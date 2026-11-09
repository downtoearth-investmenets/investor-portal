import { apiFetch } from '@/shared/lib/api-client';
import type { AdminOverview } from '../model/admin-dashboard.model';

export const adminDashboardRepo = {
  overview: () => apiFetch<AdminOverview>('/portfolio/admin-overview')
};
