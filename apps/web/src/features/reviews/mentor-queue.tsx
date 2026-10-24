"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";

import {
  CHECKPOINT_FIELDS,
  CHECKPOINT_OPTIONS,
  checkpointLabel,
  type CheckpointFieldKey,
} from "./checkpoint-labels";
import type {
  CheckpointAssessment,
  PaginationMeta,
  QueueStatusFilter,
  QueueSubmission,
  ReviewCheckpoints,
  ReviewDecision,
  ReviewStats,
} from "./types";

type LoadStatus = "loading" | "ready" | "error";

type StatsSlice = {
  status: LoadStatus;
  stats: ReviewStats;
  errorMessage: string | null;
};

type QueueSlice = {
  status: LoadStatus;
  submissions: QueueSubmission[];
  pagination: PaginationMeta | null;
  errorMessage: string | null;
  queryKey: string;
};

type StoreState = {
  stats: StatsSlice;
  queue: QueueSlice;
};

const emptyStats: ReviewStats = { pending: 0, approved: 0, rejected: 0, total: 0 };
const SEARCH_MAX = 100;
const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZES = [10, 20, 50] as const;

const DEFAULT_CHECKPOINTS: ReviewCheckpoints = {
  functionality: "NOT_ASSESSED",
  usability: "NOT_ASSESSED",
  documentation: "NOT_ASSESSED",
};

let store: StoreState = {
  stats: { status: "loading", stats: emptyStats, errorMessage: null },
  queue: {
    status: "loading",
    submissions: [],
    pagination: null,
    errorMessage: null,
    queryKey: "",
  },
};

let statsPromise: Promise<void> | null = null;
let queuePromise: Promise<void> | null = null;
let queueRequestSeq = 0;
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
  return store;
}

function getServerSnapshot(): StoreState {
  return {
    stats: { status: "loading", stats: emptyStats, errorMessage: null },
    queue: {
      status: "loading",
      submissions: [],
      pagination: null,
      errorMessage: null,
      queryKey: "",
    },
  };
}

function write(next: StoreState) {
  store = next;
  emit();
}

function queryKeyOf(page: number, pageSize: number, status: QueueStatusFilter, q: string) {
  return `${status}|${page}|${pageSize}|${q}`;
}

function parseStatus(value: string | null): QueueStatusFilter {
  if (value === "ALL" || value === "PENDING" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  return "PENDING";
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function parsePageSize(value: string | null): number {
  const n = Number(value);
  return PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number]) ? n : 10;
}

function parseSearch(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.trim().slice(0, SEARCH_MAX);
}

