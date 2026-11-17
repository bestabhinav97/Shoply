const uuid = () => crypto.randomUUID();
export const newVariant = (options) => ({
  id: uuid(),
  sku: "",
  priceMinor: 0,
  quantity: 0,
  currency: "SEK",
  active: true,
  optionValueIds: options.map((o) => o.values[0]?.id).filter(Boolean),
});
export const blank = () => ({
  name: "",
  slug: "",
  description: "",
  categoryId: "",
  status: "draft",
  specifications: {},
  options: [],
  variants: [newVariant([])],
  images: [],
});
export function editable(product) {
  return {
    ...Object.fromEntries(
      [
        "version",
        "name",
        "slug",
        "description",
        "categoryId",
        "status",
        "specifications",
        "options",
      ].map((key) => [key, product[key]]),
    ),
    options: product.options.map((o) => ({
      id: o.id,
      name: o.name,
      values: o.values.map((v) => ({ id: v.id, value: v.value })),
    })),
    variants: product.variants.map((v) =>
      Object.fromEntries(
        [
          "id",
          "sku",
          "priceMinor",
          "quantity",
          "currency",
          "active",
          "optionValueIds",
        ].map((key) => [key, v[key]]),
      ),
    ),
    images: product.images.map((i) =>
      Object.fromEntries(
        ["id", "variantId", "storageKey", "alt", "width", "height"].map(
          (key) => [key, i[key]],
        ),
      ),
    ),
  };
}
