import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

type Candidate = {
  id: string;
  name: string;
  isArchived: boolean;
  selectionCount: number;
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
  const [busyAction, setBusyAction] = useState<string>();
  const [error, setError] = useState<string>();

  async function loadWorkspace() {
    if (!workspaceId) return;
    const result = await apiRequest<{ workspace: Workspace }>(`/api/workspaces/${workspaceId}`);
    setWorkspace(result.workspace);
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

  async function runMutation(action: string, mutation: () => Promise<unknown>) {
    setError(undefined);
    setBusyAction(action);
    try {
      await mutation();
      await loadWorkspace();
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

          {selectedCandidate ? (
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
              <div className="planner-empty-state">
                <p className="eyebrow">COURSE SELECTION</p>
                <h2>Build {selectedCandidate.name}</h2>
                <p>
                  This planning option is ready for real Fall 2026 course and section selections.
                </p>
                <Link className="primary-link" to="/catalogue">
                  Explore Fall 2026 courses
                </Link>
              </div>
            </section>
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
