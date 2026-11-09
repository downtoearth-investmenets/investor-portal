export type NoteStatus = 'active' | 'pending' | 'matured' | 'delinquent' | 'paid_off';
export type NoteTone = 'positive' | 'warning' | 'negative' | 'neutral' | 'info';
export type InstallmentStatus = 'paid' | 'partial' | 'overdue' | 'upcoming';

export interface PaymentRecord {
  id: number;
  installmentNumber: number;
  amount: number;
  receivedDate: string;
  method: string;
  reference?: string;
  recordedBy?: string;
  createdAt?: string;
}

export interface ScheduleItem {
  installmentNumber: number;
  dueDate: string;
  rate: number;
  paymentAmount: number;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
  status: InstallmentStatus;
  daysLate?: number;
  paidDate?: string;
  payment?: PaymentRecord;
}

export interface RateChange {
  id: number;
  rate: number;
  effectiveDate: string;
  reason: string;
  changedBy: string;
  createdAt: string;
}

export interface ActivityEntry {
  id: number;
  kind: string;
  message: string;
  actor: string;
  createdAt: string;
}

export interface NoteProperty {
  apn: string;
  county: string;
  state: string;
  acreage: number;
  propertyAddress?: string;
  titleCompany?: string;
  estimatedLandValue?: number;
}

export interface Note {
  id: string;
  loanNumber: string;
  borrowerName: string;
  principalAmount: number;
  interestRate: number;
  originalRate: number;
  termMonths: number;
  originationDate: string;
  maturityDate: string;
  monthlyPayment: number;
  status: NoteStatus;
  overdueCount: number;
  investorId: string;
  investorName?: string;
  property: NoteProperty;
  schedule: ScheduleItem[];
  rateHistory: RateChange[];
  lastPayment: PaymentRecord | null;
  /** Admin only; the gateway removes it for investors. */
  activity?: ActivityEntry[];
}

const STATUS: Record<NoteStatus, { label: string; tone: NoteTone }> = {
  active: { label: 'Active', tone: 'positive' },
  pending: { label: 'Pending', tone: 'warning' },
  matured: { label: 'Matured', tone: 'info' },
  delinquent: { label: 'Late', tone: 'negative' },
  paid_off: { label: 'Paid off', tone: 'neutral' }
};

export const noteStatus = (status: string) => STATUS[status as NoteStatus] ?? { label: status, tone: 'neutral' as NoteTone };

export const placeLabel = (place: { county?: string; state?: string }) => [place.county, place.state].filter(Boolean).join(', ');

export const isSettled = (item: ScheduleItem) => Boolean(item.payment);

export function noteProgress(note: Note) {
  const settled = note.schedule.filter(isSettled);
  const balance = settled.length ? settled[settled.length - 1].remainingBalance : note.principalAmount;
  const total = note.schedule.length;
  return {
    paidCount: settled.length,
    total,
    principalRepaid: note.principalAmount - balance,
    balance,
    ratio: total > 0 ? settled.length / total : 0
  };
}

export const nextInstallment = (note: Note) => note.schedule.find(item => !isSettled(item)) ?? null;

/** Rate changes after the original note rate, newest first. */
export const rateChanges = (note: Note) => note.rateHistory.slice(1).reverse();

export function loanToValue(note: Note): number | null {
  const value = note.property.estimatedLandValue ?? 0;
  return value > 0 ? note.principalAmount / value : null;
}

export function monthlyPayment(principal: number, annualRatePercent: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const monthlyRate = annualRatePercent / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
}

/** Payment amount if a new rate starts with the given installment. Mirrors the loan service. */
export function paymentFromInstallment(note: Note, installmentNumber: number, rate: number): number {
  const previous = note.schedule.find(item => item.installmentNumber === installmentNumber - 1);
  const balance = previous ? previous.remainingBalance : note.principalAmount;
  return monthlyPayment(balance, rate, note.termMonths - installmentNumber + 1);
}

export function matchesNoteQuery(note: Note, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [note.loanNumber, note.borrowerName, note.investorName, note.property.county, note.property.state, note.property.apn]
    .filter(Boolean)
    .some(value => String(value).toLowerCase().includes(needle));
}

