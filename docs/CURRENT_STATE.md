# Semora — Current Implementation State

**Last Updated:** August 20, 2026
**Current Phase:** Phase 0 — Repository Foundation (in progress)
**Next Build Phase:** Phase 0 — Repository Foundation
**Product Status:** Product and technical design complete; repository and database foundation are implemented; authentication remains.

---

# 1. Executive Summary

Semora is currently in the **design-complete, Phase 0 scaffolded** state.

The product direction, V1 scope, domain model, engine behavior, architecture, and implementation roadmap have been documented.

No production application code should currently be assumed to exist. The
Phase 0 monorepo folders and root workspace manifest now exist.

The immediate next objective is:

> **Implement Phase 0 of `BUILDPLAN.md`.**

---

# 2. Product Direction

Semora is a semester decision and workload intelligence platform for university students.

Core lifecycle:

```text
PLAN → LOCK → NAVIGATE
```

Primary V1 value:

### PLAN

Help students design and compare candidate semesters using:

* courses;
* sections;
* timetable structure;
* workload profiles;
* personal preferences;
* extracurricular commitments;
* explainable semester-level trade-offs.

### LOCK

Convert the selected candidate semester into the student's real active semester.

### NAVIGATE

Use verified course outlines, assessments, workload modeling, and grade calculations to understand:

* upcoming deadlines;
* academic pressure;
* semester workload peaks;
* current course performance.

---

# 3. Initial Market

Initial beachhead:

```text
LUMS
```

Initial academic term:

```text
Fall 2026
```

LUMS is an initial data source and testing environment.

The core product architecture remains university-agnostic.

---

# 4. Implementation Status

## Repository

```text
PARTIALLY IMPLEMENTED — FOUNDATION SCAFFOLD ONLY
```

Created:

```text
apps/web
apps/api
packages/domain
packages/semester-engine
prisma
tests
```

Root workspace tooling is now configured:

```text
workspace package manifest
TypeScript base configuration
Prettier configuration
npm lockfile and installed dependencies
```

The local Git repository has been initialized on `main` and contains the initial
scaffold commit. No GitHub remote exists yet.

---

## Frontend

```text
PARTIALLY IMPLEMENTED — VITE REACT SHELL
```

Planned:

```text
React
TypeScript
Vite
```

---

## Backend

```text
PARTIALLY IMPLEMENTED — EXPRESS HEALTH API
```

Implemented:

```text
GET /api/health
```

Planned:

```text
Node.js
TypeScript
Express
```

---

## Database

```text
IMPLEMENTED — PRISMA SCHEMA, MIGRATION, AND DEVELOPMENT SEED
```

Planned:

```text
PostgreSQL
Prisma
```

Implemented:

```text
Phase 0 Prisma schema
Prisma configuration and generated client
Docker Compose definition for local PostgreSQL
Idempotent LUMS / Fall 2026 development seed
Initial migration applied successfully
LUMS / Fall 2026 seed applied successfully
Local PostgreSQL connection verified
```

Pending:

```text
Database connectivity endpoint in the API
```

---

## Authentication

```text
NOT STARTED
```

---

## Course Catalogue

```text
NOT STARTED
```

Real Fall 2026 LUMS data is available externally to the developer but has not yet been imported into Semora.

Relevant available source data includes:

* course memos;
* course timings;
* section information;
* course capacities where provided;
* course outlines.

---

## Semester Designer

```text
NOT STARTED
```

Specification complete.

See:

```text
docs/engines/SEMESTER_ENGINE.md
```

---

## Semester Engine

```text
DESIGNED
NOT IMPLEMENTED
```

---

## Active Semester / Lock Flow

```text
DESIGNED
NOT IMPLEMENTED
```

---

## Course Outline Extraction

```text
DESIGNED
NOT IMPLEMENTED
```

See:

```text
docs/engines/AI_EXTRACTION.md
```

---

## Workload Engine

```text
DESIGNED
NOT IMPLEMENTED
```

See:

```text
docs/engines/WORKLOAD_ENGINE.md
```

---

