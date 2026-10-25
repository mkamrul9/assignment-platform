/**
 * Idempotent demo sandbox seed. Only touches fixture identities.
 * Requires DEMO_MODE=1 and an allowlisted reviewdock_demo* database.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { DEMO_ACCOUNTS } from "./accounts.js";
import { assertDemoSeedTarget } from "./database-guard.js";
import {
  buildDemoSubmissionFixtures,
  demoCanonicalRepositoryUrl,
  demoLiveUrl,
  demoRepositoryUrl,
} from "./fixtures.js";
import { normalizeEmail } from "../lib/email.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { PrismaClient, Role, SubmissionStatus } from "../generated/prisma/client.js";

async function ensureUser(options: {
  prisma: PrismaClient;
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<void> {
  const email = normalizeEmail(options.email);
  const byId = await options.prisma.user.findUnique({ where: { id: options.id } });
  const byEmail = await options.prisma.user.findUnique({ where: { email } });

  if (byEmail && byEmail.id !== options.id) {
    throw new Error(
      `Demo seed collision: ${email} already belongs to user ${byEmail.id} (expected fixture id ${options.id}).`,
    );
  }

  if (byId && byId.email !== email) {
    throw new Error(
      `Demo seed collision: fixture id ${options.id} is bound to ${byId.email}, not ${email}.`,
    );
  }

  const existing = byId ?? byEmail;
  if (existing) {
    if (existing.role !== options.role) {
      throw new Error(
        `Demo seed collision: ${email} has role ${existing.role}, expected ${options.role}. Refusing to promote or overwrite.`,
      );
    }
    console.info(
      `Demo ${options.role.toLowerCase()} already present for ${email}; leaving unchanged.`,
    );
    return;
  }

  await options.prisma.user.create({
    data: {
      id: options.id,
      name: options.name,
      email,
      passwordHash: await hashPassword(options.password),
      role: options.role,
    },
  });
  console.info(`Seeded demo ${options.role.toLowerCase()} ${email}.`);
}

async function ensureSubmission(
  prisma: PrismaClient,
  fixture: ReturnType<typeof buildDemoSubmissionFixtures>[number],
  mentorId: string,
): Promise<void> {
  const repositoryUrl = demoRepositoryUrl(fixture.key);
  const canonicalRepositoryUrl = demoCanonicalRepositoryUrl(fixture.key);
  const liveUrl = demoLiveUrl(fixture.key);

  const existing = await prisma.submission.findUnique({
    where: { canonicalRepositoryUrl },
  });

  if (existing) {
    if (existing.ownerId !== fixture.ownerId) {
      throw new Error(
        `Demo seed collision: ${canonicalRepositoryUrl} is owned by ${existing.ownerId}, expected ${fixture.ownerId}.`,
      );
    }
    return;
  }

  const created = await prisma.submission.create({
    data: {
      ownerId: fixture.ownerId,
      projectName: fixture.projectName,
      repositoryUrl,
      canonicalRepositoryUrl,
      liveUrl,
      description: fixture.description,
      status: fixture.status,
    },
  });

  if (fixture.review && fixture.status !== SubmissionStatus.PENDING) {
    await prisma.review.create({
      data: {
        submissionId: created.id,
        mentorId,
        decision: fixture.review.decision,
        note: fixture.review.note,
        functionality: fixture.review.functionality,
        usability: fixture.review.usability,
        documentation: fixture.review.documentation,
      },
    });
  }
}

export async function seedDemoDatabase(databaseUrl: string): Promise<void> {
  assertDemoSeedTarget(databaseUrl);

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    await ensureUser({
      prisma,
      id: DEMO_ACCOUNTS.studentA.id,
      name: DEMO_ACCOUNTS.studentA.name,
      email: DEMO_ACCOUNTS.studentA.email,
      password: DEMO_ACCOUNTS.studentA.password,
      role: Role.STUDENT,
    });
    await ensureUser({
      prisma,
      id: DEMO_ACCOUNTS.studentB.id,
      name: DEMO_ACCOUNTS.studentB.name,
      email: DEMO_ACCOUNTS.studentB.email,
      password: DEMO_ACCOUNTS.studentB.password,
      role: Role.STUDENT,
    });
    await ensureUser({
      prisma,
      id: DEMO_ACCOUNTS.mentor.id,
      name: DEMO_ACCOUNTS.mentor.name,
      email: DEMO_ACCOUNTS.mentor.email,
      password: DEMO_ACCOUNTS.mentor.password,
      role: Role.MENTOR,
    });

    const mentor = await prisma.user.findUniqueOrThrow({
      where: { id: DEMO_ACCOUNTS.mentor.id },
      select: { id: true, passwordHash: true },
    });
    const passwordOk = await verifyPassword(DEMO_ACCOUNTS.mentor.password, mentor.passwordHash);
    if (!passwordOk) {
      console.warn(
        "Demo mentor exists with a different password hash; advertised demo password was not overwritten.",
      );
    }

    const fixtures = buildDemoSubmissionFixtures();
    for (const fixture of fixtures) {
      await ensureSubmission(prisma, fixture, mentor.id);
    }

    const submissionCount = await prisma.submission.count({
      where: {
        canonicalRepositoryUrl: {
          startsWith: "https://github.com/reviewdock-demo/",
        },
      },
    });
    console.info(
      `Demo seed complete: ${submissionCount} sandbox submissions (target ${fixtures.length}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
