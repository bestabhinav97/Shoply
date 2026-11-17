import { Router } from "express";
import * as controller from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import { issueCsrf, protectMutation } from "../../shared/csrf.js";
import {
  loginLimiter,
  registrationLimiter,
  csrfLimiter,
} from "../../shared/rateLimits.js";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.get("/csrf", csrfLimiter, issueCsrf);
router.post(
  "/register",
  protectMutation,
  registrationLimiter,
  controller.register,
);
router.post("/login", protectMutation, loginLimiter, controller.login);
router.get("/me", requireAuth, controller.me);
router.patch("/me", protectMutation, requireAuth, controller.updateProfile);
router.post("/logout", protectMutation, requireAuth, controller.logout);
router.post("/logout-all", protectMutation, requireAuth, controller.logoutAll);

export default router;
