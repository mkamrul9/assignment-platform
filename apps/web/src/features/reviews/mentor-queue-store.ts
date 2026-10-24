"use client";

import { ApiError, apiFetch } from "@/lib/api";
import { buildQueueSearchParams, queryKeyOf } from "./queue-query";
import type { PaginationMeta, QueueStatusFilter, QueueSubmission, ReviewStats } from "./types";

// Browser-only cache. Request IDs discard older responses after filter/navigation changes.
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
let statsRequestSeq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot() {
  return store;
}

const SERVER_SNAPSHOT: StoreState = store;

export function getServerSnapshot(): StoreState {
  return SERVER_SNAPSHOT;
}

export function write(next: StoreState) {
  store = next;
  emit();
}

async function fetchStats(): Promise<void> {
  const seq = ++statsRequestSeq;
  write({
    ...store,
    stats: { status: "loading", stats: store.stats.stats, errorMessage: null },
  });
  try {
    const data = await apiFetch<{ stats: ReviewStats }>("/api/reviews/stats", {
      method: "GET",
      cache: "no-store",
    });
    if (seq !== statsRequestSeq) return;
    write({
      ...store,
      stats: { status: "ready", stats: data.stats, errorMessage: null },
    });
  } catch (error) {
    if (seq !== statsRequestSeq) return;
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

export function ensureStats(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (!statsPromise) {
    statsPromise = fetchStats();
  }
  return statsPromise;
}

export function ensureQueue(
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

export function requestStats(): Promise<void> {
  statsPromise = fetchStats();
  return statsPromise;
}

export function requestQueue(
  page: number,
  pageSize: number,
  status: QueueStatusFilter,
  q: string,
): Promise<void> {
  queuePromise = fetchQueue(page, pageSize, status, q);
  return queuePromise;
}

/** Account changes invalidate both the cache and any requests still in flight. */
export function resetMentorQueueCache(): void {
  queueRequestSeq += 1;
  statsRequestSeq += 1;
  statsPromise = null;
  queuePromise = null;
  write(SERVER_SNAPSHOT);
}
