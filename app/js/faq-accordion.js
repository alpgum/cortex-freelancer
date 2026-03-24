/**
 * CF-235: FAQ Section with Accordion UI
 *
 * 10 FAQs about pricing, security, Upwork TOS, cancellation.
 * Smooth accordion expand/collapse, keyboard accessible.
 *
 * @namespace window.CortexFreelancer.FAQAccordion
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STYLE_ID = 'cortex-faq-accordion-styles';

  var FAQS = [
    {
      q: 'What is Cortex Freelancer?',
      a: 'Cortex Freelancer is an AI-powered toolkit built specifically for Upwork freelancers. It includes profile analytics, proposal optimization, rate benchmarking, earnings tracking, and 50+ productivity tools — all in one place.'
    },
    {
      q: 'How much does it cost?',
      a: 'We offer a generous free tier with essential tools. Our Pro plan unlocks all features for a flat monthly fee with no per-use charges. We also offer a lifetime deal during launch. All paid plans include a 14-day free trial — no credit card required.'
    },
    {
      q: 'Is there a money-back guarantee?',
      a: 'Yes! We offer a 30-day money-back guarantee on all paid plans. If you\'re not satisfied for any reason, contact us within 30 days for a full refund — no questions asked.'
    },
    {
      q: 'Does using Cortex Freelancer violate Upwork\'s Terms of Service?',
      a: 'No. Cortex Freelancer does not automate bidding, scrape private data, or interact with Upwork\'s platform in any unauthorized way. It\'s a standalone productivity tool that helps you write better proposals, track earnings, and optimize your profile — all within Upwork\'s guidelines.'
    },
    {
      q: 'Is my data secure?',
      a: 'Absolutely. All data is encrypted with 256-bit SSL/TLS in transit and AES-256 at rest. Payments are processed by Stripe (PCI DSS Level 1). We never sell or share your data with third parties. You can export or delete your data at any time.'
    },
    {
      q: 'Can I cancel my subscription at any time?',
      a: 'Yes, you can cancel your subscription at any time from your account settings. There are no long-term contracts or cancellation fees. Your access continues until the end of your current billing period.'
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express) through Stripe. We also support payments via Google Pay and Apple Pay where available.'
    },
    {
      q: 'Do I need to install anything?',
      a: 'No installation required. Cortex Freelancer is a web-based application that works in any modern browser. There\'s also an optional browser extension for enhanced Upwork integration, but it\'s completely optional.'
    },
    {
      q: 'Can I use Cortex Freelancer on other freelance platforms?',
      a: 'While our tools are optimized for Upwork, many features like the invoice generator, rate calculator, contract reviewer, and proposal writer work great for freelancers on any platform — Fiverr, Toptal, Freelancer.com, or direct clients.'
    },
    {
      q: 'How do I get support?',
      a: 'We offer email support for all users and priority live chat for Pro subscribers. You can also browse our help center, join our community forum, or reach us at support@cortexfreelancer.com. Average response time is under 4 hours.'
    }
  ];

  // ─── Styles ────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.cf-faq { max-width: 720px; margin: 0 auto; }',
      '.cf-faq-item { border-bottom: 1px solid #e9ecef; }',
      '.cf-faq-item:first-child { border-top: 1px solid #e9ecef; }',
      '.cf-faq-btn {',
      '  width: 100%; padding: 18px 40px 18px 0; border: none; background: none;',
      '  font-size: 16px; font-weight: 600; color: #1e1e2e; text-align: left;',
      '  cursor: pointer; position: relative; line-height: 1.5; font-family: inherit;',
      '}',
      '.cf-faq-btn:hover { color: #4f46e5; }',
      '.cf-faq-btn:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; border-radius: 4px; }',
      '.cf-faq-btn::after {',
      '  content: "+"; position: absolute; right: 0; top: 50%; transform: translateY(-50%);',
      '  font-size: 22px; font-weight: 300; color: #6c757d; transition: transform 0.3s ease;',
      '}',
      '.cf-faq-btn[aria-expanded="true"]::after { content: "\\2212"; transform: translateY(-50%) rotate(180deg); }',
      '.cf-faq-btn[aria-expanded="true"] { color: #4f46e5; }',
      '.cf-faq-panel {',
      '  max-height: 0; overflow: hidden; transition: max-height 0.35s ease;',
      '}',
      '.cf-faq-panel-inner {',
      '  padding: 0 0 18px 0; font-size: 15px; line-height: 1.7; color: #495057;',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .cf-faq-panel { transition: none; }',
      '  .cf-faq-btn::after { transition: none; }',
      '}'
    ].join('\n');
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Helpers ─────────────────────────────────────────

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function toggleItem(btn, panel) {
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));

    if (expanded) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
      // Force reflow then collapse
      panel.offsetHeight; // eslint-disable-line no-unused-expressions
      panel.style.maxHeight = '0';
    } else {
      panel.style.maxHeight = panel.scrollHeight + 'px';
      var onEnd = function () {
        panel.removeEventListener('transitionend', onEnd);
        if (btn.getAttribute('aria-expanded') === 'true') {
          panel.style.maxHeight = 'none';
        }
      };
      panel.addEventListener('transitionend', onEnd);
    }
  }

  // ─── Render ──────────────────────────────────────────

  function render(target, options) {
    injectStyles();
    options = options || {};

    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) {
      console.warn('[FAQAccordion] Target container not found:', target);
      return null;
    }

    var faqs = options.faqs || FAQS;
    var allowMultiple = options.allowMultiple !== false;

    var wrapper = document.createElement('div');
    wrapper.className = 'cf-faq';
    wrapper.setAttribute('role', 'list');

    var buttons = [];
    var panels = [];

    faqs.forEach(function (faq, i) {
      var item = document.createElement('div');
      item.className = 'cf-faq-item';
      item.setAttribute('role', 'listitem');

      var btnId = 'cf-faq-btn-' + i;
      var panelId = 'cf-faq-panel-' + i;

      var btn = document.createElement('button');
      btn.className = 'cf-faq-btn';
      btn.id = btnId;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', panelId);
      btn.textContent = faq.q;

      var panel = document.createElement('div');
      panel.className = 'cf-faq-panel';
      panel.id = panelId;
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', btnId);

      var inner = document.createElement('div');
      inner.className = 'cf-faq-panel-inner';
      inner.innerHTML = esc(faq.a);
      panel.appendChild(inner);

      btn.addEventListener('click', function () {
        if (!allowMultiple) {
          // Close others
          buttons.forEach(function (b, j) {
            if (j !== i && b.getAttribute('aria-expanded') === 'true') {
              toggleItem(b, panels[j]);
            }
          });
        }
        toggleItem(btn, panel);
      });

      // Keyboard: arrow nav between FAQ buttons
      btn.addEventListener('keydown', function (e) {
        var idx = -1;
        if (e.key === 'ArrowDown') {
          idx = (i + 1) % buttons.length;
        } else if (e.key === 'ArrowUp') {
          idx = (i - 1 + buttons.length) % buttons.length;
        } else if (e.key === 'Home') {
          idx = 0;
        } else if (e.key === 'End') {
          idx = buttons.length - 1;
        }
        if (idx >= 0) {
          e.preventDefault();
          buttons[idx].focus();
        }
      });

      buttons.push(btn);
      panels.push(panel);

      item.appendChild(btn);
      item.appendChild(panel);
      wrapper.appendChild(item);
    });

    container.appendChild(wrapper);
    return wrapper;
  }

  /** Get default FAQ data */
  function getFAQs() {
    return FAQS.map(function (f) { return { q: f.q, a: f.a }; });
  }

  // ─── Public API ────────────────────────────────────────

  window.CortexFreelancer.FAQAccordion = {
    render: render,
    getFAQs: getFAQs
  };
})();
