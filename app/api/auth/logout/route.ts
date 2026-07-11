import { clearSessionCookie, getSessionPrincipal } from '@/lib/auth';
import { invalidJsonResponse, jsonResponse, readJsonBody } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { verifySameOrigin } from '@/lib/request-security';
import { emptyBodySchema, getValidationErrorMessage } from '@/lib/validation';

export async function POST(request: Request): Promise<Response> {
  const originError = verifySameOrigin(request);

  if (originError !== undefined) {
    return originError;
  }

  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = emptyBodySchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const principal = await getSessionPrincipal(request);

    if (principal !== null) {
      await prisma.session.deleteMany({ where: { id: principal.sessionId } });
    }

    return clearSessionCookie(jsonResponse({ ok: true }));
  } catch (error: unknown) {
    console.error('Failed to sign out.', error);
    return jsonResponse({ error: 'Failed to sign out.' }, { status: 500 });
  }
}
