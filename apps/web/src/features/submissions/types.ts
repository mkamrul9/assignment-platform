export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "APPROVED" | "REJECTED";

export type CheckpointAssessment = "MEETS_EXPECTATIONS" | "NEEDS_IMPROVEMENT" | "NOT_ASSESSED";

export type SubmissionReview = {
  decision: ReviewDecision;
  note: string | null;
  functionality: CheckpointAssessment;
  usability: CheckpointAssessment;
  documentation: CheckpointAssessment;
  reviewedAt: string;
};

export type Submission = {
  id: string;
  projectName: string;
  repositoryUrl: string;
  canonicalRepositoryUrl: string;
  liveUrl: string;
  description: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
  review: SubmissionReview | null;
};

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
