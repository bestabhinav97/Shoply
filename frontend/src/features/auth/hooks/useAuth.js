import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, submitAuth, endSession, updateProfile } from '../api/auth.api.js';

const userKey = ['auth', 'user'];

async function replaceUser(client, user) {
  await client.cancelQueries();
  // Clear data from the previous account while retaining active auth observers.
  client.removeQueries({ predicate: ({ queryKey }) => queryKey[0] !== 'auth' || queryKey[1] !== 'user' });
  client.setQueryData(userKey, user);
}

export function useAuth() {
  return useQuery({ queryKey: userKey, queryFn: getCurrentUser, retry: false, staleTime: 30_000 });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onMutate: () => client.cancelQueries({ queryKey: userKey }),
    onSuccess: ({ user }) => client.setQueryData(userKey, user),
    onError: (error) => {
      if (error.status === 401) return replaceUser(client, null);
    },
  });
}

export function useAuthSubmit(mode) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) => submitAuth(mode, body),
    onSuccess: ({ user }) => replaceUser(client, user),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: endSession,
    onSuccess: () => replaceUser(client, null),
    onError: (error) => {
      if (error.status === 401) return replaceUser(client, null);
    },
  });
}
