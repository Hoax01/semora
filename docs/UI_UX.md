# Semora — UI / UX Design Specification

**Status:** Design specification  
**Version:** 0.1  
**Related:** `PRODUCT.md`, `DECISIONS.md`, `ARCHITECTURE.md`, `BUILDPLAN.md`  
**Primary responsibility:** Define how Semora should look, feel, behave, and communicate complex semester intelligence without becoming another generic student planner or generic SaaS dashboard.

---

# 1. Design Thesis

Semora should feel like:

> **an academic decision instrument**

not:

> a todo list for students.

The interface should communicate:

- clarity;
- control;
- foresight;
- intelligence;
- calm;
- trust.

The student should feel:

> **"I can see my semester."**

not:

> "I have another productivity app to maintain."

Semora contains substantial information:

- courses;
- timetables;
- workload;
- commitments;
- assessments;
- grade structures;
- comparison metrics;
- uncertainty;
- future pressure.

The design challenge is therefore:

> **present dense information without making the product feel dense.**

---

# 2. Product Personality

Semora should feel:

```text
Analytical
Modern
Calm
Precise
Student-first
Confident
Slightly futuristic
```

It should not feel:

```text
Corporate HR software
University administration software
A children's education app
A generic Notion template
A gamified habit tracker
A finance terminal
An "AI app" covered in glowing gradients
```

---

# 3. Visual Identity Direction

The preferred visual direction is:

> **dark-neutral academic technology with a restrained electric accent**

The product should primarily use:

- near-black;
- charcoal;
- cool neutral greys;
- off-white;
- one strong brand accent;
- semantic colors only where meaning requires them.

The product should look visually rich because of:

- hierarchy;
- typography;
- spacing;
- data visualization;
- contrast;
- intelligent composition;

not because every surface has a different color.

---

# 4. Default Theme

Initial design should prioritize a dark interface.

Reason:

Semora contains:

- schedules;
- heatmaps;
- charts;
- analytical comparisons;
- dense semester information.

A dark neutral surface can make these elements feel more like an intelligence dashboard and less like university administration software.

However:

- contrast must remain accessible;
- text cannot become low-contrast grey soup;
- cards cannot disappear into the background;
- heatmaps cannot rely on brightness alone.

A light theme may be added later.

It is not required for initial V1 unless implementation is trivial.

---

# 5. Suggested Color System

Exact colors may be tuned during implementation.

Use design tokens rather than scattering literal hex values.

Suggested direction:

## Background

```text
Canvas / deepest background:
#0B0D10

Primary surface:
#111419

Elevated surface:
#171B21

Hover / interactive surface:
#1C2129
```

## Borders

```text
Subtle border:
#252B34

Strong border:
#343C48
```

Borders should usually be subtle.

Avoid placing visible boxes around everything.

## Primary Text

```text
#F5F7FA
```

## Secondary Text

```text
#A9B0BB
```

## Muted Text

```text
#727B88
```

Muted text must still remain legible.

---

# 6. Brand Accent

Recommended Semora accent direction:

> **electric indigo / violet-blue**

Example starting point:

```text
Primary:
#7C6CFF

Hover:
#8C7EFF

Subtle surface:
rgba(124, 108, 255, 0.12)
```

This fits the product because it feels:

- intelligent;
- technical;
- modern;
- distinct from standard "school blue";
- usable against dark neutrals.

Avoid turning the whole application purple.

The accent should mean:

```text
selected
active
interactive
important
Semora intelligence
```

not merely decoration.

---

# 7. Semantic Colors

Semantic colors must carry actual meaning.

## Positive / Comfortable

```text
Green
```

Use for:

- manageable conditions;
- completed work;
- healthy schedule fit;
- positive comparison outcomes.

## Warning

```text
Amber
```

Use for:

- rising workload;
- incomplete data;
- uncertain extraction;
- moderate constraint issues.

## High Pressure

```text
Orange
```

## Critical / Invalid

```text
Red
```

Use for:

- timetable clashes;
- impossible grade targets;
- severe pressure;
- failed validation.

## Information

Brand indigo or cool blue.

---

# 8. Semantic Color Rule

Never use red merely because:

> something is difficult.

Reserve red for states that deserve attention.

Example:

```text
Project Load: High
```

does not necessarily need red.

A student may intentionally prefer project-heavy semesters.

Color meaning should reflect:

```text
risk
warning
invalidity
pressure
```

rather than personal value judgments.

---

# 9. Pressure Color Scale

The workload heatmap requires a consistent progression.

Conceptually:

```text
LIGHT
↓
MANAGEABLE
↓
MODERATE
↓
HIGH
↓
SEVERE
```

Possible progression:

```text
cool neutral
soft green
amber
orange
red
```

However:

users with color-vision deficiencies must still distinguish states.

Therefore also use:

- numeric value;
- label;
- intensity;
- tooltip/text explanation.

Never communicate pressure only through color.

---

# 10. Typography

Typography should feel modern and highly readable.

Recommended primary direction:

```text
Inter
Geist
Manrope
```

or another clean sans-serif with strong numerical legibility.

Avoid:

- playful rounded school fonts;
- excessive geometric display fonts;
- serif body text;
- overly compressed fonts.

---

# 11. Typographic Hierarchy

Semora should use relatively few text sizes.

Suggested hierarchy:

```text
Display / hero:
32–40px

Page title:
26–32px

Section heading:
18–22px

Card title:
14–16px

Body:
14–16px

Secondary / metadata:
12–14px
```

Data-dense areas may use slightly smaller typography.

Do not shrink text simply to fit more information.

---

# 12. Numeric Typography

Numbers are extremely important in Semora.

Examples:

```text
8.7
17 credits
45%
84.3%
3 assessments
```

Numbers should:

- align cleanly;
- be highly legible;
- have strong visual hierarchy;
- ideally use tabular numerals where supported.

Major numbers may use larger typography than surrounding labels.

Example:

```text
8.7
HIGH PRESSURE
```

rather than:

```text
Pressure Score: 8.7
```

---

# 13. Typeface Weight

Avoid bolding everything.

