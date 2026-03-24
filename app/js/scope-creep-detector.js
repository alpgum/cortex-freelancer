/**
 * [CF-142] Enhanced Scope Creep Detector
 * Sophisticated AI-powered scope creep analysis with risk scoring,
 * categorized signals, tone escalation detection, and pushback email generation.
 * Enhances the existing detectScopeCreep() in scope-analyzer.html.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_scope_creep_history';

  /* ══════════════════════════════════════════════
   * CATEGORIZED SIGNALS
   * ══════════════════════════════════════════════ */
  var CATEGORIZED_SIGNALS = {
    boundary: [
      { pattern: /can you (also|just|quickly|additionally)\b/i, label: 'Casual scope addition', weight: 12, tip: 'Client is casually expanding the project boundaries.' },
      { pattern: /while you.re at it/i, label: '"While you\'re at it" addition', weight: 14, tip: 'Piggybacking new work onto existing tasks.' },
      { pattern: /can we (add|include|throw in|sneak in)/i, label: 'Mid-project scope addition', weight: 13, tip: 'Direct request to add features beyond the original agreement.' },
      { pattern: /one more (thing|small thing|quick thing)/i, label: 'Incremental scope addition', weight: 10, tip: 'Death by a thousand cuts — small additions compound.' },
      { pattern: /i know (it.s|this is) (not|outside) (the|our) scope/i, label: 'Acknowledged out-of-scope request', weight: 11, tip: 'Client knows it is out of scope but asks anyway.' },
      { pattern: /oh and\b/i, label: 'Casual add-on ("oh and...")', weight: 8, tip: 'Slipping in extra work conversationally.' },
      { pattern: /also,?\s+(could|can|would) you/i, label: 'Additional request stacking', weight: 10, tip: 'Stacking multiple new requests in one message.' },
      { pattern: /since you(.|.re) already (working|doing|building|making)/i, label: 'Leveraging existing work for extras', weight: 12, tip: 'Using proximity to current work to justify additions.' },
      { pattern: /it would be (great|nice|cool|awesome) if/i, label: 'Feature wish disguised as suggestion', weight: 7, tip: 'A new feature request phrased as a casual wish.' },
    ],
    timeline: [
      { pattern: /i (need|want) (this|it) (by|before) (tomorrow|tonight|end of day|eod|asap)/i, label: 'Unrealistic deadline', weight: 15, tip: 'Compressed timeline that does not match the work involved.' },
      { pattern: /when.*free|spare time|get a chance|whenever you can/i, label: 'Unpaid work request', weight: 10, tip: 'Implying work should happen during downtime (unpaid).' },
      { pattern: /rush|urgent|emergency|asap|right away|immediately/i, label: 'Urgency pressure', weight: 13, tip: 'Creating artificial urgency to bypass process.' },
      { pattern: /can (this|it|we) be done (today|this week|faster|sooner)/i, label: 'Timeline compression', weight: 12, tip: 'Pushing for faster delivery without adjusting scope.' },
      { pattern: /i promised (the|my) (client|boss|stakeholder|team)/i, label: 'Externalized deadline pressure', weight: 11, tip: 'Using a third party deadline to create urgency.' },
      { pattern: /we.re (behind|running late|delayed)/i, label: 'Blame-shift for delays', weight: 9, tip: 'Implying you should absorb timeline issues.' },
    ],
    budget: [
      { pattern: /we (don.t|didn.t) (discuss|agree|talk about).*budget|budget.*later/i, label: 'Avoiding budget discussion', weight: 14, tip: 'Sidestepping cost conversations for added work.' },
      { pattern: /should(n.t)?\s+(be|take)\s+(quick|easy|simple|fast|straightforward)/i, label: 'Minimizing complexity', weight: 13, tip: 'Downplaying effort to avoid paying fair price.' },
      { pattern: /just\s+(a\s+)?(small|tiny|little|minor)\s+(change|tweak|update|fix|adjustment)/i, label: 'Minimizing change size', weight: 11, tip: 'Framing significant work as trivial to avoid extra cost.' },
      { pattern: /for free|no extra (cost|charge)|included|complimentary|thrown in/i, label: 'Expecting free work', weight: 15, tip: 'Explicitly expecting work at no additional cost.' },
      { pattern: /we(.|.ll) (pay|compensate|cover).*later|next (project|phase|time)/i, label: 'Deferred payment promise', weight: 12, tip: 'Promising future payment for current extra work.' },
      { pattern: /i (thought|assumed|figured|expected)\s+(it|this|that)\s+(would|should|could)\s+(include|have|cover|be included)/i, label: 'Assumed inclusion', weight: 13, tip: 'Claiming features were implicitly part of the agreement.' },
    ],
    effort: [
      { pattern: /it.s (not|doesn.t)\s+(what|look|work)\s*(like)?\s*(i|we)\s*(wanted|expected|imagined|envisioned)/i, label: 'Moving goalposts', weight: 14, tip: 'Changing acceptance criteria after delivery.' },
      { pattern: /actually,?\s*(i|we)\s*(changed|want to change|decided|need to change)/i, label: 'Changing requirements', weight: 11, tip: 'Modifying requirements mid-project without formal change order.' },
      { pattern: /completely (redo|redesign|rethink|rework|rebuild|start over)/i, label: 'Complete rework request', weight: 16, tip: 'Requesting a full redo disguised as a revision.' },
      { pattern: /more (revisions?|iterations?|rounds?|versions?|options?)/i, label: 'Excessive revision requests', weight: 10, tip: 'Pushing past agreed revision limits.' },
      { pattern: /not (quite|exactly) what (i|we) (had in mind|wanted|envisioned|expected)/i, label: 'Vague rejection', weight: 12, tip: 'Rejecting work without clear, actionable feedback.' },
      { pattern: /can you (try|do) (a few|several|multiple|different) (versions?|options?|approaches?)/i, label: 'Spec work / multiple options', weight: 11, tip: 'Requesting multiple options is multiplicative effort.' },
    ],
    role: [
      { pattern: /can you (do|handle|take care of|manage)\s+(the|this|our)\s+(social|marketing|seo|content|blog|hosting|maintenance)/i, label: 'Role expansion', weight: 14, tip: 'Being asked to take on responsibilities outside your contracted role.' },
      { pattern: /my (boss|manager|partner|colleague|team) (wants|needs|asked|suggested)/i, label: 'Third-party scope changes', weight: 10, tip: 'New stakeholders introducing requirements not in original brief.' },
      { pattern: /you.re (the|an?) (expert|professional|developer|designer)/i, label: 'Flattery-based scope push', weight: 8, tip: 'Using flattery to justify giving you more (unpaid) work.' },
      { pattern: /just (figure|work) (it )?out/i, label: 'Ambiguous delegation', weight: 9, tip: 'Delegating undefined work without clear requirements.' },
      { pattern: /can you (also )?(train|teach|mentor|show|walk|onboard)/i, label: 'Training/knowledge transfer request', weight: 10, tip: 'Training requests that are not part of the deliverables.' },
    ],
  };

  /* ══════════════════════════════════════════════
   * TONE ESCALATION DETECTION
   * ══════════════════════════════════════════════ */
  var TONE_MARKERS = {
    urgency: { patterns: [/!{2,}/g, /ASAP/g, /urgent/gi, /immediately/gi, /right now/gi, /right away/gi], weight: 3 },
    frustration: { patterns: [/still (waiting|haven.t|not done)/gi, /what.s (taking|the holdup)/gi, /come on/gi, /seriously\??/gi], weight: 4 },
    manipulation: { patterns: [/i.ll (leave|post|write) a (bad |negative )?(review|feedback)/gi, /other freelancers (would|can|could)/gi, /i (know|have) (other|many|plenty of) (options|freelancers|developers)/gi], weight: 5 },
    pressure: { patterns: [/everyone else (does|can|would)/gi, /it.s (standard|normal|common|expected)/gi, /you should (be able|know how)/gi], weight: 3 },
    passive_aggressive: { patterns: [/i guess/gi, /fine,? (i.ll|we.ll)/gi, /if you (can.t|won.t|don.t want to)/gi, /never ?mind/gi], weight: 3 },
  };

  /* ══════════════════════════════════════════════
   * ADDITION FREQUENCY DETECTION
   * ══════════════════════════════════════════════ */
  var ADDITION_PHRASES = [
    /also\b/gi, /another\b/gi, /additionally/gi, /on top of that/gi,
    /plus\b/gi, /and (?:also|then|maybe)\b/gi, /oh and\b/gi,
    /one more/gi, /as well\b/gi, /in addition/gi, /furthermore/gi,
  ];

  /* ══════════════════════════════════════════════
   * RISK SCORE CALCULATION
   * ══════════════════════════════════════════════ */
  function analyzeText(text) {
    if (!text || !text.trim()) return null;
    text = text.trim();

    var results = {
      signals: [],
      toneFlags: [],
      additionFrequency: 0,
      riskScore: 0,
      riskLevel: 'low',
      categories: {},
      totalWeight: 0,
    };

    // 1. Detect categorized signals
    var categoryNames = Object.keys(CATEGORIZED_SIGNALS);
    categoryNames.forEach(function (cat) {
      results.categories[cat] = [];
      CATEGORIZED_SIGNALS[cat].forEach(function (sig) {
        if (sig.pattern.test(text)) {
          var entry = { label: sig.label, weight: sig.weight, category: cat, tip: sig.tip };
          results.signals.push(entry);
          results.categories[cat].push(entry);
          results.totalWeight += sig.weight;
        }
      });
    });

    // 2. Detect tone escalation
    var toneKeys = Object.keys(TONE_MARKERS);
    toneKeys.forEach(function (tone) {
      var marker = TONE_MARKERS[tone];
      var matchCount = 0;
      marker.patterns.forEach(function (p) {
        var m = text.match(p);
        if (m) matchCount += m.length;
      });
      if (matchCount > 0) {
        results.toneFlags.push({ type: tone, count: matchCount, weight: marker.weight });
        results.totalWeight += matchCount * marker.weight;
      }
    });

    // 3. Detect frequency of additions
    ADDITION_PHRASES.forEach(function (p) {
      var m = text.match(p);
      if (m) results.additionFrequency += m.length;
    });
    if (results.additionFrequency >= 3) {
      results.totalWeight += results.additionFrequency * 2;
    }

    // 4. Sentence-level analysis — long messages with many requests
    var sentences = text.split(/[.!?\n]+/).filter(function (s) { return s.trim().length > 5; });
    var questionCount = (text.match(/\?/g) || []).length;
    if (questionCount >= 3) {
      results.totalWeight += 5;
    }

    // 5. Calculate risk score (0-100)
    var rawScore = results.totalWeight;
    // Sigmoid-style normalization to keep 0-100
    results.riskScore = Math.min(100, Math.round((rawScore / (rawScore + 30)) * 100));

    if (results.riskScore >= 70) {
      results.riskLevel = 'critical';
    } else if (results.riskScore >= 45) {
      results.riskLevel = 'high';
    } else if (results.riskScore >= 25) {
      results.riskLevel = 'medium';
    } else {
      results.riskLevel = 'low';
    }

    return results;
  }

  /* ══════════════════════════════════════════════
   * PUSHBACK EMAIL GENERATOR
   * ══════════════════════════════════════════════ */
  function generatePushbackEmail(analysis, clientName) {
    var name = clientName || 'Client';
    var signalsByCategory = analysis.categories;
    var parts = [];

    parts.push('Hi ' + name + ',');
    parts.push('');
    parts.push('Thank you for your message. I appreciate your enthusiasm for the project and the ideas you have shared.');
    parts.push('');

    // Summarize what was detected
    var catNames = Object.keys(signalsByCategory);
    var activeCats = catNames.filter(function (c) { return signalsByCategory[c].length > 0; });

    if (activeCats.length > 0) {
      parts.push('After reviewing your recent requests, I wanted to flag a few items that fall outside our current project scope:');
      parts.push('');

      activeCats.forEach(function (cat) {
        var items = signalsByCategory[cat];
        var categoryLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
        items.forEach(function (item) {
          parts.push('  - ' + item.label);
        });
      });

      parts.push('');
    }

    // Boundary-related additions
    if (signalsByCategory.boundary && signalsByCategory.boundary.length > 0) {
      parts.push('I am happy to accommodate additional features and changes. To keep the project on track and maintain quality, I suggest we handle these as a formal change order. This way we can agree on the additional timeline, deliverables, and cost before I begin work.');
      parts.push('');
    }

    // Timeline concerns
    if (signalsByCategory.timeline && signalsByCategory.timeline.length > 0) {
      parts.push('Regarding the timeline: the current scope and deadline were agreed upon based on the original requirements. Adding new items without adjusting the timeline could compromise quality. I would recommend either extending the deadline or prioritizing which items are most critical for the initial delivery.');
      parts.push('');
    }

    // Budget concerns
    if (signalsByCategory.budget && signalsByCategory.budget.length > 0) {
      parts.push('I want to be transparent about costs. Each additional item requires development time and testing. I will prepare a detailed estimate for the new requests so we can discuss budget before proceeding.');
      parts.push('');
    }

    // Role expansion
    if (signalsByCategory.role && signalsByCategory.role.length > 0) {
      parts.push('Some of the requested tasks fall outside my current role on this project. I can either scope these as a separate engagement or recommend a specialist who can handle them. Let me know which approach you prefer.');
      parts.push('');
    }

    // Effort / rework
    if (signalsByCategory.effort && signalsByCategory.effort.length > 0) {
      parts.push('For the requested changes to existing deliverables: I want to make sure we are aligned on the final vision. Could we schedule a brief call to review the current state against the original brief? If revisions beyond our agreed scope are needed, I will outline exactly what is involved so we can plan accordingly.');
      parts.push('');
    }

    parts.push('I have attached a summary of the original scope for reference. Shall I draft a change order for the additional items?');
    parts.push('');
    parts.push('Best regards');

    return parts.join('\n');
  }

  /* ══════════════════════════════════════════════
   * HISTORY PERSISTENCE
   * ══════════════════════════════════════════════ */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }

  function saveToHistory(text, analysis) {
    var history = loadHistory();
    history.unshift({
      timestamp: new Date().toISOString(),
      textPreview: text.substring(0, 120),
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      signalCount: analysis.signals.length,
    });
    // keep last 50 entries
    if (history.length > 50) history = history.slice(0, 50);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * UI RENDERING
   * ══════════════════════════════════════════════ */
  var CATEGORY_ICONS = {
    boundary: '&#128679;',  // construction
    timeline: '&#9200;',     // alarm clock
    budget: '&#128176;',     // money bag
    effort: '&#128295;',     // wrench
    role: '&#128101;',       // busts in silhouette
  };

  var CATEGORY_COLORS = {
    boundary: 'var(--orange)',
    timeline: 'var(--red)',
    budget: 'var(--green)',
    effort: '#ffc800',
    role: '#aa88ff',
  };

  function renderEnhancedResults(analysis, text) {
    var container = document.getElementById('creep-results');
    if (!container) return;

    if (!analysis || analysis.signals.length === 0 && analysis.toneFlags.length === 0) {
      container.innerHTML = '<div style="background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:var(--radius);padding:1.5rem;text-align:center;margin-top:.5rem">' +
        '<div style="font-size:1.5rem;margin-bottom:.5rem">&#9989;</div>' +
        '<div style="color:var(--green);font-weight:700;font-size:.95rem">No Scope Creep Detected</div>' +
        '<div style="color:var(--text2);font-size:.82rem;margin-top:.35rem">This message appears safe. No boundary-pushing signals found.</div>' +
        '</div>';
      return;
    }

    var riskColor = analysis.riskLevel === 'critical' ? 'var(--red)' :
                    analysis.riskLevel === 'high' ? '#ff6622' :
                    analysis.riskLevel === 'medium' ? '#ffc800' : 'var(--green)';
    var riskEmoji = analysis.riskLevel === 'critical' ? '&#128680;' :
                    analysis.riskLevel === 'high' ? '&#9888;&#65039;' :
                    analysis.riskLevel === 'medium' ? '&#128161;' : '&#9989;';

    var html = '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius);padding:1.5rem;margin-top:.5rem">';

    // Risk score header
    html += '<div style="display:flex;align-items:center;gap:1.25rem;margin-bottom:1.5rem;flex-wrap:wrap">';
    // Score circle
    html += '<div style="position:relative;width:80px;height:80px;flex-shrink:0">';
    html += '<svg viewBox="0 0 36 36" style="width:80px;height:80px;transform:rotate(-90deg)">';
    html += '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bg3)" stroke-width="3"/>';
    html += '<path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="' + riskColor + '" stroke-width="3" stroke-dasharray="' + analysis.riskScore + ', 100" stroke-linecap="round"/>';
    html += '</svg>';
    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.2rem;font-weight:800;color:' + riskColor + '">' + analysis.riskScore + '</div>';
    html += '</div>';
    // Score labels
    html += '<div style="flex:1;min-width:180px">';
    html += '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.25rem"><span style="font-size:1.1rem">' + riskEmoji + '</span><span style="font-size:1.1rem;font-weight:800;color:' + riskColor + '">' + analysis.riskLevel.charAt(0).toUpperCase() + analysis.riskLevel.slice(1) + ' Risk</span></div>';
    html += '<div style="font-size:.82rem;color:var(--text2)">' + analysis.signals.length + ' scope creep signal' + (analysis.signals.length !== 1 ? 's' : '') + ' detected</div>';
    if (analysis.toneFlags.length > 0) {
      html += '<div style="font-size:.78rem;color:var(--text3);margin-top:.15rem">' + analysis.toneFlags.length + ' tone concern' + (analysis.toneFlags.length !== 1 ? 's' : '') + ' identified</div>';
    }
    if (analysis.additionFrequency >= 3) {
      html += '<div style="font-size:.78rem;color:#ffc800;margin-top:.15rem">High frequency of additions (' + analysis.additionFrequency + ' stacking phrases)</div>';
    }
    html += '</div></div>';

    // Category breakdown
    var categoryNames = Object.keys(analysis.categories);
    var activeCats = categoryNames.filter(function (c) { return analysis.categories[c].length > 0; });

    if (activeCats.length > 0) {
      html += '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1.25rem">';
      activeCats.forEach(function (cat) {
        var count = analysis.categories[cat].length;
        var color = CATEGORY_COLORS[cat] || 'var(--text2)';
        var icon = CATEGORY_ICONS[cat] || '';
        html += '<span style="display:inline-flex;align-items:center;gap:.35rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);padding:.35rem .75rem;border-radius:100px;font-size:.75rem;font-weight:600;color:' + color + '">' + icon + ' ' + cat.charAt(0).toUpperCase() + cat.slice(1) + ' (' + count + ')</span>';
      });
      html += '</div>';
    }

    // Individual signals by category
    activeCats.forEach(function (cat) {
      var items = analysis.categories[cat];
      var color = CATEGORY_COLORS[cat] || 'var(--text2)';
      var icon = CATEGORY_ICONS[cat] || '';

      html += '<div style="margin-bottom:1rem">';
      html += '<div style="font-size:.72rem;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem;display:flex;align-items:center;gap:.4rem">' + icon + ' ' + cat.charAt(0).toUpperCase() + cat.slice(1) + ' Signals</div>';

      items.forEach(function (item) {
        var barWidth = Math.min(100, Math.round((item.weight / 16) * 100));
        html += '<div style="background:var(--bg3);border:1px solid rgba(255,255,255,.04);border-radius:var(--radius-sm);padding:.85rem 1rem;margin-bottom:.5rem;border-left:3px solid ' + color + '">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.4rem">';
        html += '<span style="font-size:.88rem;font-weight:600;color:var(--text)">' + item.label + '</span>';
        html += '<span style="font-size:.68rem;font-weight:700;color:' + color + ';white-space:nowrap">Weight: ' + item.weight + '</span>';
        html += '</div>';
        html += '<div style="font-size:.78rem;color:var(--text2);line-height:1.5">' + item.tip + '</div>';
        html += '<div style="margin-top:.5rem;background:var(--bg2);border-radius:100px;height:4px;overflow:hidden"><div style="height:100%;width:' + barWidth + '%;background:' + color + ';border-radius:100px"></div></div>';
        html += '</div>';
      });
      html += '</div>';
    });

    // Tone flags section
    if (analysis.toneFlags.length > 0) {
      html += '<div style="margin-bottom:1rem">';
      html += '<div style="font-size:.72rem;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem">&#127912; Tone Concerns</div>';
      analysis.toneFlags.forEach(function (tf) {
        var toneLabel = tf.type.replace(/_/g, ' ');
        toneLabel = toneLabel.charAt(0).toUpperCase() + toneLabel.slice(1);
        html += '<div style="background:rgba(255,68,102,.06);border:1px solid rgba(255,68,102,.12);border-radius:var(--radius-sm);padding:.65rem 1rem;margin-bottom:.4rem;display:flex;align-items:center;justify-content:space-between">';
        html += '<span style="font-size:.85rem;font-weight:600">' + toneLabel + '</span>';
        html += '<span style="font-size:.72rem;color:var(--text3)">' + tf.count + ' instance' + (tf.count !== 1 ? 's' : '') + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Generate Pushback Email button
    html += '<div style="border-top:1px solid rgba(255,255,255,.06);padding-top:1.25rem;margin-top:.5rem">';
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:1px;margin-bottom:.75rem">&#9993; Generate Pushback Email</div>';
    html += '<div style="display:flex;gap:.75rem;align-items:center;flex-wrap:wrap;margin-bottom:.75rem">';
    html += '<input type="text" id="creep-client-name" placeholder="Client name (optional)" style="flex:1;min-width:160px;background:var(--bg3);border:1px solid rgba(255,255,255,.08);border-radius:var(--radius-sm);padding:.6rem .85rem;color:var(--text);font-size:.85rem;font-family:inherit;outline:none">';
    html += '<button id="creep-generate-email-btn" style="display:inline-flex;align-items:center;gap:.5rem;padding:.65rem 1.25rem;border-radius:100px;font-size:.85rem;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,var(--orange),var(--orange2));color:#000;transition:all .2s;white-space:nowrap">Generate Email</button>';
    html += '</div>';
    html += '<div id="creep-email-output" style="display:none"></div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    // Bind email generation
    var emailBtn = document.getElementById('creep-generate-email-btn');
    if (emailBtn) {
      emailBtn.addEventListener('click', function () {
        var clientName = (document.getElementById('creep-client-name') || {}).value || '';
        var email = generatePushbackEmail(analysis, clientName.trim() || null);
        var output = document.getElementById('creep-email-output');
        if (!output) return;

        output.style.display = 'block';
        output.innerHTML = '<div style="background:var(--bg3);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius-sm);padding:1rem;position:relative">' +
          '<pre style="white-space:pre-wrap;font-size:.82rem;color:var(--text2);line-height:1.7;font-family:inherit;margin:0">' + escapeHtml(email) + '</pre>' +
          '<div style="display:flex;gap:.5rem;margin-top:.75rem">' +
          '<button id="creep-copy-email" style="background:var(--bg4);border:1px solid rgba(255,255,255,.1);color:var(--text2);padding:.4rem .85rem;border-radius:100px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s">Copy Email</button>' +
          '<button id="creep-mailto-btn" style="background:var(--bg4);border:1px solid rgba(255,255,255,.1);color:var(--text2);padding:.4rem .85rem;border-radius:100px;font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s">Open in Mail Client</button>' +
          '</div></div>';

        var copyBtn = document.getElementById('creep-copy-email');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            navigator.clipboard.writeText(email).then(function () {
              copyBtn.textContent = 'Copied!';
              copyBtn.style.color = 'var(--green)';
              setTimeout(function () { copyBtn.textContent = 'Copy Email'; copyBtn.style.color = 'var(--text2)'; }, 2000);
            });
          });
        }

        var mailtoBtn = document.getElementById('creep-mailto-btn');
        if (mailtoBtn) {
          mailtoBtn.addEventListener('click', function () {
            var subject = encodeURIComponent('Re: Project Scope — Change Order Request');
            var body = encodeURIComponent(email);
            window.open('mailto:?subject=' + subject + '&body=' + body, '_blank');
          });
        }

        dataLayer.push({ event: 'tool_used', tool_name: 'scope-analyzer', action: 'generate_pushback_email' });
        output.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ══════════════════════════════════════════════
   * OVERRIDE EXISTING detectScopeCreep()
   * ══════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    // Override the global detectScopeCreep function with enhanced version
    window.detectScopeCreep = function () {
      var input = document.getElementById('creep-input');
      if (!input) return;
      var text = input.value.trim();
      if (!text) return;

      var analysis = analyzeText(text);
      if (!analysis) return;

      // Save to history
      saveToHistory(text, analysis);

      // Render enhanced results
      renderEnhancedResults(analysis, text);

      // GTM event
      window.dataLayer = window.dataLayer || [];
      dataLayer.push({
        event: 'tool_used',
        tool_name: 'scope-analyzer',
        action: 'detect_scope_creep_enhanced',
        risk_score: analysis.riskScore,
        risk_level: analysis.riskLevel,
        signal_count: analysis.signals.length,
      });
    };

    // Add history panel below the detector
    buildHistoryPanel();
  });

  /* ══════════════════════════════════════════════
   * HISTORY PANEL
   * ══════════════════════════════════════════════ */
  function buildHistoryPanel() {
    var resultsContainer = document.getElementById('creep-results');
    if (!resultsContainer) return;

    var historyWrap = document.createElement('div');
    historyWrap.id = 'creep-history-panel';
    historyWrap.style.cssText = 'margin-top:1rem;display:none';
    resultsContainer.parentNode.insertBefore(historyWrap, resultsContainer.nextSibling);

    var history = loadHistory();
    if (history.length === 0) return;

    historyWrap.style.display = 'block';
    var html = '<div style="background:var(--bg2);border:1px solid rgba(255,255,255,.06);border-radius:var(--radius);padding:1.25rem">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">';
    html += '<div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px">Recent Analyses</div>';
    html += '<button id="creep-clear-history" style="background:none;border:1px solid rgba(255,68,102,.2);color:var(--red);padding:.25rem .6rem;border-radius:100px;font-size:.68rem;font-weight:600;cursor:pointer;font-family:inherit">Clear</button>';
    html += '</div>';

    var showCount = Math.min(history.length, 5);
    for (var i = 0; i < showCount; i++) {
      var entry = history[i];
      var entryColor = entry.riskLevel === 'critical' ? 'var(--red)' :
                       entry.riskLevel === 'high' ? '#ff6622' :
                       entry.riskLevel === 'medium' ? '#ffc800' : 'var(--green)';
      var date = new Date(entry.timestamp);
      var dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      html += '<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.04)">';
      html += '<div style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.04);display:grid;place-items:center;flex-shrink:0;font-size:.75rem;font-weight:800;color:' + entryColor + '">' + entry.riskScore + '</div>';
      html += '<div style="flex:1;min-width:0"><div style="font-size:.8rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(entry.textPreview) + '</div>';
      html += '<div style="font-size:.68rem;color:var(--text3);margin-top:.1rem">' + dateStr + ' &middot; ' + entry.signalCount + ' signal' + (entry.signalCount !== 1 ? 's' : '') + '</div></div>';
      html += '</div>';
    }

    html += '</div>';
    historyWrap.innerHTML = html;

    var clearBtn = document.getElementById('creep-clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        historyWrap.style.display = 'none';
      });
    }
  }

  // Expose for testing
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ScopeCreepDetector = {
    analyze: analyzeText,
    generatePushbackEmail: generatePushbackEmail,
  };

})();
