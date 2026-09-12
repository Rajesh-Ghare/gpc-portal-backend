# Authentication & Authorization

## Authentication

Primary method: **mobile number + OTP** (ADR-005).

Flow:

```
POST /auth/request-otp { mobileNumber, purpose }
  → OtpProvider.send() generates + sends OTP
  → otp_requests row created with otp_hash (never the raw OTP), expires_at

POST /auth/verify-otp { mobileNumber, otp, purpose }
  → verify against otp_hash + expiry + attempt_count
  → find-or-create user
  → create session (sessions.token_hash, not the raw token)
  → issue JWT (or opaque session token — decide and record as an ADR before
    Phase 3 if it changes from JWT) referencing the session
```

Rules:

- Raw OTPs are never persisted; only a hash (`otp_hash`).
- Raw session tokens are never persisted; only `token_hash`. The client holds
  the raw token; the server can always revoke by clearing/expiring the session
  row.
- `otp_requests.attempt_count` and `expires_at` enforce rate limiting/expiry
  server-side; never trust a frontend "OTP valid" claim.
- `OTP_PROVIDER=mock` in development returns/logs a deterministic OTP so the
  flow is testable without SMS costs — see `docs/DEPLOYMENT.md` /
  `.env.example`.

## Authorization

Permission-code based (ADR-012), **not** scattered `if (role === 'ADMIN')`
checks.

```
users --(user_roles)--> roles --(role_permissions)--> permissions
```

Initial roles: `SUPER_ADMIN`, `ADMIN`, `STUDENT`. Future roles
(`QUESTION_MANAGER`, `EXAM_MANAGER`, `CONTENT_EDITOR`, `SUPPORT`, `FINANCE`) must
be addable by inserting rows, not by adding code branches.

Example permission codes (extend as modules are built, keep centralized in
`src/constants/permissions.ts`):

```
question.view, question.create, question.update, question.approve, question.reject
test.view, test.create, test.update, test.validate, test.publish, test.close
product.view, product.create, product.update
payment.view
student.view
attempt.view
result.view, result.release
ai.generate
```

A middleware (`requirePermission('test.publish')`) resolves the current user's
permissions (via their roles) and rejects with `FORBIDDEN` if absent. Services
needing finer-grained, data-dependent checks (e.g. "is this the student's own
attempt") use a policy function, not inline role checks.

## Session Model

`sessions` rows back server-side revocation (logout, admin-forced logout).
`expires_at` + `revoked_at` are both checked on every authenticated request.
