# AGENTS.md — Shoply E-Commerce Project

> Instructions for AI coding agents and contributors. Follow these conventions when creating or modifying code. This file describes the **target architecture**; do not create empty folders or placeholder files just to match the tree.

## 1. Product and scope

Build **Shoply** (working name), a modern, mobile-first, Temu-inspired e-commerce website. Use the shopping experience as inspiration, not copied branding, layout, graphics, or text.

Core customer flows: browse products, search/filter/sort, view product details, register/login, add to cart, checkout, view orders, and manage a wishlist. Admin flows: manage products, categories, inventory, and orders. After the core product is working, add AI-shopping-assistant features (LLM integration, retrieval-augmented search, tool calling, and eventually agents).

**Priorities:** understandable and maintainable code, clear module boundaries, functional end-to-end features, accessibility, security, responsive design, and an incremental build process. Do not overengineer or introduce microservices prematurely.

## 2. Non-negotiable technical decisions

| Concern | Decision |
|---|---|
| Frontend | React + Vite, **JavaScript only** |
| React files | `.jsx` for files containing JSX; `.js` for regular JS |
| TypeScript | **Do not use TypeScript, `.ts`, or `.tsx`** |
| Frontend routing | React Router |
| Server-state fetching/cache | TanStack Query |
| Minimal global client state | Zustand, only when needed |
| Styling | Tailwind CSS + CSS custom properties/design tokens |
| Backend | Node.js + Express, JavaScript (ES modules) |
| Backend architecture | Modular monolith, REST API |
| Database | One PostgreSQL database |
| Database access | `pg`, parameterized SQL, SQL migrations |
| Authentication | Secure server-side sessions via HTTP-only cookies (not tokens in localStorage) |
| Dev environment | Vite for frontend; Node.js for backend; Docker Compose for PostgreSQL |
| Tests | Frontend: Vitest + React Testing Library; backend: Node test runner + Supertest |

Use current compatible library versions when installing dependencies. Do not swap architectural choices without a clear, documented reason.

## 3. Repository structure (target)

```text
shoply/
├── AGENTS.md
├── README.md
├── .gitignore
├── docker-compose.yml
├── frontend/
│   ├── public/
│   │   ├── images/
│   │   └── icons/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.jsx
│   │   │   ├── router.jsx
│   │   │   ├── providers.jsx
│   │   │   └── queryClient.js
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── api/auth.api.js
│   │   │   │   ├── components/LoginForm.jsx
│   │   │   │   ├── components/RegisterForm.jsx
│   │   │   │   ├── hooks/useAuth.js
│   │   │   │   └── index.js
│   │   │   ├── products/
│   │   │   │   ├── api/products.api.js
│   │   │   │   ├── components/ProductCard.jsx
│   │   │   │   ├── components/ProductGrid.jsx
│   │   │   │   ├── components/ProductFilters.jsx
│   │   │   │   ├── components/ProductGallery.jsx
│   │   │   │   ├── hooks/useProducts.js
│   │   │   │   ├── hooks/useProduct.js
│   │   │   │   └── index.js
│   │   │   ├── cart/
│   │   │   │   ├── api/cart.api.js
│   │   │   │   ├── components/CartItem.jsx
│   │   │   │   ├── components/CartSummary.jsx
│   │   │   │   ├── hooks/useCart.js
│   │   │   │   ├── store/cartUi.store.js
│   │   │   │   └── index.js
│   │   │   ├── checkout/
│   │   │   │   ├── api/
│   │   │   │   ├── components/AddressForm.jsx
│   │   │   │   └── components/PaymentForm.jsx
│   │   │   ├── orders/
│   │   │   │   ├── api/
│   │   │   │   ├── components/
│   │   │   │   └── hooks/
│   │   │   ├── search/
│   │   │   │   ├── components/
│   │   │   │   └── hooks/
│   │   │   ├── wishlist/
│   │   │   │   ├── api/
│   │   │   │   └── components/
│   │   │   ├── admin/
│   │   │   │   ├── api/
│   │   │   │   ├── components/
│   │   │   │   └── hooks/
│   │   │   └── ai-assistant/       # Future phase only
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── ProductsPage.jsx
│   │   │   ├── ProductDetailsPage.jsx
│   │   │   ├── CartPage.jsx
│   │   │   ├── CheckoutPage.jsx
│   │   │   ├── OrdersPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── AdminDashboardPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   ├── components/
│   │   │   ├── ui/                # Generic Button, Input, Modal, Badge, Skeleton
│   │   │   └── layout/            # Header, Footer, Navbar, MainLayout, AdminLayout
│   │   ├── hooks/                # Truly shared hooks
│   │   ├── lib/
│   │   │   ├── apiClient.js
│   │   │   └── queryKeys.js
│   │   ├── utils/
│   │   │   ├── formatCurrency.js
│   │   │   └── formatDate.js
│   │   ├── styles/globals.css
│   │   └── main.jsx
│   ├── tests/                    # Integration/test utilities; colocate unit tests
│   ├── .env.example
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── backend/
    ├── src/
    │   ├── app.js
    │   ├── server.js
    │   ├── config/database.js
    │   ├── modules/
    │   │   ├── auth/
    │   │   │   ├── auth.routes.js
    │   │   │   ├── auth.controller.js
    │   │   │   ├── auth.service.js
    │   │   │   └── auth.repository.js
    │   │   ├── products/
    │   │   │   ├── product.routes.js
    │   │   │   ├── product.controller.js
    │   │   │   ├── product.service.js
    │   │   │   └── product.repository.js
    │   │   ├── cart/
    │   │   ├── orders/
    │   │   ├── payments/
    │   │   └── inventory/
    │   ├── shared/
    │   │   ├── middleware/
    │   │   ├── errors/
    │   │   └── utils/
    │   └── routes.js
    ├── migrations/
    ├── tests/
    ├── .env.example
    └── package.json
```

