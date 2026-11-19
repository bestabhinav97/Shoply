import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Drawer } from "../../../../components/ui/Drawer";
import { Icon } from "../../../../components/ui/Icon";
import { FilterSidebar } from "./FilterSidebar";
import { useCategories } from "../../hooks/useProducts";
import { useInfiniteProducts } from "../../hooks/useInfiniteProducts";
import { CatalogLoadMore } from "./CatalogLoadMore";
import { ProductSort } from "./ProductSort";
import { Button } from "../../../../components/ui/Button";
import { ProductGrid, ProductSkeletons } from "./ProductGrid";

export function ProductCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = {
    q: searchParams.get("q") || "",
    category: searchParams.get("category") || "",
    sort: searchParams.get("sort") || "newest",
    limit: "12",
  };
  const products = useInfiniteProducts(filters);
  const pagination = products.data?.pages[0].pagination;
  const loadedItems = [...new Map(
    (products.data?.pages.flatMap((page) => page.items) || [])
      .map((product) => [product.id, product]),
  ).values()];
  const categories = useCategories();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState({ inStock: false, minPrice: "", maxPrice: "" });
  const { inStock, minPrice, maxPrice } = localFilters;
  const hasLocalFilters = inStock || minPrice !== "" || maxPrice !== "";
  const items = loadedItems.filter((product) =>
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
            {products.data && <p className="catalog-count" role="status">
              {hasLocalFilters ? `${items.length} of ${loadedItems.length} loaded products` : `${pagination.total} ${pagination.total === 1 ? "product" : "products"}`}
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

      {products.isError && !products.data && (
        <div className="catalog-feedback" role="alert">
          <h2>We couldn’t load the products.</h2>
          <p>{products.error.message}</p>
          <Button onClick={() => products.refetch()}>Try again</Button>
          <Link className="button" to="/products">
            Reset filters
          </Link>
        </div>
      )}

      {products.data && (
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

          <CatalogLoadMore query={products} loadedCount={loadedItems.length} />
        </>
      )}
      </div>
    </section>
  );
}
