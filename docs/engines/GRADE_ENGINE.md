# Semora — Grade Engine Specification

**Status:** Design specification
**Version:** 0.1
**Related:** `PRODUCT.md`, `DECISIONS.md`, `WORKLOAD_ENGINE.md`
**Primary responsibility:** Calculate course performance, remaining-grade requirements, deterministic what-if scenarios, and safe statistical context for relative grading.

---

# 1. Purpose

The Grade Engine answers:

> **How am I performing in this course, what is still mathematically possible, and what do I need on the remaining assessments to reach a target?**

The engine should support useful questions such as:

* What is my current weighted score?
* How much of the course has actually been graded?
* What percentage of the course remains?
* What do I need on the final to reach an A-?
* If I score 80 on the next assignment, what happens?
* What is the highest grade still mathematically possible?
* What happens if my lowest quiz is dropped?
* How am I performing relative to the class?
* Is a letter-grade prediction actually justified?

The Grade Engine is primarily **deterministic mathematics**.

It should not rely on an LLM for calculations.

---

# 2. Core Principle

The Grade Engine must separate:

```text
RAW SCORE
WEIGHTED CONTRIBUTION
COURSE PROGRESS
LETTER-GRADE THRESHOLD
RELATIVE CLASS POSITION
```

These are different concepts.

Example:

A student may currently have:

```text
Raw average: 82%
```

but if the completed assessments represent only:

```text
25% of the course
```

then Semora should not imply that 82% is their final-grade trajectory with high confidence.

---

# 3. Non-Responsibilities

The Grade Engine does not:

* parse course outlines;
* determine workload pressure;
* choose courses;
* predict psychological performance;
* infer hidden grading curves;
* fabricate class statistics;
* decide whether a professor will curve grades;
* determine course difficulty.

Related systems:

* outline parsing → `AI_EXTRACTION.md`
* pressure → `WORKLOAD_ENGINE.md`
* semester planning → `SEMESTER_ENGINE.md`

---

# 4. Supported Grading Modes

Initial grading modes:

```text
ABSOLUTE
RELATIVE
PASS_FAIL
UNKNOWN
```

Future grading modes may include:

```text
HYBRID
MASTERY
```

but are not required for V1.

---

# 5. Absolute Grading

A course is absolute when explicit grade thresholds are known.

Example:

```text
A   >= 90
A-  >= 85
B+  >= 80
B   >= 75
B-  >= 70
```

Semora may deterministically calculate:

* current grade equivalent;
* target requirements;
* mathematically possible outcomes.

---

# 6. Relative Grading

A course is relative when the final letter grade depends on class performance.

Examples:

* explicit curve;
* instructor-defined grade boundaries after results;
* grading based on mean/standard deviation;
* unspecified relative grading.

Semora must **not invent letter-grade boundaries**.

If adequate class statistics are available, Semora may provide statistical context.

---

# 7. Unknown Grading

If an outline does not clearly state the grading system:

```text
grading_mode = UNKNOWN
```

The UI should say:

> Grading method has not been confirmed.

The user may manually set it.

---

# 8. Course Grading Structure

A course may consist of grading categories.

Example:

```text
Assignments     20%
Quizzes         10%
Midterm         25%
Project         15%
Final           30%
```

Total expected weight:

```text
100%
```

However, the engine must support unusual courses where the total is temporarily incomplete or greater than 100 due to bonus rules.

---

# 9. Grading Category

Recommended fields:

```text
category_id
course_offering_id
name
weight_percentage
aggregation_rule
drop_rule
bonus_policy
```

Example:

```text
name = "Quizzes"
weight = 15
aggregation_rule = WEIGHTED_MEAN
drop_rule = DROP_LOWEST_2
```

---

# 10. Assessment

Each graded assessment contains:

```text
assessment_id
category_id
title
points_earned
points_possible
weight_override
status
is_bonus
```

Optional:

```text
class_mean
class_median
class_std_dev
class_max
class_min
```

---

# 11. Assessment Status

Recommended:

```text
UPCOMING
GRADED
EXCUSED
DROPPED
CANCELLED
MISSING
```

Only appropriate statuses should affect grade calculations.

