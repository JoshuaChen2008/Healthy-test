import { beforeEach, describe, expect, it } from 'vitest';

import {
  createSessionAndAssessment,
  createTestAssessment,
  createTestSession,
  getAssessment,
  patchAssessment,
  randomAssessmentId,
  resetDb,
  responseJson,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('assessment progress integration', () => {
  it('restores fields and derives progress from contiguous saved answers', async () => {
    const { assessmentId, cookie } = await createSessionAndAssessment();

    await patchAssessment(assessmentId, { gender: 'male', currentStep: 7 }, cookie);
    await patchAssessment(assessmentId, { heightCm: 175 }, cookie);
    const response = await getAssessment(assessmentId, cookie);
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body.gender).toBe('male');
    expect(body.heightCm).toBe(175);
    expect(body.currentStep).toBe(1);
    expect(body.status).toBe('in_progress');
    expect(body.userId).toBeUndefined();
  });

  it('returns the same active draft and restarts only when requested', async () => {
    const { cookie } = await createTestSession();
    const first = await createTestAssessment(cookie);
    const restored = await createTestAssessment(cookie);
    const restarted = await createTestAssessment(cookie, true);

    expect(first.response.status).toBe(201);
    expect(restored.response.status).toBe(200);
    expect(restored.assessmentId).toBe(first.assessmentId);
    expect(restarted.response.status).toBe(201);
    expect(restarted.assessmentId).not.toBe(first.assessmentId);
  });

  it('returns one active draft when two create requests race', async () => {
    const { cookie } = await createTestSession();
    const [first, second] = await Promise.all([
      createTestAssessment(cookie),
      createTestAssessment(cookie),
    ]);

    expect(first.assessmentId).toBe(second.assessmentId);
  });

  it('prevents another session from reading or modifying an assessment', async () => {
    const owner = await createSessionAndAssessment();
    const stranger = await createTestSession();

    const getResponse = await getAssessment(owner.assessmentId, stranger.cookie);
    const patchResponse = await patchAssessment(
      owner.assessmentId,
      { age: 44 },
      stranger.cookie,
    );

    expect(getResponse.status).toBe(404);
    expect(patchResponse.status).toBe(404);
  });

  it.each([
    ['heightCm', { heightCm: -5 }],
    ['age too high', { age: 999 }],
    ['gender', { gender: 'xxx' }],
    ['step too high', { currentStep: 8 }],
  ])('rejects invalid input for %s', async (_name, patchBody) => {
    const { assessmentId, cookie } = await createSessionAndAssessment();
    const response = await patchAssessment(assessmentId, patchBody, cookie);
    expect(response.status).toBe(400);
  });

  it('requires a session and validates route ids', async () => {
    const noSessionResponse = await getAssessment(randomAssessmentId());
    const { cookie } = await createTestSession();
    const invalidResponse = await patchAssessment('not-a-uuid', { age: 30 }, cookie);

    expect(noSessionResponse.status).toBe(401);
    expect(invalidResponse.status).toBe(400);
  });
});
