'use client';

import Link from 'next/link';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Copy, Download, Mail, UserX } from 'lucide-react';
import { AllocationSummary, CashflowSection, NextPaymentPanel, NoteRows, RecentPaymentsList } from '@/features/portfolio';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { inputClasses } from '@/shared/ui/Field';
import { Eyebrow, MetricStrip } from '@/shared/ui/Metric';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/States';
import { Switcher } from '@/shared/ui/Switcher';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatRate, pluralize } from '@/shared/lib/format';
import { investorStatusLabel, type InvestorProfile } from '../model/investor-detail.model';
import { investorPath, useInvestorDetailViewModel } from '../view-models/use-investor-detail.vm';

type ViewModel = ReturnType<typeof useInvestorDetailViewModel>;

function StepLink({ investor, direction }: { investor: InvestorProfile | null; direction: 'previous' | 'next' }) {
  const Icon = direction === 'previous' ? ChevronLeft : ChevronRight;
  const className = 'grid h-11 w-11 place-items-center rounded-full border border-line text-muted transition-colors';
  if (!investor) {
    return (
      <span className={cn(className, 'opacity-40')} aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
    );
  }
  return (
    <Link
      href={investorPath(investor.id)}
      className={cn(className, 'hover:border-sage-200 hover:bg-surface hover:text-ink')}
      aria-label={`${direction === 'previous' ? 'Previous' : 'Next'} investor: ${investor.fullName}`}
      title={investor.fullName}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </Link>
  );
}

function Profile({ vm, investor }: { vm: ViewModel; investor: InvestorProfile }) {
  const status = investorStatusLabel(investor);
  return (
    <section>
      <Eyebrow>Profile</Eyebrow>
      <dl className="divide-y divide-line border-y border-line text-sm">
        {[
          ['Status', <Badge key="status" tone={status.tone}>{status.label}</Badge>],
          ['Email', <a key="email" href={`mailto:${investor.email}`} className="hover:text-sage-700 hover:underline">{investor.email}</a>],
          ['Phone', investor.phone || '—'],
          ['Trust or entity', investor.entityName || 'Individual'],
          ['Accredited', investor.accreditedStatus ? 'Yes' : 'No'],
          ['Investor since', formatDate(investor.createdAt)]
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-center justify-between gap-6 py-3">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 truncate text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {investor.status === 'invited' && (
        <div className="mt-6 space-y-3 rounded-2xl bg-amber-50/70 p-5 ring-1 ring-inset ring-amber-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Waiting for setup</p>
              <p className="text-xs text-muted">They have not chosen a password yet.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={vm.resendInvite} loading={vm.resending}>
              <Mail className="h-4 w-4" aria-hidden />
              Resend invite
            </Button>
          </div>
          {vm.invite && (
            <div className="animate-pop-in space-y-2">
              <p className="text-xs text-muted">
                {vm.invite.emailSent
                  ? `Emailed to ${vm.invite.email}. The earlier link no longer works.`
                  : "Email isn't set up yet, so send this link yourself. The earlier link no longer works."}
              </p>
              <div className="flex gap-2">
                <input readOnly value={vm.invite.link} onFocus={event => event.target.select()} aria-label="Invite link" className={cn(inputClasses, 'font-mono text-xs')} />
                <Button variant="secondary" onClick={vm.copyInvite} aria-label="Copy invite link">
                  {vm.copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-12 xl:grid-cols-12">
      <div className="space-y-8 xl:col-span-8">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-52 w-full rounded-[28px] xl:col-span-4" />
    </div>
  );
}

export function InvestorDetailView({ id }: { id: string }) {
  const vm = useInvestorDetailViewModel(id);
  const investor = vm.investor;
  const summary = vm.summary;

  return (
    <>
      <Link
        href="/admin/investors"
        className="mb-6 inline-flex items-center gap-1.5 rounded-md text-sm text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-sage-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Investors
      </Link>

      <header className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          {vm.rosterReady && investor ? (
            <Switcher items={vm.switcherItems} value={id} onChange={vm.switchTo} label="Investor" searchPlaceholder="Search investors" />
          ) : (
            <div className="flex items-center gap-4">
              <Skeleton className="h-14 w-14 rounded-2xl" />
              <Skeleton className="h-10 w-64" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StepLink investor={vm.previous} direction="previous" />
          <StepLink investor={vm.next} direction="next" />
          <Link href={`/admin/reports?type=statement&investor=${encodeURIComponent(id)}`} className={buttonClasses('secondary')}>
            <Download className="h-4 w-4" aria-hidden />
            Export statement
          </Link>
        </div>
      </header>

      {vm.status === 'missing' && (
        <EmptyState
          icon={<UserX className="h-5 w-5" />}
          title="Investor not found"
          body="This investor may have been removed, or the link is wrong."
          action={
            <Link href="/admin/investors" className={buttonClasses()}>
              Back to investors
            </Link>
          }
        />
      )}
      {vm.status === 'error' && <ErrorState message={vm.error ?? 'We could not load this investor.'} onRetry={vm.retry} />}
      {vm.status === 'loading' && <DetailSkeleton />}

      {vm.status === 'ready' && investor && summary && (
        <div className="grid items-start gap-x-14 gap-y-12 xl:grid-cols-12">
          <section className="min-w-0 xl:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Outstanding principal</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">{formatMoney(summary.outstandingBalance)}</p>
              <p className="pb-2 text-sm text-muted">
                of {formatMoney(summary.totalInvested)} across {pluralize(summary.activeNotes, 'note')}
              </p>
            </div>
            <MetricStrip
              className="mt-8"
              items={[
                { label: 'Fixed rate', value: summary.activeNotes ? formatRate(summary.averageRate) : '—', hint: 'Weighted average' },
                { label: 'Monthly income', value: formatMoney(summary.monthlyIncome) },
                { label: 'Interest paid', value: formatMoney(summary.interestEarned), hint: 'All time' },
                {
                  label: 'Late payments',
                  value: investor.latePayments,
                  hint: investor.latePayments ? 'Needs follow-up' : 'All current',
                  tone: investor.latePayments ? 'alert' : 'default'
                }
              ]}
            />
          </section>

          <div className="min-w-0 xl:col-span-4">
            <NextPaymentPanel payment={summary.nextPayment} href={summary.nextPayment ? `/admin/loans?note=${summary.nextPayment.loanId}` : undefined} />
          </div>

          <div className="min-w-0 xl:col-span-8">
            <CashflowSection months={summary.cashflow} caption="paid out in the last 12 months" />
          </div>

          <div className="min-w-0 xl:col-span-4">
            <Profile vm={vm} investor={investor} />
          </div>

          <section className="min-w-0 xl:col-span-8">
            <Eyebrow
              action={
                <Link href={`/admin/loans?new=1`} className="text-sm font-medium text-sage-700 hover:underline">
                  New note
                </Link>
              }
            >
              Notes
            </Eyebrow>
            <NoteRows notes={vm.notes} hrefFor={note => `/admin/loans?note=${note.id}`} emptyBody="Create a note and assign it to this investor." />
          </section>

          <div className="min-w-0 space-y-12 xl:col-span-4">
            <AllocationSummary rows={vm.allocation} repaid={vm.repaid} />
            <RecentPaymentsList payments={summary.recentPayments} />
          </div>
        </div>
      )}
    </>
  );
}

