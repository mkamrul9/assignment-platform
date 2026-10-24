/** Keep private upstream failures inside the API's public JSON error contract. */
export async function fetchApiUpstream(target: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(target, {
      ...init,
      signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(15_000)]),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        error: {
          code: timedOut ? "API_TIMEOUT" : "API_UNAVAILABLE",
          message: timedOut
            ? "The service took too long to respond. Please try again."
            : "The service is temporarily unavailable. Please try again.",
        },
      },
      { status: timedOut ? 504 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
