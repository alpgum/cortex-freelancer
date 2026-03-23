/**
 * [UW-016] Proposal A/B Testing — Generate and track proposal variants
 * Exposed as window.CortexProposalAB
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'cortex_proposal_ab';
  const STYLES = [
    { style: 'A', label: 'Professional', icon: '💼', desc: 'Formal tone, structured, metrics-focused' },
    { style: 'B', label: 'Conversational', icon: '💬', desc: 'Casual, story-driven, personal connection' },
    { style: 'C', label: 'Technical', icon: '🔧', desc: 'Methodology, tools, timeline breakdown' },
  ];

  // ── Storage helpers ──

  function loadTracking() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function saveTracking(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function trackVariant(jobUrl, variantStyle) {
    const entries = loadTracking();
    entries.push({
      jobUrl,
      variantUsed: variantStyle,
      sentAt: new Date().toISOString(),
      gotResponse: null,
    });
    saveTracking(entries);
  }

  function updateResponse(jobUrl, sentAt, gotResponse) {
    const entries = loadTracking();
    const entry = entries.find(e => e.jobUrl === jobUrl && e.sentAt === sentAt);
    if (entry) entry.gotResponse = gotResponse;
    saveTracking(entries);
  }

  function getStats() {
    const entries = loadTracking();
    const stats = {};
    STYLES.forEach(s => {
      const mine = entries.filter(e => e.variantUsed === s.style);
      const responded = mine.filter(e => e.gotResponse === true).length;
      const noResponse = mine.filter(e => e.gotResponse === false).length;
      const pending = mine.filter(e => e.gotResponse === null).length;
      stats[s.style] = {
        label: s.label,
        total: mine.length,
        responded,
        noResponse,
        pending,
        rate: mine.length > 0 ? Math.round((responded / (responded + noResponse || 1)) * 100) : null,
      };
    });
    return stats;
  }

  // ── Template-based variant generation ──

  function buildTemplateVariants(jobData, profileData) {
    const name = profileData?.name || 'there';
    const title = jobData?.title || 'your project';
    const skills = (jobData?.skills || []).slice(0, 5).join(', ') || 'the required skills';
    const profileTitle = profileData?.title || 'experienced freelancer';

    const professional = [
      `Dear Hiring Manager,`,
      ``,
      `I am writing to express my interest in "${title}." As a ${profileTitle}, I bring a proven track record of delivering high-quality results on time and within budget.`,
      ``,
      `Key qualifications:`,
      `• Expertise in ${skills}`,
      `• ${profileData?.jobsCompleted || '50+' } projects completed with ${profileData?.successRate || '95%+'} success rate`,
      `• Strong focus on measurable outcomes and clear communication`,
      ``,
      `I'd welcome the opportunity to discuss how I can contribute to your project's success. I'm available to start immediately and can provide relevant portfolio samples upon request.`,
      ``,
      `Best regards,`,
      `${name}`,
    ].join('\n');

    const conversational = [
      `Hi ${name === 'there' ? '' : ''}there! 👋`,
      ``,
      `I came across "${title}" and it immediately caught my eye — this is exactly the kind of work I love doing.`,
      ``,
      `A quick bit about me: I'm a ${profileTitle} who genuinely enjoys solving these types of challenges. I've worked on similar projects before and understand the nuances that make the difference between "okay" and "great."`,
      ``,
      `What excites me about your project is the chance to bring ${skills} together in a meaningful way. I'm not just looking to check boxes — I want to understand your vision and help bring it to life.`,
      ``,
      `Would love to chat more about what you have in mind. I'm flexible on timeline and always keep communication open and honest.`,
      ``,
      `Looking forward to hearing from you!`,
      `${name}`,
    ].join('\n');

    const technical = [
      `## Proposed Approach for "${title}"`,
      ``,
      `**Understanding:** Based on the job description, this project requires expertise in ${skills}.`,
      ``,
      `**Methodology:**`,
      `1. Discovery & Requirements Analysis (Day 1-2)`,
      `   - Deep dive into specifications and constraints`,
      `   - Clarify deliverables and acceptance criteria`,
      `2. Implementation Phase (Day 3-7)`,
      `   - Iterative development with daily progress updates`,
      `   - Tools: ${skills}`,
      `3. Testing & Delivery (Day 8-10)`,
      `   - Comprehensive QA and edge case handling`,
      `   - Documentation and handoff`,
      ``,
      `**Timeline:** ~10 business days (adjustable based on scope)`,
      `**Communication:** Daily async updates + weekly sync calls`,
      ``,
      `I've completed ${profileData?.jobsCompleted || '50+'} similar projects. Happy to share specific case studies relevant to your needs.`,
      ``,
      `— ${name}`,
    ].join('\n');

    return [
      { style: 'A', label: 'Professional', proposal: professional },
      { style: 'B', label: 'Conversational', proposal: conversational },
      { style: 'C', label: 'Technical', proposal: technical },
    ];
  }

  // ── Generate variants (API or fallback) ──

  async function generateVariants(jobData, profileData) {
    try {
      const res = await fetch('/api/generate-proposal-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: jobData?.title || '',
          jobDescription: jobData?.description || '',
          jobSkills: jobData?.skills || [],
          profile: profileData || {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.variants?.length === 3) {
          return { variants: data.variants, source: data.source || 'api' };
        }
      }
    } catch (_) { /* fall through to templates */ }

    return { variants: buildTemplateVariants(jobData, profileData), source: 'template' };
  }

  // ── UI helpers ──

  function escapeHtml(str) {
    const el = document.createElement('div');
    el.textContent = str;
    return el.innerHTML;
  }

  function injectStyles() {
    if (document.getElementById('proposal-ab-styles')) return;
    const style = document.createElement('style');
    style.id = 'proposal-ab-styles';
    style.textContent = `
      .pab-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #e4e4e7; }

      .pab-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
      .pab-tab {
        flex: 1; padding: 10px 12px; border: 1px solid #3f3f46; border-radius: 8px;
        background: #1c1c1e; color: #a1a1aa; cursor: pointer; text-align: center;
        font-size: 13px; transition: all .15s ease;
      }
      .pab-tab:hover { background: #27272a; color: #e4e4e7; }
      .pab-tab.active { background: #2563eb; border-color: #2563eb; color: #fff; }
      .pab-tab .tab-icon { display: block; font-size: 20px; margin-bottom: 2px; }
      .pab-tab .tab-label { font-weight: 600; }
      .pab-tab .tab-desc { font-size: 11px; opacity: .7; margin-top: 2px; }

      .pab-panel { display: none; }
      .pab-panel.active { display: block; }

      .pab-textarea {
        width: 100%; min-height: 220px; padding: 12px; border: 1px solid #3f3f46;
        border-radius: 8px; background: #18181b; color: #e4e4e7; font-size: 14px;
        line-height: 1.6; resize: vertical; font-family: inherit; box-sizing: border-box;
      }
      .pab-textarea:focus { outline: none; border-color: #2563eb; }

      .pab-actions { display: flex; gap: 8px; margin-top: 10px; }
      .pab-btn {
        padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;
        font-size: 13px; font-weight: 600; transition: all .15s ease;
      }
      .pab-btn-primary { background: #2563eb; color: #fff; }
      .pab-btn-primary:hover { background: #1d4ed8; }
      .pab-btn-secondary { background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; }
      .pab-btn-secondary:hover { background: #3f3f46; color: #fff; }

      .pab-source { font-size: 11px; color: #71717a; margin-top: 8px; }

      .pab-stats { margin-top: 20px; padding: 14px; background: #1c1c1e; border: 1px solid #3f3f46; border-radius: 8px; }
      .pab-stats h4 { margin: 0 0 10px; font-size: 13px; color: #a1a1aa; }
      .pab-stat-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 0; border-bottom: 1px solid #27272a; font-size: 13px;
      }
      .pab-stat-row:last-child { border-bottom: none; }
      .pab-stat-label { font-weight: 500; }
      .pab-stat-nums { color: #a1a1aa; }
      .pab-stat-rate { font-weight: 700; color: #22c55e; }
      .pab-stat-rate.low { color: #ef4444; }
      .pab-stat-rate.mid { color: #f59e0b; }

      .pab-insight {
        margin-top: 12px; padding: 12px; background: linear-gradient(135deg, #1e1b4b 0%, #1c1c1e 100%);
        border: 1px solid #4338ca; border-radius: 8px; font-size: 13px;
      }
      .pab-insight strong { color: #818cf8; }

      .pab-history { margin-top: 16px; }
      .pab-history h4 { margin: 0 0 8px; font-size: 13px; color: #a1a1aa; }
      .pab-history-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 8px; background: #18181b; border-radius: 6px; margin-bottom: 4px;
        font-size: 12px;
      }
      .pab-history-item .job-url { color: #60a5fa; text-decoration: none; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pab-resp-btn { padding: 3px 8px; border-radius: 4px; border: 1px solid #3f3f46; background: #27272a; color: #a1a1aa; cursor: pointer; font-size: 11px; margin-left: 4px; }
      .pab-resp-btn:hover { background: #3f3f46; color: #fff; }
      .pab-resp-btn.yes { border-color: #22c55e; color: #22c55e; }
      .pab-resp-btn.no { border-color: #ef4444; color: #ef4444; }

      .pab-loading { text-align: center; padding: 40px 0; color: #a1a1aa; }
      .pab-spinner { display: inline-block; width: 24px; height: 24px; border: 2px solid #3f3f46; border-top-color: #2563eb; border-radius: 50%; animation: pab-spin .6s linear infinite; }
      @keyframes pab-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  // ── Render ──

  async function renderProposalAB(jobData, profileData, container) {
    injectStyles();
    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'pab-container';

    // Loading state
    wrap.innerHTML = '<div class="pab-loading"><div class="pab-spinner"></div><p>Generating 3 proposal variants…</p></div>';
    container.appendChild(wrap);

    const { variants, source } = await generateVariants(jobData, profileData);

    wrap.innerHTML = '';

    // ── Tabs ──
    const tabBar = document.createElement('div');
    tabBar.className = 'pab-tabs';

    const panels = [];

    STYLES.forEach((s, i) => {
      const variant = variants.find(v => v.style === s.style) || variants[i];

      // Tab button
      const tab = document.createElement('button');
      tab.className = 'pab-tab' + (i === 0 ? ' active' : '');
      tab.innerHTML = `<span class="tab-icon">${s.icon}</span><span class="tab-label">${s.label}</span><span class="tab-desc">${s.desc}</span>`;
      tab.onclick = () => {
        tabBar.querySelectorAll('.pab-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        panels.forEach(p => p.classList.remove('active'));
        panels[i].classList.add('active');
      };
      tabBar.appendChild(tab);

      // Panel
      const panel = document.createElement('div');
      panel.className = 'pab-panel' + (i === 0 ? ' active' : '');

      const textarea = document.createElement('textarea');
      textarea.className = 'pab-textarea';
      textarea.value = variant?.proposal || '';
      panel.appendChild(textarea);

      const actions = document.createElement('div');
      actions.className = 'pab-actions';

      const useBtn = document.createElement('button');
      useBtn.className = 'pab-btn pab-btn-primary';
      useBtn.textContent = '✅ Use This';
      useBtn.onclick = () => {
        const text = textarea.value;
        navigator.clipboard.writeText(text).then(() => {
          useBtn.textContent = '📋 Copied!';
          setTimeout(() => { useBtn.textContent = '✅ Use This'; }, 2000);
        });
        trackVariant(jobData?.url || jobData?.title || 'unknown', s.style);
        renderStats(statsContainer);
        renderHistory(historyContainer);
      };

      const copyBtn = document.createElement('button');
      copyBtn.className = 'pab-btn pab-btn-secondary';
      copyBtn.textContent = '📋 Copy';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(textarea.value).then(() => {
          copyBtn.textContent = '✅ Copied!';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 2000);
        });
      };

      actions.appendChild(useBtn);
      actions.appendChild(copyBtn);

      if (jobData?.url) {
        const openBtn = document.createElement('a');
        openBtn.className = 'pab-btn pab-btn-secondary';
        openBtn.textContent = 'Open Job →';
        openBtn.href = jobData.url;
        openBtn.target = '_blank';
        openBtn.style.textDecoration = 'none';
        actions.appendChild(openBtn);
      }

      panel.appendChild(actions);

      const srcTag = document.createElement('div');
      srcTag.className = 'pab-source';
      srcTag.textContent = source === 'ai' ? '🤖 AI-generated variant' : '📝 Template-based variant';
      panel.appendChild(srcTag);

      panels.push(panel);
    });

    wrap.appendChild(tabBar);
    panels.forEach(p => wrap.appendChild(p));

    // ── Stats ──
    const statsContainer = document.createElement('div');
    statsContainer.className = 'pab-stats';
    renderStats(statsContainer);
    wrap.appendChild(statsContainer);

    // ── Recent history ──
    const historyContainer = document.createElement('div');
    historyContainer.className = 'pab-history';
    renderHistory(historyContainer);
    wrap.appendChild(historyContainer);
  }

  function renderStats(container) {
    const stats = getStats();
    const entries = Object.values(stats);
    const hasData = entries.some(e => e.total > 0);

    let html = '<h4>📊 A/B Test Results</h4>';

    if (!hasData) {
      html += '<div style="font-size:12px;color:#71717a;">No proposals sent yet. Use a variant above to start tracking.</div>';
    } else {
      entries.forEach(s => {
        const rateClass = s.rate === null ? '' : s.rate >= 50 ? '' : s.rate >= 25 ? 'mid' : 'low';
        const rateText = s.rate !== null ? `${s.rate}%` : '—';
        html += `<div class="pab-stat-row">
          <span class="pab-stat-label">${s.label}</span>
          <span class="pab-stat-nums">${s.total} sent · ${s.responded} responded · ${s.pending} pending</span>
          <span class="pab-stat-rate ${rateClass}">${rateText}</span>
        </div>`;
      });

      // Insight card
      const best = entries.filter(e => e.total >= 2 && e.rate !== null).sort((a, b) => b.rate - a.rate)[0];
      if (best) {
        html += `<div class="pab-insight"><strong>💡 Which style works best?</strong><br>${best.label} has the highest response rate at <strong>${best.rate}%</strong> (${best.responded}/${best.responded + best.noResponse} responses from ${best.total} sent).</div>`;
      } else {
        html += `<div class="pab-insight"><strong>💡 Which style works best?</strong><br>Send at least 2 proposals per style and mark responses to see insights.</div>`;
      }
    }

    container.innerHTML = html;
  }

  function renderHistory(container) {
    const entries = loadTracking().slice(-10).reverse();
    if (!entries.length) {
      container.innerHTML = '';
      return;
    }

    let html = '<h4>🕓 Recent Proposals</h4>';
    entries.forEach(e => {
      const style = STYLES.find(s => s.style === e.variantUsed);
      const date = new Date(e.sentAt).toLocaleDateString();
      const statusHtml = e.gotResponse === true
        ? '<span style="color:#22c55e">✅ Response</span>'
        : e.gotResponse === false
        ? '<span style="color:#ef4444">❌ No response</span>'
        : `<button class="pab-resp-btn yes" data-url="${escapeHtml(e.jobUrl)}" data-sent="${e.sentAt}" data-resp="true">✓ Got reply</button><button class="pab-resp-btn no" data-url="${escapeHtml(e.jobUrl)}" data-sent="${e.sentAt}" data-resp="false">✗ Nothing</button>`;

      html += `<div class="pab-history-item">
        <span>${style?.icon || '📝'} ${style?.label || e.variantUsed}</span>
        <span style="color:#71717a">${date}</span>
        <a class="job-url" href="${escapeHtml(e.jobUrl)}" target="_blank">${escapeHtml(e.jobUrl)}</a>
        <span>${statusHtml}</span>
      </div>`;
    });

    container.innerHTML = html;

    // Attach response handlers
    container.querySelectorAll('.pab-resp-btn').forEach(btn => {
      btn.onclick = () => {
        const gotResp = btn.dataset.resp === 'true';
        updateResponse(btn.dataset.url, btn.dataset.sent, gotResp);
        const statsEl = container.previousElementSibling;
        if (statsEl) renderStats(statsEl);
        renderHistory(container);
      };
    });
  }

  // ── Public API ──

  window.CortexProposalAB = {
    generateVariants,
    renderProposalAB,
    trackVariant,
    updateResponse,
    getStats,
    loadTracking,
    STYLES,
  };

})();
