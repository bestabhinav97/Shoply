import { useQuery } from "@tanstack/react-query";
import { fetchAdminProducts } from "../api/adminProducts.api.js";

export function useAdminProducts(filters) {
  return useQuery({
    queryKey: ["admin", "products", filters],
    queryFn: ({ signal }) => fetchAdminProducts(filters, signal),
    retry: false,
  });
}
