'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { nextInstallment, type Note } from '@/features/notes';
import { toErrorMessage } from '@/shared/lib/api-client';
import { formatDate, formatRate } from '@/shared/lib/format';
import { useResource } from '@/shared/lib/use-resource';
import { useToast } from '@/shared/ui/Toast';
import { adminLoansRepo } from '../data/admin-loans.repo';
import {
  emptyNoteForm,
  emptyPaymentForm,
  emptyRateChange,
  filterNotes,
  previewMonthlyPayment,
  previewRateChange,
  rateStartOptions,
  shortfall,
  toCreatePayload,
  toPaymentPayload,
  toRateChangePayload,
  validateNoteForm,
  validatePaymentForm,
  validateRateChange,
  type NewNoteErrors,
  type NewNoteForm,
  type PaymentErrors,
  type PaymentForm,
  type RateChangeErrors,
  type RateChangeForm
} from '../model/admin-loans.model';

export function useAdminLoansViewModel() {
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const notes = useResource(adminLoansRepo.list, 'notes');
  const investors = useResource(adminLoansRepo.investors, 'investors');
  const [query, setQuery] = useState('');

  const list = useMemo(() => notes.data ?? [], [notes.data]);
  const rows = useMemo(() => filterNotes(list, query), [list, query]);
  const totalPrincipal = list.reduce((total, note) => total + note.principalAmount, 0);
  const lateCount = list.filter(note => note.status === 'delinquent').length;

  const selectedId = searchParams.get('note');
  const createOpen = searchParams.get('new') === '1';
  const selected = list.find(note => note.id === selectedId) ?? null;

  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(changes).forEach(([key, value]) => (value === null ? next.delete(key) : next.set(key, value)));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const replaceNote = (loan: Note) => notes.mutate(current => current?.map(note => (note.id === loan.id ? loan : note)) ?? current);

  // ---------- rate change ----------
  const [rateOpen, setRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState<RateChangeForm>({ rate: '', startsWith: '', reason: '' });
  const [rateErrors, setRateErrors] = useState<RateChangeErrors>({});
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateSaving, setRateSaving] = useState(false);

  const startRateChange = (note: Note | null = selected) => {
    if (!note) return;
    setRateForm(emptyRateChange(note));
    setRateErrors({});
    setRateError(null);
    setRateOpen(true);
    setPaymentOpen(false);
  };

  const updateRateField = <K extends keyof RateChangeForm>(field: K, value: RateChangeForm[K]) => {
    setRateForm(current => ({ ...current, [field]: value }));
    setRateErrors(current => ({ ...current, [field]: undefined }));
    setRateError(null);
  };

  const saveRateChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const errors = validateRateChange(rateForm, selected);
    setRateErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setRateSaving(true);
    setRateError(null);
    try {
      const result = await adminLoansRepo.changeRate(selected.id, toRateChangePayload(rateForm, selected));
      replaceNote(result.loan);
      setRateOpen(false);
      const who = result.loan.investorName || 'The investor';
      toast(
        result.investorNotified
          ? `Rate is ${formatRate(result.change.rate)} from ${formatDate(result.change.firstAffectedDueDate)}. ${who} was emailed.`
          : `Rate is ${formatRate(result.change.rate)} from ${formatDate(result.change.firstAffectedDueDate)}. Email isn't set up, so let ${who} know.`
      );
    } catch (err) {
      setRateError(toErrorMessage(err));
    } finally {
      setRateSaving(false);
    }
  };

  // ---------- payments ----------
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(() => emptyPaymentForm(null));
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const selectedNextNumber = selected ? nextInstallment(selected)?.installmentNumber : undefined;
  useEffect(() => {
    setPaymentForm(emptyPaymentForm(selected));
    setPaymentErrors({});
    setPaymentError(null);
    // Reset when a different note or installment is shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selectedNextNumber]);

  const updatePaymentField = <K extends keyof PaymentForm>(field: K, value: PaymentForm[K]) => {
    setPaymentForm(current => ({ ...current, [field]: value }));
    setPaymentErrors(current => ({ ...current, [field]: undefined }));
    setPaymentError(null);
  };

  const recordPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const errors = validatePaymentForm(paymentForm);
    setPaymentErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPaymentSaving(true);
    setPaymentError(null);
    try {
      const { loan, payment } = await adminLoansRepo.recordPayment(selected.id, toPaymentPayload(paymentForm, selected));
      replaceNote(loan);
      setPaymentOpen(false);
      toast(`Payment #${payment.installmentNumber} recorded`);
    } catch (err) {
      setPaymentError(toErrorMessage(err));
    } finally {
      setPaymentSaving(false);
    }
  };

  const undoLastPayment = async () => {
    const last = selected?.lastPayment;
    if (!selected || !last) return;
    setUndoing(true);
    try {
      const { loan } = await adminLoansRepo.undoPayment(selected.id, last.id);
      replaceNote(loan);
      toast(`Payment #${last.installmentNumber} undone`);
    } catch (err) {
      toast(toErrorMessage(err));
    } finally {
      setUndoing(false);
    }
  };

  // ---------- drawer ----------
  const openNote = (id: string, options: { changeRate?: boolean } = {}) => {
    setPaymentOpen(false);
    setRateOpen(false);
    if (options.changeRate) startRateChange(list.find(note => note.id === id) ?? null);
    setParams({ note: id });
  };

  const closeNote = () => {
    setRateOpen(false);
    setPaymentOpen(false);
    setParams({ note: null });
  };

  // ---------- new note ----------
  const [form, setForm] = useState<NewNoteForm>(() => emptyNoteForm());
  const [formErrors, setFormErrors] = useState<NewNoteErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const firstInvestorId = investors.data?.[0]?.id ?? '';

  useEffect(() => {
    if (!createOpen) return;
    setForm(emptyNoteForm(firstInvestorId));
    setFormErrors({});
    setCreateError(null);
    // Reset only when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOpen]);

  useEffect(() => {
    if (firstInvestorId) setForm(current => (current.investorId ? current : { ...current, investorId: firstInvestorId }));
  }, [firstInvestorId]);

  const updateField = <K extends keyof NewNoteForm>(field: K, value: NewNoteForm[K]) => {
    setForm(current => ({ ...current, [field]: value }));
    setFormErrors(current => ({ ...current, [field]: undefined }));
  };

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateNoteForm(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    setCreateError(null);
    try {
      const investorName = investors.data?.find(option => option.id === form.investorId)?.fullName ?? '';
      const { loan } = await adminLoansRepo.create(toCreatePayload(form, investorName));
      notes.mutate(current => [loan, ...(current ?? [])]);
      toast(`${loan.loanNumber} created`);
      setParams({ new: null, note: loan.id });
    } catch (err) {
      setCreateError(toErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return {
    status: notes.status,
    error: notes.error,
    retry: notes.reload,
    total: list.length,
    totalPrincipal,
    lateCount,
    rows,
    query,
    setQuery,
    selected,
    nextDue: selected ? nextInstallment(selected) : null,
    openNote,
    closeNote,

    rateOpen,
    rateForm,
    rateErrors,
    rateError,
    rateSaving,
    rateOptions: selected ? rateStartOptions(selected) : [],
    ratePreview: selected ? previewRateChange(rateForm, selected) : null,
    startRateChange: () => startRateChange(),
    cancelRateChange: () => setRateOpen(false),
    updateRateField,
    saveRateChange,

    paymentOpen,
    openPayment: () => {
      setRateOpen(false);
      setPaymentOpen(true);
    },
    cancelPayment: () => setPaymentOpen(false),
    paymentForm,
    paymentErrors,
    paymentError,
    paymentSaving,
    paymentShortfall: selected ? shortfall(paymentForm, selected) : 0,
    updatePaymentField,
    recordPayment,
    undoLastPayment,
    undoing,

    createOpen,
    openCreate: () => setParams({ new: '1', note: null }),
    closeCreate: () => setParams({ new: null }),
    investorOptions: investors.data ?? [],
    investorsStatus: investors.status,
    form,
    updateField,
    formErrors,
    createError,
    creating,
    submitCreate,
    monthlyPreview: previewMonthlyPayment(form)
  };
}

