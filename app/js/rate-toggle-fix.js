/**
 * CF-114: Fix rate calculator not handling hourly ↔ project toggle
 * Ensures rate calculator correctly switches between hourly and fixed-price modes.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  var HOURS_PER_WEEK_DEFAULT = 40;
  var WEEKS_PER_PROJECT_DEFAULT = 4;

  function init() {
    var toggle = document.querySelector('[data-rate-toggle], #rate-mode-toggle, .rate-mode-toggle');
    var hourlyFields = document.querySelector('.hourly-fields, [data-mode="hourly"]');
    var projectFields = document.querySelector('.project-fields, [data-mode="project"]');
    var rateInput = document.querySelector('#hourly-rate, [name="hourlyRate"]');
    var projectInput = document.querySelector('#project-rate, [name="projectRate"]');

    if (!toggle) return;

    function switchMode(mode) {
      var isHourly = mode === 'hourly';

      if (hourlyFields) hourlyFields.style.display = isHourly ? '' : 'none';
      if (projectFields) projectFields.style.display = isHourly ? 'none' : '';

      // Auto-convert values
      if (rateInput && projectInput) {
        var hourly = parseFloat(rateInput.value) || 0;
        var project = parseFloat(projectInput.value) || 0;

        if (isHourly && project > 0 && !hourly) {
          rateInput.value = (project / (HOURS_PER_WEEK_DEFAULT * WEEKS_PER_PROJECT_DEFAULT)).toFixed(2);
        } else if (!isHourly && hourly > 0 && !project) {
          projectInput.value = (hourly * HOURS_PER_WEEK_DEFAULT * WEEKS_PER_PROJECT_DEFAULT).toFixed(0);
        }
      }

      toggle.setAttribute('data-mode', mode);
      // Update toggle visual
      toggle.querySelectorAll('[data-value]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-value') === mode);
      });

      // Dispatch change event for other listeners
      toggle.dispatchEvent(new CustomEvent('ratemodechange', { detail: { mode: mode } }));
    }

    // Handle toggle clicks
    toggle.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-value]');
      if (btn) {
        switchMode(btn.getAttribute('data-value'));
        return;
      }
      // Simple toggle between modes
      var current = toggle.getAttribute('data-mode') || 'hourly';
      switchMode(current === 'hourly' ? 'project' : 'hourly');
    });

    // Handle change events (for select/radio toggles)
    toggle.addEventListener('change', function (e) {
      if (e.target.value) switchMode(e.target.value);
    });

    // Initialize default mode
    var initial = toggle.getAttribute('data-mode') || 'hourly';
    switchMode(initial);
  }

  window.CortexFreelancer.RateToggleFix = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
