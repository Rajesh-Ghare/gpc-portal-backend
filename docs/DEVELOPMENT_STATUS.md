# Development Status

## Current Phase

Phase 10 - Payments (complete, verified against real PostgreSQL + automated tests)

## Overall Progress

- [x] Project foundation
- [x] Database foundation
- [x] Authentication
- [x] Exam catalog
- [x] Question bank
- [x] Test builder
- [x] Exam engine
- [x] Results
- [x] Commerce
- [x] Payments
- [ ] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

## Current Work

Phase 10 is complete and verified. Awaiting user confirmation before
starting Phase 11 (AI: `AIService` interface + mock provider, AI-assisted
question generation jobs, admin review of generated questions before they
enter the normal question-bank approval flow).

## Completed (Phase 10, this session)

- **`PaymentGateway` interface** (`src/strategies/payment/PaymentGateway.ts`,
  ADR-006) — `createPayment(order)` and `verifyWebhook(rawBody, signature)`.
  No business logic outside the concrete gateway implementation and the
  `src/strategies/payment/index.ts` factory (`getPaymentGateway()`, selected
  by `PAYMENT_PROVIDER`) knows a provider's name or wire format — mirrors
  the existing `OtpProvider`/`getOtpProvider()` pattern exactly.
- **`MockPaymentGateway`** (`src/strategies/payment/MockPaymentGateway.ts`):
  `createPayment()` returns a fake `mock_order_<orderId>` reference;
  webhook payloads are HMAC-signed with a mock-only secret and verified for
  real — the mock provider never bypasses signature checking, it just
  doesn't call out to a real network.
- **`POST /payments/create`** (`src/services/paymentService.ts`): creates a
  PENDING `payments` row via the gateway for an order the caller owns
  (`orderPolicy.ensureOwnsOrder`). Idempotent (returns the existing PENDING
  payment on retry) and rejects an already-`PAID` order
  (`ORDER_ALREADY_PAID`, 409).
