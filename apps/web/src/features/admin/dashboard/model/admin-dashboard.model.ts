import type { CashflowMonth } from '@/features/portfolio';
import { DONUT_COLORS, type DonutSlice } from '@/shared/ui/charts/DonutChart';

export interface UpcomingPayment {
  loanId: string;
  loanNumber: string;
  investorName?: string;
  county?: string;
  state?: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  daysLate: number;
}

export interface RecentNote {
  id: string;
  loanNumber: string;
  borrowerName: string;
  investorName?: string;
  county?: string;
  state?: string;
  principalAmount: number;
  interestRate: number;
  status: string;
}

export interface AdminOverview {
  totalPrincipal: number;
  outstandingBalance: number;
  activeNotes: number;
  averageRate: number;
  monthlyInflow: number;
  collectedThisMonth: number;
  investorCount: number;
  overduePayments: UpcomingPayment[];
  upcomingPayments: UpcomingPayment[];
  recentNotes: RecentNote[];
  allocation: { label: string; value: number }[];
  cashflow: CashflowMonth[];
}

export function allocationSlices(rows: AdminOverview['allocation']): (DonutSlice & { share: number })[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row, index) => ({ ...row, color: DONUT_COLORS[index % DONUT_COLORS.length], share: total > 0 ? row.value / total : 0 }));
}

export const collectedRatio = (overview: AdminOverview) =>
  overview.monthlyInflow > 0 ? Math.min(overview.collectedThisMonth / overview.monthlyInflow, 1) : 0;
