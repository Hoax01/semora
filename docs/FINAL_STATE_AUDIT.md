# Semora Final State Audit

**Audit date:** August 24, 2026
**Audited phase:** Phase 8 — Product Polish
**Scope:** Implemented product and engineering state through Phase 8, excluding user-owned deployment and Phase 9 real-user operation.

## Executive verdict

Semora's V1 implementation is complete enough for deployment and user validation. The core product lifecycle is implemented:

```
PLAN → LOCK → NAVIGATE
```

The application can support course discovery and comparison, active-semester setup, verified outline enrichment, workload navigation, assessment management, and deterministic grade analysis. Phase 8 product-polish and security work is complete for the agent-owned scope.

The repository is not being marked as production-deployed. Deployment, production storage configuration, environment provisioning, and live operational monitoring remain user-owned. Phase 9 is treated as real-user validation rather than another implementation phase.

## Audit method

This audit used:

- docs/PRODUCT.md for the intended product contract;
- docs/DECISIONS.md for accepted product and architecture decisions;
- docs/BUILDPLAN.md for phase boundaries and acceptance criteria;
- docs/CURRENT_STATE.md for implementation truth;
- docs/UI_UX.md and the engine specifications for behavior boundaries;
- direct inspection of the web, API, Prisma, and pure engine packages;
- the repository verification commands listed below.

Repository implementation and CURRENT_STATE.md were treated as authoritative when they differed from aspirational specification text.

## Phase completion

| Phase | Area                                 | State                          | Audit conclusion                                                                                                                                                                |
| ----- | ------------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundation and repository setup      | Complete                       | Monorepo, Prisma, API/web shells, shared configuration, and verification tooling exist.                                                                                         |
| 1     | Catalogue and imported academic data | Complete                       | Term catalogue, offering/section navigation, schedule data, and repeatable import paths are implemented.                                                                        |
| 2     | Semester planning core               | Complete                       | Candidate workspaces, course selection, timetable validity, commitments, preferences, and planning persistence are implemented.                                                 |
| 3     | Semester intelligence                | Complete                       | Deterministic metrics, interactions, findings, comparisons, recommendation tags, and bounded scenarios are implemented.                                                         |
| 4     | Lock and active semester             | Complete                       | Lock, active-course state, Add/Drop, and active-semester UI are implemented.                                                                                                    |
| 5     | Outline extraction and verification  | Complete                       | PDF/DOCX/text normalization, private storage, extraction jobs, review, validation, verification, canonical persistence, and benchmark support are implemented.                  |
| 6     | Workload intelligence                | Complete                       | Assessments, effort estimates, commitments, daily/weekly pressure, findings, heatmap, command center, deadline updates, and completion feedback are implemented.                |
| 7     | Grade intelligence                   | Complete                       | Score entry, deterministic grade calculations, thresholds, target analysis, what-if previews, drop rules, relative context, and grade dashboard are implemented.                |
| 8     | Product polish and security          | Complete for agent-owned scope | UX state handling, responsive polish, explanations, recovery paths, timeout stability, security boundaries, and palette cleanup are implemented. Deployment remains user-owned. |
| 9     | Real-user operation                  | Not counted as implementation  | Intentionally excluded from this audit.                                                                                                                                         |

## Product capability audit

### PLAN

Implemented and verified:

- term-specific catalogue search and course-detail navigation;
- candidate semester creation and independent editing;
- section selection, credit totals, timetable clash detection, and weekly schedule presentation;
- recurring and one-off commitments with hard, soft, and flexible behavior;
- persisted semester preferences and course-level fit ratings;
- structural workload profiles and user-adjustable estimates;
- deterministic composition metrics, interaction penalties, findings, confidence, and completeness;
- comparison, meaningful-difference explanation, recommendation tags, and bounded unsaved scenarios.

Boundary preserved:

- Semora does not automatically register courses, generate a universally optimal schedule, or replace user judgment with a single opaque score.

### LOCK

Implemented and verified:

- transactional candidate-to-active-semester lock;
- active course state and Add/Drop changes;
- authenticated outline upload for active courses;
- private local document storage with generated keys and traversal protection;
- PDF, DOCX, and plain-text normalization boundaries;
- persisted extraction jobs and a provider boundary;
- deterministic local extraction draft generation;
- evidence-backed review and editable course identity, instructors, grading, assessments, dates, weights, thresholds, and aggregation rules;
- grouped assessment expansion where the source provides an exact count;
- blocking validation for mismatches, invalid totals, dates, and missing rule parameters;
- canonical persistence only after user verification;
- manual assessment entry when extraction is incomplete.

Boundary preserved:

- The local provider is heuristic and deterministic. It is not presented as a production LLM or as an authority. Unverified drafts do not feed the grade or workload engines.

