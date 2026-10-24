import { config as loadDotenv } from "dotenv";
import bcrypt from "bcryptjs";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";

import { migrateDeploy, resetDatabase, seedMentor } from "./db";
import {
  E2E_API_PORT,
  E2E_DATABASE_NAME,
  E2E_WEB_PORT,
  FIXTURE_STUDENT_EMAIL,
  FIXTURE_STUDENT_NAME,
  FIXTURE_STUDENT_PASSWORD,
  MENTOR_EMAIL,
  MENTOR_NAME,
  MENTOR_PASSWORD,
  RUNTIME_DIR,
  SCREENSHOT_DIR,
  writeState,
} from "./runtime";

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "apps", "api");
const webRoot = path.join(repoRoot, "apps", "web");

loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const JWT_SECRET = process.env.E2E_JWT_SECRET ?? "e2e-reviewdock-jwt-secret-32chars-min!!";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killPort(port: number) {
  try {
    if (process.platform === "win32") {
      const output = execFileSync("cmd", ["/c", `netstat -ano | findstr :${port}`], {
        encoding: "utf8",
      });
      const pids = new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((value): value is string => Boolean(value) && /^\d+$/.test(value)),
      );
      for (const pid of pids) {
        try {
          execFileSync("taskkill", ["/pid", pid, "/T", "/F"], { stdio: "ignore" });
        } catch {
          // ignore
        }
      }
      return;
    }
    execFileSync("sh", ["-c", `fuser -k ${port}/tcp || true`], { stdio: "ignore" });
  } catch {
    // nothing listening
  }
}

async function waitForUrl(url: string, timeoutMs: number) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return;
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

function spawnLogged(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; logName: string },
): ChildProcess {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const out = fs.openSync(path.join(RUNTIME_DIR, `${options.logName}.log`), "w");
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", out, out],
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  if (!child.pid) {
    throw new Error(`Failed to start ${options.logName}`);
  }
  return child;
}

async function seedFixtures(databaseUrl: string) {
  const { PrismaClient, Role, SubmissionStatus } =
    await import("../apps/api/src/generated/prisma/client.js");
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const student = await prisma.user.create({
      data: {
        name: FIXTURE_STUDENT_NAME,
        email: FIXTURE_STUDENT_EMAIL,
        passwordHash: await bcrypt.hash(FIXTURE_STUDENT_PASSWORD, 12),
        role: Role.STUDENT,
      },
    });

    // Enough pending rows for multi-page mentor pagination at pageSize 10.
    for (let index = 0; index < 23; index += 1) {
      await prisma.submission.create({
        data: {
          ownerId: student.id,
          projectName: `Fixture Project ${String(index).padStart(2, "0")}`,
          repositoryUrl: `https://github.com/e2e-fixture/project-${index}`,
          canonicalRepositoryUrl: `https://github.com/e2e-fixture/project-${index}`,
          liveUrl: `https://fixture-${index}.example.com`,
          description: `Fixture description ${index} used for pagination and filter coverage.`,
          status: SubmissionStatus.PENDING,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export default async function globalSetup() {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const databaseUrl = await resetDatabase(DEV_DATABASE_URL, E2E_DATABASE_NAME);
  migrateDeploy(databaseUrl);
  seedMentor(databaseUrl, {
    name: MENTOR_NAME,
    email: MENTOR_EMAIL,
    password: MENTOR_PASSWORD,
  });
  await seedFixtures(databaseUrl);

  const baseURL = `http://127.0.0.1:${E2E_WEB_PORT}`;
  const apiURL = `http://127.0.0.1:${E2E_API_PORT}`;
  const webOrigins = `${baseURL},http://localhost:${E2E_WEB_PORT}`;

  let api: ChildProcess | undefined;
  let web: ChildProcess | undefined;

  killPort(E2E_API_PORT);
  killPort(E2E_WEB_PORT);

  try {
    api = spawnLogged(process.execPath, ["dist/server.js"], {
      cwd: apiRoot,
      logName: "api",
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(E2E_API_PORT),
        DATABASE_URL: databaseUrl,
        JWT_SECRET,
        JWT_ISSUER: "reviewdock",
        JWT_AUDIENCE: "reviewdock-web",
        WEB_ORIGINS: webOrigins,
        TRUST_PROXY: "1",
        SESSION_COOKIE_NAME: "reviewdock_session",
        // Shared Next→Express peer IP; raise signup so the full suite can create accounts.
        // Keep the default login limit so proxy-trust can still observe shared IP buckets.
        SIGNUP_RATE_LIMIT_MAX: "100",
      },
    });

    await waitForUrl(`${apiURL}/api/health`, 60_000);

    const originProbe = await fetch(`${apiURL}/api/auth/signup`, {
      method: "POST",
      headers: {
        Origin: baseURL,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Origin Probe",
        email: `origin-probe-${Date.now()}@example.com`,
        password: "student-pass-1",
      }),
    });
    if (!originProbe.ok) {
      throw new Error(
        `API rejected e2e Origin ${baseURL} during setup (${originProbe.status}): ${await originProbe.text()}. WEB_ORIGINS=${webOrigins}`,
      );
    }

    const nextBinCandidates = [
      path.join(webRoot, "node_modules", "next", "dist", "bin", "next"),
      path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"),
    ];
    const nextBin = nextBinCandidates.find((candidate) => fs.existsSync(candidate));
    if (!nextBin) {
      throw new Error("Unable to locate the Next.js CLI binary.");
    }

    web = spawnLogged(
      process.execPath,
      [nextBin, "start", "-p", String(E2E_WEB_PORT), "-H", "127.0.0.1"],
      {
        cwd: webRoot,
        logName: "web",
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: String(E2E_WEB_PORT),
          API_INTERNAL_URL: apiURL,
        },
      },
    );

    await waitForUrl(`${baseURL}/api/health`, 90_000);
    await waitForUrl(baseURL, 30_000);

    const proxyProbe = await fetch(`${baseURL}/api/auth/signup`, {
      method: "POST",
      headers: {
        Origin: baseURL,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Proxy Probe",
        email: `proxy-probe-${Date.now()}@example.com`,
        password: "student-pass-1",
      }),
    });
    if (!proxyProbe.ok) {
      throw new Error(
        `Proxied signup rejected Origin ${baseURL} during setup (${proxyProbe.status}): ${await proxyProbe.text()}`,
      );
    }

    writeState({
      baseURL,
      apiURL,
      databaseUrl,
      databaseName: E2E_DATABASE_NAME,
      mentorEmail: MENTOR_EMAIL,
      mentorPassword: MENTOR_PASSWORD,
      fixtureStudentEmail: FIXTURE_STUDENT_EMAIL,
      fixtureStudentPassword: FIXTURE_STUDENT_PASSWORD,
      apiPid: api.pid!,
      webPid: web.pid!,
    });
  } catch (error) {
    for (const child of [web, api]) {
      if (child?.pid) {
        try {
          if (process.platform === "win32") {
            const { execFileSync } = await import("node:child_process");
            execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
            });
          } else {
            process.kill(child.pid, "SIGTERM");
          }
        } catch {
          // already exited
        }
      }
    }
    try {
      const { dropDatabase } = await import("./db.js");
      await dropDatabase(DEV_DATABASE_URL, E2E_DATABASE_NAME);
    } catch {
      // best-effort cleanup
    }
    throw error;
  }
}
