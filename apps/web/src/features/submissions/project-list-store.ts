"use client";

import { ApiError, apiFetch } from "@/lib/api";

import { buildMineSearchParams, queryKeyOf, type MineStatusFilter } from "./mine-query";
import type { OwnerSubmissionStats, PaginationMeta, Submission } from "./types";

type LoadStatus = "loading" | "ready" | "error";

type ListSlice = {
  status: LoadStatus;
  submissions: Submission[];
  pagination: PaginationMeta | null;
  stats: OwnerSubmissionStats | null;
  errorMessage: string | null;
  queryKey: string;
};

type StoreState = {
  list: ListSlice;
};

const emptyStats: OwnerSubmissionStats = { pending: 0, approved: 0, rejected: 0, total: 0 };

let store: StoreState = {
  list: {
    status: "loading",
    submissions: [],
    pagination: null,
    stats: null,
    errorMessage: null,
    queryKey: "",
  },
};

let listPromise: Promise<void> | null = null;
let listRequestSeq = 0;
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

function write(next: StoreState) {
  store = next;
  emit();
}

async function fetchList(
  page: number,
  pageSize: number,
  status: MineStatusFilter,
  q: string,
): Promise<void> {
  const key = queryKeyOf(page, pageSize, status, q);
  const seq = ++listRequestSeq;
  write({
    list: {
      status: "loading",
      submissions: store.list.submissions,
      pagination: store.list.pagination,
      stats: store.list.stats,
      errorMessage: null,
      queryKey: key,
    },
  });

  try {
    const params = buildMineSearchParams({ page, pageSize, status, q });
    const data = await apiFetch<{
      submissions: Submission[];
      pagination: PaginationMeta;
      stats: OwnerSubmissionStats;
    }>(`/api/submissions/mine?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (seq !== listRequestSeq) {
      return;
    }

    let rows = data.submissions;
    let meta = data.pagination;
    let pageUsed = page;

    if (rows.length === 0 && meta.total > 0 && meta.totalPages > 0 && page > meta.totalPages) {
      pageUsed = meta.totalPages;
      const retryParams = buildMineSearchParams({ page: pageUsed, pageSize, status, q });
      const retry = await apiFetch<{
        submissions: Submission[];
        pagination: PaginationMeta;
        stats: OwnerSubmissionStats;
      }>(`/api/submissions/mine?${retryParams.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (seq !== listRequestSeq) {
        return;
      }
      rows = retry.submissions;
      meta = retry.pagination;
    }

    write({
      list: {
        status: "ready",
        submissions: rows,
        pagination: meta,
        stats: data.stats ?? emptyStats,
        errorMessage: null,
        queryKey: queryKeyOf(pageUsed, pageSize, status, q),
      },
    });
  } catch (error) {
    if (seq !== listRequestSeq) {
      return;
    }
    write({
      list: {
        status: "error",
        submissions: [],
        pagination: null,
        stats: store.list.stats,
        errorMessage: error instanceof ApiError ? error.message : "Unable to load your projects.",
        queryKey: key,
      },
    });
  }
}

export function ensureProjectList(
  page: number,
  pageSize: number,
  status: MineStatusFilter,
  q: string,
): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  const key = queryKeyOf(page, pageSize, status, q);
  if (!listPromise || store.list.queryKey !== key) {
    listPromise = fetchList(page, pageSize, status, q);
  }
  return listPromise;
}

export function requestProjectList(
  page: number,
  pageSize: number,
  status: MineStatusFilter,
  q: string,
): Promise<void> {
  listPromise = fetchList(page, pageSize, status, q);
  return listPromise;
}

/** Account changes and successful submissions invalidate the cache. */
export function invalidateProjectListCache(): void {
  listRequestSeq += 1;
  listPromise = null;
  write({
    list: {
      status: "loading",
      submissions: [],
      pagination: null,
      stats: null,
      errorMessage: null,
      queryKey: "",
    },
  });
}
