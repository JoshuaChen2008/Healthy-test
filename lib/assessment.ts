import type { Prisma } from '@prisma/client';

import type { UpdateAssessmentInput } from '@/lib/validation';

export const ASSESSMENT_PUBLIC_SELECT = {
  id: true,
  gender: true,
  goal: true,
  age: true,
  heightCm: true,
  weightKg: true,
  targetWeightKg: true,
  workoutFrequency: true,
  currentStep: true,
  status: true,
} as const satisfies Prisma.AssessmentSelect;

const ORDERED_FIELDS = [
  'gender',
  'goal',
  'age',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'workoutFrequency',
] as const;

type ProgressFields = {
  readonly [Field in (typeof ORDERED_FIELDS)[number]]:
    | UpdateAssessmentInput[Field]
    | null;
};

/** Derives progress from contiguous persisted answers instead of trusting the client. */
export function getDerivedCurrentStep(fields: ProgressFields): number {
  const firstMissingIndex = ORDERED_FIELDS.findIndex(
    (field) => fields[field] === null || fields[field] === undefined,
  );

  return firstMissingIndex < 0 ? ORDERED_FIELDS.length : firstMissingIndex;
}
