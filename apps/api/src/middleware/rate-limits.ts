import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

import { sendError } from "../lib/http.js";

function clientIp(req: Request): string {
  // Prefer Express's resolved IP (respects trust proxy when enabled).
  // Fall back to the socket address so spoofed X-Forwarded-For alone cannot invent buckets
  // when trust proxy is disabled.
  return req.ip || req.socket.remoteAddress || "unknown";
}

function createLimiter(options: {
  windowMs: number;
  max: number;
  code: string;
  message: string;
  keyGenerator: (req: Request) => string;
  /** Set true when the key is not derived from request IP (e.g. authenticated user id). */
  nonIpKey?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    handler: (_req, res) => {
      const retryAfterSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
      sendError(res, 429, options.code, options.message, { retryAfterSeconds });
    },
    validate: {
      // Trust proxy is configured deliberately in app.ts.
      trustProxy: false,
      xForwardedForHeader: false,
      ip: false,
      ...(options.nonIpKey ? { keyGeneratorIpFallback: false } : {}),
    },
  });
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** 10 login attempts per 15 minutes per IP. In-memory; single process only. */
export function createLoginRateLimit() {
  return createLimiter({
    windowMs: 15 * 60 * 1000,
    max: positiveIntEnv("LOGIN_RATE_LIMIT_MAX", 10),
    code: "LOGIN_RATE_LIMITED",
    message: "Too many login attempts. Please try again later.",
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
  });
}

/** 5 signup attempts per hour per IP. In-memory; single process only. */
export function createSignupRateLimit() {
  return createLimiter({
    windowMs: 60 * 60 * 1000,
    max: positiveIntEnv("SIGNUP_RATE_LIMIT_MAX", 5),
    code: "SIGNUP_RATE_LIMITED",
    message: "Too many signup attempts. Please try again later.",
    keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
  });
}

/**
 * 5 submission attempts per 10 minutes per authenticated student.
 * Keyed by user id so IP changes or re-login do not reset the bucket.
 * In-memory; single process only.
 */
export function createSubmissionRateLimit() {
  return createLimiter({
    windowMs: 10 * 60 * 1000,
    max: 5,
    code: "SUBMISSION_RATE_LIMITED",
    message: "Too many submission attempts. Please try again later.",
    keyGenerator: (req) => `student:${req.user?.id ?? "anonymous"}`,
    nonIpKey: true,
  });
}
