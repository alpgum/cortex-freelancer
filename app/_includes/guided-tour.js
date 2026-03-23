/**
 * Guided Tour — 4-step first-visit spotlight walkthrough
 * Shows once per device via localStorage. CSS-only animations, no library.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_tour_done';
  if (localStorage.getItem(STORAGE_KEY)) return;

  var steps = [
    {
      target: '.hero, .tools-hero, [class*="hero"]',
      title: 'This is your dashboard',
      body: 'Everything you need to run your freelance business lives here. Tools, agents, and insights — all in one place.',
      fallback: { top: '50%', left: '50%', w: 300, h: 120 }
    },
    {
      target: '.nav-links a[href*="/app/tools"]',
      title: 'Your tools are here',
      body: 'Rate calculators, invoice generators, proposal writers — 20+ free tools built for freelancers.',
      fallback: null
    },
    {
      target: '.tool-card[data-name="Portfolio Review"], a[href*="portfolio-review"]',
      title: 'Try the Scorecard',
      body: 'Get an instant score on your freelancer profile. Share it on social media to attract clients.',
      fallback: null
    },
    {
      target: 'a[href="/pricing"], a[href*="pricing"]',
      title: 'Upgrade when you\'re ready',
      body: 'Start free — upgrade to Pro when you need unlimited access, priority support, and advanced agents.',
      fallback: null
    }
  ];

  // --- Build DOM ---
  var overlay = document.createElement('div');
  overlay.className = 'tour-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Guided tour');

  overlay.innerHTML =
    '<div class="tour-backdrop"></div>' +
    '<div class="tour-spotlight"></div>' +
    '<div class="tour-tooltip">' +
      '<div class="tour-tooltip-step">' +
        '<span class="tour-tooltip-badge"></span>' +
      '</div>' +
      '<h3 class="tour-title"></h3>' +
      '<p class="tour-body"></p>' +
      '<div class="tour-dots"></div>' +
      '<div class="tour-actions">' +
        '<button class="tour-skip">Skip tour</button>' +
        '<button class="tour-next">Next</button>' +
      '</div>' +
    '</div>';

  // --- Inject CSS ---
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/app/_includes/guided-tour.css';
  document.head.appendChild(link);

  // --- State ---
  var current = 0;
  var spotlight = overlay.querySelector('.tour-spotlight');
  var tooltip = overlay.querySelector('.tour-tooltip');
  var titleEl = overlay.querySelector('.tour-title');
  var bodyEl = overlay.querySelector('.tour-body');
  var badgeEl = overlay.querySelector('.tour-tooltip-badge');
  var dotsEl = overlay.querySelector('.tour-dots');
  var nextBtn = overlay.querySelector('.tour-next');
  var skipBtn = overlay.querySelector('.tour-skip');

  // Build dots
  for (var d = 0; d < steps.length; d++) {
    var dot = document.createElement('span');
    dot.className = 'tour-dot';
    dotsEl.appendChild(dot);
  }

  function findTarget(step) {
    var selectors = step.target.split(', ');
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) return el;
    }
    return null;
  }

  function positionSpotlight(rect) {
    var pad = 8;
    spotlight.style.top = (rect.top - pad) + 'px';
    spotlight.style.left = (rect.left - pad) + 'px';
    spotlight.style.width = (rect.width + pad * 2) + 'px';
    spotlight.style.height = (rect.height + pad * 2) + 'px';
  }

  function positionTooltip(rect) {
    var tw = Math.min(320, window.innerWidth * 0.9);
    var gap = 14;

    // Default: below target
    var top = rect.bottom + gap;
    var left = rect.left + rect.width / 2 - tw / 2;

    // If below goes off-screen, place above
    if (top + 180 > window.innerHeight) {
      top = rect.top - 180 - gap;
    }
    // Clamp horizontal
    if (left < 12) left = 12;
    if (left + tw > window.innerWidth - 12) left = window.innerWidth - tw - 12;
    // If above goes off-screen, center vertically
    if (top < 12) top = rect.bottom + gap;

    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.width = tw + 'px';
  }

  function showStep(index) {
    var step = steps[index];
    var el = findTarget(step);

    badgeEl.textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    nextBtn.textContent = index === steps.length - 1 ? 'Got it!' : 'Next';

    // Update dots
    var dots = dotsEl.querySelectorAll('.tour-dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].className = 'tour-dot' + (i < index ? ' done' : '') + (i === index ? ' active' : '');
    }

    var rect;
    if (el) {
      rect = el.getBoundingClientRect();
      // Scroll into view if needed
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () {
          rect = el.getBoundingClientRect();
          positionSpotlight(rect);
          positionTooltip(rect);
        }, 400);
        return;
      }
    } else {
      // Fallback: center of screen
      rect = {
        top: window.innerHeight * 0.3,
        left: window.innerWidth / 2 - 150,
        bottom: window.innerHeight * 0.3 + 120,
        width: 300,
        height: 120
      };
    }

    positionSpotlight(rect);
    positionTooltip(rect);
  }

  function endTour() {
    overlay.classList.remove('active');
    localStorage.setItem(STORAGE_KEY, '1');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 350);
  }

  nextBtn.addEventListener('click', function () {
    current++;
    if (current >= steps.length) {
      endTour();
    } else {
      showStep(current);
    }
  });

  skipBtn.addEventListener('click', endTour);

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      endTour();
    }
  });

  // Click backdrop to dismiss
  overlay.querySelector('.tour-backdrop').addEventListener('click', endTour);

  // --- Launch after page settles ---
  function launch() {
    document.body.appendChild(overlay);
    // Force reflow then activate
    overlay.offsetHeight; // eslint-disable-line no-unused-expressions
    overlay.classList.add('active');
    showStep(0);
  }

  // Reposition on resize
  window.addEventListener('resize', function () {
    if (overlay.classList.contains('active')) {
      showStep(current);
    }
  });

  // Delay start so DOM elements (nav, tools grid) are rendered
  if (document.readyState === 'complete') {
    setTimeout(launch, 800);
  } else {
    window.addEventListener('load', function () {
      setTimeout(launch, 800);
    });
  }
})();
