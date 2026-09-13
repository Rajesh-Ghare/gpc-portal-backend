import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import type { Attempt } from '../models';

/**
 * Data-scoped authorization ("is this the student's own attempt?"), not a
 * permission code — see docs/AUTHENTICATION.md. Every attempt-facing
 * service call must run this before reading or mutating attempt data.
 */
export function ensureOwnsAttempt(attempt: Attempt, userId: string) {
  if (attempt.userId !== userId) {
    throw new AppError(ErrorCode.FORBIDDEN, 'You do not have access to this attempt', 403);
  }
}
