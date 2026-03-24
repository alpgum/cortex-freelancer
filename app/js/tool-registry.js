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

    // --- Jobs ---
    ns.register({ id:'auto-apply', name:'Auto-Apply Rules', description:'Set rules for automatic job applications.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'bid-strategy', name:'Bid Strategy', description:'Optimize connect spend per job type.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'category-trends', name:'Category Trends', description:'Track trending job categories over time.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'competition-density', name:'Competition Density Heatmap', description:'Visualize competition across niches.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'competition-heatmap', name:'Competition Heatmap', description:'See where competition is highest.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'competition-radar', name:'Competition Radar', description:'Monitor competitor activity in real-time.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'competition-tracker', name:'Competition Tracker', description:'Track competitors and their wins.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'competitor-profile', name:'Competitor Profile Tracker', description:'Benchmark against competitor profiles.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'competitor-tracker', name:'Competitor Tracker', description:'Follow competitor moves over time.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'job-alerts', name:'Job Alerts', description:'Get notified for matching jobs.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'job-difficulty', name:'Job Difficulty Ranker', description:'Estimate job difficulty before applying.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'job-digest', name:'Job Digest', description:'Daily curated job summary.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'job-feed-scroll', name:'Job Feed Scroll', description:'Infinite scrolling job feed.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'job-filters', name:'Job Filters', description:'Advanced filtering for job search.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'job-language', name:'Job Language Analyzer', description:'Detect language patterns in job posts.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'job-push', name:'Job Push Notifications', description:'Browser push alerts for new jobs.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'job-quality', name:'Job Quality Score', description:'Rate job post quality instantly.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'job-red-flags', name:'Job Red Flags', description:'Spot warning signs in job posts.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'job-scorer', name:'Job Scorer', description:'Score jobs by fit and potential.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'job-search', name:'Job Search', description:'Search and filter Upwork jobs.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'jss-sim', name:'JSS Simulator', description:'Simulate Job Success Score scenarios.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'niche-finder', name:'Niche Finder', description:'Discover underserved niches.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'niche-enhancer', name:'Niche Opportunity Enhancer', description:'Optimize your niche positioning.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'niche-opportunity', name:'Niche Opportunity Finder', description:'Find profitable niche opportunities.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'saved-templates', name:'Saved Search Templates', description:'Reusable search configurations.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'similar-jobs', name:'Similar Jobs', description:'Find jobs similar to ones you liked.', category:'Jobs', requiresProfile:true, isPro:false });
    ns.register({ id:'smart-filter', name:'Smart Job Filter', description:'AI-powered job filtering.', category:'Jobs', requiresProfile:true, isPro:true });
    ns.register({ id:'title-keyword', name:'Title Keyword Parser', description:'Extract keywords from job titles.', category:'Jobs', requiresProfile:false, isPro:false });
    ns.register({ id:'title-optimizer', name:'Title Optimizer', description:'Optimize your profile title for search.', category:'Jobs', requiresProfile:true, isPro:false });

    // --- Profile ---
    ns.register({ id:'badge-strategy', name:'Badge Strategy', description:'Plan your path to Top Rated status.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'bio-rewriter', name:'Bio Rewriter', description:'AI-powered bio improvement.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'cert-recommender', name:'Cert Recommender', description:'Suggest certifications for your niche.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'photo-checker', name:'Photo Checker', description:'Analyze your profile photo quality.', category:'Profile', requiresProfile:false, isPro:false });
    ns.register({ id:'profile-ab', name:'Profile A/B Test', description:'Test profile variations.', category:'Profile', requiresProfile:true, isPro:true });
    ns.register({ id:'profile-comparison', name:'Profile Comparison', description:'Compare your profile with top earners.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'profile-completeness', name:'Profile Completeness', description:'Check profile completion percentage.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'profile-red-flags', name:'Profile Red Flags', description:'Detect issues hurting your profile.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'profile-scoring', name:'Profile Scoring', description:'Score your profile across key metrics.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'profile-timeline', name:'Profile Timeline', description:'Visualize your freelancing journey.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'skill-gap', name:'Skill Gap Analyzer', description:'Identify skills to learn for more jobs.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'skill-recommender', name:'Skill Recommender', description:'Get skill suggestions based on market.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'style-extractor', name:'Style Extractor', description:'Extract writing style from top profiles.', category:'Profile', requiresProfile:false, isPro:false });
    ns.register({ id:'testimonial-gen', name:'Testimonial Generator', description:'Draft client testimonial requests.', category:'Profile', requiresProfile:true, isPro:false });
    ns.register({ id:'rising-talent', name:'Rising Talent Guide', description:'Steps to earn Rising Talent badge.', category:'Profile', requiresProfile:true, isPro:false });

    // --- Proposals ---
    ns.register({ id:'bulk-proposal', name:'Bulk Proposal', description:'Generate multiple proposals at once.', category:'Proposals', requiresProfile:true, isPro:true });
    ns.register({ id:'cover-letter-sep', name:'Cover Letter Separator', description:'Split cover letter from proposal body.', category:'Proposals', requiresProfile:false, isPro:false });
    ns.register({ id:'proposal-ab', name:'Proposal A/B Test', description:'Test proposal variations.', category:'Proposals', requiresProfile:true, isPro:true });
    ns.register({ id:'proposal-analyzer', name:'Proposal Analyzer', description:'Analyze proposal quality & impact.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-followup', name:'Proposal Follow-up', description:'Schedule and draft follow-ups.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-keyword', name:'Proposal Keyword Injector', description:'Add high-impact keywords to proposals.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-length', name:'Proposal Length Optimizer', description:'Optimize proposal length for wins.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-multilang', name:'Proposal Multilang', description:'Translate proposals to client language.', category:'Proposals', requiresProfile:true, isPro:true });
    ns.register({ id:'proposal-portfolio', name:'Proposal Portfolio Attach', description:'Auto-attach relevant portfolio items.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-response-time', name:'Proposal Response Time', description:'Track response times & optimize.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-response-tracker', name:'Response Tracker', description:'Track client responses to proposals.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-submission', name:'Submission Tracker', description:'Log all proposal submissions.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-tracker', name:'Proposal Tracker', description:'Track proposal status over time.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'proposal-win-rate', name:'Win Rate Tracker', description:'Measure proposal win rate trends.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'response-optimizer', name:'Response Optimizer', description:'Improve response speed & quality.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'response-time-opt', name:'Response Time Optimizer', description:'Reduce client response latency.', category:'Proposals', requiresProfile:true, isPro:false });
    ns.register({ id:'response-timer', name:'Response Timer', description:'Time your proposal writing speed.', category:'Proposals', requiresProfile:false, isPro:false });

    // --- Clients ---
    ns.register({ id:'client-comm', name:'Client Communication', description:'Templates for client messages.', category:'Clients', requiresProfile:true, isPro:false });
    ns.register({ id:'client-crm', name:'Client CRM', description:'Manage client relationships.', category:'Clients', requiresProfile:true, isPro:false });
    ns.register({ id:'client-onboarding', name:'Client Onboarding', description:'Streamline new client setup.', category:'Clients', requiresProfile:true, isPro:false });
    ns.register({ id:'client-red-flags', name:'Client Red Flags', description:'Spot problematic clients early.', category:'Clients', requiresProfile:false, isPro:false });
    ns.register({ id:'client-satisfaction', name:'Client Satisfaction Predictor', description:'Predict client satisfaction risk.', category:'Clients', requiresProfile:true, isPro:true });
    ns.register({ id:'contract-negotiation', name:'Contract Negotiation', description:'Negotiate better contract terms.', category:'Clients', requiresProfile:true, isPro:false });
    ns.register({ id:'repeat-client', name:'Repeat Client Tracker', description:'Identify and nurture repeat clients.', category:'Clients', requiresProfile:true, isPro:false });
    ns.register({ id:'scope-creep', name:'Scope Creep Detector', description:'Detect scope creep in projects.', category:'Clients', requiresProfile:true, isPro:false });
    ns.register({ id:'sow-legal', name:'SOW Legal Checklist', description:'Ensure SOW covers legal basics.', category:'Clients', requiresProfile:false, isPro:false });
    ns.register({ id:'sow-milestone', name:'SOW Milestone Autogen', description:'Auto-generate milestones from SOW.', category:'Clients', requiresProfile:true, isPro:false });

    // --- Money ---
    ns.register({ id:'cashflow', name:'Cashflow Forecast', description:'Project future income & expenses.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'connects-roi', name:'Connects ROI Calculator', description:'Calculate ROI per connect spent.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'connects-spending', name:'Connects Spending ROI', description:'Track spending efficiency on connects.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'currency-conversion', name:'Currency Conversion', description:'Convert earnings across currencies.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'currency-converter', name:'Currency Converter', description:'Quick currency converter tool.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'earnings-analytics', name:'Earnings Analytics', description:'Deep dive into earning patterns.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'earnings-calc', name:'Earnings Calculator', description:'Calculate net earnings after fees.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'earnings-dashboard', name:'Earnings Dashboard', description:'Visual overview of all earnings.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'earnings-export', name:'Earnings Export', description:'Export earnings data to CSV.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'earnings-export-v2', name:'Earnings Export V2', description:'Enhanced earnings export with charts.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'earnings-goal', name:'Earnings Goal Tracker', description:'Set and track income goals.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'earnings-projection', name:'Earnings Projection', description:'Project future earnings.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'earnings-projection-trends', name:'Projection Trends', description:'Earnings projection trend analysis.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'effective-hourly', name:'Effective Hourly Rate', description:'Calculate true hourly rate.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'effective-rate', name:'Effective Rate Calculator', description:'Compare rates across project types.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'expense-tracker', name:'Expense Tracker', description:'Track freelance business expenses.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'income-comparison', name:'Income Comparison', description:'Compare income across periods.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'invoice-gen', name:'Invoice Generator', description:'Create professional invoices.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'invoice-multicurrency', name:'Invoice Multicurrency', description:'Invoices in multiple currencies.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'invoice-recurring', name:'Recurring Invoices', description:'Set up recurring invoice schedules.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'late-payment', name:'Late Payment Alerts', description:'Get alerted about overdue payments.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'market-rate', name:'Market Rate Trends', description:'Track rate trends in your market.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'milestone-tracker', name:'Payment Milestone Tracker', description:'Track payment milestones.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'milestone-tracker-v2', name:'Milestone Tracker V2', description:'Enhanced milestone tracking.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'rate-benchmark', name:'Rate Benchmark', description:'Benchmark your rates against market.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'rate-benchmarking', name:'Rate Benchmarking', description:'Detailed rate benchmarking analysis.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'rate-col', name:'Rate CoL Adjustment', description:'Adjust rates by cost of living.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'rate-market', name:'Rate Market Comparison', description:'Compare your rate to market avg.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'rate-negotiation', name:'Rate Negotiation', description:'Rate negotiation strategies.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'rate-optimizer', name:'Rate Optimizer', description:'Find the optimal rate for max income.', category:'Money', requiresProfile:true, isPro:true });
    ns.register({ id:'revenue-by-client', name:'Revenue by Client', description:'Revenue breakdown per client.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'revenue-notifications', name:'Revenue Notifications', description:'Get notified on revenue milestones.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'revenue-tracker', name:'Revenue Tracker', description:'Track cumulative revenue.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'tax-estimator', name:'Tax Estimator', description:'Estimate freelance tax obligations.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'tax-countries', name:'Tax Estimator Countries', description:'Tax rules by country.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'tax-withholding', name:'Tax Withholding Estimator', description:'Calculate tax withholding amounts.', category:'Money', requiresProfile:false, isPro:false });
    ns.register({ id:'top-earner', name:'Top Earner Analysis', description:'Analyze top earner strategies.', category:'Money', requiresProfile:true, isPro:false });
    ns.register({ id:'top-earner-analyzer', name:'Top Earner Analyzer', description:'Deep dive into top earner profiles.', category:'Money', requiresProfile:true, isPro:true });

    // --- Productivity ---
    ns.register({ id:'action-plan', name:'Action Plan Wizard', description:'Create structured action plans.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'availability', name:'Availability Calendar', description:'Set and share your availability.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'budget-negotiation', name:'Budget Negotiation Predictor', description:'Predict budget negotiation outcomes.', category:'Productivity', requiresProfile:true, isPro:true });
    ns.register({ id:'employment-opt', name:'Employment Optimizer', description:'Optimize your work schedule.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'feedback-analyzer', name:'Feedback Analyzer', description:'Analyze client feedback patterns.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'freelancer-health', name:'Freelancer Health', description:'Track work-life balance metrics.', category:'Productivity', requiresProfile:false, isPro:false });
    ns.register({ id:'history-opt', name:'History Optimizer', description:'Optimize your work history display.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'interview-prep', name:'Interview Prep', description:'Prepare for client interviews.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'meeting-ai', name:'Meeting AI Summarizer', description:'AI-powered meeting summaries.', category:'Productivity', requiresProfile:false, isPro:true });
    ns.register({ id:'meeting-calendar', name:'Meeting Calendar Integration', description:'Sync meetings with calendar.', category:'Productivity', requiresProfile:true, isPro:true });
    ns.register({ id:'milestone-status', name:'Milestone Status Tracker', description:'Track project milestone progress.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'multi-platform', name:'Multi-Platform Sync', description:'Sync profiles across platforms.', category:'Productivity', requiresProfile:true, isPro:true });
    ns.register({ id:'portfolio-ai', name:'Portfolio AI Feedback', description:'Get AI feedback on your portfolio.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'portfolio-analyzer', name:'Portfolio Analyzer', description:'Analyze portfolio effectiveness.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'portfolio-competitive', name:'Portfolio Competitive Analysis', description:'Compare portfolios with competitors.', category:'Productivity', requiresProfile:true, isPro:true });
    ns.register({ id:'portfolio-reviewer', name:'Portfolio Reviewer', description:'Detailed portfolio review.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'red-flag-detector', name:'Red Flag Detector', description:'Detect red flags in projects.', category:'Productivity', requiresProfile:false, isPro:false });
    ns.register({ id:'revision-tracker', name:'Revision Tracker', description:'Track project revision rounds.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'template-customizer', name:'Template Customizer', description:'Customize document templates.', category:'Productivity', requiresProfile:false, isPro:false });
    ns.register({ id:'template-sharing', name:'Template Sharing', description:'Share templates with other users.', category:'Productivity', requiresProfile:true, isPro:true });
    ns.register({ id:'weekly-digest', name:'Weekly Digest', description:'Weekly performance summary.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'weekly-goals', name:'Weekly Goals', description:'Set and track weekly goals.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'weekly-insights', name:'Weekly Insights', description:'AI insights on your weekly performance.', category:'Productivity', requiresProfile:true, isPro:false });
    ns.register({ id:'effort-estimator', name:'Effort Estimator', description:'Estimate project effort & hours.', category:'Productivity', requiresProfile:false, isPro:false });
  }

  seed();
})();
