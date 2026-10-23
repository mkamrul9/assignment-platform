import rateLimit from "express-rate-limit";
import type { Request } from "express";

import { sendError } from "../lib/http.js";

function clientIp(req: Request): string {
  // Prefer Express's resolved IP (respects trust proxy when enabled).
  // Fall back to the socket address so spoofed X-Forwarded-For alone cannot invent buckets
  // when trust proxy is disabled.
  return req.ip || req.socket.remoteAddress || "unknown";
}

function createLimiter(options: { windowMs: number; max: number; code: string; message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => clientIp(req),
    handler: (_req, res) => {
      const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
      sendError(res, 429, options.code, options.message, { retryAfterSeconds });
    },
    validate: {
      // Trust proxy is configured deliberately in app.ts; keyGenerator uses req.ip / socket.
      trustProxy: false,
      xForwardedForHeader: false,
      ip: false,
    },
  });
}

/** 10 login attempts per 15 minutes per IP. In-memory; single process only. */
export function createLoginRateLimit() {
  return createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    code: "LOGIN_RATE_LIMITED",
    message: "Too many login attempts. Please try again later.",
  });
}

/** 5 signup attempts per hour per IP. In-memory; single process only. */
export function createSignupRateLimit() {
  return createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    code: "SIGNUP_RATE_LIMITED",
    message: "Too many signup attempts. Please try again later.",
  });
}
