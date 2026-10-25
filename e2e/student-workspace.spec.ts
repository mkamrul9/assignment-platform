import { expect, test } from "@playwright/test";
import pg from "pg";

import { e2eState, login, logout, signupStudent, submitProject, uniqueEmail } from "./helpers";

async function seedOwnedProjects(input: {
  databaseUrl: string;
  ownerId: string;
  stamp: number;
  count: number;
}) {
  const client = new pg.Client({ connectionString: input.databaseUrl });
  await client.connect();
  try {
    for (let i = 0; i < input.count; i += 1) {
      const projectName =
        i % 2 === 0 ? `Orbit Alpha ${input.stamp}-${i}` : `Orbit Beta ${input.stamp}-${i}`;
      const repositoryUrl = `https://github.com/orbit-lab/workspace-${input.stamp}-${i}`;
      await client.query(
        `INSERT INTO submissions (
          id, owner_id, project_name, repository_url, canonical_repository_url,
          live_url, description, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $3, $4, $5, 'PENDING', NOW(), NOW()
        )`,
        [
          input.ownerId,
          projectName,
          repositoryUrl,
          `https://orbit-${input.stamp}-${i}.example.com`,
          "Synthetic student workspace project used to exercise search, filters, and pagination.",
        ],
      );
    }
  } finally {
    await client.end();
  }
}

test.describe.configure({ mode: "serial" });

test("student search, filters, pagination, details, and navigation", async ({ page }) => {
  const state = e2eState();
  const stamp = Date.now();
  const password = "student-pass-1";
  const email = uniqueEmail("student-workspace");

  await signupStudent(page, {
    name: "Workspace Student",
    email,
    password,
  });
  await expect(page.getByText(/have not submitted a project yet/i)).toBeVisible();

  const me = await page.request.get(`${state.baseURL}/api/auth/me`);
  expect(me.ok()).toBeTruthy();
  const meBody = (await me.json()) as { user: { id: string } };
  await seedOwnedProjects({
    databaseUrl: state.databaseUrl,
    ownerId: meBody.user.id,
    stamp,
    count: 12,
  });

  await page.goto("/student?status=ALL&page=1&pageSize=10");
  await expect(page.getByRole("heading", { name: /orbit/i }).first()).toBeVisible();
  await expect(page.getByText(/page 1 of/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^next$/i })).toBeEnabled();

  await page.getByRole("button", { name: /^next$/i }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/page 2 of/i)).toBeVisible();
  await page.getByRole("button", { name: /^previous$/i }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.getByText(/page 1 of/i)).toBeVisible();

  await page.getByLabel(/search projects/i).fill(`Orbit Alpha ${stamp}-0`);
  await expect(page).toHaveURL(/q=/, { timeout: 5000 });
  await expect(
    page.getByRole("heading", { name: new RegExp(`^Orbit Alpha ${stamp}-0$`, "i") }),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    page.getByRole("heading", { name: new RegExp(`^Orbit Beta ${stamp}-1$`, "i") }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: /clear/i }).click();
  await page.getByRole("button", { name: /^pending/i }).click();
  await expect(page).toHaveURL(/status=PENDING/);
  await expect(page).toHaveURL(/page=1/);

  await page.getByLabel(/page size/i).selectOption("20");
  await expect(page).toHaveURL(/pageSize=20/);
  await expect(page).toHaveURL(/page=1/);

  const firstHeading = page.getByRole("heading", { name: /orbit/i }).first();
  const projectName = (await firstHeading.innerText()).trim();
  await page
    .getByRole("link", { name: /view details/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/student\/projects\//);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await expect(page.getByText(/synthetic student workspace project/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^timeline$/i })).toBeVisible();
  await expect(page.getByText(/no review decision yet/i)).toBeVisible();

  const detailUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/student/);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/student\/projects\//);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  await page.getByRole("link", { name: /back to projects/i }).click();
  await expect(page).toHaveURL(/\/student/);

  await page.goto(detailUrl);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/student?status=ALL&pageSize=10");
  await expect(page.getByLabel(/search projects/i)).toBeVisible();
  await page.getByRole("button", { name: /^approved/i }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/status=APPROVED/);

  await logout(page);
  await page.goto(detailUrl);
  await expect(page).toHaveURL(/\/login/);
  await login(page, { email, password }, /\/student\/projects\//);
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible();
});

test("student workspace failure retry", async ({ page }) => {
  const stamp = Date.now();
  const email = uniqueEmail("student-retry");
  await signupStudent(page, {
    name: "Retry Student",
    email,
    password: "student-pass-1",
  });

  await submitProject(page, {
    projectName: `Retry Project ${stamp}`,
    repositoryUrl: `https://github.com/retry-lab/project-${stamp}`,
    liveUrl: `https://retry-${stamp}.example.com`,
    description: "Retry coverage project for student workspace failure handling.",
  });
  await expect(page.getByRole("status")).toContainText(`Retry Project ${stamp}`);

  let mineCalls = 0;
  await page.route("**/api/submissions/mine**", async (route) => {
    mineCalls += 1;
    if (mineCalls === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Temporary failure." },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/student");
  await expect(page.getByText(/temporary failure|unable to load/i)).toBeVisible();
  await page.getByRole("button", { name: /try again/i }).click();
  await expect(page.getByRole("heading", { name: `Retry Project ${stamp}` })).toBeVisible();
  await page.unroute("**/api/submissions/mine**");
});
