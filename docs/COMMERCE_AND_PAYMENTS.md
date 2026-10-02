# Commerce & Payments

## Product Model

```
products (INDIVIDUAL_TEST | TEST_SERIES | SUBJECT_PACKAGE | EXAM_PACKAGE |
          SUBSCRIPTION | ALL_ACCESS)
  → product_prices (currency, amount, validity window)
  → product_items (points at the concrete target: test_id / test_series_id /
                    competitive_exam_id / subject_id, plus access_type,
                    attempt_limit [NULL = unlimited], access_duration_days)
```

Validation rule: a `product_items` row must supply the target column matching
its `access_type` (e.g. `access_type = INDIVIDUAL_TEST` requires `test_id`, not
`test_series_id`). Enforced at both layers: the DB `CHECK` constraint
(ADR-018, `product_items_target_matches_access_type`) and, as of Phase 9, the
same rule again in `src/validations/product.validation.ts`'s
`createProductItemSchema` (`errorCode VALIDATION_ERROR`, 422) — never allow a
product_item with an ambiguous or missing target.

**Implemented (Phase 9)**: full admin product/price/item CRUD
(`src/services/productService.ts`, `POST`/`GET`/`PUT`/`DELETE
/admin/products[/:id/prices|/:id/items]`, `product.view`/`.create`/`.update`
permissions) and student-facing browsing of ACTIVE products
(`src/services/productBrowseService.ts`, `GET /products`,
`GET /products/:productId`). Products soft-delete; prices/items hard-delete.
Every price create/update/delete is audit-logged
(action `product.price_changed`) per spec section 46 — plain product/item
CRUD is not, since it isn't in that list.

## Order Flow

```
POST /orders { productId }
  → snapshot product name + price into order_items (never re-price from a live
    product lookup after order creation)
  → orders row created with idempotency_key (unique per user)
  → status = PENDING
```

`orders` uniqueness on `(user_id, idempotency_key)` means a retried "create
order" request with the same idempotency key returns the same order rather
than creating a duplicate.

**Implemented (Phase 9)**: `POST /orders` (`src/services/orderService.ts`).
One order = one product: the current active `product_price` (the first
`is_active` row whose `valid_from`/`valid_until` window covers now) is
snapshotted into a single `order_items` row with `product_item_id = null`
(entitlement creation, once Payments/Phase 10 exists, will iterate ALL of the
product's `product_items` when granting access — an order_item points at the
*product*, not one specific item). Idempotency is enforced in the service
layer, not just the DB unique index: the same `(userId, idempotencyKey)` with
the same `productId` returns the existing order (200); the same key with a
*different* `productId` is rejected as `IDEMPOTENCY_CONFLICT` (409) rather
than silently returning the wrong order. `GET /orders` (own orders) and
`GET /orders/:orderId` (own order, `orderPolicy.ensureOwnsOrder`) round out
the student-facing flow; `GET /admin/orders`/`GET /admin/orders/:orderId`
(`order.view`) give admin browsing. Order cancellation is not implemented
(see `docs/KNOWN_ISSUES.md`).

## Payment Flow — Implemented (Phase 10)

```
PaymentGateway (interface)                    src/strategies/payment/PaymentGateway.ts
  ├── MockPaymentGateway     (dev/tests)       src/strategies/payment/MockPaymentGateway.ts
  └── RazorpayPaymentGateway (PAYMENT_PROVIDER=razorpay, ADR-039)
                                               src/strategies/payment/RazorpayPaymentGateway.ts
```

No provider-specific logic outside the concrete gateway implementation —
`src/services/paymentService.ts` depends only on the `PaymentGateway`
interface (ADR-006); `src/strategies/payment/index.ts`'s `getPaymentGateway()`
factory is the only place that knows the `PAYMENT_PROVIDER` env value.

