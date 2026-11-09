'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toErrorMessage } from '@/shared/lib/api-client';
import { useResource } from '@/shared/lib/use-resource';
import { useToast } from '@/shared/ui/Toast';
import { adminInvestorsRepo } from '../data/admin-investors.repo';
import {
  EMPTY_INVESTOR_FORM,
  filterInvestors,
  validateNewInvestor,
  type InviteResult,
  type NewInvestorErrors,
  type NewInvestorForm
} from '../model/admin-investors.model';

export function useAdminInvestorsViewModel() {
  const toast = useToast();
  const investors = useResource(adminInvestorsRepo.list, 'investors');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedNotes = useResource(() => adminInvestorsRepo.notesFor(selectedId ?? ''), selectedId);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<NewInvestorForm>(EMPTY_INVESTOR_FORM);
  const [formErrors, setFormErrors] = useState<NewInvestorErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [resent, setResent] = useState<InviteResult | null>(null);
  const [resending, setResending] = useState(false);

  const all = useMemo(() => investors.data ?? [], [investors.data]);
  const rows = useMemo(() => filterInvestors(all, query), [all, query]);
  const selected = all.find(row => row.id === selectedId) ?? null;

  useEffect(() => {
    setResent(null);
    setCopied(false);
  }, [selectedId]);

  const updateField = <K extends keyof NewInvestorForm>(field: K, value: NewInvestorForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setFormErrors(current => ({ ...current, [field]: undefined }));
  };

  const openCreate = () => {
    setForm(EMPTY_INVESTOR_FORM);
    setFormErrors({});
    setCreateError(null);
    setInvite(null);
    setCopied(false);
    setCreateOpen(true);
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateNewInvestor(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    setCreateError(null);
    try {
      const result = await adminInvestorsRepo.create(form);
      setInvite({ name: result.profile.fullName, email: result.profile.email, link: result.inviteLink, emailSent: result.emailSent });
      investors.reload();
      toast(result.emailSent ? `Invite emailed to ${result.profile.email}` : `${result.profile.fullName} was added`);
    } catch (error) {
      setCreateError(toErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const resendInvite = async () => {
    if (!selected) return;
    setResending(true);
    try {
      const result = await adminInvestorsRepo.resendInvite(selected.id);
      setResent({ name: result.profile.fullName, email: result.profile.email, link: result.inviteLink, emailSent: result.emailSent });
      setCopied(false);
      toast(result.emailSent ? `New invite emailed to ${result.profile.email}` : 'New invite link created');
    } catch (error) {
      toast(toErrorMessage(error), 'error');
    } finally {
      setResending(false);
    }
  };

  const copyLink = async (link: string | undefined) => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      toast('Copy failed. Select the link and copy it manually.', 'error');
    }
  };

  return {
    status: investors.status,
    error: investors.error,
    retry: investors.reload,
    total: all.length,
    rows,
    query,
    setQuery,
    selected,
    selectedNotes: selectedNotes.data ?? [],
    selectedNotesStatus: selectedNotes.status,
    openInvestor: (id: string) => setSelectedId(id),
    closeInvestor: () => setSelectedId(null),
    createOpen,
    openCreate,
    closeCreate: () => setCreateOpen(false),
    form,
    updateField,
    formErrors,
    createError,
    creating,
    submitCreate,
    invite,
    copied,
    copyInvite: () => copyLink(invite?.link),
    resent,
    resending,
    resendInvite,
    copyResent: () => copyLink(resent?.link)
  };
}
