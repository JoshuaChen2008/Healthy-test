import { randomUUID } from 'node:crypto';

import { GET as getAssessmentRoute, PATCH as patchAssessmentRoute } from '@/app/api/assessments/[id]/route';
import { GET as getResultRoute } from '@/app/api/assessments/[id]/result/route';
import { POST as submitAssessmentRoute } from '@/app/api/assessments/[id]/submit/route';
import { POST as createAssessmentRoute } from '@/app/api/assessments/route';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { POST as logoutRoute } from '@/app/api/auth/logout/route';
import { GET as meRoute } from '@/app/api/auth/me/route';
import { POST as signupRoute } from '@/app/api/auth/signup/route';
import { POST as payRoute } from '@/app/api/pay/route';
import { POST as createSessionRoute } from '@/app/api/session/route';
import { getSessionCookieName } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const TEST_ORIGIN = 'http://localhost';

export const fullAssessmentInput = {
  gender: 'male',
  goal: 'lose_weight',
  age: 30,
  heightCm: 175,
  weightKg: 80,
  targetWeightKg: 70,
  workoutFrequency: 'few_times_week',
} as const;

export interface TestSession {
  readonly cookie: string;
  readonly response: Response;
}

export async function resetDb(): Promise<void> {
  await prisma.authRateLimit.deleteMany();
  await prisma.session.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
}

export function jsonRequest(
  pathname: string,
  method: string,
  body?: unknown,
  cookie?: string,
): Request {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: TEST_ORIGIN,
  });

  if (cookie !== undefined) {
    headers.set('cookie', cookie);
  }

  return new Request(`${TEST_ORIGIN}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

export async function responseJson<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function createTestSession(): Promise<TestSession> {
  const response = await createSessionRoute(jsonRequest('/api/session', 'POST', {}));
  return { response, cookie: getCookieFromResponse(response) };
}

export async function createTestAssessment(
  cookie: string,
  restart = false,
): Promise<{ readonly response: Response; readonly assessmentId: string }> {
  const response = await createAssessmentRoute(
    jsonRequest('/api/assessments', 'POST', restart ? { restart: true } : {}, cookie),
  );
  const body = await responseJson<{ id: string }>(response);
  return { response, assessmentId: body.id };
}

export async function patchAssessment(
  id: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  return patchAssessmentRoute(
    jsonRequest(`/api/assessments/${id}`, 'PATCH', body, cookie),
    routeContext(id),
  );
}

export async function getAssessment(id: string, cookie?: string): Promise<Response> {
  return getAssessmentRoute(
    jsonRequest(`/api/assessments/${id}`, 'GET', undefined, cookie),
    routeContext(id),
  );
}

export async function submitAssessment(
  id: string,
  cookie: string,
): Promise<Response> {
  return submitAssessmentRoute(
    jsonRequest(`/api/assessments/${id}/submit`, 'POST', {}, cookie),
    routeContext(id),
  );
}

export async function getResult(id: string, cookie?: string): Promise<Response> {
  return getResultRoute(
    jsonRequest(`/api/assessments/${id}/result`, 'GET', undefined, cookie),
    routeContext(id),
  );
}

export async function signup(
  email: string,
  password: string,
  cookie?: string,
): Promise<Response> {
  return signupRoute(
    jsonRequest('/api/auth/signup', 'POST', { email, password }, cookie),
  );
}

export async function login(
  email: string,
  password: string,
  cookie?: string,
): Promise<Response> {
  return loginRoute(
    jsonRequest('/api/auth/login', 'POST', { email, password }, cookie),
  );
}

export async function logout(cookie: string): Promise<Response> {
  return logoutRoute(jsonRequest('/api/auth/logout', 'POST', {}, cookie));
}

export async function getMe(cookie?: string): Promise<Response> {
  return meRoute(jsonRequest('/api/auth/me', 'GET', undefined, cookie));
}

export async function pay(cookie: string): Promise<Response> {
  return payRoute(jsonRequest('/api/pay', 'POST', {}, cookie));
}

export async function createSessionAndAssessment(): Promise<{
  readonly cookie: string;
  readonly assessmentId: string;
}> {
  const { cookie } = await createTestSession();
  const { assessmentId } = await createTestAssessment(cookie);
  return { cookie, assessmentId };
}

export function getCookieFromResponse(response: Response): string {
  const setCookie = response.headers.get('set-cookie');

  if (setCookie === null) {
    throw new Error('Expected a Set-Cookie response header.');
  }

  const cookiePair = setCookie.split(';', 1)[0];

  if (cookiePair === undefined || !cookiePair.startsWith(`${getSessionCookieName()}=`)) {
    throw new Error('Expected the health session cookie.');
  }

  return cookiePair;
}

export function getRawCookieToken(cookie: string): string {
  return cookie.slice(cookie.indexOf('=') + 1);
}

export function randomAssessmentId(): string {
  return randomUUID();
}
