/**
 * CF-247: Product Hunt Launch Checklist and Assets
 * Launch checklist data, tagline, description, screenshots list, maker comment template, supporter tracker.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_ph_launch_checklist';

  var LAUNCH_DATA = {
    tagline: 'AI-powered tools to help freelancers win more clients on Upwork',
    description: 'Cortex Freelancer gives you an unfair advantage on Upwork. Analyze your profile, generate winning proposals, track earnings, and optimize your rates — all powered by AI. Built by freelancers, for freelancers.',
    screenshots: [
      { id: 'hero', label: 'Dashboard overview', filename: 'ph-screenshot-hero.png', required: true },
      { id: 'profile', label: 'Profile scoring & optimization', filename: 'ph-screenshot-profile.png', required: true },
      { id: 'proposals', label: 'AI proposal generator', filename: 'ph-screenshot-proposals.png', required: true },
      { id: 'earnings', label: 'Earnings analytics', filename: 'ph-screenshot-earnings.png', required: false },
      { id: 'tools', label: 'Freelancer toolkit', filename: 'ph-screenshot-tools.png', required: false }
    ],
    makerComment: 'Hey Product Hunt! 👋\n\nI built Cortex Freelancer because I was tired of guessing what makes a great Upwork profile. After years of freelancing, I realized most of us are leaving money on the table — underbidding, writing generic proposals, and ignoring profile SEO.\n\nCortex Freelancer fixes that with:\n- 🎯 AI profile scoring that tells you exactly what to improve\n- ✍️ Proposal generator trained on winning bids\n- 📊 Earnings analytics to track your real hourly rate\n- 🔍 Job matching that finds your best-fit gigs\n\nWould love your feedback — and happy to answer any questions!\n\n— The Cortex Freelancer team',
    links: {
      website: 'https://cortexfreelancer.com',
      twitter: 'https://twitter.com/cortexfreelance',
      github: ''
    }
  };

  var CHECKLIST = [
    { id: 'tagline', category: 'pre-launch', task: 'Finalize tagline (60 chars max)', priority: 'high' },
    { id: 'description', category: 'pre-launch', task: 'Write product description (260 chars)', priority: 'high' },
    { id: 'screenshots', category: 'pre-launch', task: 'Prepare 5 screenshots (1270x760)', priority: 'high' },
    { id: 'logo', category: 'pre-launch', task: 'Upload logo (240x240 PNG)', priority: 'high' },
    { id: 'thumbnail', category: 'pre-launch', task: 'Create gallery thumbnail GIF/video', priority: 'medium' },
    { id: 'maker-comment', category: 'pre-launch', task: 'Draft first maker comment', priority: 'high' },
    { id: 'hunter', category: 'pre-launch', task: 'Confirm hunter (or self-hunt)', priority: 'medium' },
    { id: 'schedule', category: 'pre-launch', task: 'Schedule launch for 12:01 AM PT', priority: 'high' },
    { id: 'notify-supporters', category: 'launch-day', task: 'Send launch notification to supporter list', priority: 'high' },
    { id: 'social-post', category: 'launch-day', task: 'Post launch announcement on Twitter/LinkedIn', priority: 'high' },
    { id: 'email-blast', category: 'launch-day', task: 'Send launch email to waitlist', priority: 'high' },
    { id: 'respond-comments', category: 'launch-day', task: 'Respond to every PH comment within 1 hour', priority: 'high' },
    { id: 'update-post', category: 'launch-day', task: 'Post midday progress update', priority: 'medium' },
    { id: 'thank-you', category: 'post-launch', task: 'Send thank-you messages to supporters', priority: 'medium' },
    { id: 'analytics', category: 'post-launch', task: 'Review launch analytics and traffic sources', priority: 'medium' },
    { id: 'follow-up', category: 'post-launch', task: 'Write launch retrospective post', priority: 'low' }
  ];

  /**
   * Get the full launch checklist with completion state.
   * @returns {Array<object>}
   */
  function getChecklist() {
    var saved = loadProgress();
    return CHECKLIST.map(function (item) {
      return {
        id: item.id,
        category: item.category,
        task: item.task,
        priority: item.priority,
        completed: saved[item.id] === true
      };
    });
  }

  /**
   * Toggle a checklist item's completion status.
   * @param {string} itemId
   * @returns {boolean} New completion state
   */
  function toggleItem(itemId) {
    var saved = loadProgress();
    saved[itemId] = !saved[itemId];
    saveProgress(saved);
    return saved[itemId];
  }

  /**
   * Get launch readiness as a percentage.
   * @returns {{ percent: number, completed: number, total: number, ready: boolean }}
   */
  function getReadiness() {
    var list = getChecklist();
    var completed = list.filter(function (i) { return i.completed; }).length;
    var percent = Math.round((completed / list.length) * 100);
    return {
      percent: percent,
      completed: completed,
      total: list.length,
      ready: percent >= 80
    };
  }

  /**
   * Get launch assets data.
   * @returns {object}
   */
  function getLaunchData() {
    return JSON.parse(JSON.stringify(LAUNCH_DATA));
  }

  /**
   * Get maker comment template.
   * @returns {string}
   */
  function getMakerComment() {
    return LAUNCH_DATA.makerComment;
  }

  /**
   * Supporter list tracker — add a supporter.
   * @param {object} supporter
   * @param {string} supporter.name
   * @param {string} [supporter.platform] - 'twitter', 'linkedin', 'email'
   * @param {string} [supporter.handle]
   * @returns {Array<object>} Updated supporters list
   */
  function addSupporter(supporter) {
    var supporters = getSupporters();
    supporters.push({
      name: supporter.name,
      platform: supporter.platform || 'email',
      handle: supporter.handle || '',
      notified: false,
      addedAt: new Date().toISOString()
    });
    try {
      localStorage.setItem(STORAGE_KEY + '_supporters', JSON.stringify(supporters));
    } catch (_e) { /* noop */ }
    return supporters;
  }

  /**
   * Get all supporters.
   * @returns {Array<object>}
   */
  function getSupporters() {
    try {
      var data = localStorage.getItem(STORAGE_KEY + '_supporters');
      return data ? JSON.parse(data) : [];
    } catch (_e) {
      return [];
    }
  }

  function loadProgress() {
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (_e) {
      return {};
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (_e) { /* noop */ }
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ProductHuntLaunch = {
    getChecklist: getChecklist,
    toggleItem: toggleItem,
    getReadiness: getReadiness,
    getLaunchData: getLaunchData,
    getMakerComment: getMakerComment,
    addSupporter: addSupporter,
    getSupporters: getSupporters
  };
})();
