import type { NextFunction, Request, Response } from 'express';
import { env, type AuthMethod } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';

/**
 * Blocks a sign-in endpoint when its method isn't enabled (AUTH_METHODS,
 * ADR-040). Hiding a button isn't enough — a disabled method must not be
 * callable directly either.
 */
export function requireAuthMethod(method: AuthMethod) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (!env.authMethods.includes(method)) {
      next(new AppError(ErrorCode.AUTH_METHOD_DISABLED, 'This sign-in method is not available.', 404));
      return;
    }
    next();
  };
}
