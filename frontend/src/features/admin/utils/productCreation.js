export const slugFromName = (name) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
    .replace(/-$/, "");

export function priceFromText(text) {
  if (!/^\d{1,8}([.,]\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minor <= 2147483647 ? minor : null;
}
export const priceToText = (minor) =>
  Number.isInteger(minor)
    ? `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`
    : "";
export const specificationsFromRows = (rows) =>
  Object.fromEntries(rows.map((r) => [r.name.trim(), r.value.trim()]));

// These checks explain invalid configurations early. The API remains authoritative.
export function creationErrors(product, specifications, section) {
  const errors = [];
  const check = (name) => !section || section === name;
  const normalize = (s) => s.trim().toLowerCase();
  const duplicates = (values) => new Set(values).size !== values.length;
  if (check("details")) {
    if (!product.name.trim()) errors.push("Enter a product name.");
    if (!product.categoryId) errors.push("Choose or create a category.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(product.slug))
      errors.push(
        "Enter a URL handle using lowercase letters, numbers and hyphens.",
      );
    if (specifications.some((r) => !r.name.trim() || !r.value.trim()))
      errors.push(
        "Give each specification a name and a value, or remove the empty row.",
      );
    if (duplicates(specifications.map((r) => normalize(r.name))))
      errors.push("Specification names must be unique.");
  }
  if (check("options")) {
    if (duplicates(product.options.map((o) => normalize(o.name))))
      errors.push("Option names must be unique.");
    for (const option of product.options) {
      if (
        !option.name.trim() ||
        !option.values.length ||
        option.values.some((v) => !v.value.trim())
      )
        errors.push("Each option needs a name and at least one value.");
      if (duplicates(option.values.map((v) => normalize(v.value))))
        errors.push(
          `Values for ${option.name || "each option"} must be unique.`,
        );
    }
  }
  if (check("variants")) {
    if (!product.variants.length) errors.push("Add at least one variant.");
    if (duplicates(product.variants.map((v) => v.sku.trim()).filter(Boolean)))
      errors.push("Each variant needs a unique SKU.");
    if (
      duplicates(
        product.variants.map((v) => [...v.optionValueIds].sort().join(",")),
      )
    )
      errors.push(
        "Each variant must have a different combination of option values.",
      );
    for (const [i, variant] of product.variants.entries()) {
      if (
        !Number.isInteger(variant.priceMinor) ||
        variant.priceMinor < 0 ||
        variant.priceMinor > 2147483647
      )
        errors.push(
          `Enter a valid SEK price for variant ${i + 1}, with at most two decimal places.`,
        );
      if (
        !Number.isInteger(variant.quantity) ||
        variant.quantity < 0 ||
        variant.quantity > 2147483647
      )
        errors.push(
          `Enter a nonnegative whole stock quantity for variant ${i + 1}.`,
        );
      if (
        variant.optionValueIds.length !== product.options.length ||
        !product.options.every(
          (o) =>
            o.values.filter((v) => variant.optionValueIds.includes(v.id))
              .length === 1,
        )
      )
        errors.push(`Choose one value for every option on variant ${i + 1}.`);
    }
  }
  if (check("images"))
    for (const image of product.images) {
      if (
        !/^products\/[a-z0-9-]+\.(jpg|webp|png)$/.test(image.storageKey) ||
        !image.alt.trim()
      )
        errors.push(
          "Each image needs an existing product image key and descriptive alt text.",
        );
      if (
        image.variantId &&
        !product.variants.some((v) => v.id === image.variantId)
      )
        errors.push("Choose an existing variant for each image association.");
    }
  return [...new Set(errors)];
}
