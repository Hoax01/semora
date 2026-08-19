# Semora — Workload & Pressure Engine Specification

**Status:** Design specification
**Version:** 0.1
**Related:** `PRODUCT.md`, `DECISIONS.md`, `SEMESTER_ENGINE.md`
**Primary responsibility:** Convert assessments, estimated effort, deadlines, course characteristics, and non-academic commitments into an explainable model of current and upcoming semester pressure.

---

# 1. Purpose

The Workload Engine powers Semora's primary in-semester intelligence.

Its core question is:

> **How demanding is this period of my semester, why is it demanding, and what is coming next?**

Normal planners typically answer:

> "What is due?"

Semora must additionally answer:

* Which upcoming periods are genuinely difficult?
* What is creating the pressure?
* Is the pressure caused by one major assessment or many small ones?
* How much preparation is likely required?
* Are multiple courses competing for the same limited time?
* Are extracurricular commitments making an otherwise manageable week difficult?
* Is a difficult period approaching early enough to act on it?
* Has workload increased or decreased compared with surrounding weeks?
* Which upcoming task deserves attention first?

The Workload Engine does **not** attempt to create a perfect scientific representation of human stress.

It creates a useful, transparent approximation of **academic workload pressure**.

---

# 2. Core Product Principle

A deadline is not workload.

This:

```text
Quiz — 2%
```

and this:

```text
Final Exam — 35%
```

must not contribute equally merely because both occur on Friday.

Likewise, grade weight alone is not workload.

A 5% programming assignment may require:

```text
10 hours
```

while a 10% short quiz may require:

```text
1 hour
```

Therefore Semora models several concepts separately:

```text
IMPORTANCE
EFFORT
URGENCY
CONCURRENCY
FIXED COMMITMENTS
```

These interact to create pressure.

---

# 3. Non-Responsibilities

The Workload Engine does not:

* calculate final course grades;
* decide course registration;
* parse documents;
* estimate professor quality;
* act as a general task manager;
* automatically create detailed study schedules;
* claim to measure psychological stress;
* predict exact hours with unjustified precision.

Related responsibilities:

* Course selection → `SEMESTER_ENGINE.md`
* Grade calculations → `GRADE_ENGINE.md`
* Outline extraction → `AI_EXTRACTION.md`

---

# 4. Core Terminology

## Assessment

A graded academic obligation.

Examples:

* assignment;
* quiz;
* project milestone;
* presentation;
* midterm;
* final;
* lab;
* report;
* participation submission.

---

## Commitment

A non-assessment demand on the student's time.

Examples:

* TAship;
* society event;
* internship;
* research;
* gym;
* interview;
* personal obligation.

---

## Effort Estimate

Estimated amount of focused work required.

Example:

```text
6 hours
```

This may be:

* user supplied;
* inferred from assessment type;
* derived from historical personal data;
* derived from community data in future.

---

## Pressure

A normalized estimate of workload intensity during a time interval.

Pressure is **not stress**.

---

## Pressure Window

A unit of time over which pressure is summarized.

Initial windows:

```text
day
week
```

Future possibilities:

```text
48 hours
rolling 7 days
month
```

---

# 5. Required Inputs

The engine consumes:

## Assessments

```text
assessment_id
course_id
title
type
due_at
weight
estimated_effort_hours
completion_status
score_status
confidence
```

Optional:

```text
start_at
recommended_start_at
difficulty_estimate
group_project
```

---

## Course Context

Useful fields:

```text
course_intensity
assessment_style
course_difficulty
```

These are supplementary.

They should not overpower assessment-specific data.

---

## Commitments

```text
commitment_id
name
category
start_at
end_at
estimated_effort_hours
flexibility
priority
```

Recurring commitments may be expanded into occurrences.

---

## Student Availability

Optional V1 input:

```text
typical_available_hours_per_day
```

Future versions may estimate available capacity more precisely.

V1 should avoid requiring detailed hourly planning.

---

# 6. Pressure Model Philosophy

The engine should conceptually separate:

```text
TASK PRESSURE
+
OVERLAP PRESSURE
+
COMMITMENT PRESSURE
+
TIME COMPRESSION
=
PERIOD PRESSURE
```

No single feature should dominate every situation.

---

# 7. Assessment Importance

Academic importance is influenced by grade weight.

Recommended normalized importance:

```text
importance = f(weight)
```

A linear mapping is possible but may exaggerate extremely large assessments.

Potential transformation:

```text
importance =
sqrt(weight_percentage / 100)
```

or a piecewise mapping.

Example conceptual values:

```text
1–2%      Very Low
3–5%      Low
6–10%     Moderate
11–20%    High
20%+      Very High
```

These boundaries are provisional.

---

# 8. Why Weight Should Not Be Fully Linear

