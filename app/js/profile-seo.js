/**
 * Cortex Freelancer — Upwork Profile SEO Analyzer
 * [UX-006] Profile SEO analyzer
 *
 * Analyzes profile title, description, and skills for search optimization.
 * Compares against high-demand search terms from data/high-demand-skills.json.
 * Expose as window.CortexProfileSEO
 */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────────────────
  let highDemandData = null;
  let dataLoaded = false;

  // ─── Load High-Demand Skills Data ───────────────────────────────────
  async function loadHighDemandData() {
    if (dataLoaded) return highDemandData;
    try {
      const candidates = [
        'data/high-demand-skills.json',
        '../data/high-demand-skills.json',
        '/app/data/high-demand-skills.json',
        '/data/high-demand-skills.json'
      ];

      let lastErr = null;
      for (let i = 0; i < candidates.length; i++) {
        const url = candidates[i];
        try {
          const resp = await fetch(url, { cache: 'force-cache' });
          if (!resp.ok) throw new Error('HTTP ' + resp.status + ' for ' + url);
          highDemandData = await resp.json();
          dataLoaded = true;
          return highDemandData;
        } catch (inner) {
          lastErr = inner;
        }
      }

      throw lastErr || new Error('Failed to load high-demand-skills.json');
    } catch (e) {
      console.warn('[ProfileSEO] Could not load high-demand-skills.json, using built-in fallback', e);
      highDemandData = getFallbackData();
      dataLoaded = true;
    }
    return highDemandData;
  }

  function getFallbackData() {
    return {
      categories: {
        'AI & Machine Learning': {
          searchTerms: ['AI developer', 'machine learning engineer', 'LLM specialist', 'ChatGPT developer'],
          demandScore: 10, avgRate: 85
        },
        'Web Development': {
          searchTerms: ['React developer', 'Next.js developer', 'full stack developer', 'Node.js developer'],
          demandScore: 9, avgRate: 55
        },
        'Mobile Development': {
          searchTerms: ['React Native developer', 'Flutter developer', 'iOS developer', 'mobile app developer'],
          demandScore: 8, avgRate: 60
        },
        'Cloud & DevOps': {
          searchTerms: ['AWS developer', 'DevOps engineer', 'cloud architect', 'Kubernetes specialist'],
          demandScore: 8, avgRate: 70
        },
        'Design': {
          searchTerms: ['UI/UX designer', 'product designer', 'Figma designer', 'web designer'],
          demandScore: 8, avgRate: 50
        }
      },
      genericTitles: ['freelancer', 'developer', 'designer', 'expert', 'specialist', 'professional', 'guru', 'ninja'],
      powerWords: ['senior', 'lead', 'principal', 'architect', 'top-rated', 'enterprise', 'scalable'],
      descriptionStructure: {
        hookPatterns: ['I help', 'I build', 'I specialize', "I've helped", 'I deliver'],
        metricPatterns: ['\\d+\\+?\\s*(years?|clients?|projects?)', '\\d+%', '\\$\\d+'],
        ctaPatterns: ["let's talk", 'reach out', 'message me', 'contact me', 'hire me']
      }
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function normalise(str) {
    return (str || '').toLowerCase().trim();
  }

  function tokenize(text) {
    return normalise(text).split(/[\s,;|\/\-]+/).filter(Boolean);
  }

  function containsAny(text, patterns) {
    const lower = normalise(text);
    return patterns.some(function (p) { return lower.includes(normalise(p)); });
  }

  function matchesRegexAny(text, patterns) {
    return patterns.some(function (p) {
      try { return new RegExp(p, 'i').test(text); } catch (_) { return false; }
    });
  }

  function getAllSearchTerms(data) {
    var terms = [];
    var cats = data.categories || {};
    Object.keys(cats).forEach(function (k) {
      (cats[k].searchTerms || []).forEach(function (t) { terms.push(t); });
    });
    return terms;
  }

  function detectNicheCategories(profileData, data) {
    var title = normalise(profileData.title || '');
    var desc = normalise(profileData.description || profileData.overview || '');
    var skills = (profileData.skills || []).map(normalise);
    var combined = title + ' ' + desc + ' ' + skills.join(' ');

    var cats = data.categories || {};
    var matches = [];

    Object.keys(cats).forEach(function (catName) {
      var cat = cats[catName];
      var termHits = 0;
      (cat.searchTerms || []).forEach(function (term) {
        if (combined.includes(normalise(term))) termHits++;
      });
      if (termHits > 0) {
        matches.push({ category: catName, hits: termHits, demandScore: cat.demandScore || 5 });
      }
    });

    matches.sort(function (a, b) { return b.hits - a.hits || b.demandScore - a.demandScore; });
    return matches;
  }

  // ─── Title Analysis ─────────────────────────────────────────────────
  function analyzeTitle(title, data, nicheCategories) {
    var score = 0;
    var issues = [];
    var suggestions = [];
    var t = normalise(title);

    if (!t || t.length < 3) {
      return { score: 0, issues: ['Title is empty or too short'], suggestions: ['Add a descriptive professional title'] };
    }

    // Length check (ideal: 30-70 chars)
    if (title.length >= 30 && title.length <= 70) {
      score += 20;
    } else if (title.length < 30) {
      score += 10;
      issues.push('Title is too short (' + title.length + ' chars). Aim for 30-70 characters.');
    } else {
      score += 12;
      issues.push('Title is long (' + title.length + ' chars). Shorter titles scan better.');
    }

    // Check for generic words
    var generics = (data.genericTitles || []);
    var words = tokenize(t);
    var genericFound = [];
    generics.forEach(function (g) {
      if (words.indexOf(normalise(g)) !== -1) genericFound.push(g);
    });
    if (genericFound.length > 0) {
      issues.push('Generic terms found: ' + genericFound.join(', ') + '. Be more specific.');
      score += 5;
    } else {
      score += 20;
    }

    // Contains primary skill / niche keyword
    var allTerms = getAllSearchTerms(data);
    var matchedTerms = [];
    allTerms.forEach(function (term) {
      if (t.includes(normalise(term))) matchedTerms.push(term);
    });
    if (matchedTerms.length > 0) {
      score += 30;
    } else {
      score += 5;
      issues.push('Title doesn\'t contain any high-demand search terms.');
    }

    // Power words
    var powers = (data.powerWords || []);
    var hasPower = containsAny(t, powers);
    if (hasPower) {
      score += 15;
    } else {
      issues.push('Consider adding a power word (senior, lead, architect, etc.).');
      score += 5;
    }

    // Pipe/separator for multiple keywords
    if (title.includes('|') || title.includes('—') || title.includes('·')) {
      score += 15;
    } else {
      score += 8;
      issues.push('Use a separator (|) to include multiple searchable keywords.');
    }

    score = Math.min(100, score);

    // Generate suggestions based on niche
    if (nicheCategories.length > 0) {
      var primary = nicheCategories[0].category;
      var cats = data.categories || {};
      var primaryTerms = (cats[primary] || {}).searchTerms || [];
      var bestTerm = primaryTerms[0] || primary;
      var secondTerm = primaryTerms[1] || '';

      suggestions.push(bestTerm + ' | ' + (secondTerm || primary) + ' Specialist');

      if (nicheCategories.length > 1) {
        var secondary = nicheCategories[1].category;
        var secTerms = (cats[secondary] || {}).searchTerms || [];
        suggestions.push('Senior ' + bestTerm + ' | ' + (secTerms[0] || secondary));
      } else {
        suggestions.push('Senior ' + bestTerm + ' — Scalable Solutions');
      }

      suggestions.push('Top-Rated ' + bestTerm + ' | ' + primary);
    } else {
      suggestions.push('Specify your primary skill (e.g., "React Developer | Full Stack")');
      suggestions.push('Add your specialization and a power word');
      suggestions.push('Include the technology/role clients search for');
    }

    return { score: score, issues: issues, suggestions: suggestions.slice(0, 3) };
  }

  // ─── Description Analysis ──────────────────────────────────────────
  function analyzeDescription(description, data, nicheCategories) {
    var desc = description || '';
    var score = 0;
    var issues = [];
    var structure = { hasHook: false, hasMetrics: false, hasCTA: false, hasParagraphs: false, hasSkillMentions: false };

    if (!desc || desc.length < 50) {
      return {
        score: 0,
        keywordDensity: 0,
        missingKeywords: [],
        structure: structure,
        issues: ['Description is empty or too short. Aim for 300-1000 characters.']
      };
    }

    // Length scoring
    if (desc.length >= 300 && desc.length <= 1500) {
      score += 15;
    } else if (desc.length < 300) {
      score += 5;
      issues.push('Description is short (' + desc.length + ' chars). Aim for 300+ characters.');
    } else {
      score += 10;
      issues.push('Description is very long. First 300 chars matter most for preview.');
    }

    // Hook check (first sentence)
    var hookPatterns = (data.descriptionStructure || {}).hookPatterns || [];
    var firstChunk = desc.substring(0, 150);
    structure.hasHook = containsAny(firstChunk, hookPatterns);
    if (structure.hasHook) {
      score += 20;
    } else {
      score += 3;
      issues.push('Opening lacks a strong hook. Start with "I help...", "I build...", or address the client directly.');
    }

    // Metrics check
    var metricPatterns = (data.descriptionStructure || {}).metricPatterns || [];
    structure.hasMetrics = matchesRegexAny(desc, metricPatterns);
    if (structure.hasMetrics) {
      score += 20;
    } else {
      score += 3;
      issues.push('No quantifiable metrics found. Add numbers (years of experience, projects completed, etc.).');
    }

    // CTA check
    var ctaPatterns = (data.descriptionStructure || {}).ctaPatterns || [];
    structure.hasCTA = containsAny(desc, ctaPatterns);
    if (structure.hasCTA) {
      score += 15;
    } else {
      score += 3;
      issues.push('No call-to-action found. End with "Let\'s discuss your project" or similar.');
    }

    // Paragraph structure
    var paragraphs = desc.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 20; });
    structure.hasParagraphs = paragraphs.length >= 2;
    if (structure.hasParagraphs) {
      score += 10;
    } else {
      score += 3;
      issues.push('Break description into multiple paragraphs for readability.');
    }

    // Keyword density
    var lowerDesc = normalise(desc);
    var allTerms = getAllSearchTerms(data);
    var foundKeywords = [];
    var missingKeywords = [];
    var relevantTerms = [];

    // Get terms relevant to user's niche
    var cats = data.categories || {};
    nicheCategories.forEach(function (nc) {
      var cat = cats[nc.category];
      if (cat && cat.searchTerms) {
        cat.searchTerms.forEach(function (t) { relevantTerms.push(t); });
      }
    });
    if (relevantTerms.length === 0) relevantTerms = allTerms.slice(0, 20);

    relevantTerms.forEach(function (term) {
      if (lowerDesc.includes(normalise(term))) {
        foundKeywords.push(term);
      } else {
        missingKeywords.push(term);
      }
    });

    structure.hasSkillMentions = foundKeywords.length > 0;
    var density = relevantTerms.length > 0 ? Math.round((foundKeywords.length / relevantTerms.length) * 100) : 0;

    if (density >= 30) {
      score += 20;
    } else if (density >= 15) {
      score += 12;
      issues.push('Keyword coverage is moderate (' + density + '%). Weave in more relevant terms naturally.');
    } else {
      score += 5;
      issues.push('Low keyword density (' + density + '%). Include more searchable terms in your description.');
    }

    score = Math.min(100, score);

    return {
      score: score,
      keywordDensity: density,
      missingKeywords: missingKeywords.slice(0, 10),
      structure: structure,
      issues: issues
    };
  }

  // ─── Skills Analysis ───────────────────────────────────────────────
  function analyzeSkills(skills, data) {
    var userSkills = (skills || []).map(normalise);
    if (userSkills.length === 0) {
      return { score: 0, highDemandPresent: [], highDemandMissing: [], issues: ['No skills listed. Add your top skills.'] };
    }

    var allTerms = getAllSearchTerms(data);
    var present = [];
    var missing = [];

    // Map search terms to single keywords for skill matching
    allTerms.forEach(function (term) {
      var lower = normalise(term);
      var matched = userSkills.some(function (s) {
        return lower.includes(s) || s.includes(lower) ||
               lower.split(/\s+/).some(function (w) { return s.includes(w) && w.length > 3; });
      });
      if (matched) {
        present.push(term);
      }
    });

    // Find high-demand categories where user has no matching skills
    var cats = data.categories || {};
    Object.keys(cats).forEach(function (catName) {
      var cat = cats[catName];
      if (cat.demandScore >= 8) {
        var hasAny = (cat.searchTerms || []).some(function (term) {
          var lower = normalise(term);
          return userSkills.some(function (s) {
            return lower.includes(s) || s.includes(lower);
          });
        });
        if (!hasAny) {
          missing.push(catName + ' (' + (cat.searchTerms || [])[0] + ')');
        }
      }
    });

    var score = 0;

    // Skill count scoring
    if (userSkills.length >= 5 && userSkills.length <= 15) {
      score += 30;
    } else if (userSkills.length < 5) {
      score += 15;
    } else {
      score += 20;
    }

    // High-demand overlap
    var overlapRatio = present.length / Math.max(userSkills.length, 1);
    if (overlapRatio >= 0.4) {
      score += 40;
    } else if (overlapRatio >= 0.2) {
      score += 25;
    } else {
      score += 10;
    }

    // Diversity bonus
    var matchedCats = new Set();
    Object.keys(cats).forEach(function (catName) {
      var cat = cats[catName];
      var hasAny = (cat.searchTerms || []).some(function (term) {
        var lower = normalise(term);
        return userSkills.some(function (s) { return lower.includes(s) || s.includes(lower); });
      });
      if (hasAny) matchedCats.add(catName);
    });
    if (matchedCats.size >= 2 && matchedCats.size <= 3) {
      score += 30;
    } else if (matchedCats.size === 1) {
      score += 20;
    } else if (matchedCats.size > 3) {
      score += 15; // Too scattered
    } else {
      score += 5;
    }

    score = Math.min(100, score);

    return {
      score: score,
      highDemandPresent: present.slice(0, 15),
      highDemandMissing: missing.slice(0, 8)
    };
  }

  // ─── Recommendations Engine ─────────────────────────────────────────
  function generateRecommendations(titleAnalysis, descAnalysis, skillsAnalysis) {
    var recs = [];

    // Title recs
    if (titleAnalysis.score < 50) {
      recs.push({ action: 'Rewrite your profile title with specific, searchable keywords', impact: 'high', effort: 'low' });
    }
    titleAnalysis.issues.forEach(function (issue) {
      if (issue.includes('generic')) {
        recs.push({ action: 'Replace generic terms in title with specific skills', impact: 'high', effort: 'low' });
      }
      if (issue.includes('separator')) {
        recs.push({ action: 'Use pipe separators (|) to pack multiple keywords in title', impact: 'medium', effort: 'low' });
      }
      if (issue.includes('power word')) {
        recs.push({ action: 'Add seniority/authority words (Senior, Lead, Architect) to title', impact: 'medium', effort: 'low' });
      }
    });

    // Description recs
    if (!descAnalysis.structure.hasHook) {
      recs.push({ action: 'Add a compelling hook in the first sentence of your description', impact: 'high', effort: 'medium' });
    }
    if (!descAnalysis.structure.hasMetrics) {
      recs.push({ action: 'Add quantifiable results and metrics (X years, Y projects, Z% improvement)', impact: 'high', effort: 'medium' });
    }
    if (!descAnalysis.structure.hasCTA) {
      recs.push({ action: 'Add a call-to-action at the end of your description', impact: 'medium', effort: 'low' });
    }
    if (descAnalysis.keywordDensity < 20) {
      recs.push({ action: 'Naturally weave more niche keywords into your description', impact: 'high', effort: 'medium' });
    }

    // Skills recs
    if (skillsAnalysis.highDemandMissing && skillsAnalysis.highDemandMissing.length > 3) {
      recs.push({ action: 'Add high-demand skills you possess but haven\'t listed', impact: 'medium', effort: 'low' });
    }

    // Sort by impact
    var impactOrder = { high: 0, medium: 1, low: 2 };
    recs.sort(function (a, b) {
      return (impactOrder[a.impact] || 2) - (impactOrder[b.impact] || 2);
    });

    // Deduplicate
    var seen = {};
    return recs.filter(function (r) {
      if (seen[r.action]) return false;
      seen[r.action] = true;
      return true;
    });
  }

  // ─── Main Analysis ──────────────────────────────────────────────────
  async function analyzeSEO(profileData) {
    var data = await loadHighDemandData();
    var nicheCategories = detectNicheCategories(profileData, data);

    var titleAnalysis = analyzeTitle(profileData.title || '', data, nicheCategories);
    var descAnalysis = analyzeDescription(
      profileData.description || profileData.overview || '', data, nicheCategories
    );
    var skillsAnalysis = analyzeSkills(profileData.skills || [], data);

    // Overall score (weighted)
    var seoScore = Math.round(
      titleAnalysis.score * 0.35 +
      descAnalysis.score * 0.40 +
      skillsAnalysis.score * 0.25
    );

    // Top search terms relevant to user's niche
    var topSearchTerms = [];
    var cats = data.categories || {};
    nicheCategories.slice(0, 3).forEach(function (nc) {
      var cat = cats[nc.category];
      if (cat && cat.searchTerms) {
        cat.searchTerms.slice(0, 5).forEach(function (t) {
          if (topSearchTerms.indexOf(t) === -1) topSearchTerms.push(t);
        });
      }
    });
    if (topSearchTerms.length === 0) {
      // Fallback: top terms from highest demand categories
      Object.keys(cats)
        .sort(function (a, b) { return (cats[b].demandScore || 0) - (cats[a].demandScore || 0); })
        .slice(0, 3)
        .forEach(function (k) {
          (cats[k].searchTerms || []).slice(0, 4).forEach(function (t) {
            if (topSearchTerms.indexOf(t) === -1) topSearchTerms.push(t);
          });
        });
    }

    var recommendations = generateRecommendations(titleAnalysis, descAnalysis, skillsAnalysis);

    return {
      seoScore: seoScore,
      titleAnalysis: titleAnalysis,
      descriptionAnalysis: descAnalysis,
      skillsAnalysis: skillsAnalysis,
      topSearchTerms: topSearchTerms.slice(0, 15),
      recommendations: recommendations
    };
  }

  // ─── Render ─────────────────────────────────────────────────────────
  async function renderProfileSEO(profileData, container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) { console.error('[ProfileSEO] Container not found'); return; }

    container.innerHTML = '<div class="seo-loading" style="color:#999;padding:40px;text-align:center">Analyzing profile SEO…</div>';

    var result = await analyzeSEO(profileData);
    var html = [];

    // ── Header ──
    html.push('<div class="profile-seo">');
    html.push('<h2 class="seo-header">🔍 Profile SEO Analysis</h2>');

    // ── Overall Score Meter ──
    var grade = result.seoScore >= 80 ? 'A' : result.seoScore >= 60 ? 'B' : result.seoScore >= 40 ? 'C' : 'D';
    var gradeColor = result.seoScore >= 80 ? '#22c55e' : result.seoScore >= 60 ? '#eab308' : result.seoScore >= 40 ? '#f97316' : '#ef4444';

    html.push('<div class="seo-score-section">');
    html.push('  <div class="seo-score-ring" style="--score:' + result.seoScore + ';--color:' + gradeColor + '">');
    html.push('    <svg viewBox="0 0 120 120">');
    html.push('      <circle class="seo-ring-bg" cx="60" cy="60" r="52"/>');
    html.push('      <circle class="seo-ring-fg" cx="60" cy="60" r="52"');
    html.push('        stroke-dasharray="' + Math.round(326.7 * result.seoScore / 100) + ' 326.7"/>');
    html.push('    </svg>');
    html.push('    <div class="seo-score-label">');
    html.push('      <span class="seo-score-num">' + result.seoScore + '</span>');
    html.push('      <span class="seo-score-grade">' + grade + '</span>');
    html.push('    </div>');
    html.push('  </div>');
    html.push('  <div class="seo-score-summary">');
    html.push('    <div class="seo-sub-scores">');
    html.push('      <div class="seo-sub"><span class="seo-sub-icon">📝</span> Title <strong>' + result.titleAnalysis.score + '</strong></div>');
    html.push('      <div class="seo-sub"><span class="seo-sub-icon">📄</span> Description <strong>' + result.descriptionAnalysis.score + '</strong></div>');
    html.push('      <div class="seo-sub"><span class="seo-sub-icon">🛠️</span> Skills <strong>' + result.skillsAnalysis.score + '</strong></div>');
    html.push('    </div>');
    html.push('  </div>');
    html.push('</div>');

    // ── Title Section ──
    html.push('<div class="seo-section">');
    html.push('  <h3>📝 Title Analysis</h3>');
    html.push('  <div class="seo-current-title">' + esc(profileData.title || '(no title)') + '</div>');

    if (result.titleAnalysis.issues.length > 0) {
      html.push('  <div class="seo-issues">');
      result.titleAnalysis.issues.forEach(function (issue) {
        html.push('    <div class="seo-issue">⚠️ ' + esc(issue) + '</div>');
      });
      html.push('  </div>');
    }

    if (result.titleAnalysis.suggestions.length > 0) {
      html.push('  <div class="seo-suggestions">');
      html.push('    <div class="seo-suggestions-label">💡 Optimized Suggestions</div>');
      result.titleAnalysis.suggestions.forEach(function (sug, i) {
        html.push('    <div class="seo-suggestion">' + (i + 1) + '. ' + esc(sug) + '</div>');
      });
      html.push('  </div>');
    }
    html.push('</div>');

    // ── Description Section ──
    html.push('<div class="seo-section">');
    html.push('  <h3>📄 Description Analysis</h3>');

    // Keyword density bar
    var density = result.descriptionAnalysis.keywordDensity || 0;
    var densityColor = density >= 30 ? '#22c55e' : density >= 15 ? '#eab308' : '#ef4444';
    html.push('  <div class="seo-density">');
    html.push('    <div class="seo-density-label">Keyword Density: <strong>' + density + '%</strong></div>');
    html.push('    <div class="seo-density-bar"><div class="seo-density-fill" style="width:' + Math.min(density, 100) + '%;background:' + densityColor + '"></div></div>');
    html.push('  </div>');

    // Missing keywords
    var missing = result.descriptionAnalysis.missingKeywords || [];
    if (missing.length > 0) {
      html.push('  <div class="seo-missing">');
      html.push('    <div class="seo-missing-label">Missing Keywords</div>');
      html.push('    <div class="seo-badges">');
      missing.forEach(function (kw) {
        html.push('      <span class="seo-badge seo-badge-missing">' + esc(kw) + '</span>');
      });
      html.push('    </div>');
      html.push('  </div>');
    }

    // Structure checklist
    var struct = result.descriptionAnalysis.structure || {};
    html.push('  <div class="seo-checklist">');
    html.push('    <div class="seo-checklist-label">Structure Checklist</div>');
    html.push('    <div class="seo-check">' + (struct.hasHook ? '✅' : '❌') + ' Strong opening hook</div>');
    html.push('    <div class="seo-check">' + (struct.hasMetrics ? '✅' : '❌') + ' Quantifiable metrics</div>');
    html.push('    <div class="seo-check">' + (struct.hasCTA ? '✅' : '❌') + ' Call-to-action</div>');
    html.push('    <div class="seo-check">' + (struct.hasParagraphs ? '✅' : '❌') + ' Multiple paragraphs</div>');
    html.push('    <div class="seo-check">' + (struct.hasSkillMentions ? '✅' : '❌') + ' Skill keyword mentions</div>');
    html.push('  </div>');

    // Description issues
    if (result.descriptionAnalysis.issues && result.descriptionAnalysis.issues.length > 0) {
      html.push('  <div class="seo-issues">');
      result.descriptionAnalysis.issues.forEach(function (issue) {
        html.push('    <div class="seo-issue">⚠️ ' + esc(issue) + '</div>');
      });
      html.push('  </div>');
    }
    html.push('</div>');

    // ── Top Search Terms ──
    html.push('<div class="seo-section">');
    html.push('  <h3>🏷️ Top Search Terms in Your Niche</h3>');
    html.push('  <div class="seo-tags">');
    result.topSearchTerms.forEach(function (term, i) {
      var size = i < 3 ? 'seo-tag-lg' : i < 8 ? 'seo-tag-md' : 'seo-tag-sm';
      html.push('    <span class="seo-tag ' + size + '">' + esc(term) + '</span>');
    });
    html.push('  </div>');
    html.push('</div>');

    // ── Skills Analysis ──
    html.push('<div class="seo-section">');
    html.push('  <h3>🛠️ Skills Analysis</h3>');
    if (result.skillsAnalysis.highDemandPresent.length > 0) {
      html.push('  <div class="seo-skills-group">');
      html.push('    <div class="seo-skills-label">✅ High-Demand Skills Present</div>');
      html.push('    <div class="seo-badges">');
      result.skillsAnalysis.highDemandPresent.forEach(function (s) {
        html.push('      <span class="seo-badge seo-badge-present">' + esc(s) + '</span>');
      });
      html.push('    </div>');
      html.push('  </div>');
    }
    if (result.skillsAnalysis.highDemandMissing && result.skillsAnalysis.highDemandMissing.length > 0) {
      html.push('  <div class="seo-skills-group">');
      html.push('    <div class="seo-skills-label">💡 Consider Adding</div>');
      html.push('    <div class="seo-badges">');
      result.skillsAnalysis.highDemandMissing.forEach(function (s) {
        html.push('      <span class="seo-badge seo-badge-missing">' + esc(s) + '</span>');
      });
      html.push('    </div>');
      html.push('  </div>');
    }
    html.push('</div>');

    // ── Action Items ──
    if (result.recommendations.length > 0) {
      html.push('<div class="seo-section">');
      html.push('  <h3>🎯 Action Items</h3>');
      html.push('  <div class="seo-actions">');
      result.recommendations.forEach(function (rec, i) {
        var impactClass = 'seo-impact-' + rec.impact;
        var impactIcon = rec.impact === 'high' ? '🔴' : rec.impact === 'medium' ? '🟡' : '🟢';
        html.push('    <div class="seo-action ' + impactClass + '">');
        html.push('      <div class="seo-action-num">' + (i + 1) + '</div>');
        html.push('      <div class="seo-action-body">');
        html.push('        <div class="seo-action-text">' + esc(rec.action) + '</div>');
        html.push('        <div class="seo-action-meta">' + impactIcon + ' ' + rec.impact + ' impact · ' + rec.effort + ' effort</div>');
        html.push('      </div>');
        html.push('    </div>');
      });
      html.push('  </div>');
      html.push('</div>');
    }

    html.push('</div>');

    // ── Inject styles + HTML ──
    container.innerHTML = getStyles() + html.join('\n');
  }

  // ─── Escape ─────────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ─── Styles ─────────────────────────────────────────────────────────
  function getStyles() {
    return '<style>' +
    '.profile-seo{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#e2e8f0;max-width:720px}' +
    '.seo-header{font-size:1.5rem;margin:0 0 24px;color:#f1f5f9}' +

    /* Score ring */
    '.seo-score-section{display:flex;align-items:center;gap:32px;margin-bottom:32px;padding:24px;background:#1e293b;border-radius:16px;border:1px solid #334155}' +
    '.seo-score-ring{position:relative;width:120px;height:120px;flex-shrink:0}' +
    '.seo-score-ring svg{width:100%;height:100%;transform:rotate(-90deg)}' +
    '.seo-ring-bg{fill:none;stroke:#334155;stroke-width:8}' +
    '.seo-ring-fg{fill:none;stroke:var(--color);stroke-width:8;stroke-linecap:round;transition:stroke-dasharray .8s ease}' +
    '.seo-score-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}' +
    '.seo-score-num{font-size:2rem;font-weight:700;color:#f1f5f9;line-height:1}' +
    '.seo-score-grade{font-size:.85rem;color:#94a3b8;margin-top:2px}' +
    '.seo-sub-scores{display:flex;flex-direction:column;gap:8px}' +
    '.seo-sub{display:flex;align-items:center;gap:8px;font-size:.9rem;color:#94a3b8}' +
    '.seo-sub strong{color:#f1f5f9;margin-left:auto}' +
    '.seo-sub-icon{font-size:1rem}' +

    /* Sections */
    '.seo-section{margin-bottom:24px;padding:20px;background:#1e293b;border-radius:12px;border:1px solid #334155}' +
    '.seo-section h3{font-size:1.1rem;margin:0 0 16px;color:#f1f5f9}' +

    /* Title */
    '.seo-current-title{padding:12px 16px;background:#0f172a;border-radius:8px;font-family:monospace;font-size:.95rem;color:#e2e8f0;border:1px solid #334155;margin-bottom:12px;word-break:break-word}' +
    '.seo-issues{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}' +
    '.seo-issue{font-size:.85rem;color:#fbbf24;padding:6px 10px;background:rgba(251,191,36,.08);border-radius:6px}' +
    '.seo-suggestions{margin-top:12px}' +
    '.seo-suggestions-label{font-size:.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}' +
    '.seo-suggestion{padding:8px 12px;background:#0f172a;border-radius:6px;margin-bottom:6px;font-size:.9rem;color:#38bdf8;border-left:3px solid #38bdf8}' +

    /* Density bar */
    '.seo-density{margin-bottom:16px}' +
    '.seo-density-label{font-size:.85rem;color:#94a3b8;margin-bottom:6px}' +
    '.seo-density-bar{height:8px;background:#334155;border-radius:4px;overflow:hidden}' +
    '.seo-density-fill{height:100%;border-radius:4px;transition:width .6s ease}' +

    /* Badges */
    '.seo-badges{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}' +
    '.seo-badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:.8rem;font-weight:500}' +
    '.seo-badge-missing{background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.3)}' +
    '.seo-badge-present{background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.3)}' +
    '.seo-missing-label,.seo-skills-label,.seo-checklist-label{font-size:.8rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}' +
    '.seo-missing{margin-bottom:16px}' +

    /* Checklist */
    '.seo-checklist{margin-bottom:16px}' +
    '.seo-check{font-size:.9rem;color:#cbd5e1;padding:4px 0}' +

    /* Tags (word cloud) */
    '.seo-tags{display:flex;flex-wrap:wrap;gap:8px}' +
    '.seo-tag{display:inline-block;padding:6px 14px;border-radius:20px;background:#334155;color:#e2e8f0;cursor:default;transition:transform .15s}' +
    '.seo-tag:hover{transform:scale(1.05)}' +
    '.seo-tag-lg{font-size:1rem;font-weight:600;background:#1d4ed8;color:#dbeafe}' +
    '.seo-tag-md{font-size:.9rem;font-weight:500;background:#1e40af;color:#bfdbfe}' +
    '.seo-tag-sm{font-size:.8rem;color:#94a3b8}' +

    /* Skills group */
    '.seo-skills-group{margin-bottom:16px}' +

    /* Action items */
    '.seo-actions{display:flex;flex-direction:column;gap:8px}' +
    '.seo-action{display:flex;gap:12px;padding:12px;border-radius:8px;background:#0f172a;border:1px solid #334155}' +
    '.seo-action-num{width:28px;height:28px;border-radius:50%;background:#334155;color:#f1f5f9;display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:600;flex-shrink:0}' +
    '.seo-action-body{flex:1;min-width:0}' +
    '.seo-action-text{font-size:.9rem;color:#e2e8f0;margin-bottom:4px}' +
    '.seo-action-meta{font-size:.75rem;color:#64748b}' +
    '.seo-impact-high .seo-action-num{background:#7f1d1d;color:#fca5a5}' +
    '.seo-impact-medium .seo-action-num{background:#713f12;color:#fde68a}' +
    '.seo-impact-low .seo-action-num{background:#14532d;color:#86efac}' +

    /* Loading */
    '.seo-loading{animation:seo-pulse 1.5s infinite}' +
    '@keyframes seo-pulse{0%,100%{opacity:.4}50%{opacity:1}}' +
    '</style>';
  }

  // ─── Export ─────────────────────────────────────────────────────────
  window.CortexProfileSEO = {
    analyzeSEO: analyzeSEO,
    renderProfileSEO: renderProfileSEO
  };

})();
