import { randomUUID } from 'node:crypto';
import express from 'express';
import { openDatabase } from './db.mjs';
import { addMonths, buildSchedule, firstOpenInstallment, isIsoDate, lastPaidInstallment, rateOn, round2, todayIso } from './schedule.mjs';

const PAYMENT_METHODS = ['ACH', 'Check', 'Wire', 'Other'];
const MANUAL_STATUSES = ['active', 'pending', 'paid_off'];

// ---------- reading ----------

const ratesFor = (db, loanId) =>
  db
    .prepare(`SELECT id, rate, effective_date AS "effectiveDate", reason, changed_by AS "changedBy", created_at AS "createdAt"
      FROM rate_changes WHERE loan_id = ? ORDER BY effective_date, id`)
    .all(loanId);

const paymentsFor = (db, loanId) =>
  db
    .prepare(`SELECT id, installment_number AS "installmentNumber", amount, received_date AS "receivedDate", method, reference,
      recorded_by AS "recordedBy", created_at AS "createdAt" FROM payments WHERE loan_id = ? ORDER BY installment_number`)
    .all(loanId);

const activityFor = (db, loanId) =>
  db.prepare('SELECT id, kind, message, actor, created_at AS "createdAt" FROM activity WHERE loan_id = ? ORDER BY id DESC LIMIT 30').all(loanId);

const loanRow = (store, id, lock = false) => {
  const suffix = lock && store.dialect === 'postgres' ? ' FOR UPDATE' : '';
  return store.prepare('SELECT * FROM loans WHERE id = ? OR loan_number = ?' + suffix).get(id, id);
};

async function computeSchedule(db, loanId) {
  const row = await loanRow(db, loanId);
  return buildSchedule({
    principalAmount: row.principal_amount,
    termMonths: row.term_months,
    originationDate: row.origination_date,
    rateHistory: await ratesFor(db, row.id),
    payments: await paymentsFor(db, row.id)
  });
}

