import type { Transaction } from 'sequelize';
import { sequelize, type Session, type User } from '../models';
import { env } from '../config/env';
import { AppError, RateLimitError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import {
  claimOtpAttempt,
  consumeOtpRequest,
  createOtpRequest,
  expireOtpRequest,
  findActiveOtpRequest,
  findLatestOtpRequest,
  listRecentOtpRequestsForDestination,
  listRecentOtpRequestsForIp,
  lockOtpKey,
  setProviderRequestId,
  type OtpDestination,
} from '../repositories/otpRequestRepository';
import { createSession, findActiveSessionByTokenHash, revokeSession } from '../repositories/sessionRepository';
import {
  findOrCreateUserByMobileNumber,
  findOrCreateUserByVerifiedEmail,
  findUserByGoogleSub,
  findUserById,
  normalizeEmail,
  updateUser,
} from '../repositories/userRepository';
import { getOtpProvider } from '../strategies/otp';
import { getEmailProvider } from '../strategies/email';
import { getGoogleTokenVerifier } from '../strategies/google/GoogleTokenVerifier';
import {
  generateOtp,
  generateSessionToken,
  hashOtp,
  hashSessionToken,
  verifyOtp as verifyOtpHash,
} from '../utils/authTokens';

export const OTP_PURPOSE_LOGIN = 'LOGIN';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // the "per hour" in every OTP_MAX_*_PER_HOUR limit

export interface SessionContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export const smsDestination = (mobileNumber: string): OtpDestination => ({ channel: 'SMS', value: mobileNumber });
export const emailDestination = (email: string): OtpDestination => ({ channel: 'EMAIL', value: normalizeEmail(email) });

/** "this number" / "this email address" — keeps rate-limit messages accurate per channel. */
const describeDestination = (d: OtpDestination) => (d.channel === 'SMS' ? 'this number' : 'this email address');

function secondsUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));
}

function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Seconds until enough of the oldest entries (ascending `createdAt`) leave
 * the sliding window for `weightOf`'s running total to drop below `max`.
 */
function retryAfterForWindow<T extends { createdAt: Date }>(rows: T[], max: number, weightOf: (row: T) => number) {
  let total = rows.reduce((sum, row) => sum + weightOf(row), 0);
  for (const row of rows) {
    total -= weightOf(row);
    if (total < max) return secondsUntil(new Date(row.createdAt.getTime() + RATE_LIMIT_WINDOW_MS));
  }
  return secondsUntil(new Date(Date.now() + RATE_LIMIT_WINDOW_MS));
}

/**
 * Must run inside a transaction holding the destination (and IP) advisory
 * locks. The OTP_MAX_SENDS_PER_NUMBER_PER_HOUR / verify limits apply per
 * destination — a mobile number or an email address alike (ADR-035/040).
 */
async function enforceSendLimits(destination: OtpDestination, requestIp: string | null, transaction: Transaction) {
  const { resendCooldownSeconds, maxSendsPerNumberPerHour, maxSendsPerIpPerHour } = env.otp;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  if (resendCooldownSeconds > 0) {
    const latest = await findLatestOtpRequest(destination, OTP_PURPOSE_LOGIN, transaction);
    const availableAt = latest ? new Date(latest.createdAt.getTime() + resendCooldownSeconds * 1000) : null;
    if (availableAt && availableAt > new Date()) {
      const wait = secondsUntil(availableAt);
      throw new RateLimitError(`Please wait ${describeWait(wait)} before requesting another code.`, wait);
    }
  }

  if (maxSendsPerNumberPerHour > 0) {
    const recent = await listRecentOtpRequestsForDestination(destination, OTP_PURPOSE_LOGIN, since, transaction);
    if (recent.length >= maxSendsPerNumberPerHour) {
      const wait = retryAfterForWindow(recent, maxSendsPerNumberPerHour, () => 1);
      throw new RateLimitError(
        `Too many codes requested for ${describeDestination(destination)}. Try again in ${describeWait(wait)}.`,
        wait,
      );
    }
  }

  if (maxSendsPerIpPerHour > 0 && requestIp) {
    const recent = await listRecentOtpRequestsForIp(requestIp, since, transaction);
    if (recent.length >= maxSendsPerIpPerHour) {
      const wait = retryAfterForWindow(recent, maxSendsPerIpPerHour, () => 1);
      throw new RateLimitError(
        `Too many code requests from this network. Try again in ${describeWait(wait)}.`,
        wait,
      );
    }
  }
}

