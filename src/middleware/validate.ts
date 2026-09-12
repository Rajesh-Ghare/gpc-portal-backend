import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        new AppError(ErrorCode.VALIDATION_ERROR, 'Validation failed', 422, result.error.issues),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}
