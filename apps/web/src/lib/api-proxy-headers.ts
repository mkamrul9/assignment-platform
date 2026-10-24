/**
 * When "1", the deployment's trusted ingress has already replaced
 * X-Forwarded-For with a verified client address (strip-then-set, not append).
 * Next then forwards that single value to Express. Leave unset/0 when Next is
 * the public boundary without a verified client IP — Express rates by the
 * Next→Express peer address (conservative shared bucket).
 */
export function trustIngressClientIpEnabled(): boolean {
  return process.env.TRUST_INGRESS_CLIENT_IP === "1";
}

/**
 * Ingress that overwrites X-Forwarded-For with the peer address yields a single IP.
 * If a chain is present, use the rightmost entry (nearest to this process) only when
 * TRUST_INGRESS_CLIENT_IP is enabled and the outer hop already sanitized the header.
 */
export function clientIpFromTrustedIngress(xff: string | null): string | null {
  if (!xff) {
    return null;
  }
  const parts = xff
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts[parts.length - 1] ?? null;
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

/** Caller-controlled forwarding headers must never choose Express rate-limit identity. */
const STRIP_FORWARDING = new Set([
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",
  "forwarded",
  "cf-connecting-ip",
  "true-client-ip",
]);

export function buildUpstreamHeaders(request: {
  headers: Headers;
  nextUrl: { host: string; protocol: string };
}): Headers {
  const headers = new Headers();
  for (const [name, value] of request.headers.entries()) {
    const lower = name.toLowerCase();
    if (HOP_BY_HOP.has(lower) || STRIP_FORWARDING.has(lower)) {
      continue;
    }
    headers.set(name, value);
  }

  // Preserve Origin exactly when the browser sent it. Never invent one —
  // missing/null/malformed Origin must reach Express for rejection on mutations.
  const origin = request.headers.get("origin");
  if (origin === null) {
    headers.delete("origin");
  } else {
    headers.set("origin", origin);
  }

  headers.set("x-forwarded-host", request.headers.get("host") ?? request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  if (trustIngressClientIpEnabled()) {
    const verified = clientIpFromTrustedIngress(request.headers.get("x-forwarded-for"));
    if (verified) {
      headers.set("x-forwarded-for", verified);
    }
  }

  return headers;
}
