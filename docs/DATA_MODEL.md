# Semora — Data Model Specification

**Status:** Design specification
**Version:** 0.1
**Related:** `PRODUCT.md`, `DECISIONS.md`, `SEMESTER_ENGINE.md`, `WORKLOAD_ENGINE.md`, `GRADE_ENGINE.md`, `AI_EXTRACTION.md`
**Primary responsibility:** Define Semora's canonical domain entities, relationships, ownership boundaries, provenance, and invariants.

---

# 1. Purpose

Semora combines several different concerns:

* university course data;
* course offerings and sections;
* candidate semester planning;
* active semesters;
* student preferences;
* external commitments;
* course outlines;
* AI extraction drafts;
* verified grading structures;
* assessments;
* grades;
* workload analysis;
* semester analysis.

The data model must support these without turning the database into an over-generalized academic ERP system.

The guiding principle is:

> **Model what Semora needs to understand a student's semester, and nothing more.**

---

# 2. Core Domain Hierarchy

The primary academic hierarchy is:

```text
University
    ↓
AcademicTerm
    ↓
Course
    ↓
CourseOffering
    ↓
Section
    ↓
Meeting
```

The student's personal semester hierarchy is:

```text
User
    ↓
SemesterWorkspace
    ├── CandidateSemesters
    ├── ActiveSemester
    ├── Preferences
    └── Commitments
```

Course-operation data hangs primarily from:

```text
CourseOffering
```

because grading structures, assessments, instructors, and workload may change between offerings.

---

# 3. Core Design Principles

## 3.1 Course ≠ Course Offering

Mandatory distinction.

Example:

```text
Course:
CS 340 — Operating Systems
```

versus:

```text
Course Offering:
CS 340
Fall 2026
Professor X
```

The abstract course contains relatively stable identity information.

The offering contains semester-specific information.

---

## 3.2 Course Offering ≠ Section

A single course offering may have multiple sections.

Example:

```text
CS 340 — Fall 2026

Section 1
Mon/Wed 12:30

Section 2
Tue/Thu 14:00
```

Sections may differ in:

* timetable;
* instructor;
* capacity.

Depending on the university, sections may also differ academically.

Therefore section-level overrides must be possible.

---

# 4. User

Represents an authenticated Semora user.

Recommended fields:

```text
User
----
id
email
display_name
timezone
created_at
updated_at
```

Optional later:

```text
preferred_locale
default_university_id
```

Do not store unnecessary profile information.

---

# 5. University

Represents an institution.

```text
University
----------
id
name
short_name
country
timezone
created_at
```

Example:

```text
name = Lahore University of Management Sciences
short_name = LUMS
```

---

# 6. University Adapter Metadata

LUMS-specific parsing/import logic should not pollute the core academic entities.

Possible auxiliary object:

```text
UniversityDataSource
--------------------
id
university_id
source_type
source_name
configuration
```

Example:

```text
source_type = COURSE_MEMO_IMPORT
```

V1 may keep this in code configuration rather than database tables if simpler.

---

# 7. Academic Term

Represents one academic period.

```text
AcademicTerm
------------
id
university_id
name
term_type
academic_year
start_date
end_date
add_drop_end_date
exam_start_date
exam_end_date
status
```

Example:

```text
name = Fall 2026
term_type = FALL
academic_year = 2026-2027
```

---

# 8. Academic Term Status

Suggested:

```text
UPCOMING
ACTIVE
COMPLETED
ARCHIVED
```

This should not be overused for business logic.

Dates remain authoritative.

---

# 9. Course

Stable academic course identity.

```text
Course
------
id
university_id
course_code
title
description
credit_hours_default
department
created_at
updated_at
```

Example:

```text
course_code = CS 340
title = Operating Systems
```

---

# 10. Course Code Uniqueness

Within one university:

```text
(university_id, course_code)
```

should normally be unique.

Do not assume course codes are globally unique.

---

# 11. Course Offering

Represents one course in one academic term.

```text
CourseOffering
--------------
id
course_id
academic_term_id

credit_hours
description_override

grading_mode

source_confidence
created_at
updated_at
```

Possible future:

```text
status
historical_workload_summary
```

---

# 12. Why Credit Hours Exist on Offering

Credit hours may occasionally change by offering or curriculum.

Therefore:

```text
Course.credit_hours_default
```

provides fallback.

```text
CourseOffering.credit_hours
```

is authoritative for the term when known.

---

# 13. Section

Represents a registrable section.

```text
Section
-------
id
course_offering_id
section_code
capacity
instructor_display
created_at
updated_at
```

Possible:

```text
is_active
```

---

# 14. Instructor Modeling

V1 does **not require a full academic personnel directory**.

Simplest approach:

```text
Section.instructor_display
```

Example:

```text
"Dr. Agha Ali Raza"
```

If instructor-level analytics later become important, introduce:

```text
Instructor
SectionInstructor
```

Do not build this prematurely.

---

# 15. Meeting

