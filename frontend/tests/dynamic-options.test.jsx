import { afterEach, test, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ProductDetails } from "../src/features/products";
import { AdminProductEditor } from "../src/features/admin";

const categoryId = "10000000-0000-4000-8000-000000000001";
function product(names = ["RAM", "Storage"]) {
  const options = names.map((name, i) => ({
    id: `option-${i}`,
    name,
    position: i,
    values: [0, 1].map((n) => ({
      id: `value-${i}-${n}`,
      value: `${name} ${n + 1}`,
      position: n,
    })),
  }));
  const variants = [0, ...(names.length ? [1] : [])].map((n) => ({
    id: `variant-${n}`,
    sku: `SKU-${n}`,
    priceMinor: n ? 59900 : 49900,
    quantity: n ? 0 : 5,
    inStock: !n,
    currency: "SEK",
    active: true,
    optionValueIds: options.map((o) => o.values[n].id),
  }));
  return {
    id: "product",
    categoryId,
    category: { slug: "all", name: "All products" },
    name: "Configurable product",
    slug: "configurable-product",
    description: "A product.",
    status: "draft",
    version: "version-1",
    specifications: { battery: "80Wh" },
    options,
    variants,
    images: [
      {
        id: "image-0",
        storageKey: "products/shared.webp",
        url: "/images/products/shared.webp",
        variantId: null,
        alt: "Shared photo",
        width: 800,
        height: 1000,
      },
      {
        id: "image-1",
        storageKey: "products/specific.webp",
        url: "/images/products/specific.webp",
        variantId: names.length ? "variant-1" : null,
        alt: "Specific photo",
        width: 800,
        height: 1000,
      },
    ],
  };
}
function mount(content) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter([
    { path: "/", element: content },
    { path: "/admin/products", element: <p>Saved catalog</p> },
  ]);
  return { client, router, ...render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  ) };
}
const response = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test("generic selectors preserve other selections, reject missing combinations, update price, stock and images", async () => {
  const p = product();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => url === '/api/auth/me' ? response({ message: 'Sign in' }, 401) : url.startsWith('/api/products?') ? response({ items: [] }) : response({ product: p })),
  );
  const user = userEvent.setup();
  mount(<ProductDetails id="product" />);
  await screen.findByRole("heading", { name: p.name });
  expect(screen.getByText("499,00 kr")).toBeVisible();
  await user.tab();
  expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
  await user.tab();
  expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'All products' })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole('button', { name: /Zoom photo/ })).toHaveFocus();
  await user.tab();
  await user.tab();
  await user.tab();
  expect(screen.getByLabelText("RAM")).toHaveFocus();
  await user.tab();
  expect(screen.getByLabelText("Storage")).toHaveFocus();
  await user.selectOptions(screen.getByLabelText("RAM"), "value-0-1");
  expect(screen.getByLabelText("Storage")).toHaveValue("value-1-0");
  expect(screen.getByRole("status")).toHaveTextContent(
    "This combination is unavailable",
  );
  expect(screen.queryByText("499,00 kr")).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText("Storage"), "value-1-1");
  expect(screen.getByText("599,00 kr")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Out of stock");
  expect(screen.getByAltText("Specific photo")).toHaveAttribute(
    "src",
    "/images/products/specific.webp",
  );
  await user.click(screen.getByText('Details', { selector: 'summary h2' }));
  expect(screen.getByText("80Wh")).toBeVisible();
});

test.each(
  [[], ["Material"], ["Color", "Size"], ["Size", "Color", "Fit", "Length"]].map(
    (names) => ({ names }),
  ),
)("renders entirely from option definitions: $names", async ({ names }) => {
  const p = product(names);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({ product: p })),
  );
  mount(<ProductDetails id="product" />);
  await screen.findByRole("heading", { name: p.name });
  expect(screen.queryAllByRole("combobox")).toHaveLength(names.length);
  for (const name of names) expect(screen.getByLabelText(name)).toBeVisible();
});

