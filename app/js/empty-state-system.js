/**
 * Cortex Freelancer — Empty State System
 * [CF-287] Helpful empty states with illustrations and CTAs for all tools.
 *
 * Features:
 *   - SVG illustration library for common empty states
 *   - Configurable title, description, and CTA button
 *   - Presets for: no-data, no-results, no-projects, no-invoices, no-proposals,
 *     no-clients, no-messages, no-analytics, first-time, offline
 *   - Custom illustration support
 *   - Responsive layout with centered content
 *   - Accessible markup with ARIA
 *   - init()/render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var CSS_PREFIX = 'cf-empty';
  var _styleInjected = false;

  // ─── SVG Illustrations ────────────────────────────────────────────

  var ILLUSTRATIONS = {
    'no-data': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<rect x="20" y="30" width="80" height="70" rx="8" fill="#f0f0f0" stroke="#ddd" stroke-width="2"/>',
      '<rect x="32" y="50" width="56" height="6" rx="3" fill="#ddd"/>',
      '<rect x="32" y="62" width="40" height="6" rx="3" fill="#ddd"/>',
      '<rect x="32" y="74" width="48" height="6" rx="3" fill="#ddd"/>',
      '<circle cx="60" cy="45" r="20" fill="none" stroke="#6c5ce7" stroke-width="2" stroke-dasharray="4 3" opacity="0.5"/>',
      '</svg>'
    ].join(''),

    'no-results': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<circle cx="52" cy="52" r="28" stroke="#ddd" stroke-width="3" fill="#f8f8f8"/>',
      '<line x1="72" y1="72" x2="98" y2="98" stroke="#ddd" stroke-width="4" stroke-linecap="round"/>',
      '<line x1="42" y1="46" x2="62" y2="46" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>',
      '<line x1="42" y1="54" x2="56" y2="54" stroke="#ccc" stroke-width="2" stroke-linecap="round"/>',
      '</svg>'
    ].join(''),

    'no-projects': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<rect x="15" y="40" width="90" height="55" rx="6" fill="#f0f0f0" stroke="#ddd" stroke-width="2"/>',
      '<path d="M35 40V32a6 6 0 016-6h38a6 6 0 016 6v8" stroke="#ddd" stroke-width="2" fill="#f8f8f8"/>',
      '<circle cx="60" cy="65" r="12" fill="none" stroke="#6c5ce7" stroke-width="2" opacity="0.5"/>',
      '<line x1="60" y1="59" x2="60" y2="71" stroke="#6c5ce7" stroke-width="2" stroke-linecap="round" opacity="0.5"/>',
      '<line x1="54" y1="65" x2="66" y2="65" stroke="#6c5ce7" stroke-width="2" stroke-linecap="round" opacity="0.5"/>',
      '</svg>'
    ].join(''),

    'no-invoices': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<rect x="28" y="16" width="64" height="88" rx="6" fill="#f8f8f8" stroke="#ddd" stroke-width="2"/>',
      '<rect x="38" y="32" width="44" height="5" rx="2.5" fill="#ddd"/>',
      '<rect x="38" y="44" width="32" height="5" rx="2.5" fill="#ddd"/>',
      '<rect x="38" y="56" width="38" height="5" rx="2.5" fill="#ddd"/>',
      '<line x1="38" y1="72" x2="82" y2="72" stroke="#eee" stroke-width="1"/>',
      '<text x="60" y="90" text-anchor="middle" font-size="14" fill="#6c5ce7" opacity="0.5" font-family="sans-serif">$0</text>',
      '</svg>'
    ].join(''),

    'no-proposals': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<rect x="18" y="24" width="84" height="72" rx="8" fill="#f8f8f8" stroke="#ddd" stroke-width="2"/>',
      '<rect x="30" y="40" width="60" height="5" rx="2.5" fill="#ddd"/>',
      '<rect x="30" y="52" width="45" height="5" rx="2.5" fill="#ddd"/>',
      '<rect x="30" y="64" width="52" height="5" rx="2.5" fill="#ddd"/>',
      '<path d="M80 10l14 14H86a6 6 0 01-6-6V10z" fill="#f0f0f0" stroke="#ddd" stroke-width="1.5"/>',
      '<path d="M50 80l10-10 10 10" stroke="#6c5ce7" stroke-width="2" stroke-linecap="round" opacity="0.5" fill="none"/>',
      '</svg>'
    ].join(''),

    'no-clients': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<circle cx="60" cy="44" r="16" fill="#f0f0f0" stroke="#ddd" stroke-width="2"/>',
      '<path d="M32 92c0-15.5 12.5-28 28-28s28 12.5 28 28" stroke="#ddd" stroke-width="2" fill="#f8f8f8"/>',
      '<circle cx="60" cy="44" r="6" fill="none" stroke="#6c5ce7" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.5"/>',
      '</svg>'
    ].join(''),

    'no-messages': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<rect x="16" y="28" width="88" height="60" rx="10" fill="#f8f8f8" stroke="#ddd" stroke-width="2"/>',
      '<path d="M44 88l-8 16v-16" fill="#f8f8f8" stroke="#ddd" stroke-width="2"/>',
      '<rect x="32" y="46" width="56" height="5" rx="2.5" fill="#ddd"/>',
      '<rect x="32" y="58" width="40" height="5" rx="2.5" fill="#ddd"/>',
      '</svg>'
    ].join(''),

    'no-analytics': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<rect x="18" y="80" width="16" height="24" rx="3" fill="#f0f0f0" stroke="#ddd" stroke-width="1.5"/>',
      '<rect x="42" y="60" width="16" height="44" rx="3" fill="#f0f0f0" stroke="#ddd" stroke-width="1.5"/>',
      '<rect x="66" y="40" width="16" height="64" rx="3" fill="#f0f0f0" stroke="#ddd" stroke-width="1.5"/>',
      '<rect x="90" y="24" width="16" height="80" rx="3" fill="#f0f0f0" stroke="#ddd" stroke-width="1.5"/>',
      '<path d="M24 76l24-18 24-16 24-14" stroke="#6c5ce7" stroke-width="2" stroke-dasharray="4 3" opacity="0.4" fill="none"/>',
      '</svg>'
    ].join(''),

    'first-time': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<circle cx="60" cy="60" r="40" fill="#f8f8f8" stroke="#6c5ce7" stroke-width="2" opacity="0.3"/>',
      '<path d="M60 36v16m0 0l12 8m-12-8l-12 8" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>',
      '<text x="60" y="82" text-anchor="middle" font-size="22" fill="#6c5ce7" opacity="0.6" font-family="sans-serif">✦</text>',
      '</svg>'
    ].join(''),

    'offline': [
      '<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '<path d="M30 60a30 30 0 0160 0" stroke="#ddd" stroke-width="3" fill="none"/>',
      '<path d="M42 72a16 16 0 0136 0" stroke="#ddd" stroke-width="3" fill="none"/>',
      '<circle cx="60" cy="88" r="4" fill="#ddd"/>',
      '<line x1="30" y1="30" x2="90" y2="90" stroke="#e17055" stroke-width="3" stroke-linecap="round"/>',
      '</svg>'
    ].join('')
  };

  // ─── Presets ──────────────────────────────────────────────────────

  var PRESETS = {
    'no-data': {
      illustration: 'no-data',
      title: 'No data yet',
      description: 'There\'s nothing here yet. Start adding data to see it appear.',
      ctaText: 'Get Started',
      ctaAction: null
    },
    'no-results': {
      illustration: 'no-results',
      title: 'No results found',
      description: 'Try adjusting your search or filter criteria to find what you\'re looking for.',
      ctaText: 'Clear Filters',
      ctaAction: null
    },
    'no-projects': {
      illustration: 'no-projects',
      title: 'No projects yet',
      description: 'Create your first project to start tracking your freelance work and earnings.',
      ctaText: 'Create Project',
      ctaAction: null
    },
    'no-invoices': {
      illustration: 'no-invoices',
      title: 'No invoices yet',
      description: 'Generate professional invoices to get paid faster. Create your first one now.',
      ctaText: 'Create Invoice',
      ctaAction: null
    },
    'no-proposals': {
      illustration: 'no-proposals',
      title: 'No proposals yet',
      description: 'Browse available jobs and submit proposals to start winning contracts.',
      ctaText: 'Browse Jobs',
      ctaAction: null
    },
    'no-clients': {
      illustration: 'no-clients',
      title: 'No clients yet',
      description: 'Add your first client to manage relationships and track project history.',
      ctaText: 'Add Client',
      ctaAction: null
    },
    'no-messages': {
      illustration: 'no-messages',
      title: 'No messages',
      description: 'Your inbox is empty. Messages from clients and collaborators will appear here.',
      ctaText: null,
      ctaAction: null
    },
    'no-analytics': {
      illustration: 'no-analytics',
      title: 'No analytics data',
      description: 'Complete some projects or track time to see analytics and insights about your work.',
      ctaText: 'Start Tracking',
      ctaAction: null
    },
    'first-time': {
      illustration: 'first-time',
      title: 'Welcome to Cortex Freelancer',
      description: 'Let\'s get you set up. Complete your profile and explore the tools available to you.',
      ctaText: 'Set Up Profile',
      ctaAction: null
    },
    'offline': {
      illustration: 'offline',
      title: 'You\'re offline',
      description: 'Check your internet connection and try again. Some features may be available offline.',
      ctaText: 'Retry',
      ctaAction: function () { window.location.reload(); }
    }
  };

  // ─── Styles ───────────────────────────────────────────────────────

  function _injectStyles() {
    if (_styleInjected) return;
    _styleInjected = true;

    var css = [
      '.' + CSS_PREFIX + '-container {',
      '  display: flex; flex-direction: column; align-items: center;',
      '  justify-content: center; text-align: center;',
      '  padding: 48px 24px; max-width: 420px; margin: 0 auto;',
      '}',
      '',
      '.' + CSS_PREFIX + '-illustration {',
      '  width: 120px; height: 120px; margin-bottom: 24px;',
      '  opacity: 0.85;',
      '}',
      '.' + CSS_PREFIX + '-illustration svg {',
      '  width: 100%; height: 100%;',
      '}',
      '',
      '.' + CSS_PREFIX + '-title {',
      '  font-size: 18px; font-weight: 600; color: #2d3436;',
      '  margin: 0 0 8px; line-height: 1.3;',
      '}',
      '',
      '.' + CSS_PREFIX + '-description {',
      '  font-size: 14px; color: #636e72; line-height: 1.5;',
      '  margin: 0 0 24px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-cta {',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  padding: 10px 24px; border-radius: 8px;',
      '  background: #6c5ce7; color: #fff; border: none;',
      '  font-size: 14px; font-weight: 500; cursor: pointer;',
      '  transition: background 0.2s, transform 0.1s;',
      '}',
      '.' + CSS_PREFIX + '-cta:hover { background: #5a4bd1; }',
      '.' + CSS_PREFIX + '-cta:active { transform: scale(0.97); }',
      '.' + CSS_PREFIX + '-cta:focus-visible {',
      '  outline: 2px solid #6c5ce7; outline-offset: 2px;',
      '}',
      '',
      '.' + CSS_PREFIX + '-secondary-cta {',
      '  display: inline-block; margin-top: 12px;',
      '  font-size: 13px; color: #6c5ce7; cursor: pointer;',
      '  background: none; border: none; text-decoration: underline;',
      '}',
      '.' + CSS_PREFIX + '-secondary-cta:hover { color: #5a4bd1; }'
    ].join('\n');

    var style = document.createElement('style');
    style.setAttribute('data-cf', 'empty-state-system');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  function _el(tag, cls, attrs) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    }
    return el;
  }

  // ─── Empty State Builder ──────────────────────────────────────────

  /**
   * Create an empty state element.
   * @param {Object} opts
   * @param {string} [opts.preset] - Use a preset: no-data, no-results, no-projects, etc.
   * @param {string} [opts.illustration] - Illustration key or custom SVG string
   * @param {string} [opts.title] - Title text
   * @param {string} [opts.description] - Description text
   * @param {string} [opts.ctaText] - Primary CTA button text
   * @param {Function} [opts.ctaAction] - Primary CTA click handler
   * @param {string} [opts.secondaryText] - Secondary link text
   * @param {Function} [opts.secondaryAction] - Secondary link click handler
   * @returns {HTMLElement}
   */
  function create(opts) {
    _injectStyles();
    opts = opts || {};

    var preset = opts.preset ? PRESETS[opts.preset] : {};
    var config = {
      illustration: opts.illustration || preset.illustration || 'no-data',
      title: opts.title || preset.title || 'Nothing here',
      description: opts.description || preset.description || '',
      ctaText: opts.ctaText !== undefined ? opts.ctaText : preset.ctaText,
      ctaAction: opts.ctaAction || preset.ctaAction,
      secondaryText: opts.secondaryText || null,
      secondaryAction: opts.secondaryAction || null
    };

    var container = _el('div', CSS_PREFIX + '-container', { role: 'status' });

    // Illustration
    var illWrap = _el('div', CSS_PREFIX + '-illustration', { 'aria-hidden': 'true' });
    var svgContent = ILLUSTRATIONS[config.illustration] || config.illustration;
    if (svgContent.indexOf('<svg') === 0) {
      illWrap.innerHTML = svgContent;
    }
    container.appendChild(illWrap);

    // Title
    var title = _el('h3', CSS_PREFIX + '-title');
    title.textContent = config.title;
    container.appendChild(title);

    // Description
    if (config.description) {
      var desc = _el('p', CSS_PREFIX + '-description');
      desc.textContent = config.description;
      container.appendChild(desc);
    }

    // Primary CTA
    if (config.ctaText) {
      var btn = _el('button', CSS_PREFIX + '-cta', { type: 'button' });
      btn.textContent = config.ctaText;
      if (config.ctaAction) {
        btn.addEventListener('click', config.ctaAction);
      }
      container.appendChild(btn);
    }

    // Secondary CTA
    if (config.secondaryText) {
      var sec = _el('button', CSS_PREFIX + '-secondary-cta', { type: 'button' });
      sec.textContent = config.secondaryText;
      if (config.secondaryAction) {
        sec.addEventListener('click', config.secondaryAction);
      }
      container.appendChild(sec);
    }

    return container;
  }

  /**
   * Show an empty state inside a container, replacing its content.
   * @param {string|HTMLElement} container - Selector or element
   * @param {Object} opts - Same as create()
   * @returns {HTMLElement}
   */
  function showIn(container, opts) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return null;
    el.innerHTML = '';
    var empty = create(opts);
    el.appendChild(empty);
    return empty;
  }

  // ─── Public API ───────────────────────────────────────────────────

  window.CortexFreelancer.EmptyStateSystem = {
    create: create,
    showIn: showIn,
    PRESETS: Object.keys(PRESETS),
    ILLUSTRATIONS: Object.keys(ILLUSTRATIONS),

    /** @param {Object} [opts] */
    init: function (opts) {
      _injectStyles();
    },

    /**
     * Render a gallery of all empty state presets.
     * @param {string} containerId
     */
    render: function (containerId) {
      _injectStyles();
      var root = document.getElementById(containerId);
      if (!root) return;
      root.innerHTML = '';

      var h = _el('h2');
      h.textContent = 'Empty State System';
      h.style.cssText = 'margin:0 0 20px;font-size:20px;color:#2d3436';
      root.appendChild(h);

      Object.keys(PRESETS).forEach(function (key) {
        var section = _el('div', '', {
          style: 'border:1px solid #eee;border-radius:10px;margin-bottom:16px;overflow:hidden'
        });
        var label = _el('div', '', {
          style: 'padding:8px 16px;background:#f8f8f8;font-size:12px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.5px'
        });
        label.textContent = key;
        section.appendChild(label);
        section.appendChild(create({ preset: key }));
        root.appendChild(section);
      });
    }
  };

})();
