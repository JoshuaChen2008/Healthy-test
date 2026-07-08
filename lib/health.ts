export type Gender = "male" | "female" | "other";
export type Goal = "lose_weight" | "build_muscle" | "improve_fitness" | "improve_health";
export type WorkoutFrequency = "never" | "rarely" | "few_times_week" | "often" | "daily";

export interface HealthInput {
  gender: Gender;
  goal: Goal;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  workoutFrequency: WorkoutFrequency;
}

export interface HealthResult {
  bmi: number;
  recommendedCalories: number;
  targetDate: Date;
}

const ACTIVITY_FACTORS: Record<WorkoutFrequency, number> = {
  never: 1.2,
  rarely: 1.375,
  few_times_week: 1.55,
  often: 1.725,
  daily: 1.9,
};

const GENDER_BMR_OFFSETS: Record<Gender, number> = {
  male: 5,
  female: -161,
  other: -78,
};

const GOAL_CALORIE_ADJUSTMENTS: Record<Goal, number> = {
  lose_weight: -500,
  build_muscle: 300,
  improve_fitness: 0,
  improve_health: 0,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_WEEK = 7;

export function computeAssessmentResult(input: HealthInput, today = new Date()): HealthResult {
  return {
    bmi: computeBmi(input.heightCm, input.weightKg),
    recommendedCalories: computeRecommendedCalories(input),
    targetDate: computeTargetDate(input.weightKg, input.targetWeightKg, today),
  };
}

function computeBmi(heightCm: number, weightKg: number): number {
  const heightM = heightCm / 100;
  const bmi = weightKg / heightM ** 2;

  return roundToOneDecimal(bmi);
}

function computeRecommendedCalories(input: HealthInput): number {
  // Mifflin-St Jeor BMR formula, source: Mifflin MD, St Jeor ST, 1990.
  const baseBmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  const bmr = baseBmr + GENDER_BMR_OFFSETS[input.gender];

  // Standard activity factors map workout frequency to estimated TDEE.
  const tdee = bmr * ACTIVITY_FACTORS[input.workoutFrequency];

  const adjustedCalories = tdee + GOAL_CALORIE_ADJUSTMENTS[input.goal];
  const safetyFloor = input.gender === "male" ? 1500 : 1200;

  return Math.round(Math.max(adjustedCalories, safetyFloor));
}

function computeTargetDate(weightKg: number, targetWeightKg: number, today: Date): Date {
  const diff = weightKg - targetWeightKg;
  const startDate = startOfUtcDay(today);

  if (Math.abs(diff) < 0.5) {
    return startDate;
  }

  // Weight-loss and weight-gain rates use common safe planning ranges.
  const weeklyRateKg = diff > 0 ? 0.5 : 0.25;
  const weeks = Math.ceil(Math.abs(diff) / weeklyRateKg);

  return new Date(startDate.getTime() + weeks * DAYS_PER_WEEK * MS_PER_DAY);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}
