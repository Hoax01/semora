import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

type Candidate = {
  id: string;
  name: string;
  isArchived: boolean;
  selectionCount: number;
  credits: number;
  selections: Selection[];
};

type CandidateValidation = {
  candidateId: string;
  valid: boolean;
  clashes: TimetableClash[];
};

type TimetableClash = {
  type: 'COURSE_COURSE' | 'COURSE_HARD_COMMITMENT';
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  first: { kind: 'COURSE' | 'COMMITMENT'; id: string; label: string };
  second: { kind: 'COURSE' | 'COMMITMENT'; id: string; label: string };
};

type Selection = {
  id: string;
  sectionId: string;
  sectionCode: string;
  capacity: number | null;
  instructor: string | null;
  courseOfferingId: string;
  courseCode: string;
  title: string;
  credits: number;
  meetings: Meeting[];
};

type Meeting = {
  day: string;
  startTime: string;
  endTime: string;
  type: string;
  location: string | null;
};

type CatalogueCourse = {
  id: string;
  courseCode: string;
  title: string;
  description: string | null;
  department: string | null;
  credits: number;
  term: string;
  sections: Array<{
    id: string;
    sectionCode: string;
    capacity: number | null;
    instructor: string | null;
    meetings: Meeting[];
  }>;
};

type Workspace = {
  id: string;
  state: string;
  term: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    university: { id: string; name: string; shortName: string };
  };
  candidates: Candidate[];
};

type University = {
  id: string;
  name: string;
  shortName: string;
  terms: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
};

function formatMeeting(meeting: Meeting) {
  const day = meeting.day.slice(0, 3);
  return `${day} ${meeting.startTime}–${meeting.endTime}`;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    if (response.status === 401) throw new Error('Please sign in again.');
    if (body?.error === 'VALIDATION_ERROR') throw new Error('Check the highlighted information.');
    if (body?.error === 'COURSE_ALREADY_SELECTED') {
      throw new Error('This candidate already includes that course. Choose a different section.');
    }
    if (body?.error === 'SECTION_MUST_MATCH_COURSE') {
      throw new Error('Choose another section of the same course when switching sections.');
    }
    throw new Error('Semora could not save this change. Please try again.');
  }
  return response.json() as Promise<T>;
}

