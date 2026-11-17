import { rateLimit } from "express-rate-limit";

// Per-process limits suit the current single Express instance. Shared storage is
// required before running multiple instances; proxy trust must match deployment.
export const createLimiter = (limit, windowMs = 60_000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." },
  });

export const catalogLimiter = createLimiter(180);
export const loginLimiter = createLimiter(20, 15 * 60_000);
export const registrationLimiter = createLimiter(10, 60 * 60_000);
export const csrfLimiter = createLimiter(120);
