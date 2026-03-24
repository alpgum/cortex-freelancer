/**
 * [CF-170] Tool Onboarding Tooltips
 * Show guided tooltips on first visit to each tool explaining key features.
 * Uses localStorage to track seen state per tool.
 * Exposed on window.CortexFreelancer.ToolOnboarding
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_onboarding_seen';
  var activeOverlay = null;
  var currentStepIndex = 0;
  var currentSteps = [];
  var currentToolId = null;
  var cssInjected = false;

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function loadSeen() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveSeen(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  function markSeen(toolId) {
    var seen = loadSeen();
    seen[toolId] = Date.now();
    saveSeen(seen);
  }

  function hasSeen(toolId) {
    var seen = loadSeen();
    return !!seen[toolId];
  }

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cf-onboard-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 99998; }',
      '.cf-onboard-tooltip { position: fixed; z-index: 99999; background: #fff; border-radius: 10px; padding: 20px; max-width: 340px; box-shadow: 0 8px 32px rgba(0,0,0,0.18); font-family: inherit; }',
      '.cf-onboard-tooltip h3 { margin: 0 0 8px; font-size: 15px; color: #1e293b; }',
      '.cf-onboard-tooltip p { margin: 0 0 14px; font-size: 13px; color: #64748b; line-height: 1.5; }',
      '.cf-onboard-footer { display: flex; justify-content: space-between; align-items: center; }',
      '.cf-onboard-dots { display: flex; gap: 5px; }',
      '.cf-onboard-dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; }',
      '.cf-onboard-dot.active { background: #6366f1; }',
      '.cf-onboard-next { background: #6366f1; color: #fff; border: none; border-radius: 6px; padding: 6px 16px; cursor: pointer; font-size: 13px; }',
      '.cf-onboard-next:hover { opacity: 0.9; }',
      '.cf-onboard-skip { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 12px; padding: 4px 8px; }',
      '.cf-onboard-skip:hover { color: #64748b; }',
      '.cf-onboard-highlight { position: relative; z-index: 99999; box-shadow: 0 0 0 4px rgba(99,102,241,0.3); border-radius: 6px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function cleanup() {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
    var tooltip = document.querySelector('.cf-onboard-tooltip');
    if (tooltip) tooltip.remove();

    var highlighted = document.querySelectorAll('.cf-onboard-highlight');
    for (var i = 0; i < highlighted.length; i++) {
      highlighted[i].classList.remove('cf-onboard-highlight');
    }

    currentSteps = [];
    currentStepIndex = 0;
    currentToolId = null;
  }

  function positionTooltip(tooltip, targetEl) {
    if (!targetEl) {
      // Center on screen
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    var rect = targetEl.getBoundingClientRect();
    var tooltipH = tooltip.offsetHeight || 180;
    var spaceBelow = window.innerHeight - rect.bottom;

    tooltip.style.transform = '';

    if (spaceBelow > tooltipH + 16) {
      tooltip.style.top = (rect.bottom + 12) + 'px';
    } else {
      tooltip.style.top = Math.max(8, rect.top - tooltipH - 12) + 'px';
    }

    var left = Math.max(12, Math.min(rect.left, window.innerWidth - 360));
    tooltip.style.left = left + 'px';
  }

  function showStep(index) {
    // Remove previous tooltip
    var prev = document.querySelector('.cf-onboard-tooltip');
    if (prev) prev.remove();
    var prevHighlight = document.querySelectorAll('.cf-onboard-highlight');
    for (var i = 0; i < prevHighlight.length; i++) {
      prevHighlight[i].classList.remove('cf-onboard-highlight');
    }

    if (index >= currentSteps.length) {
      markSeen(currentToolId);
      cleanup();
      return;
    }

    currentStepIndex = index;
    var step = currentSteps[index];
    var targetEl = step.target ? document.querySelector(step.target) : null;

    if (targetEl) {
      targetEl.classList.add('cf-onboard-highlight');
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    var isLast = index === currentSteps.length - 1;
    var dots = '';
    for (var j = 0; j < currentSteps.length; j++) {
      dots += '<span class="cf-onboard-dot' + (j === index ? ' active' : '') + '"></span>';
    }

    var tooltip = document.createElement('div');
    tooltip.className = 'cf-onboard-tooltip';
    tooltip.innerHTML = [
      '<h3>' + escHtml(step.title) + '</h3>',
      '<p>' + escHtml(step.text) + '</p>',
      '<div class="cf-onboard-footer">',
      '  <div class="cf-onboard-dots">' + dots + '</div>',
      '  <div>',
      '    <button class="cf-onboard-skip" type="button">Skip</button>',
      '    <button class="cf-onboard-next" type="button">' + (isLast ? 'Got it' : 'Next') + '</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(tooltip);
    positionTooltip(tooltip, targetEl);

    tooltip.querySelector('.cf-onboard-next').addEventListener('click', function () {
      showStep(index + 1);
    });
    tooltip.querySelector('.cf-onboard-skip').addEventListener('click', function () {
      markSeen(currentToolId);
      cleanup();
    });
  }

  /**
   * Start onboarding for a tool.
   * @param {string} toolId - Unique tool identifier
   * @param {Array} steps - Array of { target: 'css-selector', title: string, text: string }
   * @param {object} [options] - { force: true } to show even if already seen
   */
  function start(toolId, steps, options) {
    if (!toolId || !steps || !steps.length) return;
    var opts = options || {};
    if (!opts.force && hasSeen(toolId)) return;

    injectCSS();
    cleanup();

    currentToolId = toolId;
    currentSteps = steps;
    currentStepIndex = 0;

    activeOverlay = document.createElement('div');
    activeOverlay.className = 'cf-onboard-overlay';
    activeOverlay.addEventListener('click', function () {
      markSeen(currentToolId);
      cleanup();
    });
    document.body.appendChild(activeOverlay);

    // Small delay to let overlay render
    setTimeout(function () { showStep(0); }, 100);
  }

  /**
   * Reset seen state for a tool or all tools.
   */
  function reset(toolId) {
    if (toolId) {
      var seen = loadSeen();
      delete seen[toolId];
      saveSeen(seen);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Check if user has seen onboarding for a tool.
   */
  function isSeen(toolId) {
    return hasSeen(toolId);
  }

  window.CortexFreelancer.ToolOnboarding = {
    start: start,
    reset: reset,
    isSeen: isSeen
  };
})();
