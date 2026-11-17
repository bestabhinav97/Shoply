import { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { Button } from "../../ui/Button";
import { Drawer } from "../../ui/Drawer";
import { Icon } from "../../ui/Icon";
import "./admin-layout.css";
import "./admin-theme.css";

export function AdminLayout({ loadingFallback }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="admin-layout">
      <aside
        id="admin-sidebar"
        className="admin-sidebar"
        aria-label="Administration sidebar"
      >
        <AdminSidebar />
      </aside>

      <Drawer
        id="admin-drawer"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        label="Administration menu"
      >
        <AdminSidebar onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <div id="content" className="admin-content" tabIndex={-1}>
        <div className="admin-menu-controls">
          <Button
            className="mobile-menu-toggle"
            aria-controls="admin-drawer"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" /> Menu
          </Button>
        </div>

        <Suspense fallback={loadingFallback}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
