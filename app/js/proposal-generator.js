/**
 * [CF-031] AI Proposal Generator from Job Description
 * Generate tailored proposals using job description + user profile context.
 * Multiple sections: intro, approach, timeline, pricing. Anthropic API structure.
 *
 * window.CortexFreelancer.ProposalGenerator
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY_HISTORY = 'cf_proposal_history';
  var MAX_HISTORY = 50;
  var CSS_INJECTED = false;

  var SECTION_ORDER = ['greeting', 'introduction', 'understanding', 'approach', 'timeline', 'pricing', 'closing', 'callToAction'];
  var SECTION_LABELS = {
    greeting: 'Greeting', introduction: 'Introduction', understanding: 'Understanding',
    approach: 'Approach', timeline: 'Timeline', pricing: 'Pricing',
    closing: 'Closing', callToAction: 'Call to Action'
  };

  var TONE_PRESETS = {
    professional: { label: 'Professional', instruction: 'Use formal, polished language. Be precise and confident.' },
    friendly: { label: 'Friendly', instruction: 'Be warm and personable. Use conversational tone while staying professional.' },
    confident: { label: 'Confident', instruction: 'Lead with results and bold claims. Show expertise directly.' },
    casual: { label: 'Casual', instruction: 'Be relaxed and approachable. Keep it brief and direct.' }
  };

  var _config = {
    apiKey: null,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    defaultTone: 'professional',
    userProfile: null,
    apiEndpoint: 'https://api.anthropic.com/v1/messages'
  };

  // ─── Init ─────────────────────────────────────────────────────────

  function init(config) {
    if (!config) return;
    if (config.apiKey) _config.apiKey = config.apiKey;
    if (config.model) _config.model = config.model;
    if (config.maxTokens) _config.maxTokens = config.maxTokens;
    if (config.defaultTone) _config.defaultTone = config.defaultTone;
    if (config.userProfile) _config.userProfile = config.userProfile;
    if (config.apiEndpoint) _config.apiEndpoint = config.apiEndpoint;
  }

  function setUserProfile(profile) {
    _config.userProfile = profile;
  }

  // ─── Prompt Builder ───────────────────────────────────────────────

  function buildPrompt(jobDescription, userProfile, template) {
    var profile = userProfile || _config.userProfile || {};
    var tone = (template && template.tone) || _config.defaultTone || 'professional';
    var toneInstruction = TONE_PRESETS[tone] ? TONE_PRESETS[tone].instruction : '';

    var systemPrompt = 'You are an expert freelance proposal writer. Generate a tailored proposal based on the job description and freelancer profile provided. ' +
      'Return a JSON object with these exact keys: greeting, introduction, understanding, approach, timeline, pricing, closing, callToAction. ' +
      'Each value should be a well-written paragraph (2-4 sentences). ' +
      toneInstruction;

    var userContent = 'JOB DESCRIPTION:\n' + jobDescription + '\n\n';
    if (profile.name) userContent += 'FREELANCER NAME: ' + profile.name + '\n';
    if (profile.skills && profile.skills.length) userContent += 'SKILLS: ' + profile.skills.join(', ') + '\n';
    if (profile.experience) userContent += 'EXPERIENCE: ' + profile.experience + '\n';
    if (profile.hourlyRate) userContent += 'HOURLY RATE: $' + profile.hourlyRate + '/hr\n';
    if (profile.portfolio) userContent += 'PORTFOLIO: ' + profile.portfolio + '\n';

    return {
      model: _config.model,
      max_tokens: _config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    };
  }

  // ─── Generate Proposal ────────────────────────────────────────────

  function generateProposal(jobDescription, options) {
    var opts = options || {};
    var tone = opts.tone || _config.defaultTone;
    var profile = opts.userProfile || _config.userProfile || {};

    if (_config.apiKey) {
      return _generateViaAPI(jobDescription, profile, tone);
    }
    return Promise.resolve(_generateFallback(jobDescription, profile, tone));
  }

  function _generateViaAPI(jobDescription, profile, tone) {
    var prompt = buildPrompt(jobDescription, profile, { tone: tone });

    return fetch(_config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(prompt)
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API request failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var text = data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error('Empty API response');

      try {
        var jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          var parsed = JSON.parse(jsonMatch[0]);
          parsed._meta = { source: 'ai', tone: tone, model: _config.model, generatedAt: new Date().toISOString(), jobDescriptionPreview: jobDescription.substring(0, 200) };
          return parsed;
        }
      } catch (e) { /* fallback */ }

      return _generateFallback(jobDescription, profile, tone);
    })
    .catch(function () {
      return _generateFallback(jobDescription, profile, tone);
    });
  }

  function _generateFallback(jobDescription, profile, tone) {
    var scope = estimateProjectScope(jobDescription);
    var pricing = suggestPricing(jobDescription, profile);
    var name = profile.name || 'there';
    var skills = (profile.skills || []).slice(0, 3).join(', ') || 'relevant technologies';
    var exp = profile.experience || 'several years';

    var toneAdj = tone === 'casual' ? 'Hey' : tone === 'friendly' ? 'Hi' : 'Dear';

    var proposal = {
      greeting: toneAdj + ' ' + (scope.clientName || 'Hiring Manager') + ',',
      introduction: 'I read your job posting with great interest and I\'m confident I\'m the right fit for this project. With ' + exp + ' of experience in ' + skills + ', I\'ve delivered similar work that exceeded client expectations.',
      understanding: 'From your description, I understand you need ' + (scope.summary || 'a professional solution to meet your project requirements') + '. The key deliverables I\'ve identified include: ' + (scope.deliverables.join(', ') || 'the items outlined in your posting') + '.',
      approach: 'My approach would start with a thorough requirements review, followed by an iterative development process with regular check-ins. I believe in transparent communication and delivering working results early so you can provide feedback throughout.',
      timeline: 'Based on the scope described, I estimate this project will take approximately ' + scope.estimatedHours + ' hours' + (scope.estimatedWeeks ? ' (' + scope.estimatedWeeks + ' weeks)' : '') + '. I can begin immediately and will provide a detailed timeline after our initial discussion.',
      pricing: pricing.type === 'hourly'
        ? 'My rate for this type of work is $' + pricing.suggested + '/hr (range: $' + pricing.range.low + '-$' + pricing.range.high + '/hr). Based on the estimated scope, the total investment would be approximately $' + pricing.estimatedTotal + '.'
        : 'For this project, I\'d suggest a fixed price of $' + pricing.suggested + ' (range: $' + pricing.range.low + '-$' + pricing.range.high + '). This includes all deliverables outlined above with ' + (scope.estimatedHours || 40) + ' estimated hours of work.',
      closing: 'I\'m excited about the possibility of working together on this project. My goal is to deliver exceptional results that exceed your expectations.',
      callToAction: 'Would you be available for a quick 15-minute call this week to discuss the project in more detail? I\'d love to learn more about your vision and share some ideas. Looking forward to hearing from you!'
    };

    proposal._meta = { source: 'template', tone: tone, generatedAt: new Date().toISOString(), jobDescriptionPreview: jobDescription.substring(0, 200) };
    return proposal;
  }

  // ─── Scope Estimation ─────────────────────────────────────────────

  function estimateProjectScope(jobDescription) {
    var desc = (jobDescription || '').toLowerCase();
    var deliverables = [];
    var complexity = 0;

    if (/\b(website|web\s*app|landing\s*page|frontend)\b/.test(desc)) { deliverables.push('web application/site'); complexity += 2; }
    if (/\b(api|backend|server|database)\b/.test(desc)) { deliverables.push('backend/API'); complexity += 2; }
    if (/\b(mobile|ios|android|app)\b/.test(desc)) { deliverables.push('mobile application'); complexity += 3; }
    if (/\b(design|ui|ux|mockup|wireframe)\b/.test(desc)) { deliverables.push('UI/UX design'); complexity += 1; }
    if (/\b(auth|login|register|payment|stripe)\b/.test(desc)) { deliverables.push('authentication/payments'); complexity += 2; }
    if (/\b(deploy|hosting|aws|cloud|devops)\b/.test(desc)) { deliverables.push('deployment/infrastructure'); complexity += 1; }
    if (/\b(test|qa|quality)\b/.test(desc)) { deliverables.push('testing/QA'); complexity += 1; }

    if (deliverables.length === 0) deliverables.push('project deliverables as described');

    var estimatedHours;
    if (complexity >= 8) estimatedHours = 200;
    else if (complexity >= 5) estimatedHours = 100;
    else if (complexity >= 3) estimatedHours = 60;
    else estimatedHours = 30;

    var budgetMatch = desc.match(/\$[\d,]+(?:\s*-\s*\$?[\d,]+)?/);
    var budget = budgetMatch ? budgetMatch[0] : null;

    var summary = 'a project involving ' + deliverables.slice(0, 3).join(', ');

    return {
      deliverables: deliverables, complexity: complexity, estimatedHours: estimatedHours,
      estimatedWeeks: Math.ceil(estimatedHours / 30), budget: budget, summary: summary,
      clientName: null
    };
  }

  // ─── Pricing Suggestion ───────────────────────────────────────────

  function suggestPricing(jobDescription, userProfile) {
    var profile = userProfile || _config.userProfile || {};
    var scope = estimateProjectScope(jobDescription);
    var baseRate = profile.hourlyRate || 50;
    var multiplier = 1 + (scope.complexity * 0.05);
    var adjustedRate = Math.round(baseRate * multiplier);
    var desc = (jobDescription || '').toLowerCase();

    var type = /\b(fixed[\s-]*price|fixed\s*budget|project[\s-]*based)\b/.test(desc) ? 'fixed' : 'hourly';
    var estimatedTotal = Math.round(adjustedRate * scope.estimatedHours);

    return {
      type: type,
      suggested: type === 'hourly' ? adjustedRate : estimatedTotal,
      range: type === 'hourly'
        ? { low: Math.round(adjustedRate * 0.85), high: Math.round(adjustedRate * 1.2) }
        : { low: Math.round(estimatedTotal * 0.85), high: Math.round(estimatedTotal * 1.2) },
      estimatedTotal: estimatedTotal,
      estimatedHours: scope.estimatedHours,
      baseRate: baseRate,
      complexityMultiplier: multiplier
    };
  }

  // ─── Customize & Tone ─────────────────────────────────────────────

  function customizeSection(proposal, sectionName, instructions) {
    if (!proposal || !SECTION_LABELS[sectionName]) return Promise.resolve(proposal);

    if (_config.apiKey) {
      var prompt = {
        model: _config.model,
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: 'Rewrite this proposal section based on these instructions: ' + instructions + '\n\nCurrent text:\n' + (proposal[sectionName] || '') + '\n\nReturn only the rewritten text.'
        }]
      };

      return fetch(_config.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': _config.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(prompt)
      })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var text = data.content && data.content[0] && data.content[0].text;
        if (text) proposal[sectionName] = text.trim();
        return proposal;
      })
      .catch(function () { return proposal; });
    }

    return Promise.resolve(proposal);
  }

  function adjustTone(proposal, tone) {
    if (!proposal || !TONE_PRESETS[tone]) return Promise.resolve(proposal);
    if (proposal._meta) proposal._meta.tone = tone;
    return Promise.resolve(proposal);
  }

  // ─── Variants ─────────────────────────────────────────────────────

  function generateMultipleVariants(jobDescription, count) {
    var num = Math.min(Math.max(parseInt(count, 10) || 3, 1), 5);
    var tones = Object.keys(TONE_PRESETS);
    var promises = [];
    for (var i = 0; i < num; i++) {
      promises.push(generateProposal(jobDescription, { tone: tones[i % tones.length] }));
    }
    return Promise.all(promises);
  }

  // ─── Score Proposal ───────────────────────────────────────────────

  function scoreProposal(proposal, jobDescription) {
    if (!proposal || !jobDescription) return { overall: 0, grade: 'F', sections: {}, details: {} };

    var fullText = '';
    var sectionScores = {};
    var completeness = 0;

    for (var i = 0; i < SECTION_ORDER.length; i++) {
      var key = SECTION_ORDER[i];
      var text = proposal[key] || '';
      var wc = text.trim().split(/\s+/).filter(Boolean).length;
      if (text.trim()) completeness++;
      var sectionScore = 0;
      if (wc >= 30) sectionScore = 100;
      else if (wc >= 15) sectionScore = 70;
      else if (wc >= 5) sectionScore = 40;
      else if (wc > 0) sectionScore = 20;
      sectionScores[key] = { score: sectionScore, wordCount: wc };
      fullText += text + ' ';
    }

    var completenessScore = Math.round((completeness / SECTION_ORDER.length) * 100);

    var jobKeywords = _extractKeywords(jobDescription);
    var fullLower = fullText.toLowerCase();
    var matched = [], missing = [];
    for (var j = 0; j < jobKeywords.length; j++) {
      if (fullLower.indexOf(jobKeywords[j].toLowerCase()) !== -1) matched.push(jobKeywords[j]);
      else missing.push(jobKeywords[j]);
    }
    var keywordScore = jobKeywords.length > 0 ? Math.round((matched.length / jobKeywords.length) * 100) : 50;

    var specificity = 0;
    if (/\d+/.test(fullText)) specificity += 25;
    if (/\$[\d,]+/.test(fullText)) specificity += 25;
    if (/\b(week|month|day|hour|sprint)\b/i.test(fullText)) specificity += 25;
    if (/\b(milestone|phase|deliverable|deadline)\b/i.test(fullText)) specificity += 25;

    var overall = Math.round(completenessScore * 0.25 + keywordScore * 0.30 + specificity * 0.20 + _avgScore(sectionScores) * 0.25);
    var grade;
    if (overall >= 85) grade = 'A';
    else if (overall >= 70) grade = 'B';
    else if (overall >= 55) grade = 'C';
    else if (overall >= 40) grade = 'D';
    else grade = 'F';

    return { overall: overall, grade: grade, sections: sectionScores, details: { completeness: completenessScore, keywordCoverage: keywordScore, specificity: specificity, matchedKeywords: matched, missingKeywords: missing } };
  }

  function _avgScore(scores) {
    var total = 0, count = 0;
    for (var key in scores) { if (scores.hasOwnProperty(key)) { total += scores[key].score; count++; } }
    return count > 0 ? Math.round(total / count) : 0;
  }

  function _extractKeywords(text) {
    if (!text) return [];
    var stopWords = { the: 1, a: 1, an: 1, is: 1, are: 1, was: 1, be: 1, have: 1, has: 1, do: 1, does: 1, will: 1, would: 1, could: 1, for: 1, and: 1, but: 1, or: 1, not: 1, to: 1, of: 1, in: 1, on: 1, at: 1, by: 1, with: 1, from: 1, this: 1, that: 1, you: 1, your: 1, we: 1, our: 1, i: 1, my: 1, it: 1, they: 1, as: 1, if: 1, also: 1, need: 1, looking: 1, work: 1, like: 1, get: 1, make: 1, use: 1 };
    var words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    var freq = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i].trim();
      if (w.length < 3 || stopWords[w]) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
    return Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; }).slice(0, 20);
  }

  // ─── Render: Proposal Editor ──────────────────────────────────────

  function renderProposalEditor(containerId, proposal) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;
    if (!proposal) { container.innerHTML = '<div class="pg-panel"><p style="color:#888;padding:20px;">No proposal to display.</p></div>'; return; }

    var score = scoreProposal(proposal, (proposal._meta && proposal._meta.jobDescriptionPreview) || '');

    var h = '<div class="pg-panel"><div class="pg-header">';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    h += '<h2 style="margin:0;color:#e0e0e0;font-size:18px;font-weight:700;">Proposal Editor</h2>';
    h += '<span style="background:' + _scoreColor(score.overall) + '20;color:' + _scoreColor(score.overall) + ';padding:4px 10px;border-radius:8px;font-size:13px;font-weight:700;">' + score.overall + '/100 ' + score.grade + '</span>';
    h += '</div></div>';

    for (var i = 0; i < SECTION_ORDER.length; i++) {
      var key = SECTION_ORDER[i];
      var label = SECTION_LABELS[key];
      var text = proposal[key] || '';
      h += '<div class="pg-section" data-section="' + key + '">';
      h += '<div class="pg-section-header"><span class="pg-section-label">' + label + '</span>';
      h += '<button class="pg-btn pg-btn-small pg-btn-edit" data-section="' + key + '">Edit</button></div>';
      h += '<div class="pg-section-content" data-section="' + key + '">' + _escapeHtml(text).replace(/\n/g, '<br>') + '</div>';
      h += '<textarea class="pg-section-textarea" data-section="' + key + '" style="display:none;">' + _escapeHtml(text) + '</textarea>';
      h += '</div>';
    }

    h += '<div class="pg-actions">';
    h += '<button class="pg-btn pg-btn-primary pg-btn-copy">Copy to Clipboard</button>';
    h += '<button class="pg-btn pg-btn-secondary pg-btn-save">Save to History</button>';
    h += '</div></div>';

    container.innerHTML = h;
    _bindEditorEvents(container, proposal);
  }

  function _bindEditorEvents(container, proposal) {
    var editBtns = container.querySelectorAll('.pg-btn-edit');
    for (var i = 0; i < editBtns.length; i++) {
      editBtns[i].addEventListener('click', function () {
        var section = this.getAttribute('data-section');
        var contentEl = container.querySelector('.pg-section-content[data-section="' + section + '"]');
        var textareaEl = container.querySelector('.pg-section-textarea[data-section="' + section + '"]');
        if (textareaEl.style.display === 'none') {
          textareaEl.style.display = 'block'; contentEl.style.display = 'none'; this.textContent = 'Save'; textareaEl.focus();
        } else {
          proposal[section] = textareaEl.value;
          contentEl.innerHTML = _escapeHtml(textareaEl.value).replace(/\n/g, '<br>');
          textareaEl.style.display = 'none'; contentEl.style.display = 'block'; this.textContent = 'Edit';
        }
      });
    }

    var copyBtn = container.querySelector('.pg-btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = exportProposal(proposal, 'text');
        _copyToClipboard(text).then(function (ok) {
          if (ok) {
            copyBtn.textContent = 'Copied!';
            setTimeout(function () { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
          } else {
            copyBtn.textContent = 'Copy failed';
            setTimeout(function () { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
          }
        });
      });
    }

    var saveBtn = container.querySelector('.pg-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveToHistory(proposal);
        saveBtn.textContent = 'Saved!'; setTimeout(function () { saveBtn.textContent = 'Save to History'; }, 2000);
      });
    }
  }

  // ─── Render: Generator Form ───────────────────────────────────────

  function renderGeneratorForm(containerId) {
    _injectCSS();
    var container = document.getElementById(containerId);
    if (!container) return;

    var h = '<div class="pg-panel"><div class="pg-header">';
    h += '<h2 style="margin:0 0 4px;color:#e0e0e0;font-size:18px;font-weight:700;">AI Proposal Generator</h2>';
    h += '<p style="margin:0;color:#666;font-size:13px;">Paste a job description to generate a tailored proposal</p>';
    h += '</div><div class="pg-form-body">';

    h += '<div class="pg-field"><label class="pg-label">Job Description *</label>';
    h += '<textarea class="pg-input pg-textarea" id="pg-job-desc" rows="8" placeholder="Paste the full job description here..."></textarea></div>';

    h += '<div class="pg-field"><label class="pg-label">Tone</label><div style="display:flex;gap:8px;flex-wrap:wrap;" id="pg-tone-group">';
    var toneKeys = Object.keys(TONE_PRESETS);
    for (var t = 0; t < toneKeys.length; t++) {
      var active = toneKeys[t] === _config.defaultTone ? ' pg-btn-active' : '';
      h += '<button class="pg-btn pg-btn-tone-select' + active + '" data-tone="' + toneKeys[t] + '">' + TONE_PRESETS[toneKeys[t]].label + '</button>';
    }
    h += '</div></div>';

    h += '<div class="pg-field"><button class="pg-btn pg-btn-primary pg-btn-generate" style="width:100%;padding:12px;">Generate Proposal</button></div>';
    h += '<div class="pg-status" id="pg-status" style="display:none;"></div>';
    h += '</div><div id="pg-results"></div></div>';

    container.innerHTML = h;

    var selectedTone = _config.defaultTone;
    var toneBtns = container.querySelectorAll('.pg-btn-tone-select');
    for (var i = 0; i < toneBtns.length; i++) {
      toneBtns[i].addEventListener('click', function () {
        for (var j = 0; j < toneBtns.length; j++) toneBtns[j].classList.remove('pg-btn-active');
        this.classList.add('pg-btn-active');
        selectedTone = this.getAttribute('data-tone');
      });
    }

    var genBtn = container.querySelector('.pg-btn-generate');
    var statusEl = container.querySelector('#pg-status');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        var jobDesc = container.querySelector('#pg-job-desc').value.trim();
        if (!jobDesc || jobDesc.length < 30) {
          statusEl.style.display = 'block'; statusEl.className = 'pg-status pg-status-error';
          statusEl.textContent = 'Please enter a longer job description.'; return;
        }

        genBtn.disabled = true; genBtn.textContent = 'Generating...';
        statusEl.style.display = 'block'; statusEl.className = 'pg-status pg-status-info';
        statusEl.textContent = 'Analyzing job description...';

        generateProposal(jobDesc, { tone: selectedTone }).then(function (proposal) {
          genBtn.disabled = false; genBtn.textContent = 'Generate Proposal';
          statusEl.style.display = 'none';
          var resultsEl = container.querySelector('#pg-results');
          resultsEl.innerHTML = '<div id="pg-editor-0" style="margin-top:16px;"></div>';
          renderProposalEditor('pg-editor-0', proposal);
        }).catch(function (err) {
          genBtn.disabled = false; genBtn.textContent = 'Generate Proposal';
          statusEl.className = 'pg-status pg-status-error';
          statusEl.textContent = 'Generation failed: ' + err.message;
        });
      });
    }
  }

  // ─── Export ────────────────────────────────────────────────────────

  function exportProposal(proposal, format) {
    if (!proposal) return '';
    var fmt = (format || 'text').toLowerCase();

    if (fmt === 'markdown' || fmt === 'md') {
      var md = '';
      for (var i = 0; i < SECTION_ORDER.length; i++) {
        var key = SECTION_ORDER[i];
        if (!proposal[key]) continue;
        md += '## ' + (SECTION_LABELS[key] || key) + '\n\n' + proposal[key] + '\n\n';
      }
      return md.trim();
    }

    if (fmt === 'html') {
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proposal</title></head><body>\n';
      for (var j = 0; j < SECTION_ORDER.length; j++) {
        var k = SECTION_ORDER[j];
        if (!proposal[k]) continue;
        html += '<h2>' + _escapeHtml(SECTION_LABELS[k]) + '</h2>\n<p>' + _escapeHtml(proposal[k]).replace(/\n/g, '<br>') + '</p>\n';
      }
      html += '</body></html>';
      return html;
    }

    var text = '';
    for (var m = 0; m < SECTION_ORDER.length; m++) {
      if (!proposal[SECTION_ORDER[m]]) continue;
      if (text) text += '\n\n';
      text += proposal[SECTION_ORDER[m]];
    }
    return text;
  }

  // ─── History ──────────────────────────────────────────────────────

  function getHistory() {
    try { var raw = localStorage.getItem(STORAGE_KEY_HISTORY); return raw ? JSON.parse(raw) : []; }
    catch (e) { return []; }
  }

  function saveToHistory(proposal) {
    if (!proposal) return;
    var history = getHistory();
    var entry = JSON.parse(JSON.stringify(proposal));
    if (!entry._meta) entry._meta = {};
    entry._meta.savedAt = new Date().toISOString();
    entry._meta.id = 'pg_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    history.unshift(entry);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history)); } catch (e) { /* ignore */ }
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.pg-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.pg-header{padding:16px 20px;border-bottom:1px solid #222;background:#151515}',
      '.pg-form-body{padding:16px 20px}',
      '.pg-field{margin-bottom:14px}',
      '.pg-label{display:block;color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}',
      '.pg-input{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:8px;padding:8px 12px;font-size:14px;outline:none;width:100%;box-sizing:border-box}',
      '.pg-input:focus{border-color:#7c3aed}',
      '.pg-textarea{resize:vertical;min-height:120px;font-family:inherit;line-height:1.5}',
      '.pg-btn{border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;background:#222;color:#aaa;border:1px solid #333}',
      '.pg-btn:hover{background:#2a2a2a;color:#fff}',
      '.pg-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.pg-btn-primary{background:#7c3aed;color:#fff;border-color:#7c3aed}',
      '.pg-btn-primary:hover{background:#6d28d9}',
      '.pg-btn-secondary{background:#222;color:#aaa}',
      '.pg-btn-active{background:#7c3aed33;color:#a78bfa;border-color:#7c3aed}',
      '.pg-btn-small{padding:4px 10px;font-size:11px}',
      '.pg-section{border-bottom:1px solid #1a1a1a}',
      '.pg-section-header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:#0d0d0d}',
      '.pg-section-label{color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}',
      '.pg-section-content{padding:12px 20px;color:#ccc;font-size:14px;line-height:1.6}',
      '.pg-section-textarea{width:100%;min-height:100px;padding:12px 20px;background:#0a0a0a;color:#e0e0e0;border:none;border-top:1px solid #7c3aed;font-size:14px;font-family:inherit;line-height:1.6;resize:vertical;outline:none;box-sizing:border-box}',
      '.pg-actions{display:flex;gap:8px;padding:16px 20px;border-top:1px solid #222;flex-wrap:wrap}',
      '.pg-status{padding:10px 20px;font-size:13px;border-radius:6px;margin-bottom:12px}',
      '.pg-status-info{background:#1e1e2e;color:#a78bfa}',
      '.pg-status-error{background:#2e1a1a;color:#f87171}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // [CF-113] Copy to clipboard with fallback for browsers that don't support navigator.clipboard
  function _copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () {
        return _fallbackCopy(text);
      });
    }
    return Promise.resolve(_fallbackCopy(text));
  }

  function _fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(textarea);
    return ok;
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _scoreColor(score) {
    if (score >= 70) return '#22c55e';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.ProposalGenerator = {
    init: init,
    generateProposal: generateProposal,
    buildPrompt: buildPrompt,
    setUserProfile: setUserProfile,
    customizeSection: customizeSection,
    adjustTone: adjustTone,
    estimateProjectScope: estimateProjectScope,
    suggestPricing: suggestPricing,
    generateMultipleVariants: generateMultipleVariants,
    scoreProposal: scoreProposal,
    renderProposalEditor: renderProposalEditor,
    renderGeneratorForm: renderGeneratorForm,
    exportProposal: exportProposal,
    getHistory: getHistory,
    saveToHistory: saveToHistory,
    SECTION_ORDER: SECTION_ORDER,
    SECTION_LABELS: SECTION_LABELS,
    TONE_PRESETS: TONE_PRESETS,
    version: '1.0.0'
  };

})();
