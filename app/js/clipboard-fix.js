/**
 * CF-113: Fix proposal generator output not copying to clipboard
 * navigator.clipboard.writeText() with execCommand('copy') fallback.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    Object.assign(ta.style, {
      position: 'fixed', left: '-9999px', top: '-9999px', opacity: '0'
    });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var success = false;
    try {
      success = document.execCommand('copy');
    } catch (e) {
      console.error('[ClipboardFix] execCommand fallback failed', e);
    }
    document.body.removeChild(ta);
    return success;
  }

  /**
   * Copy text to clipboard with automatic fallback.
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(function () { return true; })
        .catch(function () {
          // Clipboard API can fail in non-secure contexts or iframes
          return fallbackCopy(text);
        });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  /**
   * Show a brief "Copied!" feedback near an element.
   */
  function showCopyFeedback(button, message) {
    var original = button.textContent;
    button.textContent = message || 'Copied!';
    button.disabled = true;
    setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
    }, 1500);
  }

  /**
   * Auto-bind copy buttons: elements with [data-copy-target] or .copy-btn.
   */
  function bindCopyButtons() {
    document.querySelectorAll('[data-copy-target], .copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetSel = btn.getAttribute('data-copy-target');
        var target = targetSel ? document.querySelector(targetSel) : btn.previousElementSibling;
        if (!target) return;
        var text = target.value || target.textContent || '';
        copyToClipboard(text).then(function (ok) {
          if (ok) showCopyFeedback(btn);
        });
      });
    });
  }

  window.CortexFreelancer.ClipboardFix = {
    copyToClipboard: copyToClipboard,
    showCopyFeedback: showCopyFeedback,
    bindCopyButtons: bindCopyButtons
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCopyButtons);
  } else {
    bindCopyButtons();
  }
})();
