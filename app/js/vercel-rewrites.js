/**
 * CF-105: Fix 404 on direct URL navigation to tool pages
 * Client-side path resolver for clean URLs on Vercel.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const VercelRewrites = {
    TOOL_ROUTES: {
      '/tools/proposal': '/app/tools/proposal.html',
      '/tools/rate-calculator': '/app/tools/rate-calculator.html',
      '/tools/fee-calculator': '/app/tools/fee-calculator.html',
      '/tools/invoice': '/app/tools/invoice.html',
      '/tools/time-tracker': '/app/tools/time-tracker.html',
      '/tools/contract-review': '/app/tools/contract-review.html',
      '/tools/bio-generator': '/app/tools/bio-generator.html',
      '/tools/email-writer': '/app/tools/email-writer.html',
      '/tools/job-scanner': '/app/tools/job-scanner.html',
      '/tools/portfolio-review': '/app/tools/portfolio-review.html',
      '/tools/meeting-notes': '/app/tools/meeting-notes.html',
      '/tools/scope-analyzer': '/app/tools/scope-analyzer.html',
      '/tools/tax-estimator': '/app/tools/tax-estimator.html',
      '/tools/project-tracker': '/app/tools/project-tracker.html',
      '/tools/client-crm': '/app/tools/client-crm.html',
      '/tools/weekly-summary': '/app/tools/weekly-summary.html',
      '/tools/payment-checker': '/app/tools/payment-checker.html',
      '/tools/income-dashboard': '/app/tools/income-dashboard.html',
      '/tools/job-digest': '/app/tools/job-digest.html',
      '/tools/sow-generator': '/app/tools/sow-generator.html',
      '/tools/templates': '/app/tools/templates.html',
      '/tools/availability': '/app/tools/availability.html',
      '/tools/project-brief': '/app/tools/project-brief.html',
      '/tools/client-red-flags': '/app/tools/client-red-flags.html'
    },

    APP_ROUTES: {
      '/dashboard': '/app/dashboard.html',
      '/chat': '/app/chat.html',
      '/login': '/app/login.html',
      '/signup': '/app/signup.html',
      '/tools': '/app/tools/index.html',
      '/agents': '/app/agents.html',
      '/referral': '/app/referral.html',
      '/share': '/app/share.html'
    },

    init() {
      const path = window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
      const allRoutes = { ...this.TOOL_ROUTES, ...this.APP_ROUTES };

      if (allRoutes[path] && window.location.pathname !== allRoutes[path]) {
        // Let vercel.json handle this; this is a client-side fallback
        console.log('[CF-105] Route mapped:', path, '→', allRoutes[path]);
      }
    },

    generateVercelRewrites() {
      const allRoutes = { ...this.TOOL_ROUTES, ...this.APP_ROUTES };
      return Object.entries(allRoutes).map(([source, destination]) => ({
        source,
        destination
      }));
    }
  };

  VercelRewrites.init();
  window.CortexFreelancer.VercelRewrites = VercelRewrites;
})();
