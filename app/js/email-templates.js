/**
 * CF-258: Email Templates for Transactional Emails
 * Renderers for welcome, verification, password reset, payment receipt, and trial ending emails.
 */
(function () {
  'use strict';

  var BRAND_COLOR = '#4F46E5';
  var BRAND_NAME = 'Cortex Freelancer';

  /**
   * Wrap email body HTML in a consistent layout shell.
   * @param {string} title
   * @param {string} bodyHtml
   * @returns {string}
   */
  function layout(title, bodyHtml) {
    return '<!DOCTYPE html>' +
      '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' +
        'body{margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}' +
        '.wrapper{max-width:600px;margin:0 auto;padding:20px}' +
        '.card{background:#fff;border-radius:8px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.08)}' +
        '.btn{display:inline-block;padding:12px 28px;background:' + BRAND_COLOR + ';color:#fff;text-decoration:none;border-radius:6px;font-weight:600}' +
        '.footer{text-align:center;padding:20px;font-size:12px;color:#9ca3af}' +
        'h1{color:#111827;font-size:22px;margin:0 0 16px}' +
        'p{color:#374151;line-height:1.6;margin:0 0 16px}' +
      '</style></head>' +
      '<body><div class="wrapper"><div class="card">' +
      bodyHtml +
      '</div>' +
      '<div class="footer">&copy; ' + new Date().getFullYear() + ' ' + escapeHtml(BRAND_NAME) + '. All rights reserved.</div>' +
      '</div></body></html>';
  }

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Render welcome email.
   * @param {{ name: string }} vars
   * @returns {{ subject: string, html: string }}
   */
  function welcome(vars) {
    var name = vars && vars.name ? vars.name : 'there';
    var body =
      '<h1>Welcome to ' + escapeHtml(BRAND_NAME) + '!</h1>' +
      '<p>Hi ' + escapeHtml(name) + ',</p>' +
      '<p>Thanks for joining! We\'re excited to help you streamline your freelance business. Here\'s what you can do next:</p>' +
      '<ul style="color:#374151;line-height:1.8">' +
        '<li>Set up your profile and showcase your skills</li>' +
        '<li>Create your first contract or proposal</li>' +
        '<li>Explore our AI-powered tools</li>' +
      '</ul>' +
      '<p style="text-align:center;padding:12px 0"><a class="btn" href="{{dashboardUrl}}">Go to Dashboard</a></p>' +
      '<p>If you have any questions, just reply to this email — we\'re here to help.</p>';
    return { subject: 'Welcome to ' + BRAND_NAME + '!', html: layout('Welcome', body) };
  }

  /**
   * Render email verification email.
   * @param {{ name: string, verifyUrl: string }} vars
   * @returns {{ subject: string, html: string }}
   */
  function verification(vars) {
    var name = vars && vars.name ? vars.name : 'there';
    var url = vars && vars.verifyUrl ? vars.verifyUrl : '#';
    var body =
      '<h1>Verify Your Email</h1>' +
      '<p>Hi ' + escapeHtml(name) + ',</p>' +
      '<p>Please confirm your email address by clicking the button below. This link expires in 24 hours.</p>' +
      '<p style="text-align:center;padding:12px 0"><a class="btn" href="' + escapeHtml(url) + '">Verify Email</a></p>' +
      '<p style="font-size:13px;color:#6b7280">If you didn\'t create an account, you can safely ignore this email.</p>';
    return { subject: 'Verify your email for ' + BRAND_NAME, html: layout('Verify Email', body) };
  }

  /**
   * Render password reset email.
   * @param {{ name: string, resetUrl: string }} vars
   * @returns {{ subject: string, html: string }}
   */
  function passwordReset(vars) {
    var name = vars && vars.name ? vars.name : 'there';
    var url = vars && vars.resetUrl ? vars.resetUrl : '#';
    var body =
      '<h1>Reset Your Password</h1>' +
      '<p>Hi ' + escapeHtml(name) + ',</p>' +
      '<p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>' +
      '<p style="text-align:center;padding:12px 0"><a class="btn" href="' + escapeHtml(url) + '">Reset Password</a></p>' +
      '<p style="font-size:13px;color:#6b7280">If you didn\'t request this, no action is needed — your password remains unchanged.</p>';
    return { subject: 'Password reset for ' + BRAND_NAME, html: layout('Reset Password', body) };
  }

  /**
   * Render payment receipt email.
   * @param {{ name: string, amount: string, currency: string, plan: string, date: string, invoiceUrl: string }} vars
   * @returns {{ subject: string, html: string }}
   */
  function paymentReceipt(vars) {
    var v = vars || {};
    var name = v.name || 'there';
    var amount = v.amount || '0.00';
    var currency = v.currency || 'USD';
    var plan = v.plan || 'Pro';
    var date = v.date || new Date().toLocaleDateString();
    var invoiceUrl = v.invoiceUrl || '#';
    var body =
      '<h1>Payment Receipt</h1>' +
      '<p>Hi ' + escapeHtml(name) + ',</p>' +
      '<p>Thank you for your payment. Here\'s your receipt:</p>' +
      '<table style="width:100%;border-collapse:collapse;margin:16px 0">' +
        '<tr><td style="padding:8px 0;color:#6b7280">Plan</td><td style="padding:8px 0;text-align:right;font-weight:600">' + escapeHtml(plan) + '</td></tr>' +
        '<tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0;color:#6b7280">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600">' + escapeHtml(currency) + ' ' + escapeHtml(amount) + '</td></tr>' +
        '<tr style="border-top:1px solid #e5e7eb"><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;text-align:right">' + escapeHtml(date) + '</td></tr>' +
      '</table>' +
      '<p style="text-align:center;padding:12px 0"><a class="btn" href="' + escapeHtml(invoiceUrl) + '">View Invoice</a></p>';
    return { subject: BRAND_NAME + ' payment receipt — ' + currency + ' ' + amount, html: layout('Payment Receipt', body) };
  }

  /**
   * Render trial ending reminder email.
   * @param {{ name: string, daysLeft: number, upgradeUrl: string, plan: string }} vars
   * @returns {{ subject: string, html: string }}
   */
  function trialEnding(vars) {
    var v = vars || {};
    var name = v.name || 'there';
    var daysLeft = v.daysLeft != null ? v.daysLeft : 3;
    var upgradeUrl = v.upgradeUrl || '#';
    var plan = v.plan || 'Pro';
    var body =
      '<h1>Your Trial Ends in ' + daysLeft + ' Day' + (daysLeft === 1 ? '' : 's') + '</h1>' +
      '<p>Hi ' + escapeHtml(name) + ',</p>' +
      '<p>Just a heads-up — your free trial of the <strong>' + escapeHtml(plan) + '</strong> plan is ending soon. Upgrade now to keep access to all features without interruption.</p>' +
      '<p style="text-align:center;padding:12px 0"><a class="btn" href="' + escapeHtml(upgradeUrl) + '">Upgrade Now</a></p>' +
      '<p style="font-size:13px;color:#6b7280">If you choose not to upgrade, your account will revert to the free tier. You won\'t lose any data.</p>';
    return { subject: 'Your ' + BRAND_NAME + ' trial ends in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's'), html: layout('Trial Ending', body) };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmailTemplates = {
    welcome: welcome,
    verification: verification,
    passwordReset: passwordReset,
    paymentReceipt: paymentReceipt,
    trialEnding: trialEnding
  };
})();
