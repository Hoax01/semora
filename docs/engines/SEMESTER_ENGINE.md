# Semora — Semester Engine Specification

**Status:** Design specification
**Version:** 0.1
**Related:** `PRODUCT.md`, `DECISIONS.md`
**Primary responsibility:** Analyze, validate, score, compare, and explain candidate semesters during the `PLAN` phase.

---

# 1. Purpose

The Semester Engine is the core decision system behind Semora's pre-semester experience.

Its job is to answer:

> **What does this particular combination of courses look like for this particular student?**

It must go beyond:

* timetable clash detection;
* credit counting;
* individual course difficulty ratings;
* generic recommendations.

The engine reasons about the **composition of an entire semester**.

It combines:

* course structures;
* course schedules;
* workload profiles;
* assessments where available;
* student preferences;
* recurring commitments;
* student-defined constraints;
* uncertainty in available data.

The output must be:

* deterministic where possible;
* explainable;
* multidimensional;
* personalized;
* editable;
* resistant to false precision.

---

# 2. Non-Responsibilities

The Semester Engine does **not**:

* calculate live semester pressure after the semester begins;
* calculate grades;
* parse course outlines;
* predict exact final grades;
* determine graduation requirements;
* automatically register courses;
* decide which professor is objectively "best";
* scrape course reviews;
* act as an AI chatbot.

Those responsibilities belong elsewhere.

Relevant engines:

* `WORKLOAD_ENGINE.md`
* `GRADE_ENGINE.md`
* `AI_EXTRACTION.md`

---

# 3. Core Principle

A semester cannot be modeled as:

```text
Semester Difficulty =
Course A Difficulty
+ Course B Difficulty
+ Course C Difficulty
+ ...
```

because combinations matter.

Three project-heavy courses may interact badly even if none is individually extreme.

Five courses with moderate weekly quizzes may create more continuous pressure than two harder but exam-heavy courses.

A technically valid timetable may create:

* large idle gaps;
* excessively long campus days;
* fragmented study time;
* conflicts with recurring commitments.

Therefore the engine operates on two levels:

```text
COURSE-LEVEL PROFILES
        +
SEMESTER-LEVEL INTERACTIONS
        ↓
CANDIDATE SEMESTER PROFILE
```

---

# 4. Terminology

## Course

The abstract academic course.

Example:

```text
CS 300 — Advanced Programming
```

---

## Course Offering

A specific offering of a course.

Example:

```text
CS 300
Fall 2026
Section 1
Professor X
```

Course workload information belongs primarily to the **offering**, because:

* grading structure may change;
* assignments may change;
* instructor may change;
* project requirements may change;
* schedule may change.

---

## Candidate Semester

A proposed collection of course offerings being evaluated by the user.

---

## Hard Constraint

A rule whose violation makes a candidate invalid.

Example:

```text
Two selected sections overlap.
```

---

## Soft Constraint

A preference whose violation makes a semester less desirable but still valid.

Example:

```text
User prefers no classes before 10 AM.
```

---

## Course Workload Profile

A multidimensional representation of how a course is expected to behave academically.

---

## Semester Profile

The combined representation of all courses and commitments within a candidate semester.

---

# 5. Required Inputs

The Semester Engine consumes five categories of information.

---

# 5.1 Course Information

At minimum:

```text
course_id
offering_id
course_code
course_title
credit_hours
section
meeting_times[]
```

Optional but useful:

```text
department
course_level
description
instructor
capacity
```

---

# 5.2 Course Workload Profile

A workload profile contains dimensions normalized to a common internal range.

Recommended range:

```text
0.0 → 10.0
```

Initial dimensions:

```text
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
```

Additional fields:

```text
estimated_weekly_hours
confidence
source
```

Not all fields must always be known.

---

# 5.3 Student Preferences

Example:

```text
prefer_lower_workload
prefer_compact_schedule
prefer_free_day
avoid_early_classes
avoid_late_classes
prefer_projects
prefer_exams
prefer_continuous_assessment
career_relevance_priority
interest_priority
grade_safety_priority
```

Preferences should internally become numerical weights.

---

# 5.4 Student Commitments

Examples:

```text
TAship
Society
Gym
Research
Part-time work
Commute
```

Each commitment may include:

```text
name
category
weekly_hours
recurring_time_blocks[]
high_intensity_dates[]
flexibility
priority
```

---

# 5.5 User Constraints

Example:

