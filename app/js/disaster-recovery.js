/**
 * CF-279 Disaster Recovery Runbook
 * Interactive runbook with checklists for outage scenarios
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const SCENARIOS = [
    {
      id: 'api-down',
      title: 'API Outage',
      severity: 'critical',
      description: 'Backend API is unreachable or returning 5xx errors',
      steps: [
        { id: 'ad-1', text: 'Confirm outage via health endpoint (/api/health)', role: 'on-call' },
        { id: 'ad-2', text: 'Check Vercel deployment status and function logs', role: 'on-call' },
        { id: 'ad-3', text: 'Verify environment variables are intact', role: 'on-call' },
        { id: 'ad-4', text: 'Check for recent deployments that may have caused regression', role: 'on-call' },
        { id: 'ad-5', text: 'Rollback to last known good deployment if needed', role: 'on-call' },
        { id: 'ad-6', text: 'Enable maintenance mode / status page update', role: 'comms' },
        { id: 'ad-7', text: 'Monitor for recovery (5-min intervals)', role: 'on-call' },
        { id: 'ad-8', text: 'Post incident report within 24 hours', role: 'lead' }
      ]
    },
    {
      id: 'auth-broken',
      title: 'Authentication Failure',
      severity: 'critical',
      description: 'Users cannot log in or sessions are being invalidated',
      steps: [
        { id: 'ab-1', text: 'Verify Firebase Auth service status', role: 'on-call' },
        { id: 'ab-2', text: 'Check Firebase console for configuration changes', role: 'on-call' },
        { id: 'ab-3', text: 'Verify OAuth provider settings (Google, Apple)', role: 'on-call' },
        { id: 'ab-4', text: 'Check for expired API keys or service account credentials', role: 'on-call' },
        { id: 'ab-5', text: 'Test auth flow in incognito to rule out client cache issues', role: 'on-call' },
        { id: 'ab-6', text: 'Notify affected users via status page / email', role: 'comms' },
        { id: 'ab-7', text: 'Restore auth config from last known good backup', role: 'lead' },
        { id: 'ab-8', text: 'Verify fix across all auth providers', role: 'on-call' }
      ]
    },
    {
      id: 'payment-failure',
      title: 'Payment Processing Failure',
      severity: 'high',
      description: 'Stripe checkout, subscriptions, or webhooks are failing',
      steps: [
        { id: 'pf-1', text: 'Check Stripe dashboard for incident reports', role: 'on-call' },
        { id: 'pf-2', text: 'Verify Stripe API keys and webhook signing secret', role: 'on-call' },
        { id: 'pf-3', text: 'Check webhook endpoint logs for delivery failures', role: 'on-call' },
        { id: 'pf-4', text: 'Verify product/price IDs match between environments', role: 'on-call' },
        { id: 'pf-5', text: 'Test checkout flow end-to-end with Stripe test mode', role: 'on-call' },
        { id: 'pf-6', text: 'Replay failed webhooks from Stripe dashboard', role: 'on-call' },
        { id: 'pf-7', text: 'Notify customers of any billing issues', role: 'comms' },
        { id: 'pf-8', text: 'Reconcile any missed subscription events', role: 'lead' }
      ]
    },
    {
      id: 'data-loss',
      title: 'Data Loss / Corruption',
      severity: 'critical',
      description: 'Firestore data missing, corrupted, or incorrectly modified',
      steps: [
        { id: 'dl-1', text: 'Identify scope: which collections/documents are affected', role: 'on-call' },
        { id: 'dl-2', text: 'Immediately revoke write access to affected collections', role: 'on-call' },
        { id: 'dl-3', text: 'Check Firestore audit logs for recent write operations', role: 'on-call' },
        { id: 'dl-4', text: 'Identify root cause (bad migration, security rule gap, bug)', role: 'lead' },
        { id: 'dl-5', text: 'Restore from most recent Firestore export/backup', role: 'lead' },
        { id: 'dl-6', text: 'Validate restored data integrity', role: 'on-call' },
        { id: 'dl-7', text: 'Re-enable write access with corrected security rules', role: 'lead' },
        { id: 'dl-8', text: 'Notify affected users and provide data recovery status', role: 'comms' }
      ]
    },
    {
      id: 'ddos',
      title: 'DDoS / Traffic Spike',
      severity: 'high',
      description: 'Abnormal traffic causing performance degradation',
      steps: [
        { id: 'dd-1', text: 'Confirm traffic spike via Vercel analytics / server logs', role: 'on-call' },
        { id: 'dd-2', text: 'Enable Vercel edge rate limiting if available', role: 'on-call' },
        { id: 'dd-3', text: 'Block suspicious IP ranges or user agents', role: 'on-call' },
        { id: 'dd-4', text: 'Scale up serverless function concurrency limits', role: 'on-call' },
        { id: 'dd-5', text: 'Enable CDN caching for static assets', role: 'on-call' },
        { id: 'dd-6', text: 'Monitor until traffic normalizes', role: 'on-call' }
      ]
    }
  ];

  function getScenario(id) {
    return SCENARIOS.find(s => s.id === id) || null;
  }

  function createRunbookState() {
    const state = {};
    for (const scenario of SCENARIOS) {
      state[scenario.id] = {};
      for (const step of scenario.steps) {
        state[scenario.id][step.id] = { done: false, notes: '', completedAt: null, completedBy: '' };
      }
    }
    return state;
  }

  function loadRunbookState() {
    try {
      const saved = localStorage.getItem('cortex_dr_runbook');
      return saved ? JSON.parse(saved) : createRunbookState();
    } catch { return createRunbookState(); }
  }

  function saveRunbookState(st) {
    try { localStorage.setItem('cortex_dr_runbook', JSON.stringify(st)); } catch {}
  }

  function toggleStep(scenarioId, stepId) {
    const st = loadRunbookState();
    if (!st[scenarioId]) return;
    const step = st[scenarioId][stepId];
    if (!step) return;
    step.done = !step.done;
    step.completedAt = step.done ? new Date().toISOString() : null;
    saveRunbookState(st);
    return st;
  }

  function getProgress(scenarioId) {
    const st = loadRunbookState();
    const steps = st[scenarioId];
    if (!steps) return { done: 0, total: 0, pct: 0 };
    const entries = Object.values(steps);
    const done = entries.filter(s => s.done).length;
    return { done, total: entries.length, pct: entries.length ? Math.round((done / entries.length) * 100) : 0 };
  }

  function renderRunbook(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const runbookState = loadRunbookState();
    const sevColor = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6' };
    const roleColor = { 'on-call': '#6366f1', comms: '#8b5cf6', lead: '#0891b2' };

    el.innerHTML = `
      <div style="font-family:var(--font-main,system-ui);max-width:900px">
        <h2 style="margin:0 0 8px">Disaster Recovery Runbook</h2>
        <p style="color:#64748b;font-size:14px;margin:0 0 24px">Interactive checklists for outage scenarios. Progress is saved locally.</p>

        ${SCENARIOS.map(scenario => {
          const prog = getProgress(scenario.id);
          const scState = runbookState[scenario.id] || {};
          return `
          <details style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden" ${prog.done > 0 && prog.done < prog.total ? 'open' : ''}>
            <summary style="padding:16px;cursor:pointer;background:#f8fafc;display:flex;align-items:center;gap:12px;user-select:none">
              <span style="background:${sevColor[scenario.severity] || '#94a3b8'};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;text-transform:uppercase">${scenario.severity}</span>
              <strong style="flex:1">${scenario.title}</strong>
              <span style="font-size:13px;color:#64748b">${prog.done}/${prog.total}</span>
              <div style="width:60px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${prog.pct}%;background:${prog.pct === 100 ? '#22c55e' : '#3b82f6'};border-radius:3px"></div>
              </div>
            </summary>
            <div style="padding:16px;border-top:1px solid #e2e8f0">
              <p style="margin:0 0 16px;color:#64748b;font-size:13px">${scenario.description}</p>
              <div style="display:grid;gap:8px">
                ${scenario.steps.map(step => {
                  const done = scState[step.id] && scState[step.id].done;
                  return `
                  <label data-scenario="${scenario.id}" data-step="${step.id}" style="display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;background:${done ? '#f0fdf4' : '#fff'};border:1px solid ${done ? '#bbf7d0' : '#e2e8f0'};transition:all .15s">
                    <input type="checkbox" ${done ? 'checked' : ''} style="margin-top:2px;cursor:pointer" onchange="CortexFreelancer.disasterRecovery._onToggle('${scenario.id}','${step.id}','${containerId}')">
                    <span style="flex:1;font-size:13px;${done ? 'text-decoration:line-through;color:#94a3b8' : ''}">${step.text}</span>
                    <span style="background:${roleColor[step.role] || '#94a3b8'};color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;white-space:nowrap">${step.role}</span>
                  </label>`;
                }).join('')}
              </div>
              ${prog.pct === 100 ? `<div style="margin-top:12px;padding:10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;color:#166534;font-size:13px;font-weight:600">All steps completed</div>` : ''}
            </div>
          </details>`;
        }).join('')}

        <div style="margin-top:24px;text-align:right">
          <button onclick="CortexFreelancer.disasterRecovery._onReset('${containerId}')" style="background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px">Reset All Checklists</button>
        </div>
      </div>
    `;
  }

  function _onToggle(scenarioId, stepId, containerId) {
    toggleStep(scenarioId, stepId);
    renderRunbook(containerId);
  }

  function _onReset(containerId) {
    saveRunbookState(createRunbookState());
    renderRunbook(containerId);
  }

  ns.disasterRecovery = {
    SCENARIOS, getScenario, getProgress, toggleStep,
    loadRunbookState, renderRunbook, _onToggle, _onReset
  };
})();
