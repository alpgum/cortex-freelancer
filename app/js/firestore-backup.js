/**
 * CF-274: Firestore Backup Strategy Manager
 * Schedule, monitor, and manage Firestore backup/export operations.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_backup_history';
  var COLLECTIONS = [
    'users', 'subscriptions', 'feedback', 'waitlist',
    'referrals', 'tool_usage', 'contacts', 'events'
  ];

  /**
   * Get backup schedule config.
   * @returns {Object}
   */
  function getSchedule() {
    return {
      frequency: 'daily',
      time: '03:00',
      timezone: 'UTC',
      retention: 30,
      collections: COLLECTIONS,
      destination: 'gs://cortex-freelancer-backups/firestore/'
    };
  }

  /**
   * Generate gcloud export command.
   * @param {{ collections?: Array<string>, bucket?: string }} [options]
   * @returns {string}
   */
  function generateExportCommand(options) {
    options = options || {};
    var bucket = options.bucket || 'gs://cortex-freelancer-backups/firestore/';
    var date = new Date().toISOString().split('T')[0];
    var dest = bucket + date;

    var cmd = 'gcloud firestore export ' + dest;
    if (options.collections && options.collections.length > 0) {
      cmd += ' --collection-ids=' + options.collections.join(',');
    }
    return cmd;
  }

  /**
   * Generate restore command.
   * @param {string} backupPath
   * @returns {string}
   */
  function generateRestoreCommand(backupPath) {
    return 'gcloud firestore import ' + backupPath;
  }

  /**
   * Generate Cloud Scheduler job command for daily backup.
   * @returns {string}
   */
  function generateCronCommand() {
    return [
      'gcloud scheduler jobs create http cortex-daily-backup \\',
      '  --schedule="0 3 * * *" \\',
      '  --uri="https://firestore.googleapis.com/v1/projects/cortex-freelancer-prod/databases/(default):exportDocuments" \\',
      '  --message-body=\'{"outputUriPrefix":"gs://cortex-freelancer-backups/firestore/auto"}\' \\',
      '  --oauth-service-account-email=backup-sa@cortex-freelancer-prod.iam.gserviceaccount.com \\',
      '  --time-zone=UTC'
    ].join('\n');
  }

  /**
   * Record a backup event.
   * @param {{ type: string, status: string, collections: Array, size?: number }} backup
   */
  function recordBackup(backup) {
    var history = getHistory();
    history.push({
      timestamp: new Date().toISOString(),
      type: backup.type || 'manual',
      status: backup.status || 'completed',
      collections: backup.collections || COLLECTIONS,
      size: backup.size || 0
    });
    if (history.length > 100) history = history.slice(-100);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (_e) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Get backup history.
   * @returns {Array}
   */
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (_e) {
      return [];
    }
  }

  /**
   * Get backup health status.
   * @returns {{ status: string, lastBackup: string|null, daysSinceBackup: number }}
   */
  function getHealth() {
    var history = getHistory();
    var successful = history.filter(function (b) { return b.status === 'completed'; });

    if (successful.length === 0) {
      return { status: 'critical', lastBackup: null, daysSinceBackup: -1 };
    }

    var last = successful[successful.length - 1];
    var daysSince = Math.floor((Date.now() - new Date(last.timestamp).getTime()) / 86400000);

    return {
      status: daysSince > 2 ? 'warning' : 'healthy',
      lastBackup: last.timestamp,
      daysSinceBackup: daysSince
    };
  }

  /**
   * Render backup dashboard.
   * @param {HTMLElement} container
   */
  function render(container) {
    if (!container) return;

    var health = getHealth();
    var history = getHistory().slice(-10).reverse();
    var statusColors = { healthy: '#10b981', warning: '#f59e0b', critical: '#ef4444' };

    var html = '<div style="padding:12px;border-radius:8px;border:1px solid ' + statusColors[health.status] +
      ';background:' + statusColors[health.status] + '10;margin-bottom:16px">' +
      '<div style="font-weight:600;color:' + statusColors[health.status] + '">Backup Status: ' +
      health.status.charAt(0).toUpperCase() + health.status.slice(1) + '</div>' +
      (health.lastBackup ? '<div style="font-size:13px;color:#6b7280;margin-top:4px">Last backup: ' +
        new Date(health.lastBackup).toLocaleString() + '</div>' : '') +
      '</div>';

    html += '<h4 style="margin:0 0 8px;font-size:14px">Recent Backups</h4>';
    if (history.length === 0) {
      html += '<div style="color:#9ca3af;font-size:13px">No backups recorded yet.</div>';
    } else {
      history.forEach(function (b) {
        var icon = b.status === 'completed' ? '\u2705' : '\u274C';
        html += '<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #f3f4f6;font-size:13px">' +
          '<span>' + icon + ' ' + new Date(b.timestamp).toLocaleString() + '</span>' +
          '<span style="color:#9ca3af">' + b.type + ' | ' + (b.collections || []).length + ' collections</span></div>';
      });
    }

    container.innerHTML = html;
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.FirestoreBackup = {
    COLLECTIONS: COLLECTIONS,
    getSchedule: getSchedule,
    generateExportCommand: generateExportCommand,
    generateRestoreCommand: generateRestoreCommand,
    generateCronCommand: generateCronCommand,
    recordBackup: recordBackup,
    getHistory: getHistory,
    getHealth: getHealth,
    render: render
  };
})();
