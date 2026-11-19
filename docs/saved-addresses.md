# Saved addresses: implementation and API contract

The signed-in header popup and Account → Addresses use the same `AddressBook`
and `AddressForm` components. POST is connected to validation and transactional
PostgreSQL persistence, returning 201 and the updated address book. GET loads the
saved book after refresh. PATCH selects an existing owned address while preserving
the default. No address details are saved in cookies or browser storage.

## Frontend blocks

- `features/addresses/api/addresses.api.js`: calls the single shared API client.
- `features/addresses/hooks/useAddresses.js`: TanStack Query owns the server data,
  keyed by user ID. Mutations cancel an in-flight read and replace the cache only
  after server success, and only if the same account is still signed in.
- `features/addresses/components/AddressForm.jsx`: prefills recipient/phone from
  the account, collects local form input, validates it, normalizes the postcode
  and phone number, and calls the create mutation. Server field errors are displayed;
  failed saves retain input. No frontend validation replaces backend validation.
- `features/addresses/components/AddressBook.jsx`: loading, empty, error/retry,
  address cards, add/cancel/success, and radio selection in the header chooser.
- `features/addresses/components/AccountAddresses.jsx`: composes the account page.
  The account book uses a responsive card grid with a dashed Add address tile,
  equal-height saved-address cards, a default strip, and a selected-delivery marker.
  The header chooser retains compact radio cards. Set as default appears on
  non-default account cards. Edit reuses the prefilled form; Remove opens a
  confirmation dialog with the address and applicable fallback rules.
- `features/delivery/components/DeliveryLocation.jsx`: shows a selected saved
  address's city ahead of the temporary browsing city. Guests never fetch addresses.

## Backend endpoints

All six endpoints require the existing authenticated cookie. POST/PATCH/DELETE use the
existing CSRF token and Origin checks. Return `Cache-Control: no-store` and enforce
ownership on the server. User IDs and roles are not supplied by the client.

### GET /api/addresses

No request body. Response 200 is an address-book snapshot:

```json
{
  "items": [
    {
      "id": "6fe9fd8a-5118-4e1b-b223-2f986e865c30",
      "recipientName": "Ada Test",
      "phoneNumber": "+46701234567",
      "addressLine1": "Testgatan 12",
      "addressLine2": "",
      "postalCode": "25438",
      "city": "Helsingborg",
      "countryCode": "SE"
    }
  ],
  "defaultAddressId": "6fe9fd8a-5118-4e1b-b223-2f986e865c30",
  "selectedAddressId": "6fe9fd8a-5118-4e1b-b223-2f986e865c30"
}
```

An empty book returns `{ "items": [], "defaultAddressId": null, "selectedAddressId": null }`.
When selection is null, the frontend falls back to the default address for display.
The returned items must all belong to the signed-in user; IDs are stable UUIDs.

### POST /api/addresses

The Add address form sends:

```json
{
  "recipientName": "Ada Test",
  "phoneNumber": "+46701234567",
  "addressLine1": "Testgatan 12",
  "addressLine2": "",
  "postalCode": "25438",
  "city": "Helsingborg",
  "countryCode": "SE",
  "isDefault": false,
  "selectForDelivery": true
}
```

`selectForDelivery` is true from the header chooser and false from the account page.
`isDefault` comes from the form checkbox. Both are commands; they are not stored as
fields on the response item. The first saved address automatically becomes the
default regardless of the checkbox. A subsequent account-page save must preserve
an existing selected address. Changing the default must not overwrite an explicit
delivery selection. Create and default/selection updates must be one transaction.

Response 201 returns the complete updated snapshot, with the same shape as GET.
This lets both the header and the account page update from the server's result.

### PATCH /api/addresses/selected

The chooser's Use this address button sends:

```json
{ "addressId": "6fe9fd8a-5118-4e1b-b223-2f986e865c30" }
```

Response 200 returns the updated snapshot. This changes delivery selection only,
and does not change the default. The header changes after server confirmation.

### Errors and limits

Use the established error format, for example:

```json
{
  "message": "Please check your address.",
  "fields": { "postalCode": "Enter a valid Swedish postcode." }
}
```

