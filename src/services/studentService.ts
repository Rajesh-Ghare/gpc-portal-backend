import * as userRepo from '../repositories/userRepository';

/**
 * A minimal read-only student lookup — activates the `student.view`
 * permission (seeded since Phase 1, unused until now). Built for the admin
 * entitlement-grant UI (Phase 13), which had no way to find a userId at
 * all before this existed.
 */
export async function searchStudents(query?: string) {
  return userRepo.searchStudents(query);
}
