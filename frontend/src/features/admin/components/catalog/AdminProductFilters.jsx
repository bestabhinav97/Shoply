import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Button } from "../../../../components/ui/Button";
import { Icon } from "../../../../components/ui/Icon";

export function AdminProductFilters({ filters, categories, onApply }) {
  const [draft, setDraft] = useState({
    q: "",
    category: "",
    status: "",
    availability: "",
    sort: "newest",
    ...filters,
  });
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  return (
    <form
      className="admin-catalog-filters"
      aria-label="Catalog filters"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      <div className="catalog-search-field">
        <Input
          prefix={<Icon name="search" />}
          label="Search catalog"
          placeholder="Search by name or SKU"
          maxLength={100}
          value={draft.q}
          onChange={(e) => set("q", e.target.value)}
        />
      </div>
      <div>
        <Select
          label="Filter category"
          value={draft.category}
          onChange={(e) => set("category", e.target.value)}
          disabled={categories.isPending || categories.isError}
        >
          <option value="">All categories</option>
          {categories.data?.items.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Select
          label="Filter status"
          value={draft.status}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </Select>
      </div>
      <div>
        <Select
          label="Filter availability"
          value={draft.availability}
          onChange={(e) => set("availability", e.target.value)}
        >
          <option value="">All stock</option>
          <option value="in-stock">In stock</option>
          <option value="out-of-stock">Out of stock</option>
        </Select>
      </div>
      <div>
        <Select
          label="Sort catalog"
          value={draft.sort}
          onChange={(e) => set("sort", e.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </Select>
      </div>
      <div className="filter-actions">
        <Button type="submit">Apply filters</Button>
        <Link className="text-button" to="/admin/products">
          Clear
        </Link>
      </div>
      {categories.isError && (
        <p role="alert">
          Categories could not be loaded.{" "}
          <Button variant="text" onClick={() => categories.refetch()}>
            Retry categories
          </Button>
        </p>
      )}
    </form>
  );
}
