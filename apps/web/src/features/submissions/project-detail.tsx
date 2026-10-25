"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api";

import { checkpointLabel, CHECKPOINT_FIELDS } from "@/features/reviews/checkpoint-labels";

import { StatusBadge } from "./status-badge";
import type { Submission } from "./types";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; submission: Submission }
  | { status: "missing" }
  | { status: "error"; message: string };

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setState({ status: "loading" });
    try {
      const data = await apiFetch<{ submission: Submission }>(`/api/submissions/${projectId}`, {
        method: "GET",
        cache: "no-store",
      });
      if (seq !== requestSeq.current) {
        return;
      }
      setState({ status: "ready", submission: data.submission });
    } catch (error) {
      if (seq !== requestSeq.current) {
        return;
      }
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/student/projects/${projectId}`)}`);
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        setState({ status: "missing" });
        return;
      }
      setState({
        status: "error",
        message: error instanceof ApiError ? error.message : "Unable to load this project.",
      });
    }
  }, [projectId, router]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    let cancelled = false;

    void (async () => {
      try {
        const data = await apiFetch<{ submission: Submission }>(`/api/submissions/${projectId}`, {
          method: "GET",
          cache: "no-store",
        });
        if (cancelled || seq !== requestSeq.current) {
          return;
        }
        setState({ status: "ready", submission: data.submission });
      } catch (error) {
        if (cancelled || seq !== requestSeq.current) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/student/projects/${projectId}`)}`);
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: "missing" });
          return;
        }
        setState({
          status: "error",
          message: error instanceof ApiError ? error.message : "Unable to load this project.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  if (state.status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading project…</p>;
  }

  if (state.status === "missing") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground" role="status">
          This project is not available. It may have been removed, or you may not have access.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/student">Back to projects</Link>
        </Button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/30 bg-card px-5 py-4">
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Try again
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/student">Back to projects</Link>
          </Button>
        </div>
      </div>
    );
  }

  const submission = state.submission;
  const timeline: Array<{ label: string; at: string }> = [
    { label: "Submitted", at: submission.createdAt },
  ];
  if (submission.review) {
    timeline.push({
      label: submission.review.decision === "APPROVED" ? "Approved" : "Rejected",
      at: submission.review.reviewedAt,
    });
  }

  return (
    <article className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide text-primary">Project details</p>
          <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">
            {submission.projectName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted {formatDate(submission.createdAt)}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight">Description</h2>
        <p className="max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
          {submission.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <a
          href={submission.repositoryUrl}
          className="max-w-full truncate font-medium text-primary underline-offset-4 hover:underline"
          rel="noreferrer"
          target="_blank"
        >
          Repository
        </a>
        <a
          href={submission.liveUrl}
          className="max-w-full truncate font-medium text-primary underline-offset-4 hover:underline"
          rel="noreferrer"
          target="_blank"
        >
          Live demo
        </a>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Timeline</h2>
        <ol className="space-y-2 border-l border-border pl-4">
          {timeline.map((event) => (
            <li key={`${event.label}-${event.at}`} className="text-sm">
              <p className="font-medium">{event.label}</p>
              <p className="text-xs text-muted-foreground">{formatDate(event.at)}</p>
            </li>
          ))}
        </ol>
      </div>

      {submission.review ? (
        <div className="rounded-md border border-border bg-muted/40 px-4 py-4 text-sm">
          <h2 className="font-semibold tracking-tight">
            Review: {submission.review.decision === "APPROVED" ? "Approved" : "Rejected"}
          </h2>
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
      ) : (
        <p className="text-sm text-muted-foreground">No review decision yet.</p>
      )}

      <Button asChild variant="outline" size="sm">
        <Link href="/student">Back to projects</Link>
      </Button>
    </article>
  );
}
