import { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Modal } from '../../../components/ui/Modal';
import { useAddresses, useAddressMutation } from '../hooks/useAddresses';
import { AddressForm } from './AddressForm';
import '../styles/addresses.css';

function AddressDetails({ address }) {
  return <><p>{address.addressLine1}</p>{address.addressLine2 && <p>{address.addressLine2}</p>}
    <p>{address.postalCode} {address.city}</p><p>Sweden</p><p>Phone: {address.phoneNumber}</p></>;
}

export function AddressBook({ user, chooser = false, onSelected }) {
  const query = useAddresses(user.id);
  const selection = useAddressMutation(user.id, 'select');
  const defaultChange = useAddressMutation(user.id, 'default');
  const removal = useAddressMutation(user.id, 'delete');
  const id = useId();
  const addButton = useRef(null);
  const noticeElement = useRef(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [candidate, setCandidate] = useState('');
  const [notice, setNotice] = useState('');
  const data = query.data;
  const currentId = data?.selectedAddressId || data?.defaultAddressId;
  const busy = defaultChange.isPending || removal.isPending;

  function beginAdding() {
    setNotice('');
    defaultChange.reset();
    setAdding(true);
  }

  function finishAdding(saved) {
    setAdding(false);
    setEditing(null);
    if (saved) setNotice(editing ? 'Address updated.' : 'Address saved.');
  }

  async function useSelected(event) {
    event.preventDefault();
    try {
      await selection.mutateAsync(candidate || currentId);
      onSelected?.();
    } catch { /* Keep the chooser open and show the mutation error. */ }
  }

  async function makeDefault(addressId) {
    setNotice('');
    try {
      await defaultChange.mutateAsync(addressId);
      setNotice('Default address updated.');
      requestAnimationFrame(() => noticeElement.current?.focus());
    } catch { /* Keep the current default and show the server error. */ }
  }

  async function confirmRemoval() {
    try {
      await removal.mutateAsync(removing.id);
      setRemoving(null);
      setNotice('Address removed.');
      requestAnimationFrame(() => noticeElement.current?.focus());
    } catch { /* Keep the confirmation open so the customer can retry. */ }
  }

  return <section className="address-book" aria-label="Saved addresses">
    {chooser && <p className="address-note">Choose a saved address or add a new delivery address.</p>}
    {notice && !adding && !editing && <p ref={noticeElement} tabIndex={-1} role="status" className="address-notice">{notice}</p>}
    <Modal open={adding || Boolean(editing)} onClose={() => finishAdding(false)} label={editing ? 'Edit delivery address' : 'Add a delivery address'} className="address-edit-modal">
      <h2>{editing ? 'Edit delivery address' : 'Add a delivery address'}</h2>
      <AddressForm key={editing?.id || 'new'} user={user} address={editing} selectForDelivery={chooser} onSaved={() => finishAdding(true)} onCancel={() => finishAdding(false)} />
    </Modal>
    <>
      {query.isPending && <p role="status">Loading saved addresses…</p>}
      {query.error && <div className="address-load-error">
        <p role="alert">{query.error.status === 404 ? 'We couldn’t load saved addresses. You can still add an address.' : 'We couldn’t load your addresses. Please try again.'}</p>
        <Button onClick={() => query.refetch()} loading={query.isFetching}>Retry addresses</Button>
      </div>}
      {!chooser && <>
        {data?.items.length === 0 && <p className="address-note">No saved addresses yet. Add your first delivery address.</p>}
        <div className="address-grid">
          <button ref={addButton} type="button" className="address-add-tile" onClick={beginAdding} disabled={busy}>
            <Icon name="plus" /><span>Add address</span>
          </button>
          {data?.items.map((address) => <article className="address-grid-card" key={address.id} aria-label={`${address.recipientName}, ${address.city}`}>
            <div className="address-grid-details"><div className="address-recipient"><strong>{address.recipientName}</strong>
              {data.defaultAddressId === address.id && <span className="address-default-label">Default</span>}</div><AddressDetails address={address} /></div>
            <div className="address-grid-footer"><span className="address-delivery-status">{currentId === address.id ? <><Icon name="pin" />Delivering here</> : null}</span>
              <div className="address-card-actions">
                <Button variant="text" className="address-default-action" disabled={busy}
                  aria-label={`Edit ${address.addressLine1}, ${address.city}`} onClick={() => { setNotice(''); defaultChange.reset(); setEditing(address); }}>Edit</Button>
                <Button variant="text" className="address-default-action address-remove-action" disabled={busy}
                  aria-label={`Remove ${address.addressLine1}, ${address.city}`} onClick={() => { setNotice(''); defaultChange.reset(); removal.reset(); setRemoving(address); }}>Remove</Button>
              {data.defaultAddressId !== address.id && <Button variant="text" className="address-default-action"
                disabled={busy} loading={defaultChange.isPending && defaultChange.variables === address.id}
                onClick={() => makeDefault(address.id)} aria-label={`Set ${address.addressLine1}, ${address.city} as default`}>Set as default</Button>}
              </div>
            </div>
          </article>)}
        </div>
      </>}
      {chooser && data && <form onSubmit={useSelected}>
        {data.items.length === 0 ? <p className="address-empty">No saved addresses yet. Add your first delivery address.</p> : <fieldset className="address-list" disabled={selection.isPending}>
          <legend>{chooser ? 'Choose an address' : 'Your saved addresses'}</legend>
          {data.items.map((address) => <div className="address-card" key={address.id}>
            {chooser && <input type="radio" id={`${id}-${address.id}`} name="deliveryAddress" value={address.id}
              checked={(candidate || currentId) === address.id} onChange={() => { setCandidate(address.id); selection.reset(); }} />}
            <div>{chooser ? <label htmlFor={`${id}-${address.id}`}><strong>{address.recipientName}</strong></label> : <strong>{address.recipientName}</strong>}
              <AddressDetails address={address} />
              <div className="address-badges">{data.defaultAddressId === address.id && <span>Default</span>}{currentId === address.id && <span>Selected for delivery</span>}</div>
            </div>
          </div>)}
        </fieldset>}
        {chooser && data.items.length > 0 && <Button type="submit" variant="primary" loading={selection.isPending} disabled={!(candidate || currentId)}>Use this address</Button>}
      </form>}
      {(selection.error || defaultChange.error) && <p role="alert" className="address-error">{(selection.error || defaultChange.error).status === 404
        ? 'This address is no longer available. Refresh your addresses and try again.' : (selection.error || defaultChange.error).message}</p>}
      {chooser && <Button ref={addButton} onClick={beginAdding}>Add address</Button>}
    </>
    <Modal open={Boolean(removing)} onClose={() => { if (!removal.isPending) setRemoving(null); }} label="Remove address?" className="address-remove-modal">
      {removing && <div className="address-removal">
        <h2>Remove address?</h2>
        <div className="address-removal-details"><strong>{removing.recipientName}</strong><AddressDetails address={removing} /></div>
        <p>This address will be removed from your saved addresses.</p>
        {data?.defaultAddressId === removing.id && <p>Your oldest remaining address will become the default. If none remain, your address book will be empty.</p>}
        {data?.selectedAddressId === removing.id && <p>Your delivery selection will be cleared and will fall back to your default address.</p>}
        {removal.error && <p role="alert" className="address-error">{removal.error.status === 404 ? 'This address is no longer available. Refresh your addresses.' : removal.error.message}</p>}
        <div className="address-actions"><Button disabled={removal.isPending} onClick={() => setRemoving(null)}>Cancel</Button>
          <Button className="address-danger-button" loading={removal.isPending} onClick={confirmRemoval}>Remove address</Button></div>
      </div>}
    </Modal>
  </section>;
}
