/**
 * CF-232: Video Demo Embed on Landing Page
 * Embed 60-second demo video with custom play button overlay,
 * lazy loading, and play/pause event tracking.
 *
 * @namespace window.CortexFreelancer.VideoDemo
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-video-demo-styles';
  var METRICS_KEY = 'cf_video_metrics';

  var state = {
    containerId: null,
    videoUrl: null,
    posterUrl: null,
    playing: false,
    loaded: false,
    onEvent: null
  };

  // ─── Helpers ───────────────────────────────────────────

  function getMetrics() {
    try {
      return JSON.parse(localStorage.getItem(METRICS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function trackEvent(event) {
    var metrics = getMetrics();
    metrics[event] = (metrics[event] || 0) + 1;
    metrics.lastEvent = event;
    metrics.lastEventTime = new Date().toISOString();
    try {
      localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
    } catch (e) { /* noop */ }
    if (typeof state.onEvent === 'function') {
      state.onEvent(event, metrics);
    }
  }

  // ─── Styles ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.cf-video-demo { max-width: 800px; margin: 0 auto; position: relative; border-radius: 12px; overflow: hidden; background: #000; aspect-ratio: 16/9; }',
      '.cf-video-demo video { width: 100%; height: 100%; object-fit: cover; display: block; }',
      '.cf-video-overlay {',
      '  position: absolute; top: 0; left: 0; width: 100%; height: 100%;',
      '  display: flex; align-items: center; justify-content: center;',
      '  background: rgba(0,0,0,0.35); cursor: pointer;',
      '  transition: opacity 0.3s ease;',
      '}',
      '.cf-video-overlay.hidden { opacity: 0; pointer-events: none; }',
      '.cf-video-play-btn {',
      '  width: 72px; height: 72px; background: rgba(255,255,255,0.95);',
      '  border-radius: 50%; display: flex; align-items: center; justify-content: center;',
      '  box-shadow: 0 4px 24px rgba(0,0,0,0.3); transition: transform 0.2s;',
      '}',
      '.cf-video-overlay:hover .cf-video-play-btn { transform: scale(1.1); }',
      '.cf-video-play-btn svg { width: 28px; height: 28px; margin-left: 4px; }',
      '.cf-video-poster { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; }',
      '.cf-video-poster.hidden { display: none; }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Render ────────────────────────────────────────────

  var playSVG = '<svg viewBox="0 0 24 24" fill="#6c63ff"><polygon points="5,3 19,12 5,21"/></svg>';

  function render() {
    var container = document.getElementById(state.containerId);
    if (!container) return;
    injectStyles();

    var posterAttr = state.posterUrl ? ' poster="' + state.posterUrl + '"' : '';

    container.innerHTML = [
      '<div class="cf-video-demo">',
      '  <video preload="none"' + posterAttr + ' playsinline>',
      state.videoUrl ? '    <source src="' + state.videoUrl + '" type="video/mp4" />' : '',
      '    Your browser does not support the video tag.',
      '  </video>',
      state.posterUrl ? '  <img class="cf-video-poster" src="' + state.posterUrl + '" alt="Video thumbnail" />' : '',
      '  <div class="cf-video-overlay">',
      '    <div class="cf-video-play-btn">' + playSVG + '</div>',
      '  </div>',
      '</div>'
    ].join('\n');

    var video = container.querySelector('video');
    var overlay = container.querySelector('.cf-video-overlay');
    var poster = container.querySelector('.cf-video-poster');

    // Lazy load: only load video src when play is clicked
    overlay.addEventListener('click', function () {
      if (!state.loaded && video.preload === 'none') {
        video.preload = 'auto';
        video.load();
        state.loaded = true;
      }
      if (poster) poster.classList.add('hidden');
      overlay.classList.add('hidden');
      video.play();
      trackEvent('play');
      state.playing = true;
    });

    // Click video to toggle pause/play
    video.addEventListener('click', function () {
      if (video.paused) {
        video.play();
        overlay.classList.add('hidden');
        trackEvent('resume');
        state.playing = true;
      } else {
        video.pause();
        overlay.classList.remove('hidden');
        trackEvent('pause');
        state.playing = false;
      }
    });

    video.addEventListener('ended', function () {
      overlay.classList.remove('hidden');
      state.playing = false;
      trackEvent('completed');
    });
  }

  // ─── Public API ────────────────────────────────────────

  function init(options) {
    options = options || {};
    state.containerId = options.containerId || 'cf-video-demo';
    state.videoUrl = options.videoUrl || '';
    state.posterUrl = options.posterUrl || '';
    state.onEvent = options.onEvent || null;
    render();
  }

  function getMetrics() {
    try {
      return JSON.parse(localStorage.getItem(METRICS_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  window.CortexFreelancer.VideoDemo = {
    init: init,
    getMetrics: getMetrics
  };
})();
