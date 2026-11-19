import { validateCreateAddress, validateSelectedAddress, validateDefaultAddress, validateUpdateAddress, validateAddressId } from './address.validation.js';
import { addAddress, getAddressBook, selectDeliveryAddress, setDefaultAddress, editAddress, removeAddress } from './address.service.js';

export async function read(req, res) {
  res.json(await getAddressBook(req.auth.user.id));
}

export async function create(req, res) {
  const address = validateCreateAddress(req.body);
  const result = await addAddress(req.auth.user.id, address);
  res.status(201).json(result);
}

export async function select(req, res) {
  const { addressId } = validateSelectedAddress(req.body);
  res.json(await selectDeliveryAddress(req.auth.user.id, addressId));
}

export async function setDefault(req, res) {
  const { addressId } = validateDefaultAddress(req.body);
  res.json(await setDefaultAddress(req.auth.user.id, addressId));
}

export async function update(req, res) {
  const addressId = validateAddressId(req.params.addressId);
  const address = validateUpdateAddress(req.body);
  res.json(await editAddress(req.auth.user.id, addressId, address));
}

export async function remove(req, res) {
  const addressId = validateAddressId(req.params.addressId);
  res.json(await removeAddress(req.auth.user.id, addressId));
}
