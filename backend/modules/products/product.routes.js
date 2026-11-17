import { Router } from "express";
import * as controller from "./product.controller.js";
import { requireAuth, requireRole } from "../auth/index.js";
import { protectMutation } from "../../shared/csrf.js";
import express from "express";

export const productRoutes = Router();
productRoutes.get("/", controller.list);
productRoutes.get("/:id", controller.details);

export const categoryRoutes = Router();
categoryRoutes.get("/", controller.categories);

export const adminProductRoutes = Router();
adminProductRoutes.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
adminProductRoutes.use(requireAuth, requireRole("admin"));
adminProductRoutes.get("/", controller.adminList);
adminProductRoutes.get("/categories", controller.adminCategories);
adminProductRoutes.post(
  "/categories",
  protectMutation,
  express.json({ limit: "16kb" }),
  controller.createCategory,
);
adminProductRoutes.get("/:id", controller.adminDetails);
adminProductRoutes.post(
  "/",
  protectMutation,
  express.json({ limit: "512kb" }),
  controller.create,
);
adminProductRoutes.put(
  "/:id",
  protectMutation,
  express.json({ limit: "512kb" }),
  controller.update,
);
