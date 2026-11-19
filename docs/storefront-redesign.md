# Storefront redesign

This is a presentation and browsing-UX update. Routes, API modules, query contracts, product models, authorization, and session behavior remain unchanged. The home page continues to link into the catalog without fetching a product list.

- The single header row is now a sticky, bounded header with a demo announcement, attached category/search controls, account dropdown, disabled cart, and a category strip built from the existing categories query.
- Mobile places the wordmark, cart, and account-menu icon above the full-width search. The category strip scrolls independently.
- The large catalog banner is now a compact coral promotion with a Shop now link and two desktop category tiles. Tiles use the first two returned categories; no invented categories or product images are used.
- The listing adds a desktop filter sidebar and mobile modal drawer, a result-count/sort toolbar, removable filter chips, and Clear all. Category, search and sorting use URL state. The customer list now loads additional API pages automatically while scrolling.
- Availability and price filters apply to all loaded products. Scrolling appends more products; a Load more button provides keyboard access and a fallback when automatic loading is unavailable. Failed incremental loads preserve existing cards and offer an explicit retry. Price inputs accept SEK and compare integer minor-unit prices.
- Product grids use two columns on mobile, three from 720px, four from 1024px, and five from 1280px. Cards have square lazy-loaded images, broken-image fallbacks, two-line names, bold SEK prices, supported stock badges, and a full-width View product treatment inside the existing card link.
- Existing loading, API-error/retry, empty-result, and incremental loading states are retained. Reduced-motion preferences disable the new hover movement. Native details/dialog controls provide account disclosure and modal filtering; Escape closes either control.

## Changed and added files

All paths below are relative to the repository root.

| File | Change |
| --- | --- |
| `frontend/src/components/layout/Header.jsx` | Announcement, sticky header, account menu using existing auth hooks, disabled cart |
| `frontend/src/components/layout/header.css` | Bounded responsive header, dropdown, search and category strip |
| `frontend/src/features/products/components/CatalogSearch.jsx` | Existing search submit uses the shared magnifier icon |
| `frontend/src/features/products/components/CategoryNav.jsx` | New data-driven category navigation |
| `frontend/src/features/products/components/categoryLink.js` | New shared category URL helper |
| `frontend/src/features/products/components/CatalogPromo.jsx` | New shared home/catalog promo and category tiles |
| `frontend/src/features/products/components/FilterSidebar.jsx` | New reusable desktop/drawer filter controls |
| `frontend/src/features/products/components/ProductCatalog.jsx` | Sidebar/drawer, local page filters, count, chips and empty-state clearing |
| `frontend/src/features/products/components/ProductCard.jsx` | Image fallback, supported stock badge and View product treatment |
| `frontend/src/features/products/index.js` | Public exports for shared storefront compositions |
| `frontend/src/pages/HomePage.jsx` | Composes the shared promotion |
| `frontend/src/pages/ProductsPage.jsx` | Composes promotion and listing |
| `frontend/src/styles/catalog.css` | Promo, filter, toolbar, responsive card grid and hover styling |
| `frontend/src/index.css` | Shadow tokens and skip-link stacking above the sticky header |
| `frontend/src/test/products.test.jsx` | Loaded-page filters, URL preservation, image fallback, keyboard account menu and drawer interaction tests |
| `README.md` | Links to these implementation notes |
| `docs/storefront-redesign.md` | Design decisions and file inventory |

## Tokens and data limits

Existing coral, navy, surface, border, success, focus, and burnt-red primary-button tokens are reused. New tokens in `frontend/src/index.css` are `--shadow-header` and `--shadow-card`. No new dependencies or configuration are required.

Ratings, review counts, compare-at prices/discounts, low-stock quantities, sold counts, and shipping/returns promises are omitted because the public product contract does not provide them. There is no decorative wishlist control that implies a working feature. Category tiles are conditional on returned categories. The cart has an unavailable badge placeholder and remains disabled; no purchasing logic was added.

## Verification

Verified during implementation: frontend lint and production build passed; all 41 backend tests and 39 frontend tests passed.

Run `npm run lint`, `npm test`, and `npm run build` from the root. Interaction tests cover existing search/sort/pagination and the new page filters, category navigation, image errors, and drawer dismissal. Native modal behavior, pixel layout, mobile overflow, and visual focus treatment still require a real-browser check; browser and desktop automation were unavailable during this session.
