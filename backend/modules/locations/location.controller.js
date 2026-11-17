import { validateCoordinates } from './location.validation.js';
import { findCity } from './location.service.js';

export async function reverseGeocode(req, res) {
  const coordinates = validateCoordinates(req.body);
  const result = await findCity(coordinates);
  res.json(result);
}
