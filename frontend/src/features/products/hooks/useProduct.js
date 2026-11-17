import { useQuery } from "@tanstack/react-query";
import { fetchProduct } from "../api/products.api.js";

export function useProduct(id) {
  return useQuery({
    queryKey: ["products", "detail", id],
    queryFn: ({ signal }) => fetchProduct(id, signal),
    staleTime: 30_000,
    retry: false,
  });
}