/**
 * Caps total verify attempts per destination across *all* its OTPs in the
 * window — without this, requesting a fresh OTP resets the per-OTP
 * OTP_MAX_ATTEMPTS cap, making a 6-digit code brute-forceable.
 */
async function enforceVerifyLimit(destination: OtpDestination, transaction: Transaction) {
  const max = env.otp.maxVerifyAttemptsPerNumberPerHour;
  if (max <= 0) return;

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recent = await listRecentOtpRequestsForDestination(destination, OTP_PURPOSE_LOGIN, since, transaction);
  const used = recent.reduce((sum, row) => sum + row.attemptCount, 0);
  if (used >= max) {
    const wait = retryAfterForWindow(recent, max, (row) => row.attemptCount);
    throw new RateLimitError(
      `Too many incorrect attempts for ${describeDestination(destination)}. Try again in ${describeWait(wait)}.`,
      wait,
    );
  }
}

const otpLockKey = (d: OtpDestination) => `otp:${OTP_PURPOSE_LOGIN}:${d.channel}:${d.value}`;
const otpIpLockKey = (ip: string) => `otp:${OTP_PURPOSE_LOGIN}:ip:${ip}`;

async function deliverOtp(destination: OtpDestination, otp: string): Promise<{ provider: string; requestId?: string }> {
  if (destination.channel === 'SMS') {
    const { providerRequestId } = await getOtpProvider().send(destination.value, otp);
    return { provider: env.otp.provider, requestId: providerRequestId };
  }

  const minutes = Math.round(env.otp.expirySeconds / 60);
  const provider = getEmailProvider();
  const { providerMessageId } = await provider.send({
    to: destination.value,
    subject: `${otp} is your GPC Exam Portal sign-in code`,
    text:
      `Your GPC Exam Portal sign-in code is ${otp}\n\n` +
      `It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.`,
    html:
      `<p>Your GPC Exam Portal sign-in code is</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:6px;margin:16px 0">${otp}</p>` +
      `<p>It expires in ${minutes} minutes. If you didn't request it, you can ignore this email.</p>`,
  });
  return { provider: provider.name, requestId: providerMessageId };
}

/** Sends a login OTP to a mobile number (SMS) or email address. Rate limited (ADR-035). */
export async function requestOtp(destination: OtpDestination, requestIp: string | null) {
  const otp = generateOtp();
  // argon2 is deliberately slow — hash before taking the locks so the
  // transaction (and its pooled connection) stays short.
  const otpHash = await hashOtp(otp);

  const otpRequest = await sequelize.transaction(async (transaction) => {
    // Always destination-then-IP, never the reverse, so concurrent requests can't deadlock.
    await lockOtpKey(otpLockKey(destination), transaction);
    if (requestIp) await lockOtpKey(otpIpLockKey(requestIp), transaction);

    await enforceSendLimits(destination, requestIp, transaction);

    return createOtpRequest(
      {
        destination,
        purpose: OTP_PURPOSE_LOGIN,
        otpHash,
        expiresAt: new Date(Date.now() + env.otp.expirySeconds * 1000),
        provider: destination.channel === 'SMS' ? env.otp.provider : env.email.provider,
        requestIp,
      },
      transaction,
    );
  });

  // Sent only after the row commits: a rate-limited request never reaches
  // the (paid) provider. If sending fails, expire the row so a previous
  // still-valid code isn't shadowed — it still counts toward the limits.
  try {
    const { requestId } = await deliverOtp(destination, otp);
    await setProviderRequestId(otpRequest, requestId);
  } catch (err) {
    await expireOtpRequest(otpRequest);
    throw err;
  }

  const resendAvailableAt = new Date(otpRequest.createdAt.getTime() + env.otp.resendCooldownSeconds * 1000);
  return { expiresAt: otpRequest.expiresAt, resendAvailableAt };
}

