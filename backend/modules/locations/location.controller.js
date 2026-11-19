import { validateCoordinates } from './location.validation.js';
import { findCity, findAddress } from './location.service.js';

export async function reverseGeocode(req, res) {
  const coordinates = validateCoordinates(req.body);
  const result = await findCity(coordinates);
  res.json(result);
}

export async function reverseAddress(req, res) {
  const coordinates = validateCoordinates(req.body);
  res.json(await findAddress(coordinates));
}
