import { Link, useSearchParams, useLocation } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { Icon } from "../../../../components/ui/Icon";
import { formatCurrency } from "../../../../utils/formatCurrency";
import { useAdminProducts } from "../../hooks/useAdminProducts";
import { useAdminCategories } from "../../hooks/useAdminProduct";
import { AdminProductFilters } from "./AdminProductFilters";
import "./admin-catalog.css";

export function AdminProductList() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const filters = Object.fromEntries(
    ["q", "category", "status", "availability", "sort", "page"]
      .filter((key) => params.has(key))
      .map((key) => [key, params.get(key)]),
  );
  const products = useAdminProducts({ ...filters, page: filters.page || "1" });
  const categories = useAdminCategories();
  const filtered = ["q", "category", "status", "availability"].some((key) =>
    Boolean(filters[key]),
  );
  function goToPage(page) {
    const next = new URLSearchParams(params);
    next.set("page", page);
    setParams(next);
  }
  function applyFilters(draft) {
    const next = new URLSearchParams();
    for (const key of ["q", "category", "status", "availability", "sort"]) {
      const value = draft[key]?.trim();
      if (value && !(key === "sort" && value === "newest"))
        next.set(key, value);
    }
    setParams(next);
  }
  const data = products.data;
  return (
    <div className="admin-catalog-table">
      {location.state?.saved && <p role="status">Product saved.</p>}
      <AdminProductFilters
        key={params.toString()}
        filters={filters}
        categories={categories}
        onApply={applyFilters}
      />
      {products.isPending ? (
        <div className="catalog-loading" role="status">
          <span className="sr-only">Loading products…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <div className="catalog-skeleton" key={i} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : products.isError ? (
        <div role="alert">
          <p>{products.error.message}</p>
          <Button onClick={() => products.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="admin-catalog-meta">
            <p role="status">
              {data.pagination.total}{" "}
              {data.pagination.total === 1 ? "product" : "products"}
              {filtered ? " found" : " in your catalog"}
            </p>
            <span>Prices in SEK</span>
          </div>
          {data.items.length ? (
            <div
              className="admin-table-scroll"
              role="region"
              aria-label="Product catalog"
              tabIndex={0}
            >
              <table>
                <caption className="sr-only">
                  Products, categories, publication status, prices and
                  availability
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="numeric-cell">
                      Price
                    </th>
                    <th scope="col" className="numeric-cell">
                      Active variants
                    </th>
                    <th scope="col">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((product) => (
                    <tr key={product.id}>
                      <th scope="row">
                        <div className="catalog-product">
                          {product.image ? (
                            <img
                              src={product.image.url}
                              alt=""
                              width="48"
                              height="48"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className="catalog-product-placeholder"
                              aria-hidden="true"
                            >
                              {product.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <Link
                            className="catalog-product-link"
                            to={`/admin/products/${product.id}/edit`}
                          >
                            {product.name}
                          </Link>
                        </div>
                      </th>
                      <td data-label="Category">{product.category.name}</td>
                      <td data-label="Status">
                        <span
                          className={`status-label status-${product.status}`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td data-label="Price" className="numeric-cell">
                        {product.priceMinor == null
                          ? "Not set"
                          : `${product.hasPriceRange ? "From " : ""}${formatCurrency(product.priceMinor)}`}
                      </td>
                      <td data-label="Active variants" className="numeric-cell">
                        {product.activeVariantCount}
                      </td>
                      <td data-label="Stock">
                        <span
                          className={`stock-label ${product.inStock ? "stock-available" : "stock-unavailable"}`}
                        >
                          {product.inStock ? "In stock" : "Out of stock"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-catalog-empty">
              <Icon name="products" />
              <h2>
                {data.pagination.total
                  ? "No products on this page"
                  : filtered
                    ? "No matching products"
                    : "Your catalog is empty"}
              </h2>
              <p>
                {filtered
                  ? "Try another search or change your filters."
                  : "Products you create will appear here."}
              </p>
              {data.pagination.total > 0 ? (
                <Button onClick={() => goToPage(1)}>Back to first page</Button>
              ) : filtered ? (
                <Link className="button" to="/admin/products">
                  Clear filters
                </Link>
              ) : (
                <Link className="button primary" to="/admin/products/new">
                  <Icon name="plus" />
                  Create product
                </Link>
              )}
            </div>
          )}
          <p className="catalog-result-count">
            Showing {data.items.length} of {data.pagination.total} products
          </p>
          {data.pagination.totalPages > 1 && (
            <nav className="admin-pagination" aria-label="Admin product pages">
              <Button
                disabled={data.pagination.page <= 1}
                onClick={() => goToPage(data.pagination.page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
              <Button
                disabled={data.pagination.page >= data.pagination.totalPages}
                onClick={() => goToPage(data.pagination.page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
