/**
 * Cortex Freelancer — Timeline Core Engine v2.0
 * [cf3-012] Enhanced timeline engine with:
 *   - Time Tracker integration (cf3-001) for actual vs estimated hours
 *   - Client Directory integration (cf3-005) for project-client linking
 *   - Settings integration (cf3-009) for default rates and preferences
 *   - Drag-and-drop milestone reordering and date editing on Gantt
 *   - PDF/PNG export for client-facing timeline sharing
 *   - Automated overdue alerts and notification system
 *   - Real-time progress syncing from time entries
 *
 * Depends on: project-timeline-planner.js (loaded first)
 */

;(function () {
  'use strict';

  var TL = window.CortexProjectTimeline;
  if (!TL) {
    console.warn('[timeline-core] CortexProjectTimeline not found. Load project-timeline-planner.js first.');
    return;
  }

  // ════════════════════════════════════════════════════════════════════
  // §1  TIME TRACKER INTEGRATION (cf3-001)
  // ════════════════════════════════════════════════════════════════════

  var TimeTrackerBridge = {
    TIME_ENTRIES_KEY: 'cortex_time_entries',

    /**
     * Get all time entries from the Time Engine's localStorage
     */
    getEntries: function () {
      try {
        var raw = localStorage.getItem(this.TIME_ENTRIES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },

    /**
     * Get time entries filtered by project name (loose match)
     */
    getEntriesForProject: function (projectName) {
      if (!projectName) return [];
      var lower = projectName.toLowerCase();
      return this.getEntries().filter(function (e) {
        return (e.project || '').toLowerCase().indexOf(lower) >= 0;
      });
    },

    /**
     * Get time entries filtered by client name
     */
    getEntriesForClient: function (clientName) {
      if (!clientName) return [];
      var lower = clientName.toLowerCase();
      return this.getEntries().filter(function (e) {
        return (e.client || '').toLowerCase().indexOf(lower) >= 0;
      });
    },

    /**
     * Calculate total hours from an array of time entries
     */
    totalHours: function (entries) {
      var ms = 0;
      entries.forEach(function (e) {
        ms += (e.duration || 0);
      });
      return Math.round((ms / 3600000) * 100) / 100; // ms → hours, 2 decimal
    },

    /**
     * Sync actual hours from time tracker into project milestones.
     * Matches by milestone name appearing in the entry description/tags.
     * Returns { synced: number, totalActualHours: number }
     */
    syncProjectHours: function (project) {
      if (!project) return { synced: 0, totalActualHours: 0 };

      var entries = this.getEntriesForProject(project.name);
      if (entries.length === 0 && project.client) {
        entries = this.getEntriesForClient(project.client);
      }

      var totalActual = this.totalHours(entries);
      var synced = 0;

      (project.milestones || []).forEach(function (m) {
        var mLower = m.name.toLowerCase();
        var matched = entries.filter(function (e) {
          var desc = ((e.description || '') + ' ' + (e.tags || []).join(' ')).toLowerCase();
          return desc.indexOf(mLower) >= 0;
        });

        if (matched.length > 0) {
          var hours = TimeTrackerBridge.totalHours(matched);
          if (hours !== m.actualHours) {
            m.actualHours = hours;
            synced++;
          }
        }
      });

      return { synced: synced, totalActualHours: totalActual };
    },

    /**
     * Build comparison data: estimated vs actual for each milestone
     */
    getComparisonData: function (project) {
      if (!project) return [];
      return (project.milestones || []).map(function (m) {
        var est = m.estimatedHours || 0;
        var act = m.actualHours || 0;
        var pct = est > 0 ? Math.round((act / est) * 100) : 0;
        var efficiency = est > 0
          ? (pct <= 100 ? 'good' : pct <= 130 ? 'warn' : 'bad')
          : 'good';

        return {
          id: m.id,
          name: m.name,
          estimated: est,
          actual: act,
          percentage: pct,
          efficiency: efficiency,
          status: m.status,
          progress: m.progress,
          overBudget: act > est && est > 0
        };
      }).filter(function (d) { return d.estimated > 0 || d.actual > 0; });
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §2  CLIENT DIRECTORY INTEGRATION (cf3-005)
  // ════════════════════════════════════════════════════════════════════

  var ClientBridge = {
    CLIENTS_KEY: 'cortex_clients',

    getClients: function () {
      try {
        var raw = localStorage.getItem(this.CLIENTS_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },

    findClient: function (name) {
      if (!name) return null;
      var lower = name.toLowerCase();
      return this.getClients().find(function (c) {
        return (c.name || '').toLowerCase() === lower ||
               (c.company || '').toLowerCase() === lower;
      }) || null;
    },

    getClientProjects: function (clientName) {
      var projects = TL.loadProjects();
      var lower = (clientName || '').toLowerCase();
      return projects.filter(function (p) {
        return (p.client || '').toLowerCase() === lower;
      });
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §3  SETTINGS INTEGRATION (cf3-009)
  // ════════════════════════════════════════════════════════════════════

  var SettingsBridge = {
    SETTINGS_KEY: 'cortex_settings',

    getSettings: function () {
      try {
        var raw = localStorage.getItem(this.SETTINGS_KEY);
        var s = raw ? JSON.parse(raw) : {};
        return {
          defaultRate: parseFloat(s.defaultRate || s.hourlyRate) || 75,
          currency: s.currency || 'USD',
          currencySymbol: s.currencySymbol || '$',
          workHoursPerDay: parseInt(s.workHoursPerDay) || 8,
          weekendsOff: s.weekendsOff !== false,
          notifications: s.notifications !== false,
          alertDaysBefore: parseInt(s.alertDaysBefore) || 3
        };
      } catch (e) {
        return { defaultRate: 75, currency: 'USD', currencySymbol: '$', workHoursPerDay: 8, weekendsOff: true, notifications: true, alertDaysBefore: 3 };
      }
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §4  AUTOMATED ALERTS & NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════════

  var AlertEngine = {
    DISMISSED_KEY: 'cortex_timeline_dismissed_alerts',
    _toastTimeout: null,

    getDismissed: function () {
      try {
        var raw = localStorage.getItem(this.DISMISSED_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    },

    dismiss: function (alertKey) {
      var d = this.getDismissed();
      d[alertKey] = Date.now();
      try { localStorage.setItem(this.DISMISSED_KEY, JSON.stringify(d)); } catch (e) {}
    },

    /**
     * Generate enhanced alerts including time tracking warnings
     */
    getEnhancedAlerts: function (projects) {
      var base = TL.getAlerts(projects);
      var settings = SettingsBridge.getSettings();
      var dismissed = this.getDismissed();

      // Add time-based alerts
      projects.forEach(function (project) {
        if (project.status !== 'active') return;

        (project.milestones || []).forEach(function (m) {
          if (m.status === 'completed') return;

          // Over-budget hours alert
          if (m.estimatedHours > 0 && m.actualHours > m.estimatedHours) {
            var overPct = Math.round(((m.actualHours - m.estimatedHours) / m.estimatedHours) * 100);
            base.push({
              type: overPct > 50 ? 'overdue' : 'warning',
              projectId: project.id,
              projectName: project.name,
              milestoneId: m.id,
              milestoneName: m.name,
              message: '"' + m.name + '" is ' + overPct + '% over time estimate (' + m.actualHours + 'h / ' + m.estimatedHours + 'h)',
              daysLeft: -1,
              isTimeAlert: true
            });
          }

          // Stalled milestone alert (in_progress but no progress change)
          if (m.status === 'in_progress' && m.progress < 25 && m.startDate) {
            var daysSinceStart = TL.daysBetween(new Date(m.startDate), new Date());
            if (daysSinceStart > 5) {
              base.push({
                type: 'warning',
                projectId: project.id,
                projectName: project.name,
                milestoneId: m.id,
                milestoneName: m.name,
                message: '"' + m.name + '" started ' + daysSinceStart + ' days ago but only ' + m.progress + '% complete',
                daysLeft: 0,
                isStalledAlert: true
              });
            }
          }
        });
      });

      // Filter dismissed (allow re-show after 24h)
      var now = Date.now();
      return base.filter(function (a) {
        var key = (a.projectId || '') + '_' + (a.milestoneId || '') + '_' + a.type;
        var dismissedAt = dismissed[key];
        return !dismissedAt || (now - dismissedAt > 86400000);
      });
    },

    /**
     * Show a toast notification
     */
    showToast: function (message, type) {
      type = type || 'success';
      var existing = document.querySelector('.timeline-toast');
      if (existing) existing.remove();

      var toast = document.createElement('div');
      toast.className = 'timeline-toast ' + type;
      var icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
      toast.innerHTML =
        '<div class="timeline-toast-icon">' + (icons[type] || 'ℹ️') + '</div>' +
        '<div class="timeline-toast-text">' + message + '</div>';

      document.body.appendChild(toast);
      requestAnimationFrame(function () {
        toast.classList.add('visible');
      });

      clearTimeout(this._toastTimeout);
      this._toastTimeout = setTimeout(function () {
        toast.classList.remove('visible');
        setTimeout(function () { toast.remove(); }, 300);
      }, 4000);
    },

    /**
     * Check if browser notifications are available and request permission
     */
    requestNotificationPermission: function () {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    },

    /**
     * Send a browser notification for urgent items
     */
    sendBrowserNotification: function (title, body) {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      try {
        new Notification(title, {
          body: body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'cortex-timeline'
        });
      } catch (e) { /* silent */ }
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §5  DRAG-AND-DROP TIMELINE EDITING
  // ════════════════════════════════════════════════════════════════════

  var DragDrop = {
    _active: false,
    _dragType: null, // 'move' | 'resize-start' | 'resize-end'
    _milestone: null,
    _project: null,
    _startMouseX: 0,
    _originalStartDate: null,
    _originalDueDate: null,
    _tooltip: null,
    _onComplete: null,

    init: function (canvas, project, ganttChart, onComplete) {
      this._project = project;
      this._onComplete = onComplete;

      // Create tooltip element
      if (!this._tooltip) {
        this._tooltip = document.createElement('div');
        this._tooltip.className = 'gantt-drag-tooltip';
        document.body.appendChild(this._tooltip);
      }

      var self = this;
      var chart = ganttChart;

      canvas.addEventListener('mousedown', function (e) {
        if (!self._project) return;

        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;

        // Determine which milestone bar was clicked
        var hit = self._hitTest(mx, my, chart);
        if (!hit) return;

        e.preventDefault();
        e.stopPropagation();

        self._active = true;
        self._dragType = hit.type;
        self._milestone = hit.milestone;
        self._startMouseX = e.clientX;
        self._originalStartDate = hit.milestone.startDate;
        self._originalDueDate = hit.milestone.dueDate;

        canvas.classList.add('dragging');
        self._tooltip.classList.add('visible');
      });

      window.addEventListener('mousemove', function (e) {
        if (!self._active || !self._milestone) return;

        var dx = e.clientX - self._startMouseX;
        var daysDelta = Math.round(dx / chart.dayWidth);

        if (daysDelta === 0) {
          self._updateTooltip(e.clientX, e.clientY, 'Drag to adjust');
          return;
        }

        var m = self._milestone;

        if (self._dragType === 'move') {
          m.startDate = TL.toDateStr(self._addDays(new Date(self._originalStartDate), daysDelta));
          m.dueDate = TL.toDateStr(self._addDays(new Date(self._originalDueDate), daysDelta));
          self._updateTooltip(e.clientX, e.clientY,
            TL.formatDateShort(m.startDate) + ' → ' + TL.formatDateShort(m.dueDate));
        } else if (self._dragType === 'resize-end') {
          var newEnd = self._addDays(new Date(self._originalDueDate), daysDelta);
          if (m.startDate && newEnd >= new Date(m.startDate)) {
            m.dueDate = TL.toDateStr(newEnd);
            self._updateTooltip(e.clientX, e.clientY,
              'Due: ' + TL.formatDateShort(m.dueDate));
          }
        } else if (self._dragType === 'resize-start') {
          var newStart = self._addDays(new Date(self._originalStartDate), daysDelta);
          if (m.dueDate && newStart <= new Date(m.dueDate)) {
            m.startDate = TL.toDateStr(newStart);
            self._updateTooltip(e.clientX, e.clientY,
              'Start: ' + TL.formatDateShort(m.startDate));
          }
        }

        chart.render();
      });

      window.addEventListener('mouseup', function () {
        if (!self._active) return;

        self._active = false;
        self._tooltip.classList.remove('visible');
        canvas.classList.remove('dragging');

        if (self._milestone && self._onComplete) {
          self._onComplete();
          AlertEngine.showToast('Timeline updated — ' + self._milestone.name, 'success');
        }

        self._milestone = null;
        self._dragType = null;
      });
    },

    _hitTest: function (mx, my, chart) {
      if (!this._project || !chart) return null;

      var milestones = this._project.milestones || [];
      var range = chart._getDateRange();

      for (var i = 0; i < milestones.length; i++) {
        var m = milestones[i];
        if (!m.startDate || !m.dueDate) continue;

        var y = chart.headerHeight + i * chart.rowHeight - chart.scrollY;
        var startOffset = TL.daysBetween(range.start, new Date(m.startDate));
        var endOffset = TL.daysBetween(range.start, new Date(m.dueDate));
        var barX = chart.labelWidth + startOffset * chart.dayWidth - chart.scrollX;
        var barW = Math.max((endOffset - startOffset + 1) * chart.dayWidth, chart.dayWidth);
        var barY = y + 8;
        var barH = chart.rowHeight - 16;

        if (my >= barY && my <= barY + barH && mx >= barX && mx <= barX + barW) {
          // Determine drag type based on position
          var edgeSize = 8;
          if (mx <= barX + edgeSize) return { milestone: m, type: 'resize-start' };
          if (mx >= barX + barW - edgeSize) return { milestone: m, type: 'resize-end' };
          return { milestone: m, type: 'move' };
        }
      }

      return null;
    },

    _updateTooltip: function (x, y, text) {
      if (!this._tooltip) return;
      this._tooltip.textContent = text;
      this._tooltip.style.left = (x + 15) + 'px';
      this._tooltip.style.top = (y - 35) + 'px';
    },

    _addDays: function (date, days) {
      var d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §6  MILESTONE LIST DRAG-AND-DROP REORDER
  // ════════════════════════════════════════════════════════════════════

  var ListDragDrop = {
    _draggedId: null,

    init: function (container, project, onReorder) {
      var self = this;

      container.addEventListener('dragstart', function (e) {
        var card = e.target.closest('.milestone-card');
        if (!card) return;
        self._draggedId = card.dataset.milestoneId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', self._draggedId);
      });

      container.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        var card = e.target.closest('.milestone-card');
        if (card && card.dataset.milestoneId !== self._draggedId) {
          // Remove previous highlights
          container.querySelectorAll('.drag-over').forEach(function (el) {
            el.classList.remove('drag-over');
          });
          card.classList.add('drag-over');
        }
      });

      container.addEventListener('dragleave', function (e) {
        var card = e.target.closest('.milestone-card');
        if (card) card.classList.remove('drag-over');
      });

      container.addEventListener('drop', function (e) {
        e.preventDefault();
        container.querySelectorAll('.drag-over').forEach(function (el) {
          el.classList.remove('drag-over');
        });

        var targetCard = e.target.closest('.milestone-card');
        if (!targetCard || !self._draggedId) return;

        var targetId = targetCard.dataset.milestoneId;
        if (targetId === self._draggedId) return;

        var milestones = project.milestones || [];
        var fromIdx = milestones.findIndex(function (m) { return m.id === self._draggedId; });
        var toIdx = milestones.findIndex(function (m) { return m.id === targetId; });

        if (fromIdx >= 0 && toIdx >= 0) {
          var moved = milestones.splice(fromIdx, 1)[0];
          milestones.splice(toIdx, 0, moved);
          project.milestones = milestones;
          if (onReorder) onReorder();
          AlertEngine.showToast('Milestones reordered', 'success');
        }

        self._draggedId = null;
      });

      container.addEventListener('dragend', function () {
        container.querySelectorAll('.dragging').forEach(function (el) {
          el.classList.remove('dragging');
        });
        self._draggedId = null;
      });
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §7  EXPORT ENGINE (PDF / PNG / Client Sharing)
  // ════════════════════════════════════════════════════════════════════

  var ExportEngine = {
    /**
     * Export Gantt chart as PNG using canvas toDataURL
     */
    exportAsPNG: function (project, ganttChart) {
      if (!ganttChart || !ganttChart.canvas) {
        AlertEngine.showToast('Gantt chart not available', 'error');
        return;
      }

      // Temporarily increase resolution for export
      var canvas = ganttChart.canvas;
      var ctx = canvas.getContext('2d');
      var dpr = 2; // High-res export

      var origW = canvas.width;
      var origH = canvas.height;

      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
      ganttChart.render();

      try {
        var dataUrl = canvas.toDataURL('image/png', 1.0);
        var filename = (project.name || 'Timeline').replace(/[^a-z0-9]/gi, '_') + '_timeline.png';
        this._downloadDataUrl(dataUrl, filename);
        AlertEngine.showToast('Timeline exported as PNG', 'success');
      } catch (e) {
        AlertEngine.showToast('PNG export failed: ' + e.message, 'error');
      }

      // Restore original resolution
      canvas.width = origW;
      canvas.height = origH;
      ganttChart.render();
    },

    /**
     * Export project timeline as a styled PDF (using browser print)
     */
    exportAsPDF: function (project) {
      if (!project) return;

      var settings = SettingsBridge.getSettings();
      var sym = settings.currencySymbol;
      var stats = TL.getProjectStats(project);
      var comparison = TimeTrackerBridge.getComparisonData(project);

      // Build a printable HTML document
      var phases = {};
      (project.phases || []).forEach(function (p) { phases[p.id] = p; });

      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
        '<title>' + this._esc(project.name) + ' — Timeline</title>' +
        '<style>' +
        'body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        'background:#fff;color:#111;padding:40px;max-width:900px;margin:0 auto;font-size:13px;line-height:1.6}' +
        'h1{font-size:24px;margin-bottom:4px;color:#111}' +
        'h2{font-size:16px;color:#ff8844;margin:24px 0 12px;border-bottom:2px solid #ff8844;padding-bottom:4px}' +
        '.meta{color:#666;font-size:12px;margin-bottom:24px}' +
        '.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}' +
        '.stat{background:#f8f8f8;border-radius:8px;padding:12px;text-align:center}' +
        '.stat-val{font-size:22px;font-weight:900;color:#ff8844}' +
        '.stat-lbl{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.5px}' +
        'table{width:100%;border-collapse:collapse;margin-bottom:16px}' +
        'th{text-align:left;font-size:11px;text-transform:uppercase;color:#888;padding:6px 8px;border-bottom:2px solid #ddd}' +
        'td{padding:8px;border-bottom:1px solid #eee;font-size:12px}' +
        '.status{display:inline-block;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:700}' +
        '.status-completed{background:#e6fff2;color:#00994d}' +
        '.status-in_progress{background:#fff3e6;color:#cc6600}' +
        '.status-blocked{background:#ffe6ea;color:#cc0033}' +
        '.status-not_started{background:#f0f0f0;color:#666}' +
        '.status-review{background:#e6f0ff;color:#3366cc}' +
        '.status-on_hold{background:#fff9e6;color:#997a00}' +
        '.progress-bar{width:100px;height:6px;background:#eee;border-radius:3px;overflow:hidden;display:inline-block;vertical-align:middle}' +
        '.progress-fill{height:100%;border-radius:3px}' +
        '.footer{margin-top:32px;padding-top:16px;border-top:1px solid #ddd;color:#aaa;font-size:10px;text-align:center}' +
        '.time-col{font-size:11px}' +
        '.over{color:#cc0033;font-weight:700}' +
        '.under{color:#00994d}' +
        '@media print{body{padding:20px}@page{margin:1cm}}' +
        '</style></head><body>';

      // Header
      html += '<h1>' + this._esc(project.name) + '</h1>';
      html += '<div class="meta">';
      if (project.client) html += 'Client: <strong>' + this._esc(project.client) + '</strong> · ';
      html += TL.formatDate(project.startDate) + ' → ' + TL.formatDate(project.endDate);
      if (project.budget) html += ' · Budget: ' + sym + project.budget.toLocaleString();
      html += '</div>';

      // Stats
      html += '<div class="stats">';
      html += '<div class="stat"><div class="stat-val">' + stats.progress + '%</div><div class="stat-lbl">Progress</div></div>';
      html += '<div class="stat"><div class="stat-val">' + stats.completed + '/' + stats.total + '</div><div class="stat-lbl">Milestones</div></div>';
      html += '<div class="stat"><div class="stat-val">' + (stats.daysRemaining || '—') + '</div><div class="stat-lbl">Days Left</div></div>';
      html += '</div>';

      // Milestones table
      html += '<h2>Milestones</h2>';
      html += '<table><thead><tr><th>Milestone</th><th>Phase</th><th>Status</th><th>Due Date</th><th>Progress</th><th>Hours</th></tr></thead><tbody>';

      (project.milestones || []).forEach(function (m) {
        var phase = phases[m.phaseId];
        var status = TL.MILESTONE_STATUS[m.status] || {};
        var pctColor = m.progress >= 100 ? '#00994d' : m.progress >= 50 ? '#cc6600' : '#666';

        html += '<tr>';
        html += '<td><strong>' + ExportEngine._esc(m.name) + '</strong></td>';
        html += '<td>' + (phase ? ExportEngine._esc(phase.name) : '—') + '</td>';
        html += '<td><span class="status status-' + m.status + '">' + (status.label || m.status) + '</span></td>';
        html += '<td>' + TL.formatDateShort(m.dueDate) + '</td>';
        html += '<td><div class="progress-bar"><div class="progress-fill" style="width:' + m.progress + '%;background:' + pctColor + '"></div></div> ' + m.progress + '%</td>';
        html += '<td class="time-col">';
        if (m.estimatedHours > 0) {
          var cls = m.actualHours > m.estimatedHours ? 'over' : 'under';
          html += '<span class="' + cls + '">' + (m.actualHours || 0) + 'h</span> / ' + m.estimatedHours + 'h';
        } else {
          html += (m.actualHours || 0) + 'h';
        }
        html += '</td>';
        html += '</tr>';
      });

      html += '</tbody></table>';

      // Time tracking summary if data exists
      if (comparison.length > 0) {
        var totalEst = 0, totalAct = 0;
        comparison.forEach(function (c) { totalEst += c.estimated; totalAct += c.actual; });

        html += '<h2>Time Tracking Summary</h2>';
        html += '<div class="stats">';
        html += '<div class="stat"><div class="stat-val">' + totalEst + 'h</div><div class="stat-lbl">Estimated</div></div>';
        html += '<div class="stat"><div class="stat-val">' + totalAct + 'h</div><div class="stat-lbl">Actual</div></div>';
        html += '<div class="stat"><div class="stat-val">' + (totalEst > 0 ? Math.round((totalAct / totalEst) * 100) : 0) + '%</div><div class="stat-lbl">Utilization</div></div>';
        html += '</div>';
      }

      // Footer
      html += '<div class="footer">Generated by Cortex Freelancer · ' + new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</div>';
      html += '</body></html>';

      // Open in new window and trigger print
      var win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(function () { win.print(); }, 500);
        AlertEngine.showToast('PDF export opened — use Print dialog to save', 'success');
      } else {
        AlertEngine.showToast('Pop-up blocked. Please allow pop-ups for PDF export.', 'error');
      }
    },

    /**
     * Generate a client-facing share summary (copyable text)
     */
    generateShareSummary: function (project) {
      if (!project) return '';

      var stats = TL.getProjectStats(project);
      var lines = [];

      lines.push('📊 PROJECT STATUS: ' + project.name);
      lines.push('━'.repeat(40));
      if (project.client) lines.push('Client: ' + project.client);
      lines.push('Timeline: ' + TL.formatDate(project.startDate) + ' → ' + TL.formatDate(project.endDate));
      lines.push('Progress: ' + stats.progress + '% complete');
      lines.push('Milestones: ' + stats.completed + '/' + stats.total + ' done');
      if (stats.daysRemaining) lines.push('Days remaining: ' + stats.daysRemaining);
      lines.push('');

      // Active milestones
      var active = (project.milestones || []).filter(function (m) {
        return m.status === 'in_progress' || m.status === 'review';
      });
      if (active.length > 0) {
        lines.push('🔄 CURRENTLY IN PROGRESS:');
        active.forEach(function (m) {
          lines.push('  • ' + m.name + ' — ' + m.progress + '% complete' +
            (m.dueDate ? ' (due ' + TL.formatDateShort(m.dueDate) + ')' : ''));
        });
        lines.push('');
      }

      // Completed recently
      var completed = (project.milestones || []).filter(function (m) {
        if (m.status !== 'completed' || !m.completedDate) return false;
        return TL.daysBetween(new Date(m.completedDate), new Date()) <= 7;
      });
      if (completed.length > 0) {
        lines.push('✅ RECENTLY COMPLETED:');
        completed.forEach(function (m) {
          lines.push('  • ' + m.name);
        });
        lines.push('');
      }

      // Upcoming milestones
      var upcoming = (project.milestones || []).filter(function (m) {
        if (m.status === 'completed') return false;
        if (!m.dueDate) return false;
        var days = TL.daysBetween(new Date(), new Date(m.dueDate));
        return days >= 0 && days <= 14;
      });
      if (upcoming.length > 0) {
        lines.push('📅 UPCOMING (next 2 weeks):');
        upcoming.forEach(function (m) {
          var days = TL.daysBetween(new Date(), new Date(m.dueDate));
          lines.push('  • ' + m.name + ' — due in ' + days + ' day' + (days !== 1 ? 's' : ''));
        });
        lines.push('');
      }

      lines.push('━'.repeat(40));
      lines.push('Generated via Cortex · ' + new Date().toLocaleDateString());

      return lines.join('\n');
    },

    /**
     * Copy text to clipboard
     */
    copyToClipboard: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          AlertEngine.showToast('Copied to clipboard!', 'success');
        }).catch(function () {
          ExportEngine._fallbackCopy(text);
        });
      } else {
        this._fallbackCopy(text);
      }
    },

    _fallbackCopy: function (text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        AlertEngine.showToast('Copied to clipboard!', 'success');
      } catch (e) {
        AlertEngine.showToast('Copy failed', 'error');
      }
      document.body.removeChild(ta);
    },

    _downloadDataUrl: function (dataUrl, filename) {
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },

    _esc: function (str) {
      var d = document.createElement('div');
      d.appendChild(document.createTextNode(str || ''));
      return d.innerHTML;
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §8  PROGRESS AUTO-UPDATE FROM TIME DATA
  // ════════════════════════════════════════════════════════════════════

  var ProgressSync = {
    /**
     * Auto-update milestone progress based on actual vs estimated hours.
     * Only updates milestones that haven't been manually set to 100%
     * and are not already completed.
     */
    autoUpdateProgress: function (project) {
      if (!project) return 0;

      var updated = 0;
      (project.milestones || []).forEach(function (m) {
        if (m.status === 'completed') return;
        if (m.estimatedHours <= 0) return;

        // Calculate progress from time ratio
        var timePct = Math.round((m.actualHours / m.estimatedHours) * 100);
        // Cap at 95% — only manual action or completion sets 100%
        var suggested = Math.min(timePct, 95);

        // Only auto-update if suggested is higher than current
        // (we don't decrease progress automatically)
        if (suggested > m.progress) {
          m.progress = suggested;
          if (m.status === 'not_started' && suggested > 0) {
            m.status = 'in_progress';
          }
          updated++;
        }
      });

      return updated;
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §9  COMMUNICATION HUB INTEGRATION (cf3-011)
  // ════════════════════════════════════════════════════════════════════

  var CommBridge = {
    NOTIFICATIONS_KEY: 'cortex_comm_notifications',

    /**
     * Queue a notification for the Communication Hub
     */
    queueNotification: function (notification) {
      try {
        var raw = localStorage.getItem(this.NOTIFICATIONS_KEY);
        var list = raw ? JSON.parse(raw) : [];
        list.push({
          id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          source: 'project-timeline',
          type: notification.type || 'info',
          title: notification.title || 'Project Update',
          message: notification.message || '',
          projectId: notification.projectId || null,
          milestoneId: notification.milestoneId || null,
          timestamp: new Date().toISOString(),
          read: false
        });
        // Keep last 50 notifications
        if (list.length > 50) list = list.slice(-50);
        localStorage.setItem(this.NOTIFICATIONS_KEY, JSON.stringify(list));
      } catch (e) { /* silent */ }
    },

    /**
     * Notify on milestone completion
     */
    notifyMilestoneComplete: function (project, milestone) {
      this.queueNotification({
        type: 'milestone_complete',
        title: '✅ Milestone Complete',
        message: '"' + milestone.name + '" in ' + project.name + ' has been completed.',
        projectId: project.id,
        milestoneId: milestone.id
      });

      AlertEngine.sendBrowserNotification(
        '✅ Milestone Complete',
        '"' + milestone.name + '" in ' + project.name + ' is done!'
      );
    },

    /**
     * Notify on overdue items
     */
    notifyOverdue: function (project, milestone) {
      this.queueNotification({
        type: 'overdue',
        title: '🔴 Overdue Milestone',
        message: '"' + milestone.name + '" in ' + project.name + ' is past its deadline.',
        projectId: project.id,
        milestoneId: milestone.id
      });
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // §10  PUBLIC API — Extend CortexProjectTimeline
  // ════════════════════════════════════════════════════════════════════

  // Attach all modules
  TL.TimeTrackerBridge = TimeTrackerBridge;
  TL.ClientBridge = ClientBridge;
  TL.SettingsBridge = SettingsBridge;
  TL.AlertEngine = AlertEngine;
  TL.DragDrop = DragDrop;
  TL.ListDragDrop = ListDragDrop;
  TL.ExportEngine = ExportEngine;
  TL.ProgressSync = ProgressSync;
  TL.CommBridge = CommBridge;

  // Update alias
  window.CortexProjectTimeline = TL;
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProjectTimeline = TL;

})();
