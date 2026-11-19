import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { savePaymentMethod, fetchPaymentMethods, removePaymentMethod } from '../api/payments.api';

const cardsKey = (userId) => ['payment-methods', userId];

export function usePaymentMethods(userId) {
  return useQuery({ queryKey: cardsKey(userId), queryFn: fetchPaymentMethods,
    enabled: Boolean(userId), retry: false, staleTime: 0, gcTime: 0 });
}

export function useSavePaymentMethod(userId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: savePaymentMethod,
    retry: false,
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: cardsKey(userId), exact: true }),
    onSuccess: (card) => {
      if (!userId || client.getQueryData(['auth', 'user'])?.id !== userId) return;
      client.setQueryData(cardsKey(userId), (cards = []) => [card, ...cards.filter((item) => item.token !== card.token)]);
      void client.invalidateQueries({ queryKey: cardsKey(userId), exact: true });
    },
  });
}

export function useRemovePaymentMethod(userId) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: removePaymentMethod,
    retry: false,
    gcTime: 0,
    onMutate: () => client.cancelQueries({ queryKey: cardsKey(userId), exact: true }),
    onSuccess: async (_result, token) => {
      if (!userId || client.getQueryData(['auth', 'user'])?.id !== userId) return;
      // Cancel reads started during deletion so stale responses cannot restore the card.
      await client.cancelQueries({ queryKey: cardsKey(userId), exact: true });
      if (client.getQueryData(['auth', 'user'])?.id !== userId) return;
      client.setQueryData(cardsKey(userId), (cards = []) => cards.filter((card) => card.token !== token));
      void client.invalidateQueries({ queryKey: cardsKey(userId), exact: true });
    },
  });
}
