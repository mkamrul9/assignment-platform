import { type NextRequest, NextResponse } from "next/server";

import { buildUpstreamHeaders } from "@/lib/api-proxy-headers";

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

  const headers = buildUpstreamHeaders(request);

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
