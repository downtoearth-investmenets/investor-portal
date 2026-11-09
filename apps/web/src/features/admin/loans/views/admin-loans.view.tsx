'use client';

import { ChevronRight, Landmark, Pencil, Plus, Search, Undo2 } from 'lucide-react';
import { NoteDetailDrawer, NoteStatusBadge, nextInstallment, placeLabel } from '@/features/notes';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { SelectField, TextAreaField, TextField, inputClasses } from '@/shared/ui/Field';
import { Modal } from '@/shared/ui/Modal';
import { PageHeader } from '@/shared/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/States';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatRate, pluralize } from '@/shared/lib/format';
import { PAYMENT_METHODS } from '../model/admin-loans.model';
import { useAdminLoansViewModel } from '../view-models/use-admin-loans.vm';

type ViewModel = ReturnType<typeof useAdminLoansViewModel>;

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </p>
  );
}

function RateFigure({ vm }: { vm: ViewModel }) {
  const note = vm.selected;
  if (!note) return null;
  return (
    <span className="flex items-center justify-between gap-2">
      {formatRate(note.interestRate)}
      {!vm.rateOpen && vm.rateOptions.length > 0 && (
        <button type="button" onClick={vm.startRateChange} className="text-xs font-medium text-sage-700 hover:underline">
          Change
        </button>
      )}
    </span>
  );
}

function RateChangePanel({ vm }: { vm: ViewModel }) {
  const note = vm.selected;
  if (!note) return null;
  const remaining = note.termMonths - Number(vm.rateForm.startsWith) + 1;

  return (
    <form onSubmit={vm.saveRateChange} noValidate className="animate-pop-in space-y-4 rounded-2xl border border-sage-200 bg-sage-50/40 p-5">
      <div>
        <h3 className="text-sm font-semibold">Change fixed rate</h3>
        <p className="mt-1 text-xs text-muted">Payments already received keep their amounts.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="New rate (%)"
          inputMode="decimal"
          autoFocus
          value={vm.rateForm.rate}
          onChange={event => vm.updateRateField('rate', event.target.value)}
          error={vm.rateErrors.rate}
        />
        <SelectField
          label="Starting with"
          value={vm.rateForm.startsWith}
          onChange={event => vm.updateRateField('startsWith', event.target.value)}
          error={vm.rateErrors.startsWith}
        >
          {vm.rateOptions.map(item => (
            <option key={item.installmentNumber} value={item.installmentNumber}>
              {formatDate(item.dueDate)} · #{item.installmentNumber}
              {item.status === 'overdue' ? ' (late)' : ''}
            </option>
          ))}
        </SelectField>
      </div>

      {vm.ratePreview && (
        <p className="rounded-xl bg-surface px-4 py-3 text-sm" aria-live="polite">
          Payment goes from <span className="font-semibold tabular-nums">{formatMoney(vm.ratePreview.from, true)}</span> to{' '}
          <span className="font-semibold tabular-nums">{formatMoney(vm.ratePreview.to, true)}</span>
          <span className="text-muted"> for the last {pluralize(remaining, 'payment')}.</span>
        </p>
      )}

      <TextAreaField
        label="Reason"
        rows={2}
        maxLength={300}
        value={vm.rateForm.reason}
        onChange={event => vm.updateRateField('reason', event.target.value)}
        error={vm.rateErrors.reason}
        hint="Shown to the investor on their note and in the email."
      />

      <FormAlert message={vm.rateError} />

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={vm.cancelRateChange}>
          Cancel
        </Button>
        <Button type="submit" loading={vm.rateSaving}>
          Save rate
        </Button>
      </div>
    </form>
  );
}

