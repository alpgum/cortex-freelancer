/**
 * Cortex Freelancer — Onboarding Quick-Start Guide
 * CF3-MVP-003: Value demonstration walkthrough for new users
 */
;(function(global) {
  'use strict';

  var ONBOARDING_KEY = 'cortex_onboarding_state';
  var PROFILE_KEY = 'cortex_user_profile';
  var SETTINGS_KEY = 'cortex_settings';

  function load(key, fb) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch(e) { return fb; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  var STEPS = [
    {
      id: 'welcome',
      title: 'Welcome to Cortex Freelancer! 🚀',
      subtitle: 'Your AI-powered business manager',
      description: 'Cortex helps you find better jobs, write winning proposals, track your time, manage clients, and grow your freelance income — all in one place.',
      action: 'Get Started',
      icon: '⚡'
    },
    {
      id: 'profile',
      title: 'Set Up Your Profile',
      subtitle: 'Tell us about your skills',
      description: 'Your profile helps our AI write better proposals and match you with the right jobs.',
      fields: ['name', 'title', 'hourlyRate', 'skills', 'experience'],
      action: 'Save & Continue',
      icon: '👤'
    },
    {
      id: 'explore_jobs',
      title: 'Discover Jobs That Match You',
      subtitle: 'AI-curated job feed',
      description: 'Browse jobs from Upwork, Fiverr, and other platforms. Our AI scores each job for your skills and rates.',
      demo: 'job_feed',
      action: 'Browse Jobs',
      icon: '🔍'
    },
    {
      id: 'try_proposal',
      title: 'Generate Your First AI Proposal',
      subtitle: 'See the magic in action',
      description: 'Select any job and watch Cortex craft a personalized, professional proposal in seconds. Edit, refine, and send.',
      demo: 'proposal',
      action: 'Try It Now',
      icon: '📝'
    },
    {
      id: 'explore_tools',
      title: 'Explore Your Toolkit',
      subtitle: '30+ tools for freelancers',
      description: 'Time tracking, invoicing, client CRM, rate calculator, contract reviews, and more. Everything you need to run your business.',
      highlights: ['Time Tracker', 'Invoice Generator', 'Rate Calculator', 'Client Directory', 'Project Tracker'],
      action: 'Explore Tools',
      icon: '🛠️'
    },
    {
      id: 'complete',
      title: 'You\'re All Set! 🎉',
      subtitle: 'Your freelance command center is ready',
      description: 'You now have everything you need to find jobs, win clients, and grow your income. Welcome to Cortex Freelancer!',
      action: 'Go to Dashboard',
      icon: '✅'
    }
  ];

  var OnboardingQuickStart = {

    getState: function() {
      return load(ONBOARDING_KEY, {
        completed: false,
        currentStep: 0,
        stepsCompleted: [],
        startedAt: null,
        completedAt: null,
        skipped: false
      });
    },

    saveState: function(state) { save(ONBOARDING_KEY, state); },

    isComplete: function() { return this.getState().completed; },

    shouldShow: function() {
      var state = this.getState();
      return !state.completed && !state.skipped;
    },

    start: function() {
      var state = this.getState();
      state.startedAt = new Date().toISOString();
      state.currentStep = 0;
      this.saveState(state);
      this.render();
    },

    nextStep: function() {
      var state = this.getState();
      state.stepsCompleted.push(STEPS[state.currentStep].id);
      state.currentStep++;

      if (state.currentStep >= STEPS.length) {
        state.completed = true;
        state.completedAt = new Date().toISOString();
      }

      this.saveState(state);
      this.render();
    },

    prevStep: function() {
      var state = this.getState();
      if (state.currentStep > 0) {
        state.currentStep--;
        this.saveState(state);
        this.render();
      }
    },

    skip: function() {
      var state = this.getState();
      state.skipped = true;
      this.saveState(state);
      this.dismiss();
    },

    saveProfileStep: function(data) {
      var profile = load(PROFILE_KEY, {});
      Object.assign(profile, data);
      save(PROFILE_KEY, profile);

      if (data.hourlyRate) {
        var settings = load(SETTINGS_KEY, {});
        settings.hourlyRate = data.hourlyRate;
        save(SETTINGS_KEY, settings);
      }

      this.nextStep();
    },

    render: function() {
      var state = this.getState();
      if (state.completed) { this.dismiss(); return; }

      var step = STEPS[state.currentStep];
      if (!step) return;

      // Remove existing
      var existing = document.getElementById('onboarding-overlay');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id = 'onboarding-overlay';
      overlay.innerHTML = this.buildStepHTML(step, state);
      document.body.appendChild(overlay);

      // Bind events
      var self = this;
      var actionBtn = overlay.querySelector('.ob-action');
      if (actionBtn) actionBtn.addEventListener('click', function() {
        if (step.id === 'profile') {
          self.saveProfileStep({
            name: (document.getElementById('ob-name') || {}).value || '',
            title: (document.getElementById('ob-title') || {}).value || 'Freelancer',
            hourlyRate: parseFloat((document.getElementById('ob-rate') || {}).value) || 75,
            skills: ((document.getElementById('ob-skills') || {}).value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean),
            experience: (document.getElementById('ob-experience') || {}).value || 'intermediate'
          });
        } else if (step.id === 'complete') {
          self.nextStep();
          window.location.href = '/app/tools/dashboard.html';
        } else if (step.id === 'explore_jobs') {
          self.nextStep();
        } else if (step.id === 'try_proposal') {
          self.nextStep();
        } else if (step.id === 'explore_tools') {
          self.nextStep();
        } else {
          self.nextStep();
        }
      });

      var skipBtn = overlay.querySelector('.ob-skip');
      if (skipBtn) skipBtn.addEventListener('click', function() { self.skip(); });

      var backBtn = overlay.querySelector('.ob-back');
      if (backBtn) backBtn.addEventListener('click', function() { self.prevStep(); });
    },

    buildStepHTML: function(step, state) {
      var progress = Math.round(((state.currentStep) / (STEPS.length - 1)) * 100);

      var html = '<style>';
      html += '#onboarding-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(10px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:ob-in .3s}';
      html += '@keyframes ob-in{from{opacity:0}to{opacity:1}}';
      html += '.ob-card{background:#111118;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:40px;max-width:520px;width:90%;text-align:center;position:relative}';
      html += '.ob-icon{font-size:48px;margin-bottom:16px}';
      html += '.ob-title{font-size:24px;font-weight:800;color:#f0f0f0;margin-bottom:4px}';
      html += '.ob-subtitle{font-size:14px;color:#ff8844;font-weight:600;margin-bottom:16px}';
      html += '.ob-desc{font-size:15px;color:#b0b0b0;line-height:1.6;margin-bottom:24px}';
      html += '.ob-progress{height:4px;background:#1a1a22;border-radius:2px;margin-bottom:24px;overflow:hidden}';
      html += '.ob-progress-bar{height:100%;background:linear-gradient(90deg,#ff8844,#00ff88);border-radius:2px;transition:width .3s}';
      html += '.ob-action{background:linear-gradient(135deg,#ff8844,#ff6622);color:#fff;border:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;transition:transform .2s}';
      html += '.ob-action:hover{transform:scale(1.05)}';
      html += '.ob-skip{background:none;border:none;color:#666;font-size:13px;cursor:pointer;margin-top:16px;display:block;margin-left:auto;margin-right:auto}';
      html += '.ob-back{background:none;border:1px solid rgba(255,255,255,.1);color:#b0b0b0;padding:10px 20px;border-radius:10px;font-size:14px;cursor:pointer;margin-right:10px}';
      html += '.ob-field{text-align:left;margin-bottom:16px}';
      html += '.ob-field label{display:block;font-size:13px;color:#999;margin-bottom:6px;font-weight:600}';
      html += '.ob-field input,.ob-field select{width:100%;background:#1a1a22;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px 16px;color:#f0f0f0;font-size:15px;outline:none}';
      html += '.ob-field input:focus,.ob-field select:focus{border-color:#ff8844}';
      html += '.ob-highlights{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:20px}';
      html += '.ob-tag{background:#1a1a22;border:1px solid rgba(255,136,68,.2);color:#ff8844;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:500}';
      html += '.ob-steps{display:flex;gap:6px;justify-content:center;margin-bottom:20px}';
      html += '.ob-dot{width:8px;height:8px;border-radius:50%;background:#333}.ob-dot.active{background:#ff8844}.ob-dot.done{background:#00ff88}';
      html += '.ob-btns{display:flex;justify-content:center;align-items:center;gap:10px}';
      html += '</style>';

      html += '<div class="ob-card">';

      // Progress bar
      html += '<div class="ob-progress"><div class="ob-progress-bar" style="width:' + progress + '%"></div></div>';

      // Step dots
      html += '<div class="ob-steps">';
      for (var i = 0; i < STEPS.length; i++) {
        var cls = i < state.currentStep ? 'done' : i === state.currentStep ? 'active' : '';
        html += '<div class="ob-dot ' + cls + '"></div>';
      }
      html += '</div>';

      html += '<div class="ob-icon">' + step.icon + '</div>';
      html += '<div class="ob-title">' + step.title + '</div>';
      html += '<div class="ob-subtitle">' + step.subtitle + '</div>';
      html += '<div class="ob-desc">' + step.description + '</div>';

      // Profile fields
      if (step.id === 'profile') {
        var profile = load(PROFILE_KEY, {});
        html += '<div class="ob-field"><label>Your Name</label><input type="text" id="ob-name" value="' + (profile.name || '') + '" placeholder="John Smith"></div>';
        html += '<div class="ob-field"><label>Professional Title</label><input type="text" id="ob-title" value="' + (profile.title || '') + '" placeholder="Full-Stack Developer"></div>';
        html += '<div class="ob-field"><label>Hourly Rate (USD)</label><input type="number" id="ob-rate" value="' + (profile.hourlyRate || 75) + '" min="10" max="500"></div>';
        html += '<div class="ob-field"><label>Skills (comma-separated)</label><input type="text" id="ob-skills" value="' + (profile.skills || []).join(', ') + '" placeholder="React, Node.js, TypeScript"></div>';
        html += '<div class="ob-field"><label>Experience Level</label><select id="ob-experience"><option value="entry">Entry Level</option><option value="intermediate" ' + ((profile.experience === 'intermediate' || !profile.experience) ? 'selected' : '') + '>Intermediate</option><option value="expert" ' + (profile.experience === 'expert' ? 'selected' : '') + '>Expert</option></select></div>';
      }

      // Tool highlights
      if (step.highlights) {
        html += '<div class="ob-highlights">';
        step.highlights.forEach(function(h) { html += '<span class="ob-tag">' + h + '</span>'; });
        html += '</div>';
      }

      // Buttons
      html += '<div class="ob-btns">';
      if (state.currentStep > 0) html += '<button class="ob-back">← Back</button>';
      html += '<button class="ob-action">' + step.action + '</button>';
      html += '</div>';

      if (state.currentStep < STEPS.length - 1) {
        html += '<button class="ob-skip">Skip Setup →</button>';
      }

      html += '</div>';
      return html;
    },

    dismiss: function() {
      var overlay = document.getElementById('onboarding-overlay');
      if (overlay) overlay.remove();
    },

    reset: function() {
      localStorage.removeItem(ONBOARDING_KEY);
    }
  };

  global.OnboardingQuickStart = OnboardingQuickStart;
})(window);
