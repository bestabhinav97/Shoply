# WebShop

React (JavaScript + Vite) frontend and a modular Express monolith backed by PostgreSQL. PostgreSQL and pgAdmin run in Docker; Node runs locally.

## Local setup

Prerequisites: Node.js 22.12+ (Node 24 recommended) and Docker with Compose.

1. Copy `.env.example` to `.env`, set the two passwords and generate `JWT_SECRET` with the command shown in that file. A configured `.env` already exists on this machine. Never commit it.
2. Run `npm install` from the project root.
3. Run `npm run db:up` to start PostgreSQL and pgAdmin.
4. Run `npm run db:migrate` to apply SQL migrations.
5. Run `npm run db:seed` to insert the optional development catalog (12 sample products and 18 variants). It is safe to rerun and refuses production execution.
6. Run `npm run dev` to start both the API and React development server.

- Frontend: http://localhost:5173
- API health check: http://localhost:3000/api/health
- pgAdmin: http://localhost:5050 (login with `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` from `.env`)
- PostgreSQL from the host: `127.0.0.1:5433`, database/user/password from `.env`.

In pgAdmin, register a server with hostname **postgres**, port **5432**, maintenance database matching `POSTGRES_DB`, and credentials matching `POSTGRES_USER` / `POSTGRES_PASSWORD`. Containers use the Docker service name and internal port rather than the host port.

## Structure

```text
backend/
  app.js                 Express app and module routing
  server.js              Database check, HTTP startup and shutdown
  config/env.js          Root .env loading
  db/db.js               Shared PostgreSQL pool and query helper
  modules/health/        Database health endpoint
  modules/auth/          Authentication routes, validation, services and SQL repository
  modules/products/      Public catalog routes, validation, services and SQL repository
  migrations/            Versioned SQL schema migrations
  seeds/                 Fictional development product data and photo source manifest
  scripts/seed-products.js Explicit, transactional catalog seed command
frontend/
  src/App.jsx            Router and query provider
  src/features/auth/     Forms, authentication hooks and API calls
  src/pages/             Public home, login, signup and protected account pages
  src/features/products/ Catalog API calls, queries and browsing/detail components
  public/images/products/ Locally served, optimized demo photographs and SOURCES.md
compose.yaml             PostgreSQL and pgAdmin with persistent volumes
```

Keep future business features inside `backend/modules/<feature>/` with their own routes, services and database queries. All modules run in the same Express process and share the database pool. Use parameterized queries, e.g. `query('SELECT * FROM products WHERE id = $1', [id])`.

Vite proxies `/api` requests to the Express port configured in `.env`. Database credentials stay on the backend; frontend variables prefixed `VITE_` are public.

## Commands

- `npm run dev:backend` / `npm run dev:frontend`: run either app independently.
- `npm run build`: build the frontend to `frontend/dist`.
- `npm run lint`: lint the frontend.
- `npm test`: backend integration tests and frontend interaction tests. Backend tests create and remove a separate randomly named PostgreSQL schema; Docker PostgreSQL must be running.
- `npm run db:migrate`: apply pending migrations transactionally; safe to run again.
- `npm run db:seed`: insert the development catalog without overwriting existing products, prices or inventory. This is never run automatically during startup or migration.
- `npm start --workspace backend`: run the API without watch mode.
- `npm run db:down`: stop the database containers while retaining data.
- `npm run db:logs`: stream container logs.

Database and pgAdmin credentials initialize their volumes on first startup. Changing the passwords in `.env` does not update credentials already stored in existing volumes.

## Delivery location (frontend milestone)

The header includes a responsive delivery-location chooser. Guests can explicitly
request device location or sign in; the popup never requests location on page load.
The frontend expects `POST /api/locations/reverse-geocode` to return `{ "city": "..." }`.
The backend validates coordinates and calls Geoapify for a city-level result with
an eight-second timeout. Configure `GEOAPIFY_API_KEY` in the root `.env` to enable
lookup. Missing configuration or provider failures return **503**; no usable city
returns **422**. Only a successfully resolved city is kept in session storage.
Signed-in customers see a link to Account → Addresses and an explanation that saved
addresses are coming next. No address tables have been added. Backend configuration
reads the optional `GEOAPIFY_API_KEY` from the root `.env`; keep this key server-side.
See [the frontend walkthrough and planned API contract](docs/delivery-location.md).

