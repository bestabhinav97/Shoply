import { useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Modal } from '../../../components/ui/Modal';
import { AddCardForm } from './AddCardForm';
import { PaymentCardList } from './PaymentCardList';
import { RemoveCardDialog } from './RemoveCardDialog';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import '../styles/payments.css';

export function PaymentMethods() {
  const { data: user } = useAuth();
  return <PaymentMethodsContent key={user?.id || 'guest'} user={user} />;
}

function PaymentMethodsContent({ user }) {
  const addButton = useRef(null);
  const { data: cards = [], isPending, error, refetch, isFetching } = usePaymentMethods(user?.id);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [removing, setRemoving] = useState(null);

  return <div className="payment-methods">
    <header className="payment-heading">
      <div className="payment-title">
        <h1>Payment methods</h1>
        <span className="payment-sandbox-pill">Sandbox</span>
      </div>
      <Button ref={addButton} variant="primary" disabled={!user} onClick={() => { setNotice(''); setOpen(true); }}>
        <Icon name="plus" />Add a card
      </Button>
    </header>

    <p className="payment-notice" role="status" aria-live="polite">{notice}</p>
    {error && <div className="payment-list-error">
      <p role="alert">Couldn’t load your saved cards. Please try again.</p>
      <Button loading={isFetching} onClick={() => refetch()}>Try again</Button>
    </div>}
    {(!error || cards.length > 0) && <PaymentCardList cards={cards} loading={isPending}
      onRemove={(card) => { setNotice(''); setRemoving(card); }} />}
    <p className="payment-mode-note">Sandbox mode: test cards only.</p>

    <Modal open={open} onClose={() => setOpen(false)} dismissible={!saving} className="payment-modal" label="Add a card" describedBy="payment-dialog-description">
      {open && <AddCardForm key={user?.id} userId={user?.id} onClose={() => setOpen(false)} onSavingChange={setSaving}
        onSaved={(card) => { setNotice(`${card.brand} ending in ${card.last4} added`); setOpen(false); }} />}
    </Modal>
    {removing && <RemoveCardDialog card={removing} userId={user?.id} onClose={() => setRemoving(null)}
      onRemoved={() => { setNotice(`${removing.brand} ending in ${removing.last4} removed`); setRemoving(null); addButton.current?.focus(); }} />}
  </div>;
}
