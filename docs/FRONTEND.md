# Frontend

## Stack

React + Vite + TypeScript, React Router, TanStack Query (server state), Zustand
(client-only state, used sparingly — see ADR-004). No CSS framework — plain
hand-written CSS (`src/index.css`) with light/dark CSS-variable tokens; no new
dependency was justified for this phase's scope.

## Directory Structure

See `ARCHITECTURE.md`. Key rule: if data comes from the API, it lives in
TanStack Query's cache, not duplicated into a Zustand store. **Implemented
(Phase 12)**: the only Zustand store is `src/stores/authStore.ts` (session
token + current user, persisted to `localStorage`) — exactly the one
legitimate client-only-state case, per that rule.

## Routes — Implemented (Phase 12, Student-Facing)

```
/login
/verify-otp

(everything else requires a session — spec section 2's "login before
browsing" flow — enforced by src/app/ProtectedRoute.tsx)

/                              redirects to /tests
/tests                         published test list
/tests/:testId                 test detail + instructions + "Start test"
                                (see Deviations From the Original Plan below)
/attempt/:attemptId            the exam-taking UI — no site nav (see below)
/attempt/:attemptId/result     result page
/products                      marketplace (active products)
/products/:productId           product detail + "Buy now"
/orders                        the student's own orders
/orders/:orderId                order detail + inline checkout/payment
/profile                       current user info + logout
```

## Routes — Implemented (Phase 13, Admin)

All under `AdminGuard` (requires the `ADMIN` or `SUPER_ADMIN` role — see
Permissions section below) plus `AdminLayout` (a sidebar, distinct from the
student `AppLayout`):

```
/admin                          dashboard — tiles link to each section,
                                 each tile hidden unless the user has that
                                 section's permission
/admin/catalog                  categories/exams/series (tabbed, one page)
/admin/subjects                 subjects + topics (one page, two sections)
/admin/questions                question list (filter by subject/review status)
/admin/questions/new            author a new MCQ_SINGLE question
/admin/questions/:questionId    question detail — content, approve/reject
/admin/ai                       AI generation job list + "generate" form
/admin/ai/:jobId                job detail — generated items, approve/reject
/admin/tests                    test list
/admin/tests/new                minimal test-creation form
/admin/tests/:testId            the test builder — sections/questions/rules
                                 tabs, validate/publish/close/archive actions
/admin/tests/:testId/results    per-test results + release action
/admin/results/:resultId        one student's full result + answer breakdown
/admin/products                 product list + inline create
/admin/products/:productId      product detail — prices/items CRUD
/admin/orders                   all orders (read-only)
/admin/orders/:orderId          order detail (read-only)
/admin/entitlements             entitlement list + grant form (student
                                 search + test picker) + revoke action
/admin/attempts                 all attempts (read-only)
/admin/attempts/:attemptId      full attempt detail, INCLUDING correctness
                                 (admin-only view — see ADR-030)
```

Login redirects an `ADMIN`/`SUPER_ADMIN` user straight to `/admin` instead
of `/tests` (see `VerifyOtpPage.tsx`) — the role check runs after
`GET /auth/me` resolves inside `useVerifyOtp`'s `onSuccess`, so the
redirect decision always has the full profile, not the partial one
`verify-otp` itself returns.

### Deviations From the Original (Phase 1) Plan

