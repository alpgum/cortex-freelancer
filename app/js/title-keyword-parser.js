/**
 * CF-003: Profile Title Keyword Parser
 * Extracts keywords from profile title, compares against top-earning profile
 * patterns, and suggests improvements.
 * @namespace window.CortexFreelancer.TitleKeywordParser
 */
(function () {
  'use strict';

  /**
   * Top keywords found in high-earning profiles by category.
   * @type {Record<string, string[]>}
   */
  var TOP_KEYWORDS = {
    'Web Development': [
      'React', 'Node.js', 'TypeScript', 'Next.js', 'Full-Stack',
      'JavaScript', 'Python', 'Django', 'REST API', 'GraphQL',
      'Vue.js', 'Angular', 'AWS', 'PostgreSQL', 'MongoDB',
      'Tailwind CSS', 'WordPress', 'PHP', 'Laravel', 'Ruby on Rails'
    ],
    'Mobile Development': [
      'React Native', 'Flutter', 'iOS', 'Android', 'Swift',
      'Kotlin', 'Mobile App', 'Cross-Platform', 'Firebase', 'Expo',
      'Dart', 'Native', 'App Development', 'UI/UX', 'REST API'
    ],
    'Design': [
      'UI/UX', 'Figma', 'Web Design', 'Mobile Design', 'Design Systems',
      'User Research', 'Wireframing', 'Prototyping', 'Brand Identity',
      'Responsive Design', 'Illustration', 'Logo Design', 'Motion Graphics',
      'Adobe Photoshop', 'Adobe Illustrator', 'Interaction Design'
    ],
    'Writing': [
      'SEO', 'Content Strategy', 'Copywriting', 'Blog Writing', 'Technical Writing',
      'Ghostwriting', 'B2B', 'B2C', 'Email Marketing', 'Landing Pages',
      'Content Marketing', 'Article Writing', 'Creative Writing',
      'White Papers', 'Press Releases', 'Editing', 'Proofreading'
    ],
    'Marketing': [
      'Digital Marketing', 'SEO', 'PPC', 'Google Ads', 'Facebook Ads',
      'Social Media', 'Growth Marketing', 'Analytics', 'Conversion Optimization',
      'Email Marketing', 'Content Marketing', 'Marketing Strategy', 'Branding',
      'Lead Generation', 'Marketing Automation', 'HubSpot'
    ],
    'Data Science': [
      'Data Analysis', 'Python', 'SQL', 'Tableau', 'Power BI',
      'Machine Learning', 'Data Science', 'ETL', 'Business Intelligence',
      'R', 'Excel', 'Data Visualization', 'Statistical Analysis', 'Big Data',
      'Data Engineering', 'Pandas', 'TensorFlow', 'NLP'
    ],
    'DevOps': [
      'AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform',
      'Linux', 'GitHub Actions', 'Azure', 'GCP', 'Ansible',
      'Monitoring', 'Serverless', 'Infrastructure', 'Cloud', 'Automation'
    ]
  };

  /**
   * Power/authority words commonly used in top-earning profiles.
   * @type {string[]}
   */
  var POWER_WORDS = [
    'Expert', 'Senior', 'Specialist', 'Certified', 'Top-Rated',
    'Proven', 'Results-Driven', 'Award-Winning', 'Lead', 'Principal',
    'Architect', 'Consultant', 'Strategist', 'Professional'
  ];

  /**
   * Top-earning title patterns by category.
   * @type {Record<string, string[]>}
   */
  var WINNING_PATTERNS = {
    'Web Development': [
      'Senior {kw1} Developer | {kw2} & {kw3}',
      '{power} Full-Stack Developer | {kw1}, {kw2}, {kw3}',
      '{kw1} {power} — {kw2} & {kw3} Solutions'
    ],
    'Mobile Development': [
      'Senior {kw1} Developer | {kw2} & {kw3} Apps',
      '{power} Mobile Developer | {kw1}, {kw2}',
      '{kw1} {power} — Cross-Platform Mobile Solutions'
    ],
    'Design': [
      '{power} {kw1} Designer | {kw2} & {kw3}',
      'Senior {kw1} Designer — {kw2}, {kw3}',
      '{kw1} {power} | {kw2} & Brand Identity'
    ],
    'Writing': [
      '{power} {kw1} Writer | {kw2} & {kw3}',
      'Senior {kw1} {power} — {kw2} Content',
      '{kw1} Writer & {kw2} {power}'
    ],
    'Marketing': [
      '{power} {kw1} Marketer | {kw2} & {kw3}',
      'Senior {kw1} {power} — {kw2} & Analytics',
      '{kw1} {power} | Growth & {kw2}'
    ],
    'Data Science': [
      '{power} Data Scientist | {kw1}, {kw2} & {kw3}',
      'Senior {kw1} {power} — {kw2} & Analytics',
      '{kw1} {power} | {kw2} & Machine Learning'
    ],
    'DevOps': [
      '{power} DevOps Engineer | {kw1}, {kw2} & {kw3}',
      'Senior Cloud {power} — {kw1} & {kw2}',
      '{kw1} {power} | Infrastructure & {kw2}'
    ]
  };

  /** Common stop words to filter from keyword extraction */
  var STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'on', 'at',
    'to', 'of', 'i', 'am', 'is', 'are', 'my', 'your', '&', 'who',
    'that', 'this', 'can', 'will', 'do', 'does', 'has', 'have', 'be'
  ]);

  /**
   * Normalize a string for comparison.
   * @param {string} str
   * @returns {string}
   */
  function normalize(str) {
    return (str || '').toLowerCase().trim();
  }

  /**
   * Extract meaningful keywords from a profile title.
   *
   * @param {string} title - Profile title text
   * @returns {string[]} Extracted keywords
   */
  function extractKeywords(title) {
    if (!title || !title.trim()) return [];
    return title
      .split(/[\s|—–\-\/,&]+/)
      .map(function (w) { return w.trim(); })
      .filter(function (w) { return w.length > 1 && !STOP_WORDS.has(w.toLowerCase()); });
  }

  /**
   * Analyze a profile title against top-earning patterns for a category.
   *
   * @param {string} title - Current profile title
   * @param {string} category - Category key from TOP_KEYWORDS
   * @returns {{
   *   extractedKeywords: string[],
   *   matchedKeywords: string[],
   *   missingHighValue: string[],
   *   hasPowerWord: boolean,
   *   powerWordsFound: string[],
   *   titleLength: number,
   *   score: number,
   *   suggestions: string[],
   *   suggestedTitles: string[]
   * }}
   */
  function analyzeTitle(title, category) {
    var catKeywords = TOP_KEYWORDS[category] || TOP_KEYWORDS['Web Development'];
    var extracted = extractKeywords(title || '');
    var titleLower = normalize(title);

    // Find keyword matches
    var matched = catKeywords.filter(function (kw) {
      return titleLower.indexOf(normalize(kw)) !== -1;
    });

    // High-value keywords the user is missing
    var missing = catKeywords
      .filter(function (kw) { return titleLower.indexOf(normalize(kw)) === -1; })
      .slice(0, 8);

    // Power word analysis
    var powerWordsFound = POWER_WORDS.filter(function (pw) {
      return titleLower.indexOf(normalize(pw)) !== -1;
    });
    var hasPowerWord = powerWordsFound.length > 0;

    var titleLength = (title || '').length;

    // Calculate title quality score (0-100)
    var score = 0;
    // Length (0-20)
    if (titleLength >= 40 && titleLength <= 70) score += 20;
    else if (titleLength >= 20 && titleLength < 40) score += 12;
    else if (titleLength > 70) score += 10;
    else if (titleLength > 0) score += 5;
    // Keyword matches (0-40)
    score += Math.min(matched.length * 10, 40);
    // Power word (0-15)
    if (hasPowerWord) score += 15;
    // Has separator for structure (0-10)
    if (/[|—–]/.test(title || '')) score += 10;
    // Multiple distinct keywords (0-15)
    if (extracted.length >= 4) score += 15;
    else if (extracted.length >= 2) score += 8;

    // Build actionable suggestions
    var suggestions = [];

    if (titleLength === 0) {
      suggestions.push('Your title is empty — add a keyword-rich title showcasing your expertise');
    } else if (titleLength < 20) {
      suggestions.push('Title is too short — expand to 40-70 characters for better search visibility');
    } else if (titleLength > 70) {
      suggestions.push('Title may be truncated in search results — trim to under 70 characters');
    }

    if (matched.length === 0) {
      suggestions.push('No high-demand ' + category + ' keywords found — add terms like "' + missing.slice(0, 3).join('", "') + '"');
    } else if (matched.length < 3) {
      suggestions.push('Only ' + matched.length + ' keyword match(es) — consider adding "' + missing.slice(0, 2).join('" or "') + '"');
    }

    if (!hasPowerWord) {
      suggestions.push('Add a power word like "Expert", "Senior", or "Specialist" to boost credibility');
    }

    if (/freelancer|available|hire me|looking for/i.test(title || '')) {
      suggestions.push('Avoid generic words like "Freelancer" or "Available" — lead with skills and expertise');
    }

    if (!/[|—–\-]/.test(title || '') && titleLength > 0) {
      suggestions.push('Use separators (| or —) to structure your title into distinct keyword groups');
    }

    // Generate suggested titles
    var suggestedTitles = generateSuggestions(extracted, missing, category);

    return {
      extractedKeywords: extracted,
      matchedKeywords: matched,
      missingHighValue: missing,
      hasPowerWord: hasPowerWord,
      powerWordsFound: powerWordsFound,
      titleLength: titleLength,
      score: Math.min(score, 100),
      suggestions: suggestions,
      suggestedTitles: suggestedTitles
    };
  }

  /**
   * Generate optimized title suggestions based on winning patterns.
   *
   * @param {string[]} existing - Keywords extracted from current title
   * @param {string[]} missing - High-value missing keywords
   * @param {string} category
   * @returns {string[]}
   */
  function generateSuggestions(existing, missing, category) {
    var patterns = WINNING_PATTERNS[category] || WINNING_PATTERNS['Web Development'];
    var kw1 = existing[0] || missing[0] || 'Developer';
    var kw2 = missing[0] || existing[1] || missing[1] || '';
    var kw3 = missing[1] || existing[2] || missing[2] || '';
    var power = POWER_WORDS[Math.floor(Math.random() * 3)];

    var results = [];
    for (var i = 0; i < patterns.length; i++) {
      var suggestion = patterns[i]
        .replace('{kw1}', kw1)
        .replace('{kw2}', kw2)
        .replace('{kw3}', kw3)
        .replace('{power}', power);

      // Trim to max 70 chars
      if (suggestion.length > 70) {
        suggestion = suggestion.slice(0, 67) + '...';
      }
      results.push(suggestion);
    }

    return results;
  }

  /**
   * Get available categories.
   * @returns {string[]}
   */
  function getCategories() {
    return Object.keys(TOP_KEYWORDS);
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TitleKeywordParser = {
    extractKeywords: extractKeywords,
    analyzeTitle: analyzeTitle,
    getCategories: getCategories
  };
})();
