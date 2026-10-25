import { expect, test } from "@playwright/test";

import { signupStudent, uniqueEmail } from "./helpers";

test("failed logout keeps the session visible and allows an honest retry", async ({ page }) => {
  await signupStudent(page, {
    name: "Logout Retry Student",
    email: uniqueEmail("logout-retry"),
    password: "student-pass-1",
  });
  await expect(page.getByText(/have not submitted a project yet/i)).toBeVisible();
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "UNAVAILABLE", message: "Try again." } }),
    }),
  );
  await page.getByRole("button", { name: /^log out$/i }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to log out" })).toHaveText(
    "Unable to log out. Please try again.",
  );
  await expect(page).toHaveURL(/\/student/);
  await page.unroute("**/api/auth/logout");
  await page.getByRole("button", { name: /^log out$/i }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.reload();
  await page.goto("/student");
  await expect(page).toHaveURL(/\/login/);
});

test("a protected API 401 sends an open workspace back to login", async ({ page }) => {
  await signupStudent(page, {
    name: "Expired Session Student",
    email: uniqueEmail("session-expiry"),
    password: "student-pass-1",
  });
  await expect(page.getByText(/have not submitted a project yet/i)).toBeVisible();
  await page.route("**/api/submissions/mine**", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAUTHENTICATED", message: "Authentication required." },
      }),
    }),
  );
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});
