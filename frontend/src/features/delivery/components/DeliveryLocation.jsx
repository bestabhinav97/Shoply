import { useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { useGuestLocation } from '../hooks/useGuestLocation';
import '../styles/delivery.css';

function LocationAttribution() {
  return <p className="delivery-attribution">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a>
    {' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p>;
}

export function DeliveryLocation({ user, authPending, authError }) {
  const location = useLocation();
  const navigate = useNavigate();
  const id = useId();
  const [openedByButton, setOpen] = useState(false);
  const guest = useGuestLocation();
  const open = openedByButton || (location.hash === '#delivery-location' && !guest.city);
  const busy = ['locating', 'resolving'].includes(guest.status);
  const next = `${location.pathname}${location.search}#delivery-location`;
  const description = authPending ? 'Loading your account…' : authError ? 'We couldn’t load your account. Refresh the page to try again.'
    : user ? "Choose where you'd like your orders delivered."
      : 'Use your device location to find your city, or sign in to see your saved addresses.';

  function close() {
    guest.cancel();
    setOpen(false);
    if (location.hash === '#delivery-location') {
      navigate(`${location.pathname}${location.search}`, { replace: true });
    }
  }

  function detect() {
    // Keep the confirmation open when a city resolves from a hash-opened dialog.
    setOpen(true);
    guest.detect();
  }

  return <div className="delivery-location">
    <button type="button" className="delivery-trigger" aria-haspopup="dialog" aria-expanded={open}
      disabled={authPending} onClick={() => setOpen(true)}>
      <Icon name="pin" />
      <span><span className="delivery-caption">{guest.city ? 'Delivery area' : 'Delivery location'}</span>{' '}
        <strong>{authPending ? 'Loading…' : authError ? 'Choose location' : guest.city || (user ? 'Choose an address' : 'Choose location')}</strong></span>
      <Icon name="chevron" />
    </button>
    <Modal open={open} onClose={close} labelledBy={`${id}-title`} describedBy={`${id}-description`}
      iconOnlyClose closeLabel="Close" className="delivery-modal">
      <div className="delivery-dialog">
        <header className="delivery-dialog-header">
          <span className="delivery-dialog-icon"><Icon name="pin" /></span>
          <h2 id={`${id}-title`}>Choose your delivery location</h2>
          <p id={`${id}-description`} role={authError ? 'alert' : undefined}>{description}</p>
        </header>
        {!authPending && !authError && <>
          <div className="delivery-feedback" aria-live="polite" aria-atomic="true">
            {busy && <p className="delivery-loading" role="status">Detecting your location...</p>}
            {guest.status === 'success' && <div className="delivery-success">
              <div className="delivery-city" role="status"><Icon name="check" /><strong>Delivering to {guest.city}</strong></div>
              <Button variant="primary" onClick={close}>Done</Button>
            </div>}
          </div>
          {guest.status !== 'success' && <>
            {user && <>
              {guest.city && <div className="delivery-city"><Icon name="check" /><span><strong>{guest.city}</strong><small>Current delivery city · not a saved address</small></span></div>}
              <section className="delivery-address-empty" aria-label="Saved addresses">
                <Icon name="pin" />
                <div><strong>No saved addresses yet</strong><p>Keep your delivery details together in your account.</p>
                  <span className="delivery-coming-soon" aria-disabled="true">Saved address selection · Coming soon</span></div>
              </section>
              <Link className="button primary" to="/account/addresses" onClick={close}>Add a delivery address</Link>
            </>}
            <Button variant={user ? 'secondary' : 'primary'} onClick={detect} loading={busy}>
              {!busy && <Icon name="locate" />}{busy ? 'Detecting your location...' : 'Use my current location'}
            </Button>
            {guest.error && <div className="delivery-error" role="alert">
              <Icon name="info" /><div><p>{guest.error}</p><Button variant="text" onClick={detect}>Try again</Button></div>
            </div>}
            <div className="delivery-privacy"><Icon name="shield" /><p>Your browser may ask for permission. We send your coordinates to Geoapify only to find your city. We keep only the city name for this browser tab, and it's not a delivery address.</p></div>
            {!user && <>
              <div className="delivery-divider">or</div>
              <Link className="button" to={`/login?next=${encodeURIComponent(next)}`} onClick={close}>Sign in to your account</Link>
            </>}
          </>}
          <LocationAttribution />
        </>}
      </div>
    </Modal>
  </div>;
}