Represents one recurring teaching meeting.

```text
Meeting
-------
id
section_id
day_of_week
start_time
end_time
meeting_type
location
```

Example types:

```text
LECTURE
LAB
TUTORIAL
SEMINAR
OTHER
```

Location is optional.

---

# 16. Meeting Invariant

Require:

```text
start_time < end_time
```

for normal same-day meetings.

Cross-midnight meetings are outside normal V1 academic scheduling.

---

# 17. Semester Workspace

Represents one user's planning/active-semester environment for one academic term.

```text
SemesterWorkspace
-----------------
id
user_id
academic_term_id
state
created_at
updated_at
```

There should generally be at most one primary workspace per:

```text
(user_id, academic_term_id)
```

---

# 18. Workspace State

Suggested:

```text
PLANNING
ACTIVE
COMPLETED
ARCHIVED
```

`ACTIVE` means the user has locked an actual semester.

---

# 19. Why Workspace Exists

Do not attach candidate semesters directly to `User`.

The workspace groups:

```text
Fall 2026
├── Candidate A
├── Candidate B
├── Candidate C
├── Active Semester
├── Commitments
└── Preferences
```

This keeps planning term-specific.

---

# 20. Candidate Semester

Represents one proposed semester configuration.

```text
CandidateSemester
-----------------
id
workspace_id
name
is_archived
created_at
updated_at
```

Example:

```text
"Option A — Distributed Systems"
```

---

# 21. Candidate Semester Course Selection

Join entity:

```text
CandidateCourseSelection
------------------------
id
candidate_semester_id
section_id
interest_score
career_relevance_score
manual_workload_override_id
```

The selected **section** implies:

```text
course offering
course
meeting times
```

---

# 22. Candidate Selection Uniqueness

A candidate semester should not contain two sections from the same course offering.

Enforce logically:

```text
one selected section per course offering
```

unless future university structures require exceptions.

---

# 23. Active Semester

Avoid duplicating all candidate data into a totally separate model if unnecessary.

Recommended approach:

When a candidate is locked:

```text
CandidateSemester
```

may become:

```text
locked_candidate_semester_id
```

on the workspace.

Example:

```text
SemesterWorkspace
-----------------
locked_candidate_semester_id
locked_at
```

The active semester uses that candidate's selections as its baseline.

---

# 24. Add/Drop Changes

After locking, course selections can still change.

Two possible designs:

### Option A

Continue modifying the locked CandidateSemester.

### Option B

Create separate ActiveCourseSelection records.

Recommended for V1:

**Option B.**

Why:

Candidate history remains intact.

---

# 25. Active Course Selection

```text
ActiveCourseSelection
---------------------
id
workspace_id
section_id
added_at
dropped_at
status
```

Suggested status:

```text
ACTIVE
DROPPED
```

This provides basic Add/Drop history.

---

# 26. Locking Workflow

Conceptually:

```text
CandidateSemester
      ↓ LOCK
copy selections
      ↓
ActiveCourseSelection[]
```

Then:

```text
workspace.state = ACTIVE
```

This is simple and preserves planning history.

---

# 27. User Preference Profile

Preferences belong to a semester workspace because a student's priorities may differ by term.

```text
SemesterPreferences
-------------------
id
workspace_id

workload_priority
schedule_priority
career_priority
interest_priority
grade_safety_priority

project_preference
exam_preference
continuous_assessment_preference

free_day_priority
early_class_aversion
late_class_aversion

max_preferred_hard_courses
```

Values should use normalized scales.

---

# 28. Preference Scale

Recommended internal representation:

```text
0.0 → 1.0
```

or:

```text
0 → 10
```

Choose one consistently.

Recommended:

```text
0.0 → 1.0
```

internally.

UI may use labels.

---

# 29. Flexible Preference Storage

Do not immediately implement preferences as arbitrary JSON.

Important preferences deserve typed fields because:

* they are business logic;
* they need validation;
* they need indexing/testing;
* they influence deterministic scoring.

---

# 30. Commitment

Represents an activity affecting semester capacity.

```text
Commitment
----------
id
workspace_id
name
category
weekly_effort_hours
flexibility
priority
start_date
end_date
created_at
updated_at
```

Categories:

```text
TASHIP
SOCIETY
WORK
RESEARCH
GYM
COMMUTE
PERSONAL
OTHER
```

---

# 31. Commitment Schedule

Recurring timing:

```text
CommitmentMeeting
-----------------
id
commitment_id
day_of_week
start_time
end_time
```

Example:

```text
TAship
Monday
12:30–14:20
```

---

# 32. One-Off Commitment Event

For exceptional events:

```text
CommitmentEvent
---------------
id
commitment_id
title
start_at
end_at
estimated_effort_hours
flexibility_override
```

Example:

```text
Lahore Cup
October 12
8 hours
```

---

# 33. Why Recurring and One-Off Are Separate

A society may normally require:

```text
4h/week
```

but have:

```text
Tournament Weekend = 12h
```

