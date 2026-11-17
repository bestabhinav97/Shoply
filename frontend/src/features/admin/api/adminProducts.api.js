import { apiClient } from "../../../lib/apiClient";

export function fetchAdminProducts(filters, signal) {
  const params = new URLSearchParams({ ...filters, limit: "20" });
  return apiClient(`/admin/products?${params}`, { signal });
}
export const createAdminCategory = (body) =>
  apiClient("/admin/products/categories", { method: "POST", body });
export const fetchAdminProduct = (id, signal) =>
  apiClient(`/admin/products/${encodeURIComponent(id)}`, { signal });
export const fetchAdminCategories = (signal) =>
  apiClient("/admin/products/categories", { signal });
export const saveAdminProduct = (id, body) =>
  apiClient(
    id ? `/admin/products/${encodeURIComponent(id)}` : "/admin/products",
    {
      method: id ? "PUT" : "POST",
      body,
    },
  );
