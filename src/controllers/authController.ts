import type { Request, Response } from 'express';
import { env } from '../config/env';
import type { User } from '../models';
import { sendSuccess } from '../utils/apiResponse';
import * as authService from '../services/authService';

function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

function sessionContext(req: Request): authService.SessionContext {
  return { ipAddress: clientIp(req), userAgent: req.headers['user-agent'] ?? null };
}

function publicUser(user: User) {
  return {
    id: user.id,
    mobileNumber: user.mobileNumber,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
  };
}

/** Which sign-in options the login screen should show — public, no auth. */
export async function methods(_req: Request, res: Response) {
  sendSuccess(res, {
    methods: env.authMethods,
    // Public by design (it's embedded in Google's button); null when Google sign-in is off.
    googleClientId: env.authMethods.includes('google') ? env.google.clientId : null,
  });
}

export async function requestOtp(req: Request, res: Response) {
  const { mobileNumber } = req.body as { mobileNumber: string };
  const { expiresAt, resendAvailableAt } = await authService.requestOtp(
    authService.smsDestination(mobileNumber),
    clientIp(req),
  );
  sendSuccess(res, { mobileNumber, expiresAt, resendAvailableAt }, 'OTP sent');
}

export async function verifyOtp(req: Request, res: Response) {
  const { mobileNumber, otp } = req.body as { mobileNumber: string; otp: string };
  const { user, token } = await authService.verifyOtpAndCreateSession(
    authService.smsDestination(mobileNumber),
    otp,
    sessionContext(req),
  );
  sendSuccess(res, { token, user: publicUser(user) });
}

export async function requestEmailOtp(req: Request, res: Response) {
  const { email } = req.body as { email: string };
  const { expiresAt, resendAvailableAt } = await authService.requestOtp(
    authService.emailDestination(email),
    clientIp(req),
  );
  sendSuccess(res, { email, expiresAt, resendAvailableAt }, 'OTP sent');
}

export async function verifyEmailOtp(req: Request, res: Response) {
  const { email, otp } = req.body as { email: string; otp: string };
  const { user, token } = await authService.verifyOtpAndCreateSession(
    authService.emailDestination(email),
    otp,
    sessionContext(req),
  );
  sendSuccess(res, { token, user: publicUser(user) });
}

export async function google(req: Request, res: Response) {
  const { credential } = req.body as { credential: string };
  const { user, token } = await authService.signInWithGoogle(credential, sessionContext(req));
  sendSuccess(res, { token, user: publicUser(user) });
}

async function profile(user: User) {
  // Permission codes aren't on the eager-loaded `user.roles` from the
  // authenticate middleware (that would cost an extra join on every
  // request) — fetched fresh here, the same way requirePermission()
  // resolves them, since only these endpoints need them.
  const roles = await user.getRoles({ include: [{ association: 'permissions' }] });
  const permissionCodes = [...new Set(roles.flatMap((role) => (role.permissions ?? []).map((p) => p.code)))];

  return {
    ...publicUser(user),
    contactMobileNumber: user.contactMobileNumber,
    roles: roles.map((role) => role.code),
    permissions: permissionCodes,
  };
}

export async function me(req: Request, res: Response) {
  sendSuccess(res, await profile(req.currentUser!));
}

export async function updateMe(req: Request, res: Response) {
  const user = await authService.updateProfile(req.currentUser!, req.body);
  sendSuccess(res, await profile(user), 'Profile updated');
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.currentSession!);
  sendSuccess(res, {}, 'Logged out');
}
