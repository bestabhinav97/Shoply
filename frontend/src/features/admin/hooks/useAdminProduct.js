import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminProduct,
  fetchAdminCategories,
  saveAdminProduct,
  createAdminCategory,
} from "../api/adminProducts.api.js";

export function useAdminProduct(id) {
  return useQuery({
    queryKey: ["admin", "product", id],
    queryFn: ({ signal }) => fetchAdminProduct(id, signal),
    enabled: Boolean(id),
    retry: false,
  });
}
export function useCreateAdminCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAdminCategory,
    onSuccess: ({ category }) => {
      client.setQueryData(["admin", "categories"], (old) => ({
        items: [
          ...(old?.items || []).filter((c) => c.id !== category.id),
          category,
        ].sort((a, b) => a.name.localeCompare(b.name)),
      }));
    },
  });
}
export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin", "categories"],
    queryFn: ({ signal }) => fetchAdminCategories(signal),
    retry: false,
  });
}
export function useSaveAdminProduct(id) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) => saveAdminProduct(id, body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin"] }),
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["product"] }),
        client.invalidateQueries({ queryKey: ["categories"] }),
      ]);
    },
  });
}
