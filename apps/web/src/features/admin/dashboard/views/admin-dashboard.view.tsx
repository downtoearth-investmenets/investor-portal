'use client';

import Link from 'next/link';
import { AlertCircle, ChevronRight, Plus } from 'lucide-react';
import { CashflowSection } from '@/features/portfolio';
import { NoteStatusBadge, placeLabel } from '@/features/notes';
import { buttonClasses } from '@/shared/ui/Button';
import { DonutChart } from '@/shared/ui/charts/DonutChart';
import { Eyebrow, MetricStrip } from '@/shared/ui/Metric';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { formatCompactMoney, formatDate, formatDateParts, formatMoney, formatPercent, formatRate, pluralize } from '@/shared/lib/format';
import { useAdminDashboardViewModel } from '../view-models/use-admin-dashboard.vm';

type ViewModel = ReturnType<typeof useAdminDashboardViewModel>;
type Overview = NonNullable<ViewModel['overview']>;

// Same one-screen layout as the investor overview: on wide screens the page never scrolls.
// 5rem matches the shell's top and bottom padding on desktop.
const FIT_SCREEN = 'xl:h-[calc(100dvh-5rem)]';

function ThisMonthPanel({ overview, ratio }: { overview: Overview; ratio: number }) {
  const remaining = Math.max(overview.monthlyInflow - overview.collectedThisMonth, 0);
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-forest p-6 text-white xlshort:p-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sage-400/25 blur-3xl" aria-hidden />
      <p className="relative text-sm text-white/60">Collected this month</p>
      <div className="relative mt-4 flex items-center gap-6 xlshort:mt-3">
        <DonutChart
          size={104}
          thickness={11}
          label={`${formatPercent(ratio)} of scheduled payments collected`}
          slices={[
            { label: 'Collected', value: overview.collectedThisMonth, color: '#b6d4d6' },
            { label: 'Remaining', value: remaining, color: 'rgba(255,255,255,0.08)' }
          ]}
          center={<span className="text-lg font-semibold tabular-nums">{formatPercent(ratio)}</span>}
        />
        <div className="min-w-0">
          <p className="text-[2rem] font-semibold leading-tight tracking-tight tabular-nums">{formatMoney(overview.collectedThisMonth)}</p>
          <p className="mt-1 text-sm text-white/50">of {formatMoney(overview.monthlyInflow)} scheduled</p>
        </div>
      </div>
      <p className="relative mt-5 border-t border-white/10 pt-4 text-sm text-white/70 xlshort:hidden">
        <span className="font-medium text-white tabular-nums">{formatMoney(remaining)}</span> still to collect
      </p>
    </section>
  );
}

