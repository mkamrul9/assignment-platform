import { Router } from "express";
import type { ZodError } from "zod";

import { Role } from "../../generated/prisma/client.js";
import { sendError } from "../../lib/http.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/require-role.js";
import { requireTrustedOrigin } from "../../middleware/require-trusted-origin.js";
import {
  decideSubmission,
  getReviewStats,
  listReviewQueue,
  ReviewConflictError,
  ReviewNotFoundError,
} from "./reviews.service.js";
import { decisionBodySchema, queueQuerySchema } from "./reviews.schemas.js";

function validationDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

function rejectRepeatedQuery(
  query: Record<string, unknown>,
): { ok: true } | { ok: false; details: Array<{ path: string; message: string }> } {
  const details: Array<{ path: string; message: string }> = [];
  for (const key of ["page", "pageSize", "status", "q"] as const) {
    if (Array.isArray(query[key])) {
      details.push({ path: key, message: `${key} must not be repeated.` });
    }
  }
  return details.length > 0 ? { ok: false, details } : { ok: true };
}

export function createReviewsRouter() {
  const router = Router();

  router.get("/submissions", authenticate, requireRole(Role.MENTOR), async (req, res, next) => {
    try {
      const repeated = rejectRepeatedQuery(req.query as Record<string, unknown>);
      if (!repeated.ok) {
        sendError(res, 400, "VALIDATION_ERROR", "Check the query parameters.", {
          details: repeated.details,
        });
        return;
      }

      const parsed = queueQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Check the query parameters.", {
          details: validationDetails(parsed.error),
        });
        return;
      }

      const offset = (parsed.data.page - 1) * parsed.data.pageSize;
      if (!Number.isSafeInteger(offset) || offset < 0) {
        sendError(res, 400, "VALIDATION_ERROR", "Pagination offset is out of range.", {
          details: [{ path: "page", message: "Pagination offset is out of range." }],
        });
        return;
      }

      const result = await listReviewQueue(parsed.data);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/stats", authenticate, requireRole(Role.MENTOR), async (_req, res, next) => {
    try {
      const stats = await getReviewStats();
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ stats });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/submissions/:id/decision",
    authenticate,
    requireRole(Role.MENTOR),
    requireTrustedOrigin,
    async (req, res, next) => {
      try {
        const parsed = decisionBodySchema.safeParse(req.body);
        if (!parsed.success) {
          sendError(res, 400, "VALIDATION_ERROR", "Check the highlighted fields.", {
            details: validationDetails(parsed.error),
          });
          return;
        }

        const submissionId = req.params.id;
        if (!submissionId || Array.isArray(submissionId)) {
          sendError(res, 400, "VALIDATION_ERROR", "Submission id is required.");
          return;
        }

        const submission = await decideSubmission(submissionId, req.user!.id, parsed.data);
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({ submission });
      } catch (error) {
        if (error instanceof ReviewNotFoundError) {
          sendError(res, 404, "NOT_FOUND", error.message);
          return;
        }
        if (error instanceof ReviewConflictError) {
          sendError(res, 409, "ALREADY_REVIEWED", error.message);
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
