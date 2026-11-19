import { Link } from 'react-router-dom';
import { useProducts } from '../../hooks/useProducts';
import { ProductCard } from '../catalog/ProductCard';

export function RelatedProducts({ product }) {
  const products = useProducts({ category: product.category.slug, q: '', sort: 'newest', page: '1', limit: '5' });
  const items = products.data?.items?.filter((item) => item.id !== product.id).slice(0, 4) || [];
  if (!products.isPending && !items.length) return null;
  return <section className="related-products" aria-labelledby="related-heading">
    <div className="section-heading"><div><h2 id="related-heading">More in this category</h2></div>
      <Link to={`/products?category=${product.category.slug}`}>Explore {product.category.name} →</Link></div>
    {products.isPending ? <div className="related-grid" aria-label="Loading recommendations">{[0, 1, 2, 3].map((id) => <div className="skeleton-block recommendation-skeleton" key={id} />)}</div>
      : <div className="related-grid">{items.map((item) => <ProductCard key={item.id} product={item} headingLevel="h3" />)}</div>}
  </section>;
}