The Workload Engine needs both.

---

# 34. Course Workload Profile

Represents Semora's current workload understanding for one course offering or section.

Recommended:

```text
CourseWorkloadProfile
---------------------
id
course_offering_id
section_id nullable

overall_intensity
continuous_workload
assignment_intensity
quiz_intensity
project_intensity
exam_intensity
lab_intensity
reading_intensity
schedule_burden
assessment_fragmentation

estimated_weekly_hours

confidence
source_type

created_at
updated_at
```

---

# 35. Offering vs Section Workload Profile

Default profile:

```text
section_id = null
```

applies to entire offering.

If one section differs significantly:

```text
section_id = specific section
```

overrides offering-level profile.

---

# 36. Workload Profile Source

Suggested:

```text
STRUCTURAL_ESTIMATE
USER_ESTIMATE
VERIFIED_OUTLINE
COMMUNITY_AGGREGATE
PERSONAL_HISTORY
```

V1 primarily uses:

```text
STRUCTURAL_ESTIMATE
USER_ESTIMATE
VERIFIED_OUTLINE
```

---

# 37. Workload Signal

Separate extracted facts from calculated workload scores.

```text
WorkloadSignal
--------------
id
course_offering_id
signal_type
value
source_reference_id
confidence
```

Examples:

```text
WEEKLY_QUIZZES = true
MAJOR_PROJECT_COUNT = 1
MIDTERM_COUNT = 2
HAS_FINAL = true
```

The Semester Engine can derive workload profiles from these signals.

---

# 38. Why Workload Signals Matter

Store:

```text
weekly_quizzes = true
```

rather than only:

```text
quiz_intensity = 8
```

because scoring methodology may change.

Facts should outlive scoring formulas.

---

# 39. Document

Represents uploaded source material.

```text
Document
--------
id
user_id
workspace_id nullable
course_offering_id nullable

document_type
original_filename
storage_key
mime_type
file_size
file_hash

uploaded_at
deleted_at
```

---

# 40. Document Type

Initial:

```text
COURSE_OUTLINE
COURSE_MEMO
COURSE_TIMING
OTHER
```

---

# 41. Document Ownership

Every document must belong to a user.

Course outlines may additionally attach to:

```text
workspace
course_offering
```

No public access by default.

---

# 42. Extraction Job

Represents one processing attempt.

```text
ExtractionJob
-------------
id
document_id
status
model_identifier
extractor_version
schema_version
started_at
completed_at
failure_reason
```

Statuses:

```text
PENDING
PARSING
EXTRACTING
REVIEW_REQUIRED
VERIFIED
FAILED
```

---

# 43. Extraction Draft

Do not dump every draft into canonical academic tables immediately.

Recommended:

```text
ExtractionDraft
---------------
id
extraction_job_id
draft_payload
overall_confidence
created_at
```

The JSON payload is acceptable **here** because it represents temporary model output.

Canonical data remains typed.

---

# 44. Extraction Field Correction

```text
ExtractionCorrection
--------------------
id
extraction_job_id
field_path
original_value
corrected_value
corrected_at
```

Useful for:

* evaluation;
* debugging;
* future extraction improvements.

---

# 45. Extraction Conflict

```text
ExtractionConflict
------------------
id
extraction_job_id
field_path
conflict_type
candidate_values
resolved_value
resolution_status
```

Example:

```text
Final weight:
35 vs 40
```

---

# 46. Verification

Recommended:

```text
ExtractionVerification
----------------------
id
extraction_job_id
verified_by_user_id
verified_at
verification_state
```

States:

```text
VERIFIED
VERIFIED_WITH_GAPS
REJECTED
```

---

# 47. Canonical Academic Data

Once verified, extraction creates or updates typed entities such as:

```text
GradingScheme
GradeCategory
Assessment
GradeThreshold
WorkloadSignal
```

Downstream engines use these entities.

They do **not** read extraction draft JSON directly.

---

# 48. Grading Scheme

One active grading scheme per course offering/section context.

```text
GradingScheme
-------------
id
course_offering_id
section_id nullable

grading_mode
total_expected_weight
rounding_policy

source_type
source_document_id
verified

created_at
updated_at
```

---

# 49. Grading Mode

```text
ABSOLUTE
RELATIVE
PASS_FAIL
UNKNOWN
```

---

# 50. Grade Category

```text
GradeCategory
-------------
id
grading_scheme_id
name
weight_percentage
aggregation_rule
display_order
```

Example:

```text
Assignments
20%
```

---

# 51. Aggregation Rule

Suggested:

```text
EQUAL_MEAN
POINTS_WEIGHTED_MEAN
EXPLICIT_WEIGHTS
BEST_N
DROP_LOWEST_N
```

Supporting parameters should not require a table per rule.

---

# 52. Category Rule Configuration

Possible:

```text
GradeCategory
-------------
aggregation_rule
rule_parameter_n nullable
```

Examples:

```text
BEST_N
n = 8
```

