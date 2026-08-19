# Semora — System Architecture

**Status:** Architecture specification
**Version:** 0.1
**Related:** `PRODUCT.md`, `DECISIONS.md`, `DATA_MODEL.md`, engine specifications
**Primary goal:** Define a simple, maintainable architecture capable of shipping Semora's V1 without unnecessary infrastructure complexity.

---

# 1. Architecture Philosophy

Semora is being built under a strict practical constraint:

> **The architecture must remain maintainable during an active university semester.**

Therefore the system should optimize for:

* simplicity;
* strong module boundaries;
* deterministic business logic;
* testability;
* low infrastructure overhead;
* easy local development;
* easy deployment;
* incremental implementation.

It should **not** optimize prematurely for:

* millions of users;
* distributed systems;
* microservices;
* event streaming;
* Kubernetes;
* complex queues;
* separate databases per service;
* independently deployed engine services.

The default architectural choice is:

> **A modular monolith.**

---

# 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │     React Web App   │
                    │                     │
                    │ PLAN / LOCK /       │
                    │ NAVIGATE UI         │
                    └──────────┬──────────┘
                               │
                               │ HTTPS / REST
                               ▼
                    ┌─────────────────────┐
                    │   Node.js API       │
                    │   TypeScript        │
                    │                     │
                    │ Modular Monolith    │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │ Domain Engines │   │   PostgreSQL   │   │ File Storage   │
 │                │   │                │   │                │
 │ Semester       │   │ Canonical      │   │ Course         │
 │ Workload       │   │ semester data  │   │ documents      │
 │ Grade          │   │                │   │                │
 └────────────────┘   └────────────────┘   └────────────────┘
          │
          ▼
 ┌────────────────┐
 │ AI Extraction  │
 │ Adapter        │
 │                │
 │ LLM Provider   │
 └────────────────┘
```

---

# 3. Technology Direction

Recommended V1 stack:

## Frontend

```text
React
TypeScript
Vite
```

Supporting libraries may include:

```text
React Router
TanStack Query
Tailwind CSS
React Hook Form
```

A component library may be used where it accelerates development.

Do not allow the UI library to determine product architecture.

---

# 4. Backend

Recommended:

```text
Node.js
TypeScript
Express
```

Reasons:

* simple;
* familiar ecosystem;
* easy REST APIs;
* strong integration with shared TypeScript domain types;
* sufficient performance for Semora;
* no reason to introduce a separate backend language.

---

# 5. Database

Recommended:

```text
PostgreSQL
```

with:

```text
Prisma ORM
```

or another strongly typed relational ORM if implementation later provides a compelling reason.

PostgreSQL is appropriate because Semora has strong relational structure:

```text
Course
→ Offering
→ Section
→ Meeting

Workspace
→ Candidate
→ Course Selection

Active Course
→ Assessment
→ Score
```

JSON should only be used for data that is genuinely document-like or derived.

---

# 6. End-to-End TypeScript

Recommended V1:

```text
Frontend      TypeScript
Backend       TypeScript
Engines       TypeScript
Validation    TypeScript
```

This deliberately avoids creating a Python microservice solely because the product contains AI.

The core intelligence engines consist primarily of:

* deterministic math;
* rules;
* scheduling logic;
* document transformation;
* LLM API calls.

None require Python.

If a future ML model genuinely requires Python, introduce it then.

---

# 7. Monorepo

Recommended repository structure:

```text
semora/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── domain/
│   ├── semester-engine/
│   ├── workload-engine/
│   ├── grade-engine/
│   ├── extraction/
│   └── shared/
│
├── docs/
│   ├── PRODUCT.md
│   ├── DECISIONS.md
│   ├── DATA_MODEL.md
│   ├── ARCHITECTURE.md
│   ├── BUILDPLAN.md
│   ├── CURRENT_STATE.md
│   ├── FUTURE.md
│   │
│   └── engines/
│       ├── SEMESTER_ENGINE.md
│       ├── WORKLOAD_ENGINE.md
│       ├── GRADE_ENGINE.md
│       └── AI_EXTRACTION.md
│
├── tests/
│
└── package.json
```

Exact directory names may evolve.

The important architectural principle is the separation between:

```text
application UI
API/application services
domain logic
deterministic engines
AI extraction
infrastructure adapters
```

---

# 8. Workspace Tooling

Use a normal package workspace.

Avoid introducing complex build orchestration unless required.

The project does not initially need:

* Nx;
* Bazel;
* complicated monorepo build graphs.

Simple workspace tooling is sufficient.

---

# 9. Domain Package

Recommended:

```text
packages/domain/
```

Contains shared domain concepts such as:

```text
AcademicTerm
Course
CourseOffering
Section
Meeting

SemesterWorkspace
CandidateSemester

Assessment
Commitment

