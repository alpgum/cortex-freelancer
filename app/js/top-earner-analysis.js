/**
 * [CF-065] Top Earner Reverse Engineering
 * Analyze top earners in user's category: what skills, rates, portfolio items,
 * and profile elements they share. Provides actionable gap analysis.
 *
 * Persists to localStorage key: 'cortex_top_earner_data'
 * Exposed on window.CortexFreelancer.TopEarnerAnalysis
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_top_earner_data';

  // ─── Persistence ────────────────────────────────────────────────────

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { profiles: [], categories: {} };
  }

  function _save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function _esc(str) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ─── Data Management ────────────────────────────────────────────────

  function addProfile(profile) {
    if (!profile || !profile.name) throw new Error('Profile name is required');
    var data = _load();
    var entry = {
      id: 'te_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
      name: profile.name,
      category: profile.category || 'General',
      rate: profile.rate || null,
      earnings: profile.earnings || null,
      jss: profile.jss || null,
      skills: profile.skills || [],
      portfolioCount: profile.portfolioCount || 0,
      hasVideo: !!profile.hasVideo,
      hasCertifications: !!profile.hasCertifications,
      hasSpecialization: !!profile.hasSpecialization,
      headline: profile.headline || '',
      responseTime: profile.responseTime || null,
      addedAt: new Date().toISOString()
    };
    data.profiles.push(entry);

    // Index by category
    var cat = entry.category;
    if (!data.categories[cat]) data.categories[cat] = [];
    data.categories[cat].push(entry.id);

    _save(data);
    return entry;
  }

  function bulkAddProfiles(profiles) {
    return (profiles || []).map(function (p) { return addProfile(p); });
  }

  function getProfiles(category) {
    var data = _load();
    if (!category) return data.profiles;
    return data.profiles.filter(function (p) { return p.category === category; });
  }

  function getCategories() {
    var data = _load();
    return Object.keys(data.categories);
  }

  function clearCategory(category) {
    var data = _load();
    data.profiles = data.profiles.filter(function (p) { return p.category !== category; });
    delete data.categories[category];
    _save(data);
  }

  // ─── Analysis Engine ────────────────────────────────────────────────

  function analyzeSkills(category) {
    var profiles = getProfiles(category);
    if (profiles.length === 0) return { skills: [], total: 0 };

    var freq = {};
    profiles.forEach(function (p) {
      (p.skills || []).forEach(function (s) {
        var key = s.toLowerCase().trim();
        if (!freq[key]) freq[key] = { name: s, count: 0 };
        freq[key].count++;
      });
    });

    var skills = Object.keys(freq).map(function (k) {
      return {
        name: freq[k].name,
        count: freq[k].count,
        percentage: Math.round((freq[k].count / profiles.length) * 100)
      };
    }).sort(function (a, b) { return b.count - a.count; });

    return { skills: skills, total: profiles.length };
  }

  function analyzeRates(category) {
    var profiles = getProfiles(category).filter(function (p) { return p.rate > 0; });
    if (profiles.length === 0) return null;

    var rates = profiles.map(function (p) { return p.rate; }).sort(function (a, b) { return a - b; });
    var sum = rates.reduce(function (a, b) { return a + b; }, 0);

    return {
      min: rates[0],
      max: rates[rates.length - 1],
      average: Math.round(sum / rates.length),
      median: rates[Math.floor(rates.length / 2)],
      count: rates.length,
      distribution: {
        under50: rates.filter(function (r) { return r < 50; }).length,
        '50to100': rates.filter(function (r) { return r >= 50 && r < 100; }).length,
        '100to150': rates.filter(function (r) { return r >= 100 && r < 150; }).length,
        '150plus': rates.filter(function (r) { return r >= 150; }).length
      }
    };
  }

  function analyzeProfileElements(category) {
    var profiles = getProfiles(category);
    if (profiles.length === 0) return null;

    var total = profiles.length;
    var withVideo = profiles.filter(function (p) { return p.hasVideo; }).length;
    var withCerts = profiles.filter(function (p) { return p.hasCertifications; }).length;
    var withSpec = profiles.filter(function (p) { return p.hasSpecialization; }).length;
    var portfolioCounts = profiles.map(function (p) { return p.portfolioCount || 0; });
    var avgPortfolio = portfolioCounts.reduce(function (a, b) { return a + b; }, 0) / total;

    return {
      videoPercentage: Math.round((withVideo / total) * 100),
      certificationPercentage: Math.round((withCerts / total) * 100),
      specializationPercentage: Math.round((withSpec / total) * 100),
      avgPortfolioItems: Math.round(avgPortfolio * 10) / 10,
      total: total
    };
  }

  function analyzeHeadlines(category) {
    var profiles = getProfiles(category).filter(function (p) { return p.headline; });
    if (profiles.length === 0) return { keywords: [], patterns: [] };

    var stopWords = ['a', 'an', 'the', 'and', 'or', 'for', 'in', 'on', 'at', 'to', 'of', 'with', 'i', 'is', 'am', '|', '-', '&'];
    var freq = {};

    profiles.forEach(function (p) {
      var words = p.headline.toLowerCase().split(/[\s,|•·–—]+/);
      words.forEach(function (w) {
        w = w.trim().replace(/[^a-z0-9+#]/g, '');
        if (w.length < 2 || stopWords.indexOf(w) !== -1) return;
        freq[w] = (freq[w] || 0) + 1;
      });
    });

    var keywords = Object.keys(freq).map(function (k) {
      return { word: k, count: freq[k], percentage: Math.round((freq[k] / profiles.length) * 100) };
    }).sort(function (a, b) { return b.count - a.count; }).slice(0, 20);

    var patterns = [];
    var expertCount = profiles.filter(function (p) { return /expert|specialist/i.test(p.headline); }).length;
    if (expertCount > 0) patterns.push({ pattern: 'Uses "Expert/Specialist"', count: expertCount, percentage: Math.round((expertCount / profiles.length) * 100) });

    var yearsCount = profiles.filter(function (p) { return /\d+\+?\s*years?/i.test(p.headline); }).length;
    if (yearsCount > 0) patterns.push({ pattern: 'Mentions years of experience', count: yearsCount, percentage: Math.round((yearsCount / profiles.length) * 100) });

    var nichCount = profiles.filter(function (p) { return p.headline.split(/[\s,|]+/).length <= 5; }).length;
    if (nichCount > 0) patterns.push({ pattern: 'Short & niche focused', count: nichCount, percentage: Math.round((nichCount / profiles.length) * 100) });

    return { keywords: keywords, patterns: patterns };
  }

  function analyzeJSS(category) {
    var profiles = getProfiles(category).filter(function (p) { return p.jss != null; });
    if (profiles.length === 0) return null;

    var scores = profiles.map(function (p) { return p.jss; }).sort(function (a, b) { return a - b; });
    var sum = scores.reduce(function (a, b) { return a + b; }, 0);

    return {
      average: Math.round(sum / scores.length),
      median: scores[Math.floor(scores.length / 2)],
      min: scores[0],
      max: scores[scores.length - 1],
      above90: scores.filter(function (s) { return s >= 90; }).length,
      count: scores.length
    };
  }

  // ─── Gap Analysis ───────────────────────────────────────────────────

  function gapAnalysis(userProfile, category) {
    if (!userProfile) return null;

    var skillAnalysis = analyzeSkills(category);
    var rateAnalysis = analyzeRates(category);
    var elementAnalysis = analyzeProfileElements(category);
    var jssAnalysis = analyzeJSS(category);

    var gaps = [];
    var strengths = [];

    // Skill gaps
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
    var topSkills = skillAnalysis.skills.filter(function (s) { return s.percentage >= 40; });
    var missingSkills = topSkills.filter(function (s) {
      return userSkills.indexOf(s.name.toLowerCase()) === -1;
    });
    if (missingSkills.length > 0) {
      gaps.push({
        area: 'Skills',
        priority: 'high',
        message: 'Missing top skills: ' + missingSkills.map(function (s) { return s.name + ' (' + s.percentage + '%)'; }).join(', '),
        action: 'Consider adding these skills to your profile and portfolio'
      });
    } else if (topSkills.length > 0) {
      strengths.push({ area: 'Skills', message: 'You have all the top skills for this category' });
    }

    // Rate positioning
    if (rateAnalysis && userProfile.rate) {
      if (userProfile.rate < rateAnalysis.median * 0.7) {
        gaps.push({
          area: 'Rate',
          priority: 'medium',
          message: 'Your rate ($' + userProfile.rate + '/hr) is significantly below the median ($' + rateAnalysis.median + '/hr)',
          action: 'Consider raising your rate — underpricing can signal lower quality'
        });
      } else if (userProfile.rate > rateAnalysis.max) {
        gaps.push({
          area: 'Rate',
          priority: 'low',
          message: 'Your rate ($' + userProfile.rate + '/hr) exceeds all tracked top earners (max: $' + rateAnalysis.max + '/hr)',
          action: 'Ensure your profile clearly justifies the premium positioning'
        });
      } else {
        strengths.push({ area: 'Rate', message: 'Your rate is competitively positioned with top earners' });
      }
    }

    // Profile elements
    if (elementAnalysis) {
      if (!userProfile.hasVideo && elementAnalysis.videoPercentage >= 50) {
        gaps.push({
          area: 'Profile Video',
          priority: 'high',
          message: elementAnalysis.videoPercentage + '% of top earners have a profile video',
          action: 'Add a professional video introduction'
        });
      }
      if ((userProfile.portfolioCount || 0) < elementAnalysis.avgPortfolioItems) {
        gaps.push({
          area: 'Portfolio',
          priority: 'medium',
          message: 'Top earners average ' + elementAnalysis.avgPortfolioItems + ' portfolio items; you have ' + (userProfile.portfolioCount || 0),
          action: 'Add more portfolio items showcasing your best work'
        });
      }
    }

    // JSS
    if (jssAnalysis && userProfile.jss) {
      if (userProfile.jss < jssAnalysis.average) {
        gaps.push({
          area: 'JSS',
          priority: 'high',
          message: 'Your JSS (' + userProfile.jss + '%) is below top earner average (' + jssAnalysis.average + '%)',
          action: 'Focus on client satisfaction and communication'
        });
      } else {
        strengths.push({ area: 'JSS', message: 'Your JSS is on par with or above top earners' });
      }
    }

    return {
      gaps: gaps.sort(function (a, b) {
        var p = { high: 0, medium: 1, low: 2 };
        return (p[a.priority] || 3) - (p[b.priority] || 3);
      }),
      strengths: strengths,
      summary: {
        totalGaps: gaps.length,
        highPriority: gaps.filter(function (g) { return g.priority === 'high'; }).length,
        strengthCount: strengths.length
      }
    };
  }

  // ─── Full Report ────────────────────────────────────────────────────

  function generateReport(category) {
    return {
      category: category || 'All',
      generatedAt: new Date().toISOString(),
      skills: analyzeSkills(category),
      rates: analyzeRates(category),
      profileElements: analyzeProfileElements(category),
      headlines: analyzeHeadlines(category),
      jss: analyzeJSS(category),
      profileCount: getProfiles(category).length
    };
  }

  // ─── Rendering ──────────────────────────────────────────────────────

  function renderReport(containerId, category, userProfile) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var report = generateReport(category);
    var gap = userProfile ? gapAnalysis(userProfile, category) : null;

    var html = '<div class="tea-report" style="font-family:inherit;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">';
    html += '<h3 style="margin:0;">Top Earner Analysis: ' + _esc(report.category) + '</h3>';
    html += '<span style="font-size:12px;color:#6b7280;">' + report.profileCount + ' profiles analyzed</span>';
    html += '</div>';

    // Gap analysis banner
    if (gap) {
      html += '<div style="background:' + (gap.summary.highPriority > 0 ? '#fef2f2' : '#f0fdf4') + ';border-radius:10px;padding:16px;margin-bottom:20px;">';
      html += '<div style="font-weight:600;margin-bottom:8px;">' + (gap.summary.highPriority > 0 ? '⚡' : '✅') + ' Gap Analysis</div>';

      if (gap.gaps.length > 0) {
        gap.gaps.forEach(function (g) {
          var color = g.priority === 'high' ? '#dc2626' : g.priority === 'medium' ? '#d97706' : '#6b7280';
          html += '<div style="margin-bottom:8px;padding:8px;background:#fff;border-radius:6px;border-left:3px solid ' + color + ';">';
          html += '<div style="font-size:13px;font-weight:500;">' + _esc(g.area) + '</div>';
          html += '<div style="font-size:12px;color:#374151;">' + _esc(g.message) + '</div>';
          html += '<div style="font-size:11px;color:#6b7280;margin-top:2px;">→ ' + _esc(g.action) + '</div>';
          html += '</div>';
        });
      }

      if (gap.strengths.length > 0) {
        gap.strengths.forEach(function (s) {
          html += '<div style="font-size:12px;color:#15803d;margin-top:4px;">✓ ' + _esc(s.area) + ': ' + _esc(s.message) + '</div>';
        });
      }
      html += '</div>';
    }

    // Skills grid
    if (report.skills.skills.length > 0) {
      html += '<div style="margin-bottom:20px;">';
      html += '<h4 style="margin:0 0 10px;">Top Skills</h4>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      report.skills.skills.slice(0, 15).forEach(function (s) {
        var bg = s.percentage >= 60 ? '#dbeafe' : s.percentage >= 40 ? '#e0e7ff' : '#f3f4f6';
        html += '<span style="font-size:12px;background:' + bg + ';padding:4px 10px;border-radius:6px;">';
        html += _esc(s.name) + ' <strong>' + s.percentage + '%</strong></span>';
      });
      html += '</div></div>';
    }

    // Rate stats
    if (report.rates) {
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">';
      var metrics = [
        { label: 'Avg Rate', value: '$' + report.rates.average + '/hr' },
        { label: 'Median', value: '$' + report.rates.median + '/hr' },
        { label: 'Range', value: '$' + report.rates.min + '-$' + report.rates.max },
        { label: 'Profiles', value: report.rates.count }
      ];
      metrics.forEach(function (m) {
        html += '<div style="background:#f9fafb;border-radius:8px;padding:12px;text-align:center;">';
        html += '<div style="font-size:11px;color:#6b7280;">' + m.label + '</div>';
        html += '<div style="font-size:16px;font-weight:600;">' + m.value + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Profile elements
    if (report.profileElements) {
      html += '<div style="margin-bottom:20px;">';
      html += '<h4 style="margin:0 0 10px;">Profile Elements</h4>';
      var elements = [
        { label: 'Has Video', pct: report.profileElements.videoPercentage },
        { label: 'Certifications', pct: report.profileElements.certificationPercentage },
        { label: 'Specialization', pct: report.profileElements.specializationPercentage }
      ];
      elements.forEach(function (el) {
        html += '<div style="margin-bottom:8px;">';
        html += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">';
        html += '<span>' + el.label + '</span><span>' + el.pct + '%</span></div>';
        html += '<div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">';
        html += '<div style="background:#3b82f6;height:100%;width:' + el.pct + '%;border-radius:4px;"></div>';
        html += '</div></div>';
      });
      html += '<div style="font-size:12px;color:#6b7280;">Avg portfolio items: ' + report.profileElements.avgPortfolioItems + '</div>';
      html += '</div>';
    }

    // Headline keywords
    if (report.headlines.keywords.length > 0) {
      html += '<div style="margin-bottom:20px;">';
      html += '<h4 style="margin:0 0 10px;">Headline Keywords</h4>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      report.headlines.keywords.slice(0, 12).forEach(function (k) {
        var size = Math.max(11, Math.min(16, 10 + k.count));
        html += '<span style="font-size:' + size + 'px;color:#4b5563;padding:2px 6px;">' + _esc(k.word) + '</span>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Demo Data ──────────────────────────────────────────────────────

  function seedDemoData(category) {
    var demos = [
      { name: 'Alex M.', category: category, rate: 125, earnings: 450000, jss: 98, skills: ['React', 'Node.js', 'TypeScript', 'GraphQL', 'AWS'], portfolioCount: 12, hasVideo: true, hasCertifications: true, hasSpecialization: true, headline: 'Senior Full-Stack Developer | 10+ Years | React & Node Expert' },
      { name: 'Sarah K.', category: category, rate: 110, earnings: 380000, jss: 96, skills: ['React', 'Python', 'Django', 'PostgreSQL', 'Docker'], portfolioCount: 8, hasVideo: true, hasCertifications: false, hasSpecialization: true, headline: 'Full-Stack Engineer | Python & React Specialist' },
      { name: 'James L.', category: category, rate: 95, earnings: 320000, jss: 99, skills: ['React', 'Vue.js', 'Node.js', 'MongoDB', 'Firebase'], portfolioCount: 15, hasVideo: false, hasCertifications: true, hasSpecialization: false, headline: 'Expert JavaScript Developer | SaaS & Startups' },
      { name: 'Maria P.', category: category, rate: 140, earnings: 520000, jss: 97, skills: ['React', 'TypeScript', 'AWS', 'Terraform', 'CI/CD'], portfolioCount: 10, hasVideo: true, hasCertifications: true, hasSpecialization: true, headline: 'Cloud Architect & Full-Stack Expert | 12 Years' },
      { name: 'Chris W.', category: category, rate: 85, earnings: 280000, jss: 95, skills: ['React', 'Next.js', 'Tailwind', 'Prisma', 'Vercel'], portfolioCount: 6, hasVideo: false, hasCertifications: false, hasSpecialization: true, headline: 'Next.js & React Developer | Modern Web Apps' }
    ];
    return bulkAddProfiles(demos);
  }

  // ─── Init ───────────────────────────────────────────────────────────

  function init() {
    console.log('[TopEarnerAnalysis] Initialized');
  }

  // ─── Expose ─────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.TopEarnerAnalysis = {
    init: init,
    addProfile: addProfile,
    bulkAddProfiles: bulkAddProfiles,
    getProfiles: getProfiles,
    getCategories: getCategories,
    clearCategory: clearCategory,
    analyzeSkills: analyzeSkills,
    analyzeRates: analyzeRates,
    analyzeProfileElements: analyzeProfileElements,
    analyzeHeadlines: analyzeHeadlines,
    analyzeJSS: analyzeJSS,
    gapAnalysis: gapAnalysis,
    generateReport: generateReport,
    renderReport: renderReport,
    seedDemoData: seedDemoData
  };
})();