Consider:

```text
Assessment A = 5%
Assessment B = 40%
```

B is eight times larger by grade weight.

It should not necessarily create eight times the workload pressure.

Weight represents **consequence**, not effort.

The engine therefore keeps importance separate from effort.

---

# 9. Assessment Effort

Effort is one of the strongest workload signals.

Preferred internal representation:

```text
estimated_effort_hours
```

Example:

```text
Quiz       1.5h
Assignment 6h
Project    15h
Midterm    10h
```

These values are estimates.

---

# 10. Effort Sources

Effort may come from several sources.

Priority order:

1. explicit user override;
2. user's historical personal estimate;
3. assessment-specific known estimate;
4. course historical estimate;
5. generic assessment-type estimate.

Each source should retain provenance.

---

# 11. Generic Effort Defaults

V1 may require provisional defaults.

Example only:

```text
small_quiz             1.5 h
standard_quiz          2.5 h
small_assignment       3 h
standard_assignment    6 h
large_assignment       10 h
midterm                8 h
final                   12 h
project_milestone      8 h
presentation           5 h
```

These values must:

* live in configuration;
* be editable;
* never be presented as objective truth.

---

# 12. Assessment Type Is Not Enough

A course may contain:

```text
Assignment 1
```

that takes:

```text
2 hours
```

and:

```text
Assignment 4
```

that takes:

```text
14 hours
```

Therefore type defaults are fallbacks only.

Users should be able to revise effort estimates.

---

# 13. Effort Confidence

Each effort estimate should have:

```text
effort_confidence ∈ [0,1]
```

Example:

User says:

> I think this assignment will take about 8 hours.

```text
confidence = 0.8
```

Generic default:

```text
confidence = 0.4
```

Historical personal estimate from several similar assessments:

```text
confidence = 0.85
```

---

# 14. Urgency

Urgency increases as the deadline approaches.

Conceptually:

```text
time_remaining =
due_at - current_time
```

But urgency should not jump from:

```text
0
```

to:

```text
100
```

only on the deadline day.

---

# 15. Urgency Function

A smooth function is preferable.

Possible conceptual formulation:

```text
urgency =
1 / (1 + days_remaining / urgency_scale)
```

Alternative exponential model:

```text
urgency =
exp(-days_remaining / tau)
```

Exact implementation should be tuneable.

---

# 16. Preparation Horizon

Different tasks need different horizons.

Example:

```text
Quiz          2–4 days
Assignment    4–7 days
Midterm       7–14 days
Final         10–21 days
Project       14–30 days
```

Therefore urgency should consider:

```text
days_remaining
relative to
recommended_preparation_horizon
```

rather than only absolute days.

---

# 17. Preparation Ratio

Possible metric:

```text
preparation_ratio =
days_remaining / recommended_preparation_days
```

Interpretation:

```text
> 1.5       Plenty of time
1.0–1.5     Comfortable
0.6–1.0     Attention needed
0.3–0.6     High urgency
< 0.3       Critical urgency
```

This is conceptual.

---

# 18. Remaining Effort

Completed work should reduce pressure.

Possible user input:

```text
progress_percentage
```

Then:

```text
remaining_effort =
estimated_effort × (1 - progress)
```

However, detailed task-progress tracking is optional for V1.

Initial implementation may use:

```text
NOT_STARTED
IN_PROGRESS
DONE
```

with simple assumptions.

---

# 19. Completion Status

Suggested:

```text
NOT_STARTED
IN_PROGRESS
DONE
SKIPPED
```

Completed assessments should not contribute future pressure.

---

# 20. Task Pressure

Each assessment receives an internal task-pressure value.

Conceptually:

```text
task_pressure =
effort_component
× urgency_component
× importance_modifier
```

This should not be a raw multiplication without normalization.

A more practical formulation may be:

```text
task_pressure =
a × effort_score
+ b × urgency_score
+ c × importance_score
+ interaction_terms
```

Initial V1 should favor explainability over clever mathematics.

---

# 21. Suggested V1 Task Pressure Model

Normalize:

```text
effort_score     ∈ [0,10]
urgency_score    ∈ [0,10]
importance_score ∈ [0,10]
```

Then:

```text
task_pressure =
0.45 × effort_score
+ 0.35 × urgency_score
+ 0.20 × importance_score
```

Initial hypothesis only.

Why:

* effort strongly determines required time;
* urgency determines compression;
* grade weight matters but should not dominate.

---

# 22. Importance Modifier

Certain assessments may deserve additional attention because failure has unusually high consequences.

Examples:

* final exam;
* capstone milestone;
* pass/fail requirement.

Potential future modifier:

```text
criticality
```

Not required for V1.

---

# 23. Daily Pressure

Daily pressure should include tasks whose preparation windows overlap the day.

