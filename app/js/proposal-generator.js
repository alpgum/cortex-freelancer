/**
 * [U-017] Proposal Generator — Draft proposals for matched jobs
 * Exposed as window.CortexProposalGenerator
 */
(function() {
  'use strict';

  function renderProposalButton(container, jobData, profileData) {
    const btn = document.createElement('button');
    btn.className = 'proposal-btn';
    btn.textContent = '✍️ Draft Proposal';
    btn.onclick = () => generateAndShowProposal(jobData, profileData);
    container.appendChild(btn);
  }

  async function generateAndShowProposal(jobData, profileData) {
    // Show loading modal
    const modal = createModal('Generating proposal...', '<div class="proposal-loading"><div class="spinner"></div><p>Writing a personalized proposal...</p></div>');
    document.body.appendChild(modal);

    try {
      const res = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: jobData.title,
          jobDescription: jobData.description,
          jobBudget: jobData.budget,
          jobSkills: jobData.skills,
          profile: profileData,
        }),
      });

      const data = await res.json();

      if (data.success && data.proposal) {
        modal.querySelector('.modal-body').innerHTML = `
          <div class="proposal-result">
            <div class="proposal-meta">
              <span class="source-badge">${data.source === 'ai' ? '🤖 AI Generated' : '📝 Template'}</span>
              <span class="timeline-badge">⏱ ${data.suggestedTimeline}</span>
            </div>
            <textarea class="proposal-text" rows="14">${escapeHtml(data.proposal)}</textarea>
            <div class="proposal-actions">
              <button class="copy-btn" onclick="navigator.clipboard.writeText(this.closest('.proposal-result').querySelector('textarea').value).then(()=>{this.textContent='✅ Copied!';setTimeout(()=>{this.textContent='📋 Copy'},2000)})">📋 Copy</button>
              ${jobData.url ? `<a href="${jobData.url}" target="_blank" class="view-job-btn">Open Job on Upwork →</a>` : ''}
            </div>
          </div>
        `;
      } else {
        modal.querySelector('.modal-body').innerHTML = `
          <p class="proposal-error">❌ Could not generate proposal. Please try again.</p>
        `;
      }
    } catch (err) {
      modal.querySelector('.modal-body').innerHTML = `
        <p class="proposal-error">❌ Error: ${err.message}</p>
      `;
    }
  }

  function createModal(title, bodyHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'proposal-modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
      <div class="proposal-modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="this.closest('.proposal-modal-overlay').remove()">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>
    `;

    return overlay;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Expose globally
  window.CortexProposalGenerator = {
    renderProposalButton,
    generateAndShowProposal,
  };
})();
