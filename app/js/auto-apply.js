/**
 * [UW-009] Auto-Apply Flow — One-click proposal submit
 *
 * Renders "🚀 Apply Now" buttons on job cards, opens a 3-step modal
 * (Review → Customize → Submit), tracks applications in localStorage,
 * and provides a "My Applications" dashboard section.
 *
 * Exposed as window.CortexAutoApply
 */
(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_applications';
  var TIMELINE_OPTIONS = ['1 week', '2 weeks', '1 month', '3 months', 'Ongoing'];

  // ─── Inject CSS (once) ────────────────────────────────────────────
  var cssInjected = false;
  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = getCSS();
    document.head.appendChild(style);
  }

  // ─── HTML escape ──────────────────────────────────────────────────
  function esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── localStorage helpers ─────────────────────────────────────────
  function getApplications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) { return []; }
  }

  function saveApplication(entry) {
    var apps = getApplications();
    apps.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  }

  function isApplied(jobUrl) {
    return getApplications().some(function (a) { return a.jobUrl === jobUrl; });
  }

  // ─── 1) Render "Apply Now" button on a job card ───────────────────
  function renderAutoApplyButton(jobCard, jobData, profileData) {
    injectCSS();
    if (!jobCard || !jobData) return;

    // Don't double-render
    if (jobCard.querySelector('.aa-btn')) return;

    // Find the actions area (next to "View Job →")
    var footer = jobCard.querySelector('.jm-card-footer') || jobCard;

    var btn = document.createElement('button');
    btn.className = 'aa-btn';

    if (isApplied(jobData.url)) {
      btn.textContent = '✅ Applied';
      btn.classList.add('aa-btn--applied');
      btn.disabled = true;
    } else {
      btn.textContent = '🚀 Apply Now';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openApplyModal(jobData, profileData);
      });
    }

    footer.appendChild(btn);
  }

  // ─── 2) Full-screen modal — 3-step apply flow ────────────────────
  function openApplyModal(jobData, profileData) {
    injectCSS();
    var step = 1;
    var proposalText = '';
    var rate = '';
    var timeline = TIMELINE_OPTIONS[2]; // default 1 month
    var estimatedHours = '';
    var proposalLoading = false;
    var proposalError = '';

    if (profileData && profileData.hourlyRate) {
      rate = String(profileData.hourlyRate).replace(/[^0-9.]/g, '');
    }

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'aa-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    var modal = document.createElement('div');
    modal.className = 'aa-modal';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function closeModal() {
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
    }

    function render() {
      var h = '';
      h += '<div class="aa-modal-header">';
      h += '  <div class="aa-steps">';
      h += '    <span class="aa-step' + (step >= 1 ? ' aa-step--active' : '') + '">1. Review</span>';
      h += '    <span class="aa-step-sep">→</span>';
      h += '    <span class="aa-step' + (step >= 2 ? ' aa-step--active' : '') + '">2. Customize</span>';
      h += '    <span class="aa-step-sep">→</span>';
      h += '    <span class="aa-step' + (step >= 3 ? ' aa-step--active' : '') + '">3. Submit</span>';
      h += '  </div>';
      h += '  <button class="aa-close" id="aa-close">&times;</button>';
      h += '</div>';

      h += '<div class="aa-modal-body">';

      if (step === 1) {
        h += renderStep1(jobData);
      } else if (step === 2) {
        h += renderStep2(jobData, proposalText, rate, timeline, estimatedHours, proposalLoading, proposalError);
      } else if (step === 3) {
        h += renderStep3(jobData, proposalText, rate);
      }

      h += '</div>';

      h += '<div class="aa-modal-footer">';
      if (step > 1) {
        h += '<button class="aa-btn-secondary" id="aa-prev">← Back</button>';
      } else {
        h += '<span></span>';
      }
      if (step < 3) {
        h += '<button class="aa-btn-primary" id="aa-next">' + (step === 1 ? 'Customize Proposal →' : 'Continue to Submit →') + '</button>';
      } else {
        h += '<button class="aa-btn-primary aa-btn-success" id="aa-done">✅ Mark as Applied</button>';
      }
      h += '</div>';

      modal.innerHTML = h;

      // Bind events
      modal.querySelector('#aa-close').addEventListener('click', closeModal);

      var prevBtn = modal.querySelector('#aa-prev');
      if (prevBtn) prevBtn.addEventListener('click', function () { step--; render(); });

      var nextBtn = modal.querySelector('#aa-next');
      if (nextBtn) nextBtn.addEventListener('click', function () {
        if (step === 1) {
          step = 2;
          render();
          if (!proposalText && !proposalLoading) fetchProposal();
        } else if (step === 2) {
          // Save edits from textarea
          captureStep2();
          step = 3;
          render();
        }
      });

      var doneBtn = modal.querySelector('#aa-done');
      if (doneBtn) doneBtn.addEventListener('click', function () {
        captureStep2(); // in case they went back
        saveApplication({
          jobTitle: jobData.title || 'Untitled',
          jobUrl: jobData.url || '',
          appliedAt: new Date().toISOString(),
          proposalText: proposalText,
          rate: rate,
          status: 'applied'
        });
        closeModal();
        // Refresh applied badges
        refreshAppliedBadges();
      });

      // Step 2 bindings
      if (step === 2) bindStep2();
      // Step 3 bindings
      if (step === 3) bindStep3();
    }

    function captureStep2() {
      var ta = modal.querySelector('#aa-proposal');
      if (ta) proposalText = ta.value;
      var ri = modal.querySelector('#aa-rate');
      if (ri) rate = ri.value;
      var tl = modal.querySelector('#aa-timeline');
      if (tl) timeline = tl.value;
      var eh = modal.querySelector('#aa-hours');
      if (eh) estimatedHours = eh.value;
    }

    function fetchProposal() {
      proposalLoading = true;
      proposalError = '';
      render();

      fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job: jobData,
          profile: profileData
        })
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          proposalLoading = false;
          proposalText = (data && data.proposal) || 'Could not generate proposal. Please write your own.';
          render();
        })
        .catch(function (err) {
          proposalLoading = false;
          proposalError = 'Failed to generate proposal: ' + (err.message || 'Unknown error');
          proposalText = '';
          render();
        });
    }

    function bindStep2() {
      var regen = modal.querySelector('#aa-regenerate');
      if (regen) regen.addEventListener('click', function () { fetchProposal(); });
    }

    function bindStep3() {
      var copyBtn = modal.querySelector('#aa-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          navigator.clipboard.writeText(proposalText).then(function () {
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('aa-btn--copied');
            var chk = modal.querySelector('#aa-chk-copied');
            if (chk) chk.checked = true;
          }).catch(function () {
            // fallback
            var ta = document.createElement('textarea');
            ta.value = proposalText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('aa-btn--copied');
          });
        });
      }

      var openBtn = modal.querySelector('#aa-open-upwork');
      if (openBtn) {
        openBtn.addEventListener('click', function () {
          window.open(jobData.url || '#', '_blank');
        });
      }
    }

    render();
  }

  // ─── Step renderers ───────────────────────────────────────────────
  function renderStep1(jobData) {
    var h = '';
    h += '<h2 class="aa-job-title">' + esc(jobData.title || 'Untitled Job') + '</h2>';

    // Red flag badge
    if (window.CortexRedFlagDetector) {
      try {
        var flags = window.CortexRedFlagDetector.detect ? window.CortexRedFlagDetector.detect(jobData) : null;
        if (flags && flags.length > 0) {
          h += '<div class="aa-red-flags">';
          h += '<span class="aa-flag-badge">🚩 Red Flags Detected</span>';
          flags.forEach(function (f) {
            h += '<div class="aa-flag-item">⚠️ ' + esc(typeof f === 'string' ? f : f.message || f.flag || JSON.stringify(f)) + '</div>';
          });
          h += '</div>';
        }
      } catch (e) { /* red flag detector not ready */ }
    }

    h += '<div class="aa-info-grid">';
    if (jobData.budget) {
      h += '<div class="aa-info-item"><span class="aa-info-label">💰 Budget</span><span class="aa-info-value">' + esc(String(jobData.budget)) + '</span></div>';
    }
    if (jobData.type || jobData.contractType) {
      h += '<div class="aa-info-item"><span class="aa-info-label">📋 Type</span><span class="aa-info-value">' + esc(jobData.type || jobData.contractType || '') + '</span></div>';
    }
    if (jobData.postedAt || jobData.posted) {
      h += '<div class="aa-info-item"><span class="aa-info-label">🕐 Posted</span><span class="aa-info-value">' + esc(jobData.postedAt || jobData.posted || '') + '</span></div>';
    }
    if (jobData.matchScore != null) {
      h += '<div class="aa-info-item"><span class="aa-info-label">🎯 Match</span><span class="aa-info-value">' + jobData.matchScore + '%</span></div>';
    }
    h += '</div>';

    if (jobData.description) {
      h += '<div class="aa-description">';
      h += '<h4>Job Description</h4>';
      h += '<div class="aa-desc-text">' + esc(jobData.description) + '</div>';
      h += '</div>';
    }

    if (jobData.skills && jobData.skills.length) {
      h += '<div class="aa-skills">';
      jobData.skills.forEach(function (s) {
        h += '<span class="aa-skill-tag">' + esc(s) + '</span>';
      });
      h += '</div>';
    }

    return h;
  }

  function renderStep2(jobData, proposal, rate, timeline, hours, loading, error) {
    var h = '';
    h += '<h2 class="aa-section-title">✍️ Customize Your Proposal</h2>';
    h += '<p class="aa-subtitle">for <strong>' + esc(jobData.title || '') + '</strong></p>';

    if (loading) {
      h += '<div class="aa-loading">';
      h += '  <div class="aa-spinner"></div>';
      h += '  <span>Generating proposal with AI…</span>';
      h += '</div>';
    }

    if (error) {
      h += '<div class="aa-error">' + esc(error) + '</div>';
    }

    h += '<label class="aa-label" for="aa-proposal">Cover Letter</label>';
    h += '<textarea class="aa-textarea" id="aa-proposal" rows="10" placeholder="Your proposal…"' + (loading ? ' disabled' : '') + '>' + esc(proposal) + '</textarea>';
    h += '<button class="aa-btn-secondary aa-btn-small" id="aa-regenerate" ' + (loading ? 'disabled' : '') + '>🔄 Regenerate</button>';

    h += '<div class="aa-form-row">';
    h += '  <div class="aa-form-group">';
    h += '    <label class="aa-label" for="aa-rate">💰 Your Rate ($/hr)</label>';
    h += '    <input type="number" class="aa-input" id="aa-rate" value="' + esc(rate) + '" placeholder="e.g. 65" min="1" />';
    h += '  </div>';
    h += '  <div class="aa-form-group">';
    h += '    <label class="aa-label" for="aa-timeline">📅 Timeline</label>';
    h += '    <select class="aa-select" id="aa-timeline">';
    TIMELINE_OPTIONS.forEach(function (opt) {
      h += '      <option value="' + esc(opt) + '"' + (opt === timeline ? ' selected' : '') + '>' + esc(opt) + '</option>';
    });
    h += '    </select>';
    h += '  </div>';
    h += '  <div class="aa-form-group">';
    h += '    <label class="aa-label" for="aa-hours">⏱️ Est. Hours</label>';
    h += '    <input type="number" class="aa-input" id="aa-hours" value="' + esc(hours) + '" placeholder="e.g. 40" min="1" />';
    h += '  </div>';
    h += '</div>';

    return h;
  }

  function renderStep3(jobData, proposal, rate) {
    var h = '';
    h += '<h2 class="aa-section-title">🚀 Submit on Upwork</h2>';
    h += '<p class="aa-subtitle">Almost done! Follow these steps:</p>';

    h += '<div class="aa-submit-actions">';
    h += '  <button class="aa-btn-primary aa-btn-wide" id="aa-copy">📋 Copy Proposal</button>';
    h += '  <button class="aa-btn-primary aa-btn-wide aa-btn-upwork" id="aa-open-upwork">🔗 Open on Upwork</button>';
    h += '</div>';

    h += '<div class="aa-instructions">';
    h += '  <p>1. Click <strong>Copy Proposal</strong> above</p>';
    h += '  <p>2. Click <strong>Open on Upwork</strong> to go to the job page</p>';
    h += '  <p>3. Paste your proposal on Upwork and submit</p>';
    h += '</div>';

    h += '<div class="aa-checklist">';
    h += '  <label class="aa-check-item"><input type="checkbox" id="aa-chk-copied" /> Proposal copied</label>';
    h += '  <label class="aa-check-item"><input type="checkbox" /> Rate set to $' + esc(rate || '?') + '/hr</label>';
    h += '  <label class="aa-check-item"><input type="checkbox" /> Cover letter personalized</label>';
    h += '</div>';

    h += '<div class="aa-proposal-preview">';
    h += '  <h4>Proposal Preview</h4>';
    h += '  <div class="aa-preview-text">' + esc(proposal).replace(/\n/g, '<br>') + '</div>';
    h += '</div>';

    return h;
  }

  // ─── 3) Refresh applied badges across all visible cards ───────────
  function refreshAppliedBadges() {
    var buttons = document.querySelectorAll('.aa-btn');
    buttons.forEach(function (btn) {
      // Re-render the parent page if possible
    });
    // Simpler: reload page to reflect changes
    if (window.CortexJobMatcher && typeof window.CortexJobMatcher.fetchAndRenderJobs === 'function') {
      // Let the matcher re-render, our buttons will attach with applied state
    }
    // Mark any button whose card matches an applied URL
    document.querySelectorAll('.jm-card').forEach(function (card) {
      var link = card.querySelector('.jm-card-title');
      if (!link) return;
      var url = link.getAttribute('href');
      if (url && isApplied(url)) {
        var aaBtn = card.querySelector('.aa-btn');
        if (aaBtn && !aaBtn.classList.contains('aa-btn--applied')) {
          aaBtn.textContent = '✅ Applied';
          aaBtn.classList.add('aa-btn--applied');
          aaBtn.disabled = true;
        }
      }
    });
  }

  // ─── 4) "My Applications" dashboard section ──────────────────────
  function renderApplicationsDashboard(containerId) {
    injectCSS();
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

    if (!container) {
      // Auto-create if not present
      container = document.createElement('div');
      container.id = 'cortex-applications';
      var main = document.querySelector('.dashboard-content, .main-content, main, body');
      if (main) main.appendChild(container);
    }

    var apps = getApplications();

    var h = '';
    h += '<div class="aa-dashboard">';
    h += '  <div class="aa-dash-header">';
    h += '    <h3 class="aa-dash-title">📋 My Applications</h3>';
    h += '    <span class="aa-dash-count">' + apps.length + ' total</span>';
    h += '  </div>';

    if (apps.length === 0) {
      h += '  <div class="aa-dash-empty">';
      h += '    <p>No applications yet. Find a job match and hit 🚀 Apply Now!</p>';
      h += '  </div>';
    } else {
      h += '  <div class="aa-dash-list">';
      apps.forEach(function (app, idx) {
        var date = '';
        try {
          date = new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) { date = app.appliedAt || ''; }

        h += '  <div class="aa-dash-item">';
        h += '    <div class="aa-dash-item-main">';
        h += '      <a href="' + esc(app.jobUrl || '#') + '" target="_blank" rel="noopener" class="aa-dash-job-title">' + esc(app.jobTitle) + '</a>';
        h += '      <div class="aa-dash-meta">';
        h += '        <span class="aa-dash-date">' + esc(date) + '</span>';
        h += '        <span class="aa-dash-status aa-status-' + esc(app.status || 'applied') + '">' + statusLabel(app.status) + '</span>';
        if (app.rate) h += '        <span class="aa-dash-rate">$' + esc(String(app.rate)) + '/hr</span>';
        h += '      </div>';
        h += '    </div>';
        h += '    <div class="aa-dash-item-actions">';
        h += '      <button class="aa-btn-secondary aa-btn-small aa-followup-btn" data-idx="' + idx + '">📩 Follow Up</button>';
        h += '    </div>';
        h += '  </div>';
      });
      h += '  </div>';
    }

    h += '</div>';
    container.innerHTML = h;

    // Bind follow-up buttons
    container.querySelectorAll('.aa-followup-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
        var app = apps[idx];
        if (app) showFollowUpModal(app);
      });
    });
  }

  function statusLabel(status) {
    switch (status) {
      case 'applied': return '✅ Applied';
      case 'interviewing': return '🗣️ Interviewing';
      case 'hired': return '🎉 Hired';
      case 'rejected': return '❌ Rejected';
      case 'withdrawn': return '🚫 Withdrawn';
      default: return '✅ Applied';
    }
  }

  // ─── Follow-up modal ─────────────────────────────────────────────
  function showFollowUpModal(app) {
    var overlay = document.createElement('div');
    overlay.className = 'aa-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    var modal = document.createElement('div');
    modal.className = 'aa-modal aa-modal--small';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close() {
      document.body.removeChild(overlay);
      document.body.style.overflow = '';
    }

    var daysSince = Math.floor((Date.now() - new Date(app.appliedAt).getTime()) / 86400000);
    var followUpMsg = generateFollowUp(app, daysSince);

    var h = '';
    h += '<div class="aa-modal-header">';
    h += '  <h3>📩 Follow Up — ' + esc(app.jobTitle) + '</h3>';
    h += '  <button class="aa-close" id="aa-fu-close">&times;</button>';
    h += '</div>';
    h += '<div class="aa-modal-body">';
    h += '  <p class="aa-subtitle">Applied ' + daysSince + ' day' + (daysSince !== 1 ? 's' : '') + ' ago</p>';
    h += '  <textarea class="aa-textarea" id="aa-fu-text" rows="8">' + esc(followUpMsg) + '</textarea>';
    h += '</div>';
    h += '<div class="aa-modal-footer">';
    h += '  <span></span>';
    h += '  <button class="aa-btn-primary" id="aa-fu-copy">📋 Copy Follow-Up</button>';
    h += '</div>';

    modal.innerHTML = h;

    modal.querySelector('#aa-fu-close').addEventListener('click', close);
    modal.querySelector('#aa-fu-copy').addEventListener('click', function () {
      var text = modal.querySelector('#aa-fu-text').value;
      navigator.clipboard.writeText(text).then(function () {
        var btn = modal.querySelector('#aa-fu-copy');
        btn.textContent = '✅ Copied!';
        btn.classList.add('aa-btn--copied');
      }).catch(function () {});
    });
  }

  function generateFollowUp(app, daysSince) {
    return 'Hi there,\n\n' +
      'I wanted to follow up on my proposal for "' + (app.jobTitle || 'your project') + '" that I submitted ' +
      daysSince + ' day' + (daysSince !== 1 ? 's' : '') + ' ago.\n\n' +
      'I\'m still very interested in this project and available to start right away. ' +
      'I\'d love to discuss how I can help bring your vision to life.\n\n' +
      'Would you be available for a quick chat this week?\n\n' +
      'Best regards';
  }

  // ─── Dark theme CSS ──────────────────────────────────────────────
  function getCSS() {
    return '' +
    /* Overlay */
    '.aa-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;animation:aa-fadein .2s ease}' +
    '@keyframes aa-fadein{from{opacity:0}to{opacity:1}}' +

    /* Modal */
    '.aa-modal{background:#1a1a2e;color:#e0e0e0;border-radius:16px;width:90vw;max-width:720px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.6);animation:aa-slideup .25s ease}' +
    '.aa-modal--small{max-width:520px}' +
    '@keyframes aa-slideup{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}' +

    /* Header */
    '.aa-modal-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 12px;border-bottom:1px solid #2a2a4a}' +
    '.aa-steps{display:flex;align-items:center;gap:8px;font-size:14px}' +
    '.aa-step{color:#666;font-weight:500;transition:color .2s}' +
    '.aa-step--active{color:#00ff88}' +
    '.aa-step-sep{color:#444;font-size:12px}' +
    '.aa-close{background:none;border:none;color:#888;font-size:24px;cursor:pointer;padding:4px 8px;border-radius:8px;transition:all .15s}' +
    '.aa-close:hover{background:#2a2a4a;color:#fff}' +

    /* Body */
    '.aa-modal-body{flex:1;overflow-y:auto;padding:24px;scrollbar-width:thin;scrollbar-color:#333 transparent}' +
    '.aa-modal-body::-webkit-scrollbar{width:6px}' +
    '.aa-modal-body::-webkit-scrollbar-thumb{background:#333;border-radius:3px}' +

    /* Footer */
    '.aa-modal-footer{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-top:1px solid #2a2a4a}' +

    /* Apply button on cards */
    '.aa-btn{background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}' +
    '.aa-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,204,106,.4)}' +
    '.aa-btn--applied{background:#2a2a4a;color:#00ff88;cursor:default;pointer-events:none}' +
    '.aa-btn--applied:hover{transform:none;box-shadow:none}' +

    /* Buttons */
    '.aa-btn-primary{background:linear-gradient(135deg,#00cc6a,#00aa55);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}' +
    '.aa-btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,204,106,.4)}' +
    '.aa-btn-secondary{background:#2a2a4a;color:#ccc;border:1px solid #3a3a5a;padding:10px 24px;border-radius:10px;font-size:14px;cursor:pointer;transition:all .15s}' +
    '.aa-btn-secondary:hover{background:#3a3a5a;color:#fff}' +
    '.aa-btn-small{padding:6px 14px;font-size:12px;border-radius:6px}' +
    '.aa-btn-wide{flex:1;text-align:center}' +
    '.aa-btn-upwork{background:linear-gradient(135deg,#14a800,#108a00)}' +
    '.aa-btn-upwork:hover{box-shadow:0 4px 16px rgba(20,168,0,.4)}' +
    '.aa-btn-success{background:linear-gradient(135deg,#00cc6a,#00ff88);font-size:16px;padding:12px 32px}' +
    '.aa-btn--copied{background:#2a2a4a!important;color:#00ff88!important;border:1px solid #00ff88!important}' +

    /* Step 1 — Review */
    '.aa-job-title{font-size:22px;font-weight:700;margin:0 0 16px;color:#fff}' +
    '.aa-red-flags{background:#2a1520;border:1px solid #ff4444;border-radius:10px;padding:12px 16px;margin-bottom:16px}' +
    '.aa-flag-badge{color:#ff4444;font-weight:700;font-size:14px}' +
    '.aa-flag-item{color:#ff8888;font-size:13px;margin-top:6px}' +
    '.aa-info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}' +
    '.aa-info-item{background:#16213e;border-radius:10px;padding:12px 16px}' +
    '.aa-info-label{display:block;font-size:12px;color:#888;margin-bottom:4px}' +
    '.aa-info-value{font-size:16px;font-weight:600;color:#fff}' +
    '.aa-description{margin-bottom:16px}' +
    '.aa-description h4{font-size:14px;color:#888;margin:0 0 8px;font-weight:500}' +
    '.aa-desc-text{font-size:14px;line-height:1.6;color:#ccc;max-height:200px;overflow-y:auto;white-space:pre-wrap}' +
    '.aa-skills{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}' +
    '.aa-skill-tag{background:#16213e;color:#00cc6a;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:500}' +

    /* Step 2 — Customize */
    '.aa-section-title{font-size:20px;font-weight:700;margin:0 0 4px;color:#fff}' +
    '.aa-subtitle{font-size:14px;color:#888;margin:0 0 20px}' +
    '.aa-label{display:block;font-size:13px;color:#aaa;margin-bottom:6px;font-weight:500}' +
    '.aa-textarea{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:10px;padding:14px;font-size:14px;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box;transition:border-color .2s}' +
    '.aa-textarea:focus{outline:none;border-color:#00cc6a}' +
    '.aa-textarea:disabled{opacity:.5}' +
    '.aa-form-row{display:flex;gap:16px;margin-top:20px;flex-wrap:wrap}' +
    '.aa-form-group{flex:1;min-width:140px}' +
    '.aa-input,.aa-select{width:100%;background:#0f0f23;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;box-sizing:border-box;transition:border-color .2s}' +
    '.aa-input:focus,.aa-select:focus{outline:none;border-color:#00cc6a}' +
    '.aa-select{appearance:auto}' +
    '.aa-loading{display:flex;align-items:center;gap:12px;padding:16px;background:#16213e;border-radius:10px;margin-bottom:16px}' +
    '.aa-spinner{width:24px;height:24px;border:3px solid #333;border-top-color:#00cc6a;border-radius:50%;animation:aa-spin .8s linear infinite}' +
    '@keyframes aa-spin{to{transform:rotate(360deg)}}' +
    '.aa-error{background:#2a1520;color:#ff6666;padding:12px 16px;border-radius:8px;margin-bottom:12px;font-size:13px}' +

    /* Step 3 — Submit */
    '.aa-submit-actions{display:flex;gap:12px;margin-bottom:24px}' +
    '.aa-instructions{background:#16213e;border-radius:10px;padding:16px 20px;margin-bottom:20px}' +
    '.aa-instructions p{margin:6px 0;font-size:14px;color:#ccc}' +
    '.aa-checklist{margin-bottom:20px}' +
    '.aa-check-item{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px;color:#ccc;cursor:pointer}' +
    '.aa-check-item input[type=checkbox]{accent-color:#00cc6a;width:18px;height:18px}' +
    '.aa-proposal-preview{background:#0f0f23;border:1px solid #2a2a4a;border-radius:10px;padding:16px;margin-top:12px}' +
    '.aa-proposal-preview h4{font-size:13px;color:#666;margin:0 0 10px;font-weight:500}' +
    '.aa-preview-text{font-size:13px;line-height:1.6;color:#aaa;max-height:150px;overflow-y:auto}' +

    /* Dashboard */
    '.aa-dashboard{background:#1a1a2e;border-radius:16px;padding:24px;margin-top:24px}' +
    '.aa-dash-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}' +
    '.aa-dash-title{font-size:18px;font-weight:700;color:#fff;margin:0}' +
    '.aa-dash-count{font-size:13px;color:#888;background:#16213e;padding:4px 12px;border-radius:20px}' +
    '.aa-dash-empty{text-align:center;padding:40px 20px;color:#666}' +
    '.aa-dash-list{display:flex;flex-direction:column;gap:8px}' +
    '.aa-dash-item{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#16213e;border-radius:10px;transition:background .15s}' +
    '.aa-dash-item:hover{background:#1c2745}' +
    '.aa-dash-item-main{flex:1;min-width:0}' +
    '.aa-dash-job-title{color:#00cc6a;text-decoration:none;font-weight:600;font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.aa-dash-job-title:hover{color:#00ff88}' +
    '.aa-dash-meta{display:flex;gap:12px;margin-top:4px;font-size:12px}' +
    '.aa-dash-date{color:#888}' +
    '.aa-dash-status{font-weight:500}' +
    '.aa-status-applied{color:#00cc6a}' +
    '.aa-status-interviewing{color:#ffaa00}' +
    '.aa-status-hired{color:#00ff88}' +
    '.aa-status-rejected{color:#ff4444}' +
    '.aa-dash-rate{color:#888}' +
    '.aa-dash-item-actions{flex-shrink:0;margin-left:12px}' +

    /* Responsive */
    '@media(max-width:600px){' +
      '.aa-modal{width:100vw;max-width:100vw;max-height:100vh;border-radius:0;height:100vh}' +
      '.aa-form-row{flex-direction:column}' +
      '.aa-submit-actions{flex-direction:column}' +
      '.aa-info-grid{grid-template-columns:1fr 1fr}' +
    '}';
  }

  // ─── Public API ───────────────────────────────────────────────────
  window.CortexAutoApply = {
    renderAutoApplyButton: renderAutoApplyButton,
    renderApplicationsDashboard: renderApplicationsDashboard,
    getApplications: getApplications,
    isApplied: isApplied,
    refreshAppliedBadges: refreshAppliedBadges
  };

})();