---

# 12. Raw Assessment Percentage

For a graded assessment:

```text
assessment_percentage =
points_earned / points_possible × 100
```

Example:

```text
17 / 20 = 85%
```

Never use rounded display values in internal calculations.

---

# 13. Weighted Contribution

For a directly weighted assessment:

```text
weighted_contribution =
assessment_percentage / 100
× assessment_weight
```

Example:

```text
Midterm score = 80%
Midterm weight = 25%

Contribution = 20 percentage points
```

---

# 14. Category-Based Grading

Many courses use category weights rather than explicit per-assessment weights.

Example:

```text
Quizzes = 10%
```

with:

```text
Quiz 1
Quiz 2
Quiz 3
Quiz 4
```

The engine first calculates the category score.

Then:

```text
category_contribution =
category_score / 100
× category_weight
```

---

# 15. Category Aggregation Rules

Initial supported rules:

```text
EQUAL_MEAN
POINTS_WEIGHTED_MEAN
EXPLICIT_ASSESSMENT_WEIGHTS
BEST_N
DROP_LOWEST_N
```

Future:

```text
CUSTOM_FORMULA
```

should not be needed for V1.

---

# 16. Equal Mean

Example:

```text
Quiz 1 = 80
Quiz 2 = 90
Quiz 3 = 70
```

Then:

```text
category_score =
(80 + 90 + 70) / 3
= 80
```

---

# 17. Points-Weighted Mean

Example:

```text
Assignment 1 = 40/50
Assignment 2 = 90/100
```

Do not average:

```text
80% and 90% → 85%
```

when the grading rule is based on total points.

Instead:

```text
130 / 150
= 86.67%
```

---

# 18. Explicit Assessment Weights

Example:

```text
Project Proposal      5%
Project Milestone    10%
Final Project        20%
```

These may all belong to a logical "Project" category but contribute independently.

---

# 19. Drop Lowest N

Example:

> Best 8 of 10 quizzes count.

Equivalent:

```text
DROP_LOWEST_2
```

If all ten are graded:

1. sort eligible quiz scores;
2. remove lowest two;
3. aggregate remaining eight.

---

# 20. Drop Rules Before All Assessments Exist

Suppose:

```text
Best 8 of 10 quizzes
```

but only four quizzes have occurred.

Semora should **not prematurely drop two quizzes** from the current grade unless the instructor's policy clearly operates that way.

Recommended distinction:

```text
PROVISIONAL_CURRENT_SCORE
FINAL_RULE_ADJUSTED_SCORE
```

For V1:

apply drop rules conservatively.

If fewer assessments have occurred than the required counted number, count all currently graded assessments.

Example:

```text
Best 8 of 10
Only 4 graded

Count all 4.
```

---

# 21. Best N

If:

```text
BEST_5_OF_7
```

and seven assessments are graded:

keep highest five.

If four are graded:

count all four provisionally.

---

# 22. Excused Assessments

An excused assessment should normally be excluded from aggregation.

Example:

```text
status = EXCUSED
```

The category denominator may adjust automatically depending on grading policy.

If the policy is unclear, user confirmation is required.

---

# 23. Cancelled Assessments

Cancelled assessments:

```text
status = CANCELLED
```

should not affect grades.

If the instructor redistributes their weight, the course structure must be updated.

---

# 24. Missing Assessments

A missed assessment may be represented as:

```text
status = MISSING
score = 0
```

only if it truly counts as zero.

Do not automatically equate:

```text
not entered
```

with:

```text
0
```

Missing data and zero score are different.

---

# 25. Ungraded Assessments

An assessment awaiting results:

```text
status = UPCOMING
```

or:

```text
SUBMITTED_UNGRADED
```

should not be treated as zero in current-performance calculations.

---

# 26. Completed Grade Weight

Calculate:

```text
graded_weight
```

representing how much of the course grade has usable results.

Example:

```text
Assignments completed = 10%
Midterm = 25%
Quizzes counted so far = 5%

graded_weight = 40%
```

This should be prominently visible.

---

# 27. Current Weighted Points

Example:

