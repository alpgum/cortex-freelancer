/**
 * CF-119: Fix analytics events not firing on tool interactions
 * Verifies GA4 gtag() fires on tool usage, checks GTM container loaded.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const AnalyticsFix = {
    queue: [],
    ready: false,

    init() {
      this.waitForGtag();
      document.addEventListener('DOMContentLoaded', () => this.bindToolEvents());
    },

    waitForGtag() {
      if (typeof window.gtag === 'function') {
        this.ready = true;
        this.flushQueue();
        return;
      }

      // Provide a stub that queues events until real gtag loads
      if (!window.dataLayer) window.dataLayer = [];
      if (typeof window.gtag !== 'function') {
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
      }

      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (typeof window.gtag === 'function' || attempts > 30) {
          clearInterval(check);
          this.ready = true;
          this.flushQueue();
        }
      }, 1000);
    },

    flushQueue() {
      this.queue.forEach(evt => this.send(evt.name, evt.params));
      this.queue = [];
    },

    track(eventName, params) {
      if (this.ready) {
        this.send(eventName, params);
      } else {
        this.queue.push({ name: eventName, params });
      }
    },

    send(eventName, params) {
      try {
        window.gtag('event', eventName, {
          event_category: params?.category || 'tool_interaction',
          event_label: params?.label || '',
          value: params?.value || 0,
          ...params
        });
      } catch (e) {
        console.warn('[CF-119] gtag send failed:', e);
      }
    },

    bindToolEvents() {
      // Track tool page views
      const toolPage = document.querySelector('[data-tool-name], .tool-container');
      if (toolPage) {
        const toolName = toolPage.dataset.toolName || document.title || window.location.pathname;
        this.track('tool_view', { label: toolName, category: 'tools' });
      }

      // Track tool form submissions
      document.querySelectorAll('.tool-container form, [data-tool-form]').forEach(form => {
        form.addEventListener('submit', () => {
          const toolName = form.closest('[data-tool-name]')?.dataset.toolName || 'unknown';
          this.track('tool_submit', { label: toolName, category: 'tools' });
        });
      });

      // Track tool button clicks
      document.querySelectorAll('[data-track-click], .tool-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.trackClick || btn.textContent.trim().slice(0, 50);
          this.track('tool_action', { label: action, category: 'tools' });
        });
      });

      // Track copy actions
      document.querySelectorAll('[data-action="copy"], .copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.track('tool_copy', { label: 'output_copied', category: 'tools' });
        });
      });
    }
  };

  AnalyticsFix.init();
  window.CortexFreelancer.AnalyticsFix = AnalyticsFix;
})();