test("admin creates explicit variants through review and saves integer prices and stock", async () => {
  const calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      if (url === "/api/admin/products/categories")
        return response({ items: [{ id: categoryId, name: "All products" }] });
      if (url === "/api/auth/csrf")
        return response({ csrfToken: "test-token" });
      if (url === "/api/admin/products") {
        calls.push(options);
        return response({ product: { id: "new" } }, 201);
      }
      throw new Error(url);
    }),
  );
  const user = userEvent.setup();
  mount(<AdminProductEditor />);
  await screen.findByLabelText("Product name");
  await user.type(screen.getByLabelText("Product name"), "Laptop");
  expect(screen.getByLabelText("URL handle")).toHaveValue("laptop");
  await user.selectOptions(screen.getByLabelText("Category"), categoryId);
  await user.click(screen.getByRole("button", { name: "Add specification" }));
  await user.type(screen.getByLabelText("Specification 1 name"), "battery");
  await user.type(screen.getByLabelText("Specification 1 value"), "80Wh");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(
    screen.getByRole("button", { name: "Add option", exact: true }),
  );
  await user.type(screen.getByLabelText("Option 1 name"), "RAM");
  await user.type(screen.getByLabelText("Option 1 value 1"), "16GB");
  await user.click(
    screen.getByRole("button", { name: "Add value to option 1" }),
  );
  await user.type(screen.getByLabelText("Option 1 value 2"), "32GB");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const valueId = screen.getByRole("option", { name: "16GB" }).value;
  await user.selectOptions(screen.getByLabelText("Variant 1 RAM"), valueId);
  await user.type(screen.getByLabelText("Variant 1 SKU"), "LAPTOP-16");
  await user.clear(screen.getByLabelText("Variant 1 price (SEK)"));
  await user.type(screen.getByLabelText("Variant 1 price (SEK)"), "999,99");
  await user.clear(screen.getByLabelText("Variant 1 stock"));
  await user.type(screen.getByLabelText("Variant 1 stock"), "10");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Add image" }));
  await user.type(
    screen.getByLabelText("Image 1 storage key"),
    "products/laptop.webp",
  );
  await user.type(screen.getByLabelText("Image 1 alt text"), "Laptop photo");
  const variantId = screen.getByRole("option", { name: "LAPTOP-16" }).value;
  await user.selectOptions(
    screen.getByLabelText("Image 1 association"),
    variantId,
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("table")).toHaveTextContent("999,99 kr");
  expect(screen.getByRole("table")).toHaveTextContent("10");
  expect(calls).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Edit variants" }));
  expect(screen.getByLabelText("Variant 1 SKU")).toHaveValue("LAPTOP-16");
  expect(screen.getByLabelText("Variant 1 price (SEK)")).toHaveValue("999.99");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("table")).toHaveTextContent("999,99 kr");
  expect(calls).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("Image 1 storage key")).toHaveValue(
    "products/laptop.webp",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Saved catalog");
  const body = JSON.parse(calls[0].body);
  expect(body.options[0].name).toBe("RAM");
  expect(body.options[0].values).toHaveLength(2);
  expect(body.variants).toHaveLength(1);
  expect(body.variants[0].optionValueIds).toEqual([valueId]);
  expect(body.variants[0].priceMinor).toBe(99999);
  expect(body.variants[0].quantity).toBe(10);
  expect(body.images[0].variantId).toBe(variantId);
  expect(body.specifications).toEqual({ battery: "80Wh" });
  expect(calls[0].headers["X-CSRF-Token"]).toBe("test-token");
});

test("variants can be created without entering SKUs", async () => {
  let submitted;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      if (url === "/api/admin/products/categories")
        return response({ items: [{ id: categoryId, name: "All products" }] });
      if (url === "/api/auth/csrf") return response({ csrfToken: "token" });
      submitted = JSON.parse(options.body);
      return response({ product: { id: "new" } }, 201);
    }),
  );
  const user = userEvent.setup();
  mount(<AdminProductEditor />);
  await screen.findByLabelText("Product name");
  await user.type(screen.getByLabelText("Product name"), "T-shirt");
  await user.selectOptions(screen.getByLabelText("Category"), categoryId);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(
    screen.getByRole("button", { name: "Add option", exact: true }),
  );
  await user.type(screen.getByLabelText("Option 1 name"), "Size");
  await user.type(screen.getByLabelText("Option 1 value 1"), "Small");
  await user.click(
    screen.getByRole("button", { name: "Add value to option 1" }),
  );
  await user.type(screen.getByLabelText("Option 1 value 2"), "Large");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Variant 1 SKU")).not.toBeRequired();
  expect(screen.getByLabelText("Variant 1 SKU")).toHaveAttribute(
    "placeholder",
    "Auto-generated",
  );
  await user.selectOptions(
    screen.getByLabelText("Variant 1 Size"),
    screen.getByRole("option", { name: "Small" }).value,
  );
  await user.click(screen.getByRole("button", { name: "Add variant" }));
  await user.selectOptions(
    screen.getByLabelText("Variant 2 Size"),
    screen.getAllByRole("option", { name: "Large" })[0].value,
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getAllByText("Generated on save")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Saved catalog");
  expect(submitted.variants.map((v) => v.sku)).toEqual(["", ""]);
});

