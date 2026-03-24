/**
 * [CF-061] Competition Density Heatmap by Category
 * Show which Upwork categories are oversaturated vs underserved
 * using job-to-freelancer ratios with a visual heatmap grid,
 * color-coded cells, and actionable recommendations.
 *
 * Exposed on window.CortexFreelancer.competitionDensityHeatmap
 */
(function () {
  'use strict';

  // ─── Static Benchmark Data (25+ categories) ──────────────────────────
  // avgJobs: estimated monthly job postings
  // avgFreelancers: active freelancers in category
  // avgRate: median hourly rate (USD)
  // growthTrend: YoY demand change as decimal (-0.1 = -10%, 0.15 = +15%)
  // subcategories: notable sub-specializations
  var CATEGORIES = [
    { name: 'Web Development',     avgJobs: 12400, avgFreelancers: 38000, avgRate: 50, growthTrend:  0.05, subcategories: ['Frontend', 'Backend', 'Full-Stack', 'JAMstack'] },
    { name: 'Mobile Development',  avgJobs: 6800,  avgFreelancers: 18000, avgRate: 55, growthTrend:  0.08, subcategories: ['iOS', 'Android', 'Cross-Platform', 'PWA'] },
    { name: 'React',               avgJobs: 5600,  avgFreelancers: 14000, avgRate: 55, growthTrend:  0.12, subcategories: ['Next.js', 'React Native', 'Redux', 'Gatsby'] },
    { name: 'Python',              avgJobs: 8200,  avgFreelancers: 22000, avgRate: 55, growthTrend:  0.15, subcategories: ['Django', 'Flask', 'FastAPI', 'Scripting'] },
    { name: 'Data Science',        avgJobs: 4500,  avgFreelancers: 8000,  avgRate: 65, growthTrend:  0.18, subcategories: ['Analytics', 'Visualization', 'Statistical Modeling', 'Pandas'] },
    { name: 'Machine Learning',    avgJobs: 3800,  avgFreelancers: 5500,  avgRate: 70, growthTrend:  0.25, subcategories: ['Deep Learning', 'Computer Vision', 'Reinforcement Learning', 'MLOps'] },
    { name: 'AI/LLM',             avgJobs: 5200,  avgFreelancers: 3800,  avgRate: 80, growthTrend:  0.45, subcategories: ['Prompt Engineering', 'Fine-Tuning', 'RAG', 'AI Agents'] },
    { name: 'UI/UX Design',       avgJobs: 7200,  avgFreelancers: 21000, avgRate: 50, growthTrend:  0.07, subcategories: ['Wireframing', 'Prototyping', 'User Research', 'Design Systems'] },
    { name: 'Graphic Design',     avgJobs: 9500,  avgFreelancers: 35000, avgRate: 40, growthTrend: -0.02, subcategories: ['Logo Design', 'Branding', 'Illustration', 'Print'] },
    { name: 'DevOps',             avgJobs: 3600,  avgFreelancers: 6000,  avgRate: 65, growthTrend:  0.14, subcategories: ['CI/CD', 'Docker', 'Kubernetes', 'Terraform'] },
    { name: 'Cloud Architecture', avgJobs: 2800,  avgFreelancers: 4200,  avgRate: 70, growthTrend:  0.16, subcategories: ['AWS', 'Azure', 'GCP', 'Serverless'] },
    { name: 'Blockchain',         avgJobs: 1500,  avgFreelancers: 4800,  avgRate: 75, growthTrend: -0.12, subcategories: ['Solidity', 'Smart Contracts', 'DeFi', 'NFT'] },
    { name: 'Cybersecurity',      avgJobs: 2200,  avgFreelancers: 3200,  avgRate: 65, growthTrend:  0.20, subcategories: ['Penetration Testing', 'Auditing', 'Compliance', 'SIEM'] },
    { name: 'Technical Writing',  avgJobs: 2400,  avgFreelancers: 6500,  avgRate: 40, growthTrend:  0.05, subcategories: ['API Docs', 'User Guides', 'Whitepapers', 'Knowledge Base'] },
    { name: 'SEO',                avgJobs: 5500,  avgFreelancers: 18000, avgRate: 38, growthTrend:  0.01, subcategories: ['Technical SEO', 'Content SEO', 'Local SEO', 'Link Building'] },
    { name: 'Copywriting',        avgJobs: 5200,  avgFreelancers: 16000, avgRate: 42, growthTrend:  0.03, subcategories: ['Sales Copy', 'Ad Copy', 'Email Marketing', 'Brand Voice'] },
    { name: 'Video Editing',      avgJobs: 4800,  avgFreelancers: 14000, avgRate: 38, growthTrend:  0.10, subcategories: ['YouTube', 'Social Media', 'Motion Graphics', 'Color Grading'] },
    { name: 'WordPress',          avgJobs: 6200,  avgFreelancers: 28000, avgRate: 35, growthTrend: -0.08, subcategories: ['Theme Dev', 'Plugin Dev', 'WooCommerce', 'Migration'] },
    { name: 'Angular',            avgJobs: 2200,  avgFreelancers: 8500,  avgRate: 50, growthTrend: -0.05, subcategories: ['Angular Material', 'NgRx', 'Universal', 'Ionic'] },
    { name: 'Vue.js',             avgJobs: 1800,  avgFreelancers: 5200,  avgRate: 48, growthTrend:  0.06, subcategories: ['Nuxt.js', 'Vuex', 'Vuetify', 'Composition API'] },
    { name: 'Node.js',            avgJobs: 4800,  avgFreelancers: 12000, avgRate: 52, growthTrend:  0.10, subcategories: ['Express', 'NestJS', 'GraphQL', 'Microservices'] },
    { name: 'QA Testing',         avgJobs: 3800,  avgFreelancers: 11000, avgRate: 35, growthTrend:  0.02, subcategories: ['Manual', 'Automation', 'Performance', 'Security'] },
    { name: 'Digital Marketing',  avgJobs: 7000,  avgFreelancers: 22000, avgRate: 42, growthTrend:  0.06, subcategories: ['PPC', 'Social Media', 'Analytics', 'Email'] },
    { name: 'Flutter',            avgJobs: 2200,  avgFreelancers: 4500,  avgRate: 52, growthTrend:  0.18, subcategories: ['Mobile', 'Web', 'Desktop', 'Flame'] },
    { name: 'Data Engineering',   avgJobs: 3000,  avgFreelancers: 4500,  avgRate: 68, growthTrend:  0.20, subcategories: ['ETL', 'Spark', 'Airflow', 'dbt'] },
    { name: 'NLP',                avgJobs: 2100,  avgFreelancers: 2800,  avgRate: 75, growthTrend:  0.30, subcategories: ['Text Classification', 'Sentiment', 'Chatbots', 'Summarization'] },
    { name: 'Automation/RPA',     avgJobs: 2400,  avgFreelancers: 3500,  avgRate: 50, growthTrend:  0.15, subcategories: ['UiPath', 'Zapier', 'Python Scripts', 'Power Automate'] },
    { name: 'Rust/Go',            avgJobs: 1100,  avgFreelancers: 1600,  avgRate: 65, growthTrend:  0.28, subcategories: ['Systems', 'CLI Tools', 'WASM', 'Networking'] },
    { name: 'AR/VR',              avgJobs: 900,   avgFreelancers: 1800,  avgRate: 65, growthTrend:  0.22, subcategories: ['Unity XR', 'Unreal', 'WebXR', 'Spatial Computing'] },
    { name: 'Shopify',            avgJobs: 3200,  avgFreelancers: 9000,  avgRate: 40, growthTrend:  0.08, subcategories: ['Theme Dev', 'App Dev', 'Liquid', 'Headless'] },
    { name: 'iOS Development',    avgJobs: 3200,  avgFreelancers: 9500,  avgRate: 60, growthTrend:  0.04, subcategories: ['Swift', 'SwiftUI', 'Objective-C', 'App Clips'] },
    { name: 'Android Development', avgJobs: 3500, avgFreelancers: 12000, avgRate: 55, growthTrend:  0.03, subcategories: ['Kotlin', 'Jetpack Compose', 'NDK', 'Wear OS'] },
    { name: 'Unity/Game Dev',     avgJobs: 1400,  avgFreelancers: 5200,  avgRate: 50, growthTrend:  0.06, subcategories: ['2D', '3D', 'Multiplayer', 'VR Games'] },
    { name: '3D Modeling',        avgJobs: 1200,  avgFreelancers: 4000,  avgRate: 45, growthTrend:  0.10, subcategories: ['Blender', 'Maya', 'Rendering', 'Product Viz'] },
    { name: 'Project Management', avgJobs: 2600,  avgFreelancers: 7500,  avgRate: 50, growthTrend:  0.04, subcategories: ['Agile', 'Scrum', 'PMO', 'Jira Admin'] }
  ];

  // ─── Configuration ────────────────────────────────────────────────────
  var config = {
    userCategories: [],
    sortBy: 'densityScore',
    sortOrder: 'desc',
    filterLabel: 'all'
  };

  // ─── Ratio Range for Normalization ────────────────────────────────────
  function _computeRatios() {
    var ratios = [];
    for (var i = 0; i < CATEGORIES.length; i++) {
      var c = CATEGORIES[i];
      if (c.avgFreelancers > 0) {
        ratios.push(c.avgJobs / c.avgFreelancers);
      }
    }
    return ratios;
  }

  function _ratioRange() {
    var ratios = _computeRatios();
    var min = ratios[0];
    var max = ratios[0];
    for (var i = 1; i < ratios.length; i++) {
      if (ratios[i] < min) min = ratios[i];
      if (ratios[i] > max) max = ratios[i];
    }
    return { min: min, max: max };
  }

  // ─── Core Functions ───────────────────────────────────────────────────

  /**
   * Compute the density score (0-100) for a category object.
   * Higher = more jobs per freelancer (underserved / opportunity).
   * Lower = oversaturated.
   */
  function getDensityScore(category) {
    if (!category || category.avgFreelancers === 0) return 0;
    var ratio = category.avgJobs / category.avgFreelancers;
    var range = _ratioRange();
    if (range.max === range.min) return 50;
    return Math.round(((ratio - range.min) / (range.max - range.min)) * 100);
  }

  /**
   * Build enriched data for all categories.
   */
  function _buildCategoryData() {
    var results = [];
    for (var i = 0; i < CATEGORIES.length; i++) {
      var c = CATEGORIES[i];
      var ratio = c.avgFreelancers > 0 ? c.avgJobs / c.avgFreelancers : 0;
      var score = getDensityScore(c);
      var label = score >= 65 ? 'underserved'
                : score <= 35 ? 'oversaturated'
                : 'balanced';
      results.push({
        name: c.name,
        avgJobs: c.avgJobs,
        avgFreelancers: c.avgFreelancers,
        avgRate: c.avgRate,
        growthTrend: c.growthTrend,
        subcategories: c.subcategories,
        ratio: Math.round(ratio * 1000) / 1000,
        densityScore: score,
        label: label
      });
    }
    return results;
  }

  /**
   * Get analysis for a specific category by name.
   */
  function getCategoryAnalysis(categoryName) {
    var data = _buildCategoryData();
    var found = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i].name === categoryName) {
        found = data[i];
        break;
      }
    }
    if (!found) return null;

    var analysis = {
      category: found.name,
      densityScore: found.densityScore,
      label: found.label,
      ratio: found.ratio,
      avgJobs: found.avgJobs,
      avgFreelancers: found.avgFreelancers,
      avgRate: found.avgRate,
      growthTrend: found.growthTrend,
      subcategories: found.subcategories,
      insight: '',
      actionItems: []
    };

    if (found.label === 'underserved') {
      analysis.insight = 'This category has strong demand relative to freelancer supply. Rates tend to be higher and clients are more willing to negotiate.';
      analysis.actionItems = [
        'Position yourself as a specialist in this space',
        'Consider raising your rates above the $' + found.avgRate + '/hr average',
        'Build case studies demonstrating expertise',
        'Target long-term contracts while supply is low'
      ];
    } else if (found.label === 'oversaturated') {
      analysis.insight = 'High freelancer supply makes this category very competitive. Standing out requires strong differentiation and competitive pricing.';
      analysis.actionItems = [
        'Specialize in a niche subcategory to reduce competition',
        'Invest in portfolio pieces that showcase unique value',
        'Consider bundling services to increase perceived value',
        'Focus on client relationships and repeat business'
      ];
    } else {
      analysis.insight = 'This category has a balanced supply-demand ratio. Steady opportunities exist for freelancers who maintain quality profiles.';
      analysis.actionItems = [
        'Maintain a strong portfolio with recent work samples',
        'Keep skills current with emerging trends',
        'Develop a niche to stand out from the crowd',
        'Aim for the $' + found.avgRate + '/hr market rate or above'
      ];
    }

    if (found.growthTrend > 0.15) {
      analysis.actionItems.push('Demand is growing fast (' + Math.round(found.growthTrend * 100) + '% YoY) — invest in this skill now');
    } else if (found.growthTrend < -0.05) {
      analysis.actionItems.push('Demand is declining (' + Math.round(found.growthTrend * 100) + '% YoY) — consider diversifying');
    }

    return analysis;
  }

  /**
   * Get personalized recommendations based on user's categories.
   */
  function getRecommendations(userCategories) {
    var cats = userCategories || config.userCategories || [];
    if (!cats.length) {
      return {
        summary: 'No categories selected. Add your skills to get personalized recommendations.',
        recommendations: [],
        topOpportunities: _getTopOpportunities(),
        avoidList: _getAvoidList()
      };
    }

    var data = _buildCategoryData();
    var userAnalyses = [];
    for (var i = 0; i < cats.length; i++) {
      var analysis = getCategoryAnalysis(cats[i]);
      if (analysis) userAnalyses.push(analysis);
    }

    // Sort by density score desc (best opportunities first)
    userAnalyses.sort(function (a, b) { return b.densityScore - a.densityScore; });

    var avgScore = 0;
    for (var j = 0; j < userAnalyses.length; j++) {
      avgScore += userAnalyses[j].densityScore;
    }
    avgScore = userAnalyses.length > 0 ? Math.round(avgScore / userAnalyses.length) : 0;

    var summary = '';
    if (avgScore >= 65) {
      summary = 'Your skill portfolio is well-positioned in underserved markets. You have strong earning potential.';
    } else if (avgScore >= 40) {
      summary = 'Your skills are in moderately competitive categories. Consider specializing to improve your position.';
    } else {
      summary = 'Your categories are highly competitive. Niche specialization and differentiation are critical.';
    }

    // Find adjacent opportunities from the data that user does NOT have
    var userNameSet = {};
    for (var k = 0; k < cats.length; k++) {
      userNameSet[cats[k]] = true;
    }
    var adjacent = [];
    for (var m = 0; m < data.length; m++) {
      if (!userNameSet[data[m].name] && data[m].densityScore >= 55 && data[m].growthTrend > 0.10) {
        adjacent.push(data[m]);
      }
    }
    adjacent.sort(function (a, b) { return b.densityScore - a.densityScore; });
    adjacent = adjacent.slice(0, 5);

    return {
      summary: summary,
      averageScore: avgScore,
      analyses: userAnalyses,
      adjacentOpportunities: adjacent,
      topOpportunities: _getTopOpportunities(),
      avoidList: _getAvoidList()
    };
  }

  function _getTopOpportunities() {
    var data = _buildCategoryData();
    data.sort(function (a, b) { return b.densityScore - a.densityScore; });
    return data.slice(0, 5);
  }

  function _getAvoidList() {
    var data = _buildCategoryData();
    data.sort(function (a, b) { return a.densityScore - b.densityScore; });
    return data.slice(0, 5);
  }

  // ─── Color Interpolation ─────────────────────────────────────────────

  /**
   * Interpolate between red (oversaturated) -> yellow (balanced) -> green (underserved)
   * score: 0-100
   */
  function _scoreToColor(score) {
    var r, g, b;
    if (score <= 50) {
      // Red to Yellow (0 -> 50)
      var t = score / 50;
      r = Math.round(220 - t * 30);
      g = Math.round(60 + t * 160);
      b = Math.round(50 + t * 10);
    } else {
      // Yellow to Green (50 -> 100)
      var t2 = (score - 50) / 50;
      r = Math.round(190 - t2 * 145);
      g = Math.round(220 - t2 * 30);
      b = Math.round(60 + t2 * 60);
    }
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function _scoreToTextColor(score) {
    // Darker text for lighter backgrounds
    if (score > 35 && score < 70) return '#333';
    return '#fff';
  }

  function _growthTrendIcon(trend) {
    if (trend >= 0.15) return '<span style="color:#22c55e;font-weight:700;">&#9650;&#9650;</span>';
    if (trend >= 0.05) return '<span style="color:#22c55e;">&#9650;</span>';
    if (trend > -0.05) return '<span style="color:#888;">&#9644;</span>';
    if (trend > -0.15) return '<span style="color:#ef4444;">&#9660;</span>';
    return '<span style="color:#ef4444;font-weight:700;">&#9660;&#9660;</span>';
  }

  function _labelBadge(label) {
    var colors = {
      underserved:   { bg: '#dcfce7', text: '#166534', border: '#86efac' },
      balanced:      { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
      oversaturated: { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' }
    };
    var c = colors[label] || colors.balanced;
    return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;' +
      'background:' + c.bg + ';color:' + c.text + ';border:1px solid ' + c.border + ';">' +
      label.charAt(0).toUpperCase() + label.slice(1) + '</span>';
  }

  // ─── Sorting / Filtering ─────────────────────────────────────────────

  function _sortData(data, sortBy, sortOrder) {
    var sorted = data.slice();
    sorted.sort(function (a, b) {
      var aVal = a[sortBy];
      var bVal = b[sortBy];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  function _filterData(data, filterLabel) {
    if (!filterLabel || filterLabel === 'all') return data;
    return data.filter(function (d) { return d.label === filterLabel; });
  }

  // ─── Render Functions ─────────────────────────────────────────────────

  function _renderLegend() {
    var html = '';
    html += '<div style="display:flex;align-items:center;gap:16px;margin:16px 0;padding:12px 16px;' +
      'background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;flex-wrap:wrap;">';
    html += '<span style="font-weight:600;font-size:13px;color:#475569;">Color Scale:</span>';
    html += '<div style="display:flex;align-items:center;gap:4px;">';
    html += '<span style="font-size:11px;color:#991b1b;">Oversaturated</span>';
    // Render gradient bar
    html += '<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;width:200px;">';
    for (var i = 0; i <= 20; i++) {
      var score = Math.round(i * 5);
      html += '<div style="flex:1;background:' + _scoreToColor(score) + ';"></div>';
    }
    html += '</div>';
    html += '<span style="font-size:11px;color:#166534;">Underserved</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:12px;align-items:center;margin-left:auto;">';
    html += '<span style="font-size:11px;color:#64748b;">0 = High competition</span>';
    html += '<span style="font-size:11px;color:#64748b;">|</span>';
    html += '<span style="font-size:11px;color:#64748b;">100 = Best opportunity</span>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  function _renderHeatmapGrid(data) {
    var html = '';
    html += '<div style="margin:20px 0;">';
    html += '<h3 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 12px 0;">Category Density Heatmap</h3>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">';

    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var bgColor = _scoreToColor(d.densityScore);
      var txtColor = _scoreToTextColor(d.densityScore);
      var isUser = false;
      for (var j = 0; j < config.userCategories.length; j++) {
        if (config.userCategories[j] === d.name) { isUser = true; break; }
      }
      var borderStyle = isUser ? '3px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)';
      var starMark = isUser ? '<span style="position:absolute;top:4px;right:6px;font-size:14px;" title="Your category">&#9733;</span>' : '';

      html += '<div style="position:relative;background:' + bgColor + ';color:' + txtColor + ';padding:14px 10px;' +
        'border-radius:8px;border:' + borderStyle + ';text-align:center;cursor:default;' +
        'transition:transform 0.15s ease;min-height:80px;display:flex;flex-direction:column;justify-content:center;" ' +
        'title="' + d.name + ' — Score: ' + d.densityScore + ' | Ratio: ' + d.ratio + ' | $' + d.avgRate + '/hr">';
      html += starMark;
      html += '<div style="font-weight:700;font-size:13px;line-height:1.2;margin-bottom:6px;">' + d.name + '</div>';
      html += '<div style="font-size:22px;font-weight:800;line-height:1;">' + d.densityScore + '</div>';
      html += '<div style="font-size:10px;margin-top:4px;opacity:0.85;">' + d.label + '</div>';
      html += '</div>';
    }

    html += '</div></div>';
    return html;
  }

  function _renderTopLists(data) {
    var sorted = data.slice();
    sorted.sort(function (a, b) { return a.densityScore - b.densityScore; });
    var mostCompetitive = sorted.slice(0, 5);
    sorted.sort(function (a, b) { return b.densityScore - a.densityScore; });
    var leastCompetitive = sorted.slice(0, 5);

    var html = '';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0;">';

    // Most competitive (hardest to break into)
    html += '<div style="background:#fff;border:1px solid #fecaca;border-radius:10px;padding:18px;">';
    html += '<h4 style="font-size:14px;font-weight:700;color:#991b1b;margin:0 0 12px 0;">&#128293; Top 5 Most Competitive (Hardest)</h4>';
    for (var i = 0; i < mostCompetitive.length; i++) {
      var c = mostCompetitive[i];
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;' +
        (i < mostCompetitive.length - 1 ? 'border-bottom:1px solid #fee2e2;' : '') + '">';
      html += '<div>';
      html += '<span style="font-weight:600;font-size:13px;color:#1e293b;">' + (i + 1) + '. ' + c.name + '</span>';
      html += '<span style="font-size:11px;color:#64748b;margin-left:8px;">$' + c.avgRate + '/hr</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:8px;">';
      html += _growthTrendIcon(c.growthTrend);
      html += '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;' +
        'background:' + _scoreToColor(c.densityScore) + ';color:' + _scoreToTextColor(c.densityScore) + ';">' + c.densityScore + '</span>';
      html += '</div></div>';
    }
    html += '</div>';

    // Least competitive (best opportunities)
    html += '<div style="background:#fff;border:1px solid #bbf7d0;border-radius:10px;padding:18px;">';
    html += '<h4 style="font-size:14px;font-weight:700;color:#166534;margin:0 0 12px 0;">&#127775; Top 5 Best Opportunities</h4>';
    for (var k = 0; k < leastCompetitive.length; k++) {
      var o = leastCompetitive[k];
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;' +
        (k < leastCompetitive.length - 1 ? 'border-bottom:1px solid #dcfce7;' : '') + '">';
      html += '<div>';
      html += '<span style="font-weight:600;font-size:13px;color:#1e293b;">' + (k + 1) + '. ' + o.name + '</span>';
      html += '<span style="font-size:11px;color:#64748b;margin-left:8px;">$' + o.avgRate + '/hr</span>';
      html += '</div>';
      html += '<div style="display:flex;align-items:center;gap:8px;">';
      html += _growthTrendIcon(o.growthTrend);
      html += '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;' +
        'background:' + _scoreToColor(o.densityScore) + ';color:' + _scoreToTextColor(o.densityScore) + ';">' + o.densityScore + '</span>';
      html += '</div></div>';
    }
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _renderFilterControls() {
    var html = '';
    html += '<div style="display:flex;align-items:center;gap:16px;margin:20px 0;padding:12px 16px;' +
      'background:#f1f5f9;border-radius:8px;flex-wrap:wrap;">';

    // Filter by label
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<label style="font-size:12px;font-weight:600;color:#475569;">Filter:</label>';
    var filters = [
      { value: 'all', text: 'All Categories' },
      { value: 'underserved', text: 'Underserved' },
      { value: 'balanced', text: 'Balanced' },
      { value: 'oversaturated', text: 'Oversaturated' }
    ];
    for (var f = 0; f < filters.length; f++) {
      var active = config.filterLabel === filters[f].value;
      html += '<button data-filter="' + filters[f].value + '" style="padding:4px 12px;border-radius:6px;' +
        'font-size:12px;font-weight:' + (active ? '700' : '500') + ';border:1px solid ' +
        (active ? '#3b82f6' : '#cbd5e1') + ';background:' + (active ? '#3b82f6' : '#fff') +
        ';color:' + (active ? '#fff' : '#475569') + ';cursor:pointer;">' + filters[f].text + '</button>';
    }
    html += '</div>';

    // Sort by
    html += '<div style="display:flex;align-items:center;gap:8px;margin-left:auto;">';
    html += '<label style="font-size:12px;font-weight:600;color:#475569;">Sort by:</label>';
    var sortOptions = [
      { value: 'densityScore', text: 'Density Score' },
      { value: 'name', text: 'Name' },
      { value: 'avgJobs', text: 'Jobs/Month' },
      { value: 'avgFreelancers', text: 'Freelancers' },
      { value: 'avgRate', text: 'Avg Rate' },
      { value: 'growthTrend', text: 'Growth' }
    ];
    html += '<select data-sort-by style="padding:4px 8px;border-radius:6px;font-size:12px;' +
      'border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;">';
    for (var s = 0; s < sortOptions.length; s++) {
      var sel = config.sortBy === sortOptions[s].value ? ' selected' : '';
      html += '<option value="' + sortOptions[s].value + '"' + sel + '>' + sortOptions[s].text + '</option>';
    }
    html += '</select>';
    html += '<button data-sort-order style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;' +
      'border:1px solid #cbd5e1;background:#fff;color:#475569;cursor:pointer;">' +
      (config.sortOrder === 'asc' ? '&#9650; Asc' : '&#9660; Desc') + '</button>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function _renderDetailedTable(data) {
    var html = '';
    html += '<div style="margin:24px 0;">';
    html += '<h3 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 12px 0;">Detailed Category Breakdown</h3>';
    html += '<div style="overflow-x:auto;border-radius:10px;border:1px solid #e2e8f0;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';

    // Header
    html += '<thead><tr style="background:#f8fafc;">';
    var headers = [
      { label: 'Category', key: 'name' },
      { label: 'Jobs/Month', key: 'avgJobs' },
      { label: 'Freelancers', key: 'avgFreelancers' },
      { label: 'Ratio', key: 'ratio' },
      { label: 'Density Score', key: 'densityScore' },
      { label: 'Avg Rate', key: 'avgRate' },
      { label: 'Growth', key: 'growthTrend' },
      { label: 'Status', key: 'label' }
    ];
    for (var h = 0; h < headers.length; h++) {
      var isSorted = config.sortBy === headers[h].key;
      html += '<th style="padding:10px 12px;text-align:left;font-weight:600;color:' +
        (isSorted ? '#3b82f6' : '#475569') + ';border-bottom:2px solid #e2e8f0;white-space:nowrap;cursor:pointer;" ' +
        'data-sort-column="' + headers[h].key + '">' + headers[h].label +
        (isSorted ? ' ' + (config.sortOrder === 'asc' ? '&#9650;' : '&#9660;') : '') + '</th>';
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var isUser = false;
      for (var u = 0; u < config.userCategories.length; u++) {
        if (config.userCategories[u] === d.name) { isUser = true; break; }
      }
      var rowBg = isUser ? '#eff6ff' : (i % 2 === 0 ? '#fff' : '#f8fafc');
      var rowBorder = isUser ? 'border-left:3px solid #3b82f6;' : '';

      html += '<tr style="background:' + rowBg + ';' + rowBorder + '">';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;">' +
        (isUser ? '&#9733; ' : '') + d.name + '</td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + d.avgJobs.toLocaleString() + '</td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + d.avgFreelancers.toLocaleString() + '</td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-weight:600;">' + d.ratio + '</td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div style="width:50px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">' +
        '<div style="width:' + d.densityScore + '%;height:100%;background:' + _scoreToColor(d.densityScore) + ';border-radius:4px;"></div>' +
        '</div>' +
        '<span style="font-weight:700;color:' + _scoreToColor(d.densityScore) + ';">' + d.densityScore + '</span>' +
        '</div></td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">$' + d.avgRate + '/hr</td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' +
        _growthTrendIcon(d.growthTrend) + ' ' +
        '<span style="font-size:12px;color:#64748b;">' + (d.growthTrend >= 0 ? '+' : '') + Math.round(d.growthTrend * 100) + '%</span></td>';
      html += '<td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">' + _labelBadge(d.label) + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div></div>';
    return html;
  }

  function _renderUserHighlight() {
    if (!config.userCategories.length) return '';

    var html = '';
    html += '<div style="margin:24px 0;padding:20px;background:linear-gradient(135deg,#eff6ff,#dbeafe);' +
      'border-radius:12px;border:1px solid #93c5fd;">';
    html += '<h3 style="font-size:16px;font-weight:700;color:#1e40af;margin:0 0 14px 0;">&#9733; Your Categories</h3>';

    var data = _buildCategoryData();
    var userItems = [];
    for (var i = 0; i < config.userCategories.length; i++) {
      for (var j = 0; j < data.length; j++) {
        if (data[j].name === config.userCategories[i]) {
          userItems.push(data[j]);
          break;
        }
      }
    }

    if (!userItems.length) {
      html += '<p style="font-size:13px;color:#64748b;margin:0;">None of your categories matched our database.</p>';
      html += '</div>';
      return html;
    }

    // Summary stats
    var avgScore = 0;
    for (var k = 0; k < userItems.length; k++) avgScore += userItems[k].densityScore;
    avgScore = Math.round(avgScore / userItems.length);

    html += '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">';
    html += '<div style="background:#fff;padding:12px 18px;border-radius:8px;text-align:center;min-width:100px;">';
    html += '<div style="font-size:24px;font-weight:800;color:' + _scoreToColor(avgScore) + ';">' + avgScore + '</div>';
    html += '<div style="font-size:11px;color:#64748b;">Avg Density Score</div>';
    html += '</div>';
    html += '<div style="background:#fff;padding:12px 18px;border-radius:8px;text-align:center;min-width:100px;">';
    html += '<div style="font-size:24px;font-weight:800;color:#1e40af;">' + userItems.length + '</div>';
    html += '<div style="font-size:11px;color:#64748b;">Tracked Categories</div>';
    html += '</div>';

    var underservedCount = 0;
    for (var m = 0; m < userItems.length; m++) {
      if (userItems[m].label === 'underserved') underservedCount++;
    }
    html += '<div style="background:#fff;padding:12px 18px;border-radius:8px;text-align:center;min-width:100px;">';
    html += '<div style="font-size:24px;font-weight:800;color:#166534;">' + underservedCount + '</div>';
    html += '<div style="font-size:11px;color:#64748b;">High-Opportunity</div>';
    html += '</div>';
    html += '</div>';

    // Individual cards
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">';
    for (var n = 0; n < userItems.length; n++) {
      var item = userItems[n];
      html += '<div style="background:#fff;padding:14px;border-radius:8px;border-left:4px solid ' +
        _scoreToColor(item.densityScore) + ';">';
      html += '<div style="font-weight:700;font-size:13px;color:#1e293b;margin-bottom:6px;">' + item.name + '</div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-size:12px;color:#64748b;">Score: <strong style="color:' +
        _scoreToColor(item.densityScore) + ';">' + item.densityScore + '</strong></span>';
      html += _labelBadge(item.label);
      html += '</div>';
      html += '<div style="font-size:11px;color:#64748b;margin-top:6px;">$' + item.avgRate + '/hr avg ' +
        _growthTrendIcon(item.growthTrend) + ' ' + (item.growthTrend >= 0 ? '+' : '') +
        Math.round(item.growthTrend * 100) + '% YoY</div>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  // ─── Main Render ──────────────────────────────────────────────────────

  function render(options) {
    var opts = options || {};
    if (opts.userCategories) config.userCategories = opts.userCategories;
    if (opts.sortBy) config.sortBy = opts.sortBy;
    if (opts.sortOrder) config.sortOrder = opts.sortOrder;
    if (opts.filterLabel !== undefined) config.filterLabel = opts.filterLabel;

    var allData = _buildCategoryData();
    var filtered = _filterData(allData, config.filterLabel);
    var sorted = _sortData(filtered, config.sortBy, config.sortOrder);

    var html = '';

    // Header
    html += '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
      'max-width:1100px;margin:0 auto;color:#1e293b;">';

    html += '<div style="margin-bottom:24px;">';
    html += '<h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 6px 0;">Competition Density Heatmap</h2>';
    html += '<p style="font-size:14px;color:#64748b;margin:0;">Discover which Upwork categories are oversaturated vs underserved. ' +
      'Higher scores mean better opportunity (more jobs per freelancer).</p>';
    html += '</div>';

    // Legend
    html += _renderLegend();

    // User highlight section
    html += _renderUserHighlight();

    // Top lists
    html += _renderTopLists(allData);

    // Filter controls
    html += _renderFilterControls();

    // Heatmap grid
    html += _renderHeatmapGrid(sorted);

    // Detailed table
    html += _renderDetailedTable(sorted);

    html += '</div>';
    return html;
  }

  // ─── Init ─────────────────────────────────────────────────────────────

  function init(options) {
    var opts = options || {};
    if (opts.userCategories) config.userCategories = opts.userCategories;
    if (opts.sortBy) config.sortBy = opts.sortBy;
    if (opts.sortOrder) config.sortOrder = opts.sortOrder;
    if (opts.filterLabel) config.filterLabel = opts.filterLabel;

    return {
      categoryCount: CATEGORIES.length,
      userCategories: config.userCategories.length,
      ready: true
    };
  }

  // ─── Expose ───────────────────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.competitionDensityHeatmap = {
    init: init,
    render: render,
    getDensityScore: getDensityScore,
    getCategoryAnalysis: getCategoryAnalysis,
    getRecommendations: getRecommendations
  };

})();
