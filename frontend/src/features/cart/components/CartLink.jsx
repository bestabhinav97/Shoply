import { Link } from 'react-router-dom';
import { Icon } from '../../../components/ui/Icon';
import { useCart } from '../hooks/useCart';

export function CartLink() {
  const cart = useCart();
  const count = cart.data?.itemCount;
  return <Link className="header-cart" to="/cart" aria-label={count === undefined ? 'Cart' : `Cart, ${count} ${count === 1 ? 'item' : 'items'}`}>
    <Icon name="bag" />
    {count !== undefined && <span className="cart-badge" aria-hidden="true">{count}</span>}
  </Link>;
}