## Shopping cart

Signed-in customers can add the selected in-stock variant from product details, choose 1–99 units, view the cart count in the header, and automatically update quantities or remove items at `/cart`. Quantity edits are debounced (450ms); totals update optimistically and roll back on failure. Removed items can be restored using Undo, subject to current stock availability. Guests are sent to login with a return URL. Run `npm run db:migrate` to apply `005_cart.sql`; no new environment variables are required.

The cart is stored in PostgreSQL (`carts`, `cart_items`) and belongs to the authenticated user. Each variant appears once. Writes use a transaction and a cart row lock to serialize simultaneous requests. Prices and stock come from the catalog; quantities are validated on the server. Adding does not reserve or decrement stock. Cart reads return current prices and mark unavailable quantities. Removed catalog variants are removed from carts by a foreign-key cascade. Checkout and payment remain unavailable.

All endpoints require the session cookie; writes also require the existing CSRF token and allowed Origin. Responses use `Cache-Control: no-store`.

| Endpoint | JSON body | Result |
|---|---|---|
| `GET /api/cart` | — | Current cart |
| `POST /api/cart/items` | `{ "variantId": "<uuid>", "quantity": 2 }` | Add/increment a variant |
| `PATCH /api/cart/items/:itemId` | `{ "quantity": 3 }` | Set quantity |
| `DELETE /api/cart/items/:itemId` | `{}` | Remove an item |

Successful responses return `{ items, itemCount, subtotalMinor, currency: "SEK" }`. Items include `id`, `variantId`, `productId`, `name`, `sku`, `options`, `quantity`, `priceMinor`, `lineTotalMinor`, `currency`, `available`, and `image` (variant photo, shared product photo, or null). Money is in integer öre. Invalid input returns 400, unauthenticated requests 401, failed CSRF checks 403, another customer's or missing item 404, and unavailable variants/insufficient stock 409. Limits: 99 units per item and 100 distinct items per cart.

## Authentication

The home page `/`, catalog `/products` and details `/products/:id` are public. `/login` and `/signup` open from the account link. `/account` requires authentication and returns visitors to their intended internal page after login.

Registration requires `firstName`, `lastName`, `phoneNumber`, `email`, and `password`. Names support Unicode. Valid Swedish mobile and landline numbers are stored in E.164 format (`+46…`); email is trimmed and lowercased with database-enforced uniqueness. Phone numbers are not unique account identifiers. Passwords must contain 15–128 characters and are stored as salted Argon2id hashes. Email/SMS ownership verification and password recovery are not implemented yet.

The `users.role` column accepts only `customer` or `admin`. Public registration always creates a customer and rejects extra fields such as `role`. To promote an existing account locally:

```sh
npm run admin:promote --workspace backend -- person@example.com
```

This command requires database access. There is no public role-management endpoint. Backend modules can import `requireAuth` and `requireRole` from the auth module's `index.js` to protect future admin API routes. Authorization reads the current database role on each authenticated request; it does not trust a role sent by the browser or cached in the JWT.

### Admin route foundation

After signing in with an admin account, use the **Admin** button in the shopping header to open `/admin`. This button is hidden for visitors and customers. The route has its own `AdminLayout` and left sidebar, with **Dashboard**, **Products** (`/admin/products`) and **Back to shop** navigation. The desktop sidebar starts as a 72px icon rail and expands on hover or visible keyboard focus. It overlays the page while expanded so the workspace does not shift. Navigation links retain accessible names and active-page indicators. On narrow screens the Menu button opens a sliding modal drawer with full text labels. The shared `Drawer` component uses the browser's native dialog for focus trapping, Escape handling and focus restoration, with a close button, backdrop dismissal and reduced-motion support. Customer routes continue to use `MainLayout` and the shopping header. Both branches are defined in `frontend/src/app/router.jsx`; unknown admin URLs show the shared not-found page inside the admin layout.

