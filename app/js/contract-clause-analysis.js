/**
 * CF-132: Contract Review — AI Clause Analysis
 * Analyzes contract text via API, flags risky clauses, and suggests modifications.
 */
(function () {
  'use strict';

  var API_ENDPOINT = '/api/analyze-contract';
  var REQUEST_TIMEOUT_MS = 45000;

  var RISK_CATEGORIES = {
    'non-compete': { label: 'Non-Compete', severity: 'high' },
    'ip-assignment': { label: 'IP Assignment', severity: 'high' },
    'payment-terms': { label: 'Payment Terms', severity: 'medium' },
    'termination': { label: 'Termination Clause', severity: 'medium' },
    'liability': { label: 'Liability / Indemnification', severity: 'high' },
    'confidentiality': { label: 'Confidentiality', severity: 'low' },
    'scope-creep': { label: 'Scope of Work', severity: 'medium' }
  };

  /**
   * Analyze contract text using the AI endpoint.
   * Falls back to local pattern matching if the API is unavailable.
   *
   * @param {{ text: string }} params
   * @returns {Promise<{ clauses: Array<{ type: string, label: string, severity: string, text: string, suggestion: string }>, riskScore: number, source: string }>}
   */
  async function analyze(params) {
    var text = (params && params.text) || '';
    if (!text.trim()) {
      return { clauses: [], riskScore: 0, source: 'local' };
    }

    try {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);

      var res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (res.ok) {
        var data = await res.json();
        if (data.clauses) return data;
      }
    } catch (_err) {
      // Fall through to local analysis
    }

    return localAnalysis(text);
  }

  /**
   * Local pattern-based clause analysis fallback.
   * @param {string} text
   * @returns {{ clauses: Array, riskScore: number, source: string }}
   */
  function localAnalysis(text) {
    var lower = text.toLowerCase();
    var clauses = [];

    var patterns = [
      {
        type: 'non-compete',
        regex: /non[- ]?compet[ei]/gi,
        suggestion: 'Limit non-compete scope to a specific geographic area, industry, and duration (ideally 6 months or less). Overly broad non-competes can restrict your future work.'
      },
      {
        type: 'ip-assignment',
        regex: /\b(intellectual property|ip\b|work[- ]?for[- ]?hire|assign(?:s|ment)?(?:\s+(?:all|any|every))?\s+(?:right|ip|intellectual))/gi,
        suggestion: 'Ensure IP assignment is limited to deliverables created specifically for this project. Retain rights to pre-existing work and general tools/methods.'
      },
      {
        type: 'payment-terms',
        regex: /\b(net[- ]?\d+|payment\s+(?:within|due|terms)|(?:30|45|60|90)\s*days?\s*(?:after|from|of))/gi,
        suggestion: 'Negotiate payment terms of Net 15 or Net 30 maximum. Include late payment penalties and milestone-based payment schedules.'
      },
      {
        type: 'termination',
        regex: /\b(terminat(?:e|ion)\s+(?:at\s+any\s+time|without\s+(?:cause|notice|reason))|immediate\s+termination)/gi,
        suggestion: 'Require a minimum notice period (14-30 days) for termination. Include a kill fee for work completed but not yet paid.'
      },
      {
        type: 'liability',
        regex: /\b(indemnif(?:y|ication)|hold\s+harmless|unlimited\s+liability|liable\s+for\s+(?:all|any))/gi,
        suggestion: 'Cap liability to the total contract value. Avoid unlimited indemnification clauses. Ensure mutual indemnification rather than one-sided.'
      },
      {
        type: 'confidentiality',
        regex: /\b(confidential(?:ity)?|non[- ]?disclosure|nda|trade\s+secret)/gi,
        suggestion: 'Ensure confidentiality obligations are mutual and have a reasonable duration (2-3 years). Exclude publicly available information.'
      },
      {
        type: 'scope-creep',
        regex: /\b(additional\s+(?:work|tasks|services)\s+(?:as\s+)?(?:needed|required|requested)|any\s+(?:other|additional)\s+(?:duties|tasks|work))/gi,
        suggestion: 'Define scope explicitly with a change order process. Additional work beyond the agreed scope should require a written amendment and additional compensation.'
      }
    ];

    patterns.forEach(function (pattern) {
      var match = lower.match(pattern.regex);
      if (match) {
        var cat = RISK_CATEGORIES[pattern.type];
        // Extract surrounding context for the first match
        var idx = lower.indexOf(match[0].toLowerCase());
        var start = Math.max(0, idx - 60);
        var end = Math.min(text.length, idx + match[0].length + 60);
        var excerpt = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');

        clauses.push({
          type: pattern.type,
          label: cat.label,
          severity: cat.severity,
          text: excerpt,
          suggestion: pattern.suggestion,
          matchCount: match.length
        });
      }
    });

    var riskScore = calculateRiskScore(clauses);
    return { clauses: clauses, riskScore: riskScore, source: 'local' };
  }

  /**
   * Calculate an overall risk score (0-100) from flagged clauses.
   * @param {Array} clauses
   * @returns {number}
   */
  function calculateRiskScore(clauses) {
    if (!clauses || clauses.length === 0) return 0;

    var weights = { high: 25, medium: 15, low: 5 };
    var score = 0;

    clauses.forEach(function (c) {
      score += weights[c.severity] || 10;
    });

    return Math.min(100, score);
  }

  /**
   * Get a human-readable risk level from a score.
   * @param {number} score
   * @returns {{ level: string, color: string, description: string }}
   */
  function getRiskLevel(score) {
    if (score >= 70) return { level: 'High Risk', color: '#ef4444', description: 'This contract contains multiple concerning clauses. Review carefully before signing.' };
    if (score >= 40) return { level: 'Medium Risk', color: '#f59e0b', description: 'Some clauses may need negotiation. Review the flagged items.' };
    if (score > 0) return { level: 'Low Risk', color: '#10b981', description: 'Minor items flagged. Generally looks acceptable.' };
    return { level: 'No Issues Found', color: '#6b7280', description: 'No risky clauses detected. Note: local analysis may not catch everything.' };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ContractClauseAnalysis = {
    analyze: analyze,
    calculateRiskScore: calculateRiskScore,
    getRiskLevel: getRiskLevel,
    RISK_CATEGORIES: RISK_CATEGORIES
  };
})();
