import { Router } from "express";

import { DEMO_NOTICE, publicDemoAccounts } from "../../demo/accounts.js";
import { isDemoModeEnabled } from "../../demo/database-guard.js";

/**
 * Public metadata for the auth-screen demo panel.
 * Mounted only when DEMO_MODE is enabled; otherwise callers receive the global 404.
 */
export function createDemoRouter() {
  const router = Router();

  router.get("/accounts", (_req, res) => {
    if (!isDemoModeEnabled()) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found." } });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      notice: DEMO_NOTICE,
      accounts: publicDemoAccounts(),
    });
  });

  return router;
}
