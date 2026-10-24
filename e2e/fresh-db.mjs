import process from "node:process";
import console from "node:console";
import pg from "pg";

const connectionString = process.argv[2];
const databaseName = process.argv[3];
const action = process.argv[4] ?? "reset";

if (!connectionString || !databaseName) {
  console.error("Usage: node fresh-db.mjs <adminUrl> <databaseName> [reset|drop]");
  process.exit(1);
}

function quoteIdent(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [databaseName],
  );
  await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(databaseName)}`);
  if (action !== "drop") {
    await client.query(`CREATE DATABASE ${quoteIdent(databaseName)}`);
  }
} finally {
  await client.end();
}
