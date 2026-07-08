import { prisma } from "@/lib/prisma";
import { getValidationErrorMessage, routeIdParamsSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
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
        id: true,
        userId: true,
        status: true,
        bmi: true,
        recommendedCalories: true,
        targetDate: true,
      },
    });

    if (!assessment) {
      return Response.json({ error: "Assessment not found." }, { status: 404 });
    }

    if (assessment.status !== "completed") {
      return Response.json(
        { error: "Assessment not submitted yet." },
        { status: 409 },
      );
    }

    if (
      assessment.bmi === null ||
      assessment.recommendedCalories === null ||
      assessment.targetDate === null
    ) {
      return Response.json(
        { error: "Assessment result not available." },
        { status: 500 },
      );
    }

    const subscription = await prisma.subscription.findUnique({
      where: {
        userId: assessment.userId,
      },
      select: {
        status: true,
      },
    });

    const membership = subscription?.status ?? "free";

    if (membership === "active") {
      return Response.json({
        assessmentId: assessment.id,
        status: assessment.status,
        membership,
        bmi: assessment.bmi,
        recommendedCalories: assessment.recommendedCalories,
        targetDate: assessment.targetDate.toISOString(),
      });
    }

    return Response.json({
      assessmentId: assessment.id,
      status: assessment.status,
      membership: "free",
      bmi: assessment.bmi,
      recommendedCalories: assessment.recommendedCalories,
      locked: {
        targetDate: true,
      },
      upsell: "解锁完整结果，查看你的目标达成日期与个性化计划",
    });
  } catch {
    return Response.json(
      { error: "Failed to load assessment result." },
      { status: 500 },
    );
  }
}
