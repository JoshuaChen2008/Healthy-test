import { beforeEach, describe, expect, it } from "vitest";

import {
  createSessionAndAssessment,
  fullAssessmentInput,
  getAssessment,
  patchAssessment,
  randomAssessmentId,
  resetDb,
  responseJson,
  submitAssessment,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("assessment submit integration", () => {
  it("computes results and marks a complete assessment as completed", async () => {
    const { assessmentId } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, fullAssessmentInput);

    const submitResponse = await submitAssessment(assessmentId);
    const submitBody = await responseJson<Record<string, unknown>>(submitResponse);

    expect(submitResponse.status).toBe(200);
    expect(submitBody.status).toBe("completed");
    expect(submitBody.bmi).toBe(26.1);
    expect(typeof submitBody.recommendedCalories).toBe("number");

    const getResponse = await getAssessment(assessmentId);
    const getBody = await responseJson<Record<string, unknown>>(getResponse);

    expect(getResponse.status).toBe(200);
    expect(getBody.status).toBe("completed");
  });

  it("rejects submit when core fields are missing and lists the missing fields", async () => {
    const { assessmentId } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, {
      gender: "female",
      age: 32,
    });

    const response = await submitAssessment(assessmentId);
    const body = await responseJson<{ error?: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain("goal");
    expect(body.error).toContain("heightCm");
    expect(body.error).toContain("weightKg");
    expect(body.error).toContain("targetWeightKg");
    expect(body.error).toContain("workoutFrequency");
  });

  it("allows repeated submit for the same assessment", async () => {
    const { assessmentId } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, fullAssessmentInput);

    const firstResponse = await submitAssessment(assessmentId);
    const secondResponse = await submitAssessment(assessmentId);
    const secondBody = await responseJson<Record<string, unknown>>(secondResponse);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondBody.status).toBe("completed");
    expect(secondBody.bmi).toBe(26.1);
  });

  it("returns 404 for unknown assessment id", async () => {
    const response = await submitAssessment(randomAssessmentId());
    const body = await responseJson<{ error?: string }>(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe("Assessment not found.");
  });
});
