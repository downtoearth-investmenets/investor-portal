'use client';

import Link from 'next/link';
import { ArrowUpRight, Check, ChevronRight, Copy, Download, Mail, Search, UserPlus, Users } from 'lucide-react';
import { placeLabel } from '@/features/notes';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonClasses } from '@/shared/ui/Button';
import { Drawer } from '@/shared/ui/Drawer';
import { CheckboxField, TextField, inputClasses } from '@/shared/ui/Field';
import { Modal } from '@/shared/ui/Modal';
import { PageHeader } from '@/shared/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/States';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatMoney, formatRate, pluralize } from '@/shared/lib/format';
import { investorStatus, isAwaitingSetup, type InvestorRow } from '../model/admin-investors.model';
import { useAdminInvestorsViewModel } from '../view-models/use-admin-investors.vm';

type ViewModel = ReturnType<typeof useAdminInvestorsViewModel>;

function StatusBadge({ row }: { row: InvestorRow }) {
  const { label, tone } = investorStatus(row);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={tone}>{label}</Badge>
      {row.latePayments > 0 && <Badge tone="negative">{row.latePayments} late</Badge>}
    </span>
  );
}

function InviteLinkField({ id, link, copied, onCopy }: { id: string; link: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex gap-2">
      <input id={id} readOnly value={link} onFocus={event => event.target.select()} className={cn(inputClasses, 'font-mono text-xs')} />
      <Button variant="secondary" onClick={onCopy} aria-label="Copy invite link">
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

function InvestorTable({ vm }: { vm: ViewModel }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-canvas/60 text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Investor</th>
              <th scope="col" className="px-5 py-3 font-medium">Email</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Notes</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Invested</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              <th scope="col" className="w-14 px-3 py-3">
                <span className="sr-only">Open page</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {vm.rows.map(row => (
              <tr key={row.id} onClick={() => vm.openInvestor(row.id)} className="cursor-pointer transition-colors hover:bg-canvas/70">
                <td className="px-5 py-4">
                  <button type="button" onClick={() => vm.openInvestor(row.id)} className="text-left font-medium hover:text-sage-700">
                    {row.fullName}
                  </button>
                  {row.entityName && <p className="mt-0.5 text-xs text-muted">{row.entityName}</p>}
                </td>
                <td className="px-5 py-4 text-muted">{row.email}</td>
                <td className="px-5 py-4 text-right tabular-nums">{row.notesCount}</td>
                <td className="px-5 py-4 text-right font-medium tabular-nums">{formatMoney(row.totalInvested)}</td>
                <td className="px-5 py-4">
                  <StatusBadge row={row} />
                </td>
                <td className="px-3 py-4 text-right">
                  <Link
                    href={`/admin/investors/${encodeURIComponent(row.id)}`}
                    onClick={event => event.stopPropagation()}
                    aria-label={`Open ${row.fullName}'s page`}
                    title="Open page"
                    className="inline-grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-sand hover:text-ink"
                  >
                    <ArrowUpRight className="h-4 w-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {vm.rows.map(row => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => vm.openInvestor(row.id)}
              className="flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left shadow-card"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{row.fullName}</p>
                  <StatusBadge row={row} />
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{row.entityName || row.email}</p>
                <p className="mt-3 text-sm tabular-nums">
                  {formatMoney(row.totalInvested)} <span className="text-muted">· {pluralize(row.notesCount, 'note')}</span>
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

function InvestorDrawer({ vm }: { vm: ViewModel }) {
  const investor = vm.selected;
  return (
    <Drawer open={Boolean(investor)} onClose={vm.closeInvestor} title={investor?.fullName ?? ''} subtitle={investor?.entityName || investor?.email}>
      {investor && (
        <div className="space-y-8">
          <section className="grid grid-cols-3 gap-3">
            {[
              ['Invested', formatMoney(investor.totalInvested)],
              ['Monthly', formatMoney(investor.monthlyIncome)],
              ['Notes', String(investor.notesCount)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-canvas px-4 py-3.5">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-2 gap-3">
            <Link href={`/admin/investors/${encodeURIComponent(investor.id)}`} className={buttonClasses('primary', 'md', 'w-full')}>
              View full profile
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href={`/admin/reports?type=statement&investor=${encodeURIComponent(investor.id)}`} className={buttonClasses('secondary', 'md', 'w-full')}>
              <Download className="h-4 w-4" aria-hidden />
              Statement
            </Link>
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold">Contact</h3>
            <dl className="divide-y divide-line rounded-xl border border-line text-sm">
              {[
                ['Email', investor.email],
                ['Phone', investor.phone || '—'],
                ['Entity', investor.entityName || 'Individual'],
                ['Accredited', investor.accreditedStatus ? 'Yes' : 'No'],
                ['Added', formatDate(investor.createdAt)]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6 px-4 py-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-6 px-4 py-3">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge row={investor} />
                </dd>
              </div>
            </dl>
          </section>

          {isAwaitingSetup(investor) && (
            <section className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Waiting for setup</h3>
                  <p className="mt-0.5 text-xs text-muted">They have not chosen a password yet.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={vm.resendInvite} loading={vm.resending}>
                  <Mail className="h-4 w-4" aria-hidden />
                  Resend invite
                </Button>
              </div>
              {vm.resent && (
                <div className="space-y-2">
                  <p className="text-xs text-muted">
                    {vm.resent.emailSent
                      ? `Emailed to ${vm.resent.email}. The earlier link no longer works.`
                      : "Email isn't set up yet, so send this link yourself. The earlier link no longer works."}
                  </p>
                  <InviteLinkField id="resent-invite-link" link={vm.resent.link} copied={vm.copied} onCopy={vm.copyResent} />
                </div>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-3 text-sm font-semibold">Notes</h3>
            {vm.selectedNotesStatus === 'loading' && <Skeleton className="h-24 rounded-xl" />}
            {vm.selectedNotesStatus === 'ready' && vm.selectedNotes.length === 0 && (
              <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No notes assigned yet.</p>
            )}
            {vm.selectedNotes.length > 0 && (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {vm.selectedNotes.map(note => (
                  <li key={note.id}>
                    <Link href={`/admin/loans?note=${note.id}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-canvas/70">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{placeLabel(note.property)}</p>
                        <p className="text-xs text-muted">{note.loanNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium tabular-nums">{formatMoney(note.principalAmount)}</p>
                        <p className="text-xs text-muted">{formatRate(note.interestRate)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

function AddInvestorModal({ vm }: { vm: ViewModel }) {
  const formId = 'new-investor-form';

  if (vm.invite) {
    return (
      <Modal
        open={vm.createOpen}
        onClose={vm.closeCreate}
        title={`${vm.invite.name} was added`}
        description={
          vm.invite.emailSent
            ? `We emailed an invite to ${vm.invite.email}. It works for 7 days.`
            : "Email isn't set up yet, so send this link yourself. It works for 7 days."
        }
        footer={<Button onClick={vm.closeCreate}>Done</Button>}
      >
        <label htmlFor="invite-link" className="mb-1.5 block text-sm font-medium">
          Invite link
        </label>
        <InviteLinkField id="invite-link" link={vm.invite.link} copied={vm.copied} onCopy={vm.copyInvite} />
      </Modal>
    );
  }

  return (
    <Modal
      open={vm.createOpen}
      onClose={vm.closeCreate}
      title="Add investor"
      footer={
        <>
          <Button variant="secondary" onClick={vm.closeCreate}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={vm.creating}>
            Add investor
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={vm.submitCreate} className="grid gap-4 sm:grid-cols-2">
        <TextField
          className="sm:col-span-2"
          label="Full name"
          autoComplete="name"
          value={vm.form.fullName}
          onChange={event => vm.updateField('fullName', event.target.value)}
          error={vm.formErrors.fullName}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={vm.form.email}
          onChange={event => vm.updateField('email', event.target.value)}
          error={vm.formErrors.email}
        />
        <TextField label="Phone" type="tel" autoComplete="tel" value={vm.form.phone} onChange={event => vm.updateField('phone', event.target.value)} />
        <TextField
          className="sm:col-span-2"
          label="Trust or entity"
          hint="Leave blank for an individual investor."
          value={vm.form.entityName}
          onChange={event => vm.updateField('entityName', event.target.value)}
        />
        <CheckboxField
          className="sm:col-span-2"
          label="Accredited investor"
          checked={vm.form.accredited}
          onChange={event => vm.updateField('accredited', event.target.checked)}
        />
        {vm.createError && (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2">
            {vm.createError}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function AdminInvestorsView() {
  const vm = useAdminInvestorsViewModel();

  return (
    <>
      <PageHeader
        title="Investors"
        description={vm.status === 'ready' ? pluralize(vm.total, 'account') : undefined}
        actions={
          <Button onClick={vm.openCreate}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add investor
          </Button>
        }
      />

      {vm.status === 'error' && <ErrorState message={vm.error ?? 'We could not load investors.'} onRetry={vm.retry} />}
      {vm.status === 'loading' && <Skeleton className="h-72 w-full rounded-2xl" />}

      {vm.status === 'ready' && (
        <div className="space-y-5">
          {vm.total > 0 && (
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={vm.query}
                onChange={event => vm.setQuery(event.target.value)}
                placeholder="Search name, email, or entity"
                aria-label="Search investors"
                className={cn(inputClasses, 'pl-10')}
              />
            </div>
          )}

          {vm.total === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="No investors yet"
              body="Add an investor to send them an invite."
              action={<Button onClick={vm.openCreate}>Add investor</Button>}
            />
          ) : vm.rows.length === 0 ? (
            <EmptyState title="No matches" body={`Nothing matches "${vm.query}".`} />
          ) : (
            <InvestorTable vm={vm} />
          )}
        </div>
      )}

      <InvestorDrawer vm={vm} />
      <AddInvestorModal vm={vm} />
    </>
  );
}
