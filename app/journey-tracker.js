/* ===== [252] JOURNEY TRACKER — Log page sequence per session ===== */
(function() {
  'use strict';

  var JOURNEY_KEY = 'cortex_journey';
  var MAX_PAGES = 50;

  function getSessionId() {
    var sid = sessionStorage.getItem('cortex_session_id');
    if (!sid) {
      sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      sessionStorage.setItem('cortex_session_id', sid);
    }
    return sid;
  }

  function getJourney() {
    try {
      var data = JSON.parse(sessionStorage.getItem(JOURNEY_KEY) || '{}');
      if (data.sessionId !== getSessionId()) return { sessionId: getSessionId(), pages: [], startedAt: new Date().toISOString() };
      return data;
    } catch (e) {
      return { sessionId: getSessionId(), pages: [], startedAt: new Date().toISOString() };
    }
  }

  function saveJourney(journey) {
    try { sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(journey)); } catch (e) { /* ignore */ }
  }

  function persistToLocalStorage(journey) {
    try {
      var journeys = JSON.parse(localStorage.getItem('cortex_journeys') || '[]');
      // Keep last 20 sessions
      var exists = journeys.findIndex(function(j) { return j.sessionId === journey.sessionId; });
      if (exists >= 0) {
        journeys[exists] = journey;
      } else {
        journeys.push(journey);
      }
      if (journeys.length > 20) journeys = journeys.slice(-20);
      localStorage.setItem('cortex_journeys', JSON.stringify(journeys));
    } catch (e) { /* quota */ }
  }

  function logPage() {
    var journey = getJourney();
    var page = {
      path: window.location.pathname,
      hash: window.location.hash || null,
      referrer: document.referrer || null,
      timestamp: new Date().toISOString(),
      title: document.title.substring(0, 100)
    };

    // Avoid duplicate consecutive entries
    var last = journey.pages[journey.pages.length - 1];
    if (last && last.path === page.path && last.hash === page.hash) return;

    journey.pages.push(page);
    if (journey.pages.length > MAX_PAGES) journey.pages = journey.pages.slice(-MAX_PAGES);

    journey.lastPageAt = page.timestamp;
    journey.pageCount = journey.pages.length;
    saveJourney(journey);
    persistToLocalStorage(journey);
  }

  // Log current page
  logPage();

  // Track SPA-style navigation (hash changes, popstate)
  window.addEventListener('hashchange', logPage);
  window.addEventListener('popstate', logPage);

  // Report journey to GA4 on exit
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      var journey = getJourney();
      if (journey.pages.length >= 2 && typeof window.gtag === 'function') {
        window.gtag('event', 'user_journey', {
          session_id: journey.sessionId,
          page_count: journey.pageCount,
          pages: journey.pages.map(function(p) { return p.path; }).join(' > ').substring(0, 500),
          duration_sec: Math.round((Date.now() - new Date(journey.startedAt).getTime()) / 1000)
        });
      }
    }
  });

  // Expose for debugging
  window.CortexJourney = {
    getCurrent: getJourney,
    getAll: function() {
      try { return JSON.parse(localStorage.getItem('cortex_journeys') || '[]'); }
      catch (e) { return []; }
    },
    clear: function() {
      sessionStorage.removeItem(JOURNEY_KEY);
      localStorage.removeItem('cortex_journeys');
    }
  };
})();
