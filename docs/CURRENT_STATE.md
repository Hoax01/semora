# Semora — Current Implementation State

**Last Updated:** August 20, 2026
**Current Phase:** Phase 3 — Semester Intelligence (in progress)
**Next Build Objective:** Phase 3.4 — Preliminary Workload Profiles
**Product Status:** Product and technical design are complete. Phase 0 is
complete, the Phase 1 catalogue acceptance audit is complete, all Phase 2
planning requirements are implemented, and the post-Phase 2 Sol architecture
checkpoint is complete. Phase 3 schedule analysis foundations are now
implemented; workload profiles, scoring, findings, and comparison remain.

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
- Session-aware protected root route, loading state, authenticated application
  shell, and sign-out action.
- Vite development proxy routes `/api` requests to the API.
- Protected Fall 2026 catalogue screen with search, course rows, and course
  detail views showing sections, credits, instructors, capacities, and meeting
  times.
- First-time semester setup for selecting an available university/academic
  term and creating the user's term-specific planning workspace.
- Initial responsive Semester Designer surface with visible candidate tabs,
  candidate empty states, and create, rename, duplicate, and archive actions.
- Candidate course-selection workbench with catalogue search, section choices,
  live selected-credit totals, selected-course details, section switching, and
  removal actions.
- Candidate validation warning surface that identifies course-course and
  hard-commitment timetable overlaps.
- Weekly Monday-to-Friday timetable showing selected course meetings and
  persisted commitment meetings as visually distinct blocks, including
  conflict emphasis and an aligned 08:00–21:00 time scale that covers the
  imported Fall 2026 schedule. The planning surface remains page-width-safe at
  a 390-pixel viewport while the timetable itself scrolls when necessary.
- Commitment workbench for adding, editing, and removing recurring personal
  obligations with category, weekly effort, flexibility, and optional meeting
  times.
- Concise per-semester preferences form using normalized low/medium/high
  choices for workload, schedule, career, interest, assessment style, free-day,
  and early/late-class priorities.
- Preliminary Semester Intelligence panel on the planner showing deterministic
  class time, scheduled/free days, campus span, idle gaps, early/late class
  exposure, and long-day indicators for the selected candidate.

### API and authentication

- Express API in `apps/api` with `GET /api/health` and
  `GET /api/health/db`.
- Better Auth email/password authentication, mounted at `/api/auth/*`.
- Server-managed session cookies and `GET /api/me`, which returns the current
  user or `401 UNAUTHORIZED`.
- API authentication routes are registered before JSON parsing, as required by
  the Better Auth Express handler.
- Protected `GET /api/catalogue` search endpoint for course code, title, or
  department, with exact academic-term ID scoping for planning workspaces and
  term-name compatibility for the Phase 1 catalogue, plus
  `GET /api/catalogue/:offeringId` detail endpoint.
- Validated, transactional, idempotent JSON catalogue importer at
  `npm run catalogue:import --workspace @semora/api -- <file.json>`. Repeat
  imports preserve referenced section identities, replace their meetings,
  remove stale unreferenced records, and retain selected historical records.
  Malformed intervals and duplicate courses, sections, or meetings are
  rejected before mutation.
- LUMS class-schedule PDF adapter at `catalogue:convert-lums`; the adapter
  preserves cross-listed aliases, expands compact day codes, and resolves
  duplicate official section labels without dropping schedule rows.
- Protected term and workspace APIs. Workspace creation is idempotent per user
  and academic term and creates the typed default preference record.
- Ownership-checked candidate-semester APIs for create, rename, duplicate, and
  archive. Duplication copies persisted section selections when present.
- Ownership-checked candidate-selection APIs for adding, switching, and
  removing sections. Selection writes are term-scoped and enforce at most one
  selected section per course offering, including under concurrent alternate-
  section requests through a candidate-scoped transactional advisory lock;
  candidate responses derive credits through deterministic Semester Engine
  arithmetic from the persisted section selections.
- Ownership-checked candidate timetable validation endpoint backed by the pure
  Semester Engine. It checks selected course meetings against one another and
  against persisted HARD commitment meetings; SOFT and FLEXIBLE commitments do
  not invalidate a candidate.
- Ownership-checked `GET /api/candidates/:candidateId/analysis` endpoint maps
  persisted candidate data, commitments, and preferences into the typed
  Semester Engine input contract and returns deterministic schedule analysis
  alongside hard-constraint validity.
- Workspace responses include owned commitment names, categories, flexibility,
  weekly effort, and recurring meeting blocks for schedule rendering. No
  one-off event model is exposed in this phase.
- Ownership-checked commitment CRUD APIs support validated create, atomic edit
  (including full recurring-meeting replacement), and delete operations. Invalid
  intervals, duplicate recurring meetings, and cross-user access are rejected.
- Ownership-checked preferences update API validates normalized 0–1 values and
  upserts the typed `SemesterPreferences` record, so a legacy workspace missing
  its preference row is repaired with defaults during the update.