## Grade Engine

```text
DESIGNED
NOT IMPLEMENTED
```

See:

```text
docs/engines/GRADE_ENGINE.md
```

---

## Deployment

```text
NOT STARTED
```

---

# 5. Documentation Status

The following product and engineering specifications currently exist.

```text
docs/
├── PRODUCT.md
├── DECISIONS.md
├── DATA_MODEL.md
├── ARCHITECTURE.md
├── BUILDPLAN.md
├── CURRENT_STATE.md
├── UI_UX.md
├── FUTURE.md
│
└── engines/
    ├── SEMESTER_ENGINE.md
    ├── WORKLOAD_ENGINE.md
    ├── GRADE_ENGINE.md
    └── AI_EXTRACTION.md
```

The documentation authority order and Phase 0 contract are defined in
`BUILDPLAN.md`. `FUTURE.md` is a non-authoritative backlog for explicitly
deferred ideas.

---

# 6. Architectural Decisions Already Locked

Important implementation constraints:

### Modular Monolith

Semora V1 should remain one understandable application.

Do not introduce microservices without a demonstrated requirement.

---

### End-to-End TypeScript

Planned:

```text
Frontend    TypeScript
Backend     TypeScript
Engines     TypeScript
```

Python is not required for V1.

---

### PostgreSQL

Canonical academic and personal semester data belongs in a relational database.

---

### Pure Engines

The following engines should remain deterministic packages:

```text
Semester Engine
Workload Engine
Grade Engine
```

They should not directly access:

```text
HTTP
Prisma
React
LLM APIs
```

---

### AI Extraction Boundary

AI produces:

```text
Extraction Draft
```

Human verification produces:

```text
Canonical Academic Data
```

Unverified extraction must never become authoritative input to downstream engines.

---

### LUMS Adapter Boundary

LUMS-specific parsing/import logic belongs at the system boundary.

Core domain objects remain generic.

---

# 7. V1 Scope

The authoritative V1 feature contract is defined in:

```text
PRODUCT.md
```

and implementation ordering is defined in:

```text
BUILDPLAN.md
```

Agents should not expand V1 unless explicitly instructed.

---

# 8. Explicit Non-Goals

Current V1 does not include:

* LMS integrations;
* Gmail integrations;
* WhatsApp integrations;
* professor ratings;
* LDF scraping;
* degree planning;
* course reviews;
* social features;
* AI tutoring;
* note-taking;
* flashcards;
* mobile-native application;
* community workload intelligence;
* automatic semester generation;
* ML-based grade prediction;
* detailed study scheduling.

New ideas belong in:

```text
FUTURE.md
```

not normal implementation.

---

# 9. Current Known Product Risks

## Risk 1 — Semester scores feel arbitrary

Mitigation:

* multidimensional metrics;
* centralized heuristics;
* explainability;
* manual overrides;
* Fall 2026 dogfooding.

---

## Risk 2 — AI outline extraction is inaccurate

Mitigation:

* evidence-backed extraction;
* deterministic validation;
* user review;
* manual-entry fallback.

---

## Risk 3 — Scope expands during implementation

Mitigation:

* `PRODUCT.md`;
* `DECISIONS.md`;
* `BUILDPLAN.md`;
* explicit non-goals;
* `FUTURE.md`.

---

## Risk 4 — Development time decreases during semester

Mitigation:

* phase-based implementation;
* small Codex objectives;
* modular monolith;
* documentation-based handoffs;
* fresh agent threads at phase boundaries.

---

# 10. Real-World Dogfooding Opportunity

Fall 2026 begins shortly.

Semora should begin using real Fall 2026 data as early as possible.

The most important near-term product milestone is:

> **Get the Semester Designer working with actual Fall 2026 course data while course selection decisions are still relevant.**

Do not delay this milestone in order to build later NAVIGATE features.

---

# 11. Immediate Next Implementation Phase

According to `BUILDPLAN.md`:

# Phase 0 — Repository Foundation

Required:

