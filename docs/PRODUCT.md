# Semester Intelligence — Product Specification

**Status:** Product direction locked
**Version:** 0.1
**Initial market:** LUMS
**Product architecture:** University-agnostic
**Primary platform:** Web
**Development priority:** Small, polished, usable V1 within one month
**Working tagline:** **Design a semester you won't regret. See the hard weeks before they hit you.**

---

# 1. Product Thesis

University students are normally given tools for **registering courses** and **viewing schedules**, but relatively little help answering the harder questions:

* Is this combination of courses actually manageable?
* What kind of workload am I creating for myself?
* Am I accidentally taking several project-heavy or assessment-heavy courses together?
* How does this semester fit around TAships, societies, work, gym, commuting, or other commitments?
* Which of several valid semester combinations fits my priorities best?
* Once the semester starts, when are my genuinely difficult weeks coming?
* How much academic pressure is concentrated into a particular period?
* How am I performing across my courses?
* Which remaining assessments matter most?

Students therefore construct this understanding manually from:

* course catalogues;
* course memos;
* registration portals;
* timetable information;
* course outlines;
* grading schemes;
* advice from previous students;
* personal spreadsheets;
* calendars;
* WhatsApp messages;
* screenshots;
* memory.

Semester Intelligence converts these fragmented inputs into a single model of the student's semester.

The product follows one continuous lifecycle:

> **PLAN → LOCK → NAVIGATE**

Before the semester, it helps the student design and compare possible semesters.

After the semester is finalized, the same model becomes a live semester dashboard for workload, assessments, commitments, grades, and upcoming academic pressure.

---

# 2. Core Product Principle

Semester Intelligence is **not a generic AI student planner**.

Its primary value is not:

> "Here are your deadlines."

Its primary value is:

> **"Here is what your semester actually looks like as a system."**

The product reasons across courses rather than treating each course independently.

Five individually reasonable courses can combine into a terrible semester.

For example:

* three courses may all have large semester projects;
* multiple courses may place midterms during the same week;
* weekly quizzes across several courses may create constant assessment pressure;
* a course with an apparently reasonable workload may clash badly with a TAship;
* a timetable may technically be valid but create exhausting fragmented days;
* a student may intentionally prefer a harder course because of career relevance;
* two students may experience the same course differently.

Semester Intelligence therefore evaluates the **composition** of the semester, not merely its validity.

---

# 3. Target User

## 3.1 Initial User

The V1 user is a university student who:

* has meaningful freedom in selecting courses;
* regularly compares multiple course combinations;
* cares about workload and schedule quality;
* has commitments beyond coursework;
* receives detailed course outlines;
* wants more information than a normal timetable provides.

Typical additional commitments may include:

* TAships;
* student societies;
* internships;
* research;
* part-time work;
* sports;
* gym;
* commuting;
* personal projects.

## 3.2 Initial Beachhead

The first deployment will target **LUMS students** because:

* course memos are available;
* course timings are available;
* course outlines are available;
* the initial developer understands registration behaviour and terminology;
* potential test users are readily accessible;
* the product can be dogfooded during an actual semester.

LUMS-specific import formats are acceptable.

LUMS-specific assumptions in the **core domain model are not**.

A course must remain a course.

A section must remain a section.

A semester must remain a semester.

The application should eventually support another university by changing import/adaptation logic rather than rewriting the product.

---

# 4. Product Lifecycle

# Phase A — PLAN

The user is deciding what to take.

Semester Intelligence helps construct, validate, score, and compare possible semesters.

The user should be able to answer:

> "Which semester should I choose?"

rather than merely:

> "Which semester is technically possible?"

---

# Phase B — LOCK

The student finalizes registration.

A candidate semester becomes the active semester.

This transition is explicit.

After locking:

* selected courses become active courses;
* candidate alternatives remain historical planning data if desired;
* the user uploads actual course outlines;
* richer course information replaces preliminary estimates;
* assessment and grading structures become authoritative.

The semester may still be editable during Add/Drop.

---

# Phase C — NAVIGATE

The semester is underway.

Semester Intelligence becomes the student's semester command center.

The user should be able to answer:

* What matters today?
* What is due soon?
* How difficult is this week?
* How bad is next week?
* Which assessments are creating that pressure?
* What should I begin earlier?
* How is my performance changing?
* How much of a course grade remains?
* How does academic workload interact with my other commitments?

---

# 5. PLAN — Semester Designer

