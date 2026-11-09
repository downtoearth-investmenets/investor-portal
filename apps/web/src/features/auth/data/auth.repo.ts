import { apiFetch } from '@/shared/lib/api-client';
import type { LinkDetails, LinkPurpose } from '../model/link.model';

export const authRepo = {
  requestReset: (email: string) =>
    apiFetch<{ message: string; previewLink?: string }>('/users/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
      auth: false
    }),
  lookupLink: (purpose: LinkPurpose, token: string) =>
    apiFetch<LinkDetails>(`/users/links/${purpose}/${encodeURIComponent(token)}`, { auth: false })
};