```text
minimum_credits
maximum_credits

maximum_hard_courses

must_include_courses[]
must_exclude_courses[]

required_free_days[]

earliest_class_time
latest_class_time
```

Some are hard constraints.

Others are soft depending on the user's configuration.

---

# 6. Data Confidence

Every non-official workload estimate must expose confidence.

Recommended representation:

```text
confidence ∈ [0, 1]
```

Suggested interpretation:

```text
0.90–1.00   Very high
0.75–0.89   High
0.50–0.74   Moderate
0.25–0.49   Low
0.00–0.24   Very low
```

Examples:

Official class time:

```text
confidence = 1.0
```

Verified current outline:

```text
confidence ≈ 0.95–1.0
```

User self-report:

```text
confidence ≈ 0.8
```

Structural estimate from course description:

```text
confidence ≈ 0.4–0.6
```

Community estimate based on many users:

```text
confidence depends on sample size and variance
```

---

# 7. Missing Data

Missing values must remain missing.

Do not silently replace unknown fields with arbitrary neutral scores.

Bad:

```text
project_intensity unknown
→ project_intensity = 5
```

Better:

```text
project_intensity = null
confidence = 0
```

The scoring engine may use fallback logic internally, but uncertainty must affect the final confidence of the result.

---

# 8. Course Workload Profile Construction

Before a verified outline exists, course profiles may come from:

1. user estimates;
2. preliminary course metadata;
3. historical Semora data;
4. generic structural inference.

After a verified outline exists, offering-specific structural data should override weak preliminary assumptions.

---

# 9. Structural Workload Signals

Examples of signals that may influence course dimensions:

## Continuous Workload

Increase when course contains:

* weekly assignments;
* weekly quizzes;
* labs;
* frequent graded exercises;
* participation requirements.

---

## Project Intensity

Increase when:

* major project weight is high;
* project spans multiple weeks;
* multiple project milestones exist;
* group project complexity is significant.

---

## Exam Intensity

Increase when:

* midterm/final weights dominate;
* multiple major examinations exist;
* course has few opportunities to recover from poor exams.

---

## Assessment Fragmentation

Increase when:

* many small graded assessments exist;
* deadlines occur frequently;
* multiple assessment categories operate simultaneously.

---

## Schedule Burden

Increase with:

* large number of class meetings;
* long class duration;
* labs;
* inconvenient timing;
* isolated meetings creating extra campus presence.

---

# 10. Hard Constraint Validation

Hard validation occurs before meaningful ranking.

A candidate must first be classified as:

```text
VALID
```

or:

```text
INVALID
```

An invalid semester may still be displayed for comparison, but must not receive normal recommendation status.

---

# 11. Timetable Clash Detection

Two meetings clash if their time intervals overlap on the same day.

For intervals:

```text
A = [startA, endA)
B = [startB, endB)
```

A clash exists when:

```text
startA < endB
AND
startB < endA
```

Back-to-back classes are not clashes.

Example:

```text
12:30–13:45
13:45–15:00
```

Valid.

---

# 12. Commitment Clash Detection

Commitments may be marked:

```text
HARD
SOFT
FLEXIBLE
```

Examples:

A mandatory TA session may be:

```text
HARD
```

Gym may be:

```text
FLEXIBLE
```

A course overlapping a hard commitment invalidates the semester.

A course overlapping a soft commitment generates a penalty.

---

# 13. Credit Constraints

Calculate:

```text
total_credits = Σ course.credit_hours
```

Compare against user-defined or university-configured thresholds.

Example:

```text
minimum = 12
maximum = 20
```

The engine must not invent university credit policies if none are configured.

---

# 14. Must-Include and Must-Exclude Courses

Candidates must respect explicit course constraints.

Examples:

```text
must_include:
- Operating Systems
- Databases
```

```text
must_exclude:
- Course X
```

These constraints are deterministic.

---

# 15. Semester-Level Metrics

Every valid candidate receives a multidimensional profile.

Recommended initial metrics:

```text
academic_intensity
continuous_load
project_load
exam_load
assessment_fragmentation
schedule_quality
schedule_compactness
commitment_compatibility
lifestyle_fit
interest_fit
career_fit
grade_risk
overall_balance
uncertainty
```

Not every metric must be visible everywhere in the UI.

---

# 16. Academic Intensity

Academic Intensity estimates the overall workload severity of the chosen course combination.

A simple initial formulation may use weighted course intensity.

Example:

```text
course_load_i =
overall_intensity_i × credit_factor_i
```

