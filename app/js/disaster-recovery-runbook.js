/**
 * CF-279: Disaster Recovery Runbook
 * Procedures for API key compromise, database corruption, deployment rollback, and provider outage.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_dr_incidents';

  var RUNBOOKS = {
    'api-key-compromise': {
      title: 'API Key Compromise',
      severity: 'critical',
      estimatedTime: '15-30 min',
      steps: [
        { action: 'Identify compromised key(s) from logs or alert', owner: 'on-call' },
        { action: 'Rotate affected key in provider dashboard', owner: 'on-call' },
        { action: 'Update Vercel environment variables with new key', owner: 'on-call' },
        { action: 'Redeploy all functions (vercel --prod --force)', owner: 'on-call' },
        { action: 'Audit provider usage logs for unauthorized activity', owner: 'on-call' },
        { action: 'Revoke old key in provider dashboard', owner: 'on-call' },
        { action: 'Notify affected users if data accessed', owner: 'lead' },
        { action: 'Write post-incident report', owner: 'lead' }
      ]
    },
    'database-corruption': {
      title: 'Firestore Database Corruption',
      severity: 'critical',
      estimatedTime: '30-60 min',
      steps: [
        { action: 'Enable maintenance mode to stop writes', owner: 'on-call' },
        { action: 'Identify corrupted collections from error logs', owner: 'on-call' },
        { action: 'Export current state as backup before restore', owner: 'on-call' },
        { action: 'Locate latest clean backup from Cloud Storage', owner: 'on-call' },
        { action: 'Restore affected collections via gcloud firestore import', owner: 'on-call' },
        { action: 'Verify data integrity with spot checks', owner: 'on-call' },
        { action: 'Re-enable write operations', owner: 'on-call' },
        { action: 'Monitor error rates for 30 minutes', owner: 'on-call' }
      ]
    },
    'deployment-rollback': {
      title: 'Deployment Rollback',
      severity: 'high',
      estimatedTime: '5-10 min',
      steps: [
        { action: 'Identify failing deployment in Vercel dashboard', owner: 'on-call' },
        { action: 'Promote last known good deployment to Production', owner: 'on-call' },
        { action: 'Verify rollback via /api/health endpoint', owner: 'on-call' },
        { action: 'Check critical user flows (login, tools, checkout)', owner: 'on-call' },
        { action: 'Git revert bad commit on main branch', owner: 'dev' },
        { action: 'Investigate root cause before re-deploying', owner: 'dev' }
      ]
    },
    'provider-outage': {
      title: 'Provider Outage (Anthropic/Stripe/Firebase)',
      severity: 'high',
      estimatedTime: 'Duration of outage',
      steps: [
        { action: 'Check provider status page to confirm outage', owner: 'on-call' },
        { action: 'Enable graceful degradation for affected features', owner: 'on-call' },
        { action: 'Show user-facing unavailable messages', owner: 'on-call' },
        { action: 'Enable request queuing if applicable', owner: 'dev' },
        { action: 'Monitor provider status for recovery', owner: 'on-call' },
        { action: 'Process queued requests on recovery', owner: 'dev' },
        { action: 'Verify all systems operational', owner: 'on-call' }
      ]
    }
  };

  function getRunbook(id) {
    return RUNBOOKS[id] || null;
  }

  function listRunbooks() {
    return Object.keys(RUNBOOKS).map(function (id) {
      return { id: id, title: RUNBOOKS[id].title, severity: RUNBOOKS[id].severity };
    });
  }

  function recordIncident(incident) {
    var history = getIncidentHistory();
    history.push({
      id: 'inc_' + Date.now().toString(36),
      runbookId: incident.runbookId,
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      notes: incident.notes || '',
      startedBy: incident.startedBy || 'unknown',
      completedSteps: []
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_e) {}
  }

  function completeStep(incidentId, stepIndex) {
    var history = getIncidentHistory();
    var incident = history.find(function (i) { return i.id === incidentId; });
    if (!incident) return;

    if (incident.completedSteps.indexOf(stepIndex) === -1) {
      incident.completedSteps.push(stepIndex);
    }

    var runbook = RUNBOOKS[incident.runbookId];
    if (runbook && incident.completedSteps.length >= runbook.steps.length) {
      incident.status = 'resolved';
      incident.resolvedAt = new Date().toISOString();
    }

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_e) {}
  }

  function getIncidentHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (_e) { return []; }
  }

  function render(container, runbookId, activeIncidentId) {
    if (!container) return;
    var runbook = RUNBOOKS[runbookId];
    if (!runbook) { container.innerHTML = '<div style="color:#ef4444">Runbook not found.</div>'; return; }

    var incident = null;
    if (activeIncidentId) {
      incident = getIncidentHistory().find(function (i) { return i.id === activeIncidentId; });
    }

    var sevColors = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6' };
    var html = '<div style="margin-bottom:16px">' +
      '<h3 style="margin:0 0 4px">' + runbook.title + '</h3>' +
      '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;' +
      'background:' + (sevColors[runbook.severity] || '#9ca3af') + '20;color:' + (sevColors[runbook.severity] || '#9ca3af') + '">' +
      runbook.severity.toUpperCase() + '</span>' +
      ' <span style="font-size:13px;color:#6b7280">Est. ' + runbook.estimatedTime + '</span></div>';

    runbook.steps.forEach(function (step, idx) {
      var completed = incident && incident.completedSteps.indexOf(idx) >= 0;
      var icon = completed ? '\u2705' : '\u2B1C';
      html += '<div style="display:flex;gap:8px;padding:10px;border-bottom:1px solid #f3f4f6;' +
        (completed ? 'opacity:0.6' : '') + '">' +
        '<span>' + icon + '</span>' +
        '<div style="flex:1"><div>' + step.action + '</div>' +
        '<div style="font-size:12px;color:#9ca3af">Owner: ' + step.owner + '</div></div></div>';
    });

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.DisasterRecovery = {
    RUNBOOKS: RUNBOOKS,
    getRunbook: getRunbook,
    listRunbooks: listRunbooks,
    recordIncident: recordIncident,
    completeStep: completeStep,
    getIncidentHistory: getIncidentHistory,
    render: render
  };
})();
