import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth';
import { fetchCart, addCartItem, updateCartItem, removeCartItem } from '../api/cart.api';

export function useCart() {
  const auth = useAuth();
  return useQuery({
    queryKey: ['cart', auth.data?.id], queryFn: fetchCart,
    enabled: Boolean(auth.data), retry: false, staleTime: 0,
  });
}

export function useCartMutation(action) {
  const client = useQueryClient();
  const auth = useAuth();
  const key = ['cart', auth.data?.id];
  return useMutation({
    mutationFn: { add: addCartItem, update: updateCartItem, remove: removeCartItem }[action],
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey: key, exact: true });
      const previous = client.getQueryData(key);
      if (previous && action !== 'add') {
        const items = action === 'remove' ? previous.items.filter((item) => item.id !== body.id)
          : previous.items.map((item) => item.id === body.id ? { ...item, quantity: body.quantity, lineTotalMinor: item.priceMinor * body.quantity } : item);
        client.setQueryData(key, { ...previous, items,
          itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
          subtotalMinor: items.reduce((sum, item) => sum + item.lineTotalMinor, 0),
        });
      }
      return { previous, key };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) client.setQueryData(context.key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key, exact: true }),
  });
}
