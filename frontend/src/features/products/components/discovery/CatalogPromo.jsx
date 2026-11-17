import { Link, useSearchParams } from "react-router-dom";
import { useCategories } from "../../hooks/useProducts";
import { categoryLink } from "../../utils/categoryLink";

export function CatalogPromo({ home = false }) {
  const categories = useCategories();
  const [params] = useSearchParams();
  const tiles = categories.data?.items.slice(0, 2) || [];
  return (
    <section className={`promo-row${tiles.length ? " has-tiles" : ""}`} aria-labelledby="catalog-heading">
      <div className="catalog-hero">
        <div className="hero-copy">
          <span className="eyebrow">SMALL FINDS. EVERYDAY JOY.</span>
          <h1 id="catalog-heading">{home ? <>Your everyday.<br />A little more inspired.</> : <>A little something<br />for your everyday.</>}</h1>
          {home ? <Link to="/products" className="button hero-cta">Shop now <span aria-hidden="true">↗</span></Link> : <a href="#catalog-listing" className="button hero-cta">Shop now <span aria-hidden="true">↗</span></a>}
        </div>
        <span className="hero-flower" aria-hidden="true">✳</span>
      </div>
      {tiles.length > 0 && <div className="promo-tiles">
        {tiles.map((category, index) => <Link className={`promo-tile promo-tile-${index + 1}`} key={category.id} to={categoryLink(home ? new URLSearchParams() : params, category.slug)}>
          <span><small>EXPLORE THE CATALOG</small><strong>{category.name}</strong><span className="promo-tile-link">Discover more <span aria-hidden="true">↗</span></span></span>
          <span className="tile-flower" aria-hidden="true">✳</span>
        </Link>)}
      </div>}
    </section>
  );
}
