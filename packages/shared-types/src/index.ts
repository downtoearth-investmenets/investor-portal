
export type UserRole = 'admin' | 'investor';

export type UserStatus = 'active' | 'invited' | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  status: UserStatus;
  createdAt: string;
  investorProfileId?: string;
}

export interface InvestorProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  entityName?: string;
  taxIdMasked?: string;
  bankingInstructions?: string;
  accreditedStatus: boolean;
  totalInvested: number;
  activeNotesCount: number;
  inviteToken?: string;
  inviteAccepted: boolean;
  createdAt: string;
}

export type LoanStatus = 'active' | 'pending' | 'matured' | 'delinquent' | 'paid_off';

export interface PropertyDetails {
  apn: string; // Assessor Parcel Number
  county: string;
  state: string;
  acreage: number;
  propertyAddress?: string;
  titleCompany: string;
  escrowNumber?: string;
  zoning?: string;
  estimatedLandValue: number;
}

export interface AmortizationScheduleItem {
  installmentNumber: number;
  dueDate: string;
  paymentAmount: number;
  principalComponent: number;
  interestComponent: number;
  remainingBalance: number;
  status: 'paid' | 'upcoming' | 'overdue';
  paidDate?: string;
}

export interface Loan {
  id: string;
  loanNumber: string; // e.g., DTE-NOTE-2026-004
  borrowerName: string;
  borrowerContact?: string;
  principalAmount: number;
  interestRate: number; // e.g. 11.5%
  termMonths: number;
  originationDate: string;
  maturityDate: string;
  monthlyPayment: number;
  status: LoanStatus;
  property: PropertyDetails;
  investorId: string; // The assigned investor
  investorName?: string;
  notes?: string;
  schedule: AmortizationScheduleItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminDashboardMetrics {
  totalAum: number; // Total active capital managed
  totalActiveNotes: number;
  blendedYield: number; // Weighted average interest rate %
  monthlyProjectedInflow: number;
  delinquentCount: number;
  watchlistCount: number;
  totalInvestors: number;
  recentActivity: {
    id: string;
    type: 'payment_received' | 'investor_created' | 'note_originated';
    description: string;
    timestamp: string;
    amount?: number;
  }[];
}

export interface InvestorDashboardMetrics {
  investorId: string;
  totalDeployed: number;
  activeNotesCount: number;
  blendedAnnualYield: number;
  nextPayoutDate: string;
  nextPayoutAmount: number;
  totalInterestCollectedYtd: number;
  totalPrincipalReturnedYtd: number;
}

export interface CreateInvestorDTO {
  fullName: string;
  email: string;
  phone: string;
  entityName?: string;
  taxIdMasked?: string;
  bankingInstructions?: string;
  accreditedStatus?: boolean;
}

export interface CreateLoanDTO {
  loanNumber?: string;
  borrowerName: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  originationDate: string;
  investorId: string;
  property: PropertyDetails;
  notes?: string;
}

export interface RecordPaymentDTO {
  loanId: string;
  installmentNumber: number;
  amountPaid: number;
  paidDate: string;
  referenceNumber?: string;
}

