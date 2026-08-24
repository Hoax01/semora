# Semora

**Design a semester you won't regret. See the hard weeks before they hit you.**

Semora is a university-agnostic semester planning and workload intelligence platform. It turns course catalogues, timetables, commitments, course outlines, assessments, and grades into one explainable semester model.

Its lifecycle is:

```
PLAN → LOCK → NAVIGATE
```

During **PLAN**, students build and compare possible course combinations. During **LOCK**, they finalize one candidate and enrich it with verified course-outline data. During **NAVIGATE**, Semora becomes a command center for upcoming assessments, workload pressure, heatmaps, completion feedback, and grade progress.

## Why Semora exists

University tools usually answer whether a course can be registered. They rarely answer whether a particular combination is manageable alongside the rest of a student's life.

Semora evaluates the semester as a system rather than treating courses independently. It makes trade-offs visible:

- a valid timetable can still create exhausting gaps or long days;
- several individually reasonable courses can combine into heavy project or assessment pressure;
- a commitment can turn an otherwise acceptable week into a constrained one;
- a deadline cluster can matter more than a simple count of upcoming tasks;
- grade progress and remaining assessment weight should be calculated from confirmed data, not guessed.

Semora is not a generic chatbot, automatic registration tool, workout-style task manager, or course-plan generator. It is an explainable semester decision and navigation system.

## What is implemented

### PLAN — Semester Designer

- Browse a term-specific course catalogue and sections.
- Search courses by code or title and inspect meeting times and instructors.
- Create multiple candidate semesters with independently editable selections.
- Validate credit totals and timetable clashes.
- Add recurring and one-off commitments with hard, soft, or flexible semantics.
- Record personal priorities, course interest, career fit, and workload preferences.
- Store structural workload profiles and editable personal estimates.
- Score candidates with deterministic workload, schedule, commitment, fit, balance, confidence, and completeness metrics.
- Compare candidates side by side with meaningful-difference explanations.
- Explore bounded unsaved scenarios and receive explainable recommendation tags and findings.

### LOCK — Active-semester setup

- Lock a candidate into the active semester without destroying planning history.
- Add, switch, and drop active courses during Add/Drop.
- Upload a course outline for an active course.
- Normalize PDF, DOCX, and plain-text document content.
- Generate a local deterministic extraction draft with source evidence and warnings.
- Review and edit course identity, instructors, grading categories, assessments, dates, weights, thresholds, and aggregation rules.
- Resolve blocking conflicts before verification.
- Persist only user-verified academic data into the canonical course model.
- Enter assessments manually when extraction is incomplete or unavailable.

### NAVIGATE — Semester command center

- See due-soon assessments, priorities, current/upcoming pressure, and the next pressure peak.
- Review a selectable weekly semester heatmap with readable pressure drivers.
- Inspect daily and weekly pressure findings with severity and evidence windows.
- Edit assessment dates and completion status and see forecasts refresh.
- Track work progress separately from academic score status.
- Enter scores and view current performance, weighted points, graded weight, and remaining weight.
- Calculate required averages and reachable targets when absolute thresholds are known.
- Preview temporary what-if scores without mutating saved results.
- Apply deterministic BEST_N and DROP_LOWEST_N category rules.
- View safe relative-grade context without fabricating letter-grade predictions.

## Architecture

Semora is a modular monolith with clear boundaries:

```
React + Vite web app
          ↓
Express + TypeScript API
          ↓
PostgreSQL + Prisma

Pure domain packages:
  semester-engine
  workload-engine
  grade-engine
  extraction
```

The engines do not depend on React, Express, Prisma, or external AI services. The application keeps provisional extraction drafts separate from verified canonical academic data. User-owned routes verify ownership server-side, and private outline files are stored outside public web paths during development.

The default extraction provider is deliberately local and deterministic. It reduces manual entry but never becomes authoritative without review and verification.

## Technology

- **Frontend:** React, TypeScript, Vite, React Router, TanStack Query.
- **API:** Express 5, TypeScript, Better Auth, Zod, Prisma, PostgreSQL.
- **Domain:** standalone TypeScript engines for semester analysis, workload pressure, grade calculations, and document extraction.
- **Verification:** Vitest, Supertest, TypeScript, ESLint, Prettier, production builds.

## Repository layout

```
apps/web                 React application and authenticated UI
apps/api                 Express API, persistence, auth, and orchestration
packages/semester-engine Pure PLAN-phase semester calculations
packages/workload-engine Pure NAVIGATE-phase pressure calculations
packages/grade-engine    Pure grade and target calculations
packages/extraction      Document normalization, extraction, validation, audit
prisma/                  Schema, migrations, and development seed
docs/                    Product, architecture, engine, UX, and state documents
```

## Local development

### Prerequisites

- Node.js 22 or newer.
- npm 11 or newer.
- PostgreSQL running on port 5432, or the optional Docker Compose database on host port 5433.

### Setup

```
npm install
Copy-Item .env.example .env
npm run db:generate
npm run db:migrate -- --name local_setup
npm run db:seed
```

Set DATABASE_URL, APP_URL, BETTER_AUTH_URL, and a random BETTER_AUTH_SECRET with at least 32 characters in .env. Never commit .env.

Run the API and web app in separate terminals:

```
npm run dev --workspace @semora/api
npm run dev --workspace @semora/web
```

The API listens on http://localhost:4000 and the web app on http://localhost:5173 by default.

For catalogue-specific imports, see [docs/CATALOGUE_IMPORT.md](docs/CATALOGUE_IMPORT.md). The checked-in seed is safe for local bootstrap; institution-specific source documents remain local inputs.

## Verification

The current implementation passes:

```
npm run typecheck
npm run test
npm run build
npm run format:check
npm run lint
```

The latest full run covers 102 automated tests across the API and pure domain packages. Interactive browser smoke is environment-limited on the current Windows runtime; authenticated HTTP smoke and automated coverage remain the authoritative checks until deployment and real-user validation.

## Scope and known limitations

- Deployment is intentionally user-owned and is not included in this repository state.
- Development outline storage is local/private; production object storage, retention, and deletion flows are not configured.
- The local extraction provider is heuristic and requires human review, especially for unusual tables, dates, and drop rules.
- Workload defaults are explainable heuristics and are not yet calibrated against a broad student feedback dataset.
- Predictive grade-risk behavior and hard-course constraints remain deferred until the product has the required data.
- Relative grading provides context and deterministic statistics; it does not invent letter-grade predictions.
- Semora is university-agnostic in its domain model, while the initial catalogue/import path is optimized for the LUMS Fall 2026 source format.

See [docs/FINAL_STATE_AUDIT.md](docs/FINAL_STATE_AUDIT.md) for the complete implementation audit and [docs/USER_MANUAL.md](docs/USER_MANUAL.md) for the user guide.

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md) — product contract and lifecycle.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system boundaries and invariants.
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — persistence model.
- [docs/UI_UX.md](docs/UI_UX.md) — interface direction and interaction rules.
- [docs/BUILDPLAN.md](docs/BUILDPLAN.md) — phase sequencing and acceptance criteria.
- [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) — implementation truth.
- [docs/FINAL_STATE_AUDIT.md](docs/FINAL_STATE_AUDIT.md) — final audit and remaining operational work.
- [docs/USER_MANUAL.md](docs/USER_MANUAL.md) — student-facing operating guide.
