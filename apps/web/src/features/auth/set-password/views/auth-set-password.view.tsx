'use client';

import Link from 'next/link';
import { Eye, EyeOff, LinkIcon } from 'lucide-react';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { PasswordChecklist } from '@/shared/ui/PasswordChecklist';
import { FullPageSpinner } from '@/shared/ui/States';
import type { LinkPurpose } from '../../model/link.model';
import { AuthShell } from '../../views/AuthShell';
import { useAuthSetPasswordViewModel } from '../view-models/use-auth-set-password.vm';

export function AuthSetPasswordView({ purpose, token }: { purpose: LinkPurpose; token: string }) {
  const vm = useAuthSetPasswordViewModel(purpose, token);

  if (vm.status === 'loading' || vm.status === 'idle') return <FullPageSpinner />;

  return (
    <AuthShell>
      {vm.status === 'error' ? (
        <div className="animate-pop-in">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <LinkIcon className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Link not valid</h1>
          <p className="mt-3 text-sm text-muted">{vm.linkError}</p>
          <Link href={vm.expiredAction.href} className={buttonClasses('primary', 'md', 'mt-8 w-full')}>
            {vm.expiredAction.label}
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">{vm.title}</h1>
          <p className="mt-3 text-sm text-muted">{vm.body}</p>

          <form className="mt-8 space-y-5" noValidate onSubmit={vm.submit}>
            <TextField label="Email" type="email" value={vm.email} readOnly disabled autoComplete="username" />
            <div className="space-y-2.5">
              <TextField
                label="Password"
                type={vm.showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                autoFocus
                value={vm.password}
                onChange={event => vm.setPassword(event.target.value)}
                error={vm.fieldErrors.password}
                trailing={
                  <button
                    type="button"
                    onClick={vm.toggleShowPassword}
                    aria-label={vm.showPassword ? 'Hide password' : 'Show password'}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-ink"
                  >
                    {vm.showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />
              <PasswordChecklist items={vm.checklist} />
            </div>
            <TextField
              label="Confirm password"
              type={vm.showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={vm.confirm}
              onChange={event => vm.setConfirm(event.target.value)}
              error={vm.fieldErrors.confirm}
            />

            {vm.error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {vm.error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={vm.submitting}>
              {vm.action}
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}

