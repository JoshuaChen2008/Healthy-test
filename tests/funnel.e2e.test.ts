import { beforeEach, describe, expect, it } from "vitest";

import {
  createTestAssessment,
  createTestSession,
  fullAssessmentInput,
  getResult,
  patchAssessment,
  payUser,
  randomAssessmentId,
  resetDb,
  responseJson,
  submitAssessment,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("paid funnel end to end", () => {
  it("unlocks the full result after payment", async () => {
    const { userId } = await createTestSession();
    const { assessmentId } = await createTestAssessment(userId);

    await patchAssessment(assessmentId, fullAssessmentInput);
    await submitAssessment(assessmentId);

    const freeResponse = await getResult(assessmentId);
    const freeBody = await responseJson<Record<string, unknown>>(freeResponse);

    expect(freeResponse.status).toBe(200);
    expect(freeBody.membership).toBe("free");
    expect(freeBody.targetDate).toBeUndefined();

    const payResponse = await payUser(userId);
    const payBody = await responseJson<Record<string, unknown>>(payResponse);

    expect(payResponse.status).toBe(200);
    expect(payBody).toEqual({ status: "active" });

    const activeResponse = await getResult(assessmentId);
    const activeBody = await responseJson<Record<string, unknown>>(activeResponse);

    expect(activeResponse.status).toBe(200);
    expect(activeBody.membership).toBe("active");
    expect(typeof activeBody.targetDate).toBe("string");
  });

  it("unlocks full results account-wide for a second assessment", async () => {
    const { userId } = await createTestSession();
    const first = await createTestAssessment(userId);

    await patchAssessment(first.assessmentId, fullAssessmentInput);
    await submitAssessment(first.assessmentId);
    await payUser(userId);

    const second = await createTestAssessment(userId);
    await patchAssessment(second.assessmentId, {
      ...fullAssessmentInput,
      weightKg: 75,
      targetWeightKg: 72,
    });
    await submitAssessment(second.assessmentId);

    const response = await getResult(second.assessmentId);
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body.membership).toBe("active");
    expect(typeof body.targetDate).toBe("string");
  });

  it("allows repeated pay calls for an already active user", async () => {
    const { userId } = await createTestSession();

    const firstResponse = await payUser(userId);
    const secondResponse = await payUser(userId);
    const secondBody = await responseJson<Record<string, unknown>>(secondResponse);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toEqual({ status: "active" });
  });

  it("returns 404 when paying for an unknown user", async () => {
    const response = await payUser(randomAssessmentId());
    const body = await responseJson<{ error?: string }>(response);

    expect(response.status).toBe(404);
    expect(body.error).toBe("User not found.");
  });
});
