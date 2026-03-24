/**
 * [CF-200] Cortex Freelancer — PCI Compliance Badge & Security Assurance
 * Display 'Payments secured by Stripe' badge, link to security page explaining data handling.
 * Exposed on window.CortexFreelancer.PCICompliance
 */
(function () {
  'use strict';

  var SECURITY_DETAILS = [
    { title: 'PCI DSS Level 1', desc: 'All payment processing is handled by Stripe, a PCI Level 1 certified service provider — the highest level of certification in the payments industry.' },
    { title: 'No Card Storage', desc: 'We never store, process, or have access to your full credit card numbers. All sensitive payment data is handled entirely by Stripe\'s secure infrastructure.' },
    { title: 'Encryption', desc: 'All data transmitted between your browser and our servers is encrypted using TLS 1.2+ (HTTPS). Data at rest is encrypted using AES-256.' },
    { title: 'Authentication', desc: 'User accounts are secured with Firebase Authentication. We support email/password with bcrypt hashing, and OAuth providers for social login.' },
    { title: 'Data Minimization', desc: 'We collect only the data necessary to provide our services. You can request data export or deletion at any time.' },
    { title: 'Regular Audits', desc: 'Our security practices are regularly reviewed. Stripe undergoes annual PCI audits by a Qualified Security Assessor (QSA).' }
  ];

  function renderBadge(containerId, options) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var size = (options && options.size) || 'default';
    var padding = size === 'compact' ? '0.4rem 0.75rem' : '0.6rem 1rem';
    var fontSize = size === 'compact' ? '0.75rem' : '0.85rem';
    var iconSize = size === 'compact' ? '14px' : '18px';

    container.innerHTML =
      '<div class="pci-badge" style="display:inline-flex;align-items:center;gap:0.5rem;padding:' + padding + ';background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;" title="Click to learn about our security practices">' +
        '<svg width="' + iconSize + '" height="' + iconSize + '" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' +
          '<path d="M9 12l2 2 4-4"/>' +
        '</svg>' +
        '<span style="font-size:' + fontSize + ';color:var(--text-dim);">Payments secured by</span>' +
        '<span style="font-size:' + fontSize + ';color:var(--text-bright);font-weight:700;">Stripe</span>' +
      '</div>';

    container.querySelector('.pci-badge').addEventListener('click', function () {
      showSecurityModal();
    });
  }

  function showSecurityModal() {
    var existing = document.getElementById('pci-security-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'pci-security-modal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;';

    var detailsHtml = SECURITY_DETAILS.map(function (item) {
      return '<div style="padding:1rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);">' +
        '<h4 style="color:var(--green);margin-bottom:0.35rem;">' + item.title + '</h4>' +
        '<p style="color:var(--text);font-size:0.9rem;line-height:1.5;margin:0;">' + item.desc + '</p>' +
      '</div>';
    }).join('');

    overlay.innerHTML =
      '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);max-width:600px;width:100%;max-height:85vh;overflow-y:auto;padding:2rem;position:relative;">' +
        '<button id="pci-modal-close" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--text-dim);font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>' +
        '<h2 style="color:var(--text-bright);margin-bottom:0.5rem;">Security & Data Protection</h2>' +
        '<p style="color:var(--text-dim);margin-bottom:1.5rem;">How we keep your data and payments safe.</p>' +
        '<div style="display:flex;flex-direction:column;gap:0.75rem;">' + detailsHtml + '</div>' +
        '<div style="margin-top:1.5rem;text-align:center;">' +
          '<div style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>' +
            '<span style="color:var(--text-dim);font-size:0.8rem;">PCI DSS Level 1 Compliant via Stripe</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('pci-modal-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  }

  function renderSecurityPage(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var detailsHtml = SECURITY_DETAILS.map(function (item) {
      return '<div style="padding:1.25rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);">' +
        '<h3 style="color:var(--green);margin-bottom:0.5rem;">' + item.title + '</h3>' +
        '<p style="color:var(--text);line-height:1.6;margin:0;">' + item.desc + '</p>' +
      '</div>';
    }).join('');

    container.innerHTML =
      '<div style="max-width:700px;margin:0 auto;padding:2rem;">' +
        '<h1 style="color:var(--text-bright);font-size:2rem;margin-bottom:0.5rem;">Security</h1>' +
        '<p style="color:var(--text-dim);margin-bottom:2rem;">Your trust is our priority. Here\'s how we protect your data.</p>' +
        '<div style="display:flex;flex-direction:column;gap:1rem;">' + detailsHtml + '</div>' +
      '</div>';
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PCICompliance = {
    init: function () { console.log('[CF-200] PCICompliance ready'); },
    renderBadge: renderBadge,
    renderSecurityPage: renderSecurityPage,
    showSecurityModal: showSecurityModal
  };
})();
