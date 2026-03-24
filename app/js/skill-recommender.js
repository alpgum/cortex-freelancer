/**
 * CF-005: Skill Tag Recommendation Engine
 * Analyzes user's current skills vs job market demand per category,
 * recommends additions/removals with reasoning.
 */
(function () {
  'use strict';

  /**
   * Hardcoded market demand data per category.
   * demandScore: 1-100 representing relative demand on Upwork.
   * @type {Record<string, {skill: string, demandScore: number}[]>}
   */
  const MARKET_DEMAND = {
    'Web Development': [
      { skill: 'React', demandScore: 95 },
      { skill: 'Next.js', demandScore: 88 },
      { skill: 'TypeScript', demandScore: 92 },
      { skill: 'Node.js', demandScore: 90 },
      { skill: 'Tailwind CSS', demandScore: 85 },
      { skill: 'Vue.js', demandScore: 75 },
      { skill: 'GraphQL', demandScore: 72 },
      { skill: 'PostgreSQL', demandScore: 78 },
      { skill: 'MongoDB', demandScore: 70 },
      { skill: 'AWS', demandScore: 82 },
      { skill: 'Docker', demandScore: 76 },
      { skill: 'REST API', demandScore: 88 },
      { skill: 'Python', demandScore: 80 },
      { skill: 'WordPress', demandScore: 65 },
      { skill: 'Shopify', demandScore: 68 },
      { skill: 'Firebase', demandScore: 71 },
      { skill: 'Vercel', demandScore: 64 },
      { skill: 'Prisma', demandScore: 62 },
      { skill: 'Svelte', demandScore: 55 },
      { skill: 'Angular', demandScore: 60 }
    ],
    'Mobile Development': [
      { skill: 'React Native', demandScore: 92 },
      { skill: 'Flutter', demandScore: 88 },
      { skill: 'Swift', demandScore: 80 },
      { skill: 'Kotlin', demandScore: 78 },
      { skill: 'iOS Development', demandScore: 85 },
      { skill: 'Android Development', demandScore: 83 },
      { skill: 'Firebase', demandScore: 75 },
      { skill: 'TypeScript', demandScore: 74 },
      { skill: 'REST API', demandScore: 72 },
      { skill: 'App Store Optimization', demandScore: 60 },
      { skill: 'Push Notifications', demandScore: 55 },
      { skill: 'GraphQL', demandScore: 58 },
      { skill: 'Expo', demandScore: 65 },
      { skill: 'Dart', demandScore: 70 },
      { skill: 'CI/CD', demandScore: 52 }
    ],
    'Design': [
      { skill: 'Figma', demandScore: 95 },
      { skill: 'UI Design', demandScore: 92 },
      { skill: 'UX Design', demandScore: 90 },
      { skill: 'Adobe Photoshop', demandScore: 75 },
      { skill: 'Adobe Illustrator', demandScore: 72 },
      { skill: 'Branding', demandScore: 78 },
      { skill: 'Prototyping', demandScore: 82 },
      { skill: 'Design Systems', demandScore: 80 },
      { skill: 'Responsive Design', demandScore: 85 },
      { skill: 'Wireframing', demandScore: 77 },
      { skill: 'User Research', demandScore: 70 },
      { skill: 'Motion Design', demandScore: 65 },
      { skill: 'Webflow', demandScore: 68 },
      { skill: 'Adobe XD', demandScore: 45 },
      { skill: 'Sketch', demandScore: 40 }
    ],
    'Writing': [
      { skill: 'SEO Writing', demandScore: 90 },
      { skill: 'Copywriting', demandScore: 88 },
      { skill: 'Blog Writing', demandScore: 82 },
      { skill: 'Technical Writing', demandScore: 85 },
      { skill: 'Content Strategy', demandScore: 80 },
      { skill: 'Ghostwriting', demandScore: 72 },
      { skill: 'Email Marketing', demandScore: 78 },
      { skill: 'Social Media Content', demandScore: 75 },
      { skill: 'AI Prompt Writing', demandScore: 70 },
      { skill: 'UX Writing', demandScore: 68 },
      { skill: 'Editing', demandScore: 65 },
      { skill: 'Grant Writing', demandScore: 55 },
      { skill: 'Press Release', demandScore: 50 },
      { skill: 'Scriptwriting', demandScore: 48 },
      { skill: 'White Paper', demandScore: 60 }
    ],
    'Data Science': [
      { skill: 'Python', demandScore: 95 },
      { skill: 'Machine Learning', demandScore: 90 },
      { skill: 'SQL', demandScore: 88 },
      { skill: 'Data Analysis', demandScore: 92 },
      { skill: 'Pandas', demandScore: 85 },
      { skill: 'TensorFlow', demandScore: 78 },
      { skill: 'Power BI', demandScore: 80 },
      { skill: 'Tableau', demandScore: 75 },
      { skill: 'R', demandScore: 55 },
      { skill: 'NLP', demandScore: 72 },
      { skill: 'Deep Learning', demandScore: 70 },
      { skill: 'Data Visualization', demandScore: 77 },
      { skill: 'BigQuery', demandScore: 65 },
      { skill: 'Apache Spark', demandScore: 60 },
      { skill: 'ETL', demandScore: 68 }
    ],
    'Marketing': [
      { skill: 'Google Ads', demandScore: 92 },
      { skill: 'Facebook Ads', demandScore: 90 },
      { skill: 'SEO', demandScore: 88 },
      { skill: 'Social Media Marketing', demandScore: 85 },
      { skill: 'Email Marketing', demandScore: 82 },
      { skill: 'Content Marketing', demandScore: 80 },
      { skill: 'Google Analytics', demandScore: 78 },
      { skill: 'TikTok Ads', demandScore: 75 },
      { skill: 'Conversion Optimization', demandScore: 72 },
      { skill: 'Marketing Strategy', demandScore: 70 },
      { skill: 'HubSpot', demandScore: 65 },
      { skill: 'Klaviyo', demandScore: 62 },
      { skill: 'Influencer Marketing', demandScore: 58 },
      { skill: 'PPC', demandScore: 76 },
      { skill: 'Marketing Automation', demandScore: 68 }
    ],
    'DevOps': [
      { skill: 'AWS', demandScore: 95 },
      { skill: 'Docker', demandScore: 92 },
      { skill: 'Kubernetes', demandScore: 88 },
      { skill: 'CI/CD', demandScore: 90 },
      { skill: 'Terraform', demandScore: 85 },
      { skill: 'Linux', demandScore: 82 },
      { skill: 'GitHub Actions', demandScore: 78 },
      { skill: 'Azure', demandScore: 75 },
      { skill: 'GCP', demandScore: 72 },
      { skill: 'Ansible', demandScore: 65 },
      { skill: 'Monitoring', demandScore: 70 },
      { skill: 'Nginx', demandScore: 60 },
      { skill: 'Bash/Shell', demandScore: 68 },
      { skill: 'Jenkins', demandScore: 55 },
      { skill: 'Serverless', demandScore: 74 }
    ]
  };

  /** Skills that are declining or oversaturated — suggest removal */
  const DECLINING_SKILLS = new Map([
    ['jQuery', 'Declining demand; modern frameworks preferred'],
    ['Adobe Flash', 'Deprecated technology'],
    ['Adobe XD', 'Figma has become the industry standard'],
    ['Sketch', 'Figma has largely replaced Sketch on Upwork'],
    ['AngularJS', 'AngularJS (v1) is end-of-life; use Angular if applicable'],
    ['PHP', 'Demand declining outside WordPress; consider specifying Laravel if relevant'],
    ['Objective-C', 'Swift is the preferred iOS language'],
    ['CoffeeScript', 'TypeScript/ES6+ have replaced CoffeeScript'],
    ['Backbone.js', 'Outdated framework — React/Vue preferred'],
    ['LESS', 'Tailwind CSS and Sass have higher demand'],
    ['Grunt', 'Build tools have moved to Vite/Webpack/Turbopack'],
    ['Bower', 'Package manager is deprecated'],
    ['Dreamweaver', 'No longer used in modern workflows']
  ]);

  /**
   * Normalize a skill string for comparison.
   * @param {string} s
   * @returns {string}
   */
  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Recommend skill additions, removals, and trending skills.
   * @param {string[]} currentSkills - User's current skill tags
   * @param {string} category - Upwork category (e.g. "Web Development")
   * @returns {{add: {skill: string, reason: string, demandScore: number}[], remove: {skill: string, reason: string}[], trending: {skill: string, demandScore: number}[]}}
   */
  function recommendSkills(currentSkills, category) {
    const normalizedCurrent = new Set((currentSkills || []).map(normalize));
    const categoryData = MARKET_DEMAND[category] || [];

    // Skills to add: high-demand skills user doesn't have
    const add = categoryData
      .filter(d => !normalizedCurrent.has(normalize(d.skill)))
      .filter(d => d.demandScore >= 65)
      .sort((a, b) => b.demandScore - a.demandScore)
      .slice(0, 10)
      .map(d => ({
        skill: d.skill,
        reason: `High demand in ${category} (${d.demandScore}/100). Adding this can increase profile visibility.`,
        demandScore: d.demandScore
      }));

    // Skills to remove: declining/oversaturated
    const remove = (currentSkills || [])
      .filter(s => DECLINING_SKILLS.has(s))
      .map(s => ({
        skill: s,
        reason: DECLINING_SKILLS.get(s)
      }));

    // Also flag skills not relevant to category (low demand)
    if (categoryData.length > 0) {
      const categoryNorm = new Set(categoryData.map(d => normalize(d.skill)));
      const lowDemand = categoryData.filter(d => d.demandScore < 50);
      const lowDemandNorm = new Set(lowDemand.map(d => normalize(d.skill)));

      (currentSkills || []).forEach(s => {
        const n = normalize(s);
        if (lowDemandNorm.has(n) && !DECLINING_SKILLS.has(s)) {
          const entry = lowDemand.find(d => normalize(d.skill) === n);
          if (entry) {
            remove.push({
              skill: s,
              reason: `Low demand in ${category} (${entry.demandScore}/100). Consider replacing with a higher-demand skill.`
            });
          }
        }
      });
    }

    // Trending: top 5 skills by demand in category
    const trending = categoryData
      .sort((a, b) => b.demandScore - a.demandScore)
      .slice(0, 5)
      .map(d => ({ skill: d.skill, demandScore: d.demandScore }));

    return { add, remove, trending };
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.SkillRecommender = {
    recommendSkills: recommendSkills,
    getCategories: function () { return Object.keys(MARKET_DEMAND); }
  };
})();
