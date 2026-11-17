import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useCategories } from "../../hooks/useProducts";

import { categoryLink } from "../../utils/categoryLink";

export function CategoryNav() {
  const categories = useCategories();
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const active = pathname === "/products" ? params.get("category") || "" : null;
  const catalogParams = pathname === "/products" ? params : new URLSearchParams();
  return (
    <nav className="category-nav" aria-label="Shop by category">
      <div className="category-nav-inner">
        <Link to={categoryLink(catalogParams, "")} aria-current={active === "" ? "page" : undefined}>All products</Link>
        {categories.data?.items.map((category) => (
          <Link key={category.id} to={categoryLink(catalogParams, category.slug)} aria-current={active === category.slug ? "page" : undefined}>{category.name}</Link>
        ))}
      </div>
    </nav>
  );
}
