import { placeLabel, type Note } from '@/features/notes';
import { DONUT_COLORS, type DonutSlice } from '@/shared/ui/charts/DonutChart';
import type { CashflowMonth } from './cashflow.model';

export interface NextPayment {
  date: string;
  amount: number;
  loanId: string;
  loanNumber: string;
  daysLate: number;
}

export interface ReceivedPayment {
  loanId: string;
  loanNumber: string;
  county?: string;
  state?: string;
  installmentNumber: number;
  amount: number;
  receivedDate: string;
  method: string;
}

/** One investor's position, as returned by the portfolio service. */
export interface InvestorSummary {
  totalInvested: number;
  outstandingBalance: number;
  activeNotes: number;
  averageRate: number;
  monthlyIncome: number;
  interestEarned: number;
  principalRepaid: number;
  nextPayment: NextPayment | null;
  recentPayments: ReceivedPayment[];
  cashflow: CashflowMonth[];
}

export interface AllocationRow extends DonutSlice {
  id: string;
  share: number;
}

export function allocationByNote(notes: Note[]): AllocationRow[] {
  const total = notes.reduce((sum, note) => sum + note.principalAmount, 0);
  return [...notes]
    .sort((a, b) => b.principalAmount - a.principalAmount)
    .map((note, index) => ({
      id: note.id,
      label: placeLabel(note.property),
      value: note.principalAmount,
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      share: total > 0 ? note.principalAmount / total : 0
    }));
}

export const repaidShare = (summary: InvestorSummary) =>
  summary.totalInvested > 0 ? (summary.totalInvested - summary.outstandingBalance) / summary.totalInvested : 0;

