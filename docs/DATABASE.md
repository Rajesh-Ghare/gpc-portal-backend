# Database

## Engine & Access

- PostgreSQL (developed and verified against PostgreSQL 17; should work
  unchanged on 15/16).
- Sequelize ORM (TypeScript). All queries go through Sequelize models,
  accessed via the repository layer — no raw SQL string concatenation, except
  inside migrations/seeders themselves (see `docs/DECISIONS.md` ADR-017).
- Schema changes are made **only** via Sequelize migrations in
  `src/migrations/`. Never run `sequelize.sync({ alter: true })` or
  `sequelize.sync({ force: true })` against a real database. `sync()` may only
  be used, if at all, in isolated unit tests against an ephemeral database.
- **All 43 migrations exist, have been applied, and are verified**: a full
  `db:migrate:undo:all` followed by `db:migrate` was run against a real local
  PostgreSQL 17 database with zero errors, and a cross-domain smoke test
  (category → exam → series → test → section → subject → topic → question →
  version → translation → option → tag → test_question → attempt →
  attempt_question → attempt_answer → result → result_detail → product →
  price → item → order → order_item → payment → entitlement →
  ai_generation_job → item → audit_log → system_setting) was created and read
  back successfully through the Sequelize model layer. See
  `docs/DEVELOPMENT_STATUS.md` for the session this happened in.

## Conventions

- Primary keys: `UUID`, generated via PostgreSQL's `pgcrypto` extension
  (`gen_random_uuid()` at the DB level; `DataTypes.UUIDV4` at the Sequelize
  model level as a client-side fallback — both are wired so either a
  model-driven `.create()` or a raw `INSERT` produces a valid UUID). See
  ADR-013.
- Sequelize `underscored: true` on every model — attributes are camelCase in
  TypeScript, columns are snake_case in the database.
- **Timestamp columns follow the master spec's per-table list exactly, not a
  blanket "every table gets both created_at and updated_at" rule.** Most
  tables have both. These do not:
  - `permissions`, `otp_requests`, `question_versions`, `test_questions`,
    `result_details`, `payment_webhook_events`, `audit_logs`: `created_at`
    only (spec lists only `created_at` for these — they are insert-only /
    immutable-snapshot rows, never updated in place).
  - Pure join/pivot tables (`user_roles`, `role_permissions`, `question_tags`,
    `test_rule_tags`): `created_at` only, composite primary key, no surrogate
    `id`.
  - Each of these has its own explicit Sequelize model (not an implicit
    string-based `through:` table) specifically so `timestamps`/`updatedAt`
    can be configured correctly — see `src/models/RolePermission.ts` /
    `UserRole.ts` / `QuestionTag.ts` / `TestRuleTag.ts`. An implicit `through`
    join model inherits the global `timestamps: true` default and would
    incorrectly try to write a nonexistent `updated_at` column.
  - Tables holding user-facing/editable catalog or transactional content that
    the spec marks `deleted_at` additionally get soft-delete (`paranoid:
    true`): `users`, `exam_categories`, `competitive_exams`, `test_series`,
    `tests`, `subjects`, `topics`, `questions`, `products`.
- Never cascade-delete historical/transactional records (attempts, attempt
  answers, results, orders, payments, entitlements, audit logs). Foreign keys
  from historical tables toward mutable catalog data use `ON DELETE RESTRICT`
  or `ON DELETE SET NULL` as appropriate — never `CASCADE` in a direction that
  could silently erase a student's exam history. Purely-structural children of
  catalog config (`test_sections`, `test_questions` relative to `tests`) do
  use `CASCADE`, since they are config, not history.
- Money columns are `DECIMAL(12,2)` (or `DECIMAL(10,2)` for marks/percentages,
  `DECIMAL(18,4)` for numeric-answer/option values needing more precision),
  never floating point.
- JSONB is used for genuinely schemaless configuration (`metadata`,
  `rule_config`, `configuration`, `required_languages`, `raw_output`,
  `validation_errors`), not as a substitute for proper columns/foreign keys.
- Status/type/mode-like columns (`status`, `test_type`, `selection_mode`,
  `attempt_policy`, `result_visibility`, `question_type`, `difficulty`,
  `access_type`, `provider`, etc.) are plain `VARCHAR`, never Postgres
  `ENUM` types — enum types require a migration to add a new value, which
  would undermine the "configuration-driven, not hardcoded" requirement
  (spec sections 1/45). Valid-value sets live in application constants, not
  the schema.

## Migration Order

All 43 migrations exist in `src/migrations/`, timestamped
`20260913000001` through `20260913000043`, applied in this order (matching
spec section 20 exactly, with one addition explained below):

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
10. **`add-fk-questions-generation-job`** (not in the original numbered list) —
    adds the FK from `questions.generation_job_id` to `ai_generation_jobs.id`,
    deferred to here because `ai_generation_jobs` doesn't exist yet when
    `questions` is created. See ADR-019.
11. System: `audit_logs`, `system_settings`

