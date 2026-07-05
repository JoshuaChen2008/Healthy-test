import { prisma } from "@/lib/prisma";
import {
  createAssessmentSchema,
  getValidationErrorMessage,
} from "@/lib/validation";

async function readJsonBody(request: Request) {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await readJsonBody(request);
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = createAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: getValidationErrorMessage(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: parsed.data.userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    const assessment = await prisma.assessment.create({
      data: {
        userId: user.id,
        currentStep: 0,
        status: "in_progress",
        answers: {},
      },
      select: {
        id: true,
      },
    });

    return Response.json({ assessmentId: assessment.id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Failed to create assessment." },
      { status: 500 }
    );
  }
}

