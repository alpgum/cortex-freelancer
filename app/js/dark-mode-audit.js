/**
 * CF-112: Fix dark mode color inconsistencies across tools
 * Audits tool pages for missing CSS variables and hardcoded colors.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const DarkModeAudit = {
    CSS_VARS: {
      '--bg-primary': { light: '#ffffff', dark: '#1a1a2e' },
      '--bg-secondary': { light: '#f8f9fa', dark: '#16213e' },
      '--bg-card': { light: '#ffffff', dark: '#1e2a4a' },
      '--text-primary': { light: '#1a1a2e', dark: '#e8e8e8' },
      '--text-secondary': { light: '#6c757d', dark: '#a0a8b4' },
      '--text-muted': { light: '#999', dark: '#777' },
      '--border-color': { light: '#e0e0e0', dark: '#2a3a5c' },
      '--input-bg': { light: '#ffffff', dark: '#1a2744' },
      '--input-border': { light: '#ced4da', dark: '#2a3a5c' },
      '--input-text': { light: '#333', dark: '#e0e0e0' },
      '--accent': { light: '#6c63ff', dark: '#7c74ff' },
      '--accent-hover': { light: '#5a52d5', dark: '#8b83ff' },
      '--success': { light: '#28a745', dark: '#34d058' },
      '--warning': { light: '#ffc107', dark: '#f0ad4e' },
      '--danger': { light: '#dc3545', dark: '#f85149' },
      '--shadow': { light: 'rgba(0,0,0,0.1)', dark: 'rgba(0,0,0,0.3)' },
      '--code-bg': { light: '#f4f4f4', dark: '#0d1117' }
    },

    init() {
      this.ensureVariables();
      this.injectFixes();
    },

    isDarkMode() {
      return document.documentElement.classList.contains('dark') ||
             document.body.classList.contains('dark-mode') ||
             document.documentElement.getAttribute('data-theme') === 'dark' ||
             (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    },

    ensureVariables() {
      const root = document.documentElement;
      const mode = this.isDarkMode() ? 'dark' : 'light';
      Object.entries(this.CSS_VARS).forEach(([varName, values]) => {
        const current = getComputedStyle(root).getPropertyValue(varName).trim();
        if (!current) {
          root.style.setProperty(varName, values[mode]);
        }
      });
    },

    injectFixes() {
      if (document.getElementById('cf-dark-mode-fixes')) return;
      const style = document.createElement('style');
      style.id = 'cf-dark-mode-fixes';
      style.textContent = `
        [data-theme="dark"] .tool-container,
        .dark-mode .tool-container,
        .dark .tool-container {
          background: var(--bg-card, #1e2a4a);
          color: var(--text-primary, #e8e8e8);
          border-color: var(--border-color, #2a3a5c);
        }
        [data-theme="dark"] input,
        [data-theme="dark"] textarea,
        [data-theme="dark"] select,
        .dark-mode input,
        .dark-mode textarea,
        .dark-mode select {
          background: var(--input-bg, #1a2744);
          color: var(--input-text, #e0e0e0);
          border-color: var(--input-border, #2a3a5c);
        }
        [data-theme="dark"] .card,
        [data-theme="dark"] .tool-card,
        .dark-mode .card,
        .dark-mode .tool-card {
          background: var(--bg-card, #1e2a4a);
          border-color: var(--border-color, #2a3a5c);
        }
        [data-theme="dark"] h1,
        [data-theme="dark"] h2,
        [data-theme="dark"] h3,
        .dark-mode h1,
        .dark-mode h2,
        .dark-mode h3 {
          color: var(--text-primary, #e8e8e8);
        }
        [data-theme="dark"] label,
        .dark-mode label {
          color: var(--text-secondary, #a0a8b4);
        }
        [data-theme="dark"] .result-box,
        [data-theme="dark"] .output-box,
        .dark-mode .result-box,
        .dark-mode .output-box {
          background: var(--bg-secondary, #16213e);
          color: var(--text-primary, #e8e8e8);
          border-color: var(--border-color, #2a3a5c);
        }
        [data-theme="dark"] hr,
        .dark-mode hr {
          border-color: var(--border-color, #2a3a5c);
        }
        [data-theme="dark"] ::placeholder,
        .dark-mode ::placeholder {
          color: var(--text-muted, #777);
        }
      `;
      document.head.appendChild(style);
    }
  };

  DarkModeAudit.init();
  window.CortexFreelancer.DarkModeAudit = DarkModeAudit;
})();
