/**
 * Seeds synthetic demo identities into the disposable e2e database so the
 * auth-panel browser suite can exercise DEMO_MODE. Keeps fixture constants
 * local to avoid loading the API Prisma graph through Playwright's CJS loader.
 * Production/demo CLI seeds still require an allowlisted reviewdock_demo* database.
 */
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";

import { DEMO_ACCOUNTS } from "./demo-accounts";

type FixtureSpec = {
  key: string;
  ownerId: string;
  projectName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  description: string;
  review?: {
    decision: "APPROVED" | "REJECTED";
    note: string;
    functionality: "MEETS_EXPECTATIONS" | "NEEDS_IMPROVEMENT" | "NOT_ASSESSED";
    usability: "MEETS_EXPECTATIONS" | "NEEDS_IMPROVEMENT" | "NOT_ASSESSED";
    documentation: "MEETS_EXPECTATIONS" | "NEEDS_IMPROVEMENT" | "NOT_ASSESSED";
  };
};

function buildFixtures(): FixtureSpec[] {
  const fixtures: FixtureSpec[] = [];
  let index = 1;
  const push = (ownerId: string, status: FixtureSpec["status"], review?: FixtureSpec["review"]) => {
    const key = `project-${String(index).padStart(2, "0")}`;
    fixtures.push({
      key,
      ownerId,
      projectName: `Demo ${status.charAt(0)}${status.slice(1).toLowerCase()} ${index}`,
      status,
      description: `Synthetic demo project ${index} for ReviewDock sandbox exploration. Status ${status}.`,
      review,
    });
    index += 1;
  };

  for (let i = 0; i < 8; i += 1) push(DEMO_ACCOUNTS.studentA.id, "PENDING");
  for (let i = 0; i < 4; i += 1) {
    push(DEMO_ACCOUNTS.studentA.id, "APPROVED", {
      decision: "APPROVED",
      note: "Solid demo submission. Clear README and working live link.",
      functionality: "MEETS_EXPECTATIONS",
      usability: "MEETS_EXPECTATIONS",
      documentation: "NEEDS_IMPROVEMENT",
    });
  }
  for (let i = 0; i < 2; i += 1) {
    push(DEMO_ACCOUNTS.studentA.id, "REJECTED", {
      decision: "REJECTED",
      note: "Needs a clearer live demo and stronger setup instructions before approval.",
      functionality: "NEEDS_IMPROVEMENT",
      usability: "NEEDS_IMPROVEMENT",
      documentation: "NOT_ASSESSED",
    });
  }
  for (let i = 0; i < 6; i += 1) push(DEMO_ACCOUNTS.studentB.id, "PENDING");
  for (let i = 0; i < 3; i += 1) {
    push(DEMO_ACCOUNTS.studentB.id, "APPROVED", {
      decision: "APPROVED",
      note: "Nice ownership isolation example. Approved for the demo queue.",
      functionality: "MEETS_EXPECTATIONS",
      usability: "NOT_ASSESSED",
      documentation: "MEETS_EXPECTATIONS",
    });
  }
  for (let i = 0; i < 2; i += 1) {
    push(DEMO_ACCOUNTS.studentB.id, "REJECTED", {
      decision: "REJECTED",
      note: "Repository uniqueness conflict examples stay rejected in the sandbox.",
      functionality: "NOT_ASSESSED",
      usability: "NEEDS_IMPROVEMENT",
      documentation: "NEEDS_IMPROVEMENT",
    });
  }
  return fixtures;
}

export async function seedDemoAccountsForE2E(databaseUrl: string): Promise<void> {
  const { PrismaClient, Role, SubmissionStatus } =
    await import("../apps/api/src/generated/prisma/client.js");
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const account of [DEMO_ACCOUNTS.studentA, DEMO_ACCOUNTS.studentB, DEMO_ACCOUNTS.mentor]) {
      const existing = await prisma.user.findUnique({ where: { id: account.id } });
      if (existing) {
        continue;
      }
      await prisma.user.create({
        data: {
          id: account.id,
          name: account.name,
          email: account.email,
          passwordHash: await bcrypt.hash(account.password, 12),
          role: account.role === "MENTOR" ? Role.MENTOR : Role.STUDENT,
        },
      });
    }

    for (const fixture of buildFixtures()) {
      const canonicalRepositoryUrl = `https://github.com/reviewdock-demo/${fixture.key}`;
      const existing = await prisma.submission.findUnique({ where: { canonicalRepositoryUrl } });
      if (existing) {
        continue;
      }
      const created = await prisma.submission.create({
        data: {
          ownerId: fixture.ownerId,
          projectName: fixture.projectName,
          repositoryUrl: canonicalRepositoryUrl,
          canonicalRepositoryUrl,
          liveUrl: `https://${fixture.key}.demo.reviewdock.local`,
          description: fixture.description,
          status: SubmissionStatus[fixture.status],
        },
      });
      if (fixture.review && fixture.status !== "PENDING") {
        await prisma.review.create({
          data: {
            submissionId: created.id,
            mentorId: DEMO_ACCOUNTS.mentor.id,
            decision: fixture.review.decision,
            note: fixture.review.note,
            functionality: fixture.review.functionality,
            usability: fixture.review.usability,
            documentation: fixture.review.documentation,
          },
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}
