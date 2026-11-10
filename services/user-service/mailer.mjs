// Sends email through Resend when RESEND_API_KEY and MAIL_FROM are set.
// Every message is also written to the email_outbox table so there is a record,
// and undelivered messages are printed to the console outside production.

const isProduction = process.env.NODE_ENV === 'production';

export function createMailer(db) {
  const record = db.prepare('INSERT INTO email_outbox (to_email, subject, body, delivered_via, created_at) VALUES (?, ?, ?, ?, ?)');

  return async function sendEmail({ to, subject, text }) {
    let via = 'outbox';
    const key = process.env.RESEND_API_KEY;
    const from = process.env.MAIL_FROM;

    if (key && from) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [to], subject, text }),
          signal: AbortSignal.timeout(8000)
        });
        via = response.ok ? 'resend' : `outbox (resend ${response.status})`;
      } catch {
        via = 'outbox (resend unreachable)';
      }
    }

    await record.run(to, subject, text, via, new Date().toISOString());
    const delivered = via === 'resend';
    if (!delivered && !isProduction) {
      console.log(`[User-Service] Email not sent (no mail provider). To: ${to} | ${subject}\n${text}\n`);
    }
    return { delivered };
  };
}