Then:

```text
base_academic_load =
weighted_mean(course_load_i)
```

However, the final semester intensity must include interaction penalties.

---

# 17. Credit Weighting

Credit hours may influence expected workload but must not dominate it.

Recommended:

```text
credit_factor =
credit_hours / reference_credit_hours
```

For a typical 3-credit course:

```text
reference_credit_hours = 3
```

Possible stabilization:

```text
credit_factor =
sqrt(credit_hours / 3)
```

This prevents a 4-credit course from mechanically being treated as exactly 33% harder.

Final formula should be empirically tuned.

---

# 18. Interaction Penalties

This is one of the most important parts of the engine.

Certain combinations create nonlinear workload.

Examples:

### Project Concentration

```text
3 project-heavy courses
```

should be worse than merely summing their project scores.

### Continuous Assessment Concentration

```text
4 courses with weekly quizzes
```

creates constant context switching.

### Exam Concentration

```text
4 exam-heavy courses
```

may produce large midterm/final pressure spikes.

---

# 19. Generic Interaction Function

For dimension `d`:

```text
interaction_penalty_d =
f(number_of_courses_above_threshold_d)
```

Example threshold:

```text
project_intensity >= 7
```

Possible initial function:

```text
0 courses → 0
1 course  → 0
2 courses → 0.5
3 courses → 1.5
4 courses → 3.0
5 courses → 5.0
```

This table should be configurable rather than hardcoded across the codebase.

---

# 20. Project Concentration Metric

Example:

```text
project_heavy_count =
count(course.project_intensity >= 7)
```

Possible semester penalty:

```text
project_interaction_penalty =
max(0, project_heavy_count - 1)^1.5
```

This is an initial modelling hypothesis.

It must remain tuneable.

---

# 21. Continuous Assessment Concentration

Courses containing:

* weekly quizzes;
* frequent assignments;
* recurring labs;
* continuous participation;

contribute to continuous assessment pressure.

Possible metric:

```text
continuous_load =
mean(course.continuous_workload)
+ interaction_penalty
```

This should help distinguish:

```text
Semester A:
few large assessments
```

from:

```text
Semester B:
constant small assessments
```

even when total nominal grade weight is similar.

---

# 22. Exam Concentration

Exam load should consider:

```text
exam_intensity
number_of_exam_heavy_courses
known_exam_dates
```

Before dates are known, the engine estimates concentration structurally.

After exact dates become known, detailed temporal pressure belongs primarily to the Workload Engine.

---

# 23. Schedule Analysis

A schedule can be clash-free while still being terrible.

Semora should therefore calculate schedule characteristics.

---

# 24. Daily Class Duration

For each weekday:

```text
total_class_minutes
```

Useful for identifying overloaded days.

Example:

```text
Wednesday:
375 minutes
```

---

# 25. Campus Span

For each day:

```text
campus_span =
last_class_end - first_class_start
```

Example:

```text
first class = 08:00
last class ends = 17:15

campus_span = 9h 15m
```

This is different from actual class time.

---

# 26. Idle Gap Time

For consecutive class blocks:

```text
gap =
next.start - previous.end
```

Total:

```text
daily_idle_gap =
Σ gaps
```

Large idle gaps reduce schedule compactness.

However, short useful gaps should not be heavily punished.

Possible thresholds:

```text
0–20 min      ignore
20–60 min     mild
60–120 min    moderate
120+ min      strong
```

These thresholds should remain configurable.

---

# 27. Schedule Fragmentation

A possible daily fragmentation measure:

```text
fragmentation =
number_of_separate_class_blocks
+ weighted_idle_gap_penalty
```

Semester fragmentation:

```text
mean(daily_fragmentation)
```

---

# 28. Free Days

Calculate days with:

```text
0 scheduled academic sessions
```

User may value free days heavily.

Example preference:

```text
prefer_free_day = high
```

A candidate with Friday free may therefore outrank an academically similar candidate without any free day.

---

# 29. Early and Late Class Penalties

These depend on user preferences.

Example:

```text
earliest_preferred_time = 10:00
```

A class at:

```text
08:00
```

incurs a penalty proportional to:

* how early it is;
* number of such days;
* user's aversion weight.

Same principle for late classes.

---

# 30. Schedule Quality

Schedule Quality is a positive score.

Possible components:

```text
compactness
free_days
preferred_time_alignment
daily_balance
commitment_compatibility
```

