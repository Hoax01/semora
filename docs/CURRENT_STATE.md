# Semora — Current Implementation State

**Last Updated:** August 20, 2026
**Current Phase:** Phase 1 — Academic Catalogue (in progress)
**Next Build Phase:** Phase 2 — Semester Planning Core
**Product Status:** Product and technical design are complete. Phase 0 is
complete and the Phase 1 catalogue slice is implemented pending the official
LUMS source-data import.

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
- Protected Fall 2026 catalogue screen with search, course rows, and course
  detail views showing sections, credits, instructors, capacities, and meeting
  times.

### API and authentication

- Express API in `apps/api` with `GET /api/health` and
  `GET /api/health/db`.
- Better Auth email/password authentication, mounted at `/api/auth/*`.
- Server-managed session cookies and `GET /api/me`, which returns the current
  user or `401 UNAUTHORIZED`.
- API authentication routes are registered before JSON parsing, as required by
  the Better Auth Express handler.
- Protected `GET /api/catalogue` search endpoint for course code, title, or
  department, plus `GET /api/catalogue/:offeringId` detail endpoint.
- Validated, transactional, idempotent JSON catalogue importer at
  `npm run catalogue:import --workspace @semora/api -- <file.json>`.

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
- authenticated catalogue search and course-detail responses.
- importer validation and repeat execution were verified with the checked-in
  example JSON fixture; the second run reused the same canonical records.

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
The repository does not contain the official LUMS course memo/timing source
files yet. The importer accepts a documented canonical JSON shape and is ready
for those files; the checked-in development seed remains synthetic fixture data.
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
apps/api/src/catalogue/importer.ts
apps/api/src/import-catalogue.ts
apps/web/src/App.tsx
apps/web/src/auth-client.ts
apps/web/src/styles.css
prisma/schema.prisma
prisma/seed.ts
prisma/migrations/
docs/BUILDPLAN.md
docs/CURRENT_STATE.md
docs/CATALOGUE_IMPORT.md
```

---

## Next objective

Obtain the official Fall 2026 LUMS course memo/timing files, convert them to the
catalogue JSON import shape, run the importer, and verify the resulting browse
experience. Then audit Phase 1 acceptance criteria before beginning Phase 2.
