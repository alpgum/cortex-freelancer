/* ============================================
   CORTEX FREELANCER — Upwork RSS Feed Module
   cf3-023 | upwork-feed.js
   ============================================
   Lightweight bridge that connects the Upwork
   Integration Core (app/integrations/js/upwork-core.js)
   to the Tools ecosystem. Import this from any tool
   page to access Upwork job data.
   ============================================ */

;(function(global) {
  'use strict';

  const STORAGE_KEY = 'cortex_upwork_jobs';
  const CONFIG_KEY  = 'cortex_upwork_config';
  const SYNC_KEY    = 'cortex_upwork_sync';

  /**
   * Get all cached Upwork jobs
   * @returns {Array} Job objects
   */
  function getJobs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch { return []; }
  }

  /**
   * Get jobs filtered by minimum match score
   * @param {number} minScore - Minimum AI match score (0-100)
   * @returns {Array} Filtered & sorted jobs
   */
  function getMatchedJobs(minScore = 60) {
    return getJobs()
      .filter(j => (j.matchScore || 0) >= minScore)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  }

  /**
   * Get new jobs (not yet viewed)
   * @returns {Array}
   */
  function getNewJobs() {
    return getJobs().filter(j => j.isNew);
  }

  /**
   * Get new job count for badge display
   * @returns {number}
   */
  function getNewJobCount() {
    return getNewJobs().length;
  }

  /**
   * Get the Upwork config
   * @returns {Object}
   */
  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {};
    } catch { return {}; }
  }

  /**
   * Get last sync info
   * @returns {Object} { lastSync, syncCount, errors }
   */
  function getSyncState() {
    try {
      return JSON.parse(localStorage.getItem(SYNC_KEY)) || { lastSync: null, syncCount: 0, errors: [] };
    } catch { return { lastSync: null, syncCount: 0, errors: [] }; }
  }

  /**
   * Check if Upwork integration is configured
   * @returns {boolean}
   */
  function isConfigured() {
    const cfg = getConfig();
    return Array.isArray(cfg.feeds) && cfg.feeds.length > 0;
  }

  /**
   * Get a specific job by ID
   * @param {string} jobId
   * @returns {Object|null}
   */
  function getJob(jobId) {
    return getJobs().find(j => j.id === jobId) || null;
  }

  /**
   * Search jobs by keyword
   * @param {string} query
   * @returns {Array}
   */
  function searchJobs(query) {
    const q = query.toLowerCase();
    return getJobs().filter(j =>
      j.title.toLowerCase().includes(q) ||
      (j.description || '').toLowerCase().includes(q) ||
      (j.skills || []).some(s => (typeof s === 'string' ? s : s.name).toLowerCase().includes(q))
    );
  }

  // ---- Export ----
  global.UpworkFeed = {
    getJobs,
    getMatchedJobs,
    getNewJobs,
    getNewJobCount,
    getConfig,
    getSyncState,
    isConfigured,
    getJob,
    searchJobs,
  };

})(window);
