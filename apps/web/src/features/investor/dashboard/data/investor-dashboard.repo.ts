import { apiFetch } from '@/shared/lib/api-client';
import { notesRepo } from '@/features/notes';
import type { InvestorSummary } from '../model/investor-dashboard.model';

export const investorDashboardRepo = {
  summary: () => apiFetch<InvestorSummary>('/portfolio/me'),
  notes: () => notesRepo.list()
};