function buildQueueSearchParams(input: {
  page: number;
  pageSize: number;
  status: QueueStatusFilter;
  q: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  params.set("pageSize", String(input.pageSize));
  params.set("status", input.status);
  if (input.q) {
    params.set("q", input.q);
  }
  return params;
}

async function fetchStats(): Promise<void> {
  write({
    ...store,
    stats: { status: "loading", stats: store.stats.stats, errorMessage: null },
  });
  try {
    const data = await apiFetch<{ stats: ReviewStats }>("/api/reviews/stats", {
      method: "GET",
      cache: "no-store",
    });
    write({
      ...store,
      stats: { status: "ready", stats: data.stats, errorMessage: null },
    });
  } catch (error) {
    write({
      ...store,
      stats: {
        status: "error",
        stats: store.stats.stats,
        errorMessage: error instanceof ApiError ? error.message : "Unable to load statistics.",
      },
    });
  }
}

async function fetchQueue(
  page: number,
  pageSize: number,
  status: QueueStatusFilter,
  q: string,
): Promise<void> {
  const key = queryKeyOf(page, pageSize, status, q);
  const seq = ++queueRequestSeq;
  write({
    ...store,
    queue: {
      status: "loading",
      submissions: store.queue.submissions,
      pagination: store.queue.pagination,
      errorMessage: null,
      queryKey: key,
    },
  });

  try {
    const params = buildQueueSearchParams({ page, pageSize, status, q });
    const data = await apiFetch<{
      submissions: QueueSubmission[];
      pagination: PaginationMeta;
    }>(`/api/reviews/submissions?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (seq !== queueRequestSeq) {
      return;
    }

    let rows = data.submissions;
    let meta = data.pagination;
    let pageUsed = page;

    if (rows.length === 0 && meta.total > 0 && meta.totalPages > 0 && page > meta.totalPages) {
      pageUsed = meta.totalPages;
      const retryParams = buildQueueSearchParams({ page: pageUsed, pageSize, status, q });
      const retry = await apiFetch<{
        submissions: QueueSubmission[];
        pagination: PaginationMeta;
      }>(`/api/reviews/submissions?${retryParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (seq !== queueRequestSeq) {
        return;
      }
      rows = retry.submissions;
      meta = retry.pagination;
    }

    write({
      ...store,
      queue: {
        status: "ready",
        submissions: rows,
        pagination: meta,
        errorMessage: null,
        queryKey: queryKeyOf(pageUsed, pageSize, status, q),
      },
    });
  } catch (error) {
    if (seq !== queueRequestSeq) {
      return;
    }
    write({
      ...store,
      queue: {
        status: "error",
        submissions: [],
        pagination: null,
        errorMessage: error instanceof ApiError ? error.message : "Unable to load the queue.",
        queryKey: key,
      },
    });
  }
}

function ensureStats(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!statsPromise) {
    statsPromise = fetchStats();
  }
  return statsPromise;
}

function ensureQueue(
  page: number,
  pageSize: number,
  status: QueueStatusFilter,
  q: string,
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  const key = queryKeyOf(page, pageSize, status, q);
  if (!queuePromise || store.queue.queryKey !== key) {
    queuePromise = fetchQueue(page, pageSize, status, q);
  }
  return queuePromise;
}

function requestStats(): Promise<void> {
  statsPromise = fetchStats();
  return statsPromise;
}

function requestQueue(
  page: number,
  pageSize: number,
  status: QueueStatusFilter,
  q: string,
): Promise<void> {
  queuePromise = fetchQueue(page, pageSize, status, q);
  return queuePromise;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: QueueSubmission["status"]): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
}