Directory names are conventions, not a demand to create everything at once. Add `categories`, `reviews`, `addresses`, or other features only when implemented.

## 4. Frontend architectural rules

1. **Feature-first organization.** Feature-specific APIs, components, hooks, and local state remain inside `src/features/<feature>/`. Shared, domain-independent components belong in `src/components/ui/`.
2. **Pages compose features.** Route pages are thin composition layers; avoid large API calls/business logic in pages or presentation components.
3. **Use public exports.** Import other features through their `index.js` public API, not private implementation files. Avoid circular feature imports.
4. **Separate server/client state.** TanStack Query owns products, user/profile, cart, and orders fetched from the API. `useState` owns local form/dialog state; Zustand owns genuinely cross-screen UI state such as a cart drawer. Never treat a client cart cache as authoritative for prices or inventory.
5. **Use one API client** in `lib/apiClient.js`: base URL, `credentials: 'include'`, JSON decoding, consistent error handling, and request cancellation where appropriate. Feature API modules call this client. Never hardcode production URLs inside components.
6. **Use URL state** for shareable search terms, filters, sorting, and pagination when appropriate.
7. **JavaScript only.** Use `.jsx` for React components and `.js` for helpers, stores, hooks, and API modules. No TS interfaces, TS syntax, type assertions, or TS configs. Use understandable names; optional JSDoc only when it materially improves clarity.
8. **Accessible UI.** Semantic HTML, labels, keyboard navigation, visible focus styles, appropriate alt text, responsive images, and accessible feedback/error messages.
9. **No direct DOM manipulation** unless integrating a library that requires it. Avoid excessive abstractions and giant components.
10. **Keep admin and customer UI distinct** via separate layouts and protected routes. Frontend guards improve UX; backend authorization is mandatory.

### Example flow

`ProductsPage.jsx` → `ProductGrid.jsx` → `useProducts.js` → `products.api.js` → `apiClient.js` → `GET /api/products` → backend product module → PostgreSQL.

## 5. Visual design system

Visual direction: **modern, energetic, deal-focused, clean, approachable**. A Temu-like shopping marketplace feel without cloned branding. Product photography should dominate; pricing and calls to action must be obvious. Avoid overwhelming users with constant banners, excessive animation, or dark patterns.

