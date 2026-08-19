# Semora — Build Plan

**Status:** Active implementation plan
**Version:** 0.1
**Related:** `PRODUCT.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `UI_UX.md`, all engine specifications
**Primary goal:** Ship a polished, usable Semora V1 within the available Plus-development window while preserving a codebase that can be maintained during the semester.

---

# 1. Build Philosophy

Semora will be developed incrementally through vertical product milestones.

The project should never spend several weeks building invisible infrastructure before producing usable behavior.

The intended progression is:

```text
FOUNDATION
    ↓
PLAN
    ↓
COMPARE
    ↓
LOCK
    ↓
EXTRACT
    ↓
NAVIGATE
    ↓
GRADES
    ↓
POLISH
```

Every phase must end with something:

* working;
* testable;
* integrated;
* documented.

A phase is not complete because:

> "most of the backend exists."

It is complete when its **user-facing acceptance criteria** work end-to-end.

---

# 2. Development Constraint

The initial intensive development window occurs immediately before Fall 2026 begins.

After semester starts, typical development availability may fall substantially.

Therefore:

> **High-dependency foundational work should be completed first.**

Later phases should be independently implementable in short focused sessions.

---

# 3. Scope Authority

V1 product scope is defined by:

```text
PRODUCT.md
```

Approved changes to locked product or engineering decisions are recorded in:

```text
DECISIONS.md
```

This document defines build-phase sequencing, phase boundaries, and acceptance
criteria. It does not independently expand the V1 feature contract.

Detailed implementation behavior is defined by:

```text
UI_UX.md           interface behavior and visual requirements
ARCHITECTURE.md    system boundaries and infrastructure
DATA_MODEL.md      persistence and domain structure
engines/*.md       deterministic engine behavior
```

Authority and conflict rules:

1. An explicit accepted decision in `DECISIONS.md` may amend an earlier locked
   requirement and must identify what changed.
2. `PRODUCT.md` governs the V1 feature contract.
3. `BUILDPLAN.md` governs what is built in the current phase.
4. The detailed specifications may refine requirements inside that scope but
   may not add features to it.
5. When a general specification includes later-phase structures, the narrower
   current-phase requirement in `BUILDPLAN.md` governs.
6. `CURRENT_STATE.md` reports repository truth; it does not silently change the
   design contract.

If a potentially useful feature is not required by the current phase:

**do not implement it.**

Put it in:

```text
FUTURE.md
```

if worth preserving.

---

# 4. Codex Working Principle

Each Codex thread should have **one coherent engineering objective**.

Do not run the entire project in one enormous conversation.

Preferred pattern:

```text
New phase
↓
Fresh Codex thread
↓
Read CURRENT_STATE.md
↓
Read relevant specification(s)
↓
Inspect repository
↓
Implement phase
↓
Run tests
↓
Update CURRENT_STATE.md
↓
Commit
↓
End thread
```

This makes repository state and documentation the durable memory rather than chat history.

---

# 5. Model Usage Strategy

Recommended default:

## Terra Medium

Primary implementation model.

Use for:

* multi-file feature development;
* API implementation;
* database work;
* frontend integration;
* normal debugging;
* refactoring;
* tests.

---

## Luna Medium

Use for clearly scoped tasks such as:

* adding repetitive CRUD;
* test coverage;
* validation schemas;
* simple components;
* documentation updates;
* refactors following an established pattern;
* fixing lint/type errors.

---

## Terra High

Escalate when:

* implementation repeatedly fails;
* complex cross-module reasoning is needed;
* subtle state/data bugs appear;
* a difficult migration/refactor spans many modules.

---

## Sol High

Reserve for:

* pre-implementation architecture audit;
* major phase architecture review;
* extremely difficult bugs;
* final system audit;
* decisions that could force substantial rework.

Sol should normally **review or unblock**, not perform routine implementation.

---

# 6. Model Switching Rule

Avoid repeatedly switching models inside one long active implementation conversation.

If changing from:

```text
Terra implementation
```

to:

```text
Sol architecture audit
```

prefer opening a new thread.

The new thread should rely on:

```text
CURRENT_STATE.md
code
tests
relevant specs
```

rather than conversational history.

---

# 7. Documentation Reading Rule

Agents should not automatically read every specification for every task.

Default startup context:

```text
PRODUCT.md
DECISIONS.md
CURRENT_STATE.md
BUILDPLAN.md
```

Then read only specifications relevant to the active phase.

Any phase containing user-interface work must also read the relevant sections
of:

```text
UI_UX.md
```

Example:

Semester comparison work:

```text
SEMESTER_ENGINE.md
DATA_MODEL.md
ARCHITECTURE.md
```

Grade work:

```text
GRADE_ENGINE.md
DATA_MODEL.md
```

No need to consume `AI_EXTRACTION.md` while fixing timetable layout.

---

# 8. Git Principle

Each phase should end with a clean commit.

Meaningful intermediate commits are encouraged.

Suggested pattern:

```text
feat: add candidate semester builder
feat: implement deterministic schedule analysis
test: cover semester interaction penalties
fix: preserve candidate state on section change
```

Avoid enormous commits containing unrelated features.

---

# 9. CURRENT_STATE Rule

`CURRENT_STATE.md` must represent **what the repository actually does**.

It must never become aspirational.

At the end of each meaningful phase update:

```text
Implemented
Partially Implemented
Known Issues
Tests
Architecture Deviations
Current Data Model
Next Phase
Important Files
```

---

# 10. Phase Overview

The V1 build is divided into:

```text
Phase 0 — Repository + Architecture Foundation
Phase 1 — Academic Catalogue
Phase 2 — Semester Planning Core
Phase 3 — Semester Intelligence
Phase 4 — Lock Semester
Phase 5 — Course Outline Extraction
Phase 6 — Semester Command Center
Phase 7 — Grade Intelligence
Phase 8 — Product Polish + Dogfooding
Phase 9 — External Pilot
```

Phases 0–4 create the differentiated **PLAN** product.

Phases 5–7 create **NAVIGATE**.

---

# PHASE 0 — REPOSITORY FOUNDATION

## Objective

Create the smallest correct technical foundation required for product development.

---

## 0.1 Repository Structure

Create:

```text
apps/
  web/
  api/

packages/
  domain/
  semester-engine/

docs/

prisma/
```

Do not create unused engine packages yet unless workspace setup makes doing so trivial.

---

## 0.2 Frontend Foundation

Initialize:

```text
React
TypeScript
Vite
```

Add only baseline dependencies required immediately.

Likely:

```text
React Router
TanStack Query
Tailwind
React Hook Form
Zod
```

UI component library optional.

---

## 0.3 Backend Foundation

Initialize:

```text
Node.js
TypeScript
Express
```

Implement:

```text
GET /api/health
```

with successful response.

---

## 0.4 PostgreSQL + Prisma

Configure:

```text
PostgreSQL
Prisma
```

Initial entities:

```text
User
University
AcademicTerm
Course
CourseOffering
Section
Meeting
SemesterWorkspace
```

The selected authentication library may add its own credential and session
tables. Those tables are authentication infrastructure, not academic domain
entities.

Phase 0 must not add:

```text
CandidateSemester
CandidateCourseSelection
SemesterPreferences
Commitment
CommitmentMeeting
```

Those entities belong to their later feature phases even though
`DATA_MODEL.md` describes their eventual shape.

Do not create the full V1 schema yet.

---

## 0.5 Authentication

Implement basic:

```text
sign up
sign in
sign out
current user
protected route
```

Prefer secure cookie/session architecture.

Required security baseline:

```text
maintained authentication library
server-managed session
opaque session identifier
HTTP-only cookie
Secure cookie in production
explicit SameSite policy
origin/CSRF protection for state-changing requests
server-side authorization
```

The application-level `User` must be linked unambiguously to the identity used
by the authentication library. Do not implement password hashing or session
cryptography from scratch.

Do not spend excessive time building auth features.

No:

```text
OAuth providers
2FA
passwordless
enterprise SSO
```

required.

Email verification and password recovery are not Phase 0 acceptance criteria,
but the chosen library and schema must not prevent adding them later.

---

## 0.6 Seed Data

Create development seed:

```text
LUMS
Fall 2026

~10 representative courses
multiple sections
realistic timings
```

Enough to develop Semester Designer.

---

## 0.7 Tooling

Configure:

```text
lint
format
typecheck
unit test runner
```

---

## 0.8 CI

Optional but recommended before Phase 1 ends:

```text
install
typecheck
test
build
```

---

## Phase 0 Acceptance Criteria

A developer can:

```text
clone
install
configure env
start PostgreSQL
migrate
seed
run frontend + backend
```

A user can:

```text
create account
sign in
reach protected app
```

Frontend can fetch:

```text
/api/health
```

Database is working.

Required Phase 0 verification:

```text
migrations apply to an empty database
development seed completes successfully
GET /api/health succeeds
sign-up integration test passes
sign-in integration test passes
sign-out integration test passes
current-user integration test passes
unauthenticated protected request is rejected
authenticated protected request succeeds
lint passes
typecheck passes
tests pass
production build passes
```

These checks must pass locally. CI automation may remain optional until Phase 1
ends as stated in section 0.8.

---

## Phase 0 Non-Goals

Do not build:

* semester scoring;
* outline upload;
* grades;
* workload heatmaps;
* AI;
* file storage;
* billing.

---

## Recommended Model

```text
Terra Medium
```

Luna can handle setup cleanup/tests afterward.

---

# PHASE 1 — ACADEMIC CATALOGUE

## Objective

Semora can represent and browse the Fall 2026 academic catalogue.

---

# 1.1 Expand Catalogue Schema

Implement:

```text
Course
CourseOffering
Section
Meeting
```

fully enough to represent real LUMS term data.

---

# 1.2 LUMS Import Adapter

Create import path for actual available:

```text
course memos
course timings
```

Input formats should be inspected before implementation.

Convert LUMS-specific source format into canonical Semora entities.

---

# 1.3 Import Safety

Import must be:

```text
validated
idempotent where practical
transactional where practical
```

Repeated import must not duplicate courses/sections.

---

# 1.4 Developer Import Workflow

A polished user-facing importer is unnecessary.

Acceptable:

```text
CLI script
```

or:

```text
protected development/admin endpoint
```

---

# 1.5 Course Catalogue API

Implement filtering/search by:

```text
course code
title
department if available
```

Expose:

```text
course
credits
description
sections
instructors
timings
capacity if available
```

---

# 1.6 Course Catalogue UI

Student can browse/search Fall 2026 offerings.

Important:

This should already feel like a real product screen rather than database debug output.

---

## Phase 1 Acceptance Criteria

Real Fall 2026 LUMS data can be imported.

User can:

```text
search "CS"
open a course
see sections
see timings
see credits
```

Core schema contains no hardcoded assumption that prevents supporting another university later.

---

## Phase 1 Non-Goals

Do not build:

* professor ratings;
* seat availability;
* degree requirements;
* prerequisite engine;
* course reviews.

---

## Recommended Model

```text
Terra Medium
```

---

# PHASE 2 — SEMESTER PLANNING CORE

## Objective

A student can create realistic candidate semesters and detect hard scheduling problems.

This is the first major product milestone.

---

# 2.1 Planning Schema

Implement:

```text
SemesterWorkspace
SemesterPreferences
CandidateSemester
CandidateCourseSelection
UserCoursePreference
Commitment
CommitmentMeeting
```

---

# 2.2 Workspace Creation

User selects:

```text
University
Academic Term
```

and receives:

```text
SemesterWorkspace
```

---

# 2.3 Candidate Semester CRUD

User can:

```text
create
rename
duplicate
archive/delete
```

candidate semesters.

---

# 2.4 Course Selection

Within a candidate:

```text
add course section
remove course
change section
```

Show live:

```text
credit count
weekly timetable
```

---

# 2.5 Timetable Clash Detection

Implement deterministic clash logic from:

```text
SEMESTER_ENGINE.md
```

Support:

```text
course-course clashes
course-hard-commitment clashes
```

---

# 2.6 Weekly Schedule UI

Visual timetable should clearly show:

```text
Monday → Friday
class blocks
commitments
```

No need for full calendar functionality.

---

# 2.7 Commitments

User can add:

```text
TAship
society
work
gym
personal recurring commitment
```

with:

```text
weekly hours
optional recurring time
flexibility
```

---

# 2.8 Preferences

Implement concise onboarding/preferences.

Avoid 15 raw sliders.

Initial meaningful preferences:

```text
manageable workload priority
schedule compactness
career relevance
interest
project vs exam preference
free-day importance
early/late class aversion
```

---

## Phase 2 Acceptance Criteria

A user can create:

```text
Option A
Option B
Option C
```

and populate each with real Fall 2026 sections.

Semora correctly:

```text
calculates credits
shows timetable
detects conflicts
includes commitments
```

At this stage the app should already outperform manually juggling screenshots for schedule validity.

---

## Phase 2 Non-Goals

Do not implement advanced scoring yet.

No AI.

No outlines.

No grades.

---

## Recommended Model

```text
Terra Medium
```

Luna Medium for repetitive CRUD/forms/tests.

---

# CHECKPOINT A — SOL ARCHITECTURE REVIEW

After Phase 2:

Open a **fresh Sol High thread**.

Prompt objective:

```text
Review the implemented Phase 0–2 architecture against
PRODUCT.md
DECISIONS.md
ARCHITECTURE.md
DATA_MODEL.md
SEMESTER_ENGINE.md

Do not implement new product features.

Identify:
- architectural drift
- unnecessary complexity
- missing invariants
- data model mistakes
- security problems
- choices likely to cause expensive Phase 3–7 rework
```

Fix only high-value issues.

Do not let Sol invent new scope.

Update:

```text
DECISIONS.md
CURRENT_STATE.md
```

if necessary.

---

# PHASE 3 — SEMESTER INTELLIGENCE

## Objective

Candidate semesters become **meaningfully comparable**.

This is Semora's primary differentiator.

---

# 3.1 Semester Engine Package

Implement:

```text
packages/semester-engine/
```

as pure deterministic TypeScript.

No:

```text
Prisma
HTTP
OpenAI
React
```

dependencies.

---

# 3.2 Engine Input Model

Implement typed:

```text
CandidateSemesterInput
```

covering:

```text
selected courses
sections
meetings
workload profiles
preferences
commitments
constraints
```

---

# 3.3 Schedule Metrics

Implement:

```text
daily class duration
campus span
idle gaps
schedule fragmentation
free days
early/late class penalties
long-day detection
```

---

# 3.4 Preliminary Workload Profiles

Before outlines exist, allow course workload profile estimates.

Sources:

```text
manual user estimate
structural metadata
developer/admin seeded estimate
```

Do not attempt community ML.

Initial profile dimensions:

```text
overall intensity
continuous workload
assignment intensity
quiz intensity
project intensity
exam intensity
lab intensity
reading intensity
assessment fragmentation
```

---

# 3.5 User Course Preferences

Allow user to rate at minimum:

```text
interest
career relevance
```

for candidate courses.

These persist across candidates.

---

# 3.6 Interaction Penalties

Implement initial configured heuristics for:

```text
multiple project-heavy courses
multiple continuous-assessment-heavy courses
multiple exam-heavy courses
```

Keep all constants centralized.

---

# 3.7 Candidate Metrics

Produce:

```text
Academic Intensity
Continuous Load
Project Load
Exam Load
Assessment Fragmentation
Schedule Quality
Commitment Compatibility
Interest Fit
Career Fit
Balance
Analysis Confidence
Data Completeness
```

---

# 3.8 Findings

Implement deterministic structured findings.

Examples:

```text
PROJECT_CONCENTRATION
LONG_CAMPUS_DAY
FREE_DAY
EARLY_CLASS_PATTERN
HEAVY_FIXED_COMMITMENTS
HIGH_EXAM_CONCENTRATION
LOW_DATA_COMPLETENESS
```

---

# 3.9 Candidate Comparison UI

Side-by-side:

```text
Option A
Option B
Option C
```

Show:

* major metric differences;
* meaningful findings;
* trade-offs;
* confidence/completeness.

---

# 3.10 Recommendation Tags

Examples:

```text
Most Balanced
Best Schedule
Lowest Workload
Best Career Fit
Best Match for You
```

Avoid:

```text
BEST SEMESTER
```

---

# 3.11 Scenario Exploration

Changing:

```text
section
course
commitment
preference
```

should recalculate analysis quickly.

---

## Phase 3 Acceptance Criteria

A student can construct two realistic semester options and Semora gives a comparison that answers:

> **Why might I prefer one of these?**

The comparison must reveal information that is not obvious from simply looking at a timetable.

Engine has strong unit test coverage.

Same structured input always produces same analysis.

---

## Required Tests Before Completion

At minimum:

```text
clashes
back-to-back classes
gap calculations
free days
interaction penalties
preference-sensitive rankings
missing data
confidence
negligible comparison differences
```

---

## Phase 3 Non-Goals

No:

* automatic candidate generation;
* Pareto optimizer UI;
* ML;
* community ratings;
* professor intelligence;
* LLM recommendations.

---

## Recommended Model

Main implementation:

```text
Terra Medium
```

For engine mathematical review:

```text
Terra High
```

Optional final engine audit:

```text
Sol High
```

only if behavior feels questionable.

---

# PRODUCT MILESTONE 1

At the end of Phase 3:

> **Semora PLAN is genuinely usable.**

Deploy it.

Dogfood it immediately with real Fall 2026 options.

Do **not** wait for the rest of V1 before using it.

Record incorrect or unhelpful analysis in:

```text
CURRENT_STATE.md
```

or an internal evaluation file.

---

# PHASE 4 — LOCK SEMESTER

## Objective

Transition from semester planning to semester operation.

---

# 4.1 Active Semester Schema

Implement:

```text
ActiveCourseSelection
ActiveCourseState
```

---

# 4.2 Lock Workflow

User chooses one candidate.

Validate:

```text
no critical conflicts
```

Then transactionally:

```text
copy selections
create active course records
set workspace ACTIVE
record locked candidate
```

---

# 4.3 Add/Drop Support

Student may:

```text
add course
drop course
switch section
```

after locking.

Keep implementation simple.

Candidate planning history remains untouched.

---

# 4.4 Active Semester UI

Show:

```text
selected courses
weekly timetable
basic course cards
```

NAVIGATE intelligence does not need to exist yet.

---

## Phase 4 Acceptance Criteria

User can:

```text
compare candidates
choose one
lock it
see active semester
modify active semester during Add/Drop
```

Planning data remains available.

No duplicate active selections occur on repeated lock requests.

---

## Recommended Model

```text
Terra Medium
```

---

# PHASE 5 — COURSE OUTLINE EXTRACTION

## Objective

Turn actual course outlines into verified structured academic data.

This is the primary AI phase.

---

# 5.1 Add Extraction Package

Create:

```text
packages/extraction/
```

---

# 5.2 File Storage

Implement:

```text
Document
```

metadata.

Development:

```text
local storage acceptable
```

Production:

```text
private object storage
```

---

# 5.3 PDF + DOCX Parsing

Support:

```text
text-based PDF
DOCX
```

Preserve:

```text
page references
tables where practical
headings
```

Avoid OCR unless real outlines require it.

---

# 5.4 Normalized Document

Create intermediate:

```text
NormalizedDocument
```

so AI extraction does not depend on original file format.

---

# 5.5 AI Provider Adapter

Implement small provider abstraction.

One model/provider is enough for V1.

Require schema-constrained output.

---

# 5.6 Extraction Schema

Extract Tier 1 fields:

```text
course identity
grading mode
grade categories
weights
assessments
assessment dates
absolute thresholds
drop rules
```

Tier 2 if reliable:

```text
project structure
attendance
recurrence
```

---

# 5.7 Deterministic Validation

Validate:

```text
weight totals
course matching
dates
duplicate assessments
contradictions
schema values
```

---

# 5.8 Review UI

This is mandatory.

User sees:

```text
Grading Structure
Important Assessments
Dates
Grading Mode
Warnings
```

and can:

```text
edit
confirm
reject
```

---

# 5.9 Canonical Persistence

Only after verification:

create/update:

```text
ActiveCourseState
GradingScheme
GradeCategory
GradeThreshold
Assessment
WorkloadSignal
```

---

# 5.10 Extraction Benchmark

Before calling extraction complete, manually prepare ground truth for several real outlines.

Ideal:

```text
10+ outlines
```

if readily available.

Measure:

```text
weight accuracy
assessment extraction
date accuracy
grading mode accuracy
correction rate
```

---

## Phase 5 Acceptance Criteria

Student uploads an ordinary Fall 2026 course outline.

Semora:

```text
reads it
extracts useful structure
shows evidence/warnings
allows corrections
requires confirmation
creates canonical course data
```

Grade/Workload engines cannot accidentally consume unverified draft output.

---

## Phase 5 Non-Goals

No:

```text
PDF chat
flashcards
study notes
lecture summaries
RAG
OCR platform
email ingestion
LMS ingestion
```

---

## Recommended Model

Implementation:

```text
Terra Medium
```

Extraction prompt/schema review:

```text
Sol High
```

if needed.

Routine parser/test work:

```text
Luna Medium
```

---

# CHECKPOINT B — SOL AI/DATA AUDIT

Fresh Sol High thread.

Audit:

```text
AI_EXTRACTION.md
DATA_MODEL.md
implemented extraction flow
verification boundary
sample extraction failures
```

Goal:

* identify hallucination/trust risks;
* identify cascading-data corruption risks;
* inspect prompt-injection handling;
* inspect transaction boundaries;
* recommend fixes.

Do not ask Sol to broaden document functionality.

---

# PHASE 6 — SEMESTER COMMAND CENTER

## Objective

Semora becomes useful repeatedly during the semester.

---

# 6.1 Workload Engine Package

Create:

```text
packages/workload-engine/
```

pure deterministic TypeScript.

---

# 6.2 Assessment Management

User can:

```text
view
add
edit
delete/cancel
mark progress
mark done
```

assessments.

Manual entry must work even if AI extraction fails.

---

# 6.3 Personal Effort Estimates

Assessments support:

```text
estimated effort
```

with defaults by type.

User overrides defaults.

---

# 6.4 Commitment Events

Add one-off events:

```text
society event
TA grading
interview
personal commitment
```

---

# 6.5 Workload Calculations

Implement initial:

```text
importance
effort
urgency
preparation horizon
deadline compression
overlap
commitment pressure
```

---

# 6.6 Daily Pressure

Generate daily pressure values.

---

# 6.7 Weekly Pressure

Generate weekly values.

Primary heatmap uses weekly pressure.

---

# 6.8 Pressure Findings

Implement:

```text
UPCOMING_PRESSURE_SPIKE
ASSESSMENT_CLUSTER
MAJOR_DEADLINE_OVERLAP
DEADLINE_COMPRESSION
COMMITMENT_COLLISION
EARLY_START_OPPORTUNITY
```

---

# 6.9 Semester Heatmap

Show entire term.

Selecting week explains:

```text
what is creating pressure
```

---

# 6.10 Dashboard

Initial command center:

```text
Today / This Week
Due Soon
What Matters Now
Upcoming Pressure
Next Pressure Peak
Semester Heatmap
```

Avoid generic productivity widgets.

---

# 6.11 Deadline Changes

Manual date edit must instantly update workload forecasts.

---

# 6.12 Completion Feedback

Completing an assessment removes future pressure and updates heatmap.

---

## Phase 6 Acceptance Criteria

A student can open Semora and answer:

> What's coming?

> How bad is next week?

> Why is it bad?

Changing an assessment or completing work updates the forecast correctly.

All workload calculations are deterministic.

---

## Required Tests

At minimum:

```text
urgency increases
deadline extension reduces compression
completion removes pressure
overlap raises pressure
same effort compressed in fewer days raises pressure
commitments affect pressure
unknown dates do not create fake peaks
```

---

## Recommended Model

Engine:

```text
Terra High or Terra Medium
```

depending on difficulty.

UI/API:

```text
Terra Medium
```

Tests:

```text
Luna Medium
```

---

# PRODUCT MILESTONE 2

At this point Semora supports:

```text
PLAN
LOCK
NAVIGATE
```

The product thesis exists end-to-end.

Deploy and begin daily dogfooding.

Do not wait for Grade Engine before considering the core product operational.

---

# PHASE 7 — GRADE INTELLIGENCE

## Objective

Provide mathematically trustworthy grade tracking and what-if analysis.

---

# 7.1 Grade Engine Package

Create:

```text
packages/grade-engine/
```

pure deterministic TypeScript.

---

# 7.2 Score Entry

User can enter assessment results.

Support:

```text
points
percentage
```

as appropriate.

---

# 7.3 Current Performance

Calculate:

```text
weighted points earned
graded weight
remaining weight
current performance
```

Display clearly:

> Based on X% of course graded.

---

# 7.4 Absolute Grade Thresholds

Support:

```text
A
A-
B+
...
```

where known.

---

# 7.5 Target Analysis

For each target:

```text
required remaining average
reachable/unreachable
```

---

# 7.6 What-If Scenarios

Support:

```text
What if I get 82 on final?
```

without overwriting real grade data.

---

# 7.7 Drop Rules

Implement:

```text
BEST_N
DROP_LOWEST_N
```

with tests.

---

# 7.8 Relative Grading

Support user-entered:

```text
mean
median
standard deviation
```

where known.

Calculate:

```text
difference from mean
z-score
```

Do not predict letter grades without boundaries.

---

# 7.9 Grade Dashboard

Each course should show:

```text
current performance
graded weight
target calculations
remaining assessments
```

---

## Phase 7 Acceptance Criteria

Absolute course:

student can answer:

> What do I need to average on the remaining 45% for an A-?

Relative course:

student can answer:

> How did I perform against the known class statistics?

Semora refuses unsupported letter-grade predictions.

---

## Recommended Model

```text
Terra Medium
```

Most work is deterministic.

Luna Medium can generate test matrices once engine behavior is established.

---

# CHECKPOINT C — WHOLE SYSTEM REVIEW

Fresh Sol High thread.

Review:

```text
PRODUCT.md
DECISIONS.md
CURRENT_STATE.md
all engine docs
architecture
actual repository
test suite
```

Questions:

```text
Where has implementation drifted from product thesis?

Where are calculations inconsistent?

Where are engine boundaries violated?

Where could AI data corrupt deterministic systems?

What security/privacy problems exist?

Which technical debt should be fixed BEFORE more features?
```

No feature expansion.

---

# PHASE 8 — PRODUCT POLISH + DOGFOODING

## Objective

Turn working engineering into something students actually want to use.

---

# 8.1 UX Pass

Focus on:

```text
navigation
empty states
loading
errors
mobile responsiveness
clarity
```

---

# 8.2 Semester Designer Polish

Ensure:

```text
creating options feels fast
switching sections feels fast
comparison is understandable
scores have explanations
```

---

# 8.3 Heatmap Polish

Ensure heatmap:

* does not rely solely on color;
* clearly explains peaks;
* works on mobile.

---

# 8.4 Extraction Polish

Improve review experience based on actual course outlines.

Prioritize the fields users repeatedly correct.

---

# 8.5 Error Recovery

Verify:

```text
weird outline
failed AI call
missing date
bad weights
relative grading
invalid import
```

all fail gracefully.

---

# 8.6 Performance

Fix only actual noticeable bottlenecks.

No premature optimization.

---

# 8.7 Security Review

At minimum inspect:

```text
authorization
file access
auth/session handling
upload validation
prompt injection
secrets
```

---

# 8.8 Deployment

Production setup:

```text
app/API
managed PostgreSQL
private object storage
AI credentials
HTTPS
```

---

# 8.9 Dogfooding Log

During actual Fall 2026 use, collect:

```text
What did Semora get wrong?
What did I ignore?
What did I repeatedly open?
What required manual correction?
Which recommendation changed my behavior?
Which screen feels unnecessary?
```

---

# 8.10 Engine Calibration

Only adjust heuristics in response to real cases.

When changing major logic:

record in:

```text
DECISIONS.md
```

and increment engine version if appropriate.

---

## Phase 8 Acceptance Criteria

Semora is:

```text
deployed
stable
usable on phone + desktop
using actual Fall 2026 courses
using actual outlines
being used during the semester
```

Core flows do not require developer intervention.

---

# PHASE 9 — EXTERNAL PILOT

## Objective

Determine whether the product works for students other than the developer.

---

# 9.1 Recruit Small Test Group

Target:

```text
5–10 students
```

initially.

Variety is more valuable than raw number.

Include different:

```text
majors
course loads
extracurricular commitments
workload tolerances
```

---

# 9.2 Observe Behavior

Do not only ask:

> Do you like it?

Observe:

```text
Did they create multiple candidate semesters?
Did they upload outlines?
Did they correct extraction?
Did they revisit heatmap?
Did they enter grades?
Did they return after several days?
```

---

# 9.3 Interviews

Ask:

```text
What did you use before this?

Which part saved actual time?

What felt confusing?

What felt unnecessary?

Did Semora tell you something you hadn't noticed?

Would you use it next semester?

What would make you stop using it?
```

---

# 9.4 Monetization Probe

Only after they understand the product.

Ask behaviorally:

```text
Would you pay once per semester for the intelligence features?

Which feature would actually justify paying?

What price starts feeling unreasonable?
```

Do not optimize pricing prematurely.

---

# 9.5 Product Decision

After pilot, decide:

```text
Continue
Refine
Pivot within thesis
Pause
```

based on actual usage.

Not sunk cost.

---

# 11. Feature Dependency Graph

Conceptually:

```text
AUTH
  ↓
CATALOGUE
  ↓
CANDIDATES
  ↓
TIMETABLE + COMMITMENTS
  ↓
SEMESTER ENGINE
  ↓
COMPARISON
  ↓
LOCK
  ↓
ACTIVE COURSES
  ↓
DOCUMENTS
  ↓
AI EXTRACTION
  ↓
VERIFIED ACADEMIC DATA
  ↓
ASSESSMENTS
  ├─────────────┐
  ↓             ↓
WORKLOAD       GRADES
  ↓             ↓
HEATMAP        GRADE INTEL
```

This order should be respected.

---

# 12. What Can Be Built in Parallel

Once Phase 2 is stable:

Potentially independent:

```text
Semester Engine tests
Comparison UI
Catalogue UI polish
```

After Phase 5:

```text
Workload Engine
Grade Engine
```

can theoretically be developed somewhat independently because both consume verified assessment structures.

However, with one developer, sequential work is usually simpler.

---

# 13. What Must NOT Be Built Early

Do not start:

```text
Grade Engine
```

before canonical academic structures exist.

Do not start:

```text
Workload dashboard
```

before assessment modeling is stable.

Do not start:

```text
community course intelligence
```

before individual product value is proven.

Do not start:

```text
automatic optimizer
```

before manual semester comparison is useful.

---

# 14. Seven-Day Pre-Semester Priority

If only approximately seven days of higher-intensity development remain before classes:

Prioritize:

```text
Phase 0
Phase 1
Phase 2
```

and as much of:

```text
Phase 3
```

as realistic.

Ideal semester-start state:

> **Real Fall 2026 catalogue is imported and Semester Designer works.**

That allows immediate dogfooding.

Do not rush AI outline extraction at the expense of PLAN.

---

# 15. Semester Development Mode

Once classes begin:

Each coding session should target one narrow objective.

Examples:

```text
Implement idle-gap calculation and tests.

Add duplicate candidate action.

Implement project-concentration finding.

Create extraction review category editor.

Add weekly pressure API.
```

Avoid sessions beginning with:

> "Continue building Semora."

The plan should determine the task before the agent starts.

---

# 16. Session Size Rule

A good Codex task usually has:

```text
one clear outcome
several related files
one testable completion condition
```

Too small:

> Rename button.

Too broad:

> Build NAVIGATE.

Good:

> Implement assessment CRUD for active courses including API validation, ownership checks, frontend editing, and integration tests. Do not touch workload calculations yet.

---

# 17. Thread Boundary Rule

Start a fresh Codex thread when:

* a phase completes;
* feature domain changes substantially;
* previous debugging context is no longer relevant;
* conversation becomes dominated by historical dead ends;
* moving to a different model for architecture review.

Do not open a new thread merely because several messages have passed if the same coherent problem is still active.

---

# 18. Handoff Prompt Template

Fresh implementation thread:

```text
You are implementing [PHASE / FEATURE] of Semora.

First read:
- docs/PRODUCT.md
- docs/DECISIONS.md
- docs/CURRENT_STATE.md
- relevant specification files

Then inspect the existing repository.

Do not assume the docs describe already-implemented behavior;
CURRENT_STATE.md and the repository are authoritative about implementation state.

Your objective:
[EXACT OBJECTIVE]

Do not implement:
[OUT-OF-SCOPE ITEMS]

Completion criteria:
[TESTABLE CONDITIONS]

Run relevant tests and update CURRENT_STATE.md when complete.
```

---

# 19. Sol Audit Prompt Template

```text
Perform a critical architecture/product audit.

Read:
[list docs]

Inspect the actual implementation.

Do not add features.

Find:
- contradictions between docs and code
- architectural drift
- unsafe assumptions
- hidden coupling
- incorrect domain boundaries
- security/trust risks
- likely future rework

Rank findings by severity.

Recommend the smallest corrective action for each.
```

---

# 20. Documentation Update Rule

Agents may update:

```text
CURRENT_STATE.md
```

as part of normal completion.

They should **not casually rewrite**:

```text
PRODUCT.md
DECISIONS.md
ARCHITECTURE.md
engine specifications
```

because implementation was easier another way.

If implementation conflicts with specification:

surface it.

Then explicitly decide whether:

```text
code changes
```

or:

```text
specification changes
```

---

# 21. Architecture Deviation Rule

Sometimes implementation discovers a better design.

Record:

```text
Original plan
Actual implementation
Reason
Impact
```

in:

```text
CURRENT_STATE.md
```

If permanent:

add decision to:

```text
DECISIONS.md
```

---

# 22. Testing Priority

Highest:

```text
Semester Engine
Workload Engine
Grade Engine
```

Then:

```text
domain state transitions
API integration
```

Then:

```text
critical frontend flows
```

Do not spend half the project writing snapshot tests for button markup.

---

# 23. Code Quality Bar

V1 code should be:

```text
typed
tested where logic matters
modular
readable
boring
```

Avoid:

```text
premature abstractions
generic enterprise frameworks
clever metaprogramming
```

---

# 24. Refactoring Rule

Refactor when:

* duplication is actively causing errors;
* module boundaries are being violated;
* upcoming phase clearly requires it;
* code has become difficult to reason about.

Do not perform aesthetic architecture rewrites during the one-month build.

---

# 25. Definition of Done — Feature

A feature is done when:

```text
backend works
frontend works if user-facing
validation exists
authorization exists
important tests pass
errors are handled
existing tests pass
no obvious dead code remains
```

Not when:

> Codex generated the files.

---

# 26. Definition of Done — Phase

A phase is done when:

1. all acceptance criteria work;
2. relevant tests pass;
3. `CURRENT_STATE.md` is updated;
4. known issues are documented;
5. implementation is committed;
6. next phase can start from repository/docs without relying on chat history.

---

# 27. Definition of Done — V1

V1 is complete when a student can:

### PLAN

```text
browse courses
create candidate semesters
add commitments/preferences
compare options intelligently
```

### LOCK

```text
select real semester
modify during Add/Drop
```

### NAVIGATE

```text
upload outlines
verify extracted academic structure
see assessments
see pressure heatmap
understand upcoming workload
enter grades
perform grade what-if analysis
```

and the product is deployed.

---

# 28. V1 Does Not Require

```text
many users
perfect monetization
mobile app
community dataset
institutional partnership
ML model
automatic scheduling
LMS integration
```

These are not completion criteria.

---

# 29. Product Validation Goal

Technical completion alone is insufficient.

The key questions are:

### PLAN

Did Semora improve a real course-selection decision?

### NAVIGATE

Did Semora reveal a difficult period early enough to matter?

### RETENTION

Did users return without being reminded?

### FUTURE USE

Would they use Semora for their next semester?

---

# 30. Monetization Checkpoint

Do not implement billing during early V1.

Billing becomes justified after:

```text
core product works
small external pilot exists
users identify valuable features
pricing hypothesis is tested
```

Until then, a free pilot is appropriate.

---

# 31. Post-V1 Candidate Features

Potential future work is recorded canonically in `FUTURE.md`.

None should leak into current phases.

---

# 32. Biggest Project Risks

## Risk A — Scope Explosion

Response:

```text
defer aggressively
```

---

## Risk B — Semester Engine Feels Arbitrary

Response:

```text
explainability
manual overrides
dogfood calibration
```

---

## Risk C — AI Extraction Becomes Time Sink

Response:

```text
manual input fallback
simple one-pass extraction first
benchmark before adding complexity
```

---

## Risk D — Building NAVIGATE Before PLAN Is Good

Response:

```text
respect phase order
```

---

## Risk E — Agent Generates Too Much Architecture

Response:

```text
ARCHITECTURE.md is authoritative
no microservices
no unnecessary infra
```

---

## Risk F — Development Time Collapses During Semester

Response:

```text
small Codex objectives
stable documentation
phase boundaries
maintainable monolith
```

---

# 33. Initial Execution Order

The immediate next implementation sequence is:

```text
1. Phase 0 repository foundation
2. Phase 1 LUMS catalogue
3. Phase 2 candidate planning
4. Sol architecture checkpoint
5. Phase 3 Semester Intelligence
6. Deploy PLAN
7. Phase 4 Lock
8. Phase 5 AI Extraction
9. Sol extraction audit
10. Phase 6 Workload
11. Phase 7 Grades
12. Whole-system Sol audit
13. Polish + pilot
```

---

# 34. Most Important Delivery Rule

Do not spend the Plus month trying to maximize:

> **how much code AI can generate.**

Maximize:

> **how much correct product can be finished.**

A smaller deployed Semora that meaningfully improves semester planning is more successful than a sprawling unfinished student platform.

---

# 35. Final Build Rule

At every implementation decision, ask:

> **Does this move Semora closer to helping a real student PLAN, LOCK, or NAVIGATE a real semester?**

If the answer is no:

it is probably not the next thing to build.
