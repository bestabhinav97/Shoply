# Payment methods refinement

The later saved-card listing block adds authenticated `GET /api/payments/methods`
and refreshes the list on page entry. Its page note is now just "Sandbox mode:
test cards only." The copy inventory below records the earlier refinement pass.
The later brand-symbol refinement also replaces the generic icon for known card
brands with locally served MIT-licensed artwork; provenance is recorded in
`frontend/public/images/payment-brands/SOURCES.md`.

## Scope and verification

Refines Account > Payment methods and Add a card markup, styles, copy and UI
feedback. No changes to Braintree client-token requests, nonce generation, Vault
requests, backend services, or API contracts. No dependencies added. SDK field
metadata drives validation; raw card values are never read, logged or stored.

The shared icon-only close control and the existing submission dismissal guard
remain. The successful save response now also supplies masked card metadata to
the parent announcement callback. The existing save/cache behavior is unchanged.

## Design changes

- Neutral Sandbox pill beside the title; no subtitle, amber banner or bottom shield.
- Muted sandbox note under the list, no upcoming-feature copy or unavailable actions.
- Card rows have a 10px radius, 1px border, no shadow, 16px/20px padding, 24px plain
  muted icon, 72px minimum height, and 12px row gaps. Normal two-line rows and
  skeleton rows both occupy 72px (20px title line + 18px expiry line + 32px padding
  + 2px borders). Long translated/brand text may wrap and increase the row height.
- Expiry uses tabular numerals; expired cards say Expired in the danger color.
- Modal width capped at 440px, 24px padding, 14px radius. Inputs/buttons are 40px
  high with 6px radii. Number is full width; expiry/CVV share a row with a 16px gap.
- SDK styles use only allowed font/color/line-height properties and a system font.
- `cardTypeChange` displays the detected brand and adjusts CVV guidance for four
  digits. No brand logo assets were introduced.
- `blur` and `validityChange` reveal inline errors after interaction. Each field
  reserves 36px for two lines of 12px feedback; the parent wrapper has
  `aria-describedby` and `aria-invalid`. The SDK's supported `setAttribute` and
  `setMessage` APIs supply invalid state and accessible messages inside its iframes.
  Cross-document references to parent IDs cannot label an iframe's internal input;
  no unsupported `aria-describedby` SDK attribute is attempted.
- Braintree's `braintree-hosted-fields-focused`, `-valid` and `-invalid` class names
  were checked in the installed SDK and reference docs. Focus gets the app ring;
  interacted invalid fields get a danger border. Valid fields retain a neutral border.
- Save remains disabled until all SDK fields report valid. Tokenization codes map
  to short messages. Loading uses Saving..., spinner and aria-busy. Initialization
  focuses the hosted number field. Existing teardown/focus-return behavior remains.

References: [Hosted Fields options](https://braintree.github.io/braintree-web/current/module-braintree-web_hosted-fields.html),
[field events and accessibility methods](https://braintree.github.io/braintree-web/current/HostedFields.html).

## Account-tab layout measurements (Part C)

**Not measured.** The browser access host and native computer-use pipe were both
unavailable when baseline measurement was attempted. The supplied screenshots
show Payment methods only and do not establish before/after geometry for four tabs.
No numeric deltas or layout-shift score are inferred from them.

| Viewport | Deliver to | Search | Sidebar | Content card | Page title | Layout-shift score |
| --- | --- | --- | --- | --- | --- | --- |
| 1280px | Not measured | Not measured | Not measured | Not measured | Not measured | Not measured |
| 768px | Not measured | Not measured | Not measured | Not measured | Not measured | Not measured |

No Part C changes were made to global scrollbar behavior, AccountLayout, shared
account headers, header location sizing, sidebar sizing/weight, sticky-header
offsets, or scroll restoration. The request explicitly requires confirming each
cause by measurement first. Existing code already uses a shared Outlet layout,
`minmax` content column, and a transparent 3px border on inactive sidebar links;
these observations alone do not prove the remaining jump's cause.

When browser access is restored, record `getBoundingClientRect()` x/y/width for
the requested elements at both widths before and after each transition:
Profile > Addresses > Payment methods > Orders. Observe `layout-shift` entries
through a PerformanceObserver without discarding recent-input entries for this
navigation audit. Record viewport height, document scroll position and scrollbar
presence too. Only then apply demonstrated fixes and repeat. Acceptance remains
unverified: zero header/sidebar/card-left-edge movement and score below 0.01.

One confirmed static sizing conflict in scope B was the shared
`.modal:has(.account-dialog)` width of 560px; the payment modal now has a more
specific 440px rule. This is a selector-level finding, not a measured Part C cause.

## Complete copy-change inventory

Unlisted strings (field labels, setup/server error messages, Add a card, Save card,
Cancel, Try again, and the normal expiry prefix) are unchanged.

| Previous string | Replacement / disposition |
| --- | --- |
| Keep your preferred cards ready for future shopping. | Removed |
| Sandbox · Test cards only | Sandbox (neutral pill) |
| Cards are saved in Braintree’s test Vault. This page shows cards saved during this visit. Loading earlier cards after leaving or refreshing, and removing cards, are coming next. | Sandbox mode: test cards only. Cards shown here were saved during this visit. |
| No payment methods yet. | No saved cards |
| Add a test card to see it here. Previously saved cards aren’t loaded in this step. | Add a test card to see it here. |
| Card details go directly to Braintree through its secure fields. Shoply displays only the brand, last four digits and expiry. | Removed from page; modal now says Card details go directly to Braintree. Shoply keeps only the brand, last four digits and expiry. |
| Test card saved successfully. No purchase was made. | {brand} ending in {last4} added (polite live region) |
| Sandbox testing only. Enter a test card, not a real card. Save card stores it in Braintree’s test Vault. No purchase will be made. | Sandbox: enter a test card, not a real one. No purchase will be made. |
| Card number (placeholder only) | 1234 1234 1234 1234 |
| CVV (placeholder) | 123 (1234 for a detected four-digit security code) |
| Security code (CVV) | Unchanged normally; Security code (4 digits) when appropriate |
| Saving card… | Saving... |
| Enter a valid card number, expiry date and security code. | Enter the card details. (HOSTED_FIELDS_FIELDS_EMPTY) / Check the highlighted card details. (HOSTED_FIELDS_FIELDS_INVALID) |
| Couldn’t process the test card. Please try again. | Retained as fallback; specific codes now use Couldn’t process this card. Try another test card. / Connection interrupted. Please try again. |

New strings: Test Visa: 4111 1111 1111 1111; Enter a valid card number; Enter a valid
expiry date; Enter the security code; Expired {month}/{year}; Loading saved cards;
Detected card: {brand}. Existing card brand/last-four text is combined into one line.

## Confirm rather than guess

- Whether removal and default-card selection will be added, and their eventual
  contracts. No controls are added for either feature.
- Which Part C candidates actually cause measurable movement, including scrollbar,
  location text, auth loading and title/action heights; no cause claimed yet.
- Licensed card logos are not present in the payment feature. Plain text brands
  and the existing generic card icon are used; any future assets need review.
- The Visa number already documented in README is shown; no new example is invented.
  Sandbox CVV/AVS rules may still affect verification.
- Browser checks of actual iframes, keyboard behavior, wrapping at mobile widths,
  modal scroll locking, and the two requested navigation measurement runs remain
  pending. Automated interaction tests stub SDK metadata and cannot prove geometry.
