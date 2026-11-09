'use client';

import { useState, type FormEvent } from 'react';
import { toErrorMessage } from '@/shared/lib/api-client';
import { authRepo } from '../../data/auth.repo';
import { validateLogin } from '../../login/model/auth-login.model';

type Status = 'idle' | 'sending' | 'sent';

export function useAuthForgotPasswordViewModel() {
  const [email, setEmailValue] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [previewLink, setPreviewLink] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = validateLogin({ email, password: 'x' }).email;
    setFieldError(problem);
    if (problem) return;

    setStatus('sending');
    setError(null);
    try {
      const result = await authRepo.requestReset(email.trim());
      setMessage(result.message);
      setPreviewLink(result.previewLink ?? null);
      setStatus('sent');
    } catch (err) {
      setError(toErrorMessage(err));
      setStatus('idle');
    }
  };

  return {
    email,
    setEmail: (value: string) => {
      setEmailValue(value);
      setFieldError(undefined);
    },
    fieldError,
    error,
    status,
    message,
    previewLink,
    submit,
    startOver: () => {
      setStatus('idle');
      setPreviewLink(null);
    }
  };
}

