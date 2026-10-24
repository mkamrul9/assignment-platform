import { Router } from "express";

import { clearSessionCookie, setSessionCookie } from "../../lib/cookies.js";
import { sendError } from "../../lib/http.js";
import { validationDetails } from "../../lib/validation.js";
import { signSessionToken } from "../../lib/jwt.js";
import { authenticate } from "../../middleware/authenticate.js";
import { createLoginRateLimit, createSignupRateLimit } from "../../middleware/rate-limits.js";
import { requireTrustedOrigin } from "../../middleware/require-trusted-origin.js";
import {
  AuthConflictError,
  AuthCredentialsError,
  authenticateUser,
  signupStudent,
} from "./auth.service.js";
import { loginSchema, signupSchema } from "./auth.schemas.js";

export function createAuthRouter() {
  const authRouter = Router();
  const loginRateLimit = createLoginRateLimit();
  const signupRateLimit = createSignupRateLimit();

  authRouter.post("/signup", requireTrustedOrigin, signupRateLimit, async (req, res, next) => {
    try {
      const parsed = signupSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Check the highlighted fields.", {
          details: validationDetails(parsed.error),
        });
        return;
      }

      const user = await signupStudent(parsed.data);
      const token = await signSessionToken(user.id);
      setSessionCookie(res, token);

      res.status(201).json({ user });
    } catch (error) {
      if (error instanceof AuthConflictError) {
        sendError(res, 409, "EMAIL_IN_USE", error.message);
        return;
      }
      next(error);
    }
  });

  authRouter.post("/login", requireTrustedOrigin, loginRateLimit, async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        sendError(res, 400, "VALIDATION_ERROR", "Check the highlighted fields.", {
          details: validationDetails(parsed.error),
        });
        return;
      }

      const user = await authenticateUser(parsed.data);
      const token = await signSessionToken(user.id);
      setSessionCookie(res, token);

      res.status(200).json({ user });
    } catch (error) {
      if (error instanceof AuthCredentialsError) {
        sendError(res, 401, "INVALID_CREDENTIALS", error.message);
        return;
      }
      next(error);
    }
  });

  authRouter.get("/me", authenticate, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ user: req.user });
  });

  authRouter.post("/logout", requireTrustedOrigin, (_req, res) => {
    clearSessionCookie(res);
    res.status(204).send();
  });

  return authRouter;
}