A midterm on Friday should create pressure before Friday.

Therefore:

```text
assessment pressure is distributed backward
across its preparation horizon
```

rather than appearing only on the due date.

---

# 24. Workload Distribution

Suppose:

```text
Midterm
Due Friday
Estimated effort = 10h
Preparation horizon = 7 days
```

Do not assign:

```text
Friday = 10h
```

Instead distribute expected work across preceding days.

A simple V1 distribution:

```text
equal distribution
```

More realistic future distributions may be front-loaded or deadline-weighted.

---

# 25. Default Effort Distribution

Possible initial rule:

For assessment with:

```text
remaining_effort = E
preparation_days = D
```

baseline daily demand:

```text
E / D
```

Then urgency may skew more effort toward nearer days if preparation has not begun.

---

# 26. Deadline Compression

If a student has:

```text
10 estimated hours
```

remaining but only:

```text
2 days
```

available, required pace becomes:

```text
5 h/day
```

This should create significantly more pressure than:

```text
10 hours across 10 days
```

This is one of the engine's most useful ideas.

---

# 27. Required Pace

Conceptually:

```text
required_daily_effort =
remaining_effort /
remaining_preparation_days
```

This is a stronger workload signal than deadline count.

---

# 28. Available Capacity

Future versions may use explicit free-time estimates.

V1 can optionally ask:

> Roughly how many hours of focused academic work can you realistically do outside class on a normal weekday?

Example:

```text
3 hours/day
```

and weekend:

```text
5 hours/day
```

This makes pressure more personalized.

But it must remain optional.

---

# 29. Capacity Ratio

If capacity is known:

```text
capacity_ratio =
required_work / available_capacity
```

Interpretation:

```text
< 0.5       Comfortable
0.5–0.8     Moderate
0.8–1.0     High
> 1.0       Over-capacity
```

This could become one of the strongest future pressure signals.

---

# 30. Non-Academic Commitments

Commitments consume time and attention.

Examples:

```text
TA grading
Society event
Interview
Internship shift
Research deadline
```

They should affect pressure even though they are not graded.

---

# 31. Commitment Types

Suggested:

```text
RECURRING_FIXED
ONE_OFF_FIXED
FLEXIBLE
HIGH_INTENSITY_EVENT
```

Examples:

TA class:

```text
RECURRING_FIXED
```

Society tournament:

```text
HIGH_INTENSITY_EVENT
```

Gym:

```text
FLEXIBLE
```

---

# 32. Commitment Effort

Commitments may have:

```text
scheduled_hours
```

and optionally:

```text
additional_effort_hours
```

Example:

```text
Society Event:
event duration = 5h
prep effort = 3h
```

---

# 33. Commitment Pressure

Commitments should not use grade importance.

Instead:

```text
commitment_pressure =
time_demand
× inflexibility
× urgency
```

A fixed mandatory commitment creates more pressure than an easily movable activity.

---

# 34. Flexibility

Suggested internal scale:

```text
0.0 = fully flexible
1.0 = immovable
```

Examples:

Gym:

```text
0.3
```

TA invigilation:

```text
1.0
```

Society meeting:

```text
0.7
```

---

# 35. Concurrency

Two independent tasks create more difficulty when their preparation periods overlap.

Example:

```text
OS Midterm
10h effort

DB Assignment
8h effort
```

both within the same 4-day period.

This is more difficult than the same tasks occurring two weeks apart.

---

# 36. Overlap Pressure

For a window:

```text
overlap_count =
number of active preparation demands
```

But simple count is not enough.

Weighted overlap should use:

```text
sum(active task pressure)
```

Potential nonlinear penalty:

```text
overlap_penalty =
max(0, active_major_items - 1)^p
```

where:

```text
p > 1
```

to capture context switching and concurrent deadlines.

---

# 37. Major Assessment Threshold

A "major" item may be defined by either:

```text
weight >= threshold
OR
effort >= threshold
```

Example:

```text
weight >= 10%
OR
effort >= 6h
```

This avoids ignoring low-weight but highly demanding assignments.

---

# 38. Course Diversity Penalty

Pressure may increase when simultaneous tasks come from several different courses.

Why:

```text
three assessments from one project
```

may involve related context.

Whereas:

```text
OS Midterm
Psych Essay
DB Assignment
AI4SE Presentation
```

requires more context switching.

Possible future metric:

```text
active_course_count
```

V1 may use a mild penalty.

---

# 39. Context Switching

Potential formulation:

```text
context_switch_penalty =
factor × max(0, active_course_count - 2)
```

Keep small.

The purpose is not to overengineer psychology.

---

# 40. Weekly Pressure

Weekly pressure should summarize:

```text
academic work demand
+
deadline compression
+
assessment overlap
+
commitment demand
```

