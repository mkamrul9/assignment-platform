import { Prisma, Role, SubmissionStatus } from "../../generated/prisma/client.js";
import { canonicalizeRepositoryUrl } from "../../lib/canonical-repository-url.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateSubmissionInput, MineQuery } from "./submissions.schemas.js";

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

/** Mentor detail includes owner identity and reviewer for the review dialog. */
export const mentorSubmissionDetailSelect = {
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

export type SubmissionView = Prisma.SubmissionGetPayload<{
  select: typeof submissionSelect;
}>;

export type MentorSubmissionDetail = Prisma.SubmissionGetPayload<{
  select: typeof mentorSubmissionDetailSelect;
}>;

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type OwnerSubmissionStats = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export class SubmissionConflictError extends Error {
  constructor(message = "A project with this repository URL has already been submitted.") {
    super(message);
    this.name = "SubmissionConflictError";
  }
}

export class SubmissionNotFoundError extends Error {
  constructor(message = "Submission not found.") {
    super(message);
    this.name = "SubmissionNotFoundError";
  }
}

function statusFilter(status: MineQuery["status"]): Prisma.SubmissionWhereInput {
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
    ],
  };
}

function mineWhere(ownerId: string, query: MineQuery): Prisma.SubmissionWhereInput {
  return {
    AND: [{ ownerId }, statusFilter(query.status), searchFilter(query.q)],
  };
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

export async function listMySubmissions(
  ownerId: string,
  query: MineQuery,
): Promise<{
  submissions: SubmissionView[];
  pagination: PaginationMeta;
}> {
  const where = mineWhere(ownerId, query);
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
          select: submissionSelect,
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

/** Owner-scoped totals independent of list filters/search (single groupBy round trip). */
export async function getMySubmissionStats(ownerId: string): Promise<OwnerSubmissionStats> {
  const groups = await prisma.submission.groupBy({
    by: ["status"],
    where: { ownerId },
    _count: { _all: true },
  });
  const stats: OwnerSubmissionStats = { pending: 0, approved: 0, rejected: 0, total: 0 };
  for (const group of groups) {
    const count = group._count._all;
    stats.total += count;
    if (group.status === SubmissionStatus.PENDING) stats.pending = count;
    if (group.status === SubmissionStatus.APPROVED) stats.approved = count;
    if (group.status === SubmissionStatus.REJECTED) stats.rejected = count;
  }
  return stats;
}

/**
 * Students may read only their own rows (missing/foreign → same 404).
 * Mentors may read any submission in the review workflow with owner/reviewer fields.
 */
export async function getSubmissionForViewer(
  viewer: { id: string; role: Role },
  submissionId: string,
): Promise<SubmissionView | MentorSubmissionDetail> {
  if (viewer.role === Role.STUDENT) {
    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, ownerId: viewer.id },
      select: submissionSelect,
    });
    if (!submission) {
      throw new SubmissionNotFoundError();
    }
    return submission;
  }

  if (viewer.role === Role.MENTOR) {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: mentorSubmissionDetailSelect,
    });
    if (!submission) {
      throw new SubmissionNotFoundError();
    }
    return submission;
  }

  throw new SubmissionNotFoundError();
}
