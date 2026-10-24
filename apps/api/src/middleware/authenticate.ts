import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { JoseErrors, verifySessionToken } from "../lib/jwt.js";
import { sendError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { publicUserSelect } from "../lib/public-user.js";

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
    return;
  }

  try {
    const { userId } = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });

    if (!user) {
      sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (
      error instanceof JoseErrors.JWTExpired ||
      error instanceof JoseErrors.JWTClaimValidationFailed ||
      error instanceof JoseErrors.JWSSignatureVerificationFailed ||
      error instanceof JoseErrors.JWTInvalid ||
      error instanceof JoseErrors.JOSEError
    ) {
      sendError(res, 401, "UNAUTHENTICATED", "Authentication required.");
      return;
    }

    next(error);
  }
}

export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof token !== "string" || token.length === 0) {
    next();
    return;
  }

  try {
    const { userId } = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid optional sessions.
  }

  next();
}
