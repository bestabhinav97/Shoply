import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useRemovePaymentMethod } from '../hooks/usePaymentMethods';

export function RemoveCardDialog({ card, userId, onClose, onRemoved }) {
  const removal = useRemovePaymentMethod(userId);
  const client = useQueryClient();
  const submitting = useRef(false);

  async function confirmRemoval() {
    if (submitting.current || client.getQueryData(['auth', 'user'])?.id !== userId) return;
    submitting.current = true;
    try {
      await removal.mutateAsync(card.token);
      if (client.getQueryData(['auth', 'user'])?.id === userId) onRemoved();
    } catch {
      // Show local, safe feedback. A failed response may follow a successful deletion.
    } finally {
      submitting.current = false;
    }
  }

  return <Modal open onClose={onClose} dismissible={!removal.isPending}
    className="payment-modal" label="Remove saved card" describedBy="remove-card-description">
    <div className="payment-add-dialog">
      <h2>Remove saved card?</h2>
      <p id="remove-card-description" className="payment-dialog-description">
        Remove {card.brand} ending in {card.last4} from your saved payment methods? You can add it again later.
      </p>
      <div className="payment-form-feedback">
        {removal.isError && <p role="alert">{removal.error.status === 401
          ? 'Your session expired. Sign in again to remove this card.'
          : 'Could not confirm removal. Your card may already have been removed. Refresh the list or try again.'}</p>}
      </div>
      <div className="payment-form-actions">
        <Button variant="ghost" disabled={removal.isPending} onClick={onClose}>Cancel</Button>
        <Button className="payment-remove-confirm" loading={removal.isPending} onClick={confirmRemoval}>
          {removal.isPending ? 'Removing...' : 'Remove card'}
        </Button>
      </div>
    </div>
  </Modal>;
}
