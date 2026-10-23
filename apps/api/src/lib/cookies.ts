import type { CookieOptions, Response } from "express";

import { env } from "../config/env.js";
import { SESSION_TTL_SECONDS } from "./jwt.js";

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    maxAge: 0,
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, clearSessionCookieOptions());
}