or:

```text
DROP_LOWEST_N
n = 2
```

Simple and sufficient for V1.

---

# 53. Grade Threshold

```text
GradeThreshold
--------------
id
grading_scheme_id
letter_grade
minimum_percentage
inclusive
source_type
```

Example:

```text
A-
85
true
```

---

# 54. Assessment

Core entity shared by Grade and Workload Engines.

```text
Assessment
----------
id
course_offering_id
section_id nullable
grade_category_id nullable

title
assessment_type

weight_percentage nullable
points_possible nullable

due_at nullable
date_precision

status

estimated_effort_hours nullable
effort_confidence nullable

is_group_assessment
parent_assessment_id nullable

source_type
source_document_id nullable

created_at
updated_at
```

---

# 55. Assessment Type

Suggested:

```text
ASSIGNMENT
QUIZ
PROJECT
PROJECT_MILESTONE
MIDTERM
FINAL
PRESENTATION
LAB
REPORT
PARTICIPATION
ATTENDANCE
OTHER
```

---

# 56. Assessment Status

Recommended:

```text
UPCOMING
SUBMITTED
GRADED
MISSING
EXCUSED
DROPPED
CANCELLED
```

For Workload Engine, task progression may also need:

```text
NOT_STARTED
IN_PROGRESS
DONE
```

Do not overload one status column with two unrelated state machines.

---

# 57. Assessment Work Status

Separate field:

```text
work_status
```

Possible:

```text
NOT_STARTED
IN_PROGRESS
DONE
```

Academic result status remains separate.

---

# 58. Assessment Parent Relationship

For multi-stage projects:

```text
parent_assessment_id
```

or better:

introduce:

```text
AssessmentGroup
```

Recommended V1 simplification:

Use:

```text
parent_assessment_id
```

only if needed.

Avoid extra table until actual project hierarchy requires it.

---

# 59. Assessment Date Precision

```text
EXACT
DAY_ONLY
WEEK
APPROXIMATE
TBA
UNKNOWN
```

For week-level dates, storing only one exact timestamp would be misleading.

---

# 60. Approximate Assessment Date

Possible additional fields:

```text
due_window_start
due_window_end
```

If:

```text
date_precision = WEEK
```

then:

```text
due_at = null
due_window_start = ...
due_window_end = ...
```

This is more honest.

---

# 61. Assessment Score

```text
AssessmentScore
---------------
id
assessment_id
user_id

points_earned
percentage_override nullable

recorded_at
source_type
```

Normally one active score per user/assessment.

---

# 62. Why User ID Is Needed

The same course offering may eventually be used by multiple Semora users.

Assessments can be shared structurally.

Scores are personal.

---

# 63. Assessment User State

Rather than putting user-specific completion state directly on shared `Assessment`, consider:

```text
UserAssessmentState
-------------------
id
assessment_id
user_id

work_status
progress_percentage nullable
personal_effort_estimate nullable
personal_effort_confidence nullable
```

This is more scalable.

---

# 64. V1 Decision on Shared Assessments

Since community-level sharing is not required initially, V1 may create assessment records scoped to a user's workspace/course selection.

However, the domain should avoid assuming assessment scores belong globally to the offering.

Recommended cleaner structure:

```text
Assessment
```

belongs to:

```text
ActiveCourseSelection
```

rather than directly to `CourseOffering`.

This avoids accidental cross-user sharing.

---

# 65. Revised Assessment Ownership

Recommended V1:

```text
Assessment
----------
id
active_course_selection_id
grade_category_id
...
```

This is safer.

Later, shared/historical course structures can be introduced separately.

---

# 66. Why Personal Assessment Ownership Is Better

Two users in the same offering may:

* receive different extensions;
* manually correct dates differently;
* have different section information;
* join Semora at different times.

Canonical course-template data and user's live semester state should remain distinguishable.

---

# 67. Course Structure Template

Future optimization may introduce:

```text
CourseOfferingTemplate
```

that users can import.

Not necessary for V1.

For V1:

verified outline data may populate personal course-state objects.

---

# 68. Active Course State

Recommended entity:

```text
ActiveCourseState
-----------------
id
active_course_selection_id

grading_scheme_id
workload_profile_id nullable

outline_document_id nullable
data_completeness
data_confidence
```

This groups live academic structure for the user's selected course.

---

# 69. Revised Grading Scheme Ownership

For V1, prefer:

```text
GradingScheme.active_course_state_id
```

rather than global `course_offering_id`.

This prevents one user's corrected outline from altering everyone else's course.

---

# 70. Historical Sharing Later

Once Semora has enough users, verified structures may be promoted into shared historical offering data.

That is a **future ingestion/aggregation problem**.

Do not solve it now.

---

# 71. Grade Adjustment

```text
GradeAdjustment
---------------
id
active_course_state_id
type
value
unit
reason
```

Types:

```text
BONUS
PENALTY
```

V1 may support only percentage-point adjustments.

---

