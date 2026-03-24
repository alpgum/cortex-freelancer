/**
 * CF-081 + CF-082: Content-Security-Policy Meta Tag Manager
 * 
 * Programmatic CSP builder that:
 * - Injects a <meta http-equiv="Content-Security-Policy"> tag
 * - Allows 'unsafe-inline' for scripts/styles (needed for legacy inline code)
 * - Whitelists external domains: Google Tag Manager, Firebase, Google APIs, Stripe
 * - Provides API to add/remove directives at runtime
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  // ── Default CSP Directives ───────────────────────────────────────────
  var DEFAULT_DIRECTIVES = {
    'default-src': ["'self'"],

    'script-src': [
      "'self'",
      "'unsafe-inline'",
      'https://*.googletagmanager.com',
      'https://*.google-analytics.com',
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'https://apis.google.com',
      'https://js.stripe.com'
    ],

    'style-src': [
      "'self'",
      "'unsafe-inline'",
      'https://fonts.googleapis.com'
    ],

    'connect-src': [
      "'self'",
      'https://*.googleapis.com',
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://*.googletagmanager.com',
      'https://*.firebaseio.com',
      'https://*.firebaseapp.com',
      'https://firestore.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://api.stripe.com',
      'https://www.googleapis.com'
    ],

    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.googleusercontent.com',
      'https://*.googleapis.com',
      'https://*.gstatic.com'
    ],

    'font-src': [
      "'self'",
      'data:',
      'https://fonts.gstatic.com'
    ],

    'frame-src': [
      "'self'",
      'https://*.firebaseapp.com',
      'https://accounts.google.com',
      'https://js.stripe.com'
    ],

    'object-src': ["'none'"],

    'base-uri': ["'self'"]
  };

  // ── CSP Builder ──────────────────────────────────────────────────────

  function CSPConfig(overrides) {
    // Deep-clone defaults
    this.directives = {};
    var src = overrides || DEFAULT_DIRECTIVES;
    for (var key in DEFAULT_DIRECTIVES) {
      this.directives[key] = DEFAULT_DIRECTIVES[key].slice();
    }
    // Merge overrides on top
    if (overrides) {
      for (var k in overrides) {
        if (overrides.hasOwnProperty(k)) {
          this.directives[k] = overrides[k].slice();
        }
      }
    }
    this._metaElement = null;
  }

  /**
   * Add a value to a directive (no duplicates).
   * @param {string} directive  e.g. 'script-src'
   * @param {string} value      e.g. 'https://cdn.example.com'
   */
  CSPConfig.prototype.add = function (directive, value) {
    if (!this.directives[directive]) {
      this.directives[directive] = [];
    }
    if (this.directives[directive].indexOf(value) === -1) {
      this.directives[directive].push(value);
    }
    return this;
  };

  /**
   * Remove a value from a directive.
   */
  CSPConfig.prototype.remove = function (directive, value) {
    var arr = this.directives[directive];
    if (!arr) return this;
    var idx = arr.indexOf(value);
    if (idx !== -1) arr.splice(idx, 1);
    return this;
  };

  /**
   * Set an entire directive (replaces existing).
   */
  CSPConfig.prototype.set = function (directive, values) {
    this.directives[directive] = Array.isArray(values) ? values.slice() : [values];
    return this;
  };

  /**
   * Build the CSP header string.
   */
  CSPConfig.prototype.build = function () {
    var parts = [];
    for (var directive in this.directives) {
      if (this.directives.hasOwnProperty(directive)) {
        var values = this.directives[directive];
        if (values && values.length > 0) {
          parts.push(directive + ' ' + values.join(' '));
        }
      }
    }
    return parts.join('; ');
  };

  /**
   * Inject (or update) the CSP meta tag in <head>.
   */
  CSPConfig.prototype.apply = function () {
    var content = this.build();

    if (this._metaElement) {
      this._metaElement.setAttribute('content', content);
      return this;
    }

    // Check for existing CSP meta
    var existing = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (existing) {
      existing.setAttribute('content', content);
      this._metaElement = existing;
      return this;
    }

    // Create new
    var meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = content;

    // Insert as first child of <head> so it applies before any scripts load
    var head = document.head || document.getElementsByTagName('head')[0];
    if (head.firstChild) {
      head.insertBefore(meta, head.firstChild);
    } else {
      head.appendChild(meta);
    }
    this._metaElement = meta;
    return this;
  };

  /**
   * Remove the CSP meta tag.
   */
  CSPConfig.prototype.detach = function () {
    if (this._metaElement && this._metaElement.parentNode) {
      this._metaElement.parentNode.removeChild(this._metaElement);
      this._metaElement = null;
    }
    return this;
  };

  /**
   * Convenience: whitelist a domain across common directives.
   * @param {string} domain  e.g. 'https://cdn.example.com'
   * @param {string[]} [directives]  which directives to add to (defaults to script-src, connect-src, img-src)
   */
  CSPConfig.prototype.whitelist = function (domain, directives) {
    var targets = directives || ['script-src', 'connect-src', 'img-src'];
    for (var i = 0; i < targets.length; i++) {
      this.add(targets[i], domain);
    }
    return this;
  };

  /**
   * Get current directive values.
   */
  CSPConfig.prototype.get = function (directive) {
    return (this.directives[directive] || []).slice();
  };

  /**
   * Debug: log current policy to console.
   */
  CSPConfig.prototype.debug = function () {
    console.group('[CSP Config] Current Policy');
    for (var d in this.directives) {
      if (this.directives.hasOwnProperty(d)) {
        console.log(d + ':', this.directives[d].join(' '));
      }
    }
    console.log('\nFull header:', this.build());
    console.groupEnd();
    return this;
  };

  // ── Singleton + Export ───────────────────────────────────────────────

  var instance = new CSPConfig();

  window.CortexFreelancer.CSPConfig = CSPConfig;
  window.CortexFreelancer.csp = instance;

  // CSP auto-apply disabled for demo phase — will re-enable later
  // instance.apply() is available manually if needed

  console.log('[CF] CSP config loaded — auto-apply disabled for demo phase');
})();
