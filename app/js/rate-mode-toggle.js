/**
 * CF-114: Fix rate calculator not handling hourly ↔ project toggle
 * Ensures rate calculator correctly switches between hourly and fixed-price modes.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const RateModeToggle = {
    mode: 'hourly',

    init() {
      document.addEventListener('DOMContentLoaded', () => this.bind());
    },

    bind() {
      const toggleBtns = document.querySelectorAll('[data-rate-mode], .rate-mode-btn, #rate-mode-toggle');
      toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const newMode = e.target.dataset.rateMode ||
                          (this.mode === 'hourly' ? 'project' : 'hourly');
          this.setMode(newMode);
        });
      });

      const select = document.querySelector('#rate-type, [name="rate-type"]');
      if (select) {
        select.addEventListener('change', (e) => this.setMode(e.target.value));
      }
    },

    setMode(mode) {
      this.mode = mode;
      const hourlyFields = document.querySelectorAll('.hourly-fields, [data-mode="hourly"]');
      const projectFields = document.querySelectorAll('.project-fields, [data-mode="project"]');

      hourlyFields.forEach(el => {
        el.style.display = mode === 'hourly' ? '' : 'none';
      });
      projectFields.forEach(el => {
        el.style.display = mode === 'project' ? '' : 'none';
      });

      document.querySelectorAll('[data-rate-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.rateMode === mode);
      });

      this.recalculate();
    },

    recalculate() {
      const rateInput = document.querySelector('#hourly-rate, #rate-input');
      const hoursInput = document.querySelector('#weekly-hours, #hours-input');
      const projectInput = document.querySelector('#project-rate, #project-input');

      if (!rateInput) return;

      const rate = parseFloat(rateInput.value) || 0;
      const hours = parseFloat(hoursInput?.value) || 40;

      if (this.mode === 'hourly') {
        const weekly = rate * hours;
        const monthly = weekly * 4.33;
        const yearly = monthly * 12;
        this.updateDisplay({ hourly: rate, weekly, monthly, yearly });
      } else {
        const projectRate = parseFloat(projectInput?.value) || 0;
        const estHours = parseFloat(document.querySelector('#est-hours')?.value) || 1;
        const effectiveHourly = projectRate / estHours;
        this.updateDisplay({
          project: projectRate,
          effectiveHourly,
          monthly: effectiveHourly * hours * 4.33,
          yearly: effectiveHourly * hours * 4.33 * 12
        });
      }
    },

    updateDisplay(values) {
      Object.entries(values).forEach(([key, val]) => {
        const el = document.querySelector(`#${key}-result, [data-result="${key}"]`);
        if (el) {
          el.textContent = typeof val === 'number' ? '$' + val.toFixed(2) : val;
        }
      });

      const event = new CustomEvent('rateCalculated', { detail: values });
      document.dispatchEvent(event);
    }
  };

  RateModeToggle.init();
  window.CortexFreelancer.RateModeToggle = RateModeToggle;
})();
