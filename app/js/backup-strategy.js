/**
 * CF-274 — Database Backup Strategy
 * Firestore backup planner: collections config, schedule, export-to-JSON,
 * and renderBackupDashboard().
 */
(function() {
  const NS = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ── Backup collection definitions ──
  const BACKUP_COLLECTIONS = [
    { name: 'users', priority: 'critical', frequency: 'daily', retention: 90, description: 'User profiles, preferences, subscription status' },
    { name: 'subscriptions', priority: 'critical', frequency: 'daily', retention: 365, description: 'Stripe subscription records and billing state' },
    { name: 'proposals', priority: 'high', frequency: 'daily', retention: 60, description: 'User-generated proposals and templates' },
    { name: 'tool_usage', priority: 'medium', frequency: 'weekly', retention: 30, description: 'Tool usage analytics and counters' },
    { name: 'saved_searches', priority: 'medium', frequency: 'weekly', retention: 30, description: 'Saved job search filters' },
    { name: 'client_crm', priority: 'high', frequency: 'daily', retention: 90, description: 'Client relationship records' },
    { name: 'invoices', priority: 'critical', frequency: 'daily', retention: 365, description: 'Generated invoices and payment records' },
    { name: 'earnings', priority: 'high', frequency: 'daily', retention: 180, description: 'Earnings tracking data' },
    { name: 'feedback', priority: 'low', frequency: 'weekly', retention: 30, description: 'User feedback submissions' },
    { name: 'waitlist', priority: 'low', frequency: 'weekly', retention: 60, description: 'Waitlist signups' }
  ];

  // ── Schedule config ──
  const SCHEDULE = {
    daily: { cron: '0 2 * * *', label: 'Daily at 02:00 UTC' },
    weekly: { cron: '0 3 * * 0', label: 'Weekly Sunday at 03:00 UTC' },
    monthly: { cron: '0 4 1 * *', label: 'Monthly 1st at 04:00 UTC' }
  };

  // ── Backup log (in-memory for client-side tracking) ──
  const backupLog = [];

  function logBackup(collection, status, docCount, sizeKb) {
    backupLog.push({
      collection,
      status, // 'success' | 'failed' | 'skipped'
      docCount: docCount || 0,
      sizeKb: sizeKb || 0,
      timestamp: new Date().toISOString()
    });
    if (backupLog.length > 500) backupLog.splice(0, backupLog.length - 500);
  }

  // ── Export collection data to JSON (client-accessible data) ──
  async function exportCollectionToJSON(collectionName, getData) {
    try {
      const data = typeof getData === 'function' ? await getData(collectionName) : [];
      const blob = new Blob([JSON.stringify({ collection: collectionName, exportedAt: new Date().toISOString(), count: data.length, documents: data }, null, 2)], { type: 'application/json' });
      logBackup(collectionName, 'success', data.length, Math.round(blob.size / 1024));
      return blob;
    } catch (e) {
      logBackup(collectionName, 'failed', 0, 0);
      throw e;
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportAndDownload(collectionName, getData) {
    const blob = await exportCollectionToJSON(collectionName, getData);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadBlob(blob, `backup-${collectionName}-${ts}.json`);
    return blob;
  }

  // ── Backup plan generator ──
  function generateBackupPlan() {
    return BACKUP_COLLECTIONS.map(col => ({
      collection: col.name,
      priority: col.priority,
      schedule: SCHEDULE[col.frequency],
      retentionDays: col.retention,
      description: col.description,
      estimatedWindow: col.priority === 'critical' ? '< 5 min' : '< 15 min'
    }));
  }

  // ── Retention cleanup check ──
  function getExpiredBackups() {
    const now = Date.now();
    return backupLog.filter(entry => {
      const col = BACKUP_COLLECTIONS.find(c => c.name === entry.collection);
      if (!col) return false;
      const age = (now - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      return age > col.retention;
    });
  }

  // ── Dashboard renderer ──
  function renderBackupDashboard(container) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const plan = generateBackupPlan();
    const lastBackups = {};
    backupLog.forEach(e => {
      if (!lastBackups[e.collection] || e.timestamp > lastBackups[e.collection].timestamp) {
        lastBackups[e.collection] = e;
      }
    });

    const prioColor = p => ({ critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#64748b' }[p] || '#888');

    el.innerHTML = `
      <div style="font-family:var(--font-sans,system-ui);max-width:900px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0;font-size:20px">Backup Strategy Dashboard</h2>
          <span style="font-size:12px;color:#64748b">${BACKUP_COLLECTIONS.length} collections configured</span>
        </div>

        <!-- Summary cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
          ${['critical','high','medium','low'].map(p => {
            const cols = BACKUP_COLLECTIONS.filter(c => c.priority === p);
            return `<div style="background:#1e293b;border-radius:8px;padding:14px;border-left:3px solid ${prioColor(p)}">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">${p}</div>
              <div style="font-size:24px;font-weight:700;margin-top:4px">${cols.length}</div>
              <div style="font-size:11px;color:#64748b">${cols.map(c => c.name).join(', ')}</div>
            </div>`;
          }).join('')}
        </div>

        <!-- Collection table -->
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="border-bottom:2px solid #334155;text-align:left">
              <th style="padding:8px">Collection</th>
              <th style="padding:8px">Priority</th>
              <th style="padding:8px">Schedule</th>
              <th style="padding:8px">Retention</th>
              <th style="padding:8px">Last Backup</th>
              <th style="padding:8px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${plan.map(p => {
              const last = lastBackups[p.collection];
              const statusDot = last ? (last.status === 'success' ? '🟢' : '🔴') : '⚪';
              return `<tr style="border-bottom:1px solid #1e293b">
                <td style="padding:8px;font-weight:600">${p.collection}</td>
                <td style="padding:8px"><span style="color:${prioColor(p.priority)};font-size:11px;font-weight:600;text-transform:uppercase">${p.priority}</span></td>
                <td style="padding:8px;font-size:12px">${p.schedule.label}</td>
                <td style="padding:8px">${p.retentionDays}d</td>
                <td style="padding:8px;font-size:12px">${statusDot} ${last ? new Date(last.timestamp).toLocaleDateString() : 'Never'}</td>
                <td style="padding:8px"><button onclick="CortexFreelancer.BackupStrategy.exportAndDownload('${p.collection}')" style="background:#3b82f6;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px">Export</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <!-- Recent log -->
        ${backupLog.length ? `
          <h3 style="margin-top:24px;font-size:15px">Recent Backup Log</h3>
          <div style="max-height:200px;overflow-y:auto;font-size:12px;font-family:monospace;background:#0f172a;border-radius:6px;padding:10px">
            ${backupLog.slice(-20).reverse().map(e => `
              <div style="padding:2px 0;color:${e.status === 'success' ? '#22c55e' : '#ef4444'}">
                [${e.timestamp.slice(0, 19)}] ${e.collection} — ${e.status} (${e.docCount} docs, ${e.sizeKb} KB)
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>`;
  }

  NS.BackupStrategy = {
    BACKUP_COLLECTIONS, SCHEDULE,
    generateBackupPlan, exportCollectionToJSON, exportAndDownload, downloadBlob,
    logBackup, getExpiredBackups, renderBackupDashboard,
    getLog: () => [...backupLog]
  };
})();
