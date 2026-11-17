import { formatCurrency } from "../../../../utils/formatCurrency";
import { Button } from "../../../../components/ui/Button";

export function ProductCreateReview({
  product,
  categories,
  specifications,
  onEdit,
}) {
  const labels = new Map(
    product.options.flatMap((o) =>
      o.values.map((v) => [v.id, `${o.name}: ${v.value}`]),
    ),
  );
  return (
    <section className="product-review" aria-label="Product review">
      <div className="review-section-heading">
        <h3>{product.name}</h3>
        <Button variant="text" onClick={() => onEdit(0)}>
          Edit details
        </Button>
      </div>
      <dl className="review-details">
        <div>
          <dt>Category</dt>
          <dd>{categories.find((c) => c.id === product.categoryId)?.name}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            {product.status === "draft"
              ? "Draft — hidden from shoppers"
              : "Active"}
          </dd>
        </div>
        <div>
          <dt>URL handle</dt>
          <dd>{product.slug}</dd>
        </div>
        <div>
          <dt>Images</dt>
          <dd>{product.images.length || "No images added"}</dd>
        </div>
      </dl>
      {product.description && <p>{product.description}</p>}
      {specifications.length > 0 && (
        <dl className="review-details">
          {specifications.map((r) => (
            <div key={r.id}>
              <dt>{r.name}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div
        className="admin-table-scroll"
        role="region"
        aria-label="Variant review"
        tabIndex={0}
      >
        <div className="review-section-heading">
          <h3>Variants</h3>
          <div className="editor-actions">
            <Button variant="text" onClick={() => onEdit(1)}>
              Edit options
            </Button>
            <Button variant="text" onClick={() => onEdit(2)}>
              Edit variants
            </Button>
          </div>
        </div>
        <table>
          <caption>Variants to create</caption>
          <thead>
            <tr>
              <th scope="col">Combination</th>
              <th scope="col">SKU</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Active</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => (
              <tr key={v.id}>
                <th scope="row">
                  {v.optionValueIds.map((id) => labels.get(id)).join(" / ") ||
                    "Default variant"}
                </th>
                <td>{v.sku.trim() || "Generated on save"}</td>
                <td>{formatCurrency(v.priceMinor)}</td>
                <td>{v.quantity}</td>
                <td>{v.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="review-section-heading">
        <h3>Images</h3>
        <Button variant="text" onClick={() => onEdit(3)}>
          Edit images
        </Button>
      </div>
      {product.images.length > 0 && (
        <div className="review-images">
          {product.images.map((image) => (
            <figure key={image.id}>
              <img
                src={`/images/${image.storageKey}`}
                alt={image.alt}
                width={image.width}
                height={image.height}
              />
              <figcaption>
                {image.variantId
                  ? product.variants.find((v) => v.id === image.variantId)?.sku
                  : "Shared image"}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="muted">
        Saving creates this product and the listed variants together. You can go
        back to check any details before saving.
      </p>
    </section>
  );
}
