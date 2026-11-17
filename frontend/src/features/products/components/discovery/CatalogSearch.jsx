import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Icon } from "../../../../components/ui/Icon";
import { Select } from "../../../../components/ui/Select";
import { useCategories } from "../../hooks/useProducts";

function SearchForm({ initialQuery, initialCategory, sort }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const categories = useCategories();
  const navigate = useNavigate();
  const options = categories.data?.items || [];
  const unknownCategory =
    category && !options.some((option) => option.slug === category);

  function search(event) {
    event.preventDefault();

    const term = query.trim();
    const params = new URLSearchParams();

    setQuery(term);

    if (term) params.set("q", term);
    if (category) params.set("category", category);
    if (sort && sort !== "newest") params.set("sort", sort);

    navigate({ pathname: "/products", search: params.toString() });
  }

  return (
    <div className="header-search">
      <form
        className="header-search-controls"
        role="search"
        aria-label="Product search"
        onSubmit={search}
      >
        <Select
          id="header-category"
          label="Product category"
          labelClassName="sr-only"
          className="header-category-select"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          disabled={categories.isPending}
          aria-describedby={
            categories.isError ? "header-category-error" : undefined
          }
        >
          <option value="">
            {categories.isPending ? "Loading…" : "All categories"}
          </option>
          {unknownCategory && (
            <option value={category}>Selected category ({category})</option>
          )}
          {options.map((option) => (
            <option key={option.id} value={option.slug}>
              {option.name}
            </option>
          ))}
        </Select>

        <Input
          id="header-product-search"
          name="q"
          type="search"
          label="Search products"
          labelClassName="sr-only"
          placeholder="Search Shoply"
          maxLength={100}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <Button type="submit" variant="primary" aria-label="Search">
          <Icon name="search" />
        </Button>
      </form>

      {categories.isError && (
        <p
          id="header-category-error"
          className="header-search-error"
          role="alert"
        >
          Categories unavailable. You can still search.{" "}
          <Button variant="text" onClick={() => categories.refetch()}>
            Retry categories
          </Button>
        </p>
      )}
    </div>
  );
}

export function CatalogSearch() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onCatalog = pathname === "/products";
  const query = onCatalog ? params.get("q") || "" : "";
  const category = onCatalog ? params.get("category") || "" : "";

  // Remount form drafts when navigation changes the committed search. Sorting
  // and pagination do not discard text that the user has not submitted yet.
  return (
    <SearchForm
      key={JSON.stringify([pathname, query, category])}
      initialQuery={query}
      initialCategory={category}
      sort={onCatalog ? params.get("sort") : null}
    />
  );
}
