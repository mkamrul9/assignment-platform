/**
 * Demo seed/reset may only target an explicitly allowlisted sandbox database
 * while DEMO_MODE is enabled. An allowlisted name alone is not enough to wipe
 * or overwrite unrelated accounts — seed logic only touches fixture identities.
 */

const DEMO_DB_PATTERN = /^reviewdock_demo(?:_[a-z0-9_]+)?$/i;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function databaseNameFromUrl(databaseUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(databaseUrl).pathname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  const name = pathname.replace(/^\//, "").split("/")[0] ?? "";
  if (!name) {
    throw new Error("DATABASE_URL must include a database name.");
  }
  return name;
}

export function isAllowlistedDemoDatabaseName(databaseName: string): boolean {
  return DEMO_DB_PATTERN.test(databaseName);
}

export function isLoopbackDatabaseHost(databaseUrl: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

/**
 * Local demo commands stay locked to reviewdock_demo*. Hosted Postgres names
 * are assigned by Render/Railway, so any non-loopback database is allowed.
 */
export function isAllowedDemoSeedDatabase(databaseUrl: string): boolean {
  return (
    isAllowlistedDemoDatabaseName(databaseNameFromUrl(databaseUrl)) ||
    !isLoopbackDatabaseHost(databaseUrl)
  );
}

export function isDemoModeEnabled(value: string | undefined = process.env.DEMO_MODE): boolean {
  return value === "1" || value === "true";
}

export function assertDemoModeEnabled(value?: string): void {
  if (!isDemoModeEnabled(value)) {
    throw new Error(
      "Demo seed/reset requires DEMO_MODE=1. Refusing to run against a non-demo configuration.",
    );
  }
}

export function assertAllowlistedDemoDatabase(databaseUrl: string): string {
  const databaseName = databaseNameFromUrl(databaseUrl);
  if (!isAllowedDemoSeedDatabase(databaseUrl)) {
    throw new Error(
      `Demo commands require a sandbox database named reviewdock_demo or reviewdock_demo_* (got "${databaseName}"). Hosted deploys may use the platform database.`,
    );
  }
  return databaseName;
}

/** Combined guard for destructive or fixture-seeding demo commands. */
export function assertDemoSeedTarget(
  databaseUrl: string,
  demoMode = process.env.DEMO_MODE,
): string {
  assertDemoModeEnabled(demoMode);
  return assertAllowlistedDemoDatabase(databaseUrl);
}