## 5.1 Course Catalogue

The system stores available courses and sections for a semester.

At minimum:

* course code;
* course title;
* credit hours;
* course description;
* section;
* instructor where available;
* capacity where available;
* class days;
* start time;
* end time.

Optional information may later include:

* prerequisites;
* degree requirement categories;
* department;
* historical offering data.

---

# 5.2 Candidate Semester

A user can create multiple candidate semesters.

Example:

### Option A

* Operating Systems
* Databases
* AI4SE
* Distributed Systems
* Psychology

### Option B

* Operating Systems
* Databases
* AI4SE
* Blockchain
* Psychology

Candidate semesters should be independently editable and comparable.

---

# 5.3 Hard Constraints

Hard constraints determine whether a semester is valid.

Initial hard constraints include:

* timetable clashes;
* selected sections;
* credit count.

The architecture should support additional constraints later without requiring redesign.

Possible future constraints include:

* prerequisites;
* maximum credits;
* departmental rules;
* degree requirements.

These are not required for V1 unless particularly easy to support.

---

# 5.4 Personal Commitments

The semester model includes life outside coursework.

Users can define recurring or one-off commitments.

Examples:

### TAship

Monday
12:30–2:20 PM

Wednesday
12:30–2:20 PM

Estimated additional work:
3 hours/week

### Student Society

Estimated:
5 hours/week

Known event:
October 13

### Gym

Monday / Tuesday / Thursday / Saturday
~1.5 hours

Commitments may contain:

* name;
* category;
* recurring schedule;
* estimated weekly effort;
* specific high-intensity dates;
* flexibility.

The purpose is **not** to become a general calendar application.

Commitments exist because they affect semester feasibility and pressure.

---

# 5.5 Preferences

A student can specify what they value.

Examples:

* lower overall workload;
* career relevance;
* subject interest;
* schedule compactness;
* free weekdays;
* fewer early classes;
* fewer late classes;
* reduced project concentration;
* reduced examination concentration;
* grade safety;
* preference for continuous assessment;
* preference for exams over projects;
* maximum number of difficult technical courses.

Preferences are not hardcoded globally.

Different users should legitimately receive different recommendations from the same course set.

---

# 5.6 Course Workload Profile

A course is represented by more than credit hours.

Possible workload dimensions include:

* continuous workload;
* project intensity;
* assignment frequency;
* quiz frequency;
* examination intensity;
* reading intensity;
* lab intensity;
* schedule burden;
* assessment fragmentation;
* expected outside-class effort;
* uncertainty.

Initially, some dimensions may be estimates derived from structural course information.

After an outline is uploaded, estimates should be refined.

Eventually, historical community data may refine these values further.

---

# 5.7 Semester Composition

The system analyzes interactions between courses.

Examples:

> Three selected courses contain major semester projects.

> Four selected courses use frequent quizzes.

> The semester has unusually high continuous-assessment pressure.

> Most assessment weight appears concentrated around examination periods.

> The timetable is valid but creates four long campus gaps.

> Wednesday contains over six hours of fixed academic activity.

> Combined with the user's TAship, Monday becomes unusually constrained.

The semester should be understood as a composition, not a sum of isolated course scores.

---

# 5.8 Semester Scoring

A candidate semester receives multiple scores.

There should **not** be one mysterious universal "Semester Score."

Possible dimensions:

* Academic Intensity
* Schedule Quality
* Continuous Workload
* Project Intensity
* Exam Intensity
* Assessment Fragmentation
* Commitment Compatibility
* Lifestyle Fit
* Interest Fit
* Career Relevance
* Overall Risk

The scoring engine must remain explainable.

The UI should be able to answer:

> **Why did this semester receive this score?**

A score without explanation is not sufficient.

---

# 5.9 Comparison

Students can compare candidate semesters side-by-side.

Example comparison:

| Metric             | Option A | Option B |
| ------------------ | -------: | -------: |
| Academic Intensity |      8.1 |      6.9 |
| Project Load       |      9.0 |      6.2 |
| Exam Load          |      6.1 |      7.5 |
| Schedule Quality   |      8.0 |      7.4 |
| Lifestyle Fit      |      5.8 |      7.8 |
| Career Relevance   |      9.2 |      8.1 |

The system should then explain meaningful differences.

Example:

> Option A provides stronger systems depth but combines three project-heavy courses with your existing TAship.

> Option B has slightly higher exam concentration but substantially lower continuous workload.