```
POST /payments/create { orderId }
  → 409 ORDER_ALREADY_PAID if the order is already PAID; returns the
    existing PENDING payment if one already exists for this order with the
    current provider (idempotent — never creates two provider-side orders)
  → PaymentGateway.createPayment(order) → payments row (PENDING) + provider
    reference (providerOrderId), plus `checkout` = the gateway's public
    browser-checkout options (Razorpay: keyId, orderId, amount in paise,
    currency; null for mock) — never a secret

[browser] Razorpay Checkout success → POST /payments/verify   (session auth)
  { providerOrderId, providerPaymentId, signature }
   → caller must own the order
   → RazorpayPaymentGateway.confirmCheckout():
       1. signature == HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET),
          constant-time compare — else 400 PAYMENT_VERIFICATION_FAILED,
          nothing else runs
       2. GET the payment from Razorpay's API (server-to-server); it must
          belong to this Razorpay order
       3. status `authorized` → capture it; anything but `captured` → 400
   → then the same transactional path as a webhook (below), with event id
     `checkout:<payment_id>`

[external] provider webhook → POST /payments/webhook   (no session auth — the
                                                          caller is the
                                                          provider, verified
                                                          by signature)
  receive
   → PaymentGateway.verifyWebhook({ rawBody, body, headers }) — invalid
     signature is rejected (errorCode PAYMENT_WEBHOOK_INVALID, 400) before
     anything else runs, regardless of what the body claims. Razorpay:
     HMAC-SHA256 of the exact raw request bytes with RAZORPAY_WEBHOOK_SECRET
     (`X-Razorpay-Signature`); event id from `X-Razorpay-Event-Id`. Only
     `payment.captured` / `payment.failed` are acted on; other authentic
     events are acknowledged (200, status IGNORED) and nothing is recorded.
   ── everything below is ONE transaction (ADR-036) ──
   → claim the event: INSERT payment_webhook_events (status RECEIVED)
     ON CONFLICT (provider, provider_event_id) DO NOTHING. Already present
     → { alreadyProcessed: true }, nothing else touched. A concurrent
     duplicate blocks on the unique index until this transaction ends.
   → lock the payment (by providerOrderId; PAYMENT_NOT_FOUND if unknown),
     then its order (always in that order — no deadlocks)
   → re-verify amount + currency against the order's OWN stored
     total_amount/currency_code, compared in integer minor units — never
     trust the webhook body's amount blindly (errorCode
     PAYMENT_VERIFICATION_FAILED, 422, on mismatch)
   → status=FAILED: if the payment is already PAID, ignore it (event row →
     IGNORED, response status IGNORED) — out-of-order delivery must never
     un-pay. Otherwise payments row → FAILED/failedAt; order untouched.
   → status=PAID: payments row → PAID/paidAt and (if not already) orders
     row → PAID/paidAt, then
     entitlementService.createEntitlementsForPaidOrder(order, transaction)
     fans out one entitlement per product_item belonging to the order's
     product (ADR-031 — an order_item is per-product, this is where the
     fan-out to individual product_items happens), skipping any
     product_item the user already has an active entitlement for
     (idempotent per item, not just per webhook event)
   → event row → PROCESSED/processed_at; commit

   Any error rolls back all of it, including the event claim — so the
   provider's automatic retry reprocesses the event instead of being told
   "already processed". Rejections (bad amount, unknown payment) therefore
   leave no trace and are rejected again on every retry.
```

