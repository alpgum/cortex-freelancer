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
