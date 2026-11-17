# Admin catalog UI refresh

This change refines the Products list and five-step Create product wizard. Existing routes, API calls, field labels, validation rules, save payloads, and data models are retained.

## Before and after

- Oversized headings and a nested page card become a compact page header on a neutral canvas, with an obvious Create product action.
- Uneven filters become an aligned toolbar with search icon, consistent controls, responsive wrapping, and a styled Clear action.
- Plain catalog rows gain square thumbnails, linked product names, status pills, stock dots, tabular prices, sticky column headings, and hover feedback. Small screens show stacked cards.
- Plain loading text becomes a skeleton; empty catalogs gain an icon and creation action; a footer reports the result count alongside existing pagination.
- Tab-like progress becomes connected numbered steps with completed checkmarks and an accented current step.
- Bordered legends become section headings; the Details form gains paired short fields, a URL prefix, description character count, and a sticky action footer.
- Variants become an editable table; image entries gain previews; Review gains summary cards and shortcuts back to Details, Options, Variants, and Images.

## Files

All paths below are relative to `frontend/src/`:

- `components/layout/AdminLayout.jsx`: load the shared admin theme.
- `components/layout/admin-theme.css`: admin tokens and common typography, buttons, controls, focus, and motion rules.
- `components/ui/Icon.jsx`: lightweight plus, search, check, and image SVG paths.
- `pages/admin/AdminProductsPage.jsx`: compact catalog heading and plus icon.
- `pages/admin/AdminProductEditorPage.jsx`: editor heading, subtitle, and return link.
- `features/admin/components/AdminProductFilters.jsx`: search icon and styled Clear action.
- `features/admin/components/AdminProductList.jsx`: table presentation, edit links, badges, loading, empty state, and count footer.
- `features/admin/components/admin-catalog.css`: toolbar, table, badges, skeleton, and mobile cards.
- `features/admin/components/ProductCreateForm.jsx`: stepper checkmarks, footer layout, and review navigation.
- `features/admin/components/ProductCreateDetails.jsx`: sections, short-field grid, handle prefix, and character hint.
- `features/admin/components/CategoryPicker.jsx`: Create category icon.
- `features/admin/components/ProductOptionsEditor.jsx`: section headings.
- `features/admin/components/ProductVariantsEditor.jsx`: accessible editable table, retaining existing field handlers.
- `features/admin/components/ProductImagesEditor.jsx`: storage-library notice, section headings, and previews.
- `features/admin/components/ProductCreateReview.jsx`: section edit shortcuts.
- `features/admin/components/product-editor.css`: wizard, form, table, preview, and review styles.
- `test/auth.test.jsx`: assert the requested product edit link.
- `test/dynamic-options.test.jsx`: verify Review → Edit variants preserves values without saving early.

## Tokens

The theme reuses the existing Inter font stack, neutral surface/border/text tokens, and accessible burnt-orange `--color-primary-button`. Tokens are scoped to `.admin-layout` so the customer storefront retains its existing appearance.

| Tokens | Purpose |
| --- | --- |
| `--admin-accent`, `--admin-accent-hover`, `--admin-accent-soft` | Consistent brand actions, links, current/completed steps, and hover states |
| `--admin-surface-muted` | Table headers, inset cards, and image-library notice |
| `--admin-success`, `--admin-success-soft` | Active products and available stock |
| `--admin-warning`, `--admin-warning-soft` | Shared amber semantic palette for future accurate warning states |
| `--admin-danger`, `--admin-danger-soft` | Unavailable stock and validation feedback |
| `--admin-info`, `--admin-info-soft` | Shared blue semantic palette |
| `--admin-radius-control`, `--admin-radius-card` | 8px controls and 12px cards |
| `--admin-shadow`, `--admin-focus-ring` | Subtle elevation and accent input focus |

## Scope and verification

Image upload/drop, reorder, early draft saving, Duplicate, and Archive workflows were not introduced. Existing image storage-key inputs and final Save product behavior remain authoritative. Low-stock and SKU badges are not fabricated from the list response, which does not expose those values. Product names link to the existing edit route.

Verification: backend tests (39), frontend tests (33), ESLint, and the production build. Frontend coverage includes catalog URL filters/pagination, category creation, wizard validation, review navigation, and the final integer-price save payload.

Browser and desktop automation were unavailable in this session, so rendered desktop/mobile layout and manual keyboard inspection remain unverified. Responsive behavior, semantic labels, focus styles, and reduced-motion handling are implemented in the code.
