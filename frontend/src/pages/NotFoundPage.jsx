import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="page-status">
      <h1>Page not found</h1>
      <Link to="/">Back to Shoply</Link>
    </main>
  );
}
