# Semora — Product & Engineering Decisions

**Status:** Active
**Version:** 0.1
**Purpose:** Record important decisions that should not be repeatedly reconsidered during implementation.

This document contains decisions that have already been made.

If implementation later reveals that a decision is wrong, it may be changed—but the change must be recorded here with the reason.

---

# D-001 — Product Direction

**Decision:** Build Semora as a semester decision and workload intelligence product.

Semora helps students:

> **PLAN → LOCK → NAVIGATE**

their semester.

It is not intended to become a general student productivity platform.

---

# D-002 — Primary Product Wedge

**Decision:** Pre-semester semester-design intelligence is the primary differentiator.

Existing products already handle:

* syllabus parsing;
* calendars;
* deadline extraction;
* basic grade tracking;
* task management.

Semora must provide meaningful value through:

* whole-semester composition analysis;
* workload balancing;
* personal commitments;
* schedule quality;
* course-combination trade-offs;
* explainable semester comparisons.

The in-semester experience exists both because it is useful and because it gives the product recurring value after course selection ends.

---

# D-003 — Initial Market

**Decision:** LUMS is the initial beachhead, not the permanent domain model.

LUMS course memos, course timings, sections, caps, and outlines may be used as initial import formats.

Core entities must remain university-agnostic.

No important domain object should be named around LUMS-specific terminology if a generic equivalent exists.

---

# D-004 — Single-User Value

**Decision:** Semora must be useful with exactly one user.

The product must not require:

* community reviews;
* friends;
* historical course data;
* institutional partnerships;
* university APIs;
* network effects.

Community data may improve future recommendations but must never be required for baseline usefulness.

---

# D-005 — No Institutional Dependency

**Decision:** V1 must not require cooperation from LUMS administration.

The product should operate from data students can already legitimately access, such as:

* course memos;
* course timings;
* course outlines;
* manually entered information.

Official integrations may be considered later.

---

# D-006 — AI Is Not the Calculation Engine

**Decision:** Deterministic problems are solved deterministically.

Do not use an LLM for:

* timetable clash detection;
* credit totals;
* grade calculations;
* weighted averages;
* date arithmetic;
* sorting;
* constraint validation;
* deterministic scoring formulas.

AI should primarily handle:

* document interpretation;
* ambiguous natural language;
* structured extraction;
* explanations;
* preference interpretation where useful.

---

# D-007 — Human Verification of AI Extraction

**Decision:** AI-extracted course information is proposed data, not automatically trusted truth.

After parsing an outline, users must be able to:

* review;
* edit;
* confirm;
* reject

the extracted structure.

Canonical academic information should not silently change because an LLM inferred something.

---

# D-008 — Explainability Over Mystery Scores

**Decision:** Semester recommendations must be explainable.

Avoid a single opaque score such as:

> Semester Score: 72

without supporting dimensions.

Semester analysis should expose factors such as:

* workload;
* project intensity;
* examination intensity;
* schedule quality;
* assessment fragmentation;
* commitment compatibility;
* personal preference fit.

Users should be able to see **why** one semester differs from another.

---

# D-009 — No Universal Optimal Semester

**Decision:** Semora must not pretend there is one objectively best valid semester.

Different students legitimately optimize for different things.

For example:

* workload;
* career relevance;
* GPA safety;
* compact timetable;
* free days;
* interest;
* fewer projects;
* fewer exams.

Recommendations must respect explicit user preferences.

Where appropriate, multiple good options should be presented with trade-offs.

---

# D-010 — Personal Commitments Are First-Class Inputs

**Decision:** Academic workload cannot be evaluated in isolation.

Semora should support commitments such as:

* TAships;
* societies;
* employment;
* research;
* gym;
* recurring personal obligations;
* major one-off events.

However, Semora must **not become a general calendar app**.

Commitments exist only insofar as they affect semester planning and pressure.

---

# D-011 — Course Workload Is Multidimensional

**Decision:** Credit hours are insufficient as the sole representation of course workload.

Course profiles may include:

* continuous workload;
* assignment frequency;
* quiz frequency;
* project intensity;
* examination intensity;
* lab burden;
* reading burden;
* schedule burden;
* expected effort;
* uncertainty.

Semester analysis should reason over the combination of these dimensions.

---

# D-012 — Workload Pressure Is Not Deadline Count

**Decision:** Two small assessments should not necessarily produce more pressure than one major assessment.

The workload engine should consider factors such as:

* assessment weight;
* type;
* estimated effort;
* proximity;
* overlapping assessments;
* course characteristics;
* external commitments.

The exact model will be defined in `WORKLOAD_ENGINE.md`.

---

# D-013 — Relative Grading Must Be Treated Carefully

**Decision:** Semora must not fabricate confident letter-grade predictions for relatively graded courses.

If class statistics are unavailable:

* show current raw performance;
* show completed/remaining assessment weight;
* state that grade prediction is unavailable.

If statistics such as mean, median, or standard deviation are available, statistical context may be shown.

Absolute grading calculations may be deterministic when thresholds are known.

---

# D-014 — Course Fit Does Not Require Community Data

**Decision:** Initial Course Fit should rely on:

* course structure;
* outline information;
* schedule;
* user commitments;
* explicit preferences.

Historical/community workload data is a future enhancement.

No scraping of LDF or similar sources is required for V1.

---

# D-015 — Community Data Must Be First-Party and Optional

**Decision:** If Semora later builds historical course intelligence, preference should be given to data voluntarily contributed through Semora itself.

