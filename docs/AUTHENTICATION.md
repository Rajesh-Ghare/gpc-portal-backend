# Authentication & Authorization

## Status

**Implemented and verified (Phase 3)** against a real PostgreSQL database
and via `tests/integration/auth.test.ts`: request-otp, verify-otp (with
find-or-create user + default STUDENT role), `GET /auth/me`, `POST
/auth/logout`, and rejection of unauthenticated requests.

## Authentication

Primary method: **mobile number + OTP** (ADR-005). Session token format:
**opaque bearer token, SHA-256 hashed** (ADR-020, not JWT).

Flow (as implemented in `src/services/authService.ts`):

```
POST /auth/request-otp { mobileNumber }
  → generateOtp() — 6-digit code
  → hashOtp() — argon2 (see "Hashing Choices" below)
  → OtpProvider.send(mobileNumber, otp) — MockOtpProvider in dev/test
  → otp_requests row created (otp_hash, expires_at = now + OTP_EXPIRY_SECONDS,
    purpose = 'LOGIN', provider, request_ip)

POST /auth/verify-otp { mobileNumber, otp }
  → findActiveOtpRequest(mobileNumber, 'LOGIN') — latest unverified,
    unexpired row
  → reject (AUTH_OTP_EXPIRED) if none found
  → reject (AUTH_OTP_INVALID) if attempt_count >= OTP_MAX_ATTEMPTS
  → verify otp against otp_hash (argon2.verify); on failure, increment
    attempt_count and reject (AUTH_OTP_INVALID)
  → markOtpVerified()
  → findOrCreateUserByMobileNumber() — creates the user + assigns the
    STUDENT role on first login; updates last_login_at/is_mobile_verified
  → generateSessionToken() (32 random bytes, hex) + hashSessionToken()
    (SHA-256) → sessions row created (token_hash, expires_at = now + 30 days,
    ip_address, user_agent)
  → raw token returned to the client once; never persisted or logged

GET /auth/me, POST /auth/logout  (require `Authorization: Bearer <token>`)
  → authenticate middleware hashes the presented token, looks up an active
    (not revoked, not expired) session, loads the user + roles, attaches
    req.currentUser / req.currentSession
  → logout sets sessions.revoked_at = now()
```

### Hashing Choices (see ADR-020 for full rationale)

- **OTPs**: `argon2.hash()`/`argon2.verify()` — slow and salted, appropriate
  because an OTP is drawn from a tiny keyspace (6 digits) and checked only a
  handful of times per lifecycle. A fast unsalted hash would let an attacker
  with DB read access brute-force all 1,000,000 possibilities instantly.
- **Session tokens**: unsalted `SHA-256` — fast, appropriate because the raw
  token is 256 bits of random entropy (unguessable regardless of hash speed)
  and is checked on *every* authenticated request, where argon2's
  deliberate slowness would be a real performance cost.

Never swap these two.

Rules:

- Raw OTPs are never persisted or logged in plaintext by real providers;
  only `otp_hash`. (`MockOtpProvider` *does* log the plaintext OTP to the
  console and keep it in memory — this is explicitly a dev/test-only
  provider, never wired into a production environment; see
  `OTP_PROVIDER` in `.env.example`.)
- Raw session tokens are never persisted; only `token_hash`. The client
  holds the raw token; the server can always revoke by setting
  `sessions.revoked_at`.
- `otp_requests.attempt_count` (checked against `OTP_MAX_ATTEMPTS`, default
  5) and `expires_at` (checked against `OTP_EXPIRY_SECONDS`, default 300)
  enforce rate limiting/expiry server-side — verified by an integration test
  that exhausts the attempt count and confirms even the correct OTP is then
  rejected.
- Purpose is currently always `'LOGIN'` (hardcoded server-side, not
  client-supplied) — the `otp_requests.purpose` column exists to support
  future purposes (e.g. mobile-number-change verification) without a schema
  change.

