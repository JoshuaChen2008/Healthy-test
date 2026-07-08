import { beforeEach, describe, expect, it } from "vitest";

import {
  createSessionAndAssessment,
  fullAssessmentInput,
  getResult,
  patchAssessment,
  payUser,
  resetDb,
  responseJson,
  submitAssessment,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("result authorization", () => {
  it("returns masked result for free users without leaking the real targetDate value", async () => {
    const { assessmentId } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, fullAssessmentInput);
    await submitAssessment(assessmentId);

    const freeResponse = await getResult(assessmentId);
    const freeBody = await responseJson<Record<string, unknown>>(freeResponse);
    const targetDate = await getStoredTargetDateIso(assessmentId);

    expect(freeResponse.status).toBe(200);
    expect(freeBody.membership).toBe("free");
    expect(freeBody.targetDate).toBeUndefined();
    expect(freeBody.bmi).toBe(26.1);
    expect(typeof freeBody.recommendedCalories).toBe("number");
    expect(freeBody.locked).toEqual({ targetDate: true });
    expect(freeBody.upsell).toBeTruthy();
    expect(JSON.stringify(freeBody)).not.toContain(targetDate);
  });

  it("returns the real targetDate for active members", async () => {
    const { userId, assessmentId } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, fullAssessmentInput);
    await submitAssessment(assessmentId);
    await payUser(userId);

    const targetDate = await getStoredTargetDateIso(assessmentId);
    const response = await getResult(assessmentId);
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body.membership).toBe("active");
    expect(body.targetDate).toBe(targetDate);
  });

  it("returns 409 before the assessment is submitted", async () => {
    const { assessmentId } = await createSessionAndAssessment();

    const response = await getResult(assessmentId);
    const body = await responseJson<{ error?: string }>(response);

    expect(response.status).toBe(409);
    expect(body.error).toBe("Assessment not submitted yet.");
  });
});

async function getStoredTargetDateIso(assessmentId: string) {
  const { prisma } = await import("@/lib/prisma");
  const assessment = await prisma.assessment.findUniqueOrThrow({
    where: {
      id: assessmentId,
    },
    select: {
      targetDate: true,
    },
  });

  expect(assessment.targetDate).not.toBeNull();

  return assessment.targetDate?.toISOString() ?? "";
}
