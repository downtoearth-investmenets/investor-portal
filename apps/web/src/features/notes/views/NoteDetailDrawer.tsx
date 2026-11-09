'use client';

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Progress } from '@/shared/ui/Progress';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatPercent, formatRate } from '@/shared/lib/format';
import { loanToValue, nextInstallment, noteProgress, placeLabel, type Note, type ScheduleItem } from '../model/note.model';
import { NoteStatusBadge } from './NoteStatusBadge';

interface NoteDetailDrawerProps {
  note: Note | null;
  onClose: () => void;
  showInvestor?: boolean;
  /** Replaces the rate figure, e.g. with a change button. */
  rateSlot?: ReactNode;
  /** Shown under the progress bar, e.g. admin actions. */
  actions?: ReactNode;
  /** Shown at the end of the drawer. */
  footer?: ReactNode;
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-canvas px-4 py-3.5">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 text-lg font-semibold tabular-nums">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-4 py-3 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

export function NoteDetailDrawer({ note, onClose, showInvestor = false, rateSlot, actions, footer }: NoteDetailDrawerProps) {
  return (
    <Drawer
      open={Boolean(note)}
      onClose={onClose}
      title={note ? placeLabel(note.property) : ''}
      subtitle={note ? `${note.loanNumber} · ${note.borrowerName}` : undefined}
    >
      {note && <NoteDetailBody note={note} showInvestor={showInvestor} rateSlot={rateSlot} actions={actions} footer={footer} />}
    </Drawer>
  );
}

function InstallmentState({ item, isNext }: { item: ScheduleItem; isNext: boolean }) {
  if (item.status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700" title={item.paidDate ? `Received ${formatDate(item.paidDate)}` : undefined}>
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Paid
      </span>
    );
  }
  if (item.status === 'partial') {
    const short = item.paymentAmount - (item.payment?.amount ?? 0);
    return <span className="text-xs font-medium text-amber-700">{formatMoney(short)} short</span>;
  }
  if (item.status === 'overdue') {
    return <span className="text-xs font-medium text-rose-700">{item.daysLate ?? 0}d late</span>;
  }
  return isNext ? <span className="text-xs font-medium text-sage-700">Next</span> : null;
}

function NoteDetailBody({ note, showInvestor, rateSlot, actions, footer }: Omit<NoteDetailDrawerProps, 'onClose'> & { note: Note }) {
  const progress = noteProgress(note);
  const next = nextInstallment(note);
  const ltv = loanToValue(note);
  const land = note.property;
  const changes = note.rateHistory.slice(1);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <NoteStatusBadge status={note.status} />
        {next && (
          <p className={cn('text-sm', next.status === 'overdue' ? 'font-medium text-rose-700' : 'text-muted')}>
            {next.status === 'overdue' ? `Payment due ${formatDate(next.dueDate)} is late` : `Next payment ${formatDate(next.dueDate)}`}
          </p>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Figure label="Principal">{formatMoney(note.principalAmount)}</Figure>
        <Figure label="Fixed rate">{rateSlot ?? formatRate(note.interestRate)}</Figure>
        <Figure label="Monthly payment">{formatMoney(note.monthlyPayment, true)}</Figure>
        <Figure label="Matures">{formatDate(note.maturityDate)}</Figure>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
          <span className="font-medium">
            {progress.paidCount} of {progress.total} payments received
          </span>
          <span className="tabular-nums text-muted">{formatMoney(progress.balance)} left</span>
        </div>
        <Progress value={progress.ratio} label="Payments received" />
      </section>

      {actions}

      {changes.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">Rate history</h3>
          <ol className="space-y-3 border-l border-line pl-4">
            {[...note.rateHistory].reverse().map((change, index, list) => (
              <li key={change.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-sage-600" aria-hidden />
                <p className="font-medium">
                  {formatRate(change.rate)}
                  <span className="font-normal text-muted"> from {formatDate(change.effectiveDate)}</span>
                </p>
                <p className="text-xs text-muted">
                  {index === list.length - 1 ? 'Original note rate' : `${change.reason} · ${change.changedBy}, ${formatDate(change.createdAt.slice(0, 10))}`}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold">Details</h3>
        <dl className="divide-y divide-line rounded-xl border border-line">
          <Row label="Borrower">{note.borrowerName}</Row>
          {showInvestor && <Row label="Investor">{note.investorName || '—'}</Row>}
          <Row label="Originated">{formatDate(note.originationDate)}</Row>
          <Row label="Term">{note.termMonths} months</Row>
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Land</h3>
        <dl className="divide-y divide-line rounded-xl border border-line">
          <Row label="Parcel (APN)">
            <span className="font-mono text-[13px]">{land.apn}</span>
          </Row>
          <Row label="Size">{land.acreage} acres</Row>
          {land.propertyAddress && <Row label="Address">{land.propertyAddress}</Row>}
          {land.titleCompany && <Row label="Title company">{land.titleCompany}</Row>}
          {Boolean(land.estimatedLandValue) && <Row label="Estimated value">{formatMoney(land.estimatedLandValue ?? 0)}</Row>}
          {ltv !== null && <Row label="Loan-to-value">{formatPercent(ltv)}</Row>}
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold">Payment schedule</h3>
        <div className="max-h-96 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-canvas text-xs text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Due</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Payment</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Interest</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Balance</th>
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Status</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {note.schedule.map((item, index) => {
                const isNext = next?.installmentNumber === item.installmentNumber;
                const rateChanged = index > 0 && note.schedule[index - 1].rate !== item.rate;
                return (
                  <tr
                    key={item.installmentNumber}
                    className={cn(isNext && 'bg-sage-50', item.status === 'overdue' && 'bg-rose-50/70')}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {formatDate(item.dueDate)}
                      {rateChanged && <span className="block text-[11px] font-medium text-sage-700">Now {formatRate(item.rate)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(item.paymentAmount, true)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted sm:table-cell">{formatMoney(item.interestComponent, true)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{formatMoney(item.remainingBalance)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <InstallmentState item={item} isNext={isNext} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {footer}
    </div>
  );
}