export async function createLoansApp(database) {
  const db = await openDatabase(computeSchedule, database);

  async function hydrate(store, row) {
    const rateHistory = await ratesFor(store, row.id);
    const payments = await paymentsFor(store, row.id);
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
      property: typeof row.property === 'string' ? JSON.parse(row.property) : row.property,
      notes: row.notes,
      interestRate: current.rate,
      originalRate: rateHistory[0]?.rate ?? current.rate,
      monthlyPayment: current.paymentAmount,
      overdueCount,
      rateHistory,
      lastPayment: payments[payments.length - 1] ?? null,
      schedule,
      activity: await activityFor(store, row.id),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ---------- writing ----------

  const actorOf = req => String(req.headers['x-actor-name'] || 'System').slice(0, 120);
  const logActivity = (store, loanId, kind, message, actor) =>
    store.prepare('INSERT INTO activity (loan_id, kind, message, actor, created_at) VALUES (?, ?, ?, ?, ?)').run(loanId, kind, message, actor, new Date().toISOString());
  const touch = (store, loanId) => store.prepare('UPDATE loans SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), loanId);
  const money = value => '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const day = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const STATE_CODES = {
    colorado: 'CO', wisconsin: 'WI', michigan: 'MI', minnesota: 'MN', montana: 'MT',
    wyoming: 'WY', 'new mexico': 'NM', arizona: 'AZ', texas: 'TX', utah: 'UT', idaho: 'ID'
  };

  async function nextLoanNumber(store, state) {
    const name = String(state || '').trim();
    const code = STATE_CODES[name.toLowerCase()] || (name.length === 2 ? name.toUpperCase() : name.slice(0, 2).toUpperCase() || 'XX');
    const year = new Date().getFullYear();
    let sequence = (await store.prepare('SELECT COUNT(*) AS count FROM loans').get()).count + 1;
    let candidate;
    do {
      candidate = `DTE-NOTE-${year}-${code}${String(sequence).padStart(2, '0')}`;
      sequence += 1;
    } while (await store.prepare('SELECT 1 FROM loans WHERE loan_number = ?').get(candidate));
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

  const reply = (status, body) => ({ status, body });

  function mutateLoan(handler) {
    return async (req, res) => {
      const result = await db.transaction(async tx => {
        // Serialize changes to the same note, including the schedule checks before a write.
        const row = await loanRow(tx, req.params.id, true);
        if (!row) return reply(404, { error: 'Note not found.' });
        return handler(tx, row, req);
      });
      res.status(result.status).json(result.body);
    };
  }

  // ---------- routes ----------

  const app = express();
  app.use(express.json());

  app.get('/health', async (req, res) => {
    const { count } = await db.prepare('SELECT COUNT(*) AS count FROM loans').get();
    res.json({ service: 'loan-service', status: 'healthy', loansCount: count, timestamp: new Date().toISOString() });
  });

  app.get('/loans', async (req, res) => {
    const { investorId, status } = req.query;
    const rows = investorId
      ? await db.prepare('SELECT * FROM loans WHERE investor_id = ? ORDER BY origination_date DESC').all(String(investorId))
      : await db.prepare('SELECT * FROM loans ORDER BY origination_date DESC').all();
    const loans = await Promise.all(rows.map(row => hydrate(db, row)));
    res.json(status ? loans.filter(loan => loan.status === status) : loans);
  });

  app.get('/loans/:id', async (req, res) => {
    const row = await loanRow(db, req.params.id);
    if (!row) return res.status(404).json({ error: 'Note not found.' });
    res.json(await hydrate(db, row));
  });

  app.post('/loans', async (req, res) => {
    const error = validateNoteInput(req.body || {});
    if (error) return res.status(400).json({ error });

    const body = req.body;
    const property = body.property;
    const actor = actorOf(req);
    const stamp = new Date().toISOString();
    const originationDate = body.originationDate || todayIso();
    const id = 'loan_dte_' + randomUUID();
    const rate = Number(body.interestRate);

    const loan = await db.transaction(async tx => {
      if (tx.dialect === 'postgres') await tx.exec('LOCK TABLE loans IN SHARE ROW EXCLUSIVE MODE');
      const loanNumber = await nextLoanNumber(tx, property.state);
      await tx.prepare(`INSERT INTO loans (id, loan_number, borrower_name, borrower_contact, principal_amount, term_months, origination_date,
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
      await tx.prepare('INSERT INTO rate_changes (loan_id, rate, effective_date, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
        id, rate, originationDate, 'Original note rate', actor, stamp
      );
      await logActivity(tx, id, 'created', `Note created at ${rate}% for ${money(body.principalAmount)}`, actor);
      return hydrate(tx, await loanRow(tx, id));
    }).catch(error => {
      if (error.code === '23503' && error.constraint === 'loans_investor_id_fkey') return null;
      throw error;
    });
    if (!loan) return res.status(400).json({ error: 'Choose an existing investor.', field: 'investorId' });
    res.status(201).json({ loan });
  });

  // Fixed-rate change: applies to installments due on or after the effective date.
  // Installments that already have a recorded payment can never change.
  app.patch('/loans/:id/rate', mutateLoan(async (tx, row, req) => {

    const rate = Number(req.body?.interestRate);
    const effectiveDate = String(req.body?.effectiveDate || '');
    const reason = String(req.body?.reason || '').trim();

    if (!Number.isFinite(rate) || rate < 1 || rate > 30) {
      return reply(400, { error: 'Enter a rate between 1% and 30%.', field: 'interestRate' });
    }
    if (!isIsoDate(effectiveDate)) return reply(400, { error: 'Choose when the new rate starts.', field: 'effectiveDate' });
    if (reason.length < 3) return reply(400, { error: 'Add a short reason. The investor sees it.', field: 'reason' });
    if (reason.length > 300) return reply(400, { error: 'Keep the reason under 300 characters.', field: 'reason' });

    const before = await hydrate(tx, row);
    const lastPaid = lastPaidInstallment(before.schedule);
    const firstAffected = before.schedule.find(item => item.dueDate >= effectiveDate);

    if (!firstOpenInstallment(before.schedule)) {
      return reply(409, { error: 'Every payment on this note is recorded, so the rate can no longer change.' });
    }
    if (lastPaid && effectiveDate <= lastPaid.dueDate) {
      return reply(400, {
        error: `Payments through ${day(lastPaid.dueDate)} are already recorded. Choose a later date.`,
        field: 'effectiveDate'
      });
    }
    if (effectiveDate < row.origination_date || !firstAffected) {
      return reply(400, { error: 'Choose a date between the start date and the final payment.', field: 'effectiveDate' });
    }

    const previousRate = rateOn(before.rateHistory, firstAffected.dueDate);
    if (previousRate === rate) {
      return reply(400, { error: `The rate from that date is already ${rate}%.`, field: 'interestRate' });
    }

    const actor = actorOf(req);
    await tx.prepare('INSERT INTO rate_changes (loan_id, rate, effective_date, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      row.id, rate, effectiveDate, reason, actor, new Date().toISOString()
    );
    await logActivity(tx, row.id, 'rate', `Rate changed from ${previousRate}% to ${rate}% starting ${day(firstAffected.dueDate)}. Reason: ${reason}`, actor);
    await touch(tx, row.id);

    const loan = await hydrate(tx, await loanRow(tx, row.id));
    const affected = loan.schedule.find(item => item.installmentNumber === firstAffected.installmentNumber);
    return reply(200, {
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
  }));

  // Payments are recorded in order, one per installment.
  app.post('/loans/:id/payments', mutateLoan(async (tx, row, req) => {

    const loan = await hydrate(tx, row);
    const open = firstOpenInstallment(loan.schedule);
    if (!open) return reply(409, { error: 'Every payment on this note is already recorded.' });

    const installmentNumber = Number(req.body?.installmentNumber ?? open.installmentNumber);
    const amount = round2(Number(req.body?.amount));
    const receivedDate = String(req.body?.receivedDate || '');
    const method = PAYMENT_METHODS.includes(req.body?.method) ? req.body.method : 'ACH';
    const reference = String(req.body?.reference || '').trim().slice(0, 120);

    if (installmentNumber !== open.installmentNumber) {
      return reply(400, { error: `Record payment #${open.installmentNumber} first. Payments are recorded in order.` });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return reply(400, { error: 'Enter the amount received.', field: 'amount' });
    }
    if (!isIsoDate(receivedDate)) return reply(400, { error: 'Enter the date the payment arrived.', field: 'receivedDate' });
    if (receivedDate > todayIso()) return reply(400, { error: 'The received date cannot be in the future.', field: 'receivedDate' });
    if (receivedDate < row.origination_date) {
      return reply(400, { error: 'The received date cannot be before the note started.', field: 'receivedDate' });
    }

    const actor = actorOf(req);
    const short = round2(open.paymentAmount - amount);
    await tx.prepare(
      'INSERT INTO payments (loan_id, installment_number, amount, received_date, method, reference, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(row.id, installmentNumber, amount, receivedDate, method, reference, actor, new Date().toISOString());
    const note = short > 0.004 ? ` (${money(short)} short)` : '';
    await logActivity(tx, row.id, 'payment', `Payment #${installmentNumber} of ${money(amount)} received ${day(receivedDate)} by ${method}${note}`, actor);
    await touch(tx, row.id);

    const updated = await hydrate(tx, await loanRow(tx, row.id));
    return reply(201, { loan: updated, payment: updated.lastPayment });
  }));

  app.delete('/loans/:id/payments/:paymentId', mutateLoan(async (tx, row, req) => {

    const payments = await paymentsFor(tx, row.id);
    const latest = payments[payments.length - 1];
    const target = payments.find(payment => String(payment.id) === req.params.paymentId);
    if (!target) return reply(404, { error: 'Payment not found.' });
    if (target !== latest) return reply(409, { error: 'Only the most recent payment can be undone.' });

    const actor = actorOf(req);
    await tx.prepare('DELETE FROM payments WHERE id = ?').run(target.id);
    await logActivity(tx, row.id, 'payment_undone', `Payment #${target.installmentNumber} of ${money(target.amount)} was undone`, actor);
    await touch(tx, row.id);
    return reply(200, { loan: await hydrate(tx, await loanRow(tx, row.id)) });
  }));

  app.patch('/loans/:id/status', mutateLoan(async (tx, row, req) => {
    const status = String(req.body?.status || '');
    if (!MANUAL_STATUSES.includes(status)) return reply(400, { error: 'Unknown status.' });

    await tx.prepare('UPDATE loans SET status = ? WHERE id = ?').run(status, row.id);
    await logActivity(tx, row.id, 'status', `Status set to ${status}`, actorOf(req));
    await touch(tx, row.id);
    return reply(200, { loan: await hydrate(tx, await loanRow(tx, row.id)) });
  }));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.parse.failed' ? 400 : 500;
    if (status === 500) console.error('[Loan-Service] Request failed:', error.code || error.name);
    res.status(status).json({ error: status === 400 ? 'Invalid JSON request.' : 'The service could not complete the request.' });
  });

  return { app, close: db.close };
}
