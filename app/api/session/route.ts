import { createSession, getSessionPrincipal, setSessionCookie } from '@/lib/auth';
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
    const current = await getSessionPrincipal(request);

    if (current !== null) {
      return jsonResponse({
        authenticated: current.email !== null,
        email: current.email,
      });
    }

    const created = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {},
        select: { id: true },
      });
      const session = await createSession(transaction, user.id);
      return { session };
    });

    return setSessionCookie(
      jsonResponse(
        { authenticated: false, email: null },
        { status: 201 },
      ),
      created.session,
    );
  } catch (error: unknown) {
    console.error('Failed to create or restore a guest session.', error);
    return jsonResponse({ error: 'Failed to create session.' }, { status: 500 });
  }
}