The system should never pretend that one option is objectively correct when the trade-off depends on the user's preferences.

---

# 6. LOCK — Finalizing a Semester

A candidate semester can be explicitly locked.

Locking establishes the semester as the active semester.

The product then requests final course information, particularly course outlines.

During Add/Drop, the student may unlock or replace courses.

Changes should preserve enough history for future analysis but should not create unnecessary complexity in V1.

---

# 7. AI Course Outline Extraction

Users upload course outlines in supported document formats.

The extraction system attempts to identify:

* course identity;
* instructor;
* grading structure;
* assignments;
* quizzes;
* projects;
* midterm;
* final;
* participation;
* attendance;
* assessment weights;
* known assessment dates;
* grading type;
* absolute grade thresholds;
* relative grading statements;
* late policies;
* relevant recurring assessment rules.

The AI is an **extractor**, not the authority.

Extracted information must be reviewable before becoming canonical.

Example:

> Midterm — 25%
> Final — 35%
> Assignments — 20%
> Quizzes — 10%
> Participation — 10%

User:

**Confirm**

or edit.

---

# 8. Extraction Confidence

AI-derived information should carry confidence where appropriate.

Examples:

### High Confidence

> "The final examination is worth 40%."

### Medium Confidence

> "Approximately six quizzes will be conducted."

### Uncertain

> "Grading appears to be relative, but the document does not explicitly state this."

The product must prefer:

> **"I am not sure."**

over inventing authoritative course information.

---

# 9. NAVIGATE — Semester Command Center

After locking and importing outlines, the home experience shifts toward operating the active semester.

The dashboard should prioritize:

1. urgent assessments;
2. upcoming pressure;
3. important course changes;
4. academic performance;
5. semester-level patterns.

It should not become a generic productivity dashboard.

---

# 10. Assessment Timeline

The product provides one timeline across all active courses.

Assessment objects may include:

* assignment;
* quiz;
* project milestone;
* presentation;
* midterm;
* final;
* participation deadline;
* other graded work.

Each assessment should contain, where known:

* course;
* title;
* due date/time;
* weight;
* type;
* estimated effort;
* completion status;
* score after grading.

---

# 11. Workload / Pressure Engine

A central feature of the product is an upcoming workload visualization.

The engine must not simply count deadlines.

Two 1% quizzes should not automatically be considered more severe than one 30% midterm.

Pressure may incorporate:

* assessment weight;
* assessment type;
* estimated effort;
* time remaining;
* course difficulty;
* number of simultaneous assessments;
* fixed commitments;
* user-specific workload tendencies.

The exact scoring formula belongs in `WORKLOAD_ENGINE.md`.

---

# 12. Workload Heatmap

The product should make difficult periods visually obvious.

Example:

### September

Week 1 — 4.2 / Moderate
Week 2 — 6.3 / Elevated
Week 3 — 8.9 / **High**
Week 4 — 5.1 / Moderate

Selecting Week 3 explains:

> OS Midterm — 20%
> DB Assignment — 8%
> AI4SE Milestone — 10%
> Society event — fixed commitment

The system should communicate:

> **why the week is difficult**

rather than only assigning a number.

---

# 13. Pressure Forecasting

The system may provide simple actionable observations.

Examples:

> Next week is significantly heavier than your current week.

> Your largest assessment cluster begins in eight days.

> Two major project milestones occur during the same period.

> Your society event overlaps with a high academic-pressure week.

Early versions must avoid pretending to know the exact number of hours required when insufficient information exists.

---

# 14. Grade Engine

Grades must primarily be computed deterministically.

The LLM should not perform arithmetic that can be performed by code.

---

# 15. Absolute Grading

When thresholds are known:

Example:

A: ≥ 90
A-: ≥ 85
B+: ≥ 80

The system can calculate:

* current weighted score;
* completed assessment weight;
* remaining assessment weight;
* required scores for target grades;
* best/worst mathematically possible outcomes.

Example:

> Current weighted performance: 86.2%

> 45% of the course has been graded.

> To finish at or above 85%, you need an average of at least X% across remaining assessments.

---

# 16. Relative Grading

The product must **not fabricate letter-grade predictions** for relative courses without sufficient information.

If no class statistics are available:

> Relative grading detected. Final letter-grade projection is unavailable because class distribution data has not been provided.

If statistics are available, useful calculations may include:

* score versus mean;
* score versus median;
* standard deviations above/below mean;
* assessment-level percentile if enough information exists.

