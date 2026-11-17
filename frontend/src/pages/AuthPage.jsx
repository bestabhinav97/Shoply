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
        <span className="eyebrow">YOUR EVERYDAY, REIMAGINED</span>
        <h1>
          Good finds.
          <br />
          Great feeling<span className="accent-dot">.</span>
        </h1>
        <p>
          A place for the things you need.
          <br />
          And the things you’ll love finding.
        </p>
        <div className="bag-art" aria-hidden="true">
          <span className="art-orbit" />
          <span className="art-spark">✳</span>
          <div className="shopping-bag bag-back">
            <span className="bag-handle" />
          </div>
          <div className="shopping-bag bag-front">
            <span className="bag-handle" />
            <span className="bag-mark">s.</span>
          </div>
          <span className="art-caption">THE NEXT GOOD FIND IS YOURS.</span>
        </div>
        <div className="story-footer">
          <span>Made for your everyday</span>
          <span>Sweden / SEK</span>
        </div>
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
          <span className="eyebrow form-eyebrow">
            {register ? 'LET’S GET YOU STARTED' : 'YOUR NEXT FIND AWAITS'}
          </span>
          <h2 id="form-heading">
            {register ? 'Make yourself at home.' : 'Welcome back.'}
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
            {register ? 'Already have an account?' : 'New around here?'}{' '}
            <Link to={switchLink}>
              {register ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
        <p className="secure-note">
          <span aria-hidden="true">◇</span> Your connection. Your account.
          Securely handled.
        </p>
      </section>
    </main>
  );
}
