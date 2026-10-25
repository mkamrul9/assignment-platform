import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createDemoRouter } from "./modules/demo/demo.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { createReviewsRouter } from "./modules/reviews/reviews.routes.js";
import { createSubmissionsRouter } from "./modules/submissions/submissions.routes.js";
import { roleBoundaryRouter } from "./modules/test/role-boundary.routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  if (env.TRUST_PROXY) {
    // Trust a single reverse-proxy hop (Next.js /api proxy). The public Next route
    // strips caller X-Forwarded-For unless TRUST_INGRESS_CLIENT_IP=1 on the web app
    // and a trusted ingress has already replaced XFF with the verified peer IP.
    // See Express "behind proxies" guidance: hop count must match topology.
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  // Large enough for max-length Unicode submission bodies (name + URLs + description).
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", createAuthRouter());
  app.use("/api/submissions", createSubmissionsRouter());
  app.use("/api/reviews", createReviewsRouter());

  // Only mount demo metadata when explicitly enabled so disabled mode yields a real 404.
  if (env.DEMO_MODE) {
    app.use("/api/demo", createDemoRouter());
  }

  if (env.NODE_ENV === "test") {
    app.use("/api/test", roleBoundaryRouter);
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.use(errorHandler);

  return app;
}

export const app = createApp();