Suggested:

```text
400 normal body
500 labels / controls
600 headings / important metrics
700 sparingly
```

Hierarchy should come from:

- spacing;
- size;
- placement;
- contrast;

not just font weight.

---

# 14. Spacing System

Use a consistent spacing scale.

Suggested:

```text
4
8
12
16
24
32
48
64
```

Most UI spacing should derive from this system.

Dense analytical components can use:

```text
8–12px
```

internal spacing.

Major page regions should breathe.

---

# 15. Layout Philosophy

Avoid:

> **card soup**

where every piece of information exists inside an identical rounded rectangle.

Semora should use:

- open layout regions;
- dividers;
- grouped data;
- tables;
- timelines;
- charts;
- selective panels.

Cards should be used when the content is conceptually self-contained.

Not every heading needs a card underneath it.

---

# 16. Border Radius

Use moderate rather than cartoonish rounding.

Suggested:

```text
Small controls:
6–8px

Cards/panels:
10–14px

Large modal/dialog:
14–18px
```

Avoid:

```text
24px rounded everything
```

which would make Semora feel like a generic consumer AI app.

---

# 17. Shadows

Use minimally.

Dark interfaces should create elevation mostly through:

- surface value;
- subtle border;
- spacing.

Heavy floating shadows should be rare.

---

# 18. Navigation Model

Desktop navigation should use a compact left sidebar.

Suggested structure:

```text
SEMORA

Plan
Active Semester
Courses

────────

[Current Semester]
Fall 2026

────────

Settings
```

During planning:

```text
Plan
```

is primary.

After locking:

```text
Active Semester
```

becomes primary.

Do not expose every feature as a separate top-level nav item.

---

# 19. Navigation by Lifecycle

Semora's navigation should reinforce:

```text
PLAN → LOCK → NAVIGATE
```

Before lock:

primary experience:

```text
Semester Designer
```

After lock:

primary experience:

```text
Semester Command Center
```

Candidate planning remains accessible but no longer dominates.

---

# 20. Mobile Navigation

Mobile should use a bottom navigation or compact navigation pattern.

Possible:

```text
Home
Semester
Grades
More
```

Do not attempt to reproduce the entire desktop sidebar.

The most frequent mobile actions are likely:

- checking what is due;
- checking workload;
- checking grades;
- quickly updating an assessment.

---

# 21. Desktop vs Mobile Philosophy

Desktop is strongest for:

```text
PLAN
```

because users compare:

- timetables;
- multiple semester options;
- metrics;
- course lists.

Mobile is strongest for:

```text
NAVIGATE
```

because users quickly check:

- upcoming assessments;
- pressure;
- grades;
- course state.

The product should support both, but layouts need not be identical.

---

# 22. Core Screen Inventory

V1 should include approximately:

```text
Authentication
Semester Setup
Course Catalogue
Semester Designer
Candidate Comparison
Preferences / Commitments
Lock Confirmation

Active Semester Dashboard
Course Detail
Outline Upload
Extraction Review
Assessment Timeline
Workload Heatmap
Grades
Grade What-If
Settings
```

Avoid multiplying screens unnecessarily.

---

# 23. Semester Setup

First-time flow should feel extremely fast.

User selects:

```text
University
Academic Term
```

Example:

```text
LUMS
Fall 2026
```

Then Semora moves directly into semester planning.

Do not begin with a 12-step onboarding questionnaire.

Preferences may be collected progressively.

---

# 24. Semester Designer — Core UX

This is the signature desktop experience.

Recommended layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Fall 2026                                  Compare Options  │
├───────────────┬─────────────────────────────┬───────────────┤
│               │                             │               │
│ Course        │     Weekly Timetable        │ Semester      │
│ Catalogue     │                             │ Intelligence  │
│               │                             │               │
│ Search        │                             │ 17 credits    │
│ Filters       │                             │ High Project  │
│ Courses       │                             │ Good Schedule │
│               │                             │               │
├───────────────┴─────────────────────────────┴───────────────┤
│ Option A   Option B   + New Option                          │
└─────────────────────────────────────────────────────────────┘
```

This should feel like a **workbench**.

---

# 25. Semester Designer — Candidate Tabs

Candidate semesters should be visible and easy to switch.

Example:

```text
Balanced
Systems Heavy
Easy Friday
+ New Option
```

Avoid hiding candidate options inside dropdowns.

Comparison requires spatial awareness.

---

# 26. Course Selection Interaction

Adding a course should be lightweight.

Possible flow:

```text
Search
↓
Course row
↓
View available sections
↓
Add section
```

If multiple sections exist:

show timing immediately.

Do not force navigation to a separate page just to select a section.

---

# 27. Course Catalogue Item

Course row should prioritize:

```text
Course code
Title
Credits
Sections
```

Secondary:

```text
Instructor
Timing
Capacity
```

Possible visual:

```text
CS 340
Operating Systems

3 credits       2 sections
Mon/Wed 12:30   Dr. X
```

Avoid enormous cards for every course.

A dense searchable list is more appropriate.

---

# 28. Course Details Drawer

Selecting a course may open a side drawer.

Display:

- description;
- sections;
- timings;
- instructor;
- current personal interest;
- career relevance;
- preliminary workload profile where available.

Drawer is preferable to losing the Semester Designer context.

---

# 29. Timetable Design

The weekly timetable is central.

Requirements:

- readable at a glance;
- distinct courses;
- visible commitments;
- obvious clashes;
- compact enough for comparison.

Course colors may be assigned visually, but must not carry semantic value.

Example:

```text
OS = blue
DB = violet
AI4SE = teal
```

These are identity colors only.

---

# 30. Timetable Clashes

Clashes should be unmistakable.

Use:

- red outline;
- overlapping pattern;
- warning icon;
- textual warning.

Example:

```text
⚠ OS Section 2 overlaps with TAship
12:30–1:45
```

Do not rely only on overlapping colored blocks.

---

# 31. Commitment Appearance

Commitments should look visually different from courses.

Example:

Courses:

```text
solid block
```

Commitments:

```text
outlined / subtly striped block
```

This communicates:

> this affects my semester but is not an academic course.

---

# 32. Intelligence Rail

Semester Designer should have an analytical right rail or equivalent region.

Potential information:

```text
17 credits