test("category creation handles conflicts, selects the new category and preserves a simple product", async () => {
  let categoryAttempts = 0,
    productAttempts = 0,
    submitted;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      if (url === "/api/auth/csrf") return response({ csrfToken: "token" });
      if (
        url === "/api/admin/products/categories" &&
        options.method === "POST"
      ) {
        categoryAttempts++;
        return categoryAttempts === 1
          ? response(
              { message: "A category with this name or slug already exists." },
              409,
            )
          : response(
              { category: { id: categoryId, name: "Phones", slug: "phones" } },
              201,
            );
      }
      if (url === "/api/admin/products/categories")
        return response({ items: [] });
      if (url === "/api/admin/products") {
        submitted = JSON.parse(options.body);
        productAttempts++;
        return productAttempts === 1
          ? response({ message: "This SKU already exists." }, 409)
          : response({ product: { id: "new" } }, 201);
      }
      throw new Error(url);
    }),
  );
  const user = userEvent.setup();
  mount(<AdminProductEditor />);
  await screen.findByLabelText("Product name");
  await user.type(screen.getByLabelText("Product name"), "Simple phone");
  await user.click(screen.getByRole("button", { name: "Create category" }));
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  await user.type(screen.getByLabelText("Category name"), "Phones");
  expect(screen.getByLabelText("Category URL handle")).toHaveValue("phones");
  await user.click(screen.getByRole("button", { name: "Save category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  await user.click(screen.getByRole("button", { name: "Save category" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Category")).toHaveValue(categoryId),
  );
  expect(screen.getByLabelText("Product name")).toHaveValue("Simple phone");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(screen.getByLabelText("Variant 1 SKU"), "PHONE");
  await user.clear(screen.getByLabelText("Variant 1 price (SEK)"));
  await user.type(screen.getByLabelText("Variant 1 price (SEK)"), "0.29");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Default variant")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save product" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This SKU already exists",
  );
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("Variant 1 SKU")).toHaveValue("PHONE");
  expect(screen.getByLabelText("Variant 1 price (SEK)")).toHaveValue("0.29");
  await user.clear(screen.getByLabelText("Variant 1 SKU"));
  await user.type(screen.getByLabelText("Variant 1 SKU"), "PHONE-NEW");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Saved catalog");
  expect(submitted.categoryId).toBe(categoryId);
  expect(submitted.status).toBe("draft");
  expect(submitted.options).toEqual([]);
  expect(submitted.variants[0].optionValueIds).toEqual([]);
  expect(submitted.variants[0].priceMinor).toBe(29);
});

test("creation checks option values, duplicate combinations and fractional prices before saving", async () => {
  const writes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      if (options.method && options.method !== "GET") writes.push(url);
      return response({ items: [{ id: categoryId, name: "All products" }] });
    }),
  );
  const user = userEvent.setup();
  mount(<AdminProductEditor />);
  await screen.findByLabelText("Product name");
  await user.type(screen.getByLabelText("Product name"), "Laptop");
  await user.selectOptions(screen.getByLabelText("Category"), categoryId);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(
    screen.getByRole("button", { name: "Add option", exact: true }),
  );
  await user.type(screen.getByLabelText("Option 1 name"), "RAM");
  await user.type(screen.getByLabelText("Option 1 value 1"), "16GB");
  await user.click(
    screen.getByRole("button", { name: "Add value to option 1" }),
  );
  await user.type(screen.getByLabelText("Option 1 value 2"), " 16gb ");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent("must be unique");
  await user.clear(screen.getByLabelText("Option 1 value 2"));
  await user.type(screen.getByLabelText("Option 1 value 2"), "32GB");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const valueId = screen.getByRole("option", { name: "16GB" }).value;
  await user.selectOptions(screen.getByLabelText("Variant 1 RAM"), valueId);
  await user.type(screen.getByLabelText("Variant 1 SKU"), "LAP-A");
  await user.click(screen.getByRole("button", { name: "Add variant" }));
  await user.type(screen.getByLabelText("Variant 2 SKU"), "LAP-B");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent("different combination");
  await user.selectOptions(
    screen.getByLabelText("Variant 2 RAM"),
    screen.getAllByRole("option", { name: "32GB" })[0].value,
  );
  await user.clear(screen.getByLabelText("Variant 1 price (SEK)"));
  await user.type(screen.getByLabelText("Variant 1 price (SEK)"), "1.999");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert")).toHaveTextContent("valid SEK price");
  expect(writes).toHaveLength(0);
});

