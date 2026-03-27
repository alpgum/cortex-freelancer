/**
 * AI-Powered Client Red Flag Analyzer v1.0
 * Sends job posting / client message to AI for deep contextual analysis.
 * Returns structured risk assessment with flags, score, negotiation points.
 *
 * Dependencies: /api/chat.js endpoint
 * Exposed as: window.CortexRedFlagAnalyzer
 */
;(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var API_PATH = '/api/chat';
  var STORAGE_KEY = 'cortex_redflag_history';
  var MAX_HISTORY = 50;

  // ─── System prompt for AI analysis ────────────────────────────────
  var SYSTEM_CONTEXT = [
    'You are a freelancer risk-assessment expert. The user will paste a job posting or client message.',
    'Analyze it and return ONLY valid JSON (no markdown, no code fences) with this exact structure:',
    '{',
    '  "riskScore": <number 0-100, higher = more risky>,',
    '  "verdict": "<Safe|Mild Caution|Caution|High Caution|Avoid>",',
    '  "flags": [',
    '    {',
    '      "id": "<snake_case_id>",',
    '      "title": "<short title>",',
    '      "severity": "<high|medium|low>",',
    '      "explanation": "<1-2 sentence explanation of why this is a red flag>",',
    '      "quote": "<exact phrase from the text that triggered this flag, or null>"',
    '    }',
    '  ],',
    '  "negotiationPoints": ["<actionable suggestion 1>", "..."],',
    '  "walkAway": <boolean — true if you recommend declining>,',
    '  "walkAwayReason": "<reason if walkAway is true, else null>",',
    '  "positives": ["<any green flags or positive signals>"],',
    '  "summary": "<2-3 sentence overall assessment>"',
    '}',
    '',
    'Red flag categories to check:',
    '- Unrealistic timeline or deadlines',
    '- Below-market budget for the described scope',
    '- Spec work or free sample requests',
    '- "Quick simple job" language masking complex scope',
    '- No clear deliverables or vague requirements',
    '- Payment terms issues (no escrow, delayed payment, equity-only)',
    '- Scope creep signals (open-ended tasks, "and more")',
    '- Excessive skill requirements for one person',
    '- Pressure tactics or manipulation language',
    '- Client history red flags (fired previous freelancers, bad reviews mentioned)',
    '- Unprofessional or disrespectful tone',
    '- NDA/IP red flags (work-for-hire without fair compensation)',
    '- Unlimited revisions or availability expectations',
    '- Contest/competition-style hiring',
    '',
    'Also look for positive signals: clear scope, reasonable budget, respectful tone, milestone payments mentioned, etc.',
    'Be calibrated — not everything is a red flag. A short posting is not automatically bad. Focus on genuine risks.'
  ].join('\n');

  // ─── State ────────────────────────────────────────────────────────
  var _busy = false;
  var _lastResult = null;
  var _onUpdate = null;

  // ─── Persistence ──────────────────────────────────────────────────
  function _getHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function _saveToHistory(input, result) {
    try {
      var history = _getHistory();
      history.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        inputPreview: input.slice(0, 120),
        riskScore: result.riskScore,
        verdict: result.verdict,
        flagCount: (result.flags || []).length,
        walkAway: result.walkAway
      });
      if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (e) { /* storage full — ignore */ }
  }

  // ─── API call ─────────────────────────────────────────────────────
  function analyze(text, opts) {
    if (_busy) {
      return Promise.reject(new Error('Analysis already in progress'));
    }
    if (!text || text.trim().length < 20) {
      return Promise.reject(new Error('Text must be at least 20 characters'));
    }

    opts = opts || {};
    _busy = true;
    if (_onUpdate) _onUpdate({ state: 'loading' });

    var prompt = SYSTEM_CONTEXT + '\n\n---\n\nAnalyze this text:\n\n' + text.trim();

    return fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        sessionId: 'redflag-' + Date.now()
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API error: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var reply = data.reply || data.message || '';
      var parsed = _parseAIResponse(reply);

      // Validate and normalize
      parsed.riskScore = Math.max(0, Math.min(100, parseInt(parsed.riskScore) || 50));
      parsed.flags = (parsed.flags || []).map(_normalizeFlag);
      parsed.negotiationPoints = parsed.negotiationPoints || [];
      parsed.positives = parsed.positives || [];
      parsed.walkAway = !!parsed.walkAway;
      parsed.verdict = parsed.verdict || _scoreToVerdict(parsed.riskScore);
      parsed.summary = parsed.summary || 'Analysis complete.';
      parsed._raw = reply;
      parsed._timestamp = new Date().toISOString();

      _lastResult = parsed;
      _busy = false;
      _saveToHistory(text, parsed);
      if (_onUpdate) _onUpdate({ state: 'done', result: parsed });
      return parsed;
    })
    .catch(function (err) {
      _busy = false;
      if (_onUpdate) _onUpdate({ state: 'error', error: err.message });
      throw err;
    });
  }

  // ─── Parse AI response ────────────────────────────────────────────
  function _parseAIResponse(text) {
    // Try direct JSON parse
    try { return JSON.parse(text); } catch (e) { /* continue */ }

    // Strip markdown code fences
    var cleaned = text.replace(/```json?\s*/gi, '').replace(/```\s*/g, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { /* continue */ }

    // Extract first JSON object
    var match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e) { /* continue */ }
    }

    // Fallback: construct from raw text
    return {
      riskScore: 50,
      verdict: 'Caution',
      flags: [],
      negotiationPoints: [],
      walkAway: false,
      positives: [],
      summary: text.slice(0, 500)
    };
  }

  function _normalizeFlag(flag) {
    return {
      id: flag.id || 'unknown',
      title: flag.title || 'Unknown Flag',
      severity: (['high', 'medium', 'low'].indexOf(flag.severity) !== -1) ? flag.severity : 'medium',
      explanation: flag.explanation || '',
      quote: flag.quote || null
    };
  }

  function _scoreToVerdict(score) {
    if (score >= 80) return 'Avoid';
    if (score >= 60) return 'High Caution';
    if (score >= 40) return 'Caution';
    if (score >= 20) return 'Mild Caution';
    return 'Safe';
  }

  // ─── Render ───────────────────────────────────────────────────────
  var SEVERITY_ICONS = {
    high: '&#128680;',   // 🚨
    medium: '&#9888;&#65039;', // ⚠️
    low: '&#128161;'     // 💡
  };

  var SEVERITY_COLORS = {
    high: 'var(--red, #ff4466)',
    medium: 'var(--yellow, #f0a030)',
    low: 'var(--text2, #b0b0b0)'
  };

  var VERDICT_COLORS = {
    'Avoid': 'var(--red, #ff4466)',
    'High Caution': 'var(--red, #ff4466)',
    'Caution': 'var(--yellow, #f0a030)',
    'Mild Caution': 'var(--yellow, #f0a030)',
    'Safe': 'var(--green, #00ff88)'
  };

  function render(containerId, result) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el || !result) return;

    var r = result;
    var verdictColor = VERDICT_COLORS[r.verdict] || 'var(--text)';
    var circumference = 2 * Math.PI * 58;
    // Invert score for "safety" display (100 - riskScore)
    var safetyScore = Math.max(0, 100 - r.riskScore);
    var offset = circumference - (safetyScore / 100) * circumference;

    var html = '';

    // ── Verdict Card ──
    html += '<div class="ai-verdict-card" style="text-align:center;padding:2rem 1.5rem;background:var(--bg2,#111118);border-radius:var(--radius,16px);margin-bottom:1.5rem">';
    html += '<div style="color:var(--text2,#b0b0b0);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:1rem">AI Safety Score</div>';
    html += '<div style="position:relative;display:inline-block;width:140px;height:140px">';
    html += '<svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>';
    html += '<circle cx="70" cy="70" r="58" fill="none" stroke="' + verdictColor + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset .8s ease"/>';
    html += '</svg>';
    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2.2rem;font-weight:800;color:' + verdictColor + '">' + safetyScore + '</div>';
    html += '</div>';
    html += '<div style="font-size:1.3rem;font-weight:800;color:' + verdictColor + ';margin-top:.75rem">' + _esc(r.verdict) + '</div>';
    html += '<div style="color:var(--text2,#b0b0b0);font-size:.88rem;max-width:440px;margin:.5rem auto 0;line-height:1.5">' + _esc(r.summary) + '</div>';

    // Walk away badge
    if (r.walkAway) {
      html += '<div style="margin-top:1rem;display:inline-block;background:rgba(255,68,102,.12);border:1px solid rgba(255,68,102,.3);color:var(--red,#ff4466);padding:.5rem 1.25rem;border-radius:10px;font-size:.85rem;font-weight:700">';
      html += '&#128683; Recommendation: Walk Away';
      if (r.walkAwayReason) html += '<div style="font-weight:400;margin-top:.25rem;font-size:.8rem;opacity:.85">' + _esc(r.walkAwayReason) + '</div>';
      html += '</div>';
    }
    html += '</div>';

    // ── Flags Grid ──
    if (r.flags.length > 0) {
      html += '<div style="display:grid;grid-template-columns:1fr;gap:.75rem;margin-bottom:1.5rem">';
      for (var i = 0; i < r.flags.length; i++) {
        var f = r.flags[i];
        var sc = SEVERITY_COLORS[f.severity] || SEVERITY_COLORS.medium;
        html += '<div style="background:var(--bg2,#111118);border:1px solid rgba(255,255,255,.06);border-left:3px solid ' + sc + ';border-radius:var(--radius-sm,10px);padding:1rem 1.25rem">';
        html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">';
        html += '<span style="font-size:1.1rem">' + (SEVERITY_ICONS[f.severity] || '') + '</span>';
        html += '<span style="color:var(--text,#f0f0f0);font-weight:700;font-size:.92rem">' + _esc(f.title) + '</span>';
        html += '<span style="background:' + sc + '18;color:' + sc + ';font-size:.65rem;font-weight:700;padding:2px 8px;border-radius:6px;text-transform:uppercase;margin-left:auto">' + f.severity + '</span>';
        html += '</div>';
        html += '<div style="color:var(--text2,#b0b0b0);font-size:.82rem;line-height:1.55">' + _esc(f.explanation) + '</div>';
        if (f.quote) {
          html += '<div style="margin-top:.5rem;padding:.4rem .75rem;background:rgba(255,255,255,.03);border-left:2px solid rgba(255,255,255,.1);border-radius:4px;font-size:.78rem;color:var(--text3,#666);font-style:italic">"' + _esc(f.quote) + '"</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += '<div style="text-align:center;padding:2rem;background:rgba(0,255,136,.06);border:1px solid rgba(0,255,136,.15);border-radius:var(--radius,16px);margin-bottom:1.5rem">';
      html += '<div style="font-size:2rem;margin-bottom:.5rem">&#9989;</div>';
      html += '<div style="color:var(--green,#00ff88);font-weight:700">No Red Flags Detected</div>';
      html += '<div style="color:var(--text2,#b0b0b0);font-size:.82rem;margin-top:.25rem">This posting looks clean. Always trust your instincts.</div>';
      html += '</div>';
    }

    // ── Positives ──
    if (r.positives && r.positives.length > 0) {
      html += '<div style="background:var(--bg2,#111118);border-radius:var(--radius,16px);padding:1.25rem 1.5rem;margin-bottom:1.5rem">';
      html += '<div style="color:var(--green,#00ff88);font-weight:700;font-size:.92rem;margin-bottom:.75rem">&#9989; Positive Signals</div>';
      for (var p = 0; p < r.positives.length; p++) {
        html += '<div style="color:var(--text2,#b0b0b0);font-size:.82rem;padding:.3rem 0;display:flex;gap:.5rem"><span style="color:var(--green,#00ff88)">&#10003;</span><span>' + _esc(r.positives[p]) + '</span></div>';
      }
      html += '</div>';
    }

    // ── Negotiation Points ──
    if (r.negotiationPoints && r.negotiationPoints.length > 0) {
      html += '<div style="background:var(--bg2,#111118);border-radius:var(--radius,16px);padding:1.25rem 1.5rem;margin-bottom:1.5rem">';
      html += '<div style="color:var(--orange,#ff8844);font-weight:700;font-size:.92rem;margin-bottom:.75rem">&#128172; Negotiation Points</div>';
      for (var n = 0; n < r.negotiationPoints.length; n++) {
        html += '<div style="color:var(--text2,#b0b0b0);font-size:.82rem;padding:.35rem 0;display:flex;gap:.5rem;align-items:flex-start"><span style="color:var(--orange,#ff8844);font-size:.7rem;margin-top:2px">&#9654;</span><span>' + _esc(r.negotiationPoints[n]) + '</span></div>';
      }
      html += '</div>';
    }

    // ── Export button ──
    html += '<div style="text-align:center;margin-top:1rem">';
    html += '<button id="aiCopyBtn" onclick="CortexRedFlagAnalyzer.copyResult()" style="background:var(--bg3,#1a1a24);color:var(--text2,#b0b0b0);border:1px solid rgba(255,255,255,.1);padding:.6rem 1.5rem;border-radius:10px;font-size:.82rem;cursor:pointer;transition:all .2s">&#128203; Copy Analysis</button>';
    html += '</div>';

    el.innerHTML = html;
  }

  // ─── Copy to clipboard ────────────────────────────────────────────
  function copyResult() {
    if (!_lastResult) return;
    var r = _lastResult;
    var lines = ['CLIENT RED FLAG ANALYSIS (AI)', '='.repeat(35), ''];
    lines.push('Safety Score: ' + (100 - r.riskScore) + '/100');
    lines.push('Verdict: ' + r.verdict);
    if (r.walkAway) lines.push('RECOMMENDATION: WALK AWAY — ' + (r.walkAwayReason || ''));
    lines.push('');
    lines.push(r.summary);
    lines.push('');

    if (r.flags.length > 0) {
      lines.push('RED FLAGS', '-'.repeat(35));
      r.flags.forEach(function (f) {
        lines.push('');
        lines.push('[' + f.severity.toUpperCase() + '] ' + f.title);
        lines.push(f.explanation);
        if (f.quote) lines.push('  > "' + f.quote + '"');
      });
      lines.push('');
    }

    if (r.positives.length > 0) {
      lines.push('POSITIVE SIGNALS', '-'.repeat(35));
      r.positives.forEach(function (p) { lines.push('+ ' + p); });
      lines.push('');
    }

    if (r.negotiationPoints.length > 0) {
      lines.push('NEGOTIATION POINTS', '-'.repeat(35));
      r.negotiationPoints.forEach(function (n) { lines.push('> ' + n); });
      lines.push('');
    }

    lines.push('Generated by Cortex Freelancer AI — cortexfreelancer.com');

    navigator.clipboard.writeText(lines.join('\n')).then(function () {
      var btn = document.getElementById('aiCopyBtn');
      if (btn) {
        btn.innerHTML = '&#10003; Copied!';
        btn.style.borderColor = 'var(--green,#00ff88)';
        btn.style.color = 'var(--green,#00ff88)';
        setTimeout(function () {
          btn.innerHTML = '&#128203; Copy Analysis';
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 2000);
      }
    });
  }

  // ─── Utility ──────────────────────────────────────────────────────
  function _esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function isBusy() { return _busy; }
  function getLastResult() { return _lastResult; }
  function getHistory() { return _getHistory(); }
  function clearHistory() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function onUpdate(fn) { _onUpdate = typeof fn === 'function' ? fn : null; }

  // ─── Public API ───────────────────────────────────────────────────
  root.CortexRedFlagAnalyzer = {
    analyze: analyze,
    render: render,
    copyResult: copyResult,
    isBusy: isBusy,
    getLastResult: getLastResult,
    getHistory: getHistory,
    clearHistory: clearHistory,
    onUpdate: onUpdate,
    version: VERSION
  };

})(typeof globalThis !== 'undefined' ? globalThis : this);
