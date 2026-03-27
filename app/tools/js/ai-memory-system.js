/**
 * Cortex Freelancer — AI Memory System
 * CF3-MVP-005: User preference storage, proposal tracking, suggestion improvement
 *
 * Stores: user preferences, proposal outcomes, job patterns, learned behaviors
 * Uses localStorage (JSON-backed) — designed for easy migration to SQLite/API
 */
;(function(global) {
  'use strict';

  var MEMORY_KEY = 'cortex_ai_memory';
  var PROFILE_KEY = 'cortex_user_profile';

  function load(key, fb) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; }
    catch(e) { return fb; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  var AIMemory = {

    // ── Initialize Memory Store ──────────────────────────
    init: function() {
      var mem = this.getMemory();
      if (!mem._initialized) {
        mem._initialized = true;
        mem._version = '1.0.0';
        mem.createdAt = new Date().toISOString();
        this.saveMemory(mem);
      }
      return mem;
    },

    getMemory: function() {
      return load(MEMORY_KEY, {
        _initialized: false,
        _version: '1.0.0',
        preferences: {
          proposalTone: 'professional',
          preferredCategories: [],
          minBudget: 0,
          maxHoursPerWeek: 40,
          targetRate: 75,
          communicationStyle: 'detailed',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          currency: 'USD',
          platforms: ['upwork']
        },
        skills: [],
        proposalHistory: [],
        jobPatterns: {
          viewedCategories: {},
          appliedCategories: {},
          wonCategories: {},
          avgWinRate: 0,
          bestPerformingSkills: [],
          peakApplyTimes: {}
        },
        insights: [],
        feedback: [],
        createdAt: null,
        lastUpdated: null
      });
    },

    saveMemory: function(mem) {
      mem.lastUpdated = new Date().toISOString();
      save(MEMORY_KEY, mem);
    },

    // ── User Profile ────────────────────────────────────
    getProfile: function() {
      return load(PROFILE_KEY, {
        name: '',
        title: 'Freelancer',
        bio: '',
        avatar: null,
        skills: [],
        experience: 'intermediate',
        hourlyRate: 75,
        portfolioUrl: '',
        linkedinUrl: '',
        githubUrl: '',
        location: '',
        languages: ['English'],
        availability: 'full-time',
        specializations: [],
        certifications: [],
        createdAt: new Date().toISOString()
      });
    },

    updateProfile: function(updates) {
      var profile = this.getProfile();
      Object.assign(profile, updates);
      profile.updatedAt = new Date().toISOString();
      save(PROFILE_KEY, profile);
      return profile;
    },

    // ── Preference Management ───────────────────────────
    setPreference: function(key, value) {
      var mem = this.getMemory();
      mem.preferences[key] = value;
      this.saveMemory(mem);
      return mem.preferences;
    },

    getPreference: function(key, fallback) {
      var mem = this.getMemory();
      return mem.preferences[key] !== undefined ? mem.preferences[key] : fallback;
    },

    updatePreferences: function(updates) {
      var mem = this.getMemory();
      Object.assign(mem.preferences, updates);
      this.saveMemory(mem);
      return mem.preferences;
    },

    // ── Proposal Tracking ───────────────────────────────
    trackProposal: function(proposal) {
      var mem = this.getMemory();
      var record = {
        id: proposal.id,
        jobTitle: proposal.jobTitle || proposal.jobId,
        category: proposal.category || 'unknown',
        skills: proposal.skills || [],
        rate: proposal.rate,
        budget: proposal.totalBudget,
        matchScore: proposal.metadata ? proposal.metadata.matchScore : 0,
        status: proposal.status || 'sent',
        createdAt: proposal.createdAt || new Date().toISOString(),
        outcome: null,
        outcomeAt: null
      };

      mem.proposalHistory.push(record);
      if (mem.proposalHistory.length > 1000) {
        mem.proposalHistory = mem.proposalHistory.slice(-1000);
      }

      // Update category patterns
      var cat = record.category;
      mem.jobPatterns.appliedCategories[cat] = (mem.jobPatterns.appliedCategories[cat] || 0) + 1;

      this.saveMemory(mem);
      this.recalculateInsights();
      return record;
    },

    recordOutcome: function(proposalId, outcome) {
      var mem = this.getMemory();
      var record = mem.proposalHistory.find(function(p) { return p.id === proposalId; });
      if (record) {
        record.outcome = outcome; // 'won', 'lost', 'withdrawn', 'no_response'
        record.outcomeAt = new Date().toISOString();
        record.status = outcome;

        if (outcome === 'won') {
          var cat = record.category;
          mem.jobPatterns.wonCategories[cat] = (mem.jobPatterns.wonCategories[cat] || 0) + 1;
        }
      }
      this.saveMemory(mem);
      this.recalculateInsights();
      return record;
    },

    // ── Job Pattern Tracking ────────────────────────────
    trackJobView: function(job) {
      var mem = this.getMemory();
      var cat = job.category || 'unknown';
      mem.jobPatterns.viewedCategories[cat] = (mem.jobPatterns.viewedCategories[cat] || 0) + 1;

      // Track peak apply times
      var hour = new Date().getHours();
      mem.jobPatterns.peakApplyTimes[hour] = (mem.jobPatterns.peakApplyTimes[hour] || 0) + 1;

      this.saveMemory(mem);
    },

    // ── Insight Generation ──────────────────────────────
    recalculateInsights: function() {
      var mem = this.getMemory();
      var insights = [];
      var history = mem.proposalHistory;

      if (history.length < 3) {
        insights.push({ type: 'info', message: 'Submit more proposals to unlock AI-powered insights!', priority: 'low' });
        mem.insights = insights;
        this.saveMemory(mem);
        return insights;
      }

      // Win rate
      var completed = history.filter(function(p) { return p.outcome; });
      var won = completed.filter(function(p) { return p.outcome === 'won'; });
      var winRate = completed.length > 0 ? Math.round((won.length / completed.length) * 100) : 0;
      mem.jobPatterns.avgWinRate = winRate;

      if (winRate > 30) {
        insights.push({ type: 'success', message: 'Your win rate of ' + winRate + '% is above average! Keep it up.', priority: 'medium' });
      } else if (winRate > 0) {
        insights.push({ type: 'warning', message: 'Your win rate is ' + winRate + '%. Consider refining your proposal strategy.', priority: 'high' });
      }

      // Best performing categories
      var catWins = mem.jobPatterns.wonCategories;
      var bestCats = Object.keys(catWins).sort(function(a, b) { return catWins[b] - catWins[a]; });
      if (bestCats.length > 0) {
        mem.jobPatterns.bestPerformingSkills = bestCats.slice(0, 3);
        insights.push({ type: 'tip', message: 'You perform best in: ' + bestCats.slice(0, 3).join(', ') + '. Focus on these for higher win rates.', priority: 'medium' });
      }

      // Rate optimization
      var wonRates = won.map(function(p) { return typeof p.rate === 'number' ? p.rate : (p.rate && p.rate.effective) || 0; }).filter(function(r) { return r > 0; });
      if (wonRates.length >= 3) {
        var avgWonRate = Math.round(wonRates.reduce(function(a, b) { return a + b; }, 0) / wonRates.length);
        insights.push({ type: 'tip', message: 'Your average winning rate is $' + avgWonRate + '/hr. Consider adjusting your target rate.', priority: 'medium' });
      }

      // Response time patterns
      var peakTimes = mem.jobPatterns.peakApplyTimes;
      var peakHour = Object.keys(peakTimes).sort(function(a, b) { return peakTimes[b] - peakTimes[a]; })[0];
      if (peakHour) {
        insights.push({ type: 'info', message: 'You\'re most active at ' + peakHour + ':00. Jobs posted in early morning tend to get fewer proposals.', priority: 'low' });
      }

      mem.insights = insights;
      this.saveMemory(mem);
      return insights;
    },

    // ── Suggestion Engine ───────────────────────────────
    suggestRate: function(job) {
      var mem = this.getMemory();
      var profile = this.getProfile();
      var baseRate = profile.hourlyRate || mem.preferences.targetRate || 75;

      // Factor in won rates for similar categories
      var catHistory = mem.proposalHistory.filter(function(p) {
        return p.category === job.category && p.outcome === 'won';
      });

      if (catHistory.length > 0) {
        var avgWon = catHistory.reduce(function(sum, p) {
          var r = typeof p.rate === 'number' ? p.rate : (p.rate && p.rate.effective) || baseRate;
          return sum + r;
        }, 0) / catHistory.length;
        baseRate = Math.round((baseRate + avgWon) / 2);
      }

      // Adjust for competition
      if (job.competition && job.competition.proposals > 30) {
        baseRate = Math.round(baseRate * 0.95); // Slightly lower for high competition
      }

      return {
        suggested: baseRate,
        min: Math.round(baseRate * 0.8),
        max: Math.round(baseRate * 1.3),
        confidence: catHistory.length > 5 ? 'high' : catHistory.length > 2 ? 'medium' : 'low',
        reasoning: catHistory.length > 0
          ? 'Based on ' + catHistory.length + ' successful proposals in ' + job.category
          : 'Based on your profile rate and market data'
      };
    },

    suggestTone: function(job) {
      var mem = this.getMemory();
      var wonTones = {};
      mem.proposalHistory.filter(function(p) { return p.outcome === 'won'; }).forEach(function(p) {
        var tone = p.tone || 'professional';
        wonTones[tone] = (wonTones[tone] || 0) + 1;
      });

      var bestTone = Object.keys(wonTones).sort(function(a, b) { return wonTones[b] - wonTones[a]; })[0] || 'professional';
      return bestTone;
    },

    // ── Feedback Storage ────────────────────────────────
    addFeedback: function(proposalId, feedback) {
      var mem = this.getMemory();
      mem.feedback.push({
        proposalId: proposalId,
        feedback: feedback,
        timestamp: new Date().toISOString()
      });
      if (mem.feedback.length > 200) mem.feedback = mem.feedback.slice(-200);
      this.saveMemory(mem);
    },

    // ── Stats & Reports ─────────────────────────────────
    getStats: function() {
      var mem = this.getMemory();
      var history = mem.proposalHistory;
      var completed = history.filter(function(p) { return p.outcome; });
      var won = completed.filter(function(p) { return p.outcome === 'won'; });
      var totalRevenue = won.reduce(function(s, p) { return s + (p.budget || 0); }, 0);

      return {
        totalProposals: history.length,
        completedProposals: completed.length,
        wonProposals: won.length,
        winRate: completed.length > 0 ? Math.round((won.length / completed.length) * 100) : 0,
        totalRevenue: totalRevenue,
        avgProposalValue: won.length > 0 ? Math.round(totalRevenue / won.length) : 0,
        topCategories: mem.jobPatterns.bestPerformingSkills || [],
        insightCount: (mem.insights || []).length,
        lastActivity: mem.lastUpdated
      };
    },

    // ── Export / Import ─────────────────────────────────
    exportData: function() {
      return {
        memory: this.getMemory(),
        profile: this.getProfile(),
        exportedAt: new Date().toISOString()
      };
    },

    importData: function(data) {
      if (data.memory) save(MEMORY_KEY, data.memory);
      if (data.profile) save(PROFILE_KEY, data.profile);
      return true;
    },

    // ── Reset ───────────────────────────────────────────
    reset: function() {
      localStorage.removeItem(MEMORY_KEY);
      localStorage.removeItem(PROFILE_KEY);
      this.init();
    }
  };

  // Auto-init
  AIMemory.init();

  global.AIMemory = AIMemory;
})(window);
