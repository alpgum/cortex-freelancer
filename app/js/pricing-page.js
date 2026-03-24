/**
 * Cortex Freelancer — Pricing Page with Toggle
 * [CF-190] Standalone pricing page logic with plan comparison,
 * monthly/yearly toggle, FAQ, testimonials, and CTA buttons.
 *
 * Features:
 *   - Plan comparison grid (Free, Pro, Team)
 *   - Animated monthly/yearly price toggle
 *   - Feature comparison table
 *   - FAQ accordion
 *   - Testimonials carousel
 *   - CTA buttons wired to checkout
 *   - init() / render(containerId) interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_pricing_interval';

  var INTERVALS = { MONTHLY: 'monthly', YEARLY: 'yearly' };

  var PLANS = [
    {
      id: 'free',
      name: 'Free',
      description: 'Get started with essential tools',
      monthly: 0,
      yearly: 0,
      monthlyDisplay: '$0',
      yearlyDisplay: '$0',
      popular: false,
      cta: 'Get Started',
      ctaStyle: 'outline',
      features: [
        { name: '5 tools access', included: true },
        { name: '3 proposals/day', included: true },
        { name: 'Basic profile score', included: true },
        { name: 'Job search & alerts', included: true },
        { name: 'AI proposal writer', included: false },
        { name: 'Advanced analytics', included: false },
        { name: 'Export & sharing', included: false },
        { name: 'Priority support', included: false },
        { name: 'Team workspace', included: false }
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Unlock your full earning potential',
      monthly: 1900,
      yearly: 14900,
      monthlyDisplay: '$19',
      yearlyDisplay: '$149',
      yearlyMonthly: '$12.42',
      savings: 'Save $79/yr',
      popular: true,
      cta: 'Start Free Trial',
      ctaStyle: 'solid',
      features: [
        { name: 'All 25+ tools', included: true },
        { name: 'Unlimited proposals', included: true },
        { name: 'Advanced AI profile score', included: true },
        { name: 'Job search & alerts', included: true },
        { name: 'AI proposal writer', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Export & sharing', included: true },
        { name: 'Priority support', included: true },
        { name: 'Team workspace', included: false }
      ]
    },
    {
      id: 'team',
      name: 'Team',
      description: 'For agencies and teams of freelancers',
      monthly: 4900,
      yearly: 46800,
      monthlyDisplay: '$49',
      yearlyDisplay: '$468',
      yearlyMonthly: '$39',
      savings: 'Save $120/yr',
      popular: false,
      cta: 'Create Team',
      ctaStyle: 'solid',
      features: [
        { name: 'All 25+ tools', included: true },
        { name: 'Unlimited proposals', included: true },
        { name: 'Advanced AI profile score', included: true },
        { name: 'Job search & alerts', included: true },
        { name: 'AI proposal writer', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Export & sharing', included: true },
        { name: 'Priority team support', included: true },
        { name: '5 seats (shared workspace)', included: true }
      ]
    }
  ];

  var FAQS = [
    { q: 'Can I cancel anytime?', a: 'Yes! You can cancel your subscription at any time. You\'ll keep access until the end of your billing period.' },
    { q: 'Is there a free trial?', a: 'Yes, Pro comes with a 7-day free trial. No credit card required to start.' },
    { q: 'What happens to my data if I downgrade?', a: 'Your data is always preserved. On the Free plan, you\'ll have read-only access to Pro features like advanced analytics.' },
    { q: 'Can I switch between monthly and yearly?', a: 'Absolutely. Switch anytime from your billing settings. If upgrading to yearly, you\'ll get prorated credit.' },
    { q: 'How does the Team plan work?', a: 'The Team plan includes 5 seats with a shared workspace. Extra seats are $10/seat/month. All members get full Pro access.' },
    { q: 'Do you offer refunds?', a: 'We offer a 30-day money-back guarantee. If you\'re not satisfied, contact support for a full refund.' }
  ];

  var TESTIMONIALS = [
    { name: 'Sarah K.', role: 'UX Designer', text: 'Pro paid for itself in the first week. My proposal win rate jumped from 8% to 23%.', avatar: '👩‍🎨' },
    { name: 'Marcus T.', role: 'Full-Stack Developer', text: 'The AI proposal writer alone saves me 2 hours per day. Best investment for my freelance career.', avatar: '👨‍💻' },
    { name: 'Priya R.', role: 'Content Writer', text: 'Went from $30/hr to $65/hr in 3 months using the rate benchmarking and negotiation tools.', avatar: '✍️' },
    { name: 'James L.', role: 'Agency Owner', text: 'Team plan keeps our 8-person agency organized. Shared templates are a game changer.', avatar: '🏢' }
  ];

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    initialized: false,
    interval: INTERVALS.MONTHLY,
    expandedFaq: -1
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function getCheckout() {
    return window.CortexFreelancer.Checkout || null;
  }

  // ─── Styles ───────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cf-pricing-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-pricing-styles';
    style.textContent = [
      '@keyframes cf-price-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}',
      '.cf-price-animate{animation:cf-price-in 0.3s ease-out}',
      '.cf-pricing-toggle{position:relative;display:inline-flex;background:#F0F0F0;border-radius:24px;padding:3px}',
      '.cf-pricing-toggle button{padding:8px 20px;border:none;border-radius:22px;cursor:pointer;font-size:14px;font-weight:500;background:transparent;color:#666;transition:all 0.25s}',
      '.cf-pricing-toggle button.active{background:#fff;color:#1a1a1a;box-shadow:0 1px 4px rgba(0,0,0,0.1)}',
      '.cf-faq-answer{overflow:hidden;transition:max-height 0.3s ease,opacity 0.3s;max-height:0;opacity:0}',
      '.cf-faq-answer.open{max-height:200px;opacity:1}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Render ───────────────────────────────────────────────────────

  function render(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    injectStyles();

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:1080px;margin:0 auto;padding:40px 20px;';

    // ── Header ──
    wrapper.innerHTML += '<div style="text-align:center;margin-bottom:40px">' +
      '<h1 style="margin:0 0 8px;font-size:36px;color:#1a1a1a;font-weight:700">Simple, transparent pricing</h1>' +
      '<p style="margin:0 0 24px;color:#666;font-size:17px">Choose the plan that fits your freelance career.</p>' +
      renderToggle() +
      '</div>';

    // ── Plan Cards ──
    wrapper.innerHTML += '<div id="cf-pricing-cards" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-bottom:64px">' +
      PLANS.map(function (p) { return renderPlanCard(p); }).join('') +
      '</div>';

    // ── FAQ ──
    wrapper.innerHTML += '<div style="max-width:640px;margin:0 auto 64px">' +
      '<h2 style="text-align:center;font-size:24px;color:#1a1a1a;margin:0 0 24px">Frequently Asked Questions</h2>' +
      '<div id="cf-pricing-faqs">' + FAQS.map(function (faq, i) { return renderFaq(faq, i); }).join('') + '</div></div>';

    // ── Testimonials ──
    wrapper.innerHTML += '<div style="margin-bottom:48px">' +
      '<h2 style="text-align:center;font-size:24px;color:#1a1a1a;margin:0 0 24px">Loved by freelancers worldwide</h2>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">' +
      TESTIMONIALS.map(function (t) { return renderTestimonial(t); }).join('') +
      '</div></div>';

    container.appendChild(wrapper);
    bindEvents(container);
  }

  function renderToggle() {
    var isYearly = state.interval === INTERVALS.YEARLY;
    return '<div class="cf-pricing-toggle">' +
      '<button class="' + (!isYearly ? 'active' : '') + '" data-interval="monthly">Monthly</button>' +
      '<button class="' + (isYearly ? 'active' : '') + '" data-interval="yearly">Yearly</button>' +
      '</div>' +
      (isYearly ? '' : '<p style="margin:8px 0 0;font-size:13px;color:#888">💡 Save up to 35% with yearly billing</p>');
  }

  function renderPlanCard(plan) {
    var isYearly = state.interval === INTERVALS.YEARLY;
    var price = isYearly ? (plan.yearlyMonthly || plan.yearlyDisplay) : plan.monthlyDisplay;
    var perLabel = plan.id === 'free' ? '' : '/mo';
    var billedLabel = isYearly && plan.id !== 'free' ? '<div style="font-size:12px;color:#888;margin-top:2px">Billed ' + plan.yearlyDisplay + '/yr</div>' : '';
    var savingsBadge = isYearly && plan.savings ? '<span style="font-size:11px;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:4px;font-weight:600">' + plan.savings + '</span>' : '';

    var borderColor = plan.popular ? '#6C5CE7' : '#eee';
    var isOutline = plan.ctaStyle === 'outline';
    var btnStyle = isOutline
      ? 'background:#fff;color:#6C5CE7;border:2px solid #6C5CE7'
      : 'background:#6C5CE7;color:#fff;border:none';

    return '<div style="background:#fff;border:2px solid ' + borderColor + ';border-radius:16px;padding:28px;position:relative;' +
      (plan.popular ? 'box-shadow:0 4px 24px rgba(108,92,231,0.12)' : '') + '">' +
      (plan.popular ? '<div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#6C5CE7;color:#fff;font-size:11px;font-weight:700;padding:4px 14px;border-radius:12px;text-transform:uppercase;letter-spacing:0.5px">Most Popular</div>' : '') +
      '<h3 style="margin:0 0 4px;font-size:20px;color:#1a1a1a">' + plan.name + '</h3>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#888">' + plan.description + '</p>' +
      '<div class="cf-price-animate" style="margin-bottom:16px">' +
      '<span style="font-size:40px;font-weight:700;color:#1a1a1a">' + price + '</span>' +
      '<span style="color:#888;font-size:15px">' + perLabel + '</span>' +
      billedLabel + ' ' + savingsBadge + '</div>' +
      '<button class="cf-pricing-cta" data-plan="' + plan.id + '" style="width:100%;padding:12px;border-radius:8px;cursor:pointer;font-size:15px;font-weight:600;margin-bottom:20px;' + btnStyle + '">' + plan.cta + '</button>' +
      '<ul style="list-style:none;padding:0;margin:0">' +
      plan.features.map(function (f) {
        return '<li style="padding:6px 0;font-size:13px;color:' + (f.included ? '#333' : '#ccc') + ';display:flex;align-items:center;gap:8px">' +
          '<span style="font-size:14px">' + (f.included ? '✅' : '—') + '</span> ' + f.name + '</li>';
      }).join('') +
      '</ul></div>';
  }

  function renderFaq(faq, idx) {
    var isOpen = state.expandedFaq === idx;
    return '<div style="border-bottom:1px solid #eee">' +
      '<button class="cf-faq-toggle" data-faq="' + idx + '" style="width:100%;text-align:left;padding:16px 0;background:none;border:none;cursor:pointer;font-size:15px;color:#333;font-weight:500;display:flex;justify-content:space-between;align-items:center">' +
      faq.q + '<span style="font-size:18px;transition:transform 0.2s;transform:rotate(' + (isOpen ? '45' : '0') + 'deg)">+</span></button>' +
      '<div class="cf-faq-answer ' + (isOpen ? 'open' : '') + '">' +
      '<p style="margin:0 0 16px;font-size:14px;color:#666;line-height:1.6">' + faq.a + '</p></div></div>';
  }

  function renderTestimonial(t) {
    return '<div style="background:#FAFAFA;border-radius:12px;padding:20px">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
      '<span style="font-size:28px">' + t.avatar + '</span>' +
      '<div><div style="font-size:14px;font-weight:600;color:#333">' + t.name + '</div>' +
      '<div style="font-size:12px;color:#888">' + t.role + '</div></div></div>' +
      '<p style="margin:0;font-size:14px;color:#555;line-height:1.5;font-style:italic">"' + t.text + '"</p></div>';
  }

  // ─── Events ───────────────────────────────────────────────────────

  function bindEvents(container) {
    // Toggle
    var toggleBtns = container.querySelectorAll('.cf-pricing-toggle button');
    toggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.interval = btn.getAttribute('data-interval') === 'yearly' ? INTERVALS.YEARLY : INTERVALS.MONTHLY;
        try { localStorage.setItem(STORAGE_KEY, state.interval); } catch (e) { /* noop */ }
        render(container.id);
      });
    });

    // CTA buttons
    var ctaBtns = container.querySelectorAll('.cf-pricing-cta');
    ctaBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var planId = btn.getAttribute('data-plan');
        handleCta(planId);
      });
    });

    // FAQ toggles
    var faqBtns = container.querySelectorAll('.cf-faq-toggle');
    faqBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-faq'), 10);
        state.expandedFaq = state.expandedFaq === idx ? -1 : idx;
        render(container.id);
      });
    });
  }

  function handleCta(planId) {
    if (planId === 'free') {
      window.location.href = '/signup';
      return;
    }

    if (planId === 'team') {
      var teamPricing = window.CortexFreelancer.TeamPricing;
      if (teamPricing && typeof teamPricing.render === 'function') {
        window.location.href = '/team';
      } else {
        window.location.href = '/checkout?plan=team_monthly';
      }
      return;
    }

    // Pro plan
    var priceId = state.interval === INTERVALS.YEARLY ? 'pro_annual' : 'pro_monthly';
    var checkout = getCheckout();
    if (checkout && typeof checkout.startCheckout === 'function') {
      checkout.startCheckout(priceId);
    } else {
      window.location.href = '/checkout?plan=' + priceId;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // Restore interval preference
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === INTERVALS.YEARLY) state.interval = INTERVALS.YEARLY;
    } catch (e) { /* noop */ }

    console.log('[PricingPage] Initialized');
  }

  // ─── Export ───────────────────────────────────────────────────────

  window.CortexFreelancer.PricingPage = {
    init: init,
    render: render,
    PLANS: PLANS,
    FAQS: FAQS,
    setInterval: function (interval) {
      if (interval === INTERVALS.MONTHLY || interval === INTERVALS.YEARLY) {
        state.interval = interval;
      }
    },
    getInterval: function () { return state.interval; }
  };

})();