Example conceptual formula:

```text
schedule_quality =
10
- gap_penalty
- early_penalty
- late_penalty
- overloaded_day_penalty
+ free_day_bonus
```

Clamp:

```text
0 ≤ schedule_quality ≤ 10
```

The actual formula belongs in code configuration and should remain tuneable.

---

# 31. Daily Overload

A user may prefer avoiding extremely dense days.

For each day:

```text
fixed_minutes =
class_minutes
+ hard_commitment_minutes
```

Penalty increases after configured thresholds.

Example:

```text
< 4 hours     none
4–6 hours     mild
6–8 hours     moderate
8+ hours      strong
```

Again, configurable.

---

# 32. Weekly Fixed Commitment Load

Calculate known fixed obligations.

```text
academic_contact_hours
+ TA contact hours
+ work
+ fixed society commitments
+ other mandatory blocks
```

This is not total workload.

It represents **time already structurally unavailable**.

---

# 33. Commitment Compatibility

Commitment Compatibility estimates whether the candidate semester fits existing non-course obligations.

Inputs:

* direct conflicts;
* heavily constrained days;
* total fixed hours;
* high-priority commitments;
* user flexibility.

Examples:

> Your TAship and this section overlap.

Hard failure.

> Monday contains 7.5 hours of fixed commitments.

Penalty.

> Your society event falls during a period expected to contain multiple assessments.

Later handled more deeply by the Workload Engine.

---

# 34. Interest Fit

Interest is primarily user-supplied.

A student may assign:

```text
interest_score ∈ [0, 10]
```

to candidate courses.

Semester Interest Fit:

```text
weighted_mean(course_interest_scores)
```

Unknown interest should not automatically become neutral without indicating uncertainty.

---

# 35. Career Fit

Career relevance may initially be explicitly rated by the user.

Example:

```text
Distributed Systems → 9
Psychology → 3
Blockchain → 6
```

AI may later help interpret career goals, but V1 should avoid pretending that career value is objectively measurable.

---

# 36. Grade Risk

Grade Risk is **not predicted grade**.

It is structural risk.

Possible factors:

* high exam concentration;
* very few graded components;
* relative grading;
* high assessment variance;
* user-specific dislike of assessment style;
* unusually high workload combination.

Example:

A course with:

```text
Midterm 30%
Final 50%
Assignments 20%
```

may carry greater grade volatility than one with distributed assessment.

This does not mean it is inherently harder.

---

# 37. Assessment Style Compatibility

Users may indicate preferences such as:

```text
project_preference = 8/10
exam_preference = 4/10
continuous_assessment_preference = 6/10
```

Course profile:

```text
project_intensity = 9
exam_intensity = 3
continuous_workload = 7
```

Compatibility can be calculated using similarity or distance.

Example:

```text
style_distance =
Σ |user_preference_d - course_profile_d|
```

Normalize to a 0–10 fit score.

---

# 38. Semester Balance

Balance is distinct from low workload.

A difficult semester may still be well balanced.

Example:

```text
2 project-heavy courses
2 exam-heavy courses
1 reading-heavy course
```

may be more balanced than:

```text
5 project-heavy courses
```

even if estimated workload is similar.

---

# 39. Balance Metric

One possible approach:

calculate distribution across workload dimensions.

Example vector:

```text
[
continuous_load,
project_load,
exam_load,
reading_load,
lab_load
]
```

High concentration in one dimension may reduce balance.

Possible measure:

```text
variance(normalized_dimension_loads)
```

Higher variance:

```text
more concentrated semester
```

Lower variance:

```text
more balanced semester
```

However, low variance is not inherently better if every dimension is high.

Therefore balance must remain separate from intensity.

---

# 40. Personalization Weights

Each student gets preference weights.

Example:

```text
weights = {
  academic_intensity: 0.20,
  schedule_quality: 0.20,
  commitment_compatibility: 0.20,
  career_fit: 0.15,
  interest_fit: 0.15,
  grade_risk: 0.10
}
```

Weights should sum to:

```text
1.0
```

The exact onboarding UX does not need to expose raw decimals.

---

# 41. Preference Onboarding

Do not ask users to manually configure 15 sliders unless necessary.

Prefer human questions.

Examples:

> How important is keeping your workload manageable?

```text
Not important
Somewhat important
Very important
Critical
```

> Which sounds better?

```text
Fewer large exams
vs
Frequent smaller assessments
```

> How important are free weekdays?

