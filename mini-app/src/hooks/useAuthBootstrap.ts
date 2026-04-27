import { useEffect, useRef } from 'react';
import { authApi, AUTH_TOKEN_STORAGE_KEY, usersApi } from '../api';
import { useAppStore } from '../store/appStore';

/**
 * Runs once on app mount. Exchanges the Telegram `initData` payload for a
 * backend JWT (if there is no valid token yet), then fetches the canonical
 * User row via `/users/me`. Result is stashed in the zustand store so any
 * component can read `user` / `authStatus` directly.
 *
 * Failure modes surface via `authStatus === 'error'` and `authError`.
 */
export function useAuthBootstrap(): void {
  const started = useRef(false);
  const setUser = useAppStore((s) => s.setUser);
  const setAuthStatus = useAppStore((s) => s.setAuthStatus);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      setAuthStatus('pending');
      try {
        const existing = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
        if (!existing) {
          const tg = window.Telegram?.WebApp;
          const initData = tg?.initData;
          if (!initData) {
            setAuthStatus('error', 'Telegram WebApp context not available');
            return;
          }
          await authApi.loginWithTelegram(initData);
        }
        const me = await usersApi.getMe();
        setUser(me);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown authentication error';
        // Stale token is the likely cause when /users/me fails with 401; the
        // axios interceptor already cleared storage and reloaded the page.
        setAuthStatus('error', message);
      }
    })();
  }, [setUser, setAuthStatus]);
}
