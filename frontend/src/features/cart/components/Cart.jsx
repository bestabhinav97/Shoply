import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart, useCartMutation } from '../hooks/useCart';
import { Button } from '../../../components/ui/Button';
import { QuantityStepper } from '../../../components/ui/QuantityStepper';
import { ProductImage } from '../../../components/ui/ProductImage';
import { Toast } from '../../../components/ui/Toast';
import { Badge } from '../../../components/ui/Badge';
import { Icon } from '../../../components/ui/Icon';
import { formatCurrency } from '../../../utils/formatCurrency';

function CartItem({ item, busy, onUpdate, onRemove }) {
  const [draft, setDraft] = useState({ value: String(item.quantity), saved: item.quantity });
  if (draft.saved !== item.quantity) setDraft({ value: String(item.quantity), saved: item.quantity });
  const quantity = draft.saved === item.quantity ? draft.value : String(item.quantity);
  const setQuantity = (value) => setDraft({ value, saved: item.quantity });
  useEffect(() => {
    const next = Number(quantity);
    if (busy || !/^\d+$/.test(quantity) || !Number.isInteger(next) || next < 1 || next > 99 || next === item.quantity) return;
    const timer = setTimeout(() => onUpdate({ id: item.id, quantity: next }), 450);
    return () => clearTimeout(timer);
  }, [quantity, item.id, item.quantity, busy, onUpdate]);
  return <li className="cart-item">
    <Link className="cart-thumbnail" to={`/products/${item.productId}`} aria-label={`View ${item.name}`}><ProductImage image={item.image} name={item.name} /></Link>
    <div className="cart-item-information">
      <Link className="cart-product-name" to={`/products/${item.productId}`}><h2>{item.name}</h2></Link>
      {item.options && <p>{item.options}</p>}
      <p className="cart-unit-price">{formatCurrency(item.priceMinor)} each</p>
      <p className="cart-sku">SKU: {item.sku}</p>
      {!item.available && <p className="field-error">This quantity is no longer available. Reduce it or remove the item.</p>}
      <div className="cart-item-actions">
        <QuantityStepper value={quantity} onChange={setQuantity} disabled={busy} />
        <Button variant="ghost" size="sm" className="remove-item" disabled={busy} onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`}><Icon name="trash" />Remove</Button>
      </div>
    </div>
    <strong className="cart-line-total">{formatCurrency(item.lineTotalMinor)}</strong>
  </li>;
}

export function Cart() {
  const cart = useCart();
  const update = useCartMutation('update');
  const remove = useCartMutation('remove');
  const restore = useCartMutation('add');
  const busy = update.isPending || remove.isPending || restore.isPending;
  const error = update.error || remove.error || restore.error;
  const [notice, setNotice] = useState(null);
  const [checkoutInfo, setCheckoutInfo] = useState(false);
  function change(mutation, body, message, removedItem = null) {
    const previousNotice = notice;
    update.reset(); remove.reset(); restore.reset(); setNotice(null);
    mutation.mutate(body, {
      onSuccess: () => setNotice({ message, removedItem }),
      onError: () => { if (mutation === restore) setNotice(previousNotice); },
    });
  }
  const count = cart.data?.itemCount;
  return <>
    <header className="cart-page-heading"><div><span className="section-kicker">YOUR EVERYDAY FINDS</span><h1>Your cart</h1></div>
      {count !== undefined && <Badge>{count} {count === 1 ? 'item' : 'items'}</Badge>}
    </header>
    {cart.isPending ? <div role="status" aria-label="Loading cart" className="cart-layout"><span className="sr-only">Loading cart…</span><div className="skeleton-block cart-skeleton" /><div className="skeleton-block cart-skeleton" /></div>
      : cart.isError && !cart.data ? <Toast tone="error"><p>{cart.error.message}</p><Button onClick={() => cart.refetch()}>Retry cart</Button></Toast>
      : cart.data && <>
        {error && <Toast tone="error">{error.message} Your last change could not be saved.</Toast>}
        {cart.isError && <Toast tone="error">We couldn’t refresh your cart. <Button onClick={() => cart.refetch()}>Retry cart</Button></Toast>}
        {notice && <Toast><span>{notice.message}</span>{notice.removedItem && <Button size="sm" disabled={busy} onClick={() => change(restore,
          { variantId: notice.removedItem.variantId, quantity: notice.removedItem.quantity }, 'Item restored to your cart.')}>Undo</Button>}</Toast>}
        {busy && <p className="cart-saving" role="status"><span className="spinner" aria-hidden="true" />Saving your cart…</p>}
        {cart.data.items.length ? <div className="cart-layout">
          <section aria-label="Your selected items" className="cart-line-items">
            <ul className="cart-items" aria-label="Cart items" aria-busy={busy}>
              {cart.data.items.map((item) => <CartItem key={item.id} item={item} busy={busy}
                onUpdate={(body) => change(update, body, 'Cart quantity updated.')}
                onRemove={(removedItem) => change(remove, { id: removedItem.id }, 'Item removed from your cart.', removedItem)} />)}
            </ul>
            <p className="cart-stock-note"><Icon name="shield" />Items are saved, but stock is not reserved.</p>
          </section>
          <aside className="cart-summary" aria-labelledby="order-summary-heading">
            <h2 id="order-summary-heading">Order summary</h2>
            <dl><div><dt>Subtotal ({count} {count === 1 ? 'item' : 'items'})</dt><dd>{formatCurrency(cart.data.subtotalMinor)}</dd></div>
              <div><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
              <div className="cart-total"><dt>Total<span>Before delivery</span></dt><dd><strong>{formatCurrency(cart.data.subtotalMinor)}</strong></dd></div></dl>
            <Button variant="primary" size="lg" className="checkout-button" aria-describedby="checkout-note" aria-expanded={checkoutInfo}
              onClick={() => setCheckoutInfo(!checkoutInfo)}>Checkout <span className="checkout-badge">Coming soon</span></Button>
            <p id="checkout-note" className="checkout-note">Demo store · No payment will be taken.</p>
            {checkoutInfo && <Toast>Checkout isn’t available yet. Your items will stay saved in your account.</Toast>}
            <Link className="button continue-shopping" to="/products">Continue shopping <span aria-hidden="true">→</span></Link>
          </aside>
        </div> : <section className="empty-cart"><span className="empty-cart-icon"><Icon name="bag" /></span>
          <h2>A little room for something good.</h2><p>Your cart is empty.</p><p>Explore the catalog and save your everyday finds here.</p>
          <Link className="button primary" to="/products">Continue shopping <span aria-hidden="true">→</span></Link>
        </section>}
      </>}
  </>;
}
