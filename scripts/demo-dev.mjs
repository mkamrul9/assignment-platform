/**
 * Starts API + web against apps/api/.env.demo and apps/web/.env.demo.local.
 * Does not modify development .env files.
 */
import { config as loadDotenv } from "dotenv";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiEnvPath = path.join(repoRoot, "apps", "api", ".env.demo");
const webEnvPath = path.join(repoRoot, "apps", "web", ".env.demo.local");

if (!fs.existsSync(apiEnvPath)) {
  console.error(`Missing ${apiEnvPath}. Copy apps/api/.env.demo.example first.`);
  process.exit(1);
}

loadDotenv({ path: apiEnvPath });

if (process.env.DEMO_MODE !== "1" && process.env.DEMO_MODE !== "true") {
  console.error("apps/api/.env.demo must set DEMO_MODE=1.");
  process.exit(1);
}

const apiEnv = { ...process.env };
const webEnv = { ...process.env };

if (fs.existsSync(webEnvPath)) {
  const parsed = loadDotenv({ path: webEnvPath, processEnv: {} });
  Object.assign(webEnv, parsed.parsed ?? {});
} else {
  webEnv.API_INTERNAL_URL = `http://127.0.0.1:${apiEnv.PORT ?? 4001}`;
  console.warn(
    `Missing ${webEnvPath}; using API_INTERNAL_URL=${webEnv.API_INTERNAL_URL}. Copy apps/web/.env.demo.example for a durable config.`,
  );
}

const webPort = webEnv.PORT ?? "3001";
webEnv.PORT = String(webPort);

const api = spawn("npm", ["run", "dev", "--workspace=@reviewdock/api"], {
  cwd: repoRoot,
  env: apiEnv,
  stdio: "inherit",
  shell: true,
});

const web = spawn(
  "npm",
  ["run", "dev", "--workspace=@reviewdock/web", "--", "-p", String(webPort)],
  {
    cwd: repoRoot,
    env: webEnv,
    stdio: "inherit",
    shell: true,
  },
);

function shutdown(code = 0) {
  for (const child of [api, web]) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}

api.on("exit", (code) => shutdown(code ?? 1));
web.on("exit", (code) => shutdown(code ?? 1));
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
