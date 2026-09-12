import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { authenticateByToken } from '../services/authService';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length).trim() || null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    next(new AppError(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required', 401));
    return;
  }

  const result = await authenticateByToken(token);
  if (!result) {
    next(new AppError(ErrorCode.AUTH_UNAUTHORIZED, 'Invalid or expired session', 401));
    return;
  }

  req.currentUser = result.user;
  req.currentSession = result.session;
  next();
}

/**
 * Resolves the current user's permission codes (via their roles) and
 * rejects with FORBIDDEN if the required one is absent. Must run after
 * `authenticate`. See docs/AUTHENTICATION.md — permission-code based
 * authorization, never inline role checks.
 */
export function requirePermission(code: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      next(new AppError(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required', 401));
      return;
    }

    const roles = await req.currentUser.getRoles({ include: [{ association: 'permissions' }] });
    const hasPermission = roles.some((role) => (role.permissions ?? []).some((p) => p.code === code));

    if (!hasPermission) {
      next(new AppError(ErrorCode.FORBIDDEN, `Missing required permission: ${code}`, 403));
      return;
    }

    next();
  };
}
