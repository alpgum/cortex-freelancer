/* ============================================
   CORTEX FREELANCER — Upwork Integration Core
   cf3-023 | upwork-core.js
   ============================================
   RSS-based Upwork job discovery engine with:
   - Multi-feed RSS parsing via CORS proxy
   - AI job matching (integrates cf3-018)
   - Proposal generation (integrates cf3-017)
   - Application tracking with status pipeline
   - Auto-refresh with rate limiting
   - Desktop notification support
   - Settings integration (cf3-009)
   ============================================ */

;(function(global) {
  'use strict';

  // ========== STORAGE KEYS ==========
  const KEYS = {
    CONFIG:    'cortex_upwork_config',
    JOBS:      'cortex_upwork_jobs',
    MATCHED:   'cortex_upwork_matched',
    PROPOSALS: 'cortex_upwork_proposals',
    SYNC:      'cortex_upwork_sync',
  };

  // ========== DEFAULT CONFIGURATION ==========
  const DEFAULT_CONFIG = {
    feeds: [],                     // [{url, label, enabled}]
    refreshInterval: 30,           // minutes
    autoRefresh: true,
    notifications: false,
    skills: [],
    minBudget: 200,
    jobType: 'all',                // all | fixed | hourly
    excludeKeywords: [],
    defaultRate: 50,
    proposalTone: 'professional',
    autoPortfolio: true,
    matchThreshold: 60,
  };

  // ========== CORS PROXIES ==========
  // Public proxies for RSS fetching (rotate on failure)
  const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest=',
  ];

  // ========== STATE ==========
  let config = {};
  let jobs = [];
  let matchedJobs = [];
  let proposals = [];
  let syncState = { lastSync: null, syncCount: 0, errors: [] };
  let autoRefreshTimer = null;
  let currentProxyIndex = 0;
  let activeFetches = 0;

  // ========== INITIALIZATION ==========
  function init() {
    loadState();
    bindEvents();
    renderConfig();
    renderFeeds();
    renderStats();
    renderProposals();
    updateStatusBanner();
    startAutoRefresh();

    // If we have feeds, do an initial sync
    if (config.feeds.length > 0 && jobs.length > 0) {
      renderJobFeed(jobs);
      runAIMatching();
    }

    console.log('[Upwork Core] Initialized with', config.feeds.length, 'feeds,', jobs.length, 'cached jobs');
  }

  // ========== PERSISTENCE ==========
  function loadState() {
    try {
      config = JSON.parse(localStorage.getItem(KEYS.CONFIG)) || {};
      config = { ...DEFAULT_CONFIG, ...config };
      // Ensure arrays
      if (!Array.isArray(config.feeds)) config.feeds = [];
      if (!Array.isArray(config.skills)) config.skills = [];
      if (!Array.isArray(config.excludeKeywords)) config.excludeKeywords = [];

      jobs = JSON.parse(localStorage.getItem(KEYS.JOBS)) || [];
      matchedJobs = JSON.parse(localStorage.getItem(KEYS.MATCHED)) || [];
      proposals = JSON.parse(localStorage.getItem(KEYS.PROPOSALS)) || [];
      syncState = JSON.parse(localStorage.getItem(KEYS.SYNC)) || { lastSync: null, syncCount: 0, errors: [] };
    } catch (e) {
      console.warn('[Upwork Core] State load error:', e);
    }
  }

  function saveConfig() {
    localStorage.setItem(KEYS.CONFIG, JSON.stringify(config));
  }

  function saveJobs() {
    localStorage.setItem(KEYS.JOBS, JSON.stringify(jobs));
  }

  function saveMatched() {
    localStorage.setItem(KEYS.MATCHED, JSON.stringify(matchedJobs));
  }

  function saveProposals() {
    localStorage.setItem(KEYS.PROPOSALS, JSON.stringify(proposals));
  }

  function saveSyncState() {
    localStorage.setItem(KEYS.SYNC, JSON.stringify(syncState));
  }

  // ========== RSS FEED ENGINE ==========
  async function fetchFeed(feedUrl) {
    const proxyUrl = CORS_PROXIES[currentProxyIndex] + encodeURIComponent(feedUrl);

    try {
      const resp = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      return parseRSSFeed(text);
    } catch (err) {
      console.warn(`[Upwork Core] Proxy ${currentProxyIndex} failed:`, err.message);
      // Rotate to next proxy
      currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
      throw err;
    }
  }

  function parseRSSFeed(xmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    if (doc.querySelector('parsererror')) {
      throw new Error('Invalid RSS XML');
    }

    const items = doc.querySelectorAll('item');
    const parsed = [];

    items.forEach(item => {
      const raw = {
        title:       getText(item, 'title'),
        link:        getText(item, 'link'),
        description: getText(item, 'description'),
        pubDate:     getText(item, 'pubDate'),
        guid:        getText(item, 'guid') || getText(item, 'link'),
      };

      // Parse Upwork-specific fields from description
      const details = parseUpworkDescription(raw.description);

      parsed.push({
        id: generateJobId(raw.guid || raw.link),
        title: cleanTitle(raw.title),
        link: raw.link,
        description: details.description,
        budget: details.budget,
        budgetType: details.budgetType,
        skills: details.skills,
        category: details.category,
        country: details.country,
        postedDate: raw.pubDate ? new Date(raw.pubDate).toISOString() : new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        isNew: true,
        matchScore: null,
      });
    });

    return parsed;
  }

  function getText(parent, tag) {
    const el = parent.querySelector(tag);
    if (!el) return '';
    return el.textContent || el.innerHTML?.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1') || '';
  }

  function cleanTitle(title) {
    // Remove common Upwork prefixes
    return title.replace(/^(Upwork\s*[-–]\s*)/i, '').trim();
  }

  function parseUpworkDescription(html) {
    const result = {
      description: '',
      budget: null,
      budgetType: 'unknown',
      skills: [],
      category: '',
      country: '',
    };

    if (!html) return result;

    // Strip HTML tags for clean text
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    result.description = text;

    // Extract budget
    const budgetFixed = text.match(/Budget:\s*\$?([\d,]+(?:\.\d{2})?)/i);
    const budgetHourly = text.match(/Hourly\s*Range:\s*\$?([\d,]+(?:\.\d{2})?)\s*-\s*\$?([\d,]+(?:\.\d{2})?)/i);

    if (budgetFixed) {
      result.budget = parseFloat(budgetFixed[1].replace(/,/g, ''));
      result.budgetType = 'fixed';
    } else if (budgetHourly) {
      result.budget = parseFloat(budgetHourly[2].replace(/,/g, ''));
      result.budgetType = 'hourly';
    }

    // Extract skills
    const skillsMatch = text.match(/Skills?:\s*(.+?)(?:\.|Category:|Country:|Posted On:|$)/i);
    if (skillsMatch) {
      result.skills = skillsMatch[1]
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 50);
    }

    // Extract category
    const catMatch = text.match(/Category:\s*(.+?)(?:\.|Skills?:|Country:|Posted On:|$)/i);
    if (catMatch) result.category = catMatch[1].trim();

    // Extract country
    const countryMatch = text.match(/Country:\s*(.+?)(?:\.|Skills?:|Category:|Posted On:|$)/i);
    if (countryMatch) result.country = countryMatch[1].trim();

    return result;
  }

  function generateJobId(input) {
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const chr = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return 'uw_' + Math.abs(hash).toString(36);
  }

  // ========== SYNC ENGINE ==========
  async function syncAllFeeds() {
    const enabledFeeds = config.feeds.filter(f => f.enabled !== false);
    if (enabledFeeds.length === 0) {
      showToast('No feeds configured. Add RSS feeds in Configuration.', 'info');
      return;
    }

    setStatusBanner('syncing', '🔄', 'Syncing…', `Fetching ${enabledFeeds.length} feed(s)…`, 'Syncing');
    activeFetches++;

    let newJobCount = 0;
    const existingIds = new Set(jobs.map(j => j.id));
    const errors = [];

    for (const feed of enabledFeeds) {
      try {
        const feedJobs = await fetchFeed(feed.url);
        for (const job of feedJobs) {
          if (!existingIds.has(job.id)) {
            job.feedLabel = feed.label || 'Default';
            jobs.unshift(job);
            existingIds.add(job.id);
            newJobCount++;
          }
        }
      } catch (err) {
        console.error(`[Upwork Core] Feed error (${feed.label}):`, err);
        errors.push({ feed: feed.label, error: err.message });
      }
    }

    // Cap stored jobs at 500
    if (jobs.length > 500) {
      jobs = jobs.slice(0, 500);
    }

    // Update sync state
    syncState.lastSync = new Date().toISOString();
    syncState.syncCount++;
    syncState.errors = errors;

    // Persist
    saveJobs();
    saveSyncState();

    // Run AI matching
    runAIMatching();

    // Update UI
    activeFetches--;
    renderJobFeed(getFilteredJobs());
    renderStats();
    updateStatusBanner();

    // Show results
    if (errors.length > 0 && newJobCount === 0) {
      setStatusBanner('error', '⚠️', 'Sync Failed', `${errors.length} feed(s) had errors`, 'Error');
      showToast(`Sync failed for ${errors.length} feed(s). Check your RSS URLs.`, 'error');
    } else if (newJobCount > 0) {
      showToast(`Found ${newJobCount} new job(s)!`, 'success');
      updateNewJobsBadge(newJobCount);

      // Desktop notification
      if (config.notifications && Notification.permission === 'granted') {
        new Notification('Cortex: New Upwork Jobs', {
          body: `${newJobCount} new opportunities found!`,
          icon: '/favicon.ico',
        });
      }
    } else {
      showToast('Feed synced — no new jobs found.', 'info');
    }
  }

  // ========== AI MATCHING ENGINE ==========
  function runAIMatching() {
    if (jobs.length === 0 || config.skills.length === 0) return;

    const userSkills = config.skills.map(s => s.toLowerCase().trim());
    const excludeKw = config.excludeKeywords.map(k => k.toLowerCase().trim());

    jobs.forEach(job => {
      let score = 0;
      const factors = [];

      // 1. Skill match (0-40 points)
      const jobText = (job.title + ' ' + job.description + ' ' + (job.skills || []).join(' ')).toLowerCase();
      let skillMatches = 0;
      userSkills.forEach(skill => {
        if (jobText.includes(skill)) {
          skillMatches++;
        }
      });
      const skillScore = Math.min(40, Math.round((skillMatches / Math.max(userSkills.length, 1)) * 40));
      score += skillScore;
      if (skillScore > 20) factors.push('Strong skill match');

      // 2. Budget match (0-20 points)
      if (job.budget) {
        if (job.budget >= config.minBudget) {
          score += 20;
          factors.push('Above min budget');
        } else if (job.budget >= config.minBudget * 0.5) {
          score += 10;
        }
      } else {
        score += 5; // Unknown budget = neutral
      }

      // 3. Job type preference (0-10 points)
      if (config.jobType === 'all') {
        score += 10;
      } else if (job.budgetType === config.jobType) {
        score += 10;
        factors.push('Preferred job type');
      }

      // 4. Recency (0-15 points)
      const ageHours = (Date.now() - new Date(job.postedDate).getTime()) / (1000 * 60 * 60);
      if (ageHours < 1) { score += 15; factors.push('Just posted'); }
      else if (ageHours < 6) { score += 12; }
      else if (ageHours < 24) { score += 8; }
      else if (ageHours < 72) { score += 4; }

      // 5. Description quality (0-15 points)
      const descLength = (job.description || '').length;
      if (descLength > 500) { score += 15; factors.push('Detailed description'); }
      else if (descLength > 200) { score += 10; }
      else if (descLength > 50) { score += 5; }

      // Penalty: exclude keywords
      const hasExcluded = excludeKw.some(kw => kw && jobText.includes(kw));
      if (hasExcluded) {
        score = Math.max(0, score - 30);
        factors.push('Contains excluded keyword');
      }

      job.matchScore = Math.min(100, Math.max(0, score));
      job.matchFactors = factors;

      // Tag matching skills
      if (job.skills) {
        job.skills = job.skills.map(s => ({
          name: s,
          isMatch: userSkills.some(us => s.toLowerCase().includes(us) || us.includes(s.toLowerCase())),
        }));
      }
    });

    // Sorted matched list
    matchedJobs = jobs
      .filter(j => j.matchScore >= config.matchThreshold)
      .sort((a, b) => b.matchScore - a.matchScore);

    saveJobs();
    saveMatched();
    renderMatchedJobs();
    renderStats();
  }

  // ========== PROPOSAL ENGINE ==========
  function generateProposal(job) {
    const tone = config.proposalTone;
    const rate = config.defaultRate;
    const skills = config.skills;

    // Check for SmartProposal integration (cf3-017)
    if (global.CortexProposalAI && typeof global.CortexProposalAI.generate === 'function') {
      return global.CortexProposalAI.generate({
        jobTitle: job.title,
        jobDescription: job.description,
        skills: skills,
        rate: rate,
        tone: tone,
      });
    }

    // Fallback: template-based proposal generation
    const matchingSkills = skills.filter(s =>
      (job.title + ' ' + job.description).toLowerCase().includes(s.toLowerCase())
    );

    const greetings = {
      professional: `Dear Hiring Manager,\n\nI am writing to express my interest in your project: "${job.title}."`,
      friendly: `Hi there!\n\nI just came across your project "${job.title}" and I'm really excited about it.`,
      confident: `Hello,\n\nI'm the right fit for "${job.title}" — here's why.`,
      consultative: `Hello,\n\nAfter reviewing your requirements for "${job.title}", I have some thoughts on the best approach.`,
    };

    const closings = {
      professional: `I look forward to discussing this opportunity further.\n\nBest regards`,
      friendly: `Would love to chat more about this!\n\nCheers`,
      confident: `Let's get started. I'm available to begin immediately.\n\nBest`,
      consultative: `I'd welcome the chance to discuss my approach in more detail.\n\nBest regards`,
    };

    const skillsList = matchingSkills.length > 0
      ? `My relevant expertise includes: ${matchingSkills.join(', ')}.`
      : `I bring strong experience in ${skills.slice(0, 3).join(', ')}.`;

    const proposal = [
      greetings[tone] || greetings.professional,
      '',
      skillsList,
      '',
      `I've reviewed the project requirements carefully and I'm confident I can deliver high-quality results within your timeline and budget.`,
      '',
      job.budget ? `Regarding the budget of $${job.budget.toLocaleString()}, I believe this is achievable and I can provide a detailed breakdown of deliverables.` : '',
      '',
      `Key highlights of what I'll bring:`,
      `• Thorough understanding of your requirements`,
      `• Clean, well-documented deliverables`,
      `• Regular progress updates and transparent communication`,
      `• Post-delivery support to ensure your satisfaction`,
      '',
      closings[tone] || closings.professional,
    ].filter(Boolean).join('\n');

    return {
      text: proposal,
      suggestedBid: job.budget ? Math.round(job.budget * 0.85) : rate * 40,
      bidType: job.budgetType === 'hourly' ? 'hourly' : 'fixed',
      strength: calculateProposalStrength(proposal, job),
      suggestions: [
        'Add a specific example of similar work you\'ve completed',
        'Mention a unique approach to solving their problem',
        'Include a timeline with milestones',
        matchingSkills.length === 0 ? 'Highlight transferable skills relevant to this project' : null,
      ].filter(Boolean),
    };
  }

  function calculateProposalStrength(text, job) {
    let score = 40; // Base

    // Length
    if (text.length > 800) score += 10;
    if (text.length > 1200) score += 5;

    // Personalization (mentions job title)
    if (text.includes(job.title)) score += 10;

    // Budget mention
    if (job.budget && text.includes(String(job.budget))) score += 5;

    // Structure (bullet points)
    if ((text.match(/•/g) || []).length >= 3) score += 10;

    // Questions
    if (text.includes('?')) score += 5;

    // Call to action
    if (/available|start|begin|discuss/i.test(text)) score += 5;

    // Not too short
    if (text.split('\n').filter(l => l.trim()).length >= 8) score += 10;

    return Math.min(100, score);
  }

  function createProposalRecord(job, proposalData) {
    const record = {
      id: 'prop_' + Date.now().toString(36),
      jobId: job.id,
      jobTitle: job.title,
      jobLink: job.link,
      text: proposalData.text,
      bid: proposalData.suggestedBid,
      bidType: proposalData.bidType,
      strength: proposalData.strength,
      status: 'draft', // draft | submitted | viewed | accepted | declined
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: '',
    };

    proposals.unshift(record);
    saveProposals();
    renderProposals();
    renderStats();
    return record;
  }

  // ========== FILTERING ==========
  function getFilteredJobs() {
    let filtered = [...jobs];
    const search = (document.getElementById('feedSearch')?.value || '').toLowerCase().trim();
    const typeFilter = document.getElementById('filterType')?.value || 'all';
    const budgetFilter = document.getElementById('filterBudget')?.value || 'all';
    const sortBy = document.getElementById('filterSort')?.value || 'newest';

    // Search
    if (search) {
      filtered = filtered.filter(j =>
        j.title.toLowerCase().includes(search) ||
        j.description.toLowerCase().includes(search) ||
        (j.skills || []).some(s => (typeof s === 'string' ? s : s.name).toLowerCase().includes(search))
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(j => j.budgetType === typeFilter);
    }

    // Budget filter
    if (budgetFilter !== 'all') {
      const [min, max] = budgetFilter.replace('+', '').split('-').map(Number);
      filtered = filtered.filter(j => {
        if (!j.budget) return false;
        if (budgetFilter.endsWith('+')) return j.budget >= min;
        return j.budget >= min && j.budget <= (max || Infinity);
      });
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));
        break;
      case 'budget-high':
        filtered.sort((a, b) => (b.budget || 0) - (a.budget || 0));
        break;
      case 'budget-low':
        filtered.sort((a, b) => (a.budget || 0) - (b.budget || 0));
        break;
      case 'match':
        filtered.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        break;
    }

    return filtered;
  }

  // ========== RENDERING ==========
  function renderJobFeed(jobList) {
    const container = document.getElementById('jobFeedList');
    if (!container) return;

    if (!jobList || jobList.length === 0) {
      container.innerHTML = `
        <div class="empty-state" id="emptyFeed">
          <div class="empty-icon">📡</div>
          <h3>No Jobs Yet</h3>
          <p>Configure your Upwork RSS feeds in the Configuration tab to start discovering jobs automatically.</p>
          <button class="btn btn-primary" onclick="document.querySelector('[data-tab=config]').click()">Configure Feeds</button>
        </div>`;
      return;
    }

    container.innerHTML = jobList.map(job => renderJobCard(job)).join('');

    // Bind click handlers
    container.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openJobModal(card.dataset.jobId);
      });
    });

    container.querySelectorAll('.btn-quick-proposal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProposalModal(btn.dataset.jobId);
      });
    });
  }

  function renderJobCard(job) {
    const scoreClass = (job.matchScore || 0) >= 75 ? 'high' : (job.matchScore || 0) >= 50 ? 'medium' : 'low';
    const isNew = job.isNew ? 'new' : '';
    const skills = (job.skills || []).slice(0, 6);
    const timeAgo = getTimeAgo(job.postedDate);
    const budgetStr = job.budget ? `$${job.budget.toLocaleString()}` : 'Not specified';
    const typeStr = job.budgetType === 'hourly' ? '⏱ Hourly' : job.budgetType === 'fixed' ? '💰 Fixed' : '❓ Unknown';

    return `
      <div class="job-card ${isNew}" data-job-id="${job.id}">
        <div class="job-card-header">
          ${job.matchScore !== null ? `<div class="job-match-score ${scoreClass}">${job.matchScore}%</div>` : ''}
          <div>
            <div class="job-card-title">${escapeHtml(job.title)}</div>
            <div class="job-card-meta">
              <span>${typeStr}</span>
              <span>💵 ${budgetStr}</span>
              <span>🕒 ${timeAgo}</span>
              ${job.country ? `<span>🌍 ${escapeHtml(job.country)}</span>` : ''}
              ${job.feedLabel ? `<span>📡 ${escapeHtml(job.feedLabel)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="job-card-desc">${escapeHtml(job.description || 'No description available.').slice(0, 300)}</div>
        <div class="job-card-skills">
          ${skills.map(s => {
            const name = typeof s === 'string' ? s : s.name;
            const matched = typeof s === 'object' && s.isMatch;
            return `<span class="skill-tag ${matched ? 'match' : ''}">${escapeHtml(name)}</span>`;
          }).join('')}
        </div>
        <div class="job-card-actions">
          <a href="${job.link}" target="_blank" rel="noopener" class="btn btn-outline btn-sm" onclick="event.stopPropagation()">View on Upwork ↗</a>
          <button class="btn btn-primary btn-sm btn-quick-proposal" data-job-id="${job.id}">Generate Proposal</button>
        </div>
      </div>`;
  }

  function renderMatchedJobs() {
    const container = document.getElementById('matchedJobList');
    if (!container) return;

    const threshold = config.matchThreshold || 60;
    const filtered = matchedJobs.filter(j => (j.matchScore || 0) >= threshold);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <h3>No Matches Above ${threshold}%</h3>
          <p>Lower the threshold or add more RSS feeds to find matching jobs.</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(job => renderJobCard(job)).join('');

    // Bind handlers
    container.querySelectorAll('.job-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        openJobModal(card.dataset.jobId);
      });
    });

    container.querySelectorAll('.btn-quick-proposal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openProposalModal(btn.dataset.jobId);
      });
    });
  }

  function renderProposals() {
    const container = document.getElementById('proposalList');
    if (!container) return;

    // Update stats
    const counts = { draft: 0, submitted: 0, viewed: 0, accepted: 0 };
    proposals.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
    setText('pDrafted', counts.draft);
    setText('pSubmitted', counts.submitted);
    setText('pViewed', counts.viewed);
    setText('pAccepted', counts.accepted);

    if (proposals.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>No Proposals Yet</h3>
          <p>Click "Generate Proposal" on any matched job to create an AI-powered proposal.</p>
        </div>`;
      return;
    }

    container.innerHTML = proposals.map(p => `
      <div class="proposal-card" data-proposal-id="${p.id}">
        <div class="proposal-card-info">
          <div class="proposal-card-title">${escapeHtml(p.jobTitle)}</div>
          <div class="proposal-card-meta">
            <span>💵 $${p.bid?.toLocaleString() || '—'} ${p.bidType}</span>
            <span>📊 Strength: ${p.strength || '—'}%</span>
            <span>🕒 ${getTimeAgo(p.createdAt)}</span>
          </div>
        </div>
        <span class="proposal-status ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        <div style="display:flex;gap:.35rem">
          <button class="btn btn-outline btn-sm" onclick="UpworkCore.editProposal('${p.id}')">Edit</button>
          <button class="btn btn-sm" style="background:var(--green);color:var(--bg)" onclick="UpworkCore.markProposal('${p.id}','submitted')">Mark Sent</button>
        </div>
      </div>
    `).join('');
  }

  function renderStats() {
    setText('statJobs', jobs.length);
    setText('statMatched', matchedJobs.length);
    setText('statProposals', proposals.length);
    setText('statLastSync', syncState.lastSync ? getTimeAgo(syncState.lastSync) : 'Never');
  }

  function renderConfig() {
    setVal('cfgRefreshInterval', config.refreshInterval);
    setChecked('cfgAutoRefresh', config.autoRefresh);
    setChecked('cfgNotifications', config.notifications);
    setVal('cfgSkills', config.skills.join(', '));
    setVal('cfgMinBudget', config.minBudget);
    setVal('cfgJobType', config.jobType);
    setVal('cfgExcludeKeywords', config.excludeKeywords.join(', '));
    setVal('cfgDefaultRate', config.defaultRate);
    setVal('cfgProposalTone', config.proposalTone);
    setChecked('cfgAutoPortfolio', config.autoPortfolio);

    const thresholdEl = document.getElementById('matchThreshold');
    const thresholdValEl = document.getElementById('matchThresholdVal');
    if (thresholdEl) {
      thresholdEl.value = config.matchThreshold;
      if (thresholdValEl) thresholdValEl.textContent = config.matchThreshold + '%';
    }
  }

  function renderFeeds() {
    const container = document.getElementById('feedUrlList');
    if (!container) return;

    if (config.feeds.length === 0) {
      container.innerHTML = '<p style="font-size:.8rem;color:var(--text3);padding:.5rem 0;">No feeds configured yet.</p>';
      return;
    }

    container.innerHTML = config.feeds.map((feed, i) => `
      <div class="feed-entry">
        <span class="feed-entry-label">${escapeHtml(feed.label || 'Feed ' + (i + 1))}</span>
        <span class="feed-entry-url" title="${escapeHtml(feed.url)}">${escapeHtml(feed.url)}</span>
        <button class="feed-entry-remove" onclick="UpworkCore.removeFeed(${i})" title="Remove feed">×</button>
      </div>
    `).join('');
  }

  // ========== STATUS BANNER ==========
  function updateStatusBanner() {
    if (config.feeds.length === 0) {
      setStatusBanner('', '⚡', 'Setup Required', 'Configure your Upwork RSS feeds to start discovering jobs', 'Setup Required');
    } else if (syncState.errors.length > 0 && jobs.length === 0) {
      setStatusBanner('error', '⚠️', 'Connection Error', `Failed to fetch ${syncState.errors.length} feed(s)`, 'Error');
    } else if (jobs.length > 0) {
      const lastSyncStr = syncState.lastSync ? getTimeAgo(syncState.lastSync) : 'never';
      setStatusBanner('connected', '✅', 'Connected', `${jobs.length} jobs tracked · Last sync: ${lastSyncStr}`, 'Active');
    } else {
      setStatusBanner('', '📡', 'Ready', `${config.feeds.length} feed(s) configured · Click Refresh to sync`, 'Ready');
    }
  }

  function setStatusBanner(cls, icon, label, detail, badge) {
    const banner = document.getElementById('statusBanner');
    if (!banner) return;
    banner.className = 'status-banner ' + cls;
    setText('statusIcon', icon);
    setText('statusLabel', label);
    setText('statusDetail', detail);
    setText('statusBadge', badge);
  }

  // ========== AUTO REFRESH ==========
  function startAutoRefresh() {
    stopAutoRefresh();
    if (!config.autoRefresh || config.feeds.length === 0) return;

    const intervalMs = (config.refreshInterval || 30) * 60 * 1000;
    autoRefreshTimer = setInterval(() => {
      if (activeFetches === 0) {
        console.log('[Upwork Core] Auto-refresh triggered');
        syncAllFeeds();
      }
    }, intervalMs);

    console.log(`[Upwork Core] Auto-refresh set every ${config.refreshInterval}m`);
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  // ========== MODALS ==========
  function openJobModal(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // Mark as not new
    job.isNew = false;
    saveJobs();

    const modal = document.getElementById('jobModal');
    setText('modalTitle', job.title);

    const skills = (job.skills || []).map(s => {
      const name = typeof s === 'string' ? s : s.name;
      const matched = typeof s === 'object' && s.isMatch;
      return `<span class="skill-tag ${matched ? 'match' : ''}">${escapeHtml(name)}</span>`;
    }).join('');

    document.getElementById('modalBody').innerHTML = `
      <div class="modal-job-meta">
        <span class="meta-item">💰 ${job.budget ? '$' + job.budget.toLocaleString() : 'Not specified'}</span>
        <span class="meta-item">${job.budgetType === 'hourly' ? '⏱ Hourly' : '💵 Fixed Price'}</span>
        <span class="meta-item">🕒 Posted ${getTimeAgo(job.postedDate)}</span>
        ${job.country ? `<span class="meta-item">🌍 ${escapeHtml(job.country)}</span>` : ''}
        ${job.matchScore !== null ? `<span class="meta-item">🤖 Match: ${job.matchScore}%</span>` : ''}
      </div>
      <div class="modal-job-desc">${escapeHtml(job.description || 'No description available.')}</div>
      ${skills ? `<div class="modal-skills">${skills}</div>` : ''}
      ${job.matchFactors?.length ? `
        <div style="margin-top:.75rem;padding:.5rem;background:var(--bg3);border-radius:var(--radius-xs);font-size:.75rem;color:var(--text2)">
          <strong style="color:var(--text)">AI Match Factors:</strong> ${job.matchFactors.join(' · ')}
        </div>` : ''}
    `;

    // Store current job for modal actions
    modal.dataset.currentJobId = jobId;
    modal.classList.add('open');
  }

  function closeJobModal() {
    document.getElementById('jobModal')?.classList.remove('open');
  }

  function openProposalModal(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    closeJobModal();

    const proposal = generateProposal(job);
    const modal = document.getElementById('proposalModal');

    setVal('proposalBid', proposal.suggestedBid);
    setVal('proposalBidType', proposal.bidType);
    setVal('proposalText', proposal.text);

    // Render suggestions
    const sugEl = document.getElementById('aiSuggestions');
    if (sugEl) {
      sugEl.innerHTML = `<ul>${proposal.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    }

    // Score
    const scoreFill = document.getElementById('proposalScoreFill');
    const scoreVal = document.getElementById('proposalScoreVal');
    if (scoreFill) scoreFill.style.width = proposal.strength + '%';
    if (scoreVal) scoreVal.textContent = proposal.strength + '%';

    modal.dataset.currentJobId = jobId;
    modal.classList.add('open');
  }

  function closeProposalModal() {
    document.getElementById('proposalModal')?.classList.remove('open');
  }

  // ========== EVENT BINDING ==========
  function bindEvents() {
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        const target = document.getElementById('tab-' + tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });

    // Refresh button
    document.getElementById('btnRefreshFeed')?.addEventListener('click', () => {
      if (activeFetches > 0) {
        showToast('Sync already in progress…', 'info');
        return;
      }
      syncAllFeeds();
    });

    // Settings button → jump to config tab
    document.getElementById('btnSettings')?.addEventListener('click', () => {
      document.querySelector('[data-tab=config]')?.click();
    });

    // Feed search & filters
    ['feedSearch'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', debounce(() => {
        renderJobFeed(getFilteredJobs());
      }, 300));
    });

    ['filterType', 'filterBudget', 'filterSort'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        renderJobFeed(getFilteredJobs());
      });
    });

    // Match threshold slider
    document.getElementById('matchThreshold')?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      setText('matchThresholdVal', val + '%');
      config.matchThreshold = val;
      saveConfig();
      renderMatchedJobs();
    });

    // Add feed
    document.getElementById('btnAddFeed')?.addEventListener('click', addFeed);

    // Save config
    document.getElementById('btnSaveConfig')?.addEventListener('click', saveConfigFromUI);

    // Reset config
    document.getElementById('btnResetConfig')?.addEventListener('click', () => {
      if (confirm('Reset all configuration to defaults?')) {
        config = { ...DEFAULT_CONFIG };
        saveConfig();
        renderConfig();
        renderFeeds();
        showToast('Configuration reset to defaults.', 'info');
      }
    });

    // Notifications permission
    document.getElementById('cfgNotifications')?.addEventListener('change', (e) => {
      if (e.target.checked && Notification.permission !== 'granted') {
        Notification.requestPermission().then(perm => {
          if (perm !== 'granted') {
            e.target.checked = false;
            showToast('Notification permission denied.', 'error');
          }
        });
      }
    });

    // Job modal
    document.getElementById('modalClose')?.addEventListener('click', closeJobModal);
    document.getElementById('modalDismiss')?.addEventListener('click', closeJobModal);
    document.getElementById('jobModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeJobModal();
    });
    document.getElementById('modalProposal')?.addEventListener('click', () => {
      const jobId = document.getElementById('jobModal')?.dataset.currentJobId;
      if (jobId) openProposalModal(jobId);
    });

    // Proposal modal
    document.getElementById('proposalModalClose')?.addEventListener('click', closeProposalModal);
    document.getElementById('proposalModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeProposalModal();
    });

    document.getElementById('btnSaveDraft')?.addEventListener('click', () => {
      const jobId = document.getElementById('proposalModal')?.dataset.currentJobId;
      const job = jobs.find(j => j.id === jobId);
      if (!job) return;

      const proposalData = {
        text: document.getElementById('proposalText')?.value || '',
        suggestedBid: parseFloat(document.getElementById('proposalBid')?.value) || 0,
        bidType: document.getElementById('proposalBidType')?.value || 'fixed',
        strength: parseInt(document.getElementById('proposalScoreVal')?.textContent) || 0,
      };

      createProposalRecord(job, proposalData);
      closeProposalModal();
      showToast('Proposal draft saved!', 'success');
    });

    document.getElementById('btnCopyProposal')?.addEventListener('click', () => {
      const text = document.getElementById('proposalText')?.value;
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showToast('Proposal copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Copy failed — select and copy manually.', 'error');
        });
      }
    });

    document.getElementById('btnRegenerateProposal')?.addEventListener('click', () => {
      const jobId = document.getElementById('proposalModal')?.dataset.currentJobId;
      if (jobId) openProposalModal(jobId);
    });

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeJobModal();
        closeProposalModal();
      }
    });
  }

  // ========== FEED MANAGEMENT ==========
  function addFeed() {
    const urlEl = document.getElementById('newFeedUrl');
    const labelEl = document.getElementById('newFeedLabel');
    const url = (urlEl?.value || '').trim();
    const label = (labelEl?.value || '').trim() || 'Feed ' + (config.feeds.length + 1);

    if (!url) {
      showToast('Please enter a feed URL.', 'error');
      return;
    }

    // Basic URL validation
    if (!url.startsWith('http')) {
      showToast('URL must start with http:// or https://', 'error');
      return;
    }

    // Duplicate check
    if (config.feeds.some(f => f.url === url)) {
      showToast('This feed URL is already added.', 'error');
      return;
    }

    config.feeds.push({ url, label, enabled: true });
    saveConfig();
    renderFeeds();
    updateStatusBanner();

    if (urlEl) urlEl.value = '';
    if (labelEl) labelEl.value = '';

    showToast(`Feed "${label}" added!`, 'success');
    startAutoRefresh();
  }

  function removeFeed(index) {
    const feed = config.feeds[index];
    if (!feed) return;

    config.feeds.splice(index, 1);
    saveConfig();
    renderFeeds();
    updateStatusBanner();
    showToast('Feed removed.', 'info');
  }

  function saveConfigFromUI() {
    config.refreshInterval = parseInt(getVal('cfgRefreshInterval')) || 30;
    config.autoRefresh = getChecked('cfgAutoRefresh');
    config.notifications = getChecked('cfgNotifications');
    config.skills = (getVal('cfgSkills') || '').split(',').map(s => s.trim()).filter(Boolean);
    config.minBudget = parseInt(getVal('cfgMinBudget')) || 0;
    config.jobType = getVal('cfgJobType') || 'all';
    config.excludeKeywords = (getVal('cfgExcludeKeywords') || '').split(',').map(s => s.trim()).filter(Boolean);
    config.defaultRate = parseInt(getVal('cfgDefaultRate')) || 50;
    config.proposalTone = getVal('cfgProposalTone') || 'professional';
    config.autoPortfolio = getChecked('cfgAutoPortfolio');

    saveConfig();
    startAutoRefresh();
    runAIMatching();
    showToast('Configuration saved!', 'success');
  }

  // ========== PROPOSAL MANAGEMENT ==========
  function editProposal(proposalId) {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    const job = jobs.find(j => j.id === proposal.jobId);
    const modal = document.getElementById('proposalModal');

    setVal('proposalBid', proposal.bid);
    setVal('proposalBidType', proposal.bidType);
    setVal('proposalText', proposal.text);

    const scoreFill = document.getElementById('proposalScoreFill');
    const scoreVal = document.getElementById('proposalScoreVal');
    if (scoreFill) scoreFill.style.width = (proposal.strength || 0) + '%';
    if (scoreVal) scoreVal.textContent = (proposal.strength || 0) + '%';

    modal.dataset.currentJobId = proposal.jobId;
    modal.dataset.editingProposalId = proposalId;
    modal.classList.add('open');
  }

  function markProposal(proposalId, status) {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    proposal.status = status;
    proposal.updatedAt = new Date().toISOString();
    saveProposals();
    renderProposals();
    renderStats();
    showToast(`Proposal marked as ${status}.`, 'success');
  }

  // ========== HELPERS ==========
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }

  function getVal(id) {
    return document.getElementById(id)?.value || '';
  }

  function setChecked(id, val) {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  }

  function getChecked(id) {
    return document.getElementById(id)?.checked || false;
  }

  function getTimeAgo(dateStr) {
    if (!dateStr) return 'Unknown';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  function debounce(fn, ms) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function updateNewJobsBadge(count) {
    const badge = document.getElementById('newJobsBadge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <span class="toast-text">${escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // ========== SETTINGS INTEGRATION (cf3-009) ==========
  function loadFromCortexSettings() {
    try {
      if (global.CortexSettings) {
        const settings = global.CortexSettings;
        const rate = settings.get('rates.defaultHourlyRate');
        const skills = settings.get('upwork.skills');
        const currency = settings.get('user.currency');

        if (rate && !config.defaultRate) config.defaultRate = rate;
        if (skills && config.skills.length === 0) config.skills = skills;
        if (currency) config.currency = currency;

        saveConfig();
        console.log('[Upwork Core] Loaded settings from CortexSettings');
      }
    } catch (e) {
      console.warn('[Upwork Core] CortexSettings integration skipped:', e.message);
    }
  }

  // ========== PUBLIC API ==========
  global.UpworkCore = {
    init,
    syncAllFeeds,
    addFeed,
    removeFeed,
    generateProposal,
    editProposal,
    markProposal,
    openJobModal,
    openProposalModal,

    // Getters for other modules
    getJobs: () => [...jobs],
    getMatchedJobs: () => [...matchedJobs],
    getProposals: () => [...proposals],
    getConfig: () => ({ ...config }),
    getSyncState: () => ({ ...syncState }),

    // For external integrations
    importJobs: (newJobs) => {
      const existingIds = new Set(jobs.map(j => j.id));
      let added = 0;
      newJobs.forEach(j => {
        if (!existingIds.has(j.id)) {
          jobs.unshift(j);
          existingIds.add(j.id);
          added++;
        }
      });
      if (added > 0) {
        saveJobs();
        runAIMatching();
        renderJobFeed(getFilteredJobs());
        renderStats();
      }
      return added;
    },
  };

  // ========== BOOT ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadFromCortexSettings();
      init();
    });
  } else {
    loadFromCortexSettings();
    init();
  }

})(window);
