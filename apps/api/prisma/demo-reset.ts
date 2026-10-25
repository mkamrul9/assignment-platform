/**
 * DESTRUCTIVE: drops and recreates the allowlisted demo database, migrates, and re-seeds.
 * Never targets development `reviewdock` or other non-demo databases.
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

async function recreateDatabase(databaseUrl: string, databaseName: string): Promise<string> {
  const adminUrl = replaceDatabaseName(databaseUrl, "postgres");
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(databaseName)}`);
    await client.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
  } finally {
    await client.end();
  }
  return replaceDatabaseName(databaseUrl, databaseName);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for demo reset (set in apps/api/.env.demo).");
  }

  const databaseName = assertDemoSeedTarget(databaseUrl);
  console.warn(
    `DESTRUCTIVE demo reset: dropping and recreating database "${databaseName}". Development data is not targeted.`,
  );

  const demoUrl = await recreateDatabase(databaseUrl, databaseName);

  execFileSync(process.execPath, [prismaCli(), "migrate", "deploy"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: demoUrl, DEMO_MODE: "1" },
    stdio: "inherit",
  });

  await seedDemoDatabase(demoUrl);
  console.info(`Demo database "${databaseName}" reset and seeded.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
