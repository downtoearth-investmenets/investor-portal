import { BrandMark } from '@/shared/ui/Brand';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import { formatCell, isNumeric, type ReportDocument } from '../model/report.model';

/** The report as a printable document. Also what "Save as PDF" prints. */
export function ReportDocumentView({ report }: { report: ReportDocument }) {
  return (
    <article className="text-ink">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10 rounded-2xl print:[-webkit-print-color-adjust:exact]" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Down to Earth Investments</p>
            <p className="text-xs text-muted">Secured land notes</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          <p>Generated {formatDate(report.generatedAt)}</p>
          {report.generatedBy && <p>by {report.generatedBy}</p>}
        </div>
      </header>

      <div className="mt-8">
        <h2 className="text-2xl font-semibold tracking-tight">{report.title}</h2>
        <p className="mt-1 text-sm text-muted">
          {[report.subject, report.period ? `${formatDate(report.period.from)} – ${formatDate(report.period.to)}` : 'As of ' + formatDate(report.generatedAt)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-line py-6 sm:grid-cols-3 lg:grid-cols-6 print:grid-cols-6">
        {report.summary.map(item => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{item.label}</dt>
            <dd className="mt-1 truncate text-lg font-semibold tabular-nums">{formatCell(item.value, item.kind)}</dd>
          </div>
        ))}
      </dl>

      {report.sections.map(section => (
        <section key={section.title} className="mt-10 break-inside-avoid-page">
          <h3 className="mb-3 text-sm font-semibold">{section.title}</h3>
          {section.rows.length === 0 ? (
            <p className="border-y border-line py-6 text-center text-sm text-muted">{section.empty ?? 'Nothing to show.'}</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[640px] text-left text-[13px] print:min-w-0 print:text-[10px]">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-[0.06em] text-muted">
                    {section.columns.map(column => (
                      <th key={column.key} scope="col" className={cn('whitespace-nowrap px-2 py-2.5 font-medium first:pl-0 last:pr-0', isNumeric(column.kind) && 'text-right')}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {section.rows.map((row, index) => (
                    <tr key={index} className="break-inside-avoid">
                      {section.columns.map(column => (
                        <td
                          key={column.key}
                          className={cn('px-2 py-2.5 first:pl-0 last:pr-0', isNumeric(column.kind) ? 'whitespace-nowrap text-right tabular-nums' : 'max-w-[220px] truncate')}
                        >
                          {formatCell(row[column.key], column.kind)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {section.totals && (
                  <tfoot>
                    <tr className="border-t-2 border-ink/80 font-semibold">
                      {section.columns.map((column, index) => (
                        <td key={column.key} className={cn('px-2 py-3 first:pl-0 last:pr-0', isNumeric(column.kind) && 'text-right tabular-nums')}>
                          {index === 0 ? 'Total' : column.key in section.totals! ? formatCell(section.totals![column.key], column.kind) : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      ))}

      <footer className="mt-12 border-t border-line pt-4 text-[11px] text-muted">
        Figures come from payments recorded in the Down to Earth portal. Contact your portal administrator with any questions.
      </footer>
    </article>
  );
}

