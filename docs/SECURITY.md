# Security

## Frontend Is Never Authoritative For

- Price
- Payment status
- Entitlement
- Attempt count
- Remaining time
- Question selection
- Correct answers
- Score
- Result visibility
- Permissions

Every one of these must be recomputed/re-verified server-side on every relevant
request, regardless of what the client sends or displays.

## During an Active Attempt, Never Expose to the Client

- `is_correct`
- `correct_option_id`
- answer key / correct answers
- solution / explanation
- AI generation metadata (`generated_by_ai`, `ai_provider`, `ai_model`,
  `generation_prompt_version`, etc.)

Serializers/DTOs for in-progress-attempt question payloads must explicitly
whitelist safe fields rather than passing a full Sequelize model instance to
`res.json()`.

**Admin views are an intentional, separate exception** (Phase 8, ADR-030):
`GET /admin/attempts/:id` and `GET /admin/results/:id` (`attempt.view`/
`result.view` permission, not `attemptPolicy`) do return `is_correct`/full
result detail — an admin reviewing a student's attempt for support or
moderation is allowed to see everything. This is implemented as **entirely
separate functions** (`attemptAdminService.ts`/`resultService.ts`'s admin
functions) from the student-facing ones, not a shared function with an
`isAdmin` flag — see ADR-030 for why a flag was rejected. Never make the
student-facing path admin-aware; add a new admin-only function instead.

**This was violated once, caught by manual testing, and fixed in Phase 7**:
`createAttempt()`'s success response initially returned the raw eager-loaded
Sequelize attempt (including `is_correct` on every option) instead of
routing through the same sanitizing serializer `getAttemptDetail()` uses.
There is now exactly one code path (`getAttemptDetail()`) that ever
serializes attempt-question data for a student — `createAttempt()` calls it
rather than building its own response. See `docs/DECISIONS.md` and
`docs/EXAM_ENGINE.md` for the full account; the lesson generalizes: any new
endpoint that returns attempt-question data must reuse the existing safe
serializer, never eager-load-and-return directly.

## Payment Security

See `COMMERCE_AND_PAYMENTS.md`. Webhook signature verification, event
idempotency, and amount/currency verification happen before any order/
entitlement mutation. The frontend's "payment success" callback/redirect is
never sufficient on its own to grant an entitlement.

## Authorization

Permission-code based (`AUTHENTICATION.md`), enforced by middleware on every
admin route and, where needed, by a policy check inside a service for
data-scoped access (e.g. "is this attempt/result the requesting student's
own?").

## Required Security Test Coverage (see also `TESTING.md`)

- [x] **A student cannot access another student's attempt** — verified,
      `tests/integration/attempt.test.ts` (`ensureOwnsAttempt`,
      `errorCode FORBIDDEN`).
- [ ] A student cannot access another student's result (implied by the
      above via `getResult`'s ownership check, but not separately asserted
      in a test yet).
- [x] **A student cannot access another student's order** — verified,
      `tests/integration/commerce.test.ts` (`orderPolicy.ensureOwnsOrder`,
      `errorCode FORBIDDEN`).
- [x] **A student cannot submit another student's attempt** — verified,
      same test file.
- [x] **Correct answers are never present in an in-progress-attempt API
      response** — verified for `POST /tests/:id/attempts`'s response
      (the bug described above); `GET /attempts/:id` uses the identical
      serializer so is covered by the same guarantee.
- [x] **The frontend cannot change price** — `POST /orders` only accepts
      `{ productId, idempotencyKey }`; the order's `subtotalAmount`/
      `taxAmount`/`totalAmount` are always computed server-side from the
      product's current active `product_price` row, never from any
      client-supplied amount. Verified manually (Phase 9) and via
      `tests/integration/commerce.test.ts`'s order-creation test asserting
      the returned `totalAmount` matches the seeded price, not anything the
      request could have supplied.
- [x] **The frontend cannot bypass entitlement checks to start an
      attempt** — verified, `ENTITLEMENT_NOT_FOUND` returned with no
      entitlement present.
- [ ] The frontend cannot increase its own attempt limit — `attemptLimit`
      lives only on `entitlements` (admin-set) and is never accepted from
      the attempt-creation request body, but there's no dedicated test
      asserting a forged field is ignored.
- [x] **A student cannot call admin-only APIs** — verified across Phases
      4–8 (`FORBIDDEN` from `requirePermission`), including the new Phase 8
      admin attempt/result/release endpoints.

Unchecked items above are either not yet applicable (pricing) or are
implied-but-not-separately-asserted — add explicit tests for them as the
relevant phase (9 for pricing) makes them concrete.

## Auditability

`audit_logs` rows are required for: question approval/rejection, question
version changes, test publish/close, product price changes, entitlement
changes, result release, role/permission changes, and any administrative
override. Each entry records actor, action, entity, before/after data, IP,
user agent, and a timestamp.

**Implemented (Phases 5–9)**: `src/services/auditLogService.ts` — currently
called from `question.approve`, `question.reject`,
`question.version_created` (`src/services/questionService.ts`),
`test.publish`, `test.close` (`src/services/testService.ts`),
`entitlement.grant`, `entitlement.revoke` (`src/services/entitlementService.ts`),
`result.release` (`src/services/resultService.ts`), and
`product.price_changed` (`src/services/productService.ts`, on price
create/update/delete) — exactly the nine question-bank/test/entitlement/
result/pricing actions spec section 46 calls out so far. Metadata-only
question edits, test archive, plain product/product-item CRUD, and every
catalog/subject/topic/section/question-assignment/rule/order/attempt-viewing
CRUD or read action is deliberately **not** audited — they aren't in the
spec's list. Follow this same "only the listed actions" discipline as later
phases add role/permission changes — don't audit-log everything by default.

## Secrets

- Never commit real secrets. `.env` is git-ignored; `.env.example` documents
  required variables with placeholder/empty values only.
- `system_settings` must never store secrets (per spec section 19) — secrets
  live in environment variables / a secrets manager, not the database.
- Passwords (where used at all) are hashed with `argon2`, never stored or
  logged in plaintext. OTPs and session tokens are stored only as hashes
  (`otp_hash`, `token_hash`).
