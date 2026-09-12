import type { Session } from '../models';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import {
  createOtpRequest,
  findActiveOtpRequest,
  incrementOtpAttempt,
  markOtpVerified,
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

export async function requestOtp(mobileNumber: string, requestIp: string | null) {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + env.otp.expirySeconds * 1000);

  const provider = getOtpProvider();
  const { providerRequestId } = await provider.send(mobileNumber, otp);

  await createOtpRequest({
    mobileNumber,
    purpose: OTP_PURPOSE_LOGIN,
    otpHash,
    expiresAt,
    provider: env.otp.provider,
    providerRequestId,
    requestIp,
  });

  return { expiresAt };
}

export async function verifyOtpAndCreateSession(
  mobileNumber: string,
  otp: string,
  context: { ipAddress: string | null; userAgent: string | null },
) {
  const otpRequest = await findActiveOtpRequest(mobileNumber, OTP_PURPOSE_LOGIN);
  if (!otpRequest) {
    throw new AppError(ErrorCode.AUTH_OTP_EXPIRED, 'OTP has expired or was not requested. Please request a new one.', 400);
  }

  if (otpRequest.attemptCount >= env.otp.maxAttempts) {
    throw new AppError(ErrorCode.AUTH_OTP_INVALID, 'Too many incorrect attempts. Please request a new OTP.', 400);
  }

  const isValid = await verifyOtpHash(otpRequest.otpHash, otp);
  if (!isValid) {
    await incrementOtpAttempt(otpRequest);
    throw new AppError(ErrorCode.AUTH_OTP_INVALID, 'Incorrect OTP.', 400);
  }

  await markOtpVerified(otpRequest);

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
