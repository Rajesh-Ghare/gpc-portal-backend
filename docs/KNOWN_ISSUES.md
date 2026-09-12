# Known Issues

## High

(none)

## Medium

(none)

## Low

(none)

## Technical Debt

- **No automated test covers the database schema itself.** Phase 2's
  migrations/constraints (the partial unique index on `attempts`, the
  `product_items` CHECK constraint, full migrate-undo/reapply) were verified
  manually against a real PostgreSQL database during that session, not via
  an automated test that runs in CI. Add an integration test that runs
  migrations against a scratch test database and asserts these constraints
  actually reject bad data, so a future schema change can't silently break
  them.
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
  means those types have no server-side sanity checking yet. Add validation
  for each as its evaluation strategy is built (per `docs/EXAM_ENGINE.md`'s
  evaluator-registry design).
- **No admin endpoint to browse or pre-create tags.** Tags only come into
  existence as a side effect of `tags: string[]` on a question payload
  (ADR-022). Fine for V1; add `GET /admin/tags` if an admin UI ever needs a
  tag picker independent of authoring a question.