Academic Intensity
HIGH

Project Load
VERY HIGH

Schedule Quality
GOOD

Commitment Fit
MODERATE

────────

⚠ 3 project-heavy courses
✓ Friday remains free
⚠ Monday heavily constrained
```

This should update immediately as courses change.

---

# 33. Intelligence Presentation

Do not show ten giant progress bars.

Use variety:

```text
metric value
short label
micro-bar
small radar only if genuinely useful
structured findings
```

Preference should be toward readable comparison rather than flashy charts.

---

# 34. Metric Cards

A compact metric could look like:

```text
PROJECT LOAD
8.6
Very High
```

with:

```text
Why?
```

or expandable explanation.

Avoid:

```text
Project Load Score™
```

branding nonsense.

---

# 35. "Why?" Interaction

Explainability is core.

Every non-trivial metric should offer:

```text
Why?
```

Example:

```text
Project Load
8.6 — Very High

Why?
AI4SE          High
Distributed    High
Databases      High

3 project-heavy courses create an interaction penalty.
```

This builds trust.

---

# 36. Candidate Comparison Screen

This should feel closer to comparing laptops or investment portfolios than comparing calendars.

Recommended structure:

```text
             BALANCED        SYSTEMS HEAVY

Credits         17                17

Intensity       6.8               8.2
Project         6.1               8.8
Exam            7.2               6.4
Schedule        7.8               8.1
Career          8.0               9.2

Key Trade-offs
...
```

---

# 37. Comparison Difference Highlighting

Only meaningful differences should visually pop.

If:

```text
7.2 vs 7.3
```

keep neutral.

If:

```text
5.1 vs 8.8
```

highlight.

Avoid visually implying precision that the model does not have.

---

# 38. Comparison Verdict

Do not show:

```text
WINNER
```

Instead:

```text
Best Match for Your Priorities
Most Balanced
Best Schedule
Lowest Workload
```

Then explain the trade-off.

---

# 39. Lock Semester Interaction

Locking is a meaningful transition.

It should feel deliberate.

Example screen:

```text
Ready to lock Fall 2026?

Operating Systems
Databases
AI4SE
Blockchain
Psychology

17 credits

✓ No timetable conflicts
⚠ Project load is high
✓ Friday free
```

CTA:

```text
Lock Semester
```

Secondary:

```text
Keep Planning
```

---

# 40. Lock Should Not Feel Dangerous

Do not use terrifying irreversible language.

Add/Drop exists.

Possible supporting text:

> You can still modify your active semester during Add/Drop.

---

# 41. Active Semester Dashboard

Once locked, the homepage changes.

This screen should answer in order:

```text
1. What matters now?
2. How bad is this week?
3. What is coming next?
4. Where is the next pressure spike?
5. How is my semester going?
```

---

# 42. Dashboard Hierarchy

Recommended desktop structure:

```text
┌───────────────────────────────────────────────────────┐
│ Fall 2026                            Week 5 of 14     │
│                                                       │
│ THIS WEEK                                             │
│ 6.4  MODERATE                                        │
│ Next week: 8.6 HIGH ↑                                 │
├──────────────────────────┬────────────────────────────┤
│ What Matters Now         │ Upcoming Pressure          │
│                          │                            │
│ DB Assignment            │ ▁▂▃▆█▅▃                   │
│ OS Midterm               │                            │
│ AI4SE Proposal           │ Peak: Sep 21–27            │
├──────────────────────────┴────────────────────────────┤
│ Semester Heatmap                                      │
│                                                       │
├───────────────────────────────────────────────────────┤
│ Courses                                               │
└───────────────────────────────────────────────────────┘
```

---

# 43. Dashboard Primary Metric

Do not make the entire dashboard a giant pressure gauge.

Pressure is important but should be contextual.

Example:

```text
THIS WEEK

6.4
MODERATE

Next week rises to 8.6
```

This communicates trajectory.

---

# 44. What Matters Now

This should be one of the most useful regions.

Example:

```text
DB Assignment 2
Due tomorrow
Estimated 4h remaining

OS Midterm
4 days
20%

AI4SE Milestone
6 days
10%
```

Ranking should reflect Workload Engine output.

---

# 45. Task Rows

Avoid giant todo cards.

Use clean rows.

Each assessment row may show:

```text
course badge
assessment title
due date
weight
effort
status
```

Example:

```text
DB    Assignment 2          Tomorrow     8%    ~4h
```

---

# 46. Course Identity Badges

Small course-code chips are useful.

Example:

```text
OS
DB
AI4SE
```

Each may use a stable identity color.

Do not use full course titles everywhere.

---

# 47. Semester Heatmap

This is a signature Semora visualization.

It should communicate the entire term at a glance.

Possible design:

```text
W1  W2  W3  W4  W5  W6  W7  W8  W9  W10 ...
 ░   ░   ▒   ▒   ▓   █   ▓   ▒   █    ▓
```

Each cell displays or reveals:

```text
pressure
band
major drivers
```

---

# 48. Heatmap Interaction

Hover/click:

```text
Week 6
Sep 21–27

8.7 — Severe

OS Midterm
DB Assignment
AI4SE Milestone
TA Grading
```

The user should immediately understand:

> why this cell is dark/intense.

---

# 49. Heatmap Accessibility

Every heatmap cell should expose:

```text
Week
Pressure label
Numeric score
```

to assistive technology and non-color interpretation.

---

# 50. Pressure Curve

A compact line or area chart may supplement the heatmap.

Its job:

> show trajectory.

Not:

> look like a stock market chart.

Avoid excessive axes, gridlines, legends, and labels.

---

# 51. "Next Peak" Component

Potentially very useful.

Example:

```text
NEXT PRESSURE PEAK

Sep 21–27
8.7 — Severe

3 major assessments
+ TA grading

Starts in 9 days
```

This directly communicates foresight.

---

# 52. Course Dashboard Cards

Active course cards may show:

```text
OS
Operating Systems

