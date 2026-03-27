/* ───────────────────────────────────────────
   cross-linker.js  –  Smart Tool Cross-Linking
   Contextual "Next Steps" after tool completion.
   Detects results, suggests natural workflow chains,
   and bridges data between tools via localStorage.

   Drop <script src="js/cross-linker.js"></script>
   at the bottom of any tool page.
   ─────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── workflow definitions ──────────────────
     Each key is a tool slug (from URL path).
     `next` = ordered list of suggested follow-ups.
     `bridge` = localStorage key to write on completion
                so the next tool can pre-fill data.
  ──────────────────────────────────────────── */
  var WORKFLOWS = {
    // Money flow
    'invoice': {
      next: [
        { slug: 'payment-checker', label: 'Track payment', icon: '\u{1F4B3}' },
        { slug: 'email-writer',    label: 'Send reminder email', icon: '\u{2709}\u{FE0F}' },
        { slug: 'income-dashboard', label: 'View income dashboard', icon: '\u{1F4CA}' }
      ],
      bridge: 'cortex_last_invoice'
    },
    'rate-calculator': {
      next: [
        { slug: 'proposal',       label: 'Generate proposal', icon: '\u{1F4DD}' },
        { slug: 'fee-calculator',  label: 'Calculate platform fees', icon: '\u{1F4B0}' },
        { slug: 'bio-generator',   label: 'Update profile bio', icon: '\u{270F}\u{FE0F}' }
      ],
      bridge: 'cortex_last_rate'
    },
    'fee-calculator': {
      next: [
        { slug: 'rate-calculator', label: 'Recalculate rate', icon: '\u{1F522}' },
        { slug: 'invoice',         label: 'Create invoice', icon: '\u{1F9FE}' },
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' }
      ]
    },
    'tax-estimator': {
      next: [
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' },
        { slug: 'invoice',          label: 'Create invoice', icon: '\u{1F9FE}' }
      ]
    },
    'income-dashboard': {
      next: [
        { slug: 'tax-estimator',    label: 'Estimate taxes', icon: '\u{1F4CB}' },
        { slug: 'revenue-forecast', label: 'Revenue forecast', icon: '\u{1F4C8}' },
        { slug: 'invoice',          label: 'Create invoice', icon: '\u{1F9FE}' }
      ]
    },
    'revenue-forecast': {
      next: [
        { slug: 'rate-calculator', label: 'Adjust rates', icon: '\u{1F522}' },
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' }
      ]
    },

    // Time tracking flow
    'time-tracker': {
      next: [
        { slug: 'invoice',         label: 'Create invoice for these hours', icon: '\u{1F9FE}' },
        { slug: 'time-reports',    label: 'View time reports', icon: '\u{1F4CA}' },
        { slug: 'project-tracker', label: 'Update project status', icon: '\u{1F4CB}' }
      ],
      bridge: 'cortex_last_time_entry'
    },
    'time-reports': {
      next: [
        { slug: 'invoice',         label: 'Invoice tracked hours', icon: '\u{1F9FE}' },
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' }
      ]
    },

    // Proposal & job flow
    'proposal': {
      next: [
        { slug: 'project-tracker', label: 'Setup project', icon: '\u{1F4C1}' },
        { slug: 'time-tracker',    label: 'Start timer', icon: '\u{23F1}\u{FE0F}' },
        { slug: 'client-crm',      label: 'Add to client CRM', icon: '\u{1F465}' }
      ],
      bridge: 'cortex_last_proposal'
    },
    'smart-proposal': {
      next: [
        { slug: 'project-tracker', label: 'Setup project', icon: '\u{1F4C1}' },
        { slug: 'time-tracker',    label: 'Start timer', icon: '\u{23F1}\u{FE0F}' },
        { slug: 'client-crm',      label: 'Add to client CRM', icon: '\u{1F465}' }
      ],
      bridge: 'cortex_last_proposal'
    },
    'job-scanner': {
      next: [
        { slug: 'proposal',        label: 'Write proposal', icon: '\u{1F4DD}' },
        { slug: 'client-red-flags', label: 'Check client red flags', icon: '\u{1F6A9}' },
        { slug: 'rate-calculator',  label: 'Calculate your rate', icon: '\u{1F522}' }
      ],
      bridge: 'cortex_last_job'
    },
    'job-digest': {
      next: [
        { slug: 'job-scanner',     label: 'Deep-scan a job', icon: '\u{1F50D}' },
        { slug: 'proposal',        label: 'Write proposal', icon: '\u{1F4DD}' }
      ]
    },
    'job-matcher': {
      next: [
        { slug: 'proposal',        label: 'Write proposal', icon: '\u{1F4DD}' },
        { slug: 'job-scanner',     label: 'Scan job details', icon: '\u{1F50D}' }
      ]
    },
    'proposal-analytics': {
      next: [
        { slug: 'proposal',        label: 'Write new proposal', icon: '\u{1F4DD}' },
        { slug: 'rate-calculator',  label: 'Adjust rates', icon: '\u{1F522}' }
      ]
    },

    // Client flow
    'client-crm': {
      next: [
        { slug: 'client-onboarding', label: 'Client onboarding checklist', icon: '\u{2705}' },
        { slug: 'project-brief',     label: 'Create project brief', icon: '\u{1F4C4}' },
        { slug: 'contract-review',   label: 'Review contract', icon: '\u{1F4DC}' }
      ],
      bridge: 'cortex_last_client'
    },
    'client-onboarding': {
      next: [
        { slug: 'project-brief',    label: 'Create project brief', icon: '\u{1F4C4}' },
        { slug: 'sow-generator',     label: 'Generate SOW', icon: '\u{1F4DC}' },
        { slug: 'time-tracker',      label: 'Start tracking time', icon: '\u{23F1}\u{FE0F}' }
      ]
    },
    'client-red-flags': {
      next: [
        { slug: 'contract-review',  label: 'Review contract terms', icon: '\u{1F4DC}' },
        { slug: 'proposal',         label: 'Write proposal', icon: '\u{1F4DD}' }
      ]
    },
    'testimonial-request': {
      next: [
        { slug: 'case-study-gen',   label: 'Create case study', icon: '\u{1F4D6}' },
        { slug: 'portfolio-review', label: 'Update portfolio', icon: '\u{1F5BC}\u{FE0F}' }
      ]
    },

    // Project flow
    'project-brief': {
      next: [
        { slug: 'sow-generator',    label: 'Generate SOW', icon: '\u{1F4DC}' },
        { slug: 'project-tracker',   label: 'Setup project tracker', icon: '\u{1F4CB}' },
        { slug: 'time-tracker',      label: 'Start timer', icon: '\u{23F1}\u{FE0F}' }
      ],
      bridge: 'cortex_last_brief'
    },
    'project-tracker': {
      next: [
        { slug: 'time-tracker',     label: 'Track time', icon: '\u{23F1}\u{FE0F}' },
        { slug: 'invoice',          label: 'Create milestone invoice', icon: '\u{1F9FE}' },
        { slug: 'meeting-notes',    label: 'Meeting notes', icon: '\u{1F4DD}' }
      ]
    },
    'project-timeline': {
      next: [
        { slug: 'project-tracker',  label: 'Track progress', icon: '\u{1F4CB}' },
        { slug: 'time-tracker',     label: 'Start timer', icon: '\u{23F1}\u{FE0F}' }
      ]
    },
    'sow-generator': {
      next: [
        { slug: 'project-tracker',  label: 'Setup project tracker', icon: '\u{1F4CB}' },
        { slug: 'contract-review',  label: 'Review contract', icon: '\u{1F4DC}' },
        { slug: 'invoice',          label: 'Create invoice', icon: '\u{1F9FE}' }
      ]
    },

    // Contract & scope
    'contract-review': {
      next: [
        { slug: 'scope-analyzer',   label: 'Analyze scope', icon: '\u{1F50D}' },
        { slug: 'client-crm',       label: 'Update client CRM', icon: '\u{1F465}' },
        { slug: 'project-tracker',  label: 'Setup project', icon: '\u{1F4CB}' }
      ]
    },
    'scope-analyzer': {
      next: [
        { slug: 'sow-generator',    label: 'Generate SOW', icon: '\u{1F4DC}' },
        { slug: 'rate-calculator',   label: 'Calculate rate for scope', icon: '\u{1F522}' }
      ]
    },

    // Communication
    'email-writer': {
      next: [
        { slug: 'client-crm',       label: 'Log in CRM', icon: '\u{1F465}' },
        { slug: 'templates',        label: 'Save as template', icon: '\u{1F4E6}' }
      ]
    },
    'meeting-notes': {
      next: [
        { slug: 'project-tracker',  label: 'Update project tracker', icon: '\u{1F4CB}' },
        { slug: 'email-writer',     label: 'Send follow-up email', icon: '\u{2709}\u{FE0F}' },
        { slug: 'time-tracker',     label: 'Log meeting time', icon: '\u{23F1}\u{FE0F}' }
      ]
    },

    // Profile & portfolio
    'bio-generator': {
      next: [
        { slug: 'profile-seo',     label: 'Optimize profile SEO', icon: '\u{1F50D}' },
        { slug: 'portfolio-review', label: 'Review portfolio', icon: '\u{1F5BC}\u{FE0F}' }
      ]
    },
    'portfolio-review': {
      next: [
        { slug: 'case-study-gen',   label: 'Generate case study', icon: '\u{1F4D6}' },
        { slug: 'bio-generator',    label: 'Rewrite bio', icon: '\u{270F}\u{FE0F}' },
        { slug: 'profile-seo',     label: 'Profile SEO check', icon: '\u{1F50D}' }
      ]
    },
    'case-study-gen': {
      next: [
        { slug: 'portfolio-review', label: 'Review portfolio', icon: '\u{1F5BC}\u{FE0F}' },
        { slug: 'proposal',         label: 'Use in proposal', icon: '\u{1F4DD}' }
      ]
    },
    'profile-seo': {
      next: [
        { slug: 'bio-generator',    label: 'Rewrite bio', icon: '\u{270F}\u{FE0F}' },
        { slug: 'job-scanner',      label: 'Find matching jobs', icon: '\u{1F50D}' }
      ]
    },

    // Scheduling & productivity
    'availability': {
      next: [
        { slug: 'meeting-scheduler', label: 'Schedule meeting', icon: '\u{1F4C5}' },
        { slug: 'project-timeline',  label: 'Plan timeline', icon: '\u{1F4C6}' }
      ]
    },
    'weekly-summary': {
      next: [
        { slug: 'invoice',          label: 'Invoice this week', icon: '\u{1F9FE}' },
        { slug: 'time-reports',     label: 'Detailed time report', icon: '\u{1F4CA}' },
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' }
      ]
    },
    'payment-checker': {
      next: [
        { slug: 'email-writer',     label: 'Send payment reminder', icon: '\u{2709}\u{FE0F}' },
        { slug: 'invoice',          label: 'Create new invoice', icon: '\u{1F9FE}' },
        { slug: 'client-crm',       label: 'Update client record', icon: '\u{1F465}' }
      ]
    },

    // Expenses & analytics
    'expenses': {
      next: [
        { slug: 'tax-estimator',    label: 'Estimate taxes', icon: '\u{1F4CB}' },
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' },
        { slug: 'invoice',          label: 'Create invoice', icon: '\u{1F9FE}' }
      ]
    },
    'analytics': {
      next: [
        { slug: 'revenue-forecast', label: 'Revenue forecast', icon: '\u{1F4C8}' },
        { slug: 'income-dashboard', label: 'Income dashboard', icon: '\u{1F4CA}' },
        { slug: 'rate-calculator',  label: 'Adjust rates', icon: '\u{1F522}' }
      ]
    },
    'ai-analytics': {
      next: [
        { slug: 'analytics',        label: 'View analytics', icon: '\u{1F4CA}' },
        { slug: 'revenue-forecast', label: 'Revenue forecast', icon: '\u{1F4C8}' }
      ]
    },
    'status-update': {
      next: [
        { slug: 'email-writer',    label: 'Email status to client', icon: '\u{2709}\u{FE0F}' },
        { slug: 'project-tracker', label: 'Update project tracker', icon: '\u{1F4CB}' },
        { slug: 'meeting-notes',   label: 'Add meeting notes', icon: '\u{1F4DD}' }
      ]
    },

    // Templates & communication
    'templates': {
      next: [
        { slug: 'email-writer',    label: 'Write email', icon: '\u{2709}\u{FE0F}' },
        { slug: 'proposal',        label: 'Write proposal', icon: '\u{1F4DD}' },
        { slug: 'sow-generator',   label: 'Generate SOW', icon: '\u{1F4DC}' }
      ]
    },
    'communication-hub': {
      next: [
        { slug: 'email-writer',     label: 'Write follow-up email', icon: '\u{2709}\u{FE0F}' },
        { slug: 'client-crm',       label: 'Update client CRM', icon: '\u{1F465}' },
        { slug: 'meeting-scheduler', label: 'Schedule meeting', icon: '\u{1F4C5}' }
      ]
    },

    // Client tools
    'repeat-client': {
      next: [
        { slug: 'email-writer',     label: 'Send follow-up email', icon: '\u{2709}\u{FE0F}' },
        { slug: 'proposal',         label: 'Write new proposal', icon: '\u{1F4DD}' },
        { slug: 'client-crm',       label: 'Update CRM record', icon: '\u{1F465}' }
      ]
    },
    'client-comm-analyzer': {
      next: [
        { slug: 'email-writer',     label: 'Craft response', icon: '\u{2709}\u{FE0F}' },
        { slug: 'client-red-flags', label: 'Check red flags', icon: '\u{1F6A9}' },
        { slug: 'client-crm',       label: 'Update CRM', icon: '\u{1F465}' }
      ]
    },
    'timezone-overlap': {
      next: [
        { slug: 'meeting-scheduler', label: 'Schedule meeting', icon: '\u{1F4C5}' },
        { slug: 'availability',      label: 'Set availability', icon: '\u{23F0}' },
        { slug: 'client-crm',        label: 'Save timezone note', icon: '\u{1F465}' }
      ]
    },

    // Job hunting
    'ranking-simulator': {
      next: [
        { slug: 'profile-seo',     label: 'Optimize profile', icon: '\u{1F50D}' },
        { slug: 'bio-generator',    label: 'Rewrite bio', icon: '\u{270F}\u{FE0F}' },
        { slug: 'job-scanner',      label: 'Find matching jobs', icon: '\u{1F50D}' }
      ]
    },
    'negotiation-coach': {
      next: [
        { slug: 'rate-calculator',  label: 'Calculate your rate', icon: '\u{1F522}' },
        { slug: 'contract-review',  label: 'Review contract', icon: '\u{1F4DC}' },
        { slug: 'proposal',         label: 'Write proposal', icon: '\u{1F4DD}' }
      ]
    },
    'upwork-feed': {
      next: [
        { slug: 'job-scanner',     label: 'Deep-scan a job', icon: '\u{1F50D}' },
        { slug: 'proposal',        label: 'Write proposal', icon: '\u{1F4DD}' },
        { slug: 'client-red-flags', label: 'Check client red flags', icon: '\u{1F6A9}' }
      ]
    },

    // Scheduling
    'meeting-scheduler': {
      next: [
        { slug: 'meeting-notes',   label: 'Prepare meeting notes', icon: '\u{1F4DD}' },
        { slug: 'time-tracker',    label: 'Track meeting time', icon: '\u{23F1}\u{FE0F}' },
        { slug: 'availability',    label: 'Update availability', icon: '\u{23F0}' }
      ]
    },

    // Activity
    'activity-feed': {
      next: [
        { slug: 'weekly-summary',   label: 'Weekly summary', icon: '\u{1F4CA}' },
        { slug: 'project-tracker',  label: 'Track projects', icon: '\u{1F4CB}' },
        { slug: 'time-tracker',     label: 'Start timer', icon: '\u{23F1}\u{FE0F}' }
      ]
    }
  };

  /* ── data bridge ───────────────────────────
     Captures tool output into a standardized
     localStorage key so the next tool can read it.
  ──────────────────────────────────────────── */
  var BRIDGE_KEY = 'cortex_cross_link_bridge';

  function writeBridge(toolSlug, data) {
    try {
      var bridge = {
        from: toolSlug,
        data: data,
        ts: Date.now()
      };
      localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridge));
    } catch (e) { /* quota */ }
  }

  function readBridge() {
    try {
      var raw = localStorage.getItem(BRIDGE_KEY);
      if (!raw) return null;
      var bridge = JSON.parse(raw);
      // expire after 30 minutes
      if (Date.now() - bridge.ts > 30 * 60 * 1000) {
        localStorage.removeItem(BRIDGE_KEY);
        return null;
      }
      return bridge;
    } catch (e) { return null; }
  }

  /* ── helpers ───────────────────────────── */
  function getToolSlug() {
    var path = window.location.pathname;
    var match = path.match(/\/tools\/([^/.]+)/);
    return match ? match[1] : '';
  }

  function buildToolUrl(slug) {
    return '/app/tools/' + slug + '.html';
  }

  function captureResultSnapshot() {
    var sec = document.querySelector(
      '.results-section, .results, #results, #resultContent, ' +
      '#resultSection, #outputSection, .output-section, ' +
      '#invoice-preview, #brief-preview, #sow-preview, ' +
      '.inv-preview, .prop-preview'
    );
    if (!sec) return null;
    return sec.innerText.substring(0, 1000);
  }

  /* ── CSS ───────────────────────────────── */
  var css = document.createElement('style');
  css.textContent = [
    '.cx-link-bar{margin:28px 0 12px;padding:0}',
    '.cx-link-header{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px}',
    '.cx-link-list{display:flex;gap:10px;flex-wrap:wrap;list-style:none;padding:0;margin:0}',
    '.cx-link-item{flex:1;min-width:180px;max-width:320px}',
    '.cx-link-btn{display:flex;align-items:center;gap:10px;width:100%;padding:14px 18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;color:#f0f0f0;font-size:14px;font-weight:500;cursor:pointer;transition:all .2s;text-decoration:none;font-family:inherit}',
    '.cx-link-btn:hover{background:rgba(255,136,68,.1);border-color:rgba(255,136,68,.3);transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,.3)}',
    '.cx-link-btn:active{transform:translateY(0)}',
    '.cx-link-icon{font-size:20px;flex-shrink:0}',
    '.cx-link-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cx-link-arrow{margin-left:auto;opacity:.3;font-size:16px;flex-shrink:0}',
    '.cx-link-from{font-size:12px;color:rgba(255,255,255,.35);margin-top:4px;padding:8px 0 0;border-top:1px solid rgba(255,255,255,.06)}',
    '@media(max-width:640px){.cx-link-list{flex-direction:column}.cx-link-item{max-width:none}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ── build UI ──────────────────────────── */
  function createLinkBar(workflow, fromBridge) {
    var wrap = document.createElement('div');
    wrap.className = 'cx-link-bar';
    wrap.id = 'cxLinkBar';
    wrap.style.display = 'none';

    var header = document.createElement('div');
    header.className = 'cx-link-header';
    header.textContent = 'Next Steps';
    wrap.appendChild(header);

    var list = document.createElement('ul');
    list.className = 'cx-link-list';

    var items = workflow.next;
    for (var i = 0; i < items.length; i++) {
      var li = document.createElement('li');
      li.className = 'cx-link-item';

      var a = document.createElement('a');
      a.className = 'cx-link-btn';
      a.href = buildToolUrl(items[i].slug);
      a.setAttribute('data-cx-target', items[i].slug);

      var icon = document.createElement('span');
      icon.className = 'cx-link-icon';
      icon.textContent = items[i].icon;

      var label = document.createElement('span');
      label.className = 'cx-link-label';
      label.textContent = items[i].label;

      var arrow = document.createElement('span');
      arrow.className = 'cx-link-arrow';
      arrow.innerHTML = '&rarr;';

      a.appendChild(icon);
      a.appendChild(label);
      a.appendChild(arrow);

      // On click, write bridge data for the target tool
      (function (targetSlug) {
        a.addEventListener('click', function () {
          var slug = getToolSlug();
          var snapshot = captureResultSnapshot();
          if (snapshot) {
            writeBridge(slug, { text: snapshot });
          }
        });
      })(items[i].slug);

      li.appendChild(a);
      list.appendChild(li);
    }

    wrap.appendChild(list);

    // If we arrived from another tool, show breadcrumb
    if (fromBridge) {
      var crumb = document.createElement('div');
      crumb.className = 'cx-link-from';
      crumb.textContent = 'Continuing from: ' + fromBridge.from.replace(/-/g, ' ');
      wrap.appendChild(crumb);
    }

    return wrap;
  }

  /* ── mount ─────────────────────────────── */
  function mount() {
    var slug = getToolSlug();
    if (!slug) return;

    var workflow = WORKFLOWS[slug];
    if (!workflow) return;

    var bridge = readBridge();
    var bar = createLinkBar(workflow, bridge);

    // Find the best insertion point
    var resultSec = document.querySelector(
      '.results-section, .results, #results, #resultContent, ' +
      '#resultSection, #outputSection, .output-section, ' +
      '#invoice-preview, #brief-preview, #sow-preview, ' +
      '.inv-preview, .prop-preview'
    );

    var target = resultSec || document.querySelector('.tool-content, .container, main, .card');
    if (!target) return;

    if (resultSec) {
      // Insert after the result section
      resultSec.parentNode.insertBefore(bar, resultSec.nextSibling);
    } else {
      target.appendChild(bar);
    }

    // Show bar when results appear (via MutationObserver)
    if (resultSec) {
      var show = function () {
        var visible = resultSec.classList.contains('visible') ||
                      resultSec.classList.contains('has-results') ||
                      (getComputedStyle(resultSec).display !== 'none' &&
                       resultSec.children.length > 1 &&
                       resultSec.offsetHeight > 50);
        bar.style.display = visible ? '' : 'none';
      };

      var observer = new MutationObserver(show);
      observer.observe(resultSec, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true
      });
      show();
    } else {
      // No result section — show immediately (static tools)
      bar.style.display = '';
    }

    // Also listen for custom tool:completed event
    window.addEventListener('tool:completed', function (e) {
      bar.style.display = '';
      if (workflow.bridge && e.detail) {
        writeBridge(slug, e.detail);
      }
    });

    // Write bridge data if the workflow defines one and a
    // result section is already visible on page load
    if (workflow.bridge && resultSec) {
      var checkAndBridge = function () {
        var snapshot = captureResultSnapshot();
        if (snapshot && snapshot.length > 20) {
          writeBridge(slug, { text: snapshot });
        }
      };
      // Debounced bridge write on result changes
      var bridgeTimer;
      var bridgeObserver = new MutationObserver(function () {
        clearTimeout(bridgeTimer);
        bridgeTimer = setTimeout(checkAndBridge, 500);
      });
      bridgeObserver.observe(resultSec, { childList: true, subtree: true });
    }
  }

  /* ── init ──────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  /* ── public API ────────────────────────── */
  window.CortexCrossLinker = {
    getWorkflows: function () { return WORKFLOWS; },
    getNextSteps: function (slug) {
      var w = WORKFLOWS[slug];
      return w ? w.next : [];
    },
    readBridge: readBridge,
    writeBridge: writeBridge,
    /** Manually trigger the "Next Steps" bar for the current tool */
    show: function () {
      var bar = document.getElementById('cxLinkBar');
      if (bar) bar.style.display = '';
    }
  };
})();
