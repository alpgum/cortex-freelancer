/**
 * CF-249: Twitter/X Automation for Launch — 20 pre-written tweet templates,
 * scheduling logic, content calendar view.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_twitter_launch';
  var PH_URL = 'https://www.producthunt.com/posts/cortex-freelancer';
  var SITE_URL = 'https://cortexfreelancer.com';

  /**
   * TwitterLaunchManager — manages tweet templates, scheduling, and calendar.
   * @constructor
   * @param {object} [options]
   * @param {string} [options.launchDate] - ISO date string
   * @param {string} [options.handle] - Twitter handle (e.g. '@cortexfreelance')
   */
  function TwitterLaunchManager(options) {
    options = options || {};
    this.launchDate = options.launchDate ? new Date(options.launchDate) : null;
    this.handle = options.handle || '@cortexfreelance';
    this._schedule = this._loadSchedule();
  }

  // --- 20 Pre-written Tweet Templates ---

  var TWEET_TEMPLATES = [
    // Countdown (1-5)
    { id: 't1', category: 'countdown', phase: 'pre', dayOffset: -7,
      text: '\ud83d\udea8 Something big is coming for Upwork freelancers.\n\n7 days until launch.\n\nStay tuned. \ud83d\udc40' },
    { id: 't2', category: 'countdown', phase: 'pre', dayOffset: -5,
      text: '5 days until we launch the tool I wish I had when I started freelancing on Upwork.\n\nAI-powered profile optimization, proposal writing, and rate calculation.\n\nAll in one place. All free to try.' },
    { id: 't3', category: 'countdown', phase: 'pre', dayOffset: -3,
      text: '3 days to go \ud83d\ude80\n\nHere\'s a sneak peek at what Cortex Freelancer can do:\n\n\u2705 Analyze your Upwork profile\n\u2705 Generate winning proposals\n\u2705 Calculate your optimal rate\n\nWho wants early access?' },
    { id: 't4', category: 'countdown', phase: 'pre', dayOffset: -1,
      text: 'TOMORROW.\n\nCortex Freelancer launches on @ProductHunt.\n\nIf you freelance on Upwork, you\'ll want to see this.\n\nSet your reminder \u2192 ' + PH_URL },
    { id: 't5', category: 'countdown', phase: 'launch', dayOffset: 0,
      text: '\ud83d\ude80 WE\'RE LIVE ON PRODUCT HUNT!\n\nCortex Freelancer — AI-powered toolkit for Upwork freelancers.\n\nYour support means everything \u2192 ' + PH_URL + '\n\n#ProductHunt #Freelancing #Upwork' },

    // Feature spotlights (6-10)
    { id: 't6', category: 'feature', phase: 'pre', dayOffset: -6,
      text: 'Did you know? The average Upwork profile scores just 52/100.\n\nOur AI Profile Analyzer tells you exactly what to fix.\n\nFree to try. No signup needed.\n\n' + SITE_URL },
    { id: 't7', category: 'feature', phase: 'launch', dayOffset: 0,
      text: 'Writing Upwork proposals takes hours.\n\nOur AI Proposal Generator does it in seconds.\n\nPersonalized. Professional. Proven to convert.\n\nTry it free \u2192 ' + SITE_URL },
    { id: 't8', category: 'feature', phase: 'post', dayOffset: 1,
      text: '"Am I charging enough?"\n\nEvery freelancer asks this.\n\nOur Rate Calculator uses market data to find your optimal hourly rate.\n\nNo more guessing \u2192 ' + SITE_URL },
    { id: 't9', category: 'feature', phase: 'post', dayOffset: 2,
      text: 'Freelancers who optimized their profiles with Cortex saw an average 23-point score improvement.\n\nThat translates to more visibility and more invitations.\n\nSee your score \u2192 ' + SITE_URL },
    { id: 't10', category: 'feature', phase: 'post', dayOffset: 3,
      text: 'The Bid Strategy tool tells you which jobs are worth your time.\n\nStop wasting connects on jobs you won\'t win.\n\nStart bidding smarter \u2192 ' + SITE_URL },

    // Behind the scenes (11-14)
    { id: 't11', category: 'behind-the-scenes', phase: 'pre', dayOffset: -4,
      text: 'Building in public \ud83e\uddf1\n\nWe analyzed 10,000+ Upwork profiles to train our AI.\n\nThe patterns we found were surprising.\n\nThread coming soon \ud83e\uddf5' },
    { id: 't12', category: 'behind-the-scenes', phase: 'pre', dayOffset: -2,
      text: 'Why I built Cortex Freelancer:\n\nI spent 3 years freelancing on Upwork. Made every mistake possible.\n\nWeak profile. Generic proposals. Undercharging.\n\nI built the tool that would\'ve saved me years of trial and error.' },
    { id: 't13', category: 'behind-the-scenes', phase: 'launch', dayOffset: 0,
      text: 'Launch day nerves are real \ud83d\ude05\n\nMonths of work come down to today.\n\nIf you\'ve ever freelanced on Upwork, I\'d love 2 minutes of your time \u2192 ' + PH_URL },
    { id: 't14', category: 'behind-the-scenes', phase: 'post', dayOffset: 1,
      text: 'Day 1 recap:\n\nLaunched on Product Hunt. The response has been incredible.\n\nThank you to everyone who supported us. This is just the beginning.\n\nIf you haven\'t checked it out yet \u2192 ' + SITE_URL },

    // Testimonials (15-17)
    { id: 't15', category: 'testimonial', phase: 'post', dayOffset: 2,
      text: '"I went from a 48 to a 79 profile score. Got 3 new interview invites that same week."\n\nReal results from a real Upwork freelancer.\n\nSee what your score is \u2192 ' + SITE_URL },
    { id: 't16', category: 'testimonial', phase: 'post', dayOffset: 4,
      text: '"The proposal generator saved me hours. My response rate went from 5% to 22%."\n\nFreelancers are seeing real ROI with Cortex.\n\nTry it free \u2192 ' + SITE_URL },
    { id: 't17', category: 'testimonial', phase: 'post', dayOffset: 5,
      text: '"Finally, a tool that actually understands Upwork."\n\nBuilt by freelancers, for freelancers.\n\n' + SITE_URL },

    // Engagement / CTA (18-20)
    { id: 't18', category: 'engagement', phase: 'launch', dayOffset: 0,
      text: 'Question for Upwork freelancers:\n\nWhat\'s the #1 thing you struggle with?\n\n\ud83d\udd04 RT if it\'s finding the right clients\n\u2764\ufe0f Like if it\'s writing proposals\n\ud83d\udcac Reply if it\'s something else\n\nWe built tools for all of these \u2192 ' + SITE_URL },
    { id: 't19', category: 'engagement', phase: 'post', dayOffset: 3,
      text: 'Drop your Upwork profile link below \u2b07\ufe0f\n\nI\'ll give you a free mini-audit with tips to improve your score.\n\n(Yes, really. First 20 replies.)\n\n#Upwork #Freelancing' },
    { id: 't20', category: 'engagement', phase: 'post', dayOffset: 6,
      text: 'If you missed our Product Hunt launch:\n\nCortex Freelancer is live and free to try.\n\n\u2705 Profile Analyzer\n\u2705 Proposal Generator\n\u2705 Rate Calculator\n\u2705 Bid Strategy\n\nAll free. No signup required.\n\n' + SITE_URL }
  ];

  /**
   * Get all tweet templates.
   * @param {string} [category] - Filter by category
   * @returns {object[]}
   */
  TwitterLaunchManager.prototype.getTweets = function (category) {
    if (!category) return TWEET_TEMPLATES.slice();
    return TWEET_TEMPLATES.filter(function (t) { return t.category === category; });
  };

  /**
   * Get a tweet by ID.
   * @param {string} id
   * @returns {object|null}
   */
  TwitterLaunchManager.prototype.getTweetById = function (id) {
    for (var i = 0; i < TWEET_TEMPLATES.length; i++) {
      if (TWEET_TEMPLATES[i].id === id) return TWEET_TEMPLATES[i];
    }
    return null;
  };

  /**
   * Get tweet categories.
   * @returns {string[]}
   */
  TwitterLaunchManager.prototype.getCategories = function () {
    return ['countdown', 'feature', 'behind-the-scenes', 'testimonial', 'engagement'];
  };

  // --- Scheduling Logic ---

  /**
   * Schedule a tweet for a specific date/time.
   * @param {string} tweetId
   * @param {string} scheduledAt - ISO date string
   */
  TwitterLaunchManager.prototype.scheduleTweet = function (tweetId, scheduledAt) {
    this._schedule[tweetId] = {
      scheduledAt: scheduledAt,
      posted: false,
      scheduledOn: new Date().toISOString()
    };
    this._saveSchedule();
  };

  /**
   * Mark a tweet as posted.
   * @param {string} tweetId
   */
  TwitterLaunchManager.prototype.markPosted = function (tweetId) {
    if (this._schedule[tweetId]) {
      this._schedule[tweetId].posted = true;
      this._schedule[tweetId].postedAt = new Date().toISOString();
      this._saveSchedule();
    }
  };

  /**
   * Auto-schedule all tweets based on launch date.
   * Distributes tweets across optimal times (9am, 12pm, 5pm).
   */
  TwitterLaunchManager.prototype.autoSchedule = function () {
    if (!this.launchDate) return;

    var postTimes = [9, 12, 17]; // Hours to post
    var self = this;

    TWEET_TEMPLATES.forEach(function (tweet, index) {
      var date = new Date(self.launchDate);
      date.setDate(date.getDate() + tweet.dayOffset);
      date.setHours(postTimes[index % postTimes.length], 0, 0, 0);
      self.scheduleTweet(tweet.id, date.toISOString());
    });
  };

  /**
   * Get the full schedule with tweet data.
   * @returns {object[]}
   */
  TwitterLaunchManager.prototype.getSchedule = function () {
    var schedule = this._schedule;
    return TWEET_TEMPLATES.map(function (tweet) {
      var entry = schedule[tweet.id] || {};
      return {
        id: tweet.id,
        category: tweet.category,
        phase: tweet.phase,
        text: tweet.text,
        scheduledAt: entry.scheduledAt || null,
        posted: !!entry.posted,
        postedAt: entry.postedAt || null
      };
    }).sort(function (a, b) {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt) - new Date(b.scheduledAt);
    });
  };

  /**
   * Get tweets due for posting (scheduled but not yet posted, time has passed).
   * @returns {object[]}
   */
  TwitterLaunchManager.prototype.getDueTweets = function () {
    var now = new Date();
    return this.getSchedule().filter(function (t) {
      return t.scheduledAt && !t.posted && new Date(t.scheduledAt) <= now;
    });
  };

  // --- Content Calendar View ---

  /**
   * Render a content calendar as HTML.
   * @returns {string}
   */
  TwitterLaunchManager.prototype.renderCalendar = function () {
    var schedule = this.getSchedule();
    var grouped = {};

    schedule.forEach(function (entry) {
      var dateKey = entry.scheduledAt
        ? new Date(entry.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Unscheduled';
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(entry);
    });

    var html = '<div class="twitter-calendar">';
    var days = Object.keys(grouped);

    days.forEach(function (day) {
      html += '<div class="twitter-calendar__day">';
      html += '<h3 class="twitter-calendar__date">' + day + '</h3>';
      grouped[day].forEach(function (entry) {
        var statusClass = entry.posted ? 'twitter-calendar__tweet--posted' : '';
        var time = entry.scheduledAt
          ? new Date(entry.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
          : '';
        html += '<div class="twitter-calendar__tweet ' + statusClass + '">' +
          '<span class="twitter-calendar__time">' + time + '</span>' +
          '<span class="twitter-calendar__category">' + entry.category + '</span>' +
          '<p class="twitter-calendar__preview">' + entry.text.substring(0, 100) + '...</p>' +
          (entry.posted ? '<span class="twitter-calendar__status">\u2705 Posted</span>' : '') +
        '</div>';
      });
      html += '</div>';
    });

    html += '</div>';
    return html;
  };

  /**
   * Generate a Twitter intent URL to post a tweet.
   * @param {string} tweetId
   * @returns {string}
   */
  TwitterLaunchManager.prototype.getPostUrl = function (tweetId) {
    var tweet = this.getTweetById(tweetId);
    if (!tweet) return '';
    return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet.text);
  };

  // --- Persistence ---

  TwitterLaunchManager.prototype._loadSchedule = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_e) { return {}; }
  };

  TwitterLaunchManager.prototype._saveSchedule = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._schedule)); } catch (_e) {}
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TwitterLaunchManager = TwitterLaunchManager;
})();
