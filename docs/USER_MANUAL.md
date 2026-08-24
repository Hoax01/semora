# Semora User Manual

**Design a semester you won't regret. See the hard weeks before they hit you.**

Semora helps you design a course combination, finalize it, and navigate the resulting semester. It follows one lifecycle:

```
PLAN → LOCK → NAVIGATE
```

This manual describes the current implementation. Some screens use local deterministic extraction and heuristic workload estimates, so Semora always distinguishes confirmed information from estimates and asks you to review extracted course data before it affects the active semester.

## 1. Create an account

1. Open the Semora web app.
2. Choose **Create account**.
3. Enter your email and password.
4. Sign in when prompted.

Your session is stored through the application authentication flow. Use **Sign out** from the application navigation when you are finished.

## 2. Start a semester workspace

The **Plan** screen is the starting point for semester design.

1. Create a semester workspace.
2. Choose the available term.
3. Enter or confirm your planning preferences.
4. Use the catalogue search to find course offerings.

Semora keeps candidate semesters separate. You can create alternatives without overwriting the others.

## 3. Build a candidate semester

For each candidate:

1. Search by course code or title.
2. Open a course to inspect sections and meetings.
3. Select the section you want to consider.
4. Watch the credit total and timetable update.
5. Repeat until the candidate represents a realistic semester.

Semora treats overlapping class meetings as hard conflicts. Back-to-back meetings are allowed when one ends exactly as the next begins. An invalid candidate can still be inspected, but it should not be treated as a normal recommendation.

## 4. Add commitments

Coursework is only part of a semester. Add commitments such as a TAship, society, job, commute, research, gym schedule, or recurring personal obligation.

For a commitment, provide:

- a name and category;
- recurring time blocks when the commitment has fixed hours;
- estimated weekly effort;
- optional one-off high-intensity dates;
- a flexibility level.

Use the flexibility level intentionally:

- **Hard:** an overlap is a feasibility problem.
- **Soft:** an overlap is a penalty or warning.
- **Flexible:** the commitment can move and should not invalidate the candidate by itself.

If one real-world obligation contains both fixed and flexible parts, record them as separate commitments so Semora can model them honestly.

## 5. Set priorities and course preferences

Semora does not assume that the lowest workload is always best. Choose the trade-offs that matter to you, such as:

- lower overall workload;
- compact schedules or free days;
- fewer early or late classes;
- project or exam preference;
- career relevance;
- personal interest;
- assessment safety and balance.

Course-level interest and career-fit ratings can be reused across candidates. These are preferences, not hard constraints; they influence explanations and recommendation tags rather than silently deciding for you.

## 6. Read candidate intelligence

For a candidate, review:

- validity and credit totals;
- schedule quality and burden;
- academic and continuous workload;
- project and exam concentration;
- commitment compatibility;
- interest and career fit;
- balance, completeness, confidence, and findings.

Open the **Why?** explanations when a score or metric is unclear. Semora uses directional language carefully: some metrics are better when lower, while fit and balance metrics are better when higher.

Structured findings identify causes rather than just assigning a number. Examples include a timetable clash, a long day, project concentration, or a commitment overlap.

## 7. Compare candidates

Use the comparison view to inspect candidates side by side. Look for meaningful differences instead of treating tiny score changes as decisive.

A recommendation tag is a preference-sensitive summary, not an objective verdict. For example, one candidate may have stronger career fit but higher project concentration, while another may offer a lighter and more compact week.

Use bounded scenario exploration to try a temporary change without saving it into the candidate. Scenarios are previews; they do not replace the saved selection or preferences until you explicitly make a real change.

## 8. Lock the semester

When one candidate is ready:

1. Review the selected sections, timetable, commitments, and major trade-offs.
2. Choose **Lock semester**.
3. Confirm the transition.

Locking makes the selected courses the active semester while preserving planning data. During Add/Drop, you can add, switch, or drop active courses without losing the candidate history.

After locking, the home view changes from semester design toward active-semester navigation.

## 9. Add course outlines

For an active course, attach a course outline when you have one.

Supported development workflow inputs include PDF, DOCX, and plain text. The current provider is deterministic and local; it is not an external LLM service.

1. Open the active course.
2. Upload the outline.
3. Wait for the extraction job to finish.
4. Choose **Review extraction**.

