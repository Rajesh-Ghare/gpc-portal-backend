# GPC Exam Portal — Backend

Express + TypeScript + PostgreSQL/Sequelize API for a generic,
configuration-driven competitive-exam practice platform.

**This repo owns the full project documentation** — architecture, database
schema, API contracts, authentication, exam-engine mechanics, commerce &
payments, AI generation, security rules, deployment, testing, and the
architecture decision record. It's the source of truth for the whole
platform, not just this codebase.

**This is one of two repos for this project:**

- `gpc-portal-backend` (this repo) — the API, and all shared documentation.
- `gpc-portal-frontend` — the React/Vite/TypeScript client. See its README
  for its own quick start; it links back here for full project context.

**Start here:** [`CLAUDE.md`](./CLAUDE.md) — project rules, conventions, and
where everything lives. Then [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md)
for the business context and [`docs/DEVELOPMENT_STATUS.md`](./docs/DEVELOPMENT_STATUS.md)
for what's actually been built so far.

## Quick Start

```bash
npm install
cp .env.example .env   # fill in local PostgreSQL credentials
npm run dev
```

Migrations/seeders (once they exist beyond Phase 1 infrastructure):

```bash
npm run migrate
npm run seed
```

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for full local setup of both
repos together.
