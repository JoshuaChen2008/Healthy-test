import { createSession, getSessionPrincipal, setSessionCookie } from '@/lib/auth';
import { invalidJsonResponse, jsonResponse, readJsonBody } from '@/lib/http';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { isPrismaError } from '@/lib/prisma-errors';
import { clearAuthRateLimit, consumeAuthRateLimit } from '@/lib/rate-limit';
import { verifySameOrigin } from '@/lib/request-security';
import {
  authCredentialsSchema,
  getValidationErrorMessage,
} from '@/lib/validation';

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

  const parsed = authCredentialsSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  if (await consumeAuthRateLimit(request, email)) {
    return jsonResponse(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 },
    );
  }

  const current = await getSessionPrincipal(request);

  if (current !== null && current.email !== null) {
    return jsonResponse(
      { error: 'This browser is already signed in.' },
      { status: 409 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async (transaction) => {
      let userId: string;

      if (current !== null) {
        const updated = await transaction.user.updateMany({
          where: { id: current.userId, email: null, passwordHash: null },
          data: { email, passwordHash },
        });

        if (updated.count !== 1) {
          throw new SignupConflictError();
        }

        userId = current.userId;
        await transaction.session.deleteMany({ where: { id: current.sessionId } });
      } else {
        const user = await transaction.user.create({
          data: { email, passwordHash },
          select: { id: true },
        });
        userId = user.id;
      }

      const session = await createSession(transaction, userId);
      return { session };
    });

    await clearAuthRateLimit(request, email);

    return setSessionCookie(
      jsonResponse({ email }, { status: 201 }),
      result.session,
    );
  } catch (error: unknown) {
    if (isPrismaError(error, 'P2002')) {
      return jsonResponse(
        { error: 'Email is already registered.' },
        { status: 409 },
      );
    }

    if (error instanceof SignupConflictError) {
      return jsonResponse(
        { error: 'This guest session can no longer be registered.' },
        { status: 409 },
      );
    }

    console.error('Failed to create an account.', error);
    return jsonResponse({ error: 'Failed to create account.' }, { status: 500 });
  }
}

class SignupConflictError extends Error {
  public constructor() {
    super('Guest account has already changed.');
    this.name = 'SignupConflictError';
  }
}
