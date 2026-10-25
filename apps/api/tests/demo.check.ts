/**
 * Demo sandbox guards, seed idempotence, and public metadata checks.
 */
import { config as loadDotenv } from "dotenv";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { DEMO_ACCOUNTS, publicDemoAccounts } from "../src/demo/accounts.js";
import {
  assertAllowlistedDemoDatabase,
  assertDemoSeedTarget,
  isAllowlistedDemoDatabaseName,
  isAllowedDemoSeedDatabase,
} from "../src/demo/database-guard.js";
import { DEMO_SUBMISSION_COUNT } from "../src/demo/fixtures.js";
import { seedDemoDatabase } from "../src/demo/seed.js";
import { verifyPassword } from "../src/lib/password.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const TEST_DATABASE_NAME = "reviewdock_demo_check";
const TRUSTED_ORIGIN = "http://localhost:3000";
const JWT_SECRET = "demo-check-jwt-secret-value-32chars-min";

function replaceDatabaseName(connectionString: string, databaseName: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function adminConnectionString(connectionString: string): string {
  return replaceDatabaseName(connectionString, "postgres");
}

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

async function resetTestDatabase(devUrl: string, testDbName: string): Promise<string> {
  const client = new pg.Client({ connectionString: adminConnectionString(devUrl) });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(testDbName)}`);
    await client.query(`CREATE DATABASE ${quoteIdent(testDbName)}`);
  } finally {
    await client.end();
  }
  return replaceDatabaseName(devUrl, testDbName);
}

async function dropTestDatabase(devUrl: string, testDbName: string): Promise<void> {
  const client = new pg.Client({ connectionString: adminConnectionString(devUrl) });
  await client.connect();
  try {
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [testDbName],
    );
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(testDbName)}`);
  } finally {
    await client.end();
  }
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

