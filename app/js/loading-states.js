/**
 * CF-286: Loading States
 * Skeleton screens, spinners, progress bars, shimmer effects.
 *
 * @namespace window.CortexFreelancer.LoadingStates
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-loading-states-styles';

  var CSS = '\n\
@keyframes ct-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}\
@keyframes ct-pulse{0%,100%{opacity:1}50%{opacity:0.5}}\
@keyframes ct-progress-indeterminate{0%{left:-40%}100%{left:100%}}\
\
.ct-skeleton{background:linear-gradient(90deg,var(--ct-colors-neutral-200,#e5e7eb) 25%,var(--ct-colors-neutral-100,#f3f4f6) 50%,var(--ct-colors-neutral-200,#e5e7eb) 75%);background-size:200% 100%;animation:ct-shimmer 1.5s ease-in-out infinite;border-radius:var(--ct-radius-default,0.375rem)}\
.ct-skeleton--text{height:0.875rem;margin-bottom:0.5rem;width:100%}\
.ct-skeleton--text:last-child{width:60%}\
.ct-skeleton--heading{height:1.5rem;width:40%;margin-bottom:1rem}\
.ct-skeleton--avatar{width:40px;height:40px;border-radius:50%}\
.ct-skeleton--card{height:180px;border-radius:var(--ct-radius-lg,0.75rem)}\
.ct-skeleton--button{height:36px;width:100px;border-radius:var(--ct-radius-md,0.5rem)}\
.ct-skeleton--image{height:200px;border-radius:var(--ct-radius-md,0.5rem)}\
\
.ct-loading-spinner-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.75rem;padding:2rem}\
.ct-loading-spinner{width:32px;height:32px;border:3px solid var(--ct-colors-neutral-200,#e5e7eb);border-top-color:var(--ct-colors-primary-600,#4f46e5);border-radius:50%;animation:ct-spin 0.6s linear infinite}\
@keyframes ct-spin{to{transform:rotate(360deg)}}\
.ct-loading-text{font-size:0.875rem;color:var(--ct-colors-neutral-500,#6b7280)}\
\
.ct-progress{width:100%;height:6px;background:var(--ct-colors-neutral-200,#e5e7eb);border-radius:var(--ct-radius-full,9999px);overflow:hidden;position:relative}\
.ct-progress__bar{height:100%;background:var(--ct-colors-primary-600,#4f46e5);border-radius:var(--ct-radius-full,9999px);transition:width 0.3s ease}\
.ct-progress--indeterminate .ct-progress__bar{position:absolute;width:40%;animation:ct-progress-indeterminate 1.2s ease-in-out infinite}\
\
.ct-loading-overlay{position:absolute;inset:0;background:rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;z-index:10;border-radius:inherit}\
[data-theme="dark"] .ct-loading-overlay{background:rgba(17,24,39,0.8)}\
\
.ct-pulse{animation:ct-pulse 2s ease-in-out infinite}\
';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function skeleton(type) {
    return '<div class="ct-skeleton ct-skeleton--' + (type || 'text') + '"></div>';
  }

  function skeletonCard() {
    return '<div style="padding:1rem;border:1px solid var(--ct-colors-neutral-200,#e5e7eb);border-radius:var(--ct-radius-lg,0.75rem)">' +
      '<div style="display:flex;gap:0.75rem;margin-bottom:1rem">' +
      skeleton('avatar') +
      '<div style="flex:1">' + skeleton('text') + '<div class="ct-skeleton ct-skeleton--text" style="width:40%"></div></div>' +
      '</div>' +
      skeleton('text') + skeleton('text') + skeleton('text') +
      '<div style="margin-top:1rem">' + skeleton('button') + '</div></div>';
  }

  function spinner(text) {
    return '<div class="ct-loading-spinner-wrap">' +
      '<div class="ct-loading-spinner"></div>' +
      (text ? '<div class="ct-loading-text">' + text + '</div>' : '') +
      '</div>';
  }

  function progressBar(percent) {
    if (percent === undefined || percent === null) {
      return '<div class="ct-progress ct-progress--indeterminate"><div class="ct-progress__bar"></div></div>';
    }
    var p = Math.max(0, Math.min(100, percent));
    return '<div class="ct-progress"><div class="ct-progress__bar" style="width:' + p + '%" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100"></div></div>';
  }

  function showLoading(container, opts) {
    opts = opts || {};
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;

    el.style.position = el.style.position || 'relative';

    var overlay = document.createElement('div');
    overlay.className = 'ct-loading-overlay';
    overlay.setAttribute('data-ct-loading', 'true');

    if (opts.type === 'skeleton') {
      overlay.innerHTML = '<div style="width:80%;max-width:400px">' + skeletonCard() + '</div>';
    } else if (opts.type === 'progress') {
      overlay.innerHTML = '<div style="width:60%;max-width:300px">' + progressBar(opts.percent) + '</div>';
    } else {
      overlay.innerHTML = spinner(opts.text || 'Loading...');
    }

    el.appendChild(overlay);
  }

  function hideLoading(container) {
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    var overlays = el.querySelectorAll('[data-ct-loading]');
    overlays.forEach(function (o) { o.remove(); });
  }

  function renderLoadingShowcase() {
    var html = '<div style="font-family:var(--ct-typography-font-family,sans-serif);padding:1.5rem;display:flex;flex-direction:column;gap:2rem">';
    html += '<h2 style="font-size:1.5rem;font-weight:700">Loading States</h2>';

    // Skeletons
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Skeleton Screens</h3>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">';
    html += skeletonCard();
    html += '<div style="padding:1rem">' +
      skeleton('heading') +
      skeleton('image') +
      '<div style="margin-top:1rem">' + skeleton('text') + skeleton('text') + '</div></div>';
    html += '</div></section>';

    // Spinners
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Spinners</h3>';
    html += '<div style="display:flex;gap:2rem">';
    html += spinner('Loading data...');
    html += spinner('Analyzing...');
    html += '</div></section>';

    // Progress bars
    html += '<section><h3 style="font-weight:600;margin-bottom:0.75rem">Progress Bars</h3>';
    html += '<div style="display:flex;flex-direction:column;gap:0.75rem;max-width:400px">';
    html += '<div><div style="font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280);margin-bottom:0.25rem">25%</div>' + progressBar(25) + '</div>';
    html += '<div><div style="font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280);margin-bottom:0.25rem">60%</div>' + progressBar(60) + '</div>';
    html += '<div><div style="font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280);margin-bottom:0.25rem">90%</div>' + progressBar(90) + '</div>';
    html += '<div><div style="font-size:0.75rem;color:var(--ct-colors-neutral-500,#6b7280);margin-bottom:0.25rem">Indeterminate</div>' + progressBar() + '</div>';
    html += '</div></section>';

    html += '</div>';
    return html;
  }

  injectStyles();

  window.CortexFreelancer.LoadingStates = {
    skeleton: skeleton,
    skeletonCard: skeletonCard,
    spinner: spinner,
    progressBar: progressBar,
    showLoading: showLoading,
    hideLoading: hideLoading,
    renderLoadingShowcase: renderLoadingShowcase
  };
})();
