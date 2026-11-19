import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { AuthForm } from '../features/auth/components/AuthForm';

export default function AuthPage({ mode }) {
  const register = mode === 'register';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auth = useAuth();
  const requested = params.get('next') || '/';
  const destination = requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')
    && Array.from(requested).every((character) => character.charCodeAt(0) > 32)
    && !/^\/account(?:\/profile)?\/?(?:[?#]|$)/.test(requested)
    && !/^\/(login|signup)(?:[/?#]|$)/.test(requested) ? requested : '/';
  const switchLink = `${register ? '/login' : '/signup'}?next=${encodeURIComponent(destination)}`;

  if (auth.isPending) {
    return (
      <p className="page-status" role="status">
        Checking your session…
      </p>
    );
  }

  if (auth.data) return <Navigate to={destination} replace />;

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Welcome to Shoply">
        <h1>Your Shoply account</h1>
        <p>Save delivery addresses and manage your cart.</p>
        <div className="story-footer"><span>Sweden / SEK</span></div>
      </section>

      <section className="auth-panel" aria-labelledby="form-heading">
        <Link to="/" className="back-link">
          ← Back to Shoply
        </Link>
        <div className="auth-panel-content">
          <div className="auth-tabs" aria-label="Choose an account action">
            <Link
              to={`/login?next=${encodeURIComponent(destination)}`}
              aria-current={!register ? 'page' : undefined}
            >
              Sign in
            </Link>
            <Link
              to={`/signup?next=${encodeURIComponent(destination)}`}
              aria-current={register ? 'page' : undefined}
            >
              Create account
            </Link>
          </div>
          <h2 id="form-heading">
            {register ? 'Create account' : 'Sign in'}
          </h2>
          <p className="form-intro">
            {register
              ? 'A few details, and you’re part of Shoply.'
              : 'Sign in to your Shoply account.'}
          </p>
          <AuthForm
            key={mode}
            mode={mode}
            onSuccess={() => navigate(destination, { replace: true })}
          />
          <p className="auth-switch">
            {register ? 'Already have an account?' : 'New to Shoply?'}{' '}
            <Link to={switchLink}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
