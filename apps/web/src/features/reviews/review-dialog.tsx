"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CHECKPOINT_FIELDS,
  CHECKPOINT_OPTIONS,
  checkpointLabel,
  type CheckpointFieldKey,
} from "./checkpoint-labels";
import { formatDate, statusLabel } from "./presentation";
import type {
  CheckpointAssessment,
  QueueSubmission,
  ReviewCheckpoints,
  ReviewDecision,
} from "./types";

type ReviewDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  dialogTitleId: string;
  noteFieldId: string;
  checkpointsHintId: string;
  selected: QueueSubmission | null;
  note: string;
  checkpoints: ReviewCheckpoints;
  noteError: string | null;
  formError: string | null;
  saving: boolean;
  successMessage: string | null;
  handleDialogClose: () => void;
  closeDialog: () => void;
  setNote: (note: string) => void;
  setCheckpoint: (field: CheckpointFieldKey, value: CheckpointAssessment) => void;
  submitDecision: (decision: ReviewDecision) => Promise<void>;
};

/** Native modal semantics preserve keyboard containment and Escape behavior. */
export function ReviewDialog({
  dialogRef,
  dialogTitleId,
  noteFieldId,
  checkpointsHintId,
  selected,
  note,
  checkpoints,
  noteError,
  formError,
  saving,
  successMessage,
  handleDialogClose,
  closeDialog,
  setNote,
  setCheckpoint,
  submitDecision,
}: ReviewDialogProps) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={dialogTitleId}
      className="w-[min(100%,36rem)] max-h-[min(90vh,40rem)] overflow-y-auto rounded-xl border bg-card p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
      onClose={handleDialogClose}
    >
      {selected ? (
        <form className="space-y-5 p-6" onSubmit={(event) => event.preventDefault()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                {statusLabel(selected.status)}
              </p>
              <h3
                id={dialogTitleId}
                className="mt-2 break-words text-2xl font-semibold tracking-tight"
              >
                {selected.projectName}
              </h3>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {selected.owner.name} · {selected.owner.email}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-dialog-initial-focus
              onClick={closeDialog}
            >
              Close
            </Button>
          </div>

          <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
            {selected.description}
          </p>

          <div className="flex flex-wrap gap-4 text-sm">
            <a
              href={selected.repositoryUrl}
              className="font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Repository
            </a>
            <a
              href={selected.liveUrl}
              className="font-medium text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Live demo
            </a>
          </div>

          {selected.review ? (
            <div className="rounded-md border bg-background px-4 py-3 text-sm">
              <p className="font-medium">
                Reviewed by {selected.review.mentor.name}:{" "}
                {selected.review.decision === "APPROVED" ? "Approved" : "Rejected"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(selected.review.reviewedAt)}
              </p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                {CHECKPOINT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {field.label}
                    </dt>
                    <dd className="mt-1">{checkpointLabel(selected.review![field.key])}</dd>
                  </div>
                ))}
              </dl>
              {selected.review.note ? (
                <p className="mt-3 whitespace-pre-wrap leading-6 text-muted-foreground">
                  {selected.review.note}
                </p>
              ) : null}
            </div>
          ) : null}

          {selected.status === "PENDING" ? (
            <div className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Checkpoints</legend>
                <p id={checkpointsHintId} className="text-xs text-muted-foreground">
                  Optional checkpoints give students more specific feedback. Your approve or reject
                  decision remains the overall outcome.
                </p>
                {CHECKPOINT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={`${field.key}-checkpoint`}>{field.label}</Label>
                    <select
                      id={`${field.key}-checkpoint`}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={checkpoints[field.key]}
                      disabled={saving}
                      aria-describedby={checkpointsHintId}
                      onChange={(event) =>
                        setCheckpoint(field.key, event.target.value as CheckpointAssessment)
                      }
                    >
                      {CHECKPOINT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor={noteFieldId}>Review note</Label>
                <textarea
                  id={noteFieldId}
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={saving}
                  aria-invalid={Boolean(noteError)}
                  aria-describedby={noteError ? `${noteFieldId}-error` : `${noteFieldId}-hint`}
                  className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive"
                />
                <p id={`${noteFieldId}-hint`} className="text-xs text-muted-foreground">
                  Optional for approval. Required for rejection (10–1,000 characters). Use this for
                  actionable improvement guidance.
                </p>
                {noteError ? (
                  <p id={`${noteFieldId}-error`} className="text-sm text-destructive">
                    {noteError}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              {successMessage ? (
                <p className="text-sm text-primary" role="status">
                  {successMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitDecision("APPROVED")}
                >
                  {saving ? "Saving…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void submitDecision("REJECTED")}
                >
                  {saving ? "Saving…" : "Reject"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              {successMessage ? (
                <p className="text-sm text-primary" role="status">
                  {successMessage}
                </p>
              ) : null}
            </>
          )}
        </form>
      ) : null}
    </dialog>
  );
}
