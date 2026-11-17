import { apiClient } from '../../../lib/apiClient';

export async function getCurrentUser({ signal }) {
  try {
    const result = await apiClient('/auth/me', { signal });
    return result.user;
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
}

export const submitAuth = (mode, body) => apiClient(`/auth/${mode}`, { method: 'POST', body });
export const endSession = (everywhere) => apiClient(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST' });
export const updateProfile = (body) => apiClient('/auth/me', { method: 'PATCH', body });