- **`POST /payments/webhook`** (no session auth — the caller is the payment
  provider, authenticated by signature, not a token): verifies the
  signature first (rejects before touching any state on failure), dedupes
  on `(provider, providerEventId)` via `payment_webhook_events`, then
  re-verifies amount/currency against the *order's own stored total* —
  never trusts the webhook body's amount blindly. Only then: one
  transaction flips `payments`→`PAID`/`paidAt` and `orders`→`PAID`/`paidAt`,
  followed by `entitlementService.createEntitlementsForPaidOrder(order)`
  fanning out one entitlement per `product_item` on the order's product
  (ADR-031's fan-out point), skipping any item the user already has an
  active entitlement for.
- **`POST /payments/:paymentId/simulate`** (dev/test-only, 404s unless
  `PAYMENT_PROVIDER=mock`): builds and HMAC-signs a webhook payload with
  `MockPaymentGateway.buildSignedWebhook()` and calls the *real*
  `processWebhook()` — not a parallel "just mark it paid" shortcut. See
  ADR-032 for why this reuse (not a separate mock-confirm code path) is
  required, not just convenient.
- **Purchase-created entitlements are marked distinctly from admin
  grants**: `grantedBy: null` + `metadata.source: 'PURCHASE'` (vs. an
  admin's `grantedBy: <adminId>` + `metadata.source: 'ADMIN_GRANT'`), and
  still audit-logged (`action: entitlement.grant`, `actorId: null`) — the
  tenth spec-section-46 action instance covered, now including a
  system-triggered (not just admin-triggered) case.
- **Full acceptance-criteria flow verified end-to-end manually against a
  live server**: browse product → create order → create payment → simulate
  webhook success → order `PAID` + entitlement created → attempt-start now
  succeeds where it previously returned `ENTITLEMENT_NOT_FOUND`. Also
  manually verified: forged/missing webhook signature rejected (state
  unchanged), validly-signed-but-tampered-amount webhook rejected (state
  unchanged), replayed webhook event ignored, cross-student ownership
  blocked on both `create` and `simulate`, `ORDER_ALREADY_PAID` on a second
  payment attempt for a paid order.
- **No new error codes or permissions needed** — `PAYMENT_NOT_FOUND`,
  `PAYMENT_VERIFICATION_FAILED`, `PAYMENT_WEBHOOK_INVALID`,
  `ORDER_ALREADY_PAID` were all already seeded/defined in earlier phases
  and simply went unused until now (same "activate a dormant code" pattern
  as `question.*`/`test.*`/`product.*` before it). No admin permission
  gates `/payments/*` — every route is either "owns this order" (policy) or
  provider-signature-verified (the webhook), matching the attempt/order
  pattern rather than the admin-CRUD pattern.
- **Deliberately NOT built this phase**: a real (non-mock) `PaymentGateway`
  implementation, raw-byte webhook signature verification (the mock
  gateway signs the parsed JSON body — documented as a gap a real
  integration must not repeat, see `docs/KNOWN_ISSUES.md`), order
  cancellation, a student-facing `GET /entitlements` view.

### Testing

- **10 new integration tests** (`tests/integration/payment.test.ts`):
  payment creation + idempotent retry, cross-student ownership rejection on
  both create and simulate, invalid-signature webhook rejection (state
  unchanged), valid-signature-wrong-amount webhook rejection (state
  unchanged), the full simulate-PAID flow (order/payment/entitlement/audit-
  log all asserted), `ORDER_ALREADY_PAID` on a second payment attempt,
  webhook-event replay dedup (exactly one `payment_webhook_events` row
  asserted), and a FAILED outcome leaving the order `PENDING`.
- Manually verified end-to-end against a live server/database first
  (including hand-crafting a validly-HMAC-signed-but-tampered payload via a
  one-off Node script to prove amount verification actually runs, not just
  signature checking) — same discipline as every prior phase.

## In Progress

Nothing — Phase 10 scope is complete.

## Blocked

None.

## Known Issues

Updated this phase (see `docs/KNOWN_ISSUES.md`): added "no real
PaymentGateway implementation," "mock gateway signs parsed body not raw
bytes" (with a warning not to copy that shortcut into a real provider), and
"no student-facing GET /entitlements view."

## Next Recommended Task

Phase 11: AI. Per spec sections 20/37: an `AIService` interface (ADR-006,
same pattern as `OtpProvider`/`PaymentGateway`) with a mock implementation,
an admin-triggered "generate questions" job
(`ai_generation_jobs`/`ai_generated_questions` tables from Phase 2 —
confirm their exact shape in `docs/DATABASE.md` before designing the
service layer), and an admin review step where generated questions must be
explicitly approved before they enter the normal question-bank workflow
(reuse `questionService.ts`'s existing approve/reject/version machinery
rather than inventing a parallel one — same "extend, don't duplicate"
discipline used for commerce). `AI_JOB_NOT_FOUND`/`AI_GENERATION_FAILED`
error codes and `ai.generate` permission are already seeded/defined and
unused, per the established pattern.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 10 (Payments): a `PaymentGateway` interface
(ADR-006) with a `MockPaymentGateway` that signs/verifies real HMAC webhook
payloads rather than bypassing verification, `POST /payments/create` and
the webhook-driven `processWebhook()` that is the *only* place an order
becomes `PAID` and entitlements get created from a purchase — signature
verification, event-replay dedup, and order-total re-verification all run
unconditionally before any mutation. `POST /payments/:paymentId/simulate`
(mock-only) routes through that exact same function rather than a parallel
shortcut (ADR-032), so the acceptance-criteria "purchase using mock payment
→ entitlement created" flow is exercised identically to how a real
provider integration would be. Verified end-to-end manually (including a
hand-signed tampered-amount payload proving the amount check isn't
decorative) and via 10 new integration tests (64 total, all passing).

## Important Files Changed

- `src/strategies/payment/{PaymentGateway.ts,MockPaymentGateway.ts,index.ts}` (created)
- `src/repositories/paymentRepository.ts` (created)
- `src/repositories/orderRepository.ts` (extended — `updateOrder`)
- `src/services/paymentService.ts` (created)
- `src/services/entitlementService.ts` (extended — `createEntitlementsForPaidOrder`)
- `src/validations/payment.validation.ts` (created)
- `src/controllers/paymentController.ts` (created)
- `src/api/v1/routes/payment.routes.ts` (created)
- `src/app.ts` (modified — mounts `paymentRouter`)
- `tests/integration/payment.test.ts` (created)
- `docs/API.md`, `docs/COMMERCE_AND_PAYMENTS.md`, `docs/SECURITY.md`,
  `docs/DECISIONS.md` (ADR-032), `docs/KNOWN_ISSUES.md`, `docs/CHANGELOG.md`

## Database Changes

None — Phase 10 used the existing `payments`/`payment_webhook_events`
tables from Phase 2 as-is (both had gone unused since their migrations ran
in Phase 2). No new migrations, no new seeders.

## API Changes

Added (see `docs/API.md` for full request/response shapes):
- `POST /payments/create`
- `POST /payments/webhook` (no session auth)
- `POST /payments/:paymentId/simulate` (mock-only)

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/unit/rankings.test.ts` — 5 tests (Phase 8).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (Phase 5).
- `tests/integration/testBuilder.test.ts` — 5 tests (Phase 6).
- `tests/integration/attempt.test.ts` — 5 tests (Phase 7).
- `tests/integration/results.test.ts` — 6 tests (Phase 8).
- `tests/integration/commerce.test.ts` — 14 tests (Phase 9).
- `tests/integration/payment.test.ts` — 10 tests (this phase).
- Total: 64 tests, all passing against the real test database.
- Still open: same items as Phase 9 (`product_items` CHECK constraint not
  tested against the raw model; a few Security Test Coverage checklist
  items remain implied-but-not-separately-asserted — see
  `docs/KNOWN_ISSUES.md`).

## Handover Notes

- **`processWebhook()` is the only place that may set `orders.status =
  'PAID'` or call `createEntitlementsForPaidOrder()`.** Never add a
  shortcut that marks an order paid from a client-facing request handler —
  see ADR-032 and `docs/SECURITY.md`'s Payment Security section for why,
  and the exact case (Phase 7's `createAttempt` leak) this project already
  learned this lesson from once.
- **The mock gateway's HMAC covers the parsed JSON body, not raw request
  bytes.** This is fine for a mock provider but is explicitly *not* a
  template for a real provider integration — a real gateway must verify
  over raw bytes per that provider's documented scheme. See
  `docs/KNOWN_ISSUES.md`.
- **`createEntitlementsForPaidOrder()` is idempotent per `product_item`,
  not per webhook event** — it's safe to call it twice for the same order
  (e.g. from a retried simulate call with a fresh `eventId`) because it
  checks for an existing active entitlement per item before creating one,
  independent of the webhook-event-level dedup that already runs earlier
  in `processWebhook()`. Both layers of idempotency are intentional and
  both are tested.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
