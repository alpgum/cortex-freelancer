/**
 * Invoice PDF Generation API — Cortex Freelancer
 *
 * Generates professional PDF invoices server-side using puppeteer-core.
 * Supports multiple templates, multi-currency, tax calculations,
 * and returns a downloadable PDF buffer.
 *
 * POST /api/generate-invoice-pdf
 * Body: { invoice, template?, settings? }
 */

const { cors } = require('./middleware/cors');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

// ─── Currency ────────────────────────────────────────────────────────────────

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

// ─── Template: Professional ──────────────────────────────────────────────────

function templateProfessional(data) {
  const inv = data.invoice;
  const settings = data.settings || {};
  const cur = inv.currency || 'USD';
  const items = inv.items || [];
  const subtotal = items.reduce((s, i) => s + (i.amount || (i.quantity || i.qty || 0) * (i.rate || 0)), 0);
  const taxPct = parseFloat(inv.taxRate || inv.tax || 0);
  const taxAmount = inv.taxAmount != null ? inv.taxAmount : subtotal * (taxPct / 100);
  const discount = parseFloat(inv.discount || 0);
  const total = inv.total != null ? inv.total : (subtotal - discount + taxAmount);

  const itemRows = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const rate = item.rate || 0;
    const amt = item.amount || item.total || (qty * rate);
    return `<tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#374151">${esc(item.description || item.desc || '')}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280">${qty}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280">${fmtCurrency(rate, cur)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;color:#111827">${fmtCurrency(amt, cur)}</td>
    </tr>`;
  }).join('');

  const logoHtml = inv.logo
    ? `<img src="${inv.logo}" style="max-width:140px;max-height:70px;object-fit:contain" alt="Logo">`
    : `<div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#ff8844,#ff6622);display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#fff;letter-spacing:1px">${esc((inv.fromName || settings.businessName || 'CF').substring(0, 2).toUpperCase())}</div>`;

  const bankDetails = inv.bankDetails || settings.bankDetails || {};
  const hasBankInfo = bankDetails.bankName || bankDetails.accountHolder || bankDetails.iban;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#111827; background:#fff; }
  .wrap { max-width:800px; margin:0 auto; padding:48px; }
  @media print { .wrap { padding:24px; } @page { margin:15mm; size:A4; } }
