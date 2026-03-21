/**
 * Cortex Freelancer — Export Watermark Module
 * Adds "Powered by Cortex Freelancer" watermark to free-tier exports.
 * Pro users get clean exports with no watermark.
 *
 * Usage:
 *   import { applyTextWatermark, applyPDFWatermark, isProUser } from './export-watermark.js';
 *   // or in non-module pages:
 *   <script src="/app/export-watermark.js"></script>
 *   // then use window.CortexWatermark.applyText(text), etc.
 */

(function (root) {
  'use strict';

  var WATERMARK_LINE = '\n\n---\nPowered by Cortex Freelancer | cortexfreelancer.com\nUpgrade to Pro for clean, watermark-free exports.\n';
  var WATERMARK_HTML = '<div class="cortex-watermark" style="margin-top:2rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.08);text-align:center;font-size:.75rem;color:#888;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif"><span style="opacity:.7">Powered by</span> <strong style="color:#ff8844">Cortex Freelancer</strong> <span style="opacity:.5">&middot;</span> <a href="https://cortexfreelancer.com/pricing" style="color:#ff8844;text-decoration:none">Upgrade to Pro</a> for clean exports</div>';

  /**
   * Check if the current user has Pro status.
   * Relies on window.checkProStatus from pro-status.js + auth.
   * Returns a Promise<boolean>.
   */
  function isProUser() {
    return new Promise(function (resolve) {
      // If pro-status.js already resolved
      if (root.__cortexProResolved !== undefined) {
        resolve(!!root.__cortexProResolved);
        return;
      }

      // Listen for auth-ready to check pro
      function onAuth(e) {
        var uid = e.detail && e.detail.uid;
        if (uid && root.checkProStatus) {
          root.checkProStatus(uid).then(function (isPro) {
            root.__cortexProResolved = isPro;
            resolve(isPro);
          }).catch(function () { resolve(false); });
        } else {
          root.__cortexProResolved = false;
          resolve(false);
        }
        document.removeEventListener('cortex-auth-ready', onAuth);
      }

      // If auth already fired, use firebase auth state
      if (root.firebase && root.firebase.auth) {
        var user = root.firebase.auth().currentUser;
        if (user && root.checkProStatus) {
          root.checkProStatus(user.uid).then(function (isPro) {
            root.__cortexProResolved = isPro;
            resolve(isPro);
          }).catch(function () { resolve(false); });
          return;
        }
      }

      document.addEventListener('cortex-auth-ready', onAuth);
      // Timeout fallback — assume free tier after 3s
      setTimeout(function () {
        if (root.__cortexProResolved === undefined) {
          root.__cortexProResolved = false;
          resolve(false);
        }
      }, 3000);
    });
  }

  /**
   * Apply watermark to plain text export.
   * @param {string} text - The export text content
   * @returns {Promise<string>} - Text with or without watermark
   */
  function applyTextWatermark(text) {
    return isProUser().then(function (isPro) {
      if (isPro) return text;
      return text + WATERMARK_LINE;
    });
  }

  /**
   * Apply watermark to plain text export (sync version).
   * Uses cached pro state if available, otherwise adds watermark.
   * @param {string} text - The export text content
   * @returns {string} - Text with or without watermark
   */
  function applyTextWatermarkSync(text) {
    if (root.__cortexProResolved) return text;
    return text + WATERMARK_LINE;
  }

  /**
   * Apply watermark HTML to an export container element.
   * @param {HTMLElement} container - The element to append watermark to
   * @returns {Promise<void>}
   */
  function applyHTMLWatermark(container) {
    return isProUser().then(function (isPro) {
      if (isPro) return;
      // Remove any existing watermark first
      var existing = container.querySelector('.cortex-watermark');
      if (existing) existing.remove();
      container.insertAdjacentHTML('beforeend', WATERMARK_HTML);
    });
  }

  /**
   * Inject a watermark into the page before window.print() for PDF exports.
   * Automatically removes the watermark after printing.
   * @returns {Promise<void>}
   */
  function applyPDFWatermark() {
    return isProUser().then(function (isPro) {
      if (isPro) {
        window.print();
        return;
      }

      // Create watermark element for print
      var watermark = document.createElement('div');
      watermark.className = 'cortex-watermark cortex-print-watermark';
      watermark.innerHTML = '<div style="text-align:center;padding:1.5rem 0;border-top:2px solid #ddd;margin-top:2rem;font-family:Inter,sans-serif">' +
        '<div style="font-size:11px;color:#888">Powered by <strong style="color:#ff8844">Cortex Freelancer</strong></div>' +
        '<div style="font-size:9px;color:#aaa;margin-top:4px">Upgrade to Pro at cortexfreelancer.com/pricing for watermark-free exports</div>' +
        '</div>';

      // Add print-only style
      var style = document.createElement('style');
      style.id = 'cortex-watermark-print-style';
      style.textContent = '@media screen { .cortex-print-watermark { display: none !important; } } @media print { .cortex-print-watermark { display: block !important; } }';
      document.head.appendChild(style);
      document.body.appendChild(watermark);

      window.print();

      // Clean up after print
      setTimeout(function () {
        watermark.remove();
        style.remove();
      }, 1000);
    });
  }

  // Public API
  var CortexWatermark = {
    isProUser: isProUser,
    applyText: applyTextWatermark,
    applyTextSync: applyTextWatermarkSync,
    applyHTML: applyHTMLWatermark,
    applyPDF: applyPDFWatermark,
    WATERMARK_LINE: WATERMARK_LINE,
    WATERMARK_HTML: WATERMARK_HTML
  };

  // Export for script tag usage
  root.CortexWatermark = CortexWatermark;

  // Export for ES module usage
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CortexWatermark;
  }

})(typeof window !== 'undefined' ? window : this);