### NAVIGATE

Implemented and verified:

- active-semester command-center summary;
- due-soon assessment and priority views;
- current and upcoming daily pressure;
- weekly pressure, severity-ranked findings, and related demand;
- selectable full-term heatmap with interpretation guidance;
- deadline editing and immediate forecast refresh;
- separate work completion and academic score state;
- score entry and deterministic course grade summaries;
- absolute thresholds, current equivalents, required remaining averages, and reachability;
- temporary what-if score previews;
- BEST_N and DROP_LOWEST_N category aggregation;
- relative-grade context using safe statistics without letter-grade fabrication.

Boundary preserved:

- Workload values are explainable modeled pressure, not guaranteed hours or medical/academic certainty. Grade calculations do not claim predictive accuracy where the source data is insufficient.

## Architecture audit

### Boundaries

- Frontend remains in apps/web.
- API and persistence orchestration remain in apps/api.
- Semester, workload, grade, and extraction calculations remain in standalone packages.
- Engines do not directly depend on Express, Prisma, React, or LLM APIs.
- The application remains a modular monolith; no undocumented service split was introduced.

### Source truth and derived state

- Candidate and active-semester data are persisted as domain state.
- Extraction drafts remain provisional until review and verification.
- Verified academic structures become canonical records consumed by downstream engines.
- Workload and grade outputs remain deterministic derived views or snapshots rather than replacing source truth.
- Temporary scenarios do not mutate saved semester or grade data.

### Ownership and security

- User-owned workspaces, candidates, commitments, active-semester records, documents, assessments, scores, and preferences are checked server-side.
- Better Auth configuration fails fast when the secret is missing or shorter than 32 characters.
- Uploads validate supported MIME/extension boundaries and the 25 MB raw-body limit.
- Private storage resolves generated keys beneath its configured root and rejects traversal.
- Express parser failures return bounded JSON errors for malformed and oversized requests.
- No credentials, generated secrets, database dumps, or API keys were added to the repository.

## UX and accessibility audit

Implemented:

- blue/cyan/neutral interaction palette with no purple/violet colors;
- no CSS gradient declarations in the web source;
- active desktop navigation and reachable mobile bottom navigation;
- shared loading, empty, error, retry, and missing-data states;
- visible focus, hover, selected, and progress feedback;
- responsive assessment forms, timeline filtering, dashboard cards, heatmap, and long-content wrapping;
- pressure interpretation and score-direction explanations;
- extraction review evidence, warnings, conflicts, and correction affordances;
- reduced-motion-aware loading treatment and accessible status/alert semantics.

## Verification record

The following checks passed on August 24, 2026:

```
npm run test         102 tests passed
npm run typecheck    passed
npm run build        passed
npm run format:check passed
npm run lint         passed
git diff --check     passed
```

Additional audits passed:

- no purple, violet, or indigo color tokens in apps/web/src;
- no linear-gradient, radial-gradient, or conic-gradient declarations in apps/web/src;
- final changes committed and pushed to the configured origin remote.

Interactive browser smoke was attempted during the Phase 8 audit but the local Windows browser runtime exited before page discovery. The authenticated HTTP smoke path and automated API/engine checks passed; the browser-runtime issue is an environment limitation, not a recorded application failure.

## Known limitations and operational follow-up

These are intentionally documented rather than hidden:

1. **Deployment remains user-owned.** Production hosting, environment variables, migrations against the production database, and live verification are not performed by this audit.
2. **Development file storage is local.** Production object storage, retention, and complete document deletion flows still require operational design.
3. **Extraction is heuristic.** The local provider handles common outline structures but unusual tables, prose grading rules, dates, and drop rules require review. The benchmark is small and is not a production accuracy claim.
4. **Workload defaults are heuristic.** They are explainable and deterministic but not calibrated against a broad student feedback dataset.
5. **Some future preference constraints require data.** Hard-course limits, grade-safety behavior, community intelligence, predictive grade risk, and ML remain deferred by design.
6. **Migration history contains a known shadow-replay defect.** The existing prisma migrate dev shadow database replay is blocked by historical enum ordering; the checked-in history was not rewritten. Deployment migration application was verified through the existing deploy path.
7. **Browser smoke is environment-limited.** The local browser helper exits during setup, so live interactive validation should be repeated in a normal browser after deployment.
8. **Phase 9 is real-user validation.** Feedback, retention, and operational monitoring are not claims of implementation completeness and are intentionally outside this audit.

## Final readiness statement

Semora is implementation-ready for deployment and controlled user validation. The product is not described as production-live until the user completes deployment and operational checks. No remaining item in the current implementation phases requires a new product feature before that handoff; remaining work is deployment, environment verification, and learning from real use.
