/**
 * [UW-015 / CF-021] Cortex Red Flag Detector
 * Job listing safety analyzer for freelancers
 * Exposed as window.CortexRedFlagDetector + window.CortexFreelancer.JobRedFlags
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ───────── pattern lists ───────── */

  const DANGER_PATTERNS = {
    unlimitedRevisions: /unlimited\s+revisions?/i,
    workForFree: /work\s+for\s+free|trial\s+task|unpaid\s+test|free\s+sample|prove\s+yourself/i,
    personalInfo: /\b(ssn|social\s+security|bank\s+(account|detail)|passport|national\s+id|send\s+(your\s+)?id)\b/i,
    guaranteedWork: /guaranteed\s+(ongoing|continuous|long[\s-]?term)\s+work/i,
    paymentOutside: /pay(ment)?\s+(outside|off[\s-]?platform|via\s+(paypal|venmo|zelle|crypto|western\s+union|wire))|direct\s+payment/i,
  };

  const WARNING_PATTERNS = {
    asap: /\basap\b|urgent(ly)?|immediately|right\s+now/i,
    unrealisticTimeline: /in\s+(1|2|one|two)\s+days?|24\s*h(ou)?rs?|48\s*h(ou)?rs?|overnight/i,
  };

  const SENIOR_SKILLS = new Set([
    'react', 'angular', 'vue', 'node.js', 'python', 'machine learning',
    'ai', 'blockchain', 'solidity', 'aws', 'devops', 'kubernetes',
    'data science', 'deep learning', 'system design', 'architecture',
    'swift', 'kotlin', 'rust', 'go', 'golang', 'tensorflow', 'pytorch',
  ]);

  const DELIVERABLE_KEYWORDS = /\b(deliverable|milestone|deadline|phase|requirement|specification|scope|feature list|wireframe|prototype|mockup)\b/i;

  /* ───────── helpers ───────── */

  function wordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function isAllCaps(text) {
    if (!text || text.length < 30) return false;
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 20) return false;
    return letters === letters.toUpperCase();
  }

  function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d)) return null;
    return (Date.now() - d.getTime()) / 86400000;
  }

  /* ───────── core analyzer ───────── */

  function analyze(job) {
    const flags = [];
    const safeIndicators = [];
    const desc = (job.description || '').trim();
    const descLower = desc.toLowerCase();
    const budget = parseFloat(job.budget) || 0;
    const budgetType = (job.budgetType || '').toLowerCase(); // "fixed" | "hourly"
    const skills = job.skills || [];
    const skillsLower = skills.map(s => s.toLowerCase());
    const seniorCount = skillsLower.filter(s => SENIOR_SKILLS.has(s)).length;

    /* ── DANGER flags ── */

    // Budget too low
    if (budgetType === 'fixed' && budget > 0 && budget < 50 && wordCount(desc) > 30) {
      flags.push({
        type: 'danger',
        message: 'Budget dangerously low',
        detail: `Fixed price $${budget} for work that appears non-trivial. Likely exploitation.`,
      });
    }
    if (budgetType === 'hourly' && budget > 0 && budget < 3) {
      flags.push({
        type: 'danger',
        message: 'Hourly rate below minimum',
        detail: `$${budget}/hr is far below any reasonable rate. Avoid.`,
      });
    }

    // Pattern-based danger flags
    if (DANGER_PATTERNS.unlimitedRevisions.test(desc)) {
      flags.push({
        type: 'danger',
        message: 'Unlimited revisions mentioned',
        detail: 'Signals scope creep and unrealistic expectations. Never accept unlimited revisions.',
      });
    }
    if (DANGER_PATTERNS.workForFree.test(desc)) {
      flags.push({
        type: 'danger',
        message: 'Unpaid work requested',
        detail: 'Client wants free work upfront ("trial task", "prove yourself"). Legitimate clients pay for work.',
      });
    }
    if (DANGER_PATTERNS.personalInfo.test(desc)) {
      flags.push({
        type: 'danger',
        message: 'Requests personal information',
        detail: 'Description asks for SSN, bank details, or ID. This is a scam red flag.',
      });
    }
    if (DANGER_PATTERNS.guaranteedWork.test(desc)) {
      flags.push({
        type: 'danger',
        message: '"Guaranteed ongoing work" bait',
        detail: 'Promising future work to justify low pay now. Judge the current job on its own terms.',
      });
    }
    if (DANGER_PATTERNS.paymentOutside.test(desc)) {
      flags.push({
        type: 'danger',
        message: 'Payment outside platform',
        detail: 'Wants to pay off-platform. You lose all buyer protection and dispute resolution.',
      });
    }

    /* ── WARNING flags ── */

    if (wordCount(desc) < 50) {
      flags.push({
        type: 'warning',
        message: 'Vague scope',
        detail: `Description is only ${wordCount(desc)} words. Unclear scope leads to disputes.`,
      });
    }

    if (budgetType === 'hourly' && budget >= 5 && budget <= 10 && seniorCount >= 2) {
      flags.push({
        type: 'warning',
        message: 'Budget/skill mismatch',
        detail: `$${budget}/hr but requires senior skills (${skillsLower.filter(s => SENIOR_SKILLS.has(s)).join(', ')}). Likely underpaying.`,
      });
    }

    if (job.clientHireCount === 0 || job.clientHireCount === '0') {
      flags.push({
        type: 'warning',
        message: 'New client with no hire history',
        detail: 'First-time client — not necessarily bad, but proceed with caution and use milestones.',
      });
    }

    if (WARNING_PATTERNS.asap.test(desc) && budget < 50 && budgetType === 'hourly' && budget > 0) {
      flags.push({
        type: 'warning',
        message: 'Urgent without premium pay',
        detail: 'Marked as urgent/ASAP but the rate doesn\'t reflect rush pricing.',
      });
    } else if (WARNING_PATTERNS.asap.test(desc)) {
      flags.push({
        type: 'warning',
        message: 'Urgency language detected',
        detail: '"ASAP" or "urgent" — make sure the timeline is realistic and pay reflects the rush.',
      });
    }

    if (WARNING_PATTERNS.unrealisticTimeline.test(desc)) {
      flags.push({
        type: 'warning',
        message: 'Unrealistic timeline',
        detail: 'Expects completion in 1-2 days. Ensure scope actually fits or negotiate.',
      });
    }

    if (skills.length > 10) {
      flags.push({
        type: 'warning',
        message: 'Too many required skills',
        detail: `${skills.length} skills listed — client may not know what they need, or expects a unicorn.`,
      });
    }

    if (isAllCaps(desc)) {
      flags.push({
        type: 'warning',
        message: 'Description is ALL CAPS',
        detail: 'Unprofessional formatting. Often correlates with difficult clients.',
      });
    }

    /* ── SAFE indicators ── */

    if (job.clientHireCount && parseInt(job.clientHireCount, 10) > 3) {
      safeIndicators.push('Client has hire history (' + job.clientHireCount + ' hires)');
    }

    if (DELIVERABLE_KEYWORDS.test(desc)) {
      safeIndicators.push('Clear deliverables or milestones mentioned');
    }

    if (budgetType === 'hourly' && budget >= 25) {
      safeIndicators.push('Reasonable hourly rate ($' + budget + '/hr)');
    } else if (budgetType === 'fixed' && budget >= 200 && wordCount(desc) >= 50) {
      safeIndicators.push('Reasonable fixed budget for scope');
    }

    if (wordCount(desc) >= 100 && !isAllCaps(desc)) {
      safeIndicators.push('Professional, detailed description');
    }

    /* ── scoring ── */

    let score = 70; // start neutral-positive
    const dangerFlags = flags.filter(f => f.type === 'danger');
    const warningFlags = flags.filter(f => f.type === 'warning');

    score -= dangerFlags.length * 20;
    score -= warningFlags.length * 8;
    score += safeIndicators.length * 7;
    score = Math.max(0, Math.min(100, score));

    let safetyLevel, recommendation;
    if (score >= 70) {
      safetyLevel = 'safe';
      recommendation = 'Looks good — submit a strong proposal with clear deliverables.';
    } else if (score >= 40) {
      safetyLevel = 'caution';
      recommendation = 'Apply with caution — negotiate payment milestones and clarify scope before starting.';
    } else {
      safetyLevel = 'risky';
      recommendation = 'High risk — consider skipping this job or demanding escrow/milestone payments upfront.';
    }

    return { safetyScore: score, safetyLevel, flags, safeIndicators, recommendation };
  }

  /* ───────── safety tips ───────── */

  const SAFETY_TIPS = [
    'Always use platform escrow — never accept off-platform payments.',
    'Set clear milestones with partial payments at each stage.',
    'Get the full scope in writing before starting any work.',
    'Never share personal documents (ID, SSN, bank info) with clients.',
    'Charge rush fees for urgent timelines — your time has value.',
    'If it sounds too good to be true, it probably is.',
    'Check the client\'s review history and past jobs before applying.',
  ];

  /* ───────── renderer ───────── */

  function renderRedFlags(job, container) {
    if (!container) return;
    const result = analyze(job);

    // Badge emoji + color
    const badgeMap = { safe: '🟢', caution: '🟡', risky: '🔴' };
    const colorMap = { safe: '#22c55e', caution: '#eab308', risky: '#ef4444' };
    const bgMap = { safe: '#f0fdf4', caution: '#fefce8', risky: '#fef2f2' };
    const badge = badgeMap[result.safetyLevel];
    const color = colorMap[result.safetyLevel];
    const bg = bgMap[result.safetyLevel];

    const id = 'crf-' + Math.random().toString(36).slice(2, 9);

    let html = '';

    // Compact badge
    html += '<div class="cortex-redflag-badge" style="display:inline-flex;align-items:center;gap:6px;'
      + 'padding:4px 10px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;'
      + 'background:' + bg + ';border:1px solid ' + color + ';color:' + color + ';user-select:none;" '
      + 'onclick="document.getElementById(\'' + id + '\').style.display='
      + 'document.getElementById(\'' + id + '\').style.display===\'none\'?\'block\':\'none\'">'
      + badge + ' ' + result.safetyScore + '/100 — '
      + result.safetyLevel.charAt(0).toUpperCase() + result.safetyLevel.slice(1)
      + ' <span style="font-size:10px;opacity:0.7">▼</span>'
      + '</div>';

    // Expandable detail panel
    html += '<div id="' + id + '" style="display:none;margin-top:8px;padding:12px 16px;'
      + 'border-radius:8px;background:#fafafa;border:1px solid #e5e7eb;font-size:13px;line-height:1.6;">';

    // Danger flags
    if (result.flags.filter(f => f.type === 'danger').length > 0) {
      html += '<div style="margin-bottom:8px;font-weight:600;color:#dc2626;">🔴 Danger Flags</div>';
      result.flags.filter(f => f.type === 'danger').forEach(function (f) {
        html += '<div style="margin-left:12px;margin-bottom:6px;">'
          + '<strong>' + escHtml(f.message) + '</strong><br>'
          + '<span style="color:#6b7280;font-size:12px;">' + escHtml(f.detail) + '</span></div>';
      });
    }

    // Warning flags
    if (result.flags.filter(f => f.type === 'warning').length > 0) {
      html += '<div style="margin-bottom:8px;margin-top:10px;font-weight:600;color:#ca8a04;">🟡 Warning Flags</div>';
      result.flags.filter(f => f.type === 'warning').forEach(function (f) {
        html += '<div style="margin-left:12px;margin-bottom:6px;">'
          + '<strong>' + escHtml(f.message) + '</strong><br>'
          + '<span style="color:#6b7280;font-size:12px;">' + escHtml(f.detail) + '</span></div>';
      });
    }

    // Safe indicators
    if (result.safeIndicators.length > 0) {
      html += '<div style="margin-bottom:8px;margin-top:10px;font-weight:600;color:#16a34a;">🟢 Safe Indicators</div>';
      result.safeIndicators.forEach(function (s) {
        html += '<div style="margin-left:12px;margin-bottom:4px;">✓ ' + escHtml(s) + '</div>';
      });
    }

    // Recommendation
    html += '<div style="margin-top:12px;padding:8px 12px;border-radius:6px;background:' + bg + ';'
      + 'border-left:3px solid ' + color + ';font-weight:500;">'
      + escHtml(result.recommendation) + '</div>';

    // Safety tips for risky jobs
    if (result.safetyLevel === 'risky') {
      html += '<div style="margin-top:12px;padding:10px 12px;border-radius:6px;background:#fff7ed;'
        + 'border:1px solid #fed7aa;">'
        + '<div style="font-weight:600;color:#c2410c;margin-bottom:6px;">🛡️ Safety Tips</div>';
      SAFETY_TIPS.forEach(function (tip) {
        html += '<div style="margin-left:8px;margin-bottom:3px;font-size:12px;color:#9a3412;">• ' + escHtml(tip) + '</div>';
      });
      html += '</div>';
    }

    html += '</div>';

    container.innerHTML = html;
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ───────── [CF-021] Structured red flag detector ───────── */

  /**
   * Detect job red flags with severity levels and actionable recommendations.
   * Uses rate-benchmark.js data when available for market-rate comparisons.
   * @param {object} jobData
   * @param {string} [jobData.description] - Job description
   * @param {number} [jobData.budget] - Budget/rate offered
   * @param {string} [jobData.budgetType] - "hourly" or "fixed"
   * @param {string[]} [jobData.skills] - Required skills
   * @param {string} [jobData.category] - Job category
   * @param {string} [jobData.country] - Client country
   * @param {number} [jobData.clientHireCount] - Client's hire count
   * @param {number} [jobData.clientTotalSpent] - Client's total spend
   * @param {string} [jobData.milestones] - Milestone/deliverable info
   * @returns {Array<{flag: string, severity: 'critical'|'high'|'medium'|'low', explanation: string, recommendation: string}>}
   */
  function detectJobRedFlags(jobData) {
    if (!jobData) return [];
    var flags = [];
    var desc = (jobData.description || '').trim();
    var descLower = desc.toLowerCase();
    var budget = parseFloat(jobData.budget) || 0;
    var budgetType = (jobData.budgetType || '').toLowerCase();
    var skills = jobData.skills || [];
    var seniorCount = skills.filter(function (s) { return SENIOR_SKILLS.has(s.toLowerCase()); }).length;

    // ── Critical: scam patterns ──
    if (DANGER_PATTERNS.workForFree.test(desc)) {
      flags.push({
        flag: 'Unpaid test work requested',
        severity: 'critical',
        explanation: 'The listing asks for free work upfront ("trial task", "prove yourself"). Legitimate clients pay for all work.',
        recommendation: 'Skip this job. If interested, propose a small paid test task instead.',
      });
    }
    if (DANGER_PATTERNS.personalInfo.test(desc)) {
      flags.push({
        flag: 'Requests personal information',
        severity: 'critical',
        explanation: 'Asks for SSN, bank details, or government ID — a strong scam indicator.',
        recommendation: 'Do not apply. Report this listing to the platform.',
      });
    }
    if (DANGER_PATTERNS.paymentOutside.test(desc)) {
      flags.push({
        flag: 'Off-platform payment',
        severity: 'critical',
        explanation: 'Client wants to pay outside the platform, bypassing escrow protections.',
        recommendation: 'Refuse off-platform payment. Insist on platform escrow for all work.',
      });
    }

    // ── High: exploitative patterns ──
    if (DANGER_PATTERNS.unlimitedRevisions.test(desc)) {
      flags.push({
        flag: 'Unlimited revisions',
        severity: 'high',
        explanation: '"Unlimited revisions" is a red flag for scope creep. Work never ends.',
        recommendation: 'Negotiate a specific number of revision rounds (2-3) in your contract.',
      });
    }
    if (DANGER_PATTERNS.guaranteedWork.test(desc)) {
      flags.push({
        flag: '"Guaranteed ongoing work" bait',
        severity: 'high',
        explanation: 'Promising future work to justify low pay now. The future work rarely materializes.',
        recommendation: 'Judge the job on current terms only. Do not discount your rate for promises.',
      });
    }

    // Pay below market (use RateBenchmark when available)
    if (budget > 0 && budgetType === 'hourly') {
      var belowMarket = false;
      var marketMedian = null;
      if (window.CortexFreelancer && window.CortexFreelancer.RateBenchmark) {
        var bm = window.CortexFreelancer.RateBenchmark.getRateBenchmark(
          jobData.category || 'Web Dev', jobData.country || 'US'
        );
        if (bm) {
          marketMedian = bm.median;
          if (budget < bm.percentile25) belowMarket = true;
        }
      }
      if (!marketMedian && budget < 10 && seniorCount >= 1) belowMarket = true;
      if (belowMarket) {
        flags.push({
          flag: 'Pay below market rate',
          severity: 'high',
          explanation: '$' + budget + '/hr is below the 25th percentile' + (marketMedian ? ' (market median: $' + marketMedian + '/hr)' : '') + ' for the required skills.',
          recommendation: 'Counter-propose a rate aligned with market data, or skip if client is firm.',
        });
      }
    }

    // Unrealistic expectations: too many skills for budget
    if (skills.length > 8 && budget > 0 && budget < 30 && budgetType === 'hourly') {
      flags.push({
        flag: 'Unrealistic expectations',
        severity: 'high',
        explanation: skills.length + ' skills required at $' + budget + '/hr suggests the client wants a unicorn at a discount.',
        recommendation: 'Clarify which 2-3 skills are actually primary before applying.',
      });
    }

    // ── Medium: warning signals ──
    if (wordCount(desc) < 50) {
      flags.push({
        flag: 'Vague deliverables',
        severity: 'medium',
        explanation: 'Description is only ' + wordCount(desc) + ' words — too brief to understand the scope.',
        recommendation: 'Ask clarifying questions before submitting a proposal. Request a detailed brief.',
      });
    }

    if (budgetType === 'fixed' && budget > 0) {
      var milestones = jobData.milestones || '';
      var hasMilestoneInfo = /\b(milestone|phase|deliverable|payment schedule)\b/i.test(desc + ' ' + milestones);
      if (!hasMilestoneInfo) {
        flags.push({
          flag: 'Fixed price without clear milestones',
          severity: 'medium',
          explanation: 'Fixed-price job ($' + budget + ') with no milestone structure mentioned.',
          recommendation: 'Propose milestone-based payments (e.g., 30/30/40 split) tied to deliverables.',
        });
      }
    }

    if ((parseInt(jobData.clientHireCount, 10) || 0) === 0 && (parseFloat(jobData.clientTotalSpent) || 0) === 0) {
      flags.push({
        flag: 'New client with no history',
        severity: 'medium',
        explanation: 'Client has never hired on the platform. Higher risk of disputes or payment issues.',
        recommendation: 'Use milestones, request upfront payment or escrow, and keep initial scope small.',
      });
    }

    // ── Low: minor caution ──
    if (WARNING_PATTERNS.asap.test(desc)) {
      flags.push({
        flag: 'Urgency pressure',
        severity: 'low',
        explanation: 'Contains urgency language ("ASAP", "urgent"). Rush jobs often lead to scope issues.',
        recommendation: 'Charge a rush premium (20-50%) and confirm the timeline is realistic.',
      });
    }

    if (/test\s+project|trial\s+project|small\s+test/i.test(desc) && !DANGER_PATTERNS.workForFree.test(desc)) {
      flags.push({
        flag: '"Test project" pattern',
        severity: 'low',
        explanation: 'Framed as a "test project" — may lead to unpaid work or unrealistic expectations for the test.',
        recommendation: 'Ensure the test project is paid and has clear deliverables and timeline.',
      });
    }

    return flags;
  }

  /* ───────── public API ───────── */

  window.CortexRedFlagDetector = {
    analyze: analyze,
    renderRedFlags: renderRedFlags,
    detectJobRedFlags: detectJobRedFlags,
    version: '1.1.0',
  };

  window.CortexFreelancer.JobRedFlags = {
    detectJobRedFlags: detectJobRedFlags,
    version: '1.0.0',
  };
})();
