# Development Status

## Current Phase

Phase 13 - Admin Frontend (complete, verified against the real backend API
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
- [x] Admin frontend
- [ ] Testing
- [ ] Deployment

## Current Work

Phase 13 is complete and verified. Awaiting user confirmation before
starting Phase 14 (Testing) — a dedicated pass across both repos: a real
frontend test runner/harness (none exists yet; verification so far has
been typecheck+lint+build+ad hoc browser automation), closing the
remaining items in this repo's own `docs/KNOWN_ISSUES.md` Security Test
Coverage checklist, and deciding whether to commit a real end-to-end
browser-testing setup (Playwright/Cypress) given how much value the ad hoc
CDP scripts have already provided across Phases 12–13.

## Completed (Phase 13, this session)

Code lives in the **`gpc-portal-frontend`** repo, plus several small
backend enabling fixes in this repo (all found while building the
frontend, each committed separately before the frontend commit that
depended on it — see Important Files Changed).

- **Admin shell**: `AdminGuard` (role-gated: `ADMIN`/`SUPER_ADMIN` only,
  redirects a `STUDENT` to `/tests`) and `AdminLayout` (a permission-gated
  sidebar, distinct from the student `AppLayout`).
- **`src/permissions/`**: `usePermission(code)`/`hasPermission(code)`/
  `useIsAdmin()`, reading the new `permissions` field on the current user.
  Used throughout to hide sidebar links, dashboard tiles, and action
  buttons a user's permissions don't cover — still UX-only, every action
  independently re-checked server-side.
- **Catalog** (`src/features/admin/catalog/`): categories/exams/series in
  one tabbed page — create, activate/deactivate, soft-delete.
- **Subjects & Topics** (`src/features/admin/subjects/`): same pattern,
  two sections on one page.
- **Questions** (`src/features/admin/questions/`): list with subject/
  review-status filters; a single-page MCQ_SINGLE authoring form (dynamic
  option rows, radio-selected correct answer); a detail page showing the
  latest version's content with correct-answer highlighting and approve/
  reject actions.
- **AI Generation** (`src/features/admin/ai/`): job list, a "generate"
  form (subject + count), and a job detail page rendering each generated
  item with approve/reject — approving creates and publishes a real
  question through the same path question-bank authoring uses (per the
  backend's ADR-033).
- **Test Builder** (`src/features/admin/tests/`) — the most complex piece:
  a minimal test-creation form, then a tabbed builder page (Sections /
  Questions or Rules depending on `selectionMode`) with Validate/Publish/
  Close/Archive actions, each gated by the relevant permission and by the
  test's current status (structure edits only while `DRAFT`, matching
  ADR-024).
- **Results** (`src/features/admin/results/`): per-test results table with
  a release action, and a per-student result detail with a per-question
  answer-status breakdown.
- **Commerce** (`src/features/admin/products/`, `.../orders/`): product
  CRUD including nested price/item management (with a target-type picker
  that switches between tests/exams/series/subjects depending on
  `accessType`, mirroring the backend's own CHECK-constraint rule); a
  read-only order browser.
- **Entitlements** (`src/features/admin/entitlements/`): a grant form with
  a live student-search picker (debounce-free, since results are typically
  a handful of rows) and a test picker, plus a list with a revoke action.
- **Attempts** (`src/features/admin/attempts/`): a read-only browser
  rendering the full, unsanitized attempt detail (selected vs. correct
  option, per ADR-030's admin-only exception) — deliberately built against
  the raw nested `attemptQuestions[].questionVersion.options[]` shape the
  admin endpoint returns, not the sanitized student-facing shape.

### Backend enabling fixes (this repo, found while building the frontend)

- `GET /auth/me` gained `permissions: string[]` — nothing to gate the
  admin UI on before this.
- `GET /admin/orders`/`GET /admin/entitlements` (+ `:id` variants) now
  join `user` — previously only a raw `userId`, unusable for a browsing UI.
- `GET /admin/students?search=` — a new minimal read-only lookup
  (activates the long-dormant `student.view` permission), built because
  there was no way at all to find a `userId` for the entitlement-grant form.
- `GET /admin/results/:id` now joins `user` via a new, separate
  `findResultByIdForAdmin()` — found by the real-browser verification pass
  itself (the one bug this phase's browser testing actually caught, as
  opposed to the others, which were identified as blockers before writing
  the dependent UI).

### Verification

Same discipline as Phase 12: `tsc -b`, `oxlint`, `vite build` (all clean),
plus a real-browser CDP walkthrough against a live backend covering every
admin module end-to-end — see `docs/FRONTEND.md`'s Manual/Automated
Verification (Phase 13) section for the full list of what was exercised
and the one bug it caught.

## In Progress

Nothing — Phase 13 scope is complete.

## Blocked

None.

## Known Issues

No net-new known issues from this phase beyond what's noted inline above
(the small backend gaps were fixed, not deferred). See
`docs/KNOWN_ISSUES.md` for the running list; nothing there is specific to
Phase 13.

## Next Recommended Task

Phase 14: Testing. Per the spec's own phase order, this is a dedicated
pass rather than "add tests as you go" (which every prior phase already
did on the backend — 74 integration/unit tests exist there). Concretely:
a real frontend test runner (Vitest + Testing Library is the natural
choice given the backend already uses Vitest, or a browser-based tool like
Playwright if end-to-end coverage is the priority); closing
`docs/SECURITY.md`'s remaining unchecked Required Security Test Coverage
boxes; and deciding whether any of this phase's ad hoc CDP verification
scripts are worth turning into a committed, repeatable suite given how
much real-bug-catching value they've provided across Phases 12–13 (they
were NOT committed anywhere — this is a decision to make deliberately in
Phase 14, not something to have half-adopted already).

## Last Updated

2026-09-14

## Last Development Session

Implemented and verified Phase 13 (Admin Frontend) in the
`gpc-portal-frontend` repo: the complete admin authoring/review/commerce
surface — catalog, subjects/topics, question authoring + approval, AI
generation + review, the full test builder (sections/questions/rules/
lifecycle), results release, product/price/item management, read-only
order and attempt browsing, and entitlement grant (via a new student
search)/revoke. Four small, well-justified backend gaps were found and
fixed along the way (permissions on `/auth/me`, `user` joins on admin
orders/entitlements/results, and a new minimal student-search endpoint),
each its own commit before the frontend work that depended on it. Verified
via a real-browser walkthrough (Chrome DevTools Protocol, same method as
Phase 12) exercising every admin module against a live backend, which
caught one more backend bug (missing `user` join on the result-detail
endpoint) — fixed and verified in the same session.

## Important Files Changed

**`gpc-portal-backend`** (this repo, four separate small commits before
the frontend work, per the CHANGELOG's own entries):
- `src/controllers/authController.ts` (`permissions` field on `/auth/me`)
- `src/repositories/{orderRepository.ts,entitlementRepository.ts}`,
  `src/models/{Order.ts,Entitlement.ts}` (`user` joins)
- `src/repositories/userRepository.ts`, `src/services/studentService.ts`,
  `src/controllers/studentAdminController.ts`,
  `src/api/v1/routes/adminStudent.routes.ts` (new student search endpoint)
- `src/repositories/resultRepository.ts`, `src/services/resultService.ts`
  (`findResultByIdForAdmin()`)
- `tests/integration/{auth.test.ts,commerce.test.ts,adminStudents.test.ts,
  results.test.ts}` (new/updated assertions for all of the above)
- `docs/API.md`, `docs/AUTHENTICATION.md`, `docs/CHANGELOG.md`,
  `docs/FRONTEND.md` (rewritten for the as-built admin frontend),
  `docs/DEVELOPMENT_STATUS.md` (this file)

**`gpc-portal-frontend`** (companion repo):
- `src/permissions/index.ts`, `src/app/{AdminGuard.tsx,AdminLayout.tsx}`
  (foundation)
- `src/features/admin/{AdminDashboardPage.tsx,catalog/,subjects/,
  questions/,ai/,tests/,results/,products/,orders/,entitlements/,
  attempts/}` (every admin module)
- `src/app/router.tsx`, `src/app/AppLayout.tsx` (admin routes wired in)
- `src/stores/authStore.ts`, `src/features/auth/{hooks.ts,VerifyOtpPage.tsx}`
  (`permissions` field, role-based post-login redirect)
- `src/index.css` (admin shell/table/form/tabs styles)

## Database Changes

None.

## API Changes

New: `GET /admin/students?search=`. Extended: `GET /auth/me` (+
`permissions`), `GET /admin/orders`/`:id`, `GET /admin/entitlements`/`:id`
(+ `user`), `GET /admin/results/:id` (+ `user`). See `docs/API.md`.

## Testing Status

Backend: 74 tests (3 new: 2 in `adminStudents.test.ts`, 1 assertion added
to `auth.test.ts` and `commerce.test.ts` and `results.test.ts` each — see
this repo's own test files for exact counts). Frontend: still no test
runner (Phase 14, as planned); this phase's verification was typecheck +
lint + build + a comprehensive real-browser walkthrough, detailed above
and in `docs/FRONTEND.md`.

## Handover Notes

- **Every "found while building the frontend" backend fix this phase
  followed the same rule Phase 12 established**: small, additive,
  well-justified by a concrete UI need, its own commit, its own test
  assertion, never bundled silently into the frontend commit. Keep doing
  this — it's cheap insurance against the docs and the code drifting apart.
- **`findResultByIdForAdmin()` exists specifically so the shared
  `findResultById()`/`getResultOrThrow()` (student-facing) never gains an
  admin-only join.** This is the same ADR-030 discipline as
  `attemptAdminService.ts` vs `attemptService.ts` — don't collapse them
  back together for convenience.
- **The admin frontend's permission checks (`usePermission`) are read from
  `GET /auth/me`'s `permissions` array, cached in `authStore` at login
  time.** If a user's permissions change server-side mid-session (a role
  edit), the frontend won't see it until they log out/in again — there's
  no live-refresh of this list. Acceptable for now (permission changes are
  rare, admin-initiated events); revisit only if that assumption breaks.
- **No admin UI exists yet for role/permission management itself** — roles
  and permissions are still seeded/assigned only via migrations/seeders or
  direct DB access. Not attempted this phase; would need its own small
  backend module first (no such endpoints exist).
- Read `CLAUDE.md` and this file first in any new session before writing
  code.
