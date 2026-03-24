/**
 * [CF-025] Job Digest Generator
 * Generates daily/weekly job digest HTML summaries from saved searches.
 * Integrates with JobSearch, JobScorer, JobMatcher, and SavedSearches.
 * Exposed as window.CortexFreelancer.JobDigest
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_job_digest_history';
  var MAX_HISTORY = 30;

  /* ───────── Helpers ───────── */

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function formatDate(date) {
    var d = date instanceof Date ? date : new Date(date);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function daysSince(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return (Date.now() - d.getTime()) / 86400000;
  }

  function timeAgo(dateStr) {
    var days = daysSince(dateStr);
    if (days === null) return '';
    if (days < 1) return 'today';
    if (days < 2) return 'yesterday';
    if (days < 7) return Math.floor(days) + 'd ago';
    return formatDate(dateStr);
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function budgetLabel(job) {
    var b = parseFloat(job.budget) || 0;
    if (b <= 0) return 'Budget TBD';
    var type = (job.budgetType || '').toLowerCase();
    if (type === 'hourly') return '$' + b + '/hr';
    if (type === 'fixed') return '$' + b.toLocaleString() + ' fixed';
    return '$' + b.toLocaleString();
  }

  function scoreColor(score) {
    if (score >= 8) return '#00ff88';
    if (score >= 6) return '#ffaa00';
    if (score >= 4) return '#ff8844';
    return '#ff4444';
  }

  function matchColor(pct) {
    if (pct >= 80) return '#00ff88';
    if (pct >= 60) return '#ffaa00';
    if (pct >= 40) return '#ff8844';
    return '#ff4444';
  }

  /* ───────── Digest generation ───────── */

  /**
   * Generate a job digest from saved searches.
   * @param {object} options
   * @param {string} [options.period] - 'daily' or 'weekly'
   * @param {object} [options.profile] - User profile for match calculation
   * @param {object[]} [options.jobs] - Custom job list (defaults to mock data)
   * @param {number} [options.maxJobs] - Max jobs per search (default 10)
   * @param {number} [options.minScore] - Minimum job score threshold (default 0)
   * @returns {{html: string, summary: object, sections: object[], generatedAt: string}}
   */
  function generateDigest(options) {
    options = options || {};
    var period = options.period || 'daily';
    var profile = options.profile || {};
    var maxJobs = options.maxJobs || 10;
    var minScore = options.minScore || 0;
    var now = new Date();

    // Get saved searches
    var savedSearches = [];
    if (window.CortexSavedSearches && typeof window.CortexSavedSearches.getSavedSearches === 'function') {
      savedSearches = window.CortexSavedSearches.getSavedSearches();
    }

    // Get all jobs
    var allJobs = options.jobs || [];
    if (allJobs.length === 0 && window.CortexFreelancer.JobSearch) {
      allJobs = window.CortexFreelancer.JobSearch.getMockJobs();
    }

    // Filter by period
    var periodDays = period === 'weekly' ? 7 : 1;
    var recentJobs = allJobs.filter(function (job) {
      var age = daysSince(job.postedAt || job.createdAt);
      return age !== null && age <= periodDays;
    });

    // Build sections from saved searches
    var sections = [];
    var allMatchedJobs = [];

    if (savedSearches.length > 0) {
      savedSearches.forEach(function (search) {
        var matchedJobs = _runSearch(recentJobs, search, profile, maxJobs, minScore);
        if (matchedJobs.length > 0) {
          sections.push({
            name: search.name,
            keywords: search.keywords || '',
            category: search.category || '',
            jobs: matchedJobs,
          });
          allMatchedJobs = allMatchedJobs.concat(matchedJobs);
        }
      });
    }

    // If no saved searches or no results, create a "Top Jobs" section
    if (sections.length === 0) {
      var topJobs = _scoreAndSort(recentJobs, profile).slice(0, maxJobs);
      if (topJobs.length > 0) {
        sections.push({
          name: 'Top Jobs For You',
          keywords: '',
          category: '',
          jobs: topJobs,
        });
        allMatchedJobs = topJobs;
      }
    }

    // Summary stats
    var summary = {
      period: period,
      totalNewJobs: recentJobs.length,
      matchedJobs: allMatchedJobs.length,
      savedSearchCount: savedSearches.length,
      avgScore: 0,
      topCategories: _topCategories(allMatchedJobs),
      generatedAt: now.toISOString(),
    };

    if (allMatchedJobs.length > 0) {
      var totalScore = 0;
      allMatchedJobs.forEach(function (j) { totalScore += (j._digestScore || 5); });
      summary.avgScore = Math.round((totalScore / allMatchedJobs.length) * 10) / 10;
    }

    // Build HTML
    var html = _buildDigestHTML(sections, summary, period);

    // Save to history
    _saveToHistory({
      period: period,
      generatedAt: now.toISOString(),
      matchedCount: allMatchedJobs.length,
      totalNew: recentJobs.length,
      sectionCount: sections.length,
    });

    return {
      html: html,
      summary: summary,
      sections: sections,
      generatedAt: now.toISOString(),
    };
  }

  /* ───────── Search runner ───────── */

  function _runSearch(jobs, search, profile, maxJobs, minScore) {
    var keyword = (search.keywords || '').toLowerCase();
    var category = (search.category || '').toLowerCase();
    var minBudget = parseFloat(search.minBudget) || 0;
    var maxBudget = parseFloat(search.maxBudget) || 0;

    var keywords = keyword ? keyword.split(/[\s,]+/).filter(Boolean) : [];

    var results = [];

    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];

      // Category filter
      if (category && (job.category || '').toLowerCase() !== category) continue;

      // Budget filter
      var budget = parseFloat(job.budget) || 0;
      if (minBudget > 0 && budget > 0 && budget < minBudget) continue;
      if (maxBudget > 0 && budget > 0 && budget > maxBudget) continue;

      // Keyword match
      if (keywords.length > 0) {
        var text = ((job.title || '') + ' ' + (job.description || '') + ' ' + (job.skills || []).join(' ')).toLowerCase();
        var matched = keywords.some(function (kw) { return text.indexOf(kw) !== -1; });
        if (!matched) continue;
      }

      results.push(job);
    }

    // Score and sort
    results = _scoreAndSort(results, profile);

    // Filter by minimum score
    if (minScore > 0) {
      results = results.filter(function (j) { return (j._digestScore || 0) >= minScore; });
    }

    return results.slice(0, maxJobs);
  }

  function _scoreAndSort(jobs, profile) {
    var scored = jobs.map(function (job) {
      var copy = Object.assign({}, job);

      // Get job quality score
      var qualityScore = 5;
      if (window.CortexFreelancer.JobScorer) {
        var result = window.CortexFreelancer.JobScorer.scoreJob(job);
        qualityScore = result.score;
      }

      // Get match percentage
      var matchPct = 50;
      if (window.CortexFreelancer.JobMatcher && profile && profile.skills) {
        var match = window.CortexFreelancer.JobMatcher.calculateJobMatch(job, profile);
        matchPct = match.matchPercent;
      }

      copy._digestScore = qualityScore;
      copy._matchPct = matchPct;
      copy._compositeScore = (qualityScore * 0.4) + (matchPct / 10 * 0.6);

      return copy;
    });

    scored.sort(function (a, b) {
      return b._compositeScore - a._compositeScore;
    });

    return scored;
  }

  function _topCategories(jobs) {
    var counts = {};
    jobs.forEach(function (j) {
      var cat = j.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    var sorted = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    return sorted.slice(0, 5).map(function (cat) {
      return { category: cat, count: counts[cat] };
    });
  }

  /* ───────── HTML builder ───────── */

  function _buildDigestHTML(sections, summary, period) {
    var h = '';

    // Header
    h += '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;'
      + 'max-width:680px;margin:0 auto;background:#0a0a0a;color:#e0e0e0;border-radius:16px;overflow:hidden;border:1px solid #222;">';

    // Banner
    var periodLabel = period === 'weekly' ? 'Weekly' : 'Daily';
    h += '<div style="padding:24px 28px;background:linear-gradient(135deg,#1a0533,#0a0a2e);border-bottom:1px solid #222;">';
    h += '<h1 style="margin:0 0 6px;font-size:22px;font-weight:800;color:#fff;">&#x1F4E8; ' + periodLabel + ' Job Digest</h1>';
    h += '<p style="margin:0;font-size:13px;color:#888;">' + formatDate(new Date()) + '</p>';
    h += '</div>';

    // Stats bar
    h += '<div style="display:flex;gap:0;border-bottom:1px solid #222;">';
    h += _statBlock(summary.totalNewJobs, 'New Jobs');
    h += _statBlock(summary.matchedJobs, 'Matches');
    h += _statBlock(summary.savedSearchCount, 'Searches');
    h += _statBlock(summary.avgScore, 'Avg Score');
    h += '</div>';

    // Sections
    if (sections.length === 0) {
      h += '<div style="padding:40px 28px;text-align:center;color:#666;font-size:14px;">';
      h += 'No new jobs found for this period. Try broadening your saved searches.';
      h += '</div>';
    } else {
      for (var s = 0; s < sections.length; s++) {
        var section = sections[s];
        h += '<div style="padding:20px 28px;border-bottom:1px solid #1a1a1a;">';
        h += '<h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:#fff;">' + escHtml(section.name) + '</h2>';
        if (section.keywords || section.category) {
          var meta = [];
          if (section.keywords) meta.push(escHtml(section.keywords));
          if (section.category) meta.push(escHtml(section.category.replace(/-/g, ' ')));
          h += '<p style="margin:0 0 14px;font-size:12px;color:#666;">' + meta.join(' &middot; ') + '</p>';
        }

        for (var j = 0; j < section.jobs.length; j++) {
          h += _buildJobCard(section.jobs[j]);
        }

        h += '</div>';
      }
    }

    // Footer
    h += '<div style="padding:16px 28px;text-align:center;font-size:11px;color:#555;">';
    h += 'Generated by Cortex Freelancer &middot; ' + formatDate(new Date());
    h += '</div>';

    h += '</div>';
    return h;
  }

  function _statBlock(value, label) {
    return '<div style="flex:1;padding:14px 16px;text-align:center;border-right:1px solid #1a1a1a;">'
      + '<div style="font-size:20px;font-weight:800;color:#7c3aed;">' + value + '</div>'
      + '<div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>'
      + '</div>';
  }

  function _buildJobCard(job) {
    var score = job._digestScore || 5;
    var matchPct = job._matchPct || 50;
    var sc = scoreColor(score);
    var mc = matchColor(matchPct);

    var h = '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #111;">';

    // Score circle
    h += '<div style="flex-shrink:0;width:42px;height:42px;border-radius:50%;'
      + 'border:2px solid ' + sc + ';display:flex;align-items:center;justify-content:center;'
      + 'font-size:14px;font-weight:800;color:' + sc + ';">' + score + '</div>';

    // Content
    h += '<div style="flex:1;min-width:0;">';
    h += '<div style="font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'
      + escHtml(job.title || 'Untitled') + '</div>';

    // Meta row
    h += '<div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;align-items:center;">';
    h += '<span style="font-size:12px;font-weight:600;color:#7c3aed;">' + budgetLabel(job) + '</span>';
    h += '<span style="font-size:11px;color:#666;">' + timeAgo(job.postedAt) + '</span>';
    if (job.proposalCount != null) {
      h += '<span style="font-size:11px;color:#666;">' + job.proposalCount + ' proposals</span>';
    }
    h += '<span style="font-size:11px;font-weight:600;color:' + mc + ';">' + matchPct + '% match</span>';
    h += '</div>';

    // Skills (first 5)
    if (job.skills && job.skills.length > 0) {
      h += '<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">';
      var profileSkills = [];
      if (window.CortexFreelancer.JobMatcher && job._matchPct !== undefined) {
        // Highlight will be handled by color
      }
      job.skills.slice(0, 5).forEach(function (skill) {
        h += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;'
          + 'background:#1a1a1a;color:#999;border:1px solid #222;">' + escHtml(skill) + '</span>';
      });
      if (job.skills.length > 5) {
        h += '<span style="font-size:10px;color:#555;">+' + (job.skills.length - 5) + '</span>';
      }
      h += '</div>';
    }

    h += '</div>'; // content
    h += '</div>'; // card

    return h;
  }

  /* ───────── History ───────── */

  function _saveToHistory(entry) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var history = raw ? JSON.parse(raw) : [];
      history.unshift(entry);
      if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) {}
  }

  function getDigestHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  /**
   * Render digest into a DOM container.
   * @param {object} options - Same as generateDigest options
   * @param {string|HTMLElement} container - CSS selector or DOM element
   */
  function renderDigest(options, container) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }
    if (!container) return null;

    var result = generateDigest(options);
    container.innerHTML = result.html;
    return result;
  }

  /* ───────── Email scheduling ───────── */

  var SCHEDULE_KEY = 'cortex_digest_schedule';
  var _scheduledTimer = null;

  /**
   * Schedule automatic digest generation and email sending.
   * @param {object} config
   * @param {string} config.frequency - 'daily' or 'weekly'
   * @param {string} [config.email] - Recipient email address
   * @param {string} [config.time] - Preferred send time in HH:MM format (default '09:00')
   * @param {string} [config.day] - Day of week for weekly (default 'monday')
   * @param {object} [config.profile] - User profile for match calculation
   * @param {number} [config.minScore] - Minimum job score threshold
   * @param {function} [config.onGenerate] - Callback when digest is generated
   */
  function scheduleDigest(config) {
    if (!config) return;

    var schedule = {
      frequency: config.frequency || 'daily',
      email: config.email || '',
      time: config.time || '09:00',
      day: (config.day || 'monday').toLowerCase(),
      minScore: config.minScore || 0,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
    } catch (e) {}

    _startScheduleTimer(schedule, config.profile, config.onGenerate);
    return schedule;
  }

  function _startScheduleTimer(schedule, profile, onGenerate) {
    if (_scheduledTimer) clearInterval(_scheduledTimer);

    // Check every minute if it's time to send
    _scheduledTimer = setInterval(function () {
      if (!schedule.enabled) return;

      var now = new Date();
      var timeParts = schedule.time.split(':');
      var targetHour = parseInt(timeParts[0], 10) || 9;
      var targetMin = parseInt(timeParts[1], 10) || 0;

      if (now.getHours() !== targetHour || now.getMinutes() !== targetMin) return;

      if (schedule.frequency === 'weekly') {
        var days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        if (days[now.getDay()] !== schedule.day) return;
      }

      // Check if already sent today
      var history = getDigestHistory();
      if (history.length > 0) {
        var lastDate = new Date(history[0].generatedAt).toDateString();
        if (lastDate === now.toDateString()) return;
      }

      var result = generateDigest({
        period: schedule.frequency === 'weekly' ? 'weekly' : 'daily',
        profile: profile,
        minScore: schedule.minScore,
      });

      if (schedule.email) {
        sendDigestEmail(schedule.email, result);
      }

      if (typeof onGenerate === 'function') {
        onGenerate(result);
      }
    }, 60000);
  }

  /**
   * Send digest via email (posts to /api/send-digest endpoint).
   * @param {string} email - Recipient email
   * @param {object} digestResult - Result from generateDigest()
   * @returns {Promise}
   */
  function sendDigestEmail(email, digestResult) {
    if (!email || !digestResult) return Promise.resolve({ ok: false, error: 'Missing email or digest' });

    var payload = {
      to: email,
      subject: (digestResult.summary.period === 'weekly' ? 'Weekly' : 'Daily') +
        ' Job Digest — ' + digestResult.summary.matchedJobs + ' matches',
      html: digestResult.html,
      summary: digestResult.summary,
    };

    return fetch('/api/send-digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _saveToHistory({
        period: digestResult.summary.period,
        generatedAt: digestResult.generatedAt,
        matchedCount: digestResult.summary.matchedJobs,
        totalNew: digestResult.summary.totalNewJobs,
        sectionCount: digestResult.sections.length,
        emailSent: true,
        emailTo: email,
      });
      return data;
    })
    .catch(function (err) {
      console.warn('[CF-025] Email send failed:', err);
      return { ok: false, error: err.message };
    });
  }

  /**
   * Get the current schedule configuration.
   * @returns {object|null}
   */
  function getSchedule() {
    try {
      var raw = localStorage.getItem(SCHEDULE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /**
   * Cancel the scheduled digest.
   */
  function cancelSchedule() {
    if (_scheduledTimer) {
      clearInterval(_scheduledTimer);
      _scheduledTimer = null;
    }
    try {
      localStorage.removeItem(SCHEDULE_KEY);
    } catch (e) {}
  }

  /**
   * Generate an email-ready plain text version of the digest.
   * @param {object} digestResult - Result from generateDigest()
   * @returns {string}
   */
  function getPlainTextDigest(digestResult) {
    if (!digestResult || !digestResult.sections) return '';

    var lines = [];
    var s = digestResult.summary;
    lines.push((s.period === 'weekly' ? 'WEEKLY' : 'DAILY') + ' JOB DIGEST');
    lines.push('Generated: ' + formatDate(new Date()));
    lines.push('');
    lines.push('New jobs: ' + s.totalNewJobs + ' | Matches: ' + s.matchedJobs + ' | Avg score: ' + s.avgScore);
    lines.push('---');

    for (var i = 0; i < digestResult.sections.length; i++) {
      var section = digestResult.sections[i];
      lines.push('');
      lines.push('## ' + section.name);
      if (section.keywords) lines.push('Keywords: ' + section.keywords);
      lines.push('');

      for (var j = 0; j < section.jobs.length; j++) {
        var job = section.jobs[j];
        lines.push('  ' + (j + 1) + '. ' + (job.title || 'Untitled'));
        lines.push('     Score: ' + (job._digestScore || '-') + '/10 | Match: ' + (job._matchPct || '-') + '%');
        if (job.budget) lines.push('     Budget: ' + budgetLabel(job));
        if (job.skills && job.skills.length > 0) lines.push('     Skills: ' + job.skills.slice(0, 5).join(', '));
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('Cortex Freelancer - Job Digest');
    return lines.join('\n');
  }

  /* ───────── Public API ───────── */

  window.CortexFreelancer.JobDigest = {
    generateDigest: generateDigest,
    renderDigest: renderDigest,
    getDigestHistory: getDigestHistory,
    scheduleDigest: scheduleDigest,
    sendDigestEmail: sendDigestEmail,
    getSchedule: getSchedule,
    cancelSchedule: cancelSchedule,
    getPlainTextDigest: getPlainTextDigest,
    version: '1.1.0',
  };

})();
