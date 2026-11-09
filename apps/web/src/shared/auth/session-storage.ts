import type { SessionUser } from './types';

const TOKEN_KEY = 'dte.session.token';
const USER_KEY = 'dte.session.user';
const LEGACY_KEYS = ['dte_auth_token', 'dte_auth_user'];

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function readSession(): { token: string; user: SessionUser } | null {
  const store = storage();
  const token = store?.getItem(TOKEN_KEY);
  const rawUser = store?.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as SessionUser };
  } catch {
    return null;
  }
}

export function writeSession(token: string, user: SessionUser) {
  const store = storage();
  store?.setItem(TOKEN_KEY, token);
  store?.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  const store = storage();
  [TOKEN_KEY, USER_KEY, ...LEGACY_KEYS].forEach(key => store?.removeItem(key));
}
