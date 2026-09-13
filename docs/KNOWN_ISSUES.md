# Known Issues

## High

(none)

## Medium

(none)

## Low

(none)

## Technical Debt

- **The `product_items` CHECK constraint still has no automated test.**
  Phase 7 added a direct test of the `attempts` partial unique index
  (`tests/integration/attempt.test.ts` — inserts two `IN_PROGRESS` rows for
  the same user/test via the model directly, asserts Postgres rejects the
  second with `SequelizeUniqueConstraintError`/code `23505`), closing that
  part of what was previously one broader "no DB constraint tests" item.
  The `product_items_target_matches_access_type` CHECK constraint (ADR-018)
  is still only verified manually (Phase 2's session notes). Add a similar
  direct test for it.
- **Session duration is a hardcoded constant**, not configurable via
  environment variable (`SESSION_DURATION_MS = 30 days` in
  `src/services/authService.ts`). Fine for now; revisit if a product
  requirement needs a different or per-role session length.
- **Only `MCQ_SINGLE` has real domain validation on create/version-create**
  (`validateOptionsForType` in `src/services/questionService.ts` — exactly
  one correct option, minimum 2 options). `MCQ_MULTI`, `TRUE_FALSE`,
  `NUMERIC`, `SHORT_TEXT`, `LONG_TEXT` accept any option shape today,
  including none at all — this matches spec section 42's explicit V1 scope
  ("MCQ_SINGLE... don't build all future types now unless required"), but
  means those types have no server-side sanity checking yet. Related: if a
  non-`MCQ_SINGLE` question does end up on a test (nothing currently stops
  it — Phase 6's `test_questions` assignment only checks `reviewStatus`),
  `submitAttempt()`'s evaluator registry (`src/strategies/evaluation/`)
  silently scores it `UNANSWERED`/0 rather than crashing, since no real
  evaluator exists for it yet. Add both the creation-time validation and the
  real evaluator together, per type, as each is actually built.
- **No admin endpoint to browse or pre-create tags.** Tags only come into
  existence as a side effect of `tags: string[]` on a question payload
  (ADR-022). Fine for V1; add `GET /admin/tags` if an admin UI ever needs a
  tag picker independent of authoring a question.
- **No entitlement list/browse/revoke endpoint** — only
  `POST /admin/entitlements` (grant) exists (ADR-025). Verify grants via a
  direct DB query for now; Phase 9 (Commerce) should add
  `GET /admin/entitlements` and a revoke action as it builds out full
  product/order management.
- **`SUBJECT_PACKAGE` entitlements grant no actual test access.**
  `findActiveEntitlementForTest()` deliberately doesn't resolve this access
  type — a test isn't scoped to one subject, so "does this test belong to
  that subject package" has no defined rule (ADR-026). A `SUBJECT_PACKAGE`
  product/entitlement can be created but won't unlock any attempt today.
- **`rank`/`percentile` are always `null`.** They're cross-attempt
  aggregates (compare one student's score against everyone else's for the
  same test) deliberately deferred to Phase 8 "Results" (ADR-027) — Phase
  7's `submitAttempt()` only ever computes one attempt's own score. A test
  with `show_rank`/`show_percentile` enabled will show these fields as
  `null` until Phase 8 backfills them.
- **`randomize_options` is not implemented.** The test config flag exists
  and is stored, but nothing shuffles an attempt's option display order —
  `GET /attempts/:id` always returns a question's options in their stored
  `display_order`. Low priority (a presentation concern, not a correctness
  one); implement alongside the student frontend if per-attempt option
  shuffling turns out to matter for anti-cheating.
- **Security test coverage has some unchecked boxes** — see
  `docs/SECURITY.md`'s "Required Security Test Coverage" list. A few items
  are implied-but-not-separately-asserted (e.g. "student cannot access
  another student's *result*" is covered by the same ownership check as
  attempts, but has no dedicated test); others aren't applicable yet
  (pricing, since Commerce doesn't exist). Close these out as the relevant
  phase makes them concrete, not by writing tests against not-yet-real
  features.
