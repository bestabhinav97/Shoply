import { Link, NavLink } from "react-router-dom";
import { Icon } from "../../ui/Icon";

export function AdminSidebar({ onNavigate }) {
  return (
    <>
      <Link
        className="admin-brand"
        to="/admin"
        onClick={onNavigate}
        aria-label="Shoply administration"
        title="Shoply administration"
      >
        <Icon name="bag" />
        <span className="admin-brand-copy" aria-hidden="true">
          <strong>Shoply</strong>
          <small>Administration</small>
        </span>
      </Link>

      <nav className="admin-navigation" aria-label="Admin navigation">
        <NavLink
          to="/admin"
          end
          onClick={onNavigate}
          aria-label="Dashboard"
          title="Dashboard"
        >
          <Icon name="dashboard" />
          <span className="admin-nav-label" aria-hidden="true">
            Dashboard
          </span>
        </NavLink>
        <NavLink
          to="/admin/products"
          onClick={onNavigate}
          aria-label="Products"
          title="Products"
        >
          <Icon name="products" />
          <span className="admin-nav-label" aria-hidden="true">
            Products
          </span>
        </NavLink>
        <Link
          className="admin-shop-link"
          to="/"
          onClick={onNavigate}
          aria-label="Back to shop"
          title="Back to shop"
        >
          <Icon name="back" />
          <span className="admin-nav-label" aria-hidden="true">
            Back to shop
          </span>
        </Link>
      </nav>
    </>
  );
}