function PaymentPanel({ vm }: { vm: ViewModel }) {
  const note = vm.selected;
  const next = vm.nextDue;
  if (!note) return null;
  const last = note.lastPayment;

  return (
    <section className="space-y-3">
      {next ? (
        <div className="rounded-2xl border border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                Payment #{next.installmentNumber}
                {next.status === 'overdue' && <Badge tone="negative">{next.daysLate}d late</Badge>}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Due {formatDate(next.dueDate)} · <span className="tabular-nums">{formatMoney(next.paymentAmount, true)}</span>
              </p>
            </div>
            {!vm.paymentOpen && (
              <Button size="sm" onClick={vm.openPayment}>
                Record payment
              </Button>
            )}
          </div>

          {vm.paymentOpen && (
            <form onSubmit={vm.recordPayment} noValidate className="mt-5 animate-pop-in space-y-4 border-t border-line pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Amount received ($)"
                  inputMode="decimal"
                  autoFocus
                  value={vm.paymentForm.amount}
                  onChange={event => vm.updatePaymentField('amount', event.target.value)}
                  error={vm.paymentErrors.amount}
                  hint={vm.paymentShortfall > 0 ? `${formatMoney(vm.paymentShortfall, true)} short of the scheduled amount` : undefined}
                />
                <TextField
                  label="Received on"
                  type="date"
                  value={vm.paymentForm.receivedDate}
                  onChange={event => vm.updatePaymentField('receivedDate', event.target.value)}
                  error={vm.paymentErrors.receivedDate}
                />
                <SelectField label="Method" value={vm.paymentForm.method} onChange={event => vm.updatePaymentField('method', event.target.value)}>
                  {PAYMENT_METHODS.map(method => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Reference (optional)"
                  placeholder="Check # or ACH trace"
                  value={vm.paymentForm.reference}
                  onChange={event => vm.updatePaymentField('reference', event.target.value)}
                />
              </div>
              <FormAlert message={vm.paymentError} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={vm.cancelPayment}>
                  Cancel
                </Button>
                <Button type="submit" loading={vm.paymentSaving}>
                  Save payment
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-line px-5 py-4 text-sm text-muted">Every payment on this note is recorded.</p>
      )}

      {last && (
        <div className="flex items-center justify-between gap-3 px-1 text-xs text-muted">
          <span>
            Last recorded: #{last.installmentNumber}, {formatMoney(last.amount, true)} on {formatDate(last.receivedDate)} by {last.method}
          </span>
          <button
            type="button"
            onClick={vm.undoLastPayment}
            disabled={vm.undoing}
            className="inline-flex shrink-0 items-center gap-1 font-medium text-ink hover:text-rose-700 disabled:opacity-50"
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
            {vm.undoing ? 'Undoing…' : 'Undo'}
          </button>
        </div>
      )}
    </section>
  );
}

function ActivityLog({ vm }: { vm: ViewModel }) {
  const entries = vm.selected?.activity ?? [];
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold">Activity</h3>
      <ol className="divide-y divide-line rounded-xl border border-line">
        {entries.slice(0, 12).map(entry => (
          <li key={entry.id} className="px-4 py-3 text-sm">
            <p>{entry.message}</p>
            <p className="mt-0.5 text-xs text-muted">
              {entry.actor} · {formatDate(entry.createdAt)}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NextDue({ note }: { note: ViewModel['rows'][number] }) {
  const next = nextInstallment(note);
  if (!next) return <span className="text-muted">Paid off</span>;
  if (next.status === 'overdue') return <span className="font-medium text-rose-700">{next.daysLate}d late</span>;
  return <span className="text-muted">{formatDate(next.dueDate)}</span>;
}

function NotesTable({ vm }: { vm: ViewModel }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Note</th>
              <th scope="col" className="px-5 py-3 font-medium">Investor</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Principal</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Rate</th>
              <th scope="col" className="hidden px-5 py-3 font-medium lg:table-cell">Next due</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vm.rows.map(note => (
              <tr key={note.id} onClick={() => vm.openNote(note.id)} className="cursor-pointer transition-colors hover:bg-canvas/70">
                <td className="px-5 py-4">
                  <button type="button" onClick={() => vm.openNote(note.id)} className="text-left font-medium hover:text-sage-700">
                    {placeLabel(note.property)}
                  </button>
                  <p className="mt-0.5 text-xs text-muted">
                    {note.loanNumber} · {note.borrowerName}
                  </p>
                </td>
                <td className="px-5 py-4">{note.investorName}</td>
                <td className="px-5 py-4 text-right font-medium tabular-nums">{formatMoney(note.principalAmount)}</td>
                <td className="px-5 py-4 text-right">
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    {formatRate(note.interestRate)}
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        vm.openNote(note.id, { changeRate: true });
                      }}
                      aria-label={`Change rate for ${note.loanNumber}`}
                      title="Change rate"
                      className="rounded-md p-1 text-muted transition-colors hover:bg-sand hover:text-sage-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </td>
                <td className="hidden whitespace-nowrap px-5 py-4 lg:table-cell">
                  <NextDue note={note} />
                </td>
                <td className="px-5 py-4">
                  <NoteStatusBadge status={note.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {vm.rows.map(note => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => vm.openNote(note.id)}
              className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{placeLabel(note.property)}</p>
                  {note.status !== 'active' && <NoteStatusBadge status={note.status} />}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {note.loanNumber} · {note.investorName}
                </p>
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
  );
}

function NewNoteModal({ vm }: { vm: ViewModel }) {
  const formId = 'new-note-form';
  const field = (name: keyof ViewModel['form']) => ({
    value: vm.form[name],
    onChange: (event: { target: { value: string } }) => vm.updateField(name, event.target.value),
    error: vm.formErrors[name]
  });

  return (
    <Modal
      open={vm.createOpen}
      onClose={vm.closeCreate}
      size="lg"
      title="New note"
      footer={
        <>
          <Button variant="secondary" onClick={vm.closeCreate}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={vm.creating}>
            Create note
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={vm.submitCreate} className="space-y-8">
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Terms</legend>
          <TextField label="Borrower" autoComplete="organization" {...field('borrowerName')} />
          <SelectField
            label="Investor"
            value={vm.form.investorId}
            onChange={event => vm.updateField('investorId', event.target.value)}
            error={vm.formErrors.investorId}
            disabled={vm.investorsStatus !== 'ready'}
            hint={vm.investorsStatus === 'error' ? 'Investors could not be loaded.' : undefined}
          >
            {vm.investorsStatus !== 'ready' && <option value="">Loading investors…</option>}
            {vm.investorOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.entityName ? `${option.fullName} (${option.entityName})` : option.fullName}
              </option>
            ))}
          </SelectField>
          <TextField label="Principal ($)" inputMode="decimal" placeholder="50,000" {...field('principalAmount')} />
          <TextField label="Fixed rate (%)" inputMode="decimal" {...field('interestRate')} />
          <TextField label="Term (months)" inputMode="numeric" {...field('termMonths')} />
          <TextField label="Start date" type="date" {...field('originationDate')} />
          <div className="rounded-xl bg-canvas px-4 py-3 text-sm sm:col-span-2" aria-live="polite">
            <span className="text-muted">Monthly payment </span>
            <span className="font-semibold tabular-nums">{vm.monthlyPreview === null ? '—' : formatMoney(vm.monthlyPreview, true)}</span>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-semibold">Land</legend>
          <TextField label="County" placeholder="Costilla County" {...field('county')} />
          <TextField label="State" placeholder="Colorado" {...field('state')} />
          <TextField label="Parcel APN" {...field('apn')} />
          <TextField label="Acreage" inputMode="decimal" {...field('acreage')} />
          <TextField label="Title company" {...field('titleCompany')} />
          <TextField label="Estimated value ($)" inputMode="decimal" {...field('estimatedLandValue')} />
        </fieldset>

        <FormAlert message={vm.createError} />
      </form>
    </Modal>
  );
}

export function AdminLoansView() {
  const vm = useAdminLoansViewModel();
  const summary =
    vm.status === 'ready' && vm.total > 0
      ? [pluralize(vm.total, 'note'), `${formatMoney(vm.totalPrincipal)} deployed`, vm.lateCount ? `${vm.lateCount} late` : null].filter(Boolean).join(' · ')
      : undefined;

  return (
    <>
      <PageHeader
        title="Notes"
        description={summary}
        actions={
          <Button onClick={vm.openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            New note
          </Button>
        }
      />

      {vm.status === 'error' && <ErrorState message={vm.error ?? 'We could not load notes.'} onRetry={vm.retry} />}
      {vm.status === 'loading' && <Skeleton className="h-80 w-full rounded-2xl" />}

      {vm.status === 'ready' && (
        <div className="space-y-5">
          {vm.total > 0 && (
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={vm.query}
                onChange={event => vm.setQuery(event.target.value)}
                placeholder="Search note, borrower, investor, county"
                aria-label="Search notes"
                className={cn(inputClasses, 'pl-10')}
              />
            </div>
          )}

          {vm.total === 0 ? (
            <EmptyState
              icon={<Landmark className="h-5 w-5" />}
              title="No notes yet"
              body="Create a note to assign it to an investor and generate its payment schedule."
              action={<Button onClick={vm.openCreate}>New note</Button>}
            />
          ) : vm.rows.length === 0 ? (
            <EmptyState title="No matches" body={`Nothing matches "${vm.query}".`} />
          ) : (
            <NotesTable vm={vm} />
          )}
        </div>
      )}

      <NoteDetailDrawer
        note={vm.selected}
        onClose={vm.closeNote}
        showInvestor
        rateSlot={<RateFigure vm={vm} />}
        actions={vm.rateOpen ? <RateChangePanel vm={vm} /> : <PaymentPanel vm={vm} />}
        footer={<ActivityLog vm={vm} />}
      />
      <NewNoteModal vm={vm} />
    </>
  );
}

