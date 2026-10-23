/**
 * Database integration checks against an isolated disposable PostgreSQL database.
 * Uses real constraints — no Prisma mocks.
 */
import { config as loadDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  Prisma,
  PrismaClient,
  Role,
  ReviewDecision,
  SubmissionStatus,
} from "../src/generated/prisma/client.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadDotenv({ path: path.join(apiRoot, ".env") });

const DEV_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://reviewdock:reviewdock@127.0.0.1:5432/reviewdock?schema=public";

const TEST_DATABASE_NAME = "reviewdock_phase2_check";

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

function runSeed(
  databaseUrl: string,
  mentor: { name: string; email: string; password: string },
): void {
  execFileSync(process.execPath, [prismaCli(), "db", "seed"], {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      MENTOR_NAME: mentor.name,
      MENTOR_EMAIL: mentor.email,
      MENTOR_PASSWORD: mentor.password,
    },
    stdio: "inherit",
  });
}

function createClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRejection(action: () => Promise<unknown>, code: string, label: string) {
  try {
    await action();
    throw new Error(`${label}: expected Prisma error ${code}`);
  } catch (error) {
    assert(
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === code,
      `${label}: expected ${code}, got ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runChecks(databaseUrl: string): Promise<void> {
  const prisma = createClient(databaseUrl);

  try {
    const student = await prisma.user.create({
      data: {
        name: "Student One",
        email: "student@example.com",
        passwordHash: await bcrypt.hash("student-password", 10),
        role: Role.STUDENT,
      },
    });

    await expectRejection(
      () =>
        prisma.user.create({
          data: {
            name: "Student Duplicate",
            email: "student@example.com",
            passwordHash: "x",
            role: Role.STUDENT,
          },
        }),
      "P2002",
      "duplicate email",
    );

    const submission = await prisma.submission.create({
      data: {
        ownerId: student.id,
        projectName: "Demo Project",
        repositoryUrl: "https://github.com/example/demo",
        canonicalRepositoryUrl: "https://github.com/example/demo",
        liveUrl: "https://demo.example.com",
        description: "A long enough description for the persistence check.",
      },
    });

    assert(
      submission.status === SubmissionStatus.PENDING,
      `new submission status expected PENDING, got ${submission.status}`,
    );

    await expectRejection(
      () =>
        prisma.submission.create({
          data: {
            ownerId: student.id,
            projectName: "Other Project",
            repositoryUrl: "https://github.com/example/demo.git",
            canonicalRepositoryUrl: "https://github.com/example/demo",
            liveUrl: "https://other.example.com",
            description: "Another long enough description for uniqueness checks.",
          },
        }),
      "P2002",
      "duplicate canonical repository URL",
    );

    await expectRejection(
      () =>
        prisma.submission.create({
          data: {
            ownerId: "missing-owner-id",
            projectName: "Orphan Project",
            repositoryUrl: "https://github.com/example/orphan",
            canonicalRepositoryUrl: "https://github.com/example/orphan",
            liveUrl: "https://orphan.example.com",
            description: "Should fail because the owner does not exist.",
          },
        }),
      "P2003",
      "invalid submission owner foreign key",
    );

    const mentor = await prisma.user.create({
      data: {
        name: "Mentor One",
        email: "mentor-check@example.com",
        passwordHash: await bcrypt.hash("mentor-password", 10),
        role: Role.MENTOR,
      },
    });

    await prisma.review.create({
      data: {
        submissionId: submission.id,
        mentorId: mentor.id,
        decision: ReviewDecision.APPROVED,
        note: "Looks good.",
      },
    });

    await expectRejection(
      () =>
        prisma.review.create({
          data: {
            submissionId: submission.id,
            mentorId: mentor.id,
            decision: ReviewDecision.REJECTED,
            note: "Second review should fail.",
          },
        }),
      "P2002",
      "second review for the same submission",
    );

    await expectRejection(
      () =>
        prisma.review.create({
          data: {
            submissionId: "missing-submission-id",
            mentorId: mentor.id,
            decision: ReviewDecision.APPROVED,
          },
        }),
      "P2003",
      "invalid review submission foreign key",
    );

    const seedEmail = "seed-mentor@example.com";
    const seedPassword = "seed-password-ok";

    runSeed(databaseUrl, {
      name: "Seed Mentor",
      email: seedEmail,
      password: seedPassword,
    });

    const afterFirstSeed = await prisma.user.findUniqueOrThrow({ where: { email: seedEmail } });
    assert(afterFirstSeed.role === Role.MENTOR, "seeded account must be MENTOR");
    assert(
      afterFirstSeed.passwordHash !== seedPassword,
      "password must be stored hashed, not as plaintext",
    );
    assert(
      await bcrypt.compare(seedPassword, afterFirstSeed.passwordHash),
      "stored password hash must verify with bcrypt",
    );

    runSeed(databaseUrl, {
      name: "Seed Mentor Changed",
      email: seedEmail,
      password: "different-password-should-not-apply",
    });

    const afterSecondSeed = await prisma.user.findUniqueOrThrow({ where: { email: seedEmail } });
    const mentorCount = await prisma.user.count({ where: { email: seedEmail } });
    assert(mentorCount === 1, "running the mentor seed twice must leave one account");
    assert(afterSecondSeed.id === afterFirstSeed.id, "seed re-run must keep the same mentor row");
    assert(
      afterSecondSeed.passwordHash === afterFirstSeed.passwordHash,
      "safe seed re-run must not reset the password hash",
    );
    assert(
      afterSecondSeed.name === afterFirstSeed.name,
      "safe seed re-run must not change mentor name",
    );

    const studentEmail = "already-student@example.com";
    await prisma.user.create({
      data: {
        name: "Existing Student",
        email: studentEmail,
        passwordHash: await bcrypt.hash("student-password", 10),
        role: Role.STUDENT,
      },
    });

    let seedConflictFailed = false;
    try {
      runSeed(databaseUrl, {
        name: "Should Fail",
        email: studentEmail,
        password: "another-password",
      });
    } catch {
      seedConflictFailed = true;
    }
    assert(seedConflictFailed, "seeding a STUDENT email as mentor must fail");
    const stillStudent = await prisma.user.findUniqueOrThrow({ where: { email: studentEmail } });
    assert(stillStudent.role === Role.STUDENT, "student must not be promoted to mentor");

    // Deleting a mentor who still has reviews must be restricted.
    await expectRejection(
      () => prisma.user.delete({ where: { id: mentor.id } }),
      "P2003",
      "mentor with reviews cannot be deleted",
    );

    // Deleting a student cascades to submissions and their reviews.
    const reviewBeforeDelete = await prisma.review.findUnique({
      where: { submissionId: submission.id },
    });
    assert(reviewBeforeDelete, "review must exist before owner delete");
    await prisma.user.delete({ where: { id: student.id } });
    assert(
      (await prisma.submission.count({ where: { id: submission.id } })) === 0,
      "deleting a student must cascade to submissions",
    );
    assert(
      (await prisma.review.count({ where: { submissionId: submission.id } })) === 0,
      "deleting a student must cascade to reviews",
    );
    assert(
      (await prisma.user.count({ where: { id: mentor.id } })) === 1,
      "mentor must remain after student cascade delete",
    );

    console.info("Persistence checks passed.");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const testUrl = await resetTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  try {
    migrateDeploy(testUrl);
    await runChecks(testUrl);
  } finally {
    await dropTestDatabase(DEV_DATABASE_URL, TEST_DATABASE_NAME);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
