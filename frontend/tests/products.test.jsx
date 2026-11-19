import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/app/App";

const id = "20000000-0000-4000-8000-000000000001";
const image = {
  url: "/images/products/test.webp",
  alt: "White sneaker",
  width: 800,
  height: 1000,
};
const category = { id: "shoes", slug: "shoes", name: "Shoes" };
const card = {
  id,
  name: "Everyday white sneaker",
  category,
  priceMinor: 44900,
  currency: "SEK",
  inStock: true,
  image,
};
const product = {
  id,
  name: card.name,
  description: "A simple everyday shoe.",
  category,
  images: [image],
  specifications: {},
  options: [
    { id: "color", name: "Color", values: [{ id: "white", value: "White" }] },
    {
      id: "size",
      name: "Size",
      values: [
        { id: "eu42", value: "EU 42" },
        { id: "eu43", value: "EU 43" },
      ],
    },
  ],
  variants: [
    {
      id: "size-42",
      sku: "DEMO-42",
      optionValueIds: ["white", "eu42"],
      priceMinor: 44900,
      inStock: true,
    },
    {
      id: "size-43",
      sku: "DEMO-43",
      optionValueIds: ["white", "eu43"],
      priceMinor: 45900,
      inStock: false,
    },
  ],
};

let listRequests;
let failList;
let missingProduct;
let emptyList;
let pendingList;
let failCategories;
let categoryRequests;

beforeEach(() => {
  listRequests = [];
  failList = false;
  missingProduct = false;
  emptyList = false;
  pendingList = false;
  failCategories = false;
  categoryRequests = 0;
  window.history.replaceState({}, "", "/products");

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      const response = (data, status = 200) =>
        new Response(JSON.stringify(data), { status });

      if (url === "/api/auth/me") return response({ message: "Sign in" }, 401);
      if (url === "/api/categories") {
        categoryRequests++;
        return failCategories
          ? response({ message: "Categories unavailable." }, 503)
          : response({ items: [category] });
      }

      if (url.startsWith("/api/products?")) {
        listRequests.push({ url, options });

        if (pendingList) {
          return new Promise((_resolve, reject) => {
            options.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          });
        }

        if (failList)
          return response({ message: "Catalog temporarily unavailable." }, 503);
        const page = Number(
          new URL(url, "http://localhost").searchParams.get("page"),
        );

        return response({
          items: emptyList ? [] : [card],
          pagination: {
            page,
            limit: 12,
            total: emptyList ? 0 : 13,
            totalPages: emptyList ? 0 : 2,
          },
        });
      }

      if (url === `/api/products/${id}`) {
        return missingProduct
          ? response({ message: "Product not found." }, 404)
          : response({ product });
      }

      throw new Error(`Unexpected request: ${url}`);
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

test("visitors browse API products and inspect size-specific prices and availability", async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByRole("heading", { name: card.name })).toBeVisible();
  expect(screen.getByText("449,00 kr")).toBeVisible();
  expect(listRequests[0].options.credentials).toBe("include");
  expect(listRequests[0].options.signal).toBeInstanceOf(AbortSignal);

  await user.click(
    screen.getByRole("link", { name: /Everyday white sneaker/ }),
  );
  expect(
    await screen.findByRole("heading", { level: 1, name: card.name }),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("In stock");

  await user.selectOptions(screen.getByLabelText("Size"), "eu43");
  expect(screen.getByText("459,00 kr")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Out of stock");
  expect(screen.getByText(/Purchasing isn’t available yet/)).toBeVisible();
});

test("search, category, sorting and pagination update the URL and API request", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: card.name });

  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(window.location.search).toContain("page=2"));

  await user.type(screen.getByLabelText("Search products"), "sneaker");
  await user.keyboard("{Enter}");
  await waitFor(() => expect(window.location.search).toBe("?q=sneaker"));

  await user.selectOptions(screen.getByLabelText("Product category"), "shoes");
  await user.click(screen.getByRole("button", { name: "Search", exact: true }));
  await user.selectOptions(screen.getByLabelText("Sort by"), "price-asc");

  await waitFor(() => {
    const query = new URL(listRequests.at(-1).url, "http://localhost")
      .searchParams;
    expect(query.get("q")).toBe("sneaker");
    expect(query.get("category")).toBe("shoes");
    expect(query.get("sort")).toBe("price-asc");
    expect(query.get("page")).toBe("1");
  });

  expect(screen.getByLabelText("Product category")).toHaveValue("shoes");
});