> How much do you care about career relevance compared with workload?

Responses are converted internally into weights.

---

# 42. Scoring Philosophy

Semora should **not** rely on one giant weighted sum alone.

A single scalar score destroys useful trade-offs.

Preferred output:

```text
Candidate Semester Profile
```

with multiple dimensions.

A hidden composite score may assist ordering, but should not be treated as absolute truth.

---

# 43. Composite Utility Score

For internal ranking, a candidate utility score may be useful.

Conceptually:

```text
utility =
Σ preference_weight_i × normalized_fit_i
- interaction_penalties
- invalidity_penalties
```

Where:

```text
normalized_fit_i ∈ [0, 1]
```

However:

* invalid candidates should not merely receive a lower score;
* uncertainty should affect confidence;
* composite utility should not be presented as objective quality.

---

# 44. Why Not Just Ask an LLM?

Because ranking must be:

* reproducible;
* inspectable;
* fast;
* testable;
* consistent.

The LLM may explain the result.

It should not invent the result.

Pipeline:

```text
Structured Data
      ↓
Deterministic Semester Engine
      ↓
Metrics + Findings
      ↓
Optional LLM Explanation
```

Not:

```text
Course list
      ↓
"GPT, which semester is better?"
```

---

# 45. Candidate Comparison

When comparing two candidates, Semora should compute metric differences.

Example:

```text
Option A project_load = 8.7
Option B project_load = 5.3

difference = +3.4
```

Only meaningful differences should be highlighted.

---

# 46. Significance Threshold

Small numerical differences should not be over-explained.

Example:

```text
7.2 vs 7.3
```

should generally be treated as equivalent.

Possible threshold:

```text
abs(delta) < 0.5
→ negligible difference
```

This threshold should vary by metric if necessary.

---

# 47. Comparison Explanation

Good output:

> Option A has substantially higher project concentration because three selected courses contain major projects, compared with one in Option B.

> Option B has a less compact timetable because Tuesday contains a 2h 45m gap.

> Both options have similar overall academic intensity.

Bad output:

> Option B is 6.4% better.

False precision must be avoided.

---

# 48. Recommendation Labels

Rather than:

```text
BEST SEMESTER
```

use context-sensitive labels.

Possible examples:

```text
Most Balanced
Lowest Workload
Best Schedule
Best Career Fit
Lowest Project Load
Best Match for Your Preferences
```

A candidate may receive more than one label.

---

# 49. Pareto-Optimal Candidates

Eventually, candidate selection may use Pareto analysis.

Candidate A dominates Candidate B if A is:

* no worse in every relevant dimension;
* strictly better in at least one.

Dominated candidates can be deprioritized.

Example:

```text
Option B:
lower workload
better schedule
same career fit
same interest
```

Option A may be dominated.

---

# 50. Why Pareto Analysis Matters

Students often face genuine trade-offs.

There may be no single best semester.

Example:

### Candidate A

Better career value.

### Candidate B

Lower workload.

### Candidate C

Better schedule.

All three may be rational choices.

Semora should preserve those alternatives.

---

# 51. Candidate Generation

V1 may primarily let users manually create candidate semesters.

Automatic generation is optional.

Future engine:

```text
Available Courses
+
Must-Takes
+
Constraints
+
Preferences
        ↓
Generate valid combinations
        ↓
Remove dominated options
        ↓
Return representative candidates
```

This can become computationally expensive when candidate sets are large.

It is not required for V1.

---

# 52. Automatic Candidate Generation — Future Approach

If implemented later:

1. generate combinations;
2. apply hard constraints early;
3. prune impossible schedules;
4. evaluate soft metrics;
5. perform Pareto filtering;
6. rank using personalization;
7. return diverse options.

Do not brute-force unnecessarily when constraints can prune the search space.

---

# 53. Course Difficulty Is Not Objective Truth

Avoid storing:

```text
difficulty = 8.37
```

as though scientifically established.

Instead, distinguish sources:

```text
structural_difficulty_estimate
user_difficulty_estimate
community_difficulty_estimate
```

When combined:

```text
effective_difficulty
confidence
```

---

# 54. Structural Difficulty

Structural difficulty may eventually use features such as:

* course level;
* prerequisite depth;
* assessment structure;
* lab requirements;
* project complexity;
* historical workload.

This must remain explainable.

Do not create arbitrary ML predictions without adequate training data.

---

# 55. User Overrides

Any estimated profile dimension should be editable.

Example:

