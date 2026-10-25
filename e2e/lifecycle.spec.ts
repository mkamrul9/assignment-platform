import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

import {
  e2eState,
  login,
  logout,
  mentorLogin,
  signupStudent,
  submitProject,
  uniqueEmail,
} from "./helpers";
import { SCREENSHOT_DIR } from "./runtime";
import path from "node:path";

test.describe.configure({ mode: "serial" });

test("student and mentor review lifecycle through the proxied UI", async ({ browser, page }) => {
  const state = e2eState();
  const stamp = Date.now();
  const studentEmail = uniqueEmail("lifecycle-student");
  const password = "student-pass-1";
  const projectName = `Lifecycle Project ${stamp}`;
  const repositoryUrl = `https://github.com/e2e-lifecycle/project-${stamp}`;
  const liveUrl = `https://lifecycle-${stamp}.example.com`;
  const description = "A complete lifecycle description for browser verification coverage.";

  // Empty list after signup
  await signupStudent(page, {
    name: "Lifecycle Student",
    email: studentEmail,
    password,
  });
  await expect(page.getByText(/have not submitted a project yet/i)).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "student-empty.png"),
    fullPage: true,
  });

  // Validation failure
  await page.goto("/student/submit");
  await page.getByLabel(/project name/i).fill("ab");
  await page.getByLabel(/repository url/i).fill("http://insecure.example/repo");
  await page.getByLabel(/live demo url/i).fill("not-a-url");
  await page.getByLabel(/^description$/i).fill("too short");
  await page.getByRole("button", { name: /submit project/i }).click();
  await expect(page.getByText(/3–100 characters/i).first()).toBeVisible();
  await expect(page.getByText(/must use https/i).first()).toBeVisible();

  // Successful submission
  await submitProject(page, { projectName, repositoryUrl, liveUrl, description });
  await expect(page.getByRole("status")).toContainText(projectName);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "student-submit-success.png"),
    fullPage: true,
  });

  // Duplicate feedback
  await submitProject(page, {
    projectName: `${projectName} copy`,
    repositoryUrl: `${repositoryUrl}.git`,
    liveUrl: `https://lifecycle-dup-${stamp}.example.com`,
    description: "Attempting a duplicate repository submission through the UI.",
  });
  await expect(page.getByRole("alert")).toBeVisible();

  // Persisted list + details after navigation/reload
  await page.goto("/student");
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText(/pending review/i)).toBeVisible();
  await page.getByRole("link", { name: /view details/i }).click();
  await expect(page).toHaveURL(/\/student\/projects\//);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await page.getByRole("link", { name: /back to projects/i }).click();
  await expect(page).toHaveURL(/\/student/);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "student-projects.png"),
    fullPage: true,
  });

  // Logout / login persistence
  await logout(page);
  await login(page, { email: studentEmail, password }, /\/student/);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  // Mentor workspace: counts, filters, pagination
  const mentor = await mentorLogin(browser);
  await expect(mentor.page.getByRole("heading", { name: /workspace totals/i })).toBeVisible();
  await expect(mentor.page.getByRole("group", { name: /status filter/i })).toBeVisible();

  const pendingCard = mentor.page
    .locator("section[aria-label='Review statistics']")
    .getByText(/^Pending$/i);
  await expect(pendingCard).toBeVisible();
  await mentor.page.screenshot({
    path: path.join(SCREENSHOT_DIR, "mentor-queue.png"),
    fullPage: true,
  });

  await mentor.page.getByRole("button", { name: /^all$/i }).click();
  await expect(mentor.page.getByText(/page 1 of/i)).toBeVisible();
  await mentor.page.getByRole("button", { name: /^next$/i }).click();
  await expect(mentor.page.getByText(/page 2 of/i)).toBeVisible();
  await mentor.page.getByRole("button", { name: /^previous$/i }).click();
  await expect(mentor.page.getByText(/page 1 of/i)).toBeVisible();

  await mentor.page.getByRole("button", { name: /^pending$/i }).click();
  await expect(mentor.page.getByRole("button", { name: /^review$/i }).first()).toBeVisible();

  // Approve the lifecycle project
  await mentor.page.getByRole("button", { name: /^pending$/i }).click();
  const reviewButton = mentor.page
    .getByRole("row", { name: new RegExp(projectName, "i") })
    .getByRole("button", { name: /^review$/i });
  await reviewButton.click();
  const dialog = mentor.page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(description)).toBeVisible();
  await dialog.getByLabel(/review note/i).fill("Approved after browser lifecycle review.");
  await dialog.getByRole("button", { name: /^approve$/i }).click();
  await expect(dialog.getByRole("status")).toContainText(/approved/i);
  await mentor.page.screenshot({
    path: path.join(SCREENSHOT_DIR, "mentor-review-dialog.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: /^close$/i }).click();

  // Reject another fixture row with required feedback
  await mentor.page.getByRole("button", { name: /^pending$/i }).click();
  await mentor.page
    .getByRole("button", { name: /^review$/i })
    .first()
    .click();
  const rejectDialog = mentor.page.getByRole("dialog");
  await rejectDialog.getByRole("button", { name: /^reject$/i }).click();
  await expect(
    rejectDialog.getByText(/rejection requires a note of 10–1,000 characters/i),
  ).toBeVisible();
  await rejectDialog
    .getByLabel(/review note/i)
    .fill("Please expand the README with setup and deployment notes.");
  await rejectDialog.getByRole("button", { name: /^reject$/i }).click();
  await expect(rejectDialog.getByRole("status")).toContainText(/rejected/i);
  await rejectDialog.getByRole("button", { name: /^close$/i }).click();

  // Stats remain visible after decisions
  await expect(mentor.page.locator("section[aria-label='Review statistics']")).toContainText(
    /Approved/i,
  );

  await mentor.context.close();

  // Student sees resulting status/feedback on the details page after reload
  await page.goto("/student");
  await page.reload();
  await expect(page.getByText(/^approved$/i).first()).toBeVisible();
  await page.getByRole("link", { name: projectName }).click();
  await expect(page).toHaveURL(/\/student\/projects\//);
  await expect(page.getByText(/^approved$/i).first()).toBeVisible();
  await expect(page.getByText(/browser lifecycle review/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^timeline$/i })).toBeVisible();
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "student-project-detail.png"),
    fullPage: true,
  });

  // Session expiry → login navigation
  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("expired-user")
    .setIssuer("reviewdock")
    .setAudience("reviewdock-web")
    .setExpirationTime("0s")
    .sign(new TextEncoder().encode("e2e-reviewdock-jwt-secret-32chars-min!!"));

  await page.context().addCookies([
    {
      name: "reviewdock_session",
      value: expired,
      url: state.baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/student");
  await expect(page).toHaveURL(/\/login/);
});
