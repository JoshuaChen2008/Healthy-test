import { NextResponse } from 'next/server';

interface JsonResponseOptions {
  readonly status?: number;
  readonly noStore?: boolean;
}

/** Parses an optional JSON body, treating an empty body as an empty object. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();

  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

/** Creates a JSON response with private caching disabled by default. */
export function jsonResponse(
  body: unknown,
  options: JsonResponseOptions = {},
): NextResponse {
  const response = NextResponse.json(body, { status: options.status ?? 200 });

  if (options.noStore !== false) {
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}

/** Converts a malformed JSON body into the common API response. */
export function invalidJsonResponse(): NextResponse {
  return jsonResponse(
    { error: 'Request body must be valid JSON.' },
    { status: 400 },
  );
}