Semora estimates:

```text
project_intensity = 6
```

Student knows:

> this course has a nightmare semester project.

They set:

```text
project_intensity = 9
```

The engine immediately recalculates candidate semesters.

User knowledge should beat weak model assumptions.

---

# 56. Scenario Analysis

Users should be able to perform what-if changes.

Example:

> Replace Distributed Systems with Blockchain.

Recalculate:

* credits;
* clashes;
* workload;
* project concentration;
* exam concentration;
* schedule;
* personal fit.

This interaction should be fast enough to feel exploratory.

---

# 57. Course-Level Explanation

Each course should expose why Semora believes it contributes certain load.

Example:

### AI4SE

**Project Load: High**

Because:

* 35% semester project;
* 3 project milestones;
* final presentation.

**Continuous Load: Medium**

Because:

* recurring assignments;
* no weekly quizzes.

This becomes stronger once a verified outline exists.

---

# 58. Semester-Level Explanation

Example:

### Why Project Load is High

```text
AI4SE           9.0
Distributed     8.0
Databases       7.2
OS              4.0
Psychology      2.0
```

Three courses exceed the project-heavy threshold.

Interaction penalty:

```text
+1.5
```

Final:

```text
Project Load = 8.6 / 10
```

The UI need not expose the full formula by default, but should make reasoning inspectable.

---

# 59. Finding Generation

The engine should produce structured findings.

Example:

```json
{
  "type": "PROJECT_CONCENTRATION",
  "severity": "HIGH",
  "courses": ["AI4SE", "Distributed Systems", "Databases"],
  "message_key": "three_project_heavy_courses"
}
```

Another:

```json
{
  "type": "LONG_CAMPUS_DAY",
  "severity": "MEDIUM",
  "day": "Wednesday",
  "campus_span_minutes": 525
}
```

The LLM may turn these into polished natural-language explanations.

---

# 60. Finding Severity

Suggested:

```text
INFO
LOW
MEDIUM
HIGH
CRITICAL
```

`CRITICAL` should be rare.

Examples:

Hard timetable clash:

```text
CRITICAL
```

Three project-heavy courses:

```text
HIGH
```

One 90-minute gap:

```text
LOW / MEDIUM
```

---

# 61. Result Confidence

Every semester analysis should include an overall confidence indicator.

Conceptually:

```text
analysis_confidence =
weighted_average(input_confidences)
```

Adjusted downward for important missing dimensions.

Example:

### High Confidence

All current outlines available.

### Moderate Confidence

Timings known, workload estimates partially inferred.

### Low Confidence

Several course workload profiles missing.

---

# 62. Confidence Must Affect Language

High confidence:

> This semester contains three project-heavy courses.

Low confidence:

> This semester may have elevated project load, but workload information for two courses is incomplete.

Do not present both identically.

---

# 63. Preliminary vs Verified Analysis

Candidate semesters may be analyzed at different stages.

## Preliminary

Inputs:

* memo;
* timings;
* user estimates.

Label:

```text
PRELIMINARY
```

## Verified

Inputs include:

* current course outlines;
* confirmed assessment structures.

Label:

```text
VERIFIED
```

This distinction should be visible.

---

# 64. Semester Analysis Output Contract

Recommended engine output:

```text
CandidateSemesterAnalysis
```

containing:

```text
candidate_id
validity
hard_constraint_violations[]

metrics {
    academic_intensity
    continuous_load
    project_load
    exam_load
    fragmentation
    schedule_quality
    commitment_compatibility
    interest_fit
    career_fit
    grade_risk
    overall_balance
}

findings[]

confidence

data_completeness

recommendation_tags[]
```

---

# 65. Data Completeness

Separate confidence from completeness.

Example:

```text
data_completeness = 72%
```

could mean:

* timings: complete;
* credits: complete;
* grading structures: 3/5 known;
* workload profiles: 4/5 known.

Confidence:

```text
0.78
```

reflects trust in known data.

These are different concepts.

---

# 66. Data Completeness Explanation

Example UI:

> **Analysis completeness: 72%**

Missing:

* current outline for Blockchain;
* project structure for Psychology.

This tells users how to improve recommendations.

---

# 67. No Fake Precision Rule

Internal calculations may use decimals.

User-facing presentation should generally avoid:

```text
7.34827 / 10
```

Prefer:

```text
7.3 / 10
```

or descriptive categories:

```text
High
Moderate
Low
```

Depending on context.

---