```text
Assignments:
90% × 10% = 9.0

Midterm:
80% × 25% = 20.0

Quiz:
70% × 5% = 3.5

weighted_points_earned = 32.5
```

out of:

```text
graded_weight = 40
```

---

# 28. Current Performance on Completed Work

Normalize:

```text
current_performance =
weighted_points_earned / graded_weight × 100
```

Example:

```text
32.5 / 40 × 100
= 81.25%
```

This is different from:

```text
32.5% final course score
```

The UI must communicate the distinction.

---

# 29. Recommended Current Grade Display

Example:

> **Current performance:** 81.3%

> Based on **40% of the course graded**

This is much safer than:

> Current course grade: 81.3%

when 60% remains.

---

# 30. Remaining Weight

```text
remaining_weight =
100 - graded_weight
```

assuming total course weight is 100.

Example:

```text
60%
```

---

# 31. Target Grade Calculation

For absolute grading:

Given:

```text
target = 85
earned_weighted_points = 32.5
remaining_weight = 60
```

Required remaining average:

```text
required_remaining_average =
(target - earned_weighted_points)
/
remaining_weight
× 100
```

Example:

```text
(85 - 32.5) / 60 × 100
= 87.5%
```

---

# 32. Target Feasibility

If:

```text
required_remaining_average > 100%
```

the target is mathematically impossible under normal grading.

Example UI:

> An A is no longer mathematically reachable without bonus marks or a grading adjustment.

---

# 33. Target Already Secured

If:

```text
earned_weighted_points >= target
```

then even zero on remaining work may still satisfy the threshold.

Example:

> You have already secured at least a B under the current grading scheme, assuming no penalties or policy changes.

---

# 34. Minimum Final Score for Target

A common question:

> What do I need on the final for an A-?

If all other assessments are known:

```text
required_final_score =
(target_threshold - weighted_points_before_final)
/
final_weight
× 100
```

---

# 35. Example

Course:

```text
A- threshold = 85
Final weight = 35%
Current weighted points = 57
```

Then:

```text
required_final =
(85 - 57) / 35 × 100
= 80%
```

Display:

> You need approximately **80% on the final** to finish at or above 85%.

---

# 36. Multiple Remaining Assessments

If several assessments remain, Semora should not imply that each requires the same score unless explicitly modelling an equal-average scenario.

Useful output:

> You need an average of 87.5% across the remaining 60% of the course.

Then allow what-if scenarios.

---

# 37. What-If Analysis

Users should be able to enter hypothetical results.

Example:

```text
Assignment 4 = 90
Project = 85
Final = 80
```

Semora recalculates the projected final numeric score.

This must happen deterministically.

---

# 38. Temporary Scenario State

What-if values should not overwrite actual grade data.

Recommended:

```text
GradeScenario
```

containing hypothetical overrides.

Example:

```text
scenario_id
course_id
name
hypothetical_scores[]
```

---

# 39. Example Scenarios

Potential UI presets:

```text
Conservative
Target
Optimistic
```

However, these labels should only be generated from explicit assumptions.

Do not magically predict what the user will score.

---

# 40. Best Possible Final Score

Assume:

```text
100%
```

on all remaining standard assessments.

Then:

```text
max_final =
earned_weighted_points
+ remaining_weight
```

unless bonus marks exist.

---

# 41. Worst Possible Final Score

Assume:

```text
0%
```

on all remaining assessments.

Then:

```text
min_final =
earned_weighted_points
```

This may be useful for showing guaranteed outcomes.

---

# 42. Reachable Grade Range

Absolute course example:

```text
Current weighted points = 62
Remaining = 30
```

Then numeric final range:

```text
62–92
```

Possible letter grades:

```text
B- through A
```

depending on thresholds.

---

# 43. Bonus Marks

Courses may offer bonus points.

Represent separately:

```text
bonus_points
```

Avoid forcing bonus marks into the 100% grading structure.

Possible final:

```text
base_final_score + bonus_points
```

subject to any course-specific cap.

---

# 44. Bonus Caps

Example:

> Maximum final grade remains 100 even with bonus.

Then:

```text
final_score =
min(100, base_score + bonus)
```

If no cap exists, allow scores above 100 internally.

