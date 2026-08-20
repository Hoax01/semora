import { FormEvent, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { authClient } from './auth-client';
import { PlanningLandingPage, PlanningPage } from './features/planning';

type AuthMode = 'sign-in' | 'sign-up';

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
    meetings: Array<{
      day: string;
      startTime: string;
      endTime: string;
      type: string;
      location: string | null;
    }>;
  }>;
};

async function getApi<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok)
    throw new Error(
      response.status === 401 ? 'Please sign in again.' : 'Unable to load catalogue.',
    );
  return response.json() as Promise<T>;
}

function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? 'Unable to continue. Please try again.');
        return;
      }
      navigate('/', { replace: true });
    } catch {
      setError('Unable to reach Semora. Check that the API is running.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">SEMORA / FOUNDATION</p>
        <h1 id="auth-title">{isSignUp ? 'Start with your semester.' : 'Welcome back.'}</h1>
        <p className="lede">
          {isSignUp
            ? 'Create your account to begin designing a semester with intention.'
            : 'Sign in to continue building your semester workspace.'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp ? (
            <label>
              Name
              <input
                autoComplete="name"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          ) : null}
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? 'Already have an account?' : 'New to Semora?'}{' '}
          <Link to={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Create one'}</Link>
        </p>
      </section>
    </main>
  );
}

function CataloguePage() {
  const [searchParams] = useSearchParams();
  const termId = searchParams.get('termId')?.trim() ?? '';
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [courses, setCourses] = useState<CatalogueCourse[]>([]);
  const [termName, setTermName] = useState('Fall 2026');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setError(undefined);
    const params = new URLSearchParams(termId ? { termId } : { term: 'Fall 2026' });
    if (appliedQuery) params.set('q', appliedQuery);
    getApi<{ term: { name: string }; courses: CatalogueCourse[] }>(`/api/catalogue?${params}`)
      .then((result) => {
        if (!isCurrent) return;
        setCourses(result.courses);
        setTermName(result.term.name);
      })
      .catch((reason: unknown) => {
        if (isCurrent)
          setError(reason instanceof Error ? reason.message : 'Unable to load catalogue.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [appliedQuery, termId]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedQuery(query.trim());
  }

  return (
    <main className="app-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAN / COURSE CATALOGUE</p>
          <h1>{termName}</h1>
          <p className="lede">Browse the courses and sections available for your next semester.</p>
        </div>
        <Link className="back-link" to="/">
          Back to workspace
        </Link>
      </div>
      <form className="catalogue-search" onSubmit={submitSearch}>
        <label htmlFor="course-search">Search courses</label>
        <div className="search-row">
          <input
            id="course-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try CS, Operating Systems, or Computer Science"
            value={query}
          />
          <button type="submit">Search</button>
        </div>
      </form>
      {isLoading ? <p className="catalogue-message">Loading available courses…</p> : null}
      {error ? <p className="form-error catalogue-message">{error}</p> : null}
      {!isLoading && !error && courses.length === 0 ? (
        <p className="catalogue-message">
          No courses match “{appliedQuery}”. Try a course code or department.
        </p>
      ) : null}
      <div className="catalogue-list">
        {courses.map((course) => (
          <Link
            className="catalogue-item"
            key={course.id}
            to={`/catalogue/${course.id}${termId ? `?termId=${encodeURIComponent(termId)}` : ''}`}
          >
            <div>
              <p className="course-code">{course.courseCode}</p>
              <h2>{course.title}</h2>
              <p className="course-meta">
                {course.department ?? 'General'} · {course.credits} credits
              </p>
            </div>
            <div className="course-summary">
              <strong>{course.sections.length} sections</strong>
              <span>{course.sections[0]?.meetings[0]?.day ?? 'Timing TBA'}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

function CourseDetailPage() {
  const { offeringId } = useParams();
  const [searchParams] = useSearchParams();
  const termId = searchParams.get('termId')?.trim() ?? '';
  const [course, setCourse] = useState<CatalogueCourse>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!offeringId) return;
    getApi<{ course: CatalogueCourse }>(`/api/catalogue/${offeringId}`)
      .then((result) => setCourse(result.course))
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'Unable to load course.'),
      );
  }, [offeringId]);

  if (error)
    return (
      <main className="app-page">
        <p className="form-error">{error}</p>
      </main>
    );
  if (!course)
    return (
      <main className="app-page">
        <p className="catalogue-message">Loading course details…</p>
      </main>
    );

  return (
    <main className="app-page">
      <Link
        className="back-link"
        to={`/catalogue${termId ? `?termId=${encodeURIComponent(termId)}` : ''}`}
      >
        ← Back to catalogue
      </Link>
      <div className="detail-heading">
        <p className="eyebrow">
          {course.courseCode} / {course.term}
        </p>
        <h1>{course.title}</h1>
        <p className="course-meta">
          {course.department ?? 'General'} · {course.credits} credits
        </p>
      </div>
      <p className="course-description">
        {course.description ?? 'No course description has been provided yet.'}
      </p>
      <section className="section-grid" aria-labelledby="sections-title">
        <h2 id="sections-title">Available sections</h2>
        {course.sections.map((section) => (
          <article className="section-card" key={section.id}>
            <div className="section-card-heading">
              <h3>Section {section.sectionCode}</h3>
              <span>
                {section.capacity ? `Capacity ${section.capacity}` : 'Capacity not provided'}
              </span>
            </div>
            <p>{section.instructor ?? 'Instructor not provided'}</p>
            <ul>
              {section.meetings.map((meeting) => (
                <li key={`${meeting.day}-${meeting.startTime}-${meeting.type}`}>
                  {meeting.day} · {meeting.startTime}–{meeting.endTime} ·{' '}
                  {meeting.location ?? 'Location TBA'}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}

function ProtectedShell() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return <main className="shell">Loading your workspace…</main>;
  if (!session) return <Navigate replace to="/sign-in" />;

  async function handleSignOut() {
    await authClient.signOut();
    navigate('/sign-in', { replace: true });
  }

  return (
    <>
      <nav className="app-nav" aria-label="Main navigation">
        <Link className="brand" to="/">
          semora
        </Link>
        <div className="nav-actions">
          <Link to="/">Plan</Link>
          <Link to="/catalogue">Catalogue</Link>
          <button className="nav-signout" onClick={handleSignOut} type="button">
            Sign out
          </button>
        </div>
      </nav>
      <Outlet />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthPage mode="sign-in" />} path="/sign-in" />
        <Route element={<AuthPage mode="sign-up" />} path="/sign-up" />
        <Route element={<ProtectedShell />} path="/">
          <Route element={<PlanningLandingPage />} index />
          <Route element={<PlanningPage />} path="plan/:workspaceId" />
          <Route element={<CataloguePage />} path="catalogue" />
          <Route element={<CourseDetailPage />} path="catalogue/:offeringId" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