Normalized to:

```text
0–10
```

---

# 41. Pressure Bands

Suggested user-facing bands:

```text
0.0–2.4   Light
2.5–4.4   Manageable
4.5–6.4   Moderate
6.5–8.4   High
8.5–10    Severe
```

These labels are provisional.

Use one terminology set consistently.

---

# 42. Severe Does Not Mean Impossible

A `9.0` period means:

> unusually high modeled workload pressure

not:

> guaranteed failure.

Language should remain calibrated.

---

# 43. Pressure Heatmap

The heatmap should show workload intensity over time.

Preferred default:

```text
week-by-week semester view
```

Example:

```text
Week 1     3.1
Week 2     4.8
Week 3     5.2
Week 4     7.7
Week 5     8.9
Week 6     6.2
```

The user should immediately see peaks.

---

# 44. Heatmap Detail

Selecting a period should reveal:

```text
Why this week is difficult
```

Example:

```text
OS Midterm              20%
Estimated preparation   9h

DB Assignment 2          8%
Estimated effort         7h

AI4SE Milestone         10%
Estimated effort         6h

TA Grading
Estimated effort         4h
```

Then:

> Three major academic demands overlap within five days.

---

# 45. Pressure Contribution

Each item should expose an approximate contribution to the period.

Example:

```text
OS Midterm           High contribution
DB Assignment        Medium-high
AI4SE Milestone      Medium
TA grading           Medium
```

Avoid fake percentages unless mathematically meaningful.

---

# 46. Current Week vs Future Weeks

The dashboard should distinguish:

```text
CURRENT PRESSURE
```

from:

```text
UPCOMING PRESSURE
```

A severe week three weeks away is useful because it provides time to react.

---

# 47. Forecast Horizon

Recommended default:

```text
4–6 weeks
```

Display may show the whole semester, but actionable analysis should prioritize the next month.

---

# 48. Pressure Trend

Useful derived metric:

```text
pressure_delta =
next_week_pressure - current_week_pressure
```

Example:

> Next week is substantially heavier than this week.

Thresholds:

```text
delta < 0.5       Similar
0.5–1.5           Noticeably higher
> 1.5             Significantly higher
```

Provisional.

---

# 49. Peak Detection

The engine should identify local workload peaks.

Possible rule:

A week is a peak if:

```text
pressure > previous_week
AND
pressure > next_week
AND
pressure >= HIGH_THRESHOLD
```

This helps surface:

> Your next major pressure peak begins September 21.

---

# 50. Semester Peak Summary

Possible dashboard component:

```text
Highest-pressure periods

1. Oct 12–18    9.1
2. Nov 23–29    8.7
3. Sep 21–27    8.0
```

Useful for planning extracurricular commitments.

---

# 51. Assessment Clusters

A cluster occurs when several meaningful assessments fall within a short window.

Example:

```text
4 assessments
within 5 days
```

Cluster severity depends on:

* number;
* combined effort;
* combined weight;
* number of courses;
* preparation overlap.

---

# 52. Cluster Detection

Possible V1 approach:

Sliding window:

```text
window = 7 days
```

For each window:

```text
count meaningful assessments
sum estimated effort
sum weight
count unique courses
```

Generate a cluster if configured thresholds are exceeded.

---

# 53. Cluster Example

```text
ASSESSMENT_CLUSTER

Sep 21–26

4 assessments
3 courses
26 estimated hours
43% combined course-assessment weight
```

Note:

The phrase:

> "43% of course-assessment weight"

must be carefully worded.

Weights from different courses are not directly additive as a fraction of the student's entire semester grade.

Prefer:

> "The period contains assessments worth 20%, 15%, 5%, and 3% within their respective courses."

unless a normalized cross-course weighting scheme exists.

---

# 54. Cross-Course Grade Weight

Avoid casually summing percentages across courses.

Bad:

> 43% of your semester grade is due next week.

This is mathematically misleading.

Better:

> Next week contains four assessments, including a 20% OS midterm and a 15% AI4SE milestone.

If Semora later computes credit-weighted semester impact, it must be formally defined.

---

# 55. Semester-Impact Score

Optional future metric:

```text
semester_grade_impact =
course_credit_weight
× assessment_weight
```

This could normalize assessment importance across courses.

Not required for V1.

---

# 56. Recommendations

Semora should provide lightweight actionable guidance.

Examples:

> Next week contains your largest workload peak this month.

> Your OS midterm and DB assignment preparation windows overlap heavily.

> Consider starting DB Assignment 3 earlier than usual because it overlaps with your society event.

> Friday contains three deadlines across separate courses.

These are observations and suggestions.

---

# 57. What Semora Must NOT Do

Do not say:

> Study OS for exactly 2h 17m tonight.