## Authorization

Permission-code based (ADR-012), **not** scattered `if (role === 'ADMIN')`
checks.

```
users --(user_roles)--> roles --(role_permissions)--> permissions
```

Initial roles: `SUPER_ADMIN`, `ADMIN`, `STUDENT` (seeded — see
`docs/DATABASE.md` Seeding section). Future roles (`QUESTION_MANAGER`,
`EXAM_MANAGER`, `CONTENT_EDITOR`, `SUPPORT`, `FINANCE`) must be addable by
inserting rows, not by adding code branches.

Permission codes currently seeded (31 total): the 20 concrete examples from
spec section 25, plus 4 `catalog.*` codes added in Phase 4 for
categories/exams/series admin CRUD (ADR-021), plus 4 `subject.*` codes added
in Phase 5 for subjects/topics admin CRUD (ADR-022 — same "one shared family
per nested hierarchy" reasoning), plus `entitlement.grant` added in Phase 7
(ADR-025), plus `order.view` and `entitlement.view` added in Phase 9.
`question.*` and `test.*` (both already seeded in Phase 1's baseline list)
went unused until Phases 5 and 6 respectively wired them to real routes —
`view`/`create`/`update` gate the CRUD + versioning/section/rule endpoints,
`approve`/`reject`/`validate`/`publish`/`close` gate their namesake workflow
endpoints, and `update` is also reused to gate deletion for both families
(no separate `question.delete` or `test.delete`/`test.archive` code exists —
spec's example lists stop short of those; test archive reuses `test.close`,
see ADR-024). `product.view`/`.create`/`.update` (also already seeded in
Phase 1's baseline) went unused until Phase 9 wired them to the new
product/price/item admin CRUD — `update` is reused to gate deletion here
too (no separate `product.delete`), same pattern as `question`/`test`.
`ai.generate` (also already seeded in Phase 1's baseline) went unused until
Phase 11 wired it to the entire `/admin/ai/*` module — unlike every other
module, there's no separate `.view`/`.approve` split; one permission gates
job creation, listing, and item approve/reject alike, since the module's
scope is small enough that splitting it would add ceremony without adding
real access control granularity.
Extend as each further admin module is built.

```
question.view, question.create, question.update, question.approve, question.reject
test.view, test.create, test.update, test.validate, test.publish, test.close
product.view, product.create, product.update
payment.view
student.view
attempt.view
result.view, result.release
ai.generate
catalog.view, catalog.create, catalog.update, catalog.delete
subject.view, subject.create, subject.update, subject.delete
entitlement.grant, entitlement.view
order.view
```

`requirePermission(code)` (`src/middleware/auth.ts`) resolves the current
user's permissions via their roles (`req.currentUser.getRoles({ include:
'permissions' })`) and rejects with `FORBIDDEN` if the code is absent. It
must run *after* `authenticate` (which populates `req.currentUser`).
**Verified in Phase 4**: `src/api/v1/routes/catalog.routes.ts` is its first
real caller (all 15 category/exam/series routes), and
`tests/integration/catalog.test.ts` confirms both directions — a
`catalog.*`-less user (STUDENT) gets `FORBIDDEN`, and SUPER_ADMIN (granted
`catalog.*` via the seeders) succeeds.

**Data-scoped authorization (policies) — implemented in Phase 7.**
`src/policies/attemptPolicy.ts`'s `ensureOwnsAttempt(attempt, userId)` is
the first real policy function (`docs/ARCHITECTURE.md` described this
layer since Phase 1; nothing needed it before attempts existed). All five
student-facing attempt routes (`GET`/`PUT`/`POST .../attempts/:id...`) use
`authenticate` (any logged-in user — no permission code, since a student
has no `attempt.*` permission) plus this policy check, rather than
`requirePermission`. `attempt.view` (already seeded) is reserved for the
*admin* "view any student's attempt" use case — do not confuse the two: a
route either checks "is the caller an admin with this permission" or "does
the caller own this specific record," never both loosely combined into one
ad hoc check.

**`attempt.view`, `result.view`, `result.release` wired in Phase 8** (all
three already seeded in Phase 1's baseline list, unused until now — the
same "activate a dormant permission" pattern as `question.*`/`test.*` in
Phases 5/6): `GET /admin/attempts`, `GET /admin/attempts/:id`
(`attempt.view`), `GET /admin/tests/:testId/results`,
`GET /admin/results/:id` (`result.view`), and
`POST /admin/tests/:testId/results/release` (`result.release`). The admin
attempt/result views are **separate serializer functions** from the
student-facing ones (`attemptAdminService.ts`/`resultService.ts` vs.
`attemptService.ts`) — see ADR-030 for why a shared function with an
`isAdmin` flag was deliberately rejected.

**`src/policies/orderPolicy.ts` added in Phase 9**, a second data-scoped
policy alongside `attemptPolicy.ts`: `ensureOwnsOrder(order, userId)` gates
`GET /orders/:orderId` (any logged-in user, no permission code — the same
"policy, not permission" split as attempts). `order.view` (already seeded)
is reserved for the *admin* "browse any user's orders" use case
(`GET /admin/orders`) — do not confuse the two, same warning as
`attempt.view` above.

**`/payments/*` (Phase 10) uses no permission code at all.**
`POST /payments/create` and `POST /payments/:paymentId/simulate` reuse
`orderPolicy.ensureOwnsOrder` (via the payment's order) — same "policy, not
permission" pattern as orders/attempts. `POST /payments/webhook` uses
neither `authenticate` nor a permission — its caller is the payment
provider, authenticated by `PaymentGateway.verifyWebhook()`'s signature
check instead of a session token; this is why it's registered on
`paymentRouter` *before* that router's `.use(authenticate)` call (Express
processes routes in registration order, so a route added before a `.use()`
never runs that middleware for its own path) — see
`src/api/v1/routes/payment.routes.ts`.

**`GET /auth/me` gained a `permissions: string[]` field in Phase 13**
(flattened, deduped permission codes across all the user's roles) — added
specifically so the admin frontend can conditionally show/hide UI per
`docs/FRONTEND.md`'s originally-planned `src/permissions/` helpers, which
had no way to work before this (only role *codes* were ever returned).
Resolved the same way `requirePermission()` does
(`user.getRoles({ include: [{ association: 'permissions' }] })`), but only
on this endpoint — not added to the `authenticate` middleware's per-request
user load, which would cost an extra join on every single API call for a
value only the frontend's UI-gating needs. **This is still UX-only**: the
frontend must never treat a permission's presence in this list as
authorization to skip a server round-trip or assume an action will
succeed — `requirePermission` server-side remains the actual enforcement,
exactly as `docs/SECURITY.md` already states for the permissions list in
general.

**`student.view` activated in Phase 13** (also already seeded in Phase 1's
baseline, unused until now — same "dormant code" pattern as `question.*`/
`test.*`/`product.*`/`ai.generate` before it): `GET /admin/students?search=`
is a minimal, read-only lookup scoped to users with the STUDENT role,
matching against `mobileNumber`/`fullName`. Built specifically because the
admin entitlement-grant UI had no way to find a `userId` at all — see
`docs/API.md`'s Student Lookup section.

## Session Model

`sessions` rows back server-side revocation (logout, admin-forced logout —
the latter not yet implemented, needs an admin route in a later phase).
`expires_at` + `revoked_at` are both checked on every authenticated request
(`findActiveSessionByTokenHash` in `src/repositories/sessionRepository.ts`).
Sessions currently last 30 days from creation (`SESSION_DURATION_MS` in
`src/services/authService.ts`) — not yet configurable via environment
variable; revisit if a shorter/longer default or per-role session length is
needed.
