'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { AccountStatus } from '@/app/components/AccountStatus';
import { BrandMark } from '@/app/components/BrandMark';
import { AuthModal } from '@/app/result/[assessmentId]/AuthModal';

interface ResultViewProps {
  readonly assessmentId: string;
}

interface ResultPayload {
  readonly membership: 'free' | 'active';
  readonly bmi: number;
  readonly recommendedCalories: number;
  readonly targetDate?: string;
  readonly upsell?: string;
}

type ViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'auth-required' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly result: ResultPayload };

export function ResultView({ assessmentId }: ResultViewProps): React.ReactElement {
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const loadResult = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });

    try {
      const response = await fetch(`/api/assessments/${assessmentId}/result`, {
        cache: 'no-store',
      });

      if (response.status === 401) {
        setState({ kind: 'auth-required' });
        return;
      }

      if (response.status === 404) {
        setState({ kind: 'not-found' });
        return;
      }

      if (response.status === 409) {
        setState({ kind: 'incomplete' });
        return;
      }

      if (!response.ok) {
        throw new Error('结果暂时无法载入，请稍后再试。');
      }

      const result = (await response.json()) as ResultPayload;
      setState({ kind: 'ready', result });
    } catch (caught: unknown) {
      setState({
        kind: 'error',
        message: caught instanceof Error ? caught.message : '结果暂时无法载入。',
      });
    }
  }, [assessmentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadResult(), 0);
    return () => window.clearTimeout(timer);
  }, [loadResult]);

  async function unlockResult(): Promise<void> {
    setIsUnlocking(true);

    try {
      const accountResponse = await fetch('/api/auth/me', { cache: 'no-store' });

      if (!accountResponse.ok) {
        setIsAuthOpen(true);
        return;
      }

      await payAndRefresh();
    } catch {
      setState({ kind: 'error', message: '网络连接不稳定，请稍后重试。' });
    } finally {
      setIsUnlocking(false);
    }
  }

  async function payAndRefresh(): Promise<void> {
    const response = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    if (!response.ok) {
      setState({ kind: 'error', message: '模拟解锁失败，请重试。' });
      setIsAuthOpen(false);
      return;
    }

    setIsAuthOpen(false);
    await loadResult();
  }

  return (
    <main className="result-shell">
      <header className="result-header">
        <BrandMark />
        <AccountStatus guestLabel="结果尚未绑定账号" />
      </header>

      {state.kind === 'loading' && <ResultLoading />}
      {state.kind === 'auth-required' && (
        <StateCard icon={<LockIcon />} title="请先确认你的身份" message="登录原账号后即可安全查看这份结果。">
          <button className="primary-button" type="button" onClick={() => setIsAuthOpen(true)}>登录或注册</button>
        </StateCard>
      )}
      {state.kind === 'not-found' && (
        <StateCard icon={<SearchIcon />} title="找不到这份结果" message="链接可能无效，或者它不属于当前账号。">
          <Link className="primary-button" href="/quiz">开始新的测评</Link>
        </StateCard>
      )}
      {state.kind === 'incomplete' && (
        <StateCard icon={<ProgressIcon />} title="这次测评还没完成" message="返回测评，系统会从已保存的位置继续。">
          <Link className="primary-button" href="/quiz">继续填写</Link>
        </StateCard>
      )}
      {state.kind === 'error' && (
        <StateCard icon={<WarningIcon />} title="暂时出了点问题" message={state.message}>
          <button className="primary-button" type="button" onClick={() => void loadResult()}>重新加载</button>
        </StateCard>
      )}
      {state.kind === 'ready' && (
        <ResultContent result={state.result} isUnlocking={isUnlocking} onUnlock={() => void unlockResult()} />
      )}

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={payAndRefresh}
      />
    </main>
  );
}

interface ResultContentProps {
  readonly result: ResultPayload;
  readonly isUnlocking: boolean;
  readonly onUnlock: () => void;
}

