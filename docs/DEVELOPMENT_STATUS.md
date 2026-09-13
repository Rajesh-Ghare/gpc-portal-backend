# Development Status

## Current Phase

Phase 8 - Results (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [x] Test builder
- [x] Exam engine
- [x] Results
- [ ] Commerce
- [ ] Payments
- [ ] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

("Results" = cross-attempt rank/percentile computation, the admin
result-release workflow, and admin browsing of any student's attempts/
results. Per-attempt scoring itself was already correct as of Phase 7 —
this phase adds the parts that only make sense once multiple students have
taken the same test.)

## Current Work

Phase 8 is complete and verified. Awaiting user confirmation before
starting Phase 9 (Commerce: full product/pricing CRUD, order flow — this
is also the natural point to add `GET /admin/entitlements` list/browse and
a revoke action, extending rather than replacing Phase 7's minimal grant
endpoint).

## Completed (Phase 8, this session)

- **Rank/percentile computation** (`src/utils/rankings.ts`'s
  `computeRankings` — a pure, unit-tested function; standard competition
  ranking with ties sharing a rank and the next rank skipping ahead,
  percentile = share of that test's evaluated attempts scoring strictly
  lower). Verified both in isolation (5 unit tests covering distinct
  scores, ties, single-entry, and empty-list edge cases) and end-to-end
  with 3 real students (1 correct/10 marks, 1 wrong/0, 1 unanswered/0):
  top scorer got rank 1 / 66.67th percentile, the tied pair both got
  rank 2 / 0th percentile — matched by hand.
- **`POST /admin/tests/:testId/results/release`** (`result.release`
  permission, `resultService.releaseResults`): recomputes rank/percentile
  for every `EVALUATED` result of a test on every call (safe to repeat as
  more students finish) and releases (`releasedAt = now()`) any not
  already released — verified idempotent on the release-timestamp side
  (`releasedCount: 0` on a second call) while rank/percentile still
  refresh. Audit-logged (`result.release` — the seventh spec-section-46
  action now covered).
- **Admin attempt/result browsing**, built as **separate serializer
  functions** from the student-facing ones (not a shared function with an
  `isAdmin` flag) per ADR-030 — closing the exact gap the Phase 7 handover
  notes flagged:
  - `GET /admin/attempts?testId=&userId=&status=` /
    `GET /admin/attempts/:id` (`attempt.view`) —
    `attemptAdminService.ts`, full detail **including**
    `is_correct`/`correct_option_id` (verified present in the response,
    unlike the student-facing endpoint which strips it).
  - `GET /admin/tests/:testId/results` / `GET /admin/results/:id`
    (`result.view`) — `resultService.ts`, full result + `result_details`
    regardless of the test's `show_*` flags (those flags only shape what a
    *student* sees of their own result).
- Verified (again) that a student is `FORBIDDEN` from every new admin
  endpoint, and that `RESULT_NOT_RELEASED` correctly blocks a student's own
  result view before an admin has released it for a non-`IMMEDIATE`
  `result_visibility` test.
- New error code: `RESULT_NOT_FOUND`.
- No new permission seeder needed — `attempt.view`, `result.view`,
  `result.release` were already seeded in Phase 1's baseline list and
  simply went unused until this phase wired them to real routes (same
  story as `question.*`/`test.*` in Phases 5/6).

### Testing

- **5 new unit tests** (`tests/unit/rankings.test.ts`): distinct-score
  ranking, tie handling (competition ranking, not dense ranking),
  percentile-as-share-scored-lower, single-entry (100th percentile), and
  empty-list.
- **6 new integration tests** (`tests/integration/results.test.ts`): result
  access blocked before release, student blocked from releasing, the full
  release→rank/percentile→idempotent-re-release flow (with the audit log
  asserted), student can view their result after release, admin attempt
  view exposes correctness data, student blocked from admin endpoints.

## In Progress

Nothing — Phase 8 scope is complete.

## Blocked

None.

## Known Issues

Updated this phase (see `docs/KNOWN_ISSUES.md`): the "rank/percentile
always null" item is resolved (computation exists now) but replaced with a
narrower one — nothing *automatically* triggers a re-release, so a test
whose ranking needs to stay fresh as new students finish requires a
periodic admin action (or a future scheduled job) rather than happening on
its own.

