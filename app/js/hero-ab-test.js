/**
 * [CF-226] Landing Page Hero Section A/B Test
 * Test two hero variants and track impressions, clicks, conversions.
 * Exposed as window.CortexFreelancer.HeroABTest
 */
(function () {
  'use strict';

  var STORAGE_VARIANT_KEY = 'cortex_hero_ab_variant';
  var STORAGE_EVENTS_KEY = 'cortex_hero_ab_events';
  var FIRESTORE_COLLECTION = 'hero_ab_events';
  var TEST_ID = 'hero_v1';

  // ─── Variant Definitions ───────────────────────────────────────────

  var VARIANTS = {
    A: {
      id: 'A',
      headline: 'AI-Powered Upwork Assistant',
      subtext: 'Optimize your profile, craft winning proposals, and land more contracts with intelligent automation built for Upwork freelancers.',
      cta: 'Start Winning Jobs',
      ctaAction: 'signup'
    },
    B: {
      id: 'B',
      headline: 'Win More Freelance Clients',
      subtext: 'Stand out from the competition with data-driven insights, smart proposal tools, and real-time job matching that puts you ahead.',
      cta: 'Grow Your Business',
      ctaAction: 'signup'
    }
  };

  // ─── State ─────────────────────────────────────────────────────────

  var state = {
    container: null,
    variant: null,
    initialized: false,
    observers: [],
    boundHandlers: {}
  };

  // ─── Styles ────────────────────────────────────────────────────────

  var STYLES = '\
    .hero-ab-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }\
    .hero-ab-section { position: relative; overflow: hidden; background: linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%); padding: 80px 24px 96px; text-align: center; }\
    .hero-ab-section::before { content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(ellipse at 30% 20%, rgba(0,212,170,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(116,185,255,0.06) 0%, transparent 60%); pointer-events: none; }\
    .hero-ab-inner { position: relative; max-width: 720px; margin: 0 auto; z-index: 1; }\
    .hero-ab-badge { display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #00d4aa; background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.2); border-radius: 20px; padding: 6px 16px; margin-bottom: 24px; }\
    .hero-ab-headline { font-size: 48px; font-weight: 800; line-height: 1.15; color: #ffffff; margin: 0 0 20px; letter-spacing: -0.5px; }\
    .hero-ab-subtext { font-size: 18px; line-height: 1.6; color: #a0a0b8; margin: 0 auto 36px; max-width: 560px; }\
    .hero-ab-cta { display: inline-block; padding: 16px 36px; font-size: 16px; font-weight: 700; color: #0f0c29; background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%); border: none; border-radius: 8px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; text-decoration: none; }\
    .hero-ab-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,212,170,0.3); }\
    .hero-ab-cta:active { transform: translateY(0); }\
    .hero-ab-trust { margin-top: 32px; font-size: 13px; color: #666; }\
    .hero-ab-trust span { color: #00d4aa; font-weight: 600; }\
    \
    .hero-ab-debug { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #1a1a2e; color: #e0e0e0; border-radius: 12px; padding: 24px; max-width: 640px; }\
    .hero-ab-debug-title { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 4px; }\
    .hero-ab-debug-sub { font-size: 13px; color: #888; margin: 0 0 20px; }\
    .hero-ab-debug-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }\
    .hero-ab-debug-card { background: #16213e; border-radius: 10px; padding: 16px; border: 1px solid #2d2d44; }\
    .hero-ab-debug-card.active { border-color: #00d4aa; }\
    .hero-ab-debug-variant-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 8px; }\
    .hero-ab-debug-variant-label .tag { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: rgba(0,212,170,0.15); color: #00d4aa; margin-left: 6px; vertical-align: middle; }\
    .hero-ab-debug-headline { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 12px; }\
    .hero-ab-debug-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }\
    .hero-ab-debug-stat { background: #1a1a2e; border-radius: 6px; padding: 10px; text-align: center; }\
    .hero-ab-debug-stat-val { font-size: 22px; font-weight: 700; color: #fff; }\
    .hero-ab-debug-stat-lbl { font-size: 11px; color: #888; margin-top: 2px; }\
    .hero-ab-debug-rates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }\
    .hero-ab-debug-rate { background: #1a1a2e; border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: center; font-size: 13px; }\
    .hero-ab-debug-rate-label { color: #888; }\
    .hero-ab-debug-rate-value { font-weight: 600; color: #00d4aa; }\
    .hero-ab-debug-bar { height: 6px; background: #2d2d44; border-radius: 3px; overflow: hidden; margin-top: 10px; }\
    .hero-ab-debug-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }\
    .hero-ab-debug-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }\
    .hero-ab-debug-btn { padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s; }\
    .hero-ab-debug-btn-primary { background: #00d4aa; color: #1a1a2e; }\
    .hero-ab-debug-btn-primary:hover { background: #00b894; }\
    .hero-ab-debug-btn-secondary { background: #2d2d44; color: #e0e0e0; }\
    .hero-ab-debug-btn-secondary:hover { background: #3d3d54; }\
    .hero-ab-debug-btn-danger { background: rgba(255,107,107,0.1); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.25); }\
    .hero-ab-debug-btn-danger:hover { background: rgba(255,107,107,0.2); }\
    @media (max-width: 600px) {\
      .hero-ab-headline { font-size: 32px; }\
      .hero-ab-subtext { font-size: 16px; }\
      .hero-ab-section { padding: 56px 16px 64px; }\
      .hero-ab-debug-grid { grid-template-columns: 1fr; }\
    }\
  ';

  var cssInjected = false;

  function injectCSS() {
    if (cssInjected) return;
    var style = document.createElement('style');
    style.setAttribute('data-hero-ab-test', 'true');
    style.textContent = STYLES;
    document.head.appendChild(style);
    cssInjected = true;
  }

  // ─── Persistence ───────────────────────────────────────────────────

  function loadVariantAssignment() {
    try {
      var stored = localStorage.getItem(STORAGE_VARIANT_KEY);
      if (stored && VARIANTS[stored]) {
        return stored;
      }
    } catch (e) { /* private browsing */ }
    return null;
  }

  function saveVariantAssignment(variantId) {
    try {
      localStorage.setItem(STORAGE_VARIANT_KEY, variantId);
    } catch (e) { /* private browsing */ }
  }

  function loadEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_EVENTS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveEvents(events) {
    try {
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
    } catch (e) { /* quota exceeded or private browsing */ }
  }

  // ─── Variant Assignment ────────────────────────────────────────────

  function assignVariant() {
    var existing = loadVariantAssignment();
    if (existing) {
      state.variant = existing;
      return existing;
    }
    var chosen = Math.random() < 0.5 ? 'A' : 'B';
    saveVariantAssignment(chosen);
    state.variant = chosen;
    return chosen;
  }

  function getVariant() {
    return state.variant || loadVariantAssignment();
  }

  // ─── Firestore Integration ─────────────────────────────────────────

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function persistEventToFirestore(event) {
    var db = getFirestore();
    if (!db) return;
    try {
      db.collection(FIRESTORE_COLLECTION).add(event);
    } catch (e) {
      // Firestore not available, local storage is the fallback
    }
  }

  // ─── Event Tracking ────────────────────────────────────────────────

  /**
   * Track an A/B test event.
   * @param {string} eventType - 'impression' | 'click' | 'conversion'
   * @param {object} [meta] - Optional extra metadata
   */
  function trackEvent(eventType, meta) {
    var variant = getVariant();
    if (!variant) return;

    var event = {
      testId: TEST_ID,
      variant: variant,
      eventType: eventType,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      meta: meta || null
    };

    var events = loadEvents();
    events.push(event);
    saveEvents(events);
    persistEventToFirestore(event);

    return event;
  }

  // ─── Results / Analytics ───────────────────────────────────────────

  function getResults() {
    var events = loadEvents();
    var results = {
      testId: TEST_ID,
      variants: {}
    };

    ['A', 'B'].forEach(function (v) {
      var variantEvents = events.filter(function (e) {
        return e.testId === TEST_ID && e.variant === v;
      });
      var impressions = variantEvents.filter(function (e) { return e.eventType === 'impression'; }).length;
      var clicks = variantEvents.filter(function (e) { return e.eventType === 'click'; }).length;
      var conversions = variantEvents.filter(function (e) { return e.eventType === 'conversion'; }).length;

      results.variants[v] = {
        headline: VARIANTS[v].headline,
        impressions: impressions,
        clicks: clicks,
        conversions: conversions,
        clickRate: impressions > 0 ? (clicks / impressions * 100) : 0,
        conversionRate: impressions > 0 ? (conversions / impressions * 100) : 0
      };
    });

    return results;
  }

  // ─── Intersection Observer for Impression Tracking ─────────────────

  function observeHeroImpression(heroEl) {
    if (!('IntersectionObserver' in window)) {
      trackEvent('impression');
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          trackEvent('impression');
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(heroEl);
    state.observers.push(observer);
  }

  // ─── Hero Rendering ────────────────────────────────────────────────

  function renderHero(container) {
    if (!container) return;
    injectCSS();

    var variant = getVariant();
    if (!variant) {
      assignVariant();
      variant = getVariant();
    }
    var v = VARIANTS[variant];

    var section = document.createElement('section');
    section.className = 'hero-ab-section';
    section.setAttribute('data-ab-variant', variant);

    section.innerHTML = '\
      <div class="hero-ab-inner">\
        <div class="hero-ab-badge">Cortex Freelancer</div>\
        <h1 class="hero-ab-headline">' + escapeHtml(v.headline) + '</h1>\
        <p class="hero-ab-subtext">' + escapeHtml(v.subtext) + '</p>\
        <button class="hero-ab-cta" data-ab-cta="true">' + escapeHtml(v.cta) + '</button>\
        <div class="hero-ab-trust">Trusted by <span>2,500+</span> Upwork freelancers</div>\
      </div>\
    ';

    container.innerHTML = '';
    container.appendChild(section);

    // Track CTA clicks
    var ctaBtn = section.querySelector('[data-ab-cta]');
    var clickHandler = function () {
      trackEvent('click', { cta: v.cta });
    };
    ctaBtn.addEventListener('click', clickHandler);
    state.boundHandlers.ctaClick = { el: ctaBtn, handler: clickHandler };

    // Observe for impression
    observeHeroImpression(section);

    state.container = container;
  }

  // ─── Debug / Admin View ────────────────────────────────────────────

  function renderDebugView(container) {
    if (!container) return;
    injectCSS();

    var results = getResults();
    var current = getVariant();

    var html = '<div class="hero-ab-debug">';
    html += '<div class="hero-ab-debug-title">Hero A/B Test Results</div>';
    html += '<div class="hero-ab-debug-sub">Test ID: ' + TEST_ID + ' &middot; Your variant: ' + (current || 'unassigned') + '</div>';

    html += '<div class="hero-ab-debug-grid">';

    ['A', 'B'].forEach(function (v) {
      var data = results.variants[v];
      var isActive = current === v;
      var totalImpressions = results.variants.A.impressions + results.variants.B.impressions;
      var trafficShare = totalImpressions > 0 ? (data.impressions / totalImpressions * 100) : 0;

      html += '<div class="hero-ab-debug-card' + (isActive ? ' active' : '') + '">';
      html += '<div class="hero-ab-debug-variant-label">Variant ' + v;
      if (isActive) html += '<span class="tag">Active</span>';
      html += '</div>';
      html += '<div class="hero-ab-debug-headline">' + escapeHtml(VARIANTS[v].headline) + '</div>';

      html += '<div class="hero-ab-debug-stats">';
      html += renderDebugStat(data.impressions, 'Impressions');
      html += renderDebugStat(data.clicks, 'Clicks');
      html += renderDebugStat(data.conversions, 'Conversions');
      html += '</div>';

      html += '<div class="hero-ab-debug-rates">';
      html += '<div class="hero-ab-debug-rate"><span class="hero-ab-debug-rate-label">Click rate</span><span class="hero-ab-debug-rate-value">' + data.clickRate.toFixed(1) + '%</span></div>';
      html += '<div class="hero-ab-debug-rate"><span class="hero-ab-debug-rate-label">Conv. rate</span><span class="hero-ab-debug-rate-value">' + data.conversionRate.toFixed(1) + '%</span></div>';
      html += '</div>';

      html += '<div class="hero-ab-debug-bar"><div class="hero-ab-debug-bar-fill" style="width:' + trafficShare.toFixed(0) + '%;background:#00d4aa;"></div></div>';

      html += '</div>';
    });

    html += '</div>'; // grid

    html += '<div class="hero-ab-debug-actions">';
    html += '<button class="hero-ab-debug-btn hero-ab-debug-btn-secondary" data-debug-action="refresh">Refresh</button>';
    html += '<button class="hero-ab-debug-btn hero-ab-debug-btn-secondary" data-debug-action="switch">Switch Variant</button>';
    html += '<button class="hero-ab-debug-btn hero-ab-debug-btn-danger" data-debug-action="reset">Reset All Data</button>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    // Bind debug actions
    container.querySelector('[data-debug-action="refresh"]').addEventListener('click', function () {
      renderDebugView(container);
    });
    container.querySelector('[data-debug-action="switch"]').addEventListener('click', function () {
      var next = getVariant() === 'A' ? 'B' : 'A';
      saveVariantAssignment(next);
      state.variant = next;
      renderDebugView(container);
    });
    container.querySelector('[data-debug-action="reset"]').addEventListener('click', function () {
      try {
        localStorage.removeItem(STORAGE_VARIANT_KEY);
        localStorage.removeItem(STORAGE_EVENTS_KEY);
      } catch (e) { /* ignore */ }
      state.variant = null;
      renderDebugView(container);
    });
  }

  function renderDebugStat(value, label) {
    return '<div class="hero-ab-debug-stat">' +
      '<div class="hero-ab-debug-stat-val">' + value + '</div>' +
      '<div class="hero-ab-debug-stat-lbl">' + label + '</div>' +
      '</div>';
  }

  // ─── Utilities ─────────────────────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────

  function init(options) {
    if (state.initialized) return;
    options = options || {};

    assignVariant();
    state.initialized = true;

    if (options.heroContainer) {
      renderHero(
        typeof options.heroContainer === 'string'
          ? document.querySelector(options.heroContainer)
          : options.heroContainer
      );
    }

    if (options.debugContainer) {
      renderDebugView(
        typeof options.debugContainer === 'string'
          ? document.querySelector(options.debugContainer)
          : options.debugContainer
      );
    }
  }

  function destroy() {
    // Disconnect observers
    state.observers.forEach(function (obs) {
      obs.disconnect();
    });
    state.observers = [];

    // Remove event listeners
    if (state.boundHandlers.ctaClick) {
      state.boundHandlers.ctaClick.el.removeEventListener('click', state.boundHandlers.ctaClick.handler);
      state.boundHandlers.ctaClick = null;
    }

    // Clear container
    if (state.container) {
      state.container.innerHTML = '';
      state.container = null;
    }

    state.initialized = false;
    state.variant = null;
  }

  // ─── Public API ────────────────────────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.HeroABTest = {
    init: init,
    destroy: destroy,
    assignVariant: assignVariant,
    getVariant: getVariant,
    trackEvent: trackEvent,
    getResults: getResults,
    renderHero: renderHero,
    renderDebugView: renderDebugView
  };
})();
