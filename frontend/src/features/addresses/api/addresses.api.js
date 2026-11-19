import { apiClient } from '../../../lib/apiClient';

export const fetchAddresses = ({ signal }) => apiClient('/addresses', { signal });
export const createAddress = (body) => apiClient('/addresses', { method: 'POST', body });
export const selectAddress = (addressId) => apiClient('/addresses/selected', {
  method: 'PATCH', body: { addressId },
});
export const setDefaultAddress = (addressId) => apiClient('/addresses/default', {
  method: 'PATCH', body: { addressId },
});
export const updateAddress = ({ id, ...body }) => apiClient(`/addresses/${encodeURIComponent(id)}`, {
  method: 'PATCH', body,
});
export const deleteAddress = (id) => apiClient(`/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