Current performance: 84.2%
30% graded

Next:
Midterm — Sep 24

Pressure contribution:
High
```

Avoid displaying every statistic at once.

---

# 53. Course Detail Screen

Course detail should combine:

```text
course overview
assessment timeline
grade state
course workload
grading structure
```

Tabs may be:

```text
Overview
Assessments
Grades
Structure
```

Avoid 8+ tabs.

---

# 54. Outline Upload Experience

The upload flow should feel integrated into the course.

Example:

```text
Operating Systems

Set up your course
Upload the course outline and Semora will extract:
✓ grading structure
✓ assessments
✓ important dates
✓ grading policy
```

CTA:

```text
Upload Outline
```

Secondary:

```text
Enter Manually
```

---

# 55. Extraction Processing State

Do not use:

```text
AI magic happening...
```

Use concrete states:

```text
Reading document
Extracting grading structure
Checking assessment weights
Preparing review
```

This reinforces trust.

---

# 56. Extraction Review — Core Principle

The review page should resemble a **verification workspace**, not a chatbot response.

Recommended structure:

```text
Course Identity        ✓
Grading Structure      ⚠
Important Dates        ✓
Policies               —
```

---

# 57. Extraction Review Layout

Desktop:

```text
┌────────────────────────────┬──────────────────────────────┐
│ Extracted Structure        │ Source Evidence              │
│                            │                              │
│ Assignments      20%       │ Page 3                      │
│ Quizzes          10%       │ "Assignments 20%..."        │
│ Midterm          25%       │                              │
│ Final            45%       │                              │
└────────────────────────────┴──────────────────────────────┘
```

Selecting a field updates source evidence.

This should make Semora feel trustworthy.

---

# 58. Extraction Confidence

Do not litter the screen with:

```text
97%
82%
61%
```

confidence values.

Use:

```text
✓ Confident
⚠ Review
? Uncertain
```

and evidence.

Internal confidence remains numeric.

---

# 59. Extraction Warning Design

Warnings should clearly distinguish severity.

Examples:

```text
⚠ Assessment weights total 95%.

? Grading mode was not clearly stated.

⛔ This outline appears to belong to CS 300, not CS 340.
```

---

# 60. Confirmation

Primary action:

```text
Confirm Course Structure
```

Disabled only when blocking conflicts remain.

Secondary:

```text
Save with gaps
```

where product rules permit.

---

# 61. Manual Entry

Manual setup must not feel like a punishment.

Provide a clean form for:

```text
grading categories
assessments
dates
grading mode
```

AI is convenience, not requirement.

---

# 62. Grade Experience

Grades should feel mathematically precise and calm.

Avoid gamification.

No:

```text
🔥 You're crushing it!
😢 Oops!
```

Semora should simply communicate reality.

---

# 63. Grade Summary

Example:

```text
CURRENT PERFORMANCE

84.6%

Based on 42% of the course graded
```

Then:

```text
A- target
Need 85.3% average on remaining work
```

---

# 64. Grade Progress Visualization

Useful representation:

```text
Earned contribution    ██████████
Remaining weight       ░░░░░░░░░
```

But label clearly.

Do not show a traditional 84.6% progress bar that visually implies:

> 84% of the course is complete.

Performance and completion are different.

---

# 65. Graded Weight

Always pair performance with graded amount.

Example:

```text
84.6%
CURRENT PERFORMANCE

42%
OF COURSE GRADED
```

These two numbers should visually coexist.

---

# 66. Target Grade Table

Example:

```text
TARGET    REQUIRED ON REMAINING WORK

A         94.2%
A-        85.3%
B+        76.4%
B         67.5%
```

Impossible targets:

```text
A         Not reachable
```

No dramatic styling required.

---

# 67. What-If UX

Should feel interactive.

Example:

```text
What if...

Final Exam
[ 82 ] %

Remaining assignments
[ 90 ] %

Projected final:
86.1%   A-
```

Hypothetical inputs must be visually distinguishable from real scores.

---

# 68. Relative Grading UX

Example:

```text
MIDTERM

Your score       78
Class mean       69
Difference       +9

+0.82 SD above mean
```

Then clearly:

```text
Letter-grade boundaries are not known.
```

Do not show an invented predicted grade.

---

# 69. Relative Grade Visualizations

A simple distribution marker may eventually be useful if enough statistics exist.

V1 can remain textual.

Correctness beats flashy statistical graphics.

---

# 70. Loading States

Avoid full-page spinners when possible.

Use skeleton states for:

- catalogue;
- dashboard;
- comparison.

Use explicit processing states for:

- document extraction;
- catalogue import.

---

# 71. Empty States

Empty states should guide the next meaningful action.

Bad:

```text
No data found.
```

Good:

```text
No candidate semesters yet.

Create your first option to start comparing workload,
schedule, and course combinations.

[Create Candidate]
```

---

# 72. Active Semester Empty State

Before outlines:

```text
Your semester is locked.

Upload course outlines to unlock:
• assessment timeline
• workload forecasting
• grade intelligence
```

This naturally leads into NAVIGATE.

---

# 73. Error States

Errors should explain:

```text
what happened
what remains safe
what the user can do
```

Example:

```text
We couldn't extract this outline.

Your file was uploaded successfully and no course data
was changed.

