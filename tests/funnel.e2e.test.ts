import { beforeEach, describe, expect, it } from 'vitest';

import {
  createSessionAndAssessment,
  fullAssessmentInput,
  getCookieFromResponse,
  getResult,
  login,
  logout,
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

describe('paid funnel end to end', () => {
  it('keeps an unlocked guest assessment after signup, logout, and login', async () => {
    const { assessmentId, cookie: guestCookie } = await createSessionAndAssessment();
    await patchAssessment(assessmentId, fullAssessmentInput, guestCookie);
    await submitAssessment(assessmentId, guestCookie);

    const signupResponse = await signup(
      'alex@example.com',
      'correct-horse-battery',
      guestCookie,
    );
    const accountCookie = getCookieFromResponse(signupResponse);
    const payResponse = await pay(accountCookie);
    expect(payResponse.status).toBe(200);

    await logout(accountCookie);
    expect((await getResult(assessmentId, accountCookie)).status).toBe(401);

    const loginResponse = await login('alex@example.com', 'correct-horse-battery');
    const newDeviceCookie = getCookieFromResponse(loginResponse);
    const resultResponse = await getResult(assessmentId, newDeviceCookie);
    const result = await responseJson<Record<string, unknown>>(resultResponse);

    expect(resultResponse.status).toBe(200);
    expect(result.membership).toBe('active');
    expect(typeof result.targetDate).toBe('string');
  });
});
