/**
 * [CF-030] Job Feed Infinite Scroll with Lazy Loading
 * Replace paginated job list with infinite scroll, loading 20 jobs at a time.
 * Intersection Observer API, loading states, scroll position memory.
 *
 * v2.0.0 — Virtual scroll awareness, filter integration, keyboard navigation,
 *          feed statistics bar, scroll persistence, error retry, empty state.
 *
 * window.CortexFreelancer.JobFeedInfiniteScroll
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var SCROLL_STORAGE_KEY = 'cf_scroll_position';
  var DEFAULT_PAGE_SIZE = 20;
  var OBSERVER_ROOT_MARGIN = '600px';
  var DEBOUNCE_DELAY = 150;
  var SKELETON_COUNT = 6;
  var MAX_RETRIES = 3;
  var RETRY_DELAY = 2000;

  var state = {
    container: null, sentinel: null, observer: null, imageObserver: null,
    visibilityObserver: null,
    fetchFn: null, pageSize: DEFAULT_PAGE_SIZE, currentPage: 0,
    loadedItems: [], loading: false, exhausted: false, errorState: false,
    retryCount: 0, initialized: false, restoringScroll: false,
    filterFn: null, filteredItems: [], focusedIndex: -1,
    statsBar: null, loadStartTime: 0, totalLoadTime: 0,
    visibleJobIds: [], keyboardHandler: null
  };

  var CSS_INJECTED = false;

  // ─── CSS ──────────────────────────────────────────────────────────

  function injectStyles() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.id = 'cf-feed-scroll-styles';
    style.textContent = [
      '.cf-feed-container{position:relative;min-height:200px}',
      '.cf-feed-card{background:#111;border:1px solid #222;border-radius:10px;padding:16px 20px;margin-bottom:12px;transition:background .15s,opacity .3s,transform .3s,border-color .15s;opacity:0;transform:translateY(12px);outline:none}',
      '.cf-feed-card.cf-visible{opacity:1;transform:translateY(0)}',
      '.cf-feed-card:hover{background:#1a1a1a}',
      '.cf-feed-card.cf-feed-card-focused{border-color:#7c3aed;box-shadow:0 0 0 1px #7c3aed}',
      '.cf-feed-card-title{color:#e0e0e0;font-size:15px;font-weight:600;margin:0 0 6px;line-height:1.3}',
      '.cf-feed-card-title a{color:#e0e0e0;text-decoration:none}',
      '.cf-feed-card-title a:hover{color:#7c3aed}',
      '.cf-feed-card-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#888;margin-bottom:8px}',
      '.cf-feed-card-desc{color:#777;font-size:13px;line-height:1.5;margin-top:6px;max-height:60px;overflow:hidden}',
      '.cf-feed-card-skills{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}',
      '.cf-feed-skill-tag{background:#1e1e2e;color:#a78bfa;font-size:11px;padding:2px 8px;border-radius:10px}',
      '.cf-feed-card-footer{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-size:12px}',
      '.cf-feed-apply-link{color:#7c3aed;text-decoration:none;font-weight:600}',
      '.cf-feed-apply-link:hover{color:#6d28d9}',
      '.cf-feed-card img.cf-lazy{opacity:0;transition:opacity .3s}',
      '.cf-feed-card img.cf-lazy-loaded{opacity:1}',
      '.cf-feed-sentinel{height:1px;pointer-events:none}',
      '.cf-feed-skeleton{background:#111;border:1px solid #222;border-radius:10px;padding:16px 20px;margin-bottom:12px}',
      '.cf-feed-skeleton-line{height:14px;border-radius:4px;background:linear-gradient(90deg,#1a1a1a 25%,#252525 50%,#1a1a1a 75%);background-size:200% 100%;animation:cf-shimmer 1.5s infinite}',
      '.cf-feed-skeleton-title{width:70%;height:18px;margin-bottom:10px}',
      '.cf-feed-skeleton-meta{width:50%;margin-bottom:8px}',
      '.cf-feed-skeleton-desc{width:90%;margin-bottom:6px}',
      '.cf-feed-skeleton-desc2{width:75%}',
      '@keyframes cf-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',
      '.cf-feed-spinner{text-align:center;padding:24px 0;color:#94a3b8}',
      '.cf-feed-spinner-dots{display:flex;justify-content:center;gap:6px;margin-bottom:8px}',
      '.cf-feed-spinner-dots span{width:8px;height:8px;border-radius:50%;background:#6366f1;animation:cf-bounce .6s infinite alternate}',
      '.cf-feed-spinner-dots span:nth-child(2){animation-delay:.2s}',
      '.cf-feed-spinner-dots span:nth-child(3){animation-delay:.4s}',
      '@keyframes cf-bounce{to{opacity:.3;transform:translateY(-6px)}}',
      '.cf-feed-end{text-align:center;padding:24px 0;font-size:13px;color:#64748b;border-top:1px solid #222;margin-top:12px}',
      '.cf-feed-error{text-align:center;padding:32px 20px;color:#ef4444;font-size:14px}',
      '.cf-feed-retry-btn{background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer}',
      '.cf-feed-retry-btn:hover{background:#6d28d9}',
      '.cf-feed-empty{text-align:center;padding:40px 20px;color:#555;font-size:14px}',
      '.cf-feed-stats-bar{display:flex;align-items:center;gap:12px;padding:10px 16px;margin-bottom:12px;background:#0d0d0d;border:1px solid #222;border-radius:8px;font-size:12px;color:#94a3b8}',
      '.cf-feed-stats-bar span{white-space:nowrap}',
      '.cf-feed-empty-state{text-align:center;padding:60px 20px}',
      '.cf-feed-empty-state-icon{font-size:48px;color:#333;margin-bottom:16px;line-height:1}',
      '.cf-feed-empty-state-title{color:#888;font-size:16px;font-weight:600;margin-bottom:8px}',
      '.cf-feed-empty-state-desc{color:#555;font-size:13px;line-height:1.5;max-width:320px;margin:0 auto}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '...' : str;
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var ctx = this, args = arguments;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      var diff = Date.now() - new Date(dateStr).getTime();
      if (isNaN(diff) || diff < 0) return '';
      var mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return mins + 'm ago';
      var hours = Math.floor(mins / 60);
      if (hours < 24) return hours + 'h ago';
      var days = Math.floor(hours / 24);
      if (days < 30) return days + 'd ago';
      return Math.floor(days / 30) + 'mo ago';
    } catch (e) { return ''; }
  }

  function getDisplayItems() {
    if (typeof state.filterFn === 'function') {
      return state.loadedItems.filter(state.filterFn);
    }
    return state.loadedItems;
  }

  // ─── Scroll Position Memory ───────────────────────────────────────

  function saveScrollPosition() {
    if (!state.initialized || state.restoringScroll) return;
    try {
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify({
        scrollY: window.scrollY || window.pageYOffset || 0,
        loadedCount: state.loadedItems.length,
        currentPage: state.currentPage,
        timestamp: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function restoreScrollPosition() {
    try {
      var raw = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() - data.timestamp > 30 * 60 * 1000) {
        sessionStorage.removeItem(SCROLL_STORAGE_KEY);
        return null;
      }
      return data;
    } catch (e) { return null; }
  }

  var debouncedSaveScroll = debounce(saveScrollPosition, DEBOUNCE_DELAY);

  // ─── Skeleton Cards ───────────────────────────────────────────────

  function renderSkeletonCards(count) {
    var n = count || SKELETON_COUNT;
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'cf-feed-skeleton';
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = '<div class="cf-feed-skeleton-line cf-feed-skeleton-title"></div>' +
        '<div class="cf-feed-skeleton-line cf-feed-skeleton-meta"></div>' +
        '<div class="cf-feed-skeleton-line cf-feed-skeleton-desc"></div>' +
        '<div class="cf-feed-skeleton-line cf-feed-skeleton-desc2"></div>';
      fragment.appendChild(el);
    }
    return fragment;
  }

  function removeSkeleton() {
    if (!state.container) return;
    var skeletons = state.container.querySelectorAll('.cf-feed-skeleton');
    for (var i = 0; i < skeletons.length; i++) {
      if (skeletons[i].parentNode) skeletons[i].parentNode.removeChild(skeletons[i]);
    }
  }

  // ─── Job Card Rendering ───────────────────────────────────────────

  function renderJobCard(job) {
    var div = document.createElement('div');
    div.className = 'cf-feed-card';
    div.setAttribute('data-job-id', job.id || job.url || '');
    div.setAttribute('tabindex', '0');

    var title = job.title || 'Untitled Job';
    var budget = job.budget || job.hourlyRange || '';
    var budgetType = job.budgetType || '';
    var posted = job.postedDate || job.postedAt || job.posted || '';
    var skills = (job.skills || []).slice(0, 6);
    var description = job.description || '';
    var country = job.country || '';

    var h = '<div class="cf-feed-card-title">';
    if (job.url) h += '<a href="' + escapeHtml(job.url) + '" target="_blank" rel="noopener">' + escapeHtml(title) + '</a>';
    else h += escapeHtml(title);
    h += '</div>';

    h += '<div class="cf-feed-card-meta">';
    if (budget) {
      var budgetStr = '$' + escapeHtml(String(budget));
      if (budgetType === 'hourly') budgetStr += '/hr';
      h += '<span>' + budgetStr + '</span>';
    }
    if (country) h += '<span>' + escapeHtml(country) + '</span>';
    if (posted) { var ago = formatTimeAgo(posted); if (ago) h += '<span>' + escapeHtml(ago) + '</span>'; }
    if (job.proposals != null) h += '<span>' + job.proposals + ' proposals</span>';
    h += '</div>';

    if (job.image || job.thumbnail) {
      h += '<img class="cf-lazy" data-src="' + escapeHtml(job.image || job.thumbnail) + '" alt="" style="max-width:100%;border-radius:6px;margin:8px 0">';
    }

    if (description) h += '<div class="cf-feed-card-desc">' + escapeHtml(truncate(description, 200)) + '</div>';

    if (skills.length) {
      h += '<div class="cf-feed-card-skills">';
      for (var i = 0; i < skills.length; i++) h += '<span class="cf-feed-skill-tag">' + escapeHtml(skills[i]) + '</span>';
      if ((job.skills || []).length > 6) h += '<span class="cf-feed-skill-tag">+' + ((job.skills || []).length - 6) + '</span>';
      h += '</div>';
    }

    h += '<div class="cf-feed-card-footer">';
    if (posted) h += '<span style="color:#555">' + escapeHtml(formatTimeAgo(posted)) + '</span>';
    if (job.url) h += '<a class="cf-feed-apply-link" href="' + escapeHtml(job.url) + '" target="_blank" rel="noopener">View Job &rarr;</a>';
    h += '</div>';

    div.innerHTML = h;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { div.classList.add('cf-visible'); });
    });
    return div;
  }

  // ─── Lazy Image Loading ───────────────────────────────────────────

  function setupImageObserver() {
    if (!('IntersectionObserver' in window)) return;
    if (state.imageObserver) state.imageObserver.disconnect();

    state.imageObserver = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          var img = entries[i].target;
          var src = img.getAttribute('data-src');
          if (src) { img.src = src; img.removeAttribute('data-src'); img.classList.add('cf-lazy-loaded'); }
          state.imageObserver.unobserve(img);
        }
      }
    }, { rootMargin: '200px' });
  }

  function observeNewImages(container) {
    if (!state.imageObserver) return;
    var images = container.querySelectorAll('img.cf-lazy[data-src]');
    for (var i = 0; i < images.length; i++) state.imageObserver.observe(images[i]);
  }

  // ─── Virtual Scroll Awareness ─────────────────────────────────────

  function setupVisibilityObserver() {
    if (!('IntersectionObserver' in window)) return;
    if (state.visibilityObserver) state.visibilityObserver.disconnect();

    state.visibilityObserver = new IntersectionObserver(function (entries) {
      var changed = false;
      for (var i = 0; i < entries.length; i++) {
        var card = entries[i].target;
        var jobId = card.getAttribute('data-job-id');
        if (entries[i].isIntersecting) {
          card.setAttribute('data-visible', 'true');
          if (jobId && state.visibleJobIds.indexOf(jobId) === -1) {
            state.visibleJobIds.push(jobId);
            changed = true;
          }
        } else {
          card.removeAttribute('data-visible');
          if (jobId) {
            var idx = state.visibleJobIds.indexOf(jobId);
            if (idx !== -1) {
              state.visibleJobIds.splice(idx, 1);
              changed = true;
            }
          }
        }
      }
      if (changed) {
        emitVisibleJobs();
      }
    }, { root: null, rootMargin: '0px', threshold: 0.1 });
  }

  function emitVisibleJobs() {
    var ids = state.visibleJobIds.slice();
    var evt;
    try {
      evt = new CustomEvent('cf:feed-visible-jobs', { detail: { visibleJobIds: ids } });
    } catch (e) {
      evt = document.createEvent('CustomEvent');
      evt.initCustomEvent('cf:feed-visible-jobs', true, true, { visibleJobIds: ids });
    }
    document.dispatchEvent(evt);
  }

  function observeCardVisibility(card) {
    if (state.visibilityObserver) {
      state.visibilityObserver.observe(card);
    }
  }

  function observeAllCardVisibility() {
    if (!state.container || !state.visibilityObserver) return;
    var cards = state.container.querySelectorAll('.cf-feed-card');
    for (var i = 0; i < cards.length; i++) {
      state.visibilityObserver.observe(cards[i]);
    }
  }

  // ─── Feed Statistics Bar ──────────────────────────────────────────

  function createStatsBar() {
    if (state.statsBar) return;
    var bar = document.createElement('div');
    bar.className = 'cf-feed-stats-bar';
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<span class="cf-feed-stats-text">Showing 0 of 0 jobs | Loaded in 0ms</span>';
    state.statsBar = bar;
    if (state.container && state.container.firstChild) {
      state.container.insertBefore(bar, state.container.firstChild);
    } else if (state.container) {
      state.container.appendChild(bar);
    }
  }

  function updateStatsBar() {
    if (!state.statsBar) return;
    var displayed = getDisplayItems();
    var total = state.loadedItems.length;
    var showing = displayed.length;
    var loadTime = state.totalLoadTime;
    var text = 'Showing ' + showing + ' of ' + total + ' jobs | Loaded in ' + loadTime + 'ms';
    var span = state.statsBar.querySelector('.cf-feed-stats-text');
    if (span) span.textContent = text;
  }

  // ─── Empty State ──────────────────────────────────────────────────

  function showEmptyState() {
    if (!state.container) return;
    removeEmptyState();
    var el = document.createElement('div');
    el.className = 'cf-feed-empty-state';
    el.innerHTML = '<div class="cf-feed-empty-state-icon">' +
      '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="8" y="12" width="48" height="40" rx="4" stroke="#333" stroke-width="2" fill="none"/>' +
      '<line x1="16" y1="24" x2="48" y2="24" stroke="#333" stroke-width="2"/>' +
      '<line x1="16" y1="32" x2="40" y2="32" stroke="#333" stroke-width="2"/>' +
      '<line x1="16" y1="40" x2="32" y2="40" stroke="#333" stroke-width="2"/>' +
      '<circle cx="48" cy="44" r="10" fill="#111" stroke="#555" stroke-width="2"/>' +
      '<line x1="44" y1="44" x2="52" y2="44" stroke="#555" stroke-width="2"/>' +
      '</svg>' +
      '</div>' +
      '<div class="cf-feed-empty-state-title">No jobs found</div>' +
      '<div class="cf-feed-empty-state-desc">There are no jobs matching your current criteria. Try adjusting your filters or check back later for new postings.</div>';
    if (state.sentinel && state.sentinel.parentNode) {
      state.container.insertBefore(el, state.sentinel);
    } else {
      state.container.appendChild(el);
    }
  }

  function removeEmptyState() {
    if (!state.container) return;
    var els = state.container.querySelectorAll('.cf-feed-empty-state');
    for (var i = 0; i < els.length; i++) {
      if (els[i].parentNode) els[i].parentNode.removeChild(els[i]);
    }
  }

  // ─── Filter Integration ───────────────────────────────────────────

  function setFilter(filterFn) {
    if (filterFn !== null && typeof filterFn !== 'function') {
      console.warn('[CF-030] filterFn must be a function or null');
      return;
    }
    state.filterFn = filterFn;
    rerenderFilteredFeed();
  }

  function rerenderFilteredFeed() {
    if (!state.container) return;

    // Remove existing cards
    var existingCards = state.container.querySelectorAll('.cf-feed-card');
    for (var i = 0; i < existingCards.length; i++) {
      if (state.visibilityObserver) state.visibilityObserver.unobserve(existingCards[i]);
      if (existingCards[i].parentNode) existingCards[i].parentNode.removeChild(existingCards[i]);
    }

    // Remove previous empty/end states
    removeEmptyState();
    var endEls = state.container.querySelectorAll('.cf-feed-end');
    for (var j = 0; j < endEls.length; j++) {
      if (endEls[j].parentNode) endEls[j].parentNode.removeChild(endEls[j]);
    }

    // Reset visibility tracking
    state.visibleJobIds = [];

    // Get filtered items
    var items = getDisplayItems();

    if (items.length === 0 && state.loadedItems.length > 0) {
      showEmptyState();
      updateStatsBar();
      return;
    }

    // Render filtered cards
    var fragment = document.createDocumentFragment();
    for (var k = 0; k < items.length; k++) {
      var card = renderJobCard(items[k]);
      card.classList.add('cf-visible');
      fragment.appendChild(card);
    }

    if (state.sentinel && state.sentinel.parentNode) {
      state.container.insertBefore(fragment, state.sentinel);
    } else {
      state.container.appendChild(fragment);
    }

    observeNewImages(state.container);
    observeAllCardVisibility();
    state.focusedIndex = -1;
    updateStatsBar();
  }

  // ─── Keyboard Navigation ──────────────────────────────────────────

  function getVisibleCards() {
    if (!state.container) return [];
    var nodeList = state.container.querySelectorAll('.cf-feed-card');
    var arr = [];
    for (var i = 0; i < nodeList.length; i++) arr.push(nodeList[i]);
    return arr;
  }

  function setFocusedCard(index) {
    var cards = getVisibleCards();
    if (cards.length === 0) return;

    // Remove existing focus
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('cf-feed-card-focused');
    }

    // Clamp index
    if (index < 0) index = 0;
    if (index >= cards.length) index = cards.length - 1;

    state.focusedIndex = index;
    var card = cards[index];
    card.classList.add('cf-feed-card-focused');
    card.focus();

    // Scroll into view if needed
    if (card.scrollIntoView) {
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function openFocusedCard() {
    var cards = getVisibleCards();
    if (state.focusedIndex < 0 || state.focusedIndex >= cards.length) return;
    var card = cards[state.focusedIndex];
    var link = card.querySelector('.cf-feed-card-title a') || card.querySelector('.cf-feed-apply-link');
    if (link && link.href) {
      window.open(link.href, '_blank', 'noopener');
    }
  }

  function setupKeyboardNavigation() {
    if (state.keyboardHandler) {
      document.removeEventListener('keydown', state.keyboardHandler);
    }

    state.keyboardHandler = function (e) {
      if (!state.container || !state.initialized) return;

      // Skip if user is typing in an input/textarea
      var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.target && e.target.isContentEditable) return;

      var key = e.key || e.keyCode;

      if (key === 'ArrowDown' || key === 40 || key === 'j') {
        e.preventDefault();
        setFocusedCard(state.focusedIndex + 1);
      } else if (key === 'ArrowUp' || key === 38 || key === 'k') {
        e.preventDefault();
        setFocusedCard(state.focusedIndex - 1);
      } else if (key === 'Enter' || key === 13) {
        if (state.focusedIndex >= 0) {
          e.preventDefault();
          openFocusedCard();
        }
      }
    };

    document.addEventListener('keydown', state.keyboardHandler);
  }

  // ─── Loading States ───────────────────────────────────────────────

  function showLoadingState() {
    if (!state.container) return;
    removeLoadingState();
    var wrapper = document.createElement('div');
    wrapper.className = 'cf-feed-loading-wrapper';
    wrapper.appendChild(renderSkeletonCards(SKELETON_COUNT));
    if (state.sentinel && state.sentinel.parentNode) state.container.insertBefore(wrapper, state.sentinel);
    else state.container.appendChild(wrapper);
  }

  function hideLoadingState() { removeLoadingState(); }

  function removeLoadingState() {
    if (!state.container) return;
    var wrappers = state.container.querySelectorAll('.cf-feed-loading-wrapper');
    for (var i = 0; i < wrappers.length; i++) {
      if (wrappers[i].parentNode) wrappers[i].parentNode.removeChild(wrappers[i]);
    }
    removeSkeleton();
  }

  function showEndOfFeed() {
    if (!state.container || state.container.querySelector('.cf-feed-end')) return;
    var el = document.createElement('div');
    el.className = 'cf-feed-end';
    var total = getDisplayItems().length;
    el.textContent = total > 0
      ? 'You\'ve reached the end \u2014 ' + total + ' job' + (total !== 1 ? 's' : '') + ' loaded.'
      : 'No jobs found. Try adjusting your search or filters.';
    state.container.appendChild(el);
  }

  // ─── Error Handling ───────────────────────────────────────────────

  function handleError(error) {
    if (!state.container) return;
    state.errorState = true;
    state.loading = false;
    removeLoadingState();

    var existing = state.container.querySelector('.cf-feed-error');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var el = document.createElement('div');
    el.className = 'cf-feed-error';
    var msg = (error && error.message) ? error.message : 'Failed to load jobs. Please try again.';
    el.innerHTML = '<div style="margin-bottom:12px;">' + escapeHtml(msg) + '</div>' +
      '<button class="cf-feed-retry-btn" data-action="retry">Retry</button>';

    el.querySelector('.cf-feed-retry-btn').addEventListener('click', function () {
      state.errorState = false;
      state.retryCount = 0;
      if (el.parentNode) el.parentNode.removeChild(el);
      loadNextBatch();
    });

    if (state.sentinel && state.sentinel.parentNode) state.container.insertBefore(el, state.sentinel);
    else state.container.appendChild(el);
  }

  // ─── IntersectionObserver ─────────────────────────────────────────

  function setupIntersectionObserver() {
    if (state.observer) { state.observer.disconnect(); state.observer = null; }

    if (!('IntersectionObserver' in window)) {
      window.addEventListener('scroll', onScrollFallback);
      return;
    }

    state.observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting && !state.loading && !state.exhausted && !state.errorState) {
          loadNextBatch();
        }
      }
    }, { root: null, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0 });

    if (state.sentinel) state.observer.observe(state.sentinel);
  }

  var onScrollFallback = debounce(function () {
    if (state.loading || state.exhausted || state.errorState) return;
    var scrollBottom = (window.innerHeight || document.documentElement.clientHeight) +
      (window.scrollY || window.pageYOffset || 0);
    if (document.documentElement.scrollHeight - scrollBottom < 600) loadNextBatch();
  }, DEBOUNCE_DELAY);

  // ─── Data Loading ─────────────────────────────────────────────────

  function loadNextBatch() {
    if (state.loading || state.exhausted || !state.fetchFn) return;
    state.loading = true;
    state.loadStartTime = Date.now();
    showLoadingState();

    try {
      var result = state.fetchFn(state.currentPage, state.pageSize);
      if (result && typeof result.then === 'function') {
        result.then(function (jobs) { onBatchLoaded(jobs); }).catch(function (err) { onBatchError(err); });
      } else if (Array.isArray(result)) {
        onBatchLoaded(result);
      }
    } catch (err) { onBatchError(err); }
  }

  function onBatchLoaded(jobs) {
    state.loading = false;
    state.retryCount = 0;
    state.totalLoadTime += (Date.now() - state.loadStartTime);
    hideLoadingState();

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      state.exhausted = true;
      removeSentinel();
      if (state.loadedItems.length === 0) {
        showEmptyState();
      } else if (getDisplayItems().length === 0) {
        showEmptyState();
      } else {
        showEndOfFeed();
      }
      updateStatsBar();
      return;
    }

    state.loadedItems = state.loadedItems.concat(jobs);
    state.currentPage++;

    // Apply filter if set
    var itemsToRender;
    if (typeof state.filterFn === 'function') {
      itemsToRender = jobs.filter(state.filterFn);
    } else {
      itemsToRender = jobs;
    }

    if (itemsToRender.length > 0) {
      removeEmptyState();
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < itemsToRender.length; i++) {
        var card = renderJobCard(itemsToRender[i]);
        fragment.appendChild(card);
      }

      if (state.sentinel && state.sentinel.parentNode) state.container.insertBefore(fragment, state.sentinel);
      else state.container.appendChild(fragment);

      observeNewImages(state.container);

      // Observe newly added cards for visibility
      var newCards = state.container.querySelectorAll('.cf-feed-card');
      for (var v = 0; v < newCards.length; v++) {
        observeCardVisibility(newCards[v]);
      }
    }

    if (jobs.length < state.pageSize) {
      state.exhausted = true;
      removeSentinel();
      if (getDisplayItems().length === 0) {
        showEmptyState();
      } else {
        showEndOfFeed();
      }
    }

    updateStatsBar();
    saveScrollPosition();
  }

  function onBatchError(err) {
    state.loading = false;
    hideLoadingState();
    state.retryCount++;

    if (state.retryCount <= MAX_RETRIES) {
      setTimeout(function () {
        if (!state.exhausted && !state.errorState) loadNextBatch();
      }, RETRY_DELAY * state.retryCount);
    } else {
      handleError(err);
    }
  }

  function removeSentinel() {
    if (state.observer && state.sentinel) state.observer.unobserve(state.sentinel);
    if (state.sentinel && state.sentinel.parentNode) state.sentinel.parentNode.removeChild(state.sentinel);
  }

  // ─── Public API ───────────────────────────────────────────────────

  function init(config) {
    if (!config) { console.warn('[CF-030] Config required'); return; }
    injectStyles();

    var el = typeof config.container === 'string' ? document.querySelector(config.container) : config.container;
    if (!el) { console.warn('[CF-030] Container not found:', config.container); return; }

    destroy();

    state.container = el;
    state.pageSize = config.pageSize || DEFAULT_PAGE_SIZE;
    state.fetchFn = config.fetchFn || null;
    state.filterFn = config.filterFn || null;
    state.currentPage = 0;
    state.loadedItems = [];
    state.loading = false;
    state.exhausted = false;
    state.errorState = false;
    state.retryCount = 0;
    state.initialized = true;
    state.restoringScroll = false;
    state.focusedIndex = -1;
    state.visibleJobIds = [];
    state.totalLoadTime = 0;
    state.loadStartTime = 0;

    el.innerHTML = '';
    el.classList.add('cf-feed-container');

    // Create stats bar first
    state.statsBar = null;
    createStatsBar();

    state.sentinel = document.createElement('div');
    state.sentinel.className = 'cf-feed-sentinel';
    state.sentinel.setAttribute('aria-hidden', 'true');
    el.appendChild(state.sentinel);

    setupIntersectionObserver();
    setupImageObserver();
    setupVisibilityObserver();
    setupKeyboardNavigation();

    window.addEventListener('scroll', debouncedSaveScroll);
    window.addEventListener('beforeunload', saveScrollPosition);

    var shouldRestore = config.restoreScroll !== false;
    var savedPosition = shouldRestore ? restoreScrollPosition() : null;

    if (savedPosition && savedPosition.loadedCount > 0 && state.fetchFn) {
      state.restoringScroll = true;
      var pagesToLoad = Math.ceil(savedPosition.loadedCount / state.pageSize);
      _restorePages(pagesToLoad, savedPosition.scrollY);
    } else {
      loadNextBatch();
    }
  }

  function _restorePages(totalPages, scrollY) {
    if (state.currentPage >= totalPages) {
      state.restoringScroll = false;
      observeAllCardVisibility();
      updateStatsBar();
      requestAnimationFrame(function () { window.scrollTo(0, scrollY); });
      return;
    }
    if (!state.fetchFn) return;

    state.loadStartTime = Date.now();
    try {
      var result = state.fetchFn(state.currentPage, state.pageSize);
      if (result && typeof result.then === 'function') {
        result.then(function (jobs) { _onRestoreBatch(jobs, totalPages, scrollY); })
          .catch(function () { state.restoringScroll = false; loadNextBatch(); });
      } else if (Array.isArray(result)) {
        _onRestoreBatch(result, totalPages, scrollY);
      }
    } catch (e) { state.restoringScroll = false; loadNextBatch(); }
  }

  function _onRestoreBatch(jobs, totalPages, scrollY) {
    state.totalLoadTime += (Date.now() - state.loadStartTime);

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      state.exhausted = true;
      state.restoringScroll = false;
      removeSentinel();
      if (state.loadedItems.length === 0) {
        showEmptyState();
      } else {
        showEndOfFeed();
      }
      updateStatsBar();
      return;
    }

    state.loadedItems = state.loadedItems.concat(jobs);
    state.currentPage++;

    var itemsToRender;
    if (typeof state.filterFn === 'function') {
      itemsToRender = jobs.filter(state.filterFn);
    } else {
      itemsToRender = jobs;
    }

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < itemsToRender.length; i++) {
      var card = renderJobCard(itemsToRender[i]);
      card.classList.add('cf-visible');
      fragment.appendChild(card);
    }

    if (state.sentinel && state.sentinel.parentNode) state.container.insertBefore(fragment, state.sentinel);
    else state.container.appendChild(fragment);

    observeNewImages(state.container);

    if (jobs.length < state.pageSize) {
      state.exhausted = true;
      state.restoringScroll = false;
      removeSentinel();
      if (getDisplayItems().length === 0) {
        showEmptyState();
      } else {
        showEndOfFeed();
      }
      observeAllCardVisibility();
      updateStatsBar();
      return;
    }

    _restorePages(totalPages, scrollY);
  }

  function setDataSource(fetchFn) {
    if (typeof fetchFn !== 'function') { console.warn('[CF-030] fetchFn must be a function'); return; }
    state.fetchFn = fetchFn;
  }

  function reset() {
    if (!state.container) return;
    state.currentPage = 0;
    state.loadedItems = [];
    state.loading = false;
    state.exhausted = false;
    state.errorState = false;
    state.retryCount = 0;
    state.focusedIndex = -1;
    state.visibleJobIds = [];
    state.totalLoadTime = 0;

    state.container.innerHTML = '';

    // Recreate stats bar
    state.statsBar = null;
    createStatsBar();

    state.sentinel = document.createElement('div');
    state.sentinel.className = 'cf-feed-sentinel';
    state.container.appendChild(state.sentinel);
    setupIntersectionObserver();

    try { sessionStorage.removeItem(SCROLL_STORAGE_KEY); } catch (e) { /* ignore */ }
    loadNextBatch();
  }

  function refresh() {
    if (!state.container || !state.fetchFn) return;
    var currentScrollY = window.scrollY || window.pageYOffset || 0;
    var pagesToReload = state.currentPage || 1;

    state.currentPage = 0;
    state.loadedItems = [];
    state.exhausted = false;
    state.errorState = false;
    state.focusedIndex = -1;
    state.visibleJobIds = [];
    state.totalLoadTime = 0;

    var cards = state.container.querySelectorAll('.cf-feed-card, .cf-feed-end, .cf-feed-error, .cf-feed-empty-state');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].parentNode) cards[i].parentNode.removeChild(cards[i]);
    }

    if (!state.sentinel || !state.sentinel.parentNode) {
      state.sentinel = document.createElement('div');
      state.sentinel.className = 'cf-feed-sentinel';
      state.container.appendChild(state.sentinel);
      if (state.observer) state.observer.observe(state.sentinel);
    }

    state.restoringScroll = true;
    _restorePages(pagesToReload, currentScrollY);
  }

  function getLoadedCount() { return state.loadedItems.length; }

  function destroy() {
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    if (state.imageObserver) { state.imageObserver.disconnect(); state.imageObserver = null; }
    if (state.visibilityObserver) { state.visibilityObserver.disconnect(); state.visibilityObserver = null; }
    if (state.keyboardHandler) { document.removeEventListener('keydown', state.keyboardHandler); state.keyboardHandler = null; }
    window.removeEventListener('scroll', debouncedSaveScroll);
    window.removeEventListener('scroll', onScrollFallback);
    window.removeEventListener('beforeunload', saveScrollPosition);
    state.sentinel = null;
    state.container = null;
    state.statsBar = null;
    state.loadedItems = [];
    state.currentPage = 0;
    state.loading = false;
    state.exhausted = false;
    state.errorState = false;
    state.initialized = false;
    state.filterFn = null;
    state.focusedIndex = -1;
    state.visibleJobIds = [];
    state.totalLoadTime = 0;
  }

  // ─── Export ───────────────────────────────────────────────────────

  /**
   * Convenience render method — initializes the feed into a container with a demo data source.
   * @param {HTMLElement|string} container - DOM element or selector
   */
  function render(container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    init({ container: el });
  }

  CF.JobFeedInfiniteScroll = {
    init: init,
    render: render,
    setupIntersectionObserver: setupIntersectionObserver,
    loadNextBatch: loadNextBatch,
    renderJobCard: renderJobCard,
    showLoadingState: showLoadingState,
    hideLoadingState: hideLoadingState,
    showEndOfFeed: showEndOfFeed,
    saveScrollPosition: saveScrollPosition,
    restoreScrollPosition: restoreScrollPosition,
    reset: reset,
    refresh: refresh,
    getLoadedCount: getLoadedCount,
    setDataSource: setDataSource,
    setFilter: setFilter,
    renderSkeletonCards: renderSkeletonCards,
    handleError: handleError,
    destroy: destroy,
    version: '2.0.0'
  };

})();
