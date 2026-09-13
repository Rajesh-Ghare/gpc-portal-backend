# Development Status

## Current Phase

Phase 12 - Student Frontend (complete, verified against the real backend API
via typecheck/lint/build and real-browser end-to-end automation)

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
- [x] Payments
- [x] AI
- [x] Student frontend
- [ ] Admin frontend
- [ ] Testing
- [ ] Deployment

## Current Work

Phase 12 is complete and verified. Awaiting user confirmation before
starting Phase 13 (Admin Frontend) — the full admin authoring/review
surface (catalog, question bank incl. AI review, test builder, commerce,
results, entitlements) already exists as a backend API (`docs/API.md`);
this next phase builds the UI against it, in `gpc-portal-frontend`'s
`src/features/admin/*` (per `docs/ARCHITECTURE.md`'s planned structure) and
finally puts `src/permissions/` to real use.

## Completed (Phase 12, this session)

Code lives in the **`gpc-portal-frontend`** repo (this repo only gained one
small enabling fix — see below). All work is against the real backend API;
no mock/stub data layer exists anywhere in the frontend.

- **App shell**: `src/app/{App.tsx,router.tsx,AppLayout.tsx,
  ProtectedRoute.tsx,queryClient.ts}` — React Router route tree,
  TanStack Query client, a shared header/nav layout, and a
  `ProtectedRoute` that redirects to `/login` when there's no session
  (every student route requires login per spec section 2 — there's no
  public preview mode).
- **API client** (`src/services/apiClient.ts`): one axios instance,
  request interceptor attaching the bearer token, response interceptor
  unwrapping the `{ success, data }` envelope and normalizing errors into
  a typed `ApiError` (`errorCode`/`status`/`message`), and a 401 handler
  that clears the local session so `ProtectedRoute` naturally redirects.
- **Auth** (`src/features/auth/`): OTP request/verify flow, session
  persisted via the one legitimate Zustand store
  (`src/stores/authStore.ts`, `localStorage`-backed), a profile page with
  logout.
- **Test browsing** (`src/features/tests/`): published test list and a
  detail page that folds in instructions + "Start test" (see
  `docs/FRONTEND.md`'s Deviations section for why there's no separate
  instructions route).
- **Exam-taking UI** (`src/features/attempt/`) — the most complex piece:
  a full-screen (no site nav) attempt page with a server-expiry-driven
  countdown timer (`useCountdown`, ticks against the fixed `expiresAt`
  the server issued, auto-submits on reaching zero), a question navigator
  showing answered/marked/unvisited status, autosave on every answer
  change (debounced for free-text/numeric types), mark-for-review, and a
  confirm-before-submit action. `GET /attempts/:id`'s response is polled
  every 20s while `IN_PROGRESS` as a resync safety net — the server
  remains authoritative throughout, per `docs/EXAM_ENGINE.md`.
- **Question renderer registry** (`src/questionTypes/`): implemented
  exactly as documented in `docs/EXAM_ENGINE.md` — `MCQSingle`/`TrueFalse`
  fully functional, `NUMERIC`/`SHORT_TEXT`/`LONG_TEXT` functional
  free-text inputs, `MCQ_MULTI` honestly labeled as not-yet-scored (see
  `docs/KNOWN_ISSUES.md`) rather than silently broken.
- **Results** (`src/features/attempt/AttemptResultPage.tsx`): renders
  whichever fields the test's `show_*` flags actually returned (per
  `docs/API.md`'s conditional result shape), including rank/percentile
  and per-question answer review when present.
- **Marketplace + commerce** (`src/features/products/`,
  `src/features/orders/`, `src/features/payments/`): product browsing,
  an order-detail page that doubles as the checkout screen (create
  payment → **mock-provider simulate success/failure buttons**, clearly
  labeled as a dev-only mock provider control, calling the real
  `POST /payments/:paymentId/simulate` — see `docs/COMMERCE_AND_PAYMENTS.md`),
  and "my orders" history.
- **Backend enabling fix** (this repo, `gpc-portal-backend`): `GET
  /attempts/:id` never returned each question's `questionType`, which the
  renderer registry needs. Fixed in `attemptRepository.ts`/
  `attemptService.ts` — see this repo's own CHANGELOG "Fixed" entry and
  `tests/integration/attempt.test.ts`'s new assertion. Found while
  starting this phase, fixed and pushed as its own small commit before
  frontend work began.

### Verification

No frontend test runner exists yet (Phase 14). Verification for this phase:
- `tsc -b` (TypeScript project references) — clean.
- `oxlint` — clean (a few real warnings surfaced during development were
  fixed, not suppressed: two "accessing a ref during render" issues in
  `useCountdown`/`useDebouncedCallback` fixed by moving the ref sync into
  an effect; a "components created during render" false positive for the
  question-renderer lookup fixed by using `createElement` instead of
  binding to a capitalized JSX-tag variable; an unnecessary `useMemo`
  dependency removed).
- `vite build` — clean production build.
- **Real browser end-to-end verification** driven via the Chrome DevTools
  Protocol against the live backend + live Vite dev server (see
  `docs/FRONTEND.md`'s Manual/Automated Verification section for the exact
  method — no Playwright/Puppeteer in this project, a small uncommitted
  Node script using native `fetch`/`WebSocket` against headless Edge).
  Covered, with real DOM events: OTP login → session persisted →
  marketplace → buy → mock payment → entitlement granted → test list →
  start attempt → answer a question (confirmed no correctness data in the
  rendered DOM) → submit → correct computed score on the result page.
  **This caught and fixed one real bug**: the attempt page's "N of M
  answered" counter counted every question as answered regardless of
  whether it had actually been touched, due to an unguarded optional-chain
  comparison (`q.answer?.numericAnswer !== null` is `true` when `q.answer`
  itself is `null`) — fixed by extracting a single `isQuestionAnswered()`
  helper shared by the two places that needed this check, so they can't
  diverge again.

## In Progress

Nothing — Phase 12 scope is complete.

## Blocked

None.

## Known Issues

Updated this phase (see `docs/KNOWN_ISSUES.md`): cross-referenced the
existing "only MCQ_SINGLE has real domain validation" item with how the
Phase 12 frontend surfaces that limitation honestly rather than hiding it.

## Next Recommended Task

Phase 13: Admin Frontend. The backend's admin API surface is already
complete (catalog, question bank + AI review, test builder, commerce,
payments browsing, results, entitlements — all of `docs/API.md`'s
`/admin/*` routes). Build `gpc-portal-frontend`'s admin UI against it,
following the same "real API, no mocks" discipline as Phase 12, and
finally populate `src/permissions/` with real permission-code-based
show/hide helpers (still UX-only — every action stays re-checked
server-side).

## Last Updated

2026-09-13

## Last Development Session

Implemented and verified Phase 12 (Student Frontend) in the
`gpc-portal-frontend` repo: the full student journey (OTP login → browse
tests/products → purchase via mock payment → take an exam with a
server-authoritative timer and a question-renderer registry → view
results) built against the real backend API with no mock data layer.
Found and fixed one small backend gap along the way (`questionType`
missing from the attempt-detail response) and one frontend bug (a broken
"answered" counter) — the latter caught specifically by driving a real
browser through the full flow via the Chrome DevTools Protocol, not by
typechecking or a build succeeding. Full verification: `tsc -b`, `oxlint`,
`vite build`, and that real-browser walkthrough, all clean.

## Important Files Changed

**`gpc-portal-backend`** (this repo):
- `src/repositories/attemptRepository.ts`, `src/services/attemptService.ts`
  (modified — `questionType` in the attempt-detail response)
- `tests/integration/attempt.test.ts` (modified — new assertion)
- `docs/API.md`, `docs/EXAM_ENGINE.md`, `docs/CHANGELOG.md` (the
  `questionType` fix); `docs/FRONTEND.md` (rewritten for the as-built
  frontend), `docs/KNOWN_ISSUES.md`, `docs/DEVELOPMENT_STATUS.md` (this
  file)

**`gpc-portal-frontend`** (companion repo — see its own `README.md`):
- `src/app/*`, `src/services/apiClient.ts`, `src/stores/authStore.ts`,
  `src/hooks/*`, `src/utils/*`, `src/components/*` (foundation)
- `src/questionTypes/*` (renderer registry)
- `src/features/{auth,tests,attempt,products,orders,payments}/*`
- `src/index.css` (full app stylesheet, mobile-first)
- Removed: default Vite template (`App.tsx`/`App.css`, template assets)

## Database Changes

None.

## API Changes

None new — Phase 12 consumes the existing student-facing API surface.
One response-shape addition: `GET /attempts/:attemptId`'s per-question
objects now include `questionType` (see `docs/API.md`).

## Testing Status

Backend: unchanged at 70 tests (one assertion added to
`tests/integration/attempt.test.ts`, no new test files — see this repo's
own testing status history). Frontend: no test runner yet (Phase 14);
this phase's verification was typecheck + lint + build + real-browser
end-to-end walkthroughs, detailed above.

## Handover Notes

- **The frontend has zero mock/stub data.** Every screen calls the real
  backend. If a future session is tempted to add fixture data for faster
  iteration, don't — it's exactly the kind of thing that silently drifts
  from the real API shape.
- **`isQuestionAnswered()`** (`gpc-portal-frontend`'s
  `src/features/attempt/utils.ts`) is the single source of truth for "does
  this question have a saved answer" — never re-derive this inline with an
  unguarded optional-chain comparison again (see the bug this phase found
  and fixed).
- **`MCQ_MULTI` is intentionally not fully functional** on either side of
  the stack yet — see `docs/KNOWN_ISSUES.md`. Don't "fix" the frontend
  without also building the backend's real multi-select answer column and
  evaluator; they need to land together.
- **No Playwright/Puppeteer is installed in this project.** The real-browser
  verification method used this phase (a small Node script driving a
  headless Edge instance via the Chrome DevTools Protocol) was not
  committed anywhere — if a future phase wants repeatable browser
  end-to-end tests, that's a deliberate Phase 14 (Testing) decision to make
  (which tool, whether to commit the harness), not something to
  half-adopt ad hoc.
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
