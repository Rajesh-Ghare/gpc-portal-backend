# Database

## Engine & Access

- PostgreSQL (latest stable major supported by your environment; developed
  against PostgreSQL 16+).
- Sequelize ORM (TypeScript). All queries go through Sequelize models,
  accessed via the repository layer — no raw SQL string concatenation.
- Schema changes are made **only** via Sequelize migrations in
  `backend/src/migrations/`. Never run `sequelize.sync({ alter: true })` or
  `sequelize.sync({ force: true })` against a real database. `sync()` may only
  be used, if at all, in isolated unit tests against an ephemeral database.

## Conventions

- Primary keys: `UUID`, generated via PostgreSQL's `pgcrypto` extension
  (`gen_random_uuid()`), enabled in the first migration. See ADR-013.
- Sequelize `underscored: true` globally — model attributes are camelCase in
  TypeScript, columns are snake_case in the database.
- Every table has `created_at` / `updated_at` (managed by Sequelize timestamps).
  Tables holding user-facing or historical/editable content additionally have
  `deleted_at` (soft delete via `paranoid: true`) — see the per-table list in
  section 11-19 of the original spec (mirrored below) for which tables are
  paranoid.
- Never cascade-delete historical/transactional records (attempts, attempt
  answers, results, orders, payments, entitlements, audit logs). Foreign keys
  from historical tables toward mutable catalog data use `ON DELETE RESTRICT`
  or `ON DELETE SET NULL` as appropriate — never `CASCADE` in a direction that
  could silently erase a student's exam history.
- Money columns are `DECIMAL`/`NUMERIC`, never floating point.
- JSONB is used for genuinely schemaless configuration (`metadata`,
  `rule_config`, `configuration`, `required_languages`), not as a substitute for
  proper columns/foreign keys.

## Migration Order

Migrations are numbered and applied in this order (see the original
implementation spec, section 20, for the authoritative list). Summary by
domain:

1. `pgcrypto` extension
2. Auth: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`,
   `otp_requests`, `sessions`
3. Catalog: `exam_categories`, `competitive_exams`, `test_series`, `tests`,
   `test_sections`
4. Question bank: `subjects`, `topics`, `questions`, `question_versions`,
   `question_translations`, `question_options`,
   `question_option_translations`, `tags`, `question_tags`
5. Test assembly: `test_questions`, `test_rules`, `test_rule_tags`
6. Attempt engine: `attempts`, `attempt_questions`, `attempt_answers`
7. Results: `results`, `result_details`
8. Commerce: `products`, `product_prices`, `product_items`, `orders`,
   `order_items`, `payments`, `payment_webhook_events`, `entitlements`
9. AI: `ai_generation_jobs`, `ai_generation_items`
10. System: `audit_logs`, `system_settings`

**As of this document, no migrations have been written yet** — this is tracked
in `DEVELOPMENT_STATUS.md`. Do not assume any table exists until its migration
is present in `backend/src/migrations/` and has been applied.

## Key Integrity Rules (must be enforced in migrations, not just app code)

- `attempts`: unique `(user_id, test_id, attempt_number)`; a partial unique
  index on `(user_id, test_id) WHERE status = 'IN_PROGRESS'` to prevent two
  concurrent in-progress attempts for the same user/test.
- `attempt_questions`: unique `(attempt_id, sequence_number)` and
  `(attempt_id, question_id)`.
- `attempt_answers`: unique `(attempt_id, attempt_question_id)`.
- `test_questions`: unique `(test_id, display_order)` and
  `(test_id, question_id)`.
- `test_sections`: unique `(test_id, display_order)`.
- `question_versions`: unique `(question_id, version_number)`.
- `question_translations`: unique `(question_version_id, language_code)`.
- `results`: unique `attempt_id`.
- `orders`: unique `(user_id, idempotency_key)`.
- `payment_webhook_events`: unique `(provider, provider_event_id)`.
- `exam_categories.slug`, `competitive_exams.slug`, `competitive_exams.code`,
  `test_series.slug`, `tests.slug`, `subjects.slug`, `tags.slug`: unique.

## Full Table Reference

The complete column-level schema for every table (users, roles, permissions,
exam catalog, question bank, test assembly, attempts, results, commerce, AI,
audit) is defined in the original implementation specification provided at
project start. That specification is the source of truth for column names and
types until migrations exist, at which point **the migrations themselves become
the source of truth** and this file should be updated to reflect any
clarification made during implementation (documented as an ADR if the change is
non-trivial).

## Seeding

Development seed data (via `backend/src/seeders/`) will provide: SUPER_ADMIN,
ADMIN, and STUDENT sample users; SSC / SSC CGL catalog entries; Quantitative
Aptitude / Percentage / Profit & Loss subjects+topics; a handful of sample
questions; one sample test; one sample product. See `DEVELOPMENT_STATUS.md` for
what has actually been seeded so far.
