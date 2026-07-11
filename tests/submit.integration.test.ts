import { beforeEach, describe, expect, it } from 'vitest';

import {
  createSessionAndAssessment,
  createTestSession,
  fullAssessmentInput,
  getAssessment,
  patchAssessment,
  resetDb,
  responseJson,
  submitAssessment,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('assessment submit integration', () => {
  it('computes results and keeps repeated submission idempotent', async () => {
    const { assessmentId, cookie } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, fullAssessmentInput, cookie);

    const first = await submitAssessment(assessmentId, cookie);
    const second = await submitAssessment(assessmentId, cookie);
    const secondBody = await responseJson<Record<string, unknown>>(second);
    const getResponse = await getAssessment(assessmentId, cookie);
    const getBody = await responseJson<Record<string, unknown>>(getResponse);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody.bmi).toBe(26.1);
    expect(getBody.status).toBe('completed');
  });

  it('lists missing required fields', async () => {
    const { assessmentId, cookie } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, { gender: 'female', age: 32 }, cookie);
    const response = await submitAssessment(assessmentId, cookie);
    const body = await responseJson<{ error: string }>(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain('goal');
    expect(body.error).toContain('workoutFrequency');
  });

  it('does not let a different session submit the assessment', async () => {
    const owner = await createSessionAndAssessment();
    const stranger = await createTestSession();
    await patchAssessment(owner.assessmentId, fullAssessmentInput, owner.cookie);

    const response = await submitAssessment(owner.assessmentId, stranger.cookie);
    expect(response.status).toBe(404);
  });
});
