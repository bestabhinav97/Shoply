import * as service from "./product.service.js";
import {
  validateId,
  validateList,
  validateProduct,
  validateAdminList,
  validateCategory,
} from "./product.validation.js";

export async function list(req, res) {
  res.json(await service.getProducts(validateList(req.query)));
}
export async function details(req, res) {
  res.json(await service.getProduct(validateId(req.params.id)));
}
export async function categories(_req, res) {
  res.json(await service.getCategories());
}

export async function adminList(req, res) {
  res.json(await service.getAdminProducts(validateAdminList(req.query)));
}
export async function adminDetails(req, res) {
  res.json(await service.getProduct(validateId(req.params.id), true));
}
export async function adminCategories(_req, res) {
  res.json(await service.getAdminCategories());
}
export async function createCategory(req, res) {
  res
    .status(201)
    .json(await service.createCategory(validateCategory(req.body)));
}
export async function create(req, res) {
  const result = await service.saveProduct(validateProduct(req.body));
  res
    .status(201)
    .location(`/api/admin/products/${result.product.id}`)
    .json(result);
}
export async function update(req, res) {
  res.json(
    await service.saveProduct(
      validateProduct(req.body),
      validateId(req.params.id),
    ),
  );
}
