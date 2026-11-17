# Delivery location: learning guide

The frontend header and popup are implemented. The backend has coordinate
validation, a route mounted at `/api/locations`, and a controller calling the
Geoapify service for a city. It allows guests, enforces Origin/CSRF checks,
limits lookups to 10 per minute per IP, and sets `Cache-Control: no-store`.
The Geoapify key is loaded through backend configuration. Database tables and
saved address forms are not implemented; city lookup does not need a database.

## Block 1: Header composition

`frontend/src/components/layout/storefront/Header.jsx` imports `DeliveryLocation`
through the delivery feature's public `index.js`. It passes the existing auth
query's user/loading/error state; there is no duplicate account API. A key based
on the user ID resets the popup and cancels guest requests when accounts change.

The header grid places the control beside the wordmark on desktop and below
search on tablet/mobile. All styling uses the existing tokens. The shared Modal
accepts optional className, labelledBy, describedBy, and iconOnlyClose props so
this popup can have its own presentation without changing the product gallery.
Native dialog provides focus containment and Escape handling. The shared modal
also locks body scrolling, sets initial focus, restores trigger focus, and checks
backdrop click coordinates so clicking dialog padding does not dismiss it.

## Block 2: Popup and routing

`features/delivery/components/DeliveryLocation.jsx` owns open/closed UI state.
Guests get explicit location and sign-in actions. No location permission is
requested on mount or simply opening the popup. Both guests and signed-in customers
can detect their city, retry inline errors, and confirm success with Done. Loading
is announced and the location button is disabled while a request runs.

Signed-in customers see their temporary city, if present, as browsing context,
plus an honest saved-address empty state and a disabled Coming soon badge.
There is no saved-address API, list, selection, or form yet. The Add a delivery
address action retains the existing `/account/addresses` route; that page is still
an empty placeholder. The empty-state illustration uses the existing pin icon.
No fictional addresses or client-side address persistence were introduced.

The login link uses the existing `next` query parameter, preserving the current
path and query and adding `#delivery-location`. After login, that fragment opens
the chooser unless a city is already stored for this tab. The header selector
always allows deliberate reopening. Closing the chooser removes the fragment
without adding a history entry. No custom authentication flow was introduced.

The dialog is capped at 440px with a compact icon close control, soft pin badge,
readable shield/privacy note, and linked provider attribution. Below 480px it
becomes a scrollable bottom sheet. Touch close targets expand to 44px, and the
180ms entrance animation only runs when reduced motion is not requested.

## Block 3: Device location and temporary state

`features/delivery/hooks/useGuestLocation.js` requests a single device position.
It handles permission denial, unsupported devices, unavailable positions, and
timeouts. The device supplies coordinates, not a city or a postal address.

The hook passes coordinates to the API module, then keeps the returned city in
React state and `sessionStorage` under `shoply.guest-city`. Coordinates are not
stored. Storage failure does not prevent an in-memory result. This is temporary
guest browsing context, not authoritative checkout data or an account address.

Closing the dialog or changing users aborts pending HTTP work and ignores late
device callbacks. City lookup has a 15-second HTTP timeout after device lookup.
Use HTTPS in production; localhost supports local development. Location access
also depends on browser/OS permission and device capabilities.

## Block 4: Backend boundary

`features/delivery/api/delivery.api.js` calls the shared `apiClient`:

```http
POST /api/locations/reverse-geocode
Content-Type: application/json
X-CSRF-Token: <existing CSRF token>

{ "latitude": 56.05, "longitude": 12.69 }
```

Expected successful response:

```json
{ "city": "Helsingborg" }
```

Errors use the existing `{ "message": "..." }` format. Invalid input returns 400;
invalid Origin/CSRF returns 403; no usable city returns 422; rate limiting returns
429; a missing key, failed provider request, or malformed provider response returns
503. No fictional fallback city is used.

The shared client first calls `GET /api/auth/csrf` and then sends the POST with
cookies and the CSRF header. The endpoint validates coordinate ranges, enforces
Origin/CSRF checks, and rate-limits requests. It uses `Cache-Control: no-store`.
Provider credentials stay on the server; raw coordinates and provider URLs are
not logged.

## Block 5: Controller and service

`backend/modules/locations/location.controller.js` validates `req.body`, awaits
`findCity(coordinates)`, and sends the result using `res.json`. Express 5 forwards
rejected async controller calls to the existing centralized error handler. That
handler now preserves intentional server-error statuses such as 503 while keeping
unexpected 500 responses generic.

`backend/modules/locations/location.service.js` reads `env.geoapifyApiKey`. If it
is missing, it throws a safe 503 error without calling the provider. Otherwise it
builds a URL with `URLSearchParams` containing `lat`, `lon`, `apiKey`, `type=city`,
`format=geojson`, `lang=sv`, and `limit=1`. Native Node fetch sends a GET with an
eight-second timeout, including reading the response body; redirects are rejected.

After parsing JSON, the service extracts `features[0].properties.city`. Empty,
missing, overly long, or control-character-containing city values are rejected.
It returns only `{ city }`, not the full address or coordinates. Provider/network
errors become safe 503 messages so exceptions cannot expose the API-key URL.
The popup discloses Geoapify processing and links to Geoapify/OpenStreetMap attribution.

No database is required to translate coordinates into a city. Address storage
is a later, separate sequence:
schema/migration, repository, service and ownership rules, authenticated routes,
then frontend integration. We will review those blocks as they are implemented.

## Verification

`frontend/tests/delivery.test.jsx` checks deliberate permission requests, the API
body/CSRF contract, permission denial, the missing-endpoint state, cancellation,
temporary city persistence, and the signed-in return/addresses link. It also
covers success/Done, signed-in city lookup, network retry, accessible dialog
description, initial/restored focus, scroll locking, backdrop dismissal, and
suppression of automatic reopening after a city is chosen.
Backend location tests mock the provider and cover the outbound request, successful
city extraction, missing key, timeouts, provider errors, missing city, and the
connected API's guest/validation/CSRF behavior without consuming API quota.
Real browser permission prompts and device accuracy still require a device check.

Live verification through the running Vite `/api` proxy succeeded using sample
coordinates (56.05, 12.69): the guest POST returned 200 with
`{ "city": "Helsingborg" }` from the real Geoapify service. Invalid latitude
returned 400, and a request without CSRF protection returned 403. No actual device
location was used for this check. Browser automation was unavailable in the
session, so the native permission prompt and rendered layout were not verified.
