export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: Array<{ path?: string; message?: string }>;
    retryAfterSeconds?: number;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Array<{ path?: string; message?: string }>;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Array<{ path?: string; message?: string }>,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiErrorBody & T)
    : null;

  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details,
      error?.retryAfterSeconds,
    );
  }

  return payload as T;
}
