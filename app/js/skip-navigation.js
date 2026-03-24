/**
 * CF-293 Skip Navigation Link
 * Injects a "Skip to main content" link as the first focusable element on every page.
 * Handles focus management and smooth scrolling to the main content area.
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  /** @type {string} Default ID for the main content target */
  const DEFAULT_TARGET_ID = 'main-content';

  /** @type {string} */
  const SKIP_LINK_ID = 'cf-skip-nav';

  /**
   * CSS styles for the skip navigation link.
   * Visually hidden until focused, then slides into view.
   */
  const STYLES = [
    '#' + SKIP_LINK_ID + ' {',
    '  position: fixed;',
    '  top: -100%;',
    '  left: 16px;',
    '  z-index: 100000;',
    '  padding: 12px 24px;',
    '  background: #1a1a2e;',
    '  color: #ffffff;',
    '  font-size: 14px;',
    '  font-weight: 600;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
    '  text-decoration: none;',
    '  border-radius: 0 0 8px 8px;',
    '  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);',
    '  transition: top 0.2s ease-in-out;',
    '  outline: none;',
    '}',
    '#' + SKIP_LINK_ID + ':focus {',
    '  top: 0;',
    '  outline: 2px solid #6c63ff;',
    '  outline-offset: 2px;',
    '}'
  ].join('\n');

  /** @type {HTMLAnchorElement|null} */
  var skipLink = null;

  /** @type {HTMLStyleElement|null} */
  var styleEl = null;

  /**
   * Ensure the main content target has an ID and is focusable.
   * @param {string} [targetId] - Custom target element ID
   * @returns {HTMLElement|null}
   */
  function ensureTarget(targetId) {
    var id = targetId || DEFAULT_TARGET_ID;
    var target = document.getElementById(id);

    // Try common main content selectors if no explicit target
    if (!target) {
      target = document.querySelector('main') ||
               document.querySelector('[role="main"]') ||
               document.querySelector('.main-content') ||
               document.querySelector('#content') ||
               document.querySelector('#app');
    }

    if (target && !target.id) {
      target.id = id;
    }

    // Make target programmatically focusable if it isn't already
    if (target && target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.style.outline = 'none';
    }

    return target;
  }

  /**
   * Inject the skip link styles into the document head.
   */
  function injectStyles() {
    if (styleEl && document.head.contains(styleEl)) return;
    styleEl = document.createElement('style');
    styleEl.id = 'cf-skip-nav-styles';
    styleEl.textContent = STYLES;
    document.head.appendChild(styleEl);
  }

  /**
   * Create and insert the skip navigation link.
   * @param {Object} [options]
   * @param {string} [options.targetId] - ID of the main content element
   * @param {string} [options.text='Skip to main content'] - Link text
   * @returns {HTMLAnchorElement}
   */
  function create(options) {
    var opts = options || {};
    var targetId = opts.targetId || DEFAULT_TARGET_ID;
    var text = opts.text || 'Skip to main content';

    // Don't create duplicates
    if (skipLink && document.body.contains(skipLink)) {
      return skipLink;
    }

    injectStyles();
    ensureTarget(targetId);

    skipLink = document.createElement('a');
    skipLink.id = SKIP_LINK_ID;
    skipLink.href = '#' + targetId;
    skipLink.textContent = text;
    skipLink.className = 'cf-skip-nav-link';

    skipLink.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.getElementById(targetId);
      if (target) {
        target.focus();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Insert as the very first child of body
    if (document.body.firstChild) {
      document.body.insertBefore(skipLink, document.body.firstChild);
    } else {
      document.body.appendChild(skipLink);
    }

    return skipLink;
  }

  /**
   * Remove the skip navigation link and styles.
   */
  function destroy() {
    if (skipLink && skipLink.parentNode) {
      skipLink.parentNode.removeChild(skipLink);
      skipLink = null;
    }
    if (styleEl && styleEl.parentNode) {
      styleEl.parentNode.removeChild(styleEl);
      styleEl = null;
    }
  }

  /**
   * Initialize the skip navigation system.
   * @param {Object} [options]
   * @param {string} [options.targetId] - ID of the main content element
   * @param {string} [options.text] - Custom skip link text
   * @returns {HTMLAnchorElement}
   */
  function init(options) {
    // Wait for DOM if needed
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        create(options);
      });
      return null;
    }
    return create(options);
  }

  ns.SkipNavigation = {
    DEFAULT_TARGET_ID: DEFAULT_TARGET_ID,
    create: create,
    destroy: destroy,
    ensureTarget: ensureTarget,
    init: init
  };
})();
