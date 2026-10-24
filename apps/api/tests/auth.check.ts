/**
 * Authentication integration checks against an isolated disposable PostgreSQL database.
 */
import { config as loadDotenv } from "dotenv";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SignJWT } from "jose";
import pg from "pg";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const TEST_DATABASE_NAME = "reviewdock_phase3_auth_check";
const TRUSTED_ORIGIN = "http://localhost:3000";
const JWT_SECRET = "phase3-auth-check-secret-value-32chars-min";
const JWT_ISSUER = "reviewdock";
const JWT_AUDIENCE = "reviewdock-web";
const COOKIE_NAME = "reviewdock_session";

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

function parseSetCookie(header: string | null): Record<string, string> {
  if (!header) {
    return {};
  }
  const [pair, ...attrs] = header.split(";").map((part) => part.trim());
  const eq = pair?.indexOf("=") ?? -1;
  const name = eq >= 0 ? pair!.slice(0, eq) : "";
  const value = eq >= 0 ? pair!.slice(eq + 1) : "";
  const result: Record<string, string> = { name, value };
  for (const attr of attrs) {
    const [key, ...rest] = attr.split("=");
    result[key!.toLowerCase()] = rest.join("=") || "true";
  }
  return result;
}

type JsonResponse = {
  status: number;
  headers: Headers;
  body: unknown;
  setCookie: string | null;
};

