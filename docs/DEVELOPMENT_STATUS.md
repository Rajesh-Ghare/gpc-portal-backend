# Development Status

## Current Phase

Phase 9 - Commerce (complete, verified against real PostgreSQL + automated tests)

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
- [ ] Payments
- [ ] AI
- [ ] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

## Current Work

Phase 9 is complete and verified. Awaiting user confirmation before starting
Phase 10 (Payments: `PaymentGateway` interface + mock provider, webhook
verification, order → PAID transition, entitlement creation from a paid
order's product).

## Completed (Phase 9, this session)

- **Admin product/price/item CRUD** (`src/services/productService.ts`,
  extending — not replacing — Phase 7's deliberately narrow
  `productRepository.ts`, per ADR-025's explicit handover note): full
  create/list/get/update/soft-delete for products; create/list/update/
  delete for prices; create/list/delete for items. Slug auto-generation +
  duplicate-slug rejection, matching the catalog/question/test pattern.
  Every price create/update/delete writes an `audit_logs` row (action
  `product.price_changed`) — the ninth spec-section-46 action now covered.
- **Product-item target validation duplicated at the service layer**
  (`src/validations/product.validation.ts`'s `createProductItemSchema`),
  matching the DB `CHECK` constraint from ADR-018 rule-for-rule, per the
  spec's explicit "validate at the application layer too" requirement.
  Verified both a passing SUBSCRIPTION item (no target columns) and a
  rejected EXAM_PACKAGE-with-testId mismatch.
- **Student-facing product browsing** (`src/services/productBrowseService.ts`,
  `GET /products`, `GET /products/:productId`) — ACTIVE + `isActive` products
  only, mirroring `testBrowseService.ts`'s published-test scoping.
- **Order creation** (`src/services/orderService.ts`, `POST /orders`):
  one order = one product, snapshotting the product's name and current
  active `product_price` into a single `order_items` row
  (`product_item_id = null` — see ADR-031 for why per-product, not
  per-`product_item`). Idempotent on `(userId, idempotencyKey)`: a repeat
  with the same `productId` returns the existing order (200); a repeat with
  a *different* `productId` is rejected as `IDEMPOTENCY_CONFLICT` (409).
  `GET /orders` (own orders) and `GET /orders/:orderId`
  (`orderPolicy.ensureOwnsOrder`, `errorCode FORBIDDEN` cross-student) round
  out the student flow; `GET /admin/orders`/`GET /admin/orders/:orderId`
  (`order.view`) give admin browsing.
- **Closed the Phase 7 (ADR-025) entitlement gap**: `GET /admin/entitlements`
  (`entitlement.view`, filterable by `userId`/`status`/`productId`) and
  `DELETE /admin/entitlements/:id` (`entitlement.grant`, sets
  `status=REVOKED`/`revokedAt`, idempotent — re-revoking is a no-op with no
  duplicate audit entry). Verified end-to-end that a revoke actually blocks
  a subsequent attempt-start (`findActiveEntitlementForTest` filters on
  `status='ACTIVE'`, so a revoked row is excluded exactly like an expired
  one) — `ENTITLEMENT_NOT_FOUND` returned as expected.
- **New error code**: `PRODUCT_NOT_FOUND`.
- **New permissions** (seeder `20260913100010-commerce-permissions.js`, run
  against both dev and test databases): `order.view`, `entitlement.view`.
  `product.view`/`.create`/`.update` (already seeded in Phase 1's baseline,
  unused until now) activate the same way `question.*`/`test.*` did in
  Phases 5/6.
- **Deliberately NOT built this phase** (per the spec's own phase split):
  `PaymentGateway` interface, mock payment provider, `POST /payments/create`,
  `POST /payments/webhook`, order cancellation. These are Phase 10 (or, for
  cancellation, an explicit future item — see `docs/KNOWN_ISSUES.md`).

### Testing

- **14 new integration tests** (`tests/integration/commerce.test.ts`):
  student blocked from creating a product, product create + duplicate-slug
  rejection, price create with audit-log assertion, product-item
  target-mismatch rejection (422) and a valid SUBSCRIPTION item, student
  product browsing, order creation + idempotent retry (same key/product),
  idempotency conflict (same key/different product), cross-student order
  access denial, student blocked from admin order/entitlement endpoints,
  admin order listing, entitlement grant→list→idempotent-revoke with a
  single audit-log row asserted.
- Manually verified end-to-end against a live server/database first,
  including the full product→price→item→browse→order→idempotency→
  entitlement-revoke→attempt-blocked chain, before writing the automated
  tests — same discipline as every prior phase.

## In Progress

Nothing — Phase 9 scope is complete.

## Blocked

None.

## Known Issues

Updated this phase (see `docs/KNOWN_ISSUES.md`): the "no entitlement
list/browse/revoke endpoint" item is resolved; added "order cancellation
not implemented" and "no pagination on Phase 9 list endpoints" as new,
low-priority items; narrowed the `product_items` CHECK-constraint testing
gap to specifically "not tested against the raw model" (the app-layer
duplicate of the same rule is now tested).

## Next Recommended Task

Phase 10: Payments. Per spec sections 18/24: a `PaymentGateway` interface
(ADR-006) with a `MockPaymentGateway` implementation, `POST
/payments/create` (creates a `payments` row PENDING + a provider reference
for an order), and `POST /payments/webhook` (signature verification, event
idempotency via `payment_webhook_events`, amount/currency verification
against the order's `total_amount`, order → `PAID`/`paid_at`, and — this is
the part that finally makes orders do something — entitlement creation for
every `product_item` belonging to the paid order's product). The mock
gateway must still go through a webhook-shaped confirmation path (a
"simulate provider webhook" endpoint), not a shortcut, so the
acceptance-criteria flow ("purchase using mock payment → entitlement
created") is testable end-to-end without bypassing verification — see
`docs/COMMERCE_AND_PAYMENTS.md`'s Payment Flow section for the exact
sequence already documented.

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 9 (Commerce): full admin product/price/item
CRUD extending Phase 7's deliberately narrow `productRepository.ts`
(ADR-025's explicit handover instruction), student-facing product browsing,
an idempotent single-product order-creation flow with server-computed
pricing (ADR-031 documents why `order_items` is per-product, not
per-`product_item`), and the entitlement list/revoke endpoints Phase 7
explicitly deferred here — verified end-to-end that revoking an entitlement
actually blocks a subsequent attempt-start. Every product-price change is
audit-logged (the ninth spec-section-46 action). Payments (mock gateway +
webhook-verified entitlement creation) is next.

## Important Files Changed

- `src/errors/errorCodes.ts` (modified — `PRODUCT_NOT_FOUND`)
- `src/models/{Product.ts,Order.ts,Entitlement.ts}` (modified — `NonAttribute`
  association declarations for `prices`/`items`/`product`/`productItem`)
- `src/repositories/productRepository.ts` (extended — product + item CRUD
  added alongside the existing Phase 7 functions)
- `src/repositories/{productPriceRepository.ts,orderRepository.ts}` (created)
- `src/repositories/entitlementRepository.ts` (extended — list/revoke)
- `src/services/{productService.ts,productBrowseService.ts,orderService.ts}` (created)
- `src/services/entitlementService.ts` (extended — list/revoke)
- `src/validations/{product.validation.ts,order.validation.ts}` (created)
- `src/policies/orderPolicy.ts` (created)
- `src/controllers/{productController.ts,productBrowseController.ts,orderController.ts}` (created)
- `src/controllers/entitlementController.ts` (extended — list/revoke)
- `src/api/v1/routes/adminCommerce.routes.ts` (created)
- `src/api/v1/routes/entitlement.routes.ts`, `src/api/v1/routes/student.routes.ts` (modified)
- `src/app.ts` (modified — mounts `adminCommerceRouter`)
- `src/seeders/20260913100010-commerce-permissions.js` (created — `order.view`, `entitlement.view`)
- `tests/integration/commerce.test.ts` (created)
- `docs/API.md`, `docs/COMMERCE_AND_PAYMENTS.md`, `docs/AUTHENTICATION.md`,
  `docs/SECURITY.md`, `docs/DECISIONS.md` (ADR-031), `docs/KNOWN_ISSUES.md`,
  `docs/CHANGELOG.md`

## Database Changes

None (no migrations) — Phase 9 used the existing `products`/`product_prices`/
`product_items`/`orders`/`order_items`/`entitlements` tables from Phase 2
as-is. One new seeder for the two new permission codes.

## API Changes

Added (see `docs/API.md` for full request/response shapes):
- `GET/POST /admin/products`, `GET/PUT/DELETE /admin/products/:id`
- `GET/POST /admin/products/:id/prices`, `PUT/DELETE /admin/products/:id/prices/:priceId`
- `GET/POST /admin/products/:id/items`, `DELETE /admin/products/:id/items/:itemId`
- `GET /admin/orders`, `GET /admin/orders/:orderId`
- `GET /products`, `GET /products/:productId`
- `POST /orders`, `GET /orders`, `GET /orders/:orderId`
- `GET /admin/entitlements`, `DELETE /admin/entitlements/:id`

## Testing Status

- `tests/unit/app.test.ts` — 1 test (`/health`).
- `tests/unit/rankings.test.ts` — 5 tests (Phase 8).
- `tests/integration/auth.test.ts` — 5 tests (Phase 3).
- `tests/integration/catalog.test.ts` — 6 tests (Phase 4).
- `tests/integration/questionBank.test.ts` — 7 tests (Phase 5).
- `tests/integration/testBuilder.test.ts` — 5 tests (Phase 6).
- `tests/integration/attempt.test.ts` — 5 tests (Phase 7).
- `tests/integration/results.test.ts` — 6 tests (Phase 8).
- `tests/integration/commerce.test.ts` — 14 tests (this phase).
- Total: 54 tests, all passing against the real test database.
- Still open: the `product_items` CHECK constraint has no test against the
  raw model bypassing the app-layer schema (see `docs/KNOWN_ISSUES.md`); a
  few Security Test Coverage checklist items remain
  implied-but-not-separately-asserted.

## Handover Notes

- **`order_items` is one row per product, not one per `product_item`.**
  See ADR-031. Phase 10's payment-confirmation → entitlement-creation code
  must resolve `order_item.product_id` → all of that product's
  `product_items` itself; don't assume a 1:1 `order_item`↔`product_item`
  mapping.
- **`createOrder()` never re-reads price at any point after order
  creation.** The order's `subtotalAmount`/`taxAmount`/`totalAmount` are
  frozen at creation time from whatever `product_prices` row was active
  then. Phase 10's payment verification must check the *order's* stored
  `totalAmount` against the payment provider's amount — never re-derive a
  fresh price from the product at payment time.
- **Product-item target validation exists in two places on purpose**
  (`createProductItemSchema`'s `superRefine` and the DB `CHECK`
  constraint) — keep both in sync if `access_type`'s target-column mapping
  ever changes (e.g. a new access type is added).
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
