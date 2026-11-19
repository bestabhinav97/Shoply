# Storefront refinement

Presentation changes only: routes, dependencies, API contracts, prices, inventory and session behavior are preserved.

## Dialog audit

One `ModalCloseButton` now serves every app-owned dialog and drawer:

- Delivery location, including its mobile bottom sheet.
- Add delivery address, from both the account page and delivery chooser.
- Edit delivery address.
- Remove address confirmation.
- Edit/add email and phone number.
- Contact verification availability notice.
- Sign out on all devices confirmation.
- Product photo zoom.
- Catalog filters drawer.
- Customer mobile navigation drawer.
- Admin mobile navigation drawer.
- Admin discard unsaved product changes confirmation.
- Admin reload latest product confirmation.

All use the icon-only X, `Close dialog` accessible name, 20px icon with 1.75 stroke, 40px target (44px for coarse pointers), 16px top/right inset, hover and visible focus states. Escape and backdrop dismissal are supported. Close returns focus to the opening control when it still exists. Nested dialogs retain scroll locking. A pending sign-out or address deletion retains its existing dismissal guard until the request settles.

The browser-owned tab-close/reload warning for unsaved admin edits remains `beforeunload`; browsers control that warning and its close control.

## Removed elements and text

- Full-row Close text buttons and per-dialog close variants.
- Recipient name in the header delivery selector.
- Yellow contact verification banner, its redundant Verify now action and helper copy.
- Tinted profile icon squares and avatar tint; decorative category badge styling.
- Inline contact and address edit forms; their fields now appear in dialogs.
- Orphan saved-address introduction and address-edit helper that repeated preference behavior.
- Address default banner strips and their empty reserved row.
- Oversized add-address plus icon and red resting address action links.
- Duplicate out-of-stock image badge.
- Visible Photo coming soon text, replaced with a labeled image icon.
- Product trust list and its slogans; a factual checkout-unavailable notice remains.
- Promotional flower decorations, repeated discovery kicker and whimsical catalog taglines.
- Authentication bag illustration, decorative captions/kicker and generic security slogan.
- Resting card shadows and product-card lift/image-zoom hover animation.
- Nested scrollbar in the desktop filters sidebar.

Location privacy notices, provider attribution, form validation, deletion consequences and demo limitations are retained.

## Page changes

- Shared styling: 6px controls, 10px cards, dialogs no larger than 14px rounding; tighter typography, 600 headings, tabular prices, neutral underlined body links, 150ms transitions and reduced-motion support.
- Header: compact two-line delivery control with city/postcode and adjacent chevron; neutral search action, cart count and avatar; factual demo announcement. Shared container width/gutters and scroll offsets align storefront and account content.
- Home/catalog: specific browsing copy, quieter category tiles, two-line product names, image placeholders, aligned price/stock content, one stock indicator, 40px sort/filter controls and natural sidebar scrolling.
- Product: plain category link, consistent dark selected-thumbnail border, matching 48px quantity/cart controls, simplified information and retained sample-product disclosure.
- Profile: inline verification status/action, plain row icons, matching nowrap Add/Edit controls and modal contact editing.
- Addresses: modal forms, consistent card structure/row height, Default next to recipient, delivery status in a shared position, neutral actions and destructive hover with confirmation, equal-height add tile.
- Authentication: plain sign-in/create-account copy and simpler account illustration panel.
- Admin: discard/reload confirmations now use the shared dialog; their existing edit and reload behavior is preserved.

## Verification and limits

- Frontend suite: 116 tests passed, including shared Modal/Drawer close, Escape/backdrop, focus return and nested scroll-lock checks, plus existing account/address/cart/catalog/admin interactions.
- ESLint and production build passed. Vite retains its bundle-size advisory.
- Browser access host was unavailable. Visual checks at 375px, 768px and 1280px, real-browser keyboard traversal and a complete rendered WCAG AA audit remain unverified. Responsive rules were reviewed in source; jsdom tests do not measure layout or implement native focus trapping.

## Store information to confirm

No delivery, return, refund or payment promises were invented. The current app labels itself a demo with checkout and contact verification unavailable. Confirm actual shipping charges/times, return terms and verification availability before replacing those notices with retail policies. There are no other copy assumptions awaiting confirmation.
