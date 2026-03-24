/**
 * CF-117: Fix time tracker not persisting entries on page refresh
 * Saves time entries to localStorage on each start/stop, not just page unload.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const STORAGE_KEY = 'cf_time_entries';
  const ACTIVE_KEY = 'cf_time_active';

  const TimeEntryPersist = {
    entries: [],
    activeEntry: null,

    init() {
      this.load();
      this.patchTracker();
      window.addEventListener('beforeunload', () => this.save());
    },

    load() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.entries = saved ? JSON.parse(saved) : [];

        const active = localStorage.getItem(ACTIVE_KEY);
        if (active) {
          this.activeEntry = JSON.parse(active);
        }
      } catch (e) {
        console.warn('[CF-117] Failed to load time entries:', e);
        this.entries = [];
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
        if (this.activeEntry) {
          localStorage.setItem(ACTIVE_KEY, JSON.stringify(this.activeEntry));
        } else {
          localStorage.removeItem(ACTIVE_KEY);
        }
      } catch (e) {
        console.warn('[CF-117] Failed to save time entries:', e);
      }
    },

    start(project, task) {
      this.activeEntry = {
        id: Date.now().toString(36),
        project: project || 'Unassigned',
        task: task || '',
        startTime: Date.now(),
        endTime: null
      };
      this.save();
      return this.activeEntry;
    },

    stop() {
      if (!this.activeEntry) return null;
      this.activeEntry.endTime = Date.now();
      this.activeEntry.duration = this.activeEntry.endTime - this.activeEntry.startTime;
      this.entries.push(this.activeEntry);
      const completed = { ...this.activeEntry };
      this.activeEntry = null;
      this.save();
      return completed;
    },

    getElapsed() {
      if (!this.activeEntry) return 0;
      return Date.now() - this.activeEntry.startTime;
    },

    getEntries(filter) {
      if (!filter) return this.entries;
      return this.entries.filter(e => {
        if (filter.project && e.project !== filter.project) return false;
        if (filter.from && e.startTime < filter.from) return false;
        if (filter.to && e.startTime > filter.to) return false;
        return true;
      });
    },

    deleteEntry(id) {
      this.entries = this.entries.filter(e => e.id !== id);
      this.save();
    },

    getTotalDuration(filter) {
      return this.getEntries(filter).reduce((sum, e) => sum + (e.duration || 0), 0);
    },

    patchTracker() {
      document.addEventListener('DOMContentLoaded', () => {
        const startBtn = document.querySelector('#start-timer, [data-action="start-timer"]');
        const stopBtn = document.querySelector('#stop-timer, [data-action="stop-timer"]');

        if (startBtn) {
          startBtn.addEventListener('click', () => {
            const project = document.querySelector('#project-name, [data-field="project"]')?.value;
            const task = document.querySelector('#task-name, [data-field="task"]')?.value;
            this.start(project, task);
          });
        }

        if (stopBtn) {
          stopBtn.addEventListener('click', () => this.stop());
        }

        // Restore active timer if page was refreshed
        if (this.activeEntry) {
          const event = new CustomEvent('timerRestored', { detail: this.activeEntry });
          document.dispatchEvent(event);
        }
      });
    }
  };

  TimeEntryPersist.init();
  window.CortexFreelancer.TimeEntryPersist = TimeEntryPersist;
})();
