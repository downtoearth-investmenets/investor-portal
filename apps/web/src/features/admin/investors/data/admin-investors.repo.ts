import { apiFetch } from '@/shared/lib/api-client';
import { notesRepo } from '@/features/notes';
import type { InvestorRow, NewInvestorForm } from '../model/admin-investors.model';

interface InviteResponse {
  profile: { id: string; fullName: string; email: string };
  inviteLink: string;
  emailSent: boolean;
}

export const adminInvestorsRepo = {
  list: () => apiFetch<InvestorRow[]>('/portfolio/investors'),
  create: (form: NewInvestorForm) =>
    apiFetch<InviteResponse>('/users/investors', {
      method: 'POST',
      body: JSON.stringify({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        entityName: form.entityName.trim(),
        accreditedStatus: form.accredited
      })
    }),
  resendInvite: (investorId: string) =>
    apiFetch<InviteResponse>(`/users/investors/${encodeURIComponent(investorId)}/invite`, { method: 'POST' }),
  notesFor: (investorId: string) => notesRepo.list({ investorId })
};
