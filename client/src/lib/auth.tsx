import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionUser } from '@quorex/shared';
import { apiFetch, setUnauthorizedHandler } from './api';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  signIn: (login: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface SessionResponse {
  user: SessionUser;
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setStatus('anonymous');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiFetch<SessionResponse>('/auth/me', { silentUnauthorized: true })
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus('anonymous');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (login: string, password: string) => {
    const data = await apiFetch<SessionResponse>('/auth/login', {
      method: 'POST',
      body: { login, password },
      silentUnauthorized: true,
    });
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    await apiFetch<void>('/auth/logout', { method: 'POST', silentUnauthorized: true });
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthState>(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit etre utilise a l'interieur de AuthProvider.");
  return context;
}
