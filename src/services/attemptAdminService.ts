import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as attemptRepo from '../repositories/attemptRepository';
import * as attemptAdminRepo from '../repositories/attemptAdminRepository';

/**
 * Admin view of an attempt — deliberately a separate function from
 * attemptService.getAttemptDetail, which is the security-sensitive
 * student-facing serializer that must never expose correctness data
 * (see docs/SECURITY.md, docs/DECISIONS.md ADR-028's sibling bug). An
 * admin reviewing a student's attempt for support/moderation purposes is
 * allowed to see everything, including is_correct/correct_option_id —
 * this function returns the full eager-loaded attempt as-is rather than
 * stripping it.
 */
export async function getAttemptDetailForAdmin(id: string) {
  const attempt = await attemptRepo.findAttemptWithQuestions(id);
  if (!attempt) {
    throw new AppError(ErrorCode.ATTEMPT_NOT_FOUND, 'Attempt not found', 404);
  }
  return attempt;
}

export async function listAttempts(filter: attemptAdminRepo.AttemptFilter = {}) {
  return attemptAdminRepo.listAttempts(filter);
}
