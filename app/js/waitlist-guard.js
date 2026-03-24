/**
 * CF-118: Fix waitlist form double-submission
 * Adds loading state and disables button after first click, debounces submit.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const WaitlistGuard = {
    submitting: false,

    init() {
      document.addEventListener('DOMContentLoaded', () => this.bind());
    },

    bind() {
      const forms = document.querySelectorAll(
        '#waitlist-form, .waitlist-form, [data-form="waitlist"], #contact-form, .contact-form'
      );
      forms.forEach(form => this.guard(form));
    },

    guard(form) {
      form.addEventListener('submit', (e) => {
        if (this.submitting) {
          e.preventDefault();
          return;
        }

        this.submitting = true;
        const btn = form.querySelector('button[type="submit"], input[type="submit"], .submit-btn');
        if (btn) {
          btn.disabled = true;
          btn.dataset.originalText = btn.textContent || btn.value;
          if (btn.tagName === 'INPUT') {
            btn.value = 'Submitting...';
          } else {
            btn.textContent = 'Submitting...';
          }
          btn.style.opacity = '0.7';
          btn.style.cursor = 'not-allowed';
        }

        // Reset after timeout in case submission hangs
        setTimeout(() => this.reset(form, btn), 15000);
      });
    },

    reset(form, btn) {
      this.submitting = false;
      if (btn) {
        btn.disabled = false;
        const original = btn.dataset.originalText;
        if (btn.tagName === 'INPUT') {
          btn.value = original || 'Submit';
        } else {
          btn.textContent = original || 'Submit';
        }
        btn.style.opacity = '';
        btn.style.cursor = '';
      }
    },

    onSuccess(form) {
      const btn = form.querySelector('button[type="submit"], input[type="submit"], .submit-btn');
      if (btn) {
        btn.textContent = 'Submitted!';
        btn.style.background = 'var(--success, #28a745)';
      }
      this.submitting = false;
    }
  };

  WaitlistGuard.init();
  window.CortexFreelancer.WaitlistGuard = WaitlistGuard;
})();