### Canonical palette — Coral Commerce

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#FF623E` | Primary buttons, highlights, promo bars |
| `--color-primary-hover` | `#E54D2E` | Hover/pressed emphasis |
| `--color-text` | `#1E293B` | Primary text, navigation, footer text |
| `--color-background` | `#F5F7FA` | Main page background |
| `--color-surface` | `#FFFFFF` | Cards, forms, navigation surfaces |
| `--color-success` | `#16A34A` | Available stock, successful actions |
| `--color-border` | `#E2E8F0` | Borders and dividers |
| `--color-muted` | `#64748B` | Secondary text |
| `--color-error` | `#DC2626` | Form errors, destructive actions |
| `--color-focus` | `#1D4ED8` | Visible keyboard focus indicators |

In `src/styles/globals.css`:

```css
:root {
  --color-primary: #ff623e;
  --color-primary-hover: #e54d2e;
  --color-text: #1e293b;
  --color-background: #f5f7fa;
  --color-surface: #ffffff;
  --color-success: #16a34a;
  --color-border: #e2e8f0;
  --color-muted: #64748b;
  --color-error: #dc2626;
  --color-focus: #1d4ed8;
}
```

Wire these tokens into the installed Tailwind version's theme mechanism and reuse them; avoid arbitrary hex colors scattered across JSX.

### UI guidelines

- **Typography:** Inter (or a comparable neutral sans-serif), readable line height, a clear heading hierarchy. Use consistent font sizes instead of random values.
- **Spacing:** use a consistent 4px-based spacing scale; comfortable white space; 12–16px card rounding where appropriate.
- **Header:** white background, coral wordmark/brand accent, prominent search, account and cart actions. Responsive navigation.
- **Promotional hero:** coral background with white text and a clearly distinguishable CTA. Avoid low-contrast text.
- **Product cards:** white surfaces; consistent image aspect ratios; product name, SEK price, stock/deal information only when accurate, and an obvious cart action. Avoid layout jumps using image dimensions/skeletons.
- **Product listing:** responsive grid (typically 2 columns mobile, 3 tablet, 4–5 desktop depending on width), filters and sorting.
- **Buttons:** coral for primary actions, neutral secondary buttons; visible hover/focus/disabled/loading states. Ensure accessible text contrast; for small text on coral use a darker coral or sufficiently contrasting foreground rather than assuming white is accessible.
- **Currency:** default display in Swedish kronor (`sv-SE`, `SEK`); use `Intl.NumberFormat`, never ad-hoc string concatenation.
- **Design:** mobile-first, accessible, polished; no fake reviews, fake scarcity, or misleading discounts.

## 6. Backend rules

- One Node.js/Express application; each business module contains routes, controllers, services, and repositories where applicable.
- **Controller:** validate/parse request and return HTTP response; **service:** business rules and orchestration; **repository:** SQL and DB persistence; **routes:** map endpoints/middleware.
- Modules communicate through **public JavaScript service functions**, not REST calls to localhost. Avoid accessing another module's private repository directly.
- Keep one PostgreSQL instance and one logical database; use migration scripts. Use parameterized SQL (`$1`, `$2`, ...) and transactions for writes that must be atomic.
- REST endpoints under `/api`, e.g. `/api/products`, `/api/cart`, `/api/orders`, `/api/auth` (consistent versioning if added later).
- Enforce validation, authentication, and authorization on the backend; never trust product prices, discounts, stock, totals, or roles submitted by the client.
- Recalculate prices and stock at checkout. Use transaction-safe stock reservation/decrement and avoid overselling.
- Secure sessions with HTTP-only, `Secure` cookies in HTTPS production and appropriate `SameSite` settings; use server-side session storage and CSRF protection for cookie-authenticated state-changing requests.
- Hash passwords with a strong password-hashing algorithm; rate-limit login and sensitive endpoints. Do not log passwords, tokens, payment secrets, or private customer data.
- For payments, use a payment provider's **sandbox/hosted workflow** and verify signed webhooks; do not handle raw card data. Make webhook processing idempotent.
- Return consistent HTTP codes, errors, and pagination shape. Centralize Express error handling.
- Configure CORS only for explicit allowed origins, and support credentialed requests safely.