Proposed backend rules: 400 for validation, 401 for no session, 403 for failed CSRF,
404 for an inaccessible address ID, 409 for a per-user address limit. Validate
string lengths (recipient/street/line 2: 200, city: 100), reject control characters,
enforce Sweden as the delivery country, validate five-digit postcode syntax,
and normalize a valid recipient phone to E.164. Format validation cannot prove an
address is deliverable. Never call Geoapify automatically to save a manual address.

## Database block

Migration `006_addresses.sql` adds `addresses` and `user_address_preferences`.
Each address belongs to a user. The unique `(user_id, id)` index both supports
address-book reads and lets composite foreign keys enforce preference ownership.
Preferences have one row per user, with nullable `default_address_id` and
`selected_address_id`. Deleting an address clears only the corresponding ID;
deleting a user cascades to their addresses and preferences. Column-specific
`ON DELETE SET NULL` uses the project's PostgreSQL 18 setup.

The schema enforces required text, length limits, five-digit postcodes, phone
format, and Sweden as country. It does not prove address deliverability or phone
ownership. UUIDs are supplied by the application, following existing modules.
Timestamps default to now; the future repository must update `updated_at` on writes.

The service creates preferences as needed and enforces the first-address
default rule transactionally. The schema permits null preferences and does not
automatically choose a new default when one is deleted. The repository now has
customer locking, address insertion, listing, and preference read/write helpers.
The transactional add-address service is connected to the POST controller.

## POST route wiring block

`app.js` now mounts `address.routes.js` at `/api/addresses`. POST `/` runs
authentication, Origin/CSRF protection, and a 20-per-minute per-IP write limit,
then calls `address.controller.js`. Responses use `Cache-Control: no-store`.
The async controller validates `req.body`, obtains the user ID from
`req.auth.user.id`, awaits `addAddress(userId, address)`, and returns 201 with its
result. The service commits before returning, so success means the data is saved.
Express forwards validation/service errors to the centralized error handler.
GET and PATCH are also connected.

## Backend validation block

`address.validation.js` exports `validateCreateAddress(body)`. A strict Zod schema
requires the agreed fields and real booleans, rejects extra fields (including
client-supplied ownership), and defaults an omitted second address line to an empty
string. Text is checked for Unicode control/format characters before trimming,
then checked for required content and maximum length. Country must be `SE`.

Postcodes accept five digits with an optional space after the first three and are
normalized to five digits. Phone parsing uses Swedish defaults and disables
fragment extraction; valid international numbers are normalized to E.164 and must
fit the database phone format. These checks do not verify deliverability or phone
ownership. Invalid requests return 400 with `message` and field-specific `fields`.
The returned normalized object is passed to the service by the controller.

`addresses.validation.test.js` covers normalization, field boundaries, missing or
invalid fields, strict boolean types, control characters, phone/postcode errors,
unexpected fields and malformed bodies. The route test verifies invalid input
returns 400 while valid input is persisted and returns 201 with the updated book.

`backend/tests/addresses.schema.test.js` checks the migration in an isolated schema:
multiple addresses, separate default/selection, ownership and field constraints,
deletion behavior, and safe migration reruns.

## Next learning steps

Add/list/select/default/edit/remove are implemented. Location-based form autofill
is connected to the authenticated lookup endpoint. See the
[autofill contract](address-autofill.md). Continue one approved block at a time.

## Repository block: lock and insert

The first repository block added two functions:

- `lockUser(client, userId)` selects the customer ID with `FOR UPDATE`, returning
  `{ id }`, or undefined if the user no longer exists. The future service must
  begin a transaction before calling it, use this same connection for all related
  reads/writes, and check that the user exists. Competing address writes must follow
  the same lock-first protocol.
- `insertAddress(client, userId, address)` generates a UUID and inserts the
  validated address using `$1` through `$9` parameters. It returns the database row
  in snake_case, including timestamps. Ownership uses the separate `userId`
  argument, never an ID inside the address object. The service will later map the
  result to the frontend API shape.

Neither of these functions starts or commits a transaction, changes preferences, or handles
HTTP responses. `isDefault` and `selectForDelivery` are service commands and are
not persisted as address columns. The controller now passes validated input and
the session user ID to the service.

