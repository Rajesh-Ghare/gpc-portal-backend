import { Attempt } from '../models';

export async function countAttemptsForUserTest(userId: string, testId: string): Promise<number> {
  return Attempt.count({ where: { userId, testId } });
}

export async function findInProgressAttempt(userId: string, testId: string) {
  return Attempt.findOne({ where: { userId, testId, status: 'IN_PROGRESS' } });
}

export async function findAttemptById(id: string) {
  return Attempt.findByPk(id);
}

/**
 * `separate: true` on every nested hasMany here is load-bearing, not a
 * style choice: a single joined query 4 levels deep
 * (attemptQuestions -> questionVersion -> options -> translations)
 * produces column aliases like
 * "attemptQuestions.questionVersion.options.translations.questionOptionId",
 * which Postgres silently truncates at 63 bytes (NAMEDATALEN) to
 * "attemptQuestions.questionVersion.options.translations.questionO" — every
 * field past that point comes back with a mangled name. `separate: true`
 * runs each association as its own follow-up query instead, keeping every
 * alias short and correct.
 */
export async function findAttemptWithQuestions(id: string) {
  return Attempt.findByPk(id, {
    include: [
      {
        association: 'attemptQuestions',
        separate: true,
        order: [['sequenceNumber', 'ASC']],
        include: [
          { association: 'question' },
          {
            association: 'questionVersion',
            include: [
              { association: 'translations', separate: true },
              {
                association: 'options',
                separate: true,
                include: [{ association: 'translations', separate: true }],
              },
            ],
          },
          { association: 'answer' },
        ],
      },
    ],
  });
}
