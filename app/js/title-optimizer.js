/**
 * CF-003: Upwork Profile Title Keyword Optimizer
 * Extracts keywords from a title, compares against top keywords per category,
 * and suggests improvements.
 */
(function () {
  'use strict';

  /** Top keywords by freelancer category */
  const TOP_KEYWORDS = {
    'web dev': [
      'React', 'Node.js', 'TypeScript', 'Next.js', 'Full-Stack',
      'JavaScript', 'Python', 'Django', 'REST API', 'GraphQL',
      'Vue.js', 'Angular', 'AWS', 'PostgreSQL', 'MongoDB',
      'Tailwind CSS', 'WordPress', 'PHP', 'Laravel', 'Ruby on Rails'
    ],
    design: [
      'UI/UX', 'Figma', 'Web Design', 'Mobile Design', 'Design Systems',
      'User Research', 'Wireframing', 'Prototyping', 'Adobe XD', 'Sketch',
      'Responsive Design', 'Brand Identity', 'Illustration', 'Logo Design',
      'Motion Graphics', 'Adobe Photoshop', 'Adobe Illustrator', 'Interaction Design'
    ],
    writing: [
      'SEO', 'Content Strategy', 'Copywriting', 'Blog Writing', 'Technical Writing',
      'Ghostwriting', 'B2B', 'B2C', 'Email Marketing', 'Landing Pages',
      'Content Marketing', 'Article Writing', 'Creative Writing', 'Grant Writing',
      'White Papers', 'Press Releases', 'Editing', 'Proofreading'
    ],
    marketing: [
      'Digital Marketing', 'SEO', 'PPC', 'Google Ads', 'Facebook Ads',
      'Social Media', 'Growth Marketing', 'Analytics', 'Conversion Optimization',
      'Email Marketing', 'Content Marketing', 'Marketing Strategy', 'Branding',
      'Lead Generation', 'Marketing Automation', 'HubSpot', 'Shopify'
    ],
    data: [
      'Data Analysis', 'Python', 'SQL', 'Tableau', 'Power BI',
      'Machine Learning', 'Data Science', 'ETL', 'Business Intelligence',
      'R', 'Excel', 'Data Visualization', 'Statistical Analysis', 'Big Data',
      'Data Engineering', 'Pandas', 'TensorFlow', 'NLP'
    ]
  };

  /** Power words that boost click-through */
  const POWER_WORDS = [
    'Expert', 'Senior', 'Specialist', 'Certified', 'Top-Rated',
    'Proven', 'Results-Driven', 'Award-Winning', 'Lead', 'Principal'
  ];

  /**
   * Normalize a string for comparison (lowercase, trim).
   * @param {string} str
   * @returns {string}
   */
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  /**
   * Extract meaningful keywords from a title.
   * @param {string} title
   * @returns {string[]}
   */
  function extractKeywords(title) {
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'on', 'at',
      'to', 'of', 'i', 'am', 'is', 'are', 'my', 'your', '&', '-', '|',
      'who', 'that', 'this', 'can', 'will', 'do', 'does', 'has', 'have'
    ]);
    // Split on common separators, filter noise
    return title
      .split(/[\s|—–\-\/,]+/)
      .map(w => w.trim())
      .filter(w => w.length > 1 && !stopWords.has(w.toLowerCase()));
  }

  /**
   * Analyze a profile title against top keywords for a category.
   * @param {string} title - Current profile title
   * @param {string} category - One of: "web dev", "design", "writing", "marketing", "data"
   * @returns {{
   *   currentKeywords: string[],
   *   matchedKeywords: string[],
   *   missingHighValue: string[],
   *   hasPowerWord: boolean,
   *   titleLength: number,
   *   suggestions: string[],
   *   suggestedTitles: string[]
   * }}
   */
  function analyzeTitleKeywords(title, category) {
    const cat = normalize(category);
    const keywords = TOP_KEYWORDS[cat] || TOP_KEYWORDS['web dev'];
    const currentKeywords = extractKeywords(title || '');
    const titleLower = normalize(title);

    // Find matches
    const matchedKeywords = keywords.filter(kw =>
      titleLower.includes(normalize(kw))
    );

    // Top 8 missing keywords the user should consider
    const missingHighValue = keywords
      .filter(kw => !titleLower.includes(normalize(kw)))
      .slice(0, 8);

    // Check for power words
    const hasPowerWord = POWER_WORDS.some(pw =>
      titleLower.includes(normalize(pw))
    );

    const titleLength = (title || '').length;

    // Build suggestions
    const suggestions = [];

    if (titleLength === 0) {
      suggestions.push('Your title is empty — add a compelling, keyword-rich title');
    } else if (titleLength < 20) {
      suggestions.push('Title is too short — expand it to 40-70 characters for better search visibility');
    } else if (titleLength > 70) {
      suggestions.push('Title may be truncated in search — trim to under 70 characters');
    }

    if (matchedKeywords.length === 0) {
      suggestions.push(`No high-demand ${category} keywords found — add terms like "${missingHighValue.slice(0, 3).join('", "')}"`);
    } else if (matchedKeywords.length < 3) {
      suggestions.push(`Only ${matchedKeywords.length} keyword match(es) — try adding "${missingHighValue.slice(0, 2).join('" or "')}"`);
    }

    if (!hasPowerWord) {
      suggestions.push('Add a power word like "Expert", "Senior", or "Specialist" to stand out');
    }

    if (titleLower.includes('freelancer') || titleLower.includes('available')) {
      suggestions.push('Avoid generic words like "Freelancer" or "Available" — lead with skills instead');
    }

    if (!/[|—–\-]/.test(title || '')) {
      suggestions.push('Use separators (| or —) to structure your title into distinct keyword groups');
    }

    // Generate suggested titles
    const suggestedTitles = generateTitleSuggestions(currentKeywords, missingHighValue, cat);

    return {
      currentKeywords,
      matchedKeywords,
      missingHighValue,
      hasPowerWord,
      titleLength,
      suggestions,
      suggestedTitles
    };
  }

  /**
   * Generate 3 optimized title suggestions.
   * @param {string[]} existing - Keywords from current title
   * @param {string[]} missing - High-value missing keywords
   * @param {string} category
   * @returns {string[]}
   */
  function generateTitleSuggestions(existing, missing, category) {
    const primary = existing[0] || missing[0] || 'Developer';
    const kw1 = missing[0] || existing[1] || '';
    const kw2 = missing[1] || existing[2] || '';
    const kw3 = missing[2] || '';
    const pw = POWER_WORDS[Math.floor(Math.random() * 3)]; // Top 3 power words

    const suggestions = [];

    // Pattern 1: [Power] [Primary] | [KW1] & [KW2]
    if (kw1 && kw2) {
      suggestions.push(`${pw} ${primary} | ${kw1} & ${kw2}`.slice(0, 70));
    }

    // Pattern 2: [Primary] Specialist — [KW1], [KW2], [KW3]
    const kwList = [kw1, kw2, kw3].filter(Boolean).join(', ');
    if (kwList) {
      suggestions.push(`${primary} Specialist — ${kwList}`.slice(0, 70));
    }

    // Pattern 3: Senior [Primary] | [Category]-Focused [KW1] Expert
    const catLabel = {
      'web dev': 'Web', design: 'Design', writing: 'Content',
      marketing: 'Growth', data: 'Data'
    }[category] || 'Tech';
    suggestions.push(`Senior ${primary} | ${catLabel}-Focused ${kw1 || primary} Expert`.slice(0, 70));

    return suggestions;
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.analyzeTitleKeywords = analyzeTitleKeywords;
})();
