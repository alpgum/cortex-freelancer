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

async function sendProActivatedEmail(to, name, plan) {
  const planLabel = plan === 'pro_annual' ? 'Annual' : 'Monthly';
  return send(to, "You're now Pro! Here's everything you unlocked 🚀", `
    <h2>Welcome to Pro, ${name}! 🎉</h2>
    <p>Your <strong>${planLabel} Pro</strong> plan is now active. Here's what you've unlocked:</p>
    <ul style="line-height:1.8">
      <li>📝 <a href="https://cortexfreelancer.com/tools/proposal-writer">AI Proposal Writer</a> — generate winning proposals in seconds</li>
      <li>💰 <a href="https://cortexfreelancer.com/tools/invoice-generator">Invoice Generator</a> — create & send professional invoices</li>
      <li>✉️ <a href="https://cortexfreelancer.com/tools/email-writer">Email Writer</a> — draft client emails with AI</li>
      <li>📊 <a href="https://cortexfreelancer.com/tools/rate-calculator">Rate Calculator</a> — price your services right</li>
      <li>📋 <a href="https://cortexfreelancer.com/tools/contract-builder">Contract Builder</a> — professional contracts in minutes</li>
    </ul>
    <p style="margin-top:20px">
      <a href="https://cortexfreelancer.com/dashboard" style="background:#6C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Go to Dashboard →</a>
    </p>
    <p style="margin-top:24px;color:#666">Questions? Just reply to this email — we're here to help.</p>
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

async function sendTrialExpiryEmail(to, name, daysLeft) {
  const subject = daysLeft <= 0
    ? 'Your Cortex Pro trial has ended'
    : `Your trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;

  const urgency = daysLeft <= 0
    ? `<p>Your free trial has expired. Upgrade now to keep access to unlimited analyses, the invoice generator, proposal writer, and all Pro features.</p>`
    : `<p>Your 7-day free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. After that, you'll lose access to unlimited analyses, the invoice generator, proposal writer, and all Pro features.</p>`;

  return send(to, subject, `
    <h2>Hey ${name},</h2>
    ${urgency}
    <p style="margin-top:20px">
      <a href="https://cortexfreelancer.com/pricing" style="background:#ff8844;color:#000;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">Upgrade to Pro &rarr;</a>
    </p>
    <p style="margin-top:20px;color:#666;font-size:14px">Plans start at $29/mo or save 28% with annual billing ($249/yr).</p>
    <p style="color:#666;font-size:14px">Questions? Just reply to this email.</p>
    <p>— The Cortex Team</p>
  `);
}

module.exports = { sendWelcomeEmail, sendProActivatedEmail, sendReceiptEmail, sendTrialExpiryEmail };
