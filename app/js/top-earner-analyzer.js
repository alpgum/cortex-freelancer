/**
 * [CF-065] Top Earner Analyzer
 * Analyze top earners in a user's category: what skills, rates, portfolio items,
 * and profile elements they share. Identify gaps and provide recommendations.
 *
 * Exposed on window.CortexFreelancer.topEarnerAnalyzer
 */
(function () {
  'use strict';

  // ─── Static Benchmark Data: Top Earner Profiles by Category ─────────
  // Aggregated from analysis of top-performing freelancers per category
  var TOP_EARNER_PROFILES = {
    'Web Development': {
      commonSkills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'REST API', 'GraphQL'],
      avgRate: 85,
      avgJSS: 96,
      portfolioCount: 8,
      certifications: ['AWS Certified', 'Meta Front-End Developer'],
      responseTime: 1, // hours
      profileLength: 1200 // chars
    },
    'Mobile Development': {
      commonSkills: ['React Native', 'Swift', 'Kotlin', 'Firebase', 'REST API', 'CI/CD'],
      avgRate: 95,
      avgJSS: 97,
      portfolioCount: 7,
      certifications: ['Google Associate Android Developer', 'Apple Developer'],
      responseTime: 1,
      profileLength: 1100
    },
    'React': {
      commonSkills: ['React', 'TypeScript', 'Next.js', 'Redux', 'GraphQL', 'Tailwind CSS', 'Jest'],
      avgRate: 90,
      avgJSS: 96,
      portfolioCount: 9,
      certifications: ['Meta Front-End Developer'],
      responseTime: 1,
      profileLength: 1000
    },
    'Python': {
      commonSkills: ['Python', 'Django', 'FastAPI', 'PostgreSQL', 'Docker', 'AWS', 'Pandas'],
      avgRate: 95,
      avgJSS: 97,
      portfolioCount: 7,
      certifications: ['AWS Certified', 'Google Data Analytics'],
      responseTime: 1,
      profileLength: 1100
    },
    'Data Science': {
      commonSkills: ['Python', 'SQL', 'TensorFlow', 'Pandas', 'Tableau', 'Statistics', 'R'],
      avgRate: 110,
      avgJSS: 98,
      portfolioCount: 6,
      certifications: ['Google Data Analytics', 'IBM Data Science', 'AWS ML Specialty'],
      responseTime: 2,
      profileLength: 1300
    },
    'Machine Learning': {
      commonSkills: ['Python', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'MLOps', 'AWS SageMaker', 'NLP'],
      avgRate: 120,
      avgJSS: 97,
      portfolioCount: 5,
      certifications: ['AWS ML Specialty', 'Google ML Engineer', 'DeepLearning.AI'],
      responseTime: 2,
      profileLength: 1400
    },
    'AI/LLM': {
      commonSkills: ['Python', 'OpenAI API', 'LangChain', 'RAG', 'Vector Databases', 'Fine-tuning', 'Prompt Engineering'],
      avgRate: 140,
      avgJSS: 96,
      portfolioCount: 5,
      certifications: ['DeepLearning.AI', 'AWS ML Specialty'],
      responseTime: 1,
      profileLength: 1200
    },
    'UI/UX Design': {
      commonSkills: ['Figma', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems', 'Usability Testing'],
      avgRate: 90,
      avgJSS: 97,
      portfolioCount: 12,
      certifications: ['Google UX Design', 'Nielsen Norman Certification'],
      responseTime: 1,
      profileLength: 1000
    },
    'DevOps': {
      commonSkills: ['AWS', 'Terraform', 'Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Monitoring'],
      avgRate: 110,
      avgJSS: 97,
      portfolioCount: 5,
      certifications: ['AWS Solutions Architect', 'CKA (Kubernetes)', 'HashiCorp Terraform'],
      responseTime: 1,
      profileLength: 1100
    },
    'Cloud Architecture': {
      commonSkills: ['AWS', 'Azure', 'Terraform', 'Kubernetes', 'Microservices', 'Security', 'Cost Optimization'],
      avgRate: 120,
      avgJSS: 98,
      portfolioCount: 4,
      certifications: ['AWS Solutions Architect Pro', 'Azure Solutions Architect', 'GCP Professional'],
      responseTime: 2,
      profileLength: 1300
    },
    'Cybersecurity': {
      commonSkills: ['Penetration Testing', 'SIEM', 'Compliance', 'Network Security', 'Incident Response', 'Cloud Security'],
      avgRate: 115,
      avgJSS: 98,
      portfolioCount: 4,
      certifications: ['CISSP', 'CEH', 'CompTIA Security+', 'OSCP'],
      responseTime: 2,
      profileLength: 1200
    },
    'Blockchain': {
      commonSkills: ['Solidity', 'Web3.js', 'Smart Contracts', 'DeFi', 'Ethereum', 'Security Auditing'],
      avgRate: 130,
      avgJSS: 95,
      portfolioCount: 5,
      certifications: ['Certified Blockchain Developer'],
      responseTime: 2,
      profileLength: 1000
    },
    'Graphic Design': {
      commonSkills: ['Adobe Photoshop', 'Illustrator', 'Brand Identity', 'Typography', 'Print Design', 'Social Media Graphics'],
      avgRate: 70,
      avgJSS: 96,
      portfolioCount: 15,
      certifications: ['Adobe Certified Expert'],
      responseTime: 1,
      profileLength: 800
    },
    'WordPress': {
      commonSkills: ['WordPress', 'PHP', 'WooCommerce', 'Elementor', 'SEO', 'Custom Themes'],
      avgRate: 60,
      avgJSS: 95,
      portfolioCount: 10,
      certifications: [],
      responseTime: 1,
      profileLength: 900
    },
    'SEO': {
      commonSkills: ['Technical SEO', 'Content Strategy', 'Google Analytics', 'Keyword Research', 'Link Building', 'Search Console'],
      avgRate: 65,
      avgJSS: 96,
      portfolioCount: 6,
      certifications: ['Google Analytics', 'HubSpot SEO', 'SEMrush'],
      responseTime: 1,
      profileLength: 1000
    },
    'Copywriting': {
      commonSkills: ['Direct Response', 'Email Marketing', 'Landing Pages', 'Brand Voice', 'SEO Copywriting', 'A/B Testing'],
      avgRate: 75,
      avgJSS: 96,
      portfolioCount: 8,
      certifications: ['AWAI Copywriting'],
      responseTime: 1,
      profileLength: 1100
    },
    'Video Editing': {
      commonSkills: ['Premiere Pro', 'After Effects', 'DaVinci Resolve', 'Motion Graphics', 'Color Grading', 'Sound Design'],
      avgRate: 65,
      avgJSS: 95,
      portfolioCount: 10,
      certifications: ['Adobe Certified Expert'],
      responseTime: 2,
      profileLength: 800
    },
    'Flutter': {
      commonSkills: ['Flutter', 'Dart', 'Firebase', 'REST API', 'State Management', 'CI/CD'],
      avgRate: 88,
      avgJSS: 96,
      portfolioCount: 7,
      certifications: ['Google Associate Android Developer'],
      responseTime: 1,
      profileLength: 1000
    },
    'Rust/Go': {
      commonSkills: ['Rust', 'Go', 'Systems Programming', 'Concurrency', 'WebAssembly', 'Microservices'],
      avgRate: 110,
      avgJSS: 97,
      portfolioCount: 4,
      certifications: [],
      responseTime: 2,
      profileLength: 1100
    },
    'Digital Marketing': {
      commonSkills: ['Google Ads', 'Facebook Ads', 'Analytics', 'Conversion Optimization', 'Email Marketing', 'Content Strategy'],
      avgRate: 75,
      avgJSS: 96,
      portfolioCount: 7,
      certifications: ['Google Ads', 'Meta Blueprint', 'HubSpot Inbound'],
      responseTime: 1,
      profileLength: 1000
    }
  };

  // ─── Analysis Functions ─────────────────────────────────────────────

  /**
   * Get top earner profile data for a category.
   * @param {string} category
   * @returns {Object|null}
   */
  function analyzeTopEarners(category) {
    var profile = TOP_EARNER_PROFILES[category];
    if (!profile) return null;

    return {
      category: category,
      commonSkills: profile.commonSkills.slice(),
      avgRate: profile.avgRate,
      avgJSS: profile.avgJSS,
      portfolioCount: profile.portfolioCount,
      certifications: profile.certifications.slice(),
      responseTime: profile.responseTime,
      profileLength: profile.profileLength,
      summary: 'Top earners in ' + category + ' charge $' + profile.avgRate + '/hr avg, ' +
               'maintain ' + profile.avgJSS + '% JSS, have ' + profile.portfolioCount +
               ' portfolio items, and respond within ' + profile.responseTime + ' hour(s).'
    };
  }

  /**
   * Extract success patterns across top earners in a category.
   * @param {string} category
   * @returns {{ category: string, patterns: Array<{ factor: string, detail: string, importance: string }> }|null}
   */
  function getSuccessPatterns(category) {
    var profile = TOP_EARNER_PROFILES[category];
    if (!profile) return null;

    var patterns = [];

    // JSS pattern
    patterns.push({
      factor: 'Job Success Score',
      detail: 'Top earners maintain ' + profile.avgJSS + '%+ JSS. This is the single strongest signal to clients.',
      importance: 'critical'
    });

    // Response time
    patterns.push({
      factor: 'Response Time',
      detail: 'Average response within ' + profile.responseTime + ' hour(s). Fast responders win more contracts.',
      importance: profile.responseTime <= 1 ? 'high' : 'medium'
    });

    // Portfolio
    patterns.push({
      factor: 'Portfolio Size',
      detail: 'Top earners show ' + profile.portfolioCount + ' portfolio items on average.',
      importance: profile.portfolioCount >= 8 ? 'high' : 'medium'
    });

    // Skills breadth
    patterns.push({
      factor: 'Skill Stack',
      detail: 'Common stack: ' + profile.commonSkills.slice(0, 5).join(', ') + '. Top earners list ' + profile.commonSkills.length + ' core skills.',
      importance: 'high'
    });

    // Certifications
    if (profile.certifications.length > 0) {
      patterns.push({
        factor: 'Certifications',
        detail: 'Common certs: ' + profile.certifications.join(', ') + '. Certs add credibility, especially for new profiles.',
        importance: 'medium'
      });
    }

    // Profile length
    patterns.push({
      factor: 'Profile Length',
      detail: 'Average profile overview is ~' + profile.profileLength + ' characters. Detailed but focused.',
      importance: 'medium'
    });

    // Rate positioning
    patterns.push({
      factor: 'Rate Positioning',
      detail: 'Top earners charge $' + profile.avgRate + '/hr. They price at premium to signal quality.',
      importance: 'high'
    });

    return {
      category: category,
      patterns: patterns
    };
  }

  /**
   * Compare a user profile against top earners and identify specific gaps.
   * @param {string} category
   * @param {{ skills?: string[], rate?: number, jss?: number, portfolioCount?: number, certifications?: string[], responseTime?: number, profileLength?: number }} userProfile
   * @returns {{ category: string, overallScore: number, gaps: Array<{ area: string, userValue: *, topEarnerValue: *, gap: string, priority: string }> }|null}
   */
  function getGapAnalysis(category, userProfile) {
    var topProfile = TOP_EARNER_PROFILES[category];
    if (!topProfile || !userProfile) return null;

    var gaps = [];
    var scores = [];

    // Rate gap
    var userRate = userProfile.rate || 0;
    var ratePct = topProfile.avgRate > 0 ? Math.round((userRate / topProfile.avgRate) * 100) : 0;
    scores.push(Math.min(100, ratePct));
    if (ratePct < 80) {
      gaps.push({
        area: 'Hourly Rate',
        userValue: '$' + userRate,
        topEarnerValue: '$' + topProfile.avgRate,
        gap: 'Your rate is ' + (100 - ratePct) + '% below top earners.',
        priority: ratePct < 50 ? 'high' : 'medium'
      });
    }

    // JSS gap
    var userJSS = userProfile.jss || 0;
    var jssScore = Math.min(100, Math.round((userJSS / topProfile.avgJSS) * 100));
    scores.push(jssScore);
    if (userJSS < topProfile.avgJSS - 3) {
      gaps.push({
        area: 'Job Success Score',
        userValue: userJSS + '%',
        topEarnerValue: topProfile.avgJSS + '%',
        gap: 'Gap of ' + (topProfile.avgJSS - userJSS) + ' points. Focus on client satisfaction and on-time delivery.',
        priority: userJSS < 90 ? 'critical' : 'medium'
      });
    }

    // Skills gap
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
    var topSkills = topProfile.commonSkills.map(function (s) { return s.toLowerCase(); });
    var matchedSkills = topSkills.filter(function (s) {
      return userSkills.some(function (us) { return us.indexOf(s) !== -1 || s.indexOf(us) !== -1; });
    });
    var missingSkills = topProfile.commonSkills.filter(function (s) {
      return !userSkills.some(function (us) { return us.indexOf(s.toLowerCase()) !== -1 || s.toLowerCase().indexOf(us) !== -1; });
    });
    var skillPct = topSkills.length > 0 ? Math.round((matchedSkills.length / topSkills.length) * 100) : 0;
    scores.push(skillPct);
    if (missingSkills.length > 0) {
      gaps.push({
        area: 'Skills',
        userValue: matchedSkills.length + '/' + topSkills.length + ' matched',
        topEarnerValue: topProfile.commonSkills.join(', '),
        gap: 'Missing: ' + missingSkills.join(', '),
        priority: missingSkills.length > 3 ? 'high' : 'medium'
      });
    }

    // Portfolio gap
    var userPortfolio = userProfile.portfolioCount || 0;
    var portfolioPct = topProfile.portfolioCount > 0 ? Math.min(100, Math.round((userPortfolio / topProfile.portfolioCount) * 100)) : 0;
    scores.push(portfolioPct);
    if (userPortfolio < topProfile.portfolioCount) {
      gaps.push({
        area: 'Portfolio',
        userValue: userPortfolio + ' items',
        topEarnerValue: topProfile.portfolioCount + ' items',
        gap: 'Add ' + (topProfile.portfolioCount - userPortfolio) + ' more portfolio items.',
        priority: userPortfolio < 3 ? 'high' : 'low'
      });
    }

    // Certifications gap
    var userCerts = (userProfile.certifications || []).map(function (c) { return c.toLowerCase(); });
    var missingCerts = topProfile.certifications.filter(function (c) {
      return !userCerts.some(function (uc) { return uc.indexOf(c.toLowerCase()) !== -1; });
    });
    var certPct = topProfile.certifications.length > 0
      ? Math.min(100, Math.round(((topProfile.certifications.length - missingCerts.length) / topProfile.certifications.length) * 100))
      : 100;
    scores.push(certPct);
    if (missingCerts.length > 0) {
      gaps.push({
        area: 'Certifications',
        userValue: (topProfile.certifications.length - missingCerts.length) + '/' + topProfile.certifications.length,
        topEarnerValue: topProfile.certifications.join(', '),
        gap: 'Consider: ' + missingCerts.join(', '),
        priority: 'low'
      });
    }

    // Response time gap
    var userResponseTime = userProfile.responseTime || 24;
    var rtPct = Math.min(100, Math.round((topProfile.responseTime / userResponseTime) * 100));
    scores.push(rtPct);
    if (userResponseTime > topProfile.responseTime * 2) {
      gaps.push({
        area: 'Response Time',
        userValue: userResponseTime + ' hours',
        topEarnerValue: topProfile.responseTime + ' hour(s)',
        gap: 'Respond faster — aim for under ' + (topProfile.responseTime * 2) + ' hours.',
        priority: userResponseTime > 12 ? 'high' : 'medium'
      });
    }

    // Profile length gap
    var userProfileLen = userProfile.profileLength || 0;
    var lenPct = topProfile.profileLength > 0 ? Math.min(100, Math.round((userProfileLen / topProfile.profileLength) * 100)) : 100;
    scores.push(lenPct);
    if (userProfileLen < topProfile.profileLength * 0.6) {
      gaps.push({
        area: 'Profile Length',
        userValue: userProfileLen + ' chars',
        topEarnerValue: topProfile.profileLength + ' chars',
        gap: 'Profile is too short. Add details about process, results, and specialization.',
        priority: userProfileLen < 400 ? 'high' : 'medium'
      });
    }

    // Overall score (average of all dimension scores)
    var overallScore = scores.length > 0
      ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length)
      : 0;

    // Sort gaps by priority
    var priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    gaps.sort(function (a, b) {
      return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
    });

    return {
      category: category,
      overallScore: overallScore,
      gaps: gaps
    };
  }

  /**
   * Get actionable recommendations based on gap analysis.
   * @param {string} category
   * @param {{ skills?: string[], rate?: number, jss?: number, portfolioCount?: number, certifications?: string[], responseTime?: number, profileLength?: number }} userProfile
   * @returns {{ category: string, recommendations: Array<{ action: string, impact: string, effort: string, timeframe: string }> }|null}
   */
  function getRecommendations(category, userProfile) {
    var analysis = getGapAnalysis(category, userProfile);
    if (!analysis) return null;

    var recommendations = [];

    analysis.gaps.forEach(function (gap) {
      var rec = { action: '', impact: '', effort: '', timeframe: '' };

      switch (gap.area) {
        case 'Hourly Rate':
          rec.action = 'Raise your rate gradually — increase by $5-10 every 2-3 successful projects.';
          rec.impact = 'high';
          rec.effort = 'low';
          rec.timeframe = '3-6 months';
          break;
        case 'Job Success Score':
          rec.action = 'Prioritize client communication, set clear milestones, and deliver early when possible.';
          rec.impact = 'critical';
          rec.effort = 'medium';
          rec.timeframe = '2-4 months';
          break;
        case 'Skills':
          rec.action = 'Add missing skills: ' + gap.gap.replace('Missing: ', '') + '. Take a course or build a side project.';
          rec.impact = 'high';
          rec.effort = 'high';
          rec.timeframe = '1-3 months';
          break;
        case 'Portfolio':
          rec.action = 'Create ' + gap.gap.match(/\d+/)[0] + ' more portfolio items. Include case studies with measurable results.';
          rec.impact = 'medium';
          rec.effort = 'medium';
          rec.timeframe = '2-4 weeks';
          break;
        case 'Certifications':
          rec.action = 'Earn relevant certifications: ' + gap.gap.replace('Consider: ', '') + '.';
          rec.impact = 'medium';
          rec.effort = 'high';
          rec.timeframe = '1-3 months';
          break;
        case 'Response Time':
          rec.action = 'Enable mobile notifications and set aside time slots to check messages 3x/day.';
          rec.impact = 'high';
          rec.effort = 'low';
          rec.timeframe = 'Immediate';
          break;
        case 'Profile Length':
          rec.action = 'Expand your profile overview. Add: problem you solve, process, tools, and results.';
          rec.impact = 'medium';
          rec.effort = 'low';
          rec.timeframe = '1 day';
          break;
        default:
          rec.action = 'Address: ' + gap.gap;
          rec.impact = 'medium';
          rec.effort = 'medium';
          rec.timeframe = '1-2 weeks';
      }

      recommendations.push(rec);
    });

    // Add a general recommendation if user is already close
    if (analysis.overallScore >= 80) {
      recommendations.push({
        action: 'You are already close to top earner level. Focus on specialization and building long-term client relationships.',
        impact: 'high',
        effort: 'low',
        timeframe: 'Ongoing'
      });
    }

    return {
      category: category,
      recommendations: recommendations
    };
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.topEarnerAnalyzer = {
    analyzeTopEarners: analyzeTopEarners,
    getSuccessPatterns: getSuccessPatterns,
    getGapAnalysis: getGapAnalysis,
    getRecommendations: getRecommendations
  };
})();