`RequireAdmin` reuses `RequireAuth` for session loading, errors and login redirects, then checks the role returned by `/api/auth/me`. Visitors are sent to `/login?next=%2Fadmin` and returned after login. Signed-in customers see an access-denied page with a link to their account. Refresh the page after using the local promotion command so the frontend fetches the updated role.

The Products page lists real catalog data, including draft and archived products, status, the lowest active variant price, active variant count and availability. `GET /api/admin/products` supports the public list parameters plus admin-only status and availability filters, searches variant SKUs as well as names/descriptions, and keeps the same bounded pagination shape, with a separate admin response containing `status` and `activeVariantCount`. Products without active variants show a price of `null` and a count of zero. The endpoint requires a valid session and the current database admin role and returns `Cache-Control: no-store`. Guests receive 401 and customers receive 403. The public API continues to exclude unpublished products and internal admin fields.

Product creation and editing are available at `/admin/products/new` and `/admin/products/:id/edit`. The editor manages shared fields, specifications, ordered dynamic options/values, actual variants, prices, stock, activation and shared/variant image associations. Uploads and dashboard metrics remain future work. Administrative reads and writes enforce server-side authentication and the current database role; writes also enforce origin and CSRF checks. Tests cover role authorization and revocation, draft visibility, sidebar navigation, drawer dismissal, product loading/retry and layout separation.

Each login creates an independent PostgreSQL session and an 8-hour JWT cookie containing only identifiers and token metadata. JWTs are signature-, algorithm-, issuer-, audience- and expiry-checked, and the database session must still exist and be unexpired. Signing out revokes this device; signing out everywhere revokes all sessions for the account. Sessions survive backend restarts. Future password-change/reset flows must call `revokeUserSessions` from the auth module. Expired rows may be periodically removed with `DELETE FROM sessions WHERE expires_at <= now()`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/auth/csrf` | Set an HttpOnly CSRF cookie and return its signed token |
| POST | `/api/auth/register` | Create a customer and sign in; returns 201 and public user data |
| POST | `/api/auth/login` | Email/password login; returns public user data |
| GET | `/api/auth/me` | Current user; returns 401 without a valid session |
| POST | `/api/auth/logout` | Revoke the current session; returns 204 |
| POST | `/api/auth/logout-all` | Revoke all current user's sessions; returns 204 |

Registration JSON example:

```json
{
  "firstName": "Åsa",
  "lastName": "Öberg",
  "phoneNumber": "0701234567",
  "email": "asa@example.com",
  "password": "choose a unique long passphrase"
}
```

Login accepts only `email` and `password`. Successful registration/login returns a `user` object with `id`, `firstName`, `lastName`, `phoneNumber`, `email`, and `role`. Errors use `{ "message": "…", "fields": { "fieldName": "…" } }`, with `fields` present for validation failures. JWTs and password hashes are never returned in JSON.

All POST and PUT requests require JSON, the exact configured `Origin`, the CSRF cookie, and the token from `/api/auth/csrf` in `X-CSRF-Token`. The frontend API client handles cookies and CSRF automatically. Open the app at **http://localhost:5173**, matching `APP_ORIGIN`; using `127.0.0.1` instead will fail origin checks unless you change that setting. Production should serve the frontend and `/api` under the same HTTPS origin, set `NODE_ENV=production` and `APP_ORIGIN=https://your-domain`, and keep secrets server-side. Production cookies use `Secure`, `HttpOnly`, `SameSite=Lax`, and the `__Host-` prefix. No tokens are stored in localStorage.

Security measures include Helmet headers on API responses, a 16 KB JSON request limit (512 KB for authorized admin catalog writes), strict server-side field validation, parameterized SQL, generic login failures, and CSRF protection. Per-IP rate limits now cover login (20 requests / 15 minutes), registration (10 / hour), CSRF-token requests (120 / minute) and the combined products/categories API (180 / minute). Excess requests return JSON with status 429 and a `Retry-After` header. Limits use in-process storage for this single Express instance, reset on restart, and need shared storage or equivalent edge protection before scaling to multiple instances. Proxy trust is disabled; configure it precisely for the actual deployment rather than trusting arbitrary forwarded headers. Do not treat this local setup as a completed production deployment.

## Product catalog

