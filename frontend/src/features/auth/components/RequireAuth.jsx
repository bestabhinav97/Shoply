import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RequireAuth({ children }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isPending) return <p className="page-status" role="status">Checking your session…</p>;
  if (auth.isError) return <div className="page-status" role="alert"><p>We couldn’t check your session.</p><button className="button" onClick={() => auth.refetch()}>Try again</button></div>;
  if (!auth.data) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}
