'use client';

import { ChevronRight, Landmark } from 'lucide-react';
import { NoteDetailDrawer, NoteStatusBadge, placeLabel } from '@/features/notes';
import { PageHeader } from '@/shared/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/States';
import { formatDate, formatMoney, formatRate, pluralize } from '@/shared/lib/format';
import { useInvestorLoansViewModel } from '../view-models/use-investor-loans.vm';

export function InvestorLoansView() {
  const vm = useInvestorLoansViewModel();

  return (
    <>
      <PageHeader
        title="My notes"
        description={vm.status === 'ready' && vm.notes.length > 0 ? `${pluralize(vm.notes.length, 'note')} · ${formatMoney(vm.totalInvested)} invested` : undefined}
      />

      {vm.status === 'error' && <ErrorState message={vm.error ?? 'We could not load your notes.'} onRetry={vm.retry} />}
      {vm.status === 'loading' && <Skeleton className="h-72 w-full rounded-2xl" />}

      {vm.status === 'ready' && vm.notes.length === 0 && (
        <EmptyState icon={<Landmark className="h-5 w-5" />} title="No notes yet" body="Notes assigned to you will appear here." />
      )}

      {vm.status === 'ready' && vm.notes.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-canvas/60 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">Note</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Principal</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Rate</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Monthly</th>
                  <th scope="col" className="px-5 py-3 font-medium">Matures</th>
                  <th scope="col" className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {vm.notes.map(note => (
                  <tr key={note.id} onClick={() => vm.open(note.id)} className="cursor-pointer transition-colors hover:bg-canvas/70">
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => vm.open(note.id)} className="text-left font-medium hover:text-sage-700">
                        {placeLabel(note.property)}
                      </button>
                      <p className="mt-0.5 text-xs text-muted">
                        {note.loanNumber} · {note.property.acreage} acres
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums">{formatMoney(note.principalAmount)}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{formatRate(note.interestRate)}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{formatMoney(note.monthlyPayment)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-muted">{formatDate(note.maturityDate)}</td>
                    <td className="px-5 py-4">
                      <NoteStatusBadge status={note.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {vm.notes.map(note => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => vm.open(note.id)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{placeLabel(note.property)}</p>
                    <p className="mt-0.5 text-xs text-muted">{note.loanNumber}</p>
                    <p className="mt-3 text-sm tabular-nums">
                      {formatMoney(note.principalAmount)} <span className="text-muted">at {formatRate(note.interestRate)}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <NoteDetailDrawer note={vm.selected} onClose={vm.close} />
    </>
  );
}
