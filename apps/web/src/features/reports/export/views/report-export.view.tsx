'use client';

import { CalendarRange, FileSpreadsheet, FileText, Landmark, ListChecks, Printer, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { SelectField, TextField } from '@/shared/ui/Field';
import { Eyebrow } from '@/shared/ui/Metric';
import { ErrorState, Skeleton } from '@/shared/ui/States';
import { cn } from '@/shared/lib/cn';
import type { ReportType } from '../model/report.model';
import { useReportExportViewModel } from '../view-models/use-report-export.vm';
import { ReportDocumentView } from './ReportDocumentView';

type ViewModel = ReturnType<typeof useReportExportViewModel>;

const ICONS: Record<ReportType, LucideIcon> = {
  statement: FileText,
  payments: ListChecks,
  schedule: CalendarRange,
  portfolio: Landmark,
  investors: Users
};

function ReportPicker({ vm }: { vm: ViewModel }) {
  return (
    <fieldset>
      <legend className="sr-only">Report</legend>
      <Eyebrow>Report</Eyebrow>
      <div className="space-y-1">
        {vm.options.map(option => {
          const Icon = ICONS[option.type];
          const selected = option.type === vm.option.type;
          return (
            <label
              key={option.type}
              className={cn(
                'group relative flex cursor-pointer gap-4 rounded-2xl px-4 py-3.5 transition-colors duration-200',
                selected ? 'bg-forest text-white' : 'hover:bg-sand/70'
              )}
            >
              <input type="radio" name="report-type" value={option.type} checked={selected} onChange={() => vm.chooseType(option)} className="sr-only" />
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors',
                  selected ? 'bg-sage-200 text-forest' : 'bg-sand text-muted group-hover:text-ink'
                )}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.title}</span>
                <span className={cn('mt-0.5 block text-xs leading-relaxed', selected ? 'text-white/60' : 'text-muted')}>{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PeriodPicker({ vm }: { vm: ViewModel }) {
  if (vm.presets.length === 0) return null;
  return (
    <fieldset>
      <legend className="sr-only">Period</legend>
      <Eyebrow>Period</Eyebrow>
      <div className="flex flex-wrap gap-2">
        {vm.presets.map(preset => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={vm.preset === preset.id}
            onClick={() => vm.choosePreset(preset.id)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200',
              vm.preset === preset.id ? 'border-sage-600 bg-sage-600 text-white' : 'border-line text-muted hover:border-sage-200 hover:text-ink'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {vm.preset === 'custom' && (
        <div className="mt-4 grid animate-pop-in grid-cols-2 gap-3">
          <TextField label="From" type="date" value={vm.custom.from} onChange={event => vm.setCustomFrom(event.target.value)} />
          <TextField label="To" type="date" value={vm.custom.to} onChange={event => vm.setCustomTo(event.target.value)} />
        </div>
      )}
      {vm.rangeError && <p className="mt-2 text-xs text-rose-600">{vm.rangeError}</p>}
    </fieldset>
  );
}

function InvestorPicker({ vm }: { vm: ViewModel }) {
  if (vm.audience !== 'admin' || !['statement', 'payments', 'schedule'].includes(vm.option.type)) return null;
  return (
    <SelectField
      label={vm.option.needsInvestor ? 'Investor' : 'Investor (optional)'}
      value={vm.investorId}
      onChange={event => vm.setInvestorId(event.target.value)}
      disabled={vm.investorsStatus !== 'ready'}
    >
      <option value="">{vm.option.needsInvestor ? 'Choose an investor…' : 'All investors'}</option>
      {vm.investorOptions.map(investor => (
        <option key={investor.id} value={investor.id}>
          {investor.entityName ? `${investor.fullName} (${investor.entityName})` : investor.fullName}
        </option>
      ))}
    </SelectField>
  );
}

function Preview({ vm }: { vm: ViewModel }) {
  if (vm.needsChoice) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-dashed border-line text-center print:!hidden">
        <div>
          <FileText className="mx-auto h-8 w-8 text-muted" aria-hidden />
          <p className="mt-3 font-medium">Choose an investor</p>
          <p className="mt-1 text-sm text-muted">The statement preview appears here.</p>
        </div>
      </div>
    );
  }
  if (vm.status === 'error') return <ErrorState message={vm.error ?? 'We could not build this report.'} onRetry={vm.retry} />;
  if (!vm.report) {
    return (
      <div className="space-y-4 rounded-[28px] bg-surface p-10 shadow-card print:!hidden">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  return (
    <div
      id="report-print"
      className={cn(
        'rounded-[28px] bg-surface p-6 shadow-card transition-opacity duration-300 sm:p-10 print:rounded-none print:p-0 print:shadow-none',
        vm.status === 'loading' && 'opacity-60'
      )}
    >
      <ReportDocumentView report={vm.report} />
    </div>
  );
}

export function ReportExportView() {
  const vm = useReportExportViewModel();

  return (
    <>
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:!hidden">
        <div>
          <p className="text-sm text-muted">Export</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Reports</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={vm.downloadCsv} disabled={!vm.canExport} loading={vm.downloading}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Download CSV
          </Button>
          <Button onClick={vm.savePdf} disabled={!vm.canExport}>
            <Printer className="h-4 w-4" aria-hidden />
            Save as PDF
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-x-14 gap-y-10 xl:grid-cols-12 print:block">
        <aside className="space-y-10 xl:sticky xl:top-10 xl:col-span-4 2xl:col-span-3 print:!hidden">
          <ReportPicker vm={vm} />
          <PeriodPicker vm={vm} />
          <InvestorPicker vm={vm} />
          <p className="text-xs leading-relaxed text-muted">
            CSV opens in Excel or Google Sheets. Save as PDF opens your browser&apos;s print dialog; choose &ldquo;Save as PDF&rdquo; as the printer.
          </p>
        </aside>
        <div className="min-w-0 xl:col-span-8 2xl:col-span-9">
          <Preview vm={vm} />
        </div>
      </div>
    </>
  );
}

