import { ErrorCode, type ErrorCodeType } from './errorCodes';

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

/**
 * 429 with a `Retry-After` header (set by errorHandler) and the same value
 * in `errors[0].retryAfterSeconds`, so the frontend can show a countdown
 * without parsing headers.
 */
export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(ErrorCode.RATE_LIMITED, message, 429, [{ retryAfterSeconds }]);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
