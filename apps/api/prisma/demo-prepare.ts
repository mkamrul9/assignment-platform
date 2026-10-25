/**
 * Creates the allowlisted demo database if missing, applies migrations, and seeds fixtures.
 * Does not drop existing demo data (use demo:reset for a destructive rebuild).
 */
import { config as loadDotenv } from "dotenv";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { assertDemoSeedTarget } from "../src/demo/database-guard.js";
import { seedDemoDatabase } from "../src/demo/seed.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(apiRoot, ".env.demo") });

function replaceDatabaseName(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function prismaCli(): string {
  const candidates = [
    path.join(apiRoot, "node_modules", "prisma", "build", "index.js"),
    path.join(apiRoot, "..", "..", "node_modules", "prisma", "build", "index.js"),
  ];
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new Error("Unable to locate the prisma CLI package.");
  }
  return resolved;
}

async function ensureDatabase(databaseUrl: string, databaseName: string): Promise<void> {
  const adminUrl = replaceDatabaseName(databaseUrl, "postgres");
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
      [databaseName],
    );
    if (!result.rows[0]?.exists) {
      await client.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
      console.info(`Created demo database "${databaseName}".`);
    } else {
      console.info(`Demo database "${databaseName}" already exists.`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for demo prepare (set in apps/api/.env.demo).");
  }

  const databaseName = assertDemoSeedTarget(databaseUrl);
  await ensureDatabase(databaseUrl, databaseName);

  const demoUrl = replaceDatabaseName(databaseUrl, databaseName);
  execFileSync(process.execPath, [prismaCli(), "migrate", "deploy"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: demoUrl, DEMO_MODE: "1" },
    stdio: "inherit",
  });

  await seedDemoDatabase(demoUrl);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
