/**
 * CF-128: Time Tracker — add Pomodoro mode with break reminders
 * 25/5 Pomodoro timer with session tracking and productivity stats.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const STORAGE_KEY = 'cf_pomodoro_sessions';

  const PomodoroTimer = {
    WORK_DURATION: 25 * 60,
    SHORT_BREAK: 5 * 60,
    LONG_BREAK: 15 * 60,
    LONG_BREAK_INTERVAL: 4,

    state: 'idle', // idle | work | short_break | long_break
    remaining: 0,
    interval: null,
    sessionCount: 0,
    sessions: [],

    init() {
      this.loadSessions();
      document.addEventListener('DOMContentLoaded', () => this.bind());
    },

    bind() {
      const startBtn = document.querySelector('#pomodoro-start, [data-action="pomodoro-start"]');
      const stopBtn = document.querySelector('#pomodoro-stop, [data-action="pomodoro-stop"]');
      const skipBtn = document.querySelector('#pomodoro-skip, [data-action="pomodoro-skip"]');

      if (startBtn) startBtn.addEventListener('click', () => this.start());
      if (stopBtn) stopBtn.addEventListener('click', () => this.stop());
      if (skipBtn) skipBtn.addEventListener('click', () => this.skip());
    },

    start() {
      if (this.state === 'idle') {
        this.state = 'work';
        this.remaining = this.WORK_DURATION;
      }
      this.tick();
      this.interval = setInterval(() => this.tick(), 1000);
      this.updateUI();
    },

    stop() {
      clearInterval(this.interval);
      this.interval = null;
      this.state = 'idle';
      this.remaining = 0;
      this.updateUI();
    },

    skip() {
      clearInterval(this.interval);
      this.onPhaseComplete();
    },

    tick() {
      if (this.remaining <= 0) {
        clearInterval(this.interval);
        this.onPhaseComplete();
        return;
      }
      this.remaining--;
      this.updateUI();
    },

    onPhaseComplete() {
      if (this.state === 'work') {
        this.sessionCount++;
        this.sessions.push({
          completedAt: Date.now(),
          duration: this.WORK_DURATION,
          date: new Date().toISOString().slice(0, 10)
        });
        this.saveSessions();
        this.notify('Work session complete! Time for a break.');

        if (this.sessionCount % this.LONG_BREAK_INTERVAL === 0) {
          this.state = 'long_break';
          this.remaining = this.LONG_BREAK;
        } else {
          this.state = 'short_break';
          this.remaining = this.SHORT_BREAK;
        }
      } else {
        this.notify('Break over! Ready for another session?');
        this.state = 'work';
        this.remaining = this.WORK_DURATION;
      }

      this.interval = setInterval(() => this.tick(), 1000);
      this.updateUI();
    },

    notify(message) {
      if (Notification.permission === 'granted') {
        new Notification('Cortex Pomodoro', { body: message, icon: '/favicon.ico' });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
      // Audio beep fallback
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 800;
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch (e) { /* audio not available */ }
    },

    formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    updateUI() {
      const timerEl = document.querySelector('#pomodoro-timer, [data-pomodoro-time]');
      const stateEl = document.querySelector('#pomodoro-state, [data-pomodoro-state]');
      const countEl = document.querySelector('#pomodoro-count, [data-pomodoro-count]');

      if (timerEl) timerEl.textContent = this.formatTime(this.remaining);
      if (stateEl) {
        const labels = { idle: 'Ready', work: 'Focus', short_break: 'Short Break', long_break: 'Long Break' };
        stateEl.textContent = labels[this.state] || this.state;
      }
      if (countEl) countEl.textContent = this.sessionCount;
    },

    getStats() {
      const today = new Date().toISOString().slice(0, 10);
      const todaySessions = this.sessions.filter(s => s.date === today);
      const weekAgo = Date.now() - 7 * 86400000;
      const weekSessions = this.sessions.filter(s => s.completedAt > weekAgo);

      return {
        today: todaySessions.length,
        todayMinutes: todaySessions.length * 25,
        week: weekSessions.length,
        weekMinutes: weekSessions.length * 25,
        total: this.sessions.length,
        totalMinutes: this.sessions.length * 25
      };
    },

    loadSessions() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.sessions = saved ? JSON.parse(saved) : [];
      } catch (e) {
        this.sessions = [];
      }
    },

    saveSessions() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions));
      } catch (e) {
        console.warn('[CF-128] Failed to save pomodoro sessions:', e);
      }
    }
  };

  PomodoroTimer.init();
  window.CortexFreelancer.PomodoroTimer = PomodoroTimer;
})();
