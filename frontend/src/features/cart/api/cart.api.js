import { apiClient } from '../../../lib/apiClient';

export const fetchCart = ({ signal }) => apiClient('/cart', { signal });
export const addCartItem = (body) => apiClient('/cart/items', { method: 'POST', body });
export const updateCartItem = ({ id, quantity }) => apiClient(`/cart/items/${id}`, { method: 'PATCH', body: { quantity } });
export const removeCartItem = ({ id }) => apiClient(`/cart/items/${id}`, { method: 'DELETE' });
