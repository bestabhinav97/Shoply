import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";

export function MainLayout({ loadingFallback }) {
  return (
    <>
      <Header />

      <div id="content" tabIndex={-1}>
        <Suspense fallback={loadingFallback}>
          <Outlet />
        </Suspense>
      </div>
    </>
  );
}
