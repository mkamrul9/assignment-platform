import { config as loadDotenv } from "dotenv";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { dropDatabase } from "./db";
import { readState, STATE_PATH } from "./runtime";

const apiRoot = path.join(process.cwd(), "apps", "api");
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

function killPid(pid: number) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      return;
    }
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      process.kill(pid, "SIGTERM");
    }
  } catch {
    // Process may already have exited.
  }
}

export default async function globalTeardown() {
  if (!fs.existsSync(STATE_PATH)) {
    return;
  }

  const state = readState();
  killPid(state.webPid);
  killPid(state.apiPid);

  try {
    await dropDatabase(DEV_DATABASE_URL, state.databaseName);
  } catch (error) {
    throw new Error("Failed to drop e2e database.", { cause: error });
  } finally {
    fs.rmSync(STATE_PATH, { force: true });
  }
}
