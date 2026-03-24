/**
 * CF-132: Contract Review AI Clause Analysis
 * Analyze contract text, flag risky clauses (IP assignment, non-compete,
 * liability, payment terms), and suggest modifications.
 * Uses mock AI analysis for demonstration.
 *
 * @namespace window.CortexFreelancer.ContractReview
 */
(function () {
  'use strict';

  var ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  var STORAGE_KEY = 'cortex_contract_review';

  // ─── Risk Clause Patterns ────────────────────────────

  var CLAUSE_RULES = [
    {
      id: 'ip-assignment',
      label: 'IP Assignment',
      severity: 'high',
      patterns: [
        /\b(all\s+)?intellectual\s+property\b.*\b(assign|transfer|belong|vest)\b/i,
        /\b(work\s+product|deliverables?)\b.*\b(sole\s+property|exclusively\s+owned)\b/i,
        /\bassign\b.*\b(all\s+rights?|copyright|patent)\b/i,
        /\bwork[- ]?for[- ]?hire\b/i
      ],
      risk: 'Transfers all IP rights to the client, including potential pre-existing work and tools.',
      suggestion: 'Limit IP transfer to project-specific deliverables only. Retain rights to pre-existing tools, frameworks, and methodologies. Add a license-back clause for your portfolio use.'
    },
    {
      id: 'non-compete',
      label: 'Non-Compete',
      severity: 'high',
      patterns: [
        /\bnon[- ]?compet(e|ition)\b/i,
        /\brestrictive\s+covenant\b/i,
        /\bshall\s+not\b.*\b(compete|solicit|engage)\b.*\b(similar|competing)\b/i,
        /\bexclusi(ve|vity)\b.*\b(period|term|duration)\b/i
      ],
      risk: 'May prevent you from working with similar clients or in your field for a specified period.',
      suggestion: 'Negotiate narrower scope (specific project type, not entire industry). Limit duration to 3-6 months max. Ensure geographic restrictions are reasonable. Request compensation for the non-compete period.'
    },
    {
      id: 'liability',
      label: 'Unlimited Liability',
      severity: 'high',
      patterns: [
        /\b(unlimited|uncapped)\s+(liability|damages)\b/i,
        /\bindemnif(y|ication)\b.*\b(all|any|every)\s+(claims?|losses?|damages?)\b/i,
        /\bhold\s+harmless\b/i,
        /\bliable\s+for\b.*\b(consequential|indirect|special)\s+damages\b/i
      ],
      risk: 'Exposes you to potentially unlimited financial liability beyond the contract value.',
      suggestion: 'Cap liability at the total contract value or fees paid. Exclude consequential, indirect, and special damages. Add mutual indemnification (both parties share responsibility).'
    },
    {
      id: 'payment-terms',
      label: 'Unfavorable Payment Terms',
      severity: 'medium',
      patterns: [
        /\b(net\s+)?([6-9]\d|[1-9]\d{2,})\s*days?\b/i,
        /\bpay(ment)?\b.*\b(upon\s+completion|after\s+(?:final\s+)?delivery)\b/i,
        /\bno\s+(advance|deposit|upfront)\b/i,
        /\bpayment\b.*\bsole\s+discretion\b/i
      ],
      risk: 'Long payment terms or completion-only payment puts you at financial risk.',
      suggestion: 'Request milestone-based payments (e.g., 30% upfront, 40% mid-project, 30% on delivery). Set payment terms to Net 15 or Net 30 max. Include late payment penalties (1.5% monthly interest).'
    },
    {
      id: 'termination',
      label: 'One-Sided Termination',
      severity: 'medium',
      patterns: [
        /\b(client|company)\b.*\bterminate\b.*\b(at\s+any\s+time|without\s+(cause|reason)|for\s+convenience)\b/i,
        /\btermination\b.*\bwithout\s+(prior\s+)?notice\b/i,
        /\bimmediate(ly)?\s+terminat/i
      ],
      risk: 'Client can terminate without notice or cause, leaving you without compensation for work in progress.',
      suggestion: 'Require minimum 14-30 days written notice for termination. Include a kill fee (25-50% of remaining contract value). Ensure payment for all work completed up to termination date.'
    },
    {
      id: 'scope-creep',
      label: 'Vague Scope / Unlimited Revisions',
      severity: 'medium',
      patterns: [
        /\b(unlimited|reasonable)\s+revisions?\b/i,
        /\b(any|all)\s+(additional|other)\s+(work|tasks?|services?)\b.*\bas\s+(needed|required|requested)\b/i,
        /\bscope\b.*\b(may\s+change|subject\s+to\s+change|modified\s+at)\b/i,
        /\band\s+other\s+(duties|tasks?|responsibilities)\s+as\s+(assigned|needed)\b/i
      ],
      risk: 'Open-ended scope allows client to request unlimited additional work without extra compensation.',
      suggestion: 'Define specific deliverables and revision limits (e.g., 2 rounds included). Add a change order process for out-of-scope requests. Specify hourly rate for additional work beyond scope.'
    },
    {
      id: 'confidentiality',
      label: 'Overly Broad Confidentiality',
      severity: 'low',
      patterns: [
        /\bconfiential\b.*\b(perpetual|indefinite|forever)\b/i,
        /\bconfidentiality\b.*\b(perpetual|indefinite|forever)\b/i,
        /\bnon[- ]?disclosure\b.*\b(all\s+information|everything)\b/i
      ],
      risk: 'Indefinite or overly broad confidentiality obligations may restrict your future work.',
      suggestion: 'Limit confidentiality duration to 2-3 years. Exclude publicly available information and your general skills/knowledge. Ensure you can reference the client relationship in your portfolio.'
    },
    {
      id: 'auto-renewal',
      label: 'Auto-Renewal Clause',
      severity: 'low',
      patterns: [
        /\bauto(matic(ally)?)?[- ]?renew/i,
        /\brenew(s|ed)?\s+(automatically|unless)\b/i
      ],
      risk: 'Contract may renew automatically, locking you into terms you may want to renegotiate.',
      suggestion: 'Require explicit written agreement for renewal. Add a rate adjustment clause for renewals. Set a reminder 30 days before the auto-renewal deadline.'
    }
  ];

  // ─── Sample Contract ──────────────────────────────────

  var SAMPLE_CONTRACT = 'FREELANCE SERVICE AGREEMENT\n\n' +
    '1. SCOPE OF WORK\nContractor shall perform web development services and other tasks as assigned by the Company. ' +
    'The Company reserves the right to modify the scope of work at its sole discretion. Contractor agrees to perform unlimited revisions until the Company is satisfied.\n\n' +
    '2. INTELLECTUAL PROPERTY\nAll work product, deliverables, code, designs, and documentation created by Contractor shall be the sole property of the Company. ' +
    'Contractor hereby assigns all rights, title, and interest in all intellectual property, including copyright and patent rights, to the Company. This is a work-for-hire arrangement.\n\n' +
    '3. PAYMENT\nPayment shall be made upon final delivery and acceptance of all deliverables. Payment terms are Net 90 days from invoice date. No advance or deposit shall be provided.\n\n' +
    '4. NON-COMPETE\nContractor shall not compete with or solicit clients of the Company for a period of 24 months following termination. ' +
    'This restrictive covenant applies to any similar or competing services in any geographic region.\n\n' +
    '5. LIABILITY & INDEMNIFICATION\nContractor agrees to indemnify and hold harmless the Company against all claims, losses, and damages. ' +
    'Contractor shall be liable for consequential and indirect damages arising from the services.\n\n' +
    '6. TERMINATION\nThe Company may terminate this agreement at any time without cause and without prior notice. ' +
    'Contractor may not terminate this agreement before completion of all deliverables.\n\n' +
    '7. CONFIDENTIALITY\nAll information shared by the Company is confidential and shall remain so in perpetuity. ' +
    'This non-disclosure obligation covers all information, including publicly available materials.\n\n' +
    '8. RENEWAL\nThis agreement automatically renews for successive 12-month terms unless cancelled 90 days before expiry.';

  // ─── Analysis Engine ──────────────────────────────────

  function analyzeContract(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { clauses: [], score: 100, summary: 'No contract text provided.' };
    }

    var found = [];
    var textLower = text.toLowerCase();

    for (var i = 0; i < CLAUSE_RULES.length; i++) {
      var rule = CLAUSE_RULES[i];
      var matched = false;
      var matchedText = '';

      for (var p = 0; p < rule.patterns.length; p++) {
        var m = text.match(rule.patterns[p]);
        if (m) {
          matched = true;
          // Extract surrounding context (up to 120 chars around match)
          var idx = text.indexOf(m[0]);
          var start = Math.max(0, idx - 40);
          var end = Math.min(text.length, idx + m[0].length + 80);
          matchedText = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');
          break;
        }
      }

      if (matched) {
        found.push({
          id: rule.id,
          label: rule.label,
          severity: rule.severity,
          risk: rule.risk,
          suggestion: rule.suggestion,
          excerpt: matchedText
        });
      }
    }

    // Calculate risk score (100 = safe, 0 = very risky)
    var score = 100;
    for (var j = 0; j < found.length; j++) {
      if (found[j].severity === 'high') score -= 18;
      else if (found[j].severity === 'medium') score -= 10;
      else score -= 5;
    }
    score = Math.max(0, Math.min(100, score));

    // Sort by severity
    var severityOrder = { high: 0, medium: 1, low: 2 };
    found.sort(function (a, b) {
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
    });

    var summary;
    if (found.length === 0) summary = 'No risky clauses detected. This contract appears relatively safe.';
    else if (score >= 70) summary = found.length + ' clause(s) flagged with minor concerns. Review the suggestions below.';
    else if (score >= 40) summary = found.length + ' clause(s) flagged. Several areas need attention before signing.';
    else summary = found.length + ' clause(s) flagged. This contract has significant risks — consider negotiating major changes.';

    return { clauses: found, score: score, summary: summary };
  }

  // ─── Helpers ──────────────────────────────────────────

  function esc(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function severityBadge(severity) {
    var colors = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
    var labels = { high: 'High Risk', medium: 'Medium Risk', low: 'Low Risk' };
    return '<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:' +
           (colors[severity] || '#94a3b8') + ';">' + (labels[severity] || severity) + '</span>';
  }

  function scoreColor(score) {
    if (score >= 70) return '#10b981';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  }

  // ─── Styles ───────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('cf-cr-styles')) return;
    var style = document.createElement('style');
    style.id = 'cf-cr-styles';
    style.textContent = [
      '.cr-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 0 auto; padding: 24px; color: #1f2937; }',
      '.cr-header { text-align: center; margin-bottom: 24px; }',
      '.cr-header h2 { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; }',
      '.cr-header p { font-size: 14px; color: #6b7280; margin: 0; }',
      '.cr-input-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }',
      '.cr-input-card h3 { font-size: 15px; font-weight: 600; margin: 0 0 12px 0; }',
      '.cr-textarea { width: 100%; box-sizing: border-box; min-height: 180px; padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: "SF Mono", Menlo, monospace; resize: vertical; line-height: 1.6; color: #1f2937; }',
      '.cr-textarea:focus { outline: none; border-color: #6366f1; }',
      '.cr-btn-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }',
      '.cr-analyze-btn { padding: 10px 24px; background: #4f46e5; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s; }',
      '.cr-analyze-btn:hover { background: #4338ca; }',
      '.cr-sample-btn { padding: 10px 20px; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-size: 13px; cursor: pointer; }',
      '.cr-sample-btn:hover { background: #e5e7eb; }',
      '.cr-results { margin-top: 24px; }',
      '.cr-score-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px; text-align: center; }',
      '.cr-score-label { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 600; margin-bottom: 10px; }',
      '.cr-score-value { font-size: 48px; font-weight: 800; margin-bottom: 6px; }',
      '.cr-score-bar { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; max-width: 300px; margin: 12px auto 0; }',
      '.cr-score-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; }',
      '.cr-summary { font-size: 14px; color: #6b7280; margin-top: 10px; }',
      '.cr-clause-list { display: flex; flex-direction: column; gap: 16px; }',
      '.cr-clause { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }',
      '.cr-clause-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }',
      '.cr-clause-title { font-size: 16px; font-weight: 600; }',
      '.cr-clause-excerpt { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 10px 14px; border-radius: 0 6px 6px 0; font-size: 12px; font-family: "SF Mono", Menlo, monospace; color: #92400e; margin-bottom: 12px; line-height: 1.5; }',
      '.cr-clause-section { margin-bottom: 10px; }',
      '.cr-clause-section:last-child { margin-bottom: 0; }',
      '.cr-clause-section-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }',
      '.cr-clause-section-text { font-size: 13px; color: #374151; line-height: 1.6; }',
      '.cr-no-issues { text-align: center; padding: 40px 20px; color: #10b981; font-size: 16px; font-weight: 600; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Render ───────────────────────────────────────────

  function renderResults(container, result) {
    var el = container.querySelector('.cr-results');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cr-results';
      container.appendChild(el);
    }

    var html = '';

    // Score card
    var color = scoreColor(result.score);
    html += '<div class="cr-score-card">';
    html += '<div class="cr-score-label">Contract Safety Score</div>';
    html += '<div class="cr-score-value" style="color:' + color + '">' + result.score + '/100</div>';
    html += '<div class="cr-score-bar"><div class="cr-score-fill" style="width:' + result.score + '%;background:' + color + '"></div></div>';
    html += '<div class="cr-summary">' + esc(result.summary) + '</div>';
    html += '</div>';

    if (result.clauses.length === 0) {
      html += '<div class="cr-no-issues">&#10003; No risky clauses detected</div>';
    } else {
      html += '<div class="cr-clause-list">';
      for (var i = 0; i < result.clauses.length; i++) {
        var c = result.clauses[i];
        html += '<div class="cr-clause">';
        html += '<div class="cr-clause-header">';
        html += '<span class="cr-clause-title">' + esc(c.label) + '</span>';
        html += severityBadge(c.severity);
        html += '</div>';
        if (c.excerpt) {
          html += '<div class="cr-clause-excerpt">"' + esc(c.excerpt) + '"</div>';
        }
        html += '<div class="cr-clause-section">';
        html += '<div class="cr-clause-section-label">Risk</div>';
        html += '<div class="cr-clause-section-text">' + esc(c.risk) + '</div>';
        html += '</div>';
        html += '<div class="cr-clause-section">';
        html += '<div class="cr-clause-section-label">Suggested Modification</div>';
        html += '<div class="cr-clause-section-text">' + esc(c.suggestion) + '</div>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function init(containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      console.error('[ContractReview] Container not found: #' + containerId);
      return;
    }

    injectStyles();

    // Load saved text
    var savedText = '';
    try { savedText = localStorage.getItem(STORAGE_KEY) || ''; } catch (e) {}

    var html = '<div class="cr-container">';
    html += '<div class="cr-header">';
    html += '<h2>Contract Review &mdash; AI Clause Analysis</h2>';
    html += '<p>Paste your contract text below to identify risky clauses and get actionable suggestions.</p>';
    html += '</div>';

    html += '<div class="cr-input-card">';
    html += '<h3>Contract Text</h3>';
    html += '<textarea class="cr-textarea" placeholder="Paste your contract or agreement text here...">' + esc(savedText) + '</textarea>';
    html += '<div class="cr-btn-row">';
    html += '<button class="cr-analyze-btn" data-action="analyze" type="button">Analyze Contract</button>';
    html += '<button class="cr-sample-btn" data-action="sample" type="button">Load Sample Contract</button>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;

    var textarea = container.querySelector('.cr-textarea');
    var inner = container.querySelector('.cr-container');

    container.addEventListener('click', function (e) {
      var action = e.target.getAttribute('data-action');
      if (action === 'analyze') {
        var text = textarea.value.trim();
        if (!text) {
          renderResults(inner, { clauses: [], score: 100, summary: 'Please paste contract text to analyze.' });
          return;
        }
        try { localStorage.setItem(STORAGE_KEY, text); } catch (ex) {}
        var result = analyzeContract(text);
        renderResults(inner, result);
      }
      if (action === 'sample') {
        textarea.value = SAMPLE_CONTRACT;
        try { localStorage.setItem(STORAGE_KEY, SAMPLE_CONTRACT); } catch (ex) {}
      }
    });

    // Auto-analyze if there's saved text
    if (savedText.trim()) {
      var result = analyzeContract(savedText);
      renderResults(inner, result);
    }
  }

  // ─── Namespace Registration ───────────────────────────

  ns.ContractReview = {
    init: init,
    analyzeContract: analyzeContract,
    CLAUSE_RULES: CLAUSE_RULES
  };
})();
