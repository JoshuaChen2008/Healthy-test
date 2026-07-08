import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { POST as createAssessmentRoute } from "@/app/api/assessments/route";
import {
  GET as getAssessmentRoute,
  PATCH as patchAssessmentRoute,
} from "@/app/api/assessments/[id]/route";
import { GET as getResultRoute } from "@/app/api/assessments/[id]/result/route";
import { POST as submitAssessmentRoute } from "@/app/api/assessments/[id]/submit/route";
import { POST as payRoute } from "@/app/api/pay/route";
import { POST as createSessionRoute } from "@/app/api/session/route";

export const fullAssessmentInput = {
  currentStep: 7,
  gender: "male",
  goal: "lose_weight",
  age: 30,
  heightCm: 175,
  weightKg: 80,
  targetWeightKg: 70,
  workoutFrequency: "few_times_week",
  email: "alex@example.com",
  name: "Alex",
  answers: {
    sleep_hours: "6_7",
    target_areas: ["belly"],
  },
} as const;

export async function resetDb() {
  await prisma.assessment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();
}

export function jsonRequest(pathname: string, method: string, body?: unknown) {
  return new Request(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeContext(id: string) {
  return {
    params: Promise.resolve({ id }),
  };
}

export async function responseJson<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function createTestSession() {
  const response = await createSessionRoute(jsonRequest("/api/session", "POST"));
  const body = await responseJson<{ userId: string }>(response);

  return {
    response,
    userId: body.userId,
  };
}

export async function createTestAssessment(userId: string) {
  const response = await createAssessmentRoute(
    jsonRequest("/api/assessments", "POST", { userId }),
  );
  const body = await responseJson<{ assessmentId: string }>(response);

  return {
    response,
    assessmentId: body.assessmentId,
  };
}

export async function patchAssessment(id: string, body: unknown) {
  return patchAssessmentRoute(
    jsonRequest(`/api/assessments/${id}`, "PATCH", body),
    routeContext(id),
  );
}

export async function getAssessment(id: string) {
  return getAssessmentRoute(
    jsonRequest(`/api/assessments/${id}`, "GET"),
    routeContext(id),
  );
}

export async function submitAssessment(id: string) {
  return submitAssessmentRoute(
    jsonRequest(`/api/assessments/${id}/submit`, "POST"),
    routeContext(id),
  );
}

export async function getResult(id: string) {
  return getResultRoute(
    jsonRequest(`/api/assessments/${id}/result`, "GET"),
    routeContext(id),
  );
}

export async function payUser(userId: string) {
  return payRoute(jsonRequest("/api/pay", "POST", { userId }));
}

export async function createSessionAndAssessment() {
  const { userId } = await createTestSession();
  const { assessmentId } = await createTestAssessment(userId);

  return { userId, assessmentId };
}

export function randomAssessmentId() {
  return randomUUID();
}