- **No separate `/test/:testId/instructions` route.** The originally-planned
  route was folded into `/tests/:testId` — since every student route
  requires login anyway (there's no separate "public preview" mode), a test
  and its instructions have nothing meaningful to show at two different
  URLs. `TestDetailPage` shows the description, instructions, and the
  "Start test" button together.
- **The exam-taking route (`/attempt/:attemptId`) intentionally renders
  outside the shared `AppLayout`** (no header/nav) — an active exam
  shouldn't invite the student to navigate away mid-attempt. The result
  page (`/attempt/:attemptId/result`) uses the normal layout since the exam
  is over by then.
- **`/orders/:orderId` also serves as the checkout/payment screen** — there
  is no separate `/checkout/:orderId` route. An order's payment state is
  naturally part of that order's detail page; splitting them would just add
  a redirect with no benefit given `POST /payments/create` already needs
  the order to exist first.

## Question Renderer Registry — Implemented (Phase 12)

`src/questionTypes/index.tsx` exports `questionRendererRegistry` exactly as
documented in `docs/EXAM_ENGINE.md`, plus a `getQuestionRenderer(type)`
lookup with an `MCQSingle` fallback for an unrecognized type. `AttemptPage`
looks the component up via `React.createElement(getQuestionRenderer(...), props)`
rather than binding it to a capitalized JSX-tag variable — a lint rule
(`react/static-components`) flags the latter pattern as if a new component
were being defined on every render, even though the registry only ever
returns stable, module-level component references; `createElement` sidesteps
the false positive without weakening the "always look up via the registry"
rule.

Per-type status:
- **`MCQ_SINGLE`, `TRUE_FALSE`**: fully functional (radio buttons over
  `question.options`, saved via `selectedOptionId` — `TrueFalse` is a thin
  wrapper around `MCQSingle` since they're structurally identical).
- **`NUMERIC`, `SHORT_TEXT`, `LONG_TEXT`**: functional free-text/numeric
  inputs, debounced autosave via `answerText`/`numericAnswer`.
- **`MCQ_MULTI`**: renders checkboxes and saves the selection (as a
  comma-separated list of option keys, in the generic `answerText` field —
  there's no real multi-select answer column), but is explicitly labeled in
  the UI as not yet scored, since the backend's evaluator registry has no
  real `MCQ_MULTI` scorer (`docs/KNOWN_ISSUES.md`). Nothing is silently
  lost; nothing pretends to work that doesn't.

## Mobile-First Exam UX — Implemented (Phase 12)

- The question navigator sits below the question panel on narrow screens
  (CSS grid reflow at 800px, `src/index.css`) rather than a sidebar,
  reachable without horizontal scrolling.
- The timer is always visible in the attempt header and turns red under 60
  seconds remaining.
- Touch-sized tap targets throughout (buttons, option rows, navigator grid
  cells) — no interaction requires a mouse-precision hover state.
- Not implemented as a true drawer/bottom-sheet (the doc's original
  suggestion) — a full-width reflow was sufficient and simpler; revisit if
  real usage shows the navigator needs to be collapsible on very small
  screens.

## Permissions on the Frontend — Implemented (Phase 13)

`src/permissions/index.ts`: `usePermission(code)` (a hook reading
`authStore`'s `user.permissions`) and `hasPermission(code)` (a non-hook
variant for use outside components), plus `useIsAdmin()`. This only works
because `GET /auth/me` was extended in this phase to actually return a
`permissions: string[]` field — see this repo's own `docs/AUTHENTICATION.md`
and `docs/CHANGELOG.md` for that backend addition, made specifically to
unblock this.

Used throughout the admin UI: `AdminLayout`'s sidebar hides a section's
link unless the user has that section's `.view` permission;
`AdminDashboardPage`'s tiles do the same; action buttons (approve/reject a
question, publish/close a test, release results) check the specific
permission before rendering. **Still UX-only, per `docs/SECURITY.md`** —
every one of these actions is independently re-checked server-side via
`requirePermission`; the frontend check only avoids showing a button that
would 403 anyway. `AdminGuard` (the route-level gate) checks the coarser
`ADMIN`/`SUPER_ADMIN` *role*, not a specific permission — a logged-in
`STUDENT` is redirected to `/tests` before any admin page even mounts.

## API Client — Implemented (Phase 12)

`src/services/apiClient.ts`: a single axios instance, a request interceptor
attaching `Authorization: Bearer <token>` from `authStore`, and a response
interceptor that (a) unwraps the `{ success, data }` envelope so feature
code just gets `T`, (b) normalizes every non-2xx response into a typed
`ApiError` (`errorCode`, `status`, `message`, `errors`) so callers branch on
`error.errorCode` the same way the backend's own error codes are named, and
(c) clears the session locally on a `401` so `ProtectedRoute` redirects to
`/login` on the next render rather than looping failed requests.
`src/utils/errorMessage.ts` maps the handful of error codes a student is
actually likely to hit to friendly copy; anything unmapped falls back to
the backend's own `message` string.

## Manual/Automated Verification (Phase 12)

No frontend test runner exists yet (that's Phase 14 — Testing, per the
spec's own phase order) — verification for this phase was: TypeScript
project-reference build (`tsc -b`), `oxlint`, a production `vite build`, and
**real browser end-to-end verification** driven via the Chrome DevTools
Protocol against a live backend + live Vite dev server (no
Playwright/Puppeteer installed in this project — a small one-off Node
script using Node's built-in `fetch`/`WebSocket` against a headless Edge
instance, not committed to the repo). That verification covered, with real
DOM events (not just API calls): OTP login → session persisted →
marketplace → buy → mock payment → entitlement granted → test list → start
attempt → answer a question (confirmed no correctness data present in the
rendered DOM) → submit → result page showing the correct computed score.
That pass caught and fixed one real bug: `AttemptPage`'s "N of M answered"
counter counted every question as answered regardless of whether it had
been touched (an unguarded optional-chain comparison,
`q.answer?.numericAnswer !== null`, evaluates to `true` when `q.answer`
itself is `null`) — extracted into a single `isQuestionAnswered()` helper
(`src/features/attempt/utils.ts`) shared by `AttemptPage` and
`QuestionNavigator` so the two can't diverge again.

## Manual/Automated Verification (Phase 13)

Same method as Phase 12 (`tsc -b`, `oxlint`, `vite build`, plus a
real-browser CDP walkthrough — see above). Coverage this phase, with real
DOM events and a live backend: admin login redirecting to `/admin`;
catalog category creation; subject creation; authoring and approving a
question end-to-end (published and immediately usable); the full test
builder — create test, add a section, assign an approved question,
validate, publish (`status` confirmed `PUBLISHED` via a follow-up API
call too); entitlement grant via the new student-search picker, then
revoke; an AI generation job created and one item approved into a real
published question; releasing results and opening a result's detail;
product creation and adding a price; browsing orders and confirming the
student's identity is shown; browsing attempts and confirming the
admin-only correctness view actually renders `is_correct`/selected-option
data. **Found and fixed one real backend bug along the way** (not a
frontend one this time): the admin result-detail page rendered a blank
student name because the shared `getResultOrThrow()`/`findResultById()`
never joined `user` — see this repo's own `docs/CHANGELOG.md` for the fix
(a separate `findResultByIdForAdmin()`, per ADR-030's "admin views are
separate functions" rule). Three other small backend gaps were found and
fixed *before* frontend work started once they were identified as
blockers (not via the browser pass): `GET /auth/me` missing
`permissions`, `GET /admin/orders`/`GET /admin/entitlements` missing a
`user` join, and no way at all to search for a student
(`GET /admin/students` added) — all documented in this repo's own
`docs/CHANGELOG.md` and `docs/AUTHENTICATION.md`/`docs/API.md`.