test("admin editing retains IDs and prevents deleting referenced definitions", async () => {
  const p = product(["Material"]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url.endsWith("/categories"))
        return response({ items: [{ id: categoryId, name: "All products" }] });
      if (url === "/api/admin/products/product")
        return response({ product: p });
      throw new Error(url);
    }),
  );
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  expect(screen.getByRole("button", { name: "Remove value 1" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Remove option 1" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Remove variant 2" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Variant 1 Material")).toHaveValue(
    p.options[0].values[0].id,
  );
});

test("admin can remove unreferenced values and options and save a simple default variant", async () => {
  const p = product([]);
  let submitted;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      if (url.endsWith("/categories"))
        return response({ items: [{ id: categoryId, name: "All products" }] });
      if (url === "/api/auth/csrf") return response({ csrfToken: "token" });
      if (options.method === "PUT") {
        submitted = JSON.parse(options.body);
        return response(
          { message: "This product changed. Reload before saving your edits." },
          409,
        );
      }
      return response({ product: p });
    }),
  );
  const user = userEvent.setup();
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  expect(screen.getByRole("button", { name: "Add variant" })).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Add option", exact: true }),
  );
  await user.click(screen.getByRole("button", { name: "Remove value 1" }));
  await user.click(screen.getByRole("button", { name: "Remove option 1" }));
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("This product changed"),
  );
  expect(submitted.version).toBe("version-1");
  expect(submitted.options).toEqual([]);
  expect(submitted.variants[0].id).toBe(p.variants[0].id);
});

test("editing prefills archived products, saves SEK prices, and preserves IDs and structured specifications", async () => {
  const p = product(["Material"]);
  p.status = "archived";
  p.specifications = { battery: "80Wh", dimensions: { width: 20 }, count: 2 };
  let submitted;
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (url.endsWith("/categories")) return response({ items: [{ id: categoryId, name: "All products" }] });
    if (url === "/api/auth/csrf") return response({ csrfToken: "token" });
    if (options.method === "PUT") {
      submitted = JSON.parse(options.body);
      return response({ product: { ...p, ...submitted } });
    }
    return response({ product: p });
  }));
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  expect(screen.getByRole("status")).toHaveTextContent("No unsaved changes");
  expect(screen.getByLabelText("Publication status")).toHaveValue("archived");
  expect(screen.getByLabelText("URL handle")).toHaveValue(p.slug);
  expect(screen.getByLabelText("Specification 1 value")).toHaveValue("80Wh");
  await user.type(screen.getByLabelText("Product name"), " revised");
  expect(screen.getByLabelText("URL handle")).toHaveValue(p.slug);
  await user.clear(screen.getByLabelText("Variant 1 price (SEK)"));
  await user.type(screen.getByLabelText("Variant 1 price (SEK)"), "123,45");
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Saved catalog");
  expect(confirm).not.toHaveBeenCalled();
  expect(submitted.version).toBe(p.version);
  expect(submitted.status).toBe("archived");
  expect(submitted.specifications).toEqual(p.specifications);
  expect(submitted.options.map((o) => o.id)).toEqual(p.options.map((o) => o.id));
  expect(submitted.variants[0]).toMatchObject({ id: p.variants[0].id, sku: p.variants[0].sku, priceMinor: 12345 });
  expect(submitted.images.map((i) => i.id)).toEqual(p.images.map((i) => i.id));
});

