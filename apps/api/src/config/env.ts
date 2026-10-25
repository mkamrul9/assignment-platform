import "./load-env.js";

import { z } from "zod";

const DEFAULT_DATABASE_URL =
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
  JWT_SECRET: z
    .string()
    .min(
      32,
      "JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48",
    ),
  JWT_ISSUER: z.string().min(1).default("reviewdock"),
  JWT_AUDIENCE: z.string().min(1).default("reviewdock-web"),
  WEB_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000,http://127.0.0.1:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
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
