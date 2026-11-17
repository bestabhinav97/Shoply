import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../../../utils/formatCurrency";

export function ProductCard({ product, headingLevel: Heading = 'h2' }) {
  const [failedImage, setFailedImage] = useState(null);
  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-card-link">
        <div className="product-card-photo">
          {product.image && failedImage !== product.image.url ? (
            <img
              src={product.image.url}
              alt={product.image.alt || product.name}
              width={product.image.width}
              height={product.image.height}
              loading="lazy"
              decoding="async"
              onError={() => setFailedImage(product.image.url)}
            />
          ) : (
            <span className="photo-placeholder">Photo coming soon</span>
          )}
          {!product.inStock && <span className="product-badge">Out of stock</span>}
        </div>

        <div className="product-card-body">
          <p className="product-category">{product.category.name}</p>
          <Heading>{product.name}</Heading>
          <p className="product-price">
            {product.hasPriceRange && (
              <span className="price-prefix">From </span>
            )}
            {formatCurrency(product.priceMinor)}
          </p>
          <p
            className={
              product.inStock ? "stock-status available" : "stock-status"
            }
          >
            <span aria-hidden="true">{product.inStock ? "●" : "○"}</span>{" "}
            {product.inStock ? "In stock" : "Out of stock"}
          </p>
          <span className="product-card-action">
            View product
          </span>
        </div>
      </Link>
    </article>
  );
}