[Try Again] [Enter Manually]
```

---

# 74. Confirmation Dialogs

Use confirmation only for meaningful actions:

```text
Lock semester
Drop active course
Delete candidate
Reject extraction
Delete document
```

Do not confirm routine edits.

---

# 75. Toasts

Use small transient notifications for:

```text
Saved
Course added
Grade updated
Assessment completed
```

Do not use toast notifications for critical information that disappears.

---

# 76. Motion

Motion should be subtle.

Appropriate:

- panel transitions;
- candidate-switch animation;
- heatmap updates;
- number transitions;
- drawer opening;
- completion feedback.

Avoid:

- bouncing;
- constant gradients;
- excessive spring animations;
- decorative motion.

Semora should feel responsive, not playful.

---

# 77. Interaction Speed

The product should encourage experimentation.

Therefore:

```text
add course
remove course
switch section
change preference
change commitment
```

should update analysis quickly.

A student should feel comfortable testing:

> "What happens if I replace this?"

---

# 78. Autosave

Candidate changes should generally autosave.

Avoid making users repeatedly press:

```text
Save Semester
```

Planning should feel fluid.

Use explicit save only where necessary.

---

# 79. Recalculation Feedback

When analysis changes:

do not flash the whole screen.

Update affected metrics smoothly.

Potential small label:

```text
Updated
```

if needed.

---

# 80. Hover vs Click

Anything essential must be accessible by click/tap.

Hover may reveal supplementary details on desktop.

Never hide core explanations exclusively behind hover.

---

# 81. Information Density

Different screens deserve different density.

## Catalogue

High density.

## Semester Designer

Medium-high density.

## Comparison

Medium density.

## Dashboard

Medium density.

## Mobile dashboard

Low-medium density.

## Extraction Review

Medium-high density.

Semora should not use one universal card density.

---

# 82. Tables

Tables are appropriate for:

```text
candidate comparisons
grade targets
course catalogue
grading structure
```

Do not avoid tables just because modern dashboards prefer cards.

Tables are excellent for comparison.

---

# 83. Charts

Use charts only when they reveal patterns.

Good:

```text
pressure across semester
```

Less useful:

```text
pie chart showing five courses
```

Avoid chart decoration.

---

# 84. Radar Charts

Potentially tempting for candidate semester profiles.

Default decision:

> **Do not use radar charts in V1 unless they clearly outperform aligned metric comparison.**

Radar charts look impressive but are harder to compare precisely.

Side-by-side bars/table metrics are usually better.

---

# 85. Progress Rings

Avoid excessive rings.

Potentially acceptable for:

```text
data completeness
```

but simple text often works better.

---

# 86. Icons

Use a consistent line-icon library.

Possible:

```text
Lucide
```

Use icons to improve scanning.

Do not add icons to every label.

---

# 87. Course Colors

Stable per workspace.

A course should retain the same identity color across:

- timetable;
- assessment timeline;
- heatmap detail;
- grade screen.

Example:

```text
OS = blue
DB = violet
AI4SE = teal
```

Generate from an accessible curated palette.

---

# 88. Course Color Rule

Course colors identify **which course**.

They must never mean:

```text
good
bad
hard
easy
```

Semantic colors remain separate.

---

# 89. Course Code Priority

In dense UI:

```text
CS 340
```

or:

```text
OS
```

may be more useful than repeatedly showing:

```text
Operating Systems
```

Use full names where context is introduced.

Use course codes where scanning matters.

---

# 90. Terminology

Prefer student language.

Use:

```text
Semester
Course
Section
Assessment
Due
Project
Midterm
Final
Workload
Pressure
```

Avoid unnecessary enterprise language:

```text
Resource allocation
Workstream
Portfolio
Deliverable governance
```

---

# 91. "Pressure" Terminology

Use:

```text
Academic Pressure
Workload Pressure
```

Do not use:

```text
Stress Score
Burnout Score
Mental Load Diagnosis
```

Semora is not making psychological claims.

---

# 92. AI Terminology

Do not plaster:

```text
AI-powered
AI-generated
AI intelligence
```

throughout the UI.

The user cares about:

> what Semora did.

Use AI labels where trust requires it:

```text
Extracted from outline
AI-extracted — please review
```

Otherwise the product should simply work.

---

# 93. Product Copy Style

Copy should be:

- direct;
- concise;
- calm;
- informative.

Good:

```text
Next week is significantly heavier than this week.
```

Bad:

```text
Uh oh! 😱 Looks like next week is going to be CRAZY!
```

---

# 94. Explanation Style

Recommendations should identify cause.

Good:

```text
This option has higher project load because AI4SE,
Databases, and Distributed Systems all contain major projects.
```

Bad:

```text
Semora thinks this option may be more challenging.
```

---

# 95. Confidence Copy

Good:

```text
Analysis confidence: Moderate

Current outlines are missing for 2 courses.
```

Bad:

```text
AI confidence: 68.392%
```

---

# 96. Data Completeness UX

Potential compact component:

```text
ANALYSIS COMPLETENESS
72%

Missing:
• Blockchain outline
• Psychology assessment structure
```

This helps users improve results.

---

# 97. Personal Preferences UX

Avoid exposing a wall of sliders.

Use short preference cards/questions.

Example:

```text
What matters more this semester?

○ Keep workload lighter
○ Balance both
○ Maximize course value
```

Another:

```text
Which do you tolerate better?

Projects  ←────────→  Exams
```

---

# 98. Advanced Preferences

Allow advanced control later through:

```text
Fine tune preferences
```

This can expose more detailed weights.

Default onboarding remains simple.

---

# 99. Commitments UX

Adding a commitment should be lightweight.

Example:

```text
Name:
CS225 TAship

Weekly effort:
5 h

Fixed schedule:
Mon 12:30–2:20
Wed 12:30–2:20

Flexibility:
Low
```

Do not make users build full calendar events.

---

# 100. Commitment Categories

Use category icons/labels mainly for scanning.

No need for elaborate customization.

---

# 101. Schedule Gap UX

Semora may identify:

```text
Tuesday
2h 45m idle gap
```

Highlight within timetable and candidate findings.

This is more meaningful than merely producing a schedule compactness score.

---

# 102. Findings Design

Findings should look like analytical observations.

Example:

```text
PROJECT CONCENTRATION
High

3 selected courses contain major projects.
```

or:

```text
SCHEDULE
Positive

Friday remains free.
```

Avoid alert boxes for every finding.

---

# 103. Finding Hierarchy

Possible:

```text
Critical
Warning
Insight
Positive
```

Not every useful observation needs warning styling.

---

# 104. Comparison Findings

Example:

```text
WHY BALANCED FITS YOU BETTER

↓ Lower project concentration
↑ Better TAship compatibility
≈ Similar career relevance

