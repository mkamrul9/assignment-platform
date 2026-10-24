import { expect, test } from "@playwright/test";

import { dropDatabase, resetDatabase } from "./db";

test("database helpers refuse development and unrelated databases before connecting", async () => {
  const devUrl = "postgresql://test:test@127.0.0.1:1/reviewdock_e2e";
  for (const operation of [resetDatabase, dropDatabase]) {
    await expect(operation(devUrl, "reviewdock_e2e")).rejects.toThrow(
      "Refusing to reset or drop the configured development database",
    );
    await expect(operation(devUrl, "reviewdock")).rejects.toThrow(
      "E2E database names must start with reviewdock_e2e",
    );
  }
});