---

# 45. Negative Penalties

Some courses may deduct marks for:

* late submission;
* attendance;
* academic policy violations.

Represent as:

```text
grade_adjustment
```

rather than inventing fake assessments where possible.

---

# 46. Grade Adjustment

Possible structure:

```text
type = BONUS | PENALTY
value
unit = PERCENTAGE_POINTS | CATEGORY_POINTS
reason
```

V1 can support simple final percentage-point adjustments.

---

# 47. Category Weight Validation

Expected:

```text
Σ category_weights = 100%
```

If:

```text
98%
```

or:

```text
105%
```

Semora should flag it.

Possible causes:

* extraction error;
* bonus category;
* unusual policy;
* incomplete outline.

Do not silently normalize to 100.

---

# 48. Validation Finding

Example:

> Assessment weights total 95%. Please verify the course structure before grade calculations are considered reliable.

---

# 49. Category Score With Partial Completion

Suppose:

```text
Assignments = 20%
10 assignments total
3 currently graded
```

If assignments are equally weighted within the category, Semora may calculate the current category average from those three.

But for completed course weight, it must estimate what portion of the 20% is represented.

If all ten are equal:

```text
each assignment = 2%
```

Three graded:

```text
graded category weight = 6%
```

---

# 50. Unknown Number of Assessments

Suppose outline says:

> Quizzes = 15%

but does not state how many quizzes will occur.

After two quizzes:

Semora can show:

> Current quiz average: 82%

but should be cautious when calculating precise completed course weight.

Possible representation:

```text
category_completion_unknown = true
```

---

# 51. Unknown Internal Category Weighting

If a category weight is known but internal weighting is unclear:

```text
Assignments = 20%
```

and assignments have different point totals.

Prefer points-weighted mean only if evidence supports it.

Otherwise require user verification.

---

# 52. Grading Confidence

Each course grade analysis should have:

```text
grade_analysis_confidence
```

based on:

* verified grading structure;
* weight totals;
* known aggregation rules;
* known assessment results;
* grading mode certainty.

---

# 53. High Confidence Example

```text
Verified outline
Absolute thresholds known
All category weights total 100%
All aggregation rules known
```

Result:

```text
confidence = HIGH
```

---

# 54. Lower Confidence Example

```text
Relative grading
Quiz count unknown
One category weighting rule unclear
```

Result:

```text
confidence = MODERATE
```

Language should adjust accordingly.

---

# 55. Absolute Grade Mapping

Given numeric score:

```text
87.2
```

and thresholds:

```text
A  >= 90
A- >= 85
B+ >= 80
```

map to:

```text
A-
```

using deterministic threshold ordering.

---

# 56. Threshold Inclusivity

Threshold representation must distinguish:

```text
>=
>
```

though university grading normally uses inclusive lower bounds.

Recommended structure:

```text
letter_grade
minimum_score
inclusive = true
```

---

# 57. Relative Grading Philosophy

Relative grading is fundamentally different.

Semora should focus on:

> **Where am I relative to known class performance?**

not:

> **What letter grade am I definitely getting?**

---

# 58. Relative Assessment Statistics

If available:

```text
mean
median
standard_deviation
maximum
minimum
```

These may exist per assessment.

---

# 59. Difference From Mean

```text
difference_from_mean =
student_score - class_mean
```

Example:

```text
student = 78
mean = 69

difference = +9
```

---

# 60. Z-Score

When standard deviation is available:

```text
z =
(student_score - mean) / standard_deviation
```

Example:

```text
student = 78
mean = 69
sd = 11

z = 0.82
```

Display:

> You scored **0.82 standard deviations above the class mean**.

---

# 61. Standard Deviation Safety

Do not calculate z-score when:

```text
sd <= 0
```

or missing.

---

# 62. Percentile Approximation

A percentile may be approximated from z-score only if assuming a distribution.

V1 should probably avoid showing inferred percentiles unless clearly labelled.

Better:

```text
+0.82 SD above mean
```

than:

```text
79th percentile
```

when the class distribution may not be normal.

---

# 63. Relative Category Performance

If multiple assessments have class statistics, Semora may show:

