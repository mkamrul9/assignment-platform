export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReviewDecision = "APPROVED" | "REJECTED";

export type SubmissionReview = {
  decision: ReviewDecision;
  note: string | null;
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
