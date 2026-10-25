import { expect, test } from "@playwright/test";

import { DEMO_ACCOUNTS } from "./demo-accounts";
import { logout, signupStudent, uniqueEmail } from "./helpers";

test.describe("demo auth panel", () => {
  test("login panel prefills and opens the correct workspace", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /try a shared demo account/i })).toBeVisible();
    await expect(page.getByText(DEMO_ACCOUNTS.studentA.email)).toBeVisible();
    await expect(page.getByText(DEMO_ACCOUNTS.mentor.email)).toBeVisible();

    await page.getByRole("button", { name: /use student a/i }).click();
    await expect(page.getByLabel(/^email$/i)).toHaveValue(DEMO_ACCOUNTS.studentA.email);
    await expect(page.getByLabel(/^password$/i)).toHaveValue(DEMO_ACCOUNTS.studentA.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByRole("heading", { name: /hello, demo student a/i })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/student/);
    await logout(page);
  });

  test("mentor demo account opens the mentor workspace", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /use mentor/i }).click();
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/mentor/);
    await expect(page.getByRole("heading", { name: /hello, demo mentor/i })).toBeVisible();
    await logout(page);
  });

  test("signup demo selection routes to login without registering", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /try a shared demo account/i })).toBeVisible();
    await page
      .getByRole("button", { name: /use on sign-in/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/^email$/i)).toHaveValue(DEMO_ACCOUNTS.studentA.email);
    await expect(page.getByLabel(/^password$/i)).toHaveValue(DEMO_ACCOUNTS.studentA.password);
  });

  test("normal student signup still works alongside demo accounts", async ({ page }) => {
    const email = uniqueEmail("demo-adjacent-student");
    await signupStudent(page, {
      name: "Demo Adjacent Student",
      email,
      password: "student-pass-1",
    });
    await expect(page.getByText(/have not submitted a project yet/i)).toBeVisible();
  });
});
