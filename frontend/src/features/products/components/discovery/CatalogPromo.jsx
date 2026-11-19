import { Link, useSearchParams } from "react-router-dom";
import { useCategories } from "../../hooks/useProducts";
import { categoryLink } from "../../utils/categoryLink";

// Editorial category artwork reuses the storefront's existing photo assets.
const categoryArtwork = {
  accessories: 'weekend-sunglasses.webp',
  desk: 'daily-spiral-notebook.webp',
  home: 'morning-ceramic-mug.webp',
  shoes: 'everyday-white-sneaker.webp',
};

export function CatalogPromo({ home = false }) {
  const categories = useCategories();
  const [params] = useSearchParams();
  const tiles = categories.data?.items.slice(0, 2) || [];
  return (
    <section className={`promo-row${tiles.length ? " has-tiles" : ""}`} aria-labelledby="catalog-heading">
      <div className="catalog-hero">
        <div className="hero-copy">
          <span className="eyebrow">Shoply catalog</span>
          <h1 id="catalog-heading">{home ? 'Find your next purchase' : 'Browse the catalog'}</h1>
          {home ? <Link to="/products" className="button hero-cta">Shop now <span aria-hidden="true">↗</span></Link> : <a href="#catalog-listing" className="button hero-cta">Shop now <span aria-hidden="true">↗</span></a>}
        </div>
      </div>
      {tiles.length > 0 && <div className="promo-tiles">
        {tiles.map((category) => <Link className={`promo-tile${categoryArtwork[category.slug] ? ' has-artwork' : ''}`} key={category.id} to={categoryLink(home ? new URLSearchParams() : params, category.slug)}>
          <span className="promo-tile-copy"><strong>{category.name}</strong><span className="promo-tile-link">Shop category <span aria-hidden="true">→</span></span></span>
          {categoryArtwork[category.slug] && <img className="promo-tile-photo" src={`/images/products/${categoryArtwork[category.slug]}`} alt="" width="667" height="1000" decoding="async" />}
        </Link>)}
      </div>}
    </section>
  );
}
