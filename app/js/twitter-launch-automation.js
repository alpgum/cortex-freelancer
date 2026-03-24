/**
 * CF-249: Twitter/X Automation for Launch
 * 20 launch tweet templates: countdown, feature spotlights, behind-the-scenes, testimonials.
 */
(function () {
  'use strict';

  var TWEETS = [
    // Countdown (5)
    {
      id: 'countdown-5',
      category: 'countdown',
      dayOffset: -5,
      template: '5 days until launch day 🚀\n\nWe\'ve been building something for freelancers who are tired of guessing what works on Upwork.\n\nCortex Freelancer drops this week.\n\n#freelancing #upwork #buildinpublic'
    },
    {
      id: 'countdown-4',
      category: 'countdown',
      dayOffset: -4,
      template: '4 days to go.\n\nDid you know the average Upwork proposal gets ignored within 3 seconds?\n\nWe built an AI that writes proposals clients actually read.\n\nLaunching soon → cortexfreelancer.com\n\n#freelancerlife #upwork'
    },
    {
      id: 'countdown-3',
      category: 'countdown',
      dayOffset: -3,
      template: '3 days.\n\nSneak peek: your Upwork profile has a hidden score. Most freelancers never optimize it.\n\nCortex Freelancer shows you exactly what to fix.\n\nDrop a 🎯 if you want early access.\n\n#upwork #freelancing'
    },
    {
      id: 'countdown-2',
      category: 'countdown',
      dayOffset: -2,
      template: '2 days until we launch on @ProductHunt 🏹\n\nHere\'s what Cortex Freelancer does in 30 seconds:\n\n→ Scores your profile\n→ Writes winning proposals\n→ Tracks your real hourly rate\n→ Finds your best-fit jobs\n\nAll powered by AI. All free to start.\n\n#producthunt'
    },
    {
      id: 'countdown-1',
      category: 'countdown',
      dayOffset: -1,
      template: 'Tomorrow is the day. 🔥\n\nCortex Freelancer launches on @ProductHunt at midnight PT.\n\nIf you freelance on Upwork, this was built for you.\n\nLink in bio → we\'d love your support!\n\n#producthunt #launch #freelancing'
    },
    // Feature spotlights (5)
    {
      id: 'feature-profile',
      category: 'feature-spotlight',
      dayOffset: 0,
      template: '🎯 Feature Spotlight: Profile Scoring\n\nPaste your Upwork profile and get an instant score out of 100.\n\nSee exactly what\'s holding you back — and what to fix first.\n\nTry it free → cortexfreelancer.com\n\n#upwork #freelancing'
    },
    {
      id: 'feature-proposal',
      category: 'feature-spotlight',
      dayOffset: 1,
      template: '✍️ Feature Spotlight: AI Proposal Generator\n\nStop copy-pasting the same proposal for every job.\n\nCortex reads the job post and writes a tailored proposal that actually addresses what the client needs.\n\nResult: 47% higher win rates.\n\n#freelancertools'
    },
    {
      id: 'feature-earnings',
      category: 'feature-spotlight',
      dayOffset: 2,
      template: '📊 Feature Spotlight: Earnings Analytics\n\nDo you know your real hourly rate? (Hint: it\'s probably lower than you think.)\n\nCortex tracks everything — hours, fees, revisions — to show your actual earnings per hour.\n\nKnowledge is power.\n\n#freelancing'
    },
    {
      id: 'feature-redflag',
      category: 'feature-spotlight',
      dayOffset: 3,
      template: '🚩 Feature Spotlight: Red Flag Detector\n\nBefore you spend connects, Cortex scans job posts for:\n\n→ Unrealistic budgets\n→ Scope creep indicators\n→ Low-quality client signals\n\nSave your connects. Save your sanity.\n\n#upwork #freelancertips'
    },
    {
      id: 'feature-bio',
      category: 'feature-spotlight',
      dayOffset: 4,
      template: '⚡ Feature Spotlight: Bio Rewriter\n\nYour Upwork overview is your first impression.\n\nCortex rewrites it in 3 tones:\n• Professional\n• Friendly\n• Bold\n\nPick the one that lands you more interviews.\n\n#freelancing #upwork'
    },
    // Behind-the-scenes (5)
    {
      id: 'bts-origin',
      category: 'behind-the-scenes',
      dayOffset: -7,
      template: 'The story behind Cortex Freelancer:\n\nI spent 3 years freelancing on Upwork. Made every mistake — bad proposals, wrong pricing, terrible clients.\n\nSo I built the tool I wish I had on day one.\n\nThread 🧵\n\n#buildinpublic #indiehacker'
    },
    {
      id: 'bts-tech',
      category: 'behind-the-scenes',
      dayOffset: -6,
      template: 'Behind the scenes: our tech stack\n\n→ AI-powered analysis (not just keyword matching)\n→ Real Upwork data patterns\n→ Privacy-first: your data never leaves your session\n\nBuilding AI tools that actually respect users.\n\n#buildinpublic #ai'
    },
    {
      id: 'bts-design',
      category: 'behind-the-scenes',
      dayOffset: -4,
      template: 'We redesigned the dashboard 4 times before it clicked.\n\nFreelancers don\'t want dashboards. They want answers.\n\n"What should I fix?"\n"Is this job worth it?"\n"Am I charging enough?"\n\nSo that\'s what we built.\n\n#ux #buildinpublic'
    },
    {
      id: 'bts-users',
      category: 'behind-the-scenes',
      dayOffset: -2,
      template: 'We gave early access to 50 freelancers.\n\nThe #1 feature request surprised us: it wasn\'t AI proposals or profile scoring.\n\nIt was the earnings tracker.\n\nTurns out most freelancers have no idea what they actually earn per hour.\n\n#buildinpublic'
    },
    {
      id: 'bts-launch',
      category: 'behind-the-scenes',
      dayOffset: 0,
      template: 'Launch day. Can\'t sleep. 😅\n\nMonths of building, testing, iterating — it all comes down to today.\n\nIf you\'re a freelancer, I genuinely think this will help you.\n\nGo check it out and let me know what you think!\n\n→ cortexfreelancer.com\n\n#producthunt'
    },
    // Testimonials (5)
    {
      id: 'testimonial-1',
      category: 'testimonial',
      dayOffset: 1,
      template: '"Cortex helped me double my Upwork earnings in 3 months."\n\n— Sarah K., UX Designer\n\nThis is why we built Cortex Freelancer.\n\nTry it free → cortexfreelancer.com\n\n#upwork #freelancing'
    },
    {
      id: 'testimonial-2',
      category: 'testimonial',
      dayOffset: 2,
      template: '"The proposal generator alone saved me 10 hours a week."\n\n— Marcus T., Full-Stack Developer\n\n10 hours. Every. Week.\n\nThat\'s 520 hours a year back in your life.\n\n#freelancertools #productivity'
    },
    {
      id: 'testimonial-3',
      category: 'testimonial',
      dayOffset: 3,
      template: '"I went from $25/hr to $75/hr in 6 months. The rate benchmarking was a game-changer."\n\n— David L., WordPress Developer\n\nMost freelancers undercharge. Cortex shows you what you\'re worth.\n\n#freelancing #upwork'
    },
    {
      id: 'testimonial-4',
      category: 'testimonial',
      dayOffset: 5,
      template: '"Finally, a tool that actually understands how Upwork works."\n\n— Priya M., Content Writer\n\nWe didn\'t build generic freelancer software.\n\nWe built it specifically for Upwork. Every feature. Every insight.\n\n#upwork #freelancerlife'
    },
    {
      id: 'testimonial-5',
      category: 'testimonial',
      dayOffset: 7,
      template: '"The red flag detector saved me from a nightmare client. Worth it for that alone."\n\n— Jake R., Graphic Designer\n\nBad clients cost more than lost time. They cost your sanity.\n\nScreen smarter → cortexfreelancer.com\n\n#freelancing'
    }
  ];

  /**
   * Get all tweet templates.
   * @returns {Array<object>}
   */
  function getAllTweets() {
    return TWEETS.map(function (t) { return JSON.parse(JSON.stringify(t)); });
  }

  /**
   * Get tweets by category.
   * @param {"countdown"|"feature-spotlight"|"behind-the-scenes"|"testimonial"} category
   * @returns {Array<object>}
   */
  function getTweetsByCategory(category) {
    return getAllTweets().filter(function (t) { return t.category === category; });
  }

  /**
   * Get the tweet scheduled for a specific day offset from launch.
   * @param {number} dayOffset - Days relative to launch (negative = before, 0 = launch day)
   * @returns {Array<object>}
   */
  function getTweetsForDay(dayOffset) {
    return getAllTweets().filter(function (t) { return t.dayOffset === dayOffset; });
  }

  /**
   * Generate a launch schedule sorted by day.
   * @param {string} launchDate - ISO date string of launch day
   * @returns {Array<object>} Schedule with absolute dates
   */
  function generateSchedule(launchDate) {
    var launch = new Date(launchDate);
    return getAllTweets()
      .sort(function (a, b) { return a.dayOffset - b.dayOffset; })
      .map(function (tweet) {
        var date = new Date(launch);
        date.setDate(date.getDate() + tweet.dayOffset);
        return {
          id: tweet.id,
          category: tweet.category,
          date: date.toISOString().split('T')[0],
          dayOffset: tweet.dayOffset,
          template: tweet.template,
          charCount: tweet.template.length
        };
      });
  }

  /**
   * Customize a tweet template with dynamic values.
   * @param {string} tweetId
   * @param {object} replacements - Key-value pairs to replace in the template
   * @returns {string|null}
   */
  function customizeTweet(tweetId, replacements) {
    var tweet = TWEETS.find(function (t) { return t.id === tweetId; });
    if (!tweet) return null;

    var text = tweet.template;
    var keys = Object.keys(replacements || {});
    keys.forEach(function (key) {
      text = text.replace(new RegExp('\\{' + key + '\\}', 'g'), replacements[key]);
    });
    return text;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TwitterLaunchAutomation = {
    getAllTweets: getAllTweets,
    getTweetsByCategory: getTweetsByCategory,
    getTweetsForDay: getTweetsForDay,
    generateSchedule: generateSchedule,
    customizeTweet: customizeTweet
  };
})();
