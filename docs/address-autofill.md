# Address autofill: frontend and backend

The Add/Edit form has Use my current location, connected to the authenticated
full-address endpoint. Manual save/edit continues to use the existing address APIs.
Lookup only suggests fields; it never persists an address or changes preferences.

## Shared helper and separate lookup

`lib/getDeviceCoordinates.js` extracts the existing one-shot browser geolocation
request. Both header and form call it only after a click. It returns coordinates
and handles browser location errors without storing data or modifying forms.

The header keeps its existing city-only API and temporary browsing-city storage.
The form uses `useAddressLookup` and `addressLookup.api.js`: it needs several fields
and must not store or change the header city before the address is saved. Both
flows use timeouts and ignore late device/HTTP results after unmounting.

The existing locations module now exports `findAddress` alongside `findCity`.
Both share the private `requestGeocoding` helper for the provider URL, credentials,
eight-second timeout, redirect rejection, JSON parsing and safe errors. `findCity`
still requests `type=city` and returns only `{ city }`; `findAddress` omits type to
request full address details. Credentials stay on the server. No new table is needed.

## API contract

The route requires a signed-in session, validates Origin/CSRF and coordinates, and
shares the location limit of 10 requests per minute per IP with city lookup.
Responses use `Cache-Control: no-store`. The shared API client obtains the existing
CSRF token, then sends:

```http
POST /api/locations/reverse-address
Content-Type: application/json
X-CSRF-Token: <existing CSRF token>

{ "latitude": 56.05, "longitude": 12.69 }
```

Expected normalized response (illustrative values, not a saved address):

```json
{
  "address": {
    "addressLine1": "Testgatan 12",
    "city": "Helsingborg",
    "postalCode": "25438",
    "countryCode": "SE"
  }
}
```

Unavailable street/city/postcode fields are null; values are never invented.
The backend combines available street/house number into addressLine1 and
normalizes postcode syntax. Country must be known; both backend and frontend reject non-SE results.
Region/state is omitted because the current Swedish form/schema has no such field.
Recipient, phone, apartment line, preferences and account IDs are not returned.
Errors follow the existing `{ "message": "..." }` format: 400 for invalid
coordinates, 401 for no session, 403 for Origin/CSRF rejection, 422 for non-Sweden,
unknown country or no usable details, 429 for rate limiting, and 503 for missing
configuration/provider failures. No provider URLs or raw exceptions are exposed.

## Form behavior and verification

Inputs now use controlled React state. While lookup is pending, fields and Save
are disabled; Cancel is available. Errors leave manual entry usable. Lookup never
saves anything automatically or puts coordinates/suggestions in browser storage.

Only available street/city/postcode fields are merged. Before replacing any
nonempty different value, an inline confirmation previews the details and offers
Replace address fields or Keep my address. Missing results never erase values.
Recipient, phone and apartment fields are always preserved. The customer must
review the house number and remaining fields and deliberately press Save.

The form explains Geoapify processing and includes attribution. Tests mock lookup
responses and verify permission timing, payload/CSRF, successful and partial merges,
replacement choices, device failures, unavailable endpoint, country/response checks,
no automatic saves, and late-callback cleanup.

Backend tests verify the full-address request/mapping, partial results, country
restriction, missing key, provider failures, timeouts, authentication, CSRF/Origin,
strict coordinates, private response shape, and no database persistence.

## Live verification and local certificate trust

Real Geoapify requests using sample coordinates (56.05, 12.69) returned
`{ "address": { "addressLine1": "Sankt Jörgens plats 2", "city": "Helsingborg",
"postalCode": "25220", "countryCode": "SE" } }`. The existing city lookup also
returned Helsingborg. These were service checks with fixed sample coordinates;
the actual browser permission/device-location flow still needs manual verification.

The default Node process encountered `UNABLE_TO_VERIFY_LEAF_SIGNATURE` in this
environment. Node 24.11's `--use-system-ca` flag allowed certificate verification
using the machine's trusted roots; verification was not disabled. When this issue
occurs locally, start the backend with the same setting instead of the normal
backend command (stop the existing backend first):

```powershell
node --use-system-ca --watch backend/server.js
```

This command runs from the repository root on the installed Node 24 runtime. No
package scripts or global certificate settings were changed. See
[Geoapify's reverse geocoding reference](https://apidocs.geoapify.com/docs/geocoding/reverse-geocoding/)
for the source fields used in mapping.
