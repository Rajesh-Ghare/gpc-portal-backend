import type { Transaction } from 'sequelize';
import { sequelize, type Session } from '../models';
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
  listRecentOtpRequestsForIp,
  listRecentOtpRequestsForMobile,
  lockOtpKey,
  setProviderRequestId,
} from '../repositories/otpRequestRepository';
import { createSession, findActiveSessionByTokenHash, revokeSession } from '../repositories/sessionRepository';
import { findOrCreateUserByMobileNumber, findUserById } from '../repositories/userRepository';
import { getOtpProvider } from '../strategies/otp';
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

/** Must run inside a transaction holding the mobile-number (and IP) advisory locks. */
async function enforceSendLimits(mobileNumber: string, requestIp: string | null, transaction: Transaction) {
  const { resendCooldownSeconds, maxSendsPerNumberPerHour, maxSendsPerIpPerHour } = env.otp;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);

  if (resendCooldownSeconds > 0) {
    const latest = await findLatestOtpRequest(mobileNumber, OTP_PURPOSE_LOGIN, transaction);
    const availableAt = latest ? new Date(latest.createdAt.getTime() + resendCooldownSeconds * 1000) : null;
    if (availableAt && availableAt > new Date()) {
      const wait = secondsUntil(availableAt);
      throw new RateLimitError(`Please wait ${describeWait(wait)} before requesting another code.`, wait);
    }
  }

  if (maxSendsPerNumberPerHour > 0) {
    const recent = await listRecentOtpRequestsForMobile(mobileNumber, OTP_PURPOSE_LOGIN, since, transaction);
    if (recent.length >= maxSendsPerNumberPerHour) {
      const wait = retryAfterForWindow(recent, maxSendsPerNumberPerHour, () => 1);
      throw new RateLimitError(
        `Too many codes requested for this number. Try again in ${describeWait(wait)}.`,
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
 * Caps total verify attempts per number across *all* its OTPs in the window
 * — without this, requesting a fresh OTP resets the per-OTP
 * OTP_MAX_ATTEMPTS cap, making a 6-digit code brute-forceable.
 */
async function enforceVerifyLimit(mobileNumber: string, transaction: Transaction) {
  const max = env.otp.maxVerifyAttemptsPerNumberPerHour;
  if (max <= 0) return;

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recent = await listRecentOtpRequestsForMobile(mobileNumber, OTP_PURPOSE_LOGIN, since, transaction);
  const used = recent.reduce((sum, row) => sum + row.attemptCount, 0);
  if (used >= max) {
    const wait = retryAfterForWindow(recent, max, (row) => row.attemptCount);
    throw new RateLimitError(
      `Too many incorrect attempts for this number. Try again in ${describeWait(wait)}.`,
      wait,
    );
  }
}

const otpLockKey = (mobileNumber: string) => `otp:${OTP_PURPOSE_LOGIN}:mobile:${mobileNumber}`;
const otpIpLockKey = (ip: string) => `otp:${OTP_PURPOSE_LOGIN}:ip:${ip}`;

export async function requestOtp(mobileNumber: string, requestIp: string | null) {
  const otp = generateOtp();
  // argon2 is deliberately slow — hash before taking the locks so the
  // transaction (and its pooled connection) stays short.
  const otpHash = await hashOtp(otp);

  const otpRequest = await sequelize.transaction(async (transaction) => {
    // Always mobile-then-IP, never the reverse, so concurrent requests can't deadlock.
    await lockOtpKey(otpLockKey(mobileNumber), transaction);
    if (requestIp) await lockOtpKey(otpIpLockKey(requestIp), transaction);

    await enforceSendLimits(mobileNumber, requestIp, transaction);

    return createOtpRequest(
      {
        mobileNumber,
        purpose: OTP_PURPOSE_LOGIN,
        otpHash,
        expiresAt: new Date(Date.now() + env.otp.expirySeconds * 1000),
        provider: env.otp.provider,
        requestIp,
      },
      transaction,
    );
  });

  // Sent only after the row commits: a rate-limited request never reaches
  // the (paid) SMS provider. If sending fails, expire the row so a previous
  // still-valid code isn't shadowed — it still counts toward the limits.
  try {
    const { providerRequestId } = await getOtpProvider().send(mobileNumber, otp);
    await setProviderRequestId(otpRequest, providerRequestId);
  } catch (err) {
    await expireOtpRequest(otpRequest);
    throw err;
  }

  const resendAvailableAt = new Date(otpRequest.createdAt.getTime() + env.otp.resendCooldownSeconds * 1000);
  return { expiresAt: otpRequest.expiresAt, resendAvailableAt };
}

export async function verifyOtpAndCreateSession(
  mobileNumber: string,
  otp: string,
  context: { ipAddress: string | null; userAgent: string | null },
) {
  const otpRequest = await sequelize.transaction(async (transaction) => {
    await lockOtpKey(otpLockKey(mobileNumber), transaction);
    await enforceVerifyLimit(mobileNumber, transaction);

    const active = await findActiveOtpRequest(mobileNumber, OTP_PURPOSE_LOGIN, transaction);
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

  const { user } = await findOrCreateUserByMobileNumber(mobileNumber);
  user.lastLoginAt = new Date();
  user.isMobileVerified = true;
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