```text
Midterm      +0.8 SD
Quiz Avg     +0.3 SD
Assignment   +1.1 SD
```

This is useful without guessing grade boundaries.

---

# 64. Relative Overall Position

Combining z-scores across assessments is statistically tricky because:

* assessments have different distributions;
* weights differ;
* scores may be correlated;
* class composition may change.

V1 should avoid producing a fake:

```text
overall z = 0.72
```

unless methodology is explicitly defined.

---

# 65. Safe Relative Course Summary

Good:

> Your midterm score was 9 points above the class mean.

> Your quiz average is currently close to the class mean.

> Final letter-grade boundaries have not been announced.

Bad:

> You're on track for an A-.

unless strong evidence exists.

---

# 66. Instructor-Provided Relative Boundaries

If the instructor later announces:

```text
A >= 82
A- >= 77
...
```

then the course effectively gains usable absolute thresholds for that grading snapshot.

Store them as:

```text
published_thresholds
```

with date/version.

---

# 67. Provisional Grade Boundaries

If users manually enter rumored or estimated grade boundaries:

```text
source = USER_ESTIMATE
confidence = LOW
```

Semora must label them clearly.

Do not mix them with official thresholds.

---

# 68. Threshold Versioning

Relative boundaries may change.

Example:

```text
Mid-semester estimate
Final published boundary
```

Store both historically if useful.

Canonical grade mapping should use the latest verified official boundaries.

---

# 69. Pass/Fail Courses

Possible rules:

```text
PASS if final_score >= 50
```

or other requirements.

Store:

```text
pass_threshold
```

and calculate deterministically.

---

# 70. Component Minimums

Some courses require:

> Must score at least 40% on the final to pass.

This must be modeled separately from overall numeric score.

Example:

```text
component_requirement:
assessment_type = FINAL
minimum_percentage = 40
```

---

# 71. Compound Requirements

Example:

> Overall >= 50 AND final >= 40.

Then:

```text
pass =
overall >= 50
AND
final >= 40
```

Do not treat the final threshold as merely another grade weight.

---

# 72. Mandatory Completion Requirements

Example:

> Project must be submitted to pass the course.

Represent:

```text
mandatory_component = true
```

A score calculation alone cannot determine passing status.

---

# 73. Attendance Grade Components

If attendance contributes:

```text
Attendance = 5%
```

treat it like any other graded category.

If attendance is instead a separate eligibility requirement:

```text
minimum attendance = 80%
```

that belongs to a rule, not normal grade arithmetic.

---

# 74. Eligibility Rules

Possible structure:

```text
rule_type
threshold
affected_outcome
```

Example:

```text
ATTENDANCE_MINIMUM
80%
COURSE_PASS_ELIGIBILITY
```

Full support may be future scope, but the data model should not prevent it.

---

# 75. Reweighted Assessments

Sometimes an instructor says:

> Quiz 4 cancelled. Remaining quizzes will absorb the weight.

The engine must support updated category structures.

Canonical current structure should be recalculated.

Historical structure may remain in change history.

---

# 76. Weight Redistribution

Possible strategies:

```text
PROPORTIONAL
TO_SPECIFIC_CATEGORY
TO_FINAL
CUSTOM
```

V1 may require manual update rather than automatic inference.

---

# 77. Course Grade Snapshot

Useful stored object:

```text
GradeSnapshot
```

containing:

```text
timestamp
weighted_points
graded_weight
current_performance
remaining_weight
engine_version
```

Useful for trend visualization.

---

# 78. Grade Trend

Potential UI:

```text
Week 3    88%
Week 5    84%
Week 7    86%
```

But ensure each point represents:

> performance on completed graded work

not directly comparable certainty as graded weight changes.

---

# 79. Trend Context

A drop:

```text
88 → 82
```

after a 30% midterm is more meaningful than after a 2% quiz.

Possible display:

> Current performance dropped 4.3 points after the midterm, which represents 25% of the course.

---

# 80. Grade Risk Indicators

The Grade Engine may emit deterministic findings.

Examples:

