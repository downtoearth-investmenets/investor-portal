import { notesRepo } from '@/features/notes';
import type { InvestorSummary } from '@/features/portfolio';
import { apiFetch } from '@/shared/lib/api-client';
import type { InvestorProfile } from '../model/investor-detail.model';

const enc = encodeURIComponent;

export const investorDetailRepo = {
  roster: () => apiFetch<InvestorProfile[]>('/portfolio/investors'),
  summary: (id: string) => apiFetch<InvestorSummary>(`/portfolio/investors/${enc(id)}`),
  notes: (id: string) => notesRepo.list({ investorId: id }),
  resendInvite: (id: string) =>
    apiFetch<{ inviteLink: string; emailSent: boolean; profile: { email: string } }>(`/users/investors/${enc(id)}/invite`, { method: 'POST' })
};