Trade-off:
Friday is no longer fully free.
```

This is extremely close to the core product promise.

---

# 105. Sidebar Density

Keep sidebar narrow.

Avoid:

```text
Dashboard
Courses
Calendar
Planner
Tasks
Workload
Grades
AI
Reports
Analytics
Settings
```

That would signal a bloated platform.

---

# 106. Primary Desktop Navigation Proposal

Planning state:

```text
Semora

PLAN
Semester Designer
Courses

YOUR SEMESTER
Fall 2026

Settings
```

Active state:

```text
Semora

SEMESTER
Overview
Courses
Grades

PLAN
Semester Designer

Settings
```

Exact labels may be tuned.

---

# 107. Command Center Naming

The internal docs call it:

```text
Semester Command Center
```

The product UI may simply say:

```text
Fall 2026
```

or:

```text
Semester Overview
```

Avoid overly dramatic product terminology unless it actually feels good in testing.

---

# 108. Home Page After Login

If workspace exists:

send user directly to relevant lifecycle state.

```text
PLANNING
→ Semester Designer

ACTIVE
→ Semester Overview
```

Do not insert a useless dashboard before the real product.

---

# 109. URL Philosophy

Routes should remain understandable.

Example:

```text
/app/fall-2026/plan
/app/fall-2026/compare
/app/fall-2026
/app/fall-2026/courses/os
/app/fall-2026/grades
```

Exact architecture may differ.

Avoid opaque routing if unnecessary.

---

# 110. Mobile Semester Overview

Recommended order:

```text
Fall 2026

This Week
6.4 Moderate
Next week ↑ 8.6

What Matters Now

Next Pressure Peak

Upcoming

Courses
```

Heatmap can appear horizontally scrollable or compressed.

---

# 111. Mobile Semester Designer

Support it, but do not force desktop layout into mobile.

Possible sequence:

```text
Candidate selector
↓
Selected courses
↓
Schedule
↓
Intelligence
```

Comparison may use swipe/stacked cards rather than a wide table.

---

# 112. Mobile Tables

Convert comparison tables to stacked metric rows.

Example:

```text
PROJECT LOAD

Balanced
6.1

Systems Heavy
8.8
```

Do not require horizontal scrolling for every table.

---

# 113. Responsive Breakpoints

Use a small number of breakpoints.

Conceptually:

```text
mobile
tablet
desktop
wide desktop
```

Avoid dozens of bespoke breakpoint hacks.

---

# 114. Max Content Width

Data-heavy screens such as Semester Designer may use most available width.

Reading-heavy screens should have constrained width.

Do not force the entire application into:

```text
max-width: 1200px
```

if timetable comparison genuinely benefits from more room.

---

# 115. Accessibility

Minimum expectations:

- keyboard navigable;
- visible focus states;
- labeled controls;
- semantic headings;
- sufficient contrast;
- charts explained in text;
- heatmap not color-only;
- form errors associated with fields.

Accessibility should be built into components from the start.

---

# 116. Focus State

Use a clear brand-accent focus ring.

Do not remove browser focus without replacement.

---

# 117. Reduced Motion

Respect:

```text
prefers-reduced-motion
```

where feasible.

Animations should never convey essential information alone.

---

# 118. Form Design

Labels above inputs are preferred for clarity.

Avoid placeholder-only forms.

Validation should appear near the relevant field.

---

# 119. Input Density

Course/grade forms can be relatively compact.

Account/settings forms can breathe more.

---

# 120. Sliders

Use only when continuous values make sense.

Good:

```text
Project preference
```

Less good:

```text
Credit hours
```

Use direct numeric/select controls for exact values.

---

# 121. Modals vs Drawers

Use drawers for contextual editing where preserving background context matters.

Examples:

```text
course details
edit commitment
assessment details
```

Use modals for:

```text
confirm lock
delete
small focused actions
```

Avoid nesting modals.

---

# 122. Course Editing

Course structure editing should preferably occur in a dedicated structured screen rather than tiny modal.

Grading schemes can be complex.

---

# 123. Assessment Timeline

Potential design:

```text
SEP 21
DB Assignment 2     8%

SEP 24
OS Midterm         20%

SEP 25
AI4SE Milestone    10%
```

Group by date/week.

Do not make it a generic calendar if a timeline communicates upcoming work more clearly.

---

# 124. Timeline vs Calendar

Default NAVIGATE view should prioritize timeline/list.

Calendar view is optional.

Students generally care:

> what comes next?

not:

> show me a full monthly calendar grid.

---

# 125. Completion Interaction

Marking an assessment complete should be easy.

Possible:

```text
checkbox / action
```

But graded assessments should distinguish:

```text
work complete
```

from:

```text
score received
```

---

# 126. Completion Feedback

After completing:

```text
DB Assignment 2
```

the heatmap may subtly update.

Potential small feedback:

```text
Next week's pressure decreased.
```

This demonstrates Semora's intelligence without gamification.

---

# 127. Empty Course Structure

If no outline/manual structure exists:

```text
No assessment structure yet.

Upload your course outline or enter the course manually
to enable workload and grade intelligence.
```

---

# 128. Unknown Information

Unknown must visually look intentionally unknown.

Use:

```text
TBA
Unknown
Not provided
```

not blank cells.

---

# 129. Approximate Information

Example:

```text
Midterm
Week 7 · approximate
```

Use subtle uncertainty indicator.

Do not show a fake exact date.

---

# 130. Data Provenance

Where useful:

```text
From course outline
Entered by you
Estimated
```

Could appear as small metadata or tooltip.

Especially important for:

- workload estimates;
- grading modes;
- AI-extracted fields.

---

# 131. Estimated Workload

If:

```text
Estimated effort: 6h
```

make `Estimated` visible.

If user overrides:

```text
Your estimate: 9h
```

This distinction strengthens trust.

---

# 132. User Overrides

Any user-overridden estimate should be visually clear and reversible.

Potential:

```text
9h
Your estimate