Shared column helpers (`uuidPk`, `timestamps`, `uuidRef`) live in
`src/utils/migrationHelpers.js` — deliberately **outside** `src/migrations/`,
since `sequelize-cli` treats every file directly inside that folder as a
migration expecting `up`/`down` exports.

## Key Integrity Rules (enforced in migrations, verified against real Postgres)

- `attempts`: unique `(user_id, test_id, attempt_number)`; a **partial**
  unique index `attempts_one_in_progress_per_user_test` on
  `(user_id, test_id) WHERE status = 'IN_PROGRESS'` — confirmed present via
  `\d attempts` and enforced by Postgres, not just application logic.
- `attempt_questions`: unique `(attempt_id, sequence_number)` and
  `(attempt_id, question_id)`.
- `attempt_answers`: unique `(attempt_id, attempt_question_id)`.
- `test_questions`: unique `(test_id, display_order)` and
  `(test_id, question_id)`.
- `test_sections`: unique `(test_id, display_order)`.
- `question_versions`: unique `(question_id, version_number)`.
- `question_translations`: unique `(question_version_id, language_code)`.
- `question_options`: unique `(question_version_id, option_key)`.
- `question_option_translations`: unique `(question_option_id, language_code)`.
- `topics`: unique `(subject_id, slug)` — topic slugs are scoped per subject,
  not globally unique (the spec doesn't mark `topics.slug` `UNIQUE` the way
  it does for `subjects.slug`).
- `results`: unique `attempt_id`.
- `orders`: unique `(user_id, idempotency_key)`.
- `payment_webhook_events`: unique `(provider, provider_event_id)`.
- `product_items`: `CHECK` constraint
  `product_items_target_matches_access_type` — exactly the target column
  matching `access_type` must be non-null; the other three must be null.
  Verified by attempting a mismatched insert and confirming Postgres rejects
  it. See ADR-018.
- `exam_categories.slug`, `competitive_exams.slug`, `competitive_exams.code`,
  `test_series.slug`, `tests.slug`, `subjects.slug`, `tags.slug`,
  `products.slug`: unique.

## Full Table Reference

The complete column-level schema for every table is now defined by the
migrations themselves (`src/migrations/`), which are the source of truth —
not the original spec text. Sequelize models mirror the migrations exactly
(`src/models/`, one file per table plus `index.ts` wiring associations). If
you need the exact columns/types for a table, read its migration file; it is
short and self-contained.

Notable modeling decisions made during implementation that go beyond the
spec's literal column list (spec left these ambiguous or under-specified):

- `tests.competitive_exam_id` is `NOT NULL`; `tests.test_series_id` is
  nullable — a test always belongs to an exam but need not belong to a
  series.
- `test_series.competitive_exam_id` is nullable per spec's explicit "NULL"
  marker.
- `questions.topic_id` is nullable (a question can be tagged at subject level
  only); `questions.subject_id` is required.
- `test_rules.section_id` / `subject_id` / `topic_id` / `question_type` /
  `difficulty` / `language_code` are all nullable — an unset filter means
  "match any" for that dimension.
- Marks-related columns (`question_versions.marks`/`negative_marks`,
  `test_sections.marks_per_question`/`negative_marks`) are nullable, falling
  back to the test's `default_marks_per_question`/`default_negative_marks` at
  assembly/attempt time — resolution logic belongs in the exam-engine
  service layer (Phase 7), not the schema.

## Seeding

Development seed data (`src/seeders/`, 6 files, run in order via
`npm run seed`) provides, and has been verified end-to-end against a real
database:

1. `roles-and-permissions` — `SUPER_ADMIN`, `ADMIN`, `STUDENT` roles; 20
   permission codes (the concrete examples from spec section 25); SUPER_ADMIN
   and ADMIN both granted all of them for now (see ADR note in the seeder —
   role/permission granularity increases as more permission codes are added
   in later phases).
2. `users` — one user per role (`9000000001`/SUPER_ADMIN,
   `9000000002`/ADMIN, `9000000003`/STUDENT), pre-verified
   (`is_mobile_verified: true`) for local dev convenience.
3. `catalog` — `SSC` category → `SSC CGL` exam; `Quantitative Aptitude`
   subject → `Percentage` and `Profit & Loss` topics.
4. `sample-questions` — 4 `MCQ_SINGLE` questions (2 per topic), each with a
   `question_version`, an `en` `question_translation`, 4 options each (with
   `en` option translations), `status: PUBLISHED`, `review_status: APPROVED`.
5. `sample-test` — one published test ("SSC CGL Quantitative Aptitude —
   Sample Mock Test") with one section containing all 4 sample questions via
   `test_questions`.
6. `sample-product` — one `INDIVIDUAL_TEST` product (₹10) with a
   `product_item` pointing at the sample test, `attempt_limit: 2`.

Every seeder has a working `down()`; `db:seed:undo:all` followed by
`db:seed:all` was run and verified to leave the database in the same state.

Run: `npm run migrate && npm run seed` (see `docs/DEPLOYMENT.md`).
