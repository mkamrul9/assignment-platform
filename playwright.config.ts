import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { E2E_WEB_PORT, STATE_PATH } from "./e2e/runtime";

function resolveBaseURL() {
  if (fs.existsSync(STATE_PATH)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as { baseURL?: string };
      if (state.baseURL) {
        return state.baseURL;
      }
    } catch {
      // Fall through to default.
    }
  }
  return `http://127.0.0.1:${E2E_WEB_PORT}`;
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  globalTimeout: 60 * 60 * 1000,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  outputDir: "test-results",
  use: {
    baseURL: resolveBaseURL(),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