GradingMode
AssessmentType
```

It may also contain:

* enums;
* schemas;
* domain validation;
* shared DTO types.

It should **not** contain database queries.

---

# 10. Engine Packages

Each deterministic engine gets an isolated package.

```text
packages/semester-engine/
packages/workload-engine/
packages/grade-engine/
```

These packages should ideally behave like:

```text
structured input
↓
pure or mostly-pure deterministic logic
↓
structured output
```

Example:

```ts
analyzeCandidateSemester(input)
```

returns:

```ts
CandidateSemesterAnalysis
```

No HTTP calls.

No database access.

No UI assumptions.

---

# 11. Why Engines Must Be Pure

This makes them:

* easy to unit test;
* reproducible;
* independently tunable;
* usable from API services;
* resistant to infrastructure coupling.

Bad:

```text
Semester Engine
→ calls Prisma
→ calls OpenAI
→ accesses request object
→ calculates result
```

Good:

```text
Application Service
→ loads data from database
→ transforms into engine input
→ calls Semester Engine
→ receives analysis
→ returns response
```

---

# 12. Semester Engine Boundary

Input example:

```text
CandidateSemesterInput
```

containing:

```text
selected sections
course workload profiles
meetings
commitments
preferences
constraints
```

Output:

```text
CandidateSemesterAnalysis
```

containing:

```text
validity
metrics
findings
confidence
completeness
recommendation tags
```

The engine knows nothing about HTTP or Prisma.

---

# 13. Workload Engine Boundary

Input:

```text
WorkloadAnalysisInput
```

containing:

```text
assessments
effort estimates
deadlines
commitments
semester calendar
current date
```

Output:

```text
PressureAnalysis
```

containing:

```text
daily pressure
weekly pressure
peak periods
findings
confidence
```

---

# 14. Grade Engine Boundary

Input:

```text
CourseGradeInput
```

containing:

```text
grading scheme
categories
assessments
scores
thresholds
class statistics
scenario overrides
```

Output:

```text
CourseGradeAnalysis
```

The Grade Engine must remain independent of AI.

---

# 15. AI Extraction Package

Recommended:

```text
packages/extraction/
```

Responsibilities:

```text
document parsing
document normalization
schema-constrained AI extraction
validation
confidence
conflict detection
```

It does **not** own canonical academic persistence.

---

# 16. Extraction Architecture

```text
Uploaded File
     ↓
File Parser
     ↓
NormalizedDocument
     ↓
Extraction Provider
     ↓
Extraction Draft
     ↓
Deterministic Validator
     ↓
Review Required
     ↓
User Confirmation
     ↓
Application Service persists canonical records
```

---

# 17. AI Provider Abstraction

Do not spread provider-specific API calls throughout the codebase.

Define an interface conceptually similar to:

```ts
interface AcademicExtractionProvider {
  extractCourseDocument(
    document: NormalizedDocument,
    context: ExtractionContext
  ): Promise<CourseDocumentExtraction>;
}
```

Then an implementation:

```text
Provider X Adapter
```

satisfies it.

Changing models/providers should not require modifying:

* Grade Engine;
* Workload Engine;
* Semester Engine;
* controllers;
* database schema.

---

# 18. Why Provider Abstraction Matters

Models may change because of:

* cost;
* reliability;
* latency;
* structured-output quality.

Semora should be able to benchmark providers without rewriting product logic.

Do not over-engineer this into a universal AI framework.

One small interface is enough.

---

# 19. Schema-Constrained Output

The extraction provider should return validated structured data.

Recommended pattern:

```text
LLM response
↓
schema validation
↓
typed extraction draft
```

Use a runtime validation library such as:

```text
Zod
```

or equivalent.

Never trust model JSON without validation.

---

# 20. LLM Boundary

The AI layer is allowed to produce:

```text
interpretation
structured candidate facts
confidence signals
evidence references
```

The AI layer is not allowed to produce authoritative:

```text
semester scores
grade calculations
pressure values
```

Those belong to deterministic engines.

---

# 21. Application Modules

The backend should be organized by product/domain module.

Recommended modules:

```text
auth
catalog
workspace
planning
commitments
semester-analysis
activation
documents
extraction
academics
workload
grades
```

Not:

```text
controllers/
services/
repositories/
```

with hundreds of unrelated files dumped together.

Feature/domain organization is preferable.

---

# 22. Example Backend Structure

```text
apps/api/src/
│
├── modules/
│   ├── auth/
│   ├── catalog/
│   ├── workspace/
│   ├── planning/
│   ├── commitments/
│   ├── activation/
│   ├── documents/
│   ├── extraction/
│   ├── academics/
│   ├── workload/
│   └── grades/
│
├── infrastructure/
│   ├── database/
│   ├── storage/
│   ├── ai/
│   └── logging/
│
├── middleware/
├── app.ts
└── server.ts
```

---

# 23. Frontend Structure

Organize primarily by product feature.

Example:

```text
apps/web/src/
│
├── features/
│   ├── onboarding/
│   ├── catalog/
│   ├── semester-builder/
│   ├── semester-comparison/
│   ├── commitments/
│   ├── active-semester/
│   ├── outline-upload/
│   ├── extraction-review/
│   ├── workload/
│   └── grades/
│
├── components/
├── lib/
├── routes/
└── app/
```

Avoid a single enormous:

```text
components/
```

directory containing the whole application.

---

# 24. Frontend State Philosophy

Use server state and local UI state separately.

Recommended:

```text
TanStack Query
```

for:

* API data;
* caching;
* mutation invalidation.

Use normal React state/form state for:

* temporary candidate edits;
* form controls;
* modals;
* local interactions.

Do not introduce Redux unless real complexity justifies it.

---

# 25. REST API

Use REST for V1.

The domain does not require GraphQL.

Example routes:

```text
/api/auth/...