## 7. Data and API conventions

Likely initial tables (design schema with constraints and relationships before implementing): `users`, `sessions`, `products`, `categories`, `product_images`, `inventory`, `carts`, `cart_items`, `orders`, `order_items`, `addresses`, `payments`. Add wishlist tables when that feature begins.

- Use stable identifiers, timestamps, constraints, indexes where justified, and foreign keys.
- Store prices using fixed-precision numeric or integer minor units; **never floating-point currency calculations**.
- Persist the purchased item's price/name snapshot on `order_items` so historical orders remain accurate when catalog items change.
- Use meaningful status enums/check constraints and enforce valid order/payment transitions.
- Provide pagination and defensive limits for product search/list endpoints.
- Define API request/response contracts when implementing a feature; add examples to the README or API documentation.

## 8. Security and quality checklist

Before considering any feature finished:

- It works end-to-end with real API/database data (or is explicitly labeled UI-only).
- Loading, empty, error, and success states are handled.
- Inputs are validated on client for usability and server for security.
- Keyboard and mobile behavior have been checked.
- Auth permissions are enforced on the server, not merely hidden in the UI.
- Relevant tests pass; linting passes; no debug logs or unused code remain.
- New config is documented in `.env.example`; **never commit `.env` or secrets**.
- Existing structure and design tokens are followed.

Prefer small, meaningful tests: module service logic, API endpoint behavior, purchase transactions, auth/authorization, and key React component interactions. Use mock data only for local scaffolding or tests; remove it from production paths when the API is available.

## 9. Build order

1. **Foundation:** scaffold React + Vite (JavaScript), Express, PostgreSQL, migrations, routing, shared layouts, design tokens, API client.
2. **Products vertical slice:** product schema + backend `GET /api/products` and `GET /api/products/:id` + frontend listing/cards/details. First end-to-end milestone.
3. **Authentication:** registration, login, sessions, account/profile, protected admin routes.
4. **Admin/catalog:** create/update products and categories, images, inventory.
5. **Cart:** add/update/remove cart items and server persistence.
6. **Checkout/orders:** addresses, order placement, transactions, order history.
7. **Payments:** sandbox integration, webhook verification, order/payment reconciliation.
8. **Polish:** search/filter/sort, wishlist, UX, test coverage, observability, Docker/deploy and CI.
9. **AI phase (later):** assistant with backend-controlled tools, product retrieval/RAG, grounded answers, traceability, and explicit confirmation before any purchase-related actions.

## 10. Instructions when acting as a coding agent

1. **Inspect existing code and this file before editing.** Do not assume the target folders already exist.
2. **Explain the feature briefly**, then implement the smallest complete, testable vertical slice. Keep changes focused.
3. **Use JavaScript throughout.** Never silently generate TSX/TypeScript or replace Express with Next.js/NestJS.
4. **Reuse established components, utilities, and tokens** before introducing new abstractions/dependencies.
5. **Respect module ownership** and write clear, idiomatic code that a learner can follow. Add short explanations of important architectural decisions, not a wall of comments.
6. **Do not create fake implementations** or hardcode fake product data as though connected to a backend. If a stub is necessary, mark it clearly.
7. **Do not modify unrelated files** or rewrite large parts of the application without reason.
8. **Run relevant tests/lint/build when available**, fix problems caused by changes, and report what was or was not verified.
9. **Keep README and `.env.example` updated** when setup or configuration changes.
10. **Follow the phase plan**: do not introduce AI agents, microservices, message brokers, Kubernetes, or complex cloud infrastructure before the core store works.

**Success criterion:** a maintainable, responsive shopping app with a clear React feature-based frontend, an Express modular-monolith backend, PostgreSQL persistence, secure customer/admin workflows, and a clean path to future AI features.
