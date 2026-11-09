'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { allocationByNote, repaidShare } from '@/features/portfolio';
import { toErrorMessage } from '@/shared/lib/api-client';
import { useResource } from '@/shared/lib/use-resource';
import { useToast } from '@/shared/ui/Toast';
import { investorDetailRepo } from '../data/investor-detail.repo';
import { byName, neighbours, toSwitcherItems, type InviteResult } from '../model/investor-detail.model';

export const investorPath = (id: string) => `/admin/investors/${encodeURIComponent(id)}`;

export function useInvestorDetailViewModel(id: string) {
  const router = useRouter();
  const toast = useToast();
  const roster = useResource(investorDetailRepo.roster, 'roster');
  const summary = useResource(() => investorDetailRepo.summary(id), `summary:${id}`);
  const notes = useResource(() => investorDetailRepo.notes(id), `notes:${id}`);

  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [resending, setResending] = useState(false);
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => [...(roster.data ?? [])].sort(byName), [roster.data]);
  const investor = rows.find(row => row.id === id) ?? null;
  const { previous, next } = neighbours(rows, id);
  const list = useMemo(() => notes.data ?? [], [notes.data]);

  const failed = roster.status === 'error' || summary.status === 'error' || notes.status === 'error';
  const loaded = roster.status === 'ready' && summary.status === 'ready' && notes.status === 'ready';
  const missing = roster.status === 'ready' && !investor;

  const resendInvite = async () => {
    setResending(true);
    try {
      const result = await investorDetailRepo.resendInvite(id);
      setInvite({ link: result.inviteLink, email: result.profile.email, emailSent: result.emailSent });
      setCopied(false);
      toast(result.emailSent ? `New invite emailed to ${result.profile.email}` : 'New invite link created');
    } catch (err) {
      toast(toErrorMessage(err), 'error');
    } finally {
      setResending(false);
    }
  };

  const copyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
    } catch {
      toast('Copy failed. Select the link and copy it manually.', 'error');
    }
  };

  return {
    status: missing ? ('missing' as const) : failed ? ('error' as const) : loaded ? ('ready' as const) : ('loading' as const),
    error: roster.error ?? summary.error ?? notes.error,
    retry: () => {
      roster.reload();
      summary.reload();
      notes.reload();
    },
    investor,
    switcherItems: useMemo(() => toSwitcherItems(rows), [rows]),
    rosterReady: roster.status === 'ready',
    switchTo: (nextId: string) => router.push(investorPath(nextId)),
    previous,
    next,
    summary: summary.data,
    repaid: summary.data ? repaidShare(summary.data) : 0,
    notes: list,
    allocation: useMemo(() => allocationByNote(list), [list]),
    invite,
    resending,
    resendInvite,
    copied,
    copyInvite
  };
}

