import {
  isOpen,
  outstandingBalance,
  overdueInstallments,
  placeOf,
  receivedPayments,
  round2,
  sum,
  summarize,
  installmentRow
} from './portfolio.mjs';

// Each report is a plain document: summary figures plus tables.
// The web app renders it for preview and PDF; toCsv flattens it for spreadsheets.

export const REPORTS = {
  statement: { title: 'Investor statement', audience: ['admin', 'investor'], needsInvestor: true },
  payments: { title: 'Payments received', audience: ['admin', 'investor'] },
  schedule: { title: 'Payment schedule', audience: ['admin', 'investor'] },
  portfolio: { title: 'Note register', audience: ['admin'] },
  investors: { title: 'Investor summary', audience: ['admin'] }
};

const col = (key, label, kind = 'text') => ({ key, label, kind });
const inPeriod = (date, from, to) => date >= from && date <= to;
const totalsOf = (rows, keys) => Object.fromEntries(keys.map(key => [key, round2(sum(rows, row => row[key]))]));

function paymentsSection(payments, { withInvestor }) {
  const rows = [...payments]
    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate))
    .map(p => ({
      receivedDate: p.receivedDate,
      loanNumber: p.loanNumber,
      place: [p.county, p.state].filter(Boolean).join(', '),
      investorName: p.investorName,
      installmentNumber: p.installmentNumber,
      amount: p.amount,
      interest: p.interest,
      principal: p.principal,
      method: p.method,
      reference: p.reference
    }));
  return {
    title: 'Payments received',
    columns: [
      col('receivedDate', 'Received', 'date'),
      col('loanNumber', 'Note'),
      col('place', 'Land'),
      ...(withInvestor ? [col('investorName', 'Investor')] : []),
      col('installmentNumber', 'Payment #', 'number'),
      col('amount', 'Amount', 'money'),
      col('interest', 'Interest', 'money'),
      col('principal', 'Principal', 'money'),
      col('method', 'Method'),
      col('reference', 'Reference')
    ],
    rows,
    totals: totalsOf(rows, ['amount', 'interest', 'principal']),
    empty: 'No payments were received in this period.'
  };
}

function notesSection(loans, { withInvestor, detailed }) {
  const rows = loans.map(loan => {
    const next = loan.schedule.find(item => !item.payment);
    const settled = loan.schedule.filter(item => item.payment).length;
    return {
      loanNumber: loan.loanNumber,
      borrowerName: loan.borrowerName,
      investorName: loan.investorName,
      place: placeOf(loan),
      apn: loan.property?.apn,
      acreage: loan.property?.acreage,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      monthlyPayment: loan.monthlyPayment,
      termMonths: loan.termMonths,
      originationDate: loan.originationDate,
      maturityDate: loan.maturityDate,
      balance: outstandingBalance(loan),
      progress: `${settled} of ${loan.schedule.length}`,
      nextDue: next?.dueDate ?? '',
      status: loan.status === 'delinquent' ? 'Late' : loan.status === 'paid_off' ? 'Paid off' : loan.status.charAt(0).toUpperCase() + loan.status.slice(1)
    };
  });
  return {
    title: 'Notes',
    columns: [
      col('loanNumber', 'Note'),
      ...(detailed ? [col('borrowerName', 'Borrower')] : []),
      ...(withInvestor ? [col('investorName', 'Investor')] : []),
      col('place', 'Land'),
      ...(detailed ? [col('apn', 'APN'), col('acreage', 'Acres', 'number'), col('termMonths', 'Term (mo)', 'number'), col('originationDate', 'Start', 'date')] : []),
      col('principalAmount', 'Principal', 'money'),
      col('interestRate', 'Rate', 'percent'),
      col('monthlyPayment', 'Monthly', 'money'),
      col('balance', 'Balance', 'money'),
      col('progress', 'Payments'),
      ...(detailed ? [col('maturityDate', 'Matures', 'date')] : []),
      col('nextDue', 'Next due', 'date'),
      col('status', 'Status')
    ],
    rows,
    totals: totalsOf(rows, ['principalAmount', 'monthlyPayment', 'balance']),
    empty: 'No notes.'
  };
}

function statement({ loans, investor, from, to }) {
  const payments = receivedPayments(loans).filter(p => inPeriod(p.receivedDate, from, to));
  const totals = summarize(loans);
  return {
    subject: investor ? [investor.fullName, investor.entityName].filter(Boolean).join(' · ') : '',
    summary: [
      { label: 'Invested', value: totals.principal, kind: 'money' },
      { label: 'Outstanding balance', value: totals.outstanding, kind: 'money' },
      { label: 'Average fixed rate', value: totals.averageRate, kind: 'percent' },
      { label: 'Interest received', value: round2(sum(payments, p => p.interest)), kind: 'money' },
      { label: 'Principal returned', value: round2(sum(payments, p => p.principal)), kind: 'money' },
      { label: 'Payments received', value: payments.length, kind: 'number' }
    ],
    sections: [notesSection(loans, { withInvestor: false, detailed: false }), paymentsSection(payments, { withInvestor: false })]
  };
}

function payments({ loans, from, to, audience }) {
  const rows = receivedPayments(loans).filter(p => inPeriod(p.receivedDate, from, to));
  return {
    summary: [
      { label: 'Total received', value: round2(sum(rows, p => p.amount)), kind: 'money' },
      { label: 'Interest', value: round2(sum(rows, p => p.interest)), kind: 'money' },
      { label: 'Principal', value: round2(sum(rows, p => p.principal)), kind: 'money' },
      { label: 'Payments', value: rows.length, kind: 'number' }
    ],
    sections: [paymentsSection(rows, { withInvestor: audience === 'admin' })]
  };
}

