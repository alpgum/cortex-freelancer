/**
 * Cortex Freelancer — AI Job Matching Core Engine v1.0
 * cf3-018 | job-ai-core.js
 *
 * Intelligent job matching algorithm with:
 * - Skill-job compatibility scoring
 * - Market rate analysis & recommendations
 * - Success probability calculation
 * - Competition level assessment
 * - Optimal bidding strategy suggestions
 * - Automated opportunity alerts
 *
 * Integrations:
 * - CortexSettings (cf3-009): skill prefs, rate targets, availability
 * - Client Directory (cf3-005): historical success patterns
 * - CortexTimeEngine (cf3-001): productivity by project type
 * - Communication Hub (cf3-011): success rate tracking
 */

;(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CortexJobAI = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  /* ======== Constants ======== */
  const STORAGE_KEYS = {
    jobs:        'cortex_job_matches',
    profile:     'cortex_job_profile',
    alerts:      'cortex_job_alerts',
    history:     'cortex_job_history',
    marketData:  'cortex_market_data',
  };

  const VERSION = '1.0.0';

  /* ======== Skill Taxonomy ======== */
  const SKILL_CATEGORIES = {
    frontend:    ['html','css','javascript','typescript','react','vue','angular','svelte','next.js','nuxt','tailwind','sass','scss','bootstrap','jquery','webpack','vite','astro','remix','gatsby'],
    backend:     ['node.js','python','django','flask','fastapi','ruby','rails','php','laravel','java','spring','go','rust','c#','.net','express','nestjs','graphql','rest','api'],
    mobile:      ['react native','flutter','swift','swiftui','kotlin','ios','android','expo','capacitor','ionic'],
    database:    ['postgresql','mysql','mongodb','redis','firebase','supabase','dynamodb','sqlite','prisma','sequelize','typeorm','sql'],
    devops:      ['docker','kubernetes','aws','gcp','azure','ci/cd','terraform','jenkins','github actions','vercel','netlify','cloudflare','nginx','linux'],
    design:      ['figma','sketch','adobe xd','photoshop','illustrator','ui/ux','wireframing','prototyping','design systems','user research'],
    data:        ['machine learning','data science','tensorflow','pytorch','pandas','numpy','sql','tableau','power bi','spark','hadoop','nlp','computer vision','ai'],
    blockchain:  ['solidity','ethereum','web3','smart contracts','defi','nft','rust','substrate','cosmos','hardhat','truffle'],
    marketing:   ['seo','sem','google ads','facebook ads','content marketing','email marketing','analytics','growth hacking','copywriting','social media'],
    writing:     ['technical writing','copywriting','blog writing','ux writing','documentation','content strategy','editing','proofreading','ghostwriting'],
  };

  // Flatten for lookup
  const SKILL_TO_CATEGORY = {};
  Object.entries(SKILL_CATEGORIES).forEach(([cat, skills]) => {
    skills.forEach(s => { SKILL_TO_CATEGORY[s] = cat; });
  });

  /* ======== Persistence Helpers ======== */
  function getJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch(e) { return fallback; }
  }
  function setJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch(e) { console.warn('[job-ai] storage write failed', e); }
  }

  /* ======== External Integrations ======== */
  function getSettings() {
    try {
      if (typeof CortexSettings !== 'undefined') return CortexSettings.getAll();
    } catch(e) {}
    return getJSON('cortex_settings', {});
  }

  function getClients() {
    try { return getJSON('cortex_client_directory', { clients: [] }).clients || []; }
    catch(e) { return []; }
  }

  function getTimeEntries() {
    try {
      if (typeof CortexTimeEngine !== 'undefined') return CortexTimeEngine.getEntries();
    } catch(e) {}
    return getJSON('cortex_time_entries', []);
  }

  function getCommHistory() {
    return getJSON('cortex_comm_history', []);
  }

  /* ======== User Profile ======== */
  const Profile = {
    _defaults: {
      skills: [],
      experience: 'mid', // junior, mid, senior, expert
      experienceYears: 3,
      preferredCategories: [],
      minHourlyRate: 0,
      targetHourlyRate: 0,
      maxHourlyRate: 0,
      currency: 'USD',
      availability: 'full', // full, part, limited
      hoursPerWeek: 40,
      preferredProjectLength: 'any', // short (<1mo), medium (1-3mo), long (3mo+), any
      preferredWorkStyle: 'any', // remote, hybrid, onsite, any
      platforms: [],
      bio: '',
      portfolio: [],
      successfulProjects: 0,
      completionRate: 100,
    },

    load() {
      const saved = getJSON(STORAGE_KEYS.profile, {});
      // Merge with settings if available
      const settings = getSettings();
      const merged = { ...this._defaults, ...saved };
      if (settings.rates) {
        if (settings.rates.defaultHourlyRate && !saved.targetHourlyRate) {
          merged.targetHourlyRate = settings.rates.defaultHourlyRate;
          merged.minHourlyRate = Math.round(settings.rates.defaultHourlyRate * 0.8);
          merged.maxHourlyRate = Math.round(settings.rates.defaultHourlyRate * 1.5);
        }
        if (settings.rates.defaultCurrency) merged.currency = settings.rates.defaultCurrency;
      }
      return merged;
    },

    save(profile) {
      setJSON(STORAGE_KEYS.profile, { ...this._defaults, ...profile });
    },

    getSkillCategories(profile) {
      const cats = new Set(profile.preferredCategories || []);
      (profile.skills || []).forEach(s => {
        const cat = SKILL_TO_CATEGORY[s.toLowerCase()];
        if (cat) cats.add(cat);
      });
      return [...cats];
    }
  };

  /* ======== Market Rate Intelligence ======== */
  const MarketRates = {
    // Median hourly rates by category and experience (USD)
    _rateTable: {
      frontend:   { junior: 35, mid: 65, senior: 100, expert: 150 },
      backend:    { junior: 40, mid: 70, senior: 110, expert: 160 },
      mobile:     { junior: 40, mid: 75, senior: 120, expert: 170 },
      database:   { junior: 35, mid: 65, senior: 105, expert: 150 },
      devops:     { junior: 45, mid: 80, senior: 125, expert: 175 },
      design:     { junior: 30, mid: 55, senior: 90,  expert: 130 },
      data:       { junior: 45, mid: 85, senior: 130, expert: 185 },
      blockchain: { junior: 50, mid: 95, senior: 150, expert: 200 },
      marketing:  { junior: 25, mid: 50, senior: 80,  expert: 120 },
      writing:    { junior: 20, mid: 40, senior: 70,  expert: 110 },
    },

    getRate(category, experience) {
      const cat = this._rateTable[category] || this._rateTable.backend;
      return cat[experience] || cat.mid;
    },

    analyze(job, profile) {
      const cats = this._getJobCategories(job);
      const primaryCat = cats[0] || 'backend';
      const exp = profile.experience || 'mid';
      const marketRate = this.getRate(primaryCat, exp);
      const jobRate = this._extractRate(job);

      let rateScore = 50;
      let recommendation = '';
      let suggestedBid = marketRate;

      if (jobRate.max > 0) {
        const ratio = jobRate.max / marketRate;
        if (ratio >= 1.2) {
          rateScore = 95;
          recommendation = 'Premium rate — above market. Strong opportunity.';
          suggestedBid = Math.round(marketRate * 1.1);
        } else if (ratio >= 1.0) {
          rateScore = 80;
          recommendation = 'Fair market rate. Good fit.';
          suggestedBid = marketRate;
        } else if (ratio >= 0.8) {
          rateScore = 60;
          recommendation = 'Slightly below market. Negotiate or accept for portfolio building.';
          suggestedBid = Math.round(jobRate.max * 0.95);
        } else if (ratio >= 0.6) {
          rateScore = 35;
          recommendation = 'Below market rate. Only worth it for strategic reasons.';
          suggestedBid = Math.round(marketRate * 0.85);
        } else {
          rateScore = 15;
          recommendation = 'Significantly under market. Consider skipping.';
          suggestedBid = Math.round(marketRate * 0.8);
        }
      } else {
        recommendation = 'No rate specified. Propose your standard rate.';
        suggestedBid = marketRate;
        rateScore = 50;
      }

      // Factor in profile rate preferences
      if (profile.targetHourlyRate > 0) {
        suggestedBid = Math.max(suggestedBid, profile.minHourlyRate || 0);
        suggestedBid = Math.min(suggestedBid, profile.maxHourlyRate || suggestedBid * 1.5);
      }

      return {
        marketRate,
        jobRate,
        suggestedBid,
        rateScore,
        recommendation,
        category: primaryCat,
        experience: exp,
        currency: profile.currency || 'USD'
      };
    },

    _getJobCategories(job) {
      const text = `${job.title || ''} ${job.description || ''} ${(job.skills || []).join(' ')}`.toLowerCase();
      const scores = {};
      Object.entries(SKILL_CATEGORIES).forEach(([cat, keywords]) => {
        let count = 0;
        keywords.forEach(kw => {
          if (text.includes(kw)) count++;
        });
        if (count > 0) scores[cat] = count;
      });
      return Object.entries(scores).sort((a,b) => b[1] - a[1]).map(e => e[0]);
    },

    _extractRate(job) {
      let min = 0, max = 0, type = 'unknown';
      if (job.budget) {
        const budgetStr = String(job.budget);
        const nums = budgetStr.match(/[\d,]+\.?\d*/g);
        if (nums) {
          const parsed = nums.map(n => parseFloat(n.replace(/,/g, '')));
          if (parsed.length >= 2) {
            min = Math.min(...parsed);
            max = Math.max(...parsed);
          } else if (parsed.length === 1) {
            min = max = parsed[0];
          }
        }
        if (/hour|hr|\/h/i.test(budgetStr)) type = 'hourly';
        else if (/month|mo/i.test(budgetStr)) type = 'monthly';
        else if (/fixed|project|total|flat/i.test(budgetStr)) type = 'fixed';
        else type = 'hourly'; // default assumption
      }
      if (job.hourlyRate) { min = job.hourlyRate.min || 0; max = job.hourlyRate.max || 0; type = 'hourly'; }
      if (job.fixedPrice) { min = max = job.fixedPrice; type = 'fixed'; }

      return { min, max, type };
    }
  };

  /* ======== Skill Matching Engine ======== */
  const SkillMatcher = {
    score(job, profile) {
      const jobSkills = this._normalizeSkills(job.skills || []);
      const userSkills = this._normalizeSkills(profile.skills || []);

      if (jobSkills.length === 0) return { score: 50, matched: [], missing: [], bonus: [], details: 'No skills specified in job listing.' };

      // Direct matches
      const matched = [];
      const missing = [];
      jobSkills.forEach(js => {
        const found = userSkills.some(us => this._fuzzyMatch(us, js));
        if (found) matched.push(js);
        else missing.push(js);
      });

      // Bonus: user has extra relevant skills
      const bonus = userSkills.filter(us =>
        !jobSkills.some(js => this._fuzzyMatch(us, js)) &&
        this._isRelevant(us, job)
      );

      // Score: weighted by match ratio + bonus
      let score = Math.round((matched.length / jobSkills.length) * 85);
      score += Math.min(bonus.length * 3, 15); // up to 15 bonus points
      score = Math.min(100, Math.max(0, score));

      // Category alignment bonus
      const jobCats = MarketRates._getJobCategories(job);
      const userCats = Profile.getSkillCategories(profile);
      const catOverlap = jobCats.filter(c => userCats.includes(c)).length;
      if (catOverlap > 0 && score < 100) score = Math.min(100, score + catOverlap * 5);

      let details = '';
      if (score >= 90) details = 'Excellent skill match — you\'re highly qualified.';
      else if (score >= 70) details = 'Strong match — most required skills covered.';
      else if (score >= 50) details = 'Moderate match — some skill gaps to address.';
      else if (score >= 30) details = 'Weak match — significant upskilling needed.';
      else details = 'Poor match — consider passing on this one.';

      return { score, matched, missing, bonus, details };
    },

    _normalizeSkills(skills) {
      return skills.map(s => s.toLowerCase().trim()).filter(Boolean);
    },

    _fuzzyMatch(a, b) {
      if (a === b) return true;
      // Common aliases
      const aliases = {
        'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'rb': 'ruby',
        'react.js': 'react', 'reactjs': 'react', 'vue.js': 'vue', 'vuejs': 'vue',
        'angular.js': 'angular', 'angularjs': 'angular', 'node': 'node.js',
        'nodejs': 'node.js', 'postgres': 'postgresql', 'mongo': 'mongodb',
        'k8s': 'kubernetes', 'tf': 'terraform', 'gha': 'github actions',
        'rn': 'react native', 'nextjs': 'next.js', 'nuxtjs': 'nuxt',
        'tailwindcss': 'tailwind', 'scss': 'sass', 'express.js': 'express',
        'graphql': 'graphql', 'rest api': 'rest', 'restful': 'rest',
        'ui design': 'ui/ux', 'ux design': 'ui/ux', 'ui ux': 'ui/ux',
        'ml': 'machine learning', 'dl': 'deep learning', 'ai': 'artificial intelligence',
        'aws lambda': 'aws', 'amazon web services': 'aws',
        'google cloud': 'gcp', 'microsoft azure': 'azure',
      };
      const na = aliases[a] || a;
      const nb = aliases[b] || b;
      if (na === nb) return true;
      // Substring match for close variants
      if (na.includes(nb) || nb.includes(na)) return true;
      return false;
    },

    _isRelevant(skill, job) {
      const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      const cat = SKILL_TO_CATEGORY[skill];
      if (!cat) return false;
      const jobCats = MarketRates._getJobCategories(job);
      return jobCats.includes(cat);
    }
  };

  /* ======== Success Probability Engine ======== */
  const SuccessPredictor = {
    calculate(job, profile, skillScore, rateAnalysis) {
      const factors = {};
      let total = 0;
      let weight = 0;

      // 1. Skill match (35% weight)
      factors.skillMatch = { score: skillScore.score, weight: 0.35 };
      total += skillScore.score * 0.35;
      weight += 0.35;

      // 2. Rate competitiveness (20% weight)
      factors.rateCompetitiveness = { score: rateAnalysis.rateScore, weight: 0.20 };
      total += rateAnalysis.rateScore * 0.20;
      weight += 0.20;

      // 3. Experience level fit (15% weight)
      const expScore = this._experienceFit(job, profile);
      factors.experienceFit = { score: expScore, weight: 0.15 };
      total += expScore * 0.15;
      weight += 0.15;

      // 4. Availability alignment (10% weight)
      const availScore = this._availabilityFit(job, profile);
      factors.availability = { score: availScore, weight: 0.10 };
      total += availScore * 0.10;
      weight += 0.10;

      // 5. Historical performance (10% weight)
      const histScore = this._historicalPerformance(job, profile);
      factors.historicalPerformance = { score: histScore, weight: 0.10 };
      total += histScore * 0.10;
      weight += 0.10;

      // 6. Competition level (10% weight)
      const compScore = this._competitionScore(job);
      factors.competition = { score: compScore, weight: 0.10 };
      total += compScore * 0.10;
      weight += 0.10;

      const probability = Math.round(total);

      let verdict = '';
      if (probability >= 80) verdict = 'High probability — strong candidate. Apply with confidence.';
      else if (probability >= 60) verdict = 'Good chance — competitive profile. Emphasize strengths.';
      else if (probability >= 40) verdict = 'Moderate — highlight transferable skills and enthusiasm.';
      else if (probability >= 20) verdict = 'Challenging — focus on unique value proposition.';
      else verdict = 'Low probability — consider passing unless strategic.';

      return { probability, factors, verdict };
    },

    _experienceFit(job, profile) {
      const desc = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      const expMap = { junior: 1, mid: 2, senior: 3, expert: 4 };
      const userLevel = expMap[profile.experience] || 2;

      let requiredLevel = 2;
      if (/senior|lead|principal|architect|staff/i.test(desc)) requiredLevel = 3;
      else if (/expert|10\+|15\+/i.test(desc)) requiredLevel = 4;
      else if (/junior|entry|intern|beginner|0-2/i.test(desc)) requiredLevel = 1;
      else if (/mid|intermediate|3-5|2-5/i.test(desc)) requiredLevel = 2;

      const diff = userLevel - requiredLevel;
      if (diff === 0) return 95;
      if (diff === 1) return 80; // slightly overqualified
      if (diff === -1) return 55; // slightly underqualified
      if (diff >= 2) return 60; // overqualified — might be "too expensive"
      return 25; // very underqualified
    },

    _availabilityFit(job, profile) {
      const desc = `${job.description || ''}`.toLowerCase();
      const avail = profile.availability || 'full';

      if (/full[ -]?time|40\s*h/i.test(desc)) {
        if (avail === 'full') return 95;
        if (avail === 'part') return 40;
        return 20;
      }
      if (/part[ -]?time|10-20|20\s*h/i.test(desc)) {
        if (avail === 'part' || avail === 'limited') return 95;
        if (avail === 'full') return 75; // can do part-time too
        return 50;
      }
      return 70; // unspecified = neutral
    },

    _historicalPerformance(job, profile) {
      // Check client history for similar project types
      const clients = getClients();
      const timeEntries = getTimeEntries();

      if (clients.length === 0 && timeEntries.length === 0) return 50; // no data

      // Count successful projects
      const successCount = clients.reduce((sum, c) => {
        return sum + (c.projects || []).filter(p => p.status === 'completed').length;
      }, 0);

      // Completion rate from profile
      const completionRate = profile.completionRate || 100;

      let score = 50;
      if (successCount >= 10) score += 25;
      else if (successCount >= 5) score += 15;
      else if (successCount >= 1) score += 5;

      if (completionRate >= 95) score += 25;
      else if (completionRate >= 85) score += 15;
      else score += 5;

      return Math.min(100, score);
    },

    _competitionScore(job) {
      // Estimate competition based on job characteristics
      const desc = `${job.title || ''} ${job.description || ''}`.toLowerCase();
      let competition = 50; // medium by default

      // High competition indicators
      if (/wordpress|data entry|virtual assistant|simple|basic|easy/i.test(desc)) competition = 80;
      // Low competition indicators
      if (/blockchain|solidity|machine learning|rust|kubernetes|architect/i.test(desc)) competition = 25;
      if (/urgent|asap|immediately|start today/i.test(desc)) competition = 30;
      // Niche = less competition
      const skillCount = (job.skills || []).length;
      if (skillCount >= 6) competition -= 15;

      // Proposals count if available
      if (job.proposals !== undefined) {
        if (job.proposals < 5) competition = 20;
        else if (job.proposals < 15) competition = 40;
        else if (job.proposals < 30) competition = 60;
        else competition = 85;
      }

      // Invert: lower competition = higher score for the user
      return Math.max(0, Math.min(100, 100 - competition));
    }
  };

  /* ======== Bidding Strategy ======== */
  const BiddingStrategy = {
    suggest(job, profile, skillScore, rateAnalysis, successPrediction) {
      const strategies = [];
      const prob = successPrediction.probability;
      const rate = rateAnalysis;

      // Base strategy
      let approach = 'standard';
      let bidRate = rate.suggestedBid;
      let coverLetterFocus = [];

      if (prob >= 80 && skillScore.score >= 85) {
        approach = 'premium';
        bidRate = Math.round(rate.marketRate * 1.15);
        coverLetterFocus = ['Highlight direct experience', 'Showcase relevant portfolio pieces', 'Propose value-add beyond requirements'];
        strategies.push({ type: 'confidence', text: 'Lead with your strongest matching skill and quantified results.' });
      } else if (prob >= 60) {
        approach = 'competitive';
        bidRate = rate.suggestedBid;
        coverLetterFocus = ['Address each required skill explicitly', 'Show enthusiasm for the project', 'Offer a clear timeline'];
        strategies.push({ type: 'differentiate', text: 'Stand out by proposing a mini-plan or quick win in your cover letter.' });
      } else if (prob >= 40) {
        approach = 'value';
        bidRate = Math.round(rate.marketRate * 0.85);
        coverLetterFocus = ['Emphasize transferable skills', 'Show willingness to learn', 'Offer competitive rate to compensate for gaps'];
        strategies.push({ type: 'bridge', text: 'Bridge skill gaps by mentioning related experience and fast learning ability.' });
      } else {
        approach = 'strategic';
        bidRate = Math.round(rate.marketRate * 0.75);
        coverLetterFocus = ['Focus on unique perspective', 'Offer trial period or milestone-based payment', 'Highlight soft skills and reliability'];
        strategies.push({ type: 'creative', text: 'Consider offering a small free sample or trial to prove capability.' });
      }

      // Missing skills strategy
      if (skillScore.missing.length > 0 && skillScore.missing.length <= 2) {
        strategies.push({ type: 'upskill', text: `Quick upskill opportunity: learn ${skillScore.missing.join(', ')} to boost match.` });
      }

      // Timing strategy
      if (job.postedAge && job.postedAge < 2) {
        strategies.push({ type: 'timing', text: 'Fresh listing — apply immediately for best visibility.' });
      } else if (job.postedAge && job.postedAge > 7) {
        strategies.push({ type: 'timing', text: 'Older listing — client may be frustrated with applicants. Address their likely pain points.' });
      }

      // Rate strategy
      if (rate.rateScore >= 80) {
        strategies.push({ type: 'rate', text: `Good budget. Bid at $${bidRate}/hr — competitive but fair.` });
      } else if (rate.rateScore < 40) {
        strategies.push({ type: 'rate', text: `Low budget. If interested, propose milestone payments or scope reduction.` });
      }

      return {
        approach,
        bidRate,
        bidRateRange: { min: Math.round(bidRate * 0.9), max: Math.round(bidRate * 1.15) },
        coverLetterFocus,
        strategies,
        currency: profile.currency || 'USD'
      };
    }
  };

  /* ======== Job Parser ======== */
  const JobParser = {
    parse(text) {
      if (!text || !text.trim()) return null;

      const job = {
        title: '',
        description: text.trim(),
        skills: [],
        budget: '',
        hourlyRate: null,
        fixedPrice: null,
        duration: '',
        experience: '',
        proposals: undefined,
        postedAge: undefined,
        clientRating: undefined,
        clientSpent: undefined,
        platform: 'unknown',
        raw: text,
      };

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      // Extract title (first non-empty short line or bold text)
      if (lines.length > 0 && lines[0].length < 150) {
        job.title = lines[0].replace(/^[#*]+\s*/, '').replace(/\*+/g, '');
      }

      // Extract skills
      const skillPatterns = [
        /skills?\s*(?:required|needed|:)\s*(.+)/i,
        /(?:looking for|must know|proficient in|experience (?:with|in))\s*(.+)/i,
        /tech(?:nology)?\s*(?:stack|:)\s*(.+)/i,
      ];
      for (const pat of skillPatterns) {
        const m = text.match(pat);
        if (m) {
          const extracted = m[1].split(/[,;|·•]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
          job.skills.push(...extracted);
        }
      }

      // Also find skill tags via taxonomy
      if (job.skills.length === 0) {
        const lowerText = text.toLowerCase();
        const found = new Set();
        Object.values(SKILL_CATEGORIES).flat().forEach(skill => {
          const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'i');
          if (regex.test(lowerText)) found.add(skill);
        });
        job.skills = [...found];
      }

      // Deduplicate skills
      job.skills = [...new Set(job.skills.map(s => s.toLowerCase()))];

      // Budget extraction
      const budgetPatterns = [
        /budget\s*[:\-]?\s*\$?([\d,]+(?:\.\d+)?)\s*[-–]\s*\$?([\d,]+(?:\.\d+)?)/i,
        /\$\s*([\d,]+(?:\.\d+)?)\s*[-–]\s*\$?\s*([\d,]+(?:\.\d+)?)/,
        /\$\s*([\d,]+(?:\.\d+)?)\s*\/?\s*(?:hr|hour)/i,
        /budget\s*[:\-]?\s*\$?([\d,]+(?:\.\d+)?)/i,
        /([\d,]+(?:\.\d+)?)\s*(?:USD|EUR|GBP)/i,
      ];
      for (const pat of budgetPatterns) {
        const m = text.match(pat);
        if (m) {
          job.budget = m[0];
          break;
        }
      }

      // Duration
      const durMatch = text.match(/(\d+)\s*(?:month|week|day)s?\b/i);
      if (durMatch) job.duration = durMatch[0];

      // Experience level
      if (/senior|lead|principal|7\+|8\+|10\+/i.test(text)) job.experience = 'senior';
      else if (/expert|15\+|specialist/i.test(text)) job.experience = 'expert';
      else if (/junior|entry|intern|0-2/i.test(text)) job.experience = 'junior';
      else if (/mid|intermediate|3-5/i.test(text)) job.experience = 'mid';

      // Proposals count
      const propMatch = text.match(/(\d+)\s*proposals?/i);
      if (propMatch) job.proposals = parseInt(propMatch[1]);

      // Platform detection
      if (/upwork/i.test(text)) job.platform = 'upwork';
      else if (/fiverr/i.test(text)) job.platform = 'fiverr';
      else if (/toptal/i.test(text)) job.platform = 'toptal';
      else if (/freelancer\.com/i.test(text)) job.platform = 'freelancer';

      // Client info
      const ratingMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:star|rating|⭐)/i);
      if (ratingMatch) job.clientRating = parseFloat(ratingMatch[1]);

      const spentMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?[KkMm]?)\s*(?:spent|total)/i);
      if (spentMatch) job.clientSpent = spentMatch[1];

      return job;
    }
  };

  /* ======== Alert System ======== */
  const AlertEngine = {
    _rules: null,

    loadRules() {
      this._rules = getJSON(STORAGE_KEYS.alerts, {
        enabled: false,
        minMatchScore: 70,
        minSuccessProbability: 50,
        categories: [],
        minRate: 0,
        maxCompetition: 'any',
        keywords: [],
        excludeKeywords: [],
        checkInterval: 30, // minutes
        lastCheck: null,
      });
      return this._rules;
    },

    saveRules(rules) {
      this._rules = { ...this._rules, ...rules };
      setJSON(STORAGE_KEYS.alerts, this._rules);
    },

    shouldAlert(matchResult) {
      const rules = this._rules || this.loadRules();
      if (!rules.enabled) return false;

      if (matchResult.overallScore < (rules.minMatchScore || 0)) return false;
      if (matchResult.successPrediction.probability < (rules.minSuccessProbability || 0)) return false;
      if (rules.minRate > 0 && matchResult.rateAnalysis.jobRate.max > 0 && matchResult.rateAnalysis.jobRate.max < rules.minRate) return false;

      // Category filter
      if (rules.categories && rules.categories.length > 0) {
        const jobCats = MarketRates._getJobCategories(matchResult.job);
        if (!jobCats.some(c => rules.categories.includes(c))) return false;
      }

      // Keyword filters
      const text = `${matchResult.job.title} ${matchResult.job.description}`.toLowerCase();
      if (rules.keywords && rules.keywords.length > 0) {
        if (!rules.keywords.some(kw => text.includes(kw.toLowerCase()))) return false;
      }
      if (rules.excludeKeywords && rules.excludeKeywords.length > 0) {
        if (rules.excludeKeywords.some(kw => text.includes(kw.toLowerCase()))) return false;
      }

      return true;
    }
  };

  /* ======== Job History ======== */
  const History = {
    save(matchResult) {
      const history = getJSON(STORAGE_KEYS.history, []);
      history.unshift({
        id: 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2,4),
        timestamp: new Date().toISOString(),
        title: matchResult.job.title,
        overallScore: matchResult.overallScore,
        skillScore: matchResult.skillMatch.score,
        successProb: matchResult.successPrediction.probability,
        suggestedBid: matchResult.biddingStrategy.bidRate,
        status: 'analyzed', // analyzed, applied, rejected, won, lost
        job: matchResult.job,
      });
      // Keep last 200
      if (history.length > 200) history.length = 200;
      setJSON(STORAGE_KEYS.history, history);
    },

    getAll() { return getJSON(STORAGE_KEYS.history, []); },

    updateStatus(id, status) {
      const history = this.getAll();
      const item = history.find(h => h.id === id);
      if (item) {
        item.status = status;
        item.statusUpdated = new Date().toISOString();
        setJSON(STORAGE_KEYS.history, history);
      }
    },

    getStats() {
      const all = this.getAll();
      const applied = all.filter(h => h.status === 'applied');
      const won = all.filter(h => h.status === 'won');
      const avgScore = all.length > 0 ? Math.round(all.reduce((s,h) => s + h.overallScore, 0) / all.length) : 0;
      return {
        total: all.length,
        applied: applied.length,
        won: won.length,
        winRate: applied.length > 0 ? Math.round((won.length / applied.length) * 100) : 0,
        avgScore,
      };
    },

    clear() { setJSON(STORAGE_KEYS.history, []); }
  };

  /* ======== Main Matching Pipeline ======== */
  function analyzeJob(jobTextOrObject) {
    const profile = Profile.load();
    const job = typeof jobTextOrObject === 'string' ? JobParser.parse(jobTextOrObject) : jobTextOrObject;

    if (!job) return { error: 'Could not parse job listing.' };

    // Run all analysis engines
    const skillMatch = SkillMatcher.score(job, profile);
    const rateAnalysis = MarketRates.analyze(job, profile);
    const successPrediction = SuccessPredictor.calculate(job, profile, skillMatch, rateAnalysis);
    const biddingStrategy = BiddingStrategy.suggest(job, profile, skillMatch, rateAnalysis, successPrediction);

    // Overall score: weighted combination
    const overallScore = Math.round(
      skillMatch.score * 0.35 +
      rateAnalysis.rateScore * 0.20 +
      successPrediction.probability * 0.30 +
      (100 - Math.max(0, 100 - biddingStrategy.bidRate)) * 0.15 // normalized bid fit
    );

    // Red flags
    const redFlags = detectRedFlags(job);

    // Green flags
    const greenFlags = detectGreenFlags(job);

    const result = {
      job,
      overallScore: Math.min(100, Math.max(0, overallScore)),
      skillMatch,
      rateAnalysis,
      successPrediction,
      biddingStrategy,
      redFlags,
      greenFlags,
      profile,
      analyzedAt: new Date().toISOString(),
    };

    // Save to history
    History.save(result);

    // Check alert rules
    result.shouldAlert = AlertEngine.shouldAlert(result);

    return result;
  }

  function detectRedFlags(job) {
    const flags = [];
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();

    if (/unpaid|free|volunteer|no pay/i.test(text)) flags.push({ level: 'high', text: 'Unpaid or free work mentioned' });
    if (/spec work|design contest/i.test(text)) flags.push({ level: 'high', text: 'Spec work / design contest' });
    if (/nda before/i.test(text)) flags.push({ level: 'medium', text: 'NDA required before details shared' });
    if (/equity only|sweat equity/i.test(text)) flags.push({ level: 'high', text: 'Equity-only compensation' });
    if (/asap|urgent|yesterday/i.test(text) && /cheap|budget|low cost/i.test(text)) flags.push({ level: 'high', text: 'Urgent + cheap — scope creep likely' });
    if (/unlimited revision/i.test(text)) flags.push({ level: 'medium', text: 'Unlimited revisions requested' });
    if (job.clientRating && job.clientRating < 3) flags.push({ level: 'high', text: `Low client rating: ${job.clientRating}` });
    if (job.proposals && job.proposals > 50) flags.push({ level: 'medium', text: `High competition: ${job.proposals} proposals` });
    if (/\btest\b.*\bfree\b|\bfree\b.*\btest\b/i.test(text)) flags.push({ level: 'high', text: 'Free test/trial work requested' });
    if (/guru|fiverr/i.test(text) && /\$[1-5]\b/i.test(text)) flags.push({ level: 'high', text: 'Extremely low budget' });

    return flags;
  }

  function detectGreenFlags(job) {
    const flags = [];
    const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();

    if (job.clientRating && job.clientRating >= 4.5) flags.push({ text: `Excellent client rating: ${job.clientRating}⭐` });
    if (job.clientSpent && parseFloat(String(job.clientSpent).replace(/[^\d.]/g,'')) > 10000) flags.push({ text: 'High-spending client' });
    if (/long[ -]?term|ongoing|retainer/i.test(text)) flags.push({ text: 'Long-term opportunity' });
    if (/milestone|escrow/i.test(text)) flags.push({ text: 'Payment protection (milestone/escrow)' });
    if (job.proposals !== undefined && job.proposals < 10) flags.push({ text: 'Low competition — few proposals' });
    if (/clear scope|detailed|specification|requirements doc/i.test(text)) flags.push({ text: 'Clear project scope' });
    if (/verified|payment verified/i.test(text)) flags.push({ text: 'Verified payment method' });

    return flags;
  }

  /* ======== Batch Analysis ======== */
  function analyzeMultiple(jobTexts) {
    return jobTexts.map(text => analyzeJob(text)).sort((a,b) => (b.overallScore || 0) - (a.overallScore || 0));
  }

  /* ======== Public API ======== */
  return {
    VERSION,
    SKILL_CATEGORIES,
    SKILL_TO_CATEGORY,

    // Core analysis
    analyzeJob,
    analyzeMultiple,
    parseJob: JobParser.parse.bind(JobParser),

    // Profile management
    loadProfile: Profile.load.bind(Profile),
    saveProfile: Profile.save.bind(Profile),

    // Market intelligence
    getMarketRate: MarketRates.getRate.bind(MarketRates),
    analyzeRate: MarketRates.analyze.bind(MarketRates),

    // Skill matching
    scoreSkills: SkillMatcher.score.bind(SkillMatcher),

    // Success prediction
    predictSuccess: SuccessPredictor.calculate.bind(SuccessPredictor),

    // Bidding
    suggestBid: BiddingStrategy.suggest.bind(BiddingStrategy),

    // Alerts
    loadAlertRules: AlertEngine.loadRules.bind(AlertEngine),
    saveAlertRules: AlertEngine.saveRules.bind(AlertEngine),
    checkAlert: AlertEngine.shouldAlert.bind(AlertEngine),

    // History
    getHistory: History.getAll.bind(History),
    getHistoryStats: History.getStats.bind(History),
    updateJobStatus: History.updateStatus.bind(History),
    clearHistory: History.clear.bind(History),

    // Flags
    detectRedFlags,
    detectGreenFlags,

    // Utilities
    getSettings,
    getClients,
    getTimeEntries,
  };
});
