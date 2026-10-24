import {
  Prisma,
  type ReviewDecision,
  type SubmissionStatus,
} from "../../generated/prisma/client.js";
import { canonicalizeRepositoryUrl } from "../../lib/canonical-repository-url.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateSubmissionInput } from "./submissions.schemas.js";

export const submissionSelect = {
  id: true,
  projectName: true,
  repositoryUrl: true,
  canonicalRepositoryUrl: true,
  liveUrl: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  review: {
    select: {
      decision: true,
      note: true,
      functionality: true,
      usability: true,
      documentation: true,
      reviewedAt: true,
    },
  },
} as const;

export type SubmissionView = {
  id: string;
  projectName: string;
  repositoryUrl: string;
  canonicalRepositoryUrl: string;
  liveUrl: string;
  description: string;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  review: {
    decision: ReviewDecision;
    note: string | null;
    functionality: string;
    usability: string;
    documentation: string;
    reviewedAt: Date;
  } | null;
};

export class SubmissionConflictError extends Error {
  constructor(message = "A project with this repository URL has already been submitted.") {
    super(message);
    this.name = "SubmissionConflictError";
  }
}

export async function createSubmission(
  ownerId: string,
  input: CreateSubmissionInput,
): Promise<SubmissionView> {
  const canonicalRepositoryUrl = canonicalizeRepositoryUrl(input.repositoryUrl);

  try {
    return await prisma.submission.create({
      data: {
        ownerId,
        projectName: input.projectName,
        repositoryUrl: input.repositoryUrl,
        canonicalRepositoryUrl,
        liveUrl: input.liveUrl,
        description: input.description,
      },
      select: submissionSelect,
    });
  } catch (error) {
    // The only client-influenced unique field on create is canonical_repository_url.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SubmissionConflictError();
    }
    throw error;
  }
}

export async function listMySubmissions(ownerId: string): Promise<SubmissionView[]> {
  return prisma.submission.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: submissionSelect,
  });
}