# 68. Score Bands

Possible initial UI bands:

```text
0.0–2.4   Very Low
2.5–4.4   Low
4.5–6.4   Moderate
6.5–8.4   High
8.5–10    Very High
```

These boundaries are provisional.

Do not scatter them throughout frontend/backend code.

Store centrally.

---

# 69. Engine Configuration

Scoring constants should live in configuration.

Examples:

```text
PROJECT_HEAVY_THRESHOLD
EXAM_HEAVY_THRESHOLD
GAP_THRESHOLDS
EARLY_CLASS_THRESHOLD
LONG_DAY_THRESHOLD
INTERACTION_COEFFICIENTS
SCORE_BANDS
```

This allows tuning without rewriting business logic.

---

# 70. Versioning

Semester scoring logic should have a version identifier.

Example:

```text
semester_engine_version = "0.1"
```

Why:

If scoring changes later, stored historical analyses should be attributable to the version that produced them.

---

# 71. Recalculation

Candidate analysis should recalculate whenever relevant data changes.

Examples:

* course added;
* course removed;
* section changed;
* preference changed;
* commitment changed;
* workload estimate edited;
* outline verified.

Avoid stale scores.

---

# 72. Caching

Analysis may be cached using an input fingerprint.

Conceptually:

```text
hash(
  candidate courses
  course profiles
  user preferences
  commitments
  engine version
)
```

Same inputs:

reuse result.

Changed inputs:

recompute.

Optimization is secondary to correctness in V1.

---

# 73. Example Candidate Comparison

Student commitments:

```text
TAship: 5 h/week
Society: 4 h/week
Gym: 6 h/week
```

Preference:

```text
Workload       Very important
Career fit     Important
Free Friday    Very important
Projects       Prefer moderate
Exams          Neutral
```

---

## Candidate A

```text
OS
Databases
AI4SE
Distributed Systems
Psychology
```

Output:

```text
Academic Intensity       8.2 HIGH
Project Load             8.8 VERY HIGH
Exam Load                6.4 MODERATE
Schedule Quality         8.1 HIGH
Commitment Compatibility 5.9 MODERATE
Career Fit               9.1 VERY HIGH
Balance                  5.6 MODERATE
```

Findings:

> Three courses appear project-heavy.

> Monday and Wednesday are heavily constrained when TAship is included.

> Friday remains free.

> This candidate strongly matches the student's technical career priorities.

---

## Candidate B

```text
OS
Databases
AI4SE
Blockchain
Psychology
```

Output:

```text
Academic Intensity       6.9 HIGH
Project Load             6.1 MODERATE
Exam Load                7.1 HIGH
Schedule Quality         7.4 HIGH
Commitment Compatibility 7.7 HIGH
Career Fit               8.0 HIGH
Balance                  7.8 HIGH
```

Findings:

> Lower project concentration than Candidate A.

> Slightly higher exam dependence.

> Better compatibility with recurring commitments.

> Career relevance remains strong but lower than Candidate A.

---

# 74. Example Recommendation

Bad:

> Candidate B is best.

Good:

> **Candidate B is the strongest match for your stated priorities.**

Reasons:

1. significantly lower project concentration;
2. better compatibility with your TAship;
3. still strong career relevance;
4. workload is more evenly distributed across assessment styles.

Trade-off:

> Candidate A provides stronger systems specialization and keeps Friday free.

---

# 75. Test Philosophy

The Semester Engine should be heavily unit tested because most logic is deterministic.

Tests should not depend on LLM output.

---

# 76. Required Hard-Constraint Tests

At minimum:

* overlapping classes detected;
* back-to-back classes allowed;
* different-day classes do not clash;
* hard commitment conflict detected;
* flexible commitment does not invalidate;
* credit total correct;
* must-include enforced;
* must-exclude enforced.

---

# 77. Schedule Tests

At minimum:

* campus span calculation;
* idle gap calculation;
* free-day detection;
* early-class penalties;
* late-class penalties;
* long-day detection;
* commitment blocks included correctly.

---

# 78. Workload Composition Tests

At minimum:

* one project-heavy course produces no concentration penalty;
* three project-heavy courses produce higher penalty than two;
* continuous assessment interactions work;
* exam concentration works;
* high intensity does not imply poor balance;
* low balance does not automatically imply high intensity.

---

# 79. Preference Tests

At minimum:

Same candidate set.

User A:

```text
prioritizes low workload
```

User B:

