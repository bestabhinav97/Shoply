import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Drawer } from "../../../../components/ui/Drawer";
import { Icon } from "../../../../components/ui/Icon";
import { FilterSidebar } from "./FilterSidebar";
import { useCategories, useProducts } from "../../hooks/useProducts";
import { ProductSort } from "./ProductSort";
import { Button } from "../../../../components/ui/Button";
import { ProductGrid, ProductSkeletons } from "./ProductGrid";

export function ProductCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    q: searchParams.get("q") || "",
    category: searchParams.get("category") || "",
    sort: searchParams.get("sort") || "newest",
    page: searchParams.get("page") || "1",
    limit: "12",
  };
  const products = useProducts(filters);
  const pagination = products.data?.pagination;
  const categories = useCategories();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({ inStock: false, minPrice: "", maxPrice: "" });
  const { inStock, minPrice, maxPrice } = localFilters;
  const hasLocalFilters = inStock || minPrice !== "" || maxPrice !== "";
  const items = (products.data?.items || []).filter((product) =>
    (!inStock || product.inStock) &&
    (minPrice === "" || product.priceMinor >= Math.round(Number(minPrice) * 100)) &&
    (maxPrice === "" || product.priceMinor <= Math.round(Number(maxPrice) * 100))
  );
  function changeLocalFilter(key, value) {
    setLocalFilters((previous) => ({ ...previous, [key]: value }));
  }
  function removeFilter(key) {
    const next = new URLSearchParams(searchParams);
    next.delete(key);
    next.delete("page");
    setSearchParams(next);
  }
  function clearFilters() {
    setLocalFilters({ inStock: false, minPrice: "", maxPrice: "" });
    const next = new URLSearchParams(searchParams);
    ["q", "category", "page"].forEach((key) => next.delete(key));
    setSearchParams(next);
  }
  const sidebarProps = {
    categories: categories.data?.items || [], params: searchParams,
    inStock, minPrice, maxPrice, onChange: changeLocalFilter,
  };
  const categoryName = categories.data?.items.find((category) => category.slug === filters.category)?.name || filters.category;

  function goToPage(page) {
    const next = new URLSearchParams(searchParams);
    next.set("page", page);
    setSearchParams(next);
  }

  return (
    <section id="catalog-listing" className="catalog-listing" aria-label="Product catalog">
      <aside className="filter-sidebar" aria-label="Product filters">
        <FilterSidebar {...sidebarProps} idPrefix="desktop" />
      </aside>
      <Drawer id="catalog-filter-drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Product filters">
        <FilterSidebar {...sidebarProps} idPrefix="mobile" onNavigate={() => setDrawerOpen(false)} />
        <Button className="filter-done" variant="primary" onClick={() => setDrawerOpen(false)}>Show results</Button>
      </Drawer>
      <div className="catalog-results">
        <div className="catalog-toolbar">
          <div className="catalog-toolbar-heading">
            <h2>Explore the catalog</h2>
            {products.isSuccess && <p className="catalog-count" role="status">
              {hasLocalFilters ? `${items.length} of ${products.data.items.length} on this page` : `${pagination.total} ${pagination.total === 1 ? "product" : "products"}`}
              {filters.q && <> matching “{filters.q}”</>}
            </p>}
          </div>
          <Button className="mobile-filter-button" aria-controls="catalog-filter-drawer" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" />Filters</Button>
          <ProductSort value={filters.sort} />
        </div>
        {(filters.q || filters.category || hasLocalFilters) && <div className="filter-chips" aria-label="Active filters">
          {filters.q && <Button onClick={() => removeFilter("q")} aria-label="Remove search filter">Search: {filters.q} <span aria-hidden="true">×</span></Button>}
          {filters.category && <Button onClick={() => removeFilter("category")} aria-label="Remove category filter">{categoryName} <span aria-hidden="true">×</span></Button>}
          {inStock && <Button onClick={() => changeLocalFilter("inStock", false)}>In stock only <span aria-hidden="true">×</span></Button>}
          {minPrice !== "" && <Button onClick={() => changeLocalFilter("minPrice", "")}>Min: {minPrice} SEK <span aria-hidden="true">×</span></Button>}
          {maxPrice !== "" && <Button onClick={() => changeLocalFilter("maxPrice", "")}>Max: {maxPrice} SEK <span aria-hidden="true">×</span></Button>}
          <Button variant="text" onClick={clearFilters}>Clear all</Button>
        </div>}

      {products.isPending && <ProductSkeletons />}

      {products.isError && (
        <div className="catalog-feedback" role="alert">
          <h2>We couldn’t load the products.</h2>
          <p>{products.error.message}</p>
          <Button onClick={() => products.refetch()}>Try again</Button>
          <Link className="button" to="/products">
            Reset filters
          </Link>
        </div>
      )}

      {products.isSuccess && (
        <>
          {items.length ? (
            <ProductGrid products={items} />
          ) : (
            <div className="catalog-feedback">
              <h2>
                {pagination.total || hasLocalFilters || filters.q || filters.category
                  ? "No products match your filters"
                  : "No products found"}
              </h2>
              <p>Try another search or browse all products.</p>
              <Button onClick={clearFilters}>Clear filters</Button>
              <Link className="button" to="/products">
                Browse all products
              </Link>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <nav className="catalog-pagination" aria-label="Product pages">
              <Button
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      </div>
    </section>
  );
}
