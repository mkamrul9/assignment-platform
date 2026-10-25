import { Router } from "express";

import { Role } from "../../generated/prisma/client.js";
import { sendError } from "../../lib/http.js";
import { validationDetails } from "../../lib/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { createSubmissionRateLimit } from "../../middleware/rate-limits.js";
import { requireRole } from "../../middleware/require-role.js";
import { requireTrustedOrigin } from "../../middleware/require-trusted-origin.js";
import {
  createSubmission,
  getMySubmissionStats,
  getSubmissionForViewer,
  listMySubmissions,
  SubmissionConflictError,
  SubmissionNotFoundError,
} from "./submissions.service.js";
import { createSubmissionSchema, mineQuerySchema } from "./submissions.schemas.js";

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

export function createSubmissionsRouter() {
  const router = Router();
  const submissionRateLimit = createSubmissionRateLimit();

  router.post(
    "/",
    authenticate,
    requireRole(Role.STUDENT),
    requireTrustedOrigin,
    submissionRateLimit,
    async (req, res, next) => {
      try {
        const parsed = createSubmissionSchema.safeParse(req.body);
        if (!parsed.success) {
          sendError(res, 400, "VALIDATION_ERROR", "Check the highlighted fields.", {
            details: validationDetails(parsed.error),
          });
          return;
        }

        const submission = await createSubmission(req.user!.id, parsed.data);
        res.status(201).json({ submission });
      } catch (error) {
        if (error instanceof SubmissionConflictError) {
          sendError(res, 409, "REPOSITORY_IN_USE", error.message);
          return;
        }
        next(error);
      }
    },
  );

  // Static `/mine` must be registered before `/:id` so "mine" is never treated as an id.
  router.get("/mine", authenticate, requireRole(Role.STUDENT), async (req, res, next) => {
    try {
      const repeated = rejectRepeatedQuery(req.query as Record<string, unknown>);
      if (!repeated.ok) {
        sendError(res, 400, "VALIDATION_ERROR", "Check the query parameters.", {
          details: repeated.details,
        });
        return;
      }

      const parsed = mineQuerySchema.safeParse(req.query);
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

      const [result, stats] = await Promise.all([
        listMySubmissions(req.user!.id, parsed.data),
        getMySubmissionStats(req.user!.id),
      ]);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ ...result, stats });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:id",
    authenticate,
    requireRole(Role.STUDENT, Role.MENTOR),
    async (req, res, next) => {
      try {
        const submissionId = req.params.id;
        if (!submissionId || Array.isArray(submissionId)) {
          sendError(res, 400, "VALIDATION_ERROR", "Submission id is required.");
          return;
        }

        const submission = await getSubmissionForViewer(req.user!, submissionId);
        res.setHeader("Cache-Control", "no-store");
        res.status(200).json({ submission });
      } catch (error) {
        if (error instanceof SubmissionNotFoundError) {
          sendError(res, 404, "NOT_FOUND", error.message);
          return;
        }
        next(error);
      }
    },
  );

  return router;
}
