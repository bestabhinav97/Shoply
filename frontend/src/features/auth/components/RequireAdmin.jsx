import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { RequireAuth } from "./RequireAuth";

function AdminRoleCheck({ children }) {
  const { data: user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <main id="content" className="page-status" tabIndex={-1}>
        <h1>Admin access required</h1>
        <p>Your account does not have access to the administration area.</p>
        <Link className="button" to="/account">
          Go to your account
        </Link>
      </main>
    );
  }

  return children;
}

export function RequireAdmin({ children }) {
  return (
    <RequireAuth>
      <AdminRoleCheck>{children}</AdminRoleCheck>
    </RequireAuth>
  );
}
