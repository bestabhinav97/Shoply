import { AdminProductList } from "../../features/admin";
import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";

export default function AdminProductsPage() {
  return (
    <main className="admin-products">
      <div className="admin-catalog-heading">
        <div>
          <h1>Products</h1>
          <p className="muted">
            Browse your catalog, check stock, and add something new.
          </p>
        </div>
        <Link className="button primary" to="/admin/products/new">
          <Icon name="plus" />
          Create product
        </Link>
      </div>
      <AdminProductList />
    </main>
  );
}
