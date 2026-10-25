import "./load-env.js";

import { z } from "zod";

const DEFAULT_DATABASE_URL =
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

/** Public sandbox default so a hosted demo can start without a secrets form. */
const DEFAULT_JWT_SECRET = "reviewdock-public-demo-jwt-secret-min-32-chars";

function originFromPlatformUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return undefined;
  }
}

function collectWebOrigins(raw: string): string[] {
  const origins = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (trimmed) origins.add(trimmed);
  }
  for (const candidate of [
    originFromPlatformUrl(process.env.RENDER_EXTERNAL_URL),
    originFromPlatformUrl(process.env.RAILWAY_PUBLIC_DOMAIN),
    originFromPlatformUrl(process.env.RAILWAY_STATIC_URL),
  ]) {
    if (candidate) origins.add(candidate);
  }
  return [...origins];
}

function isOriginToken(value: string): boolean {
  if (value === "*") return true;
  try {
    return Boolean(new URL(value));
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
  JWT_SECRET: z
    .string()
    .min(
      32,
      "JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48",
    )
    .default(DEFAULT_JWT_SECRET),
  JWT_ISSUER: z.string().min(1).default("reviewdock"),
  JWT_AUDIENCE: z.string().min(1).default("reviewdock-web"),
  WEB_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000,http://127.0.0.1:3000")
    .transform(collectWebOrigins)
    .pipe(z.array(z.string().refine(isOriginToken, "Origin must be a URL or *")).min(1)),
  /** When true, trust a single reverse-proxy hop for req.ip (e.g. Next.js rewrite). */
  TRUST_PROXY: z
    .enum(["0", "1", "true", "false"])
    .default("0")
    .transform((value) => value === "1" || value === "true"),
  SESSION_COOKIE_NAME: z.string().min(1).default("reviewdock_session"),
  /**
   * Opt-in public demo sandbox. When enabled, GET /api/demo/accounts exposes
   * intentionally synthetic credentials. Keep disabled for normal development.
   */
  DEMO_MODE: z
    .enum(["0", "1", "true", "false"])
    .default("0")
    .transform((value) => value === "1" || value === "true"),
});

export const env = envSchema.parse(process.env);