### Database

- PostgreSQL + Prisma schema for universities, terms, courses, offerings,
  sections, meetings, and semester workspaces.
- Better Auth `User`, `Session`, `Account`, and `Verification` persistence
  models. `User.name` maps to the existing `display_name` database column.
- Migrations applied through:
  - `20260819210243_init_phase0`
  - `20260819212143_add_auth_tables`
  - `20260819212415_add_auth_account_issuer`
  - `20260820105904_phase2_planning_foundation`
- Phase 2 planning persistence now includes `SemesterPreferences`,
  `CandidateSemester`, `CandidateCourseSelection`, `UserCoursePreference`,
  `Commitment`, and `CommitmentMeeting`, with workspace ownership and safe
  cascade/restrict boundaries.
- The `@semora/semester-engine` package contains deterministic timetable
  interval validation, credit arithmetic, typed candidate analysis inputs, and
  schedule metrics for daily class duration, campus span, idle gaps,
  fragmentation, free days, early/late exposure, and long-day detection. It
  has no database, HTTP, React, or LLM dependencies.
- Official Fall 2026 LUMS schedule imported into the local PostgreSQL service
  on port 5432: 520 course offerings, 823 section/component records, and 1,441
  day-specific meetings.
- Development seeding is bootstrap-only: an already-populated Fall 2026 term is
  left unchanged, while a clean database receives 10 offerings, 20 sections,
  and 40 meetings. It no longer overwrites or supplements an official import.
- A complete term import removes stale unreferenced offerings from that term,
  retains referenced historical selections, and leaves other universities and
  academic terms untouched.
- Optional Docker Compose PostgreSQL remains available on host port 5433.

---

## Tests and verification

The following quality suite passes after the Phase 2 architecture audit:

```text
npm run typecheck
npm run test
npm run build
npm run format:check
npm run lint
```

Current API integration coverage verifies:

- API health response;
- database connectivity response;
- sign-up, authenticated current-user lookup, sign-out, and rejected session
  reuse.
- authenticated catalogue search and course-detail responses.
- importer validation and repeat execution were verified with the checked-in
  example JSON fixture; the second run reused the same canonical records.
- the official schedule converted to exactly 520 course-code rows and was
  imported twice without duplication; database counts remained 520 offerings,
  823 sections, and 1,441 meetings.
- LUMS schedule parsing covers wrapped titles, cross-listed aliases, compact
  day codes, and duplicate source section labels.
- term discovery, idempotent workspace creation, one default preference record,
  candidate validation, candidate create/rename/duplicate/archive behavior,
  and rejection of cross-user workspace/candidate access.
- candidate course/section selection, live credit totals, alternate-section
  switching, removal, duplicate preservation, same-offering rejection, and
  cross-user selection rejection, including concurrent alternate-section
  writes against the same candidate and offering.
- timetable engine overlap boundaries (overlap, back-to-back, different-day,
  and hard-versus-soft/flexible commitments), isolated malformed-interval
  rejection, stable decimal credit totals, and the authorized candidate
  validation endpoint.
- Semester Engine schedule metrics cover merged overlapping blocks, class
  duration, campus span, meaningful gaps, free days, configurable long-day and
  early/late thresholds, malformed intervals, and combined candidate validity.
- The authorized candidate analysis endpoint returns the selected candidate's
  deterministic schedule metrics and was exercised through the API integration
  suite.
- workspace commitment serialization and the Monday-to-Friday schedule
  rendering contract.
- commitment create/edit/delete, recurring meeting validation, and
  cross-user authorization coverage.
- default preference creation, normalized preference updates, invalid-value
  rejection, legacy-row repair, persistence on workspace reload, and cross-user
  rejection.
- catalogue imports reject malformed or duplicate source records and preserve a
  selected section's stable identity across a repeated import while updating
  its meetings.

### Phase 2 implementation status

Complete in this phase:

```text
2.1 Planning Schema
2.2 Workspace Creation
2.3 Candidate Semester CRUD
2.4 Course Selection
2.5 Timetable Clash Detection
2.6 Weekly Schedule UI
2.7 Commitment CRUD/UI and schedule participation
2.8 Preferences onboarding/editing
```

Phase 2 acceptance status:

```text
SATISFIED
```

### Phase 3 implementation status

Implemented in this phase so far:

```text
3.1 Semester Engine Package foundation
3.2 Typed CandidateSemesterInput contract
3.3 Deterministic Schedule Metrics
```

Not yet implemented:

```text
3.4 Preliminary Workload Profiles
3.5 User Course Preferences consumed by analysis
3.6 Interaction Penalties
3.7 Candidate Metrics
3.8 Findings
3.9 Candidate Comparison UI
3.10 Recommendation Tags
3.11 Scenario Exploration
```

Phase 3 acceptance status:

