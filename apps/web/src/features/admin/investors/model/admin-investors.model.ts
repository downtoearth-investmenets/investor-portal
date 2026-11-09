export interface InvestorRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  entityName?: string;
  accreditedStatus: boolean;
  status: 'active' | 'invited' | 'disabled';
  inviteAccepted: boolean;
  createdAt: string;
  notesCount: number;
  totalInvested: number;
  monthlyIncome: number;
  latePayments: number;
}

export interface InviteResult {
  name: string;
  email: string;
  link: string;
  emailSent: boolean;
}

export interface NewInvestorForm {
  fullName: string;
  email: string;
  phone: string;
  entityName: string;
  accredited: boolean;
}

export type NewInvestorErrors = Partial<Record<'fullName' | 'email', string>>;

export const EMPTY_INVESTOR_FORM: NewInvestorForm = { fullName: '', email: '', phone: '', entityName: '', accredited: true };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateNewInvestor(form: NewInvestorForm): NewInvestorErrors {
  const errors: NewInvestorErrors = {};
  if (!form.fullName.trim()) errors.fullName = 'Enter the investor name.';
  if (!form.email.trim()) errors.email = 'Enter an email address.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  return errors;
}

export function filterInvestors(rows: InvestorRow[], query: string): InvestorRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(row => [row.fullName, row.email, row.entityName].filter(Boolean).some(value => String(value).toLowerCase().includes(needle)));
}

export const investorStatus = (row: InvestorRow) =>
  row.status === 'active' ? { label: 'Active', tone: 'positive' as const } : { label: 'Invited', tone: 'warning' as const };

export const isAwaitingSetup = (row: InvestorRow) => row.status === 'invited';
