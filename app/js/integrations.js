/**
 * Cortex Freelancer — Third-Party Integrations UI
 *
 * Manages OAuth connections to Gmail and Upwork from the frontend.
 * Checks URL params for connection results and shows status.
 */

(function() {
  'use strict';

  const API_BASE = window.location.origin;

  // ── URL Param Handlers (post-OAuth redirect) ────────────────────────

  function handleOAuthResults() {
    const params = new URLSearchParams(window.location.search);

    // Gmail
    if (params.get('gmail_connected') === 'true') {
      const email = params.get('gmail_email');
      showIntegrationToast('Gmail connected' + (email ? `: ${email}` : ''), 'success');
      cleanUrl(['gmail_connected', 'gmail_email']);
    }
    if (params.get('gmail_error')) {
      const errors = {
        denied: 'Gmail connection was denied.',
        expired: 'OAuth session expired. Please try again.',
        token_exchange_failed: 'Gmail authorization failed. Please try again.',
      };
      showIntegrationToast(errors[params.get('gmail_error')] || 'Gmail connection failed.', 'error');
      cleanUrl(['gmail_error']);
    }

    // Upwork
    if (params.get('upwork_connected') === 'true') {
      const name = params.get('upwork_name');
      showIntegrationToast('Upwork connected' + (name ? `: ${name}` : ''), 'success');
      cleanUrl(['upwork_connected', 'upwork_name']);
    }
    if (params.get('upwork_error')) {
      const errors = {
        denied: 'Upwork connection was denied.',
        expired: 'OAuth session expired. Please try again.',
        token_exchange_failed: 'Upwork authorization failed. Please try again.',
      };
      showIntegrationToast(errors[params.get('upwork_error')] || 'Upwork connection failed.', 'error');
      cleanUrl(['upwork_error']);
    }
  }

  function cleanUrl(paramsToRemove) {
    const url = new URL(window.location);
    paramsToRemove.forEach(p => url.searchParams.delete(p));
    window.history.replaceState({}, '', url.toString());
  }

  // ── Integration Status Check ────────────────────────────────────────

  async function checkIntegrationStatus(service) {
    const user = window.cortexGetUser?.();
    if (!user || user.uid === 'guest') return { connected: false };

    try {
      const res = await fetch(`${API_BASE}/api/${service}-auth?action=status&uid=${user.uid}`);
      return await res.json();
    } catch {
      return { connected: false };
    }
  }

  // ── Connect/Disconnect Functions ────────────────────────────────────

  function connectGmail() {
    const user = window.cortexGetUser?.();
    if (!user || user.uid === 'guest') {
      showIntegrationToast('Please sign in to connect Gmail.', 'error');
      return;
    }
    window.location.href = `${API_BASE}/api/gmail-auth?uid=${user.uid}`;
  }

  function connectUpwork() {
    const user = window.cortexGetUser?.();
    if (!user || user.uid === 'guest') {
      showIntegrationToast('Please sign in to connect Upwork.', 'error');
      return;
    }
    window.location.href = `${API_BASE}/api/upwork-auth?uid=${user.uid}`;
  }

  async function disconnectService(service) {
    const user = window.cortexGetUser?.();
    if (!user) return;

    try {
      const res = await fetch(`${API_BASE}/api/${service}-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        showIntegrationToast(`${service === 'gmail' ? 'Gmail' : 'Upwork'} disconnected.`, 'success');
        updateIntegrationUI();
      }
    } catch {
      showIntegrationToast('Failed to disconnect. Please try again.', 'error');
    }
  }

  // ── Send Email via Gmail ────────────────────────────────────────────

  async function sendGmailEmail({ to, subject, body, cc, bcc, threadId }) {
    const user = window.cortexGetUser?.();
    if (!user || user.uid === 'guest') throw new Error('Not authenticated');

    const res = await fetch(`${API_BASE}/api/gmail-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, to, subject, body, cc, bcc, threadId }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Send failed');
    return data;
  }

  // ── Generate Email Template ─────────────────────────────────────────

  async function generateEmailTemplate(template, context) {
    const res = await fetch(`${API_BASE}/api/gmail-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, context }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || 'Generation failed');
    return data;
  }

  // ── UI Updates ──────────────────────────────────────────────────────

  async function updateIntegrationUI() {
    const gmailBtn = document.getElementById('gmail-connect-btn');
    const upworkBtn = document.getElementById('upwork-connect-btn');

    if (gmailBtn) {
      const status = await checkIntegrationStatus('gmail');
      if (status.connected) {
        gmailBtn.textContent = `Gmail: ${status.email || 'Connected'}`;
        gmailBtn.classList.add('connected');
        gmailBtn.onclick = () => {
          if (confirm('Disconnect Gmail?')) disconnectService('gmail');
        };
      } else {
        gmailBtn.textContent = 'Connect Gmail';
        gmailBtn.classList.remove('connected');
        gmailBtn.onclick = connectGmail;
      }
    }

    if (upworkBtn) {
      const status = await checkIntegrationStatus('upwork');
      if (status.connected) {
        upworkBtn.textContent = `Upwork: ${status.profile?.name || 'Connected'}`;
        upworkBtn.classList.add('connected');
        upworkBtn.onclick = () => {
          if (confirm('Disconnect Upwork?')) disconnectService('upwork');
        };
      } else {
        upworkBtn.textContent = 'Connect Upwork';
        upworkBtn.classList.remove('connected');
        upworkBtn.onclick = connectUpwork;
      }
    }
  }

  // ── Toast Notification ──────────────────────────────────────────────

  function showIntegrationToast(msg, type) {
    let t = document.getElementById('integration-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'integration-toast';
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;z-index:10000;transition:opacity 0.3s;opacity:0;pointer-events:none;max-width:350px;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = type === 'error' ? '#ef4444' : '#10b981';
    t.style.opacity = '1';
    t.style.pointerEvents = 'auto';
    setTimeout(() => { t.style.opacity = '0'; t.style.pointerEvents = 'none'; }, 3500);
  }

  // ── Init ────────────────────────────────────────────────────────────

  handleOAuthResults();

  if (window.cortexWhenAuth) {
    window.cortexWhenAuth(() => updateIntegrationUI());
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateIntegrationUI);
  } else {
    updateIntegrationUI();
  }

  // ── Public API ──────────────────────────────────────────────────────

  window.cortexIntegrations = {
    connectGmail,
    connectUpwork,
    disconnectGmail: () => disconnectService('gmail'),
    disconnectUpwork: () => disconnectService('upwork'),
    checkGmailStatus: () => checkIntegrationStatus('gmail'),
    checkUpworkStatus: () => checkIntegrationStatus('upwork'),
    sendGmailEmail,
    generateEmailTemplate,
    updateUI: updateIntegrationUI,
  };

})();
