/**
 * Cortex Freelancer — Free vs Pro Feature Matrix
 * [CF-177] Defines feature limits and access rules for Free and Pro plans.
 *
 * Free: 5 tools, 3 proposals/day, basic profile score.
 * Pro: all tools, unlimited proposals, AI features, priority support.
 *
 * Features:
 *   - Complete feature matrix definition
 *   - Limit checking and enforcement
 *   - Usage tracking against limits
 *   - Feature comparison data for UI
 *   - init() interface
 */

(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ────────────────────────────────────────────────────

  var STORAGE_KEY = 'cf_plan_usage';

  var PLANS = {
    FREE: 'free',
    PRO: 'pro'
  };

  // ─── Feature Matrix ──────────────────────────────────────────────

  var MATRIX = {
    tools: {
      name: 'Tools Access',
      description: 'Number of tools available',
      free: { limit: 5, label: '5 tools' },
      pro: { limit: -1, label: 'All tools' },
      category: 'core'
    },
    proposals_per_day: {
      name: 'Proposals',
      description: 'Proposals you can send per day',
      free: { limit: 3, label: '3 per day' },
      pro: { limit: -1, label: 'Unlimited' },
      category: 'core'
    },
    profile_score: {
      name: 'Profile Score',
      description: 'Profile optimization scoring',
      free: { limit: 1, label: 'Basic' },
      pro: { limit: -1, label: 'Advanced AI-powered' },
      category: 'core'
    },
    ai_proposal_writer: {
      name: 'AI Proposal Writer',
      description: 'AI-assisted proposal generation',
      free: { limit: 0, label: 'Not available' },
      pro: { limit: -1, label: 'Unlimited' },
      category: 'ai'
    },
    ai_bio_rewriter: {
      name: 'AI Bio Rewriter',
      description: 'AI-powered bio optimization',
      free: { limit: 0, label: 'Not available' },
      pro: { limit: -1, label: 'Unlimited' },
      category: 'ai'
    },
    ai_rate_advisor: {
      name: 'AI Rate Advisor',
      description: 'Smart rate recommendations',
      free: { limit: 0, label: 'Not available' },
      pro: { limit: -1, label: 'Unlimited' },
      category: 'ai'
    },
    ai_client_insights: {
      name: 'AI Client Insights',
      description: 'AI-powered client analysis',
      free: { limit: 0, label: 'Not available' },
      pro: { limit: -1, label: 'Unlimited' },
      category: 'ai'
    },
    invoice_templates: {
      name: 'Invoice Templates',
      description: 'Professional invoice templates',
      free: { limit: 2, label: '2 basic templates' },
      pro: { limit: -1, label: 'All premium templates' },
      category: 'tools'
    },
    time_tracking: {
      name: 'Time Tracking',
      description: 'Built-in time tracker',
      free: { limit: 1, label: 'Basic' },
      pro: { limit: -1, label: 'Advanced with reports' },
      category: 'tools'
    },
    client_crm: {
      name: 'Client CRM',
      description: 'Client relationship management',
      free: { limit: 5, label: '5 clients' },
      pro: { limit: -1, label: 'Unlimited clients' },
      category: 'tools'
    },
    analytics: {
      name: 'Analytics',
      description: 'Earnings and performance analytics',
      free: { limit: 1, label: 'Basic stats' },
      pro: { limit: -1, label: 'Full analytics dashboard' },
      category: 'tools'
    },
    priority_support: {
      name: 'Priority Support',
      description: 'Fast-track support channel',
      free: { limit: 0, label: 'Community only' },
      pro: { limit: -1, label: 'Priority email & chat' },
      category: 'support'
    },
    export: {
      name: 'Data Export',
      description: 'Export your data',
      free: { limit: 0, label: 'Not available' },
      pro: { limit: -1, label: 'CSV, PDF, JSON' },
      category: 'tools'
    }
  };

  var CATEGORIES = {
    core: { name: 'Core Features', order: 1 },
    ai: { name: 'AI Features', order: 2 },
    tools: { name: 'Tools & Integrations', order: 3 },
    support: { name: 'Support', order: 4 }
  };

  var PRICING = {
    free: { price: 0, label: 'Free', period: '' },
    pro: { price: 19, label: 'Pro', period: '/month' }
  };

  // ─── State ────────────────────────────────────────────────────────

  var state = {
    usage: {}
  };

  // ─── Helpers ──────────────────────────────────────────────────────

  function loadUsage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state.usage = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }

  function saveUsage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.usage));
    } catch (e) { /* ignore */ }
  }

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function getCurrentPlan() {
    var store = window.CortexFreelancer.SubscriptionStore;
    if (store && store.isPro()) return PLANS.PRO;
    return PLANS.FREE;
  }

  // ─── Limit Checking ──────────────────────────────────────────────

  function getFeatureConfig(featureId) {
    return MATRIX[featureId] || null;
  }

  function getLimit(featureId, plan) {
    plan = plan || getCurrentPlan();
    var feature = MATRIX[featureId];
    if (!feature) return 0;
    return feature[plan] ? feature[plan].limit : 0;
  }

  function getUsage(featureId) {
    var key = featureId + '_' + getTodayKey();
    return state.usage[key] || 0;
  }

  function trackUsage(featureId) {
    var key = featureId + '_' + getTodayKey();
    state.usage[key] = (state.usage[key] || 0) + 1;
    saveUsage();
    return state.usage[key];
  }

  function canUse(featureId) {
    var plan = getCurrentPlan();
    var limit = getLimit(featureId, plan);
    if (limit === -1) return true; // unlimited
    if (limit === 0) return false;
    return getUsage(featureId) < limit;
  }

  function getRemainingUses(featureId) {
    var limit = getLimit(featureId);
    if (limit === -1) return Infinity;
    if (limit === 0) return 0;
    return Math.max(0, limit - getUsage(featureId));
  }

  function isFreeTier(featureId) {
    var feature = MATRIX[featureId];
    if (!feature) return false;
    return feature.free.limit !== 0;
  }

  function isProOnly(featureId) {
    var feature = MATRIX[featureId];
    if (!feature) return false;
    return feature.free.limit === 0;
  }

  // ─── Comparison Data ─────────────────────────────────────────────

  function getComparisonData() {
    var categories = {};

    Object.keys(MATRIX).forEach(function (id) {
      var f = MATRIX[id];
      var cat = f.category || 'core';
      if (!categories[cat]) {
        categories[cat] = {
          name: CATEGORIES[cat] ? CATEGORIES[cat].name : cat,
          order: CATEGORIES[cat] ? CATEGORIES[cat].order : 99,
          features: []
        };
      }
      categories[cat].features.push({
        id: id,
        name: f.name,
        description: f.description,
        free: f.free.label,
        pro: f.pro.label,
        proOnly: f.free.limit === 0
      });
    });

    return Object.keys(categories)
      .map(function (k) { return categories[k]; })
      .sort(function (a, b) { return a.order - b.order; });
  }

  function getAllFeatureIds() {
    return Object.keys(MATRIX);
  }

  function getProOnlyFeatures() {
    return Object.keys(MATRIX).filter(function (id) {
      return MATRIX[id].free.limit === 0;
    });
  }

  // ─── Public API ───────────────────────────────────────────────────

  var PlanMatrix = {
    PLANS: PLANS,
    PRICING: PRICING,
    MATRIX: MATRIX,
    CATEGORIES: CATEGORIES,

    init: function () {
      loadUsage();
    },

    getFeature: getFeatureConfig,
    getLimit: getLimit,
    getUsage: getUsage,
    trackUsage: trackUsage,
    canUse: canUse,
    getRemainingUses: getRemainingUses,
    isFreeTier: isFreeTier,
    isProOnly: isProOnly,
    getCurrentPlan: getCurrentPlan,
    getComparisonData: getComparisonData,
    getAllFeatureIds: getAllFeatureIds,
    getProOnlyFeatures: getProOnlyFeatures,
    getPricing: function () { return PRICING; }
  };

  window.CortexFreelancer.PlanMatrix = PlanMatrix;
})();