# 72. Class Statistic

```text
ClassStatistic
--------------
id
assessment_id

mean
median
standard_deviation
minimum
maximum

source_type
recorded_at
```

User-entered initially.

---

# 73. Grade Scenario

What-if projections.

```text
GradeScenario
-------------
id
active_course_state_id
user_id
name
created_at
updated_at
```

---

# 74. Grade Scenario Entry

```text
GradeScenarioEntry
------------------
id
grade_scenario_id
assessment_id nullable
grade_category_id nullable
hypothetical_percentage
```

Allows:

```text
Final = 82%
```

or:

```text
Remaining assignments average = 90%
```

---

# 75. Pressure Analysis Persistence

Most Workload Engine outputs should be **derived**, not core truth.

Do not persist every recalculation unnecessarily.

Possible cache entity:

```text
PressureAnalysisSnapshot
------------------------
id
workspace_id
engine_version
input_hash
generated_at
payload
```

JSON is acceptable for derived analysis output.

---

# 76. Why JSON Is Fine for Engine Results

Engine outputs are:

* derived;
* versioned;
* replaceable;
* not canonical user data.

Therefore:

```text
payload JSON
```

is appropriate.

Do not normalize every generated finding into 12 relational tables unless needed.

---

# 77. Pressure Finding

If findings need direct UI querying, they may remain embedded inside analysis payload.

V1 recommendation:

**keep them inside analysis result JSON.**

Possible later table if analytics requires it.

---

# 78. Semester Analysis Snapshot

Same principle:

```text
SemesterAnalysisSnapshot
------------------------
id
candidate_semester_id
engine_version
input_hash
generated_at
payload
```

Stores:

```text
metrics
findings
confidence
completeness
recommendation_tags
```

---

# 79. Engine Cache Invariant

Derived analysis may be discarded and recomputed at any time.

Canonical data must not depend on cached engine output.

---

# 80. Provenance

Important canonical values should identify where they came from.

Suggested general source types:

```text
OFFICIAL_IMPORT
COURSE_MEMO
COURSE_OUTLINE
USER_ENTERED
AI_EXTRACTED_VERIFIED
STRUCTURAL_ESTIMATE
COMMUNITY_AGGREGATE
PERSONAL_HISTORY
```

---

# 81. Avoid Generic Provenance Table Initially

A fully generic:

```text
Provenance(entity_type, field_name, source...)
```

system sounds elegant but adds substantial complexity.

V1 should place source fields directly on high-value entities where needed.

Examples:

```text
Assessment.source_type
GradeThreshold.source_type
WorkloadSignal.source_type
```

---

# 82. Confidence

Confidence belongs where information is uncertain.

Do not attach meaningless confidence to deterministic values.

Example:

```text
Meeting start time from official import
```

does not need model confidence.

Example:

```text
estimated project intensity
```

does.

---

# 83. Data Completeness

Active course state should track derived completeness.

Example:

```text
data_completeness = 0.82
```

This may be recalculated rather than permanently stored.

Possible dimensions:

```text
grading structure
assessment dates
workload signals
grading mode
```

---

# 84. Current vs Historical Data

Do not overwrite history unnecessarily.

Examples worth preserving:

* candidate semesters;
* dropped active courses;
* uploaded outline versions;
* extraction drafts;
* user corrections.

But avoid building full event sourcing.

Standard audit timestamps and selected history records are enough.

---

# 85. Soft Delete

Use soft delete only where history matters.

Likely candidates:

```text
Document
ActiveCourseSelection
CandidateSemester
```

Do not soft-delete everything blindly.

---

# 86. Timezone

Store timestamps in UTC.

Interpret course/commitment local times using:

```text
University.timezone
```

or:

```text
User.timezone
```

For campus course schedules, university timezone is normally authoritative.

---

# 87. Academic Week

The Workload Engine needs semester-relative weeks.

Do not create a database row for every week unless useful.

Calculate from:

```text
AcademicTerm.start_date
```

and academic-calendar configuration.

---

# 88. Academic Break

Potential entity:

```text
AcademicCalendarEvent
---------------------
id
academic_term_id
event_type
start_date
end_date
name
```

Types:

```text
BREAK
HOLIDAY
EXAM_PERIOD
READING_PERIOD
OTHER
```

Useful but optional for early V1.

---

# 89. Import Batch

Since course data may come from RO documents:

```text
ImportBatch
-----------
id
university_id
academic_term_id
import_type
source_filename
created_at
status
```

Useful for:

* auditing imported courses;
* re-running imports;
* identifying source versions.

---

# 90. Import Record Provenance

Courses/sections created from one batch may store:

```text
import_batch_id
```

optional.

This is useful if source files change.

---

# 91. User Course Preference

Interest and career fit may vary by user.

Do not store them on `Course`.

Potential:

```text
UserCoursePreference
--------------------
id
workspace_id
course_offering_id

interest_score
career_relevance_score
manual_difficulty_estimate
manual_notes
```

