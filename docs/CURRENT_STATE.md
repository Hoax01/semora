# Semora — Current Implementation State

**Last Updated:** August 22, 2026
**Current Phase:** Phase 7 — Grade Intelligence (complete)
**Next Build Objective:** Phase 8.1 — UX Pass
**Product Status:** Product and technical design are complete. Phase 0 is
complete, the Phase 1 catalogue acceptance audit is complete, all Phase 2
planning requirements are implemented, and the post-Phase 2 Sol architecture
checkpoint is complete. Phase 3 and its optional Sol behavior audit are now
complete; preliminary workload profiles, course-preference fit summaries,
workload interaction penalties, candidate metrics, structured findings,
comparison, recommendation tags, and bounded what-if exploration are
implemented and regression-covered. Phase 4 lock, Add/Drop, and
active-semester UI requirements are now implemented. The deterministic Phase 5
document-normalization foundation, private outline upload/storage, extraction
job state, a free local deterministic provider, deterministic validation, the
mandatory review/verification flow, canonical persistence, and an opt-in
ground-truth benchmark are now implemented. Phase 5 is complete. The Phase
6.1 pure deterministic Workload Engine package, Phase 6.2 manual assessment
management, Phase 6.3 personal effort estimates, Phase 6.4 one-off commitment
events, Phase 6.5 workload calculations, Phase 6.6 daily pressure, Phase 6.7
weekly pressure, Phase 6.8 pressure findings, Phase 6.9 semester heatmap, and
Phase 6.10 initial command-center dashboard, Phase 6.11 deadline changes, and
Phase 6.12 completion feedback are now implemented and regression-covered. The
Phase 6 acceptance criteria are satisfied. Phase 7.1 Grade Engine foundation, Phase 7.2 score entry/personal score persistence, Phase 7.3 current performance, Phase 7.4 absolute grade thresholds, Phase 7.5 target analysis, Phase 7.6 temporary what-if scenarios, Phase 7.7 drop rules, Phase 7.8 relative grading, and Phase 7.9 Grade Dashboard are implemented and regression-covered. Phase 7 acceptance criteria are satisfied; Phase 8 product polish is next. A full
Phase 6 acceptance audit was completed on August 21, 2026: the primary
authenticated flow was smoke-tested in the browser from sign-in through
semester lock, assessment forecasting, deadline editing, completion feedback,
and the responsive active dashboard. The audit hardened the native assessment
date field to retain values delivered through both browser input and change
events. On August 22, 2026, the complete automated suite and an authenticated
HTTP smoke test from Phase 0 through Phase 7 passed, covering the final grade
dashboard, relative context, outline verification, workload recalculation,
deadline movement, and completion feedback. Interactive browser control was
also attempted for this audit, but the local Windows browser-runtime helper
exited before a page could be opened; no product failure was observed in the
HTTP smoke or automated API/engine checks.

---

## Phase 0–3 feedback audit — August 22, 2026

- Fixed the sign-in handoff by using the same full-page session hydration as sign-up; this prevents the protected route from racing the newly issued Better Auth session cookie. The auth card also has explicit centered grid alignment.
- Added a `Computer Science` catalogue alias for `CS` offerings, with an API regression test. Re-imported the local Fall 2026 LUMS catalogue through the corrected importer so the current database now stores `CS 370` as `Operating Systems` and cleanly handles neighboring wrapped titles.
- Narrowed LUMS PDF title extraction to the verified course-row window around each course code, preventing the first line of the next wrapped title from being concatenated into the current title. Added a parser regression fixture.
- Added visible recurring-meeting validation for reversed times, plus inline explanations for HARD, SOFT, and FLEXIBLE commitments. The UI now explicitly supports office hours as a HARD recurring commitment; mixed fixed and flexible obligations should be entered as separate commitments because flexibility applies to the whole record.
- Clarified that unsaved section/course/commitment changes and workload-priority changes are temporary previews; the selected candidate and saved preferences remain unchanged. Preliminary metric copy now distinguishes lower-is-lighter load metrics from higher-is-better fit/balance metrics, and early, late, and long-day signals are presented as always-visible cards.
- Clarified default-medium preferences, manually editable structural workload estimates, one-off effort semantics, and that workload profiles/course ratings are stored once per workspace and course offering and reused by candidate options. Workload inputs use 0.25 spinner increments while allowing existing off-quarter values such as `6.63` to save unchanged; workload dimensions retain their existing one-decimal database precision.
- Added regression coverage for Computer Science search and two-decimal estimated weekly hours. Focused and full checks passed: 88 tests, typecheck, build, format check, lint, and Prisma migration status. Interactive browser control remained unavailable because the local Windows browser-runtime helper exited before opening a page; API and engine verification passed.

## Phase 5 review polish — August 22, 2026

- Fixed outline-review category and assessment remove actions: they no longer use the fixed-size icon-button style, so the label stays inside the row and the responsive action column remains usable.
- Course identity review now exposes editable instructor-name fields with add/remove support for multiple instructors. Verified corrections persist on the user-owned `ActiveCourseState` and are returned through the active-semester workspace response without mutating shared catalogue section data.
- Added migration `20260822110000_phase5_instructor_review` and extended the Phase 5 integration test to verify instructor correction through review, verification, canonical persistence, and dashboard serialization. The in-app browser smoke attempt remained unavailable because the local Windows browser-runtime helper exited before opening a page; automated UI build, API integration, and engine checks passed.

## Implemented

### Repository and tooling

