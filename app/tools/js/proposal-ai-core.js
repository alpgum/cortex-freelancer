/**
 * Cortex Freelancer — Smart Proposal AI Core v2.0
 * cf3-017 | proposal-ai-core.js
 * 
 * AI-powered proposal generation with:
 * - Client research integration (cf3-005 Client Directory)
 * - Market rate analysis and competitive positioning
 * - Scope complexity estimation with hour breakdown
 * - Settings integration (cf3-009) for business info
 * - Communication Hub integration (cf3-011) for follow-up
 * - Time Tracker integration (cf3-001) for historical estimation
 * - Industry-specific template library
 */
;(function(global) {
  'use strict';

  // ── Storage Keys (shared with foundation modules) ──
  var KEYS = {
    CLIENTS: 'cortex_client_directory',
    SETTINGS: 'cortex_settings',
    TIME_ENTRIES: 'cortex_time_entries',
    PROPOSALS: 'cortex_proposals',
    FOLLOWUPS: 'cortex_comm_followups',
    MESSAGES: 'cortex_comm_messages',
    TEMPLATES: 'cortex_comm_templates',
    AI_CACHE: 'cortex_proposal_ai_cache'
  };

  // ── Helpers ──
  function loadJSON(key, fallback) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
    catch(e) { return fallback; }
  }
  function saveJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch(e) { console.error('[ProposalAI] save error:', key, e); }
  }
  function uid() { return 'pai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8); }
  function now() { return new Date().toISOString(); }

  // ══════════════════════════════════════════════════════════════
  // 1. CLIENT RESEARCH ENGINE
  // ══════════════════════════════════════════════════════════════
  var ClientResearch = {
    /**
     * Search client directory for matching client data
     */
    findClient: function(nameOrEmail) {
      var clients = loadJSON(KEYS.CLIENTS, { clients: [] }).clients || [];
      if (!nameOrEmail) return null;
      var q = nameOrEmail.toLowerCase().trim();
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if ((c.name || '').toLowerCase().indexOf(q) >= 0 ||
            (c.email || '').toLowerCase() === q ||
            (c.company || '').toLowerCase().indexOf(q) >= 0) {
          return c;
        }
      }
      return null;
    },

    /**
     * Get full client profile with project history
     */
    getClientProfile: function(clientId) {
      var clients = loadJSON(KEYS.CLIENTS, { clients: [] }).clients || [];
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].id === clientId) {
          var client = clients[i];
          return {
            client: client,
            projectHistory: this._getProjectHistory(clientId),
            invoiceHistory: this._getInvoiceHistory(client.name || client.company),
            communicationHistory: this._getCommHistory(clientId),
            totalRevenue: this._calcTotalRevenue(client.name || client.company),
            avgProjectValue: this._calcAvgProjectValue(client.name || client.company),
            preferredRate: client.hourlyRate || null,
            paymentTerms: client.paymentTerms || 'net30',
            rating: client.rating || 0,
            tags: client.tags || [],
            timezone: client.timezone || ''
          };
        }
      }
      return null;
    },

    _getProjectHistory: function(clientId) {
      var entries = loadJSON(KEYS.TIME_ENTRIES, []);
      var projects = {};
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.clientId === clientId || (e.client && e.client === clientId)) {
          var pName = e.project || 'Unnamed';
          if (!projects[pName]) {
            projects[pName] = { name: pName, totalHours: 0, sessions: 0 };
          }
          projects[pName].totalHours += (e.duration || 0) / 3600;
          projects[pName].sessions++;
        }
      }
      return Object.keys(projects).map(function(k) { return projects[k]; });
    },

    _getInvoiceHistory: function(clientName) {
      var invoices = loadJSON('cortex_invoices', []);
      return invoices.filter(function(inv) {
        return (inv.clientName || '').toLowerCase().indexOf((clientName || '').toLowerCase()) >= 0;
      });
    },

    _getCommHistory: function(clientId) {
      var messages = loadJSON(KEYS.MESSAGES, []);
      return messages.filter(function(m) {
        return m.clientId === clientId;
      }).slice(0, 10);
    },

    _calcTotalRevenue: function(clientName) {
      var invoices = this._getInvoiceHistory(clientName);
      var total = 0;
      for (var i = 0; i < invoices.length; i++) {
        total += parseFloat(invoices[i].total || invoices[i].amount || 0);
      }
      return total;
    },

    _calcAvgProjectValue: function(clientName) {
      var invoices = this._getInvoiceHistory(clientName);
      if (!invoices.length) return 0;
      var total = 0;
      for (var i = 0; i < invoices.length; i++) {
        total += parseFloat(invoices[i].total || invoices[i].amount || 0);
      }
      return Math.round(total / invoices.length);
    },

    /**
     * Build client research brief for proposal personalization
     */
    buildResearchBrief: function(clientId) {
      var profile = this.getClientProfile(clientId);
      if (!profile) return null;
      var c = profile.client;
      var brief = {
        name: c.name || '',
        company: c.company || '',
        isExistingClient: true,
        relationshipStrength: this._calcRelationshipStrength(profile),
        totalRevenue: profile.totalRevenue,
        avgProjectValue: profile.avgProjectValue,
        projectCount: profile.projectHistory.length,
        preferredRate: profile.preferredRate,
        paymentTerms: profile.paymentTerms,
        rating: profile.rating,
        timezone: profile.timezone,
        tags: profile.tags,
        recentProjects: profile.projectHistory.slice(0, 3),
        personalizedNotes: []
      };

      // Generate personalized notes
      if (brief.totalRevenue > 0) {
        brief.personalizedNotes.push('Existing client with $' + brief.totalRevenue.toLocaleString() + ' total revenue');
      }
      if (brief.rating >= 4) {
        brief.personalizedNotes.push('High-rated client (' + brief.rating + '/5) — prioritize');
      }
      if (brief.projectCount > 0) {
        brief.personalizedNotes.push(brief.projectCount + ' previous project(s) — reference past work');
      }
      if (c.notes) {
        brief.personalizedNotes.push('Notes: ' + c.notes.substring(0, 100));
      }
      return brief;
    },

    _calcRelationshipStrength: function(profile) {
      var score = 0;
      if (profile.totalRevenue > 0) score += 20;
      if (profile.totalRevenue > 5000) score += 15;
      if (profile.totalRevenue > 10000) score += 15;
      if (profile.projectHistory.length > 0) score += 15;
      if (profile.projectHistory.length > 3) score += 10;
      if (profile.rating >= 4) score += 15;
      if (profile.communicationHistory.length > 0) score += 10;
      return Math.min(100, score);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 2. MARKET RATE ANALYZER
  // ══════════════════════════════════════════════════════════════
  var RateAnalyzer = {
    // Market rate data by role and experience (USD/hr)
    MARKET_RATES: {
      'Web Developer':       { junior: [25, 45], mid: [45, 75], senior: [75, 120], expert: [120, 200] },
      'Mobile Developer':    { junior: [30, 50], mid: [50, 85], senior: [85, 140], expert: [140, 225] },
      'UI/UX Designer':      { junior: [25, 40], mid: [40, 70], senior: [70, 110], expert: [110, 175] },
      'Graphic Designer':    { junior: [20, 35], mid: [35, 55], senior: [55, 85], expert: [85, 130] },
      'Copywriter':          { junior: [20, 35], mid: [35, 60], senior: [60, 100], expert: [100, 150] },
      'Data Analyst':        { junior: [30, 50], mid: [50, 80], senior: [80, 120], expert: [120, 180] },
      'Video Editor':        { junior: [20, 35], mid: [35, 60], senior: [60, 95], expert: [95, 150] },
      'Virtual Assistant':   { junior: [10, 20], mid: [20, 35], senior: [35, 55], expert: [55, 80] },
      'SEO Specialist':      { junior: [25, 40], mid: [40, 65], senior: [65, 100], expert: [100, 160] },
      'Project Manager':     { junior: [30, 50], mid: [50, 80], senior: [80, 125], expert: [125, 190] }
    },

    // Complexity multipliers
    COMPLEXITY_MULT: { low: 0.85, medium: 1.0, high: 1.25, expert: 1.5 },

    /**
     * Analyze rate competitiveness
     */
    analyzeRate: function(role, experience, userRate, complexity) {
      var rates = this.MARKET_RATES[role] || this.MARKET_RATES['Web Developer'];
      var expRates = rates[experience] || rates.mid;
      var mult = this.COMPLEXITY_MULT[complexity] || 1.0;
      var marketLow = Math.round(expRates[0] * mult);
      var marketHigh = Math.round(expRates[1] * mult);
      var marketMid = Math.round((marketLow + marketHigh) / 2);

      var position = 'competitive';
      var percentile = 50;
      if (userRate) {
        if (userRate < marketLow) {
          position = 'below-market';
          percentile = Math.max(5, Math.round((userRate / marketLow) * 30));
        } else if (userRate > marketHigh) {
          position = 'premium';
          percentile = Math.min(98, 70 + Math.round(((userRate - marketHigh) / marketHigh) * 30));
        } else {
          percentile = 30 + Math.round(((userRate - marketLow) / (marketHigh - marketLow)) * 40);
          if (userRate > marketMid) position = 'above-average';
          else if (userRate < marketMid * 0.9) position = 'value';
        }
      }

      return {
        marketLow: marketLow,
        marketHigh: marketHigh,
        marketMid: marketMid,
        userRate: userRate || 0,
        position: position,
        percentile: percentile,
        recommendation: this._getRateRecommendation(position, userRate, marketLow, marketHigh, marketMid),
        competitiveRange: {
          sweet: [Math.round(marketMid * 0.9), Math.round(marketMid * 1.1)],
          aggressive: [marketLow, Math.round(marketLow * 1.15)],
          premium: [Math.round(marketHigh * 0.9), Math.round(marketHigh * 1.2)]
        }
      };
    },

    _getRateRecommendation: function(position, rate, low, high, mid) {
      switch (position) {
        case 'below-market':
          return {
            text: 'Your rate ($' + rate + '/hr) is below market average. Consider raising to $' + mid + '/hr for better positioning.',
            action: 'raise',
            suggestedRate: mid,
            urgency: 'high'
          };
        case 'premium':
          return {
            text: 'Your rate ($' + rate + '/hr) is in premium territory. Ensure your proposal emphasizes unique value to justify the investment.',
            action: 'justify',
            suggestedRate: rate,
            urgency: 'medium'
          };
        case 'value':
          return {
            text: 'Your rate ($' + rate + '/hr) offers good value. Competitive positioning for winning projects.',
            action: 'maintain',
            suggestedRate: rate,
            urgency: 'low'
          };
        default:
          return {
            text: 'Your rate ($' + (rate || '—') + '/hr) is well-positioned in the market range of $' + low + '–$' + high + '/hr.',
            action: 'maintain',
            suggestedRate: rate || mid,
            urgency: 'low'
          };
      }
    },

    /**
     * Get value-based pricing suggestion
     */
    getValueBasedPrice: function(projectType, complexity, deliverables) {
      var baseMultipliers = {
        'web development': 1.0, 'mobile app development': 1.3,
        'branding': 0.8, 'UI/UX design': 0.9,
        'video production': 0.85, 'content writing': 0.6,
        'SEO optimization': 0.75, 'data analysis': 1.1,
        'project': 0.9
      };
      var baseMult = baseMultipliers[projectType] || 0.9;
      var complexMult = this.COMPLEXITY_MULT[complexity] || 1.0;
      var deliverableCount = deliverables ? deliverables.length : 3;
      var scopeMult = 1 + (deliverableCount - 3) * 0.08;

      return {
        multiplier: Math.round(baseMult * complexMult * scopeMult * 100) / 100,
        suggestion: 'Consider value-based pricing at ' + Math.round(baseMult * complexMult * scopeMult * 100) + '% of hourly estimate'
      };
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 3. SCOPE COMPLEXITY ANALYZER
  // ══════════════════════════════════════════════════════════════
  var ScopeAnalyzer = {
    /**
     * Analyze project scope from job description
     */
    analyze: function(jdText, role, experience) {
      var lower = jdText.toLowerCase();
      var wordCount = jdText.trim().split(/\s+/).length;
      var result = {
        complexity: 'medium',
        complexityScore: 50,
        estimatedHours: { min: 0, max: 0, likely: 0 },
        deliverables: [],
        riskFactors: [],
        technicalDepth: 'moderate',
        confidenceLevel: 'medium'
      };

      // Complexity scoring
      var score = 30;
      var skills = this._extractSkills(lower);
      score += Math.min(30, skills.length * 4);
      if (wordCount > 500) score += 10;
      if (wordCount > 1000) score += 10;
      if (/full.?stack|end.to.end|complete solution/i.test(jdText)) score += 15;
      if (/integration|api|third.party/i.test(jdText)) score += 10;
      if (/scale|scalab|high.traffic|performance/i.test(jdText)) score += 10;
      if (/security|auth|encrypt|compliance|gdpr|hipaa/i.test(jdText)) score += 10;
      if (/simple|straightforward|basic|quick/i.test(jdText)) score -= 15;

      result.complexityScore = Math.max(10, Math.min(100, score));
      if (result.complexityScore < 35) result.complexity = 'low';
      else if (result.complexityScore < 65) result.complexity = 'medium';
      else if (result.complexityScore < 85) result.complexity = 'high';
      else result.complexity = 'expert';

      // Technical depth
      if (score > 75) result.technicalDepth = 'deep';
      else if (score > 50) result.technicalDepth = 'moderate';
      else result.technicalDepth = 'surface';

      // Hour estimation using historical data
      var historicalData = this._getHistoricalEstimate(role, result.complexity);
      var baseHours = historicalData.avgHours || this._getBaseHours(result.complexity);
      var expMultiplier = { junior: 1.3, mid: 1.0, senior: 0.85, expert: 0.75 }[experience] || 1.0;

      result.estimatedHours = {
        min: Math.round(baseHours * 0.7 * expMultiplier),
        max: Math.round(baseHours * 1.4 * expMultiplier),
        likely: Math.round(baseHours * expMultiplier),
        historicalBasis: historicalData.sampleSize > 0
      };

      // Risk factors
      result.riskFactors = this._identifyRisks(jdText);

      // Confidence level
      if (wordCount < 50) result.confidenceLevel = 'low';
      else if (wordCount > 200 && skills.length > 2) result.confidenceLevel = 'high';
      else result.confidenceLevel = 'medium';

      return result;
    },

    _extractSkills: function(text) {
      var skillList = [
        'react','node','javascript','typescript','python','php','laravel','vue','angular',
        'next.js','figma','photoshop','illustrator','wordpress','shopify','stripe','api',
        'aws','docker','sql','mongodb','firebase','tailwind','css','html','seo','swift',
        'flutter','kotlin','java','go','rust','c#','.net','django','flask','rails','ruby',
        'graphql','redis','elasticsearch','kubernetes','terraform','ci/cd','git'
      ];
      var found = [];
      for (var i = 0; i < skillList.length; i++) {
        if (text.indexOf(skillList[i]) >= 0) found.push(skillList[i]);
      }
      return found;
    },

    _getBaseHours: function(complexity) {
      return { low: 20, medium: 50, high: 100, expert: 180 }[complexity] || 50;
    },

    /**
     * Use time tracker historical data for estimation
     */
    _getHistoricalEstimate: function(role, complexity) {
      var entries = loadJSON(KEYS.TIME_ENTRIES, []);
      if (!entries.length) return { avgHours: 0, sampleSize: 0 };

      // Group entries by project
      var projects = {};
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        var pName = e.project || 'unknown';
        if (!projects[pName]) {
          projects[pName] = { totalSeconds: 0, sessions: 0 };
        }
        projects[pName].totalSeconds += (e.duration || 0);
        projects[pName].sessions++;
      }

      var projectHours = Object.keys(projects).map(function(k) {
        return projects[k].totalSeconds / 3600;
      }).filter(function(h) { return h > 1; });

      if (!projectHours.length) return { avgHours: 0, sampleSize: 0 };

      var avg = projectHours.reduce(function(a, b) { return a + b; }, 0) / projectHours.length;
      return {
        avgHours: Math.round(avg),
        sampleSize: projectHours.length,
        min: Math.round(Math.min.apply(null, projectHours)),
        max: Math.round(Math.max.apply(null, projectHours))
      };
    },

    _identifyRisks: function(jdText) {
      var risks = [];
      var patterns = [
        { re: /asap|urgent|immediately|tight deadline/i, risk: 'Tight timeline — scope creep risk', level: 'high' },
        { re: /not sure|unclear|tbd|flexible scope/i, risk: 'Vague requirements — needs discovery phase', level: 'high' },
        { re: /previous.*(developer|freelancer|agency).*(left|quit|failed)/i, risk: 'Previous contractor issues — set clear boundaries', level: 'medium' },
        { re: /unlimited|ongoing|no deadline/i, risk: 'Open-ended scope — define milestones', level: 'medium' },
        { re: /cheap|lowest|budget.*(tight|limited|small)/i, risk: 'Budget constraints — manage expectations', level: 'medium' },
        { re: /multiple (revisions|changes|iterations)/i, risk: 'Revision expectations — cap revision rounds', level: 'low' },
        { re: /mvp|prototype|proof of concept/i, risk: 'MVP scope — define clearly what\'s in/out', level: 'low' },
        { re: /scale|millions|high.traffic/i, risk: 'Scale requirements — factor in architecture time', level: 'medium' },
        { re: /nda|confidential|sensitive/i, risk: 'NDA/Confidentiality — review legal terms', level: 'low' }
      ];
      for (var i = 0; i < patterns.length; i++) {
        if (patterns[i].re.test(jdText)) {
          risks.push({ text: patterns[i].risk, level: patterns[i].level });
        }
      }
      return risks;
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 4. INDUSTRY TEMPLATE LIBRARY
  // ══════════════════════════════════════════════════════════════
  var TemplateLibrary = {
    TEMPLATES: {
      'saas-development': {
        id: 'saas-development',
        name: 'SaaS Application Development',
        industry: 'Technology',
        icon: '🚀',
        sections: {
          opener: 'I specialize in building SaaS applications that scale. Your project requirements align perfectly with my experience in building subscription-based platforms with user management, billing integration, and analytics dashboards.',
          approach: [
            'Architecture Design — Define database schema, API structure, and microservices boundaries',
            'Core MVP Build — Authentication, core features, and billing (Stripe/PayPal)',
            'Dashboard & Analytics — Admin panel, user metrics, and reporting',
            'Testing & Deployment — CI/CD pipeline, staging environment, production launch'
          ],
          differentiators: [
            'Experience with subscription billing (Stripe, Recurly)',
            'Scalable architecture from day one — no rewrite needed',
            'Built-in analytics and user tracking'
          ]
        }
      },
      'ecommerce': {
        id: 'ecommerce',
        name: 'E-Commerce Development',
        industry: 'Retail',
        icon: '🛒',
        sections: {
          opener: 'I build e-commerce experiences that convert. From product catalog to checkout optimization, I focus on the details that turn browsers into buyers.',
          approach: [
            'Store Architecture — Product catalog, categories, search & filtering',
            'Checkout Optimization — Cart UX, payment integration, abandonment recovery',
            'Order Management — Fulfillment workflow, inventory tracking, notifications',
            'Analytics & Growth — Conversion tracking, A/B testing, SEO optimization'
          ],
          differentiators: [
            'Conversion-optimized checkout flow (2-3% avg improvement)',
            'SEO-ready product pages from day one',
            'Mobile-first responsive design'
          ]
        }
      },
      'mobile-app': {
        id: 'mobile-app',
        name: 'Mobile App Development',
        industry: 'Technology',
        icon: '📱',
        sections: {
          opener: 'I build mobile apps that users love. Whether native or cross-platform, I focus on performance, UX, and the details that earn 5-star reviews.',
          approach: [
            'UX/UI Design — Wireframes, prototypes, and platform-specific design patterns',
            'Core Development — Feature build with offline support and push notifications',
            'Backend & API — Scalable API, real-time sync, and cloud infrastructure',
            'App Store Launch — Store optimization, beta testing, submission & approval'
          ],
          differentiators: [
            'Published 10+ apps with 4.5+ star average rating',
            'Performance-optimized — 60fps animations, minimal battery drain',
            'Cross-platform expertise (React Native, Flutter)'
          ]
        }
      },
      'brand-identity': {
        id: 'brand-identity',
        name: 'Brand Identity Design',
        industry: 'Creative',
        icon: '🎨',
        sections: {
          opener: 'I create brand identities that tell stories and build recognition. My process combines strategic thinking with creative execution to deliver brands that stand out.',
          approach: [
            'Discovery & Research — Brand audit, competitor analysis, audience profiling',
            'Concept Development — 3 distinct directions with moodboards and rationale',
            'Refinement — Iterative polish of chosen direction with client feedback',
            'Delivery — Complete brand guide with all assets and usage guidelines'
          ],
          differentiators: [
            'Strategic approach — every design decision has a business rationale',
            'Complete brand system — not just a logo',
            'Full source files and brand guidelines included'
          ]
        }
      },
      'content-marketing': {
        id: 'content-marketing',
        name: 'Content Marketing Strategy',
        industry: 'Marketing',
        icon: '📝',
        sections: {
          opener: 'I build content strategies that drive organic growth. From keyword research to editorial calendars, I create systems that generate consistent, high-quality content at scale.',
          approach: [
            'Audit & Research — Current content analysis, competitor gaps, keyword mapping',
            'Strategy Development — Content pillars, editorial calendar, distribution plan',
            'Content Production — SEO-optimized articles, social content, email sequences',
            'Measurement & Optimization — Traffic tracking, conversion analysis, iterative improvement'
          ],
          differentiators: [
            'Data-driven topic selection based on search demand and competition',
            'Full-funnel content — awareness, consideration, and conversion',
            'Repurposing workflows to maximize content ROI'
          ]
        }
      },
      'data-analytics': {
        id: 'data-analytics',
        name: 'Data Analytics & BI',
        industry: 'Analytics',
        icon: '📊',
        sections: {
          opener: 'I turn raw data into actionable business intelligence. My dashboards don\'t just look good — they surface the insights that drive real decisions.',
          approach: [
            'Data Discovery — Source mapping, quality assessment, KPI definition',
            'Pipeline Build — ETL/ELT, data cleaning, transformation, and modeling',
            'Dashboard Development — Interactive visualizations with drill-down capability',
            'Training & Handoff — Documentation, team training, and ongoing support'
          ],
          differentiators: [
            'Self-service dashboards — your team can explore without technical help',
            'Automated data pipelines — fresh insights without manual refreshes',
            'Industry benchmarking and contextual analysis'
          ]
        }
      },
      'consulting': {
        id: 'consulting',
        name: 'Technical Consulting',
        industry: 'Professional Services',
        icon: '💡',
        sections: {
          opener: 'I provide strategic technical consulting that bridges business goals and technology execution. My recommendations come with actionable implementation plans, not just slide decks.',
          approach: [
            'Stakeholder Interviews — Align on goals, constraints, and success criteria',
            'Technical Assessment — Architecture review, code audit, infrastructure analysis',
            'Strategy & Roadmap — Prioritized recommendations with effort estimates',
            'Implementation Support — Hands-on guidance during execution phase'
          ],
          differentiators: [
            'Practitioner-consultant — I build, not just advise',
            'Clear, prioritized recommendations with ROI estimates',
            'Ongoing support during implementation'
          ]
        }
      },
      'video-production': {
        id: 'video-production',
        name: 'Video Production',
        industry: 'Media',
        icon: '🎬',
        sections: {
          opener: 'I produce videos that captivate audiences and drive results. From concept to final cut, every frame is crafted to tell your story effectively.',
          approach: [
            'Pre-Production — Script, storyboard, shot list, and creative direction',
            'Production — Filming/animation with professional equipment and techniques',
            'Post-Production — Editing, color grading, sound design, motion graphics',
            'Delivery — Multiple format exports optimized for each platform'
          ],
          differentiators: [
            'Platform-optimized edits (YouTube, Instagram, TikTok, LinkedIn)',
            'Fast turnaround without sacrificing quality',
            'Engaging storytelling that drives viewer retention'
          ]
        }
      }
    },

    /**
     * Auto-select best template based on job description
     */
    selectTemplate: function(jdText, role) {
      var lower = jdText.toLowerCase();
      var scores = {};
      var templateKeys = Object.keys(this.TEMPLATES);

      for (var i = 0; i < templateKeys.length; i++) {
        var key = templateKeys[i];
        scores[key] = 0;
      }

      // Score based on keywords
      if (/saas|subscription|recurring|billing|stripe/i.test(lower)) scores['saas-development'] += 30;
      if (/dashboard|admin|panel|analytics/i.test(lower)) scores['saas-development'] += 10;
      if (/e-?commerce|shop|store|product|cart|checkout/i.test(lower)) scores['ecommerce'] += 30;
      if (/shopify|woocommerce|magento/i.test(lower)) scores['ecommerce'] += 20;
      if (/mobile|app|ios|android|flutter|react native/i.test(lower)) scores['mobile-app'] += 30;
      if (/brand|logo|identity|visual|branding/i.test(lower)) scores['brand-identity'] += 30;
      if (/content|blog|seo|article|editorial|marketing/i.test(lower)) scores['content-marketing'] += 25;
      if (/data|analytics|dashboard|bi|report|visualization/i.test(lower)) scores['data-analytics'] += 25;
      if (/consult|strategy|audit|review|advise|advisory/i.test(lower)) scores['consulting'] += 25;
      if (/video|animation|motion|edit|film|youtube/i.test(lower)) scores['video-production'] += 30;

      // Find highest
      var best = 'saas-development';
      var bestScore = 0;
      for (var key in scores) {
        if (scores[key] > bestScore) {
          best = key;
          bestScore = scores[key];
        }
      }

      return {
        templateId: best,
        template: this.TEMPLATES[best],
        confidence: bestScore > 20 ? 'high' : bestScore > 10 ? 'medium' : 'low',
        allScores: scores
      };
    },

    getTemplate: function(id) {
      return this.TEMPLATES[id] || null;
    },

    getAllTemplates: function() {
      return Object.keys(this.TEMPLATES).map(function(k) {
        var t = TemplateLibrary.TEMPLATES[k];
        return { id: k, name: t.name, industry: t.industry, icon: t.icon };
      });
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 5. SETTINGS INTEGRATION
  // ══════════════════════════════════════════════════════════════
  var SettingsIntegration = {
    getBusinessInfo: function() {
      var settings = loadJSON(KEYS.SETTINGS, {});
      return {
        name: (settings.user && settings.user.displayName) || '',
        email: (settings.user && settings.user.email) || '',
        businessName: (settings.business && settings.business.name) || '',
        title: (settings.business && settings.business.title) || '',
        phone: (settings.business && settings.business.phone) || '',
        website: (settings.business && settings.business.website) || '',
        address: (settings.business && settings.business.address) || '',
        city: (settings.business && settings.business.city) || '',
        country: (settings.business && settings.business.country) || '',
        taxId: (settings.business && settings.business.taxId) || '',
        logo: (settings.business && settings.business.logo) || ''
      };
    },

    getRateDefaults: function() {
      var settings = loadJSON(KEYS.SETTINGS, {});
      return {
        hourlyRate: (settings.rates && settings.rates.defaultHourlyRate) || 0,
        currency: (settings.rates && settings.rates.defaultCurrency) || 'USD',
        minimumBudget: (settings.rates && settings.rates.minimumProjectBudget) || 0,
        taxRate: (settings.rates && settings.rates.taxRate) || 0,
        taxLabel: (settings.rates && settings.rates.taxLabel) || 'Tax'
      };
    },

    getPaymentTerms: function() {
      var settings = loadJSON(KEYS.SETTINGS, {});
      return {
        terms: (settings.payment && settings.payment.defaultTerms) || 'net30',
        depositPercent: (settings.payment && settings.payment.depositPercent) || 0,
        lateFeePercent: (settings.payment && settings.payment.lateFeePercent) || 0,
        acceptedMethods: (settings.payment && settings.payment.acceptedMethods) || ['bank_transfer'],
        notes: (settings.payment && settings.payment.notes) || ''
      };
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 6. FOLLOW-UP AUTOMATION (Communication Hub Integration)
  // ══════════════════════════════════════════════════════════════
  var FollowUpEngine = {
    /**
     * Schedule automated follow-up for a proposal
     */
    scheduleFollowUp: function(proposalData) {
      var followups = loadJSON(KEYS.FOLLOWUPS, []);
      var followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 3);

      var entry = {
        id: uid(),
        type: 'proposal_followup',
        proposalId: proposalData.id || uid(),
        clientName: proposalData.clientName || '',
        clientEmail: proposalData.clientEmail || '',
        projectName: proposalData.projectType || 'Project',
        dueDate: followUpDate.toISOString().split('T')[0],
        status: 'pending',
        priority: 'high',
        notes: 'Follow up on proposal: ' + (proposalData.projectType || 'Project'),
        createdAt: now(),
        template: 'tpl_proposal_followup'
      };

      followups.push(entry);
      saveJSON(KEYS.FOLLOWUPS, followups);

      // Also add to communication log
      var messages = loadJSON(KEYS.MESSAGES, []);
      messages.unshift({
        id: uid(),
        type: 'proposal_sent',
        clientName: proposalData.clientName || 'Unknown',
        subject: 'Proposal sent: ' + (proposalData.projectType || 'Project'),
        body: 'Proposal generated and ready to send',
        status: 'sent',
        createdAt: now(),
        followUpId: entry.id
      });
      saveJSON(KEYS.MESSAGES, messages);

      return entry;
    },

    /**
     * Get pending follow-ups
     */
    getPendingFollowUps: function() {
      var followups = loadJSON(KEYS.FOLLOWUPS, []);
      return followups.filter(function(f) {
        return f.type === 'proposal_followup' && f.status === 'pending';
      });
    }
  };

  // ══════════════════════════════════════════════════════════════
  // 7. MAIN AI CORE — ORCHESTRATOR
  // ══════════════════════════════════════════════════════════════
  var ProposalAICore = {
    /**
     * Full AI analysis pipeline
     */
    analyze: function(options) {
      var jd = options.jobDescription || '';
      var role = options.role || 'Web Developer';
      var experience = options.experience || 'mid';
      var userRate = options.rate || 0;
      var clientSearch = options.clientSearch || '';
      var selectedTemplate = options.templateId || null;

      // Get settings defaults
      var bizInfo = SettingsIntegration.getBusinessInfo();
      var rateDefaults = SettingsIntegration.getRateDefaults();
      var paymentTerms = SettingsIntegration.getPaymentTerms();

      // Use settings rate if no rate provided
      if (!userRate && rateDefaults.hourlyRate) {
        userRate = rateDefaults.hourlyRate;
      }

      // 1. Client Research
      var clientBrief = null;
      if (clientSearch) {
        var client = ClientResearch.findClient(clientSearch);
        if (client) {
          clientBrief = ClientResearch.buildResearchBrief(client.id);
          // Use client's preferred rate if available
          if (clientBrief.preferredRate && !options.rate) {
            userRate = parseFloat(clientBrief.preferredRate);
          }
        }
      }

      // 2. Scope Analysis
      var scopeAnalysis = ScopeAnalyzer.analyze(jd, role, experience);

      // 3. Rate Analysis
      var rateAnalysis = RateAnalyzer.analyzeRate(role, experience, userRate, scopeAnalysis.complexity);

      // 4. Template Selection
      var templateResult;
      if (selectedTemplate) {
        templateResult = {
          templateId: selectedTemplate,
          template: TemplateLibrary.getTemplate(selectedTemplate),
          confidence: 'manual'
        };
      } else {
        templateResult = TemplateLibrary.selectTemplate(jd, role);
      }

      // 5. Value-based pricing
      var valuePricing = RateAnalyzer.getValueBasedPrice(
        scopeAnalysis.complexity === 'high' ? 'web development' : 'project',
        scopeAnalysis.complexity,
        scopeAnalysis.deliverables
      );

      // 6. Build comprehensive analysis
      return {
        timestamp: now(),
        jobDescription: jd,

        // Client intelligence
        client: clientBrief,
        isExistingClient: !!clientBrief,

        // Scope & complexity
        scope: scopeAnalysis,

        // Rate analysis
        rate: rateAnalysis,
        valuePricing: valuePricing,

        // Template
        template: templateResult,
        allTemplates: TemplateLibrary.getAllTemplates(),

        // Business context
        business: bizInfo,
        paymentTerms: paymentTerms,
        rateDefaults: rateDefaults,

        // Proposal metadata
        proposalId: uid(),
        estimatedValue: {
          low: scopeAnalysis.estimatedHours.min * (userRate || rateAnalysis.marketMid),
          mid: scopeAnalysis.estimatedHours.likely * (userRate || rateAnalysis.marketMid),
          high: scopeAnalysis.estimatedHours.max * (userRate || rateAnalysis.marketMid)
        },

        // AI recommendations
        recommendations: this._generateRecommendations(scopeAnalysis, rateAnalysis, clientBrief, templateResult)
      };
    },

    _generateRecommendations: function(scope, rate, client, template) {
      var recs = [];

      // Rate recommendations
      if (rate.recommendation.action === 'raise') {
        recs.push({
          type: 'rate',
          priority: 'high',
          icon: '💰',
          text: rate.recommendation.text
        });
      }

      // Scope recommendations
      if (scope.riskFactors.length > 0) {
        var highRisks = scope.riskFactors.filter(function(r) { return r.level === 'high'; });
        if (highRisks.length > 0) {
          recs.push({
            type: 'risk',
            priority: 'high',
            icon: '⚠️',
            text: highRisks[0].text + (highRisks.length > 1 ? ' (+' + (highRisks.length - 1) + ' more)' : '')
          });
        }
      }

      // Client recommendations
      if (client && client.isExistingClient) {
        recs.push({
          type: 'client',
          priority: 'medium',
          icon: '🤝',
          text: 'Existing client — reference past work together. ' + (client.personalizedNotes[0] || '')
        });
      }

      // Template recommendation
      if (template.confidence === 'high') {
        recs.push({
          type: 'template',
          priority: 'low',
          icon: '📋',
          text: 'Using "' + template.template.name + '" template for best fit'
        });
      }

      // Confidence warning
      if (scope.confidenceLevel === 'low') {
        recs.push({
          type: 'confidence',
          priority: 'medium',
          icon: '🔍',
          text: 'Job description is brief — ask clarifying questions before finalizing scope'
        });
      }

      return recs;
    },

    /**
     * Schedule follow-up for a sent proposal
     */
    scheduleFollowUp: function(proposalData) {
      return FollowUpEngine.scheduleFollowUp(proposalData);
    },

    /**
     * Get all industry templates
     */
    getTemplates: function() {
      return TemplateLibrary.getAllTemplates();
    },

    /**
     * Get template details
     */
    getTemplate: function(id) {
      return TemplateLibrary.getTemplate(id);
    },

    /**
     * Search client directory
     */
    searchClient: function(query) {
      return ClientResearch.findClient(query);
    },

    /**
     * Get pending follow-ups
     */
    getPendingFollowUps: function() {
      return FollowUpEngine.getPendingFollowUps();
    },

    /**
     * Get business info from settings
     */
    getBusinessInfo: function() {
      return SettingsIntegration.getBusinessInfo();
    },

    /**
     * Get rate defaults from settings
     */
    getRateDefaults: function() {
      return SettingsIntegration.getRateDefaults();
    }
  };

  // ── Export ──
  if (!global.CortexFreelancer) global.CortexFreelancer = {};
  global.CortexFreelancer.ProposalAICore = ProposalAICore;
  global.CortexFreelancer.ClientResearch = ClientResearch;
  global.CortexFreelancer.RateAnalyzer = RateAnalyzer;
  global.CortexFreelancer.ScopeAnalyzer = ScopeAnalyzer;
  global.CortexFreelancer.TemplateLibrary = TemplateLibrary;
  global.CortexFreelancer.SettingsIntegration = SettingsIntegration;
  global.CortexFreelancer.FollowUpEngine = FollowUpEngine;

})(typeof window !== 'undefined' ? window : this);