`addresses.repository.test.js` exercises a real isolated database schema. It
checks persisted fields/ownership, rollback, missing users, and two independent
connections contending for one customer row. A short database lock timeout proves
the second connection is blocked, while another customer's lock remains available.
After commit, the same customer row can be locked by the second connection.

## Repository block: preferences

`getPreferences(client, userId)` reads that customer's preferences row and returns
the database row in snake_case, or undefined if no row exists. It does not create
preferences or decide which address should be default.

`savePreferences(client, userId, { defaultAddressId, selectedAddressId })` uses
parameterized `INSERT ... ON CONFLICT (user_id) DO UPDATE ... RETURNING *` to
create or update the single preferences row. It returns the saved row, preserves
`created_at`, and updates `updated_at` on a change. Pass both IDs as the complete
desired preference state; null explicitly clears a reference. This is not a
partial-update helper. The service must preserve the existing ID when it does not
intend to change that choice, and apply the lock-first transaction protocol.

Both helpers use the supplied database connection without committing. Existing
composite foreign keys reject references to another user's address. Tests cover
missing preferences, insert/update, customer isolation, invalid references, and
transaction rollback for new and existing preferences. No HTTP behavior or default
selection business rules were added in the preferences-helper block alone; the
later service/controller blocks now complete the POST operation.

## Repository and service block: complete add-address transaction

`listAddresses(client, userId)` selects only that customer's rows, ordered by
`created_at, id` for a stable result. The repository returns database column names.

`addAddress(userId, address)` in `address.service.js` expects a session user ID
and a validated, normalized address. It obtains one pool connection and begins a
transaction, locks the customer row, rejects a missing customer with 401, and
checks a 20-address limit under that lock (409 when full). It then reads existing
preferences, inserts the address, and saves the next preferences:

- When no default exists or `isDefault` is true, use the new ID as default.
- When `selectForDelivery` is true, use the new ID as the selected delivery address.
- Otherwise preserve each existing choice; missing selection remains null.

The service reads the updated address list on the same connection and maps it to
the agreed `{ items, defaultAddressId, selectedAddressId }` camelCase API shape,
without exposing user IDs or internal timestamps. It commits before returning.
Any failure rolls back both the insertion and preferences; finally releases the
connection. Concurrent saves must follow the same customer lock protocol.

`addresses.service.test.js` verifies default/selection rules, customer isolation,
a forced preference-write failure rolling back the inserted address, simultaneous
first saves, concurrent saves at the limit, and missing customers.

## Controller integration block

The POST controller now validates, awaits the transactional service with the session
user ID, and returns 201. `addresses.routes.test.js` verifies authenticated saves,
normalized persisted data, private response shape, default/selection behavior,
separation between customers, and authentication/CSRF/validation rejection without
insertion. Tests use an isolated PostgreSQL schema; no sample customer addresses
are written to the application database. The frontend no longer labels saving as
unavailable; a failed GET still offers Add address.

## GET integration block

`GET /api/addresses` now runs authentication and a separate read limit of 60 per
minute per IP, then calls `controller.read`. GET requires the existing session
cookie but no CSRF header. Responses retain `Cache-Control: no-store`.

The controller passes only `req.auth.user.id` to `getAddressBook`. The service uses
the existing list and preference repository functions and the same response mapper
as POST. A missing preference row produces null default/selected IDs; reading never
creates a row or changes preferences. The service uses a read-only, repeatable-read
transaction so both queries see one consistent snapshot during concurrent saves;
it does not acquire the customer write lock. Connections are released in finally.

Tests verify guests receive 401, an empty book returns 200 without inserting
preferences, saved addresses reload with exactly the POST response shape, and
customers cannot read another customer's book by supplying a user ID in the URL.
Repeated GET requests leave preferences, including timestamps, unchanged.

## PATCH selection integration block

`PATCH /api/addresses/selected` requires authentication and Origin/CSRF protection
and shares the POST write limiter. `validateSelectedAddress` accepts exactly one
UUID `addressId`, normalizing its casing. Extra fields such as `userId` or
`isDefault` are rejected with 400. The controller passes the session user ID and
validated address ID to `selectDeliveryAddress`.

The service starts a transaction and locks the customer, then reads only their
addresses. Missing and foreign address IDs both produce the same 404. It preserves
the existing default reference, changes the selected reference, and commits before
returning the complete book. Address details are not modified. Any failure rolls
back; the connection is released in finally. This uses existing repository helpers.

