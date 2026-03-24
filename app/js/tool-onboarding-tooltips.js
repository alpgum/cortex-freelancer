/**
 * CF-170: Tool Onboarding Tooltips
 * Show guided tooltips on first visit to each tool explaining key features.
 * Uses localStorage to track first visit per tool page.
 *
 * @namespace window.CortexFreelancer.ToolOnboardingTooltips
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_onboarding_seen';

  // ─── Storage ───────────────────────────────────────────

  /**
   * Load set of seen tool IDs from localStorage.
   * @returns {Object} Map of toolId -> true
   */
  function loadSeen() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn('[ToolOnboardingTooltips] Failed to load seen state:', e);
      return {};
    }
  }

  /**
   * Mark a tool as seen in localStorage.
   * @param {string} toolId
   */
  function markSeen(toolId) {
    try {
      var seen = loadSeen();
      seen[toolId] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    } catch (e) {
      console.warn('[ToolOnboardingTooltips] Failed to save seen state:', e);
    }
  }

  /**
   * Check if a tool has been seen before.
   * @param {string} toolId
   * @returns {boolean}
   */
  function hasSeen(toolId) {
    return !!loadSeen()[toolId];
  }

  // ─── Tooltip Definitions ───────────────────────────────

  /**
   * Registry of tool tooltips keyed by toolId.
   * Each entry has a title and an array of step objects.
   * @type {Object.<string, {title: string, steps: Array.<{selector: string, text: string, position: string}>}>}
   */
  var tooltipRegistry = {};

  /**
   * Register tooltip steps for a tool page.
   * @param {string} toolId - Unique identifier for the tool
   * @param {Object} config
   * @param {string} config.title - Tooltip sequence title
   * @param {Array.<{selector: string, text: string, position: string}>} config.steps
   */
  function registerTooltips(toolId, config) {
    if (!toolId || !config || !config.steps || !config.steps.length) {
      console.warn('[ToolOnboardingTooltips] Invalid tooltip config for:', toolId);
      return;
    }
    tooltipRegistry[toolId] = {
      title: config.title || toolId,
      steps: config.steps
    };
  }

  // ─── Overlay Rendering ─────────────────────────────────

  var activeOverlay = null;
  var currentStepIndex = 0;
  var currentToolId = null;

  /**
   * Inject onboarding CSS styles once.
   */
  function injectStyles() {
    if (document.getElementById('cortex-onboarding-styles')) return;
    var style = document.createElement('style');
    style.id = 'cortex-onboarding-styles';
    style.textContent =
      '.cortex-onboarding-overlay {' +
        'position: fixed; top: 0; left: 0; width: 100%; height: 100%;' +
        'background: rgba(0,0,0,0.55); z-index: 10000;' +
        'display: flex; align-items: center; justify-content: center;' +
      '}' +
      '.cortex-onboarding-highlight {' +
        'position: absolute; border: 3px solid #6c5ce7; border-radius: 8px;' +
        'box-shadow: 0 0 0 9999px rgba(0,0,0,0.5); z-index: 10001;' +
        'pointer-events: none; transition: all 0.3s ease;' +
      '}' +
      '.cortex-onboarding-tooltip {' +
        'position: absolute; background: #fff; color: #2d3436;' +
        'border-radius: 10px; padding: 20px 24px; max-width: 340px;' +
        'box-shadow: 0 8px 32px rgba(0,0,0,0.25); z-index: 10002;' +
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
        'font-size: 14px; line-height: 1.5;' +
      '}' +
      '.cortex-onboarding-tooltip h4 {' +
        'margin: 0 0 8px; font-size: 16px; color: #6c5ce7;' +
      '}' +
      '.cortex-onboarding-tooltip p { margin: 0 0 16px; }' +
      '.cortex-onboarding-actions {' +
        'display: flex; justify-content: space-between; align-items: center; gap: 10px;' +
      '}' +
      '.cortex-onboarding-actions button {' +
        'padding: 8px 18px; border: none; border-radius: 6px;' +
        'cursor: pointer; font-size: 13px; font-weight: 600;' +
      '}' +
      '.cortex-onboarding-btn-next {' +
        'background: #6c5ce7; color: #fff;' +
      '}' +
      '.cortex-onboarding-btn-next:hover { background: #5b4bd5; }' +
      '.cortex-onboarding-btn-skip {' +
        'background: transparent; color: #636e72;' +
      '}' +
      '.cortex-onboarding-btn-skip:hover { color: #2d3436; }' +
      '.cortex-onboarding-progress {' +
        'font-size: 12px; color: #b2bec3;' +
      '}';
    document.head.appendChild(style);
  }

  /**
   * Remove the active overlay and clean up.
   */
  function removeOverlay() {
    if (activeOverlay && activeOverlay.parentNode) {
      activeOverlay.parentNode.removeChild(activeOverlay);
    }
    activeOverlay = null;
    currentStepIndex = 0;
    currentToolId = null;
  }

  /**
   * Render a specific step of the tooltip sequence.
   * @param {string} toolId
   * @param {number} stepIndex
   */
  function renderStep(toolId, stepIndex) {
    var config = tooltipRegistry[toolId];
    if (!config || stepIndex >= config.steps.length) {
      removeOverlay();
      return;
    }

    var step = config.steps[stepIndex];
    var targetEl = step.selector ? document.querySelector(step.selector) : null;

    // Remove old overlay
    removeOverlay();

    currentToolId = toolId;
    currentStepIndex = stepIndex;

    var overlay = document.createElement('div');
    overlay.className = 'cortex-onboarding-overlay';
    activeOverlay = overlay;

    // Highlight target element if found
    if (targetEl) {
      var rect = targetEl.getBoundingClientRect();
      var highlight = document.createElement('div');
      highlight.className = 'cortex-onboarding-highlight';
      highlight.style.top = (rect.top - 6) + 'px';
      highlight.style.left = (rect.left - 6) + 'px';
      highlight.style.width = (rect.width + 12) + 'px';
      highlight.style.height = (rect.height + 12) + 'px';
      overlay.appendChild(highlight);
    }

    // Tooltip box
    var tooltip = document.createElement('div');
    tooltip.className = 'cortex-onboarding-tooltip';

    var position = step.position || 'bottom';
    if (targetEl) {
      var tRect = targetEl.getBoundingClientRect();
      if (position === 'bottom') {
        tooltip.style.top = (tRect.bottom + 16) + 'px';
        tooltip.style.left = Math.max(16, tRect.left) + 'px';
      } else if (position === 'top') {
        tooltip.style.bottom = (window.innerHeight - tRect.top + 16) + 'px';
        tooltip.style.left = Math.max(16, tRect.left) + 'px';
      } else if (position === 'right') {
        tooltip.style.top = tRect.top + 'px';
        tooltip.style.left = (tRect.right + 16) + 'px';
      } else if (position === 'left') {
        tooltip.style.top = tRect.top + 'px';
        tooltip.style.right = (window.innerWidth - tRect.left + 16) + 'px';
      }
    } else {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
    }

    var isLast = stepIndex === config.steps.length - 1;
    var nextLabel = isLast ? 'Done' : 'Next';

    tooltip.innerHTML =
      '<h4>' + escapeHtml(config.title) + '</h4>' +
      '<p>' + escapeHtml(step.text) + '</p>' +
      '<div class="cortex-onboarding-actions">' +
        '<span class="cortex-onboarding-progress">' +
          (stepIndex + 1) + ' / ' + config.steps.length +
        '</span>' +
        '<div>' +
          '<button class="cortex-onboarding-btn-skip" data-action="skip">Skip</button>' +
          '<button class="cortex-onboarding-btn-next" data-action="next">' + nextLabel + '</button>' +
        '</div>' +
      '</div>';

    overlay.appendChild(tooltip);
    document.body.appendChild(overlay);

    // Event delegation on overlay
    overlay.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      if (action === 'skip') {
        markSeen(toolId);
        removeOverlay();
        window.dispatchEvent(new CustomEvent('cortex:onboarding-complete', {
          detail: { toolId: toolId, skipped: true }
        }));
      } else if (action === 'next') {
        if (isLast) {
          markSeen(toolId);
          removeOverlay();
          window.dispatchEvent(new CustomEvent('cortex:onboarding-complete', {
            detail: { toolId: toolId, skipped: false }
          }));
        } else {
          renderStep(toolId, stepIndex + 1);
        }
      }
    });
  }

  // ─── Helpers ───────────────────────────────────────────

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ─── Public API ────────────────────────────────────────

  /**
   * Start the onboarding tooltip sequence for a tool (only if not seen).
   * @param {string} toolId
   * @param {boolean} [force=false] - Force show even if already seen
   */
  function startOnboarding(toolId, force) {
    if (!tooltipRegistry[toolId]) {
      console.warn('[ToolOnboardingTooltips] No tooltips registered for:', toolId);
      return;
    }
    if (!force && hasSeen(toolId)) return;
    injectStyles();
    renderStep(toolId, 0);
  }

  /**
   * Reset seen state for a specific tool or all tools.
   * @param {string} [toolId] - If omitted, resets all
   */
  function resetSeen(toolId) {
    try {
      if (toolId) {
        var seen = loadSeen();
        delete seen[toolId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn('[ToolOnboardingTooltips] Failed to reset seen state:', e);
    }
  }

  /**
   * Initialize the module.
   */
  function init() {
    injectStyles();
    console.log('[ToolOnboardingTooltips] Module initialized');
  }

  // ─── Namespace Export ──────────────────────────────────

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ToolOnboardingTooltips = {
    init: init,
    register: registerTooltips,
    start: startOnboarding,
    hasSeen: hasSeen,
    resetSeen: resetSeen
  };
})();