function schedule({ loans, from, to, audience }) {
  const late = overdueInstallments(loans);
  const due = loans
    .filter(isOpen)
    .flatMap(loan => loan.schedule.filter(item => item.status === 'upcoming' && inPeriod(item.dueDate, from, to)).map(item => installmentRow(loan, item)));
  const rows = [...late, ...due]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(r => ({ ...r, place: [r.county, r.state].filter(Boolean).join(', '), status: r.status === 'overdue' ? `Late (${r.daysLate}d)` : 'Scheduled' }));
  return {
    summary: [
      { label: 'Scheduled', value: round2(sum(due, r => r.amount)), kind: 'money' },
      { label: 'Past due', value: round2(sum(late, r => r.amount)), kind: 'money' },
      { label: 'Payments', value: rows.length, kind: 'number' }
    ],
    sections: [
      {
        title: 'Payments due',
        columns: [
          col('dueDate', 'Due', 'date'),
          col('loanNumber', 'Note'),
          col('place', 'Land'),
          ...(audience === 'admin' ? [col('investorName', 'Investor')] : []),
          col('installmentNumber', 'Payment #', 'number'),
          col('amount', 'Amount', 'money'),
          col('interest', 'Interest', 'money'),
          col('principal', 'Principal', 'money'),
          col('status', 'Status')
        ],
        rows,
        totals: totalsOf(rows, ['amount', 'interest', 'principal']),
        empty: 'Nothing is due in this period.'
      }
    ]
  };
}

function portfolio({ loans }) {
  const totals = summarize(loans);
  return {
    summary: [
      { label: 'Active notes', value: totals.count, kind: 'number' },
      { label: 'Capital deployed', value: totals.principal, kind: 'money' },
      { label: 'Outstanding balance', value: totals.outstanding, kind: 'money' },
      { label: 'Average fixed rate', value: totals.averageRate, kind: 'percent' },
      { label: 'Scheduled monthly', value: totals.monthly, kind: 'money' }
    ],
    sections: [notesSection(loans, { withInvestor: true, detailed: true })]
  };
}

function investors({ loans, investors: people, from, to }) {
  const received = receivedPayments(loans).filter(p => inPeriod(p.receivedDate, from, to));
  const rows = people.map(person => {
    const own = loans.filter(l => l.investorId === person.id);
    const totals = summarize(own);
    const mine = received.filter(p => p.investorId === person.id);
    return {
      fullName: person.fullName,
      entityName: person.entityName || '',
      email: person.email,
      status: person.status === 'active' ? 'Active' : 'Invited',
      notes: totals.count,
      invested: totals.principal,
      balance: totals.outstanding,
      monthly: totals.monthly,
      interest: round2(sum(mine, p => p.interest)),
      late: overdueInstallments(own).length
    };
  });
  return {
    summary: [
      { label: 'Investors', value: rows.length, kind: 'number' },
      { label: 'Invested', value: round2(sum(rows, r => r.invested)), kind: 'money' },
      { label: 'Interest paid out', value: round2(sum(rows, r => r.interest)), kind: 'money' }
    ],
    sections: [
      {
        title: 'Investors',
        columns: [
          col('fullName', 'Investor'),
          col('entityName', 'Trust or entity'),
          col('email', 'Email'),
          col('status', 'Status'),
          col('notes', 'Notes', 'number'),
          col('invested', 'Invested', 'money'),
          col('balance', 'Balance', 'money'),
          col('monthly', 'Monthly', 'money'),
          col('interest', 'Interest (period)', 'money'),
          col('late', 'Late', 'number')
        ],
        rows,
        totals: totalsOf(rows, ['invested', 'balance', 'monthly', 'interest']),
        empty: 'No investors yet.'
      }
    ]
  };
}

const BUILDERS = { statement, payments, schedule, portfolio, investors };

export function buildReport(type, context) {
  const body = BUILDERS[type](context);
  return {
    type,
    title: REPORTS[type].title,
    subject: body.subject || '',
    period: ['portfolio'].includes(type) ? null : { from: context.from, to: context.to },
    generatedAt: new Date().toISOString(),
    generatedOn: context.today,
    generatedBy: context.generatedBy || '',
    summary: body.summary,
    sections: body.sections
  };
}

// ---------- CSV ----------

function cell(value, kind) {
  if (value === null || value === undefined) return '';
  let text = kind === 'money' ? Number(value).toFixed(2) : String(value);
  // Stop spreadsheet apps from treating text as a formula.
  if (kind === 'text' && /^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function toCsv(report) {
  const lines = [];
  const line = values => lines.push(values.map(([value, kind]) => cell(value, kind)).join(','));

  line([[ 'Down to Earth Investments' ], [report.title]]);
  if (report.subject) line([['For'], [report.subject]]);
  if (report.period) line([['Period'], [report.period.from + ' to ' + report.period.to]]);
  line([['Generated'], [report.generatedOn || report.generatedAt.slice(0, 10)]]);
  lines.push('');
  for (const item of report.summary) line([[item.label], [item.value, item.kind]]);

  for (const section of report.sections) {
    lines.push('');
    line([[section.title]]);
    line(section.columns.map(c => [c.label]));
    for (const row of section.rows) line(section.columns.map(c => [row[c.key], c.kind]));
    if (section.totals && section.rows.length) {
      line(section.columns.map((c, index) => (index === 0 ? ['Total'] : c.key in section.totals ? [section.totals[c.key], c.kind] : [''])));
    }
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

