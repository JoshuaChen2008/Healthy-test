'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AccountStatus } from '@/app/components/AccountStatus';
import { BrandMark } from '@/app/components/BrandMark';

type Gender = 'male' | 'female' | 'other';
type Goal = 'lose_weight' | 'build_muscle' | 'improve_fitness' | 'improve_health';
type WorkoutFrequency = 'never' | 'rarely' | 'few_times_week' | 'often' | 'daily';
type AssessmentField = keyof AssessmentAnswers;

interface AssessmentAnswers {
  gender: Gender | null;
  goal: Goal | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  workoutFrequency: WorkoutFrequency | null;
}

interface AssessmentPayload extends AssessmentAnswers {
  readonly id: string;
  readonly currentStep: number;
}

interface StepDefinition {
  readonly field: AssessmentField;
  readonly kicker: string;
  readonly title: string;
  readonly hint: string;
}

const STEPS: ReadonlyArray<StepDefinition> = [
  { field: 'gender', kicker: '先认识你', title: '你的生理性别是？', hint: '用于估算基础代谢参考。' },
  { field: 'goal', kicker: '确定方向', title: '你现在最想实现什么？', hint: '选择最接近你当前优先级的一项。' },
  { field: 'age', kicker: '基础信息', title: '你的年龄是？', hint: '可填写 10–100 岁。' },
  { field: 'heightCm', kicker: '基础信息', title: '你的身高是多少？', hint: '请填写 80–250 厘米。' },
  { field: 'weightKg', kicker: '了解现状', title: '你现在的体重是多少？', hint: '请填写 20–400 公斤。' },
  { field: 'targetWeightKg', kicker: '设定目标', title: '你的目标体重是多少？', hint: '目标不需要激进，真实更重要。' },
  { field: 'workoutFrequency', kicker: '最后一步', title: '你通常多久运动一次？', hint: '按最近一个月的平均情况选择。' },
];

const EMPTY_ANSWERS: AssessmentAnswers = {
  gender: null,
  goal: null,
  age: null,
  heightCm: null,
  weightKg: null,
  targetWeightKg: null,
  workoutFrequency: null,
};