```text
IN PROGRESS — schedule analysis is available for one selected candidate;
meaningful workload comparison is not yet implemented.
```

Checkpoint A, the Sol architecture review described in
`BUILDPLAN.md`, is complete. It found and corrected high-value Phase 0–2 issues
without adding Phase 3 behavior: destructive development seeding, unstable
selected-section identities during catalogue re-import, ambiguous term-name
planning searches, concurrent same-offering selection writes, incomplete
engine input validation/credit arithmetic, missing-preference-row recovery,
and schedule range/alignment defects.

- Browser verification covered sign-in, first-time setup, exact-term catalogue
  navigation, preference persistence, candidate creation/duplication, real
  section selection, live credits, hard-commitment clash warnings, the
  08:00–21:00 timetable, desktop layout, and a page-width-safe 390-pixel mobile
  layout against the local Fall 2026 data. No browser console errors appeared.
- All four migrations, the corrected clean-database seed, and the API suite
  were verified against a temporary PostgreSQL database. The temporary database
  was removed after verification.
- The official local catalogue was restored to 520 offerings, 823 sections,
  and 1,441 meetings after the audit discovered that the old seed had mutated
  it. A full catalogue fingerprint was unchanged before and after running the
  corrected seed against that populated term.

### Phase 1 acceptance audit

- The authenticated web UI was manually reviewed against the imported local
  database. Sign-up and sign-out worked, the Fall 2026 catalogue loaded, a
  `CS 370` search returned the expected course, and its detail view showed
  credits, both sections, instructors, and day/time meetings.
- The official schedule conversion/import is repeatable and currently contains
  520 offerings, 823 sections/components, and 1,441 day-specific meetings.
- The outline audit produced 386 unique PDFs from 392 readable source PDFs by
  excluding only six byte-identical duplicate pairs. The original folder was
  preserved unchanged.
- The 92 primary timetable codes without matching outline filename tokens are
  logged in `LUMS_data/audit/OUTLINE_AUDIT.md`. They are primarily executive,
  graduate, foundation, laboratory, or advanced-course codes and do not block
  the Phase 1 catalogue contract; they remain explicit coverage gaps for later
  enrichment.
- The unavailable memo workbook was not required to satisfy the Phase 1
  catalogue contract. Descriptions, capacities, locations, and reliable
  primary/secondary component relationships remain unknown and are rendered as
  such rather than inferred.

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
The official class-schedule PDF is available locally and has been imported. It
does not contain course descriptions, capacities, locations, or reliable
primary/secondary component relationships. The unavailable memo workbook would
normally provide some of this information.

The schedule PDF contains 22 physical pages while its footer says 23 pages.
This may be an RO export numbering defect or one missing logical page.

The local outline audit found 392 readable PDFs, six byte-identical duplicate
pairs, and 92 primary timetable codes without a matching outline filename. A
non-destructive cleaned folder contains 386 unique PDFs. `LUMS_data/` is ignored
by Git because these are locally obtained institutional source documents.

`ARCHITECTURE.md` sections 124–126 retain an older phase numbering in which
candidate planning is called Phase 1. `BUILDPLAN.md` explicitly governs current
phase sequencing and defines candidate planning as Phase 2, which is also
consistent with this file. Implementation follows `BUILDPLAN.md` to avoid
product or architecture drift.

The planning schema can persist course preferences and recurring commitments.
Candidate selections support add, switch, remove, duplication, and
same-offering enforcement. Timetable validation and the initial schedule
analysis run deterministically through the Semester Engine, the weekly schedule
renders persisted course and commitment blocks, commitment CRUD updates both
the schedule and clash analysis, and normalized preferences are editable per
workspace. Preference values are mapped into the Phase 3 input contract but are
not consumed by workload scoring until the remaining Phase 3 engine work.

`packages/domain` remains an intentionally empty workspace package. Current
Phase 2 calculations are isolated in `packages/semester-engine`, while API and
UI transport shapes remain local to their consumers. Phase 3 should introduce
shared domain contracts only where its stable engine inputs make them genuinely
reusable; the checkpoint did not invent those later-phase contracts early.

API integration runs currently emit a `pg` deprecation warning about concurrent
queries on one client. The exercised requests and assertions pass, but the
adapter/driver usage should be revisited when dependencies are upgraded.
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
apps/api/src/catalogue/lums-schedule.ts
apps/api/src/planning.ts
apps/api/src/session.ts
apps/api/src/import-catalogue.ts
apps/api/src/convert-lums-schedule.ts
apps/web/src/App.tsx
apps/web/src/auth-client.ts
apps/web/src/features/planning.tsx
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

Phase 2 and the documented Sol architecture checkpoint are complete. Phase 3
has started with the schedule-analysis foundation. The next objective is to add
preliminary workload profiles, then use them with persisted course preferences
to produce explainable candidate metrics without implementing later LOCK or
NAVIGATE behavior.
