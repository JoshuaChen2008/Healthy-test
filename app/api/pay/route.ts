import { getSessionPrincipal } from '@/lib/auth';
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

  const principal = await getSessionPrincipal(request);

  if (principal === null || principal.email === null) {
    return jsonResponse({ error: 'Registered account required.' }, { status: 401 });
  }

  try {
    const subscription = await prisma.subscription.upsert({
      where: { userId: principal.userId },
      update: { status: 'active', paidAt: new Date() },
      create: {
        userId: principal.userId,
        status: 'active',
        paidAt: new Date(),
      },
      select: { status: true },
    });

    return jsonResponse({ status: subscription.status });
  } catch (error: unknown) {
    console.error('Failed to process the simulated payment.', error);
    return jsonResponse(
      { error: 'Failed to process payment.' },
      { status: 500 },
    );
  }
}
