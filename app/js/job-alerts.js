/**
 * CortexJobAlerts — Job alert system with saved searches and new match detection
 * [UW-008]
 */
(function () {
  'use strict';

  const STORAGE_KEYS = {
    alerts: 'cortex_job_alerts',
    seenJobs: 'cortex_seen_jobs',
    newCounts: 'cortex_alert_new_counts'
  };

  const MAX_ALERTS_FREE = 5;

  /* ── Helpers ── */

  function getAlerts() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.alerts)) || []; }
    catch { return []; }
  }

  function setAlerts(alerts) {
    localStorage.setItem(STORAGE_KEYS.alerts, JSON.stringify(alerts));
  }

  function getSeenJobs() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.seenJobs)) || []; }
    catch { return []; }
  }

  function setSeenJobs(urls) {
    localStorage.setItem(STORAGE_KEYS.seenJobs, JSON.stringify(urls));
  }

  function getNewCounts() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.newCounts)) || {}; }
    catch { return {}; }
  }

  function setNewCounts(counts) {
    localStorage.setItem(STORAGE_KEYS.newCounts, JSON.stringify(counts));
  }

  function uid() {
    return 'alert_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function timeAgo(ts) {
    if (!ts) return 'Never';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.floor(hrs / 24) + 'd ago';
  }

  function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ── 1) saveAlert ── */

  function saveAlert(alertConfig) {
    const alerts = getAlerts();
    if (alerts.length >= MAX_ALERTS_FREE) {
      return { ok: false, error: 'Max ' + MAX_ALERTS_FREE + ' alerts on free tier' };
    }
    const entry = {
      id: alertConfig.id || uid(),
      skills: alertConfig.skills || [],
      minBudget: alertConfig.minBudget ?? null,
      maxBudget: alertConfig.maxBudget ?? null,
      budgetType: alertConfig.budgetType || 'any',
      createdAt: alertConfig.createdAt || Date.now(),
      lastChecked: alertConfig.lastChecked || null
    };
    alerts.push(entry);
    setAlerts(alerts);
    return { ok: true, alert: entry };
  }

  /* ── 2) checkForNewJobs ── */

  async function checkForNewJobs(alert) {
    const params = new URLSearchParams();
    if (alert.skills && alert.skills.length) {
      params.set('skills', alert.skills.join(','));
    }
    if (alert.minBudget) params.set('minBudget', alert.minBudget);
    if (alert.maxBudget) params.set('maxBudget', alert.maxBudget);
    if (alert.budgetType && alert.budgetType !== 'any') params.set('budgetType', alert.budgetType);

    const res = await fetch('/api/upwork-jobs?' + params.toString());
    if (!res.ok) throw new Error('Failed to fetch jobs: ' + res.status);
    const data = await res.json();
    const jobs = data.jobs || data || [];

    const seen = new Set(getSeenJobs());
    const newJobs = [];
    const updatedSeen = [...seen];

    for (const job of jobs) {
      const url = job.url || job.link || '';
      if (url && !seen.has(url)) {
        job._isNew = true;
        newJobs.push(job);
        updatedSeen.push(url);
      }
    }

    setSeenJobs(updatedSeen);

    // Update alert lastChecked
    const alerts = getAlerts();
    const idx = alerts.findIndex(a => a.id === alert.id);
    if (idx !== -1) {
      alerts[idx].lastChecked = Date.now();
      setAlerts(alerts);
    }

    // Persist new count per alert
    const counts = getNewCounts();
    counts[alert.id] = newJobs.length;
    setNewCounts(counts);

    return { newJobs, totalFetched: jobs.length };
  }

  /* ── 3) renderJobAlerts ── */

  function renderJobAlerts(container) {
    if (!container) return;
    container.innerHTML = '';

    const section = document.createElement('div');
    section.className = 'cortex-job-alerts';
    section.innerHTML = buildStyles() + buildHeader() + buildCreateForm() + '<div class="cja-alerts-list"></div>';
    container.appendChild(section);

    // Wire up form
    const form = section.querySelector('.cja-create-form');
    const skillInput = section.querySelector('.cja-skill-input');
    const skillTags = section.querySelector('.cja-skill-tags');
    const selectedSkills = [];

    skillInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = skillInput.value.trim().replace(/,/g, '');
        if (val && !selectedSkills.includes(val)) {
          selectedSkills.push(val);
          renderSkillTags(skillTags, selectedSkills, function () { /* on remove re-render */ renderSkillTags(skillTags, selectedSkills); });
        }
        skillInput.value = '';
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!selectedSkills.length) { skillInput.focus(); return; }
      const minB = section.querySelector('.cja-min-budget').value;
      const maxB = section.querySelector('.cja-max-budget').value;
      const bType = section.querySelector('.cja-budget-type').value;

      const result = saveAlert({
        skills: [...selectedSkills],
        minBudget: minB ? Number(minB) : null,
        maxBudget: maxB ? Number(maxB) : null,
        budgetType: bType
      });

      if (!result.ok) {
        showToast(section, result.error);
        return;
      }

      selectedSkills.length = 0;
      skillInput.value = '';
      renderSkillTags(skillTags, selectedSkills);
      section.querySelector('.cja-min-budget').value = '';
      section.querySelector('.cja-max-budget').value = '';
      refreshAlertsList(section);
    });

    refreshAlertsList(section);
  }

  function refreshAlertsList(section) {
    const listEl = section.querySelector('.cja-alerts-list');
    const alerts = getAlerts();
    const counts = getNewCounts();

    if (!alerts.length) {
      listEl.innerHTML = '<p class="cja-empty">No alerts yet. Create one above.</p>';
      return;
    }

    listEl.innerHTML = alerts.map(a => {
      const newCount = counts[a.id] || 0;
      const badge = newCount > 0 ? '<span class="cja-badge">' + newCount + ' new</span>' : '';
      return `
        <div class="cja-alert-card" data-alert-id="${escHtml(a.id)}">
          <div class="cja-alert-header">
            <div class="cja-alert-skills">
              ${a.skills.map(s => '<span class="cja-skill-tag">' + escHtml(s) + '</span>').join('')}
              ${badge}
            </div>
            <div class="cja-alert-actions">
              <span class="cja-last-checked">Checked ${timeAgo(a.lastChecked)}</span>
              <button class="cja-btn cja-btn-check" data-id="${escHtml(a.id)}">Check Now</button>
              <button class="cja-btn cja-btn-delete" data-id="${escHtml(a.id)}">✕</button>
            </div>
          </div>
          ${a.budgetType !== 'any' || a.minBudget || a.maxBudget ? `
          <div class="cja-alert-budget">
            ${a.budgetType !== 'any' ? '<span class="cja-budget-label">' + escHtml(a.budgetType) + '</span>' : ''}
            ${a.minBudget ? '$' + a.minBudget : ''}${a.minBudget && a.maxBudget ? ' – ' : ''}${a.maxBudget ? '$' + a.maxBudget : ''}
          </div>` : ''}
          <div class="cja-new-jobs" data-jobs-for="${escHtml(a.id)}"></div>
        </div>`;
    }).join('');

    // Bind check now
    listEl.querySelectorAll('.cja-btn-check').forEach(btn => {
      btn.addEventListener('click', async function () {
        const id = btn.dataset.id;
        const alert = getAlerts().find(a => a.id === id);
        if (!alert) return;
        btn.textContent = '⏳';
        btn.disabled = true;
        try {
          const result = await checkForNewJobs(alert);
          renderNewJobCards(section, id, result.newJobs);
          refreshAlertsList(section);
        } catch (err) {
          showToast(section, 'Error: ' + err.message);
        } finally {
          btn.textContent = 'Check Now';
          btn.disabled = false;
        }
      });
    });

    // Bind delete
    listEl.querySelectorAll('.cja-btn-delete').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = btn.dataset.id;
        let alerts = getAlerts().filter(a => a.id !== id);
        setAlerts(alerts);
        const counts = getNewCounts();
        delete counts[id];
        setNewCounts(counts);
        refreshAlertsList(section);
      });
    });
  }

  function renderNewJobCards(section, alertId, newJobs) {
    const container = section.querySelector('[data-jobs-for="' + alertId + '"]');
    if (!container) return;
    if (!newJobs || !newJobs.length) {
      container.innerHTML = '<p class="cja-no-new">No new jobs found.</p>';
      return;
    }
    container.innerHTML = newJobs.map(job => `
      <div class="cja-job-card">
        <div class="cja-job-title">
          <a href="${escHtml(job.url || job.link || '#')}" target="_blank" rel="noopener">${escHtml(job.title || 'Untitled')}</a>
          <span class="cja-new-dot">NEW</span>
        </div>
        ${job.budget ? '<div class="cja-job-budget">💰 ' + escHtml(String(job.budget)) + '</div>' : ''}
        ${job.description ? '<div class="cja-job-desc">' + escHtml(job.description.slice(0, 200)) + (job.description.length > 200 ? '…' : '') + '</div>' : ''}
        ${job.skills && job.skills.length ? '<div class="cja-job-skills">' + job.skills.map(s => '<span class="cja-skill-tag cja-skill-sm">' + escHtml(s) + '</span>').join('') + '</div>' : ''}
      </div>
    `).join('');
  }

  function renderSkillTags(container, skills, onRemove) {
    container.innerHTML = skills.map((s, i) =>
      '<span class="cja-skill-tag cja-removable" data-idx="' + i + '">' + escHtml(s) + ' <span class="cja-rm">×</span></span>'
    ).join('');
    container.querySelectorAll('.cja-rm').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx = Number(btn.parentElement.dataset.idx);
        skills.splice(idx, 1);
        renderSkillTags(container, skills, onRemove);
        if (onRemove) onRemove();
      });
    });
  }

  function showToast(section, msg) {
    let toast = section.querySelector('.cja-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cja-toast';
      section.prepend(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  /* ── 4) renderAlertBadge ── */

  function renderAlertBadge(navElement) {
    if (!navElement) return;
    const counts = getNewCounts();
    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    let dot = navElement.querySelector('.cja-nav-badge');
    if (total > 0) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'cja-nav-badge';
        navElement.style.position = 'relative';
        navElement.appendChild(dot);
      }
      dot.textContent = total;
      dot.style.display = 'flex';
    } else if (dot) {
      dot.style.display = 'none';
    }
  }

  /* ── Markup builders ── */

  function buildHeader() {
    return '<h2 class="cja-title">🔔 Job Alerts</h2>';
  }

  function buildCreateForm() {
    return `
      <form class="cja-create-form">
        <div class="cja-form-row">
          <label class="cja-label">Skills</label>
          <div class="cja-skill-tags"></div>
          <input type="text" class="cja-skill-input" placeholder="Type skill + Enter" />
        </div>
        <div class="cja-form-row cja-row-inline">
          <div class="cja-field">
            <label class="cja-label">Min $</label>
            <input type="number" class="cja-min-budget" min="0" placeholder="0" />
          </div>
          <div class="cja-field">
            <label class="cja-label">Max $</label>
            <input type="number" class="cja-max-budget" min="0" placeholder="Any" />
          </div>
          <div class="cja-field">
            <label class="cja-label">Type</label>
            <select class="cja-budget-type">
              <option value="any">Any</option>
              <option value="fixed">Fixed</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
          <button type="submit" class="cja-btn cja-btn-create">+ Create Alert</button>
        </div>
      </form>`;
  }

  /* ── Styles ── */

  function buildStyles() {
    return `<style>
.cortex-job-alerts{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e4e4e7;max-width:720px}
.cja-title{font-size:1.25rem;font-weight:600;margin:0 0 16px;color:#f4f4f5}
.cja-toast{background:#ef4444;color:#fff;padding:8px 14px;border-radius:8px;font-size:.85rem;margin-bottom:12px;display:none}
.cja-create-form{background:#1e1e24;border:1px solid #2e2e36;border-radius:12px;padding:16px;margin-bottom:20px}
.cja-form-row{margin-bottom:12px}
.cja-row-inline{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
.cja-field{display:flex;flex-direction:column;gap:4px;min-width:80px;flex:1}
.cja-label{font-size:.75rem;color:#a1a1aa;text-transform:uppercase;letter-spacing:.5px}
.cja-skill-input,.cja-min-budget,.cja-max-budget,.cja-budget-type{background:#27272e;border:1px solid #3f3f46;border-radius:8px;padding:8px 10px;color:#e4e4e7;font-size:.875rem;outline:none;width:100%;box-sizing:border-box}
.cja-skill-input:focus,.cja-min-budget:focus,.cja-max-budget:focus{border-color:#6366f1}
.cja-budget-type{cursor:pointer}
.cja-skill-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.cja-skill-tag{background:#6366f1;color:#fff;padding:3px 10px;border-radius:20px;font-size:.78rem;font-weight:500;display:inline-flex;align-items:center;gap:4px}
.cja-skill-sm{font-size:.72rem;padding:2px 8px}
.cja-removable{cursor:pointer}
.cja-rm{font-size:1rem;line-height:1;opacity:.7;cursor:pointer}
.cja-rm:hover{opacity:1}
.cja-btn{background:#6366f1;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:.82rem;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .15s}
.cja-btn:hover{background:#4f46e5}
.cja-btn:disabled{opacity:.5;cursor:not-allowed}
.cja-btn-delete{background:#3f3f46;padding:6px 10px;font-size:.85rem}
.cja-btn-delete:hover{background:#ef4444}
.cja-btn-create{margin-top:auto}
.cja-alerts-list{display:flex;flex-direction:column;gap:12px}
.cja-alert-card{background:#1e1e24;border:1px solid #2e2e36;border-radius:12px;padding:14px 16px}
.cja-alert-header{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.cja-alert-skills{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.cja-alert-actions{display:flex;align-items:center;gap:8px}
.cja-last-checked{font-size:.75rem;color:#71717a}
.cja-badge{background:#ef4444;color:#fff;padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:600;animation:cja-pulse 2s infinite}
@keyframes cja-pulse{0%,100%{opacity:1}50%{opacity:.7}}
.cja-alert-budget{margin-top:6px;font-size:.8rem;color:#a1a1aa}
.cja-budget-label{background:#27272e;padding:2px 8px;border-radius:12px;font-size:.72rem;text-transform:uppercase;margin-right:6px}
.cja-new-jobs{margin-top:10px}
.cja-no-new{font-size:.82rem;color:#71717a;margin:0}
.cja-job-card{background:#27272e;border:1px solid #3f3f46;border-radius:10px;padding:12px;margin-bottom:8px}
.cja-job-title{display:flex;align-items:center;gap:8px}
.cja-job-title a{color:#818cf8;text-decoration:none;font-weight:500;font-size:.9rem}
.cja-job-title a:hover{text-decoration:underline}
.cja-new-dot{background:#22c55e;color:#fff;font-size:.65rem;padding:2px 6px;border-radius:10px;font-weight:700;text-transform:uppercase}
.cja-job-budget{font-size:.8rem;color:#a1a1aa;margin-top:4px}
.cja-job-desc{font-size:.82rem;color:#d4d4d8;margin-top:6px;line-height:1.45}
.cja-job-skills{margin-top:6px;display:flex;flex-wrap:wrap;gap:4px}
.cja-empty{color:#71717a;font-size:.85rem;text-align:center;padding:20px 0}
.cja-nav-badge{position:absolute;top:-4px;right:-6px;background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #18181b}
</style>`;
  }

  /* ── Auto-check on load ── */

  function checkAllOnLoad() {
    const alerts = getAlerts();
    alerts.forEach(a => {
      checkForNewJobs(a).catch(() => {});
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAllOnLoad);
  } else {
    checkAllOnLoad();
  }

  /* ── Public API ── */

  window.CortexJobAlerts = {
    saveAlert,
    checkForNewJobs,
    renderJobAlerts,
    renderAlertBadge,
    getAlerts,
    MAX_ALERTS_FREE
  };

})();
