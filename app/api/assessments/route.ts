import { ASSESSMENT_PUBLIC_SELECT } from '@/lib/assessment';
import { getSessionPrincipal } from '@/lib/auth';
import { invalidJsonResponse, jsonResponse, readJsonBody } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { isPrismaError } from '@/lib/prisma-errors';
import { verifySameOrigin } from '@/lib/request-security';
import {
  createAssessmentSchema,
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

  const parsed = createAssessmentSchema.safeParse(body);

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
    if (parsed.data.restart === true) {
      const assessment = await prisma.$transaction(async (transaction) => {
        await transaction.assessment.updateMany({
          where: { userId: principal.userId, status: 'in_progress' },
          data: { status: 'abandoned' },
        });

        return transaction.assessment.create({
          data: { userId: principal.userId },
          select: ASSESSMENT_PUBLIC_SELECT,
        });
      });

      return jsonResponse(assessment, { status: 201 });
    }

    const existing = await findActiveAssessment(principal.userId);

    if (existing !== null) {
      return jsonResponse(existing);
    }

    try {
      const created = await prisma.assessment.create({
        data: { userId: principal.userId },
        select: ASSESSMENT_PUBLIC_SELECT,
      });
      return jsonResponse(created, { status: 201 });
    } catch (error: unknown) {
      if (isPrismaError(error, 'P2002')) {
        const racedAssessment = await findActiveAssessment(principal.userId);

        if (racedAssessment !== null) {
          return jsonResponse(racedAssessment);
        }
      }

      throw error;
    }
  } catch (error: unknown) {
    console.error('Failed to create or restore an assessment.', error);
    return jsonResponse(
      { error: 'Failed to create assessment.' },
      { status: 500 },
    );
  }
}

async function findActiveAssessment(userId: string) {
  return prisma.assessment.findFirst({
    where: { userId, status: 'in_progress' },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: ASSESSMENT_PUBLIC_SELECT,
  });
}
