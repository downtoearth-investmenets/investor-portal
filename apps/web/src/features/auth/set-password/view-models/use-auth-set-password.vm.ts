'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { homePathFor, useSession } from '@/shared/auth';
import { passwordChecklist } from '@/shared/auth/password-policy';
import { toErrorMessage } from '@/shared/lib/api-client';
import { useResource } from '@/shared/lib/use-resource';
import { authRepo } from '../../data/auth.repo';
import type { LinkPurpose } from '../../model/link.model';
import { SET_PASSWORD_COPY, validateSetPassword, type SetPasswordErrors } from '../model/auth-set-password.model';

export function useAuthSetPasswordViewModel(purpose: LinkPurpose, token: string) {
  const router = useRouter();
  const { signInWithLink } = useSession();
  const link = useResource(() => authRepo.lookupLink(purpose, token), `${purpose}:${token}`);

  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirmValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SetPasswordErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateSetPassword({ password, confirm });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const user = await signInWithLink(purpose, token, password);
      router.replace(homePathFor(user.role));
    } catch (err) {
      setError(toErrorMessage(err));
      setSubmitting(false);
    }
  };

  const copy = SET_PASSWORD_COPY[purpose];

  return {
    status: link.status,
    linkError: link.error,
    email: link.data?.email ?? '',
    title: copy.title(link.data?.fullName ?? ''),
    body: copy.body,
    action: copy.action,
    expiredAction: copy.expiredAction,
    password,
    setPassword: (value: string) => {
      setPasswordValue(value);
      setFieldErrors(current => ({ ...current, password: undefined }));
    },
    confirm,
    setConfirm: (value: string) => {
      setConfirmValue(value);
      setFieldErrors(current => ({ ...current, confirm: undefined }));
    },
    checklist: passwordChecklist(password),
    showPassword,
    toggleShowPassword: () => setShowPassword(value => !value),
    fieldErrors,
    error,
    submitting,
    submit
  };
}

