import { getSessionPrincipal } from '@/lib/auth';
import { jsonResponse } from '@/lib/http';

export async function GET(request: Request): Promise<Response> {
  const principal = await getSessionPrincipal(request);

  if (principal === null || principal.email === null) {
    return jsonResponse({ error: 'Authentication required.' }, { status: 401 });
  }

  return jsonResponse({ email: principal.email });
}