```text
TARGET_NO_LONGER_REACHABLE
TARGET_REQUIRES_HIGH_REMAINING_AVERAGE
GRADE_MOSTLY_DECIDED
LARGE_REMAINING_WEIGHT
RELATIVE_GRADE_UNCERTAIN
WEIGHT_STRUCTURE_INVALID
LOW_GRADED_COMPLETION
```

---

# 81. Target Difficulty Bands

If target requires:

```text
remaining average <= 70
```

Semora may call it:

```text
Comfortable relative to target
```

If:

```text
> 90
```

it may say:

```text
Demanding
```

But this language should not assume the student's ability.

Prefer exact math first.

---

# 82. Target Requirement Output

Example:

> To finish with at least **85%**, you need an average of **87.5%** across the remaining **60%** of the course.

That is sufficiently useful.

No motivational judgment necessary.

---

# 83. Multi-Target View

Possible:

```text
A     requires 95.8%
A-    requires 87.5%
B+    requires 79.2%
B     requires 70.8%
```

Hide impossible targets or label them clearly.

---

# 84. Best/Worst Scenario Table

Example:

```text
If remaining average is:

70% → final 74.5
80% → final 80.5
90% → final 86.5
100% → final 92.5
```

Useful and deterministic.

---

# 85. What-If Final Slider

Potential UI:

```text
Final score: [ 82 ]
```

Immediately update:

```text
Projected numeric course score: 86.1
Projected absolute grade: A-
```

Only show letter grade if valid thresholds are known.

---

# 86. What-If Category Scenario

Example:

> If my remaining assignments average 90% and final is 80%...

Semora calculates the result.

This may use scenario inputs by category rather than every individual future assessment.

---

# 87. Unknown Future Assessment Counts

If number of future quizzes is unknown, category-level what-if should use:

```text
future_category_average
```

rather than fabricate the number of assessments.

---

# 88. Rounding

Internal calculations:

```text
full precision
```

Display:

```text
usually 1 decimal place
```

Letter-grade mapping must use unrounded internal value.

Example:

```text
84.96
```

should not become:

```text
85.0 → A-
```

unless official policy specifies rounding.

---

# 89. Course Rounding Policy

Some instructors round final grades.

Represent:

```text
rounding_policy
```

Possible:

```text
NONE
NEAREST_INTEGER
CUSTOM
UNKNOWN
```

Default:

```text
UNKNOWN / no assumed rounding
```

---

# 90. No Hidden Rounding

Semora must never silently assume:

> 84.6 rounds to 85.

unless the course policy confirms this.

---

# 91. Grade Policy Provenance

Important grading rules should retain source.

Example:

```text
source_type = COURSE_OUTLINE
source_reference = page 3
verified_by_user = true
```

This will tie into `AI_EXTRACTION.md`.

---

# 92. User Overrides

Users must be able to correct:

* category weights;
* thresholds;
* aggregation rules;
* drop rules;
* scores;
* class statistics;
* grading mode.

AI extraction should never trap the user into an incorrect model.

---

# 93. Change Recalculation

Grade analysis recalculates when:

* score added;
* score edited;
* assessment cancelled;
* weight changes;
* grade threshold changes;
* drop rule changes;
* course grading mode changes;
* bonus added;
* class statistics added.

---

# 94. Engine Configuration

Centralize any non-course-specific constants such as:

```text
DISPLAY_PRECISION
TARGET_WARNING_THRESHOLDS
CONFIDENCE_BANDS
```

Actual grade formulas should mostly derive from course data, not global magic numbers.

---

# 95. Engine Version

Every calculated analysis should include:

```text
grade_engine_version = "0.1"
```

---

# 96. Result Contract

Recommended output:

```text
CourseGradeAnalysis
```

containing:

```text
course_offering_id

grading_mode

weighted_points_earned
graded_weight
remaining_weight
current_performance

current_absolute_grade

reachable_numeric_range
reachable_letter_grades[]

target_analyses[]

category_analyses[]

relative_statistics[]

findings[]

confidence
completeness
engine_version
```

---

# 97. Category Analysis

Example:

```text
Quizzes

Current average: 82.5%
Category weight: 10%
Currently represented weight: 6%
Drop rule: Best 8 of 10
4 quizzes graded
```

---

