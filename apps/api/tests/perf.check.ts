/**
 * U6 performance investigation against an isolated disposable PostgreSQL database.
 * Seeds a documented larger synthetic dataset, records EXPLAIN plans, payload sizes,
 * and representative API timings. Never targets the configured development database.
 */
import { config as loadDotenv } from "dotenv";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "..", "..");
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const TEST_DATABASE_NAME = "reviewdock_u6_perf_check";
const TRUSTED_ORIGIN = "http://localhost:3000";
const JWT_SECRET = "u6-perf-check-secret-32chars-minimum!!";
const COOKIE_NAME = "reviewdock_session";

/** Dataset sizing for documented measurements (not a hardware latency SLA). */
const STUDENT_COUNT = 20;
const SUBMISSIONS_PER_STUDENT = 40;
const TOTAL_SUBMISSIONS = STUDENT_COUNT * SUBMISSIONS_PER_STUDENT;

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

function assertDisposableDatabase(devUrl: string, testDbName: string): void {
  if (!/^reviewdock_u6_perf(?:_[a-z0-9_]+)?$/i.test(testDbName)) {
    throw new Error("Perf database names must start with reviewdock_u6_perf.");
  }
  const configuredName = new URL(devUrl).pathname.slice(1).split("?")[0];
  if (configuredName === testDbName) {
    throw new Error("Refusing to reset or drop the configured development database.");
  }
}

async function resetTestDatabase(devUrl: string, testDbName: string): Promise<string> {
  assertDisposableDatabase(devUrl, testDbName);
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
  assertDisposableDatabase(devUrl, testDbName);
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
  raw: string;
  setCookie: string | null;
  elapsedMs: number;
};

async function requestJson(
  baseUrl: string,
  method: string,
  pathName: string,
  options?: {
    body?: unknown;
    origin?: string | null;
    cookie?: string;
  },
): Promise<JsonResponse> {
  const headers: Record<string, string> = { Accept: "application/json" };
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
  const started = performance.now();
  const response = await fetch(`${baseUrl}${pathName}`, { method, headers, body });
  const raw = await response.text();
  const elapsedMs = performance.now() - started;
  const contentType = response.headers.get("content-type") ?? "";
  const parsedBody = contentType.includes("application/json") ? JSON.parse(raw) : raw;
  return {
    status: response.status,
    headers: response.headers,
    body: parsedBody,
    raw,
    setCookie: response.headers.get("set-cookie"),
    elapsedMs,
  };
}

type PlanObservation = {
  label: string;
  sql: string;
  planText: string;
  usesIndex: boolean;
  sequentialScan: boolean;
};

type EndpointObservation = {
  label: string;
  path: string;
  status: number;
  elapsedMs: number;
  bytes: number;
  rowCount: number | null;
  bounded: boolean;
};

