import { jsonResponse } from '@/lib/http';

/** Rejects state-changing browser requests that did not originate from this application. */
export function verifySameOrigin(request: Request): Response | undefined {
  const origin = request.headers.get('origin');
  const requestOrigin = new URL(request.url).origin;
  const expectedOrigin = process.env.APP_ORIGIN ?? requestOrigin;

  if (origin === expectedOrigin) {
    return undefined;
  }

  return jsonResponse({ error: 'Cross-origin request rejected.' }, { status: 403 });
}
