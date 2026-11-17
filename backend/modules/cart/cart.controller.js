import { z } from 'zod';
import { httpError } from '../../shared/errors.js';
import * as service from './cart.service.js';

const quantity = z.number().int().min(1).max(99);
const addSchema = z.object({ variantId: z.uuid(), quantity }).strict();
const updateSchema = z.object({ quantity }).strict();

function parse(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw httpError(400, 'Provide a valid variant or item ID and a quantity between 1 and 99.');
  return result.data;
}

export async function read(req, res) {
  res.json(await service.getCart(req.auth.user.id));
}
export async function add(req, res) {
  res.status(200).json(await service.changeCart(req.auth.user.id, 'add', parse(addSchema, req.body)));
}
export async function update(req, res) {
  const itemId = parse(z.uuid(), req.params.itemId);
  res.json(await service.changeCart(req.auth.user.id, 'update', { itemId, ...parse(updateSchema, req.body) }));
}
export async function remove(req, res) {
  const itemId = parse(z.uuid(), req.params.itemId);
  res.json(await service.changeCart(req.auth.user.id, 'remove', { itemId }));
}
