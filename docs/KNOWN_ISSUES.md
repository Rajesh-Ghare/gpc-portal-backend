# Known Issues

## High

(none)

## Medium

(none)

## Low

(none)

## Technical Debt

- **The `product_items` DB-level CHECK constraint still has no automated
  test against the raw model** (only the app-layer duplicate of the same
  rule, in `createProductItemSchema`, is test-covered —
  `tests/integration/commerce.test.ts`). Phase 7 added a direct test of the
  `attempts` partial unique index (`tests/integration/attempt.test.ts` —
  inserts two `IN_PROGRESS` rows for the same user/test via the model
  directly, asserts Postgres rejects the second with
  `SequelizeUniqueConstraintError`/code `23505`); the
  `product_items_target_matches_access_type` CHECK constraint (ADR-018)
  itself is still only verified manually (Phase 2's session notes) plus
  indirectly via the schema validation Phase 9 added in front of it. Add a
  test that bypasses the schema and inserts directly via `ProductItem.create`
  with a mismatched target, asserting Postgres — not Zod — rejects it.
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
- **Order cancellation is not implemented.** An order created via
  `POST /orders` stays `PENDING` forever if the customer abandons checkout
  and never pays — there's no `POST /orders/:id/cancel` and no expiry job.
  Low priority: nothing currently depends on a `PENDING` order ever
  changing state on its own; revisit once "abandoned checkout" cleanup
  actually matters (e.g. for reporting/inventory reasons a real product
  might need).
- **No pagination on any Phase 9/10 list endpoint** (`GET /products`,
  `GET /orders`, `GET /admin/orders`, `GET /admin/entitlements`,
  `GET /admin/products`) — same gap as every other list endpoint built so
  far (`docs/API.md`'s Conventions section documents the intended
  `page`/`pageSize` shape, but no endpoint implements it yet). Fine at
  current data volumes; add pagination as a cross-cutting pass once any
  list endpoint's result set could realistically grow unbounded.
- **No real (non-mock) `PaymentGateway` implementation exists yet.** Only
  `MockPaymentGateway` is wired up (`PAYMENT_PROVIDER=mock`); a real
  provider (Razorpay/Stripe/etc.) needs its own class behind the same
  interface plus real webhook signature verification per that provider's
  documented scheme (see the raw-body-vs-parsed-body note below).
- **The mock payment gateway signs the parsed JSON body, not raw request
  bytes.** Adequate for local dev/tests (there's no real network hop to
  introduce re-serialization drift), but a real provider integration
  typically requires verifying an HMAC over the exact raw bytes received,
  since JSON.stringify-ing a parsed body is not guaranteed to reproduce the
  original wire bytes. Don't copy the mock gateway's approach when building
  a real one — see ADR-032's Consequences.
- **No `GET /entitlements` student-facing "my entitlements" view.** A
  student can infer purchase success from `GET /orders/:id`'s `status`
  field, but there's no endpoint listing what they currently have access
  to. Low priority for the backend; add it if/when the student frontend
  needs a "my purchases/access" screen.
- **`SUBJECT_PACKAGE` entitlements grant no actual test access.**
  `findActiveEntitlementForTest()` deliberately doesn't resolve this access
  type — a test isn't scoped to one subject, so "does this test belong to
  that subject package" has no defined rule (ADR-026). A `SUBJECT_PACKAGE`
  product/entitlement can be created but won't unlock any attempt today.
- **`rank`/`percentile` require an explicit admin action to compute** —
  they're never automatic. `POST /admin/tests/:testId/results/release`
  (Phase 8, ADR-029) computes them for every evaluated result of a test,
  but nothing triggers this on its own — e.g. for an `IMMEDIATE`-visibility
  test where new students keep finishing over time, an admin must
  re-call `release` periodically for `rank`/`percentile` to reflect
  recent attempts (`released_at` itself won't change on a re-call, only
  the rank/percentile values do). Consider a scheduled job if a test's
  ranking needs to stay continuously fresh without manual action.
- **`randomize_options` is not implemented.** The test config flag exists
  and is stored, but nothing shuffles an attempt's option display order —
  `GET /attempts/:id` always returns a question's options in their stored
  `display_order`. Low priority (a presentation concern, not a correctness
  one); implement alongside the student frontend if per-attempt option
  shuffling turns out to matter for anti-cheating.
- **Security test coverage has some unchecked boxes** — see
  `docs/SECURITY.md`'s "Required Security Test Coverage" list. Remaining
  items are implied-but-not-separately-asserted (e.g. "student cannot
  access another student's *result*" is covered by the same ownership check
  as attempts, but has no dedicated test) rather than not-yet-applicable —
  the pricing item was closed out in Phase 9. Close the rest out as the
  relevant phase makes them concrete, not by writing tests against
  not-yet-real features.
