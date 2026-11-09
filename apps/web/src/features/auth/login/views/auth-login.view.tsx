'use client';

import Link from 'next/link';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { SelectField, TextField } from '@/shared/ui/Field';
import type { DemoAccountGroup } from '../model/demo-accounts.model';
import { useAuthLoginViewModel } from '../view-models/use-auth-login.vm';
import { TerrainMap } from './terrain-map';

export function AuthLoginView({ demoAccounts }: { demoAccounts: readonly DemoAccountGroup[] }) {
  const vm = useAuthLoginViewModel();

  return (
    <div className="grid min-h-[100dvh] bg-canvas p-4 sm:p-6 lg:grid-cols-[1.08fr_1fr] lg:gap-8">
      <main className="flex min-w-0 flex-col justify-center px-3 py-12 sm:px-10 lg:col-start-2 lg:row-start-1 lg:px-8">
        <div className="mx-auto w-full max-w-[26rem]">
          <h1 className="text-[clamp(2.6rem,5vw,4.25rem)] font-semibold leading-none tracking-[-0.06em] text-forest">Sign in</h1>
          <p className="mt-3 text-base text-muted sm:text-lg">Down to Earth portal</p>
          <div aria-hidden className="mt-5 h-0.5 w-10 rounded-full bg-sage-400" />

          <form className="mt-8 space-y-5 sm:space-y-6" noValidate onSubmit={vm.submit}>
            <TextField
              label="Email address"
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              value={vm.email}
              onChange={event => vm.setEmail(event.target.value)}
              error={vm.fieldErrors.email}
              leading={<Mail className="h-4 w-4" />}
              inputClassName="h-12 text-base"
            />
            <TextField
              label="Password"
              type={vm.showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              value={vm.password}
              onChange={event => vm.setPassword(event.target.value)}
              error={vm.fieldErrors.password}
              leading={<LockKeyhole className="h-4 w-4" />}
              inputClassName="h-12 text-base"
              labelAction={
                <Link href="/forgot-password" className="rounded-sm text-sm font-medium text-sage-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-600">
                  Forgot password?
                </Link>
              }
              trailing={
                <button
                  type="button"
                  onClick={vm.toggleShowPassword}
                  aria-label={vm.showPassword ? 'Hide password' : 'Show password'}
                  className="grid h-10 w-10 place-items-center rounded-lg text-sage-700 hover:text-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage-600"
                >
                  {vm.showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
                </button>
              }
            />

            {vm.error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {vm.error}
              </div>
            )}

            <Button type="submit" className="relative h-12 w-full bg-forest hover:bg-sage-700" loading={vm.submitting}>
              Sign in
              {!vm.submitting && <ArrowRight aria-hidden className="absolute right-4 h-4 w-4" />}
            </Button>
          </form>

          {demoAccounts.length > 0 && (
            <SelectField
              className="mt-6"
              label="Demo account"
              value={demoAccounts.some(group => group.emails.includes(vm.email)) ? vm.email : ''}
              onChange={event => vm.setEmail(event.target.value)}
            >
              <option value="" disabled>Choose a demo email</option>
              {demoAccounts.map(group => (
                <optgroup key={group.role} label={group.role}>
                  {group.emails.map(email => <option key={email} value={email}>{email}</option>)}
                </optgroup>
              ))}
            </SelectField>
          )}
        </div>
      </main>
      <TerrainMap />
    </div>
  );
}
