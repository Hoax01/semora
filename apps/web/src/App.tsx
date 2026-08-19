import { FormEvent, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { authClient } from './auth-client';

type AuthMode = 'sign-in' | 'sign-up';

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

    const result = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'Unable to continue. Please try again.');
      return;
    }

    navigate('/', { replace: true });
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

function ProtectedShell() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <main className="shell">Loading your workspace…</main>;
  }

  if (!session) {
    return <Navigate replace to="/sign-in" />;
  }

  async function handleSignOut() {
    await authClient.signOut();
    navigate('/sign-in', { replace: true });
  }

  return (
    <main className="shell">
      <p className="eyebrow">SEMORA / FOUNDATION</p>
      <h1>Design a semester you won’t regret.</h1>
      <p className="lede">
        Welcome, {session.user.name}. Your planning workspace is ready for Phase 1.
      </p>
      <div className="status-card" role="status">
        <span className="status-dot" aria-hidden="true" />
        Signed in as {session.user.email}
      </div>
      <button className="secondary-button" onClick={handleSignOut} type="button">
        Sign out
      </button>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<ProtectedShell />} path="/" />
        <Route element={<AuthPage mode="sign-in" />} path="/sign-in" />
        <Route element={<AuthPage mode="sign-up" />} path="/sign-up" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
