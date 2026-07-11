import type { Prisma } from '@prisma/client';

import { createSession, getSessionPrincipal, setSessionCookie } from '@/lib/auth';
import { invalidJsonResponse, jsonResponse, readJsonBody } from '@/lib/http';
import { verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
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

  const [targetUser, current] = await Promise.all([
    prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    }),
    getSessionPrincipal(request),
  ]);
  const passwordMatches = await verifyPassword(targetUser?.passwordHash, password);

  if (targetUser === null || !passwordMatches) {
    return jsonResponse({ error: 'Email or password is incorrect.' }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const shouldMergeGuest =
        current !== null &&
        current.email === null &&
        current.userId !== targetUser.id;

      if (shouldMergeGuest) {
        await resolveDraftConflict(transaction, current.userId, targetUser.id);
        await transaction.assessment.updateMany({
          where: { userId: current.userId },
          data: { userId: targetUser.id },
        });
      }

      if (current !== null) {
        await transaction.session.deleteMany({ where: { id: current.sessionId } });
      }

      const session = await createSession(transaction, targetUser.id);
      return { session };
    });

    await clearAuthRateLimit(request, email);
    return setSessionCookie(jsonResponse({ email }), result.session);
  } catch (error: unknown) {
    console.error('Failed to sign in and merge guest data.', error);
    return jsonResponse({ error: 'Failed to sign in.' }, { status: 500 });
  }
}

async function resolveDraftConflict(
  transaction: Prisma.TransactionClient,
  guestUserId: string,
  targetUserId: string,
): Promise<void> {
  const [guestDraft, targetDraft] = await Promise.all([
    transaction.assessment.findFirst({
      where: { userId: guestUserId, status: 'in_progress' },
      select: { id: true, updatedAt: true },
    }),
    transaction.assessment.findFirst({
      where: { userId: targetUserId, status: 'in_progress' },
      select: { id: true, updatedAt: true },
    }),
  ]);

  if (guestDraft === null || targetDraft === null) {
    return;
  }

  const draftToAbandon =
    guestDraft.updatedAt > targetDraft.updatedAt ? targetDraft : guestDraft;
  await transaction.assessment.update({
    where: { id: draftToAbandon.id },
    data: { status: 'abandoned' },
  });
}
