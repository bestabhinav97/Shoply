import { apiClient } from "../../../lib/apiClient";

export function fetchProducts(filters, signal) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value != null) {
      search.set(key, value);
    }
  }

  return apiClient(`/products?${search}`, { signal });
}

export function fetchProduct(id, signal) {
  return apiClient(`/products/${encodeURIComponent(id)}`, { signal });
}

export function fetchCategories(signal) {
  return apiClient("/categories", { signal });
}
