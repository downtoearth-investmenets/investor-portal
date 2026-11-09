'use client';

import Link from 'next/link';
import { AllocationSummary, CashflowSection, NextPaymentPanel, NoteRows, RecentPaymentsList } from '@/features/portfolio';
import { Eyebrow, MetricStrip } from '@/shared/ui/Metric';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { formatMoney, formatRate, pluralize } from '@/shared/lib/format';
import { useInvestorDashboardViewModel } from '../view-models/use-investor-dashboard.vm';

// On wide screens the overview fits exactly in the window: the page never scrolls.
// The chart stretches to the space left, and long lists scroll inside their own column.
// 5rem matches the shell's top and bottom padding on desktop.
const FIT_SCREEN = 'xl:h-[calc(100dvh-5rem)]';

function DashboardSkeleton() {
  return (
    <div className="grid gap-12 xl:min-h-0 xl:flex-1 xl:grid-cols-12">
      <div className="space-y-8 xl:col-span-8">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <div className="space-y-8 xl:col-span-4">
        <Skeleton className="h-44 w-full rounded-[28px]" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function InvestorDashboardView() {
  const vm = useInvestorDashboardViewModel();
  const summary = vm.summary;

  return (
    <div className={`flex flex-col ${FIT_SCREEN}`}>
      <header className="mb-8 flex shrink-0 items-end justify-between gap-4 xl:mb-7 xlshort:mb-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">{vm.entityName}</p>
          <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight sm:text-4xl xlshort:text-3xl">{vm.heading}</h1>
        </div>
        <p className="hidden shrink-0 pb-1 text-sm text-muted sm:block">{vm.today}</p>
      </header>

      {vm.status === 'error' && <ErrorState message={vm.error ?? 'We could not load your portfolio.'} onRetry={vm.retry} />}
      {vm.status === 'loading' && <DashboardSkeleton />}

      {vm.status === 'ready' && summary && (
        <div className="grid gap-x-12 gap-y-10 xl:min-h-0 xl:flex-1 xl:grid-cols-12 xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-y-8 xlshort:gap-y-5">
          <section className="min-w-0 xl:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Outstanding principal</p>
            <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-5xl font-semibold tracking-tight tabular-nums xl:text-[3.5rem] xl:leading-none xlshort:text-[2.75rem]">{formatMoney(summary.outstandingBalance)}</p>
              <p className="pb-1 text-sm text-muted">
                of {formatMoney(summary.totalInvested)} across {pluralize(summary.activeNotes, 'note')}
              </p>
            </div>
            <MetricStrip
              dense
              className="mt-6 xlshort:mt-4"
              items={[
                { label: 'Fixed rate', value: summary.activeNotes ? formatRate(summary.averageRate) : '—', hint: 'Weighted average' },
                { label: 'Monthly income', value: formatMoney(summary.monthlyIncome), hint: 'Scheduled' },
                { label: 'Interest earned', value: formatMoney(summary.interestEarned), hint: 'All time' },
                { label: 'Principal returned', value: formatMoney(summary.principalRepaid), hint: 'All time' }
              ]}
            />
          </section>

          <div className="min-w-0 xl:col-span-4">
            <NextPaymentPanel
              compact
              payment={summary.nextPayment}
              href={summary.nextPayment ? `/investor/loans?note=${summary.nextPayment.loanId}` : undefined}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-8 xl:col-span-8 xl:min-h-0 xlshort:gap-5">
            <div className="h-80 xl:h-auto xl:min-h-0 xl:flex-1">
              <CashflowSection fill months={summary.cashflow} caption="received in the last 12 months" />
            </div>

            <section className="xl:flex xl:max-h-[45%] xl:min-h-0 xl:shrink-0 xl:flex-col xlshort:max-h-[42%]">
              <Eyebrow
                action={
                  <Link href="/investor/loans" className="text-sm font-medium text-sage-700 hover:underline">
                    All notes
                  </Link>
                }
              >
                Your notes
              </Eyebrow>
              <div className="xl:min-h-0 xl:overflow-y-auto">
                <NoteRows dense notes={vm.notes} hrefFor={note => `/investor/loans?note=${note.id}`} emptyBody="Notes assigned to you will appear here with their payment schedule." />
              </div>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-8 xl:col-span-4 xl:min-h-0 xlshort:gap-5">
            <div className="shrink-0">
              <AllocationSummary rows={vm.allocation} repaid={vm.repaid} />
            </div>
            <div className="xl:min-h-0 xl:flex-1">
              <RecentPaymentsList scroll limit={12} payments={summary.recentPayments} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

