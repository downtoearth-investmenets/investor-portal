import { apiFetch } from '@/shared/lib/api-client';
import { notesRepo, type Note, type PaymentRecord } from '@/features/notes';
import type { CreateNotePayload, InvestorOption, PaymentPayload, RateChangePayload } from '../model/admin-loans.model';

export interface RateChangeResult {
  loan: Note;
  change: { previousRate: number; rate: number; firstAffectedDueDate: string; newPaymentAmount: number };
  investorNotified: boolean;
}

const notePath = (id: string) => `/loans/${encodeURIComponent(id)}`;

export const adminLoansRepo = {
  list: () => notesRepo.list(),
  investors: async (): Promise<InvestorOption[]> => {
    const rows = await apiFetch<InvestorOption[]>('/users/investors');
    return rows.map(({ id, fullName, entityName }) => ({ id, fullName, entityName }));
  },
  create: (payload: CreateNotePayload) => apiFetch<{ loan: Note }>('/loans', { method: 'POST', body: JSON.stringify(payload) }),
  changeRate: (id: string, payload: RateChangePayload) =>
    apiFetch<RateChangeResult>(`${notePath(id)}/rate`, { method: 'PATCH', body: JSON.stringify(payload) }),
  recordPayment: (id: string, payload: PaymentPayload) =>
    apiFetch<{ loan: Note; payment: PaymentRecord }>(`${notePath(id)}/payments`, { method: 'POST', body: JSON.stringify(payload) }),
  undoPayment: (id: string, paymentId: number) =>
    apiFetch<{ loan: Note }>(`${notePath(id)}/payments/${paymentId}`, { method: 'DELETE' })
};

