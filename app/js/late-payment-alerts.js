/**
 * Cortex Freelancer — Late Payment Alert System
 * [CF-149] Flags overdue payments with severity levels and generates follow-up messages.
 *
 * Features:
 *   - Flags payments overdue by 3, 7, and 14+ days
 *   - Severity badges: yellow (3d), orange (7d), red (14d+)
 *   - Professional follow-up email templates per severity
 *   - "Copy Follow-up Email" button
 *   - Integrates with milestone tracker data (CF-148)
 *   - Overdue amounts summary dashboard
 *   - GTM event tracking
 */

(function () {
  'use strict';

  var SEVERITY = {
    mild:     { label: '3+ Days Late',  color: '#ffcc00', bg: 'rgba(255,204,0,0.12)',   border: 'rgba(255,204,0,0.3)',   icon: '!' },
    moderate: { label: '7+ Days Late',  color: '#ff8844', bg: 'rgba(255,136,68,0.12)',  border: 'rgba(255,136,68,0.3)',  icon: '!!' },
    severe:   { label: '14+ Days Late', color: '#ff4466', bg: 'rgba(255,68,102,0.12)',  border: 'rgba(255,68,102,0.3)',  icon: '!!!' }
  };

  function pushEvent(action) {
    if (window.dataLayer) {
      window.dataLayer.push({ event: 'tool_used', tool_name: 'payment-checker', action: action });
    }
  }

  function formatCurrency(amount) {
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function daysBetween(dateStr, now) {
    var due = new Date(dateStr + 'T00:00:00');
    var diff = now.getTime() - due.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  function getSeverity(daysLate) {
    if (daysLate >= 14) return 'severe';
    if (daysLate >= 7) return 'moderate';
    if (daysLate >= 3) return 'mild';
    return null;
  }

  // ─── Collect overdue items ─────────────────────────────────────────

  function collectOverdueItems() {
    var tracker = window.CortexMilestoneTracker;
    if (!tracker) return [];

    var contracts = tracker.loadContracts();
    var now = new Date();
    var overdueItems = [];

    contracts.forEach(function (contract) {
      (contract.milestones || []).forEach(function (milestone) {
        // Check milestones that have a due date, are not released, and are past due
        if (!milestone.dueDate) return;
        if (milestone.status === 'released') return;

        var daysLate = daysBetween(milestone.dueDate, now);
        var severity = getSeverity(daysLate);

        if (severity) {
          overdueItems.push({
            client: contract.client,
            contractId: contract.id,
            milestoneName: milestone.name,
            milestoneId: milestone.id,
            amount: parseFloat(milestone.amount) || 0,
            dueDate: milestone.dueDate,
            daysLate: daysLate,
            severity: severity,
            status: milestone.status
          });
        }
      });
    });

    // Sort by severity (most severe first), then by days late
    overdueItems.sort(function (a, b) {
      var order = { severe: 0, moderate: 1, mild: 2 };
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return b.daysLate - a.daysLate;
    });

    return overdueItems;
  }

  // ─── Follow-up email templates ─────────────────────────────────────

  function generateFollowUpEmail(item) {
    var client = item.client;
    var milestone = item.milestoneName;
    var amount = formatCurrency(item.amount);
    var dueDate = item.dueDate;
    var daysLate = item.daysLate;

    if (item.severity === 'mild') {
      return 'Subject: Friendly Reminder - Payment for ' + milestone + '\n\n' +
        'Hi ' + client + ',\n\n' +
        'I hope this message finds you well. I wanted to gently follow up regarding the payment for the "' + milestone + '" milestone (' + amount + '), which was due on ' + dueDate + '.\n\n' +
        'It has been ' + daysLate + ' days since the due date, and I wanted to check if there are any issues or if you need any additional information from my end to process the payment.\n\n' +
        'I understand that payment processing can sometimes take a bit longer than expected, and I appreciate your attention to this.\n\n' +
        'Please let me know if you have any questions.\n\n' +
        'Best regards';
    }

    if (item.severity === 'moderate') {
      return 'Subject: Follow-Up: Overdue Payment for ' + milestone + '\n\n' +
        'Hi ' + client + ',\n\n' +
        'I am writing to follow up on the outstanding payment for the "' + milestone + '" milestone (' + amount + '), which was due on ' + dueDate + ' - now ' + daysLate + ' days past the agreed payment date.\n\n' +
        'As this payment is now significantly overdue, I would appreciate an update on the expected payment timeline. Timely payments are important for maintaining our working relationship and ensuring continued project progress.\n\n' +
        'If there are any concerns about the deliverables or any documentation you need, please let me know immediately so we can resolve this promptly.\n\n' +
        'I kindly request that the payment be processed within the next 3 business days.\n\n' +
        'Thank you for your prompt attention to this matter.\n\n' +
        'Best regards';
    }

    // severe (14+ days)
    return 'Subject: URGENT: Final Notice - Overdue Payment for ' + milestone + '\n\n' +
      'Hi ' + client + ',\n\n' +
      'This is a final notice regarding the significantly overdue payment for the "' + milestone + '" milestone (' + amount + '), which was due on ' + dueDate + ' - now ' + daysLate + ' days past the agreed payment date.\n\n' +
      'Despite my previous communications, this payment remains outstanding. I want to be transparent about the impact this has on our working relationship:\n\n' +
      '1. All current work on this project has been paused pending payment resolution.\n' +
      '2. Future milestones and deliverables will not proceed until all outstanding payments are settled.\n' +
      '3. If payment is not received within 5 business days, I will need to escalate this matter through the platform\'s dispute resolution process and consider further action to recover the owed amount.\n\n' +
      'I value our professional relationship and would prefer to resolve this amicably. Please process the payment immediately or contact me to discuss a resolution.\n\n' +
      'Regards';
  }

  // ─── Copy to clipboard ────────────────────────────────────────────

  function copyToClipboard(text, buttonEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopied(buttonEl);
      }).catch(function () {
        fallbackCopy(text, buttonEl);
      });
    } else {
      fallbackCopy(text, buttonEl);
    }
  }

  function fallbackCopy(text, buttonEl) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopied(buttonEl); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function showCopied(btn) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.background = 'rgba(0,255,136,0.15)';
    btn.style.borderColor = 'rgba(0,255,136,0.3)';
    btn.style.color = '#00ff88';
    setTimeout(function () {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.color = '';
    }, 2000);
  }

  // ─── Build UI ──────────────────────────────────────────────────────

  function buildSection() {
    var section = document.createElement('section');
    section.id = 'latePaymentAlertsSection';
    section.style.cssText = 'max-width:700px;margin:2.5rem auto;padding:0 1.5rem;display:none';

    section.innerHTML =
      '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
        '<div style="background:linear-gradient(135deg,#ff4466,#ff6622);padding:1.25rem 1.5rem;color:#fff;display:flex;align-items:center;justify-content:space-between">' +
          '<div>' +
            '<h3 style="font-size:1rem;font-weight:800;margin:0">Late Payment Alerts</h3>' +
            '<p style="font-size:.8rem;opacity:.85;margin:.25rem 0 0">Overdue payments requiring attention</p>' +
          '</div>' +
          '<div id="lpaAlertCount" style="background:rgba(255,255,255,.2);padding:.3rem .8rem;border-radius:100px;font-weight:800;font-size:.88rem"></div>' +
        '</div>' +
        '<div id="lpaSummaryDash" style="padding:1rem 1.5rem;display:flex;gap:1rem;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.06)"></div>' +
        '<div id="lpaAlertsList" style="padding:1rem 1.5rem"></div>' +
      '</div>';

    return section;
  }

  function renderSummaryDash(items) {
    var dash = document.getElementById('lpaSummaryDash');
    if (!dash) return;

    var mildTotal = 0, modTotal = 0, sevTotal = 0;
    items.forEach(function (item) {
      if (item.severity === 'mild') mildTotal += item.amount;
      else if (item.severity === 'moderate') modTotal += item.amount;
      else sevTotal += item.amount;
    });

    var grandTotal = mildTotal + modTotal + sevTotal;

    dash.innerHTML =
      buildDashCard('Total Overdue', grandTotal, 'var(--red)') +
      buildDashCard('3-6 Days', mildTotal, SEVERITY.mild.color) +
      buildDashCard('7-13 Days', modTotal, SEVERITY.moderate.color) +
      buildDashCard('14+ Days', sevTotal, SEVERITY.severe.color);
  }

  function buildDashCard(label, amount, color) {
    return '<div style="flex:1;min-width:100px;background:var(--bg3);border-radius:var(--radius-sm);padding:.65rem .85rem;text-align:center">' +
      '<div style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.2rem">' + label + '</div>' +
      '<div style="font-size:1rem;font-weight:800;color:' + color + '">' + formatCurrency(amount) + '</div>' +
    '</div>';
  }

  function renderAlerts(items) {
    var section = document.getElementById('latePaymentAlertsSection');
    var list = document.getElementById('lpaAlertsList');
    var countEl = document.getElementById('lpaAlertCount');

    if (!section || !list) return;

    if (items.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    if (countEl) {
      countEl.textContent = items.length + ' alert' + (items.length !== 1 ? 's' : '');
    }

    renderSummaryDash(items);

    var html = '';
    items.forEach(function (item, i) {
      var sev = SEVERITY[item.severity];
      html += '<div style="background:var(--bg3);border:1px solid ' + sev.border + ';border-left:4px solid ' + sev.color + ';border-radius:var(--radius-sm);margin-bottom:.75rem;overflow:hidden">';

      // Header
      html += '<div style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">';
      html += '<div style="flex:1;min-width:200px">';
      html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">';
      html += '<span style="background:' + sev.bg + ';border:1px solid ' + sev.border + ';color:' + sev.color + ';padding:.2rem .6rem;border-radius:4px;font-size:.7rem;font-weight:800;letter-spacing:.3px">' + sev.label + '</span>';
      html += '<span style="font-weight:700;font-size:.9rem;color:var(--text)">' + escapeHtml(item.client) + '</span>';
      html += '</div>';
      html += '<div style="font-size:.82rem;color:var(--text2)">' + escapeHtml(item.milestoneName) + '</div>';
      html += '<div style="font-size:.72rem;color:var(--text3);margin-top:.2rem">Due: ' + item.dueDate + ' &middot; ' + item.daysLate + ' days overdue &middot; Status: ' + item.status + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;min-width:80px">';
      html += '<div style="font-weight:800;font-size:1.05rem;color:' + sev.color + '">' + formatCurrency(item.amount) + '</div>';
      html += '</div>';
      html += '</div>';

      // Actions
      html += '<div style="padding:0 1.25rem 1rem;display:flex;gap:.5rem;flex-wrap:wrap">';
      html += '<button data-copy-email="' + i + '" style="background:' + sev.bg + ';border:1px solid ' + sev.border + ';color:' + sev.color + ';padding:.45rem 1rem;border-radius:6px;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s">Copy Follow-up Email</button>';
      html += '<button data-preview-email="' + i + '" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--text2);padding:.45rem 1rem;border-radius:6px;font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit">Preview Email</button>';
      html += '</div>';

      // Email preview (hidden)
      html += '<div id="lpaEmailPreview' + i + '" style="display:none;padding:0 1.25rem 1rem">';
      html += '<pre style="background:var(--bg);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:1rem;font-size:.78rem;color:var(--text2);white-space:pre-wrap;word-wrap:break-word;font-family:inherit;line-height:1.6;max-height:300px;overflow-y:auto">' + escapeHtml(generateFollowUpEmail(item)) + '</pre>';
      html += '</div>';

      html += '</div>';
    });

    list.innerHTML = html;
  }

  // ─── Event binding ─────────────────────────────────────────────────

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var target = e.target;

      // Copy follow-up email
      if (target.dataset.copyEmail !== undefined) {
        var idx = parseInt(target.dataset.copyEmail, 10);
        var items = collectOverdueItems();
        if (items[idx]) {
          var email = generateFollowUpEmail(items[idx]);
          copyToClipboard(email, target);
          pushEvent('late_payment_email_copied');
        }
        return;
      }

      // Toggle email preview
      if (target.dataset.previewEmail !== undefined) {
        var pIdx = parseInt(target.dataset.previewEmail, 10);
        var previewEl = document.getElementById('lpaEmailPreview' + pIdx);
        if (previewEl) {
          var isVisible = previewEl.style.display !== 'none';
          previewEl.style.display = isVisible ? 'none' : 'block';
          target.textContent = isVisible ? 'Preview Email' : 'Hide Preview';
        }
        return;
      }
    });

    // Listen for milestone data updates from CF-148
    document.addEventListener('milestoneDataUpdated', function () {
      refresh();
    });
  }

  function refresh() {
    var items = collectOverdueItems();
    renderAlerts(items);
  }

  // ─── Init ──────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Insert after milestone tracker section (or after reminders)
    var waitForTracker = function () {
      var milestoneSection = document.getElementById('milestoneTrackerSection');
      var anchor = milestoneSection || document.getElementById('remindersSection') || document.getElementById('results');
      if (!anchor) return;

      var section = buildSection();
      anchor.parentNode.insertBefore(section, anchor.nextSibling);

      bindEvents();
      refresh();
    };

    // Small delay to let milestone tracker insert first
    setTimeout(waitForTracker, 50);
  });

})();
