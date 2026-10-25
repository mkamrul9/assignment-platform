/**
 * Single-process hosted demo: migrate + seed, then API on :4000 and Next on $PORT.
 * DATABASE_URL is injected by Render/Railway. Everything else has code defaults.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = path.join(root, "apps", "api");
const webRoot = path.join(root, "apps", "web");

const DEMO_JWT_SECRET = "reviewdock-public-demo-jwt-secret-min-32-chars";

function applyHostedDefaults() {
  process.env.NODE_ENV ??= "production";
  process.env.DEMO_MODE ??= "1";
  process.env.TRUST_PROXY ??= "1";
  process.env.JWT_ISSUER ??= "reviewdock";
  process.env.JWT_AUDIENCE ??= "reviewdock-web";
  process.env.WEB_ORIGINS ??= "*";
  process.env.SESSION_COOKIE_NAME ??= "reviewdock_session";
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = DEMO_JWT_SECRET;
  }
}

function firstExisting(candidates) {
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) {
    throw new Error(`Unable to locate ${candidates[0]}`);
  }
  return resolved;
}

function prismaCli() {
  return firstExisting([
    path.join(apiRoot, "node_modules", "prisma", "build", "index.js"),
    path.join(root, "node_modules", "prisma", "build", "index.js"),
  ]);
}

function tsxCli() {
  return firstExisting([
    path.join(root, "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(root, "node_modules", "tsx", "dist", "cli.js"),
    path.join(apiRoot, "node_modules", "tsx", "dist", "cli.mjs"),
  ]);
}

function nextCli() {
  return firstExisting([
    path.join(webRoot, "node_modules", "next", "dist", "bin", "next"),
    path.join(root, "node_modules", "next", "dist", "bin", "next"),
  ]);
}

function migrateAndSeed() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Render injects this from the Blueprint Postgres.");
  }

  execFileSync(process.execPath, [prismaCli(), "migrate", "deploy"], {
    cwd: apiRoot,
    env: process.env,
    stdio: "inherit",
  });

  execFileSync(process.execPath, [tsxCli(), path.join(apiRoot, "prisma", "demo-seed.ts")], {
    cwd: apiRoot,
    env: { ...process.env, DEMO_MODE: "1" },
    stdio: "inherit",
  });
}

function spawnService(name, args, extraEnv, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    console.error(`${name} exited (${signal ?? code ?? "unknown"})`);
    process.exit(code ?? 1);
  });
  return child;
}

async function waitForApi(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // API still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become ready at ${url}`);
}

applyHostedDefaults();
migrateAndSeed();

const webPort = process.env.PORT ?? "3000";
const apiPort = process.env.API_PORT ?? "4000";
const apiUrl = `http://127.0.0.1:${apiPort}`;

const api = spawnService(
  "api",
  [path.join(apiRoot, "dist", "server.js")],
  {
    PORT: apiPort,
    NODE_ENV: "production",
    DEMO_MODE: "1",
    TRUST_PROXY: "1",
    WEB_ORIGINS: process.env.WEB_ORIGINS ?? "*",
  },
  apiRoot,
);

await waitForApi(`${apiUrl}/api/health`);

const web = spawnService(
  "web",
  [nextCli(), "start", "--hostname", "0.0.0.0", "--port", String(webPort)],
  {
    PORT: String(webPort),
    HOSTNAME: "0.0.0.0",
    NODE_ENV: "production",
    API_INTERNAL_URL: apiUrl,
  },
  webRoot,
);

function shutdown(signal) {
  api.kill(signal);
  web.kill(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
