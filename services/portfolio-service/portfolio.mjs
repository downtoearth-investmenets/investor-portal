// Pure portfolio maths shared by the dashboard and report endpoints. No I/O here.

export const round2 = value => Math.round(value * 100) / 100;
export const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);
export const isoDate = date => date.toISOString().slice(0, 10);
export const todayIso = () => isoDate(new Date());
export const isIsoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value));
export const isOpen = loan => loan.status === 'active' || loan.status === 'delinquent';
export const isSettled = item => item.status === 'paid' || item.status === 'partial';
export const placeOf = loan => [loan.property?.county, loan.property?.state].filter(Boolean).join(', ');

export function outstandingBalance(loan) {
  const lastSettled = [...loan.schedule].reverse().find(isSettled);
  return lastSettled ? lastSettled.remainingBalance : loan.principalAmount;
}

export function summarize(loans) {
  const open = loans.filter(isOpen);
  const principal = sum(open, l => l.principalAmount);
  const weighted = sum(open, l => l.principalAmount * l.interestRate);
  return {
    principal,
    count: open.length,
    averageRate: principal > 0 ? round2(weighted / principal) : 0,
    monthly: round2(sum(open, l => l.monthlyPayment)),
    outstanding: round2(sum(open, outstandingBalance))
  };
}

export const installmentRow = (loan, item) => ({
  loanId: loan.id,
  loanNumber: loan.loanNumber,
  investorId: loan.investorId,
  investorName: loan.investorName,
  county: loan.property?.county,
  state: loan.property?.state,
  installmentNumber: item.installmentNumber,
  dueDate: item.dueDate,
  amount: item.paymentAmount,
  interest: item.interestComponent,
  principal: item.principalComponent,
  status: item.status,
  daysLate: item.daysLate ?? 0
});

export function upcomingInstallments(loans, { days, limit } = {}) {
  const start = todayIso();
  const end = days ? isoDate(new Date(Date.now() + days * 86400000)) : null;
  const rows = loans
    .filter(isOpen)
    .flatMap(loan =>
      loan.schedule
        .filter(item => item.status === 'upcoming' && item.dueDate >= start && (!end || item.dueDate <= end))
        .map(item => installmentRow(loan, item))
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return limit ? rows.slice(0, limit) : rows;
}

export const overdueInstallments = loans =>
  loans
    .flatMap(loan => loan.schedule.filter(item => item.status === 'overdue').map(item => installmentRow(loan, item)))
    .sort((a, b) => b.daysLate - a.daysLate);

export function receivedPayments(loans) {
  return loans
    .flatMap(loan =>
      loan.schedule
        .filter(item => item.payment)
        .map(item => {
          const amount = item.payment.amount;
          const interest = round2(item.status === 'paid' ? item.interestComponent : Math.min(amount, item.interestComponent));
          return {
            loanId: loan.id,
            loanNumber: loan.loanNumber,
            investorId: loan.investorId,
            investorName: loan.investorName,
            county: loan.property?.county,
            state: loan.property?.state,
            installmentNumber: item.installmentNumber,
            dueDate: item.dueDate,
            amount,
            interest,
            principal: round2(amount - interest),
            receivedDate: item.payment.receivedDate,
            method: item.payment.method,
            reference: item.payment.reference || ''
          };
        })
    )
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate) || b.installmentNumber - a.installmentNumber);
}

// ---------- monthly cash flow ----------

export const monthKey = iso => iso.slice(0, 7);

export function shiftMonth(key, delta) {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Money by month: what was received (split into interest and principal),
 * what is still scheduled, and what is past due. Covers past and future months.
 */
export function cashflow(loans, { past = 11, future = 6 } = {}) {
  const current = monthKey(todayIso());
  const months = Array.from({ length: past + future + 1 }, (_, index) => shiftMonth(current, index - past));
  const buckets = new Map(months.map(month => [month, { month, interest: 0, principal: 0, scheduled: 0, late: 0 }]));

  for (const loan of loans) {
    for (const item of loan.schedule) {
      if (item.payment) {
        const bucket = buckets.get(monthKey(item.payment.receivedDate));
        if (!bucket) continue;
        const interest = item.status === 'paid' ? item.interestComponent : Math.min(item.payment.amount, item.interestComponent);
        bucket.interest += interest;
        bucket.principal += item.payment.amount - interest;
      } else if (isOpen(loan)) {
        const bucket = buckets.get(monthKey(item.dueDate));
        if (!bucket) continue;
        if (item.status === 'overdue') bucket.late += item.paymentAmount;
        else bucket.scheduled += item.paymentAmount;
      }
    }
  }

  return months.map(month => {
    const b = buckets.get(month);
    return { month, current: month === current, interest: round2(b.interest), principal: round2(b.principal), scheduled: round2(b.scheduled), late: round2(b.late) };
  });
}

