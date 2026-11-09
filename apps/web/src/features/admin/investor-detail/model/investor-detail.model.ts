import type { SwitcherItem } from '@/shared/ui/Switcher';
import { formatMoney } from '@/shared/lib/format';

export interface InvestorProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  entityName?: string;
  accreditedStatus: boolean;
  status: 'active' | 'invited' | 'disabled';
  createdAt: string;
  notesCount: number;
  totalInvested: number;
  monthlyIncome: number;
  latePayments: number;
}

export interface InviteResult {
  link: string;
  email: string;
  emailSent: boolean;
}

export const byName = (a: InvestorProfile, b: InvestorProfile) => a.fullName.localeCompare(b.fullName);

export function toSwitcherItems(rows: InvestorProfile[]): SwitcherItem[] {
  return rows.map(row => ({
    id: row.id,
    label: row.fullName,
    description: row.entityName || row.email,
    meta: row.status === 'invited' ? 'Invited' : formatMoney(row.totalInvested)
  }));
}

/** Previous and next investor in the list, wrapping around. */
export function neighbours(rows: InvestorProfile[], id: string) {
  const index = rows.findIndex(row => row.id === id);
  if (index < 0 || rows.length < 2) return { previous: null, next: null };
  return {
    previous: rows[(index - 1 + rows.length) % rows.length],
    next: rows[(index + 1) % rows.length]
  };
}

export const investorStatusLabel = (row: InvestorProfile) =>
  row.status === 'active' ? { label: 'Active', tone: 'positive' as const } : { label: 'Invited', tone: 'warning' as const };