async function explain(
  client: pg.Client,
  label: string,
  sql: string,
  params: unknown[] = [],
): Promise<PlanObservation> {
  const result = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`, params);
  const planText = result.rows.map((row: { "QUERY PLAN": string }) => row["QUERY PLAN"]).join("\n");
  return {
    label,
    sql,
    planText,
    usesIndex: /Index (Scan|Only Scan|Cond)/i.test(planText),
    sequentialScan: /Seq Scan/i.test(planText) && !/Index/i.test(planText.split("\n")[0] ?? ""),
  };
}

async function runChecks() {
  assertDisposableDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
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
  process.env.SIGNUP_RATE_LIMIT_MAX = "500";
  process.env.LOGIN_RATE_LIMIT_MAX = "500";
  process.env.SUBMISSION_RATE_LIMIT_MAX = "500";
  process.env.DEMO_MODE = "0";

  const { createApp } = await import("../src/app.js");
  const { prisma } = await import("../src/lib/prisma.js");
  const { Role, SubmissionStatus, ReviewDecision } =
    await import("../src/generated/prisma/client.js");

  const passwordHash = await bcrypt.hash("student-pass-1", 10);
  const mentorHash = await bcrypt.hash("mentor-pass-1", 10);

  const mentor = await prisma.user.create({
    data: {
      name: "Perf Mentor",
      email: "perf-mentor@example.com",
      passwordHash: mentorHash,
      role: Role.MENTOR,
    },
  });

  const students = [];
  for (let i = 0; i < STUDENT_COUNT; i += 1) {
    students.push(
      await prisma.user.create({
        data: {
          name: `Perf Student ${String(i).padStart(2, "0")}`,
          email: `perf-student-${i}@example.com`,
          passwordHash,
          role: Role.STUDENT,
        },
      }),
    );
  }

  const baseTime = Date.now();
  for (let s = 0; s < students.length; s += 1) {
    const owner = students[s]!;
    const rows = [];
    for (let i = 0; i < SUBMISSIONS_PER_STUDENT; i += 1) {
      const status =
        i % 5 === 0
          ? SubmissionStatus.APPROVED
          : i % 5 === 1
            ? SubmissionStatus.REJECTED
            : SubmissionStatus.PENDING;
      const createdAt = new Date(baseTime - (s * SUBMISSIONS_PER_STUDENT + i) * 1000);
      rows.push({
        ownerId: owner.id,
        projectName: `Perf Project ${s}-${String(i).padStart(2, "0")}`,
        repositoryUrl: `https://github.com/perf-lab/repo-${s}-${i}`,
        canonicalRepositoryUrl: `https://github.com/perf-lab/repo-${s}-${i}`,
        liveUrl: `https://perf-${s}-${i}.example.com`,
        description: `Synthetic U6 performance description for student ${s} project ${i}. `.repeat(
          3,
        ),
        status,
        createdAt,
        updatedAt: createdAt,
      });
    }
    // createMany does not support nested reviews; insert then add reviews for decided rows.
    await prisma.submission.createMany({ data: rows });
  }

  const decided = await prisma.submission.findMany({
    where: { status: { in: [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED] } },
    select: { id: true, status: true },
  });
  for (const row of decided) {
    await prisma.review.create({
      data: {
        submissionId: row.id,
        mentorId: mentor.id,
        decision:
          row.status === SubmissionStatus.APPROVED
            ? ReviewDecision.APPROVED
            : ReviewDecision.REJECTED,
        note:
          row.status === SubmissionStatus.REJECTED
            ? "Needs clearer setup notes for U6 performance fixtures."
            : null,
      },
    });
  }

  const total = await prisma.submission.count();
  assert(total === TOTAL_SUBMISSIONS, `expected ${TOTAL_SUBMISSIONS} submissions, got ${total}`);

  const pgClient = new pg.Client({ connectionString: testUrl });
  await pgClient.connect();

  const plans: PlanObservation[] = [];
  try {
    const ownerId = students[0]!.id;
    plans.push(
      await explain(
        pgClient,
        "owner list page (mine defaults)",
        `SELECT id FROM submissions WHERE owner_id = $1 ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0`,
        [ownerId],
      ),
    );
    plans.push(
      await explain(
        pgClient,
        "owner status filter",
        `SELECT id FROM submissions WHERE owner_id = $1 AND status = 'PENDING' ORDER BY created_at DESC, id DESC LIMIT 10`,
        [ownerId],
      ),
    );
    plans.push(
      await explain(
        pgClient,
        "owner search contains",
        `SELECT id FROM submissions WHERE owner_id = $1 AND (project_name ILIKE $2 OR repository_url ILIKE $2) ORDER BY created_at DESC, id DESC LIMIT 10`,
        [ownerId, "%Perf Project 0-0%"],
      ),
    );
    plans.push(
      await explain(
        pgClient,
        "mentor PENDING page",
        `SELECT id FROM submissions WHERE status = 'PENDING' ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0`,
      ),
    );
    plans.push(
      await explain(
        pgClient,
        "mentor ALL newest page",
        `SELECT id FROM submissions ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0`,
      ),
    );
    plans.push(
      await explain(
        pgClient,
        "mentor search contains (unscoped)",
        `SELECT s.id FROM submissions s JOIN users u ON u.id = s.owner_id WHERE (s.project_name ILIKE $1 OR s.repository_url ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1) ORDER BY s.created_at DESC, s.id DESC LIMIT 10`,
        ["%Perf Project 0-0%"],
      ),
    );
    plans.push(
      await explain(
        pgClient,
        "global status groupBy (stats)",
        `SELECT status, COUNT(*)::int AS count FROM submissions GROUP BY status`,
      ),
    );

    const indexList = await pgClient.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'submissions' ORDER BY indexname`,
    );

    async function listen(appInstance: ReturnType<typeof createApp>) {
      const server: Server = createServer(appInstance);
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert(address && typeof address === "object", "server should expose an address");
      return { server, baseUrl: `http://127.0.0.1:${address.port}` };
    }

    const { server, baseUrl } = await listen(createApp());
    const endpoints: EndpointObservation[] = [];
    try {
      const studentLogin = await requestJson(baseUrl, "POST", "/api/auth/login", {
        origin: TRUSTED_ORIGIN,
        body: { email: students[0]!.email, password: "student-pass-1" },
      });
      assert(studentLogin.status === 200, "student login failed");
      const studentCookie = `${COOKIE_NAME}=${parseSetCookie(studentLogin.setCookie).value}`;

      const mentorLogin = await requestJson(baseUrl, "POST", "/api/auth/login", {
        origin: TRUSTED_ORIGIN,
        body: { email: mentor.email, password: "mentor-pass-1" },
      });
      assert(mentorLogin.status === 200, "mentor login failed");
      const mentorCookie = `${COOKIE_NAME}=${parseSetCookie(mentorLogin.setCookie).value}`;

      // Warm-up requests (excluded from reported timings).
      await requestJson(baseUrl, "GET", "/api/submissions/mine?page=1&pageSize=10", {
        cookie: studentCookie,
      });
      await requestJson(
        baseUrl,
        "GET",
        "/api/reviews/submissions?status=PENDING&page=1&pageSize=10",
        {
          cookie: mentorCookie,
        },
      );

      const cases: Array<{
        label: string;
        path: string;
        cookie: string;
        rowPath: "submissions";
        maxRows: number;
      }> = [
        {
          label: "student mine defaults",
          path: "/api/submissions/mine",
          cookie: studentCookie,
          rowPath: "submissions",
          maxRows: 10,
        },
        {
          label: "student mine pageSize 50",
          path: "/api/submissions/mine?page=1&pageSize=50",
          cookie: studentCookie,
          rowPath: "submissions",
          maxRows: 50,
        },
        {
          label: "student mine search",
          path: "/api/submissions/mine?q=Perf%20Project%200-0&pageSize=10",
          cookie: studentCookie,
          rowPath: "submissions",
          maxRows: 10,
        },
        {
          label: "mentor PENDING page",
          path: "/api/reviews/submissions?status=PENDING&page=1&pageSize=10",
          cookie: mentorCookie,
          rowPath: "submissions",
          maxRows: 10,
        },
        {
          label: "mentor ALL page",
          path: "/api/reviews/submissions?status=ALL&page=1&pageSize=10",
          cookie: mentorCookie,
          rowPath: "submissions",
          maxRows: 10,
        },
        {
          label: "mentor search",
          path: "/api/reviews/submissions?status=ALL&q=Perf%20Project%200-0&pageSize=10",
          cookie: mentorCookie,
          rowPath: "submissions",
          maxRows: 10,
        },
      ];

      for (const testCase of cases) {
        const response = await requestJson(baseUrl, "GET", testCase.path, {
          cookie: testCase.cookie,
        });
        assert(response.status === 200, `${testCase.label} expected 200`);
        const body = response.body as { submissions?: unknown[]; pagination?: { total: number } };
        const rowCount = Array.isArray(body.submissions) ? body.submissions.length : null;
        assert(rowCount !== null, `${testCase.label} missing submissions`);
        assert(rowCount <= testCase.maxRows, `${testCase.label} exceeded page bound`);
        // Payload must not dump the full owner corpus for mine / full queue for mentor.
        assert(
          !JSON.stringify(body).includes('"passwordHash"'),
          `${testCase.label} leaked passwordHash`,
        );
        endpoints.push({
          label: testCase.label,
          path: testCase.path,
          status: response.status,
          elapsedMs: Number(response.elapsedMs.toFixed(1)),
          bytes: Buffer.byteLength(response.raw, "utf8"),
          rowCount,
          bounded: rowCount <= testCase.maxRows,
        });
      }

      const stats = await requestJson(baseUrl, "GET", "/api/reviews/stats", {
        cookie: mentorCookie,
      });
      assert(stats.status === 200, "stats expected 200");
      const statsBody = (stats.body as { stats: { total: number; pending: number } }).stats;
      assert(statsBody.total === TOTAL_SUBMISSIONS, "stats total must match seeded corpus");
      endpoints.push({
        label: "mentor stats",
        path: "/api/reviews/stats",
        status: stats.status,
        elapsedMs: Number(stats.elapsedMs.toFixed(1)),
        bytes: Buffer.byteLength(stats.raw, "utf8"),
        rowCount: null,
        bounded: true,
      });

      const filtered = await requestJson(
        baseUrl,
        "GET",
        "/api/reviews/submissions?status=PENDING&page=1&pageSize=10",
        { cookie: mentorCookie },
      );
      const filteredTotal = (filtered.body as { pagination: { total: number } }).pagination.total;
      assert(
        filteredTotal === statsBody.pending,
        "filtered pending total must match global pending",
      );

      // Detail payload vs queue row size (mentor opens one project).
      const firstId = (filtered.body as { submissions: Array<{ id: string }> }).submissions[0]?.id;
      assert(firstId, "need a pending row for detail comparison");
      const detail = await requestJson(baseUrl, "GET", `/api/submissions/${firstId}`, {
        cookie: mentorCookie,
      });
      assert(detail.status === 200, "detail expected 200");
      const detailBody = detail.body as { submission: { description?: string } };
      assert(
        typeof detailBody.submission.description === "string" &&
          detailBody.submission.description.length > 0,
        "detail must include description",
      );
      const queueRowSample = (filtered.body as { submissions: Array<Record<string, unknown>> })
        .submissions[0]!;
      assert(
        queueRowSample.description === undefined,
        "queue rows must remain compact without description",
      );
      endpoints.push({
        label: "mentor detail by id",
        path: `/api/submissions/${firstId}`,
        status: detail.status,
        elapsedMs: Number(detail.elapsedMs.toFixed(1)),
        bytes: Buffer.byteLength(detail.raw, "utf8"),
        rowCount: 1,
        bounded: true,
      });

      // Demo disabled: accounts route absent/404.
      const demoDisabled = await requestJson(baseUrl, "GET", "/api/demo/accounts");
      assert(
        demoDisabled.status === 404 || demoDisabled.status === 401,
        `demo disabled expected 404/401, got ${demoDisabled.status}`,
      );

      const health = await requestJson(baseUrl, "GET", "/api/health");
      assert(health.status === 200, "health expected 200");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }

    const report = {
      recordedAt: new Date().toISOString(),
      environment: {
        postgresHostPort: new URL(DEV_DATABASE_URL).port || "5432",
        node: process.version,
        disposableDatabase: TEST_DATABASE_NAME,
        developmentDatabasePreserved: new URL(DEV_DATABASE_URL).pathname.slice(1),
      },
      dataset: {
        students: STUDENT_COUNT,
        submissionsPerStudent: SUBMISSIONS_PER_STUDENT,
        totalSubmissions: TOTAL_SUBMISSIONS,
        statuses: "mixed PENDING/APPROVED/REJECTED (~3/5 pending)",
      },
      indexes: indexList.rows,
      plans: plans.map((plan) => ({
        label: plan.label,
        usesIndex: plan.usesIndex,
        sequentialScanDominant: plan.sequentialScan,
        planText: plan.planText,
      })),
      endpoints,
      notes: [
        "Timings are representative warm-path measurements on this machine, not latency SLAs.",
        "ILIKE contains-search is expected to remain sequential/filter-heavy without a search extension.",
        "Queue list payloads are compact after U5; descriptions load via detail.",
      ],
    };

    const outDir = path.join(repoRoot, "docs", "upgrades");
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "perf-raw.json");
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.info(`Wrote ${outPath}`);
    console.info(
      JSON.stringify(
        {
          dataset: report.dataset,
          endpoints: report.endpoints,
          planSummary: report.plans.map((p) => ({
            label: p.label,
            usesIndex: p.usesIndex,
            sequentialScanDominant: p.sequentialScanDominant,
          })),
        },
        null,
        2,
      ),
    );

    // Soft expectations: owner/PENDING/ALL paths should prefer indexes on this corpus size.
    const ownerPlan = plans.find((p) => p.label.startsWith("owner list"));
    assert(ownerPlan?.usesIndex, "owner list should use submissions_owner_created_idx");
    const pendingPlan = plans.find((p) => p.label.startsWith("mentor PENDING"));
    assert(pendingPlan?.usesIndex, "PENDING list should use submissions_status_created_idx");
    const allPlan = plans.find((p) => p.label.startsWith("mentor ALL"));
    assert(allPlan?.usesIndex, "ALL newest list should use submissions_created_idx");
    assert(!allPlan.sequentialScan, "ALL newest list should not be seq-scan dominant after index");

    console.info("U6 performance checks passed.");
  } finally {
    await pgClient.end();
    await prisma.$disconnect();
    await dropTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  }
}

runChecks().catch(async (error) => {
  console.error(error);
  try {
    await dropTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  } catch (cleanupError) {
    console.error(cleanupError);
  }
  process.exitCode = 1;
});