```text
prioritizes career relevance
```

Ranking should be allowed to differ.

This is expected behaviour.

---

# 80. Missing-Data Tests

At minimum:

* missing project score does not silently become 5;
* missing dimensions reduce completeness;
* low-confidence estimates reduce analysis confidence;
* explanations acknowledge uncertainty;
* verified outline increases confidence.

---

# 81. Comparison Tests

At minimum:

* negligible differences are not exaggerated;
* major differences generate findings;
* dominated candidate detection works if enabled;
* recommendation tags are reproducible.

---

# 82. Edge Cases

The engine must eventually handle:

* 1-credit labs;
* 4-credit courses;
* courses meeting once weekly;
* weekend courses;
* evening classes;
* cross-midnight times if ever supported;
* courses with no examinations;
* courses with only a final;
* courses with no known workload information;
* pass/fail courses;
* zero-credit requirements;
* duplicate course selections;
* alternative sections of same course.

---

# 83. Duplicate Course Rule

A candidate should not normally include two offerings of the same course.

Exception mechanisms may exist later for special academic structures.

Default:

```text
one active offering per course
```

---

# 84. Section Switching

Switching sections may alter:

* meeting times;
* instructor;
* capacity;
* workload profile if instructor-specific information exists.

The candidate should recalculate immediately.

---

# 85. User Trust Principle

The engine should expose enough structure that users can say:

> "Semora thinks this semester is project-heavy because these three courses contain major projects."

rather than:

> "Semora's AI gave it a 72."

The first builds trust.

The second does not.

---

# 86. V1 Implementation Priority

Build in this order:

### Level 1 — Deterministic Foundation

* candidate semester representation;
* credits;
* timetable clashes;
* commitment clashes;
* schedule analysis.

### Level 2 — Course Profiles

* manual workload dimensions;
* preliminary structural profiles.

### Level 3 — Semester Composition

* multidimensional scores;
* interaction penalties;
* explainable findings.

### Level 4 — Personalization

* preference weights;
* candidate comparison;
* personalized recommendation tags.

### Level 5 — Outline-Enriched Analysis

Once `AI_EXTRACTION` is available:

* replace weak estimates;
* improve confidence;
* refine workload profiles.

---

# 87. V1 Must Not Depend on Perfect Scoring

The first useful version does not require scientifically optimal weights.

It requires:

* sensible assumptions;
* centralized configuration;
* explainability;
* easy tuning;
* real-user evaluation.

A transparent 80%-good heuristic is preferable to an opaque pseudo-intelligent model.

---

# 88. Tuning Strategy

During Fall 2026 dogfooding:

record cases where the engine feels wrong.

Example:

> Semester scored project load too low.

Investigate why.

Possible change:

```text
project threshold
interaction coefficient
course estimate
```

Record important scoring changes in `DECISIONS.md`.

---

# 89. Future Personal Workload Learning

Not V1.

Eventually Semora may compare:

```text
predicted workload
vs
user-reported actual workload
```

and learn user-specific correction factors.

Example:

Community estimate:

```text
projects = 6/10
```

Student historically experiences project-heavy courses:

```text
+1.3 difficulty relative to baseline
```

Personalized estimate:

```text
7.3/10
```

This belongs in future personalization work.

---

# 90. Future Community Intelligence

Not V1.

Future course profile may combine:

```text
official structure
+
current outline
+
historical offerings
+
community workload
+
personal history
```

Each source must remain separately identifiable.

---

# 91. Future Optimization

Potential future feature:

> Generate semester options automatically.

Possible objectives:

```text
minimize workload
maximize career relevance
maximize schedule quality
maximize interest
minimize project concentration
```

Return several Pareto-efficient schedules rather than one allegedly perfect answer.

---

# 92. Success Condition

The Semester Engine succeeds when a user looking at two valid semesters says:

> **"This explains the trade-off I was trying to reason about in my head."**

It fails if the experience reduces to:

> "Option A: 73. Option B: 76."

The engine exists to make semester-level trade-offs visible, explainable, and personal.

---

# 93. Core Engine Invariant

The following principle is mandatory:

> **A semester recommendation must be traceable back to structured course information, student preferences, commitments, and explicit scoring rules.**

No recommendation should exist purely because an LLM said so.

---

# 94. Final Product Rule

The Semester Engine should optimize for:

> **decision quality**

not:

> **algorithmic complexity**

If a simpler model produces clearer, more trustworthy decisions, use the simpler model.