```text
React + TypeScript + Vite frontend

Node + TypeScript + Express backend

PostgreSQL + Prisma

Basic authentication

Initial academic schema

Development seed data

Testing/tooling foundation
```

No AI functionality is required during Phase 0.

---

# 12. Phase 0 Completion Condition

Phase 0 is complete when:

* repository structure exists;
* frontend runs;
* backend runs;
* `/api/health` works;
* PostgreSQL connection works;
* initial migrations work;
* seed data works;
* basic authentication works;
* protected application shell works;
* tests/typechecking/build succeed.

At that point this file must be updated.

---

# 13. Agent Startup Instructions

Before implementing anything, an agent should read:

```text
PRODUCT.md
DECISIONS.md
CURRENT_STATE.md
BUILDPLAN.md
```

Then read only the technical specifications relevant to the current task.

The repository itself remains authoritative about what code actually exists.

Do not infer implementation simply because a specification describes it.

---

# 14. CURRENT_STATE Maintenance Rule

This document must remain factual.

Use:

```text
IMPLEMENTED
PARTIALLY IMPLEMENTED
NOT IMPLEMENTED
KNOWN ISSUE
```

accurately.

Never mark planned behavior as implemented.

---

# 15. Required Update After Every Major Phase

Update:

### Current Phase

### Implemented

### Partially Implemented

### Known Issues

### Tests

### Architecture Deviations

### Database State

### Important Files

### Next Objective

Old details that no longer help the next agent may be condensed.

This file should remain much shorter than the full specifications.

---

# 16. Architecture Deviation Section

There are currently:

```text
NONE
```

If implementation intentionally differs from specifications, document:

```text
Expected:
...

Implemented:
...

Reason:
...

Impact:
...
```

Permanent architectural/product changes should additionally be recorded in:

```text
DECISIONS.md
```

---

# 17. Known Issues

Current implementation issues:

```text
The API does not yet expose a database connectivity check. Authentication and
protected routes are not implemented yet.

Development currently uses the local PostgreSQL 18 service on port 5432 through
pgAdmin. Docker Compose remains an optional isolated alternative on host port
5433.

The Codex sandbox still requires a per-command Git safe-directory override, while
the developer terminal has configured the repository as safe.
```

---

# 18. Test Status

```text
API health integration test passes.
Prisma migration status reports the database is up to date.
Prisma seed command succeeds against the configured local database.
Broader test coverage and test tooling for the web application are not
implemented yet.
```

Testing infrastructure is part of Phase 0.

---

# 19. Deployment Status

```text
Not deployed.
```

---

# 20. Current Repository Truth

At the time of this document:

```text
PRODUCT DESIGN        COMPLETE
ENGINE DESIGN         COMPLETE
DATA MODEL DESIGN     COMPLETE
ARCHITECTURE DESIGN   COMPLETE
BUILD PLAN            COMPLETE

UI/UX SPEC            COMPLETE
FUTURE BACKLOG        CREATED

APPLICATION CODE      PHASE 0 FOUNDATION IN PROGRESS
DATABASE              CONNECTED — MIGRATION AND SEED APPLIED
TESTS                 API HEALTH TEST ONLY
DEPLOYMENT            NOT STARTED

REPOSITORY SCAFFOLD    CREATED
WORKSPACE TOOLING      CONFIGURED
PRISMA SCHEMA          CONFIGURED — MIGRATION AND SEED APPLIED
LOCAL GIT REPOSITORY   INITIALIZED — INITIAL COMMIT CREATED
GITHUB REMOTE          CONFIGURED
```

---

# 21. Next Action

Do **not** continue product ideation.

Do **not** implement later-phase features.

Next:

```text
1. Add an API database connectivity check
2. Add basic authentication and the protected application shell
3. Add Phase 0 integration coverage
```

---

# 22. Current State Summary

Semora currently has:

> **a locked product thesis, a clean Phase 0 foundation, and no later-phase
> product behavior implemented yet.**

The next implementation agent should continue from the repository state above,
using the existing documentation as the design contract.

The next implementation agent should treat the existing documentation as the design contract and start building the smallest architecture required to reach Semester Designer.
