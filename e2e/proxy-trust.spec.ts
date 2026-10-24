import { expect, test } from "@playwright/test";

import { e2eState } from "./helpers";

/**
 * Regression coverage through the real Next.js → Express path:
 * Origin must not be manufactured; caller X-Forwarded-For must not choose rate-limit buckets.
 *
 * Uses login (not signup) for the spoofing check so other e2e suites keep their signup budget.
 */
test.describe("API proxy trust boundary", () => {
  test("missing Origin is rejected through Next.js (not manufactured)", async ({ request }) => {
    const state = e2eState();
    const response = await request.post(`${state.baseURL}/api/auth/logout`, {
      headers: {
        "Content-Type": "application/json",
      },
      data: {},
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error?.code).toBe("FORBIDDEN_ORIGIN");
  });

  test("null Origin is rejected through Next.js", async ({ request }) => {
    const state = e2eState();
    const response = await request.post(`${state.baseURL}/api/auth/logout`, {
      headers: {
        Origin: "null",
        "Content-Type": "application/json",
      },
      data: {},
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error?.code).toBe("FORBIDDEN_ORIGIN");
  });

  test("untrusted Origin is rejected through Next.js", async ({ request }) => {
    const state = e2eState();
    const response = await request.post(`${state.baseURL}/api/auth/logout`, {
      headers: {
        Origin: "http://evil.example",
        "Content-Type": "application/json",
      },
      data: {},
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error?.code).toBe("FORBIDDEN_ORIGIN");
  });

  test("safe GET remains usable without Origin", async ({ request }) => {
    const state = e2eState();
    const response = await request.get(`${state.baseURL}/api/health`);
    expect(response.ok()).toBeTruthy();
  });

  test("forged X-Forwarded-For cannot choose login rate-limit buckets", async ({ request }) => {
    const state = e2eState();
    const trustedOrigin = state.baseURL;

    async function attempt(xff: string) {
      return request.post(`${state.baseURL}/api/auth/login`, {
        headers: {
          Origin: trustedOrigin,
          "Content-Type": "application/json",
          "X-Forwarded-For": xff,
        },
        data: {
          email: "nobody@example.com",
          password: "wrong-password",
        },
      });
    }

    const first = await attempt("203.0.113.10");
    expect([401, 429]).toContain(first.status());
    if (first.status() === 429) {
      // Prior specs already exhausted the shared bucket — spoofed XFF did not open a new one.
      const body = await first.json();
      expect(body.error?.code).toBe("LOGIN_RATE_LIMITED");
      return;
    }

    const remainingAfterFirst = Number(first.headers()["ratelimit-remaining"]);
    expect(Number.isFinite(remainingAfterFirst)).toBeTruthy();

    const second = await attempt("198.51.100.20");
    expect([401, 429]).toContain(second.status());
    if (second.status() === 429) {
      const body = await second.json();
      expect(body.error?.code).toBe("LOGIN_RATE_LIMITED");
      return;
    }

    const remainingAfterSecond = Number(second.headers()["ratelimit-remaining"]);
    // Distinct forged client IPs must share one bucket at the Next→Express boundary.
    expect(remainingAfterSecond).toBe(remainingAfterFirst - 1);
  });
});
