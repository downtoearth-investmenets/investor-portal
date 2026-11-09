import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { todayIso } from './schedule.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  loan_number TEXT NOT NULL UNIQUE,
  borrower_name TEXT NOT NULL,
  borrower_contact TEXT NOT NULL DEFAULT '',
  principal_amount REAL NOT NULL CHECK (principal_amount > 0),
  term_months INTEGER NOT NULL CHECK (term_months BETWEEN 1 AND 360),
  origination_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  investor_id TEXT NOT NULL,
  investor_name TEXT NOT NULL DEFAULT '',
  property TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS loans_investor ON loans (investor_id);

CREATE TABLE IF NOT EXISTS rate_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  rate REAL NOT NULL,
  effective_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  received_date TEXT NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (loan_id, installment_number)
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id TEXT NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

// Synthetic fixtures. These records do not identify real borrowers or land.
const SEED_LOANS = [
  {
    id: 'loan_dte_01', loanNumber: 'DEMO-NOTE-001', borrowerName: 'Demo Borrower 1', borrowerContact: 'borrower.1@portal.example',
    principalAmount: 42500, interestRate: 10.25, termMonths: 42, originationDate: '2025-01-12', investorId: 'inv_prof_1', investorName: 'Demo Investor One',
    property: { apn: 'DEMO-PARCEL-001', county: 'Juniper Sample County', state: 'Colorado', acreage: 6.1, propertyAddress: 'Fictional parcel 1', titleCompany: 'Demo Title Office', estimatedLandValue: 59000 },
    notes: 'Synthetic sample for local testing.'
  },
  {
    id: 'loan_dte_02', loanNumber: 'DEMO-NOTE-002', borrowerName: 'Demo Borrower 2', borrowerContact: 'borrower.2@portal.example',
    principalAmount: 79000, interestRate: 10.9, termMonths: 54, originationDate: '2025-02-17', investorId: 'inv_prof_2', investorName: 'Demo Investor Two',
    property: { apn: 'DEMO-PARCEL-002', county: 'Pine Sample County', state: 'Wisconsin', acreage: 13, propertyAddress: 'Fictional parcel 2', titleCompany: 'Demo Title Office', estimatedLandValue: 111000 },
    notes: 'Synthetic sample for local testing.'
  },
  {
    id: 'loan_dte_03', loanNumber: 'DEMO-NOTE-003', borrowerName: 'Demo Borrower 3', borrowerContact: 'borrower.3@portal.example',
    principalAmount: 56000, interestRate: 11.25, termMonths: 40, originationDate: '2025-03-08', investorId: 'inv_prof_1', investorName: 'Demo Investor One',
    property: { apn: 'DEMO-PARCEL-003', county: 'Granite Sample County', state: 'Michigan', acreage: 7.5, propertyAddress: 'Fictional parcel 3', titleCompany: 'Demo Title Office', estimatedLandValue: 78000 },
    notes: 'Synthetic sample for local testing.'
  },
  {
    id: 'loan_dte_04', loanNumber: 'DEMO-NOTE-004', borrowerName: 'Demo Borrower 4', borrowerContact: 'borrower.4@portal.example',
    principalAmount: 102500, interestRate: 11.75, termMonths: 66, originationDate: '2025-03-21', investorId: 'inv_prof_3', investorName: 'Demo Investor Three',
    property: { apn: 'DEMO-PARCEL-004', county: 'Sage Sample County', state: 'Colorado', acreage: 9.4, propertyAddress: 'Fictional parcel 4', titleCompany: 'Demo Title Office', estimatedLandValue: 144000 },
    notes: 'Synthetic sample for local testing.'
  },
  {
    id: 'loan_dte_05', loanNumber: 'DEMO-NOTE-005', borrowerName: 'Demo Borrower 5', borrowerContact: 'borrower.5@portal.example',
    principalAmount: 92000, interestRate: 10.85, termMonths: 50, originationDate: '2025-04-04', investorId: 'inv_prof_2', investorName: 'Demo Investor Two',
    property: { apn: 'DEMO-PARCEL-005', county: 'Meadow Sample County', state: 'Colorado', acreage: 16.8, propertyAddress: 'Fictional parcel 5', titleCompany: 'Demo Title Office', estimatedLandValue: 129000 },
    notes: 'Synthetic sample for local testing.',
    skipLatestPayment: true
  }
];

export function transaction(db, work) {
  db.exec('BEGIN');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seed(db, computeSchedule) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM loans').get();
  if (count > 0) return;

  const stamp = new Date().toISOString();
  const today = todayIso();
  const insertLoan = db.prepare(`INSERT INTO loans (id, loan_number, borrower_name, borrower_contact, principal_amount, term_months, origination_date,
    status, investor_id, investor_name, property, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`);
  const insertRate = db.prepare('INSERT INTO rate_changes (loan_id, rate, effective_date, reason, changed_by, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertPayment = db.prepare(
    'INSERT INTO payments (loan_id, installment_number, amount, received_date, method, reference, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertActivity = db.prepare('INSERT INTO activity (loan_id, kind, message, actor, created_at) VALUES (?, ?, ?, ?, ?)');

  transaction(db, () => {
    for (const loan of SEED_LOANS) {
      insertLoan.run(loan.id, loan.loanNumber, loan.borrowerName, loan.borrowerContact, loan.principalAmount, loan.termMonths, loan.originationDate,
        loan.investorId, loan.investorName, JSON.stringify(loan.property), loan.notes, stamp, stamp);
      insertRate.run(loan.id, loan.interestRate, loan.originationDate, 'Original note rate', 'Demo Admin One', stamp);
      insertActivity.run(loan.id, 'created', `Note created at ${loan.interestRate}%`, 'Demo Admin One', loan.originationDate + 'T09:00:00Z');

      const due = computeSchedule(loan.id).filter(item => item.dueDate < today);
      const toPay = loan.skipLatestPayment ? due.slice(0, -1) : due;
      for (const item of toPay) {
        insertPayment.run(loan.id, item.installmentNumber, item.paymentAmount, item.dueDate, 'ACH', '', 'Demo Admin One', item.dueDate + 'T15:00:00Z');
      }
    }
  });
  console.log('[Loan-Service] Seeded demo notes and payment history');
}

export function openDatabase(computeSchedule) {
  const file = process.env.DB_PATH || resolve(here, 'data', 'loans.db');
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  if (process.env.NODE_ENV !== 'production') seed(db, loanId => computeSchedule(db, loanId));
  return db;
}

