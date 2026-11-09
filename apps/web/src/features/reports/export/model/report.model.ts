import { formatDate, formatMoney, formatRate } from '@/shared/lib/format';

export type ReportType = 'statement' | 'payments' | 'schedule' | 'portfolio' | 'investors';
export type ColumnKind = 'text' | 'money' | 'percent' | 'date' | 'number';
export type Audience = 'admin' | 'investor';
type PeriodStyle = 'past' | 'future' | 'none';

export interface ReportColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number>;
  empty?: string;
}

export interface ReportDocument {
  type: ReportType;
  title: string;
  subject: string;
  period: { from: string; to: string } | null;
  generatedAt: string;
  generatedBy: string;
  summary: { label: string; value: number; kind: ColumnKind }[];
  sections: ReportSection[];
}

export interface ReportOption {
  type: ReportType;
  title: string;
  description: string;
  period: PeriodStyle;
  needsInvestor: boolean;
  audience: Audience[];
}

export const REPORT_OPTIONS: ReportOption[] = [
  { type: 'statement', title: 'Investor statement', description: 'Notes, balances, and payments received for one investor.', period: 'past', needsInvestor: true, audience: ['admin', 'investor'] },
  { type: 'payments', title: 'Payments received', description: 'Every payment recorded in the period, split into interest and principal.', period: 'past', needsInvestor: false, audience: ['admin', 'investor'] },
  { type: 'schedule', title: 'Payment schedule', description: 'Payments coming due, plus anything already late.', period: 'future', needsInvestor: false, audience: ['admin', 'investor'] },
  { type: 'portfolio', title: 'Note register', description: 'All notes with land, terms, balances, and status.', period: 'none', needsInvestor: false, audience: ['admin'] },
  { type: 'investors', title: 'Investor summary', description: 'Each investor with capital, balance, income, and interest paid.', period: 'past', needsInvestor: false, audience: ['admin'] }
];

export const optionsFor = (audience: Audience) => REPORT_OPTIONS.filter(option => option.audience.includes(audience));

// ---------- periods ----------

export interface PeriodPreset {
  id: string;
  label: string;
}

const PRESETS: Record<Exclude<PeriodStyle, 'none'>, PeriodPreset[]> = {
  past: [
    { id: 'this-month', label: 'This month' },
    { id: 'last-month', label: 'Last month' },
    { id: 'ytd', label: 'Year to date' },
    { id: 'last-year', label: 'Last year' },
    { id: 'custom', label: 'Custom' }
  ],
  future: [
    { id: 'next-30', label: 'Next 30 days' },
    { id: 'next-90', label: 'Next 90 days' },
    { id: 'next-12m', label: 'Next 12 months' },
    { id: 'custom', label: 'Custom' }
  ]
};

export const presetsFor = (option: ReportOption) => (option.period === 'none' ? [] : PRESETS[option.period]);
export const defaultPreset = (option: ReportOption) => (option.period === 'future' ? 'next-90' : option.period === 'past' ? 'ytd' : 'none');

const iso = (date: Date) => date.toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));

export function presetRange(preset: string, today: Date): { from: string; to: string } | null {
  // Use the viewer's calendar day, then do the arithmetic in UTC so DST never shifts it.
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const days = (n: number) => iso(utc(y, m, d + n));
  switch (preset) {
    case 'this-month':
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m, d)) };
    case 'last-month':
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case 'ytd':
      return { from: iso(utc(y, 0, 1)), to: iso(utc(y, m, d)) };
    case 'last-year':
      return { from: iso(utc(y - 1, 0, 1)), to: iso(utc(y - 1, 11, 31)) };
    case 'next-30':
      return { from: days(0), to: days(30) };
    case 'next-90':
      return { from: days(0), to: days(90) };
    case 'next-12m':
      return { from: days(0), to: iso(utc(y + 1, m, d)) };
    default:
      return null;
  }
}

export function periodProblem(from: string, to: string): string | null {
  if (!from || !to) return 'Choose a start and end date.';
  if (from > to) return 'The start date must be before the end date.';
  return null;
}

export function reportQuery(params: { type: ReportType; from?: string; to?: string; investorId?: string; format?: 'csv' }) {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.investorId) query.set('investorId', params.investorId);
  if (params.format) query.set('format', params.format);
  const now = new Date();
  query.set('today', iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))));
  const qs = query.toString();
  return `/reports/${params.type}${qs ? `?${qs}` : ''}`;
}

// ---------- display ----------

export function formatCell(value: string | number | null | undefined, kind: ColumnKind): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (kind) {
    case 'money':
      return formatMoney(Number(value), true);
    case 'percent':
      return formatRate(Number(value));
    case 'date':
      return formatDate(String(value));
    default:
      return String(value);
  }
}

export const isNumeric = (kind: ColumnKind) => kind === 'money' || kind === 'percent' || kind === 'number';

