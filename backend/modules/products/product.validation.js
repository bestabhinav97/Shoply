import { z } from "zod";
import { httpError } from "../../shared/errors.js";

const listSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    category: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .optional(),
    sort: z
      .enum(["newest", "price-asc", "price-desc", "name"])
      .default("newest"),
    page: z
      .string()
      .regex(/^[1-9]\d{0,3}$/)
      .transform(Number)
      .default(1),
    limit: z
      .string()
      .regex(/^[1-9]\d?$/)
      .transform(Number)
      .pipe(z.number().max(48))
      .default(12),
  })
  .strict();

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success)
    throw httpError(
      400,
      "Invalid catalog request.",
      Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join(".") || "query",
          issue.message,
        ]),
      ),
    );
  return result.data;
}

export const validateList = (query) => parse(listSchema, query);
export const validateAdminList = (query) =>
  parse(
    listSchema.extend({
      status: z.enum(["draft", "active", "archived"]).optional(),
      availability: z.enum(["in-stock", "out-of-stock"]).optional(),
    }),
    query,
  );
export const validateId = (id) => parse(z.uuid(), id);

const text = (max) => z.string().trim().min(1).max(max);
export const validateCategory = (input) =>
  parse(
    z
      .object({
        name: text(100),
        slug: text(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
      })
      .strict(),
    input,
  );
const money = z.number().int().min(0).max(2147483647);
const childId = z.uuid();
const productSchema = z
  .object({
    version: z.string().max(100).optional(),
    categoryId: z.uuid(),
    slug: text(160).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: text(160),
    description: z.string().max(5000),
    status: z.enum(["draft", "active", "archived"]),
    specifications: z.record(z.string().max(100), z.json()).default({}),
    options: z
      .array(
        z
          .object({
            id: childId,
            name: text(100),
            values: z
              .array(z.object({ id: childId, value: text(100) }).strict())
              .min(1)
              .max(100),
          })
          .strict(),
      )
      .max(8),
    variants: z
      .array(
        z
          .object({
            id: childId,
            sku: z.string().trim().max(100).default(""),
            priceMinor: money,
            currency: z.literal("SEK").default("SEK"),
            active: z.boolean(),
            quantity: money,
            optionValueIds: z.array(childId).max(8),
          })
          .strict()
          // Stable variant IDs keep automatic SKUs unchanged across retries.
          .transform((variant) => ({
            ...variant,
            sku:
              variant.sku ||
              `SL-${variant.id.replaceAll("-", "").toUpperCase()}`,
          })),
      )
      .min(1)
      .max(250),
    images: z
      .array(
        z
          .object({
            id: childId,
            variantId: childId.nullable().default(null),
            storageKey: z
              .string()
              .max(255)
              .regex(/^products\/[a-z0-9-]+\.(jpg|webp|png)$/),
            alt: text(300),
            width: z.number().int().min(1).max(10000),
            height: z.number().int().min(1).max(10000),
          })
          .strict(),
      )
      .max(50),
  })
  .strict();

export function validateProduct(input) {
  const product = parse(productSchema, input);
  const fail = (message) => {
    throw httpError(400, message);
  };
  const unique = (values, message) => {
    if (new Set(values).size !== values.length) fail(message);
  };
  const normalized = (value) => value.trim().toLowerCase();
  unique(
    product.options.map((o) => normalized(o.name)),
    "Option names must be unique ignoring case and whitespace.",
  );
  unique(
    product.options.map((o) => o.id),
    "Duplicate option IDs.",
  );
  const valueOptions = new Map();
  for (const option of product.options) {
    unique(
      option.values.map((v) => normalized(v.value)),
      "Option values must be unique ignoring case and whitespace.",
    );
    for (const value of option.values) {
      if (valueOptions.has(value.id)) fail("Duplicate option value IDs.");
      valueOptions.set(value.id, option.id);
    }
  }
  unique(
    product.variants.map((v) => v.id),
    "Duplicate variant IDs.",
  );
  unique(
    product.variants.map((v) => v.sku),
    "SKUs must be unique.",
  );
  const combinations = [];
  for (const variant of product.variants) {
    if (variant.optionValueIds.some((id) => !valueOptions.has(id)))
      fail("A selected value does not belong to this product configuration.");
    const options = variant.optionValueIds.map((id) => valueOptions.get(id));
    if (
      options.length !== product.options.length ||
      new Set(options).size !== product.options.length
    ) {
      fail("Every variant must select exactly one value for every option.");
    }
    combinations.push([...variant.optionValueIds].sort().join(","));
  }
  unique(
    combinations,
    "Variant combinations must be unique; simple products have one default variant.",
  );
  unique(
    product.images.map((i) => i.id),
    "Duplicate image IDs.",
  );
  for (const image of product.images) {
    if (
      image.variantId &&
      !product.variants.some((v) => v.id === image.variantId)
    )
      fail("Image variant must belong to this product.");
  }
  return product;
}
