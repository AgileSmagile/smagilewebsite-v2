/** Shared JSON response helpers for admin API routes. */

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

/** Return a successful JSON response (200 by default). */
export function jsonOk(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Return a JSON error response (400 by default). */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}
