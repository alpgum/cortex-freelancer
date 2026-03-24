/**
 * [CF-024] Competition Tracker
 *
 * IIFE exposing window.CortexCompetitionTracker
 * Tracks proposal count per job over time, shows competition density.
 * Persists data in localStorage.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_competition_tracker';
  var MAX_JOBS = 200;

  // ─── Storage ────────────────────────────────────────────────────

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CF-024] localStorage write failed:', e);
    }
  }

  // ─── Core ───────────────────────────────────────────────────────

  /**
   * Record a proposal count snapshot for a job.
   * @param {string} jobId - Unique job identifier
   * @param {number} proposalCount - Current number of proposals on the job
   * @param {Object} [meta] - Optional metadata: { title, category, budget }
   */
  function recordSnapshot(jobId, proposalCount, meta) {
    if (!jobId) return;
    var data = _load();

    if (!data[jobId]) {
      // Prune oldest if at capacity
      var keys = Object.keys(data);
      if (keys.length >= MAX_JOBS) {
        var oldest = keys.sort(function (a, b) {
          var aFirst = data[a].snapshots[0] ? data[a].snapshots[0].ts : '';
          var bFirst = data[b].snapshots[0] ? data[b].snapshots[0].ts : '';
          return aFirst.localeCompare(bFirst);
        })[0];
        delete data[oldest];
      }
      data[jobId] = {
        title: (meta && meta.title) || '',
        category: (meta && meta.category) || '',
        budget: (meta && meta.budget) || 0,
        snapshots: []
      };
    }

    data[jobId].snapshots.push({
      count: parseInt(proposalCount) || 0,
      ts: new Date().toISOString()
    });

    // Update meta if provided
    if (meta) {
      if (meta.title) data[jobId].title = meta.title;
      if (meta.category) data[jobId].category = meta.category;
      if (meta.budget) data[jobId].budget = meta.budget;
    }

    _save(data);
  }

  /**
   * Get competition data for a specific job.
   * @param {string} jobId
   * @returns {Object|null} { title, category, budget, snapshots[], density, velocityPerHour }
   */
  function getJobCompetition(jobId) {
    var data = _load();
    var job = data[jobId];
    if (!job) return null;

    var snaps = job.snapshots || [];
    var latest = snaps.length > 0 ? snaps[snaps.length - 1].count : 0;

    // Calculate density label
    var density;
    if (latest >= 50) density = 'very-high';
    else if (latest >= 20) density = 'high';
    else if (latest >= 10) density = 'medium';
    else if (latest >= 5) density = 'low';
    else density = 'very-low';

    // Calculate velocity (proposals per hour between first and last snapshot)
    var velocityPerHour = 0;
    if (snaps.length >= 2) {
      var first = snaps[0];
      var last = snaps[snaps.length - 1];
      var hoursDiff = (new Date(last.ts) - new Date(first.ts)) / 3600000;
      if (hoursDiff > 0) {
        velocityPerHour = Math.round(((last.count - first.count) / hoursDiff) * 10) / 10;
      }
    }

    return {
      title: job.title,
      category: job.category,
      budget: job.budget,
      snapshots: snaps,
      currentCount: latest,
      density: density,
      velocityPerHour: velocityPerHour
    };
  }

  /**
   * Get all tracked jobs sorted by latest proposal count desc.
   * @returns {Object[]} Array of { jobId, title, category, budget, currentCount, density }
   */
  function getAllTracked() {
    var data = _load();
    var results = [];
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      var jobId = keys[i];
      var job = data[jobId];
      var snaps = job.snapshots || [];
      var latest = snaps.length > 0 ? snaps[snaps.length - 1].count : 0;

      var density;
      if (latest >= 50) density = 'very-high';
      else if (latest >= 20) density = 'high';
      else if (latest >= 10) density = 'medium';
      else if (latest >= 5) density = 'low';
      else density = 'very-low';

      results.push({
        jobId: jobId,
        title: job.title,
        category: job.category,
        budget: job.budget,
        currentCount: latest,
        density: density,
        snapshotCount: snaps.length
      });
    }
    results.sort(function (a, b) { return b.currentCount - a.currentCount; });
    return results;
  }

  /**
   * Get competition density stats across all tracked jobs.
   * @returns {Object} { avgProposals, medianProposals, densityBreakdown }
   */
  function getDensityStats() {
    var all = getAllTracked();
    if (all.length === 0) {
      return { avgProposals: 0, medianProposals: 0, densityBreakdown: {} };
    }

    var counts = all.map(function (j) { return j.currentCount; }).sort(function (a, b) { return a - b; });
    var sum = counts.reduce(function (a, b) { return a + b; }, 0);
    var avg = Math.round(sum / counts.length);
    var median = counts[Math.floor(counts.length / 2)];

    var breakdown = { 'very-low': 0, 'low': 0, 'medium': 0, 'high': 0, 'very-high': 0 };
    all.forEach(function (j) { breakdown[j.density] = (breakdown[j.density] || 0) + 1; });

    return {
      avgProposals: avg,
      medianProposals: median,
      densityBreakdown: breakdown,
      totalTracked: all.length
    };
  }

  /**
   * Remove a tracked job.
   * @param {string} jobId
   */
  function removeJob(jobId) {
    var data = _load();
    delete data[jobId];
    _save(data);
  }

  /**
   * Clear all tracked data.
   */
  function clearAll() {
    _save({});
  }

  /**
   * Get optimal application timing advice based on velocity patterns.
   * @param {string} jobId
   * @returns {Object|null} { advice, urgency ('low'|'medium'|'high'|'critical'), estimatedIn24h }
   */
  function getTimingAdvice(jobId) {
    var comp = getJobCompetition(jobId);
    if (!comp) return null;

    var velocity = comp.velocityPerHour;
    var current = comp.currentCount;
    var estimatedIn24h = current + Math.round(velocity * 24);

    var urgency, advice;
    if (velocity > 5) {
      urgency = 'critical';
      advice = 'This job is receiving proposals very rapidly (' + velocity + '/hr). Apply immediately if interested.';
    } else if (velocity > 2) {
      urgency = 'high';
      advice = 'Competition is building quickly. Apply within the next few hours for best chances.';
    } else if (velocity > 0.5) {
      urgency = 'medium';
      advice = 'Steady flow of proposals. Take time to write a strong proposal but don\'t wait too long.';
    } else {
      urgency = 'low';
      advice = 'Low competition velocity. You have time to craft a detailed, personalized proposal.';
    }

    if (current >= 50) {
      advice += ' Note: This job already has ' + current + '+ proposals — consider if the effort is worth it.';
    }

    return {
      advice: advice,
      urgency: urgency,
      currentCount: current,
      velocityPerHour: velocity,
      estimatedIn24h: estimatedIn24h,
      density: comp.density
    };
  }

  /**
   * Get competition trends — categories with highest avg competition.
   * @returns {Object[]} Sorted by avg proposals desc.
   */
  function getCategoryCompetition() {
    var all = getAllTracked();
    var catMap = {};
    for (var i = 0; i < all.length; i++) {
      var cat = all[i].category || 'uncategorized';
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
      catMap[cat].total += all[i].currentCount;
      catMap[cat].count++;
    }

    var results = [];
    var cats = Object.keys(catMap);
    for (var j = 0; j < cats.length; j++) {
      results.push({
        category: cats[j],
        avgProposals: Math.round(catMap[cats[j]].total / catMap[cats[j]].count),
        jobCount: catMap[cats[j]].count
      });
    }
    results.sort(function (a, b) { return b.avgProposals - a.avgProposals; });
    return results;
  }

  // ─── Render ───────────────────────────────────────────────────

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function densityColor(density) {
    if (density === 'very-high') return '#ff4444';
    if (density === 'high') return '#ff8844';
    if (density === 'medium') return '#ffaa00';
    if (density === 'low') return '#00ff88';
    return '#00ddff';
  }

  function urgencyColor(urgency) {
    if (urgency === 'critical') return '#ff4444';
    if (urgency === 'high') return '#ff8844';
    if (urgency === 'medium') return '#ffaa00';
    return '#00ff88';
  }

  /**
   * Render competition tracker dashboard.
   * @param {string|HTMLElement} container
   */
  function render(container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;

    var all = getAllTracked();
    var stats = getDensityStats();

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e0e0e0;border-radius:16px;overflow:hidden;border:1px solid #222;">';

    // Header
    html += '<div style="padding:20px 24px;background:linear-gradient(135deg,#1a0a0a,#0a0a2e);border-bottom:1px solid #222;">';
    html += '<h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#fff;">Competition Tracker</h2>';
    html += '<p style="margin:0;font-size:13px;color:#666;">Tracking ' + stats.totalTracked + ' jobs &middot; ' + stats.avgProposals + ' avg proposals</p>';
    html += '</div>';

    // Density breakdown
    if (stats.totalTracked > 0) {
      html += '<div style="display:flex;border-bottom:1px solid #222;">';
      var levels = ['very-low', 'low', 'medium', 'high', 'very-high'];
      var levelLabels = { 'very-low': 'Very Low', 'low': 'Low', 'medium': 'Medium', 'high': 'High', 'very-high': 'Very High' };
      for (var d = 0; d < levels.length; d++) {
        var count = (stats.densityBreakdown[levels[d]] || 0);
        html += '<div style="flex:1;padding:10px 8px;text-align:center;border-right:1px solid #1a1a1a;">' +
          '<div style="font-size:18px;font-weight:800;color:' + densityColor(levels[d]) + ';">' + count + '</div>' +
          '<div style="font-size:10px;color:#666;text-transform:uppercase;">' + levelLabels[levels[d]] + '</div></div>';
      }
      html += '</div>';
    }

    // Job list
    if (all.length === 0) {
      html += '<div style="padding:40px 24px;text-align:center;color:#555;font-size:14px;">';
      html += 'No jobs tracked yet. Use <code>recordSnapshot(jobId, count)</code> to start tracking.';
      html += '</div>';
    } else {
      for (var i = 0; i < all.length; i++) {
        var job = all[i];
        var timing = getTimingAdvice(job.jobId);
        var dc = densityColor(job.density);

        html += '<div style="padding:14px 24px;border-bottom:1px solid #111;display:flex;align-items:center;gap:14px;flex-wrap:wrap;">';

        // Count badge
        html += '<div style="flex-shrink:0;width:44px;height:44px;border-radius:50%;border:2px solid ' + dc + ';' +
          'display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:' + dc + ';">' +
          job.currentCount + '</div>';

        // Info
        html += '<div style="flex:1;min-width:180px;">';
        html += '<div style="font-size:14px;font-weight:600;color:#fff;">' + escHtml(job.title || job.jobId) + '</div>';
        var meta = [];
        if (job.category) meta.push(escHtml(job.category));
        if (job.budget) meta.push('$' + job.budget.toLocaleString());
        meta.push(job.snapshotCount + ' snapshots');
        html += '<div style="font-size:12px;color:#666;margin-top:2px;">' + meta.join(' &middot; ') + '</div>';

        // Timing advice
        if (timing) {
          html += '<div style="font-size:11px;color:' + urgencyColor(timing.urgency) + ';margin-top:3px;">';
          html += '&#9679; ' + timing.urgency.toUpperCase() + ' &mdash; est. ' + timing.estimatedIn24h + ' proposals in 24h';
          html += '</div>';
        }
        html += '</div>';

        // Density label
        html += '<div style="text-align:right;">';
        html += '<span style="font-size:11px;padding:3px 10px;border-radius:10px;background:' + dc + '22;color:' + dc + ';font-weight:600;text-transform:uppercase;">' + job.density + '</span>';
        html += '</div>';

        html += '</div>';
      }
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexCompetitionTracker = {
    recordSnapshot: recordSnapshot,
    getJobCompetition: getJobCompetition,
    getAllTracked: getAllTracked,
    getDensityStats: getDensityStats,
    getTimingAdvice: getTimingAdvice,
    getCategoryCompetition: getCategoryCompetition,
    removeJob: removeJob,
    clearAll: clearAll,
    render: render
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.CompetitionTracker = {
    recordSnapshot: recordSnapshot,
    getJobCompetition: getJobCompetition,
    getAllTracked: getAllTracked,
    getDensityStats: getDensityStats,
    getTimingAdvice: getTimingAdvice,
    getCategoryCompetition: getCategoryCompetition,
    render: render,
    version: '1.1.0',
  };

})();