- npm workspaces with apps/web, apps/api, and the packages under packages/*,
  plus Prisma and the repository verification tooling.
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
- Successful registration performs a full navigation to the protected dashboard
  so the new session is hydrated before workspace setup begins. Vite now fails
  clearly if port 5173 is already occupied instead of silently serving an
  untrusted origin for Better Auth.
- Vite development proxy routes `/api` requests to the API.
- Protected Fall 2026 catalogue screen with search, course rows, and course
  detail views showing sections, credits, instructors, capacities, and meeting
  times.
- Catalogue search prioritizes course-code prefixes for code-shaped queries
  such as `CS`, `MKTG`, or `CS 3`, while still supporting title and department
  searches such as `Operating Systems` or `Computer Science`.
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
- Selected courses expose editable preliminary workload assumptions across the
  initial ten dimensions plus estimated weekly hours. Structural estimates are
  visibly distinguished from user estimates, unknown dimensions remain blank,
  and user estimates can be reset.
- Selected courses expose normalized low/medium/high interest and career-
  relevance ratings. Ratings are stored per workspace and course offering, so
  alternate candidate semesters reuse them; the intelligence panel shows the
  resulting weighted fit summaries and rating completeness.
- The intelligence panel shows centralized interaction-pressure heuristics for
  project, continuous-assessment, and exam concentration, including heavy
  profile counts and unknown-profile coverage.
- The intelligence panel shows preliminary 0–10 candidate metrics for workload,
  schedule quality, commitment compatibility, course fit, balance, analysis
  confidence, and data completeness. Unknown metric inputs remain explicit.
- The intelligence panel shows deterministic structured findings with severity,
  stable message keys, related course or commitment IDs, and concise UI copy
  for clashes, concentration, schedule patterns, commitments, free days, and
  low data completeness.
- The planner compares all active candidates side-by-side with aligned metrics,
  credits, meaningful findings, meaningful-difference highlighting, validity
  status, directionally correct trade-off explanations,
  confidence/completeness values, and deterministic context-sensitive
  recommendation tags. Differences below the configured significance threshold
  remain neutral.
- The planner provides non-persistent what-if exploration for alternate
  sections, adding/removing courses, removing commitments, and changing
  workload priority. Scenario analysis is recalculated by the Semester Engine
  including its credit total and never mutates the saved candidate.
- The planner switches to an active-semester view after locking, showing active
  course cards, active credits, a weekly timetable, and simple controls for
  adding, switching, and dropping courses.
- The active-semester assessment form accepts exact due dates through native
  date input and change events, preserving the date used by workload forecasts.

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
  duplicate official section labels without dropping schedule rows, including
  all section rows immediately before the next course code.
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
  Semester Engine input contract and returns deterministic schedule analysis,
  resolved preliminary workload profiles, course-preference fit summaries,
  workload interaction penalties, preliminary candidate metrics, structured
  findings, and hard-constraint validity.
- Ownership-checked workspace comparison analysis returns all active candidates
  with deterministic metric differences, trade-offs, validity, and
  preference-sensitive recommendation tags.
- Ownership-checked candidate scenario analysis recalculates bounded course,
  section, commitment, and preference what-if changes without persistence.
- Ownership-checked workload-profile PATCH/DELETE APIs persist per-workspace
  user estimates for a course offering, validate 0–10 dimensions and weekly
  hours, and restore structural estimates when reset.
- Ownership-checked course-preference PATCH/DELETE APIs persist normalized
  interest and career-relevance ratings per workspace and course offering,
  validate exact academic-term ownership, and clear ratings when requested.
- Workspace responses include owned commitment names, categories, flexibility,
  weekly effort, recurring meeting blocks, and nested one-off events for the
  active workspace.
- Ownership-checked commitment CRUD APIs support validated create, atomic edit
  (including full recurring-meeting replacement), and delete operations. Invalid
  intervals, duplicate recurring meetings, and cross-user access are rejected.
- Ownership-checked preferences update API validates normalized 0–1 values and
  upserts the typed `SemesterPreferences` record, so a legacy workspace missing
  its preference row is repaired with defaults during the update.
- Ownership-checked `POST /api/candidates/:candidateId/lock` validates that the
  candidate is non-empty and has no critical timetable conflicts, then
  transactionally copies its sections into active selections, creates empty
  active course states, marks the workspace ACTIVE, and records the locked
  candidate. Repeated locks of the same candidate are idempotent; other lock
  attempts on an active workspace are rejected.
- Ownership-checked active-semester Add/Drop APIs support adding a section,
  switching an active selection within the same course offering, and dropping
  an active selection. Each mutation is term-scoped, serialized per workspace,
  rejects duplicate active course offerings and critical timetable conflicts,
  and preserves dropped selection history.
- Ownership-checked assessment APIs support listing assessments for an active
  workspace, manual creation against an owned active course, editing academic
  fields and separate work progress, and cancellation without deleting the
  historical row. Manual records use `USER_ENTERED` provenance and work status
  is kept separate from academic result status.
- Assessment responses also expose effective effort and provenance, using
  centralized type defaults when no outline or personal estimate exists;
  personal estimates can be saved or cleared without overwriting canonical
  outline-derived effort.
- Owned class-statistics endpoints upsert or clear user-entered mean, median, standard deviation, minimum, and maximum values for an assessment. Assessment summaries map safe relative differences and z-scores from the deterministic Grade Engine while preserving ownership checks and no-letter-prediction behavior.
- Ownership-checked one-off commitment-event APIs support create, edit, delete,
  timestamp validation, effort bounds, flexibility overrides, and nested event
  serialization on owned workspace commitments.
- Ownership-checked workload calculations expand owned recurring commitments
  and one-off events into engine demand, resolve assessment effort provenance,
  and return explainable preparation, urgency, compression, overlap, and task
  pressure factors for the active workspace.
- The workload response also returns the current day and deterministic daily
  pressure series, including pressure band, estimated demand when complete,
  and contributing driver IDs.
- The workload response also returns the current week and deterministic weekly
  pressure series, including Monday-to-Sunday range, pressure band, estimated
  demand when complete, major-assessment count, course count, and driver IDs.
- Weekly pressure entries also include readable driver metadata for heatmap
  explanations, while the underlying deterministic driver IDs remain present.
- The workload response also returns deterministic structured pressure findings
  with severity, message keys, time windows, modeled pressure where available,
  and related assessment/commitment IDs.
- The workload response also returns deterministic local pressure peaks with
  their date ranges, bands, driver IDs, and readable assessment/commitment
  driver metadata for dashboard explanations.
- The planner exposes a deliberate Lock Semester panel and an active-semester
  dashboard with selected-course cards, a Monday-to-Friday timetable, active
  credit totals, and simple Add/Drop and section-switch controls. Candidate
  planning data remains separate from active-semester mutations.
- The active-semester dashboard now includes an assessment timeline and manual
  assessment entry form. Users can view assessments across active courses, add
  an assessment without an outline, edit title/type/date/weight/progress, mark
  work done, and cancel an assessment while retaining it in the timeline.
- Editing an assessment deadline persists exact or unknown date state and the
  active-semester mutation flow immediately reloads the workload analysis, so
  due-soon ordering and pressure forecasts reflect the new date.
- Marking work done removes the assessment from future workload pressure,
  refreshes the dashboard and heatmap, and provides accessible feedback with
  the next-week pressure change when one is measurable.
- The active-semester dashboard includes a workload-calculation summary with
  factor-level demand explanations for dated assessments and commitment
  pressure contribution, plus a compact next-seven-days daily pressure view.
  It also shows a compact six-week pressure forecast with numeric values,
  bands, demand, major-assessment counts, and course counts. A severity-ranked
  findings panel explains pressure spikes, assessment clusters, deadline
  compression, commitment collisions, early-start opportunities, and date
  uncertainty. The semester heatmap renders the full weekly term series and
  selecting a week explains its modeled assessment and commitment drivers.
- The active-semester dashboard now starts with an initial command-center
  summary showing today, this week, due-soon assessments, engine-ranked
  "What matters now" items, upcoming pressure, and the next chronological
  pressure peak. It uses the deterministic workload response and remains
  separate from generic productivity widgets.
- Assessment effort resolves through the Workload Engine's centralized type
  defaults, preserves outline-derived effort separately, and supports a
  user-scoped personal estimate that can be cleared to restore the fallback.
  The timeline labels personal, outline, default, and unknown effort sources.
- The planner's commitments panel supports date-specific one-off events linked
  to a recurring commitment. Events have title, start/end timestamps,
  estimated effort, and an optional flexibility override; they feed workload
  calculations while remaining out of the recurring timetable and candidate
  clash model.
- Relative-grading courses expose optional user-entered class mean, median, and standard deviation fields per assessment. The active-semester grade cards show recorded score-vs-mean differences and a z-score only when a positive standard deviation is available; missing or zero spread remains explicit, and no relative letter grade is predicted.

### Extraction foundation

- `packages/extraction` validates supported PDF, DOCX, and plain-text files,
  records deterministic file metadata including SHA-256, and returns a shared
  versioned `NormalizedDocument` representation.
- PDF normalization preserves page boundaries and page-aware paragraph/heading
  blocks. DOCX normalization preserves paragraphs, heading levels, and practical
  table row/cell relationships. Plain-text normalization preserves paragraph
  order.
- Parser failures are explicit and distinguish empty files, size limits,
  unsupported formats, parsing failures, and documents with no extractable
  content. Binary input is normalized at the parser boundary for both Node
  buffers and ordinary `Uint8Array` callers.
- This package is deterministic and format-focused. It does not own API
  transport, file storage, AI provider calls, review state, or canonical course
  persistence.

### Outline document storage

- Authenticated `POST /api/active-selections/:selectionId/outline` accepts a
  bounded raw PDF, DOCX, or plain-text upload for an owned active course.
- Uploads validate MIME type, matching extension, size, empty content, and safe
  filenames before writing bytes to private local `storage/` paths. The database
  stores only metadata and a generated storage key, never the document binary.
- Each stored document belongs to its user and workspace/course offering. The
  active course state points to the current uploaded outline document while
  preserving the unverified data completeness/confidence values.
- Cross-user active-course access is rejected. No public file URL or direct file
  download route is exposed.

### Extraction jobs and provider boundary

- Uploads create a persisted `PENDING` extraction job. The protected job status
  and process endpoints distinguish `PARSING`, `EXTRACTING`, `REVIEW_REQUIRED`,
  and `FAILED` states without mutating canonical academic data.
- Processing reads the private stored file through `@semora/extraction`, then
  passes the normalized document through an `AcademicExtractionProvider`
  contract. Provider output is runtime-validated by the schema-constrained
  extraction contract before an `ExtractionDraft` can be persisted.
- The default provider is `local-deterministic-v0`, a no-network heuristic
  extractor for course identity, instructors, grading categories, assessments,
  grading mode, thresholds, and drop rules. It emits page-aware evidence where
  available and explicit confidence/warning metadata. No paid AI vendor, API
  key, or external service is required for the baseline workflow.
- Deterministic validation adds warnings for incomplete weights or missing
  course identity and blocking conflicts for course mismatches, duplicate
  categories/assessments, over-100% weights, and invalid grade thresholds.
  Validated drafts still stop at `REVIEW_REQUIRED`; validation never writes
  canonical academic data.
- The protected review API allows an owner to edit and save a schema-valid
  draft, resolve review conflicts, confirm it as `VERIFIED` or
  `VERIFIED_WITH_GAPS`, or reject it. Verification records capture the user,
  time, and outcome. Successful verification transactionally replaces the
  active course state's canonical `GradingScheme`, `GradeCategory`,
  `GradeThreshold`, `Assessment`, and structural `WorkloadSignal` records,
  preserving verified-outline provenance and updating state completeness and
  confidence. A superseded outline cannot later overwrite the canonical data
  for a newer outline attached to the same active course. Engines consume
  those typed records rather than draft JSON. The web active-semester course
  cards provide outline upload, processing, and a two-column evidence-backed
  review workspace whose completion copy reflects canonical persistence. Course
  identity review supports editing and adding multiple instructor names; verified
  names are stored on the user-owned active course state and shown by the active
  workspace response.
- Every successful extraction intentionally enters review. The fraction that
  needs human correction is not yet a measured product percentage; it requires
  production correction tracking. The opt-in Phase 5.10 benchmark now compares
  11 manually labelled real LUMS outlines without a paid AI API.

### Workload engine foundation

- `packages/workload-engine` is a pure deterministic TypeScript package with no
  database, HTTP, React, or AI dependencies.
- The package consumes canonical-assessment-shaped inputs, supports explicit
  effort overrides with configurable type defaults, distributes remaining work
  across preparation windows, and calculates bounded daily and weekly pressure
  from effort, urgency, importance, compression, overlap, context switching,
  and dated commitment demand.
- The engine returns ranked upcoming assessments, current-day/current-week
  pressure, a whole supplied semester range, local pressure peaks, structured
  findings, pressure bands, confidence, and date completeness. Unknown dates
  do not create forecast pressure; active overdue work is represented on the
  current day.
- Findings currently cover pressure spikes, assessment clusters, major
  deadline overlap, deadline compression, commitment collisions, early-start
  opportunities, and reduced confidence from unknown dates. Configuration and
  engine version are centralized for later calibration.

### Grade engine foundation

- packages/grade-engine is a pure deterministic TypeScript package with no
  database, HTTP, React, or AI dependencies.
- Phase 7.1 Level 1 calculations normalize percentage and points-based score
  inputs, calculate direct weighted assessments and category-based grades,
  expose weighted points earned, graded weight, remaining weight, and current
  performance, resolve known absolute grade thresholds into a current letter
  equivalent, and preserve explicit unknown/ungraded states instead of treating
  missing results as zero.
- Category aggregation currently supports equal means, points-weighted means, explicit
  assessment weights, BEST_N, and DROP_LOWEST_N. Drop rules use conservative
  provisional behavior and expose category counts and excluded results.

### Grade entry

- AssessmentScore stores one owned score per user and assessment, supporting
  either points earned or a percentage override with recorded timestamp and
  USER_ENTERED provenance.
- Owned score endpoints validate the points/percentage one-of contract, reject
  points beyond a known points-possible maximum, update academic status to
  GRADED, and prevent cross-user access. Clearing a score removes the
  personal result and resets a graded assessment to UPCOMING.
- The active-semester assessment timeline provides points/percentage entry,
  save, replacement, and clear controls, with local validation and responsive
  layout.
- Relative statistics are available through the owned class-statistics flow. The active-semester Grade Dashboard now also shows the remaining assessments for each course.

### Current performance

- The owned assessment response now returns per-course grade summaries calculated
  by packages/grade-engine. Summaries include grading mode, weighted points
  earned, graded weight, remaining weight, current performance, assessment
  counts, and calculation warnings.
- The active-semester view shows course-level performance cards with explicit
  “Based on X% of course graded” context, weighted points, graded weight, and
  remaining weight. Missing scores remain ungraded rather than becoming zero.
- Supported current calculations cover equal-mean, points-weighted-mean, explicit
  assessment weights, BEST_N, and DROP_LOWEST_N. Drop-rule categories expose
  conservative provisional counts and currently excluded results.

### Absolute grade thresholds

- Absolute grading schemes now load canonical `GradeThreshold` records into the
  pure Grade Engine. Inclusive and exclusive minimum-percentage boundaries are
  validated and resolved deterministically to the highest qualifying letter.
- The assessment API returns `currentGrade` for known absolute thresholds and
  warns when an absolute course has no confirmed thresholds. Relative and unknown
  grading modes never receive a fabricated letter grade.
- The active-semester performance card shows the current equivalent only when it
  is known; relative, unknown, ungraded, and unconfirmed-threshold states remain
  explicit and safe. Temporary what-if previews are documented below.

### Target analysis

- Absolute grade summaries now calculate the required average across remaining
  course weight for every confirmed threshold. Results include the target label,
  numeric threshold, required remaining average, reachability, and an explicit
  already-secured state.
- The assessment API exposes these deterministic target analyses with the owned
  course summaries, and the active-semester grade card presents them in a calm
  target table. Impossible targets are labeled without implying a probability or
  prediction.
- Relative statistics and the per-course Grade Dashboard are now implemented. Broader product-polish work remains in Phase 8.

### What-if scenarios

- The pure Grade Engine accepts validated hypothetical assessment percentages by
  assessment ID, recalculates projected performance and absolute equivalents, and
  leaves the real assessment inputs unchanged.
- The assessment API provides an ownership-checked temporary preview route for one
  active course. It returns server-calculated grade summaries and never writes
  `AssessmentScore` or assessment-status data.
- The active-semester grade card exposes hypothetical percentages for ungraded
  assessments with known weights and labels projected results as temporary.
  Persisted/named `GradeScenario` records are intentionally outside this phase.

### Drop rules

- The pure Grade Engine supports canonical `BEST_N` and `DROP_LOWEST_N` category
  rules using the existing `GradeCategory.ruleParameterN` field. It selects the
  highest qualifying percentages deterministically and marks excluded results as
  dropped without mutating the source assessment inputs.
- Drop rules are conservative while a category is in progress: if fewer results
  are graded than the rule's counted target, all graded results count. The API
  includes category rule metadata, graded counts, and dropped counts in each
  summary, and the active-semester card explains provisional versus excluded
  results.
- No Prisma migration was required; the existing nullable `rule_parameter_n`
  field already represents the documented rule configuration.

### Grade dashboard

- Phase 7.9 extends the active-semester grade cards into the documented Grade
  Dashboard surface. Each course shows current performance, graded weight,
  target calculations, and a server-mapped list of remaining assessments.
- Remaining assessments include upcoming, submitted-but-ungraded, and missing
  academic results while excluding graded, excused, dropped, and cancelled
  records. Each row shows title, type, due-date certainty, weight when known,
  and a calm status label.
- The dashboard remains derived from owned assessment data; no grade-dashboard
  snapshot or duplicate persistence layer was added.
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
  - `20260820153904_phase3_workload_profiles`
  - `20260820190218_phase4_active_semester_schema`
  - `20260821130000_phase5_documents`
  - `20260821140000_phase5_extraction_jobs`
  - `20260821150000_phase5_extraction_verification`
  - `20260821160000_phase5_canonical_academic_data`
  - `20260821170000_phase6_assessment_management`
  - `20260821180000_phase6_personal_effort_estimates`
  - `20260821190000_phase6_commitment_events`
  - `20260822110000_phase5_instructor_review`
- Phase 2 planning persistence now includes `SemesterPreferences`,
  `CandidateSemester`, `CandidateCourseSelection`, `UserCoursePreference`,
  `Commitment`, and `CommitmentMeeting`, with workspace ownership and safe
  cascade/restrict boundaries.
- Phase 4.1 persistence now includes workspace lock metadata,
  `ActiveCourseSelection` records with active/dropped status and timestamps,
  and one-to-one `ActiveCourseState` records with explicit data
  completeness/confidence defaults. Candidate planning selections remain
  separate from active selections.
- `CourseWorkloadProfile` stores workspace-owned preliminary estimates with
  source, confidence, optional section scope, and the ten Phase 3 dimensions.
- The `@semora/semester-engine` package contains deterministic timetable
  interval validation, credit arithmetic, typed candidate analysis inputs,
  structural workload estimation, user-profile resolution, and schedule
  metrics for daily class duration, campus span, raw and thresholded idle gaps,
  fragmentation, Monday-to-Friday free days, early/late exposure, and long-day
  detection. Candidate analysis also evaluates duplicate-course, credit,
  required-free-day, and class-time constraints when supplied, and treats soft
  commitment overlap as a compatibility penalty. It has no database, HTTP,
  React, or LLM dependencies.
- Official Fall 2026 LUMS schedule imported into the local PostgreSQL service
  on port 5432: 520 course offerings, 951 section/component records, and 1,658
  day-specific meetings after correcting the PDF row-boundary parser.
- Development seeding is bootstrap-only: an already-populated Fall 2026 term is
  left unchanged, while a clean database receives 10 offerings, 20 sections,
  and 40 meetings. It no longer overwrites or supplements an official import.
- A complete term import removes stale unreferenced offerings from that term,
  retains referenced historical selections, and leaves other universities and
  academic terms untouched.
- Optional Docker Compose PostgreSQL remains available on host port 5433.
- Phase 5 migrations now persist document metadata, extraction jobs, temporary
  extraction drafts, verification events, and verified-outline-derived
  canonical academic structure scoped to each active course state.
- Phase 6.2 adds `AssessmentWorkStatus`, optional progress percentage, and
  `USER_ENTERED` academic-source provenance. The existing `Assessment` remains
  scoped through the user's active course state; no shared-assessment model was
  introduced.
- Phase 6.3 adds nullable personal effort hours and confidence alongside the
  canonical assessment effort fields. The API returns the effective estimate
  and its provenance without overwriting verified outline data.
- Phase 6.4 adds `CommitmentEvent` records linked to workspace commitments.
  Recurring commitment schedule rows remain separate from one-off dated event
  demand, and event records cascade with their parent commitment.
- Phase 6.5 adds workload calculation integration without persisting derived
  snapshots. The active-semester surface now exposes dated assessment factors
  and aggregate commitment pressure from owned recurring and one-off demand.

---

## Tests and verification

The following quality suite passes after the Phase 7.9 Grade Dashboard
implementation and the complete Phase 7/end-to-end audit. The suite currently
reports 87 passing tests across the API, extraction, grade-engine,
semester-engine, and workload-engine packages:

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
  imported without duplication; database counts are 520 offerings, 951
  sections, and 1,658 meetings.
- LUMS schedule parsing covers wrapped titles, cross-listed aliases, compact
  day codes, duplicate source section labels, and trailing section rows such as
  MKTG 201 LEC 4 and LEC 5.
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
  duration, campus span, raw and thresholded gaps, weekday-only free days,
  configurable long-day and early/late thresholds, malformed intervals, and
  combined timetable/constraint validity.
- The authorized candidate analysis endpoint returns the selected candidate's
  deterministic schedule metrics and resolved workload profiles and was
  exercised through the API integration suite.
- Workload profile unit tests cover structural estimates, unknown dimensions,
  user overrides, validation bounds, and profile reset behavior. API coverage
  covers authorized save, analysis resolution, reset, and existing ownership
  boundaries.
- Workload interaction tests cover threshold counts, configurable penalty
  escalation, independent project/continuous/exam concentration, and unknown
  dimensions. Candidate metric tests cover weighted workload, schedule and
  commitment compatibility, course fit scaling, balance, confidence, and
  completeness; the API analysis contract exercises the metrics payload.
- Structured finding tests cover critical timetable conflicts, workload
  concentration severity, long campus days, early/late patterns, fixed
  commitments, free days, and low-data findings; the API analysis contract
  exercises the findings payload.
- Candidate comparison tests cover meaningful-difference thresholds,
  low-style preference direction, invalid-candidate tag exclusion, true
  best/worst selection across three options, preference-sensitive tags,
  reproducible trade-offs, and API comparison ownership. Scenario tests cover
  credit recalculation, non-persistent course removal, preference overrides,
  and cross-user rejection.
- Commitment metric tests cover the deterministic compatibility penalty and
  structured finding for SOFT overlaps while FLEXIBLE overlaps remain
  non-invalidating.
- workspace commitment serialization and the Monday-to-Friday schedule
  rendering contract.
- `@semora/extraction` unit coverage verifies format detection, deterministic
  metadata, plain-text normalization, PDF page/heading extraction, DOCX
  paragraph/table normalization, and clear invalid-input errors.
- Document storage integration coverage verifies authenticated owned uploads,
  SHA-256/file metadata persistence, private byte storage, active-course-state
  attachment, cross-user rejection, MIME/extension validation, and empty-file
  rejection.
- Extraction job integration coverage verifies persisted `PENDING` jobs,
  authorized status/process access, parser failure isolation, and explicit
  failed-job state, plus successful local processing into `REVIEW_REQUIRED`
  with a draft, owner-only draft editing, verification, and the persisted
  verification event. Canonical persistence coverage verifies typed
  grading/assessment/workload records, verified-outline provenance, and active
  course completeness/confidence updates. Replacement-upload coverage verifies
  that a superseded review draft cannot be verified over the currently attached
  outline. Provider unit coverage verifies schema-constrained output, provider
  document-identity enforcement, rejection of malformed confidence values,
  local extraction evidence, and deterministic validation conflicts.
- `@semora/workload-engine` unit coverage verifies explicit/default effort,
  urgency, deadline extension, completion, overlap, commitment pressure,
  unknown-date behavior, importance separation, and active overdue work.
- Assessment API integration coverage verifies manual creation, exact/unknown
  dates, separate progress and academic status, completion, cancellation,
  personal effort override/reset behavior, centralized type defaults,
  ownership isolation, active-course-state boundaries, workload forecast changes after moving a deadline or marking work done,
  and owned score entry, replacement, clearing, validation, persistence, current-performance summary calculations, known absolute-threshold current-grade resolution, target-analysis calculations, temporary grade-scenario previews, BEST_N/DROP_LOWEST_N calculations, relative statistics, remaining-assessment dashboard mapping, non-mutation, and ownership isolation.
- Commitment-event integration coverage verifies owned create/edit/delete,
  invalid time ordering, workspace serialization, and cross-user rejection.
- A real deduplicated LUMS outline was parsed successfully in smoke verification:
  six pages, six non-empty pages, 260 normalized blocks, and 14,658 text
  characters. The local `LUMS_data/` corpus remains ignored and is not a test
  dependency.
- The opt-in Phase 5.10 benchmark runs against 11 manually labelled real LUMS
  outlines and parsed all 11 successfully. It measured 100% course-code
  accuracy, 90.9% grading-mode accuracy, 52.6% weight accuracy, 52.6%
  assessment recall, 97.5% assessment-type accuracy among matched assessments,
  100% threshold accuracy, 0% blocking-conflict rate, and a 90.9% correction
  proxy. The correction proxy is benchmark mismatch coverage, not a measured
  production user-correction rate. Date accuracy was 0% on the one labelled
  date; the local provider currently does not reliably extract calendar dates.
  Re-run it explicitly with `npm run benchmark --workspace @semora/extraction`;
  ordinary `npm test` remains corpus-independent.
- commitment create/edit/delete, recurring meeting validation, and
  cross-user authorization coverage.
- default preference creation, normalized preference updates, invalid-value
  rejection, legacy-row repair, persistence on workspace reload, and cross-user
  rejection.
- catalogue imports reject malformed or duplicate source records and preserve a
  selected section's stable identity across a repeated import while updating
  its meetings.
- Prisma migration status reports all fifteen checked-in migrations applied and the local database schema is up to date after the Phase 7.8 relative-grading migration.
- Lock workflow integration coverage verifies critical-conflict rejection
  without mutation, active selection/state creation, workspace transition,
  repeated-lock idempotency, Add/Drop operations, same-offering duplicate
  rejection, section switching, dropped-history preservation, and cross-user
  rejection.
- Browser smoke coverage used a temporary local account to exercise sign-in,
  semester setup, catalogue search, course selection, lock, active-semester
  dashboard rendering, dated assessment forecasting, deadline movement,
  completion feedback, and the 390-pixel responsive dashboard. No new browser
  errors occurred after the date-input fix; the only recorded errors were
  stale logs from the intentionally failed first patch during the audit.
- The August 22 end-to-end HTTP smoke used a fresh throwaway account and passed
  the authenticated Phase 0–7 path: health/database checks, catalogue and
  planning, lock/Add-Drop, outline upload/extraction/review/verification,
  assessment scores and class statistics, relative grade context, temporary
  grade scenarios, workload pressure, deadline movement, and completion
  feedback. The interactive browser-runtime attempt was blocked by the local
  Windows sandbox helper before page discovery; this is an environment
  limitation, not an application failure.

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
3.4 Preliminary Workload Profiles
3.5 User Course Preferences in analysis
3.6 Interaction Penalties
3.7 Candidate Metrics
3.8 Findings
3.9 Candidate Comparison UI
3.10 Recommendation Tags
3.11 Scenario Exploration
```

Phase 3 acceptance status:

```text
SATISFIED — students can inspect one candidate's deterministic intelligence,
compare multiple active candidates, see explainable preference-sensitive tags,
and explore bounded unsaved scenarios. Automatic generation, Pareto UI, ML,
community intelligence, and LLM recommendations remain out of scope.
```

### Phase 4 implementation status

Implemented in this phase so far:

```text
4.1 Active Semester Schema
4.2 Lock Workflow
4.3 Add/Drop Support
4.4 Active Semester UI
```

Phase 4 acceptance status:

```text
SATISFIED — students can compare and lock a candidate, see the active semester,
and add, switch, or drop active courses while candidate planning data remains
preserved.
```

### Phase 5 implementation status

Implemented in this phase so far:

```text
5.1 Extraction Package foundation
5.2 File Storage and Document Metadata
5.3 PDF + DOCX Parsing foundation
5.4 Normalized Document foundation
5.5 Extraction Job and Provider Boundary foundation
5.6 Schema-Constrained Extraction Contract foundation
5.5 Local Deterministic Provider (free baseline)
5.7 Deterministic Validation foundation
5.8 Mandatory Review UI and Verification
5.9 Canonical Persistence after Verification
5.10 Extraction Benchmark
```

Still incomplete in this phase:

```text
None
```

Phase 5 acceptance status:

```text
SATISFIED — deterministic normalization, private user-owned storage, persisted
extraction jobs, a free local course-structure draft provider, deterministic
validation, mandatory evidence-backed review/verification, transactional
canonical persistence, and an opt-in ground-truth benchmark for PDF, DOCX, and
plain text boundaries. The benchmark is intentionally separate from ordinary
tests and does not require paid AI access.
```

The optional Phase 3 Sol behavior audit is complete. It corrected weekend
inflation in free-day scoring, meaningful-gap threshold handling, missing soft
commitment overlap penalties, omitted scenario/comparison credits and findings,
non-directional trade-off copy, arbitrary two-option assumptions in multi-
candidate trade-offs, and recommendation emphasis for negligible differences.
It also made the evaluable fields in the typed constraint contract explicit in
candidate validity instead of silently ignoring them.

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
- The Phase 0–4 migrations, corrected clean-database seed, and API suite were
  verified against a temporary PostgreSQL database during the earlier audit.
  The temporary database was removed after verification.
- The official local catalogue now contains 520 offerings, 951 sections, and
  1,658 meetings after correcting the PDF parser's course-row boundary and
  re-running the official import. MKTG 201 now exposes five sections,
  including Mahira Ilyas and Saima Mujtaba Rana.

### Phase 1 acceptance audit

- The authenticated web UI was manually reviewed against the imported local
  database. Sign-up arrives directly at the protected dashboard, code and title
  searches return the expected results, and the `MKTG 201` detail view shows all
  five sections with the Mahira Ilyas and Saima Mujtaba Rana timings.
- The official schedule conversion/import is repeatable and currently contains
  520 offerings, 951 sections/components, and 1,658 day-specific meetings.
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

The planning schema can persist course preferences, recurring commitments, and
workspace-owned preliminary workload profiles.
Candidate selections support add, switch, remove, duplication, and
same-offering enforcement. Timetable validation and the initial schedule
analysis run deterministically through the Semester Engine, the weekly schedule
renders persisted course and commitment blocks, commitment CRUD updates both
the schedule and clash analysis, normalized semester preferences are editable
per workspace, course interest/career ratings are editable and reused across
candidates, and workload assumptions distinguish structural estimates from
user overrides. Course ratings now produce a deterministic credit-weighted fit
summary with explicit completeness. Centralized interaction heuristics now
measure concentration among known project, continuous-assessment, and exam
profiles; candidate metrics now combine those inputs with schedule and
commitment compatibility. Structured findings now expose deterministic causes,
severity, and related IDs. Candidate comparison, recommendation tags, and
bounded scenario analysis now remain derived and non-persistent, as intended.

`packages/domain` remains an intentionally empty workspace package. Semester
calculations and their stable contracts are isolated in
`packages/semester-engine`, while API and UI transport shapes remain local to
their consumers. The Phase 3 audit did not add an unnecessary second contract
layer.

Phase 5 local storage is intentionally development-only. Files are written
under the ignored `storage/` directory (or `SEMORA_FILE_STORAGE_PATH` when
configured); production private object storage and file deletion/retention
flows are not implemented yet.

The default extraction provider is intentionally heuristic and local rather
than a paid AI service. It handles common outline patterns and exposes
uncertainty, but unusual layouts and ambiguous grading tables require review;
no external AI adapter is configured or needed for the baseline workflow.

`REVIEW_REQUIRED` is a deliberate state for every successful extraction, not a
measure of extraction failure. The 90.9% Phase 5.10 correction proxy reflects
field mismatches against 11 manually labelled outlines; it must not be
presented as a production review-rate percentage. The local provider still
needs better handling for prose/table grading layouts, calendar dates, and
drop-rule language.

The Phase 5 parser currently uses Mammoth HTML conversion for DOCX structure;
DOCX page references are therefore unavailable, and complex layout semantics
remain intentionally limited to practical paragraph and table preservation.
PDF heading detection is deterministic and heuristic, so extraction review
must remain responsible for confirming heading meaning before any canonical
course data is persisted.

Course hardness and predictive grade-risk data do not exist in the current
Phase 3 input model. Therefore `maximumHardCourses`,
`maxPreferredHardCourses`, and `gradeSafetyPriority` cannot yet influence
analysis. The engine explicitly rejects a supplied `maximumHardCourses`
constraint rather than incorrectly reporting it as satisfied; the two
preference fields remain persisted for later data-backed behavior.

API integration runs currently emit a pg deprecation warning about concurrent queries on one client. The exercised requests and assertions pass, but the adapter/driver usage should be revisited when dependencies are upgraded.

The repository existing npm run db:migrate shadow-database replay is blocked by migration 20260821162343_phase7_score_entry, which uses the USER_ENTERED enum default before the later migration that adds that enum value. The Phase 7.8 migration was applied successfully with prisma migrate deploy; the historical migration ordering defect remains documented rather than changing an already-checked-in migration.

Phase 6.1 uses configurable heuristic defaults and has not yet been calibrated
against real student workload feedback. Phase 6.10 provides the initial
command-center summary and peak forecast. Phase 6.11 covers manual deadline changes and immediate forecast refresh.
Phase 6.12 covers completion feedback and pressure removal. Phase 7.1 now
provides the pure Grade Engine foundation, Phase 7.2 provides owned score
persistence and active-semester score entry, Phase 7.3 provides current
performance, weighted points, graded weight, and remaining weight display,
Phase 7.4 provides confirmed absolute-threshold current-grade equivalents, and
Phase 7.5 provides deterministic target requirements and reachability, Phase 7.6
provides temporary hypothetical assessment previews without mutating real grade
data, and Phase 7.7 provides conservative BEST_N/DROP_LOWEST_N aggregation with transparent category summaries. Phase 7.8 provides owned class-statistics persistence, safe score-vs-mean differences, positive-SD z-scores, and relative grade context without predicting letter grades. Phase 7.9 provides the per-course Grade Dashboard with server-mapped remaining assessments. Phase 7 is complete; Phase 8 product polish is next.
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
packages/extraction/src/index.ts
packages/extraction/src/index.test.ts
packages/extraction/src/provider.ts
packages/extraction/src/provider.test.ts
packages/extraction/src/local-provider.ts
packages/extraction/src/validation.ts
packages/extraction/src/benchmark.ts
packages/extraction/src/run-benchmark.ts
packages/extraction/benchmarks/lums-fall-2026.json
packages/workload-engine/package.json
packages/workload-engine/tsconfig.json
packages/workload-engine/src/index.ts
packages/workload-engine/src/index.test.ts
packages/grade-engine/package.json
packages/grade-engine/tsconfig.json
packages/grade-engine/src/index.ts
packages/grade-engine/src/index.test.ts
apps/api/src/documents.ts
apps/api/src/document-storage.ts
apps/api/src/documents.test.ts
apps/api/src/extraction-jobs.ts
apps/api/src/assessments.ts
apps/api/src/assessments.test.ts
apps/api/src/workload.ts
apps/api/src/workload.test.ts
apps/web/src/features/extraction-review.tsx
apps/web/src/features/planning.tsx
apps/web/src/styles.css
prisma/migrations/20260822110000_phase5_instructor_review/
prisma/migrations/20260821150000_phase5_extraction_verification/
prisma/migrations/20260821160000_phase5_canonical_academic_data/
prisma/migrations/20260821130000_phase5_documents/
prisma/migrations/20260821140000_phase5_extraction_jobs/
prisma/migrations/20260821170000_phase6_assessment_management/
prisma/migrations/20260821180000_phase6_personal_effort_estimates/
prisma/migrations/20260821190000_phase6_commitment_events/
prisma/migrations/20260821162343_phase7_score_entry/
prisma/migrations/20260822100000_phase7_relative_grading/
```

---

## Next objective

Phase 2 and the documented Sol architecture checkpoint are complete. Phase 3
is complete through schedule analysis, preliminary profiles,
course-preference fit, interaction penalties, candidate metrics, structured
findings, comparison, recommendation tags, and bounded scenario exploration.
Phase 4 active-semester schema, transactional lock workflow, Add/Drop support,
and the basic active-semester UI are now complete. Phase 5 Course Outline
Extraction is complete through the opt-in ground-truth benchmark. Document
metadata, private local development storage, the authenticated active-course
upload boundary, extraction-job/provider contracts, deterministic validation,
mandatory review/verification, canonical persistence, and benchmark reporting
are in place. Phase 6.1 is complete: the deterministic Workload Engine
consumes verified canonical assessment-shaped data; draft JSON remains out of
scope for engine inputs. Phase 6.2 is complete: users can manually manage
assessment timeline items even when extraction is unavailable, with separate
work progress and academic result status. Phase 6.3 is complete: effective
effort uses centralized type defaults, preserves verified outline estimates,
and supports reversible personal overrides. Phase 6.4 is complete: users can
create, edit, and remove one-off dated events linked to commitments. Phase 6.5
is complete: owned active-semester data now produces explainable workload
factors and aggregate commitment pressure. Phase 6.6 is complete: the active
workspace exposes current and upcoming daily pressure values. Phase 6.7 is
complete: the active workspace exposes current and upcoming weekly pressure
values. Phase 6.8 is complete: the active workspace exposes deterministic,
severity-ranked pressure findings with explainable windows and related demand.
Phase 6.9 is complete: the active workspace exposes a full-term selectable
weekly heatmap with readable pressure drivers. Phase 6.10 is complete: the
active-semester view opens with a command-center summary for current pressure,
due-soon work, ranked priorities, upcoming pressure, and the next pressure
peak. Phase 6.11 is complete: changing an assessment deadline persists the
new exact/unknown date state and the workload forecast reflects it immediately.
Phase 6.12 is complete: marking work done removes future pressure, refreshes
the heatmap, and gives accessible forecast feedback. Phase 6 is complete.
Phase 7.1 is complete: the pure Grade Engine calculates score normalization,
weighted points, graded and remaining weight, category aggregation, current
performance, and safe handling of ungraded/missing results. Phase 7.2 is complete: personal AssessmentScore persistence, owned score endpoints, points/percentage validation, and active-semester score entry are implemented
and regression-covered. Phase 7.3 is complete: owned per-course grade summaries use the deterministic Grade Engine to expose current performance, weighted points earned, graded weight, and remaining weight, and the active-semester UI displays the safe “Based on X% of course graded” context. Phase 7.4 is complete: canonical absolute thresholds resolve to current letter-grade equivalents, while relative, unknown, ungraded, and unconfirmed-threshold states remain safe and explicit. Phase 7.5 is complete: known absolute thresholds expose required averages across remaining course weight, reachable/unreachable status, and already-secured targets in the API and active-semester UI. Phase 7.6 is complete: temporary hypothetical percentages produce server-calculated projected performance and grade equivalents without changing saved scores. Phase 7.7 is complete: conservative BEST_N and DROP_LOWEST_N aggregation is implemented in the pure engine, API summaries, and active-semester grade cards. Phase 7.8 is complete: owned class-statistics persistence, safe relative differences, positive-SD z-scores, and active-semester relative context are implemented without letter-grade prediction. Phase 7.9 is complete: each course now shows current performance, graded weight, target calculations, and remaining assessments in the active-semester Grade Dashboard. The next objective is Phase 8.1, UX Pass.
