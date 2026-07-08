import { computeAssessmentResult, type HealthInput } from "@/lib/health";
import { prisma } from "@/lib/prisma";
import { getValidationErrorMessage, routeIdParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type AssessmentCoreFields = {
  gender: HealthInput["gender"] | null;
  goal: HealthInput["goal"] | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  workoutFrequency: HealthInput["workoutFrequency"] | null;
};

const REQUIRED_CORE_FIELDS = [
  "gender",
  "goal",
  "age",
  "heightCm",
  "weightKg",
  "targetWeightKg",
  "workoutFrequency",
] as const satisfies ReadonlyArray<keyof AssessmentCoreFields>;

function getMissingCoreFields(assessment: AssessmentCoreFields): string[] {
  return REQUIRED_CORE_FIELDS.filter((field) => assessment[field] === null);
}

function isCompleteHealthInput(assessment: AssessmentCoreFields): assessment is HealthInput {
  return getMissingCoreFields(assessment).length === 0;
}

export async function POST(_request: Request, context: RouteContext) {
  const params = routeIdParamsSchema.safeParse(await context.params);

  if (!params.success) {
    return Response.json(
      { error: getValidationErrorMessage(params.error) },
      { status: 400 },
    );
  }

  try {
    const assessment = await prisma.assessment.findUnique({
      where: {
        id: params.data.id,
      },
      select: {
        gender: true,
        goal: true,
        age: true,
        heightCm: true,
        weightKg: true,
        targetWeightKg: true,
        workoutFrequency: true,
      },
    });

    if (!assessment) {
      return Response.json({ error: "Assessment not found." }, { status: 404 });
    }

    const missingFields = getMissingCoreFields(assessment);

    if (!isCompleteHealthInput(assessment)) {
      return Response.json(
        { error: `Missing required fields: ${missingFields.join(", ")}.` },
        { status: 400 },
      );
    }

    const result = computeAssessmentResult(assessment);

    const updated = await prisma.assessment.update({
      where: {
        id: params.data.id,
      },
      data: {
        bmi: result.bmi,
        recommendedCalories: result.recommendedCalories,
        targetDate: result.targetDate,
        status: "completed",
      },
      select: {
        status: true,
        bmi: true,
        recommendedCalories: true,
      },
    });

    return Response.json({
      status: updated.status,
      bmi: updated.bmi,
      recommendedCalories: updated.recommendedCalories,
    });
  } catch {
    return Response.json(
      { error: "Failed to submit assessment." },
      { status: 500 },
    );
  }
}
