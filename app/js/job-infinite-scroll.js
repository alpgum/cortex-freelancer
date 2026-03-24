/**
 * [CF-030] Job Feed Infinite Scroll with Lazy Loading
 * Replaces paginated job list with infinite scroll, loading 20 jobs at a time.
 * Hooks into the existing job-search module and job-matches-section container.
 *
 * window.CortexFreelancer.InfiniteScroll
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var BATCH_SIZE = 20;
  var SCROLL_THRESHOLD = 300; // px from bottom to trigger next load
  var STORAGE_KEY = 'cortex_infinite_scroll_prefs';

  /* ── State ─────────────────────────────────────────────── */

  var state = {
    allJobs: [],
    displayed: 0,
    loading: false,
    exhausted: false,
    container: null,
    sentinel: null,
    observer: null
  };

  /* ── Preferences ───────────────────────────────────────── */

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }

  /* ── DOM helpers ───────────────────────────────────────── */

  function createSpinner() {
    var el = document.createElement('div');
    el.className = 'is-spinner';
    el.innerHTML =
      '<div class="is-dots">' +
        '<span></span><span></span><span></span>' +
      '</div>' +
      '<div class="is-spinner-text">Loading more jobs\u2026</div>';
    return el;
  }

  function createSentinel() {
    var el = document.createElement('div');
    el.className = 'is-sentinel';
    el.style.height = '1px';
    return el;
  }

  function createEndMessage(total) {
    var el = document.createElement('div');
    el.className = 'is-end-msg';
    el.textContent = total > 0
      ? 'All ' + total + ' jobs loaded.'
      : 'No jobs found. Try adjusting your filters.';
    return el;
  }

  function injectStyles() {
    if (document.getElementById('is-scroll-styles')) return;
    var style = document.createElement('style');
    style.id = 'is-scroll-styles';
    style.textContent =
      '.is-spinner{text-align:center;padding:24px 0;color:#94a3b8;}' +
      '.is-dots{display:flex;justify-content:center;gap:6px;margin-bottom:8px;}' +
      '.is-dots span{width:8px;height:8px;border-radius:50%;background:#6366f1;animation:is-bounce .6s infinite alternate;}' +
      '.is-dots span:nth-child(2){animation-delay:.2s;}' +
      '.is-dots span:nth-child(3){animation-delay:.4s;}' +
      '@keyframes is-bounce{to{opacity:.3;transform:translateY(-6px);}}' +
      '.is-spinner-text{font-size:13px;}' +
      '.is-sentinel{height:1px;pointer-events:none;}' +
      '.is-end-msg{text-align:center;padding:20px 0;font-size:13px;color:#64748b;}' +
      '.is-batch-fade{animation:is-fade-in .3s ease;}' +
      '@keyframes is-fade-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}' +
      '.is-scroll-top{position:fixed;bottom:24px;right:24px;width:40px;height:40px;' +
        'border-radius:50%;background:#6366f1;color:#fff;border:none;cursor:pointer;' +
        'font-size:18px;display:none;align-items:center;justify-content:center;' +
        'box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:999;transition:opacity .2s;}' +
      '.is-scroll-top.visible{display:flex;}';
    document.head.appendChild(style);
  }

  /* ── Render a batch of job cards ───────────────────────── */

  function renderBatch() {
    if (state.loading || state.exhausted) return;
    state.loading = true;

    var start = state.displayed;
    var end = Math.min(start + BATCH_SIZE, state.allJobs.length);

    if (start >= state.allJobs.length) {
      state.exhausted = true;
      state.loading = false;
      removeSentinel();
      state.container.appendChild(createEndMessage(state.allJobs.length));
      return;
    }

    // Show spinner
    var spinner = createSpinner();
    state.container.appendChild(spinner);

    // Simulate async to allow paint
    setTimeout(function () {
      if (spinner.parentNode) spinner.parentNode.removeChild(spinner);

      var fragment = document.createDocumentFragment();
      for (var i = start; i < end; i++) {
        var card = renderJobCard(state.allJobs[i]);
        if (card) {
          card.classList.add('is-batch-fade');
          fragment.appendChild(card);
        }
      }

      // Insert before sentinel
      if (state.sentinel && state.sentinel.parentNode) {
        state.container.insertBefore(fragment, state.sentinel);
      } else {
        state.container.appendChild(fragment);
      }

      state.displayed = end;
      state.loading = false;

      if (end >= state.allJobs.length) {
        state.exhausted = true;
        removeSentinel();
        state.container.appendChild(createEndMessage(state.allJobs.length));
      }
    }, 80);
  }

  /**
   * Render a single job card. Delegates to JobMatcher or JobSearch if available,
   * otherwise builds a basic card.
   */
  function renderJobCard(job) {
    // Try existing renderers
    if (window.CortexFreelancer && window.CortexFreelancer.JobMatcher &&
        typeof window.CortexFreelancer.JobMatcher.renderCard === 'function') {
      return window.CortexFreelancer.JobMatcher.renderCard(job);
    }

    var div = document.createElement('div');
    div.className = 'jm-card is-job-card';
    div.setAttribute('data-job-id', job.id || job.url || '');

    var title = job.title || 'Untitled Job';
    var budget = job.budget || job.hourlyRange || '';
    var posted = job.postedDate || job.posted || '';
    var skills = (job.skills || []).slice(0, 5);

    var h = '<div class="jm-card-header">';
    if (job.url) {
      h += '<a class="jm-card-title" href="' + escapeHtml(job.url) + '" target="_blank">' + escapeHtml(title) + '</a>';
    } else {
      h += '<div class="jm-card-title">' + escapeHtml(title) + '</div>';
    }
    if (budget) h += '<span class="jm-card-budget">' + escapeHtml(String(budget)) + '</span>';
    h += '</div>';

    if (job.description) {
      var desc = job.description.length > 200
        ? job.description.slice(0, 200) + '\u2026'
        : job.description;
      h += '<div class="jm-card-desc">' + escapeHtml(desc) + '</div>';
    }

    if (skills.length) {
      h += '<div class="jm-card-skills">';
      for (var i = 0; i < skills.length; i++) {
        h += '<span class="jm-skill-tag">' + escapeHtml(skills[i]) + '</span>';
      }
      h += '</div>';
    }

    h += '<div class="jm-card-footer">';
    if (posted) h += '<span class="jm-card-date">' + escapeHtml(posted) + '</span>';
    if (job.url) h += '<a class="jm-apply-link" href="' + escapeHtml(job.url) + '" target="_blank">View Job \u2192</a>';
    h += '</div>';

    div.innerHTML = h;
    return div;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── IntersectionObserver for sentinel ─────────────────── */

  function setupObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: scroll event
      window.addEventListener('scroll', onScrollFallback);
      return;
    }

    state.observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !state.loading && !state.exhausted) {
        renderBatch();
      }
    }, { rootMargin: SCROLL_THRESHOLD + 'px' });

    if (state.sentinel) {
      state.observer.observe(state.sentinel);
    }
  }

  function onScrollFallback() {
    if (state.loading || state.exhausted) return;
    var scrollBottom = window.innerHeight + window.scrollY;
    var docHeight = document.documentElement.scrollHeight;
    if (docHeight - scrollBottom < SCROLL_THRESHOLD) {
      renderBatch();
    }
  }

  function removeSentinel() {
    if (state.observer && state.sentinel) {
      state.observer.unobserve(state.sentinel);
    }
    if (state.sentinel && state.sentinel.parentNode) {
      state.sentinel.parentNode.removeChild(state.sentinel);
    }
  }

  /* ── Scroll-to-top button ──────────────────────────────── */

  function setupScrollTop() {
    var btn = document.createElement('button');
    btn.className = 'is-scroll-top';
    btn.innerHTML = '\u2191';
    btn.title = 'Scroll to top';
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    window.addEventListener('scroll', function () {
      if (window.scrollY > 600) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
  }

  /* ── Public API ────────────────────────────────────────── */

  /**
   * Initialize infinite scroll with a job array and container element.
   * @param {Object[]} jobs - Full array of jobs to paginate through
   * @param {HTMLElement|string} container - Container element or selector
   * @param {Object} [options] - Configuration
   * @param {number} [options.batchSize=20] - Jobs per batch
   * @param {number} [options.threshold=300] - Pixels from bottom to trigger load
   */
  function init(jobs, container, options) {
    injectStyles();

    var el = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!el) {
      console.warn('[InfiniteScroll] Container not found');
      return;
    }

    // Reset state
    destroy();

    var opts = options || {};
    BATCH_SIZE = opts.batchSize || 20;
    SCROLL_THRESHOLD = opts.threshold || 300;

    state.allJobs = jobs || [];
    state.displayed = 0;
    state.loading = false;
    state.exhausted = false;
    state.container = el;

    // Clear existing content
    el.innerHTML = '';

    // Add sentinel at end
    state.sentinel = createSentinel();
    el.appendChild(state.sentinel);

    setupObserver();
    setupScrollTop();

    // Load first batch immediately
    renderBatch();
  }

  /**
   * Append more jobs to the feed (e.g., from a new API page).
   * @param {Object[]} newJobs - Additional jobs to add
   */
  function appendJobs(newJobs) {
    if (!newJobs || !newJobs.length) return;

    state.allJobs = state.allJobs.concat(newJobs);
    state.exhausted = false;

    // Re-add sentinel if it was removed
    if (!state.sentinel || !state.sentinel.parentNode) {
      state.sentinel = createSentinel();
      state.container.appendChild(state.sentinel);
      if (state.observer) state.observer.observe(state.sentinel);
    }

    // Remove end message if present
    var endMsg = state.container.querySelector('.is-end-msg');
    if (endMsg) endMsg.parentNode.removeChild(endMsg);
  }

  /**
   * Reset and reload with new jobs (e.g., after filter change).
   * @param {Object[]} jobs - New complete job array
   */
  function reload(jobs) {
    init(jobs, state.container);
  }

  /**
   * Clean up observers and event listeners.
   */
  function destroy() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    window.removeEventListener('scroll', onScrollFallback);
    state.sentinel = null;
  }

  /**
   * Get current scroll state info.
   * @returns {Object} { displayed, total, exhausted, loading }
   */
  function getStatus() {
    return {
      displayed: state.displayed,
      total: state.allJobs.length,
      exhausted: state.exhausted,
      loading: state.loading
    };
  }

  window.CortexFreelancer.InfiniteScroll = {
    init: init,
    appendJobs: appendJobs,
    reload: reload,
    destroy: destroy,
    getStatus: getStatus,
    BATCH_SIZE: BATCH_SIZE
  };

})();
