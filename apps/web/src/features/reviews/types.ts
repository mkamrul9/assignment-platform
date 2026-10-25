export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "APPROVED" | "REJECTED";
export type QueueStatusFilter = "ALL" | SubmissionStatus;

export type CheckpointAssessment = "MEETS_EXPECTATIONS" | "NEEDS_IMPROVEMENT" | "NOT_ASSESSED";

export type ReviewCheckpoints = {
  functionality: CheckpointAssessment;
  usability: CheckpointAssessment;
  documentation: CheckpointAssessment;
};

export type QueueReview = {
  decision: ReviewDecision;
  note: string | null;
  functionality: CheckpointAssessment;
  usability: CheckpointAssessment;
  documentation: CheckpointAssessment;
  reviewedAt: string;
  mentor: {
    id: string;
    name: string;
  };
};

/** Compact queue row — enough for the table without full description/review payloads. */
export type QueueListItem = {
  id: string;
  projectName: string;
  repositoryUrl: string;
  liveUrl: string;
  status: SubmissionStatus;
  createdAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
};

/** Full project details loaded on demand (and returned by decision responses). */
export type QueueSubmission = {
  id: string;
  projectName: string;
  repositoryUrl: string;
  canonicalRepositoryUrl: string;
  liveUrl: string;
  description: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  review: QueueReview | null;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ReviewStats = {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
};

export type DetailLoadStatus = "idle" | "loading" | "ready" | "error" | "missing";