# 98. Target Analysis Object

Example:

```text
target = "A-"
threshold = 85

required_remaining_average = 87.5
reachable = true
```

---

# 99. Relative Statistics Object

Example:

```text
assessment_id
student_score
class_mean
class_median
std_dev
difference_from_mean
z_score
```

Only include fields backed by available data.

---

# 100. Completeness

Grade completeness should reflect whether enough grading information is known.

Possible dimensions:

```text
grading_mode_known
category_weights_known
thresholds_known
aggregation_rules_known
assessment_results_known
```

---

# 101. Example Absolute Course

Structure:

```text
Assignments   20%
Quizzes       10%
Midterm       25%
Project       15%
Final         30%
```

Thresholds:

```text
A  >= 90
A- >= 85
B+ >= 80
```

Results:

```text
Assignments current average = 88%
Quizzes current average = 92%
Midterm = 81%
```

Assume completed weight:

```text
45%
```

Weighted points earned:

```text
Assignments: 17.6
Quizzes:      9.2
Midterm:     20.25

Total = 47.05
```

If all assignment and quiz categories are already complete, then:

```text
graded weight = 55%
```

This example demonstrates why category completion must be modeled accurately rather than assumed.

---

# 102. Example Target

Suppose verified:

```text
weighted points earned = 47.05
graded weight = 55
remaining = 45
```

For A-:

```text
target = 85
```

Required remaining average:

```text
(85 - 47.05) / 45 × 100
= 84.33%
```

Display:

> You need an average of approximately **84.3% across the remaining 45%** to finish at or above 85%.

---

# 103. Example Relative Course

Midterm:

```text
Student = 78
Mean = 69
Median = 71
SD = 11
```

Semora:

> Midterm: **78%**

> Class mean: **69%**

> Difference: **+9 points**

> Relative position: **+0.82 SD above mean**

Then:

> Final letter-grade boundaries are not known, so Semora cannot reliably predict a letter grade.

Perfect.

---

# 104. Required Tests — Basic Mathematics

At minimum:

* assessment percentage calculation;
* weighted contribution;
* category contribution;
* remaining weight;
* current normalized performance;
* target required average;
* minimum final score;
* maximum possible score;
* minimum possible score.

---

# 105. Required Tests — Category Aggregation

At minimum:

* equal mean;
* points-weighted mean;
* explicit assessment weights;
* best N;
* drop lowest N;
* excused assessment;
* cancelled assessment;
* missing zero versus unknown score.

---

# 106. Required Tests — Absolute Grading

At minimum:

* threshold mapping;
* exact boundary values;
* target reachable;
* target impossible;
* target already secured;
* what-if calculation;
* rounding does not affect internal threshold incorrectly.

---

# 107. Required Tests — Relative Grading

At minimum:

* difference from mean;
* z-score;
* missing SD;
* zero SD;
* no letter prediction when thresholds unavailable;
* official published boundaries enable deterministic mapping.

---

# 108. Required Tests — Partial Course State

At minimum:

* only 10% graded;
* category count unknown;
* category internal weighting unknown;
* final date unknown;
* assessment result pending;
* total category weight != 100.

---

# 109. Required Tests — Drop Rules

Examples:

```text
Best 8 of 10
```

Test:

* 4 grades entered → count all four;
* 8 entered → count all eight;
* 9 entered → drop lowest one;
* 10 entered → drop lowest two.

---

# 110. Required Tests — Bonus/Penalty

At minimum:

* bonus raises numeric grade;
* final cap enforced if configured;
* penalty reduces grade;
* bonus does not distort category weight total.

---

# 111. Edge Cases

Eventually handle:

* category with zero weight;
* 100% final course;
* more than 100% possible due to bonus;
* pass/fail;
* assessment worth 0% but mandatory;
* grade threshold changed late;
* instructor replaces final with project;
* different sections with different grading;
* negative marks if a course allows them;
* score above points possible due to bonus;
* dropped course;
* incomplete grade;
* repeated course.

---

# 112. No LLM Arithmetic Rule

The following should never be sent to an LLM for computation:

```text
weighted averages
grade thresholds
remaining requirements
z-scores
best-N selection
drop rules
numeric projections
```

