import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getValidationErrorMessage,
  routeIdParamsSchema,
  updateAssessmentSchema,
} from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const params = routeIdParamsSchema.safeParse(await context.params);

  if (!params.success) {
    return Response.json(
      { error: getValidationErrorMessage(params.error) },
      { status: 400 }
    );
  }

  try {
    const assessment = await prisma.assessment.findUnique({
      where: {
        id: params.data.id,
      },
      select: {
        id: true,
        userId: true,
        gender: true,
        goal: true,
        age: true,
        heightCm: true,
        weightKg: true,
        targetWeightKg: true,
        workoutFrequency: true,
        email: true,
        name: true,
        answers: true,
        currentStep: true,
        status: true,
      },
    });

    if (!assessment) {
      return Response.json({ error: "Assessment not found." }, { status: 404 });
    }

    return Response.json(assessment);
  } catch {
    return Response.json(
      { error: "Failed to load assessment." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const params = routeIdParamsSchema.safeParse(await context.params);

  if (!params.success) {
    return Response.json(
      { error: getValidationErrorMessage(params.error) },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = updateAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.assessment.findUnique({
      where: {
        id: params.data.id,
      },
      select: {
        answers: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Assessment not found." }, { status: 404 });
    }

    const { answers, ...coreFields } = parsed.data;
    const data: Prisma.AssessmentUpdateInput = {
      ...coreFields,
    };

    if (answers !== undefined) {
      const existingAnswers = isPlainObject(existing.answers) ? existing.answers : {};
      data.answers = {
        ...existingAnswers,
        ...answers,
      } as Prisma.InputJsonObject;
    }

    const updated = await prisma.assessment.update({
      where: {
        id: params.data.id,
      },
      data,
      select: {
        currentStep: true,
      },
    });

    return Response.json({ ok: true, currentStep: updated.currentStep });
  } catch {
    return Response.json(
      { error: "Failed to update assessment." },
      { status: 500 }
    );
  }
}