unless the product later evolves into detailed scheduling with adequate data.

V1 is **pressure intelligence**, not micromanagement.

---

# 58. Early-Start Suggestions

A useful feature:

If a future period is severe and an assessment is startable earlier:

```text
recommended_start_shift
```

Example:

> DB Assignment 3 is due during a high-pressure week. Starting approximately three days earlier would reduce deadline compression.

This can initially be heuristic.

---

# 59. Startability

Not every assessment can meaningfully begin early.

Possible field:

```text
can_start_early
```

Examples:

Assignment:

```text
true
```

Quiz preparation:

```text
true
```

In-class participation:

```text
false
```

---

# 60. Dynamic Recalculation

Pressure recalculates when:

* assessment added;
* assessment deleted;
* due date changes;
* effort estimate changes;
* completion status changes;
* commitment added;
* commitment removed;
* commitment date changes;
* course dropped;
* course added.

---

# 61. Deadline Extensions

Example:

```text
Assignment due Sep 14
→ Sep 17
```

The pressure curve should automatically redistribute.

This is an important product behavior.

---

# 62. Early Completion

If an assessment is marked done early:

```text
future pressure contribution = 0
```

The heatmap should update immediately.

This creates satisfying feedback and keeps the dashboard truthful.

---

# 63. Missed Assessments

If a deadline passes while assessment remains incomplete:

```text
status = OVERDUE
```

It should no longer distort future workload indefinitely.

Overdue work may appear separately.

---

# 64. Overdue Pressure

Optional rule:

If submission is still possible:

```text
late_allowed = true
```

it may continue contributing pressure.

Otherwise:

```text
deadline passed
late_allowed = false
```

remove from future pressure and mark missed.

V1 can simplify this if late-policy data is unavailable.

---

# 65. Unknown Deadlines

Assessments without known dates cannot contribute to temporal pressure.

They should remain visible:

> Date unknown

Example:

```text
Final Exam
40%
Date not announced
```

The user should not be given fake scheduling certainty.

---

# 66. Approximate Dates

Some outlines may say:

> Midterm around Week 7.

Support:

```text
date_precision =
EXACT
APPROXIMATE
WEEK_ONLY
UNKNOWN
```

Approximate assessments may contribute diffuse pressure with lower confidence.

---

# 67. Pressure Confidence

Every period should have:

```text
pressure_confidence
```

Influenced by:

* number of known dates;
* effort-confidence quality;
* assessment completeness;
* commitment completeness.

Example:

> **Pressure: 8.1 — High**
>
> Confidence: Moderate
>
> Two major assessment dates have not yet been announced.

---

# 68. Completeness

Separate:

```text
pressure_confidence
```

from:

```text
semester_data_completeness
```

Example:

A known week may be modeled accurately even if final-exam dates for December remain unknown.

---

# 69. Course Workload Baseline

Assessments are not the only academic demand.

Some courses require weekly ungraded work:

* readings;
* labs;
* preparation;
* coding practice;
* tutorials.

Possible field:

```text
baseline_weekly_effort
```

This can contribute to background workload.

---

# 70. Baseline Weekly Effort

Example:

```text
OS            4h/week
Databases     3h/week
AI4SE         5h/week
```

Then:

```text
baseline_academic_effort =
Σ course baseline
```

Assessment preparation is added on top.

---

# 71. Avoid Double Counting

If estimated weekly effort already includes ordinary assignments, then adding full assessment effort may double count.

Therefore V1 should define baseline carefully.

Recommended meaning:

```text
baseline_weekly_effort =
expected non-assessment academic effort
```

Examples:

* readings;
* review;
* routine practice.

Major assessment effort is separate.

---

# 72. Baseline Uncertainty

If unavailable, baseline effort may be omitted.

The engine remains useful using assessment demand alone.

Do not invent compulsory background hours.

---

# 73. Weekly Demand Model

Conceptually:

```text
weekly_demand =
baseline_academic_effort
+ distributed_assessment_effort
+ commitment_effort
```

Then modifiers:

```text
urgency
overlap
context switching
importance
```

produce pressure.

---

# 74. Demand vs Pressure

These should remain distinct.

Example:

```text
Demand:
24 estimated hours

Pressure:
8.2 / High
```

Pressure reflects compression and overlap, not merely hours.

This distinction can be useful in future UI.

---

# 75. Personal Capacity — Future Enhancement

Eventually:

```text
weekly_capacity
```

may account for:

* class hours;
* sleep;
* recurring commitments;
* personal study habits.

Then:

```text
demand / capacity
```

becomes powerful.

Not required for initial MVP.

---

# 76. Daily View

The default strategic visualization is weekly.

A daily view should support immediate navigation.

Example:

### Wednesday

```text
DB Assignment
Due tomorrow

OS Midterm
3 days away

AI4SE Milestone
6 days away
```

