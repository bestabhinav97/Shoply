import { beforeEach, afterEach, test, expect, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/app/App";

const customer = {
  id: "test-user",
  firstName: "Åsa",
  lastName: "Öberg",
  phoneNumber: "+46701234567",
  email: "asa@example.com",
  role: "customer",
};
let authenticated;
let calls;
let rejectLogin;
let role;
let failSession;
let failProducts;
let catalogPages;
let emptyProducts;

beforeEach(() => {
  authenticated = false;
  rejectLogin = false;
  role = "customer";
  failSession = false;
  failProducts = false;
  catalogPages = 1;
  emptyProducts = false;
  calls = [];
  window.history.replaceState({}, "", "/");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options = {}) => {
      calls.push({ url, options });
      const response = (data, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), { status }));
      if (url === "/api/auth/me") {
        if (failSession)
          return response({ message: "Service unavailable." }, 503);
        return authenticated
          ? response({ user: { ...customer, role } })
          : response({ message: "Sign in" }, 401);
      }
      if (url === "/api/categories") return response({ items: [] });
      if (url === "/api/cart") return response({ items: [], itemCount: 0, subtotalMinor: 0, currency: 'SEK' });
      if (url.startsWith("/api/products?"))
        return response({
          items: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        });
      if (url === "/api/admin/products/categories")
        return response({
          items: [{ id: "shoes-id", name: "Shoes", slug: "shoes" }],
        });
      if (url.startsWith("/api/admin/products?")) {
        if (failProducts)
          return response(
            { message: "Products temporarily unavailable." },
            503,
          );
        return response({
          items: emptyProducts
            ? []
            : [
                {
                  id: "product-one",
                  name: "Test sneaker",
                  category: { name: "Shoes" },
                  status: "draft",
                  priceMinor: 44900,
                  activeVariantCount: 4,
                  inStock: true,
                },
              ],
          pagination: {
            page: Number(
              new URL(url, "http://localhost").searchParams.get("page") || 1,
            ),
            limit: 20,
            total: emptyProducts ? 0 : catalogPages > 1 ? 21 : 1,
            totalPages: emptyProducts ? 0 : catalogPages,
          },
        });
      }
      if (url === "/api/auth/csrf") return response({ csrfToken: "test-csrf" });
      if (url === "/api/auth/login" || url === "/api/auth/register") {
        if (rejectLogin)
          return response({ message: "Email or password is incorrect." }, 401);
        authenticated = true;
        return response(
          { user: { ...customer, role } },
          url.endsWith("register") ? 201 : 200,
        );
      }
      if (url === "/api/auth/logout-all" || url === "/api/auth/logout") {
        authenticated = false;
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

test("visitors can open the public home page without signing in", async () => {
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: /Your everyday/ }),
  ).toBeVisible();
  expect(window.location.pathname).toBe("/");
  expect(
    screen.queryByRole("link", { name: "Admin", exact: true }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
  await userEvent.click(screen.getByRole("link", { name: /Sign in \/ Register/ }));
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});

test("account login lands on the homepage and the account still supports logout everywhere", async () => {
  window.history.replaceState({}, "", "/account");
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(window.location.search).toContain("next=%2Faccount");
  await userEvent.type(screen.getByLabelText("Email address"), customer.email);
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "a long secure passphrase",
  );
  await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  expect(await screen.findByRole('heading', { name: /Your everyday/ })).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
  await userEvent.click(screen.getByRole('link', { name: 'My account' }));
  expect(
    await screen.findByRole("heading", { name: "Profile", exact: true }),
  ).toBeVisible();
  const login = calls.find((call) => call.url === "/api/auth/login");
  expect(login.options.credentials).toBe("include");
  expect(login.options.headers["X-CSRF-Token"]).toBe("test-csrf");
  expect(within(screen.getByRole("region", { name: "Profile" })).getByText(customer.email)).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Sign out on all devices" }),
  );
  expect(calls.some((call) => call.url === "/api/auth/logout-all")).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
  expect(
    await screen.findByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(calls.some((call) => call.url === "/api/auth/logout-all")).toBe(true);
  expect(
    screen.queryByRole("link", { name: "Admin", exact: true }),
  ).not.toBeInTheDocument();
});

test("signup validates Swedish phones, masks passwords and submits only customer fields", async () => {
  window.history.replaceState({}, "", "/signup");
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Make yourself at home." }),
  ).toBeVisible();
  await userEvent.type(screen.getByLabelText("First name"), customer.firstName);
  await userEvent.type(screen.getByLabelText("Last name"), customer.lastName);
  await userEvent.type(screen.getByLabelText("Phone number"), "+12025550123");
  await userEvent.type(screen.getByLabelText("Email address"), customer.email);
  const password = screen.getByLabelText("Password", { exact: true });
  await userEvent.type(password, "a long secure passphrase");
  expect(password).toHaveAttribute("type", "password");
  await userEvent.click(
    screen.getByRole("checkbox", { name: "Show password" }),
  );
  expect(password).toHaveAttribute("type", "text");
  await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
  expect(
    await screen.findByText("Enter a valid Swedish phone number."),
  ).toBeVisible();
  expect(calls.some((call) => call.url === "/api/auth/register")).toBe(false);
  await userEvent.clear(screen.getByLabelText("Phone number"));
  await userEvent.type(screen.getByLabelText("Phone number"), "0701234567");
  await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
  const body = JSON.parse(
    calls.find((call) => call.url === "/api/auth/register").options.body,
  );
  expect(Object.keys(body).sort()).toEqual([
    "email",
    "firstName",
    "lastName",
    "password",
    "phoneNumber",
  ]);
});

