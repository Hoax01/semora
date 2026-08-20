# Semora Agent Instructions

## Project

Semora is a university-agnostic semester planning and workload intelligence
platform. Its lifecycle is:

```text
PLAN → LOCK → NAVIGATE
```

The current implementation phase is **Phase 1 — Academic Catalogue**.

## Developer workflow and model roles

Use the following model responsibilities:

- **Luna (High):** Main developer for approximately 95% of all project work,
  including daily coding, multi-file changes, and standard debugging.
- **Sol:** Reserved for the remaining 5% of work: a critical architectural
  failure or deep logical bug that remains unresolved after three attempts.
- **Terra:** Not part of this workflow. Do not recommend switching to Terra.

## Proactive model escalation

Work through tasks completely with **Luna (High)** by default, including
multi-file changes and ordinary debugging.

Only recommend switching to **Sol** after three genuine attempts have failed
to resolve a complete dead-end block or structural failure. When that happens,
explain the attempted resolutions and why Sol is required before writing any
further code for that blocked task.

## Required startup reading

Before changing code, read:

1. `docs/PRODUCT.md`
2. `docs/DECISIONS.md`
3. `docs/CURRENT_STATE.md`
4. `docs/BUILDPLAN.md`
5. Only the technical specifications relevant to the active task

For interface work, also read the relevant sections of `docs/UI_UX.md`.

`CURRENT_STATE.md` describes what is actually implemented. Specifications do
not imply that a feature already exists.

## Scope rules

- `PRODUCT.md` defines the V1 feature contract.
- Accepted amendments are recorded in `DECISIONS.md`.
- `BUILDPLAN.md` defines phase sequencing, boundaries, and acceptance criteria.
- Do not implement later-phase features early.
- Put deferred ideas in `docs/FUTURE.md`; do not expand scope silently.
- Keep the application a modular monolith unless a documented decision changes
  that boundary.

## Architecture rules

- Keep the frontend in `apps/web` and the API in `apps/api`.
- Keep reusable domain types in `packages/domain`.
- Keep deterministic semester calculations in `packages/semester-engine`.
- Engines must not directly access Express, Prisma, React, or LLM APIs.
- Server-side authorization must verify ownership of every user-owned resource.
- Never commit `.env`, credentials, database dumps, generated secrets, or API
  keys.

## Database workflow

Development currently uses the local PostgreSQL service and pgAdmin on port
`5432`. Docker Compose is optional and maps PostgreSQL to host port `5433`.

Use:

```powershell
npm run db:generate
npm run db:migrate -- --name <descriptive_name>
npm run db:seed
```

Every schema change must be represented by a migration. Do not manually modify
the database schema outside Prisma migrations.

## Verification

Before handing off a change, run the checks relevant to it. The baseline suite
is:

```powershell
npm run typecheck
npm run test
npm run build
npm run format:check
```

Update `docs/CURRENT_STATE.md` after every meaningful implementation step. Keep
it factual and record implemented behavior, partial work, known issues, tests,
database state, important files, and the next objective.

## Git

Use focused commits with clear messages. Keep the working tree clean at handoff
and push completed commits to the configured `origin` remote when network access
is available.
