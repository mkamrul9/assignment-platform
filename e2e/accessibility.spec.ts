import { expect, test } from "@playwright/test";

import { e2eState, login, logout, mentorLogin, uniqueEmail, signupStudent } from "./helpers";

test("keyboard, dialog focus, mobile layout, and failure recovery", async ({ browser, page }) => {
  const state = e2eState();
  const email = uniqueEmail("a11y-student");
  const password = "student-pass-1";

  await page.setViewportSize({ width: 390, height: 844 });
  await signupStudent(page, { name: "A11y Student", email, password });
  await expect(page.getByText(/have not submitted a project yet/i)).toBeVisible();

  // Mobile shell keeps workspace return visible; account actions live under Menu.
  await logout(page);
  await page.getByLabel(/^email$/i).focus();
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await page.keyboard.type(password);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/student/);

  // Visible focus indicator on a primary control
  const submitLink = page.getByRole("link", { name: /submit a project/i }).first();
  await submitLink.focus();
  await expect(submitLink).toBeFocused();

  // Desktop mentor queue interactions
  await page.setViewportSize({ width: 1280, height: 800 });
  const mentor = await mentorLogin(browser);
  await mentor.page.setViewportSize({ width: 390, height: 844 });
  await expect(mentor.page.getByRole("heading", { name: /review queue/i })).toBeVisible();
  // Critical controls remain reachable; wide tables scroll inside their container.
  await expect(mentor.page.getByRole("group", { name: /status filter/i })).toBeVisible();
  const tableScroller = mentor.page.locator("section[aria-label='Review queue'] .overflow-x-auto");
  await expect(tableScroller.first()).toBeVisible();
  await expect(mentor.page.getByRole("button", { name: /^review$/i }).first()).toBeVisible();

  await mentor.page.setViewportSize({ width: 1280, height: 800 });
  await mentor.page.getByRole("button", { name: /^pending$/i }).click();
  const reviewButton = mentor.page.getByRole("button", { name: /^review$/i }).first();
  await reviewButton.focus();
  await expect(reviewButton).toBeFocused();
  await mentor.page.keyboard.press("Enter");

  const dialog = mentor.page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /^close$/i })).toBeFocused();

  // Tab cycles inside the dialog (native modal dialog focus containment).
  await mentor.page.keyboard.press("Tab");
  const activeInside = await mentor.page.evaluate(() => {
    const active = document.activeElement;
    const dialogEl = document.querySelector("dialog[open]");
    return Boolean(dialogEl && active && dialogEl.contains(active));
  });
  expect(activeInside).toBe(true);

  await mentor.page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: /^close$/i })).toBeFocused();

  // Escape closes and restores focus to the trigger.
  await mentor.page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(reviewButton).toBeFocused();

  // Loading / empty / error / retry for stats and queue
  await mentor.page.route("**/api/reviews/stats", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "SERVER_ERROR", message: "Stats unavailable." } }),
    });
  });
  await mentor.page.reload();
  await expect(mentor.page.getByRole("button", { name: /^retry stats$/i })).toBeVisible();
  await expect(mentor.page.getByText(/stats unavailable|unable to load/i).first()).toBeVisible();
  await mentor.page.unroute("**/api/reviews/stats");
  await mentor.page.getByRole("button", { name: /^retry stats$/i }).click();
  await expect(mentor.page.getByText(/^pending$/i).first()).toBeVisible();

  await mentor.page.route("**/api/reviews/submissions?**", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "SERVER_ERROR", message: "Queue unavailable." } }),
    });
  });
  await mentor.page.getByRole("button", { name: /^approved$/i }).click();
  await expect(mentor.page.getByText(/queue unavailable|unable to load/i).first()).toBeVisible();
  await mentor.page.unroute("**/api/reviews/submissions?**");
  await mentor.page.getByRole("button", { name: /^try again$/i }).click();
  await expect(mentor.page.getByText(/no projects match this filter|page /i).first()).toBeVisible();

  // Conflicting review decision recovery
  await mentor.page.getByRole("button", { name: /^pending$/i }).click();
  const conflictReview = mentor.page.getByRole("button", { name: /^review$/i }).first();
  await conflictReview.click();
  const conflictDialog = mentor.page.getByRole("dialog");
  await expect(conflictDialog).toBeVisible();

  const projectHeading = await conflictDialog.locator("h3").innerText();
  const cookies = await mentor.context.cookies();
  const session = cookies.find((cookie) => cookie.name === "reviewdock_session");
  expect(session).toBeTruthy();

  // Find the submission id from the open queue API shape by approving via direct API first.
  const listResponse = await mentor.page.request.get(
    `${state.baseURL}/api/reviews/submissions?status=PENDING&page=1&pageSize=50`,
  );
  const listBody = (await listResponse.json()) as {
    submissions: Array<{ id: string; projectName: string }>;
  };
  const target = listBody.submissions.find((item) => item.projectName === projectHeading);
  expect(target).toBeTruthy();

  const race = await mentor.page.request.post(
    `${state.baseURL}/api/reviews/submissions/${target!.id}/decision`,
    {
      headers: { Origin: state.baseURL },
      data: { decision: "APPROVED", note: "Won the race from the API helper." },
    },
  );
  expect(race.ok()).toBeTruthy();

  await conflictDialog.getByLabel(/review note/i).fill("Stale dialog note that should remain.");
  await conflictDialog.getByRole("button", { name: /^approve$/i }).click();
  await expect(conflictDialog.getByRole("alert")).toContainText(/already been reviewed|already/i);
  await expect(conflictDialog.getByLabel(/review note/i)).toHaveValue(
    /Stale dialog note|Won the race/i,
  );

  await mentor.context.close();

  // Fixture student empty filter path already covered; ensure login still works on mobile width.
  await page.setViewportSize({ width: 390, height: 844 });
  await login(
    page,
    { email: state.fixtureStudentEmail, password: state.fixtureStudentPassword },
    /\/student/,
  );
  await expect(page.getByText(/fixture project/i).first()).toBeVisible();
});
