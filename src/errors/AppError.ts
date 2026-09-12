import type { ErrorCodeType } from './errorCodes';

export class AppError extends Error {
  readonly errorCode: ErrorCodeType;
  readonly statusCode: number;
  readonly errors: unknown[];

  constructor(errorCode: ErrorCodeType, message: string, statusCode = 400, errors: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
