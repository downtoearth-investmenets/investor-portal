import type { BarDatum } from '@/shared/ui/charts/BarChart';
import { formatMonthLong, formatMonthShort } from '@/shared/lib/format';

/** One month of money movement, as returned by the portfolio service. */
export interface CashflowMonth {
  month: string;
  current: boolean;
  interest: number;
  principal: number;
  scheduled: number;
  late: number;
}

export const CASHFLOW_LEGEND = [
  { label: 'Interest received', tone: 'primary' as const },
  { label: 'Principal returned', tone: 'secondary' as const },
  { label: 'Scheduled', tone: 'planned' as const },
  { label: 'Late', tone: 'alert' as const }
];

export function toCashflowBars(months: CashflowMonth[]): BarDatum[] {
  return months.map(month => ({
    key: month.month,
    label: formatMonthShort(month.month),
    title: formatMonthLong(month.month) + (month.current ? ' (this month)' : ''),
    highlight: month.current,
    segments: [
      { label: 'Interest received', value: month.interest, tone: 'primary' },
      { label: 'Principal returned', value: month.principal, tone: 'secondary' },
      { label: 'Late', value: month.late, tone: 'alert' },
      { label: 'Scheduled', value: month.scheduled, tone: 'planned' }
    ]
  }));
}

/** Received in the last 12 months, used as the chart headline. */
export function trailingReceived(months: CashflowMonth[]) {
  const past = months.filter(month => month.month <= (months.find(m => m.current)?.month ?? ''));
  return past.reduce((total, month) => total + month.interest + month.principal, 0);
}

