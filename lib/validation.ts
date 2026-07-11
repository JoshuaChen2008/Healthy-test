import { z } from 'zod';

export const uuidSchema = z.uuid('id must be a valid UUID');

export const routeIdParamsSchema = z.strictObject({
  id: uuidSchema,
});

export const emptyBodySchema = z.strictObject({});

export const createAssessmentSchema = z.strictObject({
  restart: z.boolean().optional(),
});

export const genderSchema = z.enum(['male', 'female', 'other']);

export const goalSchema = z.enum([
  'lose_weight',
  'build_muscle',
  'improve_fitness',
  'improve_health',
]);

export const workoutFrequencySchema = z.enum([
  'never',
  'rarely',
  'few_times_week',
  'often',
  'daily',
]);

const passwordSchema = z.string().superRefine((password, context) => {
  const characterCount = Array.from(password).length;

  if (characterCount < 8) {
    context.addIssue({
      code: 'custom',
      message: 'password must contain at least 8 characters',
    });
  }

  if (characterCount > 128) {
    context.addIssue({
      code: 'custom',
      message: 'password must contain at most 128 characters',
    });
  }
});

export const authCredentialsSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email('email must be valid')),
  password: passwordSchema,
});

export const updateAssessmentSchema = z.strictObject({
  currentStep: z.int().min(0).max(7).optional(),
  gender: genderSchema.optional(),
  goal: goalSchema.optional(),
  age: z.int().min(10).max(100).optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  targetWeightKg: z.number().min(20).max(400).optional(),
  workoutFrequency: workoutFrequencySchema.optional(),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

/** Returns the first Zod issue as a compact API error message. */
export function getValidationErrorMessage(error: z.ZodError): string {
  const issue = error.issues[0];

  if (issue === undefined) {
    return 'Invalid input.';
  }

  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  return `${path}${issue.message}`;
}
