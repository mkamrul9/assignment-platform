import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { sendError } from "../lib/http.js";

const trustedOrigins = new Set(env.WEB_ORIGINS);

export function requireTrustedOrigin(req: Request, res: Response, next: NextFunction): void {
  const originHeader = req.get("origin");

  if (originHeader === undefined || originHeader.trim() === "") {
    sendError(res, 403, "FORBIDDEN_ORIGIN", "Trusted Origin header is required.");
    return;
  }

  if (originHeader === "null") {
    sendError(res, 403, "FORBIDDEN_ORIGIN", "Null Origin is not allowed.");
    return;
  }

  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    sendError(res, 403, "FORBIDDEN_ORIGIN", "Origin header is malformed.");
    return;
  }

  if (origin !== originHeader) {
    sendError(res, 403, "FORBIDDEN_ORIGIN", "Origin is not trusted.");
    return;
  }

  if (trustedOrigins.has("*") || trustedOrigins.has(origin)) {
    next();
    return;
  }

  sendError(res, 403, "FORBIDDEN_ORIGIN", "Origin is not trusted.");
}
