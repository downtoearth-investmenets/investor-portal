import express from 'express';
import {
  cashflow,
  isIsoDate,
  isSettled,
  installmentRow,
  overdueInstallments,
  receivedPayments,
  round2,
  sum,
  summarize,
  todayIso,
  upcomingInstallments,
  isOpen
} from './portfolio.mjs';
import { REPORTS, buildReport, toCsv } from './reports.mjs';

export function createPortfolioApp({ services, internalHeaders }) {
  const app = express();
  app.use(express.json());

  async function fetchJson(url) {
    const response = await fetch(url, { headers: internalHeaders, signal: AbortSignal.timeout(8000), redirect: 'error' });
    if (!response.ok) throw new Error(`${url} responded ${response.status}`);
    return response.json();
  }

  const fetchLoans = investorId =>
    fetchJson(`${services.loans}/loans${investorId ? `?investorId=${encodeURIComponent(investorId)}` : ''}`);
  const fetchInvestors = () => fetchJson(`${services.users}/investors`);

  function sendServiceError(res, err) {
    console.error('[Portfolio-Service]', err.message);
    res.status(502).json({ error: 'Portfolio data is unavailable right now. Please try again shortly.' });
  }

  app.get('/health', (req, res) => {
    res.json({ service: 'portfolio-service', status: 'healthy', timestamp: new Date().toISOString() });
  });

  app.get('/portfolio/admin-overview', async (req, res) => {
    try {
      const [loans, investors] = await Promise.all([fetchLoans(), fetchInvestors()]);
      const totals = summarize(loans);
      const monthStart = todayIso().slice(0, 8) + '01';
      const collectedThisMonth = round2(sum(receivedPayments(loans).filter(p => p.receivedDate >= monthStart), p => p.amount));

      const recentNotes = [...loans]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(b.originationDate).localeCompare(String(a.originationDate)))
        .slice(0, 5)
        .map(l => ({
          id: l.id,
          loanNumber: l.loanNumber,
          borrowerName: l.borrowerName,
          investorName: l.investorName,
          county: l.property?.county,
          state: l.property?.state,
          principalAmount: l.principalAmount,
          interestRate: l.interestRate,
          status: l.status
        }));

      const byState = new Map();
      for (const loan of loans.filter(isOpen)) {
        const state = loan.property?.state || 'Other';
        byState.set(state, (byState.get(state) || 0) + loan.principalAmount);
      }

      res.json({
        totalPrincipal: totals.principal,
        outstandingBalance: totals.outstanding,
        activeNotes: totals.count,
        averageRate: totals.averageRate,
        monthlyInflow: totals.monthly,
        collectedThisMonth,
        investorCount: investors.length,
        overduePayments: overdueInstallments(loans),
        upcomingPayments: upcomingInstallments(loans, { days: 30, limit: 6 }),
        recentNotes,
        allocation: [...byState].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
        cashflow: cashflow(loans)
      });
    } catch (err) {
      sendServiceError(res, err);
    }
  });

  app.get('/portfolio/investors', async (req, res) => {
    try {
      const [loans, investors] = await Promise.all([fetchLoans(), fetchInvestors()]);
      res.json(
        investors.map(investor => {
          const own = loans.filter(l => l.investorId === investor.id);
          const totals = summarize(own);
          return {
            ...investor,
            notesCount: totals.count,
            totalInvested: totals.principal,
            monthlyIncome: totals.monthly,
            latePayments: overdueInstallments(own).length
          };
        })
      );
    } catch (err) {
      sendServiceError(res, err);
    }
  });

  app.get('/portfolio/investor/:investorId', async (req, res) => {
    try {
      const loans = await fetchLoans(req.params.investorId);
      const totals = summarize(loans);
      const received = receivedPayments(loans);
      const settled = loans.flatMap(l => l.schedule.filter(isSettled));
      const nextOpen = loans
        .filter(isOpen)
        .flatMap(loan => loan.schedule.filter(item => !item.payment).slice(0, 1).map(item => installmentRow(loan, item)))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

      res.json({
        totalInvested: totals.principal,
        outstandingBalance: totals.outstanding,
        activeNotes: totals.count,
        averageRate: totals.averageRate,
        monthlyIncome: totals.monthly,
        interestEarned: round2(sum(received, p => p.interest)),
        principalRepaid: round2(sum(settled, item => item.principalComponent)),
        nextPayment: nextOpen
          ? { date: nextOpen.dueDate, amount: nextOpen.amount, loanId: nextOpen.loanId, loanNumber: nextOpen.loanNumber, daysLate: nextOpen.daysLate }
          : null,
        recentPayments: received.slice(0, 6),
        cashflow: cashflow(loans)
      });
    } catch (err) {
      sendServiceError(res, err);
    }
  });

  // ---------- reports ----------
  // The gateway decides who may run which report and pins investors to their own data.

  app.get('/reports/:type', async (req, res) => {
    const type = req.params.type;
    if (!REPORTS[type]) return res.status(404).json({ error: 'Unknown report.' });

    const audience = req.query.audience === 'investor' ? 'investor' : 'admin';
    const investorId = req.query.investorId ? String(req.query.investorId) : '';
    // The viewer's own calendar date, so "generated" and default periods match what they see.
    const today = isIsoDate(req.query.today) ? String(req.query.today) : todayIso();
    const from = req.query.from ? String(req.query.from) : today.slice(0, 4) + '-01-01';
    const to = req.query.to ? String(req.query.to) : today;

    if (!isIsoDate(from) || !isIsoDate(to)) return res.status(400).json({ error: 'Use valid dates.' });
    if (from > to) return res.status(400).json({ error: 'The start date must be before the end date.' });
    if (REPORTS[type].needsInvestor && !investorId) return res.status(400).json({ error: 'Choose an investor.' });

    try {
      const [loans, investors] = await Promise.all([fetchLoans(investorId || undefined), fetchInvestors()]);
      const investor = investorId ? investors.find(p => p.id === investorId) : null;
      if (investorId && !investor) return res.status(404).json({ error: 'Investor not found.' });

      const report = buildReport(type, { loans, investors, investor, from, to, audience, today, generatedBy: String(req.query.generatedBy || '') });

      if (req.query.format === 'csv') {
        const slug = [type, investor?.fullName, report.period ? `${from}_to_${to}` : today]
          .filter(Boolean)
          .join('-')
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '-');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="down-to-earth-${slug}.csv"`);
        return res.send(toCsv(report));
      }
      res.json(report);
    } catch (err) {
      sendServiceError(res, err);
    }
  });

  return app;
}
