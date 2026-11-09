import { apiFetch } from '@/shared/lib/api-client';
import type { SessionUser, UserRole } from './types';

interface SessionResponse {
  user: { id: string; email: string; fullName: string; role: UserRole; investorProfileId?: string };
  profile: { entityName?: string } | null;
}

const toSessionUser = ({ user, profile }: SessionResponse): SessionUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  investorProfileId: user.investorProfileId,
  entityName: profile?.entityName || undefined
});

export const sessionRepo = {
  async login(email: string, password: string) {
    const response = await apiFetch<SessionResponse & { token: string }>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      auth: false
    });
    return { token: response.token, user: toSessionUser(response) };
  },

  /** Finishes an invite or password-reset link. The server signs the user in. */
  async completeLink(purpose: 'invite' | 'reset', token: string, password: string) {
    const response = await apiFetch<SessionResponse & { token: string }>(
      `/users/links/${purpose}/${encodeURIComponent(token)}`,
      { method: 'POST', body: JSON.stringify({ password }), auth: false }
    );
    return { token: response.token, user: toSessionUser(response) };
  },

  async current() {
    return toSessionUser(await apiFetch<SessionResponse>('/users/session'));
  },

  async logout(token: string) {
    await apiFetch<null>('/users/logout', {
      method: 'POST',
      auth: false,
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
