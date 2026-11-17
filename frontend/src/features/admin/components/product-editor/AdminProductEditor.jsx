import { Button } from "../../../../components/ui/Button";
import { useAdminProduct, useAdminCategories } from "../../hooks/useAdminProduct";
import { ProductCreateForm } from "../product-create/ProductCreateForm";
import { ProductEditForm } from "./ProductEditForm";
import "./product-editor.css";

export function AdminProductEditor({ id }) {
  const product = useAdminProduct(id);
  const categories = useAdminCategories();
  if (categories.isPending || (id && product.isPending))
    return <p role="status">Loading editor…</p>;
  if ((categories.isError && !categories.data) || (id && product.isError && !product.data))
    return (
      <div role="alert">
        <p>{categories.error?.message || product.error?.message}</p>
        <Button
          onClick={() => {
            categories.refetch();
            if (id) product.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  return id ? (
    <ProductEditForm
      key={id || "new"}
      id={id}
      initial={product.data?.product}
      categories={categories.data.items}
    />
  ) : (
    <ProductCreateForm categories={categories.data.items} />
  );
}
