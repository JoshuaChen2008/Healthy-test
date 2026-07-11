import { ASSESSMENT_PUBLIC_SELECT, getDerivedCurrentStep } from '@/lib/assessment';
import { getSessionPrincipal } from '@/lib/auth';
import { invalidJsonResponse, jsonResponse, readJsonBody } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { verifySameOrigin } from '@/lib/request-security';
import {
  getValidationErrorMessage,
  routeIdParamsSchema,
  updateAssessmentSchema,
} from '@/lib/validation';

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
      select: ASSESSMENT_PUBLIC_SELECT,
    });

    if (assessment === null) {
      return jsonResponse({ error: 'Assessment not found.' }, { status: 404 });
    }

    return jsonResponse(assessment);
  } catch (error: unknown) {
    console.error('Failed to load an assessment.', error);
    return jsonResponse(
      { error: 'Failed to load assessment.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
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

  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = updateAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return jsonResponse(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const principal = await getSessionPrincipal(request);

  if (principal === null) {
    return jsonResponse({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const existing = await prisma.assessment.findFirst({
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
      },
    });

    if (existing === null) {
      return jsonResponse({ error: 'Assessment not found.' }, { status: 404 });
    }

    if (existing.status !== 'in_progress') {
      return jsonResponse(
        { error: 'Only an in-progress assessment can be updated.' },
        { status: 409 },
      );
    }

    const answers = { ...parsed.data };
    delete answers.currentStep;
    const merged = { ...existing, ...answers };
    const currentStep = getDerivedCurrentStep(merged);
    const updated = await prisma.assessment.update({
      where: { id: params.data.id },
      data: { ...answers, currentStep },
      select: { currentStep: true },
    });

    return jsonResponse({ ok: true, currentStep: updated.currentStep });
  } catch (error: unknown) {
    console.error('Failed to update an assessment.', error);
    return jsonResponse(
      { error: 'Failed to update assessment.' },
      { status: 500 },
    );
  }
}