Pressure:

```text
7.3 — High
```

---

# 77. Weekly View

Primary analytical view.

Example:

```text
Sep 14–20
Pressure: 5.8 Moderate

Sep 21–27
Pressure: 8.6 Severe

Sep 28–Oct 4
Pressure: 6.2 Moderate
```

---

# 78. Monthly View

Primarily visual.

Should reveal pressure patterns rather than detailed tasks.

---

# 79. Semester View

Displays full-semester pressure curve.

Purpose:

> Where are the major peaks?

Not:

> What should I do today?

---

# 80. Pressure Curve

Potential visualization:

```text
10 |                 █
 9 |        █        █
 8 |        █   █    █
 7 |   █    █   █    █
 6 |   █ █  █   █  █ █
...
```

UI details belong elsewhere.

The engine provides ordered pressure values.

---

# 81. Structured Findings

The engine should emit findings rather than raw prose.

Example:

```json
{
  "type": "UPCOMING_PRESSURE_SPIKE",
  "severity": "HIGH",
  "window_start": "2026-09-21",
  "window_end": "2026-09-27",
  "pressure": 8.6,
  "drivers": [
    "assessment_1",
    "assessment_2",
    "commitment_4"
  ]
}
```

---

# 82. Finding Types

Initial possibilities:

```text
UPCOMING_PRESSURE_SPIKE
ASSESSMENT_CLUSTER
MAJOR_DEADLINE_OVERLAP
HIGH_EFFORT_ASSIGNMENT
COMMITMENT_COLLISION
DEADLINE_COMPRESSION
HEAVY_CURRENT_WEEK
LIGHT_UPCOMING_WEEK
EARLY_START_OPPORTUNITY
PRESSURE_DROP
UNKNOWN_DATES_REDUCE_CONFIDENCE
```

---

# 83. Explanation Layer

Structured finding:

```text
ASSESSMENT_CLUSTER
```

may become:

> Next week contains three major assessments across OS, Databases, and AI4SE.

The LLM may improve wording.

The finding itself must come from deterministic logic.

---

# 84. Prioritization

Semora may rank upcoming assessments by:

```text
priority_score =
task_pressure
```

Potential additional factors:

* overdue status;
* dependency;
* hard deadline;
* inability to start later.

---

# 85. Priority Is Not Importance

An assessment may be:

```text
high importance
low urgency
```

while another is:

```text
medium importance
extreme urgency
```

The second may deserve immediate attention.

Therefore priority should consider both.

---

# 86. "What Matters Now"

Potential dashboard section:

### What Matters Now

1. DB Assignment 2
   High pressure — due tomorrow

2. OS Midterm
   High importance — 4 days away

3. AI4SE Proposal
   Moderate effort — 6 days away

This should remain explainable.

---

# 87. Group Projects

Group work creates uncertainty because effort depends on others.

Possible field:

```text
is_group_assessment
```

and:

```text
personal_effort_estimate
```

Use personal effort rather than total group project size.

---

# 88. Multi-Stage Projects

Large projects may contain:

```text
Proposal
Milestone 1
Milestone 2
Final Submission
Presentation
```

Model them as separate assessments linked by:

```text
parent_project_id
```

This prevents all effort being assigned to one final deadline.

---

# 89. Exam Period

Final examination dates may be assigned late.

Before dates are known, Semora may show:

> Finals period expected to be high-pressure, but exact dates are unavailable.

Do not fabricate distribution.

---

# 90. Assessment Dependencies

Future support:

```text
Assignment 3 depends on Assignment 2
```

Could increase early-start urgency.

Not required V1.

---

# 91. Pressure Normalization

Raw workload can exceed expected ranges.

The displayed pressure should use a bounded transformation.

Example:

```text
normalized_pressure =
10 × (1 - exp(-raw_pressure / scale))
```

This prevents runaway values.

Alternative piecewise normalization is acceptable.

Keep configurable.

---

# 92. Why Bounded Pressure Matters

Suppose finals week has:

```text
raw score = 18
```

The UI should not show:

> 18/10

Instead:

```text
9.5 — Severe
```

while still preserving internal differences.

---

# 93. Calibration

Initial formulas are hypotheses.

The engine should be calibrated through dogfooding.

Questions:

> Did Semora flag weeks that actually felt difficult?

> Did it miss unexpectedly painful periods?

> Were project weeks underestimated?

> Were exam weeks overestimated?

---

# 94. Calibration Feedback

Optional internal feedback after a week:

> How demanding did last week actually feel?

```text
Much lighter than predicted
Slightly lighter
About right
Slightly harder
Much harder
```

Not required V1, but potentially extremely valuable for future personalization.

---

# 95. Personal Calibration — Future

