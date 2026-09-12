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
`test_series_id`). Enforced in the service layer (and ideally a DB check
constraint) — never allow a product_item with an ambiguous or missing target.

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

## Payment Flow

```
PaymentGateway (interface)
  ├── MockPaymentGateway   (development)
  └── <RealProvider>PaymentGateway (future — Razorpay/Stripe/etc.)
```

No provider-specific logic outside the concrete gateway implementation —
services depend only on the `PaymentGateway` interface (ADR-006).

```
POST /payments/create { orderId }
  → PaymentGateway.createPayment(order) → payments row (PENDING) + provider
    reference returned to client

[external] provider webhook → POST /payments/webhook
  receive
   → verify provider signature
   → check payment_webhook_events uniqueness (provider, provider_event_id) —
     reject/ignore duplicates
   → verify amount matches the order's total_amount
   → verify currency + order reference match
   → update payments row (status)
   → update orders row (status = PAID, paid_at)
   → create entitlements row(s) for each product_item on the order's product
   → commit
```

The mock payment provider must still go through this same webhook-shaped
verification path in a local-dev-appropriate way (e.g. a mock "confirm
payment" endpoint that simulates the provider calling the webhook with a
validly-signed mock payload) so the entitlement-creation code path is exercised
identically to production, and the acceptance-criteria flow ("Purchase using
mock payment → Entitlement created") is testable end-to-end without a shortcut
that bypasses webhook verification.

**The frontend is never trusted to report payment success.** Entitlements are
only created by the server-side webhook-verification path.

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
separate best-effort update.

## Admin Overrides

An admin may grant an entitlement manually (e.g. comped access) — this must go
through the same `entitlements` table and must be audit-logged
(`granted_by` = admin user id, plus an `audit_logs` entry).
