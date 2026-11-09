'use client';

import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { AuthShell } from '../../views/AuthShell';
import { useAuthForgotPasswordViewModel } from '../view-models/use-auth-forgot-password.vm';

export function AuthForgotPasswordView() {
  const vm = useAuthForgotPasswordViewModel();

  return (
    <AuthShell>
      <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to sign in
      </Link>

      {vm.status === 'sent' ? (
        <div className="animate-pop-in">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sage-50 text-sage-700">
            <MailCheck className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm text-muted">{vm.message} The link works for 1 hour.</p>

          {vm.previewLink && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
              <p className="font-medium text-amber-900">Email isn&apos;t set up on this server yet.</p>
              <a href={vm.previewLink} className="mt-1 inline-block font-medium text-sage-700 underline">
                Open the reset link
              </a>
            </div>
          )}

          <button type="button" onClick={vm.startOver} className={buttonClasses('secondary', 'md', 'mt-8 w-full')}>
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-3 text-sm text-muted">Enter the email you sign in with and we&apos;ll send a link to choose a new password.</p>
          <form className="mt-8 space-y-5" noValidate onSubmit={vm.submit}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              value={vm.email}
              onChange={event => vm.setEmail(event.target.value)}
              error={vm.fieldError}
            />
            {vm.error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {vm.error}
              </div>
            )}
            <Button type="submit" className="w-full" loading={vm.status === 'sending'}>
              Send reset link
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

