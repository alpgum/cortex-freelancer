/**
 * [UW-014] Weekly Performance Digest
 *
 * Generates a weekly summary of freelancer activity and opportunities.
 * Reads localStorage data from other Cortex modules, calculates stats,
 * and renders a digest card with highlights, action items, and share.
 *
 * Exposed as window.CortexWeeklyDigest
 */
(function () {
  'use strict';

  // ── Storage Keys (shared with other modules) ─────────────────────
  var KEYS = {
    applications: 'cortex_applications',
    profileSnapshots: 'cortex_profile_snapshots',
    seenJobs: 'cortex_seen_jobs',
    jobAlerts: 'cortex_job_alerts',
    digest: 'cortex_weekly_digest'
  };

  // ── Date Helpers ──────────────────────────────────────────────────
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function getWeekRange() {
    var now = new Date();
    var day = now.getDay();
    var diffToMon = (day === 0 ? -6 : 1) - day;
    var monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    var sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }

  function formatWeekLabel(range) {
    var s = range.start;
    var e = range.end;
    var sMonth = MONTHS[s.getMonth()];
    var eMonth = MONTHS[e.getMonth()];
    var year = e.getFullYear();
    if (sMonth === eMonth) {
      return sMonth + ' ' + s.getDate() + '-' + e.getDate() + ', ' + year;
    }
    return sMonth + ' ' + s.getDate() + ' - ' + eMonth + ' ' + e.getDate() + ', ' + year;
  }

  function isThisWeek(timestamp, range) {
    var t = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  }

  // ── Safe localStorage Read ────────────────────────────────────────
  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch (_) { return null; }
  }

  // ── 1) gatherDigestData() ────────────────────────────────────────
  function gatherDigestData() {
    var range = getWeekRange();
    var applications = readStore(KEYS.applications) || [];
    var snapshots = readStore(KEYS.profileSnapshots) || [];
    var seenJobs = readStore(KEYS.seenJobs) || [];
    var alerts = readStore(KEYS.jobAlerts) || [];

    // Proposals sent this week
    var weekApps = applications.filter(function (a) {
      return isThisWeek(a.appliedAt || a.timestamp || a.date, range);
    });
    var proposalsSent = weekApps.length;

    // Score delta from snapshots
    var sortedSnaps = snapshots.slice().sort(function (a, b) {
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
    var currentScore = null;
    var previousScore = null;
    if (sortedSnaps.length > 0) {
      currentScore = sortedSnaps[sortedSnaps.length - 1].score || sortedSnaps[sortedSnaps.length - 1].totalScore || 0;
      // Find the last snapshot before this week
      for (var i = sortedSnaps.length - 1; i >= 0; i--) {
        if (!isThisWeek(sortedSnaps[i].timestamp, range)) {
          previousScore = sortedSnaps[i].score || sortedSnaps[i].totalScore || 0;
          break;
        }
      }
    }
    var scoreChange = (currentScore !== null && previousScore !== null)
      ? currentScore - previousScore
      : 0;

    // New jobs seen this week
    var weekJobs = seenJobs.filter(function (j) {
      return isThisWeek(j.seenAt || j.timestamp || j.date, range);
    });
    var newJobs = weekJobs.length;

    // Top match from seen jobs or alert results
    var topMatch = null;
    var topMatchScore = 0;
    var allJobs = weekJobs.concat([]);
    // Also pull jobs from alert results
    alerts.forEach(function (alert) {
      var results = alert.results || alert.jobs || [];
      results.forEach(function (j) {
        if (isThisWeek(j.seenAt || j.timestamp || j.date || alert.lastRun, range)) {
          allJobs.push(j);
        }
      });
    });
    allJobs.forEach(function (j) {
      var score = j.matchScore || j.compatibility || j.score || 0;
      if (score > topMatchScore) {
        topMatchScore = score;
        topMatch = j;
      }
    });

    return {
      range: range,
      weekLabel: formatWeekLabel(range),
      proposalsSent: proposalsSent,
      scoreChange: scoreChange,
      currentScore: currentScore || 0,
      newJobs: newJobs,
      topMatch: topMatch,
      topMatchScore: topMatchScore,
      weekApplications: weekApps,
      allWeekJobs: allJobs
    };
  }

  // ── 2) generateDigest() ──────────────────────────────────────────
  function generateDigest(data) {
    if (!data) data = gatherDigestData();

    var highlights = [];
    highlights.push(data.newJobs + ' new matching job' + (data.newJobs !== 1 ? 's' : '') + ' found');

    if (data.scoreChange !== 0) {
      var sign = data.scoreChange > 0 ? '+' : '';
      highlights.push('Your profile score ' +
        (data.scoreChange > 0 ? 'improved' : 'decreased') +
        ' by ' + sign + data.scoreChange + ' (now ' + data.currentScore + ')');
    } else if (data.currentScore) {
      highlights.push('Profile score steady at ' + data.currentScore);
    }

    highlights.push(data.proposalsSent + ' proposal' + (data.proposalsSent !== 1 ? 's' : '') + ' sent this week');

    if (data.topMatch) {
      var title = data.topMatch.title || data.topMatch.name || 'Unknown';
      highlights.push("Top match: '" + title + "' at " + data.topMatchScore + '% compatibility');
    }

    // Action items based on data
    var actionItems = [];
    if (data.newJobs > 0 && data.proposalsSent < 3) {
      var remaining = Math.min(3, data.newJobs) - data.proposalsSent;
      if (remaining > 0) {
        actionItems.push('Apply to ' + remaining + ' high-match job' + (remaining !== 1 ? 's' : '') + ' before they expire');
      }
    }
    if (data.currentScore && data.currentScore < 90) {
      actionItems.push('Complete portfolio step to gain +12 points');
    }
    if (data.proposalsSent === 0) {
      actionItems.push('You haven\'t sent any proposals — pick your best match and apply');
    }
    // Rate advice (always useful)
    actionItems.push('Review your rate against market data — keep it competitive');

    // Fallback action items if empty
    if (actionItems.length === 0) {
      actionItems.push('Keep up the momentum — review new jobs daily');
    }

    return {
      weekOf: data.weekLabel,
      highlights: highlights,
      actionItems: actionItems,
      stats: {
        newJobs: data.newJobs,
        proposalsSent: data.proposalsSent,
        scoreChange: data.scoreChange,
        topMatchScore: data.topMatchScore
      }
    };
  }

  // ── 3) renderWeeklyDigest(container) ─────────────────────────────
  function injectStyles() {
    if (document.getElementById('cortex-weekly-digest-css')) return;
    var style = document.createElement('style');
    style.id = 'cortex-weekly-digest-css';
    style.textContent = [
      '.cwd-card { background:#1a1a2e; border:1px solid #2d2d44; border-radius:14px; padding:24px; max-width:560px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#e0e0e0; }',
      '.cwd-header { display:flex; align-items:center; gap:10px; margin-bottom:6px; }',
      '.cwd-header h2 { margin:0; font-size:20px; color:#fff; }',
      '.cwd-week { font-size:13px; color:#8888aa; margin-bottom:18px; }',
      '.cwd-section-title { font-size:12px; text-transform:uppercase; letter-spacing:1.2px; color:#6c63ff; margin:18px 0 10px; font-weight:600; }',
      '.cwd-highlights { list-style:none; padding:0; margin:0; }',
      '.cwd-highlights li { padding:6px 0; font-size:14px; display:flex; align-items:flex-start; gap:8px; line-height:1.4; }',
      '.cwd-highlights li::before { content:attr(data-icon); flex-shrink:0; font-size:15px; }',
      '.cwd-actions { list-style:none; padding:0; margin:0; }',
      '.cwd-actions li { padding:6px 0; font-size:14px; display:flex; align-items:flex-start; gap:8px; line-height:1.4; cursor:pointer; }',
      '.cwd-actions li .cwd-checkbox { width:16px; height:16px; border:2px solid #6c63ff; border-radius:4px; flex-shrink:0; margin-top:2px; transition:all .2s; }',
      '.cwd-actions li.done .cwd-checkbox { background:#6c63ff; }',
      '.cwd-actions li.done span { text-decoration:line-through; opacity:.5; }',
      '.cwd-stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:18px; }',
      '.cwd-stat { background:#16162a; border:1px solid #2d2d44; border-radius:10px; padding:12px 10px; text-align:center; }',
      '.cwd-stat-value { font-size:22px; font-weight:700; color:#fff; }',
      '.cwd-stat-label { font-size:11px; color:#8888aa; margin-top:2px; }',
      '.cwd-share-btn { margin-top:18px; width:100%; padding:10px; background:linear-gradient(135deg,#6c63ff,#4ecdc4); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:opacity .2s; }',
      '.cwd-share-btn:hover { opacity:.85; }',
      '.cwd-share-btn.copied { background:#2ecc71; }',
      '@media(max-width:480px) { .cwd-stats-row { grid-template-columns:repeat(2,1fr); } }'
    ].join('\n');
    document.head.appendChild(style);
  }

  var HIGHLIGHT_ICONS = ['🔍', '📊', '📨', '⭐'];

  function renderWeeklyDigest(container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) { console.warn('[UW-014] Container not found'); return; }

    injectStyles();

    var digest = generateDigest();

    // Save latest digest
    try { localStorage.setItem(KEYS.digest, JSON.stringify(digest)); } catch (_) {}

    var card = document.createElement('div');
    card.className = 'cwd-card';

    // Header
    var header = document.createElement('div');
    header.className = 'cwd-header';
    header.innerHTML = '<span style="font-size:24px">📋</span><h2>Weekly Digest</h2>';
    card.appendChild(header);

    // Week range
    var week = document.createElement('div');
    week.className = 'cwd-week';
    week.textContent = 'Week of ' + digest.weekOf;
    card.appendChild(week);

    // Highlights
    var hlTitle = document.createElement('div');
    hlTitle.className = 'cwd-section-title';
    hlTitle.textContent = 'Highlights';
    card.appendChild(hlTitle);

    var hlList = document.createElement('ul');
    hlList.className = 'cwd-highlights';
    digest.highlights.forEach(function (h, i) {
      var li = document.createElement('li');
      li.setAttribute('data-icon', HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]);
      li.innerHTML = '<span>' + escapeHtml(h) + '</span>';
      hlList.appendChild(li);
    });
    card.appendChild(hlList);

    // Action Items
    var actTitle = document.createElement('div');
    actTitle.className = 'cwd-section-title';
    actTitle.textContent = 'Action Items';
    card.appendChild(actTitle);

    var actList = document.createElement('ul');
    actList.className = 'cwd-actions';
    digest.actionItems.forEach(function (item) {
      var li = document.createElement('li');
      li.innerHTML = '<div class="cwd-checkbox"></div><span>' + escapeHtml(item) + '</span>';
      li.addEventListener('click', function () {
        li.classList.toggle('done');
      });
      actList.appendChild(li);
    });
    card.appendChild(actList);

    // Stats row
    var statsRow = document.createElement('div');
    statsRow.className = 'cwd-stats-row';

    var statItems = [
      { value: digest.stats.newJobs, label: 'New Jobs' },
      { value: digest.stats.proposalsSent, label: 'Proposals' },
      { value: formatDelta(digest.stats.scoreChange), label: 'Score Δ' },
      { value: digest.stats.topMatchScore ? digest.stats.topMatchScore + '%' : '—', label: 'Top Match' }
    ];

    statItems.forEach(function (s) {
      var stat = document.createElement('div');
      stat.className = 'cwd-stat';
      stat.innerHTML = '<div class="cwd-stat-value">' + escapeHtml(String(s.value)) + '</div>' +
        '<div class="cwd-stat-label">' + escapeHtml(s.label) + '</div>';
      statsRow.appendChild(stat);
    });
    card.appendChild(statsRow);

    // Share button
    var shareBtn = document.createElement('button');
    shareBtn.className = 'cwd-share-btn';
    shareBtn.textContent = '📤 Share Digest';
    shareBtn.addEventListener('click', function () {
      var text = digestToText(digest);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          shareBtn.textContent = '✅ Copied!';
          shareBtn.classList.add('copied');
          setTimeout(function () {
            shareBtn.textContent = '📤 Share Digest';
            shareBtn.classList.remove('copied');
          }, 2000);
        });
      } else {
        // Fallback
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        shareBtn.textContent = '✅ Copied!';
        shareBtn.classList.add('copied');
        setTimeout(function () {
          shareBtn.textContent = '📤 Share Digest';
          shareBtn.classList.remove('copied');
        }, 2000);
      }
    });
    card.appendChild(shareBtn);

    container.innerHTML = '';
    container.appendChild(card);

    return digest;
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatDelta(n) {
    if (n > 0) return '+' + n;
    if (n < 0) return String(n);
    return '0';
  }

  function digestToText(digest) {
    var lines = [];
    lines.push('📋 Cortex Weekly Digest');
    lines.push('Week of ' + digest.weekOf);
    lines.push('');
    lines.push('✨ Highlights:');
    digest.highlights.forEach(function (h) { lines.push('  • ' + h); });
    lines.push('');
    lines.push('📌 Action Items:');
    digest.actionItems.forEach(function (a) { lines.push('  ☐ ' + a); });
    lines.push('');
    lines.push('📊 Stats: ' +
      digest.stats.newJobs + ' new jobs | ' +
      digest.stats.proposalsSent + ' proposals | ' +
      'Score ' + formatDelta(digest.stats.scoreChange) + ' | ' +
      'Top match ' + (digest.stats.topMatchScore ? digest.stats.topMatchScore + '%' : '—'));
    return lines.join('\n');
  }

  // ── Public API ────────────────────────────────────────────────────
  window.CortexWeeklyDigest = {
    gatherDigestData: gatherDigestData,
    generateDigest: generateDigest,
    renderWeeklyDigest: renderWeeklyDigest,
    digestToText: digestToText
  };

})();
