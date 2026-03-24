/**
 * CF-129: Time Tracker — add project categorization and reporting
 * Tag time entries by project/client, generate weekly time reports.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const STORAGE_KEY = 'cf_time_categories';

  const TimeCategorizer = {
    categories: [],

    init() {
      this.load();
      document.addEventListener('DOMContentLoaded', () => this.bind());
    },

    load() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.categories = saved ? JSON.parse(saved) : [
          { id: 'dev', name: 'Development', color: '#6c63ff' },
          { id: 'design', name: 'Design', color: '#ff6b6b' },
          { id: 'meeting', name: 'Meetings', color: '#ffd93d' },
          { id: 'admin', name: 'Admin', color: '#6bcb77' },
          { id: 'research', name: 'Research', color: '#4d96ff' }
        ];
      } catch (e) {
        this.categories = [];
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.categories));
      } catch (e) {
        console.warn('[CF-129] Failed to save categories:', e);
      }
    },

    addCategory(name, color) {
      const id = name.toLowerCase().replace(/\s+/g, '-');
      if (this.categories.find(c => c.id === id)) return null;
      const cat = { id, name, color: color || this.randomColor() };
      this.categories.push(cat);
      this.save();
      return cat;
    },

    removeCategory(id) {
      this.categories = this.categories.filter(c => c.id !== id);
      this.save();
    },

    randomColor() {
      return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    },

    generateReport(entries, period) {
      const now = Date.now();
      const periods = {
        day: 86400000,
        week: 7 * 86400000,
        month: 30 * 86400000
      };
      const cutoff = now - (periods[period] || periods.week);

      const filtered = (entries || []).filter(e => e.startTime > cutoff);

      const byProject = {};
      const byCategory = {};
      let totalDuration = 0;

      filtered.forEach(entry => {
        const project = entry.project || 'Unassigned';
        const category = entry.category || 'uncategorized';
        const duration = entry.duration || 0;

        totalDuration += duration;

        if (!byProject[project]) byProject[project] = { duration: 0, entries: 0 };
        byProject[project].duration += duration;
        byProject[project].entries++;

        if (!byCategory[category]) byCategory[category] = { duration: 0, entries: 0 };
        byCategory[category].duration += duration;
        byCategory[category].entries++;
      });

      return {
        period,
        totalEntries: filtered.length,
        totalDuration,
        totalHours: (totalDuration / 3600000).toFixed(1),
        byProject: Object.entries(byProject).map(([name, data]) => ({
          name,
          ...data,
          hours: (data.duration / 3600000).toFixed(1),
          percentage: totalDuration > 0 ? ((data.duration / totalDuration) * 100).toFixed(1) : '0'
        })).sort((a, b) => b.duration - a.duration),
        byCategory: Object.entries(byCategory).map(([name, data]) => ({
          name,
          ...data,
          hours: (data.duration / 3600000).toFixed(1),
          percentage: totalDuration > 0 ? ((data.duration / totalDuration) * 100).toFixed(1) : '0',
          color: this.categories.find(c => c.id === name)?.color || '#999'
        })).sort((a, b) => b.duration - a.duration)
      };
    },

    renderReport(report) {
      const container = document.querySelector('#time-report, [data-time-report]');
      if (!container) return;

      container.innerHTML = `
        <div style="margin-bottom: 16px;">
          <h3 style="margin: 0 0 4px;">Time Report (${report.period})</h3>
          <p style="color: var(--text-muted, #999); margin: 0;">
            ${report.totalHours} hours across ${report.totalEntries} entries
          </p>
        </div>
        <div style="margin-bottom: 16px;">
          <h4>By Project</h4>
          ${report.byProject.map(p => `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color, #eee);">
              <span>${p.name}</span>
              <span>${p.hours}h (${p.percentage}%)</span>
            </div>
          `).join('')}
        </div>
        <div>
          <h4>By Category</h4>
          ${report.byCategory.map(c => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color, #eee);">
              <span>
                <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${c.color}; margin-right: 8px;"></span>
                ${c.name}
              </span>
              <span>${c.hours}h (${c.percentage}%)</span>
            </div>
          `).join('')}
        </div>
      `;
    },

    bind() {
      const reportBtn = document.querySelector('#generate-report, [data-action="time-report"]');
      if (reportBtn) {
        reportBtn.addEventListener('click', () => {
          const entries = window.CortexFreelancer?.TimeEntryPersist?.entries || [];
          const period = document.querySelector('#report-period')?.value || 'week';
          const report = this.generateReport(entries, period);
          this.renderReport(report);
        });
      }
    }
  };

  TimeCategorizer.init();
  window.CortexFreelancer.TimeCategorizer = TimeCategorizer;
})();