Then multiple candidate semesters reuse the same preference.

---

# 92. Why Preference Should Not Live on Candidate Selection

If the student rates:

```text
NLP interest = 9
```

that should carry across Candidate A and Candidate B.

So move:

```text
interest_score
career_relevance_score
```

from `CandidateCourseSelection`

to:

```text
UserCoursePreference
```

Cleaner.

---

# 93. Candidate Course Selection Final Shape

```text
CandidateCourseSelection
------------------------
id
candidate_semester_id
section_id
created_at
```

Simple.

User-specific opinions live elsewhere.

---

# 94. User Constraint

Some constraints may be dynamic.

Instead of adding one database column for every future constraint, use:

```text
UserSemesterConstraint
----------------------
id
workspace_id
constraint_type
value
is_hard
```

Example:

```text
constraint_type = REQUIRED_FREE_DAY
value = FRIDAY
is_hard = false
```

---

# 95. Typed Constraint Values

Avoid completely freeform strings.

Use validated schemas per constraint type.

Possible JSON value is acceptable:

```json
{
  "day": "FRIDAY"
}
```

because constraint types are extensible and engine-owned.

---

# 96. Constraint Types

Initial possibilities:

```text
MIN_CREDITS
MAX_CREDITS
REQUIRED_FREE_DAY
EARLIEST_CLASS_TIME
LATEST_CLASS_TIME
MAX_HARD_COURSES
MUST_INCLUDE_COURSE
MUST_EXCLUDE_COURSE
```

Some may simply be represented through preferences instead.

Do not duplicate semantics unnecessarily.

---

# 97. Auth and Billing

These are infrastructure concerns.

The domain model should not mix them into academic entities. Phase 0
authentication may require library-owned credential, identity, and session
tables. Those tables must link unambiguously to `User` but remain outside the
academic domain model described here.

Possible billing tables later:

```text
Subscription
Entitlement
UsageRecord
```

Not part of this spec.

---

# 98. Suggested V1 Entity Set

A realistic V1 does **not** need dozens of tables immediately.

Core:

```text
User
University
AcademicTerm
Course
CourseOffering
Section
Meeting

SemesterWorkspace
SemesterPreferences
CandidateSemester
CandidateCourseSelection
ActiveCourseSelection

Commitment
CommitmentMeeting
CommitmentEvent

UserCoursePreference
CourseWorkloadProfile
WorkloadSignal

Document
ExtractionJob
ExtractionDraft
ExtractionCorrection

ActiveCourseState
GradingScheme
GradeCategory
GradeThreshold
Assessment
AssessmentScore
UserAssessmentState
GradeAdjustment
ClassStatistic
GradeScenario
GradeScenarioEntry

SemesterAnalysisSnapshot
PressureAnalysisSnapshot
```

Approximately 30 entities **at full V1 maturity**.

They do not all need to exist on day one.

---

# 99. Phase 0 Migration

The Phase 0 build migration is deliberately limited to:

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

The authentication library may add credential and session tables. Do not add
candidate, preference, or commitment tables until their corresponding build
phases.

This is enough to verify persistence, authentication, seed data, and the
protected application shell before catalogue and planning behavior are added.

---

# 100. Subsequent Migration Groups

These groupings describe dependencies, not fixed migration numbers. Add each
group only when its corresponding build phase begins.

Planning:

```text
CandidateSemester
CandidateCourseSelection
SemesterPreferences
UserCoursePreference
Commitment
CommitmentMeeting
```

Active semester and extraction:

```text
ActiveCourseSelection
ActiveCourseState

Document
ExtractionJob
ExtractionDraft
ExtractionCorrection

GradingScheme
GradeCategory
GradeThreshold
Assessment
```

---

# 101. Navigation Migration Group

Add operational semester data:

```text
AssessmentScore
UserAssessmentState
GradeAdjustment
ClassStatistic

GradeScenario
GradeScenarioEntry

PressureAnalysisSnapshot
SemesterAnalysisSnapshot
```

Avoid creating every V1 table in the Phase 0 migration.

---

# 102. Relationship Overview

Conceptually:

```text
University
└── AcademicTerm
    └── CourseOffering
        ├── Course
        └── Section
            └── Meeting


User
└── SemesterWorkspace
    ├── SemesterPreferences
    ├── CandidateSemester
    │   └── CandidateCourseSelection
    │       └── Section
    │
    ├── ActiveCourseSelection
    │   └── ActiveCourseState
    │       ├── GradingScheme
    │       │   ├── GradeCategory
    │       │   └── GradeThreshold
    │       │
    │       └── Assessment
    │           ├── AssessmentScore
    │           └── UserAssessmentState
    │
    ├── Commitment
    │   ├── CommitmentMeeting
    │   └── CommitmentEvent
    │
    └── Documents
        └── ExtractionJobs
            └── ExtractionDraft
```

---

# 103. Candidate-to-Active Separation

Important invariant:

```text
CandidateSemester
```

represents planning.

