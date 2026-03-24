/**
 * CF-236: Meta Tags and Open Graph for All Pages
 *
 * Dynamically sets og:title, og:description, og:image, twitter:card
 * for landing, tools, and pricing pages based on current route.
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var BASE_URL = window.location.origin;
  var DEFAULT_IMAGE = BASE_URL + '/assets/og-default.png';

  var PAGE_META = {
    '/': {
      title: 'Cortex Freelancer — AI-Powered Tools for Upwork Success',
      description: 'Optimize your freelancing career with AI-driven profile analytics, proposal tools, rate benchmarking, and earnings tracking. Built for Upwork freelancers.',
      image: DEFAULT_IMAGE,
      type: 'website'
    },
    '/tools': {
      title: 'Freelancer Tools — Cortex Freelancer',
      description: 'Access 50+ free and premium tools: rate calculator, proposal analyzer, profile scorer, client CRM, tax estimator, and more.',
      image: BASE_URL + '/assets/og-tools.png',
      type: 'website'
    },
    '/pricing': {
      title: 'Pricing — Cortex Freelancer',
      description: 'Simple, transparent pricing. Free tier for essentials, Pro for power users. 14-day free trial, no credit card required. 30-day money-back guarantee.',
      image: BASE_URL + '/assets/og-pricing.png',
      type: 'website'
    },
    '/dashboard': {
      title: 'Dashboard — Cortex Freelancer',
      description: 'Your freelancing command center. Track earnings, monitor proposals, and optimize your profile — all in one place.',
      image: DEFAULT_IMAGE,
      type: 'website'
    },
    '/login': {
      title: 'Sign In — Cortex Freelancer',
      description: 'Sign in to your Cortex Freelancer account to access your tools and analytics.',
      image: DEFAULT_IMAGE,
      type: 'website'
    }
  };

  function getOrCreateMeta(attr, value) {
    var selector = 'meta[' + attr + '="' + value + '"]';
    var el = document.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, value);
      document.head.appendChild(el);
    }
    return el;
  }

  function setMeta(name, content) {
    if (name.indexOf('og:') === 0 || name.indexOf('article:') === 0) {
      getOrCreateMeta('property', name).setAttribute('content', content);
    } else {
      getOrCreateMeta('name', name).setAttribute('content', content);
    }
  }

  /**
   * Detect current route from hash or pathname.
   * Supports both hash-based (#/tools) and path-based (/tools) routing.
   */
  function getCurrentRoute() {
    var hash = window.location.hash.replace(/^#!?/, '');
    if (hash && hash !== '/') return hash.split('?')[0];
    return window.location.pathname;
  }

  /**
   * Apply meta tags for the given route (or auto-detect).
   * @param {string} [route] - Override route detection
   * @param {Object} [overrides] - Override specific meta values
   */
  function apply(route, overrides) {
    route = route || getCurrentRoute();
    overrides = overrides || {};

    // Normalize route
    if (route !== '/' && route.slice(-1) === '/') {
      route = route.slice(0, -1);
    }

    var meta = PAGE_META[route] || PAGE_META['/'];
    var title = overrides.title || meta.title;
    var description = overrides.description || meta.description;
    var image = overrides.image || meta.image;
    var type = overrides.type || meta.type;
    var url = overrides.url || BASE_URL + route;

    // Standard meta
    document.title = title;
    setMeta('description', description);

    // Open Graph
    setMeta('og:title', title);
    setMeta('og:description', description);
    setMeta('og:image', image);
    setMeta('og:url', url);
    setMeta('og:type', type);
    setMeta('og:site_name', 'Cortex Freelancer');

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', image);

    // Canonical URL
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', url);
  }

  /** Register a custom page definition */
  function registerPage(route, meta) {
    PAGE_META[route] = Object.assign({}, PAGE_META['/'], meta);
  }

  /** Auto-update meta on hash change */
  function enableAutoUpdate() {
    window.addEventListener('hashchange', function () { apply(); });
    window.addEventListener('popstate', function () { apply(); });
  }

  /** Initialize: apply current route and enable auto-update */
  function init() {
    apply();
    enableAutoUpdate();
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.CortexFreelancer.MetaTags = {
    init: init,
    apply: apply,
    registerPage: registerPage,
    enableAutoUpdate: enableAutoUpdate,
    getPageMeta: function () { return JSON.parse(JSON.stringify(PAGE_META)); }
  };
})();