</style>
</head><body>
<div class="wrap">
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #111827">
    <div>
      ${logoHtml}
      <div style="margin-top:12px;font-size:18px;font-weight:800;color:#111827">${esc(inv.fromName || settings.businessName || '')}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.6;margin-top:4px">
        ${inv.fromEmail ? esc(inv.fromEmail) + '<br>' : ''}
        ${inv.fromAddress ? esc(inv.fromAddress).replace(/\n/g, '<br>') : ''}
        ${inv.taxId || settings.taxId ? '<br>Tax ID: ' + esc(inv.taxId || settings.taxId) : ''}
      </div>
    </div>
    <div style="text-align:right">
      <h1 style="font-size:36px;font-weight:900;color:#111827;letter-spacing:-1px">INVOICE</h1>
      <div style="font-size:14px;color:#6b7280;margin-top:8px;line-height:1.8">
        <div><strong style="color:#374151">${esc(inv.invoiceNumber || inv.number || '')}</strong></div>
        <div>Issued: ${esc(inv.issueDate || inv.date || '')}</div>
        <div>Due: ${esc(inv.dueDate || inv.due || '')}</div>
      </div>
    </div>
  </div>

  <!-- Parties -->
  <div style="display:flex;gap:48px;margin-bottom:32px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:6px">From</div>
      <div style="font-size:15px;font-weight:700;color:#111827">${esc(inv.fromName || settings.businessName || '')}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.7">
        ${inv.fromEmail ? esc(inv.fromEmail) : ''}
        ${inv.fromAddress ? '<br>' + esc(inv.fromAddress).replace(/\n/g, '<br>') : ''}
      </div>
    </div>
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:6px">Bill To</div>
      <div style="font-size:15px;font-weight:700;color:#111827">${esc(inv.clientName || inv.toName || '')}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.7">
        ${inv.clientEmail || inv.toEmail ? esc(inv.clientEmail || inv.toEmail) : ''}
        ${inv.clientAddress || inv.toAddress ? '<br>' + esc(inv.clientAddress || inv.toAddress).replace(/\n/g, '<br>') : ''}
      </div>
    </div>
  </div>

  <!-- Meta bar -->
  <div style="display:flex;gap:32px;background:#f9fafb;border-radius:8px;padding:14px 20px;margin-bottom:28px">
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af">Invoice Date</div>
      <div style="font-size:14px;font-weight:600;color:#111827">${esc(inv.issueDate || inv.date || '')}</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af">Due Date</div>
      <div style="font-size:14px;font-weight:600;color:#111827">${esc(inv.dueDate || inv.due || '')}</div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af">Currency</div>
      <div style="font-size:14px;font-weight:600;color:#111827">${esc(cur)}</div>
    </div>
    ${inv.paymentTerms ? `<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af">Terms</div>
      <div style="font-size:14px;font-weight:600;color:#111827">${esc(inv.paymentTerms)}</div>
    </div>` : ''}
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr>
        <th style="text-align:left;padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:#1f2937;border:none;border-radius:6px 0 0 6px">Description</th>
        <th style="text-align:center;padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:#1f2937">Qty</th>
        <th style="text-align:right;padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:#1f2937">Rate</th>
        <th style="text-align:right;padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;background:#1f2937;border-radius:0 6px 6px 0">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:32px">
    <div style="width:280px;background:#f9fafb;border-radius:8px;padding:16px 20px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#6b7280">
        <span>Subtotal</span><span style="font-weight:600;color:#374151">${fmtCurrency(subtotal, cur)}</span>
      </div>
      ${discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#059669">
        <span>Discount</span><span style="font-weight:600">-${fmtCurrency(discount, cur)}</span>
      </div>` : ''}
      ${taxPct > 0 || taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#6b7280">
        <span>Tax${taxPct ? ' (' + taxPct + '%)' : ''}</span><span style="font-weight:600;color:#374151">${fmtCurrency(taxAmount, cur)}</span>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 0 6px;margin-top:8px;border-top:2px solid #111827;font-size:20px;font-weight:800;color:#111827">
        <span>Total</span><span style="color:#ea580c">${fmtCurrency(total, cur)}</span>
      </div>
      ${inv.paidAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#059669">
        <span>Paid</span><span style="font-weight:600">-${fmtCurrency(inv.paidAmount, cur)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:16px;font-weight:700;color:#dc2626">
        <span>Balance Due</span><span>${fmtCurrency(total - inv.paidAmount, cur)}</span>
      </div>` : ''}
    </div>
  </div>

  ${hasBankInfo ? `
  <!-- Bank Details -->
  <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#6b7280;line-height:1.8">
    <strong style="display:block;margin-bottom:8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#374151">Payment Details</strong>
    ${bankDetails.bankName ? '<div><span style="color:#9ca3af">Bank:</span> ' + esc(bankDetails.bankName) + '</div>' : ''}
    ${bankDetails.accountHolder ? '<div><span style="color:#9ca3af">Account Holder:</span> ' + esc(bankDetails.accountHolder) + '</div>' : ''}
    ${bankDetails.iban ? '<div><span style="color:#9ca3af">IBAN / Account:</span> ' + esc(bankDetails.iban) + '</div>' : ''}
    ${bankDetails.swift ? '<div><span style="color:#9ca3af">SWIFT / BIC:</span> ' + esc(bankDetails.swift) + '</div>' : ''}
  </div>` : ''}

  ${inv.notes ? `
  <!-- Notes -->
  <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:14px 16px 14px 20px;margin-bottom:24px;font-size:13px;color:#92400e;line-height:1.6">
    <strong style="display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#78350f">Notes</strong>
    ${esc(inv.notes).replace(/\n/g, '<br>')}
  </div>` : ''}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#d1d5db">
    Generated with Cortex Freelancer &middot; cortexfreelancer.com
  </div>
</div>
</body></html>`;
}

// ─── Template: Minimal ───────────────────────────────────────────────────────

function templateMinimal(data) {
  const inv = data.invoice;
  const settings = data.settings || {};
  const cur = inv.currency || 'USD';
  const items = inv.items || [];
  const subtotal = items.reduce((s, i) => s + (i.amount || (i.quantity || i.qty || 0) * (i.rate || 0)), 0);
  const taxPct = parseFloat(inv.taxRate || inv.tax || 0);
  const taxAmount = inv.taxAmount != null ? inv.taxAmount : subtotal * (taxPct / 100);
  const discount = parseFloat(inv.discount || 0);
  const total = inv.total != null ? inv.total : (subtotal - discount + taxAmount);

  const itemRows = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const rate = item.rate || 0;
    const amt = item.amount || item.total || (qty * rate);
    return `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#374151">${esc(item.description || item.desc || '')}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:center;color:#9ca3af">${qty}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;color:#9ca3af">${fmtCurrency(rate, cur)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmtCurrency(amt, cur)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#111827; background:#fff; font-size:14px; }
  .wrap { max-width:800px; margin:0 auto; padding:48px; }
  @media print { .wrap { padding:24px; } @page { margin:15mm; size:A4; } }
