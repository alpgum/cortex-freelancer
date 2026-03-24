/**
 * [CF-160] Templates — AI Template Customization
 * Takes a template and auto-customizes it based on user's profile
 * and project details with tone adjustment and diff preview.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_template_customizer';
  var PROFILE_KEY = 'cortex_tc_profile';
  var CSS_ID = 'cf-tc-styles';
  var _container = null;
  var _injected = false;

  /* ── Helpers ── */

  function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || getDefaultProfile(); }
    catch (e) { return getDefaultProfile(); }
  }

  function saveProfile(p) {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
  }

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { templates: getSampleTemplates(), history: [] }; }
    catch (e) { return { templates: getSampleTemplates(), history: [] }; }
  }

  function saveData(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
  }

  function getDefaultProfile() {
    return { name: '', businessName: '', skills: '', experience: 'mid', hourlyRate: '', industry: '', portfolioUrl: '' };
  }

  function getSampleTemplates() {
    return [
      { id: 'tpl-proposal', name: 'Project Proposal', content: 'Dear {{project.client}},\n\nThank you for considering {{user.businessName || user.name}} for {{project.name}}.\n\nI bring {{user.experience}} experience in {{user.industry}}, with expertise in {{user.skills}}.\n\nProject Overview:\n{{project.scope}}\n\nTimeline: {{project.timeline}}\nBudget: {{project.budget}}\n\nMy rate is {{user.hourlyRate}}/hour, and you can view my work at {{user.portfolioUrl}}.\n\nI look forward to discussing this opportunity.\n\nBest regards,\n{{user.name}}' },
      { id: 'tpl-followup', name: 'Follow-up Email', content: 'Hi {{project.client}},\n\nI wanted to follow up on our conversation about {{project.name}}.\n\nAs a {{user.experience}} {{user.industry}} professional, I am confident I can deliver excellent results for {{project.scope}}.\n\nWould you be available this week for a brief call to discuss next steps?\n\nBest,\n{{user.name}}\n{{user.businessName}}' },
      { id: 'tpl-contract', name: 'Service Agreement', content: 'SERVICE AGREEMENT\n\nThis agreement is between {{user.businessName || user.name}} ("Service Provider") and {{project.client}} ("Client").\n\nEffective Date: {{project.timeline}}\n\nScope of Services:\n{{project.scope}}\n\nCompensation:\nRate: {{user.hourlyRate}}/hour\nEstimated Budget: {{project.budget}}\nPayment Terms: Net 30\n\nProvider Background:\n{{user.name}} is a {{user.experience}} professional specializing in {{user.skills}} within the {{user.industry}} industry.\n\nPortfolio: {{user.portfolioUrl}}\n\nSignatures:\n_______________\n{{user.name}}\n\n_______________\n{{project.client}}' },
      { id: 'tpl-scope', name: 'Scope of Work', content: 'SCOPE OF WORK\n\nProject: {{project.name}}\nClient: {{project.client}}\nProvider: {{user.businessName || user.name}}\n\n1. OBJECTIVES\n{{project.scope}}\n\n2. DELIVERABLES\n[Based on {{user.skills}} expertise]\n\n3. TIMELINE\n{{project.timeline}}\n\n4. BUDGET\n{{project.budget}}\n\n5. PROVIDER QUALIFICATIONS\n{{user.name}} — {{user.experience}} experience in {{user.industry}}.\nRate: {{user.hourlyRate}}/hr\nPortfolio: {{user.portfolioUrl}}' }
    ];
  }

  var TONES = {
    formal: { label: 'Formal', transforms: [
      [/\bHi\b/g, 'Dear'], [/\bthanks\b/gi, 'thank you'], [/\bI\'m\b/g, 'I am'],
      [/\bcan\'t\b/gi, 'cannot'], [/\bwon\'t\b/gi, 'will not'], [/\bdon\'t\b/gi, 'do not'],
      [/\bBest,/g, 'Sincerely,'], [/\bCheers,/g, 'Sincerely,']
    ]},
    friendly: { label: 'Friendly', transforms: [
      [/\bDear\b/g, 'Hi'], [/\bSincerely,/g, 'Best,'], [/\bI am\b/g, "I'm"],
      [/\bcannot\b/gi, "can't"], [/\bdo not\b/gi, "don't"]
    ]},
    technical: { label: 'Technical', transforms: [
      [/\bwork\b/g, 'deliverables'], [/\bstart\b/g, 'initiate'], [/\bfinish\b/g, 'complete'],
      [/\bhelp\b/g, 'facilitate'], [/\btalk\b/g, 'discuss']
    ]},
    persuasive: { label: 'Persuasive', transforms: [
      [/\bgood\b/gi, 'excellent'], [/\bnice\b/gi, 'outstanding'], [/\bexperience\b/g, 'proven track record'],
      [/\bI can\b/g, 'I will'], [/\bI think\b/g, 'I am confident']
    ]}
  };

  var EXP_LABELS = { junior: 'junior-level', mid: 'mid-level', senior: 'senior-level', expert: 'expert-level' };

  /* ── Customization Engine ── */

  function applyVariables(template, profile, project) {
    var text = template;
    var vars = {
      '{{user.name}}': profile.name || '[Your Name]',
      '{{user.businessName}}': profile.businessName || profile.name || '[Business Name]',
      '{{user.skills}}': profile.skills || '[Your Skills]',
      '{{user.experience}}': EXP_LABELS[profile.experience] || profile.experience || '[Experience]',
      '{{user.hourlyRate}}': profile.hourlyRate ? '$' + profile.hourlyRate : '[Rate]',
      '{{user.industry}}': profile.industry || '[Industry]',
      '{{user.portfolioUrl}}': profile.portfolioUrl || '[Portfolio URL]',
      '{{project.client}}': project.client || '[Client Name]',
      '{{project.name}}': project.name || '[Project Name]',
      '{{project.scope}}': project.scope || '[Project Scope]',
      '{{project.timeline}}': project.timeline || '[Timeline]',
      '{{project.budget}}': project.budget ? '$' + project.budget : '[Budget]'
    };

    // Handle conditional expressions like {{user.businessName || user.name}}
    text = text.replace(/\{\{([^}]+)\|\|([^}]+)\}\}/g, function (match, a, b) {
      var aKey = a.trim();
      var bKey = b.trim();
      var aVal = vars['{{' + aKey + '}}'];
      var bVal = vars['{{' + bKey + '}}'];
      if (aVal && aVal.indexOf('[') !== 0) return aVal;
      if (bVal && bVal.indexOf('[') !== 0) return bVal;
      return aVal || bVal || match;
    });

    Object.keys(vars).forEach(function (key) {
      text = text.split(key).join(vars[key]);
    });

    return text;
  }

  function applyTone(text, toneKey) {
    var tone = TONES[toneKey];
    if (!tone) return text;
    tone.transforms.forEach(function (t) {
      text = text.replace(t[0], t[1]);
    });
    return text;
  }

  function generateSuggestions(profile, project) {
    var suggestions = [];
    if (!profile.name) suggestions.push('Add your name to the profile for personalized templates.');
    if (!profile.portfolioUrl) suggestions.push('Include a portfolio URL to build credibility.');
    if (!profile.hourlyRate) suggestions.push('Set your hourly rate for accurate pricing in documents.');
    if (!project.scope) suggestions.push('Add a project scope description for more detailed templates.');
    if (project.budget && profile.hourlyRate) {
      var hours = parseInt(project.budget, 10) / parseInt(profile.hourlyRate, 10);
      if (hours > 0) suggestions.push('At your rate, this budget covers ~' + Math.round(hours) + ' hours of work.');
    }
    if (profile.experience === 'senior' || profile.experience === 'expert') {
      suggestions.push('As a ' + EXP_LABELS[profile.experience] + ' professional, consider emphasizing your track record.');
    }
    return suggestions;
  }

  /* ── CSS ── */

  function injectCSS() {
    if (_injected) return;
    _injected = true;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      '.tc-panel{background:var(--bg-primary,#0a0a0a);border:1px solid var(--border,#1e1e1e);border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--text-primary,#e0e0e0);overflow:hidden}',
      '.tc-header{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e)}',
      '.tc-title{font-size:16px;font-weight:700}',
      '.tc-section{padding:16px 20px;border-bottom:1px solid var(--border,#1e1e1e)}',
      '.tc-section-title{font-size:13px;font-weight:600;color:var(--text-secondary,#ccc);margin-bottom:10px}',
      '.tc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}',
      '.tc-field label{display:block;font-size:11px;color:var(--text-muted,#888);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}',
      '.tc-field input,.tc-field select,.tc-field textarea{width:100%;background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:13px;padding:6px 8px;box-sizing:border-box;font-family:inherit}',
      '.tc-field textarea{min-height:60px;resize:vertical}',
      '.tc-templates{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
      '.tc-tpl-btn{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-primary,#e0e0e0);font-size:12px;padding:8px 14px;cursor:pointer;transition:border-color .2s}',
      '.tc-tpl-btn:hover,.tc-tpl-btn.active{border-color:#7c3aed;color:#a78bfa}',
      '.tc-tone-btns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}',
      '.tc-tone-btn{background:var(--bg-secondary,#111);border:1px solid var(--border,#222);border-radius:6px;color:var(--text-muted,#888);font-size:11px;padding:6px 12px;cursor:pointer;transition:all .2s}',
      '.tc-tone-btn:hover,.tc-tone-btn.active{border-color:#7c3aed;color:#a78bfa}',
      '.tc-preview{background:var(--bg-secondary,#111);border:1px solid var(--border,#1e1e1e);border-radius:8px;padding:16px;font-size:13px;line-height:1.6;white-space:pre-wrap;max-height:400px;overflow-y:auto}',
      '.tc-suggestions{margin-top:12px}',
      '.tc-suggestion{background:#7c3aed11;border:1px solid #7c3aed33;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#a78bfa}',
      '.tc-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
      '.tc-btn{border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;padding:8px 16px}',
      '.tc-btn-primary{background:#7c3aed;color:#fff}',
      '.tc-btn-primary:hover{background:#6d28d9}',
      '.tc-btn-secondary{background:var(--bg-secondary,#222);color:var(--text-primary,#e0e0e0);border:1px solid var(--border,#333)}',
      '.tc-btn-secondary:hover{background:var(--border,#333)}',
      '@media(max-width:600px){.tc-grid{grid-template-columns:1fr 1fr}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── Render ── */

  function render(container) {
    injectCSS();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var profile = loadProfile();
    var data = loadData();
    var state = { selectedTemplate: data.templates[0] ? data.templates[0].id : null, tone: 'formal', project: { client: '', name: '', scope: '', timeline: '', budget: '' } };

    renderUI(el, profile, data, state);
  }

  function renderUI(el, profile, data, state) {
    var h = '<div class="tc-panel">';

    // Header
    h += '<div class="tc-header"><div class="tc-title">Template Customizer</div></div>';

    // Profile section
    h += '<div class="tc-section"><div class="tc-section-title">Your Profile</div><div class="tc-grid">';
    var profileFields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'businessName', label: 'Business Name', type: 'text' },
      { key: 'skills', label: 'Skills', type: 'text' },
      { key: 'experience', label: 'Experience', type: 'select', options: [['junior','Junior'],['mid','Mid-level'],['senior','Senior'],['expert','Expert']] },
      { key: 'hourlyRate', label: 'Hourly Rate ($)', type: 'number' },
      { key: 'industry', label: 'Industry', type: 'text' },
      { key: 'portfolioUrl', label: 'Portfolio URL', type: 'text' }
    ];
    profileFields.forEach(function (f) {
      h += '<div class="tc-field"><label>' + f.label + '</label>';
      if (f.type === 'select') {
        h += '<select id="tc-p-' + f.key + '">';
        f.options.forEach(function (o) {
          h += '<option value="' + o[0] + '"' + (profile[f.key] === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        });
        h += '</select>';
      } else {
        h += '<input type="' + f.type + '" id="tc-p-' + f.key + '" value="' + esc(profile[f.key] || '') + '">';
      }
      h += '</div>';
    });
    h += '</div></div>';

    // Project section
    h += '<div class="tc-section"><div class="tc-section-title">Project Details</div><div class="tc-grid">';
    var projectFields = [
      { key: 'client', label: 'Client Name' },
      { key: 'name', label: 'Project Name' },
      { key: 'timeline', label: 'Timeline' },
      { key: 'budget', label: 'Budget ($)' }
    ];
    projectFields.forEach(function (f) {
      h += '<div class="tc-field"><label>' + f.label + '</label>';
      h += '<input type="text" id="tc-proj-' + f.key + '" value="' + esc(state.project[f.key] || '') + '"></div>';
    });
    h += '</div><div class="tc-field" style="margin-top:8px"><label>Scope Description</label>';
    h += '<textarea id="tc-proj-scope">' + esc(state.project.scope || '') + '</textarea></div></div>';

    // Template selection
    h += '<div class="tc-section"><div class="tc-section-title">Select Template</div>';
    h += '<div class="tc-templates">';
    data.templates.forEach(function (t) {
      h += '<button class="tc-tpl-btn' + (state.selectedTemplate === t.id ? ' active' : '') + '" data-tpl="' + t.id + '">' + esc(t.name) + '</button>';
    });
    h += '</div>';

    // Tone
    h += '<div class="tc-section-title">Tone</div><div class="tc-tone-btns">';
    Object.keys(TONES).forEach(function (k) {
      h += '<button class="tc-tone-btn' + (state.tone === k ? ' active' : '') + '" data-tone="' + k + '">' + TONES[k].label + '</button>';
    });
    h += '</div>';

    // Customize button
    h += '<button class="tc-btn tc-btn-primary" id="tc-customize">Customize Template</button></div>';

    // Preview section
    var selectedTpl = data.templates.find(function (t) { return t.id === state.selectedTemplate; });
    if (state.customized) {
      h += '<div class="tc-section"><div class="tc-section-title">Customized Result</div>';
      h += '<div class="tc-preview">' + esc(state.customized) + '</div>';

      var suggestions = generateSuggestions(profile, state.project);
      if (suggestions.length) {
        h += '<div class="tc-suggestions">';
        suggestions.forEach(function (s) { h += '<div class="tc-suggestion">' + esc(s) + '</div>'; });
        h += '</div>';
      }

      h += '<div class="tc-actions">';
      h += '<button class="tc-btn tc-btn-primary" id="tc-copy">Copy to Clipboard</button>';
      h += '<button class="tc-btn tc-btn-secondary" id="tc-download">Download</button>';
      h += '<button class="tc-btn tc-btn-secondary" id="tc-save">Save to Templates</button>';
      h += '</div></div>';
    }

    h += '</div>';
    el.innerHTML = h;

    // Events
    el.querySelectorAll('.tc-tpl-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.selectedTemplate = btn.getAttribute('data-tpl');
        state.customized = null;
        renderUI(el, profile, data, state);
      });
    });

    el.querySelectorAll('.tc-tone-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tone = btn.getAttribute('data-tone');
        state.customized = null;
        renderUI(el, profile, data, state);
      });
    });

    var customizeBtn = el.querySelector('#tc-customize');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', function () {
        // Read current form values
        profileFields.forEach(function (f) {
          var input = document.getElementById('tc-p-' + f.key);
          if (input) profile[f.key] = input.value.trim();
        });
        saveProfile(profile);

        projectFields.forEach(function (f) {
          var input = document.getElementById('tc-proj-' + f.key);
          if (input) state.project[f.key] = input.value.trim();
        });
        var scopeInput = document.getElementById('tc-proj-scope');
        if (scopeInput) state.project.scope = scopeInput.value.trim();

        var tpl = data.templates.find(function (t) { return t.id === state.selectedTemplate; });
        if (!tpl) return;

        var result = applyVariables(tpl.content, profile, state.project);
        result = applyTone(result, state.tone);
        state.customized = result;

        // Save history
        data.history.unshift({ template: tpl.name, tone: state.tone, date: new Date().toISOString(), preview: result.substring(0, 100) });
        if (data.history.length > 20) data.history = data.history.slice(0, 20);
        saveData(data);

        renderUI(el, profile, data, state);
      });
    }

    var copyBtn = el.querySelector('#tc-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard && state.customized) {
          navigator.clipboard.writeText(state.customized);
          this.textContent = 'Copied!';
        }
      });
    }

    var downloadBtn = el.querySelector('#tc-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        if (!state.customized) return;
        var blob = new Blob([state.customized], { type: 'text/plain' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'customized-template.txt';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    var saveBtn = el.querySelector('#tc-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!state.customized) return;
        data.templates.push({
          id: uid(),
          name: (state.project.name || 'Custom') + ' — Customized',
          content: state.customized
        });
        saveData(data);
        this.textContent = 'Saved!';
      });
    }
  }

  function init(containerId) {
    var data = loadData();
    if (containerId) render(containerId);
    return data;
  }

  function destroy() {
    if (_container) { _container.innerHTML = ''; _container = null; }
    var s = document.getElementById(CSS_ID);
    if (s) s.parentNode.removeChild(s);
    _injected = false;
  }

  /* ── Public API ── */
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TemplateCustomizer = {
    init: init,
    render: render,
    destroy: destroy,
    applyVariables: applyVariables,
    applyTone: applyTone
  };
})();
