import { expect, test } from "@playwright/test";

import { login, logout, mentorLogin, signupStudent, uniqueEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

test("drafts, search URL state, checkpoints, and stats stability", async ({ browser, page }) => {
  const stamp = Date.now();
  const password = "student-pass-1";
  const studentAEmail = uniqueEmail("draft-a");
  const studentBEmail = uniqueEmail("draft-b");
  const projectName = `Aurora Feedback ${stamp}`;
  const repositoryUrl = `https://github.com/aurora-lab/feedback-${stamp}`;
  const liveUrl = `https://aurora-${stamp}.example.com`;
  const description =
    "Aurora feedback project description used to verify drafts, search, and checkpoints.";

  await signupStudent(page, {
    name: "Aurora Student",
    email: studentAEmail,
    password,
  });

  await page.goto("/student/submit");
  await page.getByLabel(/project name/i).fill(projectName);
  await page.getByLabel(/repository url/i).fill(repositoryUrl);
  await page.getByLabel(/live demo url/i).fill(liveUrl);
  await page.getByLabel(/^description$/i).fill(description);
  await expect(page.getByText(/^Draft saved on this device/i)).toBeVisible({ timeout: 5000 });

  await page.goto("/student");
  await page.goto("/student/submit");
  await expect(page.getByLabel(/project name/i)).toHaveValue(projectName);
  await expect(page.getByText(/^Restored a draft saved on this device/i)).toBeVisible();

  // Failed validation must keep the draft
  await page.getByLabel(/project name/i).fill("ab");
  await expect(page.getByText(/^Draft saved on this device/i)).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: /submit project/i }).click();
  await expect(page.getByText(/3–100 characters/i).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/project name/i)).toHaveValue("ab");

  await page.getByLabel(/project name/i).fill(projectName);
  await page.getByLabel(/repository url/i).fill(repositoryUrl);
  await page.getByLabel(/live demo url/i).fill(liveUrl);
  await page.getByLabel(/^description$/i).fill(description);
  await page.getByRole("button", { name: /submit project/i }).click();
  await expect(page.getByRole("status")).toContainText(projectName);
  await page.reload();
  await expect(page.getByLabel(/project name/i)).toHaveValue("");
  await expect(page.getByText(/drafts stay on this device/i)).toBeVisible();

  // Account isolation: student B must not see student A's leftover (cleared) draft
  await logout(page);
  await signupStudent(page, {
    name: "Blake Student",
    email: studentBEmail,
    password,
  });
  await page.goto("/student/submit");
  await expect(page.getByLabel(/project name/i)).toHaveValue("");

  // Mentor queue: URL-backed search + checkpoints + global stats
  const mentor = await mentorLogin(browser);
  const statsSection = mentor.page.locator("section[aria-label='Review statistics']");
  await expect(statsSection.getByText(/^Pending$/i)).toBeVisible();
  const pendingBefore = await statsSection.locator("[data-stat-value='pending']").innerText();

  await mentor.page.getByLabel(/search projects/i).fill(projectName);
  await expect(mentor.page).toHaveURL(/q=/i, { timeout: 5000 });
  await expect(mentor.page.getByRole("row", { name: new RegExp(projectName, "i") })).toBeVisible({
    timeout: 5000,
  });

  const pendingAfterSearch = await statsSection.locator("[data-stat-value='pending']").innerText();
  expect(pendingAfterSearch).toBe(pendingBefore);

  const searchUrl = mentor.page.url();
  await mentor.page.reload();
  await expect(mentor.page).toHaveURL(searchUrl);
  await expect(mentor.page.getByLabel(/search projects/i)).toHaveValue(projectName);
  await expect(mentor.page.getByRole("row", { name: new RegExp(projectName, "i") })).toBeVisible();

  await mentor.page.goBack();
  await mentor.page.goForward();
  await expect(mentor.page.getByLabel(/search projects/i)).toHaveValue(projectName);

  await mentor.page
    .getByRole("row", { name: new RegExp(projectName, "i") })
    .getByRole("button", { name: /^review$/i })
    .click();
  const dialog = mentor.page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/optional checkpoints give students more specific feedback/i),
  ).toBeVisible();
  await dialog.getByLabel(/^functionality$/i).selectOption("MEETS_EXPECTATIONS");
  await dialog.getByLabel(/^usability$/i).selectOption("NEEDS_IMPROVEMENT");
  await dialog.getByLabel(/^documentation$/i).selectOption("NOT_ASSESSED");
  await dialog.getByLabel(/review note/i).fill("Improve the first-run experience for new users.");
  await dialog.getByRole("button", { name: /^approve$/i }).click();
  await expect(dialog.getByRole("status")).toContainText(/approved/i);
  await expect(dialog.getByText(/meets expectations/i).first()).toBeVisible();
  await expect(dialog.getByText(/needs improvement/i).first()).toBeVisible();
  await expect(dialog.getByText(/not assessed/i).first()).toBeVisible();

  // Keyboard: clear search remains reachable
  await dialog.getByRole("button", { name: /close/i }).click();
  await mentor.page.getByRole("button", { name: /clear search/i }).focus();
  await expect(mentor.page.getByRole("button", { name: /clear search/i })).toBeFocused();
  await mentor.page.keyboard.press("Enter");
  await expect(mentor.page.getByLabel(/search projects/i)).toHaveValue("");

  // Student sees checkpoints
  await mentor.context.close();
  await login(page, { email: studentAEmail, password }, /\/student/);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText(/meets expectations/i).first()).toBeVisible();
  await expect(page.getByText(/needs improvement/i).first()).toBeVisible();
  await expect(page.getByText(/improve the first-run experience/i)).toBeVisible();

  // Mobile layout smoke for queue controls
  const mobileMentor = await mentorLogin(browser);
  await mobileMentor.page.setViewportSize({ width: 390, height: 844 });
  await mobileMentor.page.goto("/mentor");
  await expect(mobileMentor.page.getByLabel(/search projects/i)).toBeVisible();
  await expect(mobileMentor.page.getByRole("group", { name: /status filter/i })).toBeVisible();
  await mobileMentor.context.close();
});