function AllocationByState({ vm }: { vm: ViewModel }) {
  if (vm.allocation.length === 0) return null;
  const total = vm.allocation.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <section>
      <Eyebrow>Capital by state</Eyebrow>
      <div className="flex items-center gap-6">
        <DonutChart
          slices={vm.allocation}
          size={120}
          thickness={13}
          label="Capital deployed by state"
          center={
            <div>
              <p className="text-sm font-semibold tabular-nums">{formatCompactMoney(total)}</p>
              <p className="text-[11px] text-muted">deployed</p>
            </div>
          }
        />
        <ul className="min-w-0 flex-1 space-y-2.5 text-sm">
          {vm.allocation.map(slice => (
            <li key={slice.label} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="tabular-nums text-muted">{formatPercent(slice.share)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Late payments first (flagged), then everything due in the next 30 days. */
function PaymentsDue({ overview }: { overview: Overview }) {
  const late = overview.overduePayments;
  const upcoming = overview.upcomingPayments;
  return (
    <section className="flex h-full min-h-0 flex-col">
      <Eyebrow>
        Payments due
        {late.length > 0 && <span className="ml-2 normal-case tracking-normal text-rose-700">· {late.length} late</span>}
      </Eyebrow>
      {late.length + upcoming.length === 0 ? (
        <p className="text-sm text-muted">Nothing due in the next 30 days.</p>
      ) : (
        <ol className="-mx-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3">
          {late.map(payment => (
            <li key={`late-${payment.loanId}-${payment.installmentNumber}`}>
              <Link
                href={`/admin/loans?note=${payment.loanId}`}
                className="-mx-3 flex items-center gap-4 rounded-2xl bg-rose-50/70 px-3 py-2.5 transition-colors hover:bg-rose-50"
              >
                <span className="grid w-10 shrink-0 place-items-center text-rose-600">
                  <AlertCircle className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 border-l border-rose-200 pl-4">
                  <p className="truncate text-sm font-medium">{payment.investorName}</p>
                  <p className="truncate text-xs text-muted">
                    {payment.loanNumber} · due {formatDate(payment.dueDate)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(payment.amount)}</p>
                  <p className="text-xs font-medium text-rose-700">{pluralize(payment.daysLate, 'day')} late</p>
                </div>
              </Link>
            </li>
          ))}
          {upcoming.map(payment => {
            const { month, day } = formatDateParts(payment.dueDate);
            return (
              <li key={`${payment.loanId}-${payment.dueDate}`}>
                <Link href={`/admin/loans?note=${payment.loanId}`} className="-mx-3 flex items-center gap-4 rounded-2xl px-3 py-2.5 transition-colors hover:bg-sand/60">
                  <div className="w-10 shrink-0 text-center leading-none">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted">{month}</p>
                    <p className="mt-1 text-lg font-semibold">{day}</p>
                  </div>
                  <div className="min-w-0 flex-1 border-l border-line pl-4">
                    <p className="truncate text-sm font-medium">{payment.investorName}</p>
                    <p className="truncate text-xs text-muted">{payment.loanNumber}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">{formatMoney(payment.amount)}</p>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function RecentNotes({ overview }: { overview: Overview }) {
  return (
    <section className="xl:flex xl:max-h-[45%] xl:min-h-0 xl:shrink-0 xl:flex-col xlshort:max-h-[42%]">
      <Eyebrow
        action={
          <Link href="/admin/loans" className="text-sm font-medium text-sage-700 hover:underline">
            All notes
          </Link>
        }
      >
        Recent notes
      </Eyebrow>
      {overview.recentNotes.length === 0 ? (
        <p className="border-y border-line py-8 text-center text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line xl:min-h-0 xl:overflow-y-auto">
          {overview.recentNotes.map(note => (
            <li key={note.id}>
              <Link
                href={`/admin/loans?note=${note.id}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-6 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.6fr)_6.5rem] xlshort:py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium group-hover:text-sage-700">{placeLabel(note)}</p>
                  <p className="truncate text-xs text-muted">{note.loanNumber}</p>
                </div>
                <p className="hidden truncate text-sm text-muted sm:block">{note.investorName}</p>
                <p className="text-right text-sm font-semibold tabular-nums sm:text-left">{formatMoney(note.principalAmount)}</p>
                <p className="hidden text-sm tabular-nums text-muted sm:block">{formatRate(note.interestRate)}</p>
                <div className="hidden items-center justify-end gap-3 sm:flex">
                  <NoteStatusBadge status={note.status} />
                  <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AdminDashboardView() {
  const vm = useAdminDashboardViewModel();
  const overview = vm.overview;
  const pastDue = overview ? overview.overduePayments.reduce((sum, p) => sum + p.amount, 0) : 0;

  return (
    <div className={`flex flex-col ${FIT_SCREEN}`}>
      <header className="mb-8 flex shrink-0 items-end justify-between gap-4 xl:mb-7 xlshort:mb-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">Down to Earth Investments</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl xlshort:text-3xl">Portfolio</h1>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          <p className="hidden text-sm text-muted md:block">{vm.today}</p>
          <Link href="/admin/loans?new=1" className={buttonClasses()}>
            <Plus className="h-4 w-4" aria-hidden />
            New note
          </Link>
        </div>
      </header>

      {vm.status === 'error' && <ErrorState message={vm.error ?? 'We could not load the portfolio.'} onRetry={vm.retry} />}

      {vm.status === 'loading' && (
        <div className="grid gap-12 xl:min-h-0 xl:flex-1 xl:grid-cols-12">
          <div className="space-y-8 xl:col-span-8">
            <Skeleton className="h-16 w-72" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-[28px] xl:col-span-4" />
        </div>
      )}

      {vm.status === 'ready' && overview && (
        <div className="grid gap-x-12 gap-y-10 xl:min-h-0 xl:flex-1 xl:grid-cols-12 xl:grid-rows-[auto_minmax(0,1fr)] xl:gap-y-8 xlshort:gap-y-5">
          <section className="min-w-0 xl:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Capital deployed</p>
            <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-1">
              <p className="text-5xl font-semibold tracking-tight tabular-nums xl:text-[3.5rem] xl:leading-none xlshort:text-[2.75rem]">
                {formatMoney(overview.totalPrincipal)}
              </p>
              <p className="pb-1 text-sm text-muted">
                {formatMoney(overview.outstandingBalance)} outstanding across {pluralize(overview.activeNotes, 'note')}
              </p>
            </div>
            <MetricStrip
              dense
              className="mt-6 xlshort:mt-4"
              items={[
                { label: 'Fixed rate', value: overview.activeNotes ? formatRate(overview.averageRate) : '—', hint: 'Weighted average' },
                { label: 'Monthly inflow', value: formatMoney(overview.monthlyInflow), hint: 'Scheduled' },
                {
                  label: 'Late payments',
                  value: overview.overduePayments.length,
                  hint: overview.overduePayments.length ? `${formatMoney(pastDue)} past due` : 'All current',
                  tone: overview.overduePayments.length ? 'alert' : 'default'
                },
                { label: 'Investors', value: overview.investorCount, hint: 'With accounts' }
              ]}
            />
          </section>

          <div className="min-w-0 xl:col-span-4">
            <ThisMonthPanel overview={overview} ratio={vm.collected} />
          </div>

          <div className="flex min-w-0 flex-col gap-8 xl:col-span-8 xl:min-h-0 xlshort:gap-5">
            <div className="h-80 xl:h-auto xl:min-h-0 xl:flex-1">
              <CashflowSection fill months={overview.cashflow} caption="collected in the last 12 months" />
            </div>
            <RecentNotes overview={overview} />
          </div>

          <div className="flex min-w-0 flex-col gap-8 xl:col-span-4 xl:min-h-0 xlshort:gap-5">
            <div className="shrink-0">
              <AllocationByState vm={vm} />
            </div>
            <div className="xl:min-h-0 xl:flex-1">
              <PaymentsDue overview={overview} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

