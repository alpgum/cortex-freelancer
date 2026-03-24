/**
 * CF-131: Project Tracker — add deadline countdown with notifications
 * Shows days remaining per project, browser notification when deadline is within 48h.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const STORAGE_KEY = 'cf_deadlines';

  const DeadlineCountdown = {
    deadlines: [],
    checkInterval: null,

    init() {
      this.load();
      document.addEventListener('DOMContentLoaded', () => {
        this.render();
        this.startMonitor();
      });
    },

    load() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.deadlines = saved ? JSON.parse(saved) : [];
      } catch (e) {
        this.deadlines = [];
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.deadlines));
      } catch (e) {
        console.warn('[CF-131] Failed to save deadlines:', e);
      }
    },

    addDeadline(project, date, description) {
      const deadline = {
        id: Date.now().toString(36),
        project,
        date: new Date(date).getTime(),
        description: description || '',
        notified48h: false,
        notified24h: false,
        createdAt: Date.now()
      };
      this.deadlines.push(deadline);
      this.save();
      this.render();
      return deadline;
    },

    removeDeadline(id) {
      this.deadlines = this.deadlines.filter(d => d.id !== id);
      this.save();
      this.render();
    },

    getTimeRemaining(deadline) {
      const now = Date.now();
      const diff = deadline.date - now;
      if (diff <= 0) return { expired: true, days: 0, hours: 0, text: 'Overdue' };

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);

      let text;
      if (days > 1) text = `${days} days`;
      else if (days === 1) text = `1 day, ${hours}h`;
      else text = `${hours} hours`;

      return { expired: false, days, hours, total: diff, text };
    },

    startMonitor() {
      this.checkDeadlines();
      this.checkInterval = setInterval(() => this.checkDeadlines(), 600000); // Every 10 min
    },

    checkDeadlines() {
      const now = Date.now();
      this.deadlines.forEach(deadline => {
        const remaining = deadline.date - now;

        if (remaining <= 0) return;

        if (remaining <= 24 * 3600000 && !deadline.notified24h) {
          this.notify(deadline, '24 hours');
          deadline.notified24h = true;
          this.save();
        } else if (remaining <= 48 * 3600000 && !deadline.notified48h) {
          this.notify(deadline, '48 hours');
          deadline.notified48h = true;
          this.save();
        }
      });
    },

    notify(deadline, timeframe) {
      if (Notification.permission === 'granted') {
        new Notification('Deadline Alert', {
          body: `"${deadline.project}" is due in ${timeframe}!`,
          icon: '/favicon.ico',
          tag: 'deadline-' + deadline.id
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    },

    render() {
      const container = document.querySelector('#deadline-list, [data-deadlines]');
      if (!container) return;

      const sorted = [...this.deadlines].sort((a, b) => a.date - b.date);

      if (sorted.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted, #999); text-align: center; padding: 24px;">No deadlines set. Add one to start tracking.</p>';
        return;
      }

      container.innerHTML = sorted.map(d => {
        const remaining = this.getTimeRemaining(d);
        const urgencyColor = remaining.expired ? 'var(--danger, #dc3545)' :
                             remaining.days <= 2 ? '#ff6b6b' :
                             remaining.days <= 7 ? '#ffd93d' : 'var(--success, #28a745)';

        return `
          <div style="
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 16px; margin: 8px 0; border-radius: 8px;
            background: var(--bg-card, #fff); border: 1px solid var(--border-color, #e0e0e0);
            border-left: 4px solid ${urgencyColor};
          ">
            <div>
              <strong>${this.escapeHtml(d.project)}</strong>
              ${d.description ? `<div style="font-size: 12px; color: var(--text-muted, #999);">${this.escapeHtml(d.description)}</div>` : ''}
              <div style="font-size: 12px; color: var(--text-muted, #999);">
                Due: ${new Date(d.date).toLocaleDateString()}
              </div>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
              <span style="font-weight: 600; color: ${urgencyColor}; font-size: 14px;">
                ${remaining.text}
              </span>
              <button onclick="CortexFreelancer.DeadlineCountdown.removeDeadline('${d.id}')"
                style="border: none; background: none; cursor: pointer; color: var(--text-muted, #999); font-size: 16px;">&times;</button>
            </div>
          </div>
        `;
      }).join('');
    },

    escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  };

  DeadlineCountdown.init();
  window.CortexFreelancer.DeadlineCountdown = DeadlineCountdown;
})();
