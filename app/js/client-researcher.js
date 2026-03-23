/**
 * [UX-001] Client Research Tool
 *
 * Investigate Upwork clients before applying.
 * Provides trust scoring, red-flag detection, and a visual research card.
 *
 * window.CortexClientResearcher
 */
(function () {
  'use strict';

  var PROXY_BASE = 'http://localhost:3848';
  var cssInjected = false;

  // ── Helpers ────────────────────────────────────────────────────────

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      /* Research button on job cards */
      '.cr-research-btn{',
      '  background:transparent;border:1px solid #6366f1;color:#a5b4fc;',
      '  padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px;',
      '  transition:all .2s;display:inline-flex;align-items:center;gap:4px;',
      '}',
      '.cr-research-btn:hover{background:#6366f1;color:#fff;}',
      '.cr-research-btn.cr-loading{opacity:.6;pointer-events:none;}',

      /* Modal overlay */
      '.cr-overlay{',
      '  position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;',
      '  display:flex;align-items:center;justify-content:center;',
      '  animation:cr-fade-in .2s ease;',
      '}',
      '@keyframes cr-fade-in{from{opacity:0}to{opacity:1}}',
      '.cr-modal{',
      '  background:#1a1a2e;border:1px solid #2a2a4a;border-radius:14px;',
      '  width:480px;max-width:92vw;max-height:85vh;overflow-y:auto;',
      '  padding:24px;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;',
      '  box-shadow:0 20px 60px rgba(0,0,0,.5);',
      '}',
      '.cr-modal-close{',
      '  float:right;background:none;border:none;color:#94a3b8;',
      '  font-size:20px;cursor:pointer;padding:0 4px;',
      '}',
      '.cr-modal-close:hover{color:#fff;}',

      /* Client card header */
      '.cr-client-header{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #2a2a4a;}',
      '.cr-client-name{font-size:18px;font-weight:700;color:#f1f5f9;margin:0 0 4px;}',
      '.cr-client-meta{font-size:13px;color:#94a3b8;display:flex;gap:12px;flex-wrap:wrap;}',
      '.cr-client-meta span{display:inline-flex;align-items:center;gap:4px;}',

      /* Trust meter */
      '.cr-trust-section{margin:16px 0;text-align:center;}',
      '.cr-trust-bar-wrap{',
      '  background:#27272e;border-radius:10px;height:14px;overflow:hidden;',
      '  margin:8px 0;position:relative;',
      '}',
      '.cr-trust-bar{',
      '  height:100%;border-radius:10px;transition:width .6s ease;',
      '}',
      '.cr-trust-score{font-size:28px;font-weight:800;}',
      '.cr-trust-label{font-size:13px;font-weight:600;margin-top:4px;}',

      /* Stats grid */
      '.cr-stats{',
      '  display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0;',
      '}',
      '.cr-stat{',
      '  background:#27272e;border-radius:10px;padding:12px;',
      '  border:1px solid #3f3f46;',
      '}',
      '.cr-stat-label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;}',
      '.cr-stat-value{font-size:16px;font-weight:700;color:#f1f5f9;margin-top:4px;}',

      /* Red flags */
      '.cr-flags{margin:12px 0;}',
      '.cr-flag{',
      '  background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);',
      '  border-radius:8px;padding:8px 12px;margin-bottom:6px;',
      '  font-size:13px;color:#fca5a5;display:flex;align-items:center;gap:6px;',
      '}',

      /* Recommendation */
      '.cr-recommendation{',
      '  margin-top:16px;padding:14px;border-radius:10px;',
      '  font-size:14px;font-weight:600;text-align:center;',
      '}',
      '.cr-rec-safe{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#86efac;}',
      '.cr-rec-caution{background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.3);color:#fde047;}',
      '.cr-rec-risky{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;}',

      /* Loading spinner inside modal */
      '.cr-spinner{text-align:center;padding:40px 0;color:#94a3b8;}',
      '.cr-spinner::before{content:"";display:block;width:36px;height:36px;margin:0 auto 12px;',
      '  border:3px solid #3f3f46;border-top-color:#6366f1;border-radius:50%;',
      '  animation:cr-spin .8s linear infinite;}',
      '@keyframes cr-spin{to{transform:rotate(360deg)}}',

      /* Error */
      '.cr-error{text-align:center;padding:24px;color:#fca5a5;font-size:14px;}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Fetch client info from proxy ──────────────────────────────────

  function fetchClientInfo(clientUrl) {
    var param = 'url';
    // If it's a job URL, use jobUrl param
    if (/upwork\.com\/jobs\//.test(clientUrl)) {
      param = 'jobUrl';
    }
    var endpoint = PROXY_BASE + '/client?' + param + '=' + encodeURIComponent(clientUrl);

    return fetch(endpoint)
      .then(function (r) { return r.json(); })
      .then(function (json) {
        if (json.error) throw new Error(json.error);
        return json.data;
      });
  }

  // ── Assess client trust ───────────────────────────────────────────

  function parseSpent(totalSpent) {
    if (!totalSpent) return 0;
    var s = String(totalSpent).replace(/[,$+]/g, '').trim();
    var multiplier = 1;
    if (/[Kk]/.test(s)) { multiplier = 1000; s = s.replace(/[Kk]/g, ''); }
    if (/[Mm]/.test(s)) { multiplier = 1000000; s = s.replace(/[Mm]/g, ''); }
    return parseFloat(s) * multiplier || 0;
  }

  function assessClient(clientData) {
    var score = 0;
    var flags = [];
    var details = [];

    // totalSpent > $10K → +30
    var spent = parseSpent(clientData.totalSpent);
    if (spent >= 10000) {
      score += 30;
      details.push('High spending client ($' + (spent >= 1000000 ? Math.round(spent / 1000000) + 'M' : Math.round(spent / 1000) + 'K') + '+)');
    } else if (spent > 0) {
      score += Math.round((spent / 10000) * 30);
      if (spent < 1000) flags.push('Low total spend (' + clientData.totalSpent + ')');
    } else {
      flags.push('No spending history detected');
    }

    // paymentVerified → +20
    if (clientData.paymentVerified) {
      score += 20;
      details.push('Payment method verified');
    } else {
      flags.push('Payment method NOT verified');
    }

    // avgRating > 4.5 → +20
    var rating = parseFloat(clientData.avgRating) || 0;
    if (rating >= 4.5) {
      score += 20;
      details.push('Excellent rating to freelancers (' + rating.toFixed(1) + ')');
    } else if (rating > 0) {
      score += Math.round((rating / 4.5) * 20);
      if (rating < 3.5) flags.push('Below-average rating (' + rating.toFixed(1) + '/5)');
    } else {
      // No rating might just mean new client
      details.push('No rating available yet');
    }

    // hireCount > 5 → +15
    var hires = parseInt(clientData.hireCount) || 0;
    if (hires > 5) {
      score += 15;
      details.push(hires + ' freelancers hired');
    } else if (hires > 0) {
      score += Math.round((hires / 5) * 15);
    } else {
      flags.push('No hire history');
    }

    // memberSince > 1yr → +15
    if (clientData.memberSince) {
      var since = new Date(clientData.memberSince);
      if (!isNaN(since.getTime())) {
        var years = (Date.now() - since.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (years >= 1) {
          score += 15;
          details.push('Member for ' + Math.round(years) + '+ years');
        } else {
          score += Math.round(years * 15);
          flags.push('New account (< 1 year)');
        }
      }
    } else {
      flags.push('Member-since date unknown');
    }

    score = Math.min(100, Math.max(0, score));

    var level, color;
    if (score >= 70) {
      level = 'trusted'; color = '#22c55e';
    } else if (score >= 40) {
      level = 'cautious'; color = '#eab308';
    } else {
      level = 'risky'; color = '#ef4444';
    }

    return {
      score: score,
      level: level,
      color: color,
      flags: flags,
      details: details,
    };
  }

  // ── Render client research card ───────────────────────────────────

  function renderClientResearch(clientData, container) {
    injectCSS();
    if (!clientData) {
      container.innerHTML = '<div class="cr-error">No client data available.</div>';
      return;
    }

    var assessment = assessClient(clientData);
    var h = '';

    // Close button
    h += '<button class="cr-modal-close" data-cr-close>&times;</button>';

    // Header
    h += '<div class="cr-client-header">';
    h += '<div class="cr-client-name">' + escapeHtml(clientData.clientName || 'Unknown Client') + '</div>';
    h += '<div class="cr-client-meta">';
    if (clientData.country) h += '<span>📍 ' + escapeHtml(clientData.country) + '</span>';
    if (clientData.memberSince) h += '<span>📅 Member since ' + escapeHtml(clientData.memberSince) + '</span>';
    h += '</div></div>';

    // Trust score meter
    h += '<div class="cr-trust-section">';
    h += '<div class="cr-trust-score" style="color:' + assessment.color + '">' + assessment.score + '/100</div>';
    h += '<div class="cr-trust-bar-wrap"><div class="cr-trust-bar" style="width:' + assessment.score + '%;background:' + assessment.color + '"></div></div>';
    h += '<div class="cr-trust-label" style="color:' + assessment.color + '">' +
      (assessment.level === 'trusted' ? '✅ Trusted Client' :
        assessment.level === 'cautious' ? '⚠️ Proceed With Caution' : '🚫 High Risk') +
      '</div>';
    h += '</div>';

    // Stats grid
    h += '<div class="cr-stats">';
    h += '<div class="cr-stat"><div class="cr-stat-label">Total Spent</div><div class="cr-stat-value">' + escapeHtml(clientData.totalSpent || 'N/A') + '</div></div>';
    h += '<div class="cr-stat"><div class="cr-stat-label">Hires</div><div class="cr-stat-value">' + (clientData.hireCount || 'N/A') + '</div></div>';
    h += '<div class="cr-stat"><div class="cr-stat-label">Avg Rating</div><div class="cr-stat-value">' + (clientData.avgRating ? parseFloat(clientData.avgRating).toFixed(1) + ' ★' : 'N/A') + '</div></div>';
    h += '<div class="cr-stat"><div class="cr-stat-label">Payment</div><div class="cr-stat-value">' + (clientData.paymentVerified ? '✅ Verified' : '❌ Not Verified') + '</div></div>';
    if (clientData.activeJobs != null) {
      h += '<div class="cr-stat"><div class="cr-stat-label">Active Jobs</div><div class="cr-stat-value">' + clientData.activeJobs + '</div></div>';
    }
    if (clientData.lastActivity) {
      h += '<div class="cr-stat"><div class="cr-stat-label">Last Active</div><div class="cr-stat-value">' + escapeHtml(clientData.lastActivity) + '</div></div>';
    }
    h += '</div>';

    // Red flags
    if (assessment.flags.length > 0) {
      h += '<div class="cr-flags">';
      assessment.flags.forEach(function (f) {
        h += '<div class="cr-flag">🚩 ' + escapeHtml(f) + '</div>';
      });
      h += '</div>';
    }

    // Positive details
    if (assessment.details.length > 0) {
      h += '<div style="margin:8px 0;font-size:13px;color:#94a3b8;">';
      assessment.details.forEach(function (d) {
        h += '<div style="margin:2px 0;">• ' + escapeHtml(d) + '</div>';
      });
      h += '</div>';
    }

    // Recommendation
    var recClass = assessment.level === 'trusted' ? 'cr-rec-safe' :
      assessment.level === 'cautious' ? 'cr-rec-caution' : 'cr-rec-risky';
    var recText = assessment.level === 'trusted' ? '✅ Safe to Apply — This client has a strong track record.' :
      assessment.level === 'cautious' ? '⚠️ Proceed with Caution — Review the red flags before applying.' :
        '🚫 High Risk — Consider skipping this client or setting strict milestones.';
    h += '<div class="cr-recommendation ' + recClass + '">' + recText + '</div>';

    container.innerHTML = h;

    // Wire close button
    var closeBtn = container.querySelector('[data-cr-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        var overlay = container.closest('.cr-overlay');
        if (overlay) overlay.remove();
      });
    }
  }

  // ── Show research modal ───────────────────────────────────────────

  function showResearchModal(jobUrl) {
    injectCSS();

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'cr-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    var modal = document.createElement('div');
    modal.className = 'cr-modal';
    modal.innerHTML = '<div class="cr-spinner">Researching client…</div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    fetchClientInfo(jobUrl)
      .then(function (data) {
        renderClientResearch(data, modal);
      })
      .catch(function (err) {
        modal.innerHTML = '<button class="cr-modal-close" onclick="this.closest(\'.cr-overlay\').remove()">&times;</button>' +
          '<div class="cr-error">❌ ' + escapeHtml(err.message || 'Failed to research client') +
          '<br><br><span style="font-size:12px;color:#64748b;">Make sure the local proxy is running:<br><code>node scripts/upwork-local-proxy.js</code></span></div>';
      });
  }

  // ── Wire research buttons into job cards ──────────────────────────

  function wireResearchButtons() {
    injectCSS();
    var cards = document.querySelectorAll('.jm-card');
    cards.forEach(function (card) {
      if (card.querySelector('.cr-research-btn')) return; // already wired

      // Get job URL from the card
      var link = card.querySelector('.jm-card-title') || card.querySelector('a[href*="upwork.com/jobs"]');
      if (!link || !link.href) return;

      var footer = card.querySelector('.jm-card-footer');
      if (!footer) return;

      var btn = document.createElement('button');
      btn.className = 'cr-research-btn';
      btn.innerHTML = '🔍 Research Client';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        showResearchModal(link.href);
      });

      // Insert before the "View Job" link
      var viewLink = footer.querySelector('.jm-apply-link');
      if (viewLink) {
        footer.insertBefore(btn, viewLink);
      } else {
        footer.appendChild(btn);
      }
    });
  }

  // ── Auto-wire on DOM changes (for dynamically loaded cards) ───────

  function observeAndWire() {
    wireResearchButtons();
    var observer = new MutationObserver(function () {
      wireResearchButtons();
    });
    var target = document.getElementById('job-matches-section') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  // ── Init on DOM ready ─────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAndWire);
  } else {
    observeAndWire();
  }

  // ── Expose public API ─────────────────────────────────────────────

  window.CortexClientResearcher = {
    fetchClientInfo: fetchClientInfo,
    assessClient: assessClient,
    renderClientResearch: renderClientResearch,
    showResearchModal: showResearchModal,
    wireResearchButtons: wireResearchButtons,
  };

})();