```text
ActiveCourseSelection
```

represents what the student is actually taking.

Changing the active semester should **not destroy candidate planning history**.

---

# 104. Academic Truth Separation

Important invariant:

```text
ExtractionDraft
```

is AI interpretation.

```text
ActiveCourseState + GradingScheme + Assessment
```

are verified operational data.

Never collapse these layers.

---

# 105. Shared vs Personal Truth

Another important distinction:

### Shared academic source

```text
Course
CourseOffering
Section
Meeting
```

### Personal semester truth

```text
ActiveCourseSelection
Assessment
AssessmentScore
Commitment
Preferences
```

Do not let one user's manual changes alter global course data.

---

# 106. Global Data Modification Rule

Users should not directly edit:

```text
official Course
CourseOffering
Section
Meeting
```

records globally.

If imported information is wrong for them, support:

* reporting error;
* temporary local override if necessary.

Avoid one user changing everybody's timetable.

---

# 107. Local Section Override — Future

If needed:

```text
UserSectionOverride
```

could store corrected meeting information.

Do not build unless real source-data issues require it.

---

# 108. Course Offering Identity

Recommended uniqueness:

```text
(course_id, academic_term_id)
```

if one offering per term.

If departments distinguish multiple independent offerings:

add variant/version key.

Sections remain separate.

---

# 109. Section Identity

Recommended uniqueness:

```text
(course_offering_id, section_code)
```

---

# 110. Workspace Identity

Recommended uniqueness:

```text
(user_id, academic_term_id)
```

for active primary workspace.

If future scenario work needs multiple independent workspaces, reconsider.

V1 does not.

---

# 111. Assessment Ownership Invariant

Every personal assessment must ultimately resolve to:

```text
User
+
AcademicTerm
+
ActiveCourseSelection
```

This prevents orphaned or cross-user grade records.

---

# 112. Score Ownership Invariant

An `AssessmentScore` must belong to the same user as the containing workspace.

Enforce in application/service logic even if relational FK chains make direct DB enforcement awkward.

---

# 113. Grade Category Weight Validation

At verification time:

```text
sum(weights)
```

should normally equal:

```text
100
```

but database should not enforce this with a hard constraint because:

* incomplete structures;
* bonus categories;
* temporary drafts

exist.

Validation belongs in domain logic.

---

# 114. Percentage Storage

Store percentage values using decimal/numeric types.

Avoid binary floating-point for grade-critical persisted values.

Example:

```text
NUMERIC(6,3)
```

or equivalent.

Exact choice belongs to implementation.

---

# 115. Time Storage

For weekly recurring schedules:

```text
day_of_week
start_time
end_time
```

not arbitrary timestamps.

For dated assessments/events:

```text
timestamp with timezone
```

or UTC instant.

---

# 116. Course Code Storage

Store course code as text.

Do not attempt to numerically split:

```text
CS 340
MGMT 212
BIO-101
```

into rigid structures unless university adapters need it.

---

# 117. Capacity

Section capacity is informational.

Semora V1 should not assume:

```text
capacity > enrollment
```

means seats are available unless actual enrollment data exists.

Avoid pretending to be live registration software.

---

# 118. Enrollment Status

The user's active course selection may optionally store:

```text
registration_status
```

Possible:

```text
PLANNED
REGISTERED
WAITLISTED
DROPPED
```

Not critical unless useful during Add/Drop.

---

# 119. Candidate Semester Names

Names are user-facing.

Allow:

```text
Option A
Balanced
Distributed Route
Easy Friday
```

No uniqueness requirement necessary within workspace, though UI can discourage duplicates.

---

# 120. Notes

Avoid sprinkling generic `notes TEXT` fields everywhere.

Use only where the user has a clear reason to store notes.

Semora is not a note-taking app.

---

# 121. Deleted Courses

If university source data removes an offering after import, avoid hard deletion if users already reference it.

Mark:

```text
is_available = false
```

or retain historical term data.

---

# 122. Immutable Historical Terms

Once an academic term is completed, imported academic structures should generally become historical rather than mutable.

User personal semester data remains available.

---

# 123. Engine Version Persistence

Analysis snapshots include:

```text
engine_version
```

Examples:

```text
semester_engine_version
workload_engine_version
grade_engine_version
```

Grade Engine calculations generally need not be stored as snapshots unless UI/history needs them.

---

# 124. Input Hash

Derived analysis caches should store:

```text
input_hash
```

covering relevant canonical inputs.

If inputs change:

invalidate analysis.

---

# 125. Cache Validity

Never trust analysis merely because:

```text
generated_at = five minutes ago
```

Trust it because its input fingerprint matches current canonical state.

---

# 126. Audit Timestamps

Most mutable entities should have:

```text
created_at
updated_at
```

Avoid implementing a full audit-log framework in V1.

Important transitions may additionally record:

```text
locked_at
dropped_at
verified_at
```

---

# 127. AI Data Must Be Deletable

Users should be able to delete:

