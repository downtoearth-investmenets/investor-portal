'use client';

import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import { NoteStatusBadge, noteProgress, placeLabel, type Note } from '@/features/notes';
import { BarChart, ChartLegend } from '@/shared/ui/charts/BarChart';
import { DonutChart } from '@/shared/ui/charts/DonutChart';
import { EmptyState } from '@/shared/ui/States';
import { Eyebrow, ProgressRing } from '@/shared/ui/Metric';
import { cn } from '@/shared/lib/cn';
import { formatCompactMoney, formatDate, formatDateParts, formatMoney, formatPercent, formatRate, pluralize } from '@/shared/lib/format';
import { CASHFLOW_LEGEND, toCashflowBars, trailingReceived, type CashflowMonth } from '../model/cashflow.model';
import type { AllocationRow, NextPayment, ReceivedPayment } from '../model/summary.model';

// Presentational blocks shared by the investor dashboard and the admin investor page.

export function NextPaymentPanel({ payment, href, compact = false }: { payment: NextPayment | null; href?: string; compact?: boolean }) {
  if (!payment) {
    return (
      <section className={cn('rounded-[28px] bg-forest text-white', compact ? 'p-6' : 'p-7')}>
        <p className="text-sm text-white/60">Next payment</p>
        <p className="mt-2 text-lg font-medium">Nothing scheduled</p>
      </section>
    );
  }
  const { month, day } = formatDateParts(payment.date);
  const late = payment.daysLate > 0;
  const body = (
    <>
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sage-400/25 blur-3xl transition-opacity duration-500 group-hover:opacity-80" aria-hidden />
      <div className="relative flex items-start justify-between gap-4">
        <p className="flex items-center gap-2 text-sm text-white/60">
          {late ? 'Payment due' : 'Next payment'}
          {late && <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs font-medium text-amber-200">{pluralize(payment.daysLate, 'day')} late</span>}
        </p>
        {href && <ArrowUpRight className="h-5 w-5 text-white/40 transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" aria-hidden />}
      </div>
      <p className={cn('relative font-semibold tracking-tight tabular-nums', compact ? 'mt-3 text-[2rem] leading-tight' : 'mt-4 text-4xl')}>{formatMoney(payment.amount, true)}</p>
      <div className={cn('relative flex items-center gap-4 border-t border-white/10', compact ? 'mt-5 pt-4' : 'mt-7 pt-5')}>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-center leading-none">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-sage-200">{month}</p>
            <p className="mt-1 text-lg font-semibold">{day}</p>
          </div>
        </div>
        <div className="min-w-0 text-sm">
          <p className="truncate font-medium">{payment.loanNumber}</p>
          <p className="text-white/50">{formatDate(payment.date)}</p>
        </div>
      </div>
    </>
  );
  const className = cn('group relative block overflow-hidden rounded-[28px] bg-forest text-white', compact ? 'p-6' : 'p-7');
  return href ? (
    <Link
      href={href}
      className={cn(className, 'transition-transform duration-300 hover:-translate-y-0.5')}
      aria-label={`Next payment ${formatMoney(payment.amount, true)} on ${formatDate(payment.date)}, open note ${payment.loanNumber}`}
    >
      {body}
    </Link>
  ) : (
    <section className={className}>{body}</section>
  );
}

export function AllocationSummary({ rows, repaid, title = 'Allocation' }: { rows: AllocationRow[]; repaid: number; title?: string }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <Eyebrow>{title}</Eyebrow>
      <div className="flex items-center gap-6">
        <DonutChart
          slices={rows}
          size={136}
          thickness={14}
          label="Principal by note"
          center={
            <div>
              <p className="text-lg font-semibold tabular-nums">{formatPercent(repaid)}</p>
              <p className="text-[11px] text-muted">repaid</p>
            </div>
          }
        />
        <ul className="min-w-0 flex-1 space-y-3 text-sm">
          {rows.map(row => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{row.label}</span>
              <span className="tabular-nums text-muted">{formatPercent(row.share)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function RecentPaymentsList({
  payments,
  limit = 5,
  scroll = false
}: {
  payments: ReceivedPayment[];
  limit?: number;
  /** Fill the parent's height and scroll inside instead of growing the page. */
  scroll?: boolean;
}) {
  return (
    <section className={cn(scroll && 'flex h-full min-h-0 flex-col')}>
      <Eyebrow>Recent payments</Eyebrow>
      {payments.length === 0 ? (
        <p className="text-sm text-muted">No payments recorded yet.</p>
      ) : (
        <div className={cn(scroll && '-mr-3 min-h-0 flex-1 overflow-y-auto pr-3')}>
        <ol className="relative ml-[9px] space-y-5 border-l border-line pl-5">
          {payments.slice(0, limit).map(payment => (
            <li key={`${payment.loanId}-${payment.installmentNumber}`} className="relative">
              <CheckCircle2 className="absolute -left-[29px] top-0.5 h-[18px] w-[18px] rounded-full bg-canvas text-sage-600" aria-hidden />
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{placeLabel(payment)}</p>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(payment.amount, true)}</p>
              </div>
              <p className="text-xs text-muted">
                {formatDate(payment.receivedDate)} · #{payment.installmentNumber} · {payment.method}
              </p>
            </li>
          ))}
        </ol>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('text-right sm:text-left', className)}>
      <p className="text-[11px] text-muted">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function NoteRows({
  notes,
  hrefFor,
  emptyBody,
  dense = false,
  className
}: {
  notes: Note[];
  hrefFor: (note: Note) => string;
  emptyBody: string;
  dense?: boolean;
  className?: string;
}) {
  if (notes.length === 0) return <EmptyState title="No notes yet" body={emptyBody} />;
  return (
    <ul className={cn('divide-y divide-line border-y border-line', className)}>
      {notes.map(note => {
        const progress = noteProgress(note);
        return (
          <li key={note.id}>
            <Link
              href={hrefFor(note)}
              className={cn(
                'group grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,2.4fr)_repeat(3,minmax(0,1fr))_6.5rem_6.5rem] sm:gap-y-0',
                dense ? 'py-3.5 xlshort:py-2.5' : 'py-5'
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium transition-colors group-hover:text-sage-700">{placeLabel(note.property)}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {note.loanNumber} · {note.property.acreage} acres
                </p>
              </div>
              <Figure label="Principal" value={formatMoney(note.principalAmount)} />
              <Figure label="Fixed rate" value={formatRate(note.interestRate)} className="hidden sm:block" />
              <Figure label="Monthly" value={formatMoney(note.monthlyPayment)} className="hidden sm:block" />
              <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                <ProgressRing value={progress.ratio} label={`${progress.paidCount} of ${progress.total} payments received`} />
                <p className="text-xs tabular-nums text-muted">
                  <span className="font-medium text-ink">{progress.paidCount}</span>/{progress.total}
                </p>
                <span className="ml-2 sm:hidden">
                  <NoteStatusBadge status={note.status} />
                </span>
              </div>
              <div className="hidden items-center justify-end gap-3 sm:flex">
                <NoteStatusBadge status={note.status} />
                <ChevronRight className="h-4 w-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function CashflowSection({ months, caption, fill = false }: { months: CashflowMonth[]; caption: string; fill?: boolean }) {
  return (
    <section className={cn(fill && 'flex h-full min-h-0 flex-col')}>
      <div className={cn('flex flex-wrap items-end justify-between gap-4', fill ? 'mb-4' : 'mb-6')}>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Cash flow</h2>
          <p className="mt-1 text-sm">
            <span className="font-semibold tabular-nums">{formatMoney(trailingReceived(months))}</span>
            <span className="text-muted"> {caption}</span>
          </p>
        </div>
        <ChartLegend items={CASHFLOW_LEGEND} />
      </div>
      <div className={cn(fill && 'min-h-0 flex-1')}>
        <BarChart
          data={toCashflowBars(months)}
          height={fill ? 'fill' : 220}
          format={value => formatMoney(value, true)}
          formatAxis={formatCompactMoney}
          label="Monthly payments received and scheduled"
        />
      </div>
    </section>
  );
}

