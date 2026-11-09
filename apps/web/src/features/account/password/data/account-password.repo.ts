import { apiFetch } from '@/shared/lib/api-client';

export const accountPasswordRepo = {
  change: (currentPassword: string, newPassword: string) =>
    apiFetch<{ ok: true }>('/users/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
};

