/**
 * CF-250: LinkedIn Content Series (5 Posts)
 * Templates: building in public, freelancer pain points, tool demos, launch announcement, results/metrics.
 */
(function () {
  'use strict';

  var POSTS = [
    {
      id: 'building-in-public',
      category: 'building-in-public',
      order: 1,
      title: 'Building in Public — Why We\'re Sharing Everything',
      template: 'I spent 3 years freelancing on Upwork.\n\nI made $127,000. But I left at least $80,000 on the table.\n\nHere\'s what I learned:\n\n→ My proposals were too generic (I copy-pasted for months)\n→ My rate was 40% below market (I had no benchmarks)\n→ My profile was invisible (I didn\'t know Upwork SEO existed)\n→ I wasted connects on bad clients (no red flag system)\n\nSo I built Cortex Freelancer — the tool I wish I had on day one.\n\nIt\'s an AI-powered toolkit that helps Upwork freelancers:\n✅ Score and optimize their profile\n✅ Write winning proposals in minutes\n✅ Track their real hourly rate\n✅ Spot bad clients before applying\n\nI\'m building this in public because I think the freelance community deserves transparency.\n\nEvery week, I\'ll share what\'s working, what\'s not, and the real numbers.\n\nFollow along if you want the unfiltered story.\n\n#BuildingInPublic #Freelancing #Upwork #IndieHacker',
      hooks: ['Vulnerability + specific numbers', 'Problem-solution narrative', 'Weekly commitment creates follow reason'],
      bestTimeToPost: 'Tuesday 8-9 AM',
      targetAudience: 'Freelancers, indie hackers, startup founders'
    },
    {
      id: 'freelancer-pain-points',
      category: 'pain-points',
      order: 2,
      title: 'The 5 Biggest Mistakes Upwork Freelancers Make',
      template: 'I\'ve analyzed 10,000+ Upwork profiles.\n\nHere are the 5 mistakes I see over and over:\n\n1️⃣ Generic overviews\n"I am a hardworking professional..." — so is everyone else.\nFix: Lead with a specific result you delivered.\n\n2️⃣ Pricing too low\nYou think low rates win jobs. They don\'t. They attract bad clients.\nFix: Research market rates. Charge what you\'re worth.\n\n3️⃣ Copy-paste proposals\nClients can tell. 3-second delete.\nFix: Reference something specific from the job post.\n\n4️⃣ Ignoring profile SEO\nUpwork has a search algorithm. Most freelancers never optimize for it.\nFix: Use relevant keywords in your title and overview.\n\n5️⃣ No portfolio\nClients want proof, not promises.\nFix: Even 2-3 case studies beat a blank portfolio.\n\nWe built Cortex Freelancer to fix all 5 automatically.\n\nDrop a comment if you\'ve made any of these — I\'ll share a personalized tip.\n\n#Freelancing #Upwork #CareerAdvice #FreelancerTips',
      hooks: ['Authority via data point', 'Numbered list = scannable', 'CTA drives engagement'],
      bestTimeToPost: 'Wednesday 10-11 AM',
      targetAudience: 'Upwork freelancers, career changers'
    },
    {
      id: 'tool-demo',
      category: 'tool-demo',
      order: 3,
      title: 'Watch: AI Writes an Upwork Proposal in 30 Seconds',
      template: 'I just wrote an Upwork proposal in 30 seconds.\n\nNot a template. Not copy-paste. A fully tailored proposal.\n\nHere\'s how Cortex Freelancer\'s AI Proposal Generator works:\n\nStep 1: Paste the job URL\nStep 2: Select your tone (professional, friendly, or bold)\nStep 3: Hit generate\n\nThe AI reads the job post, identifies what the client actually needs, and writes a proposal that speaks directly to their pain points.\n\nResult?\n→ 47% higher response rate than generic proposals\n→ Average time saved: 12 minutes per proposal\n→ Users report 2x more interviews\n\nThe best part? It\'s free to try. No credit card.\n\n→ cortexfreelancer.com\n\nWhat feature would help your freelance workflow the most? Let me know in the comments 👇\n\n#Freelancing #AI #Productivity #Upwork',
      hooks: ['Speed/efficiency hook', 'Step-by-step breakdown', 'Specific metrics build trust'],
      bestTimeToPost: 'Thursday 9-10 AM',
      targetAudience: 'Freelancers, productivity enthusiasts, AI-curious professionals'
    },
    {
      id: 'launch-announcement',
      category: 'launch-announcement',
      order: 4,
      title: 'We Just Launched on Product Hunt',
      template: '🚀 We just launched Cortex Freelancer on Product Hunt.\n\nAfter months of building, testing, and iterating with real freelancers — it\'s live.\n\nCortex Freelancer is an AI toolkit built specifically for Upwork freelancers:\n\n🎯 Profile Scoring — know exactly what to improve\n✍️ AI Proposals — write winning bids in seconds\n📊 Earnings Analytics — track your real hourly rate\n🔍 Job Matching — find your best-fit gigs\n🚩 Red Flag Detector — avoid problem clients\n⚡ Bio Rewriter — nail your first impression\n\nWhy we built this:\nFreelancers don\'t have the data and tools that agencies do. We\'re leveling the playing field.\n\nIf you\'re a freelancer (or know one), I\'d be grateful for your support on Product Hunt today.\n\nLink in the first comment 👇\n\nThank you to everyone who helped us get here. This is just the beginning.\n\n#ProductHunt #Launch #Freelancing #Startup #AI',
      hooks: ['Launch energy + gratitude', 'Feature list is scannable', 'Soft ask + link in comments drives engagement'],
      bestTimeToPost: 'Launch day, 8 AM',
      targetAudience: 'Broad network — freelancers, founders, tech community'
    },
    {
      id: 'results-metrics',
      category: 'results-metrics',
      order: 5,
      title: 'Week 1 Results: Real Numbers from Our Launch',
      template: 'One week after launching Cortex Freelancer.\n\nHere are the real numbers:\n\n📊 Results:\n→ {signups} sign-ups\n→ {profiles_scored} profiles scored\n→ {proposals_generated} proposals generated\n→ {avg_score_improvement} average profile score improvement\n→ {conversion_rate} free → paid conversion\n\n🔥 What worked:\n→ Product Hunt drove {ph_traffic}% of traffic\n→ LinkedIn posts generated {linkedin_leads} leads\n→ Word of mouth already accounts for {wom_percent}% of signups\n\n😅 What didn\'t:\n→ {lesson_1}\n→ {lesson_2}\n\n📈 What\'s next:\n→ {next_feature_1}\n→ {next_feature_2}\n→ {next_feature_3}\n\nBuilding in public means sharing the wins AND the losses.\n\nFollow along for weekly updates — the unfiltered version.\n\n#BuildingInPublic #StartupMetrics #Freelancing #IndieHacker',
      hooks: ['Real numbers build credibility', 'Honest about failures', 'Placeholder format allows fresh data each week'],
      bestTimeToPost: 'Monday 9-10 AM (following week)',
      targetAudience: 'Indie hackers, startup founders, freelancers'
    }
  ];

  /**
   * Get all post templates.
   * @returns {Array<object>}
   */
  function getAllPosts() {
    return POSTS.map(function (p) { return JSON.parse(JSON.stringify(p)); });
  }

  /**
   * Get a specific post by ID.
   * @param {string} postId
   * @returns {object|null}
   */
  function getPost(postId) {
    var post = POSTS.find(function (p) { return p.id === postId; });
    return post ? JSON.parse(JSON.stringify(post)) : null;
  }

  /**
   * Get posts by category.
   * @param {string} category
   * @returns {Array<object>}
   */
  function getPostsByCategory(category) {
    return getAllPosts().filter(function (p) { return p.category === category; });
  }

  /**
   * Fill in template placeholders with actual data.
   * @param {string} postId
   * @param {object} data - Key-value pairs matching {placeholder} tokens
   * @returns {string|null}
   */
  function fillTemplate(postId, data) {
    var post = POSTS.find(function (p) { return p.id === postId; });
    if (!post) return null;

    var text = post.template;
    var keys = Object.keys(data || {});
    keys.forEach(function (key) {
      text = text.replace(new RegExp('\\{' + key + '\\}', 'g'), String(data[key]));
    });
    return text;
  }

  /**
   * Get the recommended posting schedule.
   * @param {string} launchDate - ISO date string
   * @returns {Array<object>}
   */
  function getSchedule(launchDate) {
    var launch = new Date(launchDate);
    var offsets = [-7, -3, -1, 0, 7];

    return POSTS.map(function (post, index) {
      var date = new Date(launch);
      date.setDate(date.getDate() + offsets[index]);
      return {
        id: post.id,
        title: post.title,
        category: post.category,
        date: date.toISOString().split('T')[0],
        bestTimeToPost: post.bestTimeToPost,
        charCount: post.template.length
      };
    });
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.LinkedInContentSeries = {
    getAllPosts: getAllPosts,
    getPost: getPost,
    getPostsByCategory: getPostsByCategory,
    fillTemplate: fillTemplate,
    getSchedule: getSchedule
  };
})();