The catalog supports database-backed browsing and admin creation/editing. Customer option selectors are rendered from API definitions, with variant-specific prices, availability and images. Missing combinations are shown as unavailable while other selections are preserved. Uploads, carts and checkout remain future increments; there is no public catalog mutation endpoint or simulated purchase button.

The shared header contains product search with a category dropdown on its left, populated from the categories API. Select a category and submit to browse it, or enter a search term to search within it. Search works from any route and navigates to `/products`; submitting from the catalog preserves sorting and resets pagination. Committed search/category values follow the URL, including Back/Forward navigation. On narrow screens the search occupies a second full-width header row. Sorting remains above the product grid.

Generic `Button`, `Input` and `Select` controls live in `frontend/src/components/ui/`. `Header.jsx` handles layout and imports `CatalogSearch` through the products feature's public API; category fetching, form drafts and product search navigation stay inside that feature. Header styles live in `components/layout/header.css`, shared form-control styles in `components/ui/controls.css`, and catalog styles in `styles/catalog.css`.

The seed catalog is explicitly marked as a demo in the UI. Names, descriptions, prices and inventory are fictional development data, not supplier offers. Product data lives in `backend/seeds/products.js`; the frontend reads only the API. Records use deterministic seed IDs and unique slugs. Existing products and all their children are skipped on reruns, including renamed seed products. Seeds do not act as a catalog update command, and removing a seed entry does not delete a database record.

### Database ownership

- `categories` identifies browsing categories.
- `products` owns names, slugs, plain-text descriptions, category, draft/active/archived status and a shared `specifications` JSON object.
- `product_options` defines ordered product-specific attributes; `product_option_values` defines their ordered allowed values. Names/values are unique within their parent ignoring case and surrounding whitespace.
- `product_variants` owns SKU, integer price in öre, SEK currency and active status. `variant_option_values` selects exactly one value per option. Same-product foreign keys and a database-derived combination identity protect these selections. Simple products use one default variant with no selections. Legacy zero-variant products remain visible only to admins.
- `inventory` owns nonnegative stock for each variant. It is not cached as authoritative client state.
- `product_images` stores storage keys, alt text, dimensions, order and an optional variant association constrained to the same product.

Foreign keys, unique SKU/option constraints and nonnegative price/stock checks protect data integrity. Public reads exclude draft/archived products and inactive variants. Only a stock availability boolean is exposed. Later checkout must revalidate price and inventory transactionally; browsing availability is not a stock reservation.

### Read API contract

| Method | Endpoint | Response |
|---|---|---|
| GET | `/api/products` | `{ items, pagination: { page, limit, total, totalPages } }` |
| GET | `/api/products/:id` | `{ product: { id, slug, name, description, specifications, category, options, images, variants } }` |
| GET | `/api/categories` | `{ items: [{ id, name, slug }] }` for categories with published products |

Listing query parameters:

- `q`: literal name/description search, maximum 100 characters.
- `category`: category slug, such as `shoes`.
- `sort`: `newest` (default), `price-asc`, `price-desc` or `name`. Price sorting uses the lowest active variant price.
- `page`: integer 1–9999, default 1.
- `limit`: integer 1–48, default 12.

Example: `GET /api/products?category=shoes&q=sneaker&sort=price-asc&page=1&limit=12`.

Each list item contains `id`, `slug`, `name`, `category`, `priceMinor`, `hasPriceRange`, `currency`, `inStock` and `image` (or `null`). Prices use integer minor units, e.g. `44900` represents SEK 449.00. Images contain `url`, `alt`, `width` and `height`. Details include ordered `options` with `id`, `name`, `position` and ordered `values` (`id`, `value`, `position`). Variants contain `id`, `sku`, `optionValueIds`, `priceMinor`, `currency`, `active` and `inStock`; detail images may include `variantId`. Internal inventory quantities are omitted. Product IDs are UUIDs, and the public detail route uses the ID rather than the slug.

Invalid, repeated or unsupported API query parameters return 400 with `{ message, fields }`. A valid but unpublished/missing product ID returns 404. Empty or out-of-range pages return an empty `items` array while preserving the actual total. SQL values are parameterized, search wildcards are escaped, and sort expressions come from a fixed server-side allowlist.

