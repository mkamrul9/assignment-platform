import {
  CheckpointAssessment,
  Prisma,
  ReviewDecision,
  SubmissionStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { DecisionInput, QueueQuery } from "./reviews.schemas.js";

/** Compact queue rows: identity, status, links, and time — not full descriptions/reviews. */
export const queueListSelect = {
  id: true,
  projectName: true,
  repositoryUrl: true,
  liveUrl: true,
  status: true,
  createdAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

/** Full project + review payload used by decision responses and mentor detail views. */
export const queueSubmissionSelect = {
  id: true,
  projectName: true,
  repositoryUrl: true,
  canonicalRepositoryUrl: true,
  liveUrl: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  review: {
    select: {
      decision: true,
      note: true,
      functionality: true,
      usability: true,
      documentation: true,
      reviewedAt: true,
      mentor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

export type QueueListItem = Prisma.SubmissionGetPayload<{
  select: typeof queueListSelect;
}>;

export type QueueSubmission = Prisma.SubmissionGetPayload<{
  select: typeof queueSubmissionSelect;
}>;

export type ReviewStats = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export class ReviewNotFoundError extends Error {
  constructor(message = "Submission not found.") {
    super(message);
    this.name = "ReviewNotFoundError";
  }
}

export class ReviewConflictError extends Error {
  constructor(message = "This project has already been reviewed.") {
    super(message);
    this.name = "ReviewConflictError";
  }
}

function statusFilter(status: QueueQuery["status"]): Prisma.SubmissionWhereInput {
  if (status === "ALL") {
    return {};
  }
  return { status: status as SubmissionStatus };
}

function searchFilter(q: string | undefined): Prisma.SubmissionWhereInput {
  if (!q) {
    return {};
  }
  return {
    OR: [
      { projectName: { contains: q, mode: "insensitive" } },
      { repositoryUrl: { contains: q, mode: "insensitive" } },
      { owner: { name: { contains: q, mode: "insensitive" } } },
      { owner: { email: { contains: q, mode: "insensitive" } } },
    ],
  };
}

function queueWhere(query: QueueQuery): Prisma.SubmissionWhereInput {
  return {
    AND: [statusFilter(query.status), searchFilter(query.q)],
  };
}

export async function listReviewQueue(query: QueueQuery): Promise<{
  submissions: QueueListItem[];
  pagination: PaginationMeta;
}> {
  const where = queueWhere(query);
  const total = await prisma.submission.count({ where });
  const totalPages = total === 0 ? 0 : Math.ceil(total / query.pageSize);
  const skip = (query.page - 1) * query.pageSize;

  // Out-of-range pages return an empty page with stable pagination metadata.
  const submissions =
    total === 0 || skip >= total
      ? []
      : await prisma.submission.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip,
          take: query.pageSize,
          select: queueListSelect,
        });

  return {
    submissions,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
      hasNextPage: totalPages > 0 && query.page < totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
    },
  };
}

export async function getReviewStats(): Promise<ReviewStats> {
  // A single aggregate query gives every card the same database snapshot.
  const groups = await prisma.submission.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const stats: ReviewStats = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const group of groups) {
    const count = group._count._all;
    stats.total += count;
    if (group.status === SubmissionStatus.PENDING) stats.pending = count;
    if (group.status === SubmissionStatus.APPROVED) stats.approved = count;
    if (group.status === SubmissionStatus.REJECTED) stats.rejected = count;
  }
  return stats;
}

export async function decideSubmission(
  submissionId: string,
  mentorId: string,
  input: DecisionInput,
): Promise<QueueSubmission> {
  const nextStatus =
    input.decision === ReviewDecision.APPROVED
      ? SubmissionStatus.APPROVED
      : SubmissionStatus.REJECTED;

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.submission.updateMany({
        where: { id: submissionId, status: SubmissionStatus.PENDING },
        data: { status: nextStatus },
      });

      if (updated.count === 0) {
        const existing = await tx.submission.findUnique({
          where: { id: submissionId },
          select: { id: true, status: true },
        });
        if (!existing) {
          throw new ReviewNotFoundError();
        }
        throw new ReviewConflictError();
      }

      await tx.review.create({
        data: {
          submissionId,
          mentorId,
          decision: input.decision,
          note: input.note,
          functionality: input.checkpoints.functionality as CheckpointAssessment,
          usability: input.checkpoints.usability as CheckpointAssessment,
          documentation: input.checkpoints.documentation as CheckpointAssessment,
        },
      });

      return tx.submission.findUniqueOrThrow({
        where: { id: submissionId },
        select: queueSubmissionSelect,
      });
    });
  } catch (error) {
    if (error instanceof ReviewNotFoundError || error instanceof ReviewConflictError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ReviewConflictError();
    }
    throw error;
  }
}
