import { getSessionPrincipal } from '@/lib/auth';
import { computeAssessmentResult, type HealthInput } from '@/lib/health';
import { jsonResponse } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { verifySameOrigin } from '@/lib/request-security';
import { getValidationErrorMessage, routeIdParamsSchema } from '@/lib/validation';

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

interface AssessmentCoreFields {
  readonly gender: HealthInput['gender'] | null;
  readonly goal: HealthInput['goal'] | null;
  readonly age: number | null;
  readonly heightCm: number | null;
  readonly weightKg: number | null;
  readonly targetWeightKg: number | null;
  readonly workoutFrequency: HealthInput['workoutFrequency'] | null;
}

const REQUIRED_CORE_FIELDS = [
  'gender',
  'goal',
  'age',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'workoutFrequency',
] as const satisfies ReadonlyArray<keyof AssessmentCoreFields>;

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const originError = verifySameOrigin(request);

  if (originError !== undefined) {
    return originError;
  }

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
        status: true,
        gender: true,
        goal: true,
        age: true,
        heightCm: true,
        weightKg: true,
        targetWeightKg: true,
        workoutFrequency: true,
        bmi: true,
        recommendedCalories: true,
      },
    });

    if (assessment === null) {
      return jsonResponse({ error: 'Assessment not found.' }, { status: 404 });
    }

    if (assessment.status === 'abandoned') {
      return jsonResponse(
        { error: 'This assessment was abandoned.' },
        { status: 409 },
      );
    }

    if (assessment.status === 'completed') {
      return jsonResponse({
        status: assessment.status,
        bmi: assessment.bmi,
        recommendedCalories: assessment.recommendedCalories,
      });
    }

    const missingFields = getMissingCoreFields(assessment);

    if (!isCompleteHealthInput(assessment)) {
      return jsonResponse(
        { error: `Missing required fields: ${missingFields.join(', ')}.` },
        { status: 400 },
      );
    }

    const result = computeAssessmentResult(assessment);
    const updated = await prisma.assessment.update({
      where: { id: params.data.id },
      data: {
        bmi: result.bmi,
        recommendedCalories: result.recommendedCalories,
        targetDate: result.targetDate,
        currentStep: 7,
        status: 'completed',
      },
      select: {
        status: true,
        bmi: true,
        recommendedCalories: true,
      },
    });

    return jsonResponse(updated);
  } catch (error: unknown) {
    console.error('Failed to submit an assessment.', error);
    return jsonResponse(
      { error: 'Failed to submit assessment.' },
      { status: 500 },
    );
  }
}

function getMissingCoreFields(assessment: AssessmentCoreFields): string[] {
  return REQUIRED_CORE_FIELDS.filter((field) => assessment[field] === null);
}

function isCompleteHealthInput(
  assessment: AssessmentCoreFields,
): assessment is HealthInput {
  return getMissingCoreFields(assessment).length === 0;
}