test("invalid credentials show a useful error and stay on the login page", async () => {
  rejectLogin = true;
  window.history.replaceState({}, "", "/login");
  render(<App />);
  await screen.findByRole("heading", { name: "Welcome back." });
  await userEvent.type(screen.getByLabelText("Email address"), customer.email);
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "incorrect",
  );
  await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Email or password is incorrect.",
  );
  expect(window.location.pathname).toBe("/login");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Sign in/ })).toBeEnabled(),
  );
});

test.each(["/login", "/login?next=%2F%2Fevil.example", "/login?next=%2Faccount", "/login?next=%2Faccount%2Fprofile"])("login defaults safely to the homepage from %s", async (path) => {
  window.history.replaceState({}, "", path);
  render(<App />);
  await screen.findByRole("heading", { name: "Welcome back." });
  await userEvent.type(screen.getByLabelText("Email address"), customer.email);
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "a long secure passphrase",
  );
  await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
  await waitFor(() => expect(window.location.pathname).toBe("/"));
});

test("visitors return to the admin dashboard after signing in as an admin", async () => {
  role = "admin";
  window.history.replaceState({}, "", "/admin");
  render(<App />);

  await screen.findByRole("heading", { name: "Welcome back." });
  expect(window.location.search).toBe("?next=%2Fadmin");
  expect(
    screen.queryByRole("heading", { name: "Admin dashboard" }),
  ).not.toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Email address"), customer.email);
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "a long secure passphrase",
  );
  await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));

  expect(
    await screen.findByRole("heading", { name: "Admin dashboard" }),
  ).toBeVisible();
  expect(window.location.pathname).toBe("/admin");
  expect(screen.queryByRole("search")).not.toBeInTheDocument();
});

test("customers are denied admin access and can return to their account", async () => {
  authenticated = true;
  window.history.replaceState({}, "", "/admin");
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Admin access required" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("navigation", { name: "Admin navigation" }),
  ).not.toBeInTheDocument();

  await userEvent.click(
    screen.getByRole("link", { name: "Go to your account" }),
  );
  await waitFor(() => expect(window.location.pathname).toBe("/account/profile"));
  expect(
    await screen.findByRole("heading", {
      name: "Profile", exact: true,
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Admin", exact: true }),
  ).not.toBeInTheDocument();
});

test("admins get a separate layout and can navigate back to the storefront", async () => {
  authenticated = true;
  role = "admin";
  window.history.replaceState({}, "", "/admin");
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Admin dashboard" }),
  ).toBeVisible();
  expect(screen.getByText(`Welcome, ${customer.firstName}.`)).toBeVisible();
  expect(
    screen.getByRole("navigation", { name: "Admin navigation" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.queryByRole("search")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("link", { name: "Back to shop" }));
  expect(
    await screen.findByRole("heading", { name: /Your everyday/ }),
  ).toBeVisible();
  expect(screen.getByRole("search", { name: "Product search" })).toBeVisible();

  await userEvent.click(screen.getByRole('button', { name: /account menu/i }));
  const adminLink = screen.getByRole("link", { name: "Admin", exact: true });
  expect(adminLink).toHaveAttribute("href", "/admin");
  await userEvent.click(adminLink);
  expect(
    await screen.findByRole("heading", { name: "Admin dashboard" }),
  ).toBeVisible();
});

test("session errors keep the admin area closed until a successful retry", async () => {
  authenticated = true;
  role = "admin";
  failSession = true;
  window.history.replaceState({}, "", "/admin");
  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "check your session",
  );
  expect(
    screen.queryByRole("navigation", { name: "Admin navigation" }),
  ).not.toBeInTheDocument();

  failSession = false;
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("heading", { name: "Admin dashboard" }),
  ).toBeVisible();
});

test("unknown admin routes keep the admin layout and show the shared not-found page", async () => {
  authenticated = true;
  role = "admin";
  window.history.replaceState({}, "", "/admin/unknown");
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  expect(
    screen.getByRole("navigation", { name: "Admin navigation" }),
  ).toBeVisible();
  expect(screen.queryByRole("search")).not.toBeInTheDocument();
});