const FILTERS: Array<{ value: QueueStatusFilter; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export function MentorQueue() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteFieldId = useId();
  const searchFieldId = useId();
  const dialogTitleId = useId();
  const checkpointsHintId = useId();

  const filter = parseStatus(searchParams.get("status"));
  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const q = parseSearch(searchParams.get("q"));

  const [searchInput, setSearchInput] = useState(q);
  const [searchInputUrl, setSearchInputUrl] = useState(q);
  if (q !== searchInputUrl) {
    setSearchInputUrl(q);
    setSearchInput(q);
  }

  const state = useSyncExternalStore(
    subscribe,
    () => {
      void ensureStats();
      void ensureQueue(page, pageSize, filter, q);
      return getSnapshot();
    },
    getServerSnapshot,
  );

  const [selected, setSelected] = useState<QueueSubmission | null>(null);
  const [note, setNote] = useState("");
  const [checkpoints, setCheckpoints] = useState<ReviewCheckpoints>(DEFAULT_CHECKPOINTS);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const replaceQueueUrl = useCallback(
    (next: { page: number; pageSize: number; status: QueueStatusFilter; q: string }) => {
      const params = buildQueueSearchParams(next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const reloadStats = useCallback(() => requestStats(), []);

  const reloadQueue = useCallback(
    () => requestQueue(page, pageSize, filter, q),
    [page, pageSize, filter, q],
  );

  function openDialog(submission: QueueSubmission, trigger?: HTMLElement | null) {
    triggerRef.current = trigger ?? (document.activeElement as HTMLElement | null);
    setSelected(submission);
    setNote(submission.review?.note ?? "");
    setCheckpoints(
      submission.review
        ? {
            functionality: submission.review.functionality,
            usability: submission.review.usability,
            documentation: submission.review.documentation,
          }
        : { ...DEFAULT_CHECKPOINTS },
    );
    setNoteError(null);
    setFormError(null);
    setSuccessMessage(null);
    const dialog = dialogRef.current;
    dialog?.showModal();
    queueMicrotask(() => {
      const initial = dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]");
      initial?.focus();
    });
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    setSelected(null);
    setSaving(false);
    trigger?.focus?.();
  }

  function changeFilter(next: QueueStatusFilter) {
    replaceQueueUrl({ page: 1, pageSize, status: next, q });
    void requestQueue(1, pageSize, next, q);
  }

  function changePageSize(next: number) {
    replaceQueueUrl({ page: 1, pageSize: next, status: filter, q });
    void requestQueue(1, next, filter, q);
  }

  function goToPage(next: number) {
    replaceQueueUrl({ page: next, pageSize, status: filter, q });
    void requestQueue(next, pageSize, filter, q);
  }

  function applySearch(nextRaw: string) {
    const next = nextRaw.trim().slice(0, SEARCH_MAX);
    replaceQueueUrl({ page: 1, pageSize, status: filter, q: next });
    void requestQueue(1, pageSize, filter, next);
  }

  function onSearchChange(value: string) {
    const clipped = value.slice(0, SEARCH_MAX);
    setSearchInput(clipped);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      applySearch(clipped);
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearSearch() {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    setSearchInput("");
    applySearch("");
  }

  function setCheckpoint(key: CheckpointFieldKey, value: CheckpointAssessment) {
    setCheckpoints((prev) => ({ ...prev, [key]: value }));
  }

  async function refreshAfterDecision(updated: QueueSubmission) {
    setSelected(updated);
    setCheckpoints({
      functionality: updated.review?.functionality ?? "NOT_ASSESSED",
      usability: updated.review?.usability ?? "NOT_ASSESSED",
      documentation: updated.review?.documentation ?? "NOT_ASSESSED",
    });
    setSuccessMessage(
      updated.status === "APPROVED" ? "Project approved." : "Project rejected with feedback.",
    );
    await Promise.all([requestStats(), requestQueue(page, pageSize, filter, q)]);
    const recovered = store.queue.pagination?.page;
    if (recovered && recovered !== page) {
      replaceQueueUrl({ page: recovered, pageSize, status: filter, q });
    }
  }

  async function submitDecision(decision: ReviewDecision) {
    if (!selected || saving) {
      return;
    }

    setNoteError(null);
    setFormError(null);
    setSuccessMessage(null);

    if (decision === "REJECTED") {
      const trimmed = note.trim();
      if (trimmed.length < 10 || trimmed.length > 1000) {
        setNoteError("Rejection requires a note of 10–1,000 characters.");
        return;
      }
    }

    setSaving(true);
    try {
      const data = await apiFetch<{ submission: QueueSubmission }>(
        `/api/reviews/submissions/${selected.id}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            note: note.trim().length === 0 ? undefined : note,
            checkpoints,
          }),
        },
      );
      await refreshAfterDecision(data.submission);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 409) {
          setFormError(error.message);
          try {
            const params = buildQueueSearchParams({ page, pageSize, status: filter, q });
            const [queue, statsData] = await Promise.all([
              apiFetch<{ submissions: QueueSubmission[]; pagination: PaginationMeta }>(
                `/api/reviews/submissions?${params.toString()}`,
                { method: "GET", cache: "no-store" },
              ),
              apiFetch<{ stats: ReviewStats }>("/api/reviews/stats", {
                method: "GET",
                cache: "no-store",
              }),
            ]);
            write({
              stats: { status: "ready", stats: statsData.stats, errorMessage: null },
              queue: {
                status: "ready",
                submissions: queue.submissions,
                pagination: queue.pagination,
                errorMessage: null,
                queryKey: queryKeyOf(page, pageSize, filter, q),
              },
            });
            const fresh = queue.submissions.find((item) => item.id === selected.id) ?? null;
            if (fresh) {
              setSelected(fresh);
              setNote(fresh.review?.note ?? note);
              if (fresh.review) {
                setCheckpoints({
                  functionality: fresh.review.functionality,
                  usability: fresh.review.usability,
                  documentation: fresh.review.documentation,
                });
              }
            }
          } catch {
            setFormError(`${error.message} Refresh the queue to see the saved decision.`);
          }
        } else if (error.details?.length) {
          const noteDetail = error.details.find((detail) => detail.path === "note");
          if (noteDetail?.message) {
            setNoteError(noteDetail.message);
          }
          setFormError(error.message);
        } else {
          setFormError(error.message);
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  function onDialogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const { stats, queue } = state;

  return (
    <div className="min-w-0 max-w-full space-y-8">
      <section aria-label="Review statistics">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Workspace totals</h2>
          {stats.status === "error" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => void reloadStats()}>
              Retry stats
            </Button>
          ) : null}
        </div>
        {stats.errorMessage ? (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {stats.errorMessage}
          </p>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["Pending", stats.stats.pending],
              ["Approved", stats.stats.approved],
              ["Rejected", stats.stats.rejected],
              ["Total", stats.stats.total],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-2 font-serif text-3xl tracking-tight">
                {stats.status === "loading" ? "…" : value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Review queue" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Review queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find projects by name, student, or repository. Totals above stay global.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Status filter">
            {FILTERS.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                aria-pressed={filter === item.value}
                onClick={() => changeFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[min(100%,18rem)] flex-1 space-y-2">
            <Label htmlFor={searchFieldId}>Search projects</Label>
            <Input
              id={searchFieldId}
              type="search"
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Project, student, or repository"
              maxLength={SEARCH_MAX}
              aria-describedby={`${searchFieldId}-hint`}
            />
            <p id={`${searchFieldId}-hint`} className="text-xs text-muted-foreground">
              Up to {SEARCH_MAX} characters. Results update as you type.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearSearch}
            disabled={!searchInput && !q}
          >
            Clear search
          </Button>
          <div className="space-y-2">
            <Label htmlFor="pageSize">Rows</Label>
            <select
              id="pageSize"
              className="h-9 rounded-md border border-input bg-card px-3 text-sm"
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {queue.status === "loading" ? (
          <p className="text-sm text-muted-foreground">Loading the queue…</p>
        ) : null}

        {queue.status === "error" ? (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-card px-5 py-4">
            <p className="text-sm text-destructive" role="alert">
              {queue.errorMessage}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void reloadQueue()}>
              Try again
            </Button>
          </div>
        ) : null}

        {queue.status === "ready" && queue.submissions.length === 0 ? (
          <div className="rounded-lg border bg-card px-5 py-6 text-sm text-muted-foreground">
            {q ? "No projects match this search and filter." : "No projects match this filter."}
          </div>
        ) : null}

        {queue.status === "ready" && queue.submissions.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-secondary/40 text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Project
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Submitted
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.submissions.map((submission) => (
                  <tr key={submission.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground">{submission.projectName}</div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs">
                        <a
                          href={submission.repositoryUrl}
                          className="text-primary underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Repository
                        </a>
                        <a
                          href={submission.liveUrl}
                          className="text-primary underline-offset-4 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Live demo
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>{submission.owner.name}</div>
                      <div className="text-xs text-muted-foreground">{submission.owner.email}</div>
                    </td>
                    <td className="px-4 py-3 align-top">{statusLabel(submission.status)}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {formatDate(submission.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => openDialog(submission, event.currentTarget)}
                      >
                        {submission.status === "PENDING" ? "Review" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {queue.pagination && queue.pagination.totalPages > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              Page {queue.pagination.page} of {queue.pagination.totalPages} ·{" "}
              {queue.pagination.total} matching
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!queue.pagination.hasPreviousPage}
                onClick={() => goToPage(Math.max(1, page - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!queue.pagination.hasNextPage}
                onClick={() => goToPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        className="w-[min(100%,36rem)] max-h-[min(90vh,40rem)] overflow-y-auto rounded-xl border bg-card p-0 text-foreground shadow-lg backdrop:bg-foreground/40"
        onClose={handleDialogClose}
      >
        {selected ? (
          <form className="space-y-5 p-6" onSubmit={onDialogSubmit}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                  {statusLabel(selected.status)}
                </p>
                <h3 id={dialogTitleId} className="mt-2 font-serif text-2xl tracking-tight">
                  {selected.projectName}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
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

            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
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
                    Optional checkpoints give students more specific feedback. Your approve or
                    reject decision remains the overall outcome.
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
                    Optional for approval. Required for rejection (10–1,000 characters). Use this
                    for actionable improvement guidance.
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
    </div>
  );
}
