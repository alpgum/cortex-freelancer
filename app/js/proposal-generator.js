/**
 * [CF-031] AI Proposal Generator — Generate tailored proposals from job description + user profile
 * Shows Professional & Friendly variants with Copy buttons.
 * Exposed as window.CortexProposalGenerator
 */
(function () {
  'use strict';

  // ── Styles (injected once) ──
  const STYLE_ID = 'cortex-proposal-gen-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cpg-overlay{position:fixed;inset:0;z-index:9000;background:rgba(10,10,15,.92);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:1.5rem;animation:cpg-fadeIn .2s ease}
      @keyframes cpg-fadeIn{from{opacity:0}to{opacity:1}}
      .cpg-modal{background:#111118;border:1px solid rgba(255,255,255,.08);border-radius:20px;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 24px 80px rgba(0,0,0,.6)}
      .cpg-header{display:flex;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,.06)}
      .cpg-header h3{font-size:1.1rem;font-weight:800;color:#f0f0f0;display:flex;align-items:center;gap:.5rem}
      .cpg-close{background:none;border:none;color:#666;font-size:1.4rem;cursor:pointer;padding:.2rem .5rem;border-radius:8px;transition:all .15s}
      .cpg-close:hover{color:#f0f0f0;background:rgba(255,255,255,.06)}
      .cpg-body{padding:1.5rem}
      .cpg-textarea{width:100%;background:#1a1a22;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:.85rem 1rem;color:#f0f0f0;font-size:.9rem;font-family:inherit;outline:none;resize:vertical;min-height:140px;line-height:1.7;transition:border-color .2s}
      .cpg-textarea:focus{border-color:#ff8844}
      .cpg-textarea::placeholder{color:#444}
      .cpg-label{font-size:.72rem;font-weight:700;color:#ff8844;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:.5rem;display:block}
      .cpg-hint{font-size:.75rem;color:#666;margin-top:.35rem;text-align:right}
      .cpg-btn-generate{width:100%;margin-top:1rem;padding:.8rem 1.5rem;border:none;border-radius:100px;font-size:.95rem;font-weight:800;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#ff8844,#ff6622);color:#000;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.5rem}
      .cpg-btn-generate:hover{transform:translateY(-1px);box-shadow:0 8px 30px rgba(255,136,68,.3)}
      .cpg-btn-generate:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
      .cpg-spinner{display:inline-block;width:16px;height:16px;border:2.5px solid rgba(0,0,0,.2);border-top-color:#000;border-radius:50%;animation:cpg-spin .6s linear infinite}
      @keyframes cpg-spin{to{transform:rotate(360deg)}}
      .cpg-results{margin-top:1.25rem}
      .cpg-tabs{display:flex;gap:0;border-bottom:2px solid rgba(255,255,255,.06);margin-bottom:0}
      .cpg-tab{background:none;border:none;color:#666;font-size:.85rem;font-weight:600;padding:.7rem 1.2rem;cursor:pointer;font-family:inherit;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all .15s}
      .cpg-tab:hover{color:#f0f0f0}
      .cpg-tab.active{color:#ff8844;border-bottom-color:#ff8844}
      .cpg-panel{display:none;background:#1a1a22;border:1px solid rgba(255,255,255,.06);border-top:none;border-radius:0 0 16px 16px;padding:1.25rem}
      .cpg-panel.active{display:block}
      .cpg-source{display:inline-flex;align-items:center;gap:.3rem;font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:100px;margin-bottom:.75rem}
      .cpg-source-ai{background:rgba(0,255,136,.1);color:#00ff88}
      .cpg-source-template{background:rgba(255,136,68,.1);color:#ff8844}
      .cpg-proposal-text{white-space:pre-wrap;font-size:.9rem;line-height:1.8;color:#ccc;background:#111118;border-radius:10px;padding:1rem 1.25rem;min-height:80px;max-height:320px;overflow-y:auto}
      .cpg-actions{display:flex;gap:.5rem;margin-top:.85rem;flex-wrap:wrap}
      .cpg-btn-copy{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem 1.1rem;border-radius:100px;font-size:.82rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:#00ff88;color:#000;transition:all .15s}
      .cpg-btn-copy:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,255,136,.2)}
      .cpg-btn-copy.copied{background:#222;color:#00ff88}
      .cpg-error{padding:1rem;background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.15);border-radius:10px;color:#ff6666;font-size:.88rem;text-align:center;margin-top:.75rem}
    `;
    document.head.appendChild(style);
  }

  // ── State ──
  let currentOverlay = null;

  // ── Public: render a button that opens the generator modal ──
  function renderProposalButton(container, jobData, profileData) {
    const btn = document.createElement('button');
    btn.className = 'proposal-btn';
    btn.textContent = '✍️ Draft Proposal';
    btn.onclick = () => openGenerator(jobData, profileData);
    container.appendChild(btn);
  }

  // ── Public: open the generator (can be called directly) ──
  function openGenerator(jobData, profileData) {
    if (currentOverlay) currentOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'cpg-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const prefillJD = jobData?.description || jobData?.jobDescription || '';

    overlay.innerHTML = `
      <div class="cpg-modal">
        <div class="cpg-header">
          <h3>✍️ AI Proposal Generator</h3>
          <button class="cpg-close" title="Close">✕</button>
        </div>
        <div class="cpg-body">
          <label class="cpg-label">📋 Job Description</label>
          <textarea class="cpg-textarea" id="cpg-jd-input" placeholder="Paste the full job description here…&#10;&#10;The AI will analyze requirements, match them to your profile, and generate two tailored proposals.">${escapeHtml(prefillJD)}</textarea>
          <div class="cpg-hint"><span id="cpg-word-count">0</span> words</div>
          <button class="cpg-btn-generate" id="cpg-btn-generate">✨ Generate Proposals</button>
          <div class="cpg-results" id="cpg-results"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    currentOverlay = overlay;

    // Wire up events
    const closeBtn = overlay.querySelector('.cpg-close');
    closeBtn.onclick = () => overlay.remove();

    const textarea = overlay.querySelector('#cpg-jd-input');
    const wordCount = overlay.querySelector('#cpg-word-count');
    textarea.oninput = () => {
      const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
      wordCount.textContent = words;
    };
    textarea.oninput(); // init count

    const genBtn = overlay.querySelector('#cpg-btn-generate');
    genBtn.onclick = () => generateProposals(overlay, profileData);

    // Keyboard: Escape to close
    const escHandler = (e) => {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // Focus textarea
    setTimeout(() => textarea.focus(), 100);
  }

  // ── Legacy: generateAndShowProposal (backwards compat) ──
  async function generateAndShowProposal(jobData, profileData) {
    openGenerator(jobData, profileData);
  }

  // ── Generate proposals ──
  async function generateProposals(overlay, profileData) {
    const textarea = overlay.querySelector('#cpg-jd-input');
    const genBtn = overlay.querySelector('#cpg-btn-generate');
    const resultsDiv = overlay.querySelector('#cpg-results');

    const jd = textarea.value.trim();
    if (!jd) {
      showError(resultsDiv, 'Please paste a job description first.');
      return;
    }
    if (jd.length < 30) {
      showError(resultsDiv, 'Job description is too short — paste the full listing for better results.');
      return;
    }

    // Loading state
    genBtn.disabled = true;
    genBtn.innerHTML = '<span class="cpg-spinner"></span> Generating…';
    resultsDiv.innerHTML = '';

    try {
      const res = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobDescription: jd,
          profile: profileData || {},
          variants: true,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate proposals');
      }

      if (data.variants && data.variants.length > 0) {
        renderVariants(resultsDiv, data.variants);
      } else if (data.proposal) {
        // Legacy single-proposal response
        renderVariants(resultsDiv, [
          { tone: 'professional', label: '💼 Professional', proposal: data.proposal, source: data.source },
        ]);
      } else {
        throw new Error('No proposals returned');
      }
    } catch (err) {
      showError(resultsDiv, `❌ ${err.message}`);
    } finally {
      genBtn.disabled = false;
      genBtn.innerHTML = '✨ Generate Proposals';
    }
  }

  // ── Render variant tabs ──
  function renderVariants(container, variants) {
    let html = '<div class="cpg-tabs">';
    variants.forEach((v, i) => {
      html += `<button class="cpg-tab${i === 0 ? ' active' : ''}" data-idx="${i}">${escapeHtml(v.label)}</button>`;
    });
    html += '</div>';

    variants.forEach((v, i) => {
      const sourceClass = v.source === 'ai' ? 'cpg-source-ai' : 'cpg-source-template';
      const sourceLabel = v.source === 'ai' ? '🤖 AI Generated' : '📝 Template';
      html += `
        <div class="cpg-panel${i === 0 ? ' active' : ''}" data-idx="${i}">
          <span class="cpg-source ${sourceClass}">${sourceLabel}</span>
          <div class="cpg-proposal-text">${escapeHtml(v.proposal)}</div>
          <div class="cpg-actions">
            <button class="cpg-btn-copy" data-idx="${i}">📋 Copy</button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Tab switching
    container.querySelectorAll('.cpg-tab').forEach((tab) => {
      tab.onclick = () => {
        const idx = tab.dataset.idx;
        container.querySelectorAll('.cpg-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.cpg-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        container.querySelector(`.cpg-panel[data-idx="${idx}"]`).classList.add('active');
      };
    });

    // Copy buttons
    container.querySelectorAll('.cpg-btn-copy').forEach((btn) => {
      btn.onclick = () => {
        const idx = btn.dataset.idx;
        const text = variants[idx].proposal;
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✅ Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = '📋 Copy';
            btn.classList.remove('copied');
          }, 2000);
        }).catch(() => {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          btn.textContent = '✅ Copied!';
          setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
        });
      };
    });

    // Scroll results into view
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Show error ──
  function showError(container, message) {
    container.innerHTML = `<div class="cpg-error">${escapeHtml(message)}</div>`;
  }

  // ── Util ──
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ── Expose globally ──
  window.CortexProposalGenerator = {
    renderProposalButton,
    generateAndShowProposal,
    openGenerator,
  };
})();
