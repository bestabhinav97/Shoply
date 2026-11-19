import { useMutation } from '@tanstack/react-query';
import { createClientToken } from '../api/payments.api';

export function useClientToken() {
  return useMutation({ mutationFn: createClientToken, retry: false, gcTime: 0 });
}