### Dynamic options and admin writes

See [the complete dynamic option contract and migration guide](docs/catalog-options.md) for request examples, constraints, recovery and limits. `003_dynamic_options.sql` migrates existing selections without changing variant IDs, SKU, price, stock or image associations; inconsistent legacy data stops the entire migration before old columns are removed. Take a database backup and stop catalog writes before upgrading schema and code together.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/admin/products/categories` | All existing categories, including those without published products |
| POST | `/api/admin/products/categories` | Create a reusable category from `{ name, slug }`; returns 201 and `{ category: { id, name, slug } }` |
| GET | `/api/admin/products/:id` | Complete editable graph, including inactive variants, exact stock, image storage keys and `version` |
| POST | `/api/admin/products` | Transactionally create a complete product; returns 201 and `{ product }` |
| PUT | `/api/admin/products/:id` | Transactionally replace the editable graph using its latest `version`; returns `{ product }` |

All admin routes require a current admin session and use `Cache-Control: no-store`. Writes require JSON, same-origin and CSRF verification. PUT is a complete replacement, not a partial patch. Stable child IDs preserve variants and stock across edits. Stale versions return 409; invalid configurations return 400; duplicate slugs/SKUs/combinations return 409. Adding an option never generates purchasable variants automatically. The editor adds one explicit variant at a time. Category creation is available directly in the product creation flow. Image uploads remain outside this increment; use existing image storage keys.

The admin Products page has search, category, publication status, availability and sorting controls, all backed by URL state and API queries. Apply filters resets pagination; changing pages retains filters. Admin-specific query parameters are `status=draft|active|archived` and `availability=in-stock|out-of-stock`. Availability is based on active variants; products with no active variants are treated as out of stock. Public query contracts are unchanged.

New-product creation uses Details, Options, Variants, Images, then Review. The admin enters option names and allowed values, then explicitly adds the combinations to sell and their stock quantities. SEK prices accept comma or dot decimals and convert to integer minor units without floating-point currency arithmetic. Specifications use name/value rows. The product defaults to Draft and nothing is saved until the review is submitted. Inline category creation saves immediately and selects the new category; it remains reusable even if product creation is cancelled. Category names are unique ignoring case and surrounding whitespace, enforced by migration `004_category_names.sql`; ambiguous existing names stop migration without changing data. Product names in the admin catalog link to the existing edit route.

Editing uses the same detail, specification, option, variant and image controls in one form, with SEK price inputs and Draft, Active and Archived statuses. Existing child IDs, image associations and unchanged SKUs are retained. Existing non-text specification values retain their JSON types unless edited; edited values are saved as text. The editor validates the complete configuration before saving, retains drafts on save failures and warns before navigating away with unsaved changes or closing/reloading the tab. React Router's data router enables navigation blocking for links and browser history. Saving returns to the catalog with confirmation. A stale-version conflict disables saving until the admin explicitly confirms reloading the latest product; cancelling reload or a failed reload keeps local edits. Duplicate slug/SKU conflicts remain editable without a forced reload. No schema or environment changes are required.

Variant SKUs are optional in the editor and admin write API. Omit `sku`, or send an empty/whitespace-only string, to generate a stable `SL-` code from the full variant UUID on the server. Codes are generated before uniqueness validation and persisted with the variant; database uniqueness constraints still apply. Custom SKUs remain editable and are trimmed and validated (maximum 100 characters). Existing SKUs remain unchanged when editing unless explicitly replaced or cleared. Review shows "Generated on save" for automatic codes.

Products are bounded to 8 options, 100 values per option, 250 actual variants and 50 images. These limits are enforced by API validation and database checks, keeping complete detail/editor responses bounded. Catalog listings retain existing pagination and price/availability semantics, including the cheapest active variant even when it has no stock. Larger single-product configurations need a future paginated variant/resolution contract before increasing limits.

### Photographs and future uploads

Twelve curated Pexels photographs are stored in `frontend/public/images/products/` and served under `/images/products/`. They are resized to at most 1000px, converted to WebP and stripped of metadata. The seed command requires no internet access. Source pages, photographers, retrieval date, license and transformations are recorded in `backend/seeds/photos.json` and the public `SOURCES.md`. These are illustrative stock photos, not evidence of supplier specifications or brand relationships; review rights and replace them with approved product photography before selling actual goods.

PostgreSQL stores keys such as `products/everyday-white-sneaker.webp`, not image bytes. The product service resolves these to public image URLs. Future admin uploads will use persistent object storage through this boundary, not write into the frontend source or temporary server disk.

Before enabling uploads, implement server-enforced admin authorization and origin/CSRF checks for multipart requests (the existing JSON-only CSRF middleware cannot accept uploads unchanged). Allowlist raster formats, verify signatures, decode/re-encode images, remove metadata, generate storage names and cap file count, bytes and decoded pixels. Reject SVG/HTML, user-controlled paths and arbitrary remote image imports. Keep object-storage credentials server-side and record admin mutations in an audit trail. No upload surface is enabled in this milestone.

### Deployment requirements

Serve the frontend and API under the same HTTPS origin, applying security headers to frontend HTML and images as well as API responses. Keep credentialed cross-origin access closed unless explicit origins are required. Use a least-privilege runtime database role separate from the migration/administration role; the Docker initialization user in this local setup is not a production runtime role. Back up database and media before deployment. Review dependency advisories and configure deployment-specific proxy/rate-limit behavior. The seed command is blocked when `NODE_ENV=production`.

### Catalog checks

Backend integration tests use a separate randomly named PostgreSQL schema and cover seeds, catalog visibility, filtering/pagination, per-variant pricing and stock, invalid input and request throttling. Frontend tests cover browsing, option selection, URL filters, pagination and loading/empty/error states. Run `npm test`, `npm run lint` and `npm run build` from the root. Check narrow screens and keyboard focus in a browser before release.

Setup references: [Vite](https://vite.dev/guide/), [PostgreSQL Docker image](https://hub.docker.com/_/postgres), [pgAdmin container documentation](https://www.pgadmin.org/docs/pgadmin4/9.19/container_deployment.html).

## Storefront design notes

See [the storefront redesign notes](docs/storefront-redesign.md) for the responsive layout, filter scope, data limitations, and changed-file inventory.


## Storefront UI

The storefront uses a centered 1200px container with 16/24/32px responsive gutters. CSS custom properties in `frontend/src/styles/globals.css` define the palette, spacing, type scale and radii; `storefront.css` supplies shared controls and containers. Header, product-detail and cart styles remain beside their features. Native dialogs provide the mobile navigation and image zoom; native details elements provide product accordions. Motion respects `prefers-reduced-motion`.

Product recommendations use the real category catalog API, exclude the current product, and disappear when no alternatives are available. Photos use existing catalog assets, with a labeled fallback when missing. Shipping and returns copy makes no service promises for this demo. Checkout remains coming soon; the account Orders tab is a placeholder with no order API. Dark mode is not implemented.

## Account area

`/account` redirects to `/account/profile`. Profile, Addresses, Payment methods and Orders each have protected, refreshable routes under `/account`. The latter three are UI-only empty states with no data models or API calls. Account components and styles live in `frontend/src/features/account/`; route pages live in `frontend/src/pages/account/`. The desktop sidebar becomes a horizontally scrollable navigation bar below 768px.

Profile displays and edits the current user's email and phone. `PATCH /api/auth/me` accepts a nonempty object containing only `email` and/or `phoneNumber`, for example `{ "phoneNumber": "+12025550123" }`, and returns `{ "user": { ... } }` with the same public fields as `GET /api/auth/me`. It requires the session cookie, CSRF token and allowed Origin. Emails are normalized to lowercase and must be unique; phones must include `+` and a valid country code and are stored in E.164 format. Invalid input returns 400 with field errors, duplicate emails return 409, and unauthenticated requests return 401. The user ID always comes from the session. Successful saves update the shared auth query cache and PostgreSQL user record.

Email and phone ownership verification is intentionally deferred (TODO in the profile service). Changing email also changes the login email immediately. Existing registration still requires email and a Swedish phone number; the profile UI supports missing values defensively, without changing registration or the database's required fields. Existing sign-out controls remain available. No migrations, dependencies or environment variables were added.
