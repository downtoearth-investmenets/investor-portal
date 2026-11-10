import express from 'express';
import cors from 'cors';

export function createGatewayApp({ services, internalHeaders }) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  const UNAVAILABLE = { error: 'The service is unavailable. Please try again shortly.' };

  function internalUrl(base, path) {
    const target = new URL(base + path);
    // A route parameter must not change the internal route via URL normalization.
    if (target.pathname !== new URL(base).pathname + path) throw new Error('Invalid internal route');
    return target;
  }

  async function call(base, path, { method = 'GET', query = {}, body, headers = {} } = {}) {
    const url = internalUrl(base, path);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers, ...internalHeaders },
      redirect: 'error',
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(10000)
    });
    const text = await response.text();
    return { status: response.status, ok: response.ok, data: text ? JSON.parse(text) : null };
  }

  async function proxy(res, base, path, options = {}, transform = data => data) {
    try {
      const { status, ok, data } = await call(base, path, options);
      if (data === null) return res.status(status).end();
      res.status(status).json(ok ? transform(data) : data);
    } catch (err) {
      console.error(`[API Gateway] ${options.method || 'GET'} ${path} failed:`, err.message);
      res.status(502).json(UNAVAILABLE);
    }
  }

  const forwardAuth = req => (req.headers.authorization ? { Authorization: req.headers.authorization } : {});
  const actorHeaders = req => ({ 'x-actor-id': req.sessionUser.id, 'x-actor-name': req.sessionUser.fullName });
  const enc = encodeURIComponent;

  // ---------- auth ----------

  async function authenticate(req, res, next) {
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }
    try {
      const { ok, data } = await call(services.users, '/session', { headers: forwardAuth(req) });
      if (!ok) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
      req.sessionUser = data.user;
      next();
    } catch {
      res.status(502).json(UNAVAILABLE);
    }
  }

  function requireAdmin(req, res, next) {
    if (req.sessionUser?.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have access to this area.' });
    }
    next();
  }

  // Small in-memory limiter for sign-in and password endpoints.
  function rateLimit({ windowMs, max, key }) {
    const hits = new Map();
    return (req, res, next) => {
      const id = key(req);
      const nowMs = Date.now();
      const entry = hits.get(id);
      if (!entry || entry.resetAt < nowMs) {
        hits.set(id, { count: 1, resetAt: nowMs + windowMs });
        return next();
      }
      entry.count += 1;
      if (entry.count > max) {
        res.setHeader('Retry-After', Math.ceil((entry.resetAt - nowMs) / 1000));
        return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
      }
      next();
    };
  }

  const clientIp = req => req.ip || req.socket.remoteAddress || 'unknown';
  const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.LOGIN_ATTEMPT_LIMIT || 10),
    key: req => clientIp(req) + '|' + String(req.body?.email || '').trim().toLowerCase()
  });
  const passwordLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, key: clientIp });

  // Investors never see the internal activity log.
  const forInvestor = loan => {
    const { activity, ...rest } = loan;
    return rest;
  };

  // ---------- health ----------

  app.get(['/health', '/api/health'], async (req, res) => {
    const check = async (name, base) => {
      try {
        const { ok } = await call(base, '/health');
        return { name, status: ok ? 'UP' : 'DOWN' };
      } catch {
        return { name, status: 'DOWN' };
      }
    };
    const healthServices = await Promise.all(Object.entries(services).map(([name, base]) => check(name, base)));
    const healthy = healthServices.every(s => s.status === 'UP');
    res.status(healthy ? 200 : 503).json({ gateway: 'UP', healthy, services: healthServices });
  });

  // ---------- session and passwords (public) ----------

  app.post('/api/users/login', loginLimit, (req, res) => proxy(res, services.users, '/login', { method: 'POST', body: req.body }));
  app.post('/api/users/logout', (req, res) => proxy(res, services.users, '/logout', { method: 'POST', headers: forwardAuth(req) }));
  app.get('/api/users/session', (req, res) => proxy(res, services.users, '/session', { headers: forwardAuth(req) }));

  app.post('/api/users/password/forgot', passwordLimit, (req, res) =>
    proxy(res, services.users, '/password/forgot', { method: 'POST', body: req.body })
  );
  app.get('/api/users/links/:purpose/:token', (req, res) =>
    proxy(res, services.users, `/links/${enc(req.params.purpose)}/${enc(req.params.token)}`)
  );
  app.post('/api/users/links/:purpose/:token', passwordLimit, (req, res) =>
    proxy(res, services.users, `/links/${enc(req.params.purpose)}/${enc(req.params.token)}`, { method: 'POST', body: req.body })
  );
  app.post('/api/users/password', authenticate, passwordLimit, (req, res) =>
    proxy(res, services.users, '/password/change', { method: 'POST', body: req.body, headers: forwardAuth(req) })
  );

  // ---------- investor accounts (admin only) ----------

  app.get('/api/users/investors', authenticate, requireAdmin, (req, res) => proxy(res, services.users, '/investors'));
  app.post('/api/users/investors', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.users, '/investors', { method: 'POST', body: req.body })
  );
  app.post('/api/users/investors/:id/invite', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.users, `/investors/${enc(req.params.id)}/invite`, { method: 'POST' })
  );

  // ---------- notes ----------

  app.get('/api/loans', authenticate, (req, res) => {
    const user = req.sessionUser;
    if (user.role === 'admin') return proxy(res, services.loans, '/loans', { query: { ...req.query } });
    proxy(res, services.loans, '/loans', { query: { ...req.query, investorId: user.investorProfileId || 'none' } }, loans => loans.map(forInvestor));
  });

  app.get('/api/loans/:id', authenticate, async (req, res) => {
    const user = req.sessionUser;
    const path = `/loans/${enc(req.params.id)}`;
    if (user.role === 'admin') return proxy(res, services.loans, path);

    try {
      const { ok, data } = await call(services.loans, path);
      if (!ok || data.investorId !== user.investorProfileId) return res.status(404).json({ error: 'Note not found.' });
      res.json(forInvestor(data));
    } catch {
      res.status(502).json(UNAVAILABLE);
    }
  });

  app.post('/api/loans', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.loans, '/loans', { method: 'POST', body: req.body, headers: actorHeaders(req) })
  );

  app.patch('/api/loans/:id/rate', authenticate, requireAdmin, async (req, res) => {
    try {
      const result = await call(services.loans, `/loans/${enc(req.params.id)}/rate`, {
        method: 'PATCH',
        body: req.body,
        headers: actorHeaders(req)
      });
      if (!result.ok) return res.status(result.status).json(result.data);

      // Tell the investor. A mail failure should not undo the change, so report it instead.
      const { loan, change } = result.data;
      let investorNotified = false;
      try {
        const notice = await call(services.users, `/investors/${enc(loan.investorId)}/notify`, {
          method: 'POST',
          body: {
            subject: `Rate update for ${loan.loanNumber}`,
            text:
              `The fixed rate on note ${loan.loanNumber} (${loan.property.county}, ${loan.property.state}) changes from ${change.previousRate}% to ${change.rate}% ` +
              `starting with the payment due ${change.firstAffectedDueDate}. That payment becomes $${change.newPaymentAmount.toFixed(2)}.\n\n` +
              `Reason: ${change.reason}\n\nPayments already received are not affected.`
          }
        });
        investorNotified = notice.ok && notice.data.emailSent;
      } catch (err) {
        console.error('[API Gateway] Rate notice failed:', err.message);
      }
      res.json({ ...result.data, investorNotified });
    } catch (err) {
      console.error('[API Gateway] Rate change failed:', err.message);
      res.status(502).json(UNAVAILABLE);
    }
  });

  app.post('/api/loans/:id/payments', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.loans, `/loans/${enc(req.params.id)}/payments`, { method: 'POST', body: req.body, headers: actorHeaders(req) })
  );
  app.delete('/api/loans/:id/payments/:paymentId', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.loans, `/loans/${enc(req.params.id)}/payments/${enc(req.params.paymentId)}`, { method: 'DELETE', headers: actorHeaders(req) })
  );
  app.patch('/api/loans/:id/status', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.loans, `/loans/${enc(req.params.id)}/status`, { method: 'PATCH', body: req.body, headers: actorHeaders(req) })
  );

  // ---------- portfolio ----------

  app.get('/api/portfolio/admin-overview', authenticate, requireAdmin, (req, res) => proxy(res, services.portfolio, '/portfolio/admin-overview'));
  app.get('/api/portfolio/investors', authenticate, requireAdmin, (req, res) => proxy(res, services.portfolio, '/portfolio/investors'));
  app.get('/api/portfolio/investors/:id', authenticate, requireAdmin, (req, res) =>
    proxy(res, services.portfolio, `/portfolio/investor/${enc(req.params.id)}`)
  );
  app.get('/api/portfolio/me', authenticate, (req, res) => {
    const profileId = req.sessionUser.investorProfileId;
    if (!profileId) return res.status(404).json({ error: 'No investor profile is linked to this account.' });
    proxy(res, services.portfolio, `/portfolio/investor/${enc(profileId)}`);
  });

  // ---------- reports ----------

  const INVESTOR_REPORTS = ['statement', 'payments', 'schedule'];

  app.get('/api/reports/:type', authenticate, async (req, res) => {
    const user = req.sessionUser;
    const type = String(req.params.type);
    const query = {
      from: req.query.from,
      to: req.query.to,
      format: req.query.format === 'csv' ? 'csv' : 'json',
      investorId: req.query.investorId,
      today: req.query.today,
      audience: 'admin',
      generatedBy: user.fullName
    };

    if (user.role !== 'admin') {
      if (!INVESTOR_REPORTS.includes(type)) return res.status(403).json({ error: 'You do not have access to this report.' });
      if (!user.investorProfileId) return res.status(404).json({ error: 'No investor profile is linked to this account.' });
      query.investorId = user.investorProfileId;
      query.audience = 'investor';
    }

    const url = internalUrl(services.portfolio, `/reports/${enc(type)}`);
    for (const [key, value] of Object.entries(query)) if (value) url.searchParams.set(key, String(value));

    try {
      const response = await fetch(url, { headers: internalHeaders, signal: AbortSignal.timeout(15000), redirect: 'error' });
      res.status(response.status);
      for (const header of ['content-type', 'content-disposition']) {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      res.setHeader('Cache-Control', 'no-store');
      res.send(await response.text());
    } catch (err) {
      console.error('[API Gateway] Report failed:', err.message);
      res.status(502).json(UNAVAILABLE);
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

  return app;
}
