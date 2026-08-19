# Semora — Current Implementation State

**Last Updated:** August 20, 2026
**Current Phase:** Phase 0 — Repository Foundation (complete)
**Next Build Phase:** Phase 1 — Course Catalogue
**Product Status:** Product and technical design are complete. The Phase 0
application, database, authentication, and protected shell are implemented.

---

## Implemented

### Repository and tooling

- npm workspaces with `apps/web`, `apps/api`, `packages/domain`,
  `packages/semester-engine`, `prisma`, and `tests`.
- Shared TypeScript, Prettier, Vitest, and root build/test/typecheck scripts.
- Git repository on `main`, connected to the `origin` GitHub remote.
- `AGENTS.md` defines a Luna High-first workflow, with Sol escalation only
  after three failed attempts to resolve a critical dead-end, plus verification,
  database, and documentation-maintenance workflow.

### Web application

- React, TypeScript, and Vite application in `apps/web`.
- Dark-neutral design tokens with restrained indigo interaction styling.
- Email/password sign-up and sign-in screens.
- Session-aware protected root route, loading state, authenticated identity
  display, and sign-out action.
- Vite development proxy routes `/api` requests to the API.

### API and authentication

- Express API in `apps/api` with `GET /api/health` and
  `GET /api/health/db`.
- Better Auth email/password authentication, mounted at `/api/auth/*`.
- Server-managed session cookies and `GET /api/me`, which returns the current
  user or `401 UNAUTHORIZED`.
- API authentication routes are registered before JSON parsing, as required by
  the Better Auth Express handler.

### Database

- PostgreSQL + Prisma schema for universities, terms, courses, offerings,
  sections, meetings, and semester workspaces.
- Better Auth `User`, `Session`, `Account`, and `Verification` persistence
  models. `User.name` maps to the existing `display_name` database column.
- Migrations applied through:
  - `20260819210243_init_phase0`
  - `20260819212143_add_auth_tables`
  - `20260819212415_add_auth_account_issuer`
- Idempotent LUMS / Fall 2026 development seed applied to the local PostgreSQL
  service on port 5432.
- Optional Docker Compose PostgreSQL remains available on host port 5433.

---

## Tests and verification

The following all pass after the authentication implementation:

```text
npm run typecheck
npm run test
npm run build
npm run format:check
```

Current API integration coverage verifies:

- API health response;
- database connectivity response;
- sign-up, authenticated current-user lookup, sign-out, and rejected session
  reuse.

---

## Configuration required for local development

The ignored root `.env` must provide:

```text
DATABASE_URL
APP_URL=http://localhost:5173
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_SECRET=<random secret of at least 32 characters>
```

`.env.example` contains the non-secret template. Never commit the real `.env`
or its secret.

---

## Known issues and deviations

```text
NONE
```

The Codex sandbox requires a per-command Git safe-directory override because
the repository metadata was initially created by a different Windows account.
The developer terminal has the repository configured as safe.

---

## Important files

```text
AGENTS.md
apps/api/src/app.ts
apps/api/src/auth.ts
apps/api/src/app.test.ts
apps/web/src/App.tsx
apps/web/src/auth-client.ts
apps/web/src/styles.css
prisma/schema.prisma
prisma/seed.ts
prisma/migrations/
docs/BUILDPLAN.md
docs/CURRENT_STATE.md
```

---

## Next objective

Begin **Phase 1 — Course Catalogue** only after its scope is reviewed against
`docs/BUILDPLAN.md`, `docs/PRODUCT.md`, and the relevant data-model and UI
specifications. Do not start later semester-planning or intelligence features
early.