Examples:

* reported workload;
* weekly effort;
* difficulty;
* project intensity;
* assessment experience.

External scraping should not be foundational to the product.

---

# D-016 — Web First

**Decision:** V1 is a responsive web application.

Do not build:

* native Android;
* native iOS;
* desktop applications

during V1.

A mobile-friendly web interface is sufficient.

---

# D-017 — Manual Input Is Acceptable

**Decision:** V1 does not need integrations to be valuable.

Users may manually:

* add assessments;
* modify dates;
* enter grades;
* add commitments;
* correct extracted information.

Automation should reduce friction where useful but is not a prerequisite for launch.

---

# D-018 — No LMS Integration in V1

**Decision:** Do not integrate Canvas, Moodle, Blackboard, or other LMS platforms during the initial build.

Reasons:

* integration complexity;
* institution-specific differences;
* authentication complexity;
* product scope risk.

The product should first prove value using outlines and manual updates.

---

# D-019 — No Email or WhatsApp Integration in V1

**Decision:** Semora does not automatically monitor student communication during V1.

Future versions may interpret announcements or deadline changes from communication sources.

For now, manual updates are sufficient.

---

# D-020 — No Professor Rating Platform

**Decision:** Semora is not RateMyProfessor.

Do not introduce:

* public professor ratings;
* public comments;
* anonymous review feeds;
* professor leaderboards.

Future structured course-experience data may contribute to Course Fit without turning the product into a review site.

---

# D-021 — No Degree Planner in V1

**Decision:** Semora does not initially determine graduation requirements, major requirements, prerequisites, or degree completion.

Those systems introduce substantial university-specific complexity.

The V1 question is:

> **What semester should I take?**

not:

> **What courses do I need to graduate?**

---

# D-022 — Candidate Semesters Are Explicit Objects

**Decision:** Users may create and compare multiple candidate semesters.

A candidate semester is not just a temporary UI state.

It should be represented explicitly so users can:

* create alternatives;
* modify them independently;
* compare them;
* eventually select one.

---

# D-023 — Locking Is an Explicit State Transition

**Decision:** Selecting the real semester is an intentional transition.

Lifecycle:

> `PLANNING → ACTIVE`

The transition should not happen implicitly merely because courses have been added.

During Add/Drop, the active semester may still be modified.

---

# D-024 — Course Outline Overrides Preliminary Estimates

**Decision:** Before an outline exists, Semora may use preliminary course information or user estimates.

Once an outline is uploaded and verified, its structured assessment information becomes the authoritative source for that specific offering.

Course offerings from different semesters/instructors should not automatically be assumed identical.

---

# D-025 — Course and Course Offering Are Different Concepts

**Decision:** The domain model must distinguish the abstract course from a specific offering.

Example:

`CS 300 — Advanced Programming`

is a course.

`CS 300, Fall 2026, Section 1, Professor X`

is a course offering.

Workload, grading, assessments, and instructor may vary across offerings.

This distinction is mandatory in the eventual data model.

---

# D-026 — Assessment Weight and Effort Are Different

**Decision:** Grade importance must not be used as a direct substitute for workload.

A 30% final may require significant preparation.

A 5% programming assignment may also require significant time.

Pressure modeling should separately represent:

* grade weight;
* expected effort.

---

# D-027 — Estimates Must Expose Uncertainty

**Decision:** Semora may estimate workload but must not present estimates as objective fact.

Information should distinguish between:

* official data;
* user-entered data;
* AI-extracted data;
* calculated values;
* estimates;
* community aggregates.

Trust is more important than pretending the model is precise.

---

# D-028 — Scope Freeze for V1

**Decision:** V1 scope is defined in `PRODUCT.md`.

New ideas should normally be placed in `FUTURE.md`.

Implementation agents must not expand V1 simply because a related feature appears easy or interesting.

Any meaningful V1 scope expansion requires an explicit new decision in this file.

---

# D-029 — Build for Semester Survival, Not Feature Count

**Decision:** Development happens immediately before and during an academic semester.

Architecture and scope should favor:

* maintainability;
* incremental development;
* clear boundaries;
* useful partial completion;
* low operational burden.

A polished smaller product is preferable to an unfinished platform.

---

# D-030 — Primary Dogfooding Principle

**Decision:** Fall 2026 is the first real-world product test.

The product should be actively used during the semester.

Observed behaviour should influence later product decisions more heavily than speculative feature ideas.

The strongest validation milestone is:

> **Would the user choose to use Semora again when planning the next semester?**

---

# Decision Change Protocol

If a decision changes, do not silently overwrite history.

Add a new entry such as:

> `D-031 — Supersedes D-018`

and explain:

* what changed;
* why;
* what evidence caused the change;
* which parts of the product are affected.

This document exists to preserve architectural and product reasoning across implementation threads.

---

# D-031 — No Paid AI Dependency for Baseline Outline Extraction

**Decision:** Semora V1 must remain useful without a paid external AI vendor or
an API key. The default course-outline provider is a deterministic local
extractor that operates on the normalized document and emits evidence,
confidence, warnings, and conflicts for mandatory user review.

The `AcademicExtractionProvider` boundary remains in place so an optional local
model or external provider can be added later without changing the review or
canonical-persistence boundaries. No provider may write canonical academic data
directly, and the baseline flow must not make network calls.

**Reason:** The product should have zero recurring AI-vendor cost for its core
workflow and should remain usable for development, dogfooding, and ordinary
course outlines without external service availability.
