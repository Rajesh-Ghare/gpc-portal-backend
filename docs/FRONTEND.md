# Frontend

## Stack

React + Vite + TypeScript, React Router, TanStack Query (server state), Zustand
(client-only state, used sparingly — see ADR-004).

## Directory Structure

See `ARCHITECTURE.md`. Key rule: if data comes from the API, it lives in
TanStack Query's cache, not duplicated into a Zustand store.

## Routes (Planned per Spec)

Public:

```
/login
/verify-otp
/
/tests
/tests/:testId
```

Student:

```
/profile
/orders
/my-tests
/test/:testId
/test/:testId/instructions
/attempt/:attemptId
/attempt/:attemptId/result
```

Admin:

```
/admin
/admin/catalog
/admin/subjects
/admin/topics
/admin/questions
/admin/questions/new
/admin/questions/:id
/admin/tests
/admin/tests/new
/admin/tests/:id/builder
/admin/tests/:id/validate
/admin/products
/admin/orders
/admin/payments
/admin/students
/admin/attempts
/admin/results
/admin/ai
/admin/settings
```

None of these routes/pages exist yet as of Phase 1 — this file documents the
target, `DEVELOPMENT_STATUS.md` tracks actual progress.

## Question Renderer Registry

See `EXAM_ENGINE.md`. Lives in `src/questionTypes/`.

## Mobile-First Exam UX

The exam-taking interface must work well from 360px width up:

- Touch-friendly controls for answer selection and navigation.
- Timer always visible.
- Question navigation: sidebar on desktop, drawer/bottom sheet on mobile.
- Review marking, submit, and language switching all reachable on mobile
  without horizontal scrolling.

## Permissions on the Frontend

`src/permissions/` provides helpers to conditionally show/hide UI based on the
current user's permission codes (from `GET /auth/me`). This is a UX
convenience only — every action is re-checked server-side (`SECURITY.md`).
