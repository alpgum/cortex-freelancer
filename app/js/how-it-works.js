/**
 * CF-231: 'How It Works' Section with 3-Step Visual
 * Step 1: Connect profile → Step 2: Get AI analysis → Step 3: Win more clients.
 * SVG icons, step connectors, animated entry.
 *
 * @namespace window.CortexFreelancer.HowItWorks
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-how-it-works-styles';
  var CONTAINER_CLASS = 'cf-how-it-works';

  var STEPS = [
    {
      number: 1,
      title: 'Connect Your Profile',
      description: 'Paste your Upwork profile URL and let our system import your data securely.',
      icon: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="#6c63ff" stroke-width="2.5" fill="#f0efff"/><path d="M24 14v10l7 4" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 30c0-5 4-9 9-9s9 4 9 9" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="18" r="4" stroke="#6c63ff" stroke-width="2.5"/></svg>'
    },
    {
      number: 2,
      title: 'Get AI Analysis',
      description: 'Our AI reviews your profile, rates, proposals, and competition to find opportunities.',
      icon: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="#6c63ff" stroke-width="2.5" fill="#f0efff"/><rect x="14" y="20" width="20" height="14" rx="2" stroke="#6c63ff" stroke-width="2.5"/><path d="M18 26h4M18 30h8" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round"/><path d="M20 14l4 6 4-6" stroke="#6c63ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    },
    {
      number: 3,
      title: 'Win More Clients',
      description: 'Apply AI-powered recommendations to boost your profile and close more deals.',
      icon: '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" stroke="#6c63ff" stroke-width="2.5" fill="#f0efff"/><path d="M24 14l3 6 7 1-5 5 1.2 7-6.2-3.3L17.8 33 19 26l-5-5 7-1z" stroke="#6c63ff" stroke-width="2.5" stroke-linejoin="round"/></svg>'
    }
  ];

  // ─── Helpers ───────────────────────────────────────────

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ─── Styles ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.' + CONTAINER_CLASS + ' { max-width: 900px; margin: 0 auto; text-align: center; padding: 60px 20px; }',
      '.' + CONTAINER_CLASS + ' h2 { font-size: 32px; color: #1a1a2e; margin: 0 0 12px; }',
      '.' + CONTAINER_CLASS + ' .cf-hiw-subtitle { color: #666; font-size: 16px; margin: 0 0 48px; }',
      '.cf-hiw-steps { display: flex; align-items: flex-start; justify-content: center; gap: 0; position: relative; }',
      '.cf-hiw-step { flex: 1; max-width: 260px; padding: 0 16px; text-align: center; opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }',
      '.cf-hiw-step.visible { opacity: 1; transform: translateY(0); }',
      '.cf-hiw-step:nth-child(2) { transition-delay: 0.15s; }',
      '.cf-hiw-step:nth-child(3) { transition-delay: 0.3s; }',
      '.cf-hiw-icon { width: 80px; height: 80px; margin: 0 auto 16px; }',
      '.cf-hiw-icon svg { width: 100%; height: 100%; }',
      '.cf-hiw-number { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #6c63ff; color: #fff; border-radius: 50%; font-size: 14px; font-weight: 700; margin-bottom: 8px; }',
      '.cf-hiw-step h3 { font-size: 18px; color: #1a1a2e; margin: 0 0 8px; }',
      '.cf-hiw-step p { font-size: 14px; color: #666; line-height: 1.6; margin: 0; }',
      '.cf-hiw-connector { display: flex; align-items: center; padding-top: 40px; }',
      '.cf-hiw-connector svg { width: 40px; height: 20px; color: #6c63ff; }',
      '@media (max-width: 640px) {',
      '  .cf-hiw-steps { flex-direction: column; align-items: center; gap: 32px; }',
      '  .cf-hiw-connector { display: none; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Render ────────────────────────────────────────────

  var connectorSVG = '<svg viewBox="0 0 40 20" fill="none"><path d="M0 10h30M25 4l8 6-8 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function renderStep(step) {
    return [
      '<div class="cf-hiw-step">',
      '  <div class="cf-hiw-icon">' + step.icon + '</div>',
      '  <span class="cf-hiw-number">' + step.number + '</span>',
      '  <h3>' + esc(step.title) + '</h3>',
      '  <p>' + esc(step.description) + '</p>',
      '</div>'
    ].join('');
  }

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    injectStyles();

    var stepsHtml = '';
    for (var i = 0; i < STEPS.length; i++) {
      if (i > 0) {
        stepsHtml += '<div class="cf-hiw-connector">' + connectorSVG + '</div>';
      }
      stepsHtml += renderStep(STEPS[i]);
    }

    container.innerHTML = [
      '<div class="' + CONTAINER_CLASS + '">',
      '  <h2>How It Works</h2>',
      '  <p class="cf-hiw-subtitle">Three simple steps to transform your freelancing career</p>',
      '  <div class="cf-hiw-steps">' + stepsHtml + '</div>',
      '</div>'
    ].join('');

    // Animate steps in on scroll
    var steps = container.querySelectorAll('.cf-hiw-step');
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      for (var j = 0; j < steps.length; j++) {
        observer.observe(steps[j]);
      }
    } else {
      // Fallback: show all immediately
      for (var k = 0; k < steps.length; k++) {
        steps[k].classList.add('visible');
      }
    }
  }

  // ─── Public API ────────────────────────────────────────

  function init(containerId) {
    render(containerId || 'cf-how-it-works');
  }

  window.CortexFreelancer.HowItWorks = {
    init: init,
    render: render,
    STEPS: STEPS
  };
})();
