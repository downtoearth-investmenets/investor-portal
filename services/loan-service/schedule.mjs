// Pure amortization rules for a fixed-rate note. No I/O here.

export const round2 = value => Math.round(value * 100) / 100;

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const isIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value));

// Adds whole months and keeps the day of month, clamped to the end of shorter months.
export function addMonths(isoDate, months) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export const daysBetween = (fromIso, toIso) => Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86400000);

export function amortizedPayment(balance, annualRatePct, months) {
  if (months <= 0) return balance;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return balance / months;
  return (balance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

// History is sorted oldest first; the latest change effective on or before the due date applies.
export function rateOn(rateHistory, dueDate) {
  let rate = rateHistory[0]?.rate ?? 0;
  for (const change of rateHistory) {
    if (change.effectiveDate <= dueDate) rate = change.rate;
  }
  return rate;
}

/**
 * Builds the payment schedule. When the rate changes, the remaining balance is
 * re-amortized over the remaining installments, so installments before the change keep
 * their original amounts.
 */
export function buildSchedule({ principalAmount, termMonths, originationDate, rateHistory, payments, today = todayIso() }) {
  const paidByInstallment = new Map(payments.map(payment => [payment.installmentNumber, payment]));
  const items = [];
  let balance = principalAmount;
  let rate = null;
  let payment = 0;

  for (let number = 1; number <= termMonths; number += 1) {
    const dueDate = addMonths(originationDate, number);
    const applicableRate = rateOn(rateHistory, dueDate);
    if (applicableRate !== rate) {
      rate = applicableRate;
      payment = amortizedPayment(balance, rate, termMonths - number + 1);
    }

    const interest = balance * (rate / 100 / 12);
    const isLast = number === termMonths;
    const principalPart = isLast ? balance : payment - interest;
    const amount = isLast ? balance + interest : payment;
    balance = Math.max(0, balance - principalPart);

    const received = paidByInstallment.get(number);
    let status;
    if (received) status = received.amount + 0.005 >= round2(amount) ? 'paid' : 'partial';
    else status = dueDate < today ? 'overdue' : 'upcoming';

    items.push({
      installmentNumber: number,
      dueDate,
      rate,
      paymentAmount: round2(amount),
      principalComponent: round2(principalPart),
      interestComponent: round2(interest),
      remainingBalance: round2(balance),
      status,
      daysLate: status === 'overdue' ? daysBetween(dueDate, today) : undefined,
      paidDate: received?.receivedDate,
      payment: received
    });
  }

  return items;
}

export const firstOpenInstallment = schedule => schedule.find(item => !item.payment) ?? null;
export const lastPaidInstallment = schedule => [...schedule].reverse().find(item => item.payment) ?? null;

