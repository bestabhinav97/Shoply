import { useState } from "react";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Button } from "../../../../components/ui/Button";
import { CategoryPicker } from "./CategoryPicker";
import { slugFromName } from "../../utils/productCreation";

export function ProductCreateDetails({
  product,
  set,
  categories,
  specifications,
  setSpecifications,
  onCategoryOpen,
  editing = false,
}) {
  // Once changed manually, the handle is independent of subsequent name edits.
  const [customSlug, setCustomSlug] = useState(Boolean(product.slug));
  return (
    <fieldset className="details-section">
      <legend className="sr-only">Product details</legend>
      <h3>Product information</h3>
      <p className="section-description">
        Give your product a clear name and help shoppers understand what makes
        it special.
      </p>
      <div className="editor-field">
        <Input
          label="Product name"
          required
          maxLength={160}
          value={product.name}
          onChange={(e) => {
            set("name", e.target.value);
            if (!customSlug) set("slug", slugFromName(e.target.value));
          }}
        />
      </div>
      <div className="details-short-fields">
        <div className="editor-field">
          <Input
            prefix="/products/"
            label="URL handle"
            required
            maxLength={160}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={product.slug}
            onChange={(e) => {
              set("slug", e.target.value);
              setCustomSlug(true);
            }}
          />
        </div>
        <CategoryPicker
          categories={categories}
          value={product.categoryId}
          onChange={(id) => set("categoryId", id)}
          onOpenChange={onCategoryOpen}
        />
      </div>
      <div className="editor-field">
        <label htmlFor="new-description">Description</label>
        <textarea
          id="new-description"
          aria-describedby="description-hint"
          maxLength={5000}
          rows={4}
          value={product.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <span className="field-hint" id="description-hint">
          {product.description.length.toLocaleString()} / 5,000 characters
        </span>
      </div>
      <div className="editor-field">
        <Select
          label="Publication status"
          value={product.status}
          onChange={(e) => set("status", e.target.value)}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          {editing && <option value="archived">Archived</option>}
        </Select>
        <p className="muted">
          Draft and archived products are hidden from shoppers. Active products appear in the
          store when they have an active variant.
        </p>
      </div>
      <fieldset>
        <legend className="sr-only">Specifications (optional)</legend>
        <h3>
          Specifications <span className="muted">(optional)</span>
        </h3>
        <p className="muted">
          Shared details such as material or screen size. Add selectable choices
          in the Options section.
        </p>
        {specifications.map((row, index) => (
          <div className="specification-row" key={row.id}>
            <div>
              <Input
                label={`Specification ${index + 1} name`}
                required
                maxLength={100}
                placeholder="Material"
                value={row.name}
                onChange={(e) =>
                  setSpecifications(
                    specifications.map((r) =>
                      r.id === row.id ? { ...r, name: e.target.value } : r,
                    ),
                  )
                }
              />
            </div>
            <div>
              <Input
                label={`Specification ${index + 1} value`}
                required
                maxLength={1000}
                placeholder="Canvas"
                value={row.value}
                onChange={(e) =>
                  setSpecifications(
                    specifications.map((r) =>
                      r.id === row.id ? { ...r, value: e.target.value } : r,
                    ),
                  )
                }
              />
            </div>
            <Button
              variant="text"
              onClick={() =>
                setSpecifications(specifications.filter((r) => r.id !== row.id))
              }
            >
              Remove specification {index + 1}
            </Button>
          </div>
        ))}
        <Button
          disabled={specifications.length >= 50}
          onClick={() =>
            setSpecifications([
              ...specifications,
              { id: crypto.randomUUID(), name: "", value: "" },
            ])
          }
        >
          Add specification
        </Button>
      </fieldset>
    </fieldset>
  );
}
