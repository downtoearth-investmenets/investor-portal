import express from 'express';
import { openDatabase, transaction } from './db.mjs';
import { addMonths, buildSchedule, firstOpenInstallment, isIsoDate, lastPaidInstallment, rateOn, round2, todayIso } from './schedule.mjs';

const PORT = process.env.PORT || 4002;
const HOST = process.env.HOST || '127.0.0.1';
const PAYMENT_METHODS = ['ACH', 'Check', 'Wire', 'Other'];
const MANUAL_STATUSES = ['active', 'pending', 'paid_off'];

// ---------- reading ----------

const ratesFor = (db, loanId) =>
  db
    .prepare(`SELECT id, rate, effective_date AS effectiveDate, reason, changed_by AS changedBy, created_at AS createdAt
      FROM rate_changes WHERE loan_id = ? ORDER BY effective_date, id`)
    .all(loanId);

const paymentsFor = (db, loanId) =>
  db
    .prepare(`SELECT id, installment_number AS installmentNumber, amount, received_date AS receivedDate, method, reference,
      recorded_by AS recordedBy, created_at AS createdAt FROM payments WHERE loan_id = ? ORDER BY installment_number`)
    .all(loanId);

const activityFor = (db, loanId) =>
  db.prepare('SELECT id, kind, message, actor, created_at AS createdAt FROM activity WHERE loan_id = ? ORDER BY id DESC LIMIT 30').all(loanId);

const loanRow = (db, id) => db.prepare('SELECT * FROM loans WHERE id = ? OR loan_number = ?').get(id, id);

function computeSchedule(db, loanId) {
  const row = loanRow(db, loanId);
  return buildSchedule({
    principalAmount: row.principal_amount,
    termMonths: row.term_months,
    originationDate: row.origination_date,
    rateHistory: ratesFor(db, row.id),
    payments: paymentsFor(db, row.id)
  });
}

const db = openDatabase(computeSchedule);