export function QuizFlow(): React.ReactElement {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = useState<string>();
  const [answers, setAnswers] = useState<AssessmentAnswers>(EMPTY_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const initialize = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(undefined);

    try {
      const sessionResponse = await apiFetch('/api/session', {});

      if (!sessionResponse.ok) {
        throw new Error(await readApiError(sessionResponse));
      }

      const assessmentResponse = await apiFetch('/api/assessments', {});

      if (!assessmentResponse.ok) {
        throw new Error(await readApiError(assessmentResponse));
      }

      const assessment = (await assessmentResponse.json()) as AssessmentPayload;
      setAssessmentId(assessment.id);
      setAnswers({
        gender: assessment.gender,
        goal: assessment.goal,
        age: assessment.age,
        heightCm: assessment.heightCm,
        weightKg: assessment.weightKg,
        targetWeightKg: assessment.targetWeightKg,
        workoutFrequency: assessment.workoutFrequency,
      });
      setStepIndex(Math.min(assessment.currentStep, STEPS.length - 1));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : '暂时无法开始测评。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  }, [initialize]);

  function updateAnswer<Field extends AssessmentField>(
    field: Field,
    value: AssessmentAnswers[Field],
  ): void {
    setAnswers((current) => ({ ...current, [field]: value }));
    setError(undefined);
  }

  async function handleContinue(): Promise<void> {
    const currentStep = STEPS[stepIndex];

    if (currentStep === undefined || assessmentId === undefined) {
      return;
    }

    const value = answers[currentStep.field];

    if (value === null) {
      setError('请先完成这一题。');
      return;
    }

    setIsSaving(true);
    setError(undefined);

    try {
      const response = await fetch(`/api/assessments/${assessmentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [currentStep.field]: value }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      if (stepIndex < STEPS.length - 1) {
        setStepIndex((current) => current + 1);
        return;
      }

      const submitResponse = await apiFetch(`/api/assessments/${assessmentId}/submit`, {});

      if (!submitResponse.ok) {
        setError(await readApiError(submitResponse));
        return;
      }

      router.push(`/result/${assessmentId}`);
    } catch {
      setError('网络连接不稳定，请重试。你的输入仍然保留着。');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRestart(): Promise<void> {
    setIsSaving(true);

    try {
      const response = await apiFetch('/api/assessments', { restart: true });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const assessment = (await response.json()) as AssessmentPayload;
      setAssessmentId(assessment.id);
      setAnswers(EMPTY_ANSWERS);
      setStepIndex(0);
      setError(undefined);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <QuizLoading />;
  }

  if (assessmentId === undefined) {
    return (
      <QuizMessage
        title="暂时无法载入测评"
        message={error ?? '请检查网络后重试。'}
        onRetry={() => void initialize()}
      />
    );
  }

  const step = STEPS[stepIndex] ?? STEPS[0];
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <main className="quiz-shell">
      <header className="quiz-header">
        <BrandMark />
        <AccountStatus />
      </header>

      <section className="quiz-card" aria-live="polite">
        <div className="quiz-progress-meta">
          <span>第 {stepIndex + 1} 题</span>
          <span>{STEPS.length} 题</span>
        </div>
        <div className="quiz-progress" aria-label={`测评进度 ${Math.round(progress)}%`}>
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>

        <div className="question-heading">
          <span className="eyebrow">{step.kicker}</span>
          <h1>{step.title}</h1>
          <p>{step.hint}</p>
        </div>

        <div className="answer-area">
          <StepInput step={step} answers={answers} onChange={updateAnswer} />
          {error !== undefined && <p className="field-error" role="alert">{error}</p>}
        </div>

        <div className="quiz-actions">
          <button
            className="ghost-button"
            type="button"
            disabled={stepIndex === 0 || isSaving}
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          >
            上一步
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={isSaving}
            onClick={() => void handleContinue()}
          >
            {isSaving ? '正在保存…' : stepIndex === STEPS.length - 1 ? '查看结果' : '继续'}
            {!isSaving && <ArrowIcon />}
          </button>
        </div>
      </section>

      <button
        className="restart-button"
        type="button"
        disabled={isSaving}
        onClick={() => void handleRestart()}
      >
        重新开始这次测评
      </button>
    </main>
  );
}

interface StepInputProps {
  readonly step: StepDefinition;
  readonly answers: AssessmentAnswers;
  readonly onChange: <Field extends AssessmentField>(
    field: Field,
    value: AssessmentAnswers[Field],
  ) => void;
}

function StepInput({ step, answers, onChange }: StepInputProps): React.ReactElement {
  switch (step.field) {
    case 'gender':
      return <ChoiceGrid value={answers.gender} options={[['female', '女性'], ['male', '男性'], ['other', '其他 / 不便说明']]} onChange={(value) => onChange('gender', value as Gender)} />;
    case 'goal':
      return <ChoiceGrid value={answers.goal} options={[['lose_weight', '减轻体重'], ['build_muscle', '增加肌肉'], ['improve_fitness', '提升体能'], ['improve_health', '改善整体健康']]} onChange={(value) => onChange('goal', value as Goal)} />;
    case 'workoutFrequency':
      return <ChoiceGrid value={answers.workoutFrequency} options={[['never', '几乎不运动'], ['rarely', '每月几次'], ['few_times_week', '每周 2–3 次'], ['often', '每周 4–5 次'], ['daily', '几乎每天']]} onChange={(value) => onChange('workoutFrequency', value as WorkoutFrequency)} />;
    case 'age':
      return <NumberAnswer id="age" value={answers.age} min={10} max={100} suffix="岁" onChange={(value) => onChange('age', value)} />;
    case 'heightCm':
      return <NumberAnswer id="height" value={answers.heightCm} min={80} max={250} suffix="cm" onChange={(value) => onChange('heightCm', value)} />;
    case 'weightKg':
      return <NumberAnswer id="weight" value={answers.weightKg} min={20} max={400} step={0.1} suffix="kg" onChange={(value) => onChange('weightKg', value)} />;
    case 'targetWeightKg':
      return <NumberAnswer id="target-weight" value={answers.targetWeightKg} min={20} max={400} step={0.1} suffix="kg" onChange={(value) => onChange('targetWeightKg', value)} />;
  }
}

interface ChoiceGridProps {
  readonly value: string | null;
  readonly options: ReadonlyArray<readonly [string, string]>;
  readonly onChange: (value: string) => void;
}

function ChoiceGrid({ value, options, onChange }: ChoiceGridProps): React.ReactElement {
  return (
    <div className="choice-grid" role="radiogroup">
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          className={`choice-card${value === optionValue ? ' choice-card-selected' : ''}`}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          <span>{label}</span>
          <CheckIcon />
        </button>
      ))}
    </div>
  );
}

interface NumberAnswerProps {
  readonly id: string;
  readonly value: number | null;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly suffix: string;
  readonly onChange: (value: number | null) => void;
}

function NumberAnswer({ id, value, min, max, step = 1, suffix, onChange }: NumberAnswerProps): React.ReactElement {
  return (
    <label className="number-answer" htmlFor={id}>
      <span className="sr-only">请输入数值</span>
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={value ?? ''} autoFocus onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} />
      <span>{suffix}</span>
    </label>
  );
}

function QuizLoading(): React.ReactElement {
  return <main className="quiz-shell"><header className="quiz-header"><BrandMark /><span className="account-status">正在准备安全会话…</span></header><section className="quiz-card quiz-card-loading"><div className="skeleton skeleton-short" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-answer" /></section></main>;
}

interface QuizMessageProps {
  readonly title: string;
  readonly message: string;
  readonly onRetry: () => void;
}

function QuizMessage({ title, message, onRetry }: QuizMessageProps): React.ReactElement {
  return <main className="quiz-shell"><header className="quiz-header"><BrandMark /></header><section className="quiz-card message-card"><h1>{title}</h1><p>{message}</p><button className="primary-button" type="button" onClick={onRetry}>重新尝试</button></section></main>;
}

async function apiFetch(path: string, body: unknown): Promise<Response> {
  return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? '请求失败，请稍后重试。';
}

function CheckIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></svg>;
}

function ArrowIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
}
