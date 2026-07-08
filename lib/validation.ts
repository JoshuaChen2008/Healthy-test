import { z } from "zod";

export const uuidSchema = z.uuid("id must be a valid UUID");

export const routeIdParamsSchema = z.strictObject({
  id: uuidSchema,
});

export const emptyBodySchema = z.strictObject({});

export const createAssessmentSchema = z.strictObject({
  userId: z.uuid("userId must be a valid UUID"),
});

export const paySchema = z.strictObject({
  userId: z.uuid("userId must be a valid UUID"),
});

export const genderSchema = z.enum(["male", "female", "other"]);

export const goalSchema = z.enum([
  "lose_weight",
  "build_muscle",
  "improve_fitness",
  "improve_health",
]);

export const workoutFrequencySchema = z.enum([
  "never",
  "rarely",
  "few_times_week",
  "often",
  "daily",
]);

export const answersSchema = z.record(z.string(), z.unknown());

export const updateAssessmentSchema = z.strictObject({
  currentStep: z.int().min(0).optional(),
  gender: genderSchema.optional(),
  goal: goalSchema.optional(),
  age: z.int().min(10).max(100).optional(),
  heightCm: z.number().min(80).max(250).optional(),
  weightKg: z.number().min(20).max(400).optional(),
  targetWeightKg: z.number().min(20).max(400).optional(),
  workoutFrequency: workoutFrequencySchema.optional(),
  email: z.email().optional(),
  name: z.string().trim().min(1).optional(),
  answers: answersSchema.optional(),
});

export type RouteIdParams = z.infer<typeof routeIdParamsSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type PayInput = z.infer<typeof paySchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

export function getValidationErrorMessage(error: z.ZodError) {
  const issue = error.issues[0];

  if (!issue) {
    return "Invalid input.";
  }

  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}