/** Verifies an OTP for the destination; throws on any failure. The attempt is counted atomically first. */
async function verifyOtpForDestination(destination: OtpDestination, otp: string) {
  const otpRequest = await sequelize.transaction(async (transaction) => {
    await lockOtpKey(otpLockKey(destination), transaction);
    await enforceVerifyLimit(destination, transaction);

    const active = await findActiveOtpRequest(destination, OTP_PURPOSE_LOGIN, transaction);
    if (!active) {
      throw new AppError(
        ErrorCode.AUTH_OTP_EXPIRED,
        'OTP has expired or was not requested. Please request a new one.',
        400,
      );
    }
    if (!(await claimOtpAttempt(active.id, env.otp.maxAttempts, transaction))) {
      throw new AppError(ErrorCode.AUTH_OTP_INVALID, 'Too many incorrect attempts. Please request a new OTP.', 400);
    }
    return active;
  });

  // The attempt is already counted (committed above), so this slow check
  // runs outside the transaction without opening a race.
  const isValid = await verifyOtpHash(otpRequest.otpHash, otp);
  if (!isValid) {
    throw new AppError(ErrorCode.AUTH_OTP_INVALID, 'Incorrect OTP.', 400);
  }

  if (!(await consumeOtpRequest(otpRequest.id))) {
    throw new AppError(ErrorCode.AUTH_OTP_EXPIRED, 'This OTP has already been used. Please request a new one.', 400);
  }
}

/** Shared by every sign-in method: stamps the login and issues a new opaque session token (ADR-020). */
async function issueSession(user: User, context: SessionContext) {
  user.lastLoginAt = new Date();
  await user.save();

  const rawToken = generateSessionToken();
  const session = await createSession({
    userId: user.id,
    tokenHash: hashSessionToken(rawToken),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { user, session, token: rawToken };
}

export async function verifyOtpAndCreateSession(destination: OtpDestination, otp: string, context: SessionContext) {
  await verifyOtpForDestination(destination, otp);

  if (destination.channel === 'SMS') {
    const { user } = await findOrCreateUserByMobileNumber(destination.value);
    user.isMobileVerified = true;
    return issueSession(user, context);
  }

  const { user } = await findOrCreateUserByVerifiedEmail(destination.value);
  user.isEmailVerified = true;
  return issueSession(user, context);
}

/**
 * Sign in with Google (ADR-040). The ID token is verified with Google's
 * keys and our client id as audience. Account resolution:
 *   1. a user already linked to this Google account (`google_sub`);
 *   2. else a user with the same email — linked now, but only if Google
 *      says the email is verified (otherwise anyone could create a Google
 *      account claiming someone else's address and take over theirs);
 *   3. else a new STUDENT account.
 */
export async function signInWithGoogle(credential: string, context: SessionContext) {
  const identity = await getGoogleTokenVerifier().verify(credential);
  if (!identity.emailVerified) {
    throw new AppError(
      ErrorCode.AUTH_GOOGLE_INVALID,
      'This Google account has no verified email address. Verify it with Google, or sign in with an email code instead.',
      401,
    );
  }

  const linked = await findUserByGoogleSub(identity.sub);
  if (linked) {
    return issueSession(linked, context);
  }

  const { user } = await findOrCreateUserByVerifiedEmail(identity.email, { fullName: identity.name });
  await updateUser(user, {
    googleSub: identity.sub,
    isEmailVerified: true,
    fullName: user.fullName ?? identity.name,
  });
  return issueSession(user, context);
}

export async function authenticateByToken(rawToken: string) {
  const session = await findActiveSessionByTokenHash(hashSessionToken(rawToken));
  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return null;
  }

  return { user, session };
}

export async function logout(session: Session) {
  await revokeSession(session);
}

export interface UpdateProfileInput {
  fullName?: string | null;
  contactMobileNumber?: string | null;
}

/**
 * Self-service profile fields only. `contactMobileNumber` is an optional,
 * *unverified* contact number — deliberately not `mobile_number`, which is
 * a verified login identity (ADR-040).
 */
export async function updateProfile(user: User, input: UpdateProfileInput) {
  const changes: Partial<Pick<User, 'fullName' | 'contactMobileNumber'>> = {};
  if (input.fullName !== undefined) changes.fullName = input.fullName || null;
  if (input.contactMobileNumber !== undefined) changes.contactMobileNumber = input.contactMobileNumber || null;
  return updateUser(user, changes);
}
