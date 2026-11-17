import { Input } from "../../../../components/ui/Input";
import { Button } from "../../../../components/ui/Button";
import { Select } from "../../../../components/ui/Select";
import { newVariant } from "../../utils/productEditor";
import { VariantPriceInput } from "../product-create/VariantPriceInput";

export function ProductVariantsEditor({
  variants,
  options,
  images,
  onChange,
  disabled,
  pricesInSek = false,
}) {
  const changeVariant = (index, value) =>
    onChange(variants.map((item, i) => (i === index ? value : item)));
  return (
    <fieldset className="variants-editor" disabled={disabled}>
      <legend className="sr-only">Actual variants</legend>
      <h3>Actual variants</h3>
      <p>
        Choose a combination, then enter its price and stock quantity. Only the
        variants listed here will be sold.
      </p>
      <p className="field-hint" id="variant-sku-hint">
        SKUs are generated automatically when saved. Enter a custom SKU only if
        you use your own codes.
      </p>
      <div
        className="variant-table-scroll"
        role="region"
        aria-label="Editable variants"
        tabIndex={0}
      >
        <table className="variant-edit-table">
          <caption className="sr-only">Product variants</caption>
          <thead>
            <tr>
              <th scope="col">Options</th>
              <th scope="col">SKU</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Active</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => (
              <tr key={variant.id}>
                <td className="variant-options-cell">
                  {!options.length && <span>Default variant</span>}
                  {options.map((option) => (
                    <Select
                      key={option.id}
                      label={`Variant ${index + 1} ${option.name || "option"}`}
                      required
                      value={
                        variant.optionValueIds.find((id) =>
                          option.values.some((v) => v.id === id),
                        ) || ""
                      }
                      onChange={(e) =>
                        changeVariant(index, {
                          ...variant,
                          optionValueIds: [
                            ...variant.optionValueIds.filter(
                              (id) => !option.values.some((v) => v.id === id),
                            ),
                            e.target.value,
                          ],
                        })
                      }
                    >
                      <option value="">Select value</option>
                      {option.values.map((value) => (
                        <option key={value.id} value={value.id}>
                          {value.value || "Unnamed value"}
                        </option>
                      ))}
                    </Select>
                  ))}
                </td>
                <td>
                  <Input
                    label={`Variant ${index + 1} SKU`}
                    placeholder="Auto-generated"
                    aria-describedby="variant-sku-hint"
                    maxLength={100}
                    value={variant.sku}
                    onChange={(e) =>
                      changeVariant(index, { ...variant, sku: e.target.value })
                    }
                  />
                </td>
                <td>
                  {pricesInSek ? (
                    <VariantPriceInput
                      label={`Variant ${index + 1} price (SEK)`}
                      value={variant.priceMinor}
                      onChange={(priceMinor) =>
                        changeVariant(index, { ...variant, priceMinor })
                      }
                    />
                  ) : (
                    <Input
                      label={`Variant ${index + 1} price (öre)`}
                      required
                      type="number"
                      min={0}
                      max={2147483647}
                      step={1}
                      value={variant.priceMinor}
                      onChange={(e) =>
                        changeVariant(index, {
                          ...variant,
                          priceMinor: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </td>
                <td>
                  <Input
                    label={`Variant ${index + 1} stock`}
                    required
                    type="number"
                    min={0}
                    max={2147483647}
                    step={1}
                    value={variant.quantity}
                    onChange={(e) =>
                      changeVariant(index, {
                        ...variant,
                        quantity: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <label>
                    <input
                      type="checkbox"
                      checked={variant.active}
                      onChange={(e) =>
                        changeVariant(index, {
                          ...variant,
                          active: e.target.checked,
                        })
                      }
                    />{" "}
                    Variant {index + 1} active
                  </label>
                </td>
                <td>
                  <Button
                    disabled={images.some((i) => i.variantId === variant.id)}
                    onClick={() =>
                      onChange(variants.filter((v) => v.id !== variant.id))
                    }
                  >
                    Remove variant {index + 1}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        disabled={
          variants.length >= 250 || (!options.length && variants.length > 0)
        }
        onClick={() => onChange([...variants, newVariant(options)])}
      >
        Add variant
      </Button>
    </fieldset>
  );
}
