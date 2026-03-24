/**
 * [CF-030] Job Feed Infinite Scroll
 * Replace paginated job list with infinite scroll using IntersectionObserver.
 * Loads 20 jobs at a time with loading spinner and debounced scroll.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_job_feed';
  var CSS_ID = 'cf-jfs-styles';
  var PAGE_SIZE = 20;
  var _container = null;
  var _injected = false;
  var _observer = null;
  var _loading = false;
  var _page = 0;
  var _hasMore = true;
  var _jobProvider = null;
  var _debounceTimer = null;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function debounce(fn, delay) {
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function defaultJobProvider(page, pageSize, callback) {
    // Default mock provider — generates sample jobs
    var jobs = [];
    var start = page * pageSize;
    var total = 100;
    if (start >= total) { callback([], false); return; }
    var count = Math.min(pageSize, total - start);
    var categories = ['Web Development', 'Mobile Apps', 'Data Science', 'UI/UX Design', 'DevOps', 'Blockchain'];
    var skills = ['React', 'Node.js', 'Python', 'TypeScript', 'AWS', 'Docker', 'Figma', 'PostgreSQL'];
    for (var i = 0; i < count; i++) {
      var idx = start + i;
      jobs.push({
        id: 'job_' + idx,
        title: 'Project #' + (idx + 1) + ' — ' + categories[idx % categories.length],
        client: 'Client ' + String.fromCharCode(65 + (idx % 26)),
        category: categories[idx % categories.length],
        budget: '$' + ((idx + 1) * 50 + 500),
        skills: [skills[idx % skills.length], skills[(idx + 3) % skills.length]],
        posted: new Date(Date.now() - idx * 3600000).toLocaleDateString(),
        description: 'Looking for an experienced freelancer to help with ' + categories[idx % categories.length].toLowerCase() + ' tasks.'
      });
    }
    setTimeout(function () { callback(jobs, start + count < total); }, 300);
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.jfs-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.jfs-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e);display:flex;align-items:center;justify-content:space-between}',
      '.jfs-title{font-size:16px;font-weight:700}',
      '.jfs-count{font-size:12px;color:var(--text-muted,#888)}',
      '.jfs-list{max-height:600px;overflow-y:auto;padding:0}',
      '.jfs-job{padding:14px 20px;border-bottom:1px solid var(--border,#1e1e1e);cursor:pointer;transition:background .15s}',
      '.jfs-job:hover{background:var(--bg-secondary,#111)}',
      '.jfs-job-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
      '.jfs-job-title{font-size:14px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.jfs-job-budget{font-size:13px;font-weight:700;color:#22c55e;margin-left:12px;white-space:nowrap}',
      '.jfs-job-meta{display:flex;gap:12px;font-size:12px;color:var(--text-muted,#888);margin-bottom:6px}',
      '.jfs-job-desc{font-size:12px;color:var(--text-muted,#888);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.jfs-job-skills{display:flex;gap:4px;margin-top:6px;flex-wrap:wrap}',
      '.jfs-skill{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:4px;padding:2px 8px;font-size:11px;color:var(--text-secondary,#ccc)}',
      '.jfs-sentinel{height:1px}',
      '.jfs-spinner{display:flex;align-items:center;justify-content:center;padding:20px;gap:8px}',
      '.jfs-spinner-dot{width:8px;height:8px;border-radius:50%;background:#7c3aed;animation:jfs-pulse 1.2s infinite}',
      '.jfs-spinner-dot:nth-child(2){animation-delay:.2s}',
      '.jfs-spinner-dot:nth-child(3){animation-delay:.4s}',
      '@keyframes jfs-pulse{0%,80%,100%{opacity:.3;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}',
      '.jfs-end{text-align:center;padding:16px;font-size:12px;color:var(--text-muted,#888)}',
      '.jfs-empty{text-align:center;padding:40px 20px;color:var(--text-muted,#888);font-size:13px}',
      '@media(max-width:600px){.jfs-job-top{flex-direction:column;align-items:flex-start;gap:4px}.jfs-job-budget{margin-left:0}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;
    _page = 0;
    _hasMore = true;
    _loading = false;

    var h = '<div class="jfs-panel">';
    h += '<div class="jfs-header"><span class="jfs-title">Job Feed</span><span class="jfs-count" id="jfs-count"></span></div>';
    h += '<div class="jfs-list" id="jfs-list">';
    h += '<div id="jfs-items"></div>';
    h += '<div class="jfs-spinner" id="jfs-spinner" style="display:none"><div class="jfs-spinner-dot"></div><div class="jfs-spinner-dot"></div><div class="jfs-spinner-dot"></div></div>';
    h += '<div class="jfs-sentinel" id="jfs-sentinel"></div>';
    h += '<div class="jfs-end" id="jfs-end" style="display:none">All jobs loaded</div>';
    h += '</div></div>';
    el.innerHTML = h;

    setupObserver(el);
    loadMore(el);
  }

  function setupObserver(el) {
    if (_observer) _observer.disconnect();
    var sentinel = el.querySelector('#jfs-sentinel');
    var list = el.querySelector('#jfs-list');
    if (!sentinel || !list) return;

    var loadDebounced = debounce(function () { loadMore(el); }, 150);

    _observer = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !_loading && _hasMore) {
        loadDebounced();
      }
    }, { root: list, rootMargin: '200px' });

    _observer.observe(sentinel);
  }

  function loadMore(el) {
    if (_loading || !_hasMore) return;
    _loading = true;

    var spinner = el.querySelector('#jfs-spinner');
    if (spinner) spinner.style.display = '';

    var provider = _jobProvider || defaultJobProvider;
    provider(_page, PAGE_SIZE, function (jobs, hasMore) {
      _loading = false;
      _hasMore = hasMore;
      _page++;

      var spinner = el.querySelector('#jfs-spinner');
      if (spinner) spinner.style.display = 'none';

      var items = el.querySelector('#jfs-items');
      if (!items) return;

      if (jobs.length === 0 && _page === 1) {
        items.innerHTML = '<div class="jfs-empty">No jobs found. Check back later.</div>';
        return;
      }

      var h = '';
      jobs.forEach(function (job) {
        h += '<div class="jfs-job" data-job-id="' + esc(job.id) + '">';
        h += '<div class="jfs-job-top"><span class="jfs-job-title">' + esc(job.title) + '</span>';
        h += '<span class="jfs-job-budget">' + esc(job.budget) + '</span></div>';
        h += '<div class="jfs-job-meta"><span>' + esc(job.client) + '</span><span>' + esc(job.category) + '</span><span>' + esc(job.posted) + '</span></div>';
        h += '<div class="jfs-job-desc">' + esc(job.description) + '</div>';
        if (job.skills && job.skills.length) {
          h += '<div class="jfs-job-skills">';
          job.skills.forEach(function (sk) { h += '<span class="jfs-skill">' + esc(sk) + '</span>'; });
          h += '</div>';
        }
        h += '</div>';
      });
      items.insertAdjacentHTML('beforeend', h);

      // Update count
      var countEl = el.querySelector('#jfs-count');
      if (countEl) countEl.textContent = items.children.length + ' jobs loaded';

      // End message
      if (!hasMore) {
        var endEl = el.querySelector('#jfs-end');
        if (endEl) endEl.style.display = '';
      }
    });
  }

  function setJobProvider(fn) {
    _jobProvider = fn;
  }

  function init(containerId) {
    if (containerId) render(containerId);
  }

  function destroy() {
    if (_observer) { _observer.disconnect(); _observer = null; }
    if (_container) { _container.innerHTML = ''; _container = null; }
    var s = document.getElementById(CSS_ID);
    if (s) s.parentNode.removeChild(s);
    clearTimeout(_debounceTimer);
    _injected = false;
    _loading = false;
    _page = 0;
    _hasMore = true;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.JobFeedScroll = {
    init: init,
    render: render,
    destroy: destroy,
    setJobProvider: setJobProvider,
    loadMore: function () { if (_container) loadMore(_container); }
  };
})();
