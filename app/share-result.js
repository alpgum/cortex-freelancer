// ── Share Result Button ──
// Adds a "Share Result" button to tool output pages that copies result text to clipboard.

(function () {
  'use strict';

  /**
   * Appends a styled "Share Result" button to the given container.
   * @param {string} containerId - ID of the container element to append the button to
   * @param {function} getResultText - Function that returns the result summary text to copy
   */
  window.addShareButton = function (containerId, getResultText) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('[share-result] Container not found:', containerId);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'share-result-btn';
    btn.innerHTML = '📤 Share Result';

    btn.addEventListener('click', async function () {
      const text = typeof getResultText === 'function' ? getResultText() : '';
      if (!text) return;

      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }

      showCopiedToast();
    });

    container.appendChild(btn);
  };

  function showCopiedToast() {
    let t = document.getElementById('share-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'share-toast';
      Object.assign(t.style, {
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%) translateY(80px)',
        background: '#6C5CE7',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.85rem',
        opacity: '0',
        transition: 'all 0.3s ease',
        zIndex: '100',
        pointerEvents: 'none'
      });
      document.body.appendChild(t);
    }

    t.textContent = '📋 Copied!';
    // Trigger reflow for re-animation
    void t.offsetWidth;
    Object.assign(t.style, {
      transform: 'translateX(-50%) translateY(0)',
      opacity: '1'
    });

    setTimeout(function () {
      Object.assign(t.style, {
        transform: 'translateX(-50%) translateY(80px)',
        opacity: '0'
      });
    }, 2500);
  }

  // Inject button styles
  const style = document.createElement('style');
  style.textContent = `
    .share-result-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      background: #6C5CE7;
      color: #e0e0e0;
      border: none;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 1rem;
    }
    .share-result-btn:hover {
      filter: brightness(1.15);
    }
  `;
  document.head.appendChild(style);
})();
