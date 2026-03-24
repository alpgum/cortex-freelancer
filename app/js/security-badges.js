/**
 * [CF-200] PCI Compliance Badge and Security Assurance
 * Displays "Payments secured by Stripe" badge, security indicators,
 * and links to security info page.
 * Exposed on window.CortexFreelancer.SecurityBadges
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ── Badge Configurations ──────────────────────────────────────────────

  var BADGES = {
    stripe: {
      id: 'cf-badge-stripe',
      icon: '🔒',
      title: 'Payments secured by Stripe',
      subtitle: 'PCI DSS Level 1 compliant',
      color: '#635bff',
      bg: '#f6f5ff'
    },
    encryption: {
      id: 'cf-badge-encryption',
      icon: '🛡️',
      title: '256-bit SSL Encryption',
      subtitle: 'Your data is always encrypted',
      color: '#059669',
      bg: '#ecfdf5'
    },
    noCard: {
      id: 'cf-badge-nocard',
      icon: '💳',
      title: 'We never store card details',
      subtitle: 'Handled entirely by Stripe',
      color: '#0284c7',
      bg: '#f0f9ff'
    }
  };

  var SECURITY_PAGE_CONTENT = {
    title: 'Security & Data Handling',
    sections: [
      {
        heading: 'Payment Security',
        body: 'All payments are processed by Stripe, a PCI DSS Level 1 certified payment processor — the highest level of certification in the payments industry. Your credit card information never touches our servers.'
      },
      {
        heading: 'Data Encryption',
        body: 'All data transmitted between your browser and our servers is encrypted using 256-bit TLS/SSL encryption. Data at rest is encrypted using AES-256.'
      },
      {
        heading: 'What We Store',
        body: 'We store your email, display name, and subscription status. We do NOT store credit card numbers, CVVs, or full card details. Stripe securely manages all payment information.'
      },
      {
        heading: 'Your Rights',
        body: 'You can request data export or deletion at any time. Contact support@cortexfreelancer.com for data requests.'
      },
      {
        heading: 'PCI Compliance',
        body: 'By using Stripe as our payment processor, we maintain PCI compliance without handling sensitive card data. Stripe handles all card processing in their PCI DSS Level 1 certified environment.'
      }
    ]
  };

  // ── Badge Renderer ────────────────────────────────────────────────────

  function createBadgeElement(config) {
    var badge = document.createElement('div');
    badge.id = config.id;
    badge.style.cssText = [
      'display:flex', 'align-items:center', 'gap:10px',
      'padding:12px 16px', 'border-radius:10px',
      'background:' + config.bg,
      'border:1px solid ' + config.color + '20',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'cursor:default', 'transition:box-shadow 0.2s'
    ].join(';');

    badge.addEventListener('mouseenter', function () {
      badge.style.boxShadow = '0 2px 8px ' + config.color + '15';
    });
    badge.addEventListener('mouseleave', function () {
      badge.style.boxShadow = 'none';
    });

    var icon = document.createElement('span');
    icon.textContent = config.icon;
    icon.style.fontSize = '22px';

    var text = document.createElement('div');
    var titleEl = document.createElement('div');
    titleEl.textContent = config.title;
    titleEl.style.cssText = 'font-size:13px;font-weight:600;color:' + config.color + ';';

    var subtitleEl = document.createElement('div');
    subtitleEl.textContent = config.subtitle;
    subtitleEl.style.cssText = 'font-size:11px;color:#6b7280;margin-top:1px;';

    text.appendChild(titleEl);
    text.appendChild(subtitleEl);
    badge.appendChild(icon);
    badge.appendChild(text);

    return badge;
  }

  function renderBadges(containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[SecurityBadges] Container not found:', containerId);
      return;
    }

    options = options || {};
    var badgeKeys = options.badges || ['stripe', 'encryption', 'noCard'];
    var layout = options.layout || 'horizontal'; // 'horizontal' | 'vertical' | 'inline'

    var wrapper = document.createElement('div');
    var direction = layout === 'vertical' ? 'column' : 'row';
    var wrap = layout === 'inline' ? 'wrap' : 'nowrap';
    wrapper.style.cssText = 'display:flex;flex-direction:' + direction + ';gap:10px;flex-wrap:' + wrap + ';';

    badgeKeys.forEach(function (key) {
      if (BADGES[key]) wrapper.appendChild(createBadgeElement(BADGES[key]));
    });

    container.innerHTML = '';
    container.appendChild(wrapper);
  }

  // ── Inline Stripe Badge (compact) ─────────────────────────────────────

  function renderInlineBadge(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var badge = document.createElement('div');
    badge.style.cssText = [
      'display:inline-flex', 'align-items:center', 'gap:6px',
      'padding:6px 12px', 'border-radius:6px',
      'background:#f6f5ff', 'border:1px solid #e0deff',
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif',
      'font-size:12px', 'color:#635bff', 'font-weight:500'
    ].join(';');
    badge.innerHTML = '🔒 Secured by <strong>Stripe</strong>';

    container.innerHTML = '';
    container.appendChild(badge);
  }

  // ── Security Info Page ────────────────────────────────────────────────

  function renderSecurityPage(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[SecurityBadges] Container not found:', containerId);
      return;
    }

    var html = '<div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';
    html += '<h2 style="font-size:24px;font-weight:700;color:#111;margin-bottom:8px;">' + SECURITY_PAGE_CONTENT.title + '</h2>';
    html += '<p style="color:#6b7280;font-size:14px;margin-bottom:32px;">How we protect your data and payments.</p>';

    SECURITY_PAGE_CONTENT.sections.forEach(function (section) {
      html += '<div style="margin-bottom:24px;">';
      html += '<h3 style="font-size:16px;font-weight:600;color:#111;margin-bottom:6px;">' + section.heading + '</h3>';
      html += '<p style="font-size:14px;color:#374151;line-height:1.6;margin:0;">' + section.body + '</p>';
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // ── Security Link Helper ──────────────────────────────────────────────

  function createSecurityLink(text) {
    var link = document.createElement('a');
    link.href = '/security';
    link.textContent = text || 'Learn about our security';
    link.style.cssText = 'color:#635bff;font-size:12px;text-decoration:none;';
    link.addEventListener('mouseenter', function () { link.style.textDecoration = 'underline'; });
    link.addEventListener('mouseleave', function () { link.style.textDecoration = 'none'; });
    return link;
  }

  // ── Public API ────────────────────────────────────────────────────────

  window.CortexFreelancer.SecurityBadges = {
    BADGES: BADGES,
    renderBadges: renderBadges,
    renderInlineBadge: renderInlineBadge,
    renderSecurityPage: renderSecurityPage,
    createSecurityLink: createSecurityLink
  };
})();
