'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, UNAUTHORIZED_EVENT } from '@/shared/lib/api-client';
import { clearSession, readSession, readToken, writeSession } from './session-storage';
import { sessionRepo } from './session-repo';
import type { SessionStatus, SessionUser } from './types';

interface SessionValue {
  user: SessionUser | null;
  status: SessionStatus;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signInWithLink: (purpose: 'invite' | 'reset', token: string, password: string) => Promise<SessionUser>;
  signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  const signOut = useCallback(() => {
    const token = readToken();
    clearSession();
    setUser(null);
    setStatus('anonymous');
    if (token) sessionRepo.logout(token).catch(() => undefined);
  }, []);

  useEffect(() => {
    const stored = readSession();
    if (!stored) {
      clearSession();
      setStatus('anonymous');
      return;
    }

    setUser(stored.user);
    setStatus('authenticated');

    sessionRepo
      .current()
      .then(fresh => {
        setUser(fresh);
        writeSession(stored.token, fresh);
      })
      .catch(error => {
        if (error instanceof ApiError && error.status === 401) signOut();
      });
  }, [signOut]);

  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const adopt = useCallback(({ token, user: signedIn }: { token: string; user: SessionUser }) => {
    writeSession(token, signedIn);
    setUser(signedIn);
    setStatus('authenticated');
    return signedIn;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => adopt(await sessionRepo.login(email, password)), [adopt]);

  const signInWithLink = useCallback(
    async (purpose: 'invite' | 'reset', token: string, password: string) => {
      // Drop any other signed-in account on this browser first.
      clearSession();
      return adopt(await sessionRepo.completeLink(purpose, token, password));
    },
    [adopt]
  );

  const value = useMemo(() => ({ user, status, signIn, signInWithLink, signOut }), [user, status, signIn, signInWithLink, signOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
