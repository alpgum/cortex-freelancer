/**
 * [CF-027] Similar Jobs Recommendation Engine
 *
 * IIFE exposing window.CortexSimilarJobs
 * When viewing a job, suggests 5 similar jobs based on skills, budget range,
 * and category. Works against locally cached job data.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_job_cache';
  var MAX_CACHE = 500;

  // ─── Cache layer ────────────────────────────────────────────────

  function _loadCache() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function _saveCache(jobs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, MAX_CACHE)));
    } catch (e) {
      console.warn('[CF-027] localStorage write failed:', e);
    }
  }

  /**
   * Add jobs to the local cache (deduplicates by id).
   * @param {Object[]} jobs - Array of { id, title, skills[], category, budget, clientCountry, description }
   */
  function cacheJobs(jobs) {
    if (!Array.isArray(jobs)) return;
    var cache = _loadCache();
    var idSet = {};
    cache.forEach(function (j) { idSet[j.id] = true; });

    jobs.forEach(function (j) {
      if (j.id && !idSet[j.id]) {
        cache.push({
          id: j.id,
          title: j.title || '',
          skills: Array.isArray(j.skills) ? j.skills : [],
          category: j.category || '',
          budget: parseFloat(j.budget) || 0,
          clientCountry: j.clientCountry || '',
          description: (j.description || '').slice(0, 200),
          addedAt: new Date().toISOString()
        });
        idSet[j.id] = true;
      }
    });

    _saveCache(cache);
  }

  // ─── Similarity scoring ─────────────────────────────────────────

  function _normalizeSkills(skills) {
    return (skills || []).map(function (s) { return String(s).toLowerCase().trim(); });
  }

  function _skillOverlap(a, b) {
    var setB = {};
    b.forEach(function (s) { setB[s] = true; });
    var overlap = 0;
    a.forEach(function (s) { if (setB[s]) overlap++; });
    var union = new Set(a.concat(b)).size;
    return union > 0 ? overlap / union : 0;
  }

  function _budgetSimilarity(a, b) {
    if (a === 0 || b === 0) return 0.5;
    var ratio = Math.min(a, b) / Math.max(a, b);
    return ratio;
  }

  function _categorySimilarity(a, b) {
    if (!a || !b) return 0.3;
    return a.toLowerCase() === b.toLowerCase() ? 1 : 0;
  }

  function _textTokens(text) {
    if (!text) return [];
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length > 2;
    });
  }

  function _textSimilarity(a, b) {
    var tokensA = _textTokens(a);
    var tokensB = _textTokens(b);
    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    var setB = {};
    tokensB.forEach(function (t) { setB[t] = true; });
    var overlap = 0;
    tokensA.forEach(function (t) { if (setB[t]) overlap++; });
    var union = new Set(tokensA.concat(tokensB)).size;
    return union > 0 ? overlap / union : 0;
  }

  /**
   * Compute similarity score between two jobs.
   * @returns {number} 0-100
   */
  function _computeSimilarity(target, candidate) {
    var skillsA = _normalizeSkills(target.skills);
    var skillsB = _normalizeSkills(candidate.skills);

    var skillScore = _skillOverlap(skillsA, skillsB) * 40;
    var budgetScore = _budgetSimilarity(target.budget, candidate.budget) * 20;
    var categoryScore = _categorySimilarity(target.category, candidate.category) * 20;
    var titleScore = _textSimilarity(target.title, candidate.title) * 10;
    var descScore = _textSimilarity(target.description, candidate.description) * 10;

    return Math.round(skillScore + budgetScore + categoryScore + titleScore + descScore);
  }

  /**
   * Find similar jobs for a given job.
   * @param {Object} job - The reference job { id, skills[], category, budget }
   * @param {number} [limit=5] - Number of results to return
   * @returns {Object[]} Array of { job, similarityScore } sorted by score desc
   */
  function findSimilar(job, limit) {
    if (!job || !job.id) return [];
    limit = limit || 5;

    var cache = _loadCache();
    var scored = [];

    for (var i = 0; i < cache.length; i++) {
      var candidate = cache[i];
      if (candidate.id === job.id) continue;

      var score = _computeSimilarity(job, candidate);
      if (score > 10) {
        scored.push({ job: candidate, similarityScore: score });
      }
    }

    scored.sort(function (a, b) { return b.similarityScore - a.similarityScore; });
    return scored.slice(0, limit);
  }

  /**
   * Find similar jobs by job ID (looks up the job from cache first).
   * @param {string} jobId
   * @param {number} [limit=5]
   * @returns {Object[]}
   */
  function findSimilarById(jobId, limit) {
    var cache = _loadCache();
    var target = null;
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].id === jobId) { target = cache[i]; break; }
    }
    if (!target) return [];
    return findSimilar(target, limit);
  }

  /**
   * Get the current cache size.
   * @returns {number}
   */
  function getCacheSize() {
    return _loadCache().length;
  }

  /**
   * Clear the job cache.
   */
  function clearCache() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get shared skills between two jobs.
   * @param {Object} jobA
   * @param {Object} jobB
   * @returns {string[]}
   */
  function getSharedSkills(jobA, jobB) {
    var a = _normalizeSkills(jobA.skills);
    var b = _normalizeSkills(jobB.skills);
    var setB = {};
    b.forEach(function (s) { setB[s] = true; });
    var shared = [];
    a.forEach(function (s) { if (setB[s]) shared.push(s); });
    return shared;
  }

  // ─── Render ───────────────────────────────────────────────────

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function simColor(score) {
    if (score >= 70) return '#00ff88';
    if (score >= 50) return '#ffaa00';
    if (score >= 30) return '#ff8844';
    return '#ff4444';
  }

  /**
   * Render similar jobs widget for a given job.
   * @param {Object} job - The reference job
   * @param {string|HTMLElement} container
   * @param {object} [options]
   * @param {number} [options.limit] - Number of suggestions (default 5)
   */
  function render(job, container, options) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container || !job) return;
    options = options || {};
    var limit = options.limit || 5;

    var results = findSimilar(job, limit);

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e0e0e0;border-radius:16px;overflow:hidden;border:1px solid #222;max-width:480px;">';

    // Header
    html += '<div style="padding:16px 20px;background:linear-gradient(135deg,#0a0a28,#0a1a0a);border-bottom:1px solid #222;">';
    html += '<h3 style="margin:0 0 4px;font-size:16px;font-weight:700;color:#fff;">Similar Jobs</h3>';
    html += '<p style="margin:0;font-size:12px;color:#666;">Based on skills, budget, category &amp; content</p>';
    html += '</div>';

    if (results.length === 0) {
      html += '<div style="padding:32px 20px;text-align:center;color:#555;font-size:13px;">';
      html += 'No similar jobs found. Cache more jobs to improve recommendations.';
      html += '</div>';
    } else {
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var sc = simColor(r.similarityScore);
        var shared = getSharedSkills(job, r.job);

        html += '<div style="padding:12px 20px;border-bottom:1px solid #111;display:flex;align-items:flex-start;gap:12px;">';

        // Score badge
        html += '<div style="flex-shrink:0;width:38px;height:38px;border-radius:50%;border:2px solid ' + sc + ';' +
          'display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:' + sc + ';">' +
          r.similarityScore + '</div>';

        // Info
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(r.job.title || 'Untitled') + '</div>';

        var meta = [];
        if (r.job.category) meta.push(escHtml(r.job.category));
        if (r.job.budget > 0) meta.push('$' + r.job.budget.toLocaleString());
        if (meta.length > 0) {
          html += '<div style="font-size:11px;color:#666;margin-top:2px;">' + meta.join(' &middot; ') + '</div>';
        }

        // Shared skills
        if (shared.length > 0) {
          html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">';
          for (var j = 0; j < shared.length && j < 4; j++) {
            html += '<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:#7c3aed20;color:#7c3aed;border:1px solid #7c3aed30;">' + escHtml(shared[j]) + '</span>';
          }
          if (shared.length > 4) {
            html += '<span style="font-size:10px;color:#555;">+' + (shared.length - 4) + '</span>';
          }
          html += '</div>';
        }

        html += '</div></div>';
      }
    }

    // Footer
    html += '<div style="padding:10px 20px;text-align:center;font-size:11px;color:#444;">';
    html += getCacheSize() + ' jobs in cache';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexSimilarJobs = {
    cacheJobs: cacheJobs,
    findSimilar: findSimilar,
    findSimilarById: findSimilarById,
    getSharedSkills: getSharedSkills,
    getCacheSize: getCacheSize,
    clearCache: clearCache,
    render: render
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SimilarJobs = {
    cacheJobs: cacheJobs,
    findSimilar: findSimilar,
    findSimilarById: findSimilarById,
    getSharedSkills: getSharedSkills,
    render: render,
    version: '1.1.0',
  };

})();