Any attempt at letter-grade estimation must be explicitly labelled as uncertain and is not required for V1.

---

# 17. Manual Academic Updates

Not every assessment or date will exist in the original outline.

V1 therefore supports manually:

* adding assessments;
* changing dates;
* modifying weights;
* entering scores;
* correcting course structures.

The application must remain useful without integrations.

---

# 18. Future Change Detection

Eventually, students may provide emails, announcements, or other communications.

Example:

> Assignment 2 has been extended from September 14 to September 17.

The system could propose:

> **Detected deadline change**
>
> DB Assignment 2
> September 14 → September 17
>
> Apply update?

This is explicitly **future scope** unless implementation proves extremely cheap.

---

# 19. Personalization

The long-term system should learn the difference between:

> "This course is generally difficult."

and:

> "This kind of course is difficult for this student."

Potential personalization signals:

* previous workload estimates;
* actual time spent;
* preferred assessment styles;
* historic performance;
* project-heavy versus exam-heavy preference;
* schedule preferences.

V1 only requires explicit preferences.

Automatic learning belongs to later phases.

---

# 20. Community Course Intelligence

Community intelligence is **not required for the product to work**.

This is a hard product rule.

A single student with no other users must receive useful value.

Future community data may include:

* reported workload;
* estimated weekly effort;
* project intensity;
* course difficulty;
* grading experience;
* assessment structure;
* semester-specific outline history.

This data may improve Course Fit in the future.

It cannot become a V1 dependency.

---

# 21. Data Flywheel

The long-term product may naturally generate better course intelligence.

```text
Students use Semester Intelligence
        ↓
Structured course information accumulates
        ↓
Students optionally contribute workload experience
        ↓
Historical course intelligence improves
        ↓
Semester Designer becomes better
        ↓
More students use Semester Intelligence
```

Network effects enhance value.

They do not create baseline value.

---

# 22. AI Philosophy

AI should be used where ambiguity exists.

Good uses:

* interpreting course outlines;
* extracting assessments;
* understanding unusual grading language;
* explaining semester trade-offs;
* summarizing why a semester is risky;
* interpreting natural-language preferences.

AI should **not** replace deterministic systems unnecessarily.

Do not use LLMs for:

* timetable clash detection;
* credit calculations;
* grade arithmetic;
* weighted score calculations;
* basic date comparisons;
* known constraint checks;
* deterministic sorting/filtering.

General rule:

> **Use software for facts and mathematics. Use AI for interpretation and ambiguity.**

---

# 23. Explainability

Any recommendation affecting course selection should be explainable.

Bad:

> Semester Score: 63.

Good:

> This semester scores poorly on workload balance because three selected courses have major projects and two contain weekly quizzes.

Users should be able to disagree with assumptions.

If a course workload estimate is wrong, the user should be able to change it.

---

# 24. V1 Feature Contract

The one-month V1 consists of:

1. **Course catalogue import**
2. **Course/section browsing**
3. **Candidate semester creation**
4. **Timetable clash detection**
5. **Credit calculation**
6. **Personal commitments**
7. **User preference configuration**
8. **Semester composition analysis**
9. **Explainable semester scoring**
10. **Side-by-side candidate comparison**
11. **Lock Semester**
12. **Course outline upload**
13. **AI outline extraction**
14. **Human verification/editing of extracted data**
15. **Unified assessment timeline**
16. **Workload heatmap**
17. **Upcoming pressure analysis**
18. **Manual assessment management**
19. **Grade tracking**
20. **Absolute-grade target calculations**
21. **Safe handling of relative grading**

That is the product.

---

# 25. Explicit V1 Non-Goals

The following are **not V1 features**.

They must not be introduced simply because implementation appears interesting.

* LMS integration
* Gmail integration
* WhatsApp integration
* professor ratings
* LDF scraping
* student reviews
* public course discussions
* social feeds
* AI tutoring
* notes
* flashcards
* Pomodoro timers
* attendance management
* friend schedules
* course swaps
* carpooling
* degree planning
* complete graduation requirement tracking
* mobile-native application
* automatic university registration
* browser extensions
* university admin dashboards
* institutional analytics
* automated study plans
* study-content generation
* full calendar replacement
* automatic timetable registration
* community marketplace features

Potential future ideas belong in `FUTURE.md`.

They are not reasons to modify V1 architecture unless doing so is essentially free.

---

# 26. Product Scope Rule

When considering a new feature, ask:

