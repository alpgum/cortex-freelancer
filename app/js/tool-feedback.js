/**
 * [CF-168] Tool Feedback Widget
 * Reusable thumbs up/down + comment widget for every tool page.
 * Posts feedback to api/feedback.js endpoint.
 * Exposed on window.CortexFreelancer.ToolFeedback
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_tool_feedback';
  var API_ENDPOINT = '/api/feedback';
  var MAX_COMMENT = 500;
  var cssInjected = false;

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function uid() {
    return 'fb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function loadFeedback() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveFeedback(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) {}
  }

  function detectToolId() {
    var bodyAttr = document.body.getAttribute('data-tool-name');
    if (bodyAttr) return bodyAttr;
    var toolEl = document.querySelector('[data-tool-id]');
    if (toolEl) return toolEl.getAttribute('data-tool-id');
    var path = window.location.pathname;
    var match = path.match(/\/tools?\/([a-z0-9-]+)/i);
    if (match) return match[1];
    return null;
  }

  function injectCSS() {
    if (cssInjected) return;
    cssInjected = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cf-feedback-widget { border-top: 1px solid var(--border-color, #e2e8f0); padding: 16px 0; margin-top: 24px; font-family: inherit; }',
      '.cf-feedback-label { font-size: 14px; color: var(--text-secondary, #64748b); margin-bottom: 8px; }',
      '.cf-feedback-buttons { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }',
      '.cf-feedback-btn { background: var(--bg-secondary, #f1f5f9); border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 6px 14px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; transition: all 0.15s; }',
      '.cf-feedback-btn:hover { background: var(--bg-hover, #e2e8f0); }',
      '.cf-feedback-btn.active-up { background: #dcfce7; border-color: #22c55e; color: #15803d; }',
      '.cf-feedback-btn.active-down { background: #fee2e2; border-color: #ef4444; color: #b91c1c; }',
      '.cf-feedback-comment { margin-top: 10px; display: none; }',
      '.cf-feedback-comment.visible { display: block; }',
      '.cf-feedback-comment textarea { width: 100%; max-width: 400px; min-height: 60px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 6px; padding: 8px; font-size: 13px; resize: vertical; font-family: inherit; }',
      '.cf-feedback-submit { margin-top: 6px; background: var(--primary, #6366f1); color: #fff; border: none; border-radius: 6px; padding: 6px 16px; cursor: pointer; font-size: 13px; }',
      '.cf-feedback-submit:hover { opacity: 0.9; }',
      '.cf-feedback-thanks { font-size: 13px; color: #22c55e; margin-top: 8px; }',
      '.cf-feedback-aggregate { margin-top: 12px; padding: 10px 14px; background: var(--bg-secondary, #f8fafc); border-radius: 8px; font-size: 13px; color: var(--text-secondary, #64748b); display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }',
      '.cf-feedback-aggregate-score { font-size: 18px; font-weight: 700; color: var(--text-primary, #1e293b); }',
      '.cf-feedback-aggregate-bar { flex: 1; min-width: 100px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }',
      '.cf-feedback-aggregate-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }',
      '.cf-feedback-aggregate-count { font-size: 12px; color: var(--text-secondary, #94a3b8); }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function render(container, toolId) {
    var stored = loadFeedback();
    var existing = stored[toolId];

    if (existing && existing.submitted) {
      container.innerHTML = '<div class="cf-feedback-widget"><div class="cf-feedback-thanks">Thanks for your feedback!</div></div>';
      return;
    }

    var id = uid();
    container.innerHTML = [
      '<div class="cf-feedback-widget" data-feedback-id="' + id + '">',
      '  <div class="cf-feedback-label">Was this tool helpful?</div>',
      '  <div class="cf-feedback-buttons">',
      '    <button class="cf-feedback-btn" data-rating="up" type="button">&#128077; Yes</button>',
      '    <button class="cf-feedback-btn" data-rating="down" type="button">&#128078; No</button>',
      '  </div>',
      '  <div class="cf-feedback-comment" id="cf-comment-' + id + '">',
      '    <textarea placeholder="Any additional comments? (optional)" maxlength="' + MAX_COMMENT + '"></textarea>',
      '    <br>',
      '    <button class="cf-feedback-submit" type="button">Submit</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    var widget = container.querySelector('[data-feedback-id="' + id + '"]');
    var selectedRating = null;

    widget.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rating]');
      if (btn) {
        selectedRating = btn.getAttribute('data-rating');
        var btns = widget.querySelectorAll('[data-rating]');
        for (var i = 0; i < btns.length; i++) {
          btns[i].classList.remove('active-up', 'active-down');
        }
        btn.classList.add(selectedRating === 'up' ? 'active-up' : 'active-down');
        var commentBox = widget.querySelector('.cf-feedback-comment');
        if (commentBox) commentBox.classList.add('visible');
        return;
      }

      if (e.target.classList.contains('cf-feedback-submit')) {
        if (!selectedRating) return;
        var textarea = widget.querySelector('textarea');
        var comment = textarea ? textarea.value.trim().slice(0, MAX_COMMENT) : '';
        submitFeedback(toolId, selectedRating, comment, widget);
      }
    });
  }

  function submitFeedback(toolId, rating, comment, widget) {
    var payload = {
      tool: toolId,
      rating: rating,
      comment: comment,
      timestamp: new Date().toISOString()
    };

    var stored = loadFeedback();
    stored[toolId] = { rating: rating, submitted: true, at: Date.now() };
    saveFeedback(stored);

    widget.innerHTML = '<div class="cf-feedback-thanks">Thanks for your feedback!</div>';

    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_ENDPOINT, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(payload));
    } catch (e) {
      // Feedback saved locally even if API fails
    }
  }

  /**
   * Mount feedback widget into a container element.
   * @param {HTMLElement|string} container - Element or selector
   * @param {string} [toolId] - Override auto-detected tool ID
   */
  function mount(container, toolId) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    var id = toolId || detectToolId();
    if (!id) return;
    render(el, id);
  }

  /**
   * Auto-mount: append widget to any element with data-tool-feedback attribute.
   */
  function autoMount() {
    injectCSS();
    var targets = document.querySelectorAll('[data-tool-feedback]');
    for (var i = 0; i < targets.length; i++) {
      var el = targets[i];
      var id = el.getAttribute('data-tool-feedback') || detectToolId();
      if (id && !el.querySelector('.cf-feedback-widget')) {
        render(el, id);
      }
    }
  }

  /**
   * Get all stored feedback entries.
   */
  function getAll() {
    return loadFeedback();
  }

  /**
   * Compute aggregate rating stats for a given tool.
   * @param {string} [toolId] - Tool ID; if omitted, computes across all tools.
   * @returns {{ total: number, up: number, down: number, percent: number }}
   */
  function getAggregate(toolId) {
    var stored = loadFeedback();
    var up = 0;
    var down = 0;
    var keys = Object.keys(stored);
    for (var i = 0; i < keys.length; i++) {
      var entry = stored[keys[i]];
      if (toolId && keys[i] !== toolId) continue;
      if (!entry || !entry.submitted) continue;
      if (entry.rating === 'up') up++;
      else if (entry.rating === 'down') down++;
    }
    var total = up + down;
    return {
      total: total,
      up: up,
      down: down,
      percent: total > 0 ? Math.round((up / total) * 100) : 0
    };
  }

  /**
   * Render aggregate ratings bar into a container.
   * @param {HTMLElement|string} container - Element or selector
   * @param {string} [toolId] - Specific tool, or all tools if omitted
   */
  function renderAggregate(container, toolId) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    var stats = getAggregate(toolId);
    if (stats.total === 0) {
      el.innerHTML = '<div class="cf-feedback-aggregate"><span style="color:#94a3b8;">No ratings yet</span></div>';
      return;
    }

    var barColor = stats.percent >= 70 ? '#22c55e' : stats.percent >= 40 ? '#f59e0b' : '#ef4444';
    el.innerHTML = [
      '<div class="cf-feedback-aggregate">',
      '  <span class="cf-feedback-aggregate-score">' + stats.percent + '%</span>',
      '  <span>positive</span>',
      '  <div class="cf-feedback-aggregate-bar">',
      '    <div class="cf-feedback-aggregate-fill" style="width:' + stats.percent + '%;background:' + barColor + ';"></div>',
      '  </div>',
      '  <span class="cf-feedback-aggregate-count">&#128077; ' + stats.up + ' &nbsp; &#128078; ' + stats.down + ' &nbsp; (' + stats.total + ' total)</span>',
      '</div>'
    ].join('\n');
  }

  /**
   * Reset feedback for a specific tool (allows re-submitting).
   */
  function reset(toolId) {
    var stored = loadFeedback();
    delete stored[toolId];
    saveFeedback(stored);
  }

  // Auto-mount on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMount);
  } else {
    autoMount();
  }

  window.CortexFreelancer.ToolFeedback = {
    mount: mount,
    autoMount: autoMount,
    getAll: getAll,
    getAggregate: getAggregate,
    renderAggregate: renderAggregate,
    reset: reset
  };
})();
