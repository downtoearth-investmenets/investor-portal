import { isSettled, matchesNoteQuery, monthlyPayment, nextInstallment, paymentFromInstallment, type Note } from '@/features/notes';

export interface InvestorOption {
  id: string;
  fullName: string;
  entityName?: string;
}

export interface NewNoteForm {
  borrowerName: string;
  investorId: string;
  principalAmount: string;
  interestRate: string;
  termMonths: string;
  originationDate: string;
  county: string;
  state: string;
  apn: string;
  acreage: string;
  titleCompany: string;
  estimatedLandValue: string;
}

export type NewNoteErrors = Partial<Record<keyof NewNoteForm, string>>;

export interface CreateNotePayload {
  borrowerName: string;
  investorId: string;
  investorName: string;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  originationDate: string;
  property: {
    apn: string;
    county: string;
    state: string;
    acreage: number;
    titleCompany: string;
    estimatedLandValue: number;
  };
}

const toNumber = (value: string) => Number(String(value).replace(/[$,\s%]/g, ''));

function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export const emptyNoteForm = (investorId = ''): NewNoteForm => ({
  borrowerName: '',
  investorId,
  principalAmount: '',
  interestRate: '11.5',
  termMonths: '36',
  originationDate: todayIso(),
  county: '',
  state: '',
  apn: '',
  acreage: '',
  titleCompany: '',
  estimatedLandValue: ''
});

export function validateRate(value: string): string | null {
  const rate = toNumber(value);
  if (!value.trim() || !Number.isFinite(rate)) return 'Enter a rate.';
  if (rate < 1 || rate > 30) return 'Use a rate between 1% and 30%.';
  return null;
}

export function validateNoteForm(form: NewNoteForm): NewNoteErrors {
  const errors: NewNoteErrors = {};
  const principal = toNumber(form.principalAmount);
  const term = toNumber(form.termMonths);

  if (!form.borrowerName.trim()) errors.borrowerName = 'Enter the borrower.';
  if (!form.investorId) errors.investorId = 'Choose an investor.';
  if (!form.principalAmount.trim() || !Number.isFinite(principal) || principal <= 0) errors.principalAmount = 'Enter an amount above $0.';

  const rateError = validateRate(form.interestRate);
  if (rateError) errors.interestRate = rateError;

  if (!Number.isInteger(term) || term < 1 || term > 360) errors.termMonths = 'Use 1 to 360 months.';
  if (!form.originationDate) errors.originationDate = 'Choose a start date.';
  if (!form.county.trim()) errors.county = 'Enter the county.';
  if (!form.state.trim()) errors.state = 'Enter the state.';
  if (!form.apn.trim()) errors.apn = 'Enter the parcel APN.';

  if (form.acreage.trim() && !(toNumber(form.acreage) > 0)) errors.acreage = 'Enter a positive number.';
  if (form.estimatedLandValue.trim() && !(toNumber(form.estimatedLandValue) > 0)) errors.estimatedLandValue = 'Enter an amount above $0.';
  return errors;
}

export function toCreatePayload(form: NewNoteForm, investorName: string): CreateNotePayload {
  return {
    borrowerName: form.borrowerName.trim(),
    investorId: form.investorId,
    investorName,
    principalAmount: toNumber(form.principalAmount),
    interestRate: toNumber(form.interestRate),
    termMonths: toNumber(form.termMonths),
    originationDate: form.originationDate,
    property: {
      apn: form.apn.trim(),
      county: form.county.trim(),
      state: form.state.trim(),
      acreage: toNumber(form.acreage) || 0,
      titleCompany: form.titleCompany.trim(),
      estimatedLandValue: toNumber(form.estimatedLandValue) || 0
    }
  };
}

export function previewMonthlyPayment(form: NewNoteForm): number | null {
  const principal = toNumber(form.principalAmount);
  const rate = toNumber(form.interestRate);
  const term = toNumber(form.termMonths);
  if (!(principal > 0) || validateRate(form.interestRate) || !Number.isInteger(term) || term < 1) return null;
  return monthlyPayment(principal, rate, term);
}

