"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
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

import {
  buildMineSearchParams,
  PAGE_SIZES,
  parsePage,
  parsePageSize,
  parseSearch,
  parseStatus,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX,
  type MineStatusFilter,
} from "./mine-query";
import {
  ensureProjectList,
  getServerSnapshot,
  getSnapshot,
  requestProjectList,
  subscribe,
} from "./project-list-store";
import { StatusBadge } from "./status-badge";
import type { OwnerSubmissionStats } from "./types";

const FILTERS: Array<{ value: MineStatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statsLabel(stats: OwnerSubmissionStats | null, status: MineStatusFilter): string | null {
  if (!stats) {
    return null;
  }
  if (status === "ALL") {
    return `${stats.total}`;
  }
  if (status === "PENDING") {
    return `${stats.pending}`;
  }
  if (status === "APPROVED") {
    return `${stats.approved}`;
  }
  return `${stats.rejected}`;
}

function ProjectListInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchFieldId = useId();
  const pageSizeId = useId();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const subscribeToList = useCallback(
    (listener: () => void) => {
      const unsubscribe = subscribe(listener);
      void ensureProjectList(page, pageSize, filter, q);
      return unsubscribe;
    },
    [page, pageSize, filter, q],
  );
  const state = useSyncExternalStore(subscribeToList, getSnapshot, getServerSnapshot);

  const writeListUrl = useCallback(
    (
      next: { page: number; pageSize: number; status: MineStatusFilter; q: string },
      mode: "replace" | "push" = "replace",
    ) => {
      const params = buildMineSearchParams(next);
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (mode === "push") {
        router.push(href, { scroll: false });
      } else {
        router.replace(href, { scroll: false });
      }
    },
    [pathname, router],
  );

  const reload = useCallback(
    () => requestProjectList(page, pageSize, filter, q),
    [page, pageSize, filter, q],
  );

  useEffect(() => {
    if (state.list.status !== "ready" || !state.list.pagination) {
      return;
    }
    const recovered = state.list.pagination.page;
    if (recovered !== page) {
      writeListUrl({ page: recovered, pageSize, status: filter, q }, "replace");
    }
  }, [state.list.status, state.list.pagination, page, pageSize, filter, q, writeListUrl]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  function changeFilter(next: MineStatusFilter) {
    writeListUrl({ page: 1, pageSize, status: next, q }, "replace");
    void requestProjectList(1, pageSize, next, q);
  }

  function changePageSize(next: number) {
    writeListUrl({ page: 1, pageSize: next, status: filter, q }, "replace");
    void requestProjectList(1, next, filter, q);
  }

  function goToPage(next: number) {
    // Push so browser Back/Forward can move between pages.
    writeListUrl({ page: next, pageSize, status: filter, q }, "push");
    void requestProjectList(next, pageSize, filter, q);
  }

  function applySearch(nextRaw: string) {
    const next = nextRaw.trim().slice(0, SEARCH_MAX);
    writeListUrl({ page: 1, pageSize, status: filter, q: next }, "replace");
    void requestProjectList(1, pageSize, filter, next);
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
    writeListUrl({ page: 1, pageSize, status: filter, q: "" }, "replace");
    void requestProjectList(1, pageSize, filter, "");
  }

  const pagination = state.list.pagination;
  const stats = state.list.stats;
  const hasAnyProjects = (stats?.total ?? 0) > 0 || state.list.submissions.length > 0;
  const filtersActive = filter !== "ALL" || q.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor={searchFieldId}>Search projects</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={searchFieldId}
              type="search"
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (searchDebounceRef.current) {
                    clearTimeout(searchDebounceRef.current);
                  }
                  applySearch(searchInput);
                }
              }}
              placeholder="Name or repository URL"
              maxLength={SEARCH_MAX}
              className="max-w-md"
              autoComplete="off"
            />
            {searchInput ? (
              <Button type="button" variant="outline" size="sm" onClick={clearSearch}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={pageSizeId}>Page size</Label>
          <select
            id={pageSizeId}
            className="flex h-9 w-full min-w-[6rem] rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((item) => {
          const count = statsLabel(stats, item.value);
          const selected = filter === item.value;
          return (
            <Button
              key={item.value}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              onClick={() => changeFilter(item.value)}
            >
              {item.label}
              {count !== null ? (
                <span className="ml-1.5 tabular-nums opacity-80">({count})</span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {state.list.status === "loading" ? (
        <p className="text-sm text-muted-foreground">Loading your projects…</p>
      ) : null}

      {state.list.status === "error" ? (
        <div className="space-y-3 rounded-lg border border-destructive/30 bg-card px-5 py-4">
          <p className="text-sm text-destructive" role="alert">
            {state.list.errorMessage}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : null}

      {state.list.status === "ready" && state.list.submissions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-6">
          <p className="text-sm leading-6 text-muted-foreground">
            {!hasAnyProjects && !filtersActive
              ? "You have not submitted a project yet. Add a repository, live link, and short description to get started."
              : "No projects match this search or filter."}
          </p>
          {!hasAnyProjects && !filtersActive ? (
            <Button asChild className="mt-4" size="sm">
              <Link href="/student/submit">Submit a project</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {state.list.status === "ready" && state.list.submissions.length > 0 ? (
        <ul className="space-y-3">
          {state.list.submissions.map((submission) => (
            <li key={submission.id} className="rounded-lg border border-border bg-card px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight">
                    <Link
                      href={`/student/projects/${submission.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {submission.projectName}
                    </Link>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDate(submission.createdAt)}
                  </p>
                </div>
                <StatusBadge status={submission.status} />
              </div>
              <div className="mt-3">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/student/projects/${submission.id}`}>View details</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {pagination && pagination.totalPages > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
            <span className="mx-1">·</span>
            {pagination.total} project{pagination.total === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!pagination.hasPreviousPage}
              onClick={() => goToPage(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => goToPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProjectList() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading your projects…</p>}>
      <ProjectListInner />
    </Suspense>
  );
}

export { invalidateProjectListCache } from "./project-list-store";