test("cancel and unload protect unsaved edits; confirmed navigation discards them", async () => {
  const p = product([]);
  vi.stubGlobal("fetch", vi.fn(async (url) => url.endsWith("/categories")
    ? response({ items: [{ id: categoryId, name: "All products" }] }) : response({ product: p })));
  const user = userEvent.setup();
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  const clean = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  await user.type(screen.getByLabelText("Product name"), " changed");
  const dirty = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  await user.click(screen.getByRole("link", { name: "Cancel" }));
  expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Product name")).toHaveValue(p.name + " changed");
  await user.click(screen.getByRole("link", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Discard changes" }));
  await screen.findByText("Saved catalog");
});

test("stale conflicts retain edits until explicit reload, recover reload failures and use the latest version", async () => {
  const p = product([]);
  let reads = 0;
  const writes = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (url.endsWith("/categories")) return response({ items: [{ id: categoryId, name: "All products" }] });
    if (url === "/api/auth/csrf") return response({ csrfToken: "token" });
    if (options.method === "PUT") {
      writes.push(JSON.parse(options.body));
      return writes.length === 1
        ? response({ message: "This product changed. Reload before saving your edits." }, 409)
        : response({ product: p });
    }
    reads++;
    if (reads === 2) return response({ message: "Reload unavailable" }, 503);
    return response({ product: reads === 1 ? p : {
      ...p, version: "version-2", name: "Latest name",
      variants: [{ ...p.variants[0], priceMinor: 43210 }],
    } });
  }));
  const user = userEvent.setup();
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  await user.type(screen.getByLabelText("Product name"), " local");
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Your edits are kept here until you choose to reload.");
  expect(screen.getByRole("button", { name: "Save product" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Reload latest product" }));
  expect(reads).toBe(1);
  await user.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Product name")).toHaveValue(p.name + " local");
  await user.click(screen.getByRole("button", { name: "Reload latest product" }));
  await user.click(screen.getByRole("button", { name: "Reload product" }));
  await screen.findByText("Reload unavailable");
  expect(screen.getByLabelText("Product name")).toHaveValue(p.name + " local");
  await user.click(screen.getByRole("button", { name: "Reload latest product" }));
  await user.click(screen.getByRole("button", { name: "Reload product" }));
  await waitFor(() => expect(screen.getByLabelText("Product name")).toHaveValue("Latest name"));
  expect(screen.getByLabelText("Variant 1 price (SEK)")).toHaveValue("432.10");
  expect(screen.getByRole("status")).toHaveTextContent("No unsaved changes");
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Saved catalog");
  expect(writes[1].version).toBe("version-2");
});

test("invalid configurations are explained before saving", async () => {
  const p = product([]);
  const writes = [];
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (options.method === "PUT") writes.push(options);
    return url.endsWith("/categories")
      ? response({ items: [{ id: categoryId, name: "All products" }] }) : response({ product: p });
  }));
  const user = userEvent.setup();
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  await user.type(screen.getByLabelText("Variant 1 price (SEK)"), "999");
  fireEvent.submit(screen.getByRole("button", { name: "Save product" }).closest("form"));
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid SEK price");
  expect(writes).toHaveLength(0);
});

test("editor retries initial loading failures and keeps a draft when background refresh fails", async () => {
  const p = product([]);
  let fail = true;
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    if (url.endsWith("/categories")) return response({ items: [{ id: categoryId, name: "All products" }] });
    return fail ? response({ message: "Product unavailable" }, 503) : response({ product: p });
  }));
  const user = userEvent.setup();
  const { client } = mount(<AdminProductEditor id="product" />);
  await screen.findByText("Product unavailable");
  fail = false;
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByLabelText("Product name");
  await user.tab();
  expect(screen.getByLabelText("Product name")).toHaveFocus();
  await user.type(screen.getByLabelText("Product name"), " local draft");
  fail = true;
  await client.refetchQueries({ queryKey: ["admin", "product", "product"] });
  expect(screen.getByLabelText("Product name")).toHaveValue(p.name + " local draft");
});

test("duplicate conflicts allow correcting the draft and retrying without reloading", async () => {
  const p = product([]);
  let writes = 0;
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    if (url.endsWith("/categories")) return response({ items: [{ id: categoryId, name: "All products" }] });
    if (url === "/api/auth/csrf") return response({ csrfToken: "token" });
    if (options.method === "PUT") {
      writes++;
      return writes === 1
        ? response({ message: "A slug, SKU, option name, value, or variant combination already exists." }, 409)
        : response({ product: p });
    }
    return response({ product: p });
  }));
  const user = userEvent.setup();
  mount(<AdminProductEditor id="product" />);
  await screen.findByLabelText("Product name");
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("button", { name: "Reload latest product" })).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("URL handle"), "-unique");
  await user.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Saved catalog");
  expect(writes).toBe(2);
});
