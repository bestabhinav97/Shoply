import { CatalogPromo, ProductCatalog } from "../features/products";

export default function HomePage() {
  return <main className="catalog-page catalog-browse-page"><CatalogPromo home /><ProductCatalog /></main>;
}
