import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth';
import { useCartMutation } from '../hooks/useCart';
import { Button } from '../../../components/ui/Button';
import { QuantityStepper } from '../../../components/ui/QuantityStepper';
import { Toast } from '../../../components/ui/Toast';
import { Icon } from '../../../components/ui/Icon';

export function AddToCart({ variant }) {
  const auth = useAuth();
  const location = useLocation();
  const add = useCartMutation('add');
  const [quantity, setQuantity] = useState('1');
  const validQuantity = /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 99;
  if (auth.isPending) return <p>Checking your session…</p>;
  if (auth.isError) return <Toast tone="error"><p>We couldn’t check your session.</p><Button onClick={() => auth.refetch()}>Retry session</Button></Toast>;
  if (!auth.data) return <Link className="button primary sign-in-cart" to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}>Sign in to add to cart</Link>;
  return <form className="cart-add-form" onSubmit={(event) => {
    event.preventDefault();
    if (validQuantity && variant?.inStock && !add.isPending) add.mutate({ variantId: variant.id, quantity: Number(quantity) });
  }}>
    <QuantityStepper value={quantity} disabled={add.isPending} onChange={(value) => { setQuantity(value); add.reset(); }} />
    <Button variant="primary" size="lg" type="submit" loading={add.isPending} disabled={!variant?.inStock || !validQuantity}>
      {add.isPending ? 'Adding…' : add.isSuccess ? 'Added ✓' : 'Add to cart'}
    </Button>
    {add.isError && <Toast tone="error">{add.error.message}</Toast>}
    {add.isSuccess && <Toast><span><Icon name="check" /> Added to your cart.</span><Link className="button button-sm" to="/cart">View cart</Link></Toast>}
  </form>;
}
