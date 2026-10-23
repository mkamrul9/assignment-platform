-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'MENTOR');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "project_name" VARCHAR(100) NOT NULL,
    "repository_url" VARCHAR(2048) NOT NULL,
    "canonical_repository_url" VARCHAR(2048) NOT NULL,
    "live_url" VARCHAR(2048) NOT NULL,
    "description" VARCHAR(5000) NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "note" VARCHAR(1000),
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_canonical_repository_url_key" ON "submissions"("canonical_repository_url");

-- CreateIndex
CREATE INDEX "submissions_owner_created_idx" ON "submissions"("owner_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "submissions_status_created_idx" ON "submissions"("status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_submission_id_key" ON "reviews"("submission_id");

-- CreateIndex
CREATE INDEX "reviews_mentor_idx" ON "reviews"("mentor_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
