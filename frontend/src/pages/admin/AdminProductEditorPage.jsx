import { Link, useParams } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";
import { AdminProductEditor } from "../../features/admin";

export default function AdminProductEditorPage() {
  const { id } = useParams();
  return (
    <main className="admin-products admin-editor-page">
      <Link className="editor-back-link" to="/admin/products">
        <Icon name="back" /> Products
      </Link>
      <h1>{id ? "Edit product" : "Create product"}</h1>
      <p className="muted">
        {id
          ? "Manage your product information and configuration."
          : "Build your product, one step at a time."}
      </p>
      <AdminProductEditor id={id} />
    </main>
  );
}
