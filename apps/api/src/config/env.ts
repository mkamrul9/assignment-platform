import "./load-env.js";

import { z } from "zod";

const DEFAULT_DATABASE_URL =
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1).default(DEFAULT_DATABASE_URL),
});

export const env = envSchema.parse(process.env);
