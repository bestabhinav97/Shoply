import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProduct } from '../../hooks/useProduct';
import { formatCurrency } from '../../../../utils/formatCurrency';
import { ProductGallery } from './ProductGallery';
import { RelatedProducts } from './RelatedProducts';
import { Select } from '../../../../components/ui/Select';
import { AddToCart } from '../../../cart';
import { Badge } from '../../../../components/ui/Badge';
import { Breadcrumbs } from '../../../../components/ui/Breadcrumbs';
import { Accordion } from '../../../../components/ui/Accordion';
import { Icon } from '../../../../components/ui/Icon';

function ProductInformation({ product }) {
  const [selections, setSelections] = useState(() => Object.fromEntries(product.options.map((option) => [option.id,
    option.values.find((value) => product.variants[0]?.optionValueIds.includes(value.id))?.id || '',
  ])));
  const selected = product.variants.find((variant) => variant.optionValueIds.length === product.options.length &&
    product.options.every((option) => variant.optionValueIds.includes(selections[option.id])));
  const images = product.images.filter((image) => !image.variantId || image.variantId === selected?.id)
    .sort((a, b) => Number(Boolean(b.variantId)) - Number(Boolean(a.variantId)));
  const categoryPath = `/products?category=${product.category.slug}`;
  return <>
    <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: product.category.name, to: categoryPath }, { label: product.name }]} />
    <div className="product-details-layout">
      <ProductGallery key={selected?.id} images={images} productName={product.name} />
      <section className="product-information" aria-labelledby="product-title">
        <Link to={categoryPath} className="product-category-link"><Badge>{product.category.name}</Badge></Link>
        <h1 id="product-title">{product.name}</h1>
        {selected ? <>
          <p className="detail-price" aria-live="polite">{formatCurrency(selected.priceMinor)}</p>
          <p className={`stock-status detail-stock${selected.inStock ? ' available' : ''}`} role="status">
            <span className="stock-dot" aria-hidden="true" />{selected.inStock ? 'In stock' : 'Out of stock'}
          </p>
        </> : <p className="variant-unavailable" role="status">This combination is unavailable. Choose different options.</p>}
        <div className="variant-options">{product.options.map((option) => <div className="variant-field" key={option.id}>
          <Select label={option.name} value={selections[option.id]} onChange={(event) => setSelections({ ...selections, [option.id]: event.target.value })}>
            {option.values.map((value) => <option key={value.id} value={value.id}>{value.value}</option>)}
          </Select>
        </div>)}</div>
        <AddToCart key={selected?.id || 'unavailable'} variant={selected} />
        <ul className="product-benefits">
          <li><Icon name="bag" /><span><strong>Your finds, saved</strong>Cart items stay with your account.</span></li>
          <li><Icon name="shield" /><span><strong>Availability checked</strong>Stock is checked when you add an item.</span></li>
          <li><Icon name="truck" /><span><strong>Explore at your own pace</strong>This is a demo. Checkout is coming later.</span></li>
        </ul>
      </section>
    </div>
    <section className="product-story" aria-label="About this product">
      <Accordion items={[
        { title: 'A closer look', content: <><h3 className="section-kicker">Description</h3><p>{product.description}</p></> },
        { title: 'Details', content: <><p className="product-sku">SKU: {selected?.sku || 'Choose a variant'}</p>
          {Object.keys(product.specifications).length > 0 ? <dl className="specification-list">{Object.entries(product.specifications).map(([name, value]) => <div key={name}>
            <dt>{name}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd></div>)}</dl> : <p>Select the available options above to find your variant.</p>}</> },
        { title: 'Shipping & returns', content: <p>This demo does not accept orders yet. Delivery estimates, shipping costs and return terms will be shown before any future purchase. No delivery or returns service is currently offered.</p> },
      ]} />
      <aside className="demo-note"><strong>Explore the demo catalog</strong><p>These are sample products and prices. Purchasing isn’t available yet.</p></aside>
    </section>
    <RelatedProducts product={product} />
  </>;
}

export function ProductDetails({ id }) {
  const product = useProduct(id);
  if (product.isPending) return <div className="product-detail-skeleton" role="status" aria-label="Loading product">
    <span className="sr-only">Loading product…</span><div className="skeleton-block" /><div aria-hidden="true"><div className="skeleton-block" /><div className="skeleton-block" /><div className="skeleton-block" /></div>
  </div>;
  if (product.isError) return <div className="catalog-feedback" role="alert">
    <h1>{product.error.status === 404 ? 'Product not found' : 'We couldn’t load this product.'}</h1>
    <p>{product.error.status === 404 ? 'It may no longer be available.' : product.error.message}</p>
    {product.error.status !== 404 && <button className="button" onClick={() => product.refetch()}>Try again</button>}
    <Link className="button" to="/products">Browse products</Link>
  </div>;
  return <ProductInformation key={product.data.product.id} product={product.data.product} />;
}
