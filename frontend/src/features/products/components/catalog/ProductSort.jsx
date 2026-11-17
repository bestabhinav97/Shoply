import { useSearchParams } from "react-router-dom";
import { Select } from "../../../../components/ui/Select";

export function ProductSort({ value }) {
  const [searchParams, setSearchParams] = useSearchParams();

  function changeSort(event) {
    const next = new URLSearchParams(searchParams);
    next.set("sort", event.target.value);
    next.delete("page");
    setSearchParams(next);
  }

  return (
    <div className="catalog-sort">
      <Select
        id="catalog-sort"
        label="Sort by"
        value={value}
        onChange={changeSort}
      >
        <option value="newest">Newest</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="name">Name: A–Z</option>
      </Select>
    </div>
  );
}
