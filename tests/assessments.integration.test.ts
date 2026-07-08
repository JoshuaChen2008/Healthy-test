import { beforeEach, describe, expect, it } from "vitest";

import {
  createSessionAndAssessment,
  getAssessment,
  patchAssessment,
  randomAssessmentId,
  resetDb,
  responseJson,
} from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("assessment progress integration", () => {
  it("restores partially saved core fields, answers, and current step", async () => {
    const { assessmentId } = await createSessionAndAssessment();

    await patchAssessment(assessmentId, {
      currentStep: 1,
      gender: "male",
    });
    await patchAssessment(assessmentId, {
      currentStep: 2,
      heightCm: 175,
      weightKg: 80,
    });
    await patchAssessment(assessmentId, {
      currentStep: 3,
      answers: {
        sleep_hours: "6_7",
      },
    });

    const response = await getAssessment(assessmentId);
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body.gender).toBe("male");
    expect(body.heightCm).toBe(175);
    expect(body.weightKg).toBe(80);
    expect(body.answers).toEqual({ sleep_hours: "6_7" });
    expect(body.currentStep).toBe(3);
    expect(body.status).toBe("in_progress");
  });

  it("accepts out-of-order and repeated patches without losing final data", async () => {
    const { assessmentId } = await createSessionAndAssessment();

    await patchAssessment(assessmentId, {
      currentStep: 4,
      age: 28,
      weightKg: 82,
    });
    await patchAssessment(assessmentId, {
      currentStep: 2,
      weightKg: 80,
      heightCm: 176,
    });
    await patchAssessment(assessmentId, {
      currentStep: 5,
      age: 29,
    });

    const response = await getAssessment(assessmentId);
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body.age).toBe(29);
    expect(body.weightKg).toBe(80);
    expect(body.heightCm).toBe(176);
    expect(body.currentStep).toBe(5);
  });

  it("merges answers across patches instead of replacing the object", async () => {
    const { assessmentId } = await createSessionAndAssessment();

    await patchAssessment(assessmentId, {
      answers: {
        sleep_hours: "6_7",
      },
    });
    await patchAssessment(assessmentId, {
      answers: {
        target_areas: ["belly"],
      },
    });

    const response = await getAssessment(assessmentId);
    const body = await responseJson<{ answers: unknown }>(response);

    expect(response.status).toBe(200);
    expect(body.answers).toEqual({
      sleep_hours: "6_7",
      target_areas: ["belly"],
    });
  });

  it("allows sparse fields while the assessment is still in progress", async () => {
    const { assessmentId } = await createSessionAndAssessment();

    const response = await patchAssessment(assessmentId, {
      currentStep: 1,
      age: 30,
    });
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, currentStep: 1 });
  });

  it.each([
    ["heightCm", { heightCm: -5 }],
    ["age too high", { age: 999 }],
    ["gender", { gender: "xxx" }],
    ["age too low", { age: 9 }],
  ])("rejects invalid input for %s with 400", async (_name, patchBody) => {
    const { assessmentId } = await createSessionAndAssessment();

    const response = await patchAssessment(assessmentId, patchBody);
    const body = await responseJson<{ error?: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("returns 404 for unknown UUID and 400 for invalid UUID format", async () => {
    const unknownResponse = await getAssessment(randomAssessmentId());
    const invalidResponse = await patchAssessment("not-a-uuid", { age: 30 });

    expect(unknownResponse.status).toBe(404);
    expect(invalidResponse.status).toBe(400);
  });
});
