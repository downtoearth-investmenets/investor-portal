'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { homePathFor, useSession } from '@/shared/auth';
import { toErrorMessage } from '@/shared/lib/api-client';
import { validateLogin, type LoginErrors } from '../model/auth-login.model';

export function useAuthLoginViewModel() {
  const { signIn, status: sessionStatus, user } = useSession();
  const router = useRouter();

  const [email, setEmailValue] = useState('');
  const [password, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionStatus === 'authenticated' && user) router.replace(homePathFor(user.role));
  }, [sessionStatus, user, router]);

  const setEmail = (value: string) => {
    setEmailValue(value);
    setFieldErrors(current => ({ ...current, email: undefined }));
  };

  const setPassword = (value: string) => {
    setPasswordValue(value);
    setFieldErrors(current => ({ ...current, password: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const signedIn = await signIn(email.trim(), password);
      router.replace(homePathFor(signedIn.role));
    } catch (err) {
      setError(toErrorMessage(err));
      setSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    toggleShowPassword: () => setShowPassword(value => !value),
    fieldErrors,
    error,
    submitting,
    submit
  };
}
