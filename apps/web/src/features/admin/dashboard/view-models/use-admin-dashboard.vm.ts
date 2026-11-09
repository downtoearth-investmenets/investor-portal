'use client';

import { useMemo } from 'react';
import { useResource } from '@/shared/lib/use-resource';
import { adminDashboardRepo } from '../data/admin-dashboard.repo';
import { allocationSlices, collectedRatio } from '../model/admin-dashboard.model';

export function useAdminDashboardViewModel() {
  const overview = useResource(adminDashboardRepo.overview, 'overview');
  const data = overview.data;

  return {
    status: overview.status,
    error: overview.error,
    retry: overview.reload,
    overview: data,
    today: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()),
    collected: data ? collectedRatio(data) : 0,
    allocation: useMemo(() => allocationSlices(data?.allocation ?? []), [data])
  };
}

