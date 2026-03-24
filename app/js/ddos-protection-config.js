/**
 * CF-278: DDoS Protection Configuration
 * Client-side request throttling, bot detection, and protection status dashboard.
 */
(function () {
  'use strict';

  var MAX_REQUESTS_PER_MINUTE = 120;
  var MAX_REQUESTS_PER_SECOND = 10;
  var BLOCK_DURATION = 300000;
  var requestLog = [];
  var blocked = false;
  var blockUntil = 0;

  function logRequest() {
    var now = Date.now();
    requestLog = requestLog.filter(function (ts) { return now - ts < 60000; });
    requestLog.push(now);

    var lastSecond = requestLog.filter(function (ts) { return now - ts < 1000; }).length;
    if (lastSecond > MAX_REQUESTS_PER_SECOND || requestLog.length > MAX_REQUESTS_PER_MINUTE) {
      blocked = true;
      blockUntil = now + BLOCK_DURATION;
    }
  }

  function isBlocked() {
    if (blocked && Date.now() > blockUntil) {
      blocked = false;
      requestLog = [];
    }
    return blocked;
  }

  function getRequestRate() {
    var now = Date.now();
    requestLog = requestLog.filter(function (ts) { return now - ts < 60000; });
    return {
      perSecond: requestLog.filter(function (ts) { return now - ts < 1000; }).length,
      perMinute: requestLog.length
    };
  }

  function detectBot() {
    var signals = [];
    if (navigator.webdriver) signals.push('webdriver_detected');
    if (!window.chrome && /Chrome/.test(navigator.userAgent)) signals.push('headless_chrome_suspected');
    if (!navigator.languages || navigator.languages.length === 0) signals.push('no_languages');
    if (window._phantom || window.__nightmare || window.callPhantom) signals.push('automation_framework');
    if (screen.width === 0 || screen.height === 0) signals.push('zero_screen_size');
    return { isBot: signals.length >= 2, signals: signals };
  }

  function generateCloudflareRules() {
    return {
      security_level: 'high',
      challenge_passage: 1800,
      browser_integrity_check: true,
      rules: [
        { description: 'Block known bad bots', expression: '(cf.client.bot) or (cf.threat_score gt 30)', action: 'block' },
        { description: 'Challenge suspicious traffic', expression: '(cf.threat_score gt 10) and (http.request.uri.path contains "/api/")', action: 'challenge' },
        { description: 'Rate limit API', expression: '(http.request.uri.path contains "/api/")', action: 'rate_limit', rateLimit: { requests: 60, period: 60 } }
      ]
    };
  }

  function getProtectionStatus() {
    var rate = getRequestRate();
    return {
      requestRate: rate,
      isBlocked: isBlocked(),
      botDetection: detectBot(),
      limits: { perSecond: MAX_REQUESTS_PER_SECOND, perMinute: MAX_REQUESTS_PER_MINUTE }
    };
  }

  function createProtectedFetch() {
    return function (url, options) {
      if (isBlocked()) return Promise.reject(new Error('Rate limited. Please wait.'));
      logRequest();
      if (isBlocked()) return Promise.reject(new Error('Rate limit exceeded.'));
      return fetch(url, options);
    };
  }

  function render(container) {
    if (!container) return;
    var status = getProtectionStatus();
    var rateColor = status.requestRate.perMinute > MAX_REQUESTS_PER_MINUTE * 0.8 ? '#f59e0b' : '#10b981';

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
    html += '<div style="padding:12px;border-radius:8px;border:1px solid #e5e7eb">' +
      '<div style="font-size:12px;color:#9ca3af">Requests/min</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + rateColor + '">' + status.requestRate.perMinute + '/' + status.limits.perMinute + '</div></div>';
    html += '<div style="padding:12px;border-radius:8px;border:1px solid #e5e7eb">' +
      '<div style="font-size:12px;color:#9ca3af">Status</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + (status.isBlocked ? '#ef4444' : '#10b981') + '">' + (status.isBlocked ? 'Blocked' : 'Normal') + '</div></div>';
    html += '</div>';

    html += '<div style="padding:12px;border-radius:8px;border:1px solid #e5e7eb">' +
      '<div style="font-weight:600;margin-bottom:8px">Bot Detection</div>' +
      '<div style="color:' + (status.botDetection.isBot ? '#ef4444' : '#10b981') + '">' +
      (status.botDetection.isBot ? 'Bot Suspected' : 'Human Detected') + '</div></div>';

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.DdosProtection = {
    logRequest: logRequest,
    isBlocked: isBlocked,
    getRequestRate: getRequestRate,
    detectBot: detectBot,
    generateCloudflareRules: generateCloudflareRules,
    getProtectionStatus: getProtectionStatus,
    createProtectedFetch: createProtectedFetch,
    render: render
  };
})();