**The mock provider goes through this exact same verification path.**
`POST /payments/:paymentId/simulate` (`errorCode NOT_FOUND` unless
`PAYMENT_PROVIDER=mock` — the endpoint doesn't exist in a non-mock
configuration) requires the caller to own the payment's order
(`orderPolicy.ensureOwnsOrder`), then builds and HMAC-signs a payload with
`MockPaymentGateway.buildSignedWebhook()` and calls the real
`paymentService.processWebhook()` — not a parallel shortcut implementation.
This satisfies the acceptance-criteria flow ("purchase using mock payment →
entitlement created") end-to-end without bypassing signature/amount
verification.

**The frontend is never trusted to report payment success.** Entitlements are
only created after the server has authenticated the outcome *with the
provider*: a signature-verified webhook, or a checkout result whose
signature is verified **and** whose payment is re-fetched from Razorpay's
API (ADR-039). The browser's "it worked" alone grants nothing.

**Why both paths (Razorpay).** `/payments/verify` gives the student
instant access when they finish checkout. The webhook covers the cases
where the browser never comes back (tab closed, network lost after paying).
Whichever arrives second is a no-op — the order is already PAID and
entitlement creation is idempotent per product item.

### Razorpay setup

1. `.env`: `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET` (Dashboard → Account & Settings → API Keys). Startup
   fails if either is missing.
2. Dashboard → Webhooks → add `https://<api-host>/api/v1/payments/webhook`,
   events **payment.captured** and **payment.failed**, and a secret →
   `RAZORPAY_WEBHOOK_SECRET`. Required in production (startup fails without
   it). Locally Razorpay can't reach `localhost`, so the webhook only works
   through a tunnel (e.g. ngrok); checkout + verify work without it.
3. Test mode (`rzp_test_` keys) never moves real money; production logs a
   warning if it starts with test keys. Use Razorpay's test cards/UPI
   (`success@razorpay`) to pay.

Orders below ₹1.00 (100 paise) are rejected before calling Razorpay
(422 VALIDATION_ERROR). Razorpay API/auth failures return **502
PAYMENT_PROVIDER_ERROR**, not 401 — a 401 from this API means "your session
expired" and logs the student out; the real cause is logged server-side.

## Entitlements

```
entitlements
  user_id, product_id, order_id, product_item_id
  status (ACTIVE | EXPIRED | REVOKED)
  attempt_limit (copied from product_item at grant time), attempts_used
  valid_from, valid_until
  granted_by (webhook system, or an admin override — audited)
```

Attempt-start (`EXAM_ENGINE.md`) checks entitlement status, validity window, and
`attempts_used < attempt_limit` (or unlimited if `attempt_limit IS NULL`).
`attempts_used` increments transactionally alongside attempt creation, not as a
separate best-effort update. **Implemented and verified (Phase 7)**:
`findActiveEntitlementForTest()` (`src/services/entitlementService.ts`)
resolves `INDIVIDUAL_TEST`/`EXAM_PACKAGE`/`TEST_SERIES`/blanket
`SUBSCRIPTION`/`ALL_ACCESS` matches (not `SUBJECT_PACKAGE` — see
`docs/DECISIONS.md` ADR-026).

**Purchase-created entitlements (Phase 10)**:
`createEntitlementsForPaidOrder()` sets `order_id` to the paid order, copies
`attempt_limit`/computes `valid_until` (now + `access_duration_days`, or
`null` for unlimited) from each `product_item`, and sets `granted_by = null`
(distinguishing a system/purchase grant from an admin's `granted_by =
<adminId>`) with `metadata.source = 'PURCHASE'` — mirroring the admin path's
`metadata.source = 'ADMIN_GRANT'`. Still audit-logged as `entitlement.grant`
(with `actorId: null`) since "entitlement changes" is unconditional in spec
section 46's list, not just admin-triggered ones. Verified end-to-end
manually (product → order → payment → simulate → entitlement → attempt
unlocked) and via `tests/integration/payment.test.ts`.

## Admin Overrides — Grant Implemented (Phase 7), List/Revoke Implemented (Phase 9)

`POST /admin/entitlements` (`entitlement.grant` permission) lets an admin
grant an entitlement manually (e.g. comped access, or — until the Payment
flow exists in Phase 10 — the *only* way an entitlement backed by a real
purchase gets created, since orders currently stop at `PENDING`). Goes
through the real `entitlements` table, is idempotent (returns the existing
active entitlement rather than duplicating), sets `granted_by` to the
admin's user id, and writes an `audit_logs` entry
(action `entitlement.grant`). Given a `testId`, it finds-or-creates the
minimal `INDIVIDUAL_TEST` product/product_item needed — see ADR-025 for the
full reasoning on why this exists ahead of full Commerce, and
`docs/API.md` for the request/response shape.

**Implemented (Phase 9)**: `GET /admin/entitlements` (`entitlement.view` —
filterable by `userId`/`status`/`productId`) and `DELETE
/admin/entitlements/:id` (`entitlement.grant` — sets `status=REVOKED`,
`revoked_at=now()`; idempotent, re-revoking is a no-op with no duplicate
audit entry; audit-logged as `entitlement.revoke`). Revoking correctly
removes the test-start entitlement match: `findActiveEntitlementForTest()`
filters on `status='ACTIVE'`, so a revoked entitlement is excluded exactly
like an expired one — verified manually (grant → attempt allowed → revoke →
attempt blocked with `ENTITLEMENT_NOT_FOUND`) and in
`tests/integration/commerce.test.ts`.