test("header search works from home and scopes results to the selected category", async () => {
  window.history.replaceState({}, "", "/");
  const user = userEvent.setup();
  render(<App />);

  const header = within(screen.getByRole("banner"));
  await header.findByRole("option", { name: "Shoes" });
  expect(
    header.getByRole("option", { name: "All categories" }),
  ).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: card.name })).toBeVisible();
  expect(listRequests).toHaveLength(1);

  await user.selectOptions(header.getByLabelText("Product category"), "shoes");
  expect(window.location.pathname).toBe("/");
  await user.type(header.getByLabelText("Search products"), "  sneaker  ");
  await user.keyboard("{Enter}");

  expect(await screen.findByRole("heading", { name: card.name })).toBeVisible();
  expect(window.location.pathname).toBe("/products");
  expect(window.location.search).toBe("?q=sneaker&category=shoes");
  expect(header.getByLabelText("Search products")).toHaveValue("sneaker");
  expect(screen.getAllByRole("search")).toHaveLength(1);
  expect(categoryRequests).toBe(1);
});

test("committed URL searches restore on Back and preserve sorting while resetting pagination", async () => {
  window.history.replaceState(
    {},
    "",
    "/products?q=boot&category=shoes&sort=price-desc&page=2",
  );
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: card.name });

  expect(screen.getByLabelText("Search products")).toHaveValue("boot");
  expect(screen.getByLabelText("Product category")).toHaveValue("shoes");

  await user.clear(screen.getByLabelText("Search products"));
  await user.type(screen.getByLabelText("Search products"), "sneaker");
  await user.selectOptions(screen.getByLabelText("Product category"), "");
  await user.click(screen.getByRole("button", { name: "Search", exact: true }));

  await waitFor(() =>
    expect(window.location.search).toBe("?q=sneaker&sort=price-desc"),
  );
  expect(screen.getByLabelText("Sort by")).toHaveValue("price-desc");

  await act(async () => window.history.back());
  await waitFor(() =>
    expect(screen.getByLabelText("Search products")).toHaveValue("boot"),
  );
  expect(screen.getByLabelText("Product category")).toHaveValue("shoes");
  expect(window.location.search).toContain("page=2");

  await act(async () => window.history.forward());
  await waitFor(() =>
    expect(screen.getByLabelText("Search products")).toHaveValue("sneaker"),
  );
  expect(screen.getByLabelText("Product category")).toHaveValue("");
});

test("category failures can be retried while product search remains usable", async () => {
  failCategories = true;
  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Categories unavailable",
  );
  await user.type(screen.getByLabelText("Search products"), "mug");
  await user.keyboard("{Enter}");
  await waitFor(() => expect(window.location.search).toBe("?q=mug"));

  failCategories = false;
  await user.click(screen.getByRole("button", { name: "Retry categories" }));
  expect(
    await screen.findByRole("option", { name: "Shoes" }),
  ).toBeInTheDocument();

  await user.clear(screen.getByLabelText("Search products"));
  await user.selectOptions(screen.getByLabelText("Product category"), "shoes");
  await user.click(screen.getByRole("button", { name: "Search", exact: true }));
  await waitFor(() => expect(window.location.search).toBe("?category=shoes"));
});

test("failed catalog requests show useful feedback and can be retried", async () => {
  failList = true;
  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Catalog temporarily unavailable.",
  );
  failList = false;
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: card.name })).toBeVisible();
});

test("empty results and missing products have clear navigation", async () => {
  emptyList = true;
  const view = render(<App />);
  expect(
    await screen.findByRole("heading", { name: "No products found" }),
  ).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Browse all products" }),
  ).toHaveAttribute("href", "/products");
  view.unmount();

  missingProduct = true;
  window.history.replaceState({}, "", `/products/${id}`);
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Product not found" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute(
    "href",
    "/products",
  );
});

