import { config as loadDotenv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { PrismaClient, Role } from "../src/generated/prisma/client.js";

const apiRoot = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.join(apiRoot, "..", ".env") });

const seedEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required to seed the database."),
  MENTOR_NAME: z
    .string()
    .trim()
    .min(1, "MENTOR_NAME is required.")
    .max(100, "MENTOR_NAME must be at most 100 characters."),
  MENTOR_EMAIL: z
    .string()
    .trim()
    .min(1, "MENTOR_EMAIL is required.")
    .email("MENTOR_EMAIL must be a valid email address."),
  MENTOR_PASSWORD: z.string().superRefine((value, ctx) => {
    if (value.length < 8) {
      ctx.addIssue({
        code: "custom",
        message: "MENTOR_PASSWORD must be at least 8 characters.",
      });
      return;
    }
    if (Buffer.byteLength(value, "utf8") > 72) {
      ctx.addIssue({
        code: "custom",
        message: "MENTOR_PASSWORD must be at most 72 bytes (bcrypt limit).",
      });
    }
  }),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function main() {
  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(`Invalid mentor seed configuration:\n${details}`);
  }

  const { DATABASE_URL, MENTOR_NAME, MENTOR_EMAIL, MENTOR_PASSWORD } = parsed.data;
  const email = normalizeEmail(MENTOR_EMAIL);
  const name = MENTOR_NAME.trim();

  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role === Role.STUDENT) {
        throw new Error(
          `Cannot seed mentor: ${email} already belongs to a STUDENT account. Choose a different MENTOR_EMAIL.`,
        );
      }

      console.info(`Mentor already present for ${email}; leaving the existing account unchanged.`);
      return;
    }

    const passwordHash = await bcrypt.hash(MENTOR_PASSWORD, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: Role.MENTOR,
      },
    });

    console.info(`Seeded mentor account for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed error.";
  console.error(message);
  process.exit(1);
});
