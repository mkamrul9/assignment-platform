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
  listMySubmissions,
  SubmissionConflictError,
} from "./submissions.service.js";
import { createSubmissionSchema } from "./submissions.schemas.js";

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

  router.get("/mine", authenticate, requireRole(Role.STUDENT), async (req, res, next) => {
    try {
      const submissions = await listMySubmissions(req.user!.id);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ submissions });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
