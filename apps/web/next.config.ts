import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  // Browser /api traffic is proxied by apps/web/src/app/api/[...path]/route.ts so Origin,
  // Cookie, and Set-Cookie headers stay aligned with Express trusted-origin checks.
};

export default nextConfig;
