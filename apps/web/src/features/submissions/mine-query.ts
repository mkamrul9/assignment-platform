export type MineStatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

export const SEARCH_MAX = 100;
export const SEARCH_DEBOUNCE_MS = 350;
export const PAGE_SIZES = [10, 20, 50] as const;

export function queryKeyOf(page: number, pageSize: number, status: MineStatusFilter, q: string) {
  return `${status}|${page}|${pageSize}|${q}`;
}

export function parseStatus(value: string | null): MineStatusFilter {
  if (value === "ALL" || value === "PENDING" || value === "APPROVED" || value === "REJECTED") {
    return value;
  }
  return "ALL";
}

export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function parsePageSize(value: string | null): number {
  const n = Number(value);
  return PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number]) ? n : 10;
}

export function parseSearch(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.trim().slice(0, SEARCH_MAX);
}

export function buildMineSearchParams(input: {
  page: number;
  pageSize: number;
  status: MineStatusFilter;
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
