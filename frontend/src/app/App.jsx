import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppRoutes } from "./router";

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [router] = useState(() => createBrowserRouter([
    { path: "*", element: <AppContent /> },
  ]));

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

function AppContent() {
  const loadingFallback = (
    <p className="page-status" role="status">
      Loading…
    </p>
  );

  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <AppRoutes loadingFallback={loadingFallback} />
    </>
  );
}