> **Does this help the student PLAN, LOCK, or NAVIGATE their semester?**

If not, it probably does not belong.

Even if the answer is yes, ask:

> **Is it required for V1 to deliver its core value?**

If not, defer it.

---

# 27. Core User Experience

The intended first-time flow:

### Step 1

Create account.

### Step 2

Select university and semester.

### Step 3

Import/browse available courses.

### Step 4

Add personal commitments and preferences.

### Step 5

Create candidate semesters.

### Step 6

Compare candidate semesters.

### Step 7

Lock selected semester.

### Step 8

Upload outlines.

### Step 9

Review extracted course structures.

### Step 10

Use Semester Command Center throughout the term.

The experience should feel like one evolving semester, not several unrelated tools joined together.

---

# 28. Success Criteria

V1 succeeds if:

### Pre-semester

A student genuinely prefers using Semester Intelligence over manually comparing course combinations.

The system identifies at least some trade-offs the student would otherwise have needed to reason about manually.

### During semester

The student regularly checks the application because it provides useful visibility into upcoming workload.

### Extraction

Most ordinary course outlines can be converted into editable structured course information with limited manual correction.

### Trust

The system clearly distinguishes:

* known fact;
* user-provided information;
* AI-derived estimate;
* uncertain information.

### Scope

The application reaches a polished, deployable V1 without expanding into a generic student productivity suite.

---

# 29. Dogfooding Success Test

The primary initial developer should use Semester Intelligence throughout Fall 2026.

The strongest product-validation question is:

> **After using this through Fall 2026, would I trust and want Semester Intelligence when designing Spring 2027?**

A strong "yes" is more important than raw feature count.

---

# 30. Early External Validation

After the core flow works, test with a small number of students.

Initial testers should ideally vary in:

* major;
* course load;
* extracurricular involvement;
* workload tolerance;
* assessment preferences.

Important questions:

* Did the semester comparison reveal anything useful?
* Did recommendations match how you actually think about course selection?
* What information was missing?
* Did the heatmap correctly identify difficult periods?
* Did you return to the dashboard without being prompted?
* What did you ignore?
* What felt like noise?
* Would you use this next semester?
* What would you pay, if anything?

Do not ask only:

> "Do you like the idea?"

Behaviour matters more.

---

# 31. Monetization Hypothesis

Monetization is desirable but must not distort initial product development.

A possible model:

## Free

* basic semester builder;
* timetable;
* clash detection;
* basic assessments;
* basic grade tracking.

## Semester Pro

Potentially sold once per academic semester rather than as a perpetual monthly subscription.

Possible premium functionality:

* AI course-outline extraction;
* advanced candidate comparisons;
* richer semester scoring;
* workload forecasting;
* unlimited what-if analysis;
* personalized Course Fit;
* historical intelligence.

Potential international price hypothesis:

**approximately $5–15 per semester**, with regional pricing.

This is a hypothesis only.

Pricing is not validated.

---

# 32. Product Risks

## Risk 1 — Becomes Another Planner

Mitigation:

Keep semester decision intelligence central.

---

## Risk 2 — Workload Scores Feel Arbitrary

Mitigation:

Use explainable sub-scores and expose assumptions.

---

## Risk 3 — AI Misreads Outlines

Mitigation:

Human verification before extracted information becomes canonical.

---

## Risk 4 — Course Fit Lacks Historical Data

Mitigation:

V1 relies on structural information and explicit user preferences.

Community data is optional enhancement.

---

## Risk 5 — Students Will Not Pay

Mitigation:

First prove frequent product usage and decision value.

Monetization validation follows product validation.

---

## Risk 6 — Scope Explosion

This is considered one of the highest project risks.

Mitigation:

`PRODUCT.md` V1 scope and non-goals are authoritative.

Any proposed expansion must be recorded in `FUTURE.md` or explicitly approved through a product decision.

---

# 33. Product Identity

Semester Intelligence should feel:

* analytical;
* calm;
* student-first;
* transparent;
* intelligent without pretending omniscience;
* visually informative;
* substantially more useful than a timetable;
* substantially less bloated than a productivity suite.

The product should make the student feel:

> **"I understand my semester."**

Not:

> "I have another place where I need to maintain tasks."

---

# 34. Product North Star

The long-term ambition is not to manage every aspect of university life.

It is:

> **Give students enough intelligence about their academic workload to make better semester-level decisions before and during the term.**

Every major product decision should remain consistent with that statement.