test("sidebar links switch between dashboard and real API product data", async () => {
  authenticated = true;
  role = "admin";
  window.history.replaceState({}, "", "/admin");
  render(<App />);
  await screen.findByRole("heading", { name: "Admin dashboard" });

  // The collapsed rail keeps meaningful link names and keyboard navigation.
  const keyboard = userEvent.setup();
  await keyboard.tab();
  await keyboard.tab();
  await keyboard.tab();
  await keyboard.tab();
  expect(
    screen.getByRole("link", { name: "Products", exact: true }),
  ).toHaveFocus();

  await userEvent.click(
    screen.getByRole("link", { name: "Products", exact: true }),
  );
  expect(
    await screen.findByRole("rowheader", { name: /Test sneaker/ }),
  ).toBeVisible();
  expect(screen.getByRole("cell", { name: "draft" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Products", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(calls.some(({ url }) => url.startsWith("/api/admin/products?"))).toBe(
    true,
  );
  expect(screen.queryByRole("banner")).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  expect(
    await screen.findByRole("heading", { name: "Admin dashboard" }),
  ).toBeVisible();
});

test("admin product errors support retry", async () => {
  authenticated = true;
  role = "admin";
  failProducts = true;
  window.history.replaceState({}, "", "/admin/products");
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Products temporarily unavailable.",
  );

  failProducts = false;
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(
    await screen.findByRole("rowheader", { name: /Test sneaker/ }),
  ).toBeVisible();
});

test("admin catalog filters use URL state, reset pagination and preserve filters between pages", async () => {
  authenticated = true;
  role = "admin";
  catalogPages = 2;
  window.history.replaceState({}, "", "/admin/products?page=2");
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("rowheader", { name: /Test sneaker/ });
  await user.type(screen.getByLabelText("Search catalog"), "DEMO-SHOE");
  await user.selectOptions(screen.getByLabelText("Filter category"), "shoes");
  await user.selectOptions(screen.getByLabelText("Filter status"), "draft");
  await user.selectOptions(
    screen.getByLabelText("Filter availability"),
    "out-of-stock",
  );
  await user.selectOptions(screen.getByLabelText("Sort catalog"), "price-asc");
  await user.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() => expect(window.location.search).not.toContain("page="));
  const lastQuery = () =>
    new URL(
      calls.filter(({ url }) => url.startsWith("/api/admin/products?")).at(-1)
        .url,
      "http://localhost",
    ).searchParams;
  await waitFor(() => expect(lastQuery().get("status")).toBe("draft"));
  expect(lastQuery().get("q")).toBe("DEMO-SHOE");
  expect(lastQuery().get("category")).toBe("shoes");
  expect(lastQuery().get("availability")).toBe("out-of-stock");
  expect(lastQuery().get("sort")).toBe("price-asc");
  await user.click(await screen.findByRole("button", { name: "Next" }));
  await waitFor(() => expect(lastQuery().get("page")).toBe("2"));
  expect(lastQuery().get("q")).toBe("DEMO-SHOE");
  await user.click(screen.getByRole("link", { name: "Clear", exact: true }));
  await waitFor(() =>
    expect(screen.getByLabelText("Search catalog")).toHaveValue(""),
  );
  expect(window.location.search).toBe("");
  expect(screen.getByRole("link", { name: "Create product" })).toHaveAttribute(
    "href",
    "/admin/products/new",
  );
  expect(screen.getByRole("link", { name: "Test sneaker" })).toHaveAttribute(
    "href",
    "/admin/products/product-one/edit",
  );
});

test("empty filtered catalogs keep creation and clear-filter actions available", async () => {
  authenticated = true;
  role = "admin";
  emptyProducts = true;
  window.history.replaceState({}, "", "/admin/products?q=missing&status=draft");
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "No matching products" });
  expect(screen.getByRole("link", { name: "Create product" })).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Clear filters" }));
  await screen.findByRole("heading", { name: "Your catalog is empty" });
  expect(window.location.search).toBe("");
});

test("drawer navigation closes the menu and Escape dismisses it", async () => {
  // jsdom does not implement the browser's native modal-dialog methods.
  const prototype = HTMLDialogElement.prototype;
  const show = Object.getOwnPropertyDescriptor(prototype, "showModal");
  const close = Object.getOwnPropertyDescriptor(prototype, "close");
  Object.defineProperty(prototype, "showModal", {
    configurable: true,
    value() {
      this.open = true;
    },
  });
  Object.defineProperty(prototype, "close", {
    configurable: true,
    value() {
      this.open = false;
    },
  });
  authenticated = true;
  role = "admin";
  window.history.replaceState({}, "", "/admin");

  let view;
  try {
    view = render(<App />);
    await screen.findByRole("heading", { name: "Admin dashboard" });
    await userEvent.click(screen.getByRole("button", { name: /Menu/ }));
    const drawer = screen.getByRole("dialog", { name: "Administration menu" });
    await userEvent.click(
      within(drawer).getByRole("link", { name: "Products", exact: true }),
    );
    expect(
      await screen.findByRole("rowheader", { name: /Test sneaker/ }),
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Menu/ }));
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  } finally {
    view?.unmount();
    if (show) Object.defineProperty(prototype, "showModal", show);
    else delete prototype.showModal;
    if (close) Object.defineProperty(prototype, "close", close);
    else delete prototype.close;
  }
});