function migrateDeploy(databaseUrl: string): void {
  execFileSync(process.execPath, [prismaCli(), "migrate", "deploy"], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(
  baseUrl: string,
  method: string,
  pathName: string,
  options?: { body?: unknown; origin?: string; cookie?: string },
) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options?.origin) headers.Origin = options.origin;
  if (options?.cookie) headers.Cookie = options.cookie;
  let body: string | undefined;
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathName}`, { method, headers, body });
  const contentType = response.headers.get("content-type") ?? "";
  const parsed = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return {
    status: response.status,
    body: parsed,
    setCookie: response.headers.get("set-cookie"),
  };
}

function parseSetCookie(header: string | null): Record<string, string> {
  if (!header) return {};
  const [pair, ...attrs] = header.split(";").map((part) => part.trim());
  const eq = pair?.indexOf("=") ?? -1;
  const result: Record<string, string> = {
    name: eq >= 0 ? pair!.slice(0, eq) : "",
    value: eq >= 0 ? pair!.slice(eq + 1) : "",
  };
  for (const attr of attrs) {
    const [key, ...rest] = attr.split("=");
    result[key!.toLowerCase()] = rest.join("=") || "true";
  }
  return result;
}

async function listen(appInstance: ReturnType<typeof import("../src/app.js").createApp>): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const server: Server = createServer(appInstance);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object", "server should expose an address");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function runChecks() {
  assert(isAllowlistedDemoDatabaseName("reviewdock_demo"), "reviewdock_demo allowlisted");
  assert(
    isAllowlistedDemoDatabaseName("reviewdock_demo_check"),
    "reviewdock_demo_check allowlisted",
  );
  assert(!isAllowlistedDemoDatabaseName("reviewdock"), "development name refused");
  assert(!isAllowlistedDemoDatabaseName("reviewdock_e2e"), "e2e name refused");
  assert(
    isAllowedDemoSeedDatabase("postgresql://u:p@dpg-abc.render.com:5432/random_platform_name"),
    "hosted platform database names are allowed",
  );
  assert(
    !isAllowedDemoSeedDatabase(replaceDatabaseName(DEV_DATABASE_URL, "reviewdock")),
    "local development database remains refused",
  );

  let threw = false;
  try {
    assertDemoSeedTarget(replaceDatabaseName(DEV_DATABASE_URL, "reviewdock"), "0");
  } catch {
    threw = true;
  }
  assert(threw, "seed without DEMO_MODE must fail");

  threw = false;
  try {
    assertAllowlistedDemoDatabase(replaceDatabaseName(DEV_DATABASE_URL, "reviewdock"));
  } catch {
    threw = true;
  }
  assert(threw, "seed against development database name must fail");

  const testUrl = await resetTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  migrateDeploy(testUrl);

  process.env.DEMO_MODE = "1";
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISSUER = "reviewdock";
  process.env.JWT_AUDIENCE = "reviewdock-web";
  process.env.WEB_ORIGINS = TRUSTED_ORIGIN;
  process.env.TRUST_PROXY = "0";
  process.env.SESSION_COOKIE_NAME = "reviewdock_session";

  await seedDemoDatabase(testUrl);
  await seedDemoDatabase(testUrl);

  const { PrismaClient, Role } = await import("../src/generated/prisma/client.js");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const adapter = new PrismaPg({ connectionString: testUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const students = await prisma.user.count({
      where: { role: Role.STUDENT, id: { startsWith: "demo_" } },
    });
    const mentors = await prisma.user.count({
      where: { role: Role.MENTOR, id: DEMO_ACCOUNTS.mentor.id },
    });
    assert(students === 2, `expected 2 demo students, got ${students}`);
    assert(mentors === 1, `expected 1 demo mentor, got ${mentors}`);

    const submissions = await prisma.submission.count({
      where: { canonicalRepositoryUrl: { startsWith: "https://github.com/reviewdock-demo/" } },
    });
    assert(
      submissions === DEMO_SUBMISSION_COUNT,
      `expected ${DEMO_SUBMISSION_COUNT} demo submissions, got ${submissions}`,
    );
    assert(DEMO_SUBMISSION_COUNT >= 25, "fixture set must include at least 25 submissions");

    const reviews = await prisma.review.count({
      where: { mentorId: DEMO_ACCOUNTS.mentor.id },
    });
    assert(reviews > 0, "expected demo reviews");

    const mentor = await prisma.user.findUniqueOrThrow({ where: { id: DEMO_ACCOUNTS.mentor.id } });
    assert(
      await verifyPassword(DEMO_ACCOUNTS.mentor.password, mentor.passwordHash),
      "demo mentor password must verify",
    );
    assert(mentor.passwordHash !== DEMO_ACCOUNTS.mentor.password, "password must be hashed");

    // Role collision: create conflicting student with mentor email pattern via different id path
    await prisma.user.create({
      data: {
        id: "collision_user",
        name: "Collision",
        email: "collision@demo.reviewdock.local",
        passwordHash: mentor.passwordHash,
        role: Role.STUDENT,
      },
    });
    // Attempting to seed a fixture that collides on email with wrong id is covered by ensureUser;
    // force a role collision on an existing demo student by flipping role then re-seeding.
    await prisma.user.update({
      where: { id: DEMO_ACCOUNTS.studentA.id },
      data: { role: Role.MENTOR },
    });
    let collision = false;
    try {
      await seedDemoDatabase(testUrl);
    } catch (error) {
      collision = error instanceof Error && /role/i.test(error.message);
    }
    assert(collision, "role collision must fail clearly");
    await prisma.user.update({
      where: { id: DEMO_ACCOUNTS.studentA.id },
      data: { role: Role.STUDENT },
    });
  } finally {
    await prisma.$disconnect();
  }

  // Fresh module graph for DEMO_MODE=1 app
  const { createApp } = await import("../src/app.js");
  const enabled = await listen(createApp());
  try {
    const meta = await requestJson(enabled.baseUrl, "GET", "/api/demo/accounts");
    assert(meta.status === 200, `demo metadata expected 200, got ${meta.status}`);
    const accounts = (meta.body as { accounts: Array<{ email: string }> }).accounts;
    assert(accounts.length === publicDemoAccounts().length, "public account count mismatch");
    assert(
      accounts.every((account) => account.email.endsWith("@demo.reviewdock.local")),
      "only synthetic demo emails",
    );
    assert(
      accounts.some((account) => account.email === DEMO_ACCOUNTS.studentA.email),
      "student A advertised",
    );
    assert(
      accounts.some((account) => account.email === DEMO_ACCOUNTS.mentor.email),
      "mentor advertised",
    );

    const studentLogin = await requestJson(enabled.baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: {
        email: DEMO_ACCOUNTS.studentA.email,
        password: DEMO_ACCOUNTS.studentA.password,
      },
    });
    assert(studentLogin.status === 200, `student A login expected 200, got ${studentLogin.status}`);
    const studentCookie = `${parseSetCookie(studentLogin.setCookie).name}=${parseSetCookie(studentLogin.setCookie).value}`;

    const mentorLogin = await requestJson(enabled.baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: {
        email: DEMO_ACCOUNTS.mentor.email,
        password: DEMO_ACCOUNTS.mentor.password,
      },
    });
    assert(mentorLogin.status === 200, `mentor login expected 200, got ${mentorLogin.status}`);
    const mentorCookie = `${parseSetCookie(mentorLogin.setCookie).name}=${parseSetCookie(mentorLogin.setCookie).value}`;

    const studentMine = await requestJson(
      enabled.baseUrl,
      "GET",
      "/api/submissions/mine?pageSize=50",
      { cookie: studentCookie },
    );
    assert(studentMine.status === 200, "student mine expected 200");
    const mineBody = studentMine.body as {
      submissions: Array<{ projectName: string }>;
      pagination: { total: number };
    };
    assert(mineBody.pagination.total > 0, "student A should own demo projects");
    assert(mineBody.submissions.length > 0, "student A mine page should include projects");

    const studentBLogin = await requestJson(enabled.baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: {
        email: DEMO_ACCOUNTS.studentB.email,
        password: DEMO_ACCOUNTS.studentB.password,
      },
    });
    const studentBCookie = `${parseSetCookie(studentBLogin.setCookie).name}=${parseSetCookie(studentBLogin.setCookie).value}`;
    const mineB = await requestJson(enabled.baseUrl, "GET", "/api/submissions/mine?pageSize=50", {
      cookie: studentBCookie,
    });
    const namesA = new Set(mineBody.submissions.map((item) => item.projectName));
    const namesB = (mineB.body as { submissions: Array<{ projectName: string }> }).submissions.map(
      (item) => item.projectName,
    );
    assert(
      namesB.every((name) => !namesA.has(name)),
      "students must not see each other's projects",
    );

    const mentorQueue = await requestJson(
      enabled.baseUrl,
      "GET",
      "/api/reviews/submissions?status=ALL&pageSize=50",
      { cookie: mentorCookie },
    );
    assert(mentorQueue.status === 200, "mentor queue expected 200");

    const studentBlocked = await requestJson(
      enabled.baseUrl,
      "GET",
      "/api/reviews/submissions?status=PENDING",
      { cookie: studentCookie },
    );
    assert(studentBlocked.status === 403, "student must not access mentor queue");
  } finally {
    await new Promise<void>((resolve, reject) => {
      enabled.server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  // DEMO_MODE off: demo router returns 404 even if mounted (createApp omits mount when disabled).
  process.env.DEMO_MODE = "0";
  const { createDemoRouter } = await import("../src/modules/demo/demo.routes.js");
  const express = (await import("express")).default;
  const offApp = express();
  offApp.use("/api/demo", createDemoRouter());
  const disabledServer: Server = createServer(offApp);
  await new Promise<void>((resolve) => disabledServer.listen(0, "127.0.0.1", resolve));
  const disabledAddress = disabledServer.address();
  assert(disabledAddress && typeof disabledAddress === "object", "disabled server address");
  const disabledBase = `http://127.0.0.1:${disabledAddress.port}`;
  try {
    const missing = await requestJson(disabledBase, "GET", "/api/demo/accounts");
    assert(missing.status === 404, `disabled demo metadata expected 404, got ${missing.status}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      disabledServer.close((error) => (error ? reject(error) : resolve()));
    });
  }

  console.info("Demo checks passed.");
}

async function main() {
  try {
    await runChecks();
  } finally {
    await dropTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