function ResultContent({ result, isUnlocking, onUnlock }: ResultContentProps): React.ReactElement {
  const bmiLabel = getBmiLabel(result.bmi);

  return (
    <div className="result-content">
      <section className="result-intro">
        <span className="success-mark"><CheckIcon /></span>
        <span className="eyebrow">测评已完成</span>
        <h1>这是你现在的健康起点</h1>
        <p>这些数字不是评判，而是帮助你做出下一步选择的参考。</p>
      </section>

      <section className="metrics-grid" aria-label="测评关键结果">
        <article className="metric-card metric-card-primary">
          <span>BMI 参考</span>
          <strong>{result.bmi.toFixed(1)}</strong>
          <small>{bmiLabel}</small>
          <div className="bmi-scale" aria-hidden="true"><span style={{ left: `${getBmiPosition(result.bmi)}%` }} /></div>
        </article>
        <article className="metric-card">
          <span>每日热量参考</span>
          <strong>{result.recommendedCalories.toLocaleString('zh-CN')}</strong>
          <small>千卡 / 天</small>
          <p>根据你的基础信息、目标和活动频率估算。</p>
        </article>
        <article className={`metric-card target-card${result.membership === 'free' ? ' target-card-locked' : ''}`}>
          <span>目标日期参考</span>
          {result.targetDate !== undefined ? (
            <><strong className="target-date">{formatDate(result.targetDate)}</strong><small>按温和节奏估算</small></>
          ) : (
            <><span className="lock-badge"><LockIcon /></span><strong className="blurred-date" aria-hidden="true">2026年12月18日</strong><small>注册并解锁后查看</small></>
          )}
        </article>
      </section>

      {result.membership === 'free' ? (
        <section className="unlock-card">
          <div><span className="eyebrow">保存完整方向</span><h2>解锁你的目标日期</h2><p>{result.upsell}</p></div>
          <button className="primary-button primary-button-large" type="button" disabled={isUnlocking} onClick={onUnlock}>{isUnlocking ? '正在确认…' : '模拟解锁完整结果'} <ArrowIcon /></button>
          <small>演示环境，不会发生真实扣款</small>
        </section>
      ) : (
        <section className="member-note"><CheckIcon /><div><strong>完整结果已保存到你的账号</strong><p>在其他设备登录后，通过这条结果链接仍可查看。</p></div></section>
      )}

      <div className="result-footer-actions"><Link className="ghost-button" href="/quiz">再测一次</Link><Link className="text-link" href="/">返回首页</Link></div>
      <p className="medical-note">本测评仅提供一般健康参考，不构成医学诊断或治疗建议。</p>
    </div>
  );
}

interface StateCardProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly message: string;
  readonly children: React.ReactNode;
}

function StateCard({ icon, title, message, children }: StateCardProps): React.ReactElement {
  return <section className="state-card"><span className="state-icon">{icon}</span><h1>{title}</h1><p>{message}</p>{children}</section>;
}

function ResultLoading(): React.ReactElement {
  return <section className="result-loading"><div className="skeleton skeleton-short" /><div className="skeleton skeleton-title" /><div className="metrics-grid"><div className="skeleton skeleton-metric" /><div className="skeleton skeleton-metric" /><div className="skeleton skeleton-metric" /></div></section>;
}

function getBmiLabel(bmi: number): string {
  if (bmi < 18.5) return '偏低区间';
  if (bmi < 24) return '常见健康区间';
  if (bmi < 28) return '偏高区间';
  return '较高区间';
}

function getBmiPosition(bmi: number): number {
  return Math.min(96, Math.max(4, ((bmi - 15) / 20) * 100));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

function CheckIcon(): React.ReactElement { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 12 4 4 8-9" /></svg>; }
function LockIcon(): React.ReactElement { return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>; }
function SearchIcon(): React.ReactElement { return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg>; }
function ProgressIcon(): React.ReactElement { return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>; }
function WarningIcon(): React.ReactElement { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 9 17H3L12 3Z" /><path d="M12 9v5m0 3h.01" /></svg>; }
function ArrowIcon(): React.ReactElement { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>; }
