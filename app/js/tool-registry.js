/**
 * Cortex Freelancer — Tool Registry
 * Purpose: make the product feel like "Freelancer's OpenClaw" by having a single directory of tools.
 * No build system. Safe to include on any page.
 */
(function(){
  'use strict';

  var g = window;
  var ns = g.CortexToolRegistry = g.CortexToolRegistry || {};

  var _tools = ns._tools = ns._tools || {}; // id -> tool

  function norm(s){ return String(s||'').toLowerCase().trim(); }

  ns.register = function(tool){
    if(!tool || !tool.id) throw new Error('Tool must have id');
    var id = String(tool.id);
    // deterministic overwrite: last write wins (easier during sprint)
    _tools[id] = Object.assign({
      id: id,
      name: id,
      description: '',
      category: 'General',
      requiresProfile: false,
      isPro: false,
      href: null
    }, tool);
    return _tools[id];
  };

  ns.get = function(id){ return _tools[String(id)] || null; };

  ns.list = function(opts){
    opts = opts || {};
    var q = norm(opts.query);
    var cat = opts.category ? String(opts.category) : null;
    var proOnly = !!opts.proOnly;

    return Object.keys(_tools)
      .map(function(k){ return _tools[k]; })
      .filter(function(t){
        if (proOnly && !t.isPro) return false;
        if (cat && t.category !== cat) return false;
        if (!q) return true;
        var hay = norm(t.name + ' ' + t.description + ' ' + t.category);
        return hay.indexOf(q) !== -1;
      })
      .sort(function(a,b){ return a.name.localeCompare(b.name); });
  };

  // --- Seed: register core tools that already exist in index.html ---
  function seed(){
    if (ns._seeded) return;
    ns._seeded = true;

    // Advanced Toolkit widgets (FREE)
    ns.register({ id:'connects', name:'Connects ROI Tracker', description:'Track connects spend & ROI.', category:'Jobs', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'connects'} });
    ns.register({ id:'proposal-templates', name:'Proposal Templates', description:'Ready-to-use templates by category.', category:'Proposals', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'proposalTemplates'} });
    ns.register({ id:'comm-templates', name:'Communication Templates', description:'Client messages for each stage.', category:'Clients', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'commTemplates'} });
    ns.register({ id:'ranking', name:'Ranking Simulator', description:'Simulate ranking factors & outcomes.', category:'Profile', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'ranking'} });
    ns.register({ id:'negotiation', name:'Negotiation Coach', description:'Price & scope negotiation helpers.', category:'Money', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'negotiation'} });
    ns.register({ id:'profile-seo', name:'Profile SEO Analyzer', description:'Keyword & positioning improvements.', category:'Profile', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'seo'} });
    ns.register({ id:'revenue', name:'Revenue Forecast', description:'Project revenue scenarios.', category:'Money', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'revenue'} });
    ns.register({ id:'burnout', name:'Burnout Detector', description:'Workload risk signals & tips.', category:'Productivity', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'burnout'} });
    ns.register({ id:'comm-analyzer', name:'Communication Analyzer', description:'Analyze tone & clarity of messages.', category:'Clients', requiresProfile:true, isPro:false, open:{tab:'advanced', widget:'commAnalyzer'} });

    // Other FREE tabs
    ns.register({ id:'fee-calc', name:'Fee Calculator', description:'Compare platform fees & net income.', category:'Money', requiresProfile:false, isPro:false, open:{tab:'feecalc'} });
    ns.register({ id:'rate-calc', name:'Rate Calculator', description:'Set a sustainable hourly rate.', category:'Money', requiresProfile:false, isPro:false, open:{tab:'ratecalc'} });
    ns.register({ id:'contract', name:'Contract Reviewer', description:'Quick contract sanity check.', category:'Clients', requiresProfile:false, isPro:false, open:{tab:'contract'} });
  }

  seed();
})();