export function PlanningLandingPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>();
  const [universities, setUniversities] = useState<University[]>();
  const [academicTermId, setAcademicTermId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      apiRequest<{ workspaces: Workspace[] }>('/api/workspaces'),
      apiRequest<{ universities: University[] }>('/api/terms'),
    ])
      .then(([workspaceResult, termResult]) => {
        if (!isCurrent) return;
        setWorkspaces(workspaceResult.workspaces);
        setUniversities(termResult.universities);
        setAcademicTermId(termResult.universities[0]?.terms[0]?.id ?? '');
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to load semester setup.');
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  if (createdWorkspaceId) return <Navigate replace to={`/plan/${createdWorkspaceId}`} />;
  if (workspaces?.[0]) return <Navigate replace to={`/plan/${workspaces[0].id}`} />;

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      const result = await apiRequest<{ workspace: Workspace }>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ academicTermId }),
      });
      setCreatedWorkspaceId(result.workspace.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create your workspace.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const termOptions =
    universities?.flatMap((university) =>
      university.terms.map((term) => ({
        id: term.id,
        label: `${university.shortName} · ${term.name}`,
      })),
    ) ?? [];

  return (
    <main className="setup-shell">
      <section className="setup-panel" aria-labelledby="setup-title">
        <p className="eyebrow">PLAN / SEMESTER SETUP</p>
        <h1 id="setup-title">Start with the semester you’re designing.</h1>
        <p className="lede">
          Choose a university and academic term. Preferences and commitments can be added as your
          plan takes shape.
        </p>
        {!universities && !error ? (
          <p className="catalogue-message">Loading available terms…</p>
        ) : null}
        {error ? <p className="form-error setup-message">{error}</p> : null}
        {universities ? (
          <form className="setup-form" onSubmit={createWorkspace}>
            <label htmlFor="academic-term">University and academic term</label>
            <select
              id="academic-term"
              onChange={(event) => setAcademicTermId(event.target.value)}
              required
              value={academicTermId}
            >
              {termOptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.label}
                </option>
              ))}
            </select>
            <button disabled={isSubmitting || !academicTermId} type="submit">
              {isSubmitting ? 'Creating workspace…' : 'Begin planning'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

export function PlanningPage() {
  const { workspaceId } = useParams();
  const [workspace, setWorkspace] = useState<Workspace>();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>();
  const [newCandidateName, setNewCandidateName] = useState('');
  const [editedName, setEditedName] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [appliedCourseSearch, setAppliedCourseSearch] = useState('');
  const [catalogueCourses, setCatalogueCourses] = useState<CatalogueCourse[]>([]);
  const [isCatalogueLoading, setIsCatalogueLoading] = useState(false);
  const [activeOfferingId, setActiveOfferingId] = useState<string>();
  const [candidateValidation, setCandidateValidation] = useState<CandidateValidation>();
  const [validationRefresh, setValidationRefresh] = useState(0);
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();

  async function loadWorkspace() {
    if (!workspaceId) return;
    const result = await apiRequest<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
    setWorkspace(result.workspace);
    setCandidateValidation(undefined);
    setSelectedCandidateId((current) =>
      result.workspace.candidates.some((candidate) => candidate.id === current)
        ? current
        : result.workspace.candidates[0]?.id,
    );
  }

  useEffect(() => {
    setError(undefined);
    loadWorkspace().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : 'Unable to load this workspace.'),
    );
  }, [workspaceId]);

  const selectedCandidate = workspace?.candidates.find(
    (candidate) => candidate.id === selectedCandidateId,
  );

  useEffect(() => {
    setEditedName(selectedCandidate?.name ?? '');
  }, [selectedCandidate?.id, selectedCandidate?.name]);

  useEffect(() => {
    if (!selectedCandidateId) {
      setCandidateValidation(undefined);
      return;
    }
    let isCurrent = true;
    apiRequest<CandidateValidation>(`/api/candidates/${selectedCandidateId}/validation`)
      .then((result) => {
        if (isCurrent) setCandidateValidation(result);
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to validate this timetable.');
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedCandidateId, validationRefresh]);

  useEffect(() => {
    if (!workspace || !appliedCourseSearch) {
      setCatalogueCourses([]);
      setIsCatalogueLoading(false);
      return;
    }
    let isCurrent = true;
    setIsCatalogueLoading(true);
    apiRequest<{ courses: CatalogueCourse[] }>(
      `/api/catalogue?term=${encodeURIComponent(workspace.term.name)}&q=${encodeURIComponent(appliedCourseSearch)}`,
    )
      .then((result) => {
        if (!isCurrent) return;
        setCatalogueCourses(result.courses);
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to search courses.');
      })
      .finally(() => {
        if (isCurrent) setIsCatalogueLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [appliedCourseSearch, workspace?.term.name]);

  async function runMutation(action: string, mutation: () => Promise<unknown>) {
    setError(undefined);
    setBusyAction(action);
    try {
      await mutation();
      await loadWorkspace();
      setValidationRefresh((current) => current + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save this change.');
    } finally {
      setBusyAction(undefined);
    }
  }

  function createCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCandidateName.trim();
    if (!workspaceId || !name) return;
    void runMutation('create', async () => {
      const result = await apiRequest<{ candidate: Candidate }>(
        `/api/workspaces/${workspaceId}/candidates`,
        { method: 'POST', body: JSON.stringify({ name }) },
      );
      setNewCandidateName('');
      setSelectedCandidateId(result.candidate.id);
    });
  }

  function renameCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCandidate || !editedName.trim()) return;
    void runMutation('rename', () =>
      apiRequest(`/api/candidates/${selectedCandidate.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editedName.trim() }),
      }),
    );
  }

  function searchCourses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedCourseSearch(courseSearch.trim());
    setActiveOfferingId(undefined);
  }

  function openOffering(course: CatalogueCourse) {
    setActiveOfferingId(course.id);
  }

  function openSelectedCourse(selection: Selection) {
    setCourseSearch(selection.courseCode);
    setAppliedCourseSearch(selection.courseCode);
    setActiveOfferingId(selection.courseOfferingId);
  }

  function chooseSection(sectionId: string) {
    if (!selectedCandidate || !activeOfferingId) return;
    const existing = selectedCandidate.selections.find(
      (selection) => selection.courseOfferingId === activeOfferingId,
    );
    void runMutation('selection', () =>
      apiRequest(
        existing
          ? `/api/selections/${existing.id}`
          : `/api/candidates/${selectedCandidate.id}/selections`,
        { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ sectionId }) },
      ),
    ).then(() => setActiveOfferingId(undefined));
  }

  function removeSelection(selectionId: string) {
    void runMutation('remove-selection', () =>
      apiRequest(`/api/selections/${selectionId}`, { method: 'DELETE' }),
    );
  }

  const activeOffering = catalogueCourses.find((course) => course.id === activeOfferingId);
  const activeSelection = selectedCandidate?.selections.find(
    (selection) => selection.courseOfferingId === activeOfferingId,
  );

  if (!workspace && !error)
    return (
      <main className="app-page">
        <p className="catalogue-message">Loading your semester workspace…</p>
      </main>
    );

  return (
    <main className="planner-page">
      {workspace ? (
        <>
          <header className="planner-heading">
            <div>
              <p className="eyebrow">PLAN / SEMESTER DESIGNER</p>
              <h1>{workspace.term.name}</h1>
              <p className="lede">{workspace.term.university.name}</p>
            </div>
            <Link className="back-link" to="/catalogue">
              Browse catalogue
            </Link>
          </header>

          <section className="candidate-strip" aria-label="Candidate semesters">
            <div className="candidate-tabs">
              {workspace.candidates.map((candidate) => (
                <button
                  className={
                    candidate.id === selectedCandidateId ? 'candidate-tab active' : 'candidate-tab'
                  }
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  type="button"
                >
                  {candidate.name}
                </button>
              ))}
            </div>
            <form className="new-candidate-form" onSubmit={createCandidate}>
              <label className="sr-only" htmlFor="candidate-name">
                New option name
              </label>
              <input
                id="candidate-name"
                maxLength={80}
                onChange={(event) => setNewCandidateName(event.target.value)}
                placeholder={workspace.candidates.length ? 'New option name' : 'Option A'}
                value={newCandidateName}
              />
              <button disabled={busyAction === 'create' || !newCandidateName.trim()} type="submit">
                + New option
              </button>
            </form>
          </section>

          {error ? <p className="form-error planner-error">{error}</p> : null}

          {candidateValidation?.clashes.length ? (
            <aside className="clash-warning" role="alert">
              <p className="eyebrow">HARD CONSTRAINT</p>
              <h2>Schedule conflict detected</h2>
              <p>Resolve these overlaps before treating this candidate as valid.</p>
              <ul>
                {candidateValidation.clashes.map((clash, index) => (
                  <li key={`${clash.type}-${clash.first.id}-${clash.second.id}-${index}`}>
                    <strong>
                      {clash.type === 'COURSE_COURSE'
                        ? 'Course overlap'
                        : 'Hard commitment overlap'}
                    </strong>
                    <span>
                      {clash.dayOfWeek.slice(0, 3)} {clash.startTime}–{clash.endTime} ·{' '}
                      {clash.first.label} ↔ {clash.second.label}
                    </span>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          {selectedCandidate ? (
            <>
              <section className="candidate-workbench">
                <div className="candidate-summary">
                  <p className="eyebrow">CURRENT OPTION</p>
                  <form className="rename-form" onSubmit={renameCandidate}>
                    <label className="sr-only" htmlFor="selected-candidate-name">
                      Candidate name
                    </label>
                    <input
                      id="selected-candidate-name"
                      maxLength={80}
                      onChange={(event) => setEditedName(event.target.value)}
                      value={editedName}
                    />
                    <button
                      className="secondary-button compact-button"
                      disabled={busyAction === 'rename' || !editedName.trim()}
                      type="submit"
                    >
                      Rename
                    </button>
                  </form>
                  <p>
                    {selectedCandidate.selectionCount === 0
                      ? 'No sections selected yet.'
                      : `${selectedCandidate.selectionCount} selected sections`}
                  </p>
                  <p className="credit-total">
                    <strong>{selectedCandidate.credits}</strong> credits
                  </p>
                  <div className="candidate-actions">
                    <button
                      className="secondary-button compact-button"
                      disabled={Boolean(busyAction)}
                      onClick={() =>
                        void runMutation('duplicate', () =>
                          apiRequest(`/api/candidates/${selectedCandidate.id}/duplicate`, {
                            method: 'POST',
                          }),
                        )
                      }
                      type="button"
                    >
                      Duplicate
                    </button>
                    <button
                      className="danger-button compact-button"
                      disabled={Boolean(busyAction)}
                      onClick={() => {
                        if (!window.confirm(`Archive ${selectedCandidate.name}?`)) return;
                        void runMutation('archive', () =>
                          apiRequest(`/api/candidates/${selectedCandidate.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isArchived: true }),
                          }),
                        );
                      }}
                      type="button"
                    >
                      Archive
                    </button>
                  </div>
                </div>
                <div className="selected-courses-panel">
                  <div className="panel-heading-row">
                    <div>
                      <p className="eyebrow">SELECTED COURSES</p>
                      <h2>{selectedCandidate.name}</h2>
                    </div>
                    <span className="credit-badge">{selectedCandidate.credits} credits</span>
                  </div>
                  {selectedCandidate.selections.length ? (
                    <div className="selected-course-list">
                      {selectedCandidate.selections.map((selection) => (
                        <article className="selected-course-row" key={selection.id}>
                          <div>
                            <p className="course-code">{selection.courseCode}</p>
                            <h3>{selection.title}</h3>
                            <p className="course-meta">
                              Section {selection.sectionCode} · {selection.credits} credits
                            </p>
                            <p className="meeting-summary">
                              {selection.meetings.map(formatMeeting).join(' · ') || 'Timing TBA'}
                            </p>
                          </div>
                          <div className="selected-course-actions">
                            <button
                              className="secondary-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => openSelectedCourse(selection)}
                              type="button"
                            >
                              Change section
                            </button>
                            <button
                              className="danger-button compact-button"
                              disabled={Boolean(busyAction)}
                              onClick={() => removeSelection(selection.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="selected-courses-empty">
                      Search the catalogue below to add your first course section.
                    </p>
                  )}
                </div>
              </section>

              <section className="planner-selection-layout">
                <section className="planner-course-browser" aria-labelledby="course-browser-title">
                  <div className="panel-heading-row">
                    <div>
                      <p className="eyebrow">COURSE CATALOGUE</p>
                      <h2 id="course-browser-title">Add a section</h2>
                    </div>
                    <Link className="back-link" to="/catalogue">
                      Full catalogue
                    </Link>
                  </div>
                  <form className="planner-search" onSubmit={searchCourses}>
                    <label className="sr-only" htmlFor="planner-course-search">
                      Search courses
                    </label>
                    <input
                      id="planner-course-search"
                      onChange={(event) => setCourseSearch(event.target.value)}
                      placeholder="Search by code or title"
                      value={courseSearch}
                    />
                    <button disabled={!courseSearch.trim()} type="submit">
                      Search
                    </button>
                  </form>
                  {isCatalogueLoading ? (
                    <p className="catalogue-message">Searching courses…</p>
                  ) : null}
                  {!isCatalogueLoading && appliedCourseSearch && !catalogueCourses.length ? (
                    <p className="catalogue-message">No courses match “{appliedCourseSearch}”.</p>
                  ) : null}
                  <div className="planner-course-results">
                    {catalogueCourses.map((course) => (
                      <button
                        className={
                          course.id === activeOfferingId
                            ? 'planner-course-row active'
                            : 'planner-course-row'
                        }
                        key={course.id}
                        onClick={() => openOffering(course)}
                        type="button"
                      >
                        <span>
                          <strong>{course.courseCode}</strong>
                          <span>{course.title}</span>
                        </span>
                        <small>
                          {course.credits} cr · {course.sections.length} sections
                        </small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="section-picker" aria-labelledby="section-picker-title">
                  {activeOffering ? (
                    <>
                      <div className="panel-heading-row">
                        <div>
                          <p className="eyebrow">SECTION OPTIONS</p>
                          <h2 id="section-picker-title">{activeOffering.courseCode}</h2>
                          <p className="course-meta">{activeOffering.title}</p>
                        </div>
                        <span className="credit-badge">{activeOffering.credits} credits</span>
                      </div>
                      <div className="section-option-list">
                        {activeOffering.sections.map((section) => {
                          const isSelected = activeSelection?.sectionId === section.id;
                          return (
                            <article
                              className={isSelected ? 'section-option selected' : 'section-option'}
                              key={section.id}
                            >
                              <div>
                                <h3>Section {section.sectionCode}</h3>
                                <p>{section.instructor ?? 'Instructor not provided'}</p>
                                <p className="meeting-summary">
                                  {section.meetings.map(formatMeeting).join(' · ') || 'Timing TBA'}
                                </p>
                              </div>
                              <button
                                className={
                                  isSelected ? 'secondary-button compact-button' : 'compact-button'
                                }
                                disabled={Boolean(busyAction) || isSelected}
                                onClick={() => chooseSection(section.id)}
                                type="button"
                              >
                                {isSelected
                                  ? 'Selected'
                                  : activeSelection
                                    ? 'Switch to this section'
                                    : 'Add section'}
                              </button>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="planner-empty-state compact-empty">
                      <p className="eyebrow">SECTION OPTIONS</p>
                      <h2>Choose a course.</h2>
                      <p>
                        Search the catalogue and select a course to see its available sections and
                        timings.
                      </p>
                    </div>
                  )}
                </section>
              </section>
            </>
          ) : (
            <section className="planner-empty-state standalone-empty">
              <p className="eyebrow">YOUR FIRST OPTION</p>
              <h2>Create a candidate semester.</h2>
              <p>
                Start with one possible route, then duplicate it when you want to explore a
                trade-off.
              </p>
            </section>
          )}
        </>
      ) : (
        <p className="form-error">{error}</p>
      )}
    </main>
  );
}