The extraction draft may identify course identity, instructors, grading categories, assessments, dates, weights, thresholds, aggregation rules, and warnings. It may also leave fields unknown. Unknown is safer than an invented value.

## 10. Review and verify extracted data

Treat the review page as a required checkpoint.

1. Confirm the course code and title match the active course.
2. Correct instructor names if necessary.
3. Review grading mode and category weights.
4. Review each assessment, type, date, weight, and category.
5. Resolve blocking conflicts, such as a course mismatch, impossible totals, invalid dates, or unresolved aggregation parameters.
6. Expand grouped assessments when the source gives an exact count and the category supports equal weighting.
7. Add missing information manually when the outline does not provide it.
8. Choose **Verify** only when the draft represents the course accurately.

Verification promotes the reviewed draft into canonical academic data. Workload and grade calculations consume verified or manually entered data, not an unreviewed extraction draft.

If extraction is incomplete, use manual assessment entry. The product should remain usable even when one outline is unusual or unreadable.

## 11. Navigate the active semester

The active-semester command center answers:

- What matters now?
- What is due soon?
- How heavy is the current week?
- When is the next pressure peak?
- Which assessments and commitments cause that pressure?

Use the dashboard sections to inspect:

- due-soon work and priorities;
- current and upcoming daily pressure;
- weekly pressure findings;
- the full-term pressure heatmap;
- the assessment timeline;
- course grade cards and remaining work.

Higher pressure means more modeled demand. Pressure bands and findings explain the window and related assessments rather than pretending to be exact predictions of the number of hours you will need.

## 12. Manage assessments

Assessments can come from verified outline data or manual entry. Each assessment keeps academic result state separate from work-progress state.

You can:

- search and filter the timeline by course and assessment type;
- edit title, type, date, weight, category, and effort estimate;
- move a deadline or mark a date unknown;
- mark work complete;
- record a score when the result is available.

Changing a deadline or completion state recalculates the active pressure forecast. Completing work removes its future pressure contribution while retaining the historical assessment record.

## 13. Understand grades

The Grade Dashboard uses deterministic calculations.

For a course, review:

- current performance;
- weighted points earned;
- graded and remaining weight;
- current absolute grade equivalent when thresholds are confirmed;
- required average across remaining work for a target;
- whether a target is mathematically reachable;
- temporary what-if projections.

What-if values are previews only. They do not change saved scores.

Categories may use equal mean, points weighting, individual weights, best N, or drop-lowest N rules. The dashboard explains the selected rule and preserves the distinction between stored weights and derived equal shares.

For relative grading, Semora can show safe class-statistics context such as difference from the mean and standardized position when the data is sufficient. It does not fabricate a letter-grade prediction from incomplete relative information.

## 14. Read uncertainty correctly

Semora combines different kinds of information:

- official catalogue and timetable data;
- user-entered preferences and estimates;
- outline-derived drafts;
- user-verified canonical academic data;
- deterministic calculations.

These are not equally certain. A missing final date remains unknown. A heuristic workload estimate is not the same as a verified assessment weight. Use the confidence and completeness explanations to decide what deserves manual follow-up.

## 15. Common recovery paths

### A course outline fails

Retry the extraction, upload a clearer file, or enter assessments manually. A failed extraction should not prevent active-semester planning.

### A course mismatch appears

Check that the outline belongs to the selected course and offering. Do not verify a document against the wrong course.

### A grading total is invalid

Review duplicate categories, missing rule parameters, or weights that exceed a valid total. Correct the draft before verification.

### A date is unknown

Leave it unknown until you have reliable information. The workload engine excludes unknown dates from time-based calculations rather than inventing a date.

### The dashboard looks heavy

Open the pressure finding or heatmap week. Inspect the related assessments, commitments, and completion states. Move a deadline only when the real academic information changed.

### The candidate is invalid

Inspect timetable and commitment clashes first, then review credits and selected sections. A scenario can help test a replacement without changing the saved candidate.

## 16. Current product boundaries

Semora currently does not:

- automatically register courses;
- generate a complete study plan or timetable for you;
- act as a general calendar, notes, or document-chat application;
- consume unverified extraction as canonical truth;
- predict exact final grades from insufficient data;
- provide production external-AI extraction in the local baseline;
- provide community workload intelligence or predictive ML in V1.

Those boundaries keep the product explainable and keep the user in control of academic truth.
