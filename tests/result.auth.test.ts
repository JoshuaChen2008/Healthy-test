import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/lib/prisma';

import {
  createSessionAndAssessment,
  createTestSession,
  fullAssessmentInput,
  getCookieFromResponse,
  getResult,
  patchAssessment,
  pay,
  resetDb,
  responseJson,
  signup,
  submitAssessment,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('result authorization', () => {
  it('returns a masked result to its guest owner without leaking targetDate', async () => {
    const { assessmentId, cookie } = await createCompletedAssessment();
    const response = await getResult(assessmentId, cookie);
    const body = await responseJson<Record<string, unknown>>(response);
    const stored = await prisma.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      select: { targetDate: true },
    });

    expect(response.status).toBe(200);
    expect(body.membership).toBe('free');
    expect(body.targetDate).toBeUndefined();
    expect(body.locked).toEqual({ targetDate: true });
    expect(JSON.stringify(body)).not.toContain(stored.targetDate?.toISOString());
  });

  it('returns 401 without a session and 404 to a different owner', async () => {
    const owner = await createCompletedAssessment();
    const stranger = await createTestSession();

    expect((await getResult(owner.assessmentId)).status).toBe(401);
    expect((await getResult(owner.assessmentId, stranger.cookie)).status).toBe(404);
  });

  it('returns the full target date only to the active account owner', async () => {
    const owner = await createCompletedAssessment();
    const signupResponse = await signup('member@example.com', 'strong-pass-123', owner.cookie);
    const accountCookie = getCookieFromResponse(signupResponse);
    await pay(accountCookie);

    const response = await getResult(owner.assessmentId, accountCookie);
    const body = await responseJson<Record<string, unknown>>(response);

    expect(response.status).toBe(200);
    expect(body.membership).toBe('active');
    expect(typeof body.targetDate).toBe('string');
  });

  it('returns 409 before submission', async () => {
    const { assessmentId, cookie } = await createSessionAndAssessment();
    const response = await getResult(assessmentId, cookie);
    expect(response.status).toBe(409);
  });
});

async function createCompletedAssessment(): Promise<{
  readonly assessmentId: string;
  readonly cookie: string;
}> {
  const created = await createSessionAndAssessment();
  await patchAssessment(created.assessmentId, fullAssessmentInput, created.cookie);
  await submitAssessment(created.assessmentId, created.cookie);
  return created;
}
