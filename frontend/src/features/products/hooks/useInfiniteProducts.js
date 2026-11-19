import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchProducts } from "../api/products.api.js";

export function useInfiniteProducts(filters) {
  return useInfiniteQuery({
    queryKey: ["products", "infinite", filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      fetchProducts({ ...filters, page: pageParam }, signal),
    getNextPageParam: ({ pagination }) =>
      pagination.page < pagination.totalPages && pagination.page < 9999
        ? pagination.page + 1
        : undefined,
    staleTime: 30_000,
    retry: false,
  });
}