async function requestJson(
  baseUrl: string,
  method: string,
  pathName: string,
  options?: {
    body?: unknown;
    origin?: string | null;
    cookie?: string;
    headers?: Record<string, string>;
  },
): Promise<JsonResponse> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options?.headers ?? {}),
  };
  if (options?.origin !== undefined && options.origin !== null) {
    headers.Origin = options.origin;
  }
  if (options?.cookie) {
    headers.Cookie = options.cookie;
  }
  let body: string | undefined;
  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${pathName}`, { method, headers, body });
  const contentType = response.headers.get("content-type") ?? "";
  const parsedBody = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    status: response.status,
    headers: response.headers,
    body: parsedBody,
    setCookie: response.headers.get("set-cookie"),
  };
}

async function main() {
  const testUrl = await resetTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  migrateDeploy(testUrl);

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISSUER = JWT_ISSUER;
  process.env.JWT_AUDIENCE = JWT_AUDIENCE;
  process.env.WEB_ORIGINS = TRUSTED_ORIGIN;
  process.env.TRUST_PROXY = "0";
  process.env.SESSION_COOKIE_NAME = COOKIE_NAME;

  const { createApp } = await import("../src/app.js");
  const { prisma } = await import("../src/lib/prisma.js");
  const { Role } = await import("../src/generated/prisma/client.js");
  const { env } = await import("../src/config/env.js");

  assert(env.NODE_ENV === "test", "NODE_ENV should be test for role-boundary routes");
  assert(env.TRUST_PROXY === false, "TRUST_PROXY should be disabled for spoofing checks");

  async function listen(appInstance: ReturnType<typeof createApp>): Promise<{
    server: Server;
    baseUrl: string;
  }> {
    const server: Server = createServer(appInstance);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address === "object", "server should expose an address");
    return { server, baseUrl: `http://127.0.0.1:${address.port}` };
  }

  const { server, baseUrl } = await listen(createApp());

  try {
    const mentorEmail = "mentor-auth@example.com";
    const mentorPassword = "mentor-pass-ok";
    await prisma.user.create({
      data: {
        name: "Seeded Mentor",
        email: mentorEmail,
        passwordHash: await bcrypt.hash(mentorPassword, 12),
        role: Role.MENTOR,
      },
    });

    // Signup creates STUDENT, normalizes email, hashes password, sets cookie.
    const signup = await requestJson(baseUrl, "POST", "/api/auth/signup", {
      origin: TRUSTED_ORIGIN,
      body: {
        name: "  Ada Student  ",
        email: "  Ada.Student@Example.com ",
        password: "student-pass-1",
      },
    });
    assert(signup.status === 201, `signup expected 201, got ${signup.status}`);
    const signupUser = (signup.body as { user: { email: string; role: string; name: string } })
      .user;
    assert(signupUser.email === "ada.student@example.com", "email should be normalized");
    assert(signupUser.name === "Ada Student", "name should be trimmed");
    assert(signupUser.role === "STUDENT", "signup must create STUDENT");
    const cookie = parseSetCookie(signup.setCookie);
    assert(cookie.name === COOKIE_NAME, "session cookie name mismatch");
    assert(cookie.httponly === "true", "cookie must be HttpOnly");
    assert(cookie.path === "/", "cookie path must be /");
    assert(cookie.samesite?.toLowerCase() === "lax", "cookie SameSite must be Lax");
    assert(!("secure" in cookie), "Secure must be off outside production");
    assert(Boolean(cookie.value), "cookie value missing");
    assert(!(signup.body as { token?: string }).token, "token must not appear in JSON response");

    const stored = await prisma.user.findUniqueOrThrow({
      where: { email: "ada.student@example.com" },
    });
    assert(stored.passwordHash !== "student-pass-1", "password must be hashed");
    assert(await bcrypt.compare("student-pass-1", stored.passwordHash), "hash must verify");

    // Role injection rejected by strict schema.
    const roleInjection = await requestJson(baseUrl, "POST", "/api/auth/signup", {
      origin: TRUSTED_ORIGIN,
      body: {
        name: "Hacker",
        email: "hacker@example.com",
        password: "student-pass-1",
        role: "MENTOR",
      },
    });
    assert(roleInjection.status === 400, "role injection must be rejected");

    // Duplicate signup.
    const duplicate = await requestJson(baseUrl, "POST", "/api/auth/signup", {
      origin: TRUSTED_ORIGIN,
      body: {
        name: "Ada Again",
        email: "ada.student@example.com",
        password: "student-pass-1",
      },
    });
    assert(duplicate.status === 409, `duplicate signup expected 409, got ${duplicate.status}`);

    // Concurrent duplicate requests.
    const concurrentEmail = "race@example.com";
    const [first, second] = await Promise.all([
      requestJson(baseUrl, "POST", "/api/auth/signup", {
        origin: TRUSTED_ORIGIN,
        body: { name: "Race One", email: concurrentEmail, password: "student-pass-1" },
      }),
      requestJson(baseUrl, "POST", "/api/auth/signup", {
        origin: TRUSTED_ORIGIN,
        body: { name: "Race Two", email: concurrentEmail, password: "student-pass-1" },
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    assert(
      statuses[0] === 201 && statuses[1] === 409,
      `concurrent signup expected 201+409, got ${statuses.join(",")}`,
    );
    assert(
      (await prisma.user.count({ where: { email: concurrentEmail } })) === 1,
      "concurrent signup must create one user",
    );

    // Student login + /me
    const login = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "ada.student@example.com", password: "student-pass-1" },
    });
    assert(login.status === 200, `student login expected 200, got ${login.status}`);
    const studentCookie = `${COOKIE_NAME}=${parseSetCookie(login.setCookie).value}`;

    const me = await requestJson(baseUrl, "GET", "/api/auth/me", { cookie: studentCookie });
    assert(me.status === 200, `/me expected 200, got ${me.status}`);
    assert(me.headers.get("cache-control")?.includes("no-store"), "/me must be no-store");
    const meUser = (me.body as { user: Record<string, unknown> }).user;
    assert(meUser.email === "ada.student@example.com", "/me email mismatch");
    assert(!("passwordHash" in meUser), "/me must not expose passwordHash");

    // Mentor login
    const mentorLogin = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: mentorEmail, password: mentorPassword },
    });
    assert(mentorLogin.status === 200, `mentor login expected 200, got ${mentorLogin.status}`);
    const mentorCookie = `${COOKIE_NAME}=${parseSetCookie(mentorLogin.setCookie).value}`;

    // Invalid credentials share one message.
    const badEmail = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "missing@example.com", password: "student-pass-1" },
    });
    const badPassword = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "ada.student@example.com", password: "wrong-password" },
    });
    assert(badEmail.status === 401 && badPassword.status === 401, "bad credentials must be 401");
    assert(
      (badEmail.body as { error: { message: string } }).error.message ===
        (badPassword.body as { error: { message: string } }).error.message,
      "unknown email and bad password must share the same message",
    );

    // Malformed input
    const malformed = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "not-an-email", password: "" },
    });
    assert(malformed.status === 400, "malformed login must be 400");

    // Missing auth
    const missing = await requestJson(baseUrl, "GET", "/api/auth/me");
    assert(missing.status === 401, "missing session must be 401");

    // Tampered / wrong claims tokens
    const secret = new TextEncoder().encode(JWT_SECRET);
    const validUserId = stored.id;

    async function cookieForToken(token: string) {
      return requestJson(baseUrl, "GET", "/api/auth/me", {
        cookie: `${COOKIE_NAME}=${token}`,
      });
    }

    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(validUserId)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime("0s")
      .sign(secret);
    assert((await cookieForToken(expired)).status === 401, "expired token must be 401");

    const missingExpiry = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(validUserId)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .sign(secret);
    assert((await cookieForToken(missingExpiry)).status === 401, "missing expiry must be 401");

    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(validUserId)
      .setIssuer("other-issuer")
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime("30m")
      .sign(secret);
    assert((await cookieForToken(wrongIssuer)).status === 401, "wrong issuer must be 401");

    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(validUserId)
      .setIssuer(JWT_ISSUER)
      .setAudience("other-audience")
      .setExpirationTime("30m")
      .sign(secret);
    assert((await cookieForToken(wrongAudience)).status === 401, "wrong audience must be 401");

    const tamperedParts = parseSetCookie(login.setCookie).value.split(".");
    tamperedParts[2] = "invalidsignature";
    assert(
      (await cookieForToken(tamperedParts.join("."))).status === 401,
      "tampered token must be 401",
    );

    const wrongAlgHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    );
    const wrongAlgPayload = Buffer.from(
      JSON.stringify({
        sub: validUserId,
        iss: JWT_ISSUER,
        aud: JWT_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    assert(
      (await cookieForToken(`${wrongAlgHeader}.${wrongAlgPayload}.`)).status === 401,
      "wrong algorithm must be 401",
    );

    // Deleted user session
    const doomed = await prisma.user.create({
      data: {
        name: "Doomed",
        email: "doomed@example.com",
        passwordHash: await bcrypt.hash("student-pass-1", 12),
        role: Role.STUDENT,
      },
    });
    const doomedLogin = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "doomed@example.com", password: "student-pass-1" },
    });
    const doomedCookie = `${COOKIE_NAME}=${parseSetCookie(doomedLogin.setCookie).value}`;
    await prisma.user.delete({ where: { id: doomed.id } });
    assert(
      (await requestJson(baseUrl, "GET", "/api/auth/me", { cookie: doomedCookie })).status === 401,
      "deleted user session must be 401",
    );

    // Role boundaries via test-only routes
    const studentAreaAsStudent = await requestJson(baseUrl, "GET", "/api/test/student-area", {
      cookie: studentCookie,
    });
    assert(studentAreaAsStudent.status === 200, "student can access student area");
    const mentorAreaAsStudent = await requestJson(baseUrl, "GET", "/api/test/mentor-area", {
      cookie: studentCookie,
    });
    assert(mentorAreaAsStudent.status === 403, "student cannot access mentor area");
    const studentAreaAsMentor = await requestJson(baseUrl, "GET", "/api/test/student-area", {
      cookie: mentorCookie,
    });
    assert(studentAreaAsMentor.status === 403, "mentor cannot access student area");
    const mentorAreaAsMentor = await requestJson(baseUrl, "GET", "/api/test/mentor-area", {
      cookie: mentorCookie,
    });
    assert(mentorAreaAsMentor.status === 200, "mentor can access mentor area");

    // Origin protection
    for (const origin of [undefined, "null", "not-a-url", "http://evil.example"] as const) {
      const blocked = await requestJson(baseUrl, "POST", "/api/auth/logout", {
        origin: origin === undefined ? null : origin,
        cookie: studentCookie,
      });
      // When origin is null we omit the header entirely.
      assert(blocked.status === 403, `origin ${String(origin)} must be rejected`);
    }
    const allowedLogout = await requestJson(baseUrl, "POST", "/api/auth/logout", {
      origin: TRUSTED_ORIGIN,
      cookie: studentCookie,
    });
    assert(allowedLogout.status === 204, "trusted origin logout must succeed");
    const cleared = parseSetCookie(allowedLogout.setCookie);
    assert(cleared.name === COOKIE_NAME, "logout must clear session cookie");
    assert(cleared["max-age"] === "0" || Boolean(cleared.expires), "logout cookie must expire");

    const logoutWithoutSession = await requestJson(baseUrl, "POST", "/api/auth/logout", {
      origin: TRUSTED_ORIGIN,
    });
    assert(logoutWithoutSession.status === 204, "logout without session must still succeed");

    console.info("Core authentication checks passed; verifying rate limits on a fresh app…");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  // Fresh router instances so earlier requests do not consume the limiter budget.
  const rate = await listen(createApp());
  try {
    for (let i = 0; i < 10; i += 1) {
      const limitedAttempt = await requestJson(rate.baseUrl, "POST", "/api/auth/login", {
        origin: TRUSTED_ORIGIN,
        body: { email: "limit@example.com", password: "wrong" },
        headers: { "X-Forwarded-For": `203.0.113.${i}` },
      });
      assert(
        limitedAttempt.status === 401,
        `login attempt ${i + 1} should be 401 before limit, got ${limitedAttempt.status}`,
      );
    }
    const rateLimited = await requestJson(rate.baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "limit@example.com", password: "wrong" },
      headers: { "X-Forwarded-For": "198.51.100.10" },
    });
    assert(rateLimited.status === 429, "11th login must be rate limited");
    assert(
      (rateLimited.body as { error: { retryAfterSeconds?: number } }).error.retryAfterSeconds,
      "429 must include retryAfterSeconds",
    );
    assert(rateLimited.headers.get("retry-after"), "429 must include Retry-After header");

    for (let i = 0; i < 5; i += 1) {
      const attempt = await requestJson(rate.baseUrl, "POST", "/api/auth/signup", {
        origin: TRUSTED_ORIGIN,
        body: {
          name: `Limiter ${i}`,
          email: `signup-limit-${i}@example.com`,
          password: "student-pass-1",
        },
      });
      assert(attempt.status === 201, `signup attempt ${i + 1} expected 201, got ${attempt.status}`);
    }
    const signupLimited = await requestJson(rate.baseUrl, "POST", "/api/auth/signup", {
      origin: TRUSTED_ORIGIN,
      body: {
        name: "Limiter Six",
        email: "signup-limit-6@example.com",
        password: "student-pass-1",
      },
    });
    assert(signupLimited.status === 429, "6th signup must be rate limited");

    console.info("Authentication checks passed.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      rate.server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
    await dropTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
