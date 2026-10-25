import {
  CheckpointAssessment,
  ReviewDecision,
  SubmissionStatus,
} from "../generated/prisma/client.js";

import { DEMO_USER_IDS } from "./accounts.js";

export type DemoSubmissionFixture = {
  /** Stable suffix used in repository URLs and project names. */
  key: string;
  ownerId: string;
  projectName: string;
  status: SubmissionStatus;
  description: string;
  review?: {
    decision: ReviewDecision;
    note: string;
    functionality: CheckpointAssessment;
    usability: CheckpointAssessment;
    documentation: CheckpointAssessment;
  };
};

function repoUrl(key: string): string {
  return `https://github.com/reviewdock-demo/${key}`;
}

function liveUrl(key: string): string {
  return `https://${key}.demo.reviewdock.local`;
}

/** At least 25 representative projects across statuses and both students. */
export function buildDemoSubmissionFixtures(): DemoSubmissionFixture[] {
  const fixtures: DemoSubmissionFixture[] = [];

  const pendingA = 8;
  const approvedA = 4;
  const rejectedA = 2;
  const pendingB = 6;
  const approvedB = 3;
  const rejectedB = 2;

  let index = 1;
  const push = (
    ownerId: string,
    status: SubmissionStatus,
    review?: DemoSubmissionFixture["review"],
  ) => {
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

  for (let i = 0; i < pendingA; i += 1) {
    push(DEMO_USER_IDS.studentA, SubmissionStatus.PENDING);
  }
  for (let i = 0; i < approvedA; i += 1) {
    push(DEMO_USER_IDS.studentA, SubmissionStatus.APPROVED, {
      decision: ReviewDecision.APPROVED,
      note: "Solid demo submission. Clear README and working live link.",
      functionality: CheckpointAssessment.MEETS_EXPECTATIONS,
      usability: CheckpointAssessment.MEETS_EXPECTATIONS,
      documentation: CheckpointAssessment.NEEDS_IMPROVEMENT,
    });
  }
  for (let i = 0; i < rejectedA; i += 1) {
    push(DEMO_USER_IDS.studentA, SubmissionStatus.REJECTED, {
      decision: ReviewDecision.REJECTED,
      note: "Needs a clearer live demo and stronger setup instructions before approval.",
      functionality: CheckpointAssessment.NEEDS_IMPROVEMENT,
      usability: CheckpointAssessment.NEEDS_IMPROVEMENT,
      documentation: CheckpointAssessment.NOT_ASSESSED,
    });
  }
  for (let i = 0; i < pendingB; i += 1) {
    push(DEMO_USER_IDS.studentB, SubmissionStatus.PENDING);
  }
  for (let i = 0; i < approvedB; i += 1) {
    push(DEMO_USER_IDS.studentB, SubmissionStatus.APPROVED, {
      decision: ReviewDecision.APPROVED,
      note: "Nice ownership isolation example. Approved for the demo queue.",
      functionality: CheckpointAssessment.MEETS_EXPECTATIONS,
      usability: CheckpointAssessment.NOT_ASSESSED,
      documentation: CheckpointAssessment.MEETS_EXPECTATIONS,
    });
  }
  for (let i = 0; i < rejectedB; i += 1) {
    push(DEMO_USER_IDS.studentB, SubmissionStatus.REJECTED, {
      decision: ReviewDecision.REJECTED,
      note: "Repository uniqueness conflict examples stay rejected in the sandbox.",
      functionality: CheckpointAssessment.NOT_ASSESSED,
      usability: CheckpointAssessment.NEEDS_IMPROVEMENT,
      documentation: CheckpointAssessment.NEEDS_IMPROVEMENT,
    });
  }

  return fixtures;
}

export function demoRepositoryUrl(key: string): string {
  return repoUrl(key);
}

export function demoLiveUrl(key: string): string {
  return liveUrl(key);
}

export function demoCanonicalRepositoryUrl(key: string): string {
  return repoUrl(key);
}

export const DEMO_SUBMISSION_COUNT = buildDemoSubmissionFixtures().length;