Use normal code.

The LLM may explain:

> You need 84.3% across the remaining work.

It must not produce the 84.3%.

---

# 113. Explanation Layer

Structured result:

```text
TARGET_REQUIRES_84_3
```

may become:

> An A- is still reachable, but your remaining assessments need to average approximately 84.3%.

The factual values come from the Grade Engine.

---

# 114. Product Trust Rule

Semora must be able to show how it calculated a grade.

Example:

```text
Assignments      17.6 / 20
Quizzes           9.2 / 10
Midterm          20.25 / 25
--------------------------------
Earned           47.05
Currently graded 55%
Current perf.    85.5%
```

Transparency matters because students frequently verify grade math themselves.

---

# 115. False Precision Rule

Do not display:

```text
You have an 83.72% chance of getting an A-
```

There is no justified probability model in V1.

Semora computes mathematical possibilities, not clairvoyance.

---

# 116. Relative-Grading Refusal Rule

When no reliable boundaries or statistical model exist, Semora should explicitly say:

> **Letter-grade prediction unavailable for this relatively graded course.**

This is a feature, not a failure.

---

# 117. Future Personal Grade Modeling

Not V1.

Future versions may use the student's historical performance to answer questions like:

> Based on your previous assessments, what score range is plausible?

That would require proper uncertainty modelling.

Do not implement as casual LLM prediction.

---

# 118. Future Community Grade Data

Not V1.

Possible future inputs:

* historical class means;
* past grade distributions;
* historical boundaries.

Such data must be:

* semester-specific;
* instructor-specific where appropriate;
* clearly historical;
* never presented as guaranteed current boundaries.

---

# 119. Future Probabilistic Modeling

Potential future system:

```text
historical performance
+
assessment difficulty
+
course distribution
+
student history
↓
probabilistic outcome range
```

This would require real data and calibration.

Do not fake this in V1.

---

# 120. Interaction With Workload Engine

The Grade Engine owns:

```text
assessment importance by weight
```

The Workload Engine may consume:

```text
assessment.weight
```

as one input to pressure.

However:

```text
Grade Engine ≠ Workload Engine
```

A 5% assignment can have low grade impact and high workload.

Maintain this separation.

---

# 121. Interaction With AI Extraction

`AI_EXTRACTION.md` may extract:

```text
grading categories
weights
drop rules
thresholds
relative grading statements
bonus policies
```

But the Grade Engine only operates on **verified structured data**.

---

# 122. Interaction With Data Model

`DATA_MODEL.md` must support:

```text
GradingScheme
GradeCategory
Assessment
AssessmentScore
GradeThreshold
DropRule
GradeAdjustment
ClassStatistic
GradeScenario
```

Exact tables may differ.

---

# 123. V1 Implementation Priority

### Level 1

* categories;
* assessment scores;
* weighted grade calculation;
* graded/remaining weight.

### Level 2

* absolute thresholds;
* target-grade requirements;
* what-if calculations.

### Level 3

* drop lowest / best-N;
* bonus and simple adjustments.

### Level 4

* relative statistics;
* mean/median/SD context.

### Level 5

* polished findings and scenario UI.

---

# 124. V1 Must Remain Small

Do not build:

* predictive ML;
* automatic curve estimation;
* professor-specific grade prediction;
* community grade distributions;
* probability-of-A models;
* detailed GPA forecasting across entire degree.

The Grade Engine should be extremely reliable within its narrow mathematical responsibilities.

---

# 125. Success Condition

The Grade Engine succeeds when a student can ask:

> **What exactly do I need from here?**

and get a mathematically correct answer.

It also succeeds when Semora knows when the correct answer is:

> **We don't have enough information to predict that.**

---

# 126. Final Engine Invariant

Every grade value displayed by Semora must be reproducible from:

```text
verified grading rules
+
assessment results
+
deterministic mathematics
```

No numeric grade result should exist because an LLM estimated it.

---

# 127. Final Product Rule

The Grade Engine should optimize for:

> **mathematical trust**

not:

> **prediction spectacle**

Students should trust Semora's grade calculations enough to verify important academic decisions with them.
