/**
 * CF-278 DDoS Protection Config
 * Client-side rate limiter, captcha trigger, request fingerprinting
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const CONFIG = {
    formSubmitLimit: 5,
    formSubmitWindow: 60000,
    apiCallLimit: 30,
    apiCallWindow: 60000,
    captchaThreshold: 3,
    suspiciousPatterns: ['rapid-fire', 'identical-payload', 'missing-referer', 'bot-ua'],
    blockDuration: 300000
  };

  const state = {
    formSubmits: [],
    apiCalls: [],
    violations: 0,
    blocked: false,
    blockedUntil: null,
    fingerprint: null,
    events: []
  };

  function generateFingerprint() {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 'unknown',
      navigator.platform
    ];
    let hash = 0;
    const str = components.join('|');
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    state.fingerprint = 'fp_' + Math.abs(hash).toString(36);
    return state.fingerprint;
  }

  function logEvent(type, detail) {
    const entry = { type, detail, time: Date.now(), fingerprint: state.fingerprint };
    state.events.push(entry);
    if (state.events.length > 200) state.events.shift();
    return entry;
  }

  function pruneWindow(arr, windowMs) {
    const cutoff = Date.now() - windowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();
  }

  function checkRateLimit(arr, limit, windowMs) {
    pruneWindow(arr, windowMs);
    arr.push(Date.now());
    return arr.length <= limit;
  }

  function isBlocked() {
    if (!state.blocked) return false;
    if (Date.now() > state.blockedUntil) {
      state.blocked = false;
      state.blockedUntil = null;
      state.violations = 0;
      logEvent('unblock', 'Block period expired');
      return false;
    }
    return true;
  }

  function blockClient() {
    state.blocked = true;
    state.blockedUntil = Date.now() + CONFIG.blockDuration;
    logEvent('block', `Blocked for ${CONFIG.blockDuration / 1000}s`);
  }

  function recordViolation(reason) {
    state.violations++;
    logEvent('violation', reason);
    if (state.violations >= CONFIG.captchaThreshold) {
      blockClient();
      return { action: 'blocked', reason };
    }
    if (state.violations >= CONFIG.captchaThreshold - 1) {
      logEvent('captcha-trigger', 'Suspicious activity detected');
      return { action: 'captcha', reason };
    }
    return { action: 'warn', reason };
  }

  function checkFormSubmit(formId) {
    if (isBlocked()) return { allowed: false, action: 'blocked', reason: 'Client is temporarily blocked' };
    if (!checkRateLimit(state.formSubmits, CONFIG.formSubmitLimit, CONFIG.formSubmitWindow)) {
      const result = recordViolation('Form submit rate limit exceeded: ' + (formId || 'unknown'));
      return { allowed: false, ...result };
    }
    logEvent('form-submit', formId || 'unknown');
    return { allowed: true, action: 'allow' };
  }

  function checkApiCall(endpoint) {
    if (isBlocked()) return { allowed: false, action: 'blocked', reason: 'Client is temporarily blocked' };
    if (!checkRateLimit(state.apiCalls, CONFIG.apiCallLimit, CONFIG.apiCallWindow)) {
      const result = recordViolation('API rate limit exceeded: ' + (endpoint || 'unknown'));
      return { allowed: false, ...result };
    }
    return { allowed: true, action: 'allow' };
  }

  function detectSuspiciousActivity() {
    const flags = [];
    const now = Date.now();

    // Rapid-fire: more than 10 events in last 5 seconds
    const recentEvents = state.events.filter(e => now - e.time < 5000);
    if (recentEvents.length > 10) flags.push('rapid-fire');

    // Identical payloads in sequence
    const last5 = state.events.slice(-5);
    if (last5.length === 5 && new Set(last5.map(e => e.detail)).size === 1) {
      flags.push('identical-payload');
    }

    // Bot user-agent patterns
    const ua = navigator.userAgent.toLowerCase();
    if (/bot|crawl|spider|scrape|headless|phantom|selenium/i.test(ua)) {
      flags.push('bot-ua');
    }

    if (flags.length) {
      flags.forEach(f => logEvent('suspicious', f));
    }
    return flags;
  }

  function getSecurityStats() {
    const now = Date.now();
    pruneWindow(state.formSubmits, CONFIG.formSubmitWindow);
    pruneWindow(state.apiCalls, CONFIG.apiCallWindow);
    return {
      fingerprint: state.fingerprint,
      blocked: state.blocked,
      blockedUntil: state.blockedUntil ? new Date(state.blockedUntil).toISOString() : null,
      violations: state.violations,
      recentFormSubmits: state.formSubmits.length,
      recentApiCalls: state.apiCalls.length,
      formLimit: CONFIG.formSubmitLimit,
      apiLimit: CONFIG.apiCallLimit,
      totalEvents: state.events.length,
      last10Events: state.events.slice(-10)
    };
  }

  function renderSecurityDashboard(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!state.fingerprint) generateFingerprint();
    const stats = getSecurityStats();
    const suspicious = detectSuspiciousActivity();
    const statusColor = stats.blocked ? '#ef4444' : suspicious.length ? '#f59e0b' : '#22c55e';
    const statusText = stats.blocked ? 'BLOCKED' : suspicious.length ? 'SUSPICIOUS' : 'NORMAL';

    el.innerHTML = `
      <div style="font-family:var(--font-main,system-ui);max-width:800px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <h2 style="margin:0">Security Dashboard</h2>
          <span style="background:${statusColor};color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600">${statusText}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
          ${[
            ['Fingerprint', stats.fingerprint || '—'],
            ['Violations', stats.violations + '/' + CONFIG.captchaThreshold],
            ['Form Submits', stats.recentFormSubmits + '/' + stats.formLimit + ' (1 min)'],
            ['API Calls', stats.recentApiCalls + '/' + stats.apiLimit + ' (1 min)']
          ].map(([label, val]) => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:12px;color:#64748b;margin-bottom:4px">${label}</div>
              <div style="font-size:16px;font-weight:700">${val}</div>
            </div>
          `).join('')}
        </div>

        ${stats.blocked ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-bottom:16px;color:#991b1b;font-size:14px">
            Client blocked until ${stats.blockedUntil ? new Date(stats.blockedUntil).toLocaleTimeString() : 'unknown'}
          </div>
        ` : ''}

        ${suspicious.length ? `
          <div style="background:#fffbeb;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin-bottom:16px;font-size:14px">
            <strong style="color:#92400e">Suspicious patterns detected:</strong>
            <span style="color:#78350f"> ${suspicious.join(', ')}</span>
          </div>
        ` : ''}

        <h3 style="margin:24px 0 12px;font-size:15px">Rate Limits</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid #e2e8f0;text-align:left">
              <th style="padding:8px 12px">Type</th>
              <th style="padding:8px 12px">Limit</th>
              <th style="padding:8px 12px">Window</th>
              <th style="padding:8px 12px">Current</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:8px 12px">Form Submissions</td>
              <td style="padding:8px 12px">${CONFIG.formSubmitLimit}</td>
              <td style="padding:8px 12px">${CONFIG.formSubmitWindow / 1000}s</td>
              <td style="padding:8px 12px">${stats.recentFormSubmits}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0">
              <td style="padding:8px 12px">API Calls</td>
              <td style="padding:8px 12px">${CONFIG.apiCallLimit}</td>
              <td style="padding:8px 12px">${CONFIG.apiCallWindow / 1000}s</td>
              <td style="padding:8px 12px">${stats.recentApiCalls}</td>
            </tr>
          </tbody>
        </table>

        <h3 style="margin:24px 0 12px;font-size:15px">Recent Events</h3>
        <div style="max-height:250px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px">
          ${stats.last10Events.length === 0 ? '<p style="padding:16px;color:#94a3b8;margin:0">No events recorded</p>' :
            stats.last10Events.map(e => `
              <div style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;display:flex;justify-content:space-between">
                <span><strong>${e.type}</strong> — ${e.detail}</span>
                <span style="color:#94a3b8">${new Date(e.time).toLocaleTimeString()}</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
  }

  generateFingerprint();

  ns.ddosProtection = {
    CONFIG, checkFormSubmit, checkApiCall, detectSuspiciousActivity,
    generateFingerprint, getSecurityStats, isBlocked, renderSecurityDashboard
  };
})();
