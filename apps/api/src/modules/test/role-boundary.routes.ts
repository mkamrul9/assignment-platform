import { Router } from "express";

import { Role } from "../../generated/prisma/client.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/require-role.js";
import { requireTrustedOrigin } from "../../middleware/require-trusted-origin.js";

/**
 * Mounted only when NODE_ENV=test so integration checks can exercise role
 * middleware without shipping demonstration endpoints in production.
 */
export const roleBoundaryRouter = Router();

roleBoundaryRouter.get("/student-area", authenticate, requireRole(Role.STUDENT), (req, res) => {
  res.json({ ok: true, role: req.user?.role });
});

roleBoundaryRouter.get("/mentor-area", authenticate, requireRole(Role.MENTOR), (req, res) => {
  res.json({ ok: true, role: req.user?.role });
});

roleBoundaryRouter.post("/cookie-mutation", requireTrustedOrigin, authenticate, (_req, res) => {
  res.status(204).send();
});
