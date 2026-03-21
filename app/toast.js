/* ===== CORTEX FREELANCER — TOAST NOTIFICATION SYSTEM ===== */

const Toast = (() => {
  const ICONS = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  const DEFAULT_DURATION = 3000;
  let container = null;

  function getContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a toast notification.
   * @param {string} message - The message to display.
   * @param {'success'|'error'|'info'|'warning'} [type='info'] - Toast type.
   * @param {number} [duration=3000] - Auto-dismiss time in ms. Pass 0 to disable.
   * @returns {HTMLElement} The toast element.
   */
  function showToast(message, type = 'info', duration = DEFAULT_DURATION) {
    const cont = getContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.textContent = ICONS[type] || ICONS.info;

    const msg = document.createElement('span');
    msg.className = 'toast-message';
    msg.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.addEventListener('click', () => dismissToast(toast));

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);
    cont.appendChild(toast);

    if (duration > 0) {
      toast._timeout = setTimeout(() => dismissToast(toast), duration);
    }

    return toast;
  }

  function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._timeout);
    toast.classList.add('toast-exit');
    toast.addEventListener('animationend', () => {
      toast.remove();
    }, { once: true });
  }

  // Public API
  return { show: showToast, dismiss: dismissToast };
})();

// Convenience global
function showToast(message, type, duration) {
  return Toast.show(message, type, duration);
}
