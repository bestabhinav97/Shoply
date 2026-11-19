import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import healthRoutes from "./modules/health/health.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import cartRoutes from "./modules/cart/cart.routes.js";
import locationRoutes from "./modules/locations/location.routes.js";
import addressRoutes from "./modules/addresses/address.routes.js";
import {
  productRoutes,
  categoryRoutes,
  adminProductRoutes,
} from "./modules/products/index.js";
import { catalogLimiter } from "./shared/rateLimits.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  // Catalog graphs have a larger, bounded body parser after authorization/CSRF.
  if (/^\/api\/admin\/products(?:\/|$)/.test(req.path)) return next();
  return express.json({ limit: "16kb" })(req, res, next);
});
app.use(cookieParser());
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/products", catalogLimiter, productRoutes);
app.use("/api/categories", catalogLimiter, categoryRoutes);
app.use("/api/admin/products", catalogLimiter, adminProductRoutes);
app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
  if (status === 500)
    console.error("Request failed:", error.code || error.name);
  res.status(status).json({
    message: status === 500 ? "Internal server error" : error.message,
    ...(error.fields && { fields: error.fields }),
  });
});

export default app;
