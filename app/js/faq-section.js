/**
 * CF-235: FAQ Section with Accordion UI
 *
 * 10 FAQs covering pricing, data security, Upwork TOS compliance,
 * cancellation, and supported platforms. Smooth accordion expand/collapse
 * with full ARIA attributes.
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var FAQS = [
    {
      q: 'How much does Cortex Freelancer cost?',
      a: 'We offer a free tier with core tools and premium plans starting at $19/month. Annual billing saves you 20%. Check our pricing page for full details.'
    },
    {
      q: 'Is there a free trial?',
      a: 'Yes! Every new account gets a 14-day free trial of our Pro plan — no credit card required. You can downgrade to the free tier anytime.'
    },
    {
      q: 'How is my data kept secure?',
      a: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We use Stripe for payment processing (PCI DSS Level 1) and never store your credit card details on our servers.'
    },
    {
      q: 'Does using Cortex Freelancer violate Upwork\'s Terms of Service?',
      a: 'No. Cortex Freelancer is a personal analytics and productivity tool. It does not automate actions on Upwork, scrape data in bulk, or interact with Upwork\'s platform on your behalf. You remain fully in control of your account.'
    },
    {
      q: 'Can I cancel my subscription anytime?',
      a: 'Absolutely. You can cancel from your account settings at any time. Your premium features remain active until the end of your billing period, and we offer a 30-day money-back guarantee.'
    },
    {
      q: 'Which freelancing platforms are supported?',
      a: 'We currently support Upwork with deep integration. Support for Fiverr, Freelancer.com, and Toptal is on our roadmap. You can also use many of our tools (rate calculator, invoice generator, tax estimator) regardless of platform.'
    },
    {
      q: 'Can I export my data?',
      a: 'Yes. You can export all your data — including analytics, proposals, and client records — as CSV or JSON from the account settings page at any time.'
    },
    {
      q: 'Do you offer refunds?',
      a: 'We offer a 30-day money-back guarantee on all paid plans. If you\'re not satisfied, contact support within 30 days of your purchase for a full refund.'
    },
    {
      q: 'Is Cortex Freelancer available on mobile?',
      a: 'Our web app is fully responsive and works great on mobile browsers. A dedicated iOS and Android app is planned for later this year.'
    },
    {
      q: 'How do I get support?',
      a: 'You can reach us via the in-app chat widget, email at support@cortexfreelancer.com, or our community Discord. Premium users get priority support with guaranteed response times.'
    }
  ];

  var CSS = '\n\
    .cf-faq-section { max-width: 720px; margin: 0 auto; padding: 32px 16px; }\n\
    .cf-faq-section__title { font-size: 28px; font-weight: 700; text-align: center;\n\
      margin-bottom: 24px; color: #1e1e2e; }\n\
    .cf-faq-item { border-bottom: 1px solid #e9ecef; }\n\
    .cf-faq-item:first-child { border-top: 1px solid #e9ecef; }\n\
    .cf-faq-trigger { display: flex; align-items: center; justify-content: space-between;\n\
      width: 100%; padding: 16px 0; background: none; border: none; cursor: pointer;\n\
      font-size: 16px; font-weight: 600; color: #1e1e2e; text-align: left; gap: 12px; }\n\
    .cf-faq-trigger:hover { color: #4f46e5; }\n\
    .cf-faq-trigger:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px;\n\
      border-radius: 4px; }\n\
    .cf-faq-trigger__icon { flex-shrink: 0; width: 20px; height: 20px;\n\
      transition: transform 0.3s ease; }\n\
    .cf-faq-trigger[aria-expanded="true"] .cf-faq-trigger__icon { transform: rotate(180deg); }\n\
    .cf-faq-panel { overflow: hidden; max-height: 0; transition: max-height 0.35s ease;\n\
      will-change: max-height; }\n\
    .cf-faq-panel__inner { padding: 0 0 16px; font-size: 15px; line-height: 1.6;\n\
      color: #495057; }\n\
  ';

  var CHEVRON_SVG = '<svg class="cf-faq-trigger__icon" viewBox="0 0 20 20" fill="none" ' +
    'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function injectStyles() {
    if (document.getElementById('cf-faq-section-css')) return;
    var style = document.createElement('style');
    style.id = 'cf-faq-section-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function createFaqItem(faq, index) {
    var id = 'cf-faq-' + index;
    var item = document.createElement('div');
    item.className = 'cf-faq-item';

    var trigger = document.createElement('button');
    trigger.className = 'cf-faq-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id + '-panel');
    trigger.id = id + '-trigger';
    trigger.innerHTML = '<span>' + faq.q + '</span>' + CHEVRON_SVG;

    var panel = document.createElement('div');
    panel.className = 'cf-faq-panel';
    panel.id = id + '-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', id + '-trigger');
    panel.innerHTML = '<div class="cf-faq-panel__inner">' + faq.a + '</div>';

    trigger.addEventListener('click', function () {
      var expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));

      if (!expanded) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
      } else {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        // Force reflow then collapse
        panel.offsetHeight; // eslint-disable-line no-unused-expressions
        panel.style.maxHeight = '0';
      }
    });

    // After expand transition ends, remove fixed max-height so content reflow works
    panel.addEventListener('transitionend', function () {
      if (trigger.getAttribute('aria-expanded') === 'true') {
        panel.style.maxHeight = 'none';
      }
    });

    item.appendChild(trigger);
    item.appendChild(panel);
    return item;
  }

  /**
   * Render FAQ accordion into a container.
   * @param {string|HTMLElement} target - CSS selector or DOM element
   * @param {Object} [options]
   * @param {string} [options.title] - Section heading
   * @param {boolean} [options.allowMultiple] - Allow multiple panels open (default: true)
   */
  function render(target, options) {
    injectStyles();
    options = options || {};

    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) {
      console.warn('[FAQSection] Target container not found:', target);
      return null;
    }

    var section = document.createElement('section');
    section.className = 'cf-faq-section';
    section.setAttribute('aria-label', 'Frequently Asked Questions');

    var title = document.createElement('h2');
    title.className = 'cf-faq-section__title';
    title.textContent = options.title || 'Frequently Asked Questions';
    section.appendChild(title);

    var list = document.createElement('div');
    list.setAttribute('role', 'list');

    FAQS.forEach(function (faq, i) {
      var item = createFaqItem(faq, i);
      item.setAttribute('role', 'listitem');
      list.appendChild(item);
    });

    // Single-open mode: close others when one opens
    if (options.allowMultiple === false) {
      list.addEventListener('click', function (e) {
        var trigger = e.target.closest('.cf-faq-trigger');
        if (!trigger) return;
        var allTriggers = list.querySelectorAll('.cf-faq-trigger');
        allTriggers.forEach(function (t) {
          if (t !== trigger && t.getAttribute('aria-expanded') === 'true') {
            t.click();
          }
        });
      });
    }

    section.appendChild(list);
    container.appendChild(section);
    return section;
  }

  /** Programmatically expand/collapse a FAQ by index */
  function toggle(index) {
    var trigger = document.getElementById('cf-faq-' + index + '-trigger');
    if (trigger) trigger.click();
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.CortexFreelancer.FAQSection = {
    render: render,
    toggle: toggle,
    getFAQs: function () { return FAQS.slice(); }
  };
})();
