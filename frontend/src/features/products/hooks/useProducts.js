import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchProducts } from "../api/products.api.js";

export function useProducts(filters) {
  return useQuery({
    queryKey: ["products", "list", filters],
    queryFn: ({ signal }) => fetchProducts(filters, signal),
    staleTime: 30_000,
    retry: false,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 60_000,
    retry: false,
  });
}