</style>
</head><body>
<div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:48px">
    <h1 style="font-size:42px;font-weight:900;letter-spacing:-2px;color:#111827">Invoice</h1>
    <div style="text-align:right;font-size:13px;color:#9ca3af;line-height:1.8">
      <div style="font-size:16px;font-weight:700;color:#111827">${esc(inv.invoiceNumber || inv.number || '')}</div>
      ${esc(inv.issueDate || inv.date || '')}<br>Due: ${esc(inv.dueDate || inv.due || '')}
    </div>
  </div>

  <div style="display:flex;gap:48px;margin-bottom:40px;font-size:13px;color:#6b7280;line-height:1.7">
    <div style="flex:1">
      <div style="font-weight:700;color:#111827;font-size:15px;margin-bottom:4px">${esc(inv.fromName || settings.businessName || '')}</div>
      ${inv.fromEmail ? esc(inv.fromEmail) + '<br>' : ''}${inv.fromAddress ? esc(inv.fromAddress).replace(/\n/g, '<br>') : ''}
    </div>
    <div style="flex:1;text-align:right">
      <div style="font-weight:700;color:#111827;font-size:15px;margin-bottom:4px">${esc(inv.clientName || inv.toName || '')}</div>
      ${inv.clientEmail || inv.toEmail ? esc(inv.clientEmail || inv.toEmail) + '<br>' : ''}${inv.clientAddress || inv.toAddress ? esc(inv.clientAddress || inv.toAddress).replace(/\n/g, '<br>') : ''}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:32px">
    <thead>
      <tr style="border-bottom:2px solid #111827">
        <th style="text-align:left;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">Description</th>
        <th style="text-align:center;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">Qty</th>
        <th style="text-align:right;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">Rate</th>
        <th style="text-align:right;padding:8px 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:40px">
    <div style="width:240px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#6b7280"><span>Subtotal</span><span>${fmtCurrency(subtotal, cur)}</span></div>
      ${discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#059669"><span>Discount</span><span>-${fmtCurrency(discount, cur)}</span></div>` : ''}
      ${taxPct > 0 || taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#6b7280"><span>Tax${taxPct ? ' (' + taxPct + '%)' : ''}</span><span>${fmtCurrency(taxAmount, cur)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:12px 0 0;margin-top:8px;border-top:2px solid #111827;font-size:22px;font-weight:900"><span>Total</span><span>${fmtCurrency(total, cur)}</span></div>
    </div>
  </div>

  ${inv.notes ? `<div style="padding:16px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#6b7280;line-height:1.6"><strong style="color:#374151">Notes:</strong> ${esc(inv.notes).replace(/\n/g, '<br>')}</div>` : ''}
  <div style="margin-top:48px;text-align:center;font-size:10px;color:#d1d5db">cortexfreelancer.com</div>
</div>
</body></html>`;
}

// ─── Template: Bold ──────────────────────────────────────────────────────────

function templateBold(data) {
  const inv = data.invoice;
  const settings = data.settings || {};
  const cur = inv.currency || 'USD';
  const items = inv.items || [];
  const subtotal = items.reduce((s, i) => s + (i.amount || (i.quantity || i.qty || 0) * (i.rate || 0)), 0);
  const taxPct = parseFloat(inv.taxRate || inv.tax || 0);
  const taxAmount = inv.taxAmount != null ? inv.taxAmount : subtotal * (taxPct / 100);
  const discount = parseFloat(inv.discount || 0);
  const total = inv.total != null ? inv.total : (subtotal - discount + taxAmount);

  const itemRows = items.map(item => {
    const qty = item.quantity || item.qty || 1;
    const rate = item.rate || 0;
    const amt = item.amount || item.total || (qty * rate);
    return `<tr>
      <td style="padding:14px 16px;border-bottom:1px solid #374151;color:#e5e7eb">${esc(item.description || item.desc || '')}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #374151;text-align:center;color:#9ca3af">${qty}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #374151;text-align:right;color:#9ca3af">${fmtCurrency(rate, cur)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #374151;text-align:right;font-weight:700;color:#fff">${fmtCurrency(amt, cur)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#f3f4f6; background:#111827; font-size:14px; }
  .wrap { max-width:800px; margin:0 auto; padding:48px; }
  @media print { body { background:#111827; -webkit-print-color-adjust:exact; print-color-adjust:exact; } .wrap { padding:24px; } @page { margin:10mm; size:A4; } }
</style>
</head><body>
<div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;padding-bottom:24px;border-bottom:3px solid #f97316">
    <div>
      <h1 style="font-size:40px;font-weight:900;letter-spacing:-2px;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent">INVOICE</h1>
      <div style="font-size:14px;color:#9ca3af;margin-top:4px">${esc(inv.invoiceNumber || inv.number || '')}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800;color:#fff">${esc(inv.fromName || settings.businessName || '')}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.7;margin-top:4px">
        ${inv.fromEmail ? esc(inv.fromEmail) + '<br>' : ''}${inv.fromAddress ? esc(inv.fromAddress).replace(/\n/g, '<br>') : ''}
      </div>
    </div>
  </div>

  <div style="display:flex;gap:48px;margin-bottom:32px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#f97316;margin-bottom:8px">Bill To</div>
      <div style="font-size:16px;font-weight:700;color:#fff">${esc(inv.clientName || inv.toName || '')}</div>
      <div style="font-size:13px;color:#6b7280;line-height:1.7;margin-top:4px">
        ${inv.clientEmail || inv.toEmail ? esc(inv.clientEmail || inv.toEmail) + '<br>' : ''}${inv.clientAddress || inv.toAddress ? esc(inv.clientAddress || inv.toAddress).replace(/\n/g, '<br>') : ''}
      </div>
    </div>
    <div style="flex:1;display:flex;gap:24px;justify-content:flex-end">
      <div style="text-align:center;background:#1f2937;border-radius:12px;padding:16px 20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">Issued</div>
        <div style="font-size:14px;font-weight:600;color:#fff;margin-top:4px">${esc(inv.issueDate || inv.date || '')}</div>
      </div>
      <div style="text-align:center;background:#1f2937;border-radius:12px;padding:16px 20px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280">Due</div>
        <div style="font-size:14px;font-weight:600;color:#f97316;margin-top:4px">${esc(inv.dueDate || inv.due || '')}</div>
      </div>
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
    <thead>
      <tr>
        <th style="text-align:left;padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f97316;background:#1f2937;border-radius:8px 0 0 8px">Description</th>
        <th style="text-align:center;padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f97316;background:#1f2937">Qty</th>
        <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f97316;background:#1f2937">Rate</th>
        <th style="text-align:right;padding:12px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#f97316;background:#1f2937;border-radius:0 8px 8px 0">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:32px">
    <div style="width:280px;background:#1f2937;border-radius:12px;padding:20px">
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#9ca3af"><span>Subtotal</span><span style="color:#e5e7eb">${fmtCurrency(subtotal, cur)}</span></div>
      ${discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#34d399"><span>Discount</span><span>-${fmtCurrency(discount, cur)}</span></div>` : ''}
      ${taxPct > 0 || taxAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#9ca3af"><span>Tax${taxPct ? ' (' + taxPct + '%)' : ''}</span><span style="color:#e5e7eb">${fmtCurrency(taxAmount, cur)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:14px 0 6px;margin-top:8px;border-top:2px solid #f97316;font-size:22px;font-weight:900">
        <span style="color:#fff">Total</span><span style="color:#f97316">${fmtCurrency(total, cur)}</span>
      </div>
    </div>
  </div>

  ${inv.notes ? `<div style="background:#1f2937;border-left:3px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px 14px 20px;margin-bottom:24px;font-size:13px;color:#9ca3af;line-height:1.6"><strong style="display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#f97316">Notes</strong>${esc(inv.notes).replace(/\n/g, '<br>')}</div>` : ''}
  <div style="margin-top:48px;text-align:center;font-size:10px;color:#374151">cortexfreelancer.com</div>
</div>
</body></html>`;
}

// ─── Template Registry ───────────────────────────────────────────────────────

const TEMPLATES = {
  professional: templateProfessional,
  minimal: templateMinimal,
  bold: templateBold,
};

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  sanitize(req);

  const { invoice, template = 'professional', format = 'pdf', settings } = req.body;

  if (!invoice) {
    return sendError(res, 400, 'invoice object is required', 'MISSING_INVOICE', 'validation_error');
  }

  if (!invoice.items || !invoice.items.length) {
    return sendError(res, 400, 'At least one line item is required', 'NO_ITEMS', 'validation_error');
  }

  const templateFn = TEMPLATES[template] || TEMPLATES.professional;
  const html = templateFn({ invoice, settings });

  // If HTML format requested, return directly
  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  // PDF generation via puppeteer-core
  let browser;
  try {
    const chromium = require('@sparticuz/chromium');
    const puppeteer = require('puppeteer-core');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const filename = (invoice.invoiceNumber || invoice.number || 'invoice') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    // If puppeteer unavailable, fallback to returning HTML with instructions
    console.warn('[generate-invoice-pdf] Puppeteer unavailable, returning HTML:', err.message);
    res.json({
      success: true,
      format: 'html',
      html,
      message: 'PDF generation unavailable in this environment. Use the HTML to print-to-PDF.',
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});
