'use client';

import { useMemo } from 'react';
import { allocationByNote, repaidShare } from '@/features/portfolio';
import { useSession } from '@/shared/auth';
import { useResource } from '@/shared/lib/use-resource';
import { investorDashboardRepo } from '../data/investor-dashboard.repo';
import { greetingFor, shortName, todayLabel } from '../model/investor-dashboard.model';

export function useInvestorDashboardViewModel() {
  const { user } = useSession();
  const summary = useResource(investorDashboardRepo.summary, 'summary');
  const notes = useResource(investorDashboardRepo.notes, 'notes');

  const failed = summary.status === 'error' || notes.status === 'error';
  const ready = summary.status === 'ready' && notes.status === 'ready';
  const name = shortName(user?.fullName ?? '');
  const list = useMemo(() => notes.data ?? [], [notes.data]);

  return {
    status: failed ? ('error' as const) : ready ? ('ready' as const) : ('loading' as const),
    error: summary.error ?? notes.error,
    retry: () => {
      summary.reload();
      notes.reload();
    },
    heading: name ? `${greetingFor(new Date())}, ${name}` : greetingFor(new Date()),
    today: todayLabel(new Date()),
    entityName: user?.entityName,
    summary: summary.data,
    repaid: summary.data ? repaidShare(summary.data) : 0,
    notes: list,
    allocation: useMemo(() => allocationByNote(list), [list])
  };
}