function hydrate(row) {
  const rateHistory = ratesFor(db, row.id);
  const payments = paymentsFor(db, row.id);
  const schedule = buildSchedule({
    principalAmount: row.principal_amount,
    termMonths: row.term_months,
    originationDate: row.origination_date,
    rateHistory,
    payments
  });
  const open = firstOpenInstallment(schedule);
  const current = open ?? schedule[schedule.length - 1];
  const overdueCount = schedule.filter(item => item.status === 'overdue').length;

  let status = row.status;
  if (status === 'active') status = !open ? 'paid_off' : overdueCount > 0 ? 'delinquent' : 'active';

  return {
    id: row.id,
    loanNumber: row.loan_number,
    borrowerName: row.borrower_name,
    borrowerContact: row.borrower_contact,
    principalAmount: row.principal_amount,
    termMonths: row.term_months,
    originationDate: row.origination_date,
    maturityDate: addMonths(row.origination_date, row.term_months),
    status,
    investorId: row.investor_id,
    investorName: row.investor_name,
    property: JSON.parse(row.property),
    notes: row.notes,
    interestRate: current.rate,
    originalRate: rateHistory[0]?.rate ?? current.rate,
    monthlyPayment: current.paymentAmount,
    overdueCount,
    rateHistory,
    lastPayment: payments[payments.length - 1] ?? null,
    schedule,
    activity: activityFor(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---------- writing ----------

const actorOf = req => String(req.headers['x-actor-name'] || 'System').slice(0, 120);
const logActivity = (loanId, kind, message, actor) =>
  db.prepare('INSERT INTO activity (loan_id, kind, message, actor, created_at) VALUES (?, ?, ?, ?, ?)').run(loanId, kind, message, actor, new Date().toISOString());
const touch = loanId => db.prepare('UPDATE loans SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), loanId);
const money = value => '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const STATE_CODES = {
  colorado: 'CO', wisconsin: 'WI', michigan: 'MI', minnesota: 'MN', montana: 'MT',
  wyoming: 'WY', 'new mexico': 'NM', arizona: 'AZ', texas: 'TX', utah: 'UT', idaho: 'ID'
};

function nextLoanNumber(state) {
  const name = String(state || '').trim();
  const code = STATE_CODES[name.toLowerCase()] || (name.length === 2 ? name.toUpperCase() : name.slice(0, 2).toUpperCase() || 'XX');
  const year = new Date().getFullYear();
  let sequence = db.prepare('SELECT COUNT(*) AS count FROM loans').get().count + 1;
  let candidate;
  do {
    candidate = `DTE-NOTE-${year}-${code}${String(sequence).padStart(2, '0')}`;
    sequence += 1;
  } while (db.prepare('SELECT 1 FROM loans WHERE loan_number = ?').get(candidate));
  return candidate;
}

function validateNoteInput(body) {
  const principal = Number(body.principalAmount);
  const rate = Number(body.interestRate);
  const term = Number(body.termMonths);
  const property = body.property || {};
  if (!String(body.borrowerName || '').trim()) return 'Enter the borrower name.';
  if (!body.investorId) return 'Choose an investor for this note.';
  if (!Number.isFinite(principal) || principal <= 0) return 'Enter a principal amount above $0.';
  if (!Number.isFinite(rate) || rate < 1 || rate > 30) return 'Enter a rate between 1% and 30%.';
  if (!Number.isInteger(term) || term < 1 || term > 360) return 'Enter a term between 1 and 360 months.';
  if (body.originationDate && !isIsoDate(body.originationDate)) return 'Enter a valid start date.';
  if (!String(property.county || '').trim() || !String(property.state || '').trim()) return 'Enter the county and state of the land.';
  if (!String(property.apn || '').trim()) return 'Enter the parcel APN.';
  return null;
}

function findLoanOr404(req, res) {
  const row = loanRow(db, req.params.id);
  if (!row) res.status(404).json({ error: 'Note not found.' });
  return row;
}

// ---------- routes ----------

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM loans').get();
  res.json({ service: 'loan-service', status: 'healthy', loansCount: count, timestamp: new Date().toISOString() });
});

app.get('/loans', (req, res) => {
  const { investorId, status } = req.query;
  const rows = investorId
    ? db.prepare('SELECT * FROM loans WHERE investor_id = ? ORDER BY origination_date DESC').all(String(investorId))
    : db.prepare('SELECT * FROM loans ORDER BY origination_date DESC').all();
  const loans = rows.map(hydrate);
  res.json(status ? loans.filter(loan => loan.status === status) : loans);
});

app.get('/loans/:id', (req, res) => {
  const row = findLoanOr404(req, res);
  if (row) res.json(hydrate(row));
});

app.post('/loans', (req, res) => {
  const error = validateNoteInput(req.body || {});
  if (error) return res.status(400).json({ error });

  const body = req.body;
  const property = body.property;
  const actor = actorOf(req);
  const stamp = new Date().toISOString();
  const originationDate = body.originationDate || todayIso();
  const id = `loan_dte_${Date.now()}`;
  const loanNumber = nextLoanNumber(property.state);
  const rate = Number(body.interestRate);

  transaction(db, () => {
    db.prepare(`INSERT INTO loans (id, loan_number, borrower_name, borrower_contact, principal_amount, term_months, origination_date,
      status, investor_id, investor_name, property, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`).run(
      id,
      loanNumber,
      String(body.borrowerName).trim(),
      String(body.borrowerContact || '').trim(),
      Number(body.principalAmount),
      Number(body.termMonths),
      originationDate,
      String(body.investorId),
      String(body.investorName || '').trim(),
      JSON.stringify({
        apn: String(property.apn).trim(),
        county: String(property.county).trim(),
        state: String(property.state).trim(),
        acreage: Number(property.acreage) || 0,
        propertyAddress: String(property.propertyAddress || '').trim(),
        titleCompany: String(property.titleCompany || '').trim(),
        estimatedLandValue: Number(property.estimatedLandValue) || 0
      }),
      String(body.notes || '').trim(),
      stamp,
      stamp
    );
    db.prepare('INSERT INTO rate_changes (loan_id, rate, effective_date, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, rate, originationDate, 'Original note rate', actor, stamp
    );
    logActivity(id, 'created', `Note created at ${rate}% for ${money(body.principalAmount)}`, actor);
  });

  res.status(201).json({ loan: hydrate(loanRow(db, id)) });
});

// Fixed-rate change: applies to installments due on or after the effective date.
// Installments that already have a recorded payment can never change.
app.patch('/loans/:id/rate', (req, res) => {
  const row = findLoanOr404(req, res);
  if (!row) return;

  const rate = Number(req.body?.interestRate);
  const effectiveDate = String(req.body?.effectiveDate || '');
  const reason = String(req.body?.reason || '').trim();

  if (!Number.isFinite(rate) || rate < 1 || rate > 30) {
    return res.status(400).json({ error: 'Enter a rate between 1% and 30%.', field: 'interestRate' });
  }
  if (!isIsoDate(effectiveDate)) return res.status(400).json({ error: 'Choose when the new rate starts.', field: 'effectiveDate' });
  if (reason.length < 3) return res.status(400).json({ error: 'Add a short reason. The investor sees it.', field: 'reason' });
  if (reason.length > 300) return res.status(400).json({ error: 'Keep the reason under 300 characters.', field: 'reason' });

  const before = hydrate(row);
  const lastPaid = lastPaidInstallment(before.schedule);
  const firstAffected = before.schedule.find(item => item.dueDate >= effectiveDate);

  if (!firstOpenInstallment(before.schedule)) {
    return res.status(409).json({ error: 'Every payment on this note is recorded, so the rate can no longer change.' });
  }
  if (lastPaid && effectiveDate <= lastPaid.dueDate) {
    return res.status(400).json({
      error: `Payments through ${day(lastPaid.dueDate)} are already recorded. Choose a later date.`,
      field: 'effectiveDate'
    });
  }
  if (effectiveDate < row.origination_date || !firstAffected) {
    return res.status(400).json({ error: 'Choose a date between the start date and the final payment.', field: 'effectiveDate' });
  }

  const previousRate = rateOn(before.rateHistory, firstAffected.dueDate);
  if (previousRate === rate) {
    return res.status(400).json({ error: `The rate from that date is already ${rate}%.`, field: 'interestRate' });
  }

  const actor = actorOf(req);
  transaction(db, () => {
    db.prepare('INSERT INTO rate_changes (loan_id, rate, effective_date, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      row.id, rate, effectiveDate, reason, actor, new Date().toISOString()
    );
    logActivity(row.id, 'rate', `Rate changed from ${previousRate}% to ${rate}% starting ${day(firstAffected.dueDate)}. Reason: ${reason}`, actor);
    touch(row.id);
  });

  const loan = hydrate(row);
  const affected = loan.schedule.find(item => item.installmentNumber === firstAffected.installmentNumber);
  res.json({
    loan,
    change: {
      previousRate,
      rate,
      effectiveDate,
      reason,
      firstAffectedDueDate: affected.dueDate,
      newPaymentAmount: affected.paymentAmount,
      previousPaymentAmount: firstAffected.paymentAmount
    }
  });
});

// Payments are recorded in order, one per installment.
app.post('/loans/:id/payments', (req, res) => {
  const row = findLoanOr404(req, res);
  if (!row) return;

  const loan = hydrate(row);
  const open = firstOpenInstallment(loan.schedule);
  if (!open) return res.status(409).json({ error: 'Every payment on this note is already recorded.' });

  const installmentNumber = Number(req.body?.installmentNumber ?? open.installmentNumber);
  const amount = round2(Number(req.body?.amount));
  const receivedDate = String(req.body?.receivedDate || '');
  const method = PAYMENT_METHODS.includes(req.body?.method) ? req.body.method : 'ACH';
  const reference = String(req.body?.reference || '').trim().slice(0, 120);

  if (installmentNumber !== open.installmentNumber) {
    return res.status(400).json({ error: `Record payment #${open.installmentNumber} first. Payments are recorded in order.` });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
    return res.status(400).json({ error: 'Enter the amount received.', field: 'amount' });
  }
  if (!isIsoDate(receivedDate)) return res.status(400).json({ error: 'Enter the date the payment arrived.', field: 'receivedDate' });
  if (receivedDate > todayIso()) return res.status(400).json({ error: 'The received date cannot be in the future.', field: 'receivedDate' });
  if (receivedDate < row.origination_date) {
    return res.status(400).json({ error: 'The received date cannot be before the note started.', field: 'receivedDate' });
  }

  const actor = actorOf(req);
  const short = round2(open.paymentAmount - amount);
  transaction(db, () => {
    db.prepare(
      'INSERT INTO payments (loan_id, installment_number, amount, received_date, method, reference, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(row.id, installmentNumber, amount, receivedDate, method, reference, actor, new Date().toISOString());
    const note = short > 0.004 ? ` (${money(short)} short)` : '';
    logActivity(row.id, 'payment', `Payment #${installmentNumber} of ${money(amount)} received ${day(receivedDate)} by ${method}${note}`, actor);
    touch(row.id);
  });

  const updated = hydrate(row);
  res.status(201).json({ loan: updated, payment: updated.lastPayment });
});

app.delete('/loans/:id/payments/:paymentId', (req, res) => {
  const row = findLoanOr404(req, res);
  if (!row) return;

  const payments = paymentsFor(db, row.id);
  const latest = payments[payments.length - 1];
  const target = payments.find(payment => String(payment.id) === req.params.paymentId);
  if (!target) return res.status(404).json({ error: 'Payment not found.' });
  if (target !== latest) return res.status(409).json({ error: 'Only the most recent payment can be undone.' });

  const actor = actorOf(req);
  transaction(db, () => {
    db.prepare('DELETE FROM payments WHERE id = ?').run(target.id);
    logActivity(row.id, 'payment_undone', `Payment #${target.installmentNumber} of ${money(target.amount)} was undone`, actor);
    touch(row.id);
  });
  res.json({ loan: hydrate(row) });
});

app.patch('/loans/:id/status', (req, res) => {
  const row = findLoanOr404(req, res);
  if (!row) return;
  const status = String(req.body?.status || '');
  if (!MANUAL_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });

  transaction(db, () => {
    db.prepare('UPDATE loans SET status = ? WHERE id = ?').run(status, row.id);
    logActivity(row.id, 'status', `Status set to ${status}`, actorOf(req));
    touch(row.id);
  });
  res.json({ loan: hydrate(loanRow(db, row.id)) });
});

app.listen(PORT, HOST, () => {
  console.log(`[Loan-Service] Running on http://${HOST}:${PORT}`);
});

