import { Icon } from "../../../../components/ui/Icon";
import { Input } from "../../../../components/ui/Input";
import { Button } from "../../../../components/ui/Button";
import { Select } from "../../../../components/ui/Select";

export function ProductImagesEditor({ images, variants, onChange, disabled }) {
  const changeImage = (index, value) =>
    onChange(images.map((item, i) => (i === index ? value : item)));
  return (
    <fieldset className="images-editor" disabled={disabled}>
      <legend className="sr-only">Images</legend>
      <h3>Images</h3>
      <div className="image-storage-notice">
        <Icon name="image" />
        <div>
          <strong>Add images from your library</strong>
          <p>
            Use an existing image storage key. Image uploading is not available.
          </p>
        </div>
      </div>
      {images.map((image, index) => (
        <fieldset className="image-editor-card" key={image.id}>
          <legend className="sr-only">Image {index + 1}</legend>
          <h3>Image {index + 1}</h3>
          {image.storageKey && (
            <img
              className="editor-image-preview"
              src={`/images/${image.storageKey}`}
              alt={image.alt || `Image ${index + 1} preview`}
              width="96"
              height="96"
            />
          )}
          <Input
            label={`Image ${index + 1} storage key`}
            required
            placeholder="products/example.webp"
            value={image.storageKey}
            onChange={(e) =>
              changeImage(index, { ...image, storageKey: e.target.value })
            }
          />
          <Input
            label={`Image ${index + 1} alt text`}
            required
            maxLength={300}
            value={image.alt}
            onChange={(e) =>
              changeImage(index, { ...image, alt: e.target.value })
            }
          />
          {["width", "height"].map((dimension) => (
            <Input
              key={dimension}
              label={`Image ${index + 1} ${dimension}`}
              required
              type="number"
              min={1}
              max={10000}
              value={image[dimension]}
              onChange={(e) =>
                changeImage(index, {
                  ...image,
                  [dimension]: Number(e.target.value),
                })
              }
            />
          ))}
          <Select
            label={`Image ${index + 1} association`}
            value={image.variantId || ""}
            onChange={(e) =>
              changeImage(index, {
                ...image,
                variantId: e.target.value || null,
              })
            }
          >
            <option value="">Shared product image</option>
            {variants.map((v, vi) => (
              <option key={v.id} value={v.id}>
                {v.sku || `Variant ${vi + 1}`}
              </option>
            ))}
          </Select>
          <Button
            onClick={() => onChange(images.filter((i) => i.id !== image.id))}
          >
            Remove image {index + 1}
          </Button>
        </fieldset>
      ))}
      <Button
        disabled={images.length >= 50}
        onClick={() =>
          onChange([
            ...images,
            {
              id: crypto.randomUUID(),
              variantId: null,
              storageKey: "",
              alt: "",
              width: 800,
              height: 1000,
            },
          ])
        }
      >
        Add image
      </Button>
    </fieldset>
  );
}
