import { Link } from "react-router-dom";
import { Input } from "../../../../components/ui/Input";
import { categoryLink } from "../../utils/categoryLink";

export function FilterSidebar({ categories, params, inStock, minPrice, maxPrice, onChange, onNavigate, idPrefix }) {
  const selected = params.get("category") || "";
  return (
    <div className="filter-groups">
      <h2>Filters</h2>
      <fieldset>
        <legend>Category</legend>
        <div className="filter-category-list">
          <Link to={categoryLink(params, "")} aria-current={!selected ? "page" : undefined} onClick={onNavigate}>All categories</Link>
          {categories.map((category) => <Link key={category.id} to={categoryLink(params, category.slug)} aria-current={selected === category.slug ? "page" : undefined} onClick={onNavigate}>{category.name}</Link>)}
        </div>
      </fieldset>
      <p className="filter-scope">Availability and price apply to loaded products. More products load as you scroll.</p>
      <fieldset>
        <legend>Availability</legend>
        <label className="stock-filter"><input type="checkbox" checked={inStock} onChange={(event) => onChange("inStock", event.target.checked)} />In stock only</label>
      </fieldset>
      <fieldset>
        <legend>Price range · SEK</legend>
        <div className="price-filter-inputs">
          <div><Input id={`${idPrefix}-min`} label="Min price" type="number" min="0" step="0.01" placeholder="Min" value={minPrice} onChange={(event) => onChange("minPrice", event.target.value)} /></div>
          <div><Input id={`${idPrefix}-max`} label="Max price" type="number" min="0" step="0.01" placeholder="Max" value={maxPrice} onChange={(event) => onChange("maxPrice", event.target.value)} /></div>
        </div>
        {minPrice !== "" && maxPrice !== "" && Number(minPrice) > Number(maxPrice) && <p className="field-error" role="alert">Min price must not exceed max price.</p>}
      </fieldset>
    </div>
  );
}
