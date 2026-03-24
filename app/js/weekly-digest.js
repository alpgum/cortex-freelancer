/**
 * [CF-068] Weekly Performance Digest
 * Generate weekly summary: proposals sent, response rate, earnings,
 * AI-generated suggestions for improvement.
 *
 * Exposed as window.CortexFreelancer.weeklyDigest AND window.CortexWeeklyDigest (legacy)
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ── Storage Keys ──────────────────────────────────────────────────
  var KEYS = {
    applications: 'cortex_applications',
    profileSnapshots: 'cortex_profile_snapshots',
    seenJobs: 'cortex_seen_jobs',
    jobAlerts: 'cortex_job_alerts',
    digest: 'cortex_weekly_digest',
    earnings: 'cortex_earnings',
    responses: 'cortex_proposal_responses'
  };

  // ── Date Helpers ──────────────────────────────────────────────────
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function getWeekRange(weeksAgo) {
    weeksAgo = weeksAgo || 0;
    var now = new Date();
    now.setDate(now.getDate() - weeksAgo * 7);
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
    var s = range.start, e = range.end;
    var sM = MONTHS[s.getMonth()], eM = MONTHS[e.getMonth()];
    if (sM === eM) return sM + ' ' + s.getDate() + '-' + e.getDate() + ', ' + e.getFullYear();
    return sM + ' ' + s.getDate() + ' - ' + eM + ' ' + e.getDate() + ', ' + e.getFullYear();
  }

  function isInRange(timestamp, range) {
    var t = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return t >= range.start.getTime() && t <= range.end.getTime();
  }

  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
  }

  // ── 1) Gather Performance Data ────────────────────────────────────

  function gatherDigestData(weeksAgo) {
    var range = getWeekRange(weeksAgo);
    var prevRange = getWeekRange((weeksAgo || 0) + 1);
    var applications = readStore(KEYS.applications) || [];
    var snapshots = readStore(KEYS.profileSnapshots) || [];
    var seenJobs = readStore(KEYS.seenJobs) || [];
    var alerts = readStore(KEYS.jobAlerts) || [];
    var earnings = readStore(KEYS.earnings) || [];
    var responses = readStore(KEYS.responses) || [];

    // This week's proposals
    var weekApps = applications.filter(function (a) { return isInRange(a.appliedAt || a.timestamp, range); });
    var prevWeekApps = applications.filter(function (a) { return isInRange(a.appliedAt || a.timestamp, prevRange); });

    // Response rate
    var weekResponses = responses.filter(function (r) { return isInRange(r.respondedAt || r.timestamp, range); });
    var responseRate = weekApps.length > 0 ? Math.round((weekResponses.length / weekApps.length) * 100) : 0;
    var prevResponses = responses.filter(function (r) { return isInRange(r.respondedAt || r.timestamp, prevRange); });
    var prevResponseRate = prevWeekApps.length > 0 ? Math.round((prevResponses.length / prevWeekApps.length) * 100) : 0;

    // Earnings
    var weekEarnings = earnings.filter(function (e) { return isInRange(e.date || e.timestamp, range); });
    var totalEarnings = weekEarnings.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);
    var prevEarnings = earnings.filter(function (e) { return isInRange(e.date || e.timestamp, prevRange); });
    var prevTotalEarnings = prevEarnings.reduce(function (sum, e) { return sum + (e.amount || 0); }, 0);

    // Profile score
    var sortedSnaps = snapshots.slice().sort(function (a, b) { return (a.timestamp || 0) - (b.timestamp || 0); });
    var currentScore = 0, previousScore = 0;
    if (sortedSnaps.length > 0) {
      currentScore = sortedSnaps[sortedSnaps.length - 1].score || sortedSnaps[sortedSnaps.length - 1].totalScore || 0;
      for (var i = sortedSnaps.length - 1; i >= 0; i--) {
        if (!isInRange(sortedSnaps[i].timestamp, range)) {
          previousScore = sortedSnaps[i].score || sortedSnaps[i].totalScore || 0;
          break;
        }
      }
    }

    // Jobs found
    var weekJobs = seenJobs.filter(function (j) { return isInRange(j.seenAt || j.timestamp, range); });
    var allJobs = weekJobs.slice();
    alerts.forEach(function (alert) {
      (alert.results || alert.jobs || []).forEach(function (j) {
        if (isInRange(j.seenAt || j.timestamp || alert.lastRun, range)) allJobs.push(j);
      });
    });

    // Top match
    var topMatch = null, topMatchScore = 0;
    allJobs.forEach(function (j) {
      var score = j.matchScore || j.compatibility || j.score || 0;
      if (score > topMatchScore) { topMatchScore = score; topMatch = j; }
    });

    // Win rate (interviews/hires from responses)
    var interviews = weekResponses.filter(function (r) { return r.type === 'interview' || r.type === 'hired'; }).length;
    var hires = weekResponses.filter(function (r) { return r.type === 'hired'; }).length;

    return {
      range: range,
      weekLabel: formatWeekLabel(range),
      proposalsSent: weekApps.length,
      prevProposalsSent: prevWeekApps.length,
      responseRate: responseRate,
      prevResponseRate: prevResponseRate,
      responsesReceived: weekResponses.length,
      interviews: interviews,
      hires: hires,
      totalEarnings: totalEarnings,
      prevTotalEarnings: prevTotalEarnings,
      scoreChange: currentScore - previousScore,
      currentScore: currentScore,
      newJobs: allJobs.length,
      topMatch: topMatch,
      topMatchScore: topMatchScore,
      weekApplications: weekApps,
      allWeekJobs: allJobs
    };
  }

  // ── 2) Generate AI-Style Suggestions ──────────────────────────────

  function _generateSuggestions(data) {
    var suggestions = [];

    // Proposal volume
    if (data.proposalsSent === 0) {
      suggestions.push({ type: 'critical', icon: '🚨', text: 'No proposals sent this week. Aim for at least 5-10 per week to maintain pipeline.' });
    } else if (data.proposalsSent < 5) {
      suggestions.push({ type: 'warning', icon: '📝', text: 'Only ' + data.proposalsSent + ' proposals sent. Increasing to 8-12/week typically improves win rate by 40%.' });
    } else if (data.proposalsSent > data.prevProposalsSent) {
      suggestions.push({ type: 'positive', icon: '📈', text: 'Proposal volume up from ' + data.prevProposalsSent + ' to ' + data.proposalsSent + '. Keep the momentum!' });
    }

    // Response rate
    if (data.proposalsSent >= 3 && data.responseRate < 10) {
      suggestions.push({ type: 'critical', icon: '💬', text: 'Response rate is ' + data.responseRate + '%. Consider: shorter opening hooks, more specific case studies, lower initial bid to get foot in door.' });
    } else if (data.responseRate >= 30) {
      suggestions.push({ type: 'positive', icon: '🎯', text: 'Strong ' + data.responseRate + '% response rate! Your proposals are resonating well.' });
    } else if (data.responseRate > 0 && data.responseRate < data.prevResponseRate) {
      suggestions.push({ type: 'warning', icon: '📉', text: 'Response rate dropped from ' + data.prevResponseRate + '% to ' + data.responseRate + '%. Review recent proposals for quality.' });
    }

    // Earnings
    if (data.totalEarnings > 0) {
      if (data.totalEarnings > data.prevTotalEarnings) {
        var pct = data.prevTotalEarnings > 0 ? Math.round(((data.totalEarnings - data.prevTotalEarnings) / data.prevTotalEarnings) * 100) : 100;
        suggestions.push({ type: 'positive', icon: '💰', text: 'Earnings up ' + pct + '% ($' + data.totalEarnings.toLocaleString() + '). Consider raising your rate by 5-10%.' });
      } else if (data.totalEarnings < data.prevTotalEarnings * 0.7) {
        suggestions.push({ type: 'warning', icon: '💸', text: 'Earnings down this week. Focus on closing existing leads before new proposals.' });
      }
    } else if (data.prevTotalEarnings > 0) {
      suggestions.push({ type: 'warning', icon: '💸', text: 'No earnings this week. Prioritize follow-ups with pending clients.' });
    }

    // Profile score
    if (data.currentScore > 0 && data.currentScore < 80) {
      suggestions.push({ type: 'info', icon: '👤', text: 'Profile score at ' + data.currentScore + '. Add portfolio items and certifications to break 90+.' });
    }

    // Job market
    if (data.newJobs > 20) {
      suggestions.push({ type: 'positive', icon: '🔍', text: data.newJobs + ' matching jobs found. Market is active — be selective and bid on best-fit opportunities.' });
    } else if (data.newJobs < 5) {
      suggestions.push({ type: 'info', icon: '🔍', text: 'Only ' + data.newJobs + ' matching jobs. Consider broadening your skills filter or exploring adjacent categories.' });
    }

    // Conversion funnel
    if (data.interviews > 0 && data.hires === 0) {
      suggestions.push({ type: 'warning', icon: '🗣️', text: data.interviews + ' interviews but no hires. Practice your pitch: focus on client outcomes, not your resume.' });
    } else if (data.hires > 0) {
      suggestions.push({ type: 'positive', icon: '🎉', text: data.hires + ' new hire' + (data.hires > 1 ? 's' : '') + ' this week! Request reviews within 48 hours of delivery.' });
    }

    // General tips (rotate)
    var weekNum = Math.floor(Date.now() / 604800000);
    var tips = [
      { icon: '⏰', text: 'Proposals sent within 2 hours of posting get 3x more responses. Set up job alerts.' },
      { icon: '📸', text: 'Profiles with video introductions get 50% more invitations. Add one if you haven\'t.' },
      { icon: '🔄', text: 'Follow up on proposals after 3-5 days. A polite nudge converts 15% of silent leads.' },
      { icon: '⭐', text: 'Aim for 5-star reviews on every project. 1 bad review takes 10 good ones to offset.' },
      { icon: '🎨', text: 'Update your portfolio quarterly. Remove old projects, add recent wins.' },
      { icon: '📊', text: 'Track your effective hourly rate (total earned / total hours). Optimize for this, not just gross.' }
    ];
    suggestions.push({ type: 'tip', icon: tips[weekNum % tips.length].icon, text: tips[weekNum % tips.length].text });

    return suggestions;
  }

  // ── 3) Generate Full Digest ───────────────────────────────────────

  function generateDigest(weeksAgo) {
    var data = gatherDigestData(weeksAgo);
    var suggestions = _generateSuggestions(data);

    var highlights = [];
    highlights.push(data.proposalsSent + ' proposal' + (data.proposalsSent !== 1 ? 's' : '') + ' sent');
    if (data.responsesReceived > 0) highlights.push(data.responsesReceived + ' response' + (data.responsesReceived !== 1 ? 's' : '') + ' received (' + data.responseRate + '% rate)');
    if (data.totalEarnings > 0) highlights.push('$' + data.totalEarnings.toLocaleString() + ' earned');
    if (data.interviews > 0) highlights.push(data.interviews + ' interview' + (data.interviews !== 1 ? 's' : ''));
    if (data.hires > 0) highlights.push(data.hires + ' new hire' + (data.hires !== 1 ? 's' : '') + ' 🎉');
    highlights.push(data.newJobs + ' matching job' + (data.newJobs !== 1 ? 's' : '') + ' found');
    if (data.topMatch) {
      highlights.push('Top match: "' + (data.topMatch.title || 'Unknown') + '" (' + data.topMatchScore + '%)');
    }
    if (data.scoreChange !== 0) {
      highlights.push('Profile score ' + (data.scoreChange > 0 ? '+' : '') + data.scoreChange + ' (now ' + data.currentScore + ')');
    }

    var actionItems = suggestions.filter(function (s) { return s.type === 'critical' || s.type === 'warning'; }).map(function (s) { return s.text; });
    if (actionItems.length === 0) actionItems.push('Keep up the good work! Focus on quality over quantity.');

    return {
      weekOf: data.weekLabel,
      highlights: highlights,
      suggestions: suggestions,
      actionItems: actionItems,
      stats: {
        proposalsSent: data.proposalsSent,
        prevProposalsSent: data.prevProposalsSent,
        responseRate: data.responseRate,
        prevResponseRate: data.prevResponseRate,
        responsesReceived: data.responsesReceived,
        interviews: data.interviews,
        hires: data.hires,
        totalEarnings: data.totalEarnings,
        prevTotalEarnings: data.prevTotalEarnings,
        newJobs: data.newJobs,
        scoreChange: data.scoreChange,
        currentScore: data.currentScore,
        topMatchScore: data.topMatchScore
      },
      raw: data
    };
  }

  // ── 4) Render Digest Card ─────────────────────────────────────────

  function _injectStyles() {
    if (document.getElementById('cortex-weekly-digest-css')) return;
    var style = document.createElement('style');
    style.id = 'cortex-weekly-digest-css';
    style.textContent = [
      '.cwd-card{background:#1a1a2e;border:1px solid #2d2d44;border-radius:14px;padding:24px;max-width:600px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e0e0e0}',
      '.cwd-header{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
      '.cwd-header h2{margin:0;font-size:20px;color:#fff}',
      '.cwd-week{font-size:13px;color:#8888aa;margin-bottom:18px}',
      '.cwd-section-title{font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:#6c63ff;margin:18px 0 10px;font-weight:600}',
      '.cwd-highlights{list-style:none;padding:0;margin:0}',
      '.cwd-highlights li{padding:6px 0;font-size:14px;display:flex;align-items:flex-start;gap:8px;line-height:1.4}',
      '.cwd-highlights li::before{content:attr(data-icon);flex-shrink:0;font-size:15px}',
      '.cwd-suggestion{padding:10px 14px;margin-bottom:8px;border-radius:8px;font-size:13px;line-height:1.5;display:flex;align-items:flex-start;gap:8px}',
      '.cwd-suggestion-critical{background:#2d151540;border-left:3px solid #ef4444}',
      '.cwd-suggestion-warning{background:#2d251540;border-left:3px solid #f59e0b}',
      '.cwd-suggestion-positive{background:#152d1540;border-left:3px solid #22c55e}',
      '.cwd-suggestion-info{background:#15152d40;border-left:3px solid #6c63ff}',
      '.cwd-suggestion-tip{background:#2d2d1540;border-left:3px solid #06b6d4}',
      '.cwd-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}',
      '.cwd-stat{background:#16162a;border:1px solid #2d2d44;border-radius:10px;padding:12px 10px;text-align:center}',
      '.cwd-stat-value{font-size:22px;font-weight:700;color:#fff}',
      '.cwd-stat-label{font-size:11px;color:#8888aa;margin-top:2px}',
      '.cwd-stat-delta{font-size:10px;margin-top:2px}',
      '.cwd-delta-up{color:#22c55e}.cwd-delta-down{color:#ef4444}.cwd-delta-flat{color:#8888aa}',
      '.cwd-share-btn{margin-top:18px;width:100%;padding:10px;background:linear-gradient(135deg,#6c63ff,#4ecdc4);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s}',
      '.cwd-share-btn:hover{opacity:.85}',
      '.cwd-share-btn.copied{background:#2ecc71}',
      '@media(max-width:480px){.cwd-stats-row{grid-template-columns:repeat(2,1fr)}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function _deltaHTML(current, previous, suffix) {
    suffix = suffix || '';
    if (previous === 0 && current === 0) return '<span class="cwd-delta-flat">—</span>';
    var diff = current - previous;
    if (diff > 0) return '<span class="cwd-delta-up">▲ +' + diff + suffix + '</span>';
    if (diff < 0) return '<span class="cwd-delta-down">▼ ' + diff + suffix + '</span>';
    return '<span class="cwd-delta-flat">→ same</span>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function renderWeeklyDigest(container, weeksAgo) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    _injectStyles();

    var digest = generateDigest(weeksAgo);
    try { localStorage.setItem(KEYS.digest, JSON.stringify(digest)); } catch (_) {}

    var ICONS = ['📨','💬','💰','🗣️','🎉','🔍','⭐','📊'];
    var card = document.createElement('div');
    card.className = 'cwd-card';

    var h = '';
    h += '<div class="cwd-header"><span style="font-size:24px">📋</span><h2>Weekly Performance Digest</h2></div>';
    h += '<div class="cwd-week">Week of ' + escapeHtml(digest.weekOf) + '</div>';

    // Stats row
    h += '<div class="cwd-stats-row">';
    var stats = [
      { value: digest.stats.proposalsSent, label: 'Proposals', delta: _deltaHTML(digest.stats.proposalsSent, digest.stats.prevProposalsSent) },
      { value: digest.stats.responseRate + '%', label: 'Response Rate', delta: _deltaHTML(digest.stats.responseRate, digest.stats.prevResponseRate, '%') },
      { value: '$' + (digest.stats.totalEarnings || 0).toLocaleString(), label: 'Earnings', delta: _deltaHTML(digest.stats.totalEarnings, digest.stats.prevTotalEarnings) },
      { value: digest.stats.topMatchScore ? digest.stats.topMatchScore + '%' : '—', label: 'Top Match', delta: '' }
    ];
    stats.forEach(function (s) {
      h += '<div class="cwd-stat"><div class="cwd-stat-value">' + escapeHtml(String(s.value)) + '</div>';
      h += '<div class="cwd-stat-label">' + escapeHtml(s.label) + '</div>';
      if (s.delta) h += '<div class="cwd-stat-delta">' + s.delta + '</div>';
      h += '</div>';
    });
    h += '</div>';

    // Highlights
    h += '<div class="cwd-section-title">Highlights</div>';
    h += '<ul class="cwd-highlights">';
    digest.highlights.forEach(function (hl, i) {
      h += '<li data-icon="' + ICONS[i % ICONS.length] + '"><span>' + escapeHtml(hl) + '</span></li>';
    });
    h += '</ul>';

    // AI Suggestions
    h += '<div class="cwd-section-title">💡 AI Suggestions</div>';
    digest.suggestions.forEach(function (s) {
      h += '<div class="cwd-suggestion cwd-suggestion-' + s.type + '">';
      h += '<span>' + s.icon + '</span><span>' + escapeHtml(s.text) + '</span></div>';
    });

    // Share
    h += '<button class="cwd-share-btn" id="cwd-share">📤 Share Digest</button>';

    card.innerHTML = h;
    container.innerHTML = '';
    container.appendChild(card);

    card.querySelector('#cwd-share').addEventListener('click', function () {
      var text = digestToText(digest);
      var btn = card.querySelector('#cwd-share');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          btn.textContent = '✅ Copied!';
          btn.classList.add('copied');
          setTimeout(function () { btn.textContent = '📤 Share Digest'; btn.classList.remove('copied'); }, 2000);
        });
      }
    });

    return digest;
  }

  // ── Text Export ───────────────────────────────────────────────────

  function digestToText(digest) {
    var lines = ['📋 Cortex Weekly Performance Digest', 'Week of ' + digest.weekOf, ''];
    lines.push('📊 Stats:');
    lines.push('  Proposals: ' + digest.stats.proposalsSent + ' | Response Rate: ' + digest.stats.responseRate + '% | Earnings: $' + (digest.stats.totalEarnings || 0).toLocaleString());
    lines.push('');
    lines.push('✨ Highlights:');
    digest.highlights.forEach(function (h) { lines.push('  • ' + h); });
    lines.push('');
    lines.push('💡 Suggestions:');
    digest.suggestions.forEach(function (s) { lines.push('  ' + s.icon + ' ' + s.text); });
    return lines.join('\n');
  }

  // ── Public API ────────────────────────────────────────────────────

  var api = {
    gatherDigestData: gatherDigestData,
    generateDigest: generateDigest,
    renderWeeklyDigest: renderWeeklyDigest,
    digestToText: digestToText
  };

  window.CortexFreelancer.weeklyDigest = api;
  window.CortexWeeklyDigest = api;

})();
