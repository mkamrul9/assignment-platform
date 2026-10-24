"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

import { checkpointLabel, CHECKPOINT_FIELDS } from "@/features/reviews/checkpoint-labels";

import type { Submission } from "./types";

type ListState =
  | { status: "loading"; submissions: Submission[]; errorMessage: string | null }
  | { status: "ready"; submissions: Submission[]; errorMessage: string | null }
  | { status: "error"; submissions: Submission[]; errorMessage: string | null };

let listState: ListState = {
  status: "loading",
  submissions: [],
  errorMessage: null,
};
let listPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return listState;
}

function getServerSnapshot(): ListState {
  return { status: "loading", submissions: [], errorMessage: null };
}

function write(next: ListState) {
  listState = next;
  emit();
}

async function fetchProjects(): Promise<void> {
  write({ status: "loading", submissions: listState.submissions, errorMessage: null });
  try {
    const data = await apiFetch<{ submissions: Submission[] }>("/api/submissions/mine", {
      method: "GET",
      cache: "no-store",
    });
    write({ status: "ready", submissions: data.submissions, errorMessage: null });
  } catch (error) {
    write({
      status: "error",
      submissions: [],
      errorMessage: error instanceof ApiError ? error.message : "Unable to load your projects.",
    });
  }
}

function ensureLoaded(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!listPromise) {
    listPromise = fetchProjects();
  }
  return listPromise;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: Submission["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pending review";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

export function ProjectList() {
  const state = useSyncExternalStore(
    subscribe,
    () => {
      void ensureLoaded();
      return getSnapshot();
    },
    getServerSnapshot,
  );

  const reload = useCallback(() => {
    listPromise = fetchProjects();
    return listPromise;
  }, []);

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading your projects…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 bg-card px-5 py-4">
        <p className="text-sm text-destructive" role="alert">
          {state.errorMessage}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  if (state.submissions.length === 0) {
    return (
      <div className="rounded-lg border bg-card px-5 py-6">
        <p className="text-sm leading-6 text-muted-foreground">
          You have not submitted a project yet. Add a repository, live link, and short description
          to get started.
        </p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/student/submit">Submit a project</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {state.submissions.map((submission) => (
        <li key={submission.id} className="rounded-lg border bg-card px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{submission.projectName}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted {formatDate(submission.createdAt)}
              </p>
            </div>
            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {statusLabel(submission.status)}
            </span>
          </div>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {submission.description}
          </p>

          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <a
              href={submission.repositoryUrl}
              className="font-medium text-primary underline-offset-4 hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              Repository
            </a>
            <a
              href={submission.liveUrl}
              className="font-medium text-primary underline-offset-4 hover:underline"
              rel="noreferrer"
              target="_blank"
            >
              Live demo
            </a>
          </div>

          {submission.review ? (
            <div className="mt-4 rounded-md border bg-background px-4 py-3 text-sm">
              <p className="font-medium">
                Review: {submission.review.decision === "APPROVED" ? "Approved" : "Rejected"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(submission.review.reviewedAt)}
              </p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                {CHECKPOINT_FIELDS.map((field) => (
                  <div key={field.key}>
                    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {field.label}
                    </dt>
                    <dd className="mt-1">{checkpointLabel(submission.review![field.key])}</dd>
                  </div>
                ))}
              </dl>
              {submission.review.note ? (
                <p className="mt-3 whitespace-pre-wrap leading-6 text-muted-foreground">
                  {submission.review.note}
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Reset cached list state after a successful submission from another page. */
export function invalidateProjectListCache() {
  listPromise = null;
  write({ status: "loading", submissions: [], errorMessage: null });
}
