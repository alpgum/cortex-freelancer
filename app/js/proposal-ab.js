/**
 * Cortex Freelancer — Proposal A/B Testing [CF-033]
 *
 * Create proposal variants per job, track which version gets hired,
 * store variants with metadata, and compare performance metrics.
 */
window.CortexFreelancer = window.CortexFreelancer || {};
window.CortexFreelancer.ProposalAB = (function () {
  'use strict';

  var STORAGE_PREFIX = 'cortex_pab_';
  var INDEX_KEY = 'cortex_pab_index';

  // ── Storage helpers ──────────────────────────────────────────────────

  function loadIndex() {
    try { return JSON.parse(localStorage.getItem(INDEX_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveIndex(ids) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
  }

  function loadJob(jobId) {
    try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + jobId)) || { variants: [] }; }
    catch (e) { return { variants: [] }; }
  }

  function saveJob(jobId, data) {
    localStorage.setItem(STORAGE_PREFIX + jobId, JSON.stringify(data));
    var idx = loadIndex();
    if (idx.indexOf(jobId) === -1) {
      idx.push(jobId);
      saveIndex(idx);
    }
  }

  function generateId() {
    return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  /**
   * Create a new variant for a job.
   *
   * @param {string} jobId
   * @param {Object} opts
   * @param {string} opts.title - Variant label (e.g. "Professional v1").
   * @param {string} opts.text  - Proposal body text.
   * @param {string[]} [opts.tags] - Optional tags for categorisation.
   * @returns {Object} The created variant.
   */
  function createVariant(jobId, opts) {
    if (!jobId || !opts || !opts.text) return { error: 'jobId and opts.text are required.' };
    var data = loadJob(jobId);
    var variant = {
      id: generateId(),
      title: opts.title || 'Variant ' + (data.variants.length + 1),
      text: opts.text,
      tags: opts.tags || [],
      createdAt: new Date().toISOString(),
      metrics: { views: 0, responses: 0, hired: false },
      winner: false
    };
    data.variants.push(variant);
    saveJob(jobId, data);
    return variant;
  }

  function getVariant(jobId, variantId) {
    var data = loadJob(jobId);
    return data.variants.find(function (v) { return v.id === variantId; }) || null;
  }

  function listVariants(jobId) {
    return loadJob(jobId).variants;
  }

  function updateVariant(jobId, variantId, updates) {
    var data = loadJob(jobId);
    var v = data.variants.find(function (v) { return v.id === variantId; });
    if (!v) return null;
    if (updates.title !== undefined) v.title = updates.title;
    if (updates.text !== undefined) v.text = updates.text;
    if (updates.tags !== undefined) v.tags = updates.tags;
    saveJob(jobId, data);
    return v;
  }

  function deleteVariant(jobId, variantId) {
    var data = loadJob(jobId);
    var idx = -1;
    for (var i = 0; i < data.variants.length; i++) {
      if (data.variants[i].id === variantId) { idx = i; break; }
    }
    if (idx === -1) return false;
    data.variants.splice(idx, 1);
    saveJob(jobId, data);
    return true;
  }

  function deleteAllVariants(jobId) {
    saveJob(jobId, { variants: [] });
    return true;
  }

  // ── Metrics tracking ─────────────────────────────────────────────────

  function recordView(jobId, variantId) {
    var data = loadJob(jobId);
    var v = data.variants.find(function (v) { return v.id === variantId; });
    if (!v) return null;
    v.metrics.views++;
    saveJob(jobId, data);
    return v.metrics;
  }

  function recordResponse(jobId, variantId) {
    var data = loadJob(jobId);
    var v = data.variants.find(function (v) { return v.id === variantId; });
    if (!v) return null;
    v.metrics.responses++;
    saveJob(jobId, data);
    return v.metrics;
  }

  function markWinner(jobId, variantId) {
    var data = loadJob(jobId);
    data.variants.forEach(function (v) { v.winner = false; v.metrics.hired = false; });
    var v = data.variants.find(function (v) { return v.id === variantId; });
    if (!v) return null;
    v.winner = true;
    v.metrics.hired = true;
    saveJob(jobId, data);
    return v;
  }

  function clearWinner(jobId) {
    var data = loadJob(jobId);
    data.variants.forEach(function (v) { v.winner = false; v.metrics.hired = false; });
    saveJob(jobId, data);
    return true;
  }

  // ── Comparison & reporting ───────────────────────────────────────────

  /**
   * Compare all variants for a job side-by-side.
   */
  function compareVariants(jobId) {
    var variants = loadJob(jobId).variants;
    if (!variants.length) return { jobId: jobId, variants: [], insights: [] };

    var rows = variants.map(function (v) {
      var responseRate = v.metrics.views > 0
        ? Math.round((v.metrics.responses / v.metrics.views) * 100)
        : 0;
      return {
        id: v.id,
        title: v.title,
        tags: v.tags,
        views: v.metrics.views,
        responses: v.metrics.responses,
        responseRate: responseRate,
        hired: v.metrics.hired,
        winner: v.winner,
        wordCount: v.text.trim().split(/\s+/).length,
        createdAt: v.createdAt
      };
    });

    rows.sort(function (a, b) { return b.responseRate - a.responseRate; });

    var insights = [];
    if (rows.length >= 2) {
      var best = rows[0];
      var worst = rows[rows.length - 1];
      if (best.responseRate > worst.responseRate) {
        insights.push('"' + best.title + '" outperforms "' + worst.title + '" by ' + (best.responseRate - worst.responseRate) + ' percentage points.');
      }
    }
    var winner = rows.find(function (r) { return r.winner; });
    if (winner) {
      insights.push('"' + winner.title + '" was the winning variant (hired).');
    }

    return { jobId: jobId, variants: rows, insights: insights };
  }

  /**
   * Generate an aggregate report across all tracked jobs.
   */
  function generateReport() {
    var jobIds = loadIndex();
    var totalVariants = 0;
    var totalViews = 0;
    var totalResponses = 0;
    var totalHires = 0;
    var tagWins = {};

    jobIds.forEach(function (jid) {
      var variants = loadJob(jid).variants;
      totalVariants += variants.length;
      variants.forEach(function (v) {
        totalViews += v.metrics.views;
        totalResponses += v.metrics.responses;
        if (v.metrics.hired) {
          totalHires++;
          (v.tags || []).forEach(function (t) { tagWins[t] = (tagWins[t] || 0) + 1; });
        }
      });
    });

    return {
      jobs: jobIds.length,
      totalVariants: totalVariants,
      totalViews: totalViews,
      totalResponses: totalResponses,
      totalHires: totalHires,
      overallResponseRate: totalViews > 0 ? Math.round((totalResponses / totalViews) * 100) : 0,
      winningTags: tagWins
    };
  }

  /**
   * List all tracked job IDs.
   */
  function listJobs() {
    return loadIndex();
  }

  // ── Public API ───────────────────────────────────────────────────────

  return {
    createVariant: createVariant,
    getVariant: getVariant,
    listVariants: listVariants,
    updateVariant: updateVariant,
    deleteVariant: deleteVariant,
    deleteAllVariants: deleteAllVariants,
    recordView: recordView,
    recordResponse: recordResponse,
    markWinner: markWinner,
    clearWinner: clearWinner,
    compareVariants: compareVariants,
    generateReport: generateReport,
    listJobs: listJobs
  };
})();
