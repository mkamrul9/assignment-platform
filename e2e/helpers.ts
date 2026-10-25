import { expect, type Browser, type Page } from "@playwright/test";

import { readState } from "./runtime";

export function e2eState() {
  return readState();
}

export async function signupStudent(
  page: Page,
  input: { name: string; email: string; password: string },
) {
  await page.goto("/signup");
  await page.getByLabel(/^name$/i).fill(input.name);
  await page.getByLabel(/^email$/i).fill(input.email);
  await page.getByLabel(/^password$/i).fill(input.password);
  await page.getByRole("button", { name: /create student account/i }).click();
  await expect(page).toHaveURL(/\/student/);
}

export async function login(
  page: Page,
  input: { email: string; password: string },
  expectedPath: RegExp,
) {
  if (!/\/login(?:\?|$)/.test(page.url())) {
    await page.goto("/login");
  }
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await page.getByLabel(/^email$/i).fill(input.email);
  await page.getByLabel(/^password$/i).fill(input.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(expectedPath);
}

export async function openAccountMenuIfNeeded(page: Page) {
  const logoutButton = page.getByRole("button", { name: /^log out$/i });
  if (await logoutButton.isVisible()) {
    return;
  }
  await page.getByRole("button", { name: /^menu$/i }).click();
  await expect(logoutButton).toBeVisible();
}

export async function logout(page: Page) {
  await openAccountMenuIfNeeded(page);
  const logoutButton = page.getByRole("button", { name: /^log out$/i });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
}

export async function submitProject(
  page: Page,
  input: {
    projectName: string;
    repositoryUrl: string;
    liveUrl: string;
    description: string;
  },
) {
  await page.goto("/student/submit");
  await page.getByLabel(/project name/i).fill(input.projectName);
  await page.getByLabel(/repository url/i).fill(input.repositoryUrl);
  await page.getByLabel(/live demo url/i).fill(input.liveUrl);
  await page.getByLabel(/^description$/i).fill(input.description);
  await page.getByRole("button", { name: /submit project/i }).click();
}

export async function mentorLogin(browser: Browser) {
  const state = e2eState();
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { email: state.mentorEmail, password: state.mentorPassword }, /\/mentor/);
  return { context, page };
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
}