```text
Document
ExtractionDraft
```

subject to product rules around verified course structures.

Do not tightly couple canonical objects to permanent source-file existence.

---

# 128. Referential Deletion

Deleting a document should not automatically cascade-delete:

```text
verified grades
assessments
course state
```

without explicit user action.

Avoid dangerous cascades.

---

# 129. Cascade Policy

Safe cascades:

```text
CandidateSemester
→ CandidateCourseSelection
```

Potentially safe:

```text
GradeScenario
→ GradeScenarioEntry
```

Dangerous:

```text
Document
→ all canonical academic data
```

Do not configure casually.

---

# 130. Database Choice Assumption

The data model strongly fits a relational database.

Recommended conceptual choice:

```text
PostgreSQL
```

because Semora contains:

* clear relationships;
* constraints;
* joins;
* transactional updates;
* structured academic data.

Final stack belongs to `ARCHITECTURE.md`.

---

# 131. Why Not MongoDB-First

The domain has strong relational structure:

```text
Course → Offering → Section → Meeting
Workspace → Candidate → Selection
Course State → Category → Assessment → Score
```

A relational database naturally represents these invariants.

Document extraction drafts and derived analysis payloads can still use JSON columns where appropriate.

---

# 132. JSON Usage Rule

Use JSON for:

```text
temporary AI extraction drafts
derived engine result payloads
extensible constraint values
```

Do not use JSON as an excuse to avoid modeling core domain entities.

---

# 133. Canonical vs Derived Data

Canonical examples:

```text
Course
Meeting
Assessment
Score
Commitment
Preference
```

Derived examples:

```text
Semester score
Pressure score
Recommendation tags
Findings
Current weighted performance
```

Derived values should usually be recalculable.

---

# 134. Do Not Store Every Calculation

Avoid persisted columns such as:

```text
current_grade
weekly_pressure
semester_score
```

unless used specifically as caches.

Otherwise they become stale.

Calculate from canonical data.

---

# 135. Data Model Success Condition

The model succeeds if:

* Semester Engine can reason without hacks;
* Workload Engine can obtain assessments and commitments cleanly;
* Grade Engine can reproduce all calculations;
* AI extraction can remain isolated until verification;
* candidate planning and active-semester state remain separate;
* LUMS-specific imports do not leak into the domain;
* a second university could theoretically reuse the same core model.

---

# 136. V1 Anti-Overengineering Rule

Do not create tables merely because this document mentions a future possibility.

An entity should be implemented when:

1. a current feature requires it;
2. the relationship has meaningful business semantics;
3. putting it somewhere else would create ambiguity or duplication.

The database should grow alongside the build phases.

---

# 137. Critical Invariants

The following must remain true:

### Invariant 1

```text
Course ≠ CourseOffering ≠ Section
```

### Invariant 2

```text
Candidate semester ≠ active semester
```

### Invariant 3

```text
AI extraction draft ≠ verified academic truth
```

### Invariant 4

```text
shared university data ≠ personal semester data
```

### Invariant 5

```text
canonical data ≠ derived engine output
```

### Invariant 6

```text
grade importance ≠ workload effort
```

### Invariant 7

```text
community data is never required for individual usefulness
```

---

# 138. Recommended Schema Implementation Order

The stages in this section are schema stages, not `BUILDPLAN.md` build phases.
Build-phase scope and timing remain authoritative.

## Schema Stage 1 — Planning Foundation

Implement:

```text
User
University
AcademicTerm
Course
CourseOffering
Section
Meeting

SemesterWorkspace
SemesterPreferences
CandidateSemester
CandidateCourseSelection

UserCoursePreference

Commitment
CommitmentMeeting
```

Enough for:

```text
PLAN
```

---

## Schema Stage 2 — Active Semester

Add:

```text
ActiveCourseSelection
ActiveCourseState
CommitmentEvent
```

Enough for:

```text
LOCK
```

---

## Schema Stage 3 — Documents and Extraction

Add:

```text
Document
ExtractionJob
ExtractionDraft
ExtractionCorrection
ExtractionVerification
```

---

## Schema Stage 4 — Academic Structure

Add:

```text
GradingScheme
GradeCategory
GradeThreshold
Assessment
WorkloadSignal
CourseWorkloadProfile
```

---

## Schema Stage 5 — Navigation

Add:

```text
AssessmentScore
UserAssessmentState
GradeAdjustment
ClassStatistic
GradeScenario
GradeScenarioEntry
```

Enough for:

```text
NAVIGATE
```

---

## Schema Stage 6 — Caching/Analysis

Only if needed:

```text
SemesterAnalysisSnapshot
PressureAnalysisSnapshot
```

---

# 139. Final Data Model Rule

The database exists to preserve:

> **the student's semester truth**

while Semora's engines continuously derive intelligence from that truth.

Do not let:

* AI drafts,
* cached scores,
* speculative estimates,
* or university-specific import formats

become indistinguishable from canonical domain data.
