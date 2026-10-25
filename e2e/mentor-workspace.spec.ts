import { expect, test } from "@playwright/test";
import path from "node:path";

import { mentorLogin } from "./helpers";
import { SCREENSHOT_DIR } from "./runtime";

test.describe.configure({ mode: "serial" });

test("mentor on-demand details, refresh failure, and focus recovery", async ({ browser }) => {
  const mentor = await mentorLogin(browser);
  const page = mentor.page;

  await expect(page.getByRole("heading", { name: /workspace totals/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^refresh$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^clear filters$/i })).toBeVisible();

  // Prefer fixture rows so description copy is stable across the suite.
  await page.getByLabel(/search projects/i).fill("Fixture Project");
  await expect(page).toHaveURL(/q=/, { timeout: 5000 });
  await page.getByRole("button", { name: /^pending$/i }).click();
  const reviewButton = page.getByRole("button", { name: /^review$/i }).first();
  await expect(reviewButton).toBeVisible({ timeout: 5000 });

  await page.route("**/api/submissions/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  const projectName = (
    await reviewButton.locator("xpath=ancestor::tr").locator("td").first().innerText()
  )
    .split("\n")[0]!
    .trim();
  await reviewButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(dialog.getByText(/loading project details|fixture description/i)).toBeVisible();
  await expect(dialog.getByText(/fixture description/i)).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByRole("button", { name: /^approve$/i })).toBeVisible();
  await page.unroute("**/api/submissions/**");
  await dialog.getByRole("button", { name: /^close$/i }).click();

  // Successful save with refresh failure still reports the saved decision.
  await page
    .getByRole("button", { name: /^review$/i })
    .first()
    .click();
  const saveDialog = page.getByRole("dialog");
  await expect(saveDialog.getByText(/fixture description/i)).toBeVisible();
  await page.route("**/api/reviews/submissions?**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAVAILABLE", message: "Queue refresh unavailable." },
      }),
    });
  });
  await page.route("**/api/reviews/stats", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAVAILABLE", message: "Stats refresh unavailable." },
      }),
    });
  });
  await saveDialog.getByRole("button", { name: /^approve$/i }).click();
  await expect(saveDialog.getByRole("status")).toContainText(/approved/i);
  await expect(saveDialog.getByText(/could not be refreshed/i)).toBeVisible();
  await page.unroute("**/api/reviews/submissions?**");
  await page.unroute("**/api/reviews/stats");
  await saveDialog.getByRole("button", { name: /^close$/i }).click();

  await page.getByRole("button", { name: /^refresh$/i }).click();
  await expect(page.locator("[data-stat-value='pending']")).toBeVisible();

  // After a decision removes the trigger row, close restores a useful fallback.
  await page.getByRole("button", { name: /^pending$/i }).click();
  await page
    .getByRole("button", { name: /^review$/i })
    .first()
    .click();
  const focusDialog = page.getByRole("dialog");
  await expect(focusDialog.getByText(/fixture description/i)).toBeVisible();
  await focusDialog.getByRole("button", { name: /^approve$/i }).click();
  await expect(focusDialog.getByRole("status")).toContainText(/approved/i);
  await focusDialog.getByRole("button", { name: /^close$/i }).click();
  await expect(page.getByRole("button", { name: /^refresh$/i })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mentor?status=PENDING&page=1&pageSize=10");
  await expect(page.getByRole("button", { name: /^refresh$/i })).toBeVisible();
  await expect(page.getByRole("group", { name: /status filter/i })).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "mentor-queue.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: /^all$/i }).click();
  const viewButton = page.getByRole("button", { name: /^view$/i }).first();
  await expect(viewButton).toBeVisible();
  await viewButton.click();
  const viewDialog = page.getByRole("dialog");
  await expect(
    viewDialog
      .getByText(/reviewed by/i)
      .or(viewDialog.getByText(/fixture description/i))
      .first(),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "mentor-review-dialog.png"),
    fullPage: true,
  });
  await viewDialog.getByRole("button", { name: /^close$/i }).click();

  await mentor.context.close();
});
