'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { notesRepo } from '@/features/notes';
import { useResource } from '@/shared/lib/use-resource';

export function useInvestorLoansViewModel() {
  const notes = useResource(() => notesRepo.list(), 'notes');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const list = useMemo(() => notes.data ?? [], [notes.data]);
  const selectedId = searchParams.get('note');
  const selected = list.find(note => note.id === selectedId) ?? null;
  const totalInvested = list.reduce((total, note) => total + note.principalAmount, 0);

  return {
    status: notes.status,
    error: notes.error,
    retry: notes.reload,
    notes: list,
    totalInvested,
    selected,
    open: (id: string) => router.replace(`${pathname}?note=${encodeURIComponent(id)}`, { scroll: false }),
    close: () => router.replace(pathname, { scroll: false })
  };
}
