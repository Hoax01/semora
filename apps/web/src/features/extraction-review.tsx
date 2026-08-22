import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type Evidence = { pageNumber?: number; text: string };
type Category = {
  name: string;
  weightPercentage: number | null;
  confidence: number;
  evidence: Evidence[];
};
type Assessment = {
  title: string;
  type:
    | 'ASSIGNMENT'
    | 'QUIZ'
    | 'PROJECT'
    | 'PRESENTATION'
    | 'MIDTERM'
    | 'FINAL'
    | 'PARTICIPATION'
    | 'OTHER';
  weightPercentage: number | null;
  dueDate: string | null;
  recurrence: string | null;
  confidence: number;
  evidence: Evidence[];
};
type ExtractionPayload = {
  documentId: string;
  documentType: 'COURSE_OUTLINE';
  schemaVersion: string;
  extractorVersion: string;
  modelIdentifier: string;
  courseIdentity: {
    courseCode: string | null;
    title: string | null;
    instructors: string[];
    confidence: number;
    evidence: Evidence[];
  };
  gradingScheme: {
    gradingMode: 'ABSOLUTE' | 'RELATIVE' | 'PASS_FAIL' | 'UNKNOWN';
    categories: Category[];
    thresholds: Array<{
      label: string;
      minimumPercentage: number;
      confidence: number;
      evidence: Evidence[];
    }>;
    dropRules: string[];
  };
  assessments: Assessment[];
  warnings: Array<{
    code: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    evidence: Evidence[];
  }>;
  conflicts: Array<{
    field: string;
    message: string;
    values: string[];
    evidence: Evidence[];
  }>;
  fieldConfidences: Record<string, number>;
  overallConfidence: number;
};

type ExtractionJob = {
  id: string;
  status: string;
  modelIdentifier: string | null;
  extractorVersion: string | null;
  schemaVersion: string | null;
  failureReason: string | null;
  document: { id: string; originalFilename: string; mimeType: string };
  draft: { payload: ExtractionPayload; overallConfidence: number } | null;
  verification: {
    state: string;
    verifiedAt: string;
  } | null;
};

class ReviewApiError extends Error {
  constructor(
    message: string,
    readonly body: { blockingIssues?: string[]; extractionJob?: ExtractionJob },
  ) {
    super(message);
  }
}

async function reviewRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = (await response.json().catch(() => undefined)) as
    (T & { error?: string; blockingIssues?: string[]; extractionJob?: ExtractionJob }) | undefined;
  if (!response.ok) {
    throw new ReviewApiError(
      body?.error === 'EXTRACTION_REVIEW_BLOCKED'
        ? 'Resolve the highlighted conflicts before confirming.'
        : body?.error === 'EXTRACTION_REVIEW_NOT_AVAILABLE'
          ? 'This extraction is no longer waiting for review.'
          : body?.error === 'EXTRACTION_DOCUMENT_NOT_CURRENT'
            ? 'A newer outline is attached to this course. Review the current outline instead.'
            : body?.error === 'EXTRACTION_DRAFT_INVALID'
              ? 'Some edited values are invalid. Check the review fields.'
              : 'Semora could not save this extraction review.',
      body ?? {},
    );
  }
  return body as T;
}

function confidenceLabel(value: number) {
  if (value >= 0.7) return 'Confident';
  if (value >= 0.45) return 'Needs review';
  return 'Uncertain';
}

function evidenceText(evidence: Evidence[]) {
  return evidence.length
    ? evidence
        .map((item) => `${item.pageNumber ? `Page ${item.pageNumber}: ` : ''}${item.text}`)
        .join(' ')
    : 'No source evidence was captured for this field.';
}