/api/terms
/api/courses
/api/offerings
/api/sections

/api/workspaces/:id

/api/workspaces/:id/candidates
/api/candidates/:id/selections
/api/candidates/:id/analysis

/api/workspaces/:id/commitments

/api/workspaces/:id/lock

/api/active-courses/:id

/api/documents
/api/documents/:id/extract
/api/extractions/:id
/api/extractions/:id/verify

/api/workspaces/:id/workload

/api/active-courses/:id/grades
/api/active-courses/:id/grade-scenarios
```

Exact endpoint names may evolve.

---

# 26. API Response Contracts

Controllers should return typed DTOs.

Do not expose Prisma records directly.

Example:

```text
CourseOfferingDTO
CandidateSemesterDTO
SemesterAnalysisDTO
PressureAnalysisDTO
CourseGradeAnalysisDTO
```

This creates a stable API boundary.

---

# 27. Validation

Validate incoming request data at the API boundary.

Recommended:

```text
Zod schemas
```

or equivalent.

Example:

```text
CreateCandidateSemesterRequest
AddCourseSelectionRequest
CreateCommitmentRequest
RecordAssessmentScoreRequest
```

Invalid values should never reach engine logic.

---

# 28. Error Model

Use consistent application errors.

Conceptual categories:

```text
VALIDATION_ERROR
NOT_FOUND
CONFLICT
UNAUTHORIZED
FORBIDDEN
EXTRACTION_FAILED
DOCUMENT_MISMATCH
ENGINE_INPUT_INCOMPLETE
INTERNAL_ERROR
```

Avoid returning random exception strings to the frontend.

---

# 29. Database Access

Database access belongs in application/module services or repositories.

Engines must not import Prisma.

Example:

```text
CandidateAnalysisService
    ↓
loads candidate
loads sections
loads preferences
loads commitments
    ↓
maps to engine input
    ↓
semesterEngine.analyze()
```

---

# 30. Transaction Boundaries

Use database transactions for operations that must remain consistent.

Examples:

### Lock Semester

```text
create active selections
create active course states
update workspace state
record locked_at
```

should succeed or fail together.

### Verify Extraction

```text
update/create grading scheme
create categories
create assessments
create workload signals
record verification
```

should ideally be transactional.

---

# 31. Course Catalogue Import

LUMS data should enter through an adapter/import layer.

Conceptually:

```text
LUMS Course Memo
LUMS Timing Data
       ↓
LumsCatalogImporter
       ↓
Canonical Semora Objects
       ↓
