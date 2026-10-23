export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "APPROVED" | "REJECTED";
export type QueueStatusFilter = "ALL" | SubmissionStatus;

export type QueueReview = {
  decision: ReviewDecision;
  note: string | null;
  reviewedAt: string;
  mentor: {
    id: string;
    name: string;
  };
};

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
