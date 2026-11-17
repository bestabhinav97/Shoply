import { Cart } from '../features/cart';
import { Container } from '../components/ui/Container';

export default function CartPage() {
  return <Container as="main" className="cart-page"><Cart /></Container>;
}
