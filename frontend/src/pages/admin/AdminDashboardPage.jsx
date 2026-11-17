import { useAuth } from "../../features/auth";

export default function AdminDashboardPage() {
  const { data: user } = useAuth();

  return (
    <main className="admin-dashboard">
      <span className="eyebrow">SHOPLY ADMIN</span>
      <h1>Admin dashboard</h1>
      <p>Welcome, {user.firstName}.</p>
      <p className="muted">This is your administration workspace.</p>
    </main>
  );
}
