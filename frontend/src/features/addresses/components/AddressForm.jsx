import { useId, useRef, useState } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useAddressMutation } from '../hooks/useAddresses';
import { useAddressLookup } from '../hooks/useAddressLookup';

const fields = [
  { name: 'recipientName', label: 'Recipient name', autoComplete: 'shipping name', maxLength: 200 },
  { name: 'phoneNumber', label: 'Phone number', autoComplete: 'shipping tel', type: 'tel', maxLength: 40 },
  { name: 'addressLine1', label: 'Street and house number', autoComplete: 'shipping address-line1', maxLength: 200 },
  { name: 'addressLine2', label: 'Apartment or address line 2 (optional)', autoComplete: 'shipping address-line2', maxLength: 200 },
  { name: 'postalCode', label: 'Postcode', autoComplete: 'shipping postal-code', inputMode: 'numeric', maxLength: 6 },
  { name: 'city', label: 'City', autoComplete: 'shipping address-level2', maxLength: 100 },
];

export function AddressForm({ user, address, selectForDelivery = false, onSaved, onCancel }) {
  const id = useId();
  const form = useRef(null);
  const [localErrors, setLocalErrors] = useState({});
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(({ name }) => [name,
    address?.[name] ?? (name === 'recipientName' ? [user.firstName, user.lastName].filter(Boolean).join(' ')
      : name === 'phoneNumber' ? user.phoneNumber || '' : ''),
  ])));
  const [suggestion, setSuggestion] = useState(null);
  const [lookupNotice, setLookupNotice] = useState('');
  const lookup = useAddressLookup();
  const mutation = useAddressMutation(user.id, address ? 'update' : 'create');
  const errors = { ...mutation.error?.fields, ...localErrors };

  function applySuggestion(next) {
    setValues((previous) => ({ ...previous, ...next }));
    setSuggestion(null);
    setLocalErrors({});
    mutation.reset();
    setLookupNotice('Available location details filled in. Review the street, house number and postcode before saving. Missing fields still need to be completed.');
  }

  async function detectAddress() {
    setLookupNotice('');
    const next = await lookup.detect();
    if (!next) return;
    if (Object.entries(next).some(([field, value]) => values[field].trim() && values[field].trim() !== value)) setSuggestion(next);
    else applySuggestion(next);
  }

  async function submit(event) {
    event.preventDefault();
    if (lookup.busy || suggestion || mutation.isPending) return;
    mutation.reset();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = Object.fromEntries(fields.map(({ name }) => [name, values[name].trim()]));
    const nextErrors = {};
    for (const { name, maxLength } of fields) {
      if (name !== 'addressLine2' && !body[name]) nextErrors[name] = 'This field is required.';
      else if (body[name].length > maxLength || /[\p{Cc}\p{Cf}]/u.test(body[name])) nextErrors[name] = 'Enter a valid value within the field length limit.';
    }
    if (!/^\d{3}\s?\d{2}$/.test(body.postalCode)) nextErrors.postalCode = 'Enter a Swedish postcode, for example 254 38.';
    const phone = parsePhoneNumberFromString(body.phoneNumber, 'SE');
    if (!phone?.isValid()) nextErrors.phoneNumber = 'Enter a valid phone number, including a country code for numbers outside Sweden.';
    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      form.current.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    try {
      const details = {
        ...body, phoneNumber: phone.number, postalCode: body.postalCode.replace(/\s/g, ''),
        countryCode: 'SE',
      };
      await mutation.mutateAsync(address ? { id: address.id, ...details }
        : { ...details, isDefault: values.isDefault === 'on', selectForDelivery });
      onSaved();
    } catch { /* Mutation errors are rendered below; keep the user's input. */ }
  }

  return <form ref={form} className="address-form" aria-label={address ? 'Edit delivery address' : 'Add delivery address'} onSubmit={submit} noValidate>
    <p className="address-note">Delivery addresses in Sweden. Fields are required unless marked optional.</p>
    <div className="address-autofill">
      <Button onClick={detectAddress} loading={lookup.busy} disabled={mutation.isPending || Boolean(suggestion)}>
        {lookup.status === 'locating' ? 'Finding your location…' : lookup.status === 'resolving' ? 'Looking up your address…' : 'Use my current location'}
      </Button>
      <p className="address-note">Only after you click, your browser may ask for location permission. Coordinates go to Geoapify to suggest address details; nothing is saved automatically.</p>
      <p className="address-note">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>
      {lookup.busy && <p role="status">{lookup.status === 'locating' ? 'Finding your location…' : 'Looking up your address…'}</p>}
      {lookup.error && <p className="address-error" role="alert">{lookup.error}</p>}
      {lookupNotice && <p role="status" className="address-note">{lookupNotice}</p>}
      {suggestion && <div className="address-replace" role="group" aria-label="Replace address fields?">
        <strong>Replace existing address fields?</strong>
        <p className="address-note">{[suggestion.addressLine1, suggestion.postalCode, suggestion.city].filter(Boolean).join(', ')}</p>
        <p className="address-note">Only the available street, city and postcode will be filled. Recipient, phone and apartment details stay unchanged.</p>
        <div className="address-actions"><Button onClick={() => applySuggestion(suggestion)}>Replace address fields</Button>
          <Button onClick={() => setSuggestion(null)}>Keep my address</Button></div>
      </div>}
    </div>
    {mutation.error && <p role="alert" className="address-error">{mutation.error.status === 404
      ? address ? 'This address is no longer available. Your changes have not been saved.' : 'Address saving isn’t connected yet. Your details have not been saved.' : mutation.error.message}</p>}
    <fieldset disabled={mutation.isPending || lookup.busy || Boolean(suggestion)}>
      <legend className="sr-only">Delivery address details</legend>
      <div className="address-fields">{fields.map((field) => <div className="address-field" key={field.name}>
        <Input {...field} id={`${id}-${field.name}`} name={field.name}
          value={values[field.name]} onChange={(event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value }))}
          required={field.name !== 'addressLine2'} aria-invalid={Boolean(errors[field.name])}
          aria-describedby={errors[field.name] ? `${id}-${field.name}-error` : undefined} />
        {errors[field.name] && <span id={`${id}-${field.name}-error`} className="address-error">{errors[field.name]}</span>}
      </div>)}</div>
      <div className="address-field"><label htmlFor={`${id}-country`}>Country</label><select id={`${id}-country`} className="ui-select" name="countryCode" defaultValue="SE"><option value="SE">Sweden</option></select></div>
      {!address && <><label className="address-checkbox"><input type="checkbox" name="isDefault" />Make this my default address</label>
        <p className="address-note">Your first saved address automatically becomes the default.</p></>}

    </fieldset>
    <div className="address-actions">
      <Button variant="primary" type="submit" loading={mutation.isPending} disabled={lookup.busy || Boolean(suggestion)}>Save address</Button>
      <Button onClick={onCancel} disabled={mutation.isPending}>Cancel</Button>
    </div>
  </form>;
}
