// Email service — Resend API wrapper (free tier: 100 emails/day)
const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'Cortex Freelancer <noreply@cortexfreelancer.com>';

async function send(to, subject, html) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
    return null;
  }

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error', res.status, body);
    return null;
  }

  return res.json();
}

async function sendWelcomeEmail(to, name) {
  return send(to, 'Welcome to Cortex Freelancer!', `
    <h2>Hey ${name} 👋</h2>
    <p>Welcome to <strong>Cortex Freelancer</strong> — your AI-powered freelance toolkit.</p>
    <p>Explore the dashboard and let us know if you need anything.</p>
    <p>— The Cortex Team</p>
  `);
}

async function sendProActivatedEmail(to, name) {
  return send(to, 'Pro activated! 🚀', `
    <h2>You're Pro now, ${name}!</h2>
    <p>Thanks for upgrading. You now have access to all Pro features.</p>
    <p>If you have any questions, just reply to this email.</p>
    <p>— The Cortex Team</p>
  `);
}

async function sendReceiptEmail(to, name, amount) {
  return send(to, 'Payment receipt', `
    <h2>Thanks, ${name}!</h2>
    <p>We received your payment of <strong>$${amount}</strong>.</p>
    <p>You can manage your subscription from the billing portal anytime.</p>
    <p>— The Cortex Team</p>
  `);
}

module.exports = { sendWelcomeEmail, sendProActivatedEmail, sendReceiptEmail };
