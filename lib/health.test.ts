import { describe, expect, it } from 'vitest';

import { computeAssessmentResult, type HealthInput } from './health';

const fixedToday = new Date('2026-01-01T15:30:00.000Z');

const baseInput: HealthInput = {
  gender: 'male',
  goal: 'lose_weight',
  age: 30,
  heightCm: 175,
  weightKg: 80,
  targetWeightKg: 70,
  workoutFrequency: 'few_times_week',
};

describe('computeAssessmentResult', () => {
  it('computes bmi, recommended calories, and target date for a known input', () => {
    const result = computeAssessmentResult(baseInput, fixedToday);

    expect(result.bmi).toBe(26.1);
    expect(result.recommendedCalories).toBe(2211);
    expect(result.targetDate.toISOString()).toBe('2026-05-21T00:00:00.000Z');
  });

  it('uses the male, female, and other BMR offsets', () => {
    const sharedInput = {
      goal: 'improve_health',
      age: 30,
      heightCm: 160,
      weightKg: 60,
      targetWeightKg: 60,
      workoutFrequency: 'never',
    } satisfies Omit<HealthInput, 'gender'>;

    expect(
      computeAssessmentResult({ ...sharedInput, gender: 'male' }, fixedToday)
        .recommendedCalories,
    ).toBe(1746);
    expect(
      computeAssessmentResult({ ...sharedInput, gender: 'female' }, fixedToday)
        .recommendedCalories,
    ).toBe(1547);
    expect(
      computeAssessmentResult({ ...sharedInput, gender: 'other' }, fixedToday)
        .recommendedCalories,
    ).toBe(1646);
  });

  it('applies every goal calorie adjustment branch', () => {
    expect(
      computeAssessmentResult({ ...baseInput, goal: 'lose_weight' }, fixedToday)
        .recommendedCalories,
    ).toBe(2211);
    expect(
      computeAssessmentResult({ ...baseInput, goal: 'build_muscle' }, fixedToday)
        .recommendedCalories,
    ).toBe(3011);
    expect(
      computeAssessmentResult({ ...baseInput, goal: 'improve_fitness' }, fixedToday)
        .recommendedCalories,
    ).toBe(2711);
    expect(
      computeAssessmentResult({ ...baseInput, goal: 'improve_health' }, fixedToday)
        .recommendedCalories,
    ).toBe(2711);
  });

  it('enforces the calorie safety floor', () => {
    const result = computeAssessmentResult(
      {
        gender: 'female',
        goal: 'lose_weight',
        age: 100,
        heightCm: 80,
        weightKg: 20,
        targetWeightKg: 20,
        workoutFrequency: 'never',
      },
      fixedToday,
    );

    expect(result.recommendedCalories).toBe(1200);
  });

  it('predicts target dates for weight loss, weight gain, and already reached goals', () => {
    expect(
      computeAssessmentResult(
        { ...baseInput, weightKg: 80, targetWeightKg: 70 },
        fixedToday,
      ).targetDate.toISOString(),
    ).toBe('2026-05-21T00:00:00.000Z');
    expect(
      computeAssessmentResult(
        {
          ...baseInput,
          goal: 'build_muscle',
          weightKg: 70,
          targetWeightKg: 75,
        },
        fixedToday,
      ).targetDate.toISOString(),
    ).toBe('2026-05-21T00:00:00.000Z');
    expect(
      computeAssessmentResult(
        { ...baseInput, weightKg: 70, targetWeightKg: 70.4 },
        fixedToday,
      ).targetDate.toISOString(),
    ).toBe('2026-01-01T00:00:00.000Z');
  });

  it('accepts legal range endpoints without throwing', () => {
    expect(() =>
      computeAssessmentResult(
        {
          gender: 'other',
          goal: 'improve_fitness',
          age: 10,
          heightCm: 80,
          weightKg: 20,
          targetWeightKg: 20,
          workoutFrequency: 'daily',
        },
        fixedToday,
      ),
    ).not.toThrow();
    expect(() =>
      computeAssessmentResult(
        {
          gender: 'male',
          goal: 'build_muscle',
          age: 100,
          heightCm: 250,
          weightKg: 400,
          targetWeightKg: 400,
          workoutFrequency: 'never',
        },
        fixedToday,
      ),
    ).not.toThrow();
  });
});
