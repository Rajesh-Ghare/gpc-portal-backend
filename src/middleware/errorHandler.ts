import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { sendError } from '../utils/apiResponse';

export function notFoundHandler(req: Request, res: Response) {
  sendError(res, ErrorCode.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    sendError(res, err.errorCode, err.message, err.statusCode, err.errors);
    return;
  }

  console.error(err);
  sendError(res, ErrorCode.INTERNAL_ERROR, 'Something went wrong', 500);
}
