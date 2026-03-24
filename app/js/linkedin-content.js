/**
 * CF-250: LinkedIn Content Series — 5 post templates with formatting,
 * publishing schedule, and content management.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_linkedin_content';
  var SITE_URL = 'https://cortexfreelancer.com';
  var PH_URL = 'https://www.producthunt.com/posts/cortex-freelancer';

  /**
   * LinkedInContentManager — manages LinkedIn post templates and schedule.
   * @constructor
   * @param {object} [options]
   * @param {string} [options.launchDate] - ISO date string
   * @param {string} [options.authorName] - Author name for posts
   */
  function LinkedInContentManager(options) {
    options = options || {};
    this.launchDate = options.launchDate ? new Date(options.launchDate) : null;
    this.authorName = options.authorName || '';
    this._state = this._load();
  }

  // --- 5 Post Templates ---

  var POST_TEMPLATES = [
    {
      id: 'building-in-public',
      title: 'Building in Public',
      dayOffset: -3,
      template: function (vars) {
        return 'I\u2019ve been building something for the past few months.\n\n' +
          'Here\u2019s the story:\n\n' +
          'After ' + (vars.yearsFreelancing || '3') + ' years freelancing on Upwork, I noticed a pattern.\n\n' +
          'The freelancers who succeed aren\u2019t necessarily the most skilled.\n' +
          'They\u2019re the ones who:\n\n' +
          '\u2192 Have optimized profiles\n' +
          '\u2192 Write personalized proposals\n' +
          '\u2192 Price themselves strategically\n\n' +
          'So I built an AI tool that does all three.\n\n' +
          'It\u2019s called Cortex Freelancer, and it launches in ' + (vars.daysUntilLaunch || '3') + ' days.\n\n' +
          'More details coming soon. If you freelance on Upwork, you\u2019ll want to see this.\n\n' +
          '#BuildingInPublic #Freelancing #Upwork #AI';
      }
    },
    {
      id: 'freelancer-pain-points',
      title: 'Freelancer Pain Points',
      dayOffset: -1,
      template: function (vars) {
        return 'I surveyed ' + (vars.surveyCount || '200') + ' Upwork freelancers about their biggest challenges.\n\n' +
          'The results were eye-opening:\n\n' +
          '\ud83d\udfe1 67% struggle with writing proposals that stand out\n' +
          '\ud83d\udfe1 54% don\u2019t know if their rate is too high or too low\n' +
          '\ud83d\udfe1 72% have never optimized their profile\n' +
          '\ud83d\udfe1 81% waste time bidding on jobs they won\u2019t get\n\n' +
          'The common thread? Freelancers are great at their craft.\n' +
          'But marketing yourself on a platform is a completely different skill.\n\n' +
          'That\u2019s exactly why we built Cortex Freelancer.\n\n' +
          'An AI-powered toolkit that handles the business side\n' +
          'so you can focus on the work you love.\n\n' +
          'Launching tomorrow. Link in comments.\n\n' +
          '#Freelancing #Upwork #FreelancerLife';
      }
    },
    {
      id: 'tool-demos',
      title: 'Tool Demo Showcase',
      dayOffset: 0,
      template: function () {
        return '\ud83d\ude80 Today\u2019s the day. Cortex Freelancer is LIVE.\n\n' +
          'Here\u2019s what you get (all free to try):\n\n' +
          '1\ufe0f\u20e3 Profile Analyzer\n' +
          'AI scans your Upwork profile and gives you a score out of 100.\n' +
          'Plus specific recommendations to improve.\n\n' +
          '2\ufe0f\u20e3 Proposal Generator\n' +
          'Paste a job description. Get a personalized, professional proposal in seconds.\n\n' +
          '3\ufe0f\u20e3 Rate Calculator\n' +
          'Based on your skills, experience, and market data\u2014\n' +
          'find out exactly what you should be charging.\n\n' +
          '4\ufe0f\u20e3 Bid Strategy\n' +
          'Stop wasting connects. Our AI tells you which jobs you\u2019re most likely to win.\n\n' +
          'No signup required. Just try the tools.\n\n' +
          '\ud83d\udc49 ' + SITE_URL + '\n\n' +
          'We\u2019re also live on Product Hunt today:\n' +
          '\ud83d\udc49 ' + PH_URL + '\n\n' +
          '#ProductHunt #Freelancing #AI #Upwork';
      }
    },
    {
      id: 'launch-announcement',
      title: 'Launch Announcement',
      dayOffset: 0,
      template: function (vars) {
        return 'Big announcement: we just launched on Product Hunt! \ud83c\udf89\n\n' +
          'Cortex Freelancer is an AI-powered toolkit for Upwork freelancers.\n\n' +
          'After months of development and testing with ' + (vars.betaUsers || '500') + '+ beta users,\n' +
          'we\u2019re finally opening it up to everyone.\n\n' +
          'What early users are saying:\n\n' +
          '\u201cWent from a 48 to a 79 profile score. Got 3 new interview invites that week.\u201d\n\n' +
          '\u201cThe proposal generator alone saves me 2 hours per day.\u201d\n\n' +
          '\u201cFinally understand what I should be charging.\u201d\n\n' +
          'If you know a freelancer who could use this, tag them below.\n\n' +
          'Try it free \u2192 ' + SITE_URL + '\n' +
          'Support on PH \u2192 ' + PH_URL + '\n\n' +
          '#LaunchDay #Freelancing #ProductHunt';
      }
    },
    {
      id: 'results-metrics',
      title: 'Results & Metrics',
      dayOffset: 7,
      template: function (vars) {
        return 'One week after launching Cortex Freelancer.\n\n' +
          'Here are the numbers:\n\n' +
          '\ud83d\udcca ' + (vars.profilesAnalyzed || '2,500') + ' profiles analyzed\n' +
          '\ud83d\udcca ' + (vars.proposalsGenerated || '1,200') + ' proposals generated\n' +
          '\ud83d\udcca Average profile score improvement: ' + (vars.avgImprovement || '23') + ' points\n' +
          '\ud83d\udcca ' + (vars.userRating || '4.8') + '/5 average user rating\n\n' +
          'But the number I\u2019m most proud of:\n\n' +
          '' + (vars.successStories || '47') + ' freelancers reported landing new clients\n' +
          'within a week of optimizing their profiles.\n\n' +
          'That\u2019s why we built this.\n\n' +
          'Not for vanity metrics. For real freelancer success.\n\n' +
          'Still free to try \u2192 ' + SITE_URL + '\n\n' +
          '#BuildingInPublic #Freelancing #Results';
      }
    }
  ];

  /**
   * Get all post templates.
   * @returns {object[]}
   */
  LinkedInContentManager.prototype.getPostTemplates = function () {
    return POST_TEMPLATES.map(function (p) {
      return { id: p.id, title: p.title, dayOffset: p.dayOffset };
    });
  };

  /**
   * Generate a post from a template with variables.
   * @param {string} postId
   * @param {object} [vars] - Template variables
   * @returns {string}
   */
  LinkedInContentManager.prototype.generatePost = function (postId, vars) {
    vars = vars || {};
    for (var i = 0; i < POST_TEMPLATES.length; i++) {
      if (POST_TEMPLATES[i].id === postId) {
        return POST_TEMPLATES[i].template(vars);
      }
    }
    return '';
  };

  /**
   * Format a post for LinkedIn (applies character limits and formatting).
   * @param {string} content
   * @returns {object} { formatted, charCount, isOverLimit }
   */
  LinkedInContentManager.prototype.formatForLinkedIn = function (content) {
    var MAX_CHARS = 3000;
    // LinkedIn collapses after ~210 chars, so ensure strong hook in first 2 lines
    var formatted = content
      .replace(/\n{3,}/g, '\n\n')  // Collapse excessive newlines
      .trim();

    return {
      formatted: formatted,
      charCount: formatted.length,
      isOverLimit: formatted.length > MAX_CHARS,
      hookPreview: formatted.substring(0, 210)
    };
  };

  // --- Publishing Schedule ---

  /**
   * Set the publishing schedule for posts.
   */
  LinkedInContentManager.prototype.autoSchedule = function () {
    if (!this.launchDate) return;

    var self = this;
    POST_TEMPLATES.forEach(function (post) {
      var date = new Date(self.launchDate);
      date.setDate(date.getDate() + post.dayOffset);
      date.setHours(8, 30, 0, 0); // LinkedIn optimal: early morning
      self._state.schedule = self._state.schedule || {};
      self._state.schedule[post.id] = {
        scheduledAt: date.toISOString(),
        published: false
      };
    });
    self._save();
  };

  /**
   * Mark a post as published.
   * @param {string} postId
   * @param {string} [postUrl] - URL of the published post
   */
  LinkedInContentManager.prototype.markPublished = function (postId, postUrl) {
    this._state.schedule = this._state.schedule || {};
    if (!this._state.schedule[postId]) this._state.schedule[postId] = {};
    this._state.schedule[postId].published = true;
    this._state.schedule[postId].publishedAt = new Date().toISOString();
    if (postUrl) this._state.schedule[postId].postUrl = postUrl;
    this._save();
  };

  /**
   * Get the full publishing schedule.
   * @returns {object[]}
   */
  LinkedInContentManager.prototype.getSchedule = function () {
    var schedule = this._state.schedule || {};
    return POST_TEMPLATES.map(function (post) {
      var entry = schedule[post.id] || {};
      return {
        id: post.id,
        title: post.title,
        dayOffset: post.dayOffset,
        scheduledAt: entry.scheduledAt || null,
        published: !!entry.published,
        publishedAt: entry.publishedAt || null,
        postUrl: entry.postUrl || null
      };
    }).sort(function (a, b) {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
  };

  /**
   * Render the content schedule as HTML.
   * @returns {string}
   */
  LinkedInContentManager.prototype.renderSchedule = function () {
    var schedule = this.getSchedule();
    var html = '<div class="linkedin-schedule">' +
      '<h2 class="linkedin-schedule__title">LinkedIn Content Calendar</h2>';

    schedule.forEach(function (entry) {
      var date = entry.scheduledAt
        ? new Date(entry.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
        : 'Unscheduled';
      var status = entry.published ? '\u2705 Published' : '\ud83d\udcc5 Scheduled';
      html += '<div class="linkedin-schedule__item">' +
        '<div class="linkedin-schedule__date">' + date + '</div>' +
        '<div class="linkedin-schedule__title">' + entry.title + '</div>' +
        '<div class="linkedin-schedule__status">' + status + '</div>' +
      '</div>';
    });

    html += '</div>';
    return html;
  };

  // --- Persistence ---

  LinkedInContentManager.prototype._load = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_e) { return {}; }
  };

  LinkedInContentManager.prototype._save = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state)); } catch (_e) {}
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.LinkedInContentManager = LinkedInContentManager;
})();
