import type { Response } from "express";

export type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    retryAfterSeconds?: number;
  };
};

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  extras?: { details?: unknown; retryAfterSeconds?: number },
): void {
  const body: ErrorBody = {
    error: {
      code,
      message,
      ...(extras?.details !== undefined ? { details: extras.details } : {}),
      ...(extras?.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: extras.retryAfterSeconds }
        : {}),
    },
  };

  if (extras?.retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(extras.retryAfterSeconds));
  }

  res.status(status).json(body);
}
