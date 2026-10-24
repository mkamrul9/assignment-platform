-- CreateEnum
CREATE TYPE "CheckpointAssessment" AS ENUM ('MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT', 'NOT_ASSESSED');

-- AlterTable: existing reviews become unassessed (NOT_ASSESSED), not invented grades.
ALTER TABLE "reviews" ADD COLUMN "functionality" "CheckpointAssessment" NOT NULL DEFAULT 'NOT_ASSESSED';
ALTER TABLE "reviews" ADD COLUMN "usability" "CheckpointAssessment" NOT NULL DEFAULT 'NOT_ASSESSED';
ALTER TABLE "reviews" ADD COLUMN "documentation" "CheckpointAssessment" NOT NULL DEFAULT 'NOT_ASSESSED';
