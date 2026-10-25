"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, apiFetch } from "@/lib/api";

import { invalidateProjectListCache } from "./project-list";
import {
  cancelPendingDraftWrite,
  clearSubmissionDraft,
  loadSubmissionDraft,
  scheduleDraftSave,
} from "./submission-draft";
import type { Submission } from "./types";

type FieldKey = "projectName" | "repositoryUrl" | "liveUrl" | "description" | "form";
type FieldErrors = Partial<Record<FieldKey, string>>;

function clientValidate(values: {
  projectName: string;
  repositoryUrl: string;
  liveUrl: string;
  description: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.projectName.trim();
  const description = values.description.trim();
  const repositoryUrl = values.repositoryUrl.trim();
  const liveUrl = values.liveUrl.trim();

  if (name.length < 3 || name.length > 100) {
    errors.projectName = "Project name must be 3–100 characters.";
  }
  if (description.length < 20 || description.length > 5000) {
    errors.description = "Description must be 20–5,000 characters.";
  }
  for (const [key, label, value] of [
    ["repositoryUrl", "Repository URL", repositoryUrl],
    ["liveUrl", "Live URL", liveUrl],
  ] as const) {
    if (!value) {
      errors[key] = `${label} is required.`;
      continue;
    }
    if (value.length > 2048) {
      errors[key] = `${label} must be at most 2048 characters.`;
      continue;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") {
        errors[key] = `${label} must use HTTPS.`;
      } else if (parsed.username || parsed.password) {
        errors[key] = `${label} must not include credentials.`;
      }
    } catch {
      errors[key] = `${label} must be a valid absolute URL.`;
    }
  }

  return errors;
}

function formatDraftTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function SubmissionForm() {
  const router = useRouter();
  const { user, status } = useAuth();
  const draftStatusId = useId();
  const hydratedForUser = useRef<string | null>(null);

  const [projectName, setProjectName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !user || user.role !== "STUDENT") {
      return;
    }
    if (hydratedForUser.current === user.id) {
      return;
    }
    hydratedForUser.current = user.id;
    const loaded = loadSubmissionDraft(user.id);
    setProjectName(loaded.fields.projectName);
    setRepositoryUrl(loaded.fields.repositoryUrl);
    setLiveUrl(loaded.fields.liveUrl);
    setDescription(loaded.fields.description);
    setDraftSavedAt(loaded.savedAt);
    setDraftRestored(Boolean(loaded.savedAt));
  }, [status, user]);

  useEffect(() => {
    if (status !== "authenticated" || !user || user.role !== "STUDENT") {
      return;
    }
    if (hydratedForUser.current !== user.id) {
      return;
    }
    scheduleDraftSave(user.id, { projectName, repositoryUrl, liveUrl, description }, (savedAt) => {
      setDraftSavedAt(savedAt);
      if (savedAt) {
        setDraftRestored(false);
      }
    });
  }, [projectName, repositoryUrl, liveUrl, description, status, user]);

  function discardDraft() {
    if (!user) {
      return;
    }
    cancelPendingDraftWrite();
    clearSubmissionDraft(user.id);
    setProjectName("");
    setRepositoryUrl("");
    setLiveUrl("");
    setDescription("");
    setDraftSavedAt(null);
    setDraftRestored(false);
    setErrors({});
    setSuccessName(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const localErrors = clientValidate({ projectName, repositoryUrl, liveUrl, description });
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      setSuccessName(null);
      return;
    }

    setErrors({});
    setSuccessName(null);
    setSubmitting(true);

    try {
      const data = await apiFetch<{ submission: Submission }>("/api/submissions", {
        method: "POST",
        body: JSON.stringify({ projectName, repositoryUrl, liveUrl, description }),
      });
      if (user) {
        cancelPendingDraftWrite();
        clearSubmissionDraft(user.id);
      }
      setDraftSavedAt(null);
      setDraftRestored(false);
      setSuccessName(data.submission.projectName);
      setProjectName("");
      setRepositoryUrl("");
      setLiveUrl("");
      setDescription("");
      invalidateProjectListCache();
      router.refresh();
    } catch (error) {
      // Keep the draft after validation, duplicate, rate-limit, or network errors.
      if (error instanceof ApiError) {
        const nextErrors: FieldErrors = {};
        for (const detail of error.details ?? []) {
          const key = detail.path as FieldKey;
          if (
            key === "projectName" ||
            key === "repositoryUrl" ||
            key === "liveUrl" ||
            key === "description"
          ) {
            nextErrors[key] = detail.message ?? error.message;
          }
        }
        nextErrors.form = error.message;
        setErrors(nextErrors);
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-5" noValidate>
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/40 px-3 py-2 text-sm"
        aria-live="polite"
        id={draftStatusId}
      >
        <p className="text-muted-foreground">
          {draftRestored && draftSavedAt
            ? `Restored a draft saved on this device (${formatDraftTime(draftSavedAt)}).`
            : draftSavedAt
              ? `Draft saved on this device (${formatDraftTime(draftSavedAt)}).`
              : "Drafts stay on this device until you submit or discard them."}
        </p>
        {(draftSavedAt || projectName || repositoryUrl || liveUrl || description) && (
          <Button type="button" variant="outline" size="sm" onClick={discardDraft}>
            Discard draft
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectName">Project name</Label>
        <Input
          id="projectName"
          name="projectName"
          autoComplete="off"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          aria-invalid={Boolean(errors.projectName)}
          aria-describedby={
            errors.projectName ? "projectName-error" : `projectName-hint ${draftStatusId}`
          }
          disabled={submitting}
          required
        />
        <p id="projectName-hint" className="text-xs text-muted-foreground">
          3–100 characters. Shown as plain text.
        </p>
        {errors.projectName ? (
          <p id="projectName-error" className="text-sm text-destructive">
            {errors.projectName}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="repositoryUrl">Repository URL</Label>
        <Input
          id="repositoryUrl"
          name="repositoryUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://github.com/owner/repo"
          value={repositoryUrl}
          onChange={(event) => setRepositoryUrl(event.target.value)}
          aria-invalid={Boolean(errors.repositoryUrl)}
          aria-describedby={errors.repositoryUrl ? "repositoryUrl-error" : "repositoryUrl-hint"}
          disabled={submitting}
          required
        />
        <p id="repositoryUrl-hint" className="text-xs text-muted-foreground">
          Absolute HTTPS link only. Equivalent repository URLs count as the same project.
        </p>
        {errors.repositoryUrl ? (
          <p id="repositoryUrl-error" className="text-sm text-destructive">
            {errors.repositoryUrl}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="liveUrl">Live demo URL</Label>
        <Input
          id="liveUrl"
          name="liveUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          placeholder="https://example.com"
          value={liveUrl}
          onChange={(event) => setLiveUrl(event.target.value)}
          aria-invalid={Boolean(errors.liveUrl)}
          aria-describedby={errors.liveUrl ? "liveUrl-error" : "liveUrl-hint"}
          disabled={submitting}
          required
        />
        <p id="liveUrl-hint" className="text-xs text-muted-foreground">
          Absolute HTTPS link to the running project.
        </p>
        {errors.liveUrl ? (
          <p id="liveUrl-error" className="text-sm text-destructive">
            {errors.liveUrl}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={6}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? "description-error" : "description-hint"}
          disabled={submitting}
          required
          className="flex min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm"
        />
        <p id="description-hint" className="text-xs text-muted-foreground">
          20–5,000 characters. Mentors see this as plain text.
        </p>
        {errors.description ? (
          <p id="description-error" className="text-sm text-destructive">
            {errors.description}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p
          className="rounded-md border border-destructive/30 bg-card px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {errors.form}
        </p>
      ) : null}

      {successName ? (
        <p
          className="rounded-md border border-primary/20 bg-secondary px-3 py-2 text-sm text-secondary-foreground"
          role="status"
        >
          “{successName}” was submitted.{" "}
          <Link href="/student" className="font-medium underline-offset-4 hover:underline">
            View your projects
          </Link>
          .
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit project"}
        </Button>
        <Button asChild type="button" variant="outline" size="lg">
          <Link href="/student">Back to projects</Link>
        </Button>
      </div>
    </form>
  );
}
