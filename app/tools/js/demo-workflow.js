/**
 * Cortex Freelancer — End-to-End Demo Workflow Engine
 * CF3-MVP-002: Integrates job selection → AI proposal → mock response flow
 *
 * Connects: Job Feed, Proposal Generator, Rate Calculator, Timeline Planner, Project Tracker
 */
;(function(global) {
  'use strict';

  var KEYS = {
    DEMO_MODE: 'cortex_demo_mode',
    DEMO_STATE: 'cortex_demo_state',
    PROPOSALS: 'cortex_proposals',
    PROJECTS: 'cortex_projects',
    CLIENTS: 'cortex_client_directory',
    SETTINGS: 'cortex_settings',
    ACTIVITY: 'cortex_dashboard_activity',
    AI_MEMORY: 'cortex_ai_memory'
  };

  function load(key, fb) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch(e) { return fb; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // ── Demo Mode Toggle ──────────────────────────────────────
  var DemoWorkflow = {
    isDemo: function() { return load(KEYS.DEMO_MODE, false); },

    toggleDemo: function() {
      var current = this.isDemo();
      save(KEYS.DEMO_MODE, !current);
      if (!current) this.seedDemoData();
      this.updateUI();
      return !current;
    },

    // ── Step 1: Job Discovery ──────────────────────────────
    fetchJobs: async function(filters) {
      if (this.isDemo()) return this.getMockJobs(filters);

      try {
        var params = new URLSearchParams(filters || {});
        var resp = await fetch('/api/jobs?' + params.toString());
        var data = await resp.json();
        return data.success ? data.data : [];
      } catch(e) {
        console.warn('Jobs API unavailable, using mock data');
        return this.getMockJobs(filters);
      }
    },

    getMockJobs: function(filters) {
      var allJobs = load('cortex_demo_jobs', []);
      if (!allJobs.length) {
        allJobs = this.generateDemoJobs();
        save('cortex_demo_jobs', allJobs);
      }
      if (filters && filters.category) {
        allJobs = allJobs.filter(function(j) { return j.category === filters.category; });
      }
      if (filters && filters.search) {
        var term = filters.search.toLowerCase();
        allJobs = allJobs.filter(function(j) {
          return j.title.toLowerCase().includes(term) || j.description.toLowerCase().includes(term);
        });
      }
      return allJobs;
    },

    // ── Step 2: Job Selection → Proposal Generation ────────
    selectJob: async function(job) {
      var state = load(KEYS.DEMO_STATE, {});
      state.selectedJob = job;
      state.step = 'proposal';
      state.timestamp = new Date().toISOString();
      save(KEYS.DEMO_STATE, state);

      // Auto-add client if not exists
      this.ensureClient(job.client);

      // Log to activity
      this.logActivity('job_selected', 'Selected job: ' + job.title, { jobId: job.id });

      // Track in AI memory
      this.trackMemory('job_view', { jobId: job.id, category: job.category, skills: job.skills });

      return state;
    },

    generateProposal: async function(job, options) {
      options = options || {};
      var settings = load(KEYS.SETTINGS, {});
      var memory = load(KEYS.AI_MEMORY, { preferences: {}, history: [] });

      // Calculate rate
      var rate = this.calculateRate(job, settings);

      // Build proposal
      var proposal = {
        id: 'prop_' + Date.now(),
        jobId: job.id,
        jobTitle: job.title,
        clientName: job.client.name,
        status: 'draft',
        createdAt: new Date().toISOString(),
        rate: rate,
        estimatedHours: this.estimateHours(job),
        totalBudget: 0,
        content: {
          greeting: 'Hi ' + (job.client.name.split(' ')[0] || 'there') + ',',
          hook: this.generateHook(job, memory),
          experience: this.generateExperience(job, settings),
          approach: this.generateApproach(job),
          timeline: this.generateTimeline(job),
          closing: this.generateClosing(job, settings),
          callToAction: 'I\'d love to discuss this further. Are you available for a quick call this week?'
        },
        metadata: {
          tone: options.tone || memory.preferences.tone || 'professional',
          wordCount: 0,
          matchScore: this.calculateMatchScore(job, settings),
          competitionLevel: job.competition ? job.competition.proposals : 0
        }
      };

      proposal.totalBudget = proposal.rate.effective * proposal.estimatedHours;
      proposal.metadata.wordCount = JSON.stringify(proposal.content).split(/\s+/).length;

      // Save to proposals
      var proposals = load(KEYS.PROPOSALS, []);
      proposals.unshift(proposal);
      save(KEYS.PROPOSALS, proposals);

      // Update demo state
      var state = load(KEYS.DEMO_STATE, {});
      state.currentProposal = proposal;
      state.step = 'review';
      save(KEYS.DEMO_STATE, state);

      this.logActivity('proposal_created', 'Generated proposal for: ' + job.title, { proposalId: proposal.id });

      return proposal;
    },

    // ── Step 3: Mock Client Response ───────────────────────
    simulateResponse: function(proposalId, scenario) {
      var proposals = load(KEYS.PROPOSALS, []);
      var idx = proposals.findIndex(function(p) { return p.id === proposalId; });
      if (idx === -1) return null;

      var proposal = proposals[idx];
      var responses = {
        accepted: {
          status: 'accepted',
          message: 'Great proposal! I\'d love to move forward. When can we start?',
          nextStep: 'project_setup'
        },
        interview: {
          status: 'interview',
          message: 'Impressive background! Could we schedule a call to discuss the project in more detail?',
          nextStep: 'schedule_call'
        },
        negotiation: {
          status: 'negotiation',
          message: 'I like your approach, but the budget is a bit higher than expected. Could you work within $' + Math.round(proposal.totalBudget * 0.8) + '?',
          nextStep: 'counter_offer'
        },
        declined: {
          status: 'declined',
          message: 'Thank you for your proposal. We\'ve decided to go with another freelancer for this project.',
          nextStep: 'learn_and_improve'
        }
      };

      // Default to weighted random if no scenario specified
      if (!scenario) {
        var rand = Math.random();
        if (rand < 0.35) scenario = 'accepted';
        else if (rand < 0.6) scenario = 'interview';
        else if (rand < 0.85) scenario = 'negotiation';
        else scenario = 'declined';
      }

      var response = responses[scenario];
      proposal.status = response.status;
      proposal.clientResponse = {
        message: response.message,
        timestamp: new Date().toISOString(),
        scenario: scenario
      };

      proposals[idx] = proposal;
      save(KEYS.PROPOSALS, proposals);

      // Track in AI memory for learning
      this.trackMemory('proposal_outcome', {
        proposalId: proposal.id,
        jobCategory: proposal.jobTitle,
        outcome: scenario,
        rate: proposal.rate.effective,
        matchScore: proposal.metadata.matchScore
      });

      // If accepted, create project
      if (scenario === 'accepted') {
        this.createProjectFromProposal(proposal);
      }

      this.logActivity('client_response', response.message.substring(0, 60) + '...', {
        proposalId: proposal.id,
        outcome: scenario
      });

      // Update demo state
      var state = load(KEYS.DEMO_STATE, {});
      state.step = response.nextStep;
      state.response = response;
      save(KEYS.DEMO_STATE, state);

      return { proposal: proposal, response: response };
    },

    // ── Step 4: Project Tracking ───────────────────────────
    createProjectFromProposal: function(proposal) {
      var projects = load(KEYS.PROJECTS, []);
      var project = {
        id: 'proj_' + Date.now(),
        name: proposal.jobTitle,
        client: proposal.clientName,
        status: 'active',
        proposalId: proposal.id,
        budget: proposal.totalBudget,
        rate: proposal.rate.effective,
        estimatedHours: proposal.estimatedHours,
        hoursLogged: 0,
        startDate: new Date().toISOString(),
        milestones: this.generateMilestones(proposal),
        createdAt: new Date().toISOString()
      };

      projects.unshift(project);
      save(KEYS.PROJECTS, projects);
      this.logActivity('project_created', 'New project started: ' + project.name, { projectId: project.id });
      return project;
    },

    // ── Helper Functions ───────────────────────────────────
    calculateRate: function(job, settings) {
      var baseRate = (settings && settings.hourlyRate) || 75;
      var budget = job.budget || {};
      var marketRate = budget.type === 'hourly' ? (budget.min + budget.max) / 2 : baseRate;

      return {
        base: baseRate,
        market: marketRate,
        effective: Math.round(Math.max(baseRate, marketRate * 0.9)),
        currency: budget.currency || 'USD'
      };
    },

    estimateHours: function(job) {
      var duration = (job.duration || '').toLowerCase();
      if (duration.includes('week')) return parseInt(duration) * 20 || 40;
      if (duration.includes('month')) return parseInt(duration) * 80 || 160;
      if (duration.includes('day')) return parseInt(duration) * 6 || 30;
      return 80;
    },

    calculateMatchScore: function(job, settings) {
      var score = 70;
      if (job.client && job.client.rating >= 4.5) score += 10;
      if (job.client && job.client.verified) score += 5;
      if (job.competition && job.competition.proposals < 20) score += 10;
      if (job.urgency === 'high') score += 5;
      return Math.min(100, score);
    },

    generateHook: function(job, memory) {
      var hooks = [
        'I noticed your project requires ' + (job.skills || []).slice(0, 2).join(' and ') + ' — I\'ve been working with these technologies for over 5 years.',
        'Your project caught my eye because it aligns perfectly with my recent work in ' + (job.category || 'this field') + '.',
        'I\'m excited about this opportunity. I recently completed a similar project that delivered excellent results.'
      ];
      return hooks[Math.floor(Math.random() * hooks.length)];
    },

    generateExperience: function(job, settings) {
      return 'With extensive experience in ' + (job.skills || []).slice(0, 3).join(', ') +
        ', I\'ve delivered over 50 successful projects in this space. My approach focuses on clean code, clear communication, and meeting deadlines consistently.';
    },

    generateApproach: function(job) {
      return 'For this project, I\'d start with a thorough requirements review, followed by a phased development approach with weekly check-ins. I\'ll provide a detailed project plan within 24 hours of kickoff.';
    },

    generateTimeline: function(job) {
      var hours = this.estimateHours(job);
      var weeks = Math.ceil(hours / 30);
      return 'Based on the scope, I estimate ' + hours + ' hours over ' + weeks + ' weeks, with key milestones at each phase. I can start within 2-3 business days.';
    },

    generateClosing: function(job, settings) {
      return 'I\'m confident I can deliver exceptional results for this project. My availability is flexible, and I\'m happy to work within your preferred communication style.';
    },

    generateMilestones: function(proposal) {
      var hours = proposal.estimatedHours;
      return [
        { name: 'Project Kickoff & Planning', hours: Math.round(hours * 0.1), status: 'pending', dueOffset: 3 },
        { name: 'Phase 1: Core Development', hours: Math.round(hours * 0.4), status: 'pending', dueOffset: 14 },
        { name: 'Phase 2: Features & Integration', hours: Math.round(hours * 0.3), status: 'pending', dueOffset: 28 },
        { name: 'Testing & Refinement', hours: Math.round(hours * 0.15), status: 'pending', dueOffset: 35 },
        { name: 'Final Delivery & Handoff', hours: Math.round(hours * 0.05), status: 'pending', dueOffset: 42 }
      ];
    },

    ensureClient: function(clientInfo) {
      if (!clientInfo) return;
      var clients = load(KEYS.CLIENTS, []);
      var exists = clients.find(function(c) { return c.name === clientInfo.name; });
      if (!exists) {
        clients.push({
          id: 'client_' + Date.now(),
          name: clientInfo.name,
          rating: clientInfo.rating,
          location: clientInfo.location,
          totalSpent: clientInfo.total_spent,
          status: 'prospect',
          addedAt: new Date().toISOString()
        });
        save(KEYS.CLIENTS, clients);
      }
    },

    trackMemory: function(type, data) {
      var memory = load(KEYS.AI_MEMORY, { preferences: {}, history: [], insights: [] });
      memory.history.push({ type: type, data: data, timestamp: new Date().toISOString() });
      if (memory.history.length > 500) memory.history = memory.history.slice(-500);
      save(KEYS.AI_MEMORY, memory);
    },

    logActivity: function(type, message, data) {
      var activity = load(KEYS.ACTIVITY, []);
      activity.unshift({ type: type, message: message, data: data || {}, timestamp: new Date().toISOString() });
      if (activity.length > 200) activity = activity.slice(0, 200);
      save(KEYS.ACTIVITY, activity);
    },

    // ── Demo Data Seeding ─────────────────────────────────
    seedDemoData: function() {
      // Seed sample proposals
      var proposals = load(KEYS.PROPOSALS, []);
      if (proposals.length < 3) {
        var demoProposals = [
          { id: 'demo_prop_1', jobTitle: 'React Dashboard for SaaS', clientName: 'TechCorp', status: 'accepted', rate: { effective: 85 }, totalBudget: 6800, estimatedHours: 80, createdAt: '2026-03-20T10:00:00Z', metadata: { matchScore: 92 } },
          { id: 'demo_prop_2', jobTitle: 'Mobile App UI Design', clientName: 'DesignHub', status: 'interview', rate: { effective: 70 }, totalBudget: 2800, estimatedHours: 40, createdAt: '2026-03-22T14:00:00Z', metadata: { matchScore: 85 } },
          { id: 'demo_prop_3', jobTitle: 'SEO Content Strategy', clientName: 'GrowthCo', status: 'pending', rate: { effective: 60 }, totalBudget: 1800, estimatedHours: 30, createdAt: '2026-03-25T09:00:00Z', metadata: { matchScore: 78 } }
        ];
        save(KEYS.PROPOSALS, demoProposals.concat(proposals));
      }

      // Seed sample projects
      var projects = load(KEYS.PROJECTS, []);
      if (projects.length < 2) {
        var demoProjects = [
          { id: 'demo_proj_1', name: 'E-commerce Platform Redesign', client: 'ShopNow Inc.', status: 'active', budget: 12000, rate: 90, estimatedHours: 133, hoursLogged: 45, startDate: '2026-03-01T00:00:00Z' },
          { id: 'demo_proj_2', name: 'API Integration Project', client: 'DataFlow', status: 'active', budget: 4500, rate: 75, estimatedHours: 60, hoursLogged: 22, startDate: '2026-03-10T00:00:00Z' }
        ];
        save(KEYS.PROJECTS, demoProjects.concat(projects));
      }
    },

    generateDemoJobs: function() {
      return [
        { id: 'demo_1', title: 'React Dashboard for Analytics Platform', category: 'web-dev', description: 'Build interactive analytics dashboard with charts and real-time data.', budget: { min: 5000, max: 8000, type: 'fixed', currency: 'USD' }, duration: '1-2 months', skills: ['React', 'D3.js', 'TypeScript'], client: { name: 'DataViz Corp', rating: 4.8, total_spent: '$50k+', location: 'US', verified: true }, competition: { proposals: 15, avg_bid: 6500 }, posted: '2026-03-27T00:00:00Z', urgency: 'high' },
        { id: 'demo_2', title: 'Brand Identity for Tech Startup', category: 'design', description: 'Complete brand identity including logo, colors, and guidelines.', budget: { min: 1500, max: 3000, type: 'fixed', currency: 'USD' }, duration: '2 weeks', skills: ['Logo Design', 'Branding', 'Illustrator'], client: { name: 'InnovateTech', rating: 4.5, total_spent: '$10k+', location: 'UK', verified: true }, competition: { proposals: 28, avg_bid: 2000 }, posted: '2026-03-26T12:00:00Z', urgency: 'medium' },
        { id: 'demo_3', title: 'Blog Content — AI & Machine Learning', category: 'writing', description: 'Write 10 in-depth articles on AI and ML topics for tech blog.', budget: { min: 1000, max: 2000, type: 'fixed', currency: 'USD' }, duration: '1 month', skills: ['Content Writing', 'AI/ML', 'SEO'], client: { name: 'TechBlog Pro', rating: 4.3, total_spent: '$8k+', location: 'CA', verified: true }, competition: { proposals: 40, avg_bid: 1400 }, posted: '2026-03-26T18:00:00Z', urgency: 'low' }
      ];
    },

    // ── UI Update Helper ──────────────────────────────────
    updateUI: function() {
      var toggle = document.getElementById('demo-toggle');
      if (toggle) {
        toggle.checked = this.isDemo();
        toggle.closest('.demo-toggle-wrap').classList.toggle('active', this.isDemo());
      }
      var badge = document.getElementById('demo-badge');
      if (badge) badge.style.display = this.isDemo() ? 'inline-flex' : 'none';
    },

    // ── Get Full Workflow State ───────────────────────────
    getState: function() {
      return {
        isDemo: this.isDemo(),
        state: load(KEYS.DEMO_STATE, {}),
        proposals: load(KEYS.PROPOSALS, []),
        projects: load(KEYS.PROJECTS, []),
        activity: load(KEYS.ACTIVITY, []).slice(0, 20)
      };
    },

    // ── Run Full Demo Sequence ────────────────────────────
    runFullDemo: async function() {
      if (!this.isDemo()) this.toggleDemo();

      var jobs = await this.fetchJobs();
      if (!jobs.length) return { error: 'No jobs available' };

      var job = jobs[0];
      await this.selectJob(job);
      var proposal = await this.generateProposal(job);
      var result = this.simulateResponse(proposal.id, 'accepted');

      return {
        job: job,
        proposal: proposal,
        response: result.response,
        project: load(KEYS.PROJECTS, [])[0],
        message: '🎉 Full demo complete! Job selected, proposal sent, client accepted, project created.'
      };
    }
  };

  global.DemoWorkflow = DemoWorkflow;
})(window);
