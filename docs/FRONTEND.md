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

## Permissions on the Frontend

`src/permissions/` is not yet populated — nothing in the Phase 12
student-facing surface is permission-gated (every student route needs only
a valid session, never a permission code; see `docs/AUTHENTICATION.md`).
This directory will matter starting Phase 13 (Admin Frontend), where
`requirePermission`-gated backend routes need corresponding UI-level
show/hide logic — still only a UX convenience, per `docs/SECURITY.md`;
every action stays re-checked server-side regardless of what the frontend
shows.

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
