'use client';

import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/Field';
import { PageHeader } from '@/shared/ui/PageHeader';
import { PasswordChecklist } from '@/shared/ui/PasswordChecklist';
import { useAccountPasswordViewModel } from '../view-models/use-account-password.vm';

export function AccountPasswordView() {
  const vm = useAccountPasswordViewModel();

  return (
    <>
      <PageHeader title="Account" />

      <div className="grid gap-10 lg:grid-cols-5">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Profile</h2>
          <dl className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm shadow-card">
            {vm.profile.map(item => (
              <div key={item.label} className="flex justify-between gap-6 px-5 py-3.5">
                <dt className="text-muted">{item.label}</dt>
                <dd className="truncate text-right font-medium">{item.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 px-1 text-xs text-muted">To change your name or email, contact Down to Earth.</p>
        </section>

        <section className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold">Change password</h2>
          <form onSubmit={vm.submit} noValidate className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-card">
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={vm.form.current}
              onChange={event => vm.update('current', event.target.value)}
              error={vm.errors.current}
            />
            <div className="space-y-2.5">
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                value={vm.form.next}
                onChange={event => vm.update('next', event.target.value)}
                error={vm.errors.next}
              />
              <PasswordChecklist items={vm.checklist} />
            </div>
            <TextField
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={vm.form.confirm}
              onChange={event => vm.update('confirm', event.target.value)}
              error={vm.errors.confirm}
            />
            {vm.error && (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {vm.error}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" loading={vm.saving}>
                Change password
              </Button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