function numberOrNull(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ReviewEvidence({ evidence }: { evidence: Evidence[] }) {
  return <small className="review-evidence">{evidenceText(evidence)}</small>;
}

export function ExtractionReviewPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<ExtractionJob>();
  const [payload, setPayload] = useState<ExtractionPayload>();
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [blockingIssues, setBlockingIssues] = useState<string[]>([]);
  const [newInstructorName, setNewInstructorName] = useState('');

  useEffect(() => {
    if (!jobId) return;
    let isCurrent = true;
    reviewRequest<{ extractionJob: ExtractionJob }>(`/api/extraction-jobs/${jobId}`)
      .then((result) => {
        if (!isCurrent) return;
        setJob(result.extractionJob);
        setPayload(result.extractionJob.draft?.payload);
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to load review.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [jobId]);

  function applyJob(nextJob: ExtractionJob) {
    setJob(nextJob);
    if (nextJob.draft?.payload) setPayload(nextJob.draft.payload);
  }

  function updatePayload(mutator: (current: ExtractionPayload) => ExtractionPayload) {
    setPayload((current) => (current ? mutator(current) : current));
  }

  function updateCategory(index: number, patch: Partial<Category>) {
    updatePayload((current) => ({
      ...current,
      gradingScheme: {
        ...current.gradingScheme,
        categories: current.gradingScheme.categories.map((category, itemIndex) =>
          itemIndex === index ? { ...category, ...patch } : category,
        ),
      },
    }));
  }

  function updateAssessment(index: number, patch: Partial<Assessment>) {
    updatePayload((current) => ({
      ...current,
      assessments: current.assessments.map((assessment, itemIndex) =>
        itemIndex === index ? { ...assessment, ...patch } : assessment,
      ),
    }));
  }

  function updateInstructor(index: number, value: string) {
    updatePayload((current) => ({
      ...current,
      courseIdentity: {
        ...current.courseIdentity,
        instructors: current.courseIdentity.instructors.map((instructor, itemIndex) =>
          itemIndex === index ? value : instructor,
        ),
      },
    }));
  }

  function removeInstructor(index: number) {
    updatePayload((current) => ({
      ...current,
      courseIdentity: {
        ...current.courseIdentity,
        instructors: current.courseIdentity.instructors.filter(
          (_instructor, itemIndex) => itemIndex !== index,
        ),
      },
    }));
  }

  function addInstructor() {
    const name = newInstructorName.trim();
    if (!name) return;
    updatePayload((current) => ({
      ...current,
      courseIdentity: {
        ...current.courseIdentity,
        instructors: [...current.courseIdentity.instructors, name],
      },
    }));
    setNewInstructorName('');
  }

  async function saveDraft() {
    if (!jobId || !payload) return;
    setBusyAction('save');
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await reviewRequest<{
        extractionJob: ExtractionJob;
        blockingIssues: string[];
      }>(`/api/extraction-jobs/${jobId}/review`, {
        method: 'PUT',
        body: JSON.stringify({ payload }),
      });
      applyJob(result.extractionJob);
      setBlockingIssues(result.blockingIssues);
      setNotice('Draft saved. It is still unverified.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this draft.');
    } finally {
      setBusyAction(undefined);
    }
  }

  async function verifyDraft() {
    if (!jobId || !payload) return;
    setBusyAction('verify');
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await reviewRequest<{ extractionJob: ExtractionJob }>(
        `/api/extraction-jobs/${jobId}/verify`,
        { method: 'POST', body: JSON.stringify({ payload }) },
      );
      applyJob(result.extractionJob);
      setBlockingIssues([]);
      setNotice('Course structure verified and saved to this active course.');
    } catch (reason) {
      if (reason instanceof ReviewApiError) {
        if (reason.body.extractionJob) applyJob(reason.body.extractionJob);
        setBlockingIssues(reason.body.blockingIssues ?? []);
      }
      setError(reason instanceof Error ? reason.message : 'Unable to verify this draft.');
    } finally {
      setBusyAction(undefined);
    }
  }

  async function rejectDraft() {
    if (
      !jobId ||
      !window.confirm('Reject this extraction draft? You can upload the outline again later.')
    ) {
      return;
    }
    setBusyAction('reject');
    setError(undefined);
    try {
      const result = await reviewRequest<{ extractionJob: ExtractionJob }>(
        `/api/extraction-jobs/${jobId}/reject`,
        { method: 'POST' },
      );
      applyJob(result.extractionJob);
      setNotice('Draft rejected. No academic data was changed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reject this draft.');
    } finally {
      setBusyAction(undefined);
    }
  }

  if (isLoading) return <main className="app-page">Loading extraction review…</main>;
  if (error && !job)
    return (
      <main className="app-page">
        <p className="form-error">{error}</p>
      </main>
    );
  if (!job || !payload)
    return (
      <main className="app-page">
        <p className="form-error">This extraction does not have a reviewable draft.</p>
      </main>
    );

  const weightTotal = payload.gradingScheme.categories.reduce(
    (total, category) => total + (category.weightPercentage ?? 0),
    0,
  );
  const hasBlockingConflicts = payload.conflicts.length > 0 || weightTotal > 100.0001;
  const isReviewable = job.status === 'REVIEW_REQUIRED';

  return (
    <main className="app-page extraction-review-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">COURSE OUTLINE / REVIEW</p>
          <h1>Verify the extracted structure.</h1>
          <p className="lede">
            Review the proposal from <strong>{job.document.originalFilename}</strong>. Evidence
            stays beside the fields so you can correct uncertain structure before it becomes
            academic data.
          </p>
        </div>
        <Link className="back-link" to="/">
          Back to active semester
        </Link>
      </header>

      {error ? <p className="form-error review-message">{error}</p> : null}
      {notice ? <p className="review-notice">{notice}</p> : null}
      {blockingIssues.length ? (
        <section className="review-alert review-alert-blocking" aria-labelledby="blocking-title">
          <h2 id="blocking-title">Resolve before confirming</h2>
          <ul>
            {blockingIssues.map((issue) => (
              <li key={issue}>{issue.replaceAll('_', ' ').toLowerCase()}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="extraction-review-layout">
        <div className="extraction-review-main">
          <section className="review-card" aria-labelledby="identity-title">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">COURSE IDENTITY</p>
                <h2 id="identity-title">
                  {payload.courseIdentity.courseCode ?? 'Course code not found'}
                </h2>
              </div>
              <span className="review-confidence">
                {confidenceLabel(payload.courseIdentity.confidence)}
              </span>
            </div>
            <div className="review-identity-grid">
              <label>
                Course code
                <input
                  disabled={!isReviewable || Boolean(busyAction)}
                  onChange={(event) =>
                    updatePayload((current) => ({
                      ...current,
                      courseIdentity: {
                        ...current.courseIdentity,
                        courseCode: event.target.value || null,
                      },
                    }))
                  }
                  value={payload.courseIdentity.courseCode ?? ''}
                />
              </label>
              <label>
                Title
                <input
                  disabled={!isReviewable || Boolean(busyAction)}
                  onChange={(event) =>
                    updatePayload((current) => ({
                      ...current,
                      courseIdentity: {
                        ...current.courseIdentity,
                        title: event.target.value || null,
                      },
                    }))
                  }
                  value={payload.courseIdentity.title ?? ''}
                />
              </label>
            </div>
            <div className="review-instructor-editor">
              <div className="review-instructor-heading">
                <span>Instructor names</span>
                <small>Correct the extracted name or add a co-instructor.</small>
              </div>
              <div className="review-instructor-list">
                {payload.courseIdentity.instructors.map((instructor, index) => (
                  <div className="review-instructor-row" key={`${instructor}-${index}`}>
                    <label>
                      Instructor {index + 1}
                      <input
                        disabled={!isReviewable || Boolean(busyAction)}
                        onChange={(event) => updateInstructor(index, event.target.value)}
                        value={instructor}
                      />
                    </label>
                    <button
                      aria-label={`Remove instructor ${index + 1}`}
                      className="text-button review-remove-button"
                      disabled={!isReviewable || Boolean(busyAction)}
                      onClick={() => removeInstructor(index)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="review-instructor-add">
                <label>
                  Add instructor
                  <input
                    disabled={!isReviewable || Boolean(busyAction)}
                    onChange={(event) => setNewInstructorName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addInstructor();
                      }
                    }}
                    placeholder="Enter a name"
                    value={newInstructorName}
                  />
                </label>
                <button
                  className="secondary-button compact-button"
                  disabled={!isReviewable || Boolean(busyAction) || !newInstructorName.trim()}
                  onClick={addInstructor}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
            <ReviewEvidence evidence={payload.courseIdentity.evidence} />
          </section>

          <section className="review-card" aria-labelledby="grading-title">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">GRADING STRUCTURE</p>
                <h2 id="grading-title">Categories and mode</h2>
              </div>
              <span
                className={
                  weightTotal > 100.0001 ? 'review-confidence review-danger' : 'review-confidence'
                }
              >
                {weightTotal.toFixed(1)}% total
              </span>
            </div>
            <label className="review-field review-mode-field">
              Grading mode
              <select
                disabled={!isReviewable || Boolean(busyAction)}
                onChange={(event) =>
                  updatePayload((current) => ({
                    ...current,
                    gradingScheme: {
                      ...current.gradingScheme,
                      gradingMode: event.target
                        .value as ExtractionPayload['gradingScheme']['gradingMode'],
                    },
                  }))
                }
                value={payload.gradingScheme.gradingMode}
              >
                <option value="UNKNOWN">Unknown</option>
                <option value="ABSOLUTE">Absolute</option>
                <option value="RELATIVE">Relative</option>
                <option value="PASS_FAIL">Pass / Fail</option>
              </select>
            </label>
            <div className="review-edit-list">
              {payload.gradingScheme.categories.map((category, index) => (
                <div className="review-edit-row" key={`${category.name}-${index}`}>
                  <label>
                    Category
                    <input
                      disabled={!isReviewable || Boolean(busyAction)}
                      onChange={(event) => updateCategory(index, { name: event.target.value })}
                      value={category.name}
                    />
                  </label>
                  <label>
                    Weight %
                    <input
                      disabled={!isReviewable || Boolean(busyAction)}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateCategory(index, {
                          weightPercentage: numberOrNull(event.target.value),
                        })
                      }
                      type="number"
                      value={category.weightPercentage ?? ''}
                    />
                  </label>
                  <button
                    className="text-button review-remove-button"
                    disabled={!isReviewable || Boolean(busyAction)}
                    onClick={() =>
                      updatePayload((current) => ({
                        ...current,
                        gradingScheme: {
                          ...current.gradingScheme,
                          categories: current.gradingScheme.categories.filter(
                            (_item, itemIndex) => itemIndex !== index,
                          ),
                        },
                      }))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                  <ReviewEvidence evidence={category.evidence} />
                </div>
              ))}
            </div>
            <button
              className="secondary-button compact-button"
              disabled={!isReviewable || Boolean(busyAction)}
              onClick={() =>
                updatePayload((current) => ({
                  ...current,
                  gradingScheme: {
                    ...current.gradingScheme,
                    categories: [
                      ...current.gradingScheme.categories,
                      { name: '', weightPercentage: null, confidence: 0.5, evidence: [] },
                    ],
                  },
                }))
              }
              type="button"
            >
              Add category
            </button>
            {payload.gradingScheme.dropRules.length ? (
              <div className="review-subsection">
                <h3>Drop rules</h3>
                <ul>
                  {payload.gradingScheme.dropRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="review-card" aria-labelledby="assessments-title">
            <div className="panel-heading-row">
              <div>
                <p className="eyebrow">IMPORTANT ASSESSMENTS</p>
                <h2 id="assessments-title">Assessments and dates</h2>
              </div>
              <span className="review-confidence">{payload.assessments.length} found</span>
            </div>
            <div className="review-edit-list">
              {payload.assessments.map((assessment, index) => (
                <div
                  className="review-edit-row review-assessment-row"
                  key={`${assessment.title}-${index}`}
                >
                  <label>
                    Assessment
                    <input
                      disabled={!isReviewable || Boolean(busyAction)}
                      onChange={(event) => updateAssessment(index, { title: event.target.value })}
                      value={assessment.title}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      disabled={!isReviewable || Boolean(busyAction)}
                      onChange={(event) =>
                        updateAssessment(index, {
                          type: event.target.value as Assessment['type'],
                        })
                      }
                      value={assessment.type}
                    >
                      {[
                        'ASSIGNMENT',
                        'QUIZ',
                        'PROJECT',
                        'PRESENTATION',
                        'MIDTERM',
                        'FINAL',
                        'PARTICIPATION',
                        'OTHER',
                      ].map((type) => (
                        <option key={type} value={type}>
                          {type.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Weight %
                    <input
                      disabled={!isReviewable || Boolean(busyAction)}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateAssessment(index, {
                          weightPercentage: numberOrNull(event.target.value),
                        })
                      }
                      type="number"
                      value={assessment.weightPercentage ?? ''}
                    />
                  </label>
                  <label>
                    Due date
                    <input
                      disabled={!isReviewable || Boolean(busyAction)}
                      onChange={(event) =>
                        updateAssessment(index, { dueDate: event.target.value || null })
                      }
                      type="date"
                      value={assessment.dueDate ?? ''}
                    />
                  </label>
                  <button
                    className="text-button review-remove-button"
                    disabled={!isReviewable || Boolean(busyAction)}
                    onClick={() =>
                      updatePayload((current) => ({
                        ...current,
                        assessments: current.assessments.filter(
                          (_item, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                    type="button"
                  >
                    Remove
                  </button>
                  <ReviewEvidence evidence={assessment.evidence} />
                </div>
              ))}
            </div>
            <button
              className="secondary-button compact-button"
              disabled={!isReviewable || Boolean(busyAction)}
              onClick={() =>
                updatePayload((current) => ({
                  ...current,
                  assessments: [
                    ...current.assessments,
                    {
                      title: '',
                      type: 'OTHER',
                      weightPercentage: null,
                      dueDate: null,
                      recurrence: null,
                      confidence: 0.5,
                      evidence: [],
                    },
                  ],
                }))
              }
              type="button"
            >
              Add assessment
            </button>
          </section>

          {payload.gradingScheme.thresholds.length ? (
            <section className="review-card" aria-labelledby="thresholds-title">
              <p className="eyebrow">GRADE THRESHOLDS</p>
              <h2 id="thresholds-title">Absolute thresholds</h2>
              <div className="review-threshold-list">
                {payload.gradingScheme.thresholds.map((threshold) => (
                  <div key={threshold.label}>
                    <strong>{threshold.label}</strong> {threshold.minimumPercentage}%
                    <ReviewEvidence evidence={threshold.evidence} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className="review-actions">
            <button
              disabled={!isReviewable || Boolean(busyAction)}
              onClick={saveDraft}
              type="button"
            >
              {busyAction === 'save' ? 'Saving…' : 'Save draft'}
            </button>
            <button
              disabled={!isReviewable || Boolean(busyAction) || hasBlockingConflicts}
              onClick={verifyDraft}
              type="button"
            >
              {busyAction === 'verify' ? 'Confirming…' : 'Confirm course structure'}
            </button>
            <button
              className="danger-button"
              disabled={!isReviewable || Boolean(busyAction)}
              onClick={rejectDraft}
              type="button"
            >
              {busyAction === 'reject' ? 'Rejecting…' : 'Reject draft'}
            </button>
          </div>
          {!isReviewable ? (
            <p className="review-status-note">
              This draft is{' '}
              {job.verification?.state?.toLowerCase().replaceAll('_', ' ') ??
                job.status.toLowerCase()}
              {job.status === 'VERIFIED'
                ? '. Canonical course records were updated when it was verified.'
                : '. Canonical course records were not changed.'}
            </p>
          ) : null}
        </div>

        <aside className="review-side-panel">
          <section className="review-card review-warning-card" aria-labelledby="warnings-title">
            <p className="eyebrow">WARNINGS</p>
            <h2 id="warnings-title">What needs attention</h2>
            {payload.warnings.length || payload.conflicts.length ? (
              <div className="review-warning-list">
                {payload.warnings.map((warning) => (
                  <article
                    className={`review-warning review-${warning.severity.toLowerCase()}`}
                    key={warning.code}
                  >
                    <strong>
                      {warning.severity === 'HIGH'
                        ? '⛔'
                        : warning.severity === 'MEDIUM'
                          ? '⚠'
                          : '?'}{' '}
                      {warning.code.replaceAll('_', ' ')}
                    </strong>
                    <p>{warning.message}</p>
                    <ReviewEvidence evidence={warning.evidence} />
                  </article>
                ))}
                {payload.conflicts.map((conflict, index) => (
                  <article
                    className="review-warning review-high"
                    key={`${conflict.field}-${index}`}
                  >
                    <strong>⛔ Conflict in {conflict.field}</strong>
                    <p>{conflict.message}</p>
                    <p className="review-values">{conflict.values.join(' · ')}</p>
                    <ReviewEvidence evidence={conflict.evidence} />
                    {isReviewable ? (
                      <button
                        className="secondary-button compact-button"
                        disabled={Boolean(busyAction)}
                        onClick={() =>
                          updatePayload((current) => ({
                            ...current,
                            conflicts: current.conflicts.filter(
                              (_item, itemIndex) => itemIndex !== index,
                            ),
                          }))
                        }
                        type="button"
                      >
                        Mark resolved after editing
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="review-empty">No warnings were generated. Review the fields anyway.</p>
            )}
          </section>
          <section className="review-card review-evidence-summary">
            <p className="eyebrow">EXTRACTION SOURCE</p>
            <h2>Evidence-backed draft</h2>
            <dl>
              <div>
                <dt>Extractor</dt>
                <dd>{job.modelIdentifier ?? payload.modelIdentifier}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{Math.round(payload.overallConfidence * 100)}%</dd>
              </div>
              <div>
                <dt>Fields with evidence</dt>
                <dd>
                  {payload.courseIdentity.evidence.length +
                    payload.gradingScheme.categories.filter((category) => category.evidence.length)
                      .length +
                    payload.assessments.filter((assessment) => assessment.evidence.length).length}
                </dd>
              </div>
            </dl>
            <p>
              The local extractor is a convenience. Your confirmation is the authority for this
              course’s structure.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
