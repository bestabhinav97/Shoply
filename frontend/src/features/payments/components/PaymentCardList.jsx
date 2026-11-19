import { CardBrandIcon } from './CardBrandIcon';
import { Button } from '../../../components/ui/Button';

export function PaymentCardList({ cards, loading = false, onRemove }) {
  if (loading) return <div role="status" aria-label="Loading saved cards" className="payment-card-list">
    {[0, 1].map((key) => <div key={key} className="payment-card payment-card-skeleton" aria-hidden="true"><span /><div><span /><span /></div></div>)}
  </div>;

  if (!cards.length) return <div className="payment-empty">
    <h2>No saved cards</h2>
    <p>Add a test card to see it here.</p>
  </div>;

  const now = new Date();
  return <ul className="payment-card-list" aria-label="Saved cards">
    {cards.map((card) => {
      const expired = Number(card.expirationYear) < now.getFullYear()
        || (Number(card.expirationYear) === now.getFullYear() && Number(card.expirationMonth) < now.getMonth() + 1);
      return <li className="payment-card" key={card.token}>
        <CardBrandIcon brand={card.brand} />
        <div className="payment-card-details">
          <h2>{card.brand} ending in {card.last4}</h2>
          <p className={expired ? 'payment-card-expired' : undefined}>{expired ? 'Expired' : 'Expires'} {card.expirationMonth}/{card.expirationYear}</p>
        </div>
        {onRemove && <Button variant="text" className="payment-card-remove"
          aria-label={`Remove ${card.brand} ending in ${card.last4}`} onClick={() => onRemove(card)}>Remove</Button>}
      </li>;
    })}
  </ul>;
}
