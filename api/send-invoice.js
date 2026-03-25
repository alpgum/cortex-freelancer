/**
 * Invoice Email Sending API — Cortex Freelancer
 *
 * Sends professional invoice emails to clients via Resend API.
 * Supports invoice delivery, payment reminders, and thank-you receipts.
 *
 * POST /api/send-invoice
 * Body: { type, invoice, settings? }
 *   type: "invoice" | "reminder" | "receipt"
 */

const { cors } = require('./middleware/cors');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const RESEND_API = 'https://api.resend.com/emails';
const FROM = 'Cortex Freelancer <noreply@cortexfreelancer.com>';

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '\u20ac', GBP: '\u00a3', TRY: '\u20ba', JPY: '\u00a5',
  CAD: 'C$', AUD: 'A$', CHF: 'CHF', INR: '\u20b9', BRL: 'R$',
  EGP: 'E\u00a3', PKR: '\u20a8', NGN: '\u20a6', PHP: '\u20b1', BDT: '\u09f3',
};

function fmtCurrency(amount, currency = 'USD') {
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return sym + Number(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function invoiceEmailHtml(inv, settings = {}) {
  const cur = inv.currency || 'USD';
  const items = inv.items || [];
  const total = inv.total != null ? inv.total
    : items.reduce((s, i) => s + (i.amount || (i.quantity || i.qty || 0) * (i.rate || 0)), 0);
  const fromName = inv.fromName || settings.businessName || 'Freelancer';

  const itemRows = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const rate = item.rate || 0;
    const amt = item.amount || item.total || (qty * rate);
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:14px">${esc(item.description || item.desc || '')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#6b7280;font-size:14px">${qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280;font-size:14px">${fmtCurrency(rate, cur)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111827;font-size:14px">${fmtCurrency(amt, cur)}</td>
    </tr>`;
  }).join('');

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:0">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1f2937,#111827);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 4px">Invoice ${esc(inv.invoiceNumber || inv.number || '')}</h1>
    <p style="color:#9ca3af;font-size:14px;margin:0">From ${esc(fromName)}</p>
  </div>

  <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none">
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
      Dear ${esc(inv.clientName || inv.toName || 'Client')},
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">
      Please find the details for Invoice <strong>${esc(inv.invoiceNumber || inv.number || '')}</strong> below.
    </p>

    <!-- Summary Card -->
    <div style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px">
      <table style="width:100%;font-size:14px;color:#6b7280">
        <tr><td style="padding:4px 0"><strong style="color:#374151">Amount Due:</strong></td><td style="text-align:right;font-size:20px;font-weight:800;color:#ea580c">${fmtCurrency(total, cur)}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Due Date:</strong></td><td style="text-align:right;font-weight:600;color:#111827">${esc(inv.dueDate || inv.due || '')}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Currency:</strong></td><td style="text-align:right">${esc(cur)}</td></tr>
        ${inv.paymentTerms ? `<tr><td style="padding:4px 0"><strong style="color:#374151">Terms:</strong></td><td style="text-align:right">${esc(inv.paymentTerms)}</td></tr>` : ''}
      </table>
    </div>

    <!-- Line Items -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead>
        <tr style="background:#f9fafb">
          <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Description</th>
          <th style="text-align:center;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Qty</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Rate</th>
          <th style="text-align:right;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <!-- Bank Details -->
    ${(inv.bankDetails && (inv.bankDetails.bankName || inv.bankDetails.iban)) ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px">
      <strong style="display:block;font-size:13px;color:#166534;margin-bottom:8px">Payment Details</strong>
      <div style="font-size:13px;color:#374151;line-height:1.7">
        ${inv.bankDetails.bankName ? 'Bank: ' + esc(inv.bankDetails.bankName) + '<br>' : ''}
        ${inv.bankDetails.accountHolder ? 'Account Holder: ' + esc(inv.bankDetails.accountHolder) + '<br>' : ''}
        ${inv.bankDetails.iban ? 'IBAN / Account: ' + esc(inv.bankDetails.iban) + '<br>' : ''}
        ${inv.bankDetails.swift ? 'SWIFT / BIC: ' + esc(inv.bankDetails.swift) : ''}
      </div>
    </div>` : ''}

    ${inv.notes ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:24px;font-size:13px;color:#92400e;line-height:1.6"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ''}

    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:24px 0 0">
      If you have any questions about this invoice, please don't hesitate to reach out.
    </p>
    <p style="color:#374151;font-size:14px;margin:16px 0 0">
      Best regards,<br><strong>${esc(fromName)}</strong>
      ${inv.fromEmail ? '<br><span style="color:#6b7280;font-size:13px">' + esc(inv.fromEmail) + '</span>' : ''}
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f9fafb;padding:16px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;text-align:center">
    <p style="color:#9ca3af;font-size:11px;margin:0">Sent via <a href="https://cortexfreelancer.com" style="color:#f97316;text-decoration:none">Cortex Freelancer</a></p>
  </div>
</div>`;
}

function reminderEmailHtml(inv, settings = {}, reminderLevel = 1) {
  const cur = inv.currency || 'USD';
  const total = inv.total || 0;
  const remaining = total - (inv.paidAmount || 0);
  const fromName = inv.fromName || settings.businessName || 'Freelancer';
  const daysOverdue = inv.daysOverdue || 0;

  const tones = {
    1: { label: 'Friendly Reminder', color: '#2563eb', bgColor: '#eff6ff', borderColor: '#bfdbfe',
         message: `This is a friendly reminder that Invoice <strong>${esc(inv.invoiceNumber || inv.number || '')}</strong> for <strong>${fmtCurrency(remaining, cur)}</strong> ${daysOverdue > 0 ? `was due ${daysOverdue} day(s) ago` : 'is coming due soon'}. We'd appreciate payment at your earliest convenience.` },
    2: { label: 'Payment Overdue', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a',
         message: `This is a follow-up regarding Invoice <strong>${esc(inv.invoiceNumber || inv.number || '')}</strong> for <strong>${fmtCurrency(remaining, cur)}</strong>, which is now <strong>${daysOverdue} days overdue</strong>. Please arrange payment promptly to avoid late fees.` },
    3: { label: 'Final Notice', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca',
         message: `<strong>FINAL NOTICE:</strong> Invoice <strong>${esc(inv.invoiceNumber || inv.number || '')}</strong> for <strong>${fmtCurrency(remaining, cur)}</strong> is now <strong>${daysOverdue} days overdue</strong>. Late fees may apply. Please remit payment immediately to avoid further action.` },
  };

  const tone = tones[Math.min(reminderLevel, 3)];

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto">
  <div style="background:${tone.bgColor};border:1px solid ${tone.borderColor};border-radius:12px;padding:32px">
    <h2 style="color:${tone.color};font-size:20px;font-weight:800;margin:0 0 16px">${tone.label}</h2>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">Dear ${esc(inv.clientName || inv.toName || 'Client')},</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px">${tone.message}</p>

    <div style="background:#fff;border-radius:8px;padding:16px;margin-bottom:24px">
      <table style="width:100%;font-size:14px;color:#6b7280">
        <tr><td style="padding:4px 0"><strong style="color:#374151">Invoice:</strong></td><td style="text-align:right;font-weight:600;color:#111827">${esc(inv.invoiceNumber || inv.number || '')}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Amount Due:</strong></td><td style="text-align:right;font-size:18px;font-weight:800;color:${tone.color}">${fmtCurrency(remaining, cur)}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Original Due Date:</strong></td><td style="text-align:right">${esc(inv.dueDate || inv.due || '')}</td></tr>
      </table>
    </div>

    <p style="color:#374151;font-size:14px;margin:0">Best regards,<br><strong>${esc(fromName)}</strong></p>
  </div>
  <div style="text-align:center;padding:12px;font-size:11px;color:#9ca3af">Sent via <a href="https://cortexfreelancer.com" style="color:#f97316;text-decoration:none">Cortex Freelancer</a></div>
</div>`;
}

function receiptEmailHtml(inv, payment, settings = {}) {
  const cur = inv.currency || 'USD';
  const fromName = inv.fromName || settings.businessName || 'Freelancer';

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto">
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:32px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:48px;margin-bottom:8px">&#10003;</div>
      <h2 style="color:#166534;font-size:22px;font-weight:800;margin:0">Payment Received</h2>
    </div>

    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;text-align:center">
      Thank you! We've received your payment of <strong style="color:#166534">${fmtCurrency(payment.amount, cur)}</strong> for Invoice <strong>${esc(inv.invoiceNumber || inv.number || '')}</strong>.
    </p>

    <div style="background:#fff;border-radius:8px;padding:16px;margin-bottom:24px">
      <table style="width:100%;font-size:14px;color:#6b7280">
        <tr><td style="padding:4px 0"><strong style="color:#374151">Invoice:</strong></td><td style="text-align:right">${esc(inv.invoiceNumber || inv.number || '')}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Payment Amount:</strong></td><td style="text-align:right;font-weight:700;color:#166534">${fmtCurrency(payment.amount, cur)}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Payment Method:</strong></td><td style="text-align:right">${esc(payment.method || 'Bank Transfer')}</td></tr>
        <tr><td style="padding:4px 0"><strong style="color:#374151">Date:</strong></td><td style="text-align:right">${esc(payment.date || new Date().toISOString().slice(0, 10))}</td></tr>
        ${payment.reference ? `<tr><td style="padding:4px 0"><strong style="color:#374151">Reference:</strong></td><td style="text-align:right">${esc(payment.reference)}</td></tr>` : ''}
        ${(inv.total - (inv.paidAmount || 0) - payment.amount) > 0.01 ? `<tr><td style="padding:4px 0"><strong style="color:#374151">Remaining Balance:</strong></td><td style="text-align:right;color:#dc2626;font-weight:600">${fmtCurrency(inv.total - (inv.paidAmount || 0) - payment.amount, cur)}</td></tr>` : ''}
      </table>
    </div>

    <p style="color:#374151;font-size:14px;margin:0;text-align:center">
      Thank you for your business!<br><strong>${esc(fromName)}</strong>
    </p>
  </div>
  <div style="text-align:center;padding:12px;font-size:11px;color:#9ca3af">Sent via <a href="https://cortexfreelancer.com" style="color:#f97316;text-decoration:none">Cortex Freelancer</a></div>
</div>`;
}

// ─── Send via Resend ─────────────────────────────────────────────────────────

async function sendEmail(to, subject, html, replyTo) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[send-invoice] RESEND_API_KEY not set — skipping email to', to);
    return { success: false, error: 'Email service not configured' };
  }

  const payload = { from: FROM, to, subject, html };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API ${res.status}: ${body}`);
  }

  return { success: true, data: await res.json() };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);

  const { type, invoice, payment, settings, reminderLevel } = req.body;

  if (!type || !invoice) {
    return sendError(res, 400, 'type and invoice are required', 'MISSING_FIELDS', 'validation_error');
  }

  const toEmail = invoice.clientEmail || invoice.toEmail;
  if (!toEmail) {
    return sendError(res, 400, 'Client email is required', 'MISSING_EMAIL', 'validation_error');
  }

  const fromName = invoice.fromName || (settings && settings.businessName) || 'Freelancer';
  const invNum = invoice.invoiceNumber || invoice.number || 'Invoice';
  let subject, html;

  switch (type) {
    case 'invoice':
      subject = `Invoice ${invNum} from ${fromName}`;
      html = invoiceEmailHtml(invoice, settings);
      break;

    case 'reminder': {
      const level = parseInt(reminderLevel) || 1;
      const prefix = level >= 3 ? 'FINAL NOTICE: ' : level >= 2 ? 'Overdue: ' : '';
      subject = `${prefix}Payment reminder for Invoice ${invNum}`;
      html = reminderEmailHtml(invoice, settings, level);
      break;
    }

    case 'receipt':
      if (!payment) {
        return sendError(res, 400, 'payment object is required for receipts', 'MISSING_PAYMENT', 'validation_error');
      }
      subject = `Payment received — Invoice ${invNum}`;
      html = receiptEmailHtml(invoice, payment, settings);
      break;

    default:
      return sendError(res, 400, `Unknown type: ${type}`, 'INVALID_TYPE', 'validation_error');
  }

  const replyTo = invoice.fromEmail || (settings && settings.businessEmail);
  const result = await sendEmail(toEmail, subject, html, replyTo);

  if (!result.success) {
    return sendError(res, 503, result.error || 'Email service unavailable', 'EMAIL_FAILED', 'service_error');
  }

  console.log(`[send-invoice] ${type} → ${toEmail} (${invNum})`);
  res.json({ success: true, type, to: toEmail, subject });
});