Tests cover authentication, CSRF/Origin, malformed IDs/extra fields, ownership,
persisted selection, unchanged defaults and address data, repeated selection,
rollback, and a concurrent add/selection without lost changes. The existing
frontend Use this address action calls this endpoint and updates its query cache
and header only after the server succeeds.

## Default address: frontend and backend

Account cards offer Set as default on each non-default address. The frontend calls
`PATCH /api/addresses/default` with `{ "addressId": "<uuid>" }`. The shared API
client includes session cookies and the CSRF header. While pending, other default
actions and Add address are disabled. The UI waits for success before moving the
Default label, announces success and focuses the notice. Errors preserve the prior
default and allow retry. No optimistic preference changes are made.

The route enforces authentication, Origin/CSRF, and the shared address write limit.
The controller reuses the strict UUID request schema. `setDefaultAddress` and
`selectDeliveryAddress` now call one private transactional helper with an explicit
preference name. It locks the customer before ownership and preference reads,
returns the same 404 for missing/foreign IDs, and changes only the requested
reference. Default updates preserve an explicit selected address or null selection.
It commits and returns 200 with the same book shape, or rolls back on failure.

Service/API tests cover ownership, authentication, Origin/CSRF, validation,
persisted defaults, unchanged selection/address details, repeated requests,
rollback, and concurrent default/selection updates. Frontend tests verify the
request body and credentials, pending state, confirmed label updates, and recovery
after a failed default update. Browser visual verification was not performed in
this block.

## Editing an existing address

The account card Edit action opens the shared form populated from the saved
address, including recipient/phone and optional address line 2. It omits the
create-only preference checkbox. Cancel sends no write; failed saves retain
entered values and permit retry. The request is:

```http
PATCH /api/addresses/:addressId
Content-Type: application/json
X-CSRF-Token: <existing CSRF token>
```

```json
{
  "recipientName": "Ada Test",
  "phoneNumber": "+46701234567",
  "addressLine1": "Testgatan 12",
  "addressLine2": "Apartment 4",
  "postalCode": "25438",
  "city": "Helsingborg",
  "countryCode": "SE"
}
```

The request contains the complete editable details, not an arbitrary partial
object. An omitted optional second line normalizes to an empty string. The strict
schema reuses create validation while rejecting ownership and preference commands.
The URL UUID is validated/normalized separately. The service begins a transaction,
locks the customer, and runs an UPDATE scoped by both user ID and address ID.
Missing/foreign addresses receive the same 404. It preserves ID, creation time,
default, and selection; updates address details and `updated_at`; and returns 200
with the updated book after commit. Editing the selected address's city updates
the shared header cache on success.

## Removing an address

The account card Remove action opens a native modal naming the address. No DELETE
is sent before explicit confirmation. Cancel/close dismiss it; pending confirmation
disables repeat removal, and failure keeps the card and confirmation available for
retry. The request is:

```http
DELETE /api/addresses/:addressId
Content-Type: application/json
X-CSRF-Token: <existing CSRF token>

{}
```

After authentication, CSRF, rate limiting and UUID validation, the service locks
the customer and reads preferences before deleting (foreign keys clear references
on delete). DELETE is scoped by both customer and address ID. The service then
reads remaining addresses and repairs preferences in the same transaction:

- Deleted default: choose the oldest remaining address, ordered by creation time
  then ID, or null when none remain.
- Deleted explicit selection: set selection to null; the frontend uses the default.
- Unaffected default/selection: preserve them.
- Last address removed: return empty items and both references null.

Response 200 returns the updated book. Any failure rolls back deletion and
preference updates together. API/service tests cover ownership, validation,
persisted edits, deletion cases, a forced post-deletion failure, and simultaneous
edit/delete. Frontend tests cover prefilled values, stable references, header
updates, cancellation, delayed confirmation, failed writes/retry, and empty state.
Location lookup/autofill is described in [address-autofill.md](address-autofill.md).

## Account layout adjustment

All account tabs now use the same outer `.account-content` wrapper. Profile keeps
its own cards; other tabs use an inner `.account-panel`. Account pages reserve a
stable scrollbar gutter so switching between long and short tabs does not move
the centered container horizontally.
