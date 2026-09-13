import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import * as authService from '../services/authService';

function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

export async function requestOtp(req: Request, res: Response) {
  const { mobileNumber } = req.body as { mobileNumber: string };
  const { expiresAt } = await authService.requestOtp(mobileNumber, clientIp(req));
  sendSuccess(res, { mobileNumber, expiresAt }, 'OTP sent');
}

export async function verifyOtp(req: Request, res: Response) {
  const { mobileNumber, otp } = req.body as { mobileNumber: string; otp: string };
  const { user, token } = await authService.verifyOtpAndCreateSession(mobileNumber, otp, {
    ipAddress: clientIp(req),
    userAgent: req.headers['user-agent'] ?? null,
  });

  sendSuccess(res, {
    token,
    user: {
      id: user.id,
      mobileNumber: user.mobileNumber,
      fullName: user.fullName,
      status: user.status,
    },
  });
}

export async function me(req: Request, res: Response) {
  const user = req.currentUser!;
  // Permission codes aren't on the eager-loaded `user.roles` from the
  // authenticate middleware (that would cost an extra join on every
  // request) — fetched fresh here, the same way requirePermission()
  // resolves them, since only this endpoint needs them.
  const roles = await user.getRoles({ include: [{ association: 'permissions' }] });
  const permissionCodes = [...new Set(roles.flatMap((role) => (role.permissions ?? []).map((p) => p.code)))];

  sendSuccess(res, {
    id: user.id,
    mobileNumber: user.mobileNumber,
    email: user.email,
    fullName: user.fullName,
    status: user.status,
    roles: roles.map((role) => role.code),
    permissions: permissionCodes,
  });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.currentSession!);
  sendSuccess(res, {}, 'Logged out');
}
