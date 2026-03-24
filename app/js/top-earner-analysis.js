/**
 * [CF-065] Top Earner Reverse Engineering
 * Analyze top earners in user's category: what skills, rates, portfolio items,
 * and profile elements they share. Actionable insights for improvement.
 *
 * Exposed on window.CortexFreelancer.TopEarnerAnalysis
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ── Constants ── */
  var STORAGE_KEY = 'cortex_top_earner_data';
  var ANALYSIS_CACHE_KEY = 'cortex_top_earner_analysis_cache';

  /* ── Storage ── */

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function loadCache() {
    try { return JSON.parse(localStorage.getItem(ANALYSIS_CACHE_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveCache(cache) {
    try { localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
  }

  /* ── Profile Data Management ── */

  /**
   * Add a top earner profile to the dataset.
   * @param {string} category - e.g. 'web-development'
   * @param {Object} profile  - { name, rate, earnings, skills[], portfolioItems, headline,
   *                              specialization, jobSuccessScore, hoursWorked, profileStrength,
   *                              hasPortfolio, hasVideo, hasCertifications, responseTime,
   *                              languages[], country, memberSince }
   */
  function addProfile(category, profile) {
    var data = loadData();
    if (!data[category]) data[category] = [];

    profile.addedAt = new Date().toISOString();
    profile.id = profile.id || generateId();

    // Dedupe by name
    data[category] = data[category].filter(function (p) {
      return p.name !== profile.name;
    });
    data[category].push(profile);

    // Keep top 100 per category, sorted by earnings
    data[category].sort(function (a, b) { return (b.earnings || 0) - (a.earnings || 0); });
    if (data[category].length > 100) data[category] = data[category].slice(0, 100);

    saveData(data);
    clearCacheForCategory(category);
  }

  function addBulkProfiles(category, profiles) {
    profiles.forEach(function (p) { addProfile(category, p); });
  }

  function getProfiles(category) {
    var data = loadData();
    return (data[category] || []).slice();
  }

  function generateId() {
    return 'te_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function clearCacheForCategory(cat) {
    var cache = loadCache();
    delete cache[cat];
    saveCache(cache);
  }

  /* ── Analysis Engine ── */

  function analyzeCategory(category) {
    // Check cache
    var cache = loadCache();
    if (cache[category] && (Date.now() - cache[category].timestamp < 300000)) {
      return cache[category].result;
    }

    var profiles = getProfiles(category);
    if (profiles.length === 0) {
      return { category: category, profileCount: 0, insights: [], error: 'No profiles recorded for this category.' };
    }

    var total = profiles.length;

    // ── Skill Frequency Analysis ──
    var skillCounts = {};
    var totalSkills = 0;
    profiles.forEach(function (p) {
      (p.skills || []).forEach(function (s) {
        var normalized = s.toLowerCase().trim();
        skillCounts[normalized] = (skillCounts[normalized] || 0) + 1;
        totalSkills++;
      });
    });

    var skillRanking = Object.keys(skillCounts).map(function (s) {
      return {
        skill: s,
        count: skillCounts[s],
        frequency: Math.round((skillCounts[s] / total) * 10000) / 100
      };
    }).sort(function (a, b) { return b.count - a.count; });

    var topSkills = skillRanking.slice(0, 15);
    var mustHaveSkills = skillRanking.filter(function (s) { return s.frequency >= 60; });
    var differentiatorSkills = skillRanking.filter(function (s) { return s.frequency >= 20 && s.frequency < 60; });

    // ── Rate Analysis ──
    var rates = profiles.filter(function (p) { return p.rate > 0; }).map(function (p) { return p.rate; });
    rates.sort(function (a, b) { return a - b; });
    var rateStats = computeStats(rates);

    // ── Earnings Analysis ──
    var earnings = profiles.filter(function (p) { return p.earnings > 0; }).map(function (p) { return p.earnings; });
    earnings.sort(function (a, b) { return a - b; });
    var earningsStats = computeStats(earnings);

    // ── Profile Element Patterns ──
    var patterns = {
      hasPortfolio: countTrue(profiles, 'hasPortfolio'),
      hasVideo: countTrue(profiles, 'hasVideo'),
      hasCertifications: countTrue(profiles, 'hasCertifications'),
      hasSpecialization: countTrue(profiles, function (p) { return !!p.specialization; })
    };

    Object.keys(patterns).forEach(function (k) {
      patterns[k] = {
        count: patterns[k],
        percentage: Math.round((patterns[k] / total) * 10000) / 100
      };
    });

    // ── Job Success Score ──
    var jssValues = profiles.filter(function (p) { return p.jobSuccessScore > 0; }).map(function (p) { return p.jobSuccessScore; });
    var jssStats = computeStats(jssValues);

    // ── Hours Worked ──
    var hoursValues = profiles.filter(function (p) { return p.hoursWorked > 0; }).map(function (p) { return p.hoursWorked; });
    var hoursStats = computeStats(hoursValues);

    // ── Portfolio Item Count ──
    var portfolioCounts = profiles.filter(function (p) { return p.portfolioItems >= 0; }).map(function (p) { return p.portfolioItems || 0; });
    var portfolioStats = computeStats(portfolioCounts);

    // ── Headline Keyword Analysis ──
    var headlineWords = {};
    profiles.forEach(function (p) {
      if (!p.headline) return;
      var words = p.headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
      var stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'am', 'are', 'was', 'i', ''];
      words.forEach(function (w) {
        if (w.length > 2 && stopWords.indexOf(w) === -1) {
          headlineWords[w] = (headlineWords[w] || 0) + 1;
        }
      });
    });

    var topHeadlineKeywords = Object.keys(headlineWords).map(function (w) {
      return { word: w, count: headlineWords[w], frequency: Math.round((headlineWords[w] / total) * 100) };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 20);

    // ── Generate Insights ──
    var insights = generateInsights({
      total: total,
      rateStats: rateStats,
      earningsStats: earningsStats,
      topSkills: topSkills,
      mustHaveSkills: mustHaveSkills,
      differentiatorSkills: differentiatorSkills,
      patterns: patterns,
      jssStats: jssStats,
      hoursStats: hoursStats,
      portfolioStats: portfolioStats,
      topHeadlineKeywords: topHeadlineKeywords
    });

    var result = {
      category: category,
      profileCount: total,
      rateStats: rateStats,
      earningsStats: earningsStats,
      jssStats: jssStats,
      hoursStats: hoursStats,
      portfolioStats: portfolioStats,
      skillRanking: skillRanking,
      topSkills: topSkills,
      mustHaveSkills: mustHaveSkills,
      differentiatorSkills: differentiatorSkills,
      profilePatterns: patterns,
      topHeadlineKeywords: topHeadlineKeywords,
      insights: insights,
      analyzedAt: new Date().toISOString()
    };

    // Cache
    cache[category] = { result: result, timestamp: Date.now() };
    saveCache(cache);

    return result;
  }

  function computeStats(values) {
    if (values.length === 0) return { count: 0, min: 0, max: 0, mean: 0, median: 0, p25: 0, p75: 0, stdDev: 0 };
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var n = sorted.length;
    var sum = sorted.reduce(function (a, b) { return a + b; }, 0);
    var mean = sum / n;
    var variance = sorted.reduce(function (s, v) { return s + (v - mean) * (v - mean); }, 0) / n;

    return {
      count: n,
      min: sorted[0],
      max: sorted[n - 1],
      mean: Math.round(mean * 100) / 100,
      median: percentile(sorted, 50),
      p25: percentile(sorted, 25),
      p75: percentile(sorted, 75),
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100
    };
  }

  function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    var idx = (p / 100) * (sorted.length - 1);
    var lower = Math.floor(idx);
    var upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return Math.round((sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)) * 100) / 100;
  }

  function countTrue(arr, keyOrFn) {
    return arr.filter(function (item) {
      if (typeof keyOrFn === 'function') return keyOrFn(item);
      return !!item[keyOrFn];
    }).length;
  }

  /* ── Insight Generator ── */

  function generateInsights(data) {
    var insights = [];

    // Rate insights
    if (data.rateStats.count > 0) {
      insights.push({
        type: 'rate',
        priority: 'high',
        icon: '💰',
        title: 'Sweet Spot Rate',
        message: 'Top earners charge $' + data.rateStats.p25 + '–$' + data.rateStats.p75 + '/hr (median $' + data.rateStats.median + '/hr). The top 25% charge $' + data.rateStats.p75 + '+/hr.'
      });
    }

    // Must-have skills
    if (data.mustHaveSkills.length > 0) {
      var skillList = data.mustHaveSkills.slice(0, 5).map(function (s) { return s.skill; }).join(', ');
      insights.push({
        type: 'skills',
        priority: 'high',
        icon: '🎯',
        title: 'Must-Have Skills',
        message: 'Over 60% of top earners list: ' + skillList + '. Ensure these are on your profile.'
      });
    }

    // Differentiator skills
    if (data.differentiatorSkills.length > 0) {
      var diffList = data.differentiatorSkills.slice(0, 5).map(function (s) { return s.skill; }).join(', ');
      insights.push({
        type: 'skills',
        priority: 'medium',
        icon: '⭐',
        title: 'Differentiator Skills',
        message: 'These skills appear in 20-60% of top earners: ' + diffList + '. Adding these can set you apart.'
      });
    }

    // Portfolio pattern
    if (data.patterns.hasPortfolio.percentage > 70) {
      insights.push({
        type: 'portfolio',
        priority: 'high',
        icon: '🖼️',
        title: 'Portfolio is Essential',
        message: data.patterns.hasPortfolio.percentage + '% of top earners have portfolio items (avg ' + data.portfolioStats.median + ' items). This is a clear differentiator.'
      });
    }

    // Video intro
    if (data.patterns.hasVideo.percentage > 30) {
      insights.push({
        type: 'profile',
        priority: 'medium',
        icon: '🎥',
        title: 'Video Intro Advantage',
        message: data.patterns.hasVideo.percentage + '% of top earners use a video introduction. Consider adding one.'
      });
    }

    // Certifications
    if (data.patterns.hasCertifications.percentage > 40) {
      insights.push({
        type: 'profile',
        priority: 'medium',
        icon: '📜',
        title: 'Certifications Matter',
        message: data.patterns.hasCertifications.percentage + '% have certifications displayed. This builds trust with clients.'
      });
    }

    // JSS
    if (data.jssStats.count > 0 && data.jssStats.median >= 90) {
      insights.push({
        type: 'performance',
        priority: 'high',
        icon: '🏆',
        title: 'Job Success Score Target',
        message: 'Top earners have a median JSS of ' + data.jssStats.median + '%. Aim for 90%+ through great delivery and communication.'
      });
    }

    // Hours worked
    if (data.hoursStats.count > 0) {
      insights.push({
        type: 'experience',
        priority: 'medium',
        icon: '⏱️',
        title: 'Experience Level',
        message: 'Top earners average ' + Math.round(data.hoursStats.mean) + ' hours worked (median ' + data.hoursStats.median + '). This signals reliability to clients.'
      });
    }

    // Headline keywords
    if (data.topHeadlineKeywords.length > 0) {
      var keywords = data.topHeadlineKeywords.slice(0, 5).map(function (k) { return '"' + k.word + '"'; }).join(', ');
      insights.push({
        type: 'headline',
        priority: 'medium',
        icon: '✏️',
        title: 'Headline Optimization',
        message: 'Most common headline keywords: ' + keywords + '. Incorporate these to match client searches.'
      });
    }

    // Specialization
    if (data.patterns.hasSpecialization.percentage > 50) {
      insights.push({
        type: 'profile',
        priority: 'medium',
        icon: '🎯',
        title: 'Specialization Wins',
        message: data.patterns.hasSpecialization.percentage + '% of top earners have a clear specialization. Niching down increases perceived expertise.'
      });
    }

    // Sort by priority
    var priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort(function (a, b) {
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    return insights;
  }

  /* ── Gap Analysis (compare user to top earners) ── */

  function gapAnalysis(category, userProfile) {
    var analysis = analyzeCategory(category);
    if (analysis.profileCount === 0) {
      return { gaps: [], score: 0, message: 'No top earner data for comparison.' };
    }

    var gaps = [];
    var score = 0;
    var maxScore = 0;

    // Rate gap
    maxScore += 20;
    if (userProfile.rate) {
      if (userProfile.rate >= analysis.rateStats.p75) { score += 20; }
      else if (userProfile.rate >= analysis.rateStats.median) { score += 15; }
      else if (userProfile.rate >= analysis.rateStats.p25) {
        score += 10;
        gaps.push({ area: 'Rate', icon: '💰', severity: 'medium', message: 'Your rate ($' + userProfile.rate + '/hr) is below the top-earner median ($' + analysis.rateStats.median + '/hr).' });
      } else {
        score += 5;
        gaps.push({ area: 'Rate', icon: '💰', severity: 'high', message: 'Your rate ($' + userProfile.rate + '/hr) is well below top earners ($' + analysis.rateStats.p25 + '–$' + analysis.rateStats.p75 + '/hr). Consider increasing gradually.' });
      }
    }

    // Skills gap
    maxScore += 25;
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase().trim(); });
    var mustHaveMatched = analysis.mustHaveSkills.filter(function (s) { return userSkills.indexOf(s.skill) !== -1; }).length;
    var mustHaveTotal = analysis.mustHaveSkills.length;
    if (mustHaveTotal > 0) {
      var skillCoverage = mustHaveMatched / mustHaveTotal;
      score += Math.round(skillCoverage * 25);
      if (skillCoverage < 0.6) {
        var missing = analysis.mustHaveSkills.filter(function (s) { return userSkills.indexOf(s.skill) === -1; }).map(function (s) { return s.skill; });
        gaps.push({ area: 'Skills', icon: '🎯', severity: 'high', message: 'You\'re missing key skills that ' + mustHaveTotal + ' of top earners have: ' + missing.slice(0, 5).join(', ') + '.' });
      }
    }

    // Portfolio
    maxScore += 15;
    if (userProfile.hasPortfolio) { score += 15; }
    else if (analysis.profilePatterns.hasPortfolio.percentage > 60) {
      gaps.push({ area: 'Portfolio', icon: '🖼️', severity: 'high', message: analysis.profilePatterns.hasPortfolio.percentage + '% of top earners have portfolios. Add portfolio items to compete.' });
    }

    // Video
    maxScore += 10;
    if (userProfile.hasVideo) { score += 10; }
    else if (analysis.profilePatterns.hasVideo.percentage > 30) {
      gaps.push({ area: 'Video Intro', icon: '🎥', severity: 'medium', message: analysis.profilePatterns.hasVideo.percentage + '% of top earners use video intros. This is a quick win.' });
    }

    // Certifications
    maxScore += 10;
    if (userProfile.hasCertifications) { score += 10; }
    else if (analysis.profilePatterns.hasCertifications.percentage > 40) {
      gaps.push({ area: 'Certifications', icon: '📜', severity: 'medium', message: 'Add relevant certifications — ' + analysis.profilePatterns.hasCertifications.percentage + '% of top earners have them.' });
    }

    // JSS
    maxScore += 10;
    if (userProfile.jobSuccessScore >= 90) { score += 10; }
    else if (userProfile.jobSuccessScore >= 80) {
      score += 7;
      gaps.push({ area: 'Job Success Score', icon: '🏆', severity: 'medium', message: 'Your JSS (' + userProfile.jobSuccessScore + '%) is good but top earners average ' + analysis.jssStats.median + '%. Focus on client satisfaction.' });
    } else if (userProfile.jobSuccessScore > 0) {
      score += 3;
      gaps.push({ area: 'Job Success Score', icon: '🏆', severity: 'high', message: 'Your JSS (' + userProfile.jobSuccessScore + '%) needs improvement. Top earner median is ' + analysis.jssStats.median + '%.' });
    }

    // Specialization
    maxScore += 10;
    if (userProfile.specialization) { score += 10; }
    else if (analysis.profilePatterns.hasSpecialization.percentage > 50) {
      gaps.push({ area: 'Specialization', icon: '🎯', severity: 'medium', message: 'Define a clear specialization. ' + analysis.profilePatterns.hasSpecialization.percentage + '% of top earners have one.' });
    }

    var overallScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    // Sort gaps by severity
    var sevOrder = { high: 0, medium: 1, low: 2 };
    gaps.sort(function (a, b) { return (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2); });

    return {
      score: overallScore,
      gaps: gaps,
      analysis: analysis,
      message: overallScore >= 80 ? '🌟 You\'re in the top tier! Fine-tune the remaining gaps.' :
               overallScore >= 60 ? '📈 Good foundation. Address the high-priority gaps to break into top earner territory.' :
               overallScore >= 40 ? '🔧 Room for improvement. Focus on the critical gaps first.' :
               '🚀 Significant opportunity to level up. Start with the high-priority items.'
    };
  }

  /* ── Seed Demo Data ── */

  function seedDemoData(category) {
    var sampleSkillPools = {
      'web-development': ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Next.js', 'Python', 'GraphQL', 'AWS', 'Docker', 'PostgreSQL', 'MongoDB', 'Redux', 'Vue.js', 'CSS', 'REST API'],
      'mobile-development': ['React Native', 'Swift', 'Kotlin', 'Flutter', 'iOS', 'Android', 'Firebase', 'TypeScript', 'REST API', 'GraphQL', 'UI Design', 'App Store Optimization'],
      'data-science': ['Python', 'Machine Learning', 'TensorFlow', 'SQL', 'Pandas', 'R', 'Data Visualization', 'Deep Learning', 'NLP', 'Statistics', 'Spark', 'Tableau', 'Scikit-learn'],
      'ui-ux-design': ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Wireframing', 'Adobe XD', 'Sketch', 'User Testing', 'Design Systems', 'Responsive Design', 'Interaction Design']
    };

    var skillPool = sampleSkillPools[category] || ['Skill A', 'Skill B', 'Skill C', 'Skill D', 'Skill E', 'Skill F', 'Skill G', 'Skill H'];
    var names = ['Alex Rivera', 'Jordan Chen', 'Sam Patel', 'Morgan Lee', 'Taylor Kim', 'Casey Williams', 'Riley Johnson', 'Quinn Adams', 'Avery Thompson', 'Drew Martinez', 'Cameron Brooks', 'Dakota Singh', 'Emery Clark', 'Finley Ross', 'Harper Young', 'Indigo Bell', 'Jamie Scott', 'Kai Nakamura', 'Logan Park', 'Max Weber'];

    var profiles = names.map(function (name, i) {
      var rate = 50 + Math.round(Math.random() * 100);
      var numSkills = 4 + Math.floor(Math.random() * 6);
      var skills = shuffleArray(skillPool.slice()).slice(0, numSkills);
      return {
        name: name,
        rate: rate,
        earnings: Math.round(10000 + Math.random() * 490000),
        skills: skills,
        portfolioItems: Math.floor(Math.random() * 15),
        headline: generateHeadline(category, skills),
        specialization: Math.random() > 0.4 ? skills[0] + ' Specialist' : null,
        jobSuccessScore: 80 + Math.floor(Math.random() * 20),
        hoursWorked: 500 + Math.floor(Math.random() * 9500),
        hasPortfolio: Math.random() > 0.2,
        hasVideo: Math.random() > 0.6,
        hasCertifications: Math.random() > 0.45,
        country: ['US', 'UK', 'Canada', 'Germany', 'India', 'Australia'][Math.floor(Math.random() * 6)]
      };
    });

    addBulkProfiles(category, profiles);
  }

  function generateHeadline(category, skills) {
    var prefixes = ['Senior', 'Expert', 'Full-Stack', 'Lead', 'Top-Rated', 'Experienced'];
    var prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    var skill = skills[0] || category;
    var suffixes = ['Developer', 'Engineer', 'Specialist', 'Consultant', 'Architect'];
    var suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return prefix + ' ' + skill + ' ' + suffix;
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    }
    return arr;
  }

  /* ── Render ── */

  function render(containerId, options) {
    options = options || {};
    var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) return;

    var category = options.category || Object.keys(loadData())[0];
    if (!category && options.seedDemo) {
      seedDemoData('web-development');
      category = 'web-development';
    }

    if (!category) {
      container.innerHTML = '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:16px;padding:40px;text-align:center;color:#64748b;font-family:-apple-system,sans-serif;">' +
        '<p style="font-size:48px;margin:0;">🔍</p>' +
        '<p style="font-size:16px;margin:12px 0;">No top earner data yet</p>' +
        '<p style="font-size:13px;">Add profiles to start analyzing.</p></div>';
      return;
    }

    var analysis = analyzeCategory(category);
    var html = '';

    html += '<div style="background:#1a1a2e;border:1px solid #2a2a4a;border-radius:16px;padding:24px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e2e8f0;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<div>';
    html += '<h2 style="margin:0;font-size:20px;font-weight:700;color:#f1f5f9;">🏆 Top Earner Analysis</h2>';
    html += '<p style="margin:4px 0 0;font-size:13px;color:#64748b;">' + analysis.profileCount + ' profiles analyzed in ' + escHtml(category) + '</p>';
    html += '</div></div>';

    // Key metrics grid
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;">';
    html += metricCard('💰 Median Rate', '$' + analysis.rateStats.median + '/hr', '$' + analysis.rateStats.p25 + '–$' + analysis.rateStats.p75);
    html += metricCard('💵 Median Earnings', '$' + formatNum(analysis.earningsStats.median), 'Range: $' + formatNum(analysis.earningsStats.min) + '–$' + formatNum(analysis.earningsStats.max));
    html += metricCard('🏆 Median JSS', analysis.jssStats.median + '%', 'Min: ' + analysis.jssStats.min + '%');
    html += metricCard('⏱️ Avg Hours', formatNum(Math.round(analysis.hoursStats.mean)), 'Median: ' + formatNum(analysis.hoursStats.median));
    html += '</div>';

    // Top Skills
    if (analysis.topSkills.length > 0) {
      html += '<div style="margin-bottom:20px;">';
      html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">🎯 Top Skills</h3>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      analysis.topSkills.forEach(function (s) {
        var opacity = Math.max(0.4, s.frequency / 100);
        html += '<span style="background:rgba(99,102,241,' + opacity + ');color:#e0e7ff;padding:5px 12px;border-radius:8px;font-size:13px;font-weight:500;">' +
          escHtml(s.skill) + ' <span style="opacity:0.6;font-size:11px;">' + s.frequency + '%</span></span>';
      });
      html += '</div></div>';
    }

    // Profile Patterns
    html += '<div style="margin-bottom:20px;">';
    html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">📋 Profile Patterns</h3>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;">';
    html += patternBar('Portfolio', analysis.profilePatterns.hasPortfolio.percentage, '🖼️');
    html += patternBar('Specialization', analysis.profilePatterns.hasSpecialization.percentage, '🎯');
    html += patternBar('Certifications', analysis.profilePatterns.hasCertifications.percentage, '📜');
    html += patternBar('Video Intro', analysis.profilePatterns.hasVideo.percentage, '🎥');
    html += '</div></div>';

    // Insights
    if (analysis.insights.length > 0) {
      html += '<div style="margin-bottom:12px;">';
      html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">💡 Actionable Insights</h3>';
      analysis.insights.forEach(function (ins) {
        var borderColor = ins.priority === 'high' ? '#4ade80' : ins.priority === 'medium' ? '#facc15' : '#94a3b8';
        html += '<div style="background:#16213e;border-left:3px solid ' + borderColor + ';border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px;">';
        html += '<div style="font-size:13px;font-weight:600;color:#f1f5f9;margin-bottom:4px;">' + ins.icon + ' ' + escHtml(ins.title) + '</div>';
        html += '<div style="font-size:12px;color:#94a3b8;line-height:1.5;">' + escHtml(ins.message) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Headline Keywords
    if (analysis.topHeadlineKeywords.length > 0) {
      html += '<div>';
      html += '<h3 style="font-size:15px;font-weight:600;color:#f1f5f9;margin:0 0 12px;">✏️ Headline Keywords</h3>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      analysis.topHeadlineKeywords.slice(0, 12).forEach(function (k) {
        html += '<span style="background:#16213e;color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:12px;">' +
          escHtml(k.word) + ' <span style="color:#64748b;">(' + k.count + ')</span></span>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function metricCard(label, value, subtitle) {
    return '<div style="background:#16213e;border-radius:10px;padding:14px;">' +
      '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">' + label + '</div>' +
      '<div style="font-size:22px;font-weight:700;color:#f1f5f9;margin:4px 0;">' + value + '</div>' +
      '<div style="font-size:11px;color:#64748b;">' + subtitle + '</div></div>';
  }

  function patternBar(label, percentage, icon) {
    var color = percentage >= 70 ? '#4ade80' : percentage >= 40 ? '#facc15' : '#94a3b8';
    return '<div style="background:#0f0f23;border-radius:8px;padding:10px 14px;">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px;">' +
      '<span style="color:#94a3b8;">' + icon + ' ' + label + '</span>' +
      '<span style="color:' + color + ';font-weight:600;">' + percentage + '%</span></div>' +
      '<div style="height:6px;background:#2a2a4a;border-radius:3px;overflow:hidden;">' +
      '<div style="height:100%;width:' + percentage + '%;background:' + color + ';border-radius:3px;"></div></div></div>';
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* ── Init ── */

  function init(options) {
    options = options || {};
    if (options.seedDemo) {
      var cats = options.categories || ['web-development'];
      cats.forEach(function (c) {
        if (getProfiles(c).length === 0) seedDemoData(c);
      });
    }
  }

  /* ── Public API ── */

  window.CortexFreelancer.TopEarnerAnalysis = {
    init: init,
    render: render,
    addProfile: addProfile,
    addBulkProfiles: addBulkProfiles,
    getProfiles: getProfiles,
    analyzeCategory: analyzeCategory,
    gapAnalysis: gapAnalysis,
    seedDemoData: seedDemoData
  };

})();
