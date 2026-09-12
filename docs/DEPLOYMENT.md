# Deployment

## Status

Not yet configured — this is a Phase 15 concern per the implementation plan.
This file will document, once decided:

- Target hosting for backend (container/PaaS/VM) and frontend (static host/CDN).
- Production PostgreSQL provisioning.
- Environment/secrets management approach.
- Migration-run step in the deploy pipeline (`sequelize-cli db:migrate` against
  production must be an explicit, reviewed step — never automatic
  `sync({ alter: true })`).
- CI/CD pipeline (lint, build, test gates before deploy) — note this repo and
  `gpc-portal-frontend` are separate repos (ADR-016), so each needs its own
  pipeline; a backend API change that requires a coordinated frontend release
  must be called out explicitly (e.g. in the PR description) since there is no
  single commit spanning both.
- Logging/monitoring setup.

## Repositories

This project is split across two git repositories, cloned as siblings:

```
gpc-portal-backend/    (this repo) — API + full docs/
gpc-portal-frontend/   — client app
```

## Local Development

### Prerequisites

- Node.js 22+ LTS (developed against Node 24.2.0).
- PostgreSQL 16+ running locally or reachable via `DB_HOST`/`DB_PORT`.
- npm.

### Backend (this repo)

```bash
npm install
cp .env.example .env   # fill in local DB credentials
npm run migrate         # once migrations exist
npm run seed             # once seeders exist
npm run dev
```

### Frontend (`gpc-portal-frontend`, separate clone)

```bash
git clone <gpc-portal-frontend-url> ../gpc-portal-frontend
cd ../gpc-portal-frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL to this backend's URL
npm run dev
```

Full environment variable reference: this repo's `.env.example`,
`gpc-portal-frontend`'s `.env.example`.
