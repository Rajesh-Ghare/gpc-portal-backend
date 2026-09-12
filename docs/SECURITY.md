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

- A student cannot access another student's attempt.
- A student cannot access another student's result.
- A student cannot submit another student's attempt.
- Correct answers are never present in an in-progress-attempt API response.
- The frontend cannot change price (server re-reads `product_prices`, ignores
  any client-supplied amount).
- The frontend cannot bypass entitlement checks to start an attempt.
- The frontend cannot increase its own attempt limit.
- A student cannot call admin-only APIs (permission middleware rejects with
  `FORBIDDEN`).

## Auditability

`audit_logs` rows are required for: question approval/rejection, question
version changes, test publish/close, product price changes, entitlement
changes, result release, role/permission changes, and any administrative
override. Each entry records actor, action, entity, before/after data, IP,
user agent, and a timestamp.

**Implemented (Phases 5–6)**: `src/services/auditLogService.ts` — currently
called from `question.approve`, `question.reject`,
`question.version_created` (`src/services/questionService.ts`), and
`test.publish`, `test.close` (`src/services/testService.ts`) — exactly the
five question-bank/test actions spec section 46 calls out. Metadata-only
question edits, test archive, and every catalog/subject/topic/section/
question-assignment/rule CRUD action are deliberately **not** audited —
they aren't in the spec's list. Follow this same "only the listed actions"
discipline as later phases add price changes, entitlement changes, result
release, and role/permission changes — don't audit-log everything by
default.

## Secrets

- Never commit real secrets. `.env` is git-ignored; `.env.example` documents
  required variables with placeholder/empty values only.
- `system_settings` must never store secrets (per spec section 19) — secrets
  live in environment variables / a secrets manager, not the database.
- Passwords (where used at all) are hashed with `argon2`, never stored or
  logged in plaintext. OTPs and session tokens are stored only as hashes
  (`otp_hash`, `token_hash`).
