/**
 * Mentor review integration checks against an isolated disposable PostgreSQL database.
 */
import { config as loadDotenv } from "dotenv";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const TEST_DATABASE_NAME = "reviewdock_phase5_reviews_check";
const TRUSTED_ORIGIN = "http://localhost:3000";
const JWT_SECRET = "phase5-reviews-check-secret-32chars-min!!";
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

function assertNoSecrets(body: unknown, label: string) {
  const raw = JSON.stringify(body);
  assert(!raw.includes("passwordHash"), `${label} leaked passwordHash`);
  assert(!raw.includes("password_hash"), `${label} leaked password_hash`);
  assert(!/"token"\s*:/.test(raw), `${label} leaked token`);
}

type QueueBody = {
  submissions: Array<{
    id: string;
    projectName: string;
    repositoryUrl: string;
    status: string;
    createdAt: string;
    owner: { id: string; name: string; email: string };
    review: {
      decision: string;
      note: string | null;
      functionality: string;
      usability: string;
      documentation: string;
      reviewedAt: string;
      mentor: { id: string; name: string };
    } | null;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type StatsBody = {
  stats: { pending: number; approved: number; rejected: number; total: number };
};

async function runChecks() {
  const testUrl = await resetTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  migrateDeploy(testUrl);

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testUrl;
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.JWT_ISSUER = "reviewdock";
  process.env.JWT_AUDIENCE = "reviewdock-web";
  process.env.WEB_ORIGINS = TRUSTED_ORIGIN;
  process.env.TRUST_PROXY = "0";
  process.env.SESSION_COOKIE_NAME = COOKIE_NAME;

  const { createApp } = await import("../src/app.js");
  const { prisma } = await import("../src/lib/prisma.js");
  const { Role, ReviewDecision, SubmissionStatus } =
    await import("../src/generated/prisma/client.js");
  const { decideSubmission } = await import("../src/modules/reviews/reviews.service.js");

  async function listen(appInstance: ReturnType<typeof createApp>) {
    const server: Server = createServer(appInstance);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert(address && typeof address === "object", "server should expose an address");
    return { server, baseUrl: `http://127.0.0.1:${address.port}` };
  }

  const { server, baseUrl } = await listen(createApp());

  async function signup(name: string, email: string, password: string) {
    const response = await requestJson(baseUrl, "POST", "/api/auth/signup", {
      origin: TRUSTED_ORIGIN,
      body: { name, email, password },
    });
    assert(response.status === 201, `signup ${email} expected 201, got ${response.status}`);
    return `${COOKIE_NAME}=${parseSetCookie(response.setCookie).value}`;
  }

  async function createMentor(name: string, email: string, password: string) {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: Role.MENTOR,
      },
    });
    const login = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email, password },
    });
    assert(login.status === 200, `mentor login failed for ${email}`);
    return {
      user,
      cookie: `${COOKIE_NAME}=${parseSetCookie(login.setCookie).value}`,
    };
  }

  try {
    const studentCookie = await signup("Student R", "student-r@example.com", "student-pass-1");
    const student = await prisma.user.findUniqueOrThrow({
      where: { email: "student-r@example.com" },
    });
    const mentorA = await createMentor("Mentor A", "mentor-a@example.com", "mentor-pass-1");
    const mentorB = await createMentor("Mentor B", "mentor-b@example.com", "mentor-pass-1");

    // Empty database statistics
    const emptyStats = await requestJson(baseUrl, "GET", "/api/reviews/stats", {
      cookie: mentorA.cookie,
    });
    assert(emptyStats.status === 200, "empty stats expected 200");
    assert(emptyStats.headers.get("cache-control")?.includes("no-store"), "stats must be no-store");
    assertNoSecrets(emptyStats.body, "empty stats");
    assert(
      JSON.stringify((emptyStats.body as StatsBody).stats) ===
        JSON.stringify({ pending: 0, approved: 0, rejected: 0, total: 0 }),
      "empty stats must be zeros",
    );

    // Authz on every route
    for (const [method, pathName] of [
      ["GET", "/api/reviews/submissions"],
      ["GET", "/api/reviews/stats"],
      ["POST", "/api/reviews/submissions/missing/decision"],
    ] as const) {
      const unauth = await requestJson(baseUrl, method, pathName, {
        origin: method === "POST" ? TRUSTED_ORIGIN : undefined,
        body: method === "POST" ? { decision: "APPROVED" } : undefined,
      });
      assert(unauth.status === 401, `${method} ${pathName} unauth expected 401`);

      const studentBlocked = await requestJson(baseUrl, method, pathName, {
        origin: method === "POST" ? TRUSTED_ORIGIN : undefined,
        cookie: studentCookie,
        body: method === "POST" ? { decision: "APPROVED" } : undefined,
      });
      assert(studentBlocked.status === 403, `${method} ${pathName} student expected 403`);
    }

    const fixedTime = new Date("2026-01-15T12:00:00.000Z");
    const seeded = await Promise.all(
      Array.from({ length: 12 }, async (_, index) => {
        const status =
          index < 5
            ? SubmissionStatus.PENDING
            : index < 8
              ? SubmissionStatus.APPROVED
              : SubmissionStatus.REJECTED;
        const submission = await prisma.submission.create({
          data: {
            ownerId: student.id,
            projectName: `Project ${String(index).padStart(2, "0")}`,
            repositoryUrl: `https://github.com/reviews/project-${index}`,
            canonicalRepositoryUrl: `https://github.com/reviews/project-${index}`,
            liveUrl: `https://project-${index}.example.com`,
            description: `Description for project ${index} that is long enough.`,
            status: SubmissionStatus.PENDING,
            createdAt: fixedTime,
          },
        });

        if (status !== SubmissionStatus.PENDING) {
          await prisma.submission.update({
            where: { id: submission.id },
            data: { status },
          });
          await prisma.review.create({
            data: {
              submissionId: submission.id,
              mentorId: mentorA.user.id,
              decision:
                status === SubmissionStatus.APPROVED
                  ? ReviewDecision.APPROVED
                  : ReviewDecision.REJECTED,
              note:
                status === SubmissionStatus.REJECTED
                  ? "Needs a clearer README and setup steps."
                  : null,
              reviewedAt: fixedTime,
            },
          });
        }

        return submission;
      }),
    );

    // Defaults: PENDING, page 1, pageSize 10
    const defaults = await requestJson(baseUrl, "GET", "/api/reviews/submissions", {
      cookie: mentorA.cookie,
    });
    assert(defaults.status === 200, "defaults list expected 200");
    assert(defaults.headers.get("cache-control")?.includes("no-store"), "queue must be no-store");
    assertNoSecrets(defaults.body, "defaults queue");
    const defaultsBody = defaults.body as QueueBody;
    assert(defaultsBody.pagination.page === 1, "default page");
    assert(defaultsBody.pagination.pageSize === 10, "default pageSize");
    assert(defaultsBody.pagination.total === 5, "default filter pending total");
    assert(defaultsBody.submissions.length === 5, "default pending rows");
    assert(
      defaultsBody.submissions.every((item) => item.status === "PENDING"),
      "default filter must be pending only",
    );

    // Query validation
    const invalidQueries: Array<{ query: string; label: string }> = [
      { query: "page=0", label: "page zero" },
      { query: "page=-1", label: "page negative" },
      { query: "page=1.5", label: "page fractional" },
      { query: "page=abc", label: "page non-numeric" },
      { query: "pageSize=0", label: "pageSize zero" },
      { query: "pageSize=51", label: "pageSize over max" },
      { query: "pageSize=1.2", label: "pageSize fractional" },
      { query: "status=WAITING", label: "unknown status" },
      { query: "page=1&page=2", label: "repeated page" },
      { query: "status=PENDING&status=ALL", label: "repeated status" },
      { query: `q=${"x".repeat(101)}`, label: "q too long" },
      { query: "q=alpha&q=beta", label: "repeated q" },
    ];
    for (const testCase of invalidQueries) {
      const response = await requestJson(
        baseUrl,
        "GET",
        `/api/reviews/submissions?${testCase.query}`,
        { cookie: mentorA.cookie },
      );
      assert(response.status === 400, `${testCase.label} expected 400, got ${response.status}`);
    }

    // Deterministic ordering when timestamps match (createdAt desc, id desc)
    const pendingOrdered = defaultsBody.submissions.map((item) => item.id);
    const expectedOrder = [...seeded]
      .filter((_, index) => index < 5)
      .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .map((item) => item.id);
    assert(
      pendingOrdered.join(",") === expectedOrder.join(","),
      `ordering mismatch: ${pendingOrdered.join(",")} vs ${expectedOrder.join(",")}`,
    );

    // Status filters + filtered totals vs global stats
    const stats = await requestJson(baseUrl, "GET", "/api/reviews/stats", {
      cookie: mentorA.cookie,
    });
    const statsBody = (stats.body as StatsBody).stats;
    assert(
      statsBody.pending === 5 &&
        statsBody.approved === 3 &&
        statsBody.rejected === 4 &&
        statsBody.total === 12,
      `unexpected global stats: ${JSON.stringify(statsBody)}`,
    );

    for (const [status, expectedTotal] of [
      ["ALL", 12],
      ["PENDING", 5],
      ["APPROVED", 3],
      ["REJECTED", 4],
    ] as const) {
      const response = await requestJson(
        baseUrl,
        "GET",
        `/api/reviews/submissions?status=${status}&pageSize=50`,
        { cookie: mentorA.cookie },
      );
      assert(response.status === 200, `${status} filter expected 200`);
      const body = response.body as QueueBody;
      assert(body.pagination.total === expectedTotal, `${status} filtered total`);
      assert(body.submissions.length === expectedTotal, `${status} row count`);
      if (status !== "ALL") {
        assert(
          body.submissions.every((item) => item.status === status),
          `${status} rows must match`,
        );
      }
    }

    // Pagination boundaries
    const page1 = await requestJson(
      baseUrl,
      "GET",
      "/api/reviews/submissions?status=ALL&page=1&pageSize=5",
      { cookie: mentorA.cookie },
    );
    const page1Body = page1.body as QueueBody;
    assert(page1Body.submissions.length === 5, "page 1 size");
    assert(page1Body.pagination.totalPages === 3, "total pages");
    assert(page1Body.pagination.hasNextPage === true, "has next");
    assert(page1Body.pagination.hasPreviousPage === false, "no previous");

    const page3 = await requestJson(
      baseUrl,
      "GET",
      "/api/reviews/submissions?status=ALL&page=3&pageSize=5",
      { cookie: mentorA.cookie },
    );
    const page3Body = page3.body as QueueBody;
    assert(page3Body.submissions.length === 2, "last page size");
    assert(page3Body.pagination.hasNextPage === false, "last page no next");
    assert(page3Body.pagination.hasPreviousPage === true, "last page has previous");

    const outOfRange = await requestJson(
      baseUrl,
      "GET",
      "/api/reviews/submissions?status=ALL&page=9&pageSize=5",
      { cookie: mentorA.cookie },
    );
    const outBody = outOfRange.body as QueueBody;
    assert(outBody.submissions.length === 0, "out-of-range page empty");
    assert(outBody.pagination.total === 12, "out-of-range keeps filtered total");
    assert(outBody.pagination.totalPages === 3, "out-of-range keeps totalPages");
    assert(outBody.pagination.page === 9, "out-of-range reports requested page");

    // Approval with and without notes
    const pendingIds = defaultsBody.submissions.map((item) => item.id);
    const approveNoNote = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[0]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "APPROVED", note: "   " },
      },
    );
    assert(approveNoNote.status === 200, "approve blank note expected 200");
    const approvedBlank = (
      approveNoNote.body as {
        submission: {
          status: string;
          review: { note: string | null; mentor: { id: string }; reviewedAt: string };
        };
      }
    ).submission;
    assert(approvedBlank.status === "APPROVED", "status approved");
    assert(approvedBlank.review.note === null, "blank note normalized to null");
    assert(approvedBlank.review.mentor.id === mentorA.user.id, "reviewer identity");
    assert(typeof approvedBlank.review.reviewedAt === "string", "reviewedAt present");

    const approveWithNote = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[1]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "APPROVED", note: "  Clear structure and demo.  " },
      },
    );
    assert(approveWithNote.status === 200, "approve with note expected 200");
    const approvedNoted = (
      approveWithNote.body as { submission: { review: { note: string | null } } }
    ).submission;
    assert(approvedNoted.review.note === "Clear structure and demo.", "note trimmed");

    // Rejection validation
    const shortReject = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[2]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "REJECTED", note: "too short" },
      },
    );
    assert(shortReject.status === 400, "short rejection note expected 400");

    const longReject = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[2]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "REJECTED", note: "n".repeat(1001) },
      },
    );
    assert(longReject.status === 400, "long rejection note expected 400");

    const missingReject = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[2]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "REJECTED" },
      },
    );
    assert(missingReject.status === 400, "missing rejection note expected 400");

    const rejectOk = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[2]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: {
          decision: "REJECTED",
          note: "  Please improve the README and deployment notes.  ",
        },
      },
    );
    assert(rejectOk.status === 200, "valid rejection expected 200");
    const rejected = (
      rejectOk.body as {
        submission: { status: string; review: { note: string | null; mentor: { id: string } } };
      }
    ).submission;
    assert(rejected.status === "REJECTED", "rejected status");
    assert(
      rejected.review.note === "Please improve the README and deployment notes.",
      "rejection note trimmed",
    );

    // Missing submission
    const missing = await requestJson(
      baseUrl,
      "POST",
      "/api/reviews/submissions/does-not-exist/decision",
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "APPROVED" },
      },
    );
    assert(missing.status === 404, "missing submission expected 404");

    // Repeated decision must not overwrite
    const originalReview = await prisma.review.findUniqueOrThrow({
      where: { submissionId: pendingIds[0] },
    });
    const repeat = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[0]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorB.cookie,
        body: { decision: "REJECTED", note: "Attempting to overwrite the first decision." },
      },
    );
    assert(repeat.status === 409, "repeat decision expected 409");
    const stillOriginal = await prisma.review.findUniqueOrThrow({
      where: { submissionId: pendingIds[0] },
    });
    assert(stillOriginal.mentorId === originalReview.mentorId, "reviewer preserved");
    assert(stillOriginal.note === originalReview.note, "note preserved");
    assert(
      stillOriginal.reviewedAt.getTime() === originalReview.reviewedAt.getTime(),
      "timestamp preserved",
    );
    assert(stillOriginal.decision === ReviewDecision.APPROVED, "decision preserved");

    // Trusted Origin on decision
    const noOrigin = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[3]}/decision`,
      {
        origin: null,
        cookie: mentorA.cookie,
        body: { decision: "APPROVED" },
      },
    );
    assert(noOrigin.status === 403, "missing origin expected 403");

    const badOrigin = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[3]}/decision`,
      {
        origin: "http://evil.example",
        cookie: mentorA.cookie,
        body: { decision: "APPROVED" },
      },
    );
    assert(badOrigin.status === 403, "bad origin expected 403");

    // Forged privileged fields
    const forged = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[3]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: {
          decision: "APPROVED",
          mentorId: mentorB.user.id,
          reviewedAt: "2000-01-01T00:00:00.000Z",
          submissionId: pendingIds[4],
          status: "REJECTED",
        },
      },
    );
    assert(forged.status === 400, "forged privileged fields expected 400");

    // Concurrent decisions: exactly one success, one conflict, one review
    const raceTarget = pendingIds[3]!;
    const [raceOne, raceTwo] = await Promise.all([
      requestJson(baseUrl, "POST", `/api/reviews/submissions/${raceTarget}/decision`, {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: { decision: "APPROVED", note: "Mentor A wins race." },
      }),
      requestJson(baseUrl, "POST", `/api/reviews/submissions/${raceTarget}/decision`, {
        origin: TRUSTED_ORIGIN,
        cookie: mentorB.cookie,
        body: {
          decision: "REJECTED",
          note: "Mentor B tries to reject during the race window.",
        },
      }),
    ]);
    const raceStatuses = [raceOne.status, raceTwo.status].sort();
    assert(
      raceStatuses[0] === 200 && raceStatuses[1] === 409,
      `concurrent decision expected 200+409, got ${raceStatuses.join(",")}`,
    );
    const raceReviews = await prisma.review.findMany({ where: { submissionId: raceTarget } });
    assert(raceReviews.length === 1, "concurrent race must leave one review");
    const raceSubmission = await prisma.submission.findUniqueOrThrow({
      where: { id: raceTarget },
    });
    assert(
      (raceReviews[0]!.decision === ReviewDecision.APPROVED &&
        raceSubmission.status === SubmissionStatus.APPROVED) ||
        (raceReviews[0]!.decision === ReviewDecision.REJECTED &&
          raceSubmission.status === SubmissionStatus.REJECTED),
      "final status must match the winning review",
    );

    // Transaction rollback when review creation fails
    const rollbackTarget = pendingIds[4]!;
    let rolledBack = false;
    try {
      await decideSubmission(rollbackTarget, "nonexistent-mentor-id", {
        decision: ReviewDecision.APPROVED,
        note: null,
        checkpoints: {
          functionality: "NOT_ASSESSED",
          usability: "NOT_ASSESSED",
          documentation: "NOT_ASSESSED",
        },
      });
    } catch {
      rolledBack = true;
    }
    assert(rolledBack, "invalid mentor should fail review create");
    const afterRollback = await prisma.submission.findUniqueOrThrow({
      where: { id: rollbackTarget },
    });
    assert(afterRollback.status === SubmissionStatus.PENDING, "status must stay PENDING");
    assert(
      (await prisma.review.count({ where: { submissionId: rollbackTarget } })) === 0,
      "no orphaned review after rollback",
    );

    // Structured checkpoints persist atomically with the decision; legacy clients omit them.
    const checkpointTarget = rollbackTarget;
    const withCheckpoints = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${checkpointTarget}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: {
          decision: "APPROVED",
          note: "Solid demo with clear docs.",
          checkpoints: {
            functionality: "MEETS_EXPECTATIONS",
            usability: "NEEDS_IMPROVEMENT",
            documentation: "MEETS_EXPECTATIONS",
          },
        },
      },
    );
    assert(withCheckpoints.status === 200, "checkpoint decision expected 200");
    const checkpointed = (
      withCheckpoints.body as {
        submission: {
          status: string;
          review: {
            functionality: string;
            usability: string;
            documentation: string;
            note: string | null;
          };
        };
      }
    ).submission;
    assert(checkpointed.status === "APPROVED", "checkpoint decision approved");
    assert(checkpointed.review.functionality === "MEETS_EXPECTATIONS", "functionality stored");
    assert(checkpointed.review.usability === "NEEDS_IMPROVEMENT", "usability stored");
    assert(checkpointed.review.documentation === "MEETS_EXPECTATIONS", "documentation stored");
    assert(
      checkpointed.review.note === "Solid demo with clear docs.",
      "note stored with checkpoints",
    );

    const invalidCheckpoint = await requestJson(
      baseUrl,
      "POST",
      `/api/reviews/submissions/${pendingIds[0]}/decision`,
      {
        origin: TRUSTED_ORIGIN,
        cookie: mentorA.cookie,
        body: {
          decision: "APPROVED",
          checkpoints: { functionality: "GREAT" },
        },
      },
    );
    assert(invalidCheckpoint.status === 400, "invalid checkpoint expected 400");

    // Legacy seeded reviews (no checkpoint columns set beyond DB default) read as NOT_ASSESSED.
    const legacyList = await requestJson(
      baseUrl,
      "GET",
      "/api/reviews/submissions?status=REJECTED&pageSize=50",
      { cookie: mentorA.cookie },
    );
    assert(legacyList.status === 200, "legacy list expected 200");
    const legacyRows = (legacyList.body as QueueBody).submissions;
    assert(legacyRows.length >= 1, "expected legacy rejected rows");
    assert(
      legacyRows.every(
        (row) =>
          row.review &&
          row.review.functionality === "NOT_ASSESSED" &&
          row.review.usability === "NOT_ASSESSED" &&
          row.review.documentation === "NOT_ASSESSED",
      ),
      "legacy reviews must display as unassessed",
    );

    // Search combines with status; pagination/count apply; global stats stay independent.
    const statsBeforeSearch = await requestJson(baseUrl, "GET", "/api/reviews/stats", {
      cookie: mentorA.cookie,
    });
    const statsBefore = (statsBeforeSearch.body as StatsBody).stats;
    const searchPending = await requestJson(
      baseUrl,
      "GET",
      "/api/reviews/submissions?status=PENDING&q=Project%2003&pageSize=50",
      { cookie: mentorA.cookie },
    );
    assert(searchPending.status === 200, "search pending expected 200");
    const searchBody = searchPending.body as QueueBody;
    assert(searchBody.pagination.total === 0, "Project 03 is no longer pending after decisions");
    const knownApproved = await prisma.submission.findFirstOrThrow({
      where: { status: SubmissionStatus.APPROVED },
      select: { repositoryUrl: true, projectName: true },
    });
    const repoNeedle = knownApproved.repositoryUrl.replace(/^https:\/\//, "").slice(0, 40);
    const searchApproved = await requestJson(
      baseUrl,
      "GET",
      `/api/reviews/submissions?status=APPROVED&q=${encodeURIComponent(repoNeedle)}&pageSize=50`,
      { cookie: mentorA.cookie },
    );
    assert(searchApproved.status === 200, "search approved expected 200");
    const searchApprovedBody = searchApproved.body as QueueBody;
    assert(searchApprovedBody.pagination.total >= 1, "repository search should match");
    assert(
      searchApprovedBody.submissions.every((row) =>
        row.repositoryUrl.toLowerCase().includes(repoNeedle.toLowerCase()),
      ),
      "search rows must match repository query",
    );
    const searchByName = await requestJson(
      baseUrl,
      "GET",
      `/api/reviews/submissions?status=APPROVED&q=${encodeURIComponent(knownApproved.projectName)}&pageSize=50`,
      { cookie: mentorA.cookie },
    );
    assert(searchByName.status === 200, "project name search expected 200");
    assert(
      (searchByName.body as QueueBody).pagination.total >= 1,
      "project name search should match",
    );
    const searchStudent = await requestJson(
      baseUrl,
      "GET",
      "/api/reviews/submissions?status=ALL&q=Student%20R&pageSize=50",
      { cookie: mentorA.cookie },
    );
    assert(searchStudent.status === 200, "student name search expected 200");
    assert(
      (searchStudent.body as QueueBody).pagination.total >= 1,
      "student name search should return rows",
    );
    const statsAfterSearch = await requestJson(baseUrl, "GET", "/api/reviews/stats", {
      cookie: mentorA.cookie,
    });
    assert(
      JSON.stringify((statsAfterSearch.body as StatsBody).stats) === JSON.stringify(statsBefore),
      "global stats must not change when only search/filter changes",
    );

    // Exact numeric statistics after the decisions above (race winner is either approve or reject).
    const finalStats = (statsAfterSearch.body as StatsBody).stats;
    assert(finalStats.pending === 0, `pending must be 0, got ${finalStats.pending}`);
    assert(finalStats.total === 12, `total must be 12, got ${finalStats.total}`);
    assert(
      (finalStats.approved === 7 && finalStats.rejected === 5) ||
        (finalStats.approved === 6 && finalStats.rejected === 6),
      `unexpected approved/rejected after race: ${JSON.stringify(finalStats)}`,
    );

    // Student sees updated status/feedback through /mine
    const mine = await requestJson(baseUrl, "GET", "/api/submissions/mine", {
      cookie: studentCookie,
    });
    assert(mine.status === 200, "student mine expected 200");
    const mineRows = (
      mine.body as {
        submissions: Array<{
          id: string;
          status: string;
          review: {
            note: string | null;
            decision: string;
            functionality: string;
            usability: string;
            documentation: string;
          } | null;
        }>;
      }
    ).submissions;
    const rejectedMine = mineRows.find((item) => item.id === pendingIds[2]);
    assert(rejectedMine?.status === "REJECTED", "student sees rejected status");
    assert(rejectedMine?.review?.note?.includes("README"), "student sees rejection feedback");
    const approvedMine = mineRows.find((item) => item.id === pendingIds[0]);
    assert(approvedMine?.status === "APPROVED", "student sees approved status");
    const checkpointMine = mineRows.find((item) => item.id === checkpointTarget);
    assert(
      checkpointMine?.review?.functionality === "MEETS_EXPECTATIONS",
      "student sees checkpoint",
    );
    assert(checkpointMine?.review?.usability === "NEEDS_IMPROVEMENT", "student sees usability");

    console.info("Review checks passed.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  }
}

async function main() {
  // Cleanup also covers migration/import failures and failures before the limiter phase.
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
