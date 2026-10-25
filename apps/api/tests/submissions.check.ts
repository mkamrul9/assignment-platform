/**
 * Submission integration checks against an isolated disposable PostgreSQL database.
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

const TEST_DATABASE_NAME = "reviewdock_phase4_submissions_check";
const TRUSTED_ORIGIN = "http://localhost:3000";
const JWT_SECRET = "phase4-submissions-check-secret-32chars-min";
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

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    projectName: "Demo Project",
    repositoryUrl: "https://github.com/example/demo",
    liveUrl: "https://demo.example.com",
    description: "A long enough description for the submission checks.",
    ...overrides,
  };
}

async function runChecks() {
  const { canonicalizeRepositoryUrl } = await import("../src/lib/canonical-repository-url.js");

  const examples = [
    "https://github.com/Owner/Repo",
    "https://github.com/owner/repo/",
    "https://github.com/OWNER/REPO.git?tab=readme#top",
  ];
  for (const [input, expected] of [
    ["https://git.example.com:8443/Org/Repo/", "https://git.example.com:8443/Org/Repo"],
    ["https://www.git.example.com/Org/Repo", "https://www.git.example.com/Org/Repo"],
    ["https://git.example.com/Org//Repo", "https://git.example.com/Org//Repo"],
    ["https://github.com/Owner/Repo/.git", "https://github.com/owner/repo"],
  ]) {
    const normalized = canonicalizeRepositoryUrl(input!);
    assert(normalized === expected, `meaningful URL components lost: ${input}`);
    assert(canonicalizeRepositoryUrl(normalized) === normalized, `not idempotent: ${input}`);
  }
  const canonical = examples.map(canonicalizeRepositoryUrl);
  assert(
    canonical.every((value) => value === "https://github.com/owner/repo"),
    `GitHub canonicalization failed: ${canonical.join(" | ")}`,
  );
  assert(
    canonicalizeRepositoryUrl(canonical[0]!) === canonical[0],
    "canonicalization must be idempotent",
  );
  assert(
    canonicalizeRepositoryUrl("https://gitlab.com/Org/Project/") ===
      "https://gitlab.com/Org/Project",
    "non-GitHub path case must be preserved",
  );

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
  // Core checks create several students; keep rate limits for the dedicated rate phase only.
  process.env.SIGNUP_RATE_LIMIT_MAX = "100";
  process.env.SUBMISSION_RATE_LIMIT_MAX = "100";

  const { createApp } = await import("../src/app.js");
  const { prisma } = await import("../src/lib/prisma.js");
  const { Role, ReviewDecision, SubmissionStatus } =
    await import("../src/generated/prisma/client.js");

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

  try {
    const studentA = await signup("Student A", "student-a@example.com", "student-pass-1");
    const studentB = await signup("Student B", "student-b@example.com", "student-pass-1");
    const validationCookies = [
      await signup("Student V1", "student-v1@example.com", "student-pass-1"),
      await signup("Student V2", "student-v2@example.com", "student-pass-1"),
      await signup("Student V3", "student-v3@example.com", "student-pass-1"),
    ];

    const mentor = await prisma.user.create({
      data: {
        name: "Mentor",
        email: "mentor-submissions@example.com",
        passwordHash: await bcrypt.hash("mentor-pass-1", 12),
        role: Role.MENTOR,
      },
    });
    const mentorLogin = await requestJson(baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: mentor.email, password: "mentor-pass-1" },
    });
    assert(mentorLogin.status === 200, "mentor login failed");
    const mentorCookie = `${COOKIE_NAME}=${parseSetCookie(mentorLogin.setCookie).value}`;

    const created = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: studentA,
      body: validPayload({
        repositoryUrl: "https://github.com/Owner/Phase4Demo.git?ref=main#readme",
      }),
    });
    assert(created.status === 201, `create expected 201, got ${created.status}`);
    const submission = (
      created.body as {
        submission: {
          id: string;
          status: string;
          canonicalRepositoryUrl: string;
          repositoryUrl: string;
        };
      }
    ).submission;
    assert(submission.status === "PENDING", "new submission must be PENDING");
    assert(
      submission.canonicalRepositoryUrl === "https://github.com/owner/phase4demo",
      `unexpected canonical URL: ${submission.canonicalRepositoryUrl}`,
    );
    assert(
      submission.repositoryUrl.includes("Owner/Phase4Demo"),
      "original repository URL must be preserved",
    );

    const stored = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
    assert(stored.ownerId !== undefined, "owner must be stored");

    // Validation cases
    const validationCases: Array<{ body: Record<string, unknown>; label: string }> = [
      { label: "missing projectName", body: validPayload({ projectName: undefined }) },
      { label: "short name", body: validPayload({ projectName: "ab" }) },
      { label: "long name", body: validPayload({ projectName: "n".repeat(101) }) },
      { label: "whitespace name", body: validPayload({ projectName: "   " }) },
      { label: "short description", body: validPayload({ description: "too short" }) },
      {
        label: "long description",
        body: validPayload({ description: "d".repeat(5001) }),
      },
      {
        label: "whitespace description",
        body: validPayload({ description: "                    " }),
      },
      { label: "http repo", body: validPayload({ repositoryUrl: "http://github.com/a/b" }) },
      { label: "malformed live", body: validPayload({ liveUrl: "not-a-url" }) },
      {
        label: "long live url",
        body: validPayload({ liveUrl: `https://example.com/${"a".repeat(2048)}` }),
      },
      {
        label: "credentials",
        body: validPayload({ repositoryUrl: "https://user:pass@github.com/a/b" }),
      },
    ];
    for (const [index, testCase] of validationCases.entries()) {
      const response = await requestJson(baseUrl, "POST", "/api/submissions", {
        origin: TRUSTED_ORIGIN,
        cookie: validationCookies[index % validationCookies.length],
        body: testCase.body,
      });
      assert(response.status === 400, `${testCase.label} expected 400, got ${response.status}`);
    }

    // Privileged fields rejected by strict schema
    const forged = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: validationCookies[0],
      body: validPayload({
        repositoryUrl: "https://github.com/example/forged-fields",
        ownerId: mentor.id,
        status: "APPROVED",
        canonicalRepositoryUrl: "https://evil.example/x",
      }),
    });
    assert(forged.status === 400, "forged privileged fields must be rejected");

    const boundaryOk = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: studentA,
      body: validPayload({
        projectName: "abc",
        description: "d".repeat(20),
        repositoryUrl: "https://github.com/boundary/ok",
        liveUrl: "https://boundary.example.com",
      }),
    });
    assert(boundaryOk.status === 201, "minimum boundary lengths should pass");

    // Cross-student equivalent URL conflict
    const conflict = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: studentB,
      body: validPayload({
        projectName: "Other Student Copy",
        repositoryUrl: "https://github.com/owner/phase4demo/",
      }),
    });
    assert(conflict.status === 409, `cross-student duplicate expected 409, got ${conflict.status}`);
    assert(
      !JSON.stringify(conflict.body).includes("student-a@example.com"),
      "conflict response must not disclose another student",
    );

    // Concurrent equivalent submissions
    const [raceOne, raceTwo] = await Promise.all([
      requestJson(baseUrl, "POST", "/api/submissions", {
        origin: TRUSTED_ORIGIN,
        cookie: studentA,
        body: validPayload({
          projectName: "Race One",
          repositoryUrl: "https://github.com/Race/Repo",
          liveUrl: "https://race-one.example.com",
        }),
      }),
      requestJson(baseUrl, "POST", "/api/submissions", {
        origin: TRUSTED_ORIGIN,
        cookie: studentB,
        body: validPayload({
          projectName: "Race Two",
          repositoryUrl: "https://github.com/race/repo.git",
          liveUrl: "https://race-two.example.com",
        }),
      }),
    ]);
    const raceStatuses = [raceOne.status, raceTwo.status].sort();
    assert(
      raceStatuses[0] === 201 && raceStatuses[1] === 409,
      `concurrent create expected 201+409, got ${raceStatuses.join(",")}`,
    );
    assert(
      (await prisma.submission.count({
        where: { canonicalRepositoryUrl: "https://github.com/race/repo" },
      })) === 1,
      "concurrent create must store one row",
    );

    // Duplicate still blocked after review
    const reviewed = await prisma.submission.create({
      data: {
        ownerId: (
          await prisma.user.findUniqueOrThrow({ where: { email: "student-a@example.com" } })
        ).id,
        projectName: "Reviewed Project",
        repositoryUrl: "https://github.com/reviewed/project",
        canonicalRepositoryUrl: "https://github.com/reviewed/project",
        liveUrl: "https://reviewed.example.com",
        description: "Already reviewed project description here.",
        status: SubmissionStatus.REJECTED,
      },
    });
    await prisma.review.create({
      data: {
        submissionId: reviewed.id,
        mentorId: mentor.id,
        decision: ReviewDecision.REJECTED,
        note: "Needs clearer setup instructions for reviewers.",
      },
    });
    const afterReview = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: studentB,
      body: validPayload({
        projectName: "Try Again",
        repositoryUrl: "https://github.com/Reviewed/Project.git",
      }),
    });
    assert(afterReview.status === 409, "reviewed repository must still conflict");

    // Authz
    const unauthenticated = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      body: validPayload({ repositoryUrl: "https://github.com/no/auth" }),
    });
    assert(unauthenticated.status === 401, "missing auth must be 401");

    const mentorBlocked = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: mentorCookie,
      body: validPayload({ repositoryUrl: "https://github.com/mentor/cannot" }),
    });
    assert(mentorBlocked.status === 403, "mentor submit must be 403");

    const mentorListBlocked = await requestJson(baseUrl, "GET", "/api/submissions/mine", {
      cookie: mentorCookie,
    });
    assert(mentorListBlocked.status === 403, "mentor list must be 403");

    // Ownership isolation + review feedback
    const studentBCreate = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: studentB,
      body: validPayload({
        projectName: "Student B Only",
        repositoryUrl: "https://github.com/student-b/only",
        liveUrl: "https://b-only.example.com",
      }),
    });
    assert(studentBCreate.status === 201, "student B create failed");
    const studentBSubmissionId = (studentBCreate.body as { submission: { id: string } }).submission
      .id;

    type MineBody = {
      submissions: Array<{
        id: string;
        projectName: string;
        status: string;
        review: { note: string | null } | null;
      }>;
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
      stats: { pending: number; approved: number; rejected: number; total: number };
    };

    const listA = await requestJson(baseUrl, "GET", "/api/submissions/mine", { cookie: studentA });
    assert(listA.status === 200, "student A list failed");
    assert(listA.headers.get("cache-control")?.includes("no-store"), "list must be no-store");
    const mineA = listA.body as MineBody;
    assert(Array.isArray(mineA.submissions), "mine must include submissions array");
    assert(mineA.pagination && typeof mineA.pagination.total === "number", "mine pagination");
    assert(mineA.stats && typeof mineA.stats.total === "number", "mine stats");
    assert(
      mineA.submissions.every((item) => item.projectName !== "Student B Only"),
      "student A must not see student B projects",
    );
    const reviewedView = mineA.submissions.find((item) => item.projectName === "Reviewed Project");
    assert(reviewedView?.review?.note?.includes("setup instructions"), "review feedback missing");

    const listB = await requestJson(baseUrl, "GET", "/api/submissions/mine?pageSize=50", {
      cookie: studentB,
    });
    const mineB = listB.body as MineBody;
    assert(
      mineB.submissions.every((item) => item.projectName !== "Reviewed Project"),
      "student B must not see student A projects",
    );

    // Defaults, validation, search, pagination, detail authorization
    const browseStudent = await signup(
      "Browse Student",
      "browse-student@example.com",
      "student-pass-1",
    );
    const browseUser = await prisma.user.findUniqueOrThrow({
      where: { email: "browse-student@example.com" },
    });
    const fixedTime = new Date("2024-06-01T12:00:00.000Z");
    const browseSeeds: Array<{ id: string; projectName: string; status: string }> = [];
    for (let i = 0; i < 12; i += 1) {
      const status =
        i < 5
          ? SubmissionStatus.PENDING
          : i < 8
            ? SubmissionStatus.APPROVED
            : SubmissionStatus.REJECTED;
      const submission = await prisma.submission.create({
        data: {
          ownerId: browseUser.id,
          projectName: i % 2 === 0 ? `Alpha Browse ${i}` : `Beta Browse ${i}`,
          repositoryUrl: `https://github.com/browse/repo-${i}`,
          canonicalRepositoryUrl: `https://github.com/browse/repo-${i}`,
          liveUrl: `https://browse-${i}.example.com`,
          description: "Bounded browse description for student workspace checks.",
          status,
          createdAt: fixedTime,
          updatedAt: fixedTime,
        },
      });
      if (status !== SubmissionStatus.PENDING) {
        await prisma.review.create({
          data: {
            submissionId: submission.id,
            mentorId: mentor.id,
            decision:
              status === SubmissionStatus.APPROVED
                ? ReviewDecision.APPROVED
                : ReviewDecision.REJECTED,
            note:
              status === SubmissionStatus.REJECTED
                ? "Needs clearer setup instructions for reviewers."
                : null,
            reviewedAt: fixedTime,
          },
        });
      }
      browseSeeds.push({ id: submission.id, projectName: submission.projectName, status });
    }

    const defaultsMine = await requestJson(baseUrl, "GET", "/api/submissions/mine", {
      cookie: browseStudent,
    });
    assert(defaultsMine.status === 200, "mine defaults expected 200");
    const defaultsMineBody = defaultsMine.body as MineBody;
    assert(defaultsMineBody.pagination.page === 1, "default mine page");
    assert(defaultsMineBody.pagination.pageSize === 10, "default mine pageSize");
    assert(defaultsMineBody.pagination.total === 12, "default mine total");
    assert(defaultsMineBody.submissions.length === 10, "default mine page rows");
    assert(
      defaultsMineBody.stats.total === 12 &&
        defaultsMineBody.stats.pending === 5 &&
        defaultsMineBody.stats.approved === 3 &&
        defaultsMineBody.stats.rejected === 4,
      `unexpected owner stats: ${JSON.stringify(defaultsMineBody.stats)}`,
    );

    const invalidMineQueries: Array<{ query: string; label: string }> = [
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
      { query: "ownerId=forged", label: "unsupported ownerId" },
      { query: "sort=createdAt", label: "unsupported sort" },
    ];
    for (const testCase of invalidMineQueries) {
      const response = await requestJson(
        baseUrl,
        "GET",
        `/api/submissions/mine?${testCase.query}`,
        { cookie: browseStudent },
      );
      assert(response.status === 400, `${testCase.label} expected 400, got ${response.status}`);
    }

    const ordered = defaultsMineBody.submissions.map((item) => item.id);
    const expectedOrder = [...browseSeeds]
      .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
      .slice(0, 10)
      .map((item) => item.id);
    assert(
      ordered.join(",") === expectedOrder.join(","),
      `mine ordering mismatch: ${ordered.join(",")} vs ${expectedOrder.join(",")}`,
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
        `/api/submissions/mine?status=${status}&pageSize=50`,
        { cookie: browseStudent },
      );
      assert(response.status === 200, `mine ${status} expected 200`);
      const body = response.body as MineBody;
      assert(body.pagination.total === expectedTotal, `mine ${status} filtered total`);
      assert(body.submissions.length === expectedTotal, `mine ${status} row count`);
      assert(body.stats.total === 12, "owner stats must stay independent of list filters");
      if (status !== "ALL") {
        assert(
          body.submissions.every((item) => item.status === status),
          `mine ${status} rows must match`,
        );
      }
    }

    const searchMine = await requestJson(
      baseUrl,
      "GET",
      "/api/submissions/mine?q=Alpha&pageSize=50",
      { cookie: browseStudent },
    );
    const searchBody = searchMine.body as MineBody;
    assert(searchBody.pagination.total === 6, "search Alpha total");
    assert(
      searchBody.submissions.every((item) => item.projectName.includes("Alpha")),
      "search must match project names",
    );
    assert(
      searchBody.submissions.every((item) => item.projectName !== "Student B Only"),
      "search must stay owner-scoped",
    );

    const page2 = await requestJson(
      baseUrl,
      "GET",
      "/api/submissions/mine?status=ALL&page=2&pageSize=5",
      { cookie: browseStudent },
    );
    const page2Body = page2.body as MineBody;
    assert(page2Body.submissions.length === 5, "mine page 2 size");
    assert(page2Body.pagination.hasPreviousPage === true, "mine page 2 previous");
    assert(page2Body.pagination.hasNextPage === true, "mine page 2 next");

    const outOfRange = await requestJson(
      baseUrl,
      "GET",
      "/api/submissions/mine?status=ALL&page=99&pageSize=5",
      { cookie: browseStudent },
    );
    const outBody = outOfRange.body as MineBody;
    assert(outBody.submissions.length === 0, "out-of-range mine page empty");
    assert(outBody.pagination.total === 12, "out-of-range keeps total");
    assert(outBody.pagination.page === 99, "out-of-range keeps requested page");
    assert(outBody.pagination.totalPages === 3, "out-of-range totalPages");

    const emptyFilter = await requestJson(baseUrl, "GET", "/api/submissions/mine?q=zzzz-no-match", {
      cookie: browseStudent,
    });
    const emptyBody = emptyFilter.body as MineBody;
    assert(emptyBody.submissions.length === 0, "empty search rows");
    assert(emptyBody.pagination.total === 0 && emptyBody.pagination.totalPages === 0, "empty meta");

    const unauthenticatedMine = await requestJson(baseUrl, "GET", "/api/submissions/mine");
    assert(unauthenticatedMine.status === 401, "unauthenticated mine must be 401");

    const ownId = browseSeeds[0]!.id;
    const ownDetail = await requestJson(baseUrl, "GET", `/api/submissions/${ownId}`, {
      cookie: browseStudent,
    });
    assert(ownDetail.status === 200, "owner detail expected 200");
    assert(ownDetail.headers.get("cache-control")?.includes("no-store"), "detail must be no-store");
    const ownDetailBody = ownDetail.body as {
      submission: {
        id: string;
        projectName: string;
        description: string;
        review: { note: string | null } | null;
        passwordHash?: string;
      };
    };
    assert(ownDetailBody.submission.id === ownId, "detail id");
    assert(ownDetailBody.submission.description.length > 0, "detail description");
    assert(ownDetailBody.submission.passwordHash === undefined, "detail must omit secrets");

    const foreignDetail = await requestJson(
      baseUrl,
      "GET",
      `/api/submissions/${studentBSubmissionId}`,
      { cookie: browseStudent },
    );
    assert(foreignDetail.status === 404, "foreign student detail must be 404");

    const missingDetail = await requestJson(
      baseUrl,
      "GET",
      "/api/submissions/00000000-0000-4000-8000-000000000000",
      { cookie: browseStudent },
    );
    assert(missingDetail.status === 404, "missing detail must be 404");

    const mentorDetail = await requestJson(baseUrl, "GET", `/api/submissions/${ownId}`, {
      cookie: mentorCookie,
    });
    assert(mentorDetail.status === 200, "mentor may read workflow submission");

    const unauthenticatedDetail = await requestJson(baseUrl, "GET", `/api/submissions/${ownId}`);
    assert(unauthenticatedDetail.status === 401, "unauthenticated detail must be 401");

    const mineAsId = await requestJson(baseUrl, "GET", "/api/submissions/mine", {
      cookie: browseStudent,
    });
    assert(mineAsId.status === 200, "/mine must not be captured as :id");

    const deletedBrowse = await prisma.user.delete({ where: { id: browseUser.id } });
    assert(deletedBrowse.id === browseUser.id, "browse user deleted");
    const deletedMine = await requestJson(baseUrl, "GET", "/api/submissions/mine", {
      cookie: browseStudent,
    });
    assert(deletedMine.status === 401, "deleted user mine must be 401");
    const deletedDetail = await requestJson(baseUrl, "GET", `/api/submissions/${ownId}`, {
      cookie: browseStudent,
    });
    assert(deletedDetail.status === 401, "deleted user detail must be 401");

    // Origin protection
    const badOrigin = await requestJson(baseUrl, "POST", "/api/submissions", {
      origin: null,
      cookie: studentA,
      body: validPayload({ repositoryUrl: "https://github.com/origin/missing" }),
    });
    assert(badOrigin.status === 403, "missing origin must be 403");

    console.info("Core submission checks passed; verifying rate limits on a fresh app…");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  const rate = await listen(createApp());
  try {
    const limitedStudent = await requestJson(rate.baseUrl, "POST", "/api/auth/signup", {
      origin: TRUSTED_ORIGIN,
      body: {
        name: "Limiter Student",
        email: "submit-limiter@example.com",
        password: "student-pass-1",
      },
    });
    assert(limitedStudent.status === 201, "limiter student signup failed");
    const cookie = `${COOKIE_NAME}=${parseSetCookie(limitedStudent.setCookie).value}`;

    for (let i = 0; i < 5; i += 1) {
      const attempt = await requestJson(rate.baseUrl, "POST", "/api/submissions", {
        origin: TRUSTED_ORIGIN,
        cookie,
        headers: { "X-Forwarded-For": `203.0.113.${i}` },
        body: validPayload({
          projectName: `Limit ${i}`,
          repositoryUrl: `https://github.com/limit/repo-${i}`,
          liveUrl: `https://limit-${i}.example.com`,
        }),
      });
      assert(attempt.status === 201, `submission ${i + 1} expected 201, got ${attempt.status}`);
    }

    const limited = await requestJson(rate.baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie,
      headers: { "X-Forwarded-For": "198.51.100.20" },
      body: validPayload({
        projectName: "Limit Six",
        repositoryUrl: "https://github.com/limit/repo-6",
        liveUrl: "https://limit-6.example.com",
      }),
    });
    assert(limited.status === 429, "6th submission must be rate limited");
    assert(
      (limited.body as { error: { retryAfterSeconds?: number } }).error.retryAfterSeconds,
      "429 must include retryAfterSeconds",
    );

    // Re-login must not reset the per-student bucket
    const relogin = await requestJson(rate.baseUrl, "POST", "/api/auth/login", {
      origin: TRUSTED_ORIGIN,
      body: { email: "submit-limiter@example.com", password: "student-pass-1" },
    });
    const reloginCookie = `${COOKIE_NAME}=${parseSetCookie(relogin.setCookie).value}`;
    const stillLimited = await requestJson(rate.baseUrl, "POST", "/api/submissions", {
      origin: TRUSTED_ORIGIN,
      cookie: reloginCookie,
      body: validPayload({
        projectName: "After Relogin",
        repositoryUrl: "https://github.com/limit/repo-7",
        liveUrl: "https://limit-7.example.com",
      }),
    });
    assert(stillLimited.status === 429, "re-login must not reset submission rate limit");

    console.info("Submission checks passed.");
  } finally {
    await new Promise<void>((resolve, reject) => {
      rate.server.close((error) => (error ? reject(error) : resolve()));
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
