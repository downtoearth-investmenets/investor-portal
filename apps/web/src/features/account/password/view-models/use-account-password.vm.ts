'use client';

import { useState, type FormEvent } from 'react';
import { useSession } from '@/shared/auth';
import { passwordChecklist } from '@/shared/auth/password-policy';
import { toErrorMessage } from '@/shared/lib/api-client';
import { useToast } from '@/shared/ui/Toast';
import { accountPasswordRepo } from '../data/account-password.repo';
import {
  EMPTY_CHANGE_PASSWORD,
  roleLabel,
  validateChangePassword,
  type ChangePasswordErrors,
  type ChangePasswordForm
} from '../model/account-password.model';

export function useAccountPasswordViewModel() {
  const { user } = useSession();
  const toast = useToast();
  const [form, setForm] = useState<ChangePasswordForm>(EMPTY_CHANGE_PASSWORD);
  const [errors, setErrors] = useState<ChangePasswordErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (field: keyof ChangePasswordForm, value: string) => {
    setForm(current => ({ ...current, [field]: value }));
    setErrors(current => ({ ...current, [field]: undefined }));
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateChangePassword(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      await accountPasswordRepo.change(form.current, form.next);
      setForm(EMPTY_CHANGE_PASSWORD);
      toast('Password changed. Other devices were signed out.');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return {
    status: saving ? ('saving' as const) : ('idle' as const),
    profile: [
      { label: 'Name', value: user?.fullName ?? '' },
      { label: 'Email', value: user?.email ?? '' },
      ...(user?.entityName ? [{ label: 'Trust or entity', value: user.entityName }] : []),
      { label: 'Role', value: roleLabel(user?.role) }
    ],
    form,
    update,
    errors,
    error,
    saving,
    checklist: passwordChecklist(form.next),
    submit
  };
}

