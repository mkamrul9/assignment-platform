import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEFAULT_DATABASE_URL =
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
