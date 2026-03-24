/**
 * CF-292 Screen Reader Announcements
 * Manages aria-live regions for dynamic content: tool results, form validation,
 * notifications, and loading states.
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  /**
   * @typedef {'polite'|'assertive'|'off'} Politeness
   */

  /**
   * @typedef {'status'|'alert'|'log'|'timer'|'marquee'} AriaRole
   */

  /**
   * @typedef {Object} LiveRegionConfig
   * @property {string} id - Unique region identifier
   * @property {Politeness} politeness - aria-live value
   * @property {AriaRole} [role] - ARIA role for the region
   * @property {boolean} [atomic=true] - Whether to announce entire region or just changes
   * @property {number} [clearAfterMs=0] - Auto-clear message after N ms (0 = never)
   */

  /** @type {Object<string, LiveRegionConfig>} */
  const REGION_PRESETS = {
    toolResult: {
      id: 'cf-sr-tool-result',
      politeness: 'polite',
      role: 'status',
      atomic: true,
      clearAfterMs: 8000
    },
    formValidation: {
      id: 'cf-sr-form-validation',
      politeness: 'assertive',
      role: 'alert',
      atomic: true,
      clearAfterMs: 0
    },
    notification: {
      id: 'cf-sr-notification',
      politeness: 'polite',
      role: 'status',
      atomic: true,
      clearAfterMs: 6000
    },
    loading: {
      id: 'cf-sr-loading',
      politeness: 'polite',
      role: 'status',
      atomic: true,
      clearAfterMs: 0
    },
    error: {
      id: 'cf-sr-error',
      politeness: 'assertive',
      role: 'alert',
      atomic: true,
      clearAfterMs: 0
    }
  };

  /** @type {Map<string, HTMLElement>} */
  var regions = new Map();

  /** @type {Map<string, number>} */
  var clearTimers = new Map();

  /**
   * Create a visually-hidden live region element.
   * @param {LiveRegionConfig} config
   * @returns {HTMLElement}
   */
  function createRegionElement(config) {
    var el = document.createElement('div');
    el.id = config.id;
    el.setAttribute('aria-live', config.politeness);
    if (config.role) el.setAttribute('role', config.role);
    el.setAttribute('aria-atomic', config.atomic !== false ? 'true' : 'false');
    // Visually hidden but accessible to screen readers
    Object.assign(el.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0'
    });
    return el;
  }

  /**
   * Ensure a live region exists in the DOM.
   * @param {string} presetName - Key from REGION_PRESETS or custom config id
   * @param {LiveRegionConfig} [customConfig] - Override preset with custom config
   * @returns {HTMLElement}
   */
  function ensureRegion(presetName, customConfig) {
    var config = customConfig || REGION_PRESETS[presetName];
    if (!config) throw new Error('Unknown region preset: ' + presetName);

    var existing = regions.get(config.id);
    if (existing && document.body.contains(existing)) return existing;

    var el = createRegionElement(config);
    document.body.appendChild(el);
    regions.set(config.id, el);
    return el;
  }

  /**
   * Announce a message to screen readers via the specified region.
   * @param {string} region - Region preset name (toolResult, formValidation, notification, loading, error)
   * @param {string} message - Text to announce
   * @param {Object} [options]
   * @param {number} [options.clearAfterMs] - Override auto-clear timeout
   * @param {Politeness} [options.politeness] - Override politeness level
   */
  function announce(region, message, options) {
    var opts = options || {};
    var config = REGION_PRESETS[region];
    if (!config) throw new Error('Unknown region: ' + region);

    var el = ensureRegion(region);

    // Override politeness if requested
    if (opts.politeness) el.setAttribute('aria-live', opts.politeness);

    // Clear first then set after microtask so screen readers detect the change
    el.textContent = '';
    var timerId = clearTimers.get(config.id);
    if (timerId) clearTimeout(timerId);

    setTimeout(function() {
      el.textContent = message;

      var clearMs = opts.clearAfterMs !== undefined ? opts.clearAfterMs : config.clearAfterMs;
      if (clearMs > 0) {
        clearTimers.set(config.id, setTimeout(function() {
          el.textContent = '';
          clearTimers.delete(config.id);
        }, clearMs));
      }
    }, 100);
  }

  /**
   * Announce a tool/action result.
   * @param {string} toolName - Name of the tool or action
   * @param {string} result - Result summary
   */
  function announceToolResult(toolName, result) {
    announce('toolResult', toolName + ' complete: ' + result);
  }

  /**
   * Announce form validation errors.
   * @param {string[]} errors - List of validation error messages
   */
  function announceValidation(errors) {
    if (!errors || errors.length === 0) {
      announce('formValidation', 'All fields are valid.');
      return;
    }
    var count = errors.length;
    var msg = count + ' validation error' + (count > 1 ? 's' : '') + ': ' + errors.join('. ');
    announce('formValidation', msg);
  }

  /**
   * Announce a notification.
   * @param {string} message - Notification text
   * @param {'info'|'success'|'warning'|'error'} [level='info']
   */
  function announceNotification(message, level) {
    var prefix = level && level !== 'info' ? level.charAt(0).toUpperCase() + level.slice(1) + ': ' : '';
    var region = level === 'error' ? 'error' : 'notification';
    announce(region, prefix + message);
  }

  /**
   * Announce a loading state change.
   * @param {boolean} isLoading - Whether loading has started or finished
   * @param {string} [context='Content'] - What is loading
   */
  function announceLoading(isLoading, context) {
    var label = context || 'Content';
    announce('loading', isLoading ? label + ' is loading, please wait.' : label + ' has finished loading.');
  }

  /**
   * Clear a specific region's announcement.
   * @param {string} region - Region preset name
   */
  function clear(region) {
    var config = REGION_PRESETS[region];
    if (!config) return;
    var el = regions.get(config.id);
    if (el) el.textContent = '';
  }

  /**
   * Initialize all preset live regions in the DOM.
   */
  function init() {
    Object.keys(REGION_PRESETS).forEach(function(key) {
      ensureRegion(key);
    });
  }

  /**
   * Destroy all live regions and clean up timers.
   */
  function destroy() {
    clearTimers.forEach(function(id) { clearTimeout(id); });
    clearTimers.clear();
    regions.forEach(function(el) {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    regions.clear();
  }

  ns.ScreenReaderSystem = {
    REGION_PRESETS: REGION_PRESETS,
    announce: announce,
    announceToolResult: announceToolResult,
    announceValidation: announceValidation,
    announceNotification: announceNotification,
    announceLoading: announceLoading,
    clear: clear,
    ensureRegion: ensureRegion,
    init: init,
    destroy: destroy
  };
})();