If user repeatedly reports:

```text
project weeks harder than predicted
```

Semora may increase their personal project-load factor.

Example:

```text
personal_project_multiplier = 1.2
```

This is future scope.

---

# 96. Workload History

Store generated weekly pressure snapshots.

Useful for:

* comparing prediction to reality;
* engine-version analysis;
* future personalization;
* semester reflection.

But current pressure should always be recalculated from canonical data.

---

# 97. Engine Version

Every result should include:

```text
workload_engine_version = "0.1"
```

Scoring changes can then be tracked.

---

# 98. Configuration

Centralize:

```text
EFFORT_DEFAULTS
PREPARATION_HORIZONS
PRESSURE_WEIGHTS
OVERLAP_COEFFICIENTS
CONTEXT_SWITCH_FACTOR
PRESSURE_BANDS
MAJOR_ASSESSMENT_THRESHOLDS
PEAK_THRESHOLD
```

Do not scatter magic numbers.

---

# 99. V1 Simplification

The first version does **not** need:

* machine learning;
* sophisticated time-series prediction;
* reinforcement learning;
* daily automatic study scheduling;
* optimal control;
* calendar optimization.

A robust heuristic model is sufficient.

---

# 100. V1 Recommended Model

A practical first implementation:

For every upcoming assessment:

### Step 1

Estimate:

```text
effort_hours
```

### Step 2

Determine:

```text
preparation_horizon
```

### Step 3

Distribute remaining effort across preparation days.

### Step 4

Calculate:

```text
urgency
importance
```

### Step 5

Generate:

```text
task_pressure
```

### Step 6

Aggregate all active tasks per day/week.

### Step 7

Add:

```text
commitment effort
baseline effort if known
```

### Step 8

Apply:

```text
overlap penalty
context-switch penalty
deadline-compression penalty
```

### Step 9

Normalize:

```text
0–10
```

### Step 10

Generate deterministic findings.

This is sufficient for a strong V1.

---

# 101. Example

Current date:

```text
September 18
```

Upcoming:

### OS Midterm

```text
Due: Sep 24
Weight: 20%
Effort: 10h
Preparation horizon: 8 days
```

### DB Assignment

```text
Due: Sep 22
Weight: 8%
Effort: 7h
Preparation horizon: 6 days
```

### AI4SE Milestone

```text
Due: Sep 25
Weight: 10%
Effort: 6h
Preparation horizon: 7 days
```

### TA Grading

```text
Sep 21
Effort: 3h
Fixed
```

---

# 102. Example Interpretation

Base effort:

```text
26h
```

across several overlapping preparation windows.

Unique courses:

```text
3
```

Major assessments:

```text
3
```

Fixed non-course demand:

```text
3h
```

Output may be:

```text
Sep 21–27
Pressure: 8.7 — Severe
Confidence: High
```

Findings:

> Three major assessments overlap during this period.

> The DB assignment has the highest deadline compression.

> OS carries the largest grade importance.

> TA grading adds fixed workload during the same week.

> This is currently the highest-pressure period in the next four weeks.

---

# 103. Example After Early Completion

Student completes DB assignment on September 20.

Recalculate:

```text
Sep 21–27
Pressure: 7.4 — High
```

Finding:

> Completing DB Assignment 2 reduced modeled workload for next week substantially.

This is useful feedback.

---

# 104. Data Model Contract

The eventual `DATA_MODEL.md` should support at minimum:

```text
Assessment
AssessmentEffortEstimate
Commitment
CommitmentOccurrence
PressureSnapshot
PressureFinding
```

Potential future:

```text
PersonalCalibration
WorkloadFeedback
```

---

# 105. API-Level Output

Recommended high-level response:

```text
PressureAnalysis
```

containing:

```text
current_day_pressure
current_week_pressure

daily_pressure[]
weekly_pressure[]

peak_periods[]
findings[]
upcoming_assessments[]

confidence
completeness
engine_version
```

---

# 106. Daily Pressure Object

Example:

```json
{
  "date": "2026-09-21",
  "pressure": 7.2,
  "band": "HIGH",
  "estimated_demand_hours": 5.8,
  "drivers": [
    "assessment_12",
    "assessment_18",
    "commitment_3"
  ]
}
```

---

# 107. Weekly Pressure Object

Example:

```json
{
  "week_start": "2026-09-21",
  "week_end": "2026-09-27",
  "pressure": 8.7,
  "band": "SEVERE",
  "estimated_demand_hours": 27.0,
  "major_assessment_count": 3,
  "unique_course_count": 3
}
```

---

# 108. Estimated Hours Are Optional

If effort data quality is poor, Semora should prefer:

```text
Pressure: High
```

without prominently claiming:

```text
Estimated demand: 27.3h
```

Confidence must control presentation.