Reset to Semora estimate
```

---

# 133. Visual Hierarchy Rule

Every screen should have:

```text
ONE primary question
ONE primary action
```

Examples:

Semester Designer:

> Which semester works best?

Action:

> modify/compare candidates.

Extraction Review:

> Is this course structure correct?

Action:

> confirm.

Dashboard:

> What matters now?

Action:

> inspect/update assessments.

---

# 134. Avoid Dashboard Decoration

Do not add meaningless:

```text
Total courses: 5
Total assignments: 16
Total credits: 17
```

as four giant KPI cards merely because dashboards usually have KPI cards.

Only elevate information that changes decisions.

---

# 135. Metrics Worth Elevating

Examples:

```text
This week pressure
Next pressure peak
Current performance
Remaining grade requirement
Schedule conflict
```

These influence action.

---

# 136. Course Count Is Usually Not a KPI

The student knows they are taking five courses.

Do not waste prime screen real estate telling them.

---

# 137. Branding

Logo should be simple.

Potential visual concept:

```text
S / semester layers / stacked timeline / subtle orbit
```

Avoid:

- graduation caps;
- books;
- pencils;
- generic AI sparkles.

Semora should feel like university software made for students, not school software.

---

# 138. Wordmark

A lowercase or title-case:

```text
Semora
```

wordmark can work well.

No need for complicated identity during V1.

---

# 139. Favicon

Should remain recognizable at 16–32px.

Simple geometric mark.

---

# 140. Landing Page

Not a V1 engineering priority.

When eventually created, the landing page should demonstrate:

```text
Compare semesters
See workload heatmap
Understand grade targets
```

rather than generic:

> Transform your academic journey with AI.

---

# 141. Product Screens Are Marketing

During early pilot, a polished Semester Designer screenshot will sell the product better than elaborate landing-page copy.

Prioritize application quality.

---

# 142. Visual References

Semora should take inspiration from the clarity and density balance of modern analytical products rather than directly copying any specific application.

Useful conceptual references:

```text
Linear
Raycast
Vercel
Stripe dashboards
modern developer tooling
high-quality finance/analytics products
```

But Semora should remain warmer and more student-oriented than pure developer tooling.

---

# 143. Avoid Generic Shadcn Look

Using Shadcn components is acceptable.

Shipping unchanged default Shadcn visual language is not.

If used:

customize:

- colors;
- spacing;
- typography;
- card treatment;
- tables;
- navigation;
- chart styles.

The goal is:

```text
Semora
```

not:

```text
Shadcn starter dashboard
```

---

# 144. Component Design System

Create reusable primitives for:

```text
Button
Input
Select
Dialog
Drawer
Tooltip
Tabs
Badge
Metric
Finding
CourseBadge
StatusLabel
DataTable
EmptyState
Skeleton
```

Then Semora-specific components:

```text
SemesterMetric
PressureBadge
CourseBlock
Timetable
PressureHeatmap
CandidateComparison
AssessmentRow
GradeTargetTable
ExtractionField
EvidencePanel
```

---

# 145. Button Hierarchy

Use:

```text
Primary
Secondary
Ghost
Destructive
```

Avoid five equally loud button styles.

Primary accent should normally appear once per focused region.

---

# 146. CTA Discipline

Example extraction review:

Primary:

```text
Confirm Course Structure
```

Secondary:

```text
Save with Gaps
```

Ghost:

```text
Cancel
```

Not three purple buttons.

---

# 147. Badge Discipline

Badges are useful for:

```text
HIGH
RELATIVE
TBA
PROJECT
```

Do not badge every word in the interface.

---

# 148. Semantic Labels

Examples:

```text
High
Moderate
Relative
Absolute
Verified
Estimated
TBA
```

Keep label vocabulary stable.

---

# 149. Skeleton System

Build a few reusable skeleton patterns:

```text
course row
dashboard metric
assessment row
candidate analysis
```

Do not create unique loading spinners for every screen.

---

# 150. Design Token System

At minimum define tokens for:

```text
colors
spacing
radius
font sizes
font weights
borders
shadows
transitions
z-index
```

This makes future theme tuning much easier.

---

# 151. Chart Tokens

Define:

```text
pressure scale
course identity palette
grid line
axis text
tooltip surface
```

centrally.

---

# 152. Course Identity Palette

Create around:

```text
8–12 accessible distinct colors
```

for course identification.

Avoid neon saturation against dark background.

---

# 153. UI State Coverage

Every major component should consider:

```text
normal
hover
focus
selected
disabled
loading
error
empty
partial data
```

Especially important for analytical interfaces.

---

# 154. Data Table Sorting

Where sorting exists:

make current sort obvious.

Do not add sorting controls where collections are tiny.

---

# 155. Search

Course search should be fast and forgiving.

Typing:

```text
operating
CS340
340
```

should reasonably locate the course.

Exact implementation belongs outside UI spec.

---

# 156. Filters

Useful potential filters:

```text
department
credits
days
time range
```

Do not build an enormous advanced search system initially.

---

# 157. Section Selection

Section options should show schedule prominently.

Example:

```text
Section 1
Mon/Wed 12:30–1:45
Dr. X

