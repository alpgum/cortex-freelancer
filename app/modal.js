/* ===== CORTEX FREELANCER — MODAL COMPONENT SYSTEM ===== */

const Modal = (() => {
  let activeModal = null;
  let previousFocus = null;

  /**
   * Open a modal dialog.
   * @param {Object} options
   * @param {string} [options.title] - Modal title.
   * @param {string|HTMLElement} options.content - Body content (HTML string or element).
   * @param {'sm'|'md'|'lg'} [options.size='md'] - Modal size.
   * @param {boolean} [options.closeOnBackdrop=true] - Close when clicking backdrop.
   * @param {boolean} [options.closeOnEscape=true] - Close on Escape key.
   * @param {boolean} [options.showClose=true] - Show close button.
   * @param {Array} [options.footer] - Footer buttons: [{text, className, onClick}].
   * @param {Function} [options.onClose] - Callback when modal closes.
   * @returns {HTMLElement} The backdrop element.
   */
  function openModal(options = {}) {
    // Close any existing modal first
    if (activeModal) closeModal();

    const {
      title = '',
      content = '',
      size = 'md',
      closeOnBackdrop = true,
      closeOnEscape = true,
      showClose = true,
      footer = null,
      onClose = null
    } = options;

    previousFocus = document.activeElement;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop._onClose = onClose;
    backdrop._closeOnEscape = closeOnEscape;

    if (closeOnBackdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });
    }

    // Modal
    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    // Header
    if (title || showClose) {
      const header = document.createElement('div');
      header.className = 'modal-header';

      const titleEl = document.createElement('h3');
      titleEl.className = 'modal-title';
      titleEl.textContent = title;
      header.appendChild(titleEl);

      if (showClose) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close modal');
        closeBtn.addEventListener('click', closeModal);
        header.appendChild(closeBtn);
      }

      if (title) modal.setAttribute('aria-label', title);
      modal.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }
    modal.appendChild(body);

    // Footer
    if (footer && footer.length) {
      const footerEl = document.createElement('div');
      footerEl.className = 'modal-footer';
      footer.forEach(btn => {
        const button = document.createElement('button');
        button.className = btn.className || 'btn-secondary';
        button.textContent = btn.text || 'OK';
        if (btn.onClick) {
          button.addEventListener('click', btn.onClick);
        }
        footerEl.appendChild(button);
      });
      modal.appendChild(footerEl);
    }

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    activeModal = backdrop;

    // Focus trap
    setupFocusTrap(modal);

    // Escape key
    if (closeOnEscape) {
      document.addEventListener('keydown', handleEscape);
    }

    // Focus first focusable element
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();

    return backdrop;
  }

  function closeModal() {
    if (!activeModal) return;

    const backdrop = activeModal;
    const callback = backdrop._onClose;

    document.removeEventListener('keydown', handleEscape);
    backdrop.classList.add('modal-exit');

    backdrop.addEventListener('animationend', () => {
      backdrop.remove();
      document.body.style.overflow = '';
      if (previousFocus && previousFocus.focus) {
        previousFocus.focus();
      }
      if (typeof callback === 'function') callback();
    }, { once: true });

    activeModal = null;
  }

  function handleEscape(e) {
    if (e.key === 'Escape' && activeModal) {
      closeModal();
    }
  }

  function setupFocusTrap(modal) {
    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  return { open: openModal, close: closeModal };
})();

// Convenience globals
function openModal(options) { return Modal.open(options); }
function closeModal() { return Modal.close(); }

/* ===== [344] WAITLIST POPUP — Exit-intent + 30s timer ===== */
const WaitlistPopup = (() => {
  const STORAGE_KEY = 'cortex_waitlist_dismissed';
  const DELAY_MS = 30000;
  let shown = false;

  function alreadyDismissed() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* ignore */ }
  }

  function buildContent() {
    return '<div style="text-align:center">' +
      '<h2 style="font-size:1.4rem;font-weight:800;margin-bottom:.5rem">Before you go&hellip;</h2>' +
      '<p style="color:var(--text2);font-size:.95rem;margin-bottom:1.25rem">Join 2,400+ freelancers getting early access to AI tools that save hours every week.</p>' +
      '<form id="waitlist-popup-form" style="display:flex;gap:.5rem;max-width:380px;margin:0 auto">' +
        '<input type="email" id="waitlist-popup-email" placeholder="you@example.com" required ' +
          'style="flex:1;padding:.65rem 1rem;border-radius:100px;border:1px solid rgba(255,255,255,.15);background:var(--bg3,#1a1a1a);color:var(--text,#f0f0f0);font-size:.9rem;outline:none">' +
        '<button type="submit" style="background:linear-gradient(135deg,var(--orange,#ff8844),var(--orange2,#ff6622));color:#000;border:none;padding:.65rem 1.2rem;border-radius:100px;font-weight:700;font-size:.85rem;cursor:pointer;white-space:nowrap">Join Waitlist</button>' +
      '</form>' +
      '<p style="color:var(--text3,#666);font-size:.75rem;margin-top:.75rem">No spam. Unsubscribe anytime.</p>' +
    '</div>';
  }

  function show() {
    if (shown || alreadyDismissed()) return;
    shown = true;

    Modal.open({
      content: buildContent(),
      size: 'sm',
      showClose: true,
      onClose: markDismissed
    });

    setTimeout(() => {
      var form = document.getElementById('waitlist-popup-form');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var email = document.getElementById('waitlist-popup-email').value.trim();
          if (!email) return;

          var utm = window.CortexUTM ? window.CortexUTM.getAll() : {};

          fetch('/api/waitlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, source: 'exit_popup', utm: utm.utm || {}, referrer: utm.referrer || {} })
          }).catch(function () { /* silent */ });

          markDismissed();
          Modal.close();
        });
      }
    }, 0);
  }

  function init() {
    if (alreadyDismissed()) return;

    // Exit intent (mouse leaves viewport top)
    document.addEventListener('mouseout', function handler(e) {
      if (e.clientY <= 0) {
        document.removeEventListener('mouseout', handler);
        show();
      }
    });

    // 30-second timer fallback
    setTimeout(show, DELAY_MS);
  }

  // Auto-init on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { show: show };
})();
