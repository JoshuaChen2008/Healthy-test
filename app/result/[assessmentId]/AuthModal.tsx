'use client';

import { useEffect, useState } from 'react';

type AuthMode = 'signup' | 'login';

interface AuthModalProps {
  readonly isOpen: boolean;
  readonly initialMode?: AuthMode;
  readonly onClose: () => void;
  readonly onSuccess: () => Promise<void>;
}

export function AuthModal({
  isOpen,
  initialMode = 'signup',
  onClose,
  onSuccess,
}: AuthModalProps): React.ReactElement | null {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        if (mode === 'signup' && response.status === 409) {
          setMode('login');
          setError('这个邮箱已经注册，我们已为你切换到登录。');
          return;
        }

        setError(body.error ?? '操作失败，请重试。');
        return;
      }

      await onSuccess();
    } catch {
      setError('网络连接不稳定，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isSubmitting) {
        onClose();
      }
    }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" aria-label="关闭" disabled={isSubmitting} onClick={onClose}>
          <CloseIcon />
        </button>
        <span className="modal-icon"><LockIcon /></span>
        <h2 id="auth-title">把结果安全保存到账号</h2>
        <p>登录后，你可以在其他设备上通过这条结果链接继续查看。</p>

        <div className="auth-tabs" role="tablist" aria-label="账号操作">
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(undefined); }}>注册</button>
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(undefined); }}>登录</button>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="auth-email">邮箱</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoFocus />
          <label htmlFor="auth-password">密码</label>
          <input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" />
          {error !== undefined && <p className="field-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '正在处理…' : mode === 'signup' ? '注册并解锁' : '登录并解锁'}
          </button>
        </form>
        <small>继续即表示你理解：当前付费为产品演示，不会产生真实扣款。</small>
      </section>
    </div>
  );
}

function CloseIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function LockIcon(): React.ReactElement {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}
