import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").replace(
  /\/$/,
  "",
);

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

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetPath = path.map(encodeURIComponent).join("/");
  const target = `${API_INTERNAL_URL}/api/${targetPath}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const [name, value] of request.headers.entries()) {
    if (HOP_BY_HOP.has(name.toLowerCase())) {
      continue;
    }
    headers.set(name, value);
  }

  // Cookie-authenticated mutations require the browser Origin, not the private API origin.
  const browserOrigin = request.headers.get("origin") ?? request.nextUrl.origin;
  headers.set("origin", browserOrigin);
  headers.set("x-forwarded-host", request.headers.get("host") ?? request.nextUrl.host);
  headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  if (!headers.has("x-forwarded-for")) {
    headers.set("x-forwarded-for", "127.0.0.1");
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers();
  for (const [name, value] of upstream.headers.entries()) {
    if (name.toLowerCase() === "set-cookie") {
      continue;
    }
    if (HOP_BY_HOP.has(name.toLowerCase())) {
      continue;
    }
    responseHeaders.set(name, value);
  }

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  const setCookies =
    typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxyRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
