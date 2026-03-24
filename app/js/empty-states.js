/**
 * CF-287: Empty States
 * Illustrated empty states for all tool categories with helpful CTAs.
 *
 * @namespace window.CortexFreelancer.EmptyStates
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-empty-states-styles';

  var CSS = '\n\
.ct-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:3rem 1.5rem;max-width:400px;margin:0 auto}\
.ct-empty__icon{font-size:3rem;margin-bottom:1rem;line-height:1}\
.ct-empty__title{font-size:1.125rem;font-weight:600;color:var(--ct-colors-neutral-900,#111827);margin:0 0 0.5rem}\
.ct-empty__desc{font-size:0.875rem;color:var(--ct-colors-neutral-500,#6b7280);margin:0 0 1.25rem;line-height:1.5}\
.ct-empty__cta{display:inline-flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;background:var(--ct-colors-primary-600,#4f46e5);color:#fff;border:none;border-radius:var(--ct-radius-md,0.5rem);font-size:0.875rem;font-weight:600;cursor:pointer;font-family:inherit;transition:background 0.15s}\
.ct-empty__cta:hover{background:var(--ct-colors-primary-700,#4338ca)}\
.ct-empty__secondary{margin-top:0.75rem;font-size:0.8125rem;color:var(--ct-colors-primary-600,#4f46e5);cursor:pointer;background:none;border:none;font-family:inherit;text-decoration:underline}\
';

  var TYPES = {
    proposals: {
      icon: '\uD83D\uDCDD',
      title: 'No proposals yet',
      description: 'Start writing winning proposals to land your next freelance gig.',
      cta: 'Write a Proposal',
      ctaAction: 'proposal'
    },
    jobs: {
      icon: '\uD83D\uDD0D',
      title: 'No jobs found',
      description: 'Try adjusting your search filters or save a search to get notified of new matches.',
      cta: 'Browse Jobs',
      ctaAction: 'job-search'
    },
    earnings: {
      icon: '\uD83D\uDCB0',
      title: 'No earnings data',
      description: 'Once you start tracking your income, charts and insights will appear here.',
      cta: 'Add Earnings',
      ctaAction: 'earnings'
    },
    clients: {
      icon: '\uD83E\uDD1D',
      title: 'No clients yet',
      description: 'Track your client relationships to build stronger freelance partnerships.',
      cta: 'Add a Client',
      ctaAction: 'client-crm'
    },
    invoices: {
      icon: '\uD83E\uDDFE',
      title: 'No invoices',
      description: 'Create professional invoices to get paid faster.',
      cta: 'Create Invoice',
      ctaAction: 'invoice'
    },
    templates: {
      icon: '\uD83D\uDCC4',
      title: 'No templates saved',
      description: 'Save your best proposals and emails as reusable templates.',
      cta: 'Create Template',
      ctaAction: 'templates'
    },
    analytics: {
      icon: '\uD83D\uDCCA',
      title: 'No analytics data',
      description: 'Start using Cortex tools to see performance insights and trends.',
      cta: 'Explore Tools',
      ctaAction: 'tools'
    },
    projects: {
      icon: '\uD83D\uDCC1',
      title: 'No active projects',
      description: 'Track your freelance projects with milestones and deadlines.',
      cta: 'Add a Project',
      ctaAction: 'project-tracker'
    },
    search: {
      icon: '\uD83D\uDE45',
      title: 'No results found',
      description: 'We couldn\'t find anything matching your search. Try different keywords.',
      cta: 'Clear Search',
      ctaAction: 'clear-search'
    },
    generic: {
      icon: '\uD83D\uDCE6',
      title: 'Nothing here yet',
      description: 'This section is empty. Get started by taking your first action.',
      cta: 'Get Started',
      ctaAction: 'dashboard'
    }
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function renderEmptyState(type, container, opts) {
    opts = opts || {};
    var config = TYPES[type] || TYPES.generic;
    var title = opts.title || config.title;
    var desc = opts.description || config.description;
    var cta = opts.cta || config.cta;

    var html = '<div class="ct-empty">';
    html += '<div class="ct-empty__icon">' + config.icon + '</div>';
    html += '<h3 class="ct-empty__title">' + title + '</h3>';
    html += '<p class="ct-empty__desc">' + desc + '</p>';
    if (cta) {
      html += '<button class="ct-empty__cta" data-action="' + (opts.ctaAction || config.ctaAction || '') + '">' + cta + '</button>';
    }
    if (opts.secondaryLabel) {
      html += '<button class="ct-empty__secondary" data-action="' + (opts.secondaryAction || '') + '">' + opts.secondaryLabel + '</button>';
    }
    html += '</div>';

    if (container) {
      var el = typeof container === 'string' ? document.querySelector(container) : container;
      if (el) el.innerHTML = html;
    }

    return html;
  }

  function renderEmptyStateShowcase() {
    var html = '<div style="font-family:var(--ct-typography-font-family,sans-serif);padding:1.5rem">';
    html += '<h2 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">Empty States</h2>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem">';

    Object.keys(TYPES).forEach(function (type) {
      html += '<div style="border:1px solid var(--ct-colors-neutral-200,#e5e7eb);border-radius:var(--ct-radius-lg,0.75rem);overflow:hidden">';
      html += '<div style="padding:0.5rem 1rem;background:var(--ct-colors-neutral-50,#f9fafb);border-bottom:1px solid var(--ct-colors-neutral-200,#e5e7eb);font-size:0.75rem;font-weight:600;color:var(--ct-colors-neutral-500,#6b7280);text-transform:uppercase;letter-spacing:0.05em">' + type + '</div>';
      html += renderEmptyState(type);
      html += '</div>';
    });

    html += '</div></div>';
    return html;
  }

  injectStyles();

  window.CortexFreelancer.EmptyStates = {
    types: TYPES,
    renderEmptyState: renderEmptyState,
    renderEmptyStateShowcase: renderEmptyStateShowcase
  };
})();
