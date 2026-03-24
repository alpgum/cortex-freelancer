/**
 * [CF-152] Job Push Notifications
 * Real-time browser push notifications for job scanner results.
 * Adds notification permission request, keyword-based preferences,
 * frequency control, and test notification functionality.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_job_notification_prefs';

  /* ── Helpers ── */

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { enabled: false, keywords: [], frequency: 'instant' }; }
    catch (e) { return { enabled: false, keywords: [], frequency: 'instant' }; }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (e) {}
  }

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function isNotificationSupported() {
    return 'Notification' in window;
  }

  function getPermissionStatus() {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission; // 'default', 'granted', 'denied'
  }

  /* ── UI Builder ── */

  function buildNotificationPanel() {
    var prefs = loadPrefs();
    var permission = getPermissionStatus();

    var panel = document.createElement('div');
    panel.id = 'job-notification-panel';
    panel.style.cssText = 'background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius);padding:1.5rem;margin-bottom:1.5rem;';

    var headerHTML = '<h3 style="font-size:.75rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:1rem">Job Notifications</h3>';

    // Permission status
    var statusColor = permission === 'granted' ? 'var(--green)' : permission === 'denied' ? 'var(--red)' : 'var(--text3)';
    var statusLabel = permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : permission === 'unsupported' ? 'Not Supported' : 'Not Enabled';

    var statusHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">' +
      '<div style="display:flex;align-items:center;gap:.5rem">' +
        '<span style="font-size:.82rem;color:var(--text2)">Browser Notifications:</span>' +
        '<span style="font-size:.78rem;font-weight:700;color:' + statusColor + ';background:rgba(255,255,255,.05);padding:.15rem .6rem;border-radius:100px">' + statusLabel + '</span>' +
      '</div>' +
      '<div style="display:flex;gap:.5rem">';

    if (permission === 'default' || permission === 'denied') {
      statusHTML += '<button id="btn-enable-notif" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border-radius:100px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:all .2s;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#000">Enable Notifications</button>';
    }

    statusHTML += '<button id="btn-test-notif" style="display:inline-flex;align-items:center;gap:.4rem;padding:.5rem 1rem;border-radius:100px;font-size:.82rem;font-weight:600;border:1px solid rgba(255,255,255,.1);cursor:pointer;font-family:inherit;transition:all .2s;background:var(--bg3);color:var(--text2)"' +
      (permission !== 'granted' ? ' disabled title="Enable notifications first"' : '') +
      '>Test Notification</button>';

    statusHTML += '</div></div>';

    // Keyword preferences
    var keywordsHTML = '<div style="margin-bottom:1rem">' +
      '<label style="display:block;font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.4rem">Notification Keywords</label>' +
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
        '<input type="text" id="notif-keyword-input" placeholder="e.g. react, python, design..." style="flex:1;min-width:200px;background:var(--bg3);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:.55rem .8rem;color:var(--text);font-size:.85rem;font-family:inherit;outline:none">' +
        '<button id="btn-add-keyword" style="padding:.55rem 1rem;border-radius:100px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:var(--bg3);color:var(--green);border:1px solid rgba(0,255,136,.2)">+ Add</button>' +
      '</div>' +
      '<div id="notif-keywords-list" style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem"></div>' +
    '</div>';

    // Frequency selector
    var freqOptions = [
      { value: 'instant', label: 'Instant' },
      { value: 'hourly', label: 'Hourly' },
      { value: 'daily', label: 'Daily' }
    ];

    var freqHTML = '<div style="margin-bottom:1rem">' +
      '<label style="display:block;font-size:.8rem;font-weight:600;color:var(--text2);margin-bottom:.4rem">Notification Frequency</label>' +
      '<div style="display:flex;gap:.5rem">';

    freqOptions.forEach(function (opt) {
      var isActive = prefs.frequency === opt.value;
      freqHTML += '<button class="notif-freq-btn" data-freq="' + opt.value + '" style="padding:.5rem 1.2rem;border-radius:100px;font-size:.82rem;font-weight:600;border:1px solid ' +
        (isActive ? 'var(--orange)' : 'rgba(255,255,255,.1)') + ';background:' +
        (isActive ? 'var(--orange)' : 'var(--bg3)') + ';color:' +
        (isActive ? '#000' : 'var(--text2)') + ';cursor:pointer;font-family:inherit;transition:all .2s">' + opt.label + '</button>';
    });

    freqHTML += '</div></div>';

    // Summary
    var summaryHTML = '<div id="notif-summary" style="font-size:.78rem;color:var(--text3);padding:.5rem .75rem;background:var(--bg3);border-radius:var(--radius-sm)"></div>';

    panel.innerHTML = headerHTML + statusHTML + keywordsHTML + freqHTML + summaryHTML;

    return panel;
  }

  function renderKeywordTags() {
    var prefs = loadPrefs();
    var container = document.getElementById('notif-keywords-list');
    if (!container) return;

    if (!prefs.keywords.length) {
      container.innerHTML = '<span style="font-size:.78rem;color:var(--text3)">No keywords set. Add keywords to receive targeted notifications.</span>';
      return;
    }

    container.innerHTML = prefs.keywords.map(function (kw, idx) {
      return '<span style="display:inline-flex;align-items:center;gap:.35rem;background:rgba(255,136,68,.1);color:var(--orange);padding:.2rem .6rem;border-radius:100px;font-size:.75rem;font-weight:600">' +
        esc(kw) +
        '<button data-remove-kw="' + idx + '" style="background:none;border:none;color:var(--orange);cursor:pointer;font-size:.9rem;padding:0 2px;line-height:1;opacity:.7">&times;</button>' +
      '</span>';
    }).join('');
  }

  function updateSummary() {
    var prefs = loadPrefs();
    var el = document.getElementById('notif-summary');
    if (!el) return;

    var permission = getPermissionStatus();
    if (permission !== 'granted') {
      el.textContent = 'Enable browser notifications to receive job alerts.';
      return;
    }

    if (!prefs.keywords.length) {
      el.textContent = 'Notifications enabled. Add keywords to filter relevant jobs.';
      return;
    }

    var freqLabel = prefs.frequency === 'instant' ? 'instantly' : prefs.frequency === 'hourly' ? 'hourly' : 'daily';
    el.textContent = 'You will be notified ' + freqLabel + ' about jobs matching: ' + prefs.keywords.join(', ') + '.';
  }

  /* ── Event Handlers ── */

  function bindEvents() {
    var panel = document.getElementById('job-notification-panel');
    if (!panel) return;

    // Enable notifications button
    var enableBtn = document.getElementById('btn-enable-notif');
    if (enableBtn) {
      enableBtn.addEventListener('click', function () {
        if (!isNotificationSupported()) {
          showToast('Browser notifications are not supported');
          return;
        }

        Notification.requestPermission().then(function (result) {
          try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-push-notifications', action: 'request_permission', result: result }); } catch (e) {}

          if (result === 'granted') {
            var prefs = loadPrefs();
            prefs.enabled = true;
            savePrefs(prefs);
            showToast('Notifications enabled!');
            rebuildPanel();
          } else if (result === 'denied') {
            showToast('Notifications blocked. Check browser settings.');
            rebuildPanel();
          }
        });
      });
    }

    // Test notification button
    var testBtn = document.getElementById('btn-test-notif');
    if (testBtn) {
      testBtn.addEventListener('click', function () {
        if (getPermissionStatus() !== 'granted') {
          showToast('Enable notifications first');
          return;
        }

        var prefs = loadPrefs();
        var keywordText = prefs.keywords.length ? prefs.keywords[0] : 'React Developer';

        try {
          var notif = new Notification('New Job Match - Cortex', {
            body: 'Senior ' + keywordText + ' needed - $3,000-$5,000 budget. Click to view.',
            icon: '/apple-touch-icon.png',
            badge: '/favicon.ico',
            tag: 'cortex-test-' + Date.now(),
            requireInteraction: false
          });

          notif.onclick = function () {
            window.focus();
            notif.close();
          };

          setTimeout(function () { notif.close(); }, 5000);

          try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-push-notifications', action: 'test_notification' }); } catch (e) {}
          showToast('Test notification sent!');
        } catch (e) {
          showToast('Could not send notification');
        }
      });
    }

    // Add keyword
    var addBtn = document.getElementById('btn-add-keyword');
    var kwInput = document.getElementById('notif-keyword-input');

    function addKeyword() {
      if (!kwInput) return;
      var val = kwInput.value.trim();
      if (!val) return;

      var prefs = loadPrefs();
      var newKeywords = val.split(',').map(function (k) { return k.trim().toLowerCase(); }).filter(function (k) { return k.length > 0; });

      newKeywords.forEach(function (kw) {
        if (prefs.keywords.indexOf(kw) === -1) {
          prefs.keywords.push(kw);
        }
      });

      savePrefs(prefs);
      kwInput.value = '';
      renderKeywordTags();
      updateSummary();
      try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-push-notifications', action: 'add_keyword' }); } catch (e) {}
    }

    if (addBtn) addBtn.addEventListener('click', addKeyword);
    if (kwInput) kwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') addKeyword(); });

    // Remove keyword
    panel.addEventListener('click', function (e) {
      var removeBtn = e.target.closest('[data-remove-kw]');
      if (!removeBtn) return;

      var idx = parseInt(removeBtn.getAttribute('data-remove-kw'), 10);
      var prefs = loadPrefs();
      prefs.keywords.splice(idx, 1);
      savePrefs(prefs);
      renderKeywordTags();
      updateSummary();
    });

    // Frequency buttons
    var freqBtns = panel.querySelectorAll('.notif-freq-btn');
    freqBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var freq = btn.getAttribute('data-freq');
        var prefs = loadPrefs();
        prefs.frequency = freq;
        savePrefs(prefs);

        freqBtns.forEach(function (b) {
          var isActive = b.getAttribute('data-freq') === freq;
          b.style.background = isActive ? 'var(--orange)' : 'var(--bg3)';
          b.style.color = isActive ? '#000' : 'var(--text2)';
          b.style.borderColor = isActive ? 'var(--orange)' : 'rgba(255,255,255,.1)';
        });

        updateSummary();
        try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-push-notifications', action: 'set_frequency', frequency: freq }); } catch (e) {}
      });
    });
  }

  function rebuildPanel() {
    var existing = document.getElementById('job-notification-panel');
    if (!existing) return;
    var parent = existing.parentNode;
    var next = existing.nextSibling;
    parent.removeChild(existing);
    var newPanel = buildNotificationPanel();
    parent.insertBefore(newPanel, next);
    renderKeywordTags();
    updateSummary();
    bindEvents();
  }

  /* ── Job Scan Integration ── */

  function checkJobsForNotifications(jobs) {
    var prefs = loadPrefs();
    if (!prefs.enabled || getPermissionStatus() !== 'granted') return;
    if (!prefs.keywords.length) return;
    if (!jobs || !jobs.length) return;

    // Frequency gating
    var lastNotifTime = parseInt(localStorage.getItem('cortex_job_notif_last_sent') || '0', 10);
    var now = Date.now();
    var minInterval = prefs.frequency === 'instant' ? 0 : prefs.frequency === 'hourly' ? 3600000 : 86400000;

    if (now - lastNotifTime < minInterval) return;

    var matchingJobs = [];
    jobs.forEach(function (job) {
      var jobText = ((job.title || '') + ' ' + (job.description || '') + ' ' + (job.skills || []).join(' ')).toLowerCase();
      var matchedKeywords = prefs.keywords.filter(function (kw) {
        return jobText.indexOf(kw.toLowerCase()) >= 0;
      });
      if (matchedKeywords.length > 0) {
        matchingJobs.push({ job: job, keywords: matchedKeywords });
      }
    });

    if (!matchingJobs.length) return;

    var count = matchingJobs.length;
    var topJob = matchingJobs[0].job;
    var title = count === 1 ? 'New Job Match!' : count + ' New Job Matches!';
    var body = count === 1
      ? (topJob.title || 'New job') + (topJob.budget ? ' - $' + topJob.budget : '')
      : count + ' jobs match your keywords: ' + prefs.keywords.slice(0, 3).join(', ');

    try {
      var notif = new Notification(title + ' - Cortex', {
        body: body,
        icon: '/apple-touch-icon.png',
        badge: '/favicon.ico',
        tag: 'cortex-job-match-' + Date.now(),
        requireInteraction: false
      });

      notif.onclick = function () {
        window.focus();
        notif.close();
      };

      setTimeout(function () { notif.close(); }, 8000);

      localStorage.setItem('cortex_job_notif_last_sent', String(now));
      try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-push-notifications', action: 'notification_sent', match_count: count }); } catch (e) {}
    } catch (e) {
      // Notification failed silently
    }
  }

  /* ── Init ── */

  document.addEventListener('DOMContentLoaded', function () {
    // Insert panel after the filters section (before results)
    var mainWrap = document.querySelector('.main-wrap');
    if (!mainWrap) return;

    var rssResults = document.getElementById('rss-results');
    if (!rssResults) return;

    var panel = buildNotificationPanel();
    mainWrap.insertBefore(panel, rssResults);
    renderKeywordTags();
    updateSummary();
    bindEvents();

    // Auto-populate keywords from search input
    var searchInput = document.getElementById('keyword-input');
    if (searchInput) {
      var prefs = loadPrefs();
      if (!prefs.keywords.length && searchInput.value.trim()) {
        // Pre-fill suggestion but don't auto-add
      }
    }

    // Hook into job scan results to trigger notifications
    window.CortexJobNotifications = {
      checkJobs: checkJobsForNotifications,
      getPrefs: loadPrefs,
      savePrefs: savePrefs,
      rebuildPanel: rebuildPanel
    };

    // Observe results container for new job cards
    var resultsObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length > 0) {
          var jobCards = (mutation.target.id === 'rss-results' || mutation.target.id === 'results')
            ? mutation.target.querySelectorAll('.job-card')
            : [];

          if (jobCards.length > 0) {
            var jobs = [];
            jobCards.forEach(function (card) {
              var titleEl = card.querySelector('.job-title');
              var budgetEl = card.querySelector('.job-budget');
              var skillEls = card.querySelectorAll('.skill-tag');
              var descEl = card.querySelector('.job-desc');

              var skills = [];
              skillEls.forEach(function (s) { skills.push(s.textContent); });

              jobs.push({
                title: titleEl ? titleEl.textContent : '',
                budget: budgetEl ? budgetEl.textContent.replace(/[^0-9.,]/g, '') : '',
                skills: skills,
                description: descEl ? descEl.textContent : ''
              });
            });

            checkJobsForNotifications(jobs);
          }
        }
      });
    });

    var rssContainer = document.getElementById('rss-results');
    var pasteContainer = document.getElementById('results');

    if (rssContainer) {
      resultsObserver.observe(rssContainer, { childList: true, subtree: true });
    }
    if (pasteContainer) {
      resultsObserver.observe(pasteContainer, { childList: true, subtree: true });
    }

    try { window.dataLayer = window.dataLayer || []; dataLayer.push({ event: 'tool_used', tool_name: 'job-push-notifications', action: 'init' }); } catch (e) {}
  });
})();
