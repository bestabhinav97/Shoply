import { useState } from "react";
import { Input } from "../../../../components/ui/Input";
import { Select } from "../../../../components/ui/Select";
import { Button } from "../../../../components/ui/Button";
import { useCreateAdminCategory } from "../../hooks/useAdminProduct";
import { slugFromName } from "../../utils/productCreation";
import { Icon } from "../../../../components/ui/Icon";

export function CategoryPicker({ categories, value, onChange, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customSlug, setCustomSlug] = useState(false);
  const [error, setError] = useState("");
  const create = useCreateAdminCategory();
  function toggle(next) {
    setOpen(next);
    onOpenChange(next);
    setError("");
  }
  async function saveCategory() {
    setError("");
    if (!name.trim() || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      setError("Enter a category name and a valid URL handle.");
      return;
    }
    try {
      const result = await create.mutateAsync({ name: name.trim(), slug });
      onChange(result.category.id);
      toggle(false);
      setName("");
      setSlug("");
      setCustomSlug(false);
    } catch (failure) {
      setError(failure.message);
    }
  }
  return (
    <div className="category-picker">
      <Select
        label="Category"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose a category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      {!open && (
        <Button variant="text" onClick={() => toggle(true)}>
          <Icon name="plus" />
          Create category
        </Button>
      )}
      {open && (
        <fieldset disabled={create.isPending} className="category-create">
          <legend className="sr-only">New category</legend>
          <h3>New category</h3>
          <Input
            label="Category name"
            maxLength={100}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!customSlug) setSlug(slugFromName(e.target.value));
            }}
          />
          <Input
            label="Category URL handle"
            maxLength={100}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setCustomSlug(true);
            }}
          />
          <p className="muted">
            Saved separately and available for other products, even if you
            cancel this product.
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="editor-actions">
            <Button onClick={saveCategory}>
              {create.isPending ? "Creating…" : "Save category"}
            </Button>
            <Button variant="text" onClick={() => toggle(false)}>
              Cancel category
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