test("pending requests announce loading without displaying fabricated products", async () => {
  pendingList = true;
  render(<App />);

  expect(
    await screen.findByRole("status", { name: "Loading products" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: card.name }),
  ).not.toBeInTheDocument();
});

test("price and stock filters refine the loaded page without changing API requests", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: card.name });
  const filters = within(screen.getByRole("complementary", { name: "Product filters" }));
  const initialRequests = listRequests.length;
  await user.click(filters.getByLabelText("In stock only"));
  expect(screen.getByRole("heading", { name: card.name })).toBeVisible();
  await user.type(filters.getByLabelText("Max price"), "400");
  expect(screen.getByRole("heading", { name: "No products match your filters" })).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("0 of 1 on this page");
  expect(window.location.search).toBe("");
  expect(listRequests).toHaveLength(initialRequests);
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  expect(screen.getByRole("heading", { name: card.name })).toBeVisible();
  expect(filters.getByLabelText("In stock only")).not.toBeChecked();
  expect(filters.getByLabelText("Max price")).toHaveValue(null);
  await user.type(filters.getByLabelText("Min price"), "500");
  await user.type(filters.getByLabelText("Max price"), "400");
  expect(screen.getByRole("alert")).toHaveTextContent("Min price must not exceed max price");
});

test("category strip preserves search and sort, resets pagination and marks the active category", async () => {
  window.history.replaceState({}, "", "/products?q=shoe&sort=price-asc&page=2");
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: card.name });
  const nav = within(screen.getByRole("navigation", { name: "Shop by category" }));
  await user.click(nav.getByRole("link", { name: "Shoes" }));
  expect(window.location.search).toBe("?q=shoe&sort=price-asc&category=shoes");
  expect(nav.getByRole("link", { name: "Shoes" })).toHaveAttribute("aria-current", "page");
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  expect(window.location.search).toBe("?sort=price-asc");
});

test("broken product images show a placeholder and the cart is accessible", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: card.name });
  fireEvent.error(screen.getByRole("img", { name: image.alt }));
  expect(screen.getByRole("img", { name: "Product photo unavailable" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Cart" })).toHaveAttribute('href', '/cart');
});

test("account menu closes on Escape and navigation uses existing routes", async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: card.name });
  const summary = screen.getByRole('button', { name: 'Account menu' });
  await user.click(summary);
  expect(summary).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{Escape}");
  expect(summary).toHaveAttribute("aria-expanded", "false");
  expect(summary).toHaveFocus();
  await user.click(summary);
  await user.click(screen.getByRole("link", { name: "Sign in / Register" }));
  expect(window.location.pathname).toBe("/login");
  await screen.findByRole("heading", { name: "Sign in" });
  expect(screen.getByRole('button', { name: 'Account menu' })).toHaveAttribute("aria-expanded", "false");
});

test("filter drawer shares filters and responds to dismissal", async () => {
  // jsdom omits the native dialog methods; browsers own modality and focus.
  const prototype = HTMLDialogElement.prototype;
  const show = Object.getOwnPropertyDescriptor(prototype, "showModal");
  const close = Object.getOwnPropertyDescriptor(prototype, "close");
  Object.defineProperty(prototype, "showModal", { configurable: true, value() { this.open = true; } });
  Object.defineProperty(prototype, "close", { configurable: true, value() { this.open = false; } });
  const user = userEvent.setup();
  let view;
  try {
    view = render(<App />);
    await screen.findByRole("heading", { name: card.name });
    await user.click(screen.getByRole("button", { name: "Filters", exact: true }));
    const dialog = screen.getByRole("dialog", { name: "Product filters" });
    await user.type(within(dialog).getByLabelText("Max price"), "400");
    await user.click(within(dialog).getByRole("button", { name: "Show results" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "No products match your filters" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Filters", exact: true }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Max price")).toHaveValue(400);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters", exact: true })).toHaveAttribute("aria-expanded", "false");
  } finally {
    view?.unmount();
    if (show) Object.defineProperty(prototype, "showModal", show);
    else delete prototype.showModal;
    if (close) Object.defineProperty(prototype, "close", close);
    else delete prototype.close;
  }
});
