import { getSessionPrincipal } from '@/lib/auth';
import { jsonResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getValidationErrorMessage, routeIdParamsSchema } from '@/lib/validation';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const params = routeIdParamsSchema.safeParse(await context.params);

  if (!params.success) {
    return jsonResponse(
      { error: getValidationErrorMessage(params.error) },
      { status: 400 },
    );
  }

  const principal = await getSessionPrincipal(request);

  if (principal === null) {
    return jsonResponse({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const assessment = await prisma.assessment.findFirst({
      where: { id: params.data.id, userId: principal.userId },
      select: {
        id: true,
        status: true,
        bmi: true,
        recommendedCalories: true,
        targetDate: true,
        user: {
          select: {
            email: true,
            subscription: { select: { status: true } },
          },
        },
      },
    });

    if (assessment === null) {
      return jsonResponse({ error: 'Assessment not found.' }, { status: 404 });
    }

    if (assessment.status !== 'completed') {
      return jsonResponse(
        { error: 'Assessment not submitted yet.' },
        { status: 409 },
      );
    }

    if (
      assessment.bmi === null ||
      assessment.recommendedCalories === null ||
      assessment.targetDate === null
    ) {
      return jsonResponse(
        { error: 'Assessment result not available.' },
        { status: 500 },
      );
    }

    const isActiveMember =
      assessment.user.email !== null &&
      assessment.user.subscription?.status === 'active';

    if (isActiveMember) {
      return jsonResponse({
        assessmentId: assessment.id,
        status: assessment.status,
        membership: 'active',
        bmi: assessment.bmi,
        recommendedCalories: assessment.recommendedCalories,
        targetDate: assessment.targetDate.toISOString(),
      });
    }

    return jsonResponse({
      assessmentId: assessment.id,
      status: assessment.status,
      membership: 'free',
      bmi: assessment.bmi,
      recommendedCalories: assessment.recommendedCalories,
      locked: { targetDate: true },
      upsell: '解锁完整结果，查看你的目标达成日期与个性化计划。',
    });
  } catch (error: unknown) {
    console.error('Failed to load an assessment result.', error);
    return jsonResponse(
      { error: 'Failed to load assessment result.' },
      { status: 500 },
    );
  }
}
