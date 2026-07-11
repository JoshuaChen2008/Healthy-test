'use client';

import { useCallback, useEffect, useState } from 'react';

interface AccountStatusProps {
  readonly guestLabel?: string;
}

type AccountState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'guest' }
  | { readonly kind: 'account'; readonly email: string };

export function AccountStatus({
  guestLabel = '访客进度会安全保存在当前浏览器',
}: AccountStatusProps): React.ReactElement {
  const [state, setState] = useState<AccountState>({ kind: 'loading' });

  const loadAccount = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });

      if (!response.ok) {
        setState({ kind: 'guest' });
        return;
      }

      const body = (await response.json()) as { email: string };
      setState({ kind: 'account', email: body.email });
    } catch {
      setState({ kind: 'guest' });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAccount(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAccount]);

  async function handleLogout(): Promise<void> {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    if (response.ok) {
      window.location.assign('/');
    }
  }

  if (state.kind === 'loading') {
    return <span className="account-status account-status-loading">正在确认账号…</span>;
  }

  if (state.kind === 'guest') {
    return <span className="account-status">{guestLabel}</span>;
  }

  return (
    <div className="account-cluster">
      <span className="account-status account-email">{state.email}</span>
      <button className="text-button" type="button" onClick={() => void handleLogout()}>
        退出
      </button>
    </div>
  );
}