## Next Recommended Task

Phase 9: Commerce. Per spec sections 17/24: full `products`/`product_prices`/
`product_items` admin CRUD (Phase 7's `productRepository.ts` was
deliberately narrow — extend it, don't replace it), the student-facing
`GET /products`, order creation (`POST /orders`, idempotency-key uniqueness
already enforced at the DB level from Phase 2), and
`GET /admin/entitlements` (list/browse) + a revoke action — the two gaps
Phase 7's ADR-025 explicitly deferred to this phase. Decide the order
flow's exact snapshot behavior (order_items must snapshot product name/
price at order time, never re-read live pricing) before implementing, per
`docs/COMMERCE_AND_PAYMENTS.md`. Payments (mock provider, webhook
verification) is Phase 10, right after.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 8 (Results): a pure, unit-tested
rank/percentile computation function using standard competition ranking,
wired into an idempotent admin result-release action that also
audit-logs (the seventh spec-section-46 action covered), and admin
attempt/result browsing built as deliberately separate serializer
functions from the student-facing ones — directly following through on a
warning Phase 7's own handover notes left about not letting the
security-sensitive student path grow an "admin mode" flag. Verified
end-to-end with 3 real students producing a real tie, confirmed by hand.

## Important Files Changed

- `src/errors/errorCodes.ts` (modified — `RESULT_NOT_FOUND`)
- `src/utils/rankings.ts` (created)
- `src/repositories/{resultRepository.ts,attemptAdminRepository.ts}` (created)
- `src/services/{resultService.ts,attemptAdminService.ts}` (created)
- `src/controllers/adminExamController.ts` (created)
- `src/api/v1/routes/adminExam.routes.ts` (created)
- `src/app.ts` (modified — mounts `adminExamRouter`)
- `src/models/{Result.ts,Attempt.ts}` (modified — `user`/`test` association mixin types)
- `tests/unit/rankings.test.ts`, `tests/integration/results.test.ts` (created)
- `docs/EXAM_ENGINE.md` (Rank & Percentile section added), `docs/API.md`
  (admin attempts/results endpoints documented), `docs/AUTHENTICATION.md`
  (permission updates), `docs/SECURITY.md` (admin-view exception documented,
  coverage checklist updated), `docs/DECISIONS.md` (ADR-029, ADR-030)

## Database Changes

None (no migrations) — Phase 8 used the existing `results`/`result_details`
tables and columns (`rank`, `percentile`, `released_at`) from Phase 2 as-is.

## API Changes

Added (see `docs/API.md` for full request/response shapes):
- `GET /admin/attempts`, `GET /admin/attempts/:attemptId`
- `GET /admin/tests/:testId/results`, `GET /admin/results/:id`
- `POST /admin/tests/:testId/results/release`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/unit/rankings.test.ts` — 5 tests (this phase).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (Phase 5).
- `tests/integration/testBuilder.test.ts` — 5 tests (Phase 6).
- `tests/integration/attempt.test.ts` — 5 tests (Phase 7).
- `tests/integration/results.test.ts` — 6 tests (this phase).
- Total: 40 tests, all passing against the real test database.
- Still open: the `product_items` CHECK constraint has no automated test
  (see `docs/KNOWN_ISSUES.md`); a few Security Test Coverage checklist
  items remain implied-but-not-separately-asserted.

## Handover Notes

- **Never add an `isAdmin`/`includeCorrectness` flag to
  `attemptService.getAttemptDetail`/`getResult`.** Any future admin-facing
  attempt/result feature belongs in `attemptAdminService.ts`/
  `resultService.ts` as a new named function. This is ADR-030, written
  specifically because Phase 7 shipped (and caught) the exact bug this
  guards against.
- `POST /admin/tests/:testId/results/release` is the *only* thing that
  computes rank/percentile — there's no automatic trigger. If a future
  requirement needs rankings to stay continuously fresh (e.g. a live
  leaderboard), that's a new scheduled-job feature, not a change to
  `submitAttempt()` (ADR-027 already rejected computing it inline there).
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