Course
CourseOffering
Section
Meeting
```

The rest of the application should have no idea what a "RO portal" is.

---

# 32. Import Adapter Interface

Conceptually:

```ts
interface CatalogImporter {
  parse(input: ImportSource): Promise<CatalogImportResult>;
}
```

Potential implementations:

```text
LumsMemoImporter
LumsTimingImporter
GenericCsvImporter
```

Only LUMS support is required initially.

---

# 33. No Live RO Dependency

Semora must not depend on:

```text
scraping RO every time the user opens the app
```

Instead:

```text
source files
↓
import
↓
canonical database
```

This keeps the product stable and avoids institutional dependency.

---

# 34. Initial Import Strategy

V1 does not need a polished public importer.

A developer/admin workflow is acceptable initially:

```text
source file
↓
import script / protected admin endpoint
↓
review
↓
database
```

The goal is product validation, not building an academic data platform.

---

# 35. File Storage

Uploaded documents should not live as database binary blobs.

Use:

```text
object/file storage
```

with database metadata stored in:

```text
Document
```

Development may use:

```text
local filesystem
```

Production should use:

```text
private S3-compatible object storage
```

or equivalent managed storage.

---

# 36. File Access

Files must be private by default.

Flow:

```text
authenticated request
↓
authorization check
↓
temporary/signed access or server stream
```

Avoid permanent public URLs.

---

# 37. File Processing

Uploaded documents should go through:

```text
MIME validation
size validation
safe filename handling
parser
```

Never trust the client-supplied extension alone.

---

# 38. Extraction Processing Strategy

For V1, start simple.

Recommended:

```text
Upload
↓
store file
↓
create extraction job
↓
process extraction
↓
return REVIEW_REQUIRED
```

If extraction latency is reasonable, synchronous request-driven processing is acceptable initially.

---

# 39. Async Extraction Later

If extraction becomes too slow or unreliable for HTTP request lifetime:

introduce background jobs.

Possible future:

```text
API
↓
Job Table / Queue
↓
Extraction Worker
```

But do **not** add:

```text
Redis
BullMQ
separate worker deployment
```

before there is an actual need.

---

# 40. Job Table Before Message Queue

If asynchronous processing becomes necessary, prefer initially:

```text
PostgreSQL-backed jobs
```

or a simple database job table.

Semora already depends on PostgreSQL.

Avoid introducing another infrastructure service solely for a small extraction queue.

---

# 41. Authentication

Authentication should remain boring.

V1 needs:

```text
sign up
sign in
sign out
current session
protected API
```

Recommended architecture:

```text
server-managed authenticated session
secure HTTP-only cookie
```

rather than storing long-lived authentication tokens in browser local storage.

The browser cookie must contain only an opaque session identifier. In
production it must use `Secure`; its `SameSite` policy must be explicit.
State-changing requests must receive origin/CSRF protection appropriate to the
selected authentication library and same-origin deployment.

---

# 42. Auth Implementation

Use a maintained authentication library/provider rather than inventing cryptography.

Exact implementation may be chosen during setup.

The selected implementation must own credential verification, session creation,
session invalidation, and any authentication-specific persistence it requires.
The academic `User` record must link unambiguously to the authenticated identity.
Authentication tables remain infrastructure and are not part of the academic
domain model.

The rest of Semora should depend on a simple interface:

```text
request.user.id
```

not provider-specific concepts.

---

# 43. LUMS Email Verification

Potential beachhead enhancement:

```text
@lums.edu.pk
```

verification.

This can help:

* confirm local student users;
* restrict early pilot access.

It should **not** become a core domain assumption because Semora is university-agnostic.

V1 may begin with normal authentication.

---

# 44. Authorization

Every user-owned resource must verify ownership.

Examples:

```text
workspace.user_id == current_user.id
document.user_id == current_user.id
candidate.workspace.user_id == current_user.id
```

Do not rely on obscurity of UUIDs.

---

# 45. Security Boundary

Users must never be able to access another student's:

* outlines;
* assessments;
* grades;
* commitments;
* candidate semesters;
* uploaded files.

Authorization checks belong server-side.

---

# 46. API Same-Origin Architecture

For deployment simplicity, the preferred production shape is:

```text
ONE APPLICATION ORIGIN
```

Example:

```text
semora.app/
```

serves:

```text
React frontend
/api/*
```

from the same deployment or reverse-proxy boundary.

Benefits:

* simpler auth cookies;
* simpler CORS;
* fewer deployment issues.

---

# 47. Local Development

Development may use:

```text
Vite frontend dev server
+
Express API
```

with Vite proxying:

```text
/api
```

to backend.

Production may serve the compiled React app through the Node service or through a colocated frontend host.

Exact deployment provider is not architecturally important.

---

# 48. Production Deployment Shape

Ideal V1 production requirements:

```text
1 web/API application
1 managed PostgreSQL database
1 private object-storage bucket
1 AI API integration
```

That's it.

No:

```text
Redis
Kafka
Elasticsearch
Kubernetes
service mesh
```

---

# 49. Scaling Philosophy

If Semora unexpectedly gains significant usage:

scale vertically first.

Then:

```text
multiple API instances
```

if needed.

Only separate services when a clear operational bottleneck exists.

---

# 50. Caching

Most V1 operations are cheap.

Do not add Redis caching.

Potential caches:

```text
SemesterAnalysisSnapshot
PressureAnalysisSnapshot
```

stored in PostgreSQL.

Use:

```text
input_hash
+
engine_version
```

to determine validity.

---

# 51. Candidate Analysis Cache

Input fingerprint may include:

```text
selected sections
course profiles
preferences
commitments
constraints
semester engine version
```

If unchanged:

return cached analysis.

Otherwise:

recalculate.

---

# 52. Pressure Analysis Cache

Fingerprint includes:

```text
assessments
effort estimates
deadlines
statuses
commitments
current analysis date
engine version
```

Because pressure changes with time, date/time belongs to cache validity.

---

# 53. Grade Analysis

Grade calculations are cheap.

Prefer recalculation instead of persistent caching.

---

# 54. Engine Configuration

Each engine should have explicit configuration.

Example:

```text
packages/semester-engine/src/config.ts
packages/workload-engine/src/config.ts
```

Contains:

```text
thresholds
interaction coefficients
score bands
default effort estimates
preparation horizons
```

Do not scatter magic numbers.

---

# 55. Configuration Versioning

Analysis outputs include:

```text
engine_version
```

When formulas materially change:

increment version.

This aids debugging during dogfooding.

---

# 56. Findings Architecture

Engines emit structured findings.

Example:

```ts
{
  type: "PROJECT_CONCENTRATION",
  severity: "HIGH",
  relatedCourseIds: [...]
}
```

The UI may map these to human copy deterministically.

---

# 57. LLM Explanation Layer

LLM-generated explanations are optional.

For V1, many explanations can come from templates.

Example:

```text
PROJECT_CONCENTRATION
```

becomes:

> Three selected courses appear project-heavy.

This is:

* cheaper;
* faster;
* more deterministic.

Use AI explanation only where natural-language synthesis genuinely improves the product.

---

# 58. Do Not Put LLMs in Every Request

Bad:

```text
user opens dashboard
↓
call LLM
```

Good:

```text
dashboard data
↓
deterministic calculations
↓
render
```

LLM calls should mostly occur during:

```text
outline extraction
explicit interpretation tasks
```

This improves:

* cost;
* latency;
* reliability.

---

# 59. AI Cost Boundary

Every LLM call should be associated with a clear product action.

Examples:

```text
Upload outline
Analyze document
Interpret natural-language preference
```

Avoid invisible repeated calls.

---

# 60. AI Usage Logging

Store enough metadata to understand AI costs and failures.

Possible fields:

```text
operation
model
input size
output size
latency
success/failure
```

Do not initially build a huge analytics platform.

Basic structured logs are enough.

---

# 61. Logging

Use structured server logs.

Important events:

```text
authentication failure
import failure
document parsing failure
extraction failure
verification
engine error
unexpected exception
```

Do not log:

```text
grades
full uploaded document contents
auth tokens
passwords
```

unless absolutely necessary.

---

# 62. Observability

V1 needs basic:

```text
application logs
error tracking
health endpoint
```

Potential endpoint:

```text
GET /api/health
```

No elaborate telemetry stack needed.

---

# 63. Error Tracking

A managed error-reporting service may be added if convenient.

Not required before core product works.

---

# 64. Testing Strategy

Testing should mirror architecture.

---

# 65. Engine Unit Tests

Highest-priority tests.

```text
Semester Engine
Workload Engine
Grade Engine
```

should have extensive deterministic test suites.

These tests:

* require no database;
* require no API;
* require no LLM.

---

# 66. Domain Tests

Test:

```text
validation
state transitions
locking
ownership rules
course matching
```

---

# 67. API Integration Tests

Test major flows against a test database.

Examples:

```text
create candidate
add course
analyze candidate
lock semester
upload/verify structure
record grade
fetch workload
```

---

# 68. Extraction Tests

Use fixed documents / normalized text fixtures where possible.

Do not make ordinary test runs depend on live paid AI APIs.

---

# 69. AI Test Strategy

Split:

### Deterministic extraction pipeline tests

Use mocked extraction output.

### Model benchmark tests

Run intentionally and separately against real providers.

This prevents:

```text
npm test
```

from accidentally spending money or failing because of an API outage.

---

# 70. End-to-End Tests

A small number of critical flows should eventually use browser tests.

Examples:

### PLAN

```text
login
→ create candidate
→ add courses
→ compare
```

### LOCK

```text
lock candidate
→ active semester created
```

### NAVIGATE

```text
upload outline
→ verify
→ assessments visible
→ enter score
→ grade recalculates
```

Do not attempt exhaustive UI automation in V1.

---

# 71. Frontend Data Flow

Example candidate analysis:

```text
Semester Builder
↓ mutation
API updates selection
↓
query invalidated
↓
GET candidate analysis
↓
Semester Engine executes/reuses cache
↓
UI updates metrics
```

This should feel immediate.

---

# 72. Optimistic Updates

Use carefully.

Adding/removing courses may optimistically update UI.

However:

```text
hard constraint analysis
semester metrics
```

should come from server-authoritative engine output.

---

# 73. What-If Grade Calculations

Grade scenarios could eventually run client-side using shared pure engine code for instant feedback.

However server remains authoritative for stored values.

V1 may simply use API calls because grade calculations are cheap.

Do not duplicate logic unnecessarily.

---

# 74. Date/Time Handling

Use a proper date/time library or platform APIs consistently.

Key concerns:

```text
University timezone
assessment timestamps
weekly recurring local times
semester weeks
```

Never perform ad-hoc date arithmetic with strings.

---

# 75. Timezone Rule

Stored absolute timestamps:

```text
UTC
```

Recurring course meetings:

```text
local academic time
+
University timezone
```

Frontend displays in user's/university's expected timezone.

---

# 76. Semester Calendar Service

Create a small domain utility for:

```text
term week number
week start/end
break detection
exam period
```

This supports both Semester and Workload engines.

Do not duplicate semester-week logic.

---

# 77. Import Architecture

Initial course-data process:

```text
Raw LUMS data
↓
Import Adapter
↓
Import Validation
↓
Preview / developer inspection
↓
Database transaction
```

Bad input should not partially corrupt catalogue data.

---

# 78. Import Idempotency

Running the same catalogue import twice should not create duplicate:

```text
Courses
Offerings
Sections
Meetings
```

Use stable natural identifiers where possible.

---

# 79. Import Conflict Strategy

If imported data changes:

Example:

```text
Section 1
12:30 → 13:00
```

update canonical term data if the new source is intentionally imported as newer.

Log enough to diagnose unexpected changes.

Full historical import versioning is future scope.

---

# 80. Data Seeding

Development should include realistic seed data.

Create:

```text
Fall 2026
sample courses
sample sections
sample candidate semester
sample commitments
```

This allows frontend development before full LUMS import is complete.

---

# 81. Demo User

Maintain a deterministic demo dataset.

Useful for:

* screenshots;
* product demos;
* automated testing;
* development.

Do not use actual sensitive student grade information as public demo data.

---

# 82. Privacy

Semora stores personal academic data.

Principles:

```text
private by default
minimum necessary data
explicit deletion
no public grades
no public schedules by default
```

The product does not need social features in V1.

---

# 83. Data Deletion

Users should eventually be able to delete:

```text
workspace
documents
grades
account
```

Account deletion should remove or anonymize personal data according to implementation policy.

Detailed compliance policy can be written later if commercialization progresses.

---

# 84. Rate Limiting

Apply rate limits particularly to:

```text
auth
document upload
AI extraction
```

Normal dashboard queries need only basic abuse protection.

---

# 85. File Upload Limits

Define sensible limits.

Example product behavior:

> Course outlines should be normal academic documents, not 500MB uploads.

Exact numerical limit belongs to implementation configuration.

---

# 86. API Idempotency

Important mutations such as:

```text
verify extraction
lock semester
```

should guard against accidental duplicate requests.

Example:

locking an already locked candidate should not duplicate active course records.

---

# 87. Lock Semester Service

Conceptually:

```text
lockCandidate(candidateId)
```

performs:

```text
authorize candidate
validate candidate
ensure no critical hard constraint violations
begin transaction
create active selections
create active states
set workspace ACTIVE
record locked candidate
commit
```

---

# 88. Extraction Verification Service

Conceptually:

```text
verifyExtraction(extractionId, corrections)
```

performs:

```text
authorize
load draft
apply user corrections
validate structure
begin transaction
persist grading scheme
persist categories
persist assessments
persist workload signals
record verification
commit
```

This is a critical consistency boundary.

---

# 89. Analysis Services

Application services convert persisted domain data into engine inputs.

Example:

```text
SemesterAnalysisService
WorkloadAnalysisService
GradeAnalysisService
```

They are orchestration layers.

They should not reimplement engine algorithms.

---

# 90. Shared Analysis DTOs

Engine outputs and API DTOs may be closely related.

But API representations may omit internal fields.

Example:

engine:

```text
rawInteractionPenalty
```

might remain internal.

API:

```text
projectLoad = 8.3
findings = [...]
```

---

# 91. UI Independence

Business logic must not live exclusively in frontend components.

Bad:

```text
SemesterComparison.tsx
contains 400 lines of workload scoring
```

Good:

```text
Semester Engine
calculates
↓
frontend visualizes
```

---

# 92. Database Independence of Engines

Likewise:

Bad:

```text
grade-engine imports PrismaClient
```

Good:

```text
GradeAnalysisService
↓
Prisma
↓
maps data
↓
Grade Engine
```

---

# 93. Document Parsing Adapter

Document parsing should have its own abstraction.

Conceptually:

```ts
interface DocumentParser {
  supports(mimeType: string): boolean;
  parse(file: StoredFile): Promise<NormalizedDocument>;
}
```

Implementations:

```text
PdfDocumentParser
DocxDocumentParser
PlainTextParser
```

---

# 94. Normalized Document

Common intermediate representation:

```text
NormalizedDocument
```

may contain:

```text
text blocks
page numbers
headings
tables
metadata
```

The AI provider should not care whether the source was PDF or DOCX.

---

# 95. Parser Failure Isolation

If PDF parser fails:

the extraction model should not receive garbage and then be blamed.

Pipeline must clearly distinguish:

```text
PARSING_FAILED
```

from:

```text
EXTRACTION_FAILED
```

---

# 96. Future Multimodal Extraction

If table/image-heavy documents prove difficult:

add a visual extraction adapter.

Do not architect V1 around multimodal processing unless benchmark documents require it.

---

# 97. Performance Expectations

Semora is not high-frequency trading.

Reasonable goals:

### Normal API operations

feel immediate.

### Candidate analysis

sub-second where practical.

### Grade analysis

effectively instant.

### Workload analysis

sub-second to low seconds.

### AI document extraction

several seconds is acceptable.

Correctness matters more than shaving milliseconds from extraction.

---

# 98. Database Query Philosophy

Avoid N+1 query patterns.

Candidate analysis should load necessary relationships efficiently.

Example:

```text
candidate
+ selections
+ sections
+ meetings
+ course profiles
+ preferences
+ commitments
```

through a deliberate query set.

---

# 99. Pagination

Needed for:

```text
course catalogue
```

if large.

Not necessary for tiny child collections such as:

```text
five candidate courses
```

Do not paginate everything mechanically.

---

# 100. Search

Course catalogue needs basic search/filtering.

V1:

```text
course code
title
department
```

PostgreSQL text search or simple indexed matching is sufficient.

No Elasticsearch.

---

# 101. Frontend Rendering

Course catalogue could become large.

Use normal pagination/filtering before reaching for complex virtualization.

---

# 102. Feature Flags

Not necessary initially.

If experimental engine behavior needs testing, simple environment/config toggles are sufficient.

Do not build a feature-flag platform.

---

# 103. Environment Configuration

Use environment variables for:

```text
DATABASE_URL
SESSION_SECRET
APP_URL
```

Add later-phase variables only when the corresponding feature is implemented:

```text
AI_PROVIDER_KEY       course-outline extraction phase
FILE_STORAGE_CONFIG   document-storage phase
```

Never commit secrets.

Provide:

```text
.env.example
```

---

# 104. Secret Separation

Frontend environment variables are public once bundled.

AI credentials and database secrets must remain server-side.

---

# 105. Local Setup

Target:

```text
clone
install dependencies
start PostgreSQL
run migrations
seed
run dev
```

Avoid a 45-minute onboarding process.

Docker Compose may be used for local PostgreSQL if convenient.

Do not containerize everything just to say the project uses Docker.

---

# 106. Docker

Potentially useful for:

```text
local PostgreSQL
production API deployment
```

Not required for frontend development.

---

# 107. Database Migrations

Every schema change goes through migration files.

Never manually modify production schema.

The migration history becomes part of the project.

---

# 108. Seed Strategy

Separate:

```text
development seeds
```

from:

```text
real LUMS term imports
```

Do not bake actual term data into migration files.

---

# 109. Build Environments

At minimum:

```text
development
production
test
```

A separate staging environment is optional during early development.

---

# 110. CI

Recommended once foundation exists:

```text
install
typecheck
lint
unit tests
build
```

on each pull request / push.

Do not delay product development for elaborate CI/CD.

---

# 111. Deployment Automation

Once deployed:

a successful main-branch build may trigger deployment.

Database migrations should run deliberately and safely.

---

# 112. Backups

Production PostgreSQL should use managed backups if actual users begin storing grades/outlines.

During personal dogfooding, basic provider backups are sufficient.

---

# 113. No Microservices Decision

For V1:

```text
Semester Engine      library
Workload Engine      library
Grade Engine         library
Extraction           module/library
```

NOT:

```text
semester-service
workload-service
grade-service
ai-service
```

These have no operational reason to be separate.

---

# 114. When a Service Split Would Be Justified

Only reconsider if:

* extraction jobs require independent heavy scaling;
* ML workloads need Python/GPU infrastructure;
* one module has fundamentally different uptime/scaling requirements;
* team ownership requires independent deployment.

None are true for V1.

---

# 115. No Event Bus

Modules may call each other through application services.

No need for:

```text
Kafka
RabbitMQ
event sourcing
```

Example:

after extraction verification:

```text
invalidate semester analysis cache
invalidate workload analysis cache
```

can happen directly.

---

# 116. Domain Events — Lightweight Future Option

Internal events such as:

```text
ASSESSMENT_UPDATED
COURSE_LOCKED
EXTRACTION_VERIFIED
```

may become useful later.

If needed, implement in-process event handling first.

Do not introduce external infrastructure.

---

# 117. Current Analysis Consistency

When canonical data changes:

derived caches must become invalid.

Potential strategy:

```text
input hash
```

naturally handles this.

Explicit invalidation may improve efficiency but is not required for correctness.

---

# 118. API Versioning

V1 does not need:

```text
/api/v1
```

unless public API compatibility becomes relevant.

Semora currently has one first-party frontend.

Keep routes simple.

---

# 119. Accessibility

Frontend architecture should support normal accessibility:

* semantic elements;
* keyboard navigation;
* labels;
* readable heatmaps beyond color alone.

This matters particularly because workload information cannot rely only on red/green colors.

---

# 120. Responsive Design

Semora is web-first but should work well on phones.

Students will likely check:

```text
deadlines
grades
current pressure
```

from mobile.

The complex Semester Designer may remain more comfortable on desktop.

No native app is required.

---

# 121. Product Analytics

If added:

track product behavior such as:

```text
candidate created
comparison viewed
semester locked
outline uploaded
extraction corrected
dashboard revisited
```

Do not log sensitive academic content.

Product analytics are useful for validation but not a prerequisite for first deployment.

---

# 122. Dogfooding Instrumentation

Especially useful metrics:

```text
number of candidate semesters created
number of comparisons
outline correction rate
dashboard visits
heatmap visits
grade what-if usage
```

These help determine whether features are actually useful.

---

# 123. Development Priority

Architecture must follow product phases.

### First

```text
PLAN
```

### Then

```text
LOCK
```

### Then

```text
NAVIGATE
```

Do not build the entire technical platform simultaneously.

---

# 124. Phase 1 Architecture

Required:

```text
React app
Express API
Postgres
catalog
workspace
candidate semesters
commitments
Semester Engine
```

No AI required yet.

This is important.

The first product milestone can exist **without an LLM API call**.

---

# 125. Phase 2 Architecture

Add:

```text
active semester
document storage
document parsing
AI extraction
verification
```

---

# 126. Phase 3 Architecture

Add:

```text
assessments
Workload Engine
Grade Engine
dashboard
```

---

# 127. Architecture Risk — AI First Development

Do not begin development with outline extraction because it looks exciting.

That would create:

```text
AI demo
```

without the actual product.

Semora's core differentiator is Semester Designer.

Build product foundations first.

---

# 128. Architecture Risk — Generic Planner Creep

Do not create generic infrastructure for:

```text
tasks
notes
todos
projects
habits
```

unless required by Semora's academic model.

An `Assessment` is not a generic Todo.

A `Commitment` is not an invitation to build Notion.

---

# 129. Architecture Risk — Premature Community Platform

Do not architect V1 around:

```text
public course profiles
reviews
followers
social graphs
user-generated professor data
```

Community intelligence comes later.

---

# 130. Architecture Risk — Shared Canonical Assessments

Do not let one student's verified outline automatically become another student's active-semester truth.

For V1:

```text
verified active academic structure
```

is personal.

Shared historical aggregation can be added deliberately later.

---

# 131. Architecture Risk — Scoring Logic Everywhere

All Semester Engine formulas belong in the engine.

All Workload formulas belong in the engine.

All Grade calculations belong in the engine.

Never duplicate them in:

```text
controller
frontend
database trigger
```

---

# 132. Architecture Risk — Model Lock-In

Extraction provider calls must remain behind a small adapter.

The rest of Semora should not import a vendor SDK directly.

---

# 133. Architecture Risk — Too Many Tables Too Early

`DATA_MODEL.md` describes full V1 maturity.

Do not create all entities immediately.

Migrations follow feature phases.

---

# 134. Architecture Risk — Infrastructure Hobby Project

If engineering effort begins going primarily into:

```text
Docker
queues
CI
cloud networking
monitoring
```

before students can compare semesters, priorities are wrong.

---

# 135. System Invariant 1

```text
AI does interpretation.
Engines do calculation.
```

---

# 136. System Invariant 2

```text
Engines consume structured data.
They do not fetch their own data.
```

---

# 137. System Invariant 3

```text
Extraction drafts never become academic truth without verification.
```

---

# 138. System Invariant 4

```text
Canonical data lives in PostgreSQL.
Derived intelligence can always be recalculated.
```

---

# 139. System Invariant 5

```text
LUMS-specific behavior lives at system boundaries.
Core domain remains university-agnostic.
```

---

# 140. System Invariant 6

```text
One deployed application should be enough for V1.
```

---

# 141. System Invariant 7

```text
A single user must receive full baseline value.
```

No architectural dependency on community adoption.

---

# 142. System Invariant 8

```text
The application must remain understandable by one developer.
```

If understanding the deployment requires drawing twelve network boxes, V1 architecture has failed.

---

# 143. Recommended Initial Directory

Initial codebase may begin as:

```text
semora/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── domain/
│   └── semester-engine/
│
├── docs/
│
├── prisma/
│
├── package.json
└── README.md
```

Then add:

```text
workload-engine
grade-engine
extraction
```

when their build phases begin.

Do not scaffold unused complexity.

---

# 144. Architecture Success Condition

The architecture succeeds if:

* Semester Designer can ship quickly;
* engine logic is heavily testable;
* AI failures cannot corrupt grade logic;
* the database preserves clear academic truth;
* adding NAVIGATE features does not require rewriting PLAN;
* deployment remains simple;
* one developer can understand and modify the entire system during semester.

---

# 145. Final Architecture Rule

When choosing between:

> **technically impressive**

and:

> **simple, explicit, reliable**

Semora chooses the second unless measurable product requirements justify the first.

The product itself should contain the intelligence.

The infrastructure should be boring.
