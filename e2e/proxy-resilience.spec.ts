import { expect, test } from "@playwright/test";

import { fetchApiUpstream } from "../apps/web/src/lib/api-upstream";

test("an unreachable API returns a safe, non-cacheable JSON gateway error", async () => {
  // Port 1 is blocked by fetch; no external service or database is contacted.
  const response = await fetchApiUpstream("http://127.0.0.1:1/api/health", { method: "GET" });
  expect(response.status).toBe(502);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    error: {
      code: "API_UNAVAILABLE",
      message: "The service is temporarily unavailable. Please try again.",
    },
  });
});

test("upstream timeouts keep the distinct retryable gateway status", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("Synthetic timeout", "TimeoutError"));
  const response = await fetchApiUpstream("http://127.0.0.1:4010/api/health", {
    signal: controller.signal,
  });
  expect(response.status).toBe(504);
  expect((await response.json()).error.code).toBe("API_TIMEOUT");
});