export const filterNotes = (notes: Note[], query: string) => notes.filter(note => matchesNoteQuery(note, query));

// ---------- rate changes ----------

export interface RateChangeForm {
  rate: string;
  /** Installment number the new rate starts with. */
  startsWith: string;
  reason: string;
}

export type RateChangeErrors = Partial<Record<keyof RateChangeForm, string>>;

export interface RateChangePayload {
  interestRate: number;
  effectiveDate: string;
  reason: string;
}

/** Unpaid installments the new rate can start from. Paid ones are locked. */
export const rateStartOptions = (note: Note) => note.schedule.filter(item => !isSettled(item)).slice(0, 24);

export function emptyRateChange(note: Note): RateChangeForm {
  const first = rateStartOptions(note)[0];
  return { rate: String(note.interestRate), startsWith: first ? String(first.installmentNumber) : '', reason: '' };
}

const installmentOf = (note: Note, value: string) => note.schedule.find(item => item.installmentNumber === Number(value));

export function validateRateChange(form: RateChangeForm, note: Note): RateChangeErrors {
  const errors: RateChangeErrors = {};
  const rateError = validateRate(form.rate);
  const start = installmentOf(note, form.startsWith);
  if (rateError) errors.rate = rateError;
  else if (start && toNumber(form.rate) === start.rate) errors.rate = 'That is already the rate for this payment.';
  if (!start || isSettled(start)) errors.startsWith = 'Choose an unpaid payment.';
  if (form.reason.trim().length < 3) errors.reason = 'Add a short reason. The investor sees it.';
  else if (form.reason.trim().length > 300) errors.reason = 'Keep it under 300 characters.';
  return errors;
}

export function previewRateChange(form: RateChangeForm, note: Note): { from: number; to: number } | null {
  const start = installmentOf(note, form.startsWith);
  if (!start || validateRate(form.rate)) return null;
  return { from: start.paymentAmount, to: paymentFromInstallment(note, start.installmentNumber, toNumber(form.rate)) };
}

export function toRateChangePayload(form: RateChangeForm, note: Note): RateChangePayload {
  const start = installmentOf(note, form.startsWith);
  return { interestRate: toNumber(form.rate), effectiveDate: start?.dueDate ?? '', reason: form.reason.trim() };
}

// ---------- payments ----------

export const PAYMENT_METHODS = ['ACH', 'Check', 'Wire', 'Other'] as const;

export interface PaymentForm {
  amount: string;
  receivedDate: string;
  method: string;
  reference: string;
}

export type PaymentErrors = Partial<Record<keyof PaymentForm, string>>;

export interface PaymentPayload {
  installmentNumber: number;
  amount: number;
  receivedDate: string;
  method: string;
  reference: string;
}

export function emptyPaymentForm(note: Note | null): PaymentForm {
  const next = note ? nextInstallment(note) : null;
  return { amount: next ? next.paymentAmount.toFixed(2) : '', receivedDate: todayIso(), method: 'ACH', reference: '' };
}

export function validatePaymentForm(form: PaymentForm): PaymentErrors {
  const errors: PaymentErrors = {};
  const amount = toNumber(form.amount);
  if (!form.amount.trim() || !(amount > 0)) errors.amount = 'Enter the amount received.';
  if (!form.receivedDate) errors.receivedDate = 'Enter the date it arrived.';
  else if (form.receivedDate > todayIso()) errors.receivedDate = 'This date is in the future.';
  return errors;
}

export function toPaymentPayload(form: PaymentForm, note: Note): PaymentPayload {
  return {
    installmentNumber: nextInstallment(note)?.installmentNumber ?? 0,
    amount: toNumber(form.amount),
    receivedDate: form.receivedDate,
    method: form.method,
    reference: form.reference.trim()
  };
}

export const shortfall = (form: PaymentForm, note: Note) => {
  const next = nextInstallment(note);
  const amount = toNumber(form.amount);
  return next && amount > 0 && amount < next.paymentAmount - 0.004 ? next.paymentAmount - amount : 0;
};