---

# 109. Testing Philosophy

This engine should be heavily unit tested.

LLM output should never be required for calculation tests.

---

# 110. Required Effort Tests

* explicit user effort overrides defaults;
* unknown effort preserves uncertainty;
* effort decreases after progress;
* completed item contributes zero future demand;
* generic defaults load correctly.

---

# 111. Required Urgency Tests

* urgency increases as deadline approaches;
* long-horizon projects begin contributing early;
* near-deadline work receives compression penalty;
* future assessment outside preparation horizon contributes little or no immediate pressure.

---

# 112. Required Aggregation Tests

* overlapping assessments create more pressure than separated assessments;
* same total effort compressed into fewer days produces greater pressure;
* fixed commitments increase period pressure;
* done assessments reduce pressure;
* deadline extensions redistribute workload.

---

# 113. Required Importance Tests

* higher weight increases importance;
* weight does not replace effort;
* high-effort low-weight assessment can still create major workload;
* high-weight low-effort assessment remains academically important without artificially huge effort.

---

# 114. Required Timeline Tests

* exact deadlines;
* approximate deadlines;
* unknown deadlines;
* overdue work;
* extension;
* dropped course;
* added assessment;
* semester boundary.

---

# 115. Required Confidence Tests

* generic effort estimates lower confidence;
* user-confirmed effort increases confidence;
* missing dates reduce future forecast completeness;
* unknown final dates do not create fabricated pressure peaks.

---

# 116. Required Finding Tests

Given controlled input, verify generation of:

```text
ASSESSMENT_CLUSTER
UPCOMING_PRESSURE_SPIKE
MAJOR_DEADLINE_OVERLAP
DEADLINE_COMPRESSION
COMMITMENT_COLLISION
EARLY_START_OPPORTUNITY
```

Findings must be deterministic.

---

# 117. Edge Cases

Eventually support:

* zero-weight mandatory assessments;
* pass/fail assessments;
* take-home exams;
* multi-day exams;
* group projects;
* recurring quizzes;
* assessment dropped from grading;
* best-N quiz rules;
* replacement exams;
* extensions;
* grace periods;
* courses without known outlines;
* weeks with no assessments but heavy recurring commitments.

---

# 118. Best-N Assessment Rules

Example:

> Best 8 of 10 quizzes count.

This affects grades more than pressure.

All quizzes still require preparation, so workload should normally include them.

Grade Engine handles which scores count.

---

# 119. Dropped Assessment

If instructor announces:

> Quiz 3 is cancelled.

Set:

```text
status = CANCELLED
```

No future workload contribution.

---

# 120. Semester Breaks

Break periods should be represented.

Pressure may still exist if deadlines fall immediately after a break.

Do not automatically assume break = zero workload.

---

# 121. Product Trust Rule

Semora should be able to answer:

> **Why is next week red?**

with concrete reasons.

Example:

> Because you have approximately three meaningful assessment preparation windows overlapping, plus a fixed TA commitment.

Never:

> Our AI predicts next week will be stressful.

---

# 122. No Psychological Claims

Avoid phrases such as:

> Stress level: 9/10.

Semora models:

```text
Workload Pressure
```

not mental health.

Preferred:

> Academic pressure: High.

---

# 123. User Overrides

Users must be able to change:

* effort estimate;
* due date;
* assessment type;
* completion status;
* commitment effort;
* flexibility.

The heatmap should recalculate immediately.

---

# 124. Useful Partial Data

The engine should degrade gracefully.

Even with only:

```text
assessment dates
assessment types
weights
```

it can provide a basic pressure estimate.

Effort estimates improve it.

Personal history improves it further.

No single advanced data source should gate usefulness.

---

# 125. Progressive Intelligence

Conceptually:

```text
Deadlines only
    ↓
Basic pressure

+ Weights
    ↓
Importance-aware pressure

+ Effort estimates
    ↓
Workload-aware pressure

+ Commitments
    ↓
Life-aware pressure

+ Personal history
    ↓
Personalized pressure
```

This is the intended evolution.

---

# 126. V1 Product Success Condition

The Workload Engine succeeds if a student can open Semora and immediately understand:

> **This week is manageable, but next week is bad—and I can see exactly why.**

Even better:

> **I changed when I started something because Semora showed me the collision early.**

That is the behavior we want.

---

# 127. Final Engine Invariant

Every pressure score must ultimately be explainable through:

```text
known assessments
+
estimated effort
+
deadlines
+
academic importance
+
commitments
+
explicit heuristic rules
```

No pressure result should exist purely because an LLM declared a week difficult.

---

# 128. Final Product Rule

Semora's Workload Engine should optimize for:

> **foresight**

not:

> **perfect prediction**

The goal is to help students see difficult periods early enough to make better decisions.
