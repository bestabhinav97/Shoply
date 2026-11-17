import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export function ProductSkeletons() {
  return (
    <div role="status" aria-label="Loading products">
      <p className="muted">Loading products…</p>
      <div className="product-grid" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="product-skeleton">
            <div className="skeleton-photo" />
            <div className="skeleton-line" />
            <div className="skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}
