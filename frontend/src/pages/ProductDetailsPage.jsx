import { useParams } from 'react-router-dom';
import { ProductDetails } from '../features/products';
import { Container } from '../components/ui/Container';

export default function ProductDetailsPage() {
  const { id } = useParams();
  return <Container as="main" className="catalog-page detail-page"><ProductDetails id={id} /></Container>;
}
