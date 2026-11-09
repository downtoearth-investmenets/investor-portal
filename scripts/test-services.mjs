import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// End-to-end checks for the gateway and services. Each run uses fresh throwaway
// databases, so it never touches the data you use with pnpm dev.
const dataDir = mkdtempSync(join(tmpdir(), 'dte-test-'));
const API = 'http://127.0.0.1:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD || 'LocalDemoOnly2026!';
const NODE_ARGS = ['--disable-warning=ExperimentalWarning', 'server.mjs'];

const services = {
  users: { cwd: './services/user-service', env: { DB_PATH: join(dataDir, 'users.db') } },
  loans: { cwd: './services/loan-service', env: { DB_PATH: join(dataDir, 'loans.db') } },
  portfolio: { cwd: './services/portfolio-service', env: {} },
  gateway: { cwd: './apps/gateway', env: {} }
};

const running = {};
function start(name) {
  const { cwd, env } = services[name];
  const child = spawn('node', NODE_ARGS, { cwd, env: { ...process.env, ...env, NODE_ENV: 'test', RESEND_API_KEY: '', MAIL_FROM: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  running[name] = child;
  return child;
}
function stop(name) {
  return new Promise(resolve => {
    const child = running[name];
    if (!child || child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill();
  });
}

let failures = 0;
function check(label, condition, detail = '') {
  if (condition) console.log('  ok   ' + label);
  else {
    failures += 1;
    console.log('  FAIL ' + label + (detail ? ' -> ' + detail : ''));
  }
}

async function call(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const login = (email, password = PASSWORD) => call('/users/login', { method: 'POST', body: { email, password } });

async function waitFor(url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Timed out waiting for ' + url);
}

const tokenFrom = link => link.split('/').pop();

try {
  Object.keys(services).forEach(start);
  await waitFor(API + '/health');

  console.log('Sign-in');
  check('wrong password is rejected', (await login('admin.one@portal.example', 'nope')).status === 401);
  check('signed-out request is rejected', (await call('/loans')).status === 401);
  const admin = await login('admin.one@portal.example');
  const investorOne = await login('investor.one@portal.example');
  check('admin can sign in', admin.status === 200 && admin.data.user.role === 'admin');
  check('investor can sign in', investorOne.status === 200 && investorOne.data.user.role === 'investor');
  const A = admin.data.token;
  let J = investorOne.data.token;
  const investorOneProfile = investorOne.data.user.investorProfileId;

  console.log('Role boundaries');
  check('investor blocked from admin overview', (await call('/portfolio/admin-overview', { token: J })).status === 403);
  check('investor blocked from investor list', (await call('/users/investors', { token: J })).status === 403);
  check('investor blocked from rate changes', (await call('/loans/loan_dte_01/rate', { token: J, method: 'PATCH', body: {} })).status === 403);
  check('investor blocked from recording payments', (await call('/loans/loan_dte_01/payments', { token: J, method: 'POST', body: {} })).status === 403);

  console.log('Investor data isolation');
  const allLoans = (await call('/loans', { token: A })).data;
  const investorOneLoans = (await call('/loans', { token: J })).data;
  check('investor sees only their notes', investorOneLoans.length > 0 && investorOneLoans.every(l => l.investorId === investorOneProfile));
  check('investor never receives the activity log', investorOneLoans.every(l => !('activity' in l)));
  const foreign = allLoans.find(l => l.investorId !== investorOneProfile);
  check('investor cannot open another investor note', (await call('/loans/' + foreign.id, { token: J })).status === 404);

  console.log('Payment ledger');
  const overview = (await call('/portfolio/admin-overview', { token: A })).data;
  const late = overview.overduePayments.find(p => p.loanNumber === 'DEMO-NOTE-005');
  check('seeded late payment shows on the admin dashboard', Boolean(late), JSON.stringify(overview.overduePayments));
  const lateLoan = allLoans.find(l => l.loanNumber === 'DEMO-NOTE-005');
  check('a note with a missed payment is marked late', lateLoan.status === 'delinquent');
  const open = lateLoan.schedule.find(i => !i.payment);
  const today = new Date().toISOString().slice(0, 10);
  check('payments must be recorded in order',
    (await call('/loans/' + lateLoan.id + '/payments', { token: A, method: 'POST', body: { installmentNumber: open.installmentNumber + 1, amount: 10, receivedDate: today } })).status === 400);
  check('future received date is rejected',
    (await call('/loans/' + lateLoan.id + '/payments', { token: A, method: 'POST', body: { amount: open.paymentAmount, receivedDate: '2999-01-01' } })).status === 400);
  const paid = await call('/loans/' + lateLoan.id + '/payments', { token: A, method: 'POST', body: { amount: open.paymentAmount, receivedDate: today, method: 'Check', reference: '1042' } });
  check('admin can record a payment', paid.status === 201 && paid.data.loan.status === 'active', JSON.stringify(paid.data).slice(0, 200));
  check('recording is logged with who did it', paid.data.loan.activity[0].kind === 'payment' && paid.data.loan.activity[0].actor === 'Demo Admin One');
  const afterPay = (await call('/portfolio/admin-overview', { token: A })).data;
  check('late list clears after the payment', !afterPay.overduePayments.some(p => p.loanNumber === 'DEMO-NOTE-005'));
  const undo = await call('/loans/' + lateLoan.id + '/payments/' + paid.data.payment.id, { token: A, method: 'DELETE' });
  check('latest payment can be undone', undo.status === 200 && undo.data.loan.status === 'delinquent');
  const earlier = lateLoan.schedule.find(i => i.payment);
  check('older payments cannot be undone',
    (await call('/loans/' + lateLoan.id + '/payments/' + earlier.payment.id, { token: A, method: 'DELETE' })).status === 409);

  console.log('Rate changes keep history');
  const target = investorOneLoans.find(l => l.loanNumber === 'DEMO-NOTE-001');
  const lastPaid = [...target.schedule].reverse().find(i => i.payment);
  const nextDue = target.schedule.find(i => !i.payment);
  check('reason is required',
    (await call('/loans/' + target.id + '/rate', { token: A, method: 'PATCH', body: { interestRate: 12.25, effectiveDate: nextDue.dueDate, reason: '' } })).status === 400);
  check('cannot start before recorded payments',
    (await call('/loans/' + target.id + '/rate', { token: A, method: 'PATCH', body: { interestRate: 12.25, effectiveDate: lastPaid.dueDate, reason: 'Test' } })).status === 400);
  check('out-of-range rate rejected',
    (await call('/loans/' + target.id + '/rate', { token: A, method: 'PATCH', body: { interestRate: 45, effectiveDate: nextDue.dueDate, reason: 'Test' } })).status === 400);
  const changed = await call('/loans/' + target.id + '/rate', {
    token: A, method: 'PATCH', body: { interestRate: 12.25, effectiveDate: nextDue.dueDate, reason: 'Borrower requested an extension' }
  });
  check('admin can change the rate from a future payment', changed.status === 200 && changed.data.loan.interestRate === 12.25, JSON.stringify(changed.data).slice(0, 200));
  check('response says whether the investor was emailed', typeof changed.data.investorNotified === 'boolean');
  const paidBefore = target.schedule.filter(i => i.payment);
  const paidAfter = changed.data.loan.schedule.filter(i => i.payment);
  check('paid installments are unchanged',
    paidBefore.length === paidAfter.length && paidBefore.every((item, i) => item.paymentAmount === paidAfter[i].paymentAmount && item.remainingBalance === paidAfter[i].remainingBalance));
  const changedItem = changed.data.loan.schedule.find(i => i.installmentNumber === nextDue.installmentNumber);
  check('future payments are recalculated', changedItem.paymentAmount > nextDue.paymentAmount && changedItem.rate === 12.25);
  check('final payment clears the balance', changed.data.loan.schedule.at(-1).remainingBalance === 0);
  check('rate history is kept', changed.data.loan.rateHistory.length === 2 && changed.data.loan.rateHistory[1].reason === 'Borrower requested an extension');
  const seen = (await call('/loans/' + target.id, { token: J })).data;
  check('investor sees the new rate and its history', seen.interestRate === 12.25 && seen.rateHistory.length === 2);

  console.log('Data survives a restart');
  await stop('loans');
  start('loans');
  await waitFor('http://127.0.0.1:4002/health');
  const reloaded = await call('/loans/' + target.id, { token: A });
  check('rate change is still there after restart',
    reloaded.status === 200 && reloaded.data.interestRate === 12.25 && reloaded.data.rateHistory.length === 2,
    reloaded.status + ' ' + JSON.stringify(reloaded.data).slice(0, 200));

  console.log('Investor invites');
  const email = 'investor.' + Date.now() + '@fixtures.example';
  const invite = await call('/users/investors', { token: A, method: 'POST', body: { fullName: 'Demo Invitee', email, entityName: 'Demo Invitee Trust' } });
  check('admin can invite an investor', invite.status === 201 && invite.data.inviteLink.includes('/onboard/'));
  check('duplicate email rejected', (await call('/users/investors', { token: A, method: 'POST', body: { fullName: 'Dup', email } })).status === 409);
  check('invited investor cannot sign in yet', (await login(email)).status === 401);
  const roster = (await call('/portfolio/investors', { token: A })).data;
  const fresh = roster.find(i => i.email === email);
  check('new investor starts at $0 and invited', fresh && fresh.totalInvested === 0 && fresh.status === 'invited');
  const resent = await call('/users/investors/' + fresh.id + '/invite', { token: A, method: 'POST' });
  check('admin can resend the invite', resent.status === 200);
  const oldToken = tokenFrom(invite.data.inviteLink);
  check('resending replaces the old link', (await call('/users/links/invite/' + oldToken)).status === 410);
  const inviteToken = tokenFrom(resent.data.inviteLink);
  const lookup = await call('/users/links/invite/' + inviteToken);
  check('invite link shows who it is for', lookup.status === 200 && lookup.data.email === email);
  check('weak password rejected', (await call('/users/links/invite/' + inviteToken, { method: 'POST', body: { password: 'short' } })).status === 400);
  const accepted = await call('/users/links/invite/' + inviteToken, { method: 'POST', body: { password: 'LocalInviteTest2026!' } });
  check('investor can set a password and is signed in', accepted.status === 200 && accepted.data.user.status === 'active' && Boolean(accepted.data.token));
  check('invite link works only once', (await call('/users/links/invite/' + inviteToken, { method: 'POST', body: { password: 'LocalInviteTest2026!' } })).status === 410);
  check('investor can sign in with their own password', (await login(email, 'LocalInviteTest2026!')).status === 200);
  check('resend is refused after setup', (await call('/users/investors/' + fresh.id + '/invite', { token: A, method: 'POST' })).status === 409);

  console.log('Password reset and change');
  const forgot = await call('/users/password/forgot', { method: 'POST', body: { email: 'investor.one@portal.example' } });
  check('reset request gives the same answer for any email', forgot.status === 200 && (await call('/users/password/forgot', { method: 'POST', body: { email: 'nobody@fixtures.example' } })).data.message === forgot.data.message);
  check('reset link available while no mail provider is set', Boolean(forgot.data.previewLink));
  const reset = await call('/users/links/reset/' + tokenFrom(forgot.data.previewLink), { method: 'POST', body: { password: 'LocalResetTest2026!' } });
  check('reset sets the new password', reset.status === 200);
  check('reset signs out old sessions', (await call('/loans', { token: J })).status === 401);
  check('old password stops working', (await login('investor.one@portal.example')).status === 401);
  J = (await login('investor.one@portal.example', 'LocalResetTest2026!')).data.token;
  check('change password needs the current one',
    (await call('/users/password', { token: J, method: 'POST', body: { currentPassword: 'wrong', newPassword: 'Another2026pass' } })).status === 400);
  check('change password works',
    (await call('/users/password', { token: J, method: 'POST', body: { currentPassword: 'LocalResetTest2026!', newPassword: 'Another2026pass' } })).status === 200);

  console.log('Abuse limits');
  let limited = false;
  for (let i = 0; i < 12; i += 1) {
    if ((await login('ghost@fixtures.example', 'x')).status === 429) limited = true;
  }
  check('repeated failed sign-ins are slowed down', limited);

  console.log('Reports');
  const A2 = (await login('admin.one@portal.example')).data.token;
  const investorTwo = await login('investor.two@portal.example');
  const S = investorTwo.data.token;
  const year = new Date().getFullYear();
  const statement = await call('/reports/statement?from=' + year + '-01-01&to=' + year + '-12-31', { token: S });
  check('investor can build their statement', statement.status === 200 && statement.data.sections.length === 2 && statement.data.subject.includes('Demo Investor Two'));
  check('statement only lists their notes', statement.data.sections[0].rows.every(r => ['DEMO-NOTE-002', 'DEMO-NOTE-005'].includes(r.loanNumber)));
  const spoof = await call('/reports/statement?investorId=inv_prof_1', { token: S });
  check('investor cannot pull another investor statement', spoof.status === 200 && !spoof.data.subject.includes('Demo Investor One'));
  check('investor blocked from the note register', (await call('/reports/portfolio', { token: S })).status === 403);
  check('admin statement needs an investor', (await call('/reports/statement', { token: A2 })).status === 400);
  check('bad date range rejected', (await call('/reports/payments?from=2026-05-01&to=2026-01-01', { token: A2 })).status === 400);
  const register = await call('/reports/portfolio', { token: A2 });
  check('admin can build the note register', register.status === 200 && register.data.sections[0].rows.length >= 5);
  const csvRes = await fetch(API + '/reports/payments?format=csv&from=2025-01-01&to=' + year + '-12-31', { headers: { Authorization: 'Bearer ' + A2 } });
  const csv = await csvRes.text();
  check('CSV export downloads as a file', csvRes.status === 200 && /attachment; filename="down-to-earth-payments/.test(csvRes.headers.get('content-disposition') || ''));
  check('CSV has a header row and totals', csv.includes('Received,Note,Land,Investor') && csv.includes('Total,'));
  const overviewCash = (await call('/portfolio/admin-overview', { token: A2 })).data;
  check('dashboard includes 18 months of cash flow', overviewCash.cashflow.length === 18 && overviewCash.cashflow.some(m => m.current));
  const one = await call('/portfolio/investors/inv_prof_2', { token: A2 });
  check('admin can open one investor summary', one.status === 200 && one.data.totalInvested > 0 && one.data.cashflow.length === 18);
  check('investor cannot open another investor summary', (await call('/portfolio/investors/inv_prof_1', { token: S })).status === 403);
  const dated = await fetch(API + '/reports/payments?format=csv&today=2026-11-08', { headers: { Authorization: 'Bearer ' + A2 } });
  check('CSV uses the viewer date', (await dated.text()).includes('Generated,2026-11-08'));

  console.log('Sign-out');
  await call('/users/logout', { token: J, method: 'POST' });
  check('token is revoked after sign-out', (await call('/loans', { token: J })).status === 401);
} catch (e) {
  failures += 1;
  console.error('Test error:', e);
} finally {
  await Promise.all(Object.keys(running).map(stop));
  rmSync(dataDir, { recursive: true, force: true });
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

