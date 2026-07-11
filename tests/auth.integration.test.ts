import { beforeEach, describe, expect, it } from 'vitest';

import { hashSessionToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

import {
  createSessionAndAssessment,
  createTestSession,
  getAssessment,
  getCookieFromResponse,
  getMe,
  getRawCookieToken,
  login,
  logout,
  resetDb,
  responseJson,
  signup,
} from './helpers';

beforeEach(async () => {
  await resetDb();
});

describe('account authentication', () => {
  it('upgrades a guest, stores only a token hash, and rotates the session', async () => {
    const guest = await createTestSession();
    const response = await signup('  OWNER@Example.com ', 'strong-pass-123', guest.cookie);
    const accountCookie = getCookieFromResponse(response);
    const rawToken = getRawCookieToken(accountCookie);
    const storedSession = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionToken(rawToken) },
      select: { tokenHash: true, user: { select: { email: true } } },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(accountCookie).not.toBe(guest.cookie);
    expect(storedSession.tokenHash).not.toBe(rawToken);
    expect(storedSession.user.email).toBe('owner@example.com');
    expect((await getMe(guest.cookie)).status).toBe(401);
    expect((await getMe(accountCookie)).status).toBe(200);
  });

  it('returns 409 for a duplicate email and generic 401 login errors', async () => {
    const first = await signup('owner@example.com', 'strong-pass-123');
    expect(first.status).toBe(201);

    const duplicate = await signup('OWNER@example.com', 'another-pass-123');
    const wrongPassword = await login('owner@example.com', 'wrong-password');
    const unknownEmail = await login('unknown@example.com', 'wrong-password');
    const wrongBody = await responseJson<{ error: string }>(wrongPassword);
    const unknownBody = await responseJson<{ error: string }>(unknownEmail);

    expect(duplicate.status).toBe(409);
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongBody.error).toBe(unknownBody.error);
  });

  it('merges only the guest data proven by its cookie', async () => {
    const accountResponse = await signup('owner@example.com', 'strong-pass-123');
    const accountCookie = getCookieFromResponse(accountResponse);
    const guest = await createSessionAndAssessment();
    const stranger = await createSessionAndAssessment();

    const loginResponse = await login(
      'owner@example.com',
      'strong-pass-123',
      guest.cookie,
    );
    const mergedCookie = getCookieFromResponse(loginResponse);

    expect((await getAssessment(guest.assessmentId, mergedCookie)).status).toBe(200);
    expect((await getAssessment(stranger.assessmentId, mergedCookie)).status).toBe(404);
    expect((await getMe(accountCookie)).status).toBe(200);
  });

  it('invalidates only the current session on logout', async () => {
    const signupResponse = await signup('owner@example.com', 'strong-pass-123');
    const firstCookie = getCookieFromResponse(signupResponse);
    const loginResponse = await login('owner@example.com', 'strong-pass-123');
    const secondCookie = getCookieFromResponse(loginResponse);

    await logout(secondCookie);

    expect((await getMe(secondCookie)).status).toBe(401);
    expect((await getMe(firstCookie)).status).toBe(200);
  });

  it('rate limits repeated failed login attempts', async () => {
    const responses: Response[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await login('limited@example.com', 'wrong-password'));
    }

    expect(responses.slice(0, 5).every((response) => response.status === 401)).toBe(true);
    expect(responses[5]?.status).toBe(429);
  });
});