Section 2
Tue/Thu 2:00–3:15
Dr. Y
```

A student's section decision is heavily schedule-driven.

---

# 158. Capacity Display

If only capacity is known:

show:

```text
Cap: 40
```

Do not imply:

```text
12 seats available
```

without actual enrollment data.

---

# 159. Comparison of Timetables

When comparing candidates, allow:

```text
Schedule
```

to be inspected side-by-side or switched easily.

Do not force all timetable information into metric scores.

---

# 160. Print / Export

Not V1 priority.

If added later:

possible useful export:

```text
semester summary
assessment calendar
```

Do not build early.

---

# 161. Notification UX

Notifications are future scope.

The initial dashboard itself should provide value without push notifications.

Do not design V1 around notification dependence.

---

# 162. Monetization UI

Billing is not V1.

Do not place:

```text
PRO
UPGRADE
LOCKED
```

badges throughout early dogfooding.

First prove value.

---

# 163. Future Pro Boundary

If monetization arrives later:

paid features should feel like deeper intelligence, not arbitrary restrictions on basic academic organization.

Potential:

```text
advanced comparisons
unlimited what-if scenarios
historical course intelligence
personalized workload learning
```

This belongs later.

---

# 164. Design Review Questions

Before accepting a major screen, ask:

### Hierarchy

Can the user identify the main point in under five seconds?

### Density

Is important information visible without overwhelming them?

### Explainability

Can the user understand where intelligence came from?

### Actionability

Does this screen help the student make or prepare for a decision?

### Trust

Are estimates, facts, and AI-derived information distinguishable?

### Lifecycle

Does the screen clearly belong to PLAN, LOCK, or NAVIGATE?

---

# 165. Semester Designer Success Test

Show the screen to a student for five seconds.

They should understand:

> "This lets me build and compare possible semesters."

If they think:

> "This is a timetable app."

the design has failed to communicate Semora's differentiator.

---

# 166. Dashboard Success Test

Show active-semester dashboard for five seconds.

Student should be able to answer:

```text
How bad is this week?
What matters next?
Is a worse period coming?
```

---

# 167. Extraction Review Success Test

Student should immediately understand:

> "Semora extracted this from my outline and wants me to verify it."

If it looks like immutable system output, the design has failed.

---

# 168. Grade Screen Success Test

Student should immediately distinguish:

```text
current performance
amount graded
remaining requirement
```

If these blur together, redesign.

---

# 169. Visual Anti-Patterns

Avoid:

```text
gradient borders around every card
glassmorphism everywhere
giant floating blobs
AI sparkle icons everywhere
rainbow gradients
massive 24px radii everywhere
seven KPI cards in every dashboard
excessive pill-shaped controls
tiny grey text
three nested cards
huge empty hero areas inside the app
```

---

# 170. UX Anti-Patterns

Avoid:

```text
forcing full onboarding before user can explore
saving manually after every edit
hiding explanations
making AI output irreversible
making unknown data look like zero
requiring community data
making mobile users manipulate giant desktop tables
showing false precision
```

---

# 171. V1 Design Priority Order

Design effort should follow:

```text
1. Semester Designer
2. Candidate Comparison
3. Active Semester Dashboard
4. Extraction Review
5. Workload Heatmap
6. Grade Experience
7. Course Catalogue
8. Secondary settings/admin screens
```

Do not spend two days perfecting login while the Semester Designer looks generic.

---

# 172. Phase-Based UI Implementation

## Phase 0

Create:

```text
design tokens
application shell
navigation
auth screens
base components
```

Do not over-design.

## Phase 1

Focus:

```text
course catalogue
course details
```

## Phase 2

Highest design priority:

```text
Semester Designer
timetable
commitments
candidate navigation
```

## Phase 3

Focus:

```text
intelligence rail
metric explanations
candidate comparison
findings
```

## Phase 4

Focus:

```text
lock flow
active semester shell
```

## Phase 5

Focus:

```text
outline upload
processing
extraction review
evidence view
```

## Phase 6

Focus:

```text
dashboard
assessment timeline
heatmap
pressure views
```

## Phase 7

Focus:

```text
grade summary
targets
what-if analysis
relative grading
```

---

# 173. Visual Polish Rule

Polish should improve:

```text
clarity
hierarchy
recognition
trust
```

before decorative novelty.

---

# 174. Design Iteration Rule

The initial UI specification is directional, not sacred.

If dogfooding reveals:

- timetable is too small;
- heatmap is ignored;
- comparison is confusing;
- metrics take too much space;

change the design.

Important permanent direction changes should be recorded in:

```text
DECISIONS.md
```

---

# 175. Codex UI Instruction

When implementing major UI, agents should read:

```text
PRODUCT.md
CURRENT_STATE.md
UI_UX.md
```

plus the relevant engine/product specification.

Agents must not independently invent a completely different visual system for each phase.

---

# 176. Codex Design Rule

Before creating a new component, first inspect existing:

```text
design tokens
primitives
Semora-specific components
```

Reuse established patterns.

Avoid implementation drift where:

```text
Phase 2 buttons
Phase 5 buttons
Phase 7 buttons
```

all look like different products.

---

# 177. UI Review Rule

A feature is not visually complete simply because:

```text
all data appears somewhere.
```

For major screens, inspect:

- visual hierarchy;
- responsive behavior;
- empty states;
- long text;
- missing data;
- realistic values;
- loading;
- error states.

---

# 178. Real Data Rule

Design using realistic semester data.

Do not use:

```text
Course 1
Course 2
Test Assignment
```

for all development screenshots.

Use realistic:

```text
Operating Systems
Databases
AI4SE
Midterm
Project Milestone
```

This exposes actual layout problems.

---

# 179. Long Course Names

Layouts must handle:

```text
Advanced Topics in Machine Learning
```

without breaking.

Course codes can serve as compact identifiers.

---

# 180. Stress Testing UI

Test:

```text
5–6 courses
multiple commitments
10+ assessments in one month
relative grading
unknown dates
long professor/course names
high-pressure week
no-pressure week
```

Do not optimize only for pretty demo data.

---

# 181. Empty Semester State

Semora should still look intentional before data exists.

Example:

```text
Build your Fall 2026 semester

Search courses and create different options.
Semora will compare workload, schedule, and fit as you go.

[Add First Course]
```

---

# 182. Full Semester State

The design must scale from:

```text
0 courses
```

to:

```text
5–6 courses
20+ assessments
multiple commitments
```

without fundamentally changing interaction patterns.

---

# 183. Brand Emotional Goal

Semora should create the feeling of:

> **"I have visibility."**

That is more important than making the interface feel:

> productive

or:

> motivational.

---

# 184. Product Design North Star

Every major screen should improve one of three things:

```text
UNDERSTANDING
DECISION QUALITY
FORESIGHT
```

If a UI element does none of these, question whether it belongs.

---

# 185. Final Visual Rule

Semora should look like:

> **a polished intelligence tool built specifically around the structure of university semesters**

not:

> **a generic dashboard template that happens to contain course data.**

---

# 186. Final UX Rule

The ideal user reaction is not:

> "There are a lot of features here."

It is:

> **"Oh. I can finally see what this semester is going to look like."**
