import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAddress, fetchAddresses, selectAddress, setDefaultAddress, updateAddress, deleteAddress } from '../api/addresses.api';

const addressKey = (userId) => ['addresses', userId];

export function useAddresses(userId) {
  return useQuery({
    queryKey: addressKey(userId), queryFn: fetchAddresses,
    enabled: Boolean(userId), retry: false, staleTime: 30000,
  });
}

export function useAddressMutation(userId, action) {
  const client = useQueryClient();
  const key = addressKey(userId);
  return useMutation({
    mutationFn: { create: createAddress, select: selectAddress, default: setDefaultAddress, update: updateAddress, delete: deleteAddress }[action],
    onMutate: () => client.cancelQueries({ queryKey: key, exact: true }),
    onSuccess: (data) => {
      // Do not repopulate private data after signing out or switching accounts.
      if (client.getQueryData(['auth', 'user'])?.id === userId) client.setQueryData(key, data);
    },
  });
}
