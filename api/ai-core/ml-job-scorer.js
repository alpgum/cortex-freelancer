/**
 * [PHASE-2] ML Job Scoring Engine
 * Real-time job analysis with multi-factor weighted scoring,
 * feature extraction, and adaptive learning from user history.
 *
 * Uses a lightweight gradient-free ML approach:
 * - Feature extraction from job descriptions (NLP-lite)
 * - Bayesian-inspired scoring with prior from user success patterns
 * - Adaptive weight adjustment based on accepted/rejected jobs
 */

class MLJobScorer {
  constructor() {
    // Base feature weights — adapted over time per user
    this.defaultWeights = {
      skillMatch: 0.25,
      budgetFit: 0.20,
      clientQuality: 0.20,
      scopeClarity: 0.15,
      competitionLevel: 0.10,
      timingSignal: 0.05,
      redFlagPenalty: 0.05
    };

    // Red flag patterns that reduce score
    this.RED_FLAGS = [
      { pattern: /\b(unlimited revisions|as many revisions)\b/i, severity: 0.8, label: 'Unlimited revisions' },
      { pattern: /\b(ASAP|urgent|immediately|right now|today)\b/i, severity: 0.4, label: 'Urgency pressure' },
      { pattern: /\b(simple|easy|quick|just need|small task)\b/i, severity: 0.3, label: 'Scope minimization' },
      { pattern: /\b(test|trial|prove yourself|sample)\b/i, severity: 0.6, label: 'Unpaid test work' },
      { pattern: /\b(equity|rev[\s-]?share|profit[\s-]?sharing|no budget)\b/i, severity: 0.9, label: 'No pay / equity only' },
      { pattern: /\b(NDA before|sign NDA first)\b/i, severity: 0.5, label: 'NDA-first approach' },
      { pattern: /\b(full[\s-]?time availability|exclusive|dedicated)\b/i, severity: 0.4, label: 'Full-time expectation' },
      { pattern: /\b(cheap|lowest bid|budget[\s-]?friendly)\b/i, severity: 0.7, label: 'Race to bottom pricing' }
    ];

    // Positive signal patterns that boost score
    this.POSITIVE_SIGNALS = [
      { pattern: /\b(milestone|milestones)\b/i, weight: 0.1, label: 'Milestone-based' },
      { pattern: /\b(long[\s-]?term|ongoing|retainer)\b/i, weight: 0.15, label: 'Long-term potential' },
      { pattern: /\b(payment verified|verified payment)\b/i, weight: 0.1, label: 'Payment verified' },
      { pattern: /\b(detailed|comprehensive|thorough)\b/i, weight: 0.05, label: 'Well-documented' },
      { pattern: /\b(NDA|confidential|proprietary)\b/i, weight: 0.05, label: 'Professional scope' },
      { pattern: /\b(funded|venture|series [A-D]|YC|techstars)\b/i, weight: 0.12, label: 'Funded company' },
      { pattern: /\b(senior|expert|experienced)\b/i, weight: 0.08, label: 'Values experience' }
    ];

    // Skill equivalence map for fuzzy matching
    this.SKILL_ALIASES = {
      'react': ['reactjs', 'react.js', 'react 18', 'react 19'],
      'node': ['nodejs', 'node.js', 'express', 'expressjs'],
      'python': ['python3', 'django', 'flask', 'fastapi'],
      'javascript': ['js', 'es6', 'es2015', 'ecmascript'],
      'typescript': ['ts', 'tsx'],
      'css': ['css3', 'scss', 'sass', 'less', 'tailwind', 'tailwindcss'],
      'html': ['html5'],
      'aws': ['amazon web services', 'ec2', 's3', 'lambda'],
      'gcp': ['google cloud', 'firebase', 'cloud functions'],
      'docker': ['containerization', 'containers'],
      'sql': ['mysql', 'postgresql', 'postgres', 'sqlite'],
      'nosql': ['mongodb', 'dynamodb', 'firestore', 'redis'],
      'ml': ['machine learning', 'deep learning', 'ai', 'artificial intelligence'],
      'mobile': ['react native', 'flutter', 'ios', 'android', 'swift', 'kotlin']
    };
  }

  /**
   * Score a single job against a user profile with ML-enhanced analysis
   * @param {object} job - Job posting data
   * @param {object} userProfile - User skills, rate, preferences
   * @param {object} [userHistory] - Past accepted/rejected jobs for adaptive weights
   * @returns {object} Comprehensive ML score
   */
  scoreJob(job, userProfile, userHistory = null) {
    const weights = userHistory
      ? this.adaptWeights(this.defaultWeights, userHistory)
      : { ...this.defaultWeights };

    // Extract features
    const features = this.extractFeatures(job, userProfile);

    // Compute weighted score
    let rawScore = 0;
    rawScore += features.skillMatch.score * weights.skillMatch;
    rawScore += features.budgetFit.score * weights.budgetFit;
    rawScore += features.clientQuality.score * weights.clientQuality;
    rawScore += features.scopeClarity.score * weights.scopeClarity;
    rawScore += features.competitionLevel.score * weights.competitionLevel;
    rawScore += features.timingSignal.score * weights.timingSignal;

    // Apply red flag penalty
    const redFlagPenalty = features.redFlags.totalPenalty * weights.redFlagPenalty;
    rawScore = Math.max(0, rawScore - redFlagPenalty);

    // Apply positive signal bonus (capped at 15%)
    const positiveBonus = Math.min(features.positiveSignals.totalBonus, 0.15);
    rawScore = Math.min(1, rawScore + positiveBonus);

    // Bayesian adjustment from user history
    const bayesianScore = userHistory
      ? this.bayesianAdjust(rawScore, features, userHistory)
      : rawScore;

    const finalScore = Math.round(bayesianScore * 100);

    return {
      score: finalScore,
      grade: this.scoreToGrade(finalScore),
      confidence: this.calculateConfidence(features, userHistory),
      features,
      weights,
      redFlags: features.redFlags.flags,
      positiveSignals: features.positiveSignals.signals,
      recommendation: this.generateRecommendation(finalScore, features),
      applyStrategy: this.generateApplyStrategy(finalScore, features, userProfile)
    };
  }

  /**
   * Batch score multiple jobs and rank them
   */
  scoreJobs(jobs, userProfile, userHistory = null) {
    return jobs
      .map(job => ({
        job,
        analysis: this.scoreJob(job, userProfile, userHistory)
      }))
      .sort((a, b) => b.analysis.score - a.analysis.score);
  }

  /**
   * Extract all features from a job posting
   */
  extractFeatures(job, userProfile) {
    return {
      skillMatch: this.scoreSkillMatch(job, userProfile),
      budgetFit: this.scoreBudgetFit(job, userProfile),
      clientQuality: this.scoreClientQuality(job),
      scopeClarity: this.scoreScopeClarity(job),
      competitionLevel: this.scoreCompetition(job),
      timingSignal: this.scoreTimingSignal(job),
      redFlags: this.detectRedFlags(job),
      positiveSignals: this.detectPositiveSignals(job)
    };
  }

  /**
   * Skill matching with fuzzy/alias support and partial credit
   */
  scoreSkillMatch(job, userProfile) {
    const jobSkills = this.extractSkillsFromJob(job);
    const userSkills = (userProfile.skills || []).map(s => s.toLowerCase().trim());

    if (jobSkills.length === 0) {
      return { score: 0.5, matched: [], missing: [], partial: [], matchRate: 0, detail: 'No skills detected in job' };
    }

    const matched = [];
    const partial = [];
    const missing = [];

    for (const jobSkill of jobSkills) {
      const normalizedJob = jobSkill.toLowerCase().trim();

      // Direct match
      if (userSkills.some(us => us === normalizedJob || us.includes(normalizedJob) || normalizedJob.includes(us))) {
        matched.push(jobSkill);
        continue;
      }

      // Alias match
      let aliasMatched = false;
      for (const [canonical, aliases] of Object.entries(this.SKILL_ALIASES)) {
        const allForms = [canonical, ...aliases];
        const jobInGroup = allForms.some(a => normalizedJob.includes(a) || a.includes(normalizedJob));
        const userInGroup = userSkills.some(us => allForms.some(a => us.includes(a) || a.includes(us)));

        if (jobInGroup && userInGroup) {
          partial.push({ skill: jobSkill, via: canonical, credit: 0.7 });
          aliasMatched = true;
          break;
        }
      }

      if (!aliasMatched) {
        missing.push(jobSkill);
      }
    }

    const directScore = matched.length / jobSkills.length;
    const partialScore = partial.reduce((sum, p) => sum + p.credit, 0) / jobSkills.length;
    const totalScore = Math.min(1, directScore + partialScore);

    return {
      score: totalScore,
      matched,
      partial: partial.map(p => p.skill),
      missing,
      matchRate: Math.round(totalScore * 100),
      detail: `${matched.length} direct + ${partial.length} related of ${jobSkills.length} required`
    };
  }

  /**
   * Extract skills from job description + explicit skills array
   */
  extractSkillsFromJob(job) {
    const skills = new Set();

    // From explicit skills array
    if (job.skills && Array.isArray(job.skills)) {
      job.skills.forEach(s => skills.add(s));
    }

    // Extract from description using common tech patterns
    const desc = (job.description || '') + ' ' + (job.title || '');
    const techPatterns = [
      /\b(React|Angular|Vue|Svelte|Next\.?js|Nuxt)\b/gi,
      /\b(Node\.?js|Express|Django|Flask|FastAPI|Rails|Laravel|Spring)\b/gi,
      /\b(Python|JavaScript|TypeScript|Java|Go|Rust|Ruby|PHP|Swift|Kotlin|C\+\+|C#)\b/gi,
      /\b(AWS|GCP|Azure|Docker|Kubernetes|Terraform|CI\/CD)\b/gi,
      /\b(PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB|Firebase)\b/gi,
      /\b(GraphQL|REST|gRPC|WebSocket|API)\b/gi,
      /\b(React Native|Flutter|iOS|Android)\b/gi,
      /\b(TailwindCSS|Tailwind|Bootstrap|Material UI|Chakra)\b/gi,
      /\b(Figma|Sketch|Adobe XD|UI\/UX)\b/gi,
      /\b(Machine Learning|ML|AI|NLP|LLM|GPT|Deep Learning|TensorFlow|PyTorch)\b/gi
    ];

    for (const pattern of techPatterns) {
      const matches = desc.match(pattern);
      if (matches) {
        matches.forEach(m => skills.add(m));
      }
    }

    return [...skills];
  }

  /**
   * Budget/rate fitness scoring
   */
  scoreBudgetFit(job, userProfile) {
    const userRate = userProfile.hourlyRate || userProfile.rate || 0;
    if (!userRate) return { score: 0.5, detail: 'No rate set', effectiveRate: 0 };

    const budget = this.parseBudget(job);
    if (!budget.amount) return { score: 0.5, detail: 'No budget info', effectiveRate: 0 };

    let effectiveHourly;
    if (budget.type === 'hourly') {
      effectiveHourly = budget.amount;
    } else {
      const hours = this.estimateProjectHours(job);
      effectiveHourly = budget.amount / hours;
    }

    const ratio = effectiveHourly / userRate;

    let score, detail;
    if (ratio >= 1.5) {
      score = 1.0;
      detail = `Premium: $${Math.round(effectiveHourly)}/hr (${Math.round(ratio * 100)}% of your rate)`;
    } else if (ratio >= 1.1) {
      score = 0.9;
      detail = `Above rate: $${Math.round(effectiveHourly)}/hr`;
    } else if (ratio >= 0.9) {
      score = 0.8;
      detail = `At rate: $${Math.round(effectiveHourly)}/hr`;
    } else if (ratio >= 0.75) {
      score = 0.6;
      detail = `Slightly below: $${Math.round(effectiveHourly)}/hr (${Math.round(ratio * 100)}% of your rate)`;
    } else if (ratio >= 0.5) {
      score = 0.3;
      detail = `Below rate: $${Math.round(effectiveHourly)}/hr`;
    } else {
      score = 0.1;
      detail = `Far below rate: $${Math.round(effectiveHourly)}/hr`;
    }

    return { score, detail, effectiveRate: Math.round(effectiveHourly), ratio: Math.round(ratio * 100) };
  }

  /**
   * Client quality assessment
   */
  scoreClientQuality(job) {
    let score = 0;
    const signals = [];

    // Total spent
    const spent = parseFloat(job.clientTotalSpent || job.clientSpent || job.totalSpent || 0);
    if (spent >= 100000) { score += 0.3; signals.push('High spender ($' + Math.round(spent / 1000) + 'K)'); }
    else if (spent >= 10000) { score += 0.2; signals.push('Active client ($' + Math.round(spent / 1000) + 'K)'); }
    else if (spent >= 1000) { score += 0.1; signals.push('Some history'); }
    else { signals.push('New/low-spend client'); }

    // Rating
    const rating = parseFloat(job.clientRating || job.rating || 0);
    if (rating >= 4.8) { score += 0.25; signals.push(rating + ' rating'); }
    else if (rating >= 4.5) { score += 0.2; signals.push(rating + ' rating'); }
    else if (rating >= 4.0) { score += 0.1; signals.push(rating + ' rating'); }
    else if (rating > 0) { signals.push('Low rating: ' + rating); }

    // Hire rate
    const hireRate = parseFloat(job.clientHireRate || job.hireRate || 0);
    if (hireRate >= 80) { score += 0.2; signals.push(hireRate + '% hire rate'); }
    else if (hireRate >= 50) { score += 0.15; signals.push(hireRate + '% hire rate'); }
    else if (hireRate >= 20) { score += 0.05; }

    // Payment verification
    if (job.paymentVerified || job.clientPaymentVerified) {
      score += 0.15;
      signals.push('Payment verified');
    }

    // Previous hires
    const hires = parseInt(job.clientHires || job.hires || 0, 10);
    if (hires >= 20) { score += 0.1; signals.push(hires + ' past hires'); }
    else if (hires >= 5) { score += 0.05; }

    return { score: Math.min(1, score), signals, detail: signals.join(', ') };
  }

  /**
   * Scope clarity — how well-defined is the project?
   */
  scoreScopeClarity(job) {
    const desc = job.description || '';
    if (!desc.trim()) return { score: 0.1, detail: 'No description', signals: [] };

    let score = 0;
    const signals = [];
    const words = desc.trim().split(/\s+/).length;

    // Length (ideal: 100-500 words)
    if (words >= 100 && words <= 500) { score += 0.25; signals.push('Good length'); }
    else if (words >= 50) { score += 0.15; signals.push(words + ' words'); }
    else { score += 0.05; signals.push('Very short'); }

    // Structure indicators
    if (/[-•*]\s|^\d+[.)]\s/m.test(desc)) { score += 0.15; signals.push('Structured (bullets/numbers)'); }
    if (desc.split(/\n\s*\n/).filter(p => p.trim()).length >= 3) { score += 0.1; signals.push('Multiple sections'); }

    // Specificity
    if (/\b(deliver|milestone|deadline|phase|sprint)\b/i.test(desc)) { score += 0.15; signals.push('Has deliverables'); }
    if (/\b(require|must|should|need to|looking for)\b/i.test(desc)) { score += 0.1; signals.push('Clear requirements'); }
    if (/\d+/.test(desc)) { score += 0.1; signals.push('Contains specifics'); }
    if (/\b(experience|expertise|skill|proficient)\b/i.test(desc)) { score += 0.1; signals.push('Skill expectations listed'); }

    // Technology specificity
    const techMentions = (desc.match(/\b(React|Node|Python|AWS|Docker|API|SQL|MongoDB|GraphQL|TypeScript)\b/gi) || []).length;
    if (techMentions >= 3) { score += 0.1; signals.push(techMentions + ' tech mentions'); }

    return { score: Math.min(1, score), signals, detail: signals.join(', ') };
  }

  /**
   * Competition level assessment
   */
  scoreCompetition(job) {
    const proposals = parseInt(job.proposals || job.applicants || job.bids || 0, 10);
    const posted = job.postedDate || job.createdAt || job.posted;

    let hoursAgo = 24;
    if (posted) {
      const postedTime = new Date(posted).getTime();
      if (!isNaN(postedTime)) {
        hoursAgo = Math.max(1, (Date.now() - postedTime) / (1000 * 60 * 60));
      }
    }

    // Proposal velocity (proposals per hour)
    const velocity = proposals / hoursAgo;

    let score, detail;
    if (proposals === 0) {
      score = 0.95;
      detail = 'No proposals yet — first mover advantage';
    } else if (proposals <= 5 && velocity < 1) {
      score = 0.85;
      detail = `${proposals} proposals, low velocity — great opportunity`;
    } else if (proposals <= 10) {
      score = 0.7;
      detail = `${proposals} proposals — moderate competition`;
    } else if (proposals <= 20) {
      score = 0.45;
      detail = `${proposals} proposals — competitive`;
    } else if (proposals <= 35) {
      score = 0.25;
      detail = `${proposals} proposals — high competition`;
    } else {
      score = 0.1;
      detail = `${proposals}+ proposals — very crowded`;
    }

    return { score, proposals, velocity: Math.round(velocity * 10) / 10, detail };
  }

  /**
   * Timing signal — how fresh is the job?
   */
  scoreTimingSignal(job) {
    const posted = job.postedDate || job.createdAt || job.posted;
    if (!posted) return { score: 0.5, detail: 'No posting time' };

    const postedTime = new Date(posted).getTime();
    if (isNaN(postedTime)) return { score: 0.5, detail: 'Invalid date' };

    const hoursAgo = (Date.now() - postedTime) / (1000 * 60 * 60);

    if (hoursAgo < 1) return { score: 1.0, detail: 'Just posted (<1hr)' };
    if (hoursAgo < 4) return { score: 0.9, detail: `Posted ${Math.round(hoursAgo)}hr ago — very fresh` };
    if (hoursAgo < 12) return { score: 0.7, detail: 'Posted today' };
    if (hoursAgo < 24) return { score: 0.5, detail: 'Posted yesterday' };
    if (hoursAgo < 72) return { score: 0.3, detail: `Posted ${Math.round(hoursAgo / 24)}d ago` };
    return { score: 0.1, detail: `Posted ${Math.round(hoursAgo / 24)}d ago — stale` };
  }

  /**
   * Detect red flags in job description
   */
  detectRedFlags(job) {
    const text = (job.description || '') + ' ' + (job.title || '');
    const flags = [];
    let totalPenalty = 0;

    for (const rf of this.RED_FLAGS) {
      if (rf.pattern.test(text)) {
        flags.push({ label: rf.label, severity: rf.severity });
        totalPenalty += rf.severity;
      }
    }

    return { flags, totalPenalty: Math.min(totalPenalty, 1), count: flags.length };
  }

  /**
   * Detect positive signals
   */
  detectPositiveSignals(job) {
    const text = (job.description || '') + ' ' + (job.title || '');
    const signals = [];
    let totalBonus = 0;

    for (const ps of this.POSITIVE_SIGNALS) {
      if (ps.pattern.test(text)) {
        signals.push({ label: ps.label, weight: ps.weight });
        totalBonus += ps.weight;
      }
    }

    return { signals, totalBonus, count: signals.length };
  }

  /**
   * Bayesian adjustment: shift score based on historical success patterns
   */
  bayesianAdjust(rawScore, features, userHistory) {
    if (!userHistory || !userHistory.outcomes || userHistory.outcomes.length < 3) {
      return rawScore;
    }

    // Calculate success rate for similar jobs (by skill overlap)
    const similar = userHistory.outcomes.filter(h => {
      if (!h.jobSkills) return false;
      const overlap = h.jobSkills.filter(s =>
        features.skillMatch.matched.some(m => m.toLowerCase() === s.toLowerCase())
      ).length;
      return overlap > 0;
    });

    if (similar.length < 2) return rawScore;

    const successRate = similar.filter(s => s.success).length / similar.length;

    // Blend raw score with prior (weight by sample size, max 30% influence)
    const priorWeight = Math.min(similar.length / 20, 0.3);
    return rawScore * (1 - priorWeight) + successRate * priorWeight;
  }

  /**
   * Adapt weights based on what factors correlated with user success
   */
  adaptWeights(baseWeights, userHistory) {
    if (!userHistory || !userHistory.weightFeedback) return { ...baseWeights };

    const adapted = { ...baseWeights };
    const feedback = userHistory.weightFeedback;

    // Shift weights toward factors that correlated with user success
    for (const [factor, adjustment] of Object.entries(feedback)) {
      if (adapted[factor] !== undefined) {
        adapted[factor] = Math.max(0.05, Math.min(0.4, adapted[factor] + adjustment));
      }
    }

    // Normalize to sum = 1
    const sum = Object.values(adapted).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(adapted)) {
      adapted[key] = adapted[key] / sum;
    }

    return adapted;
  }

  /**
   * Calculate confidence in the score (0-100)
   */
  calculateConfidence(features, userHistory) {
    let confidence = 50; // Base confidence

    // More data = more confidence
    if (features.skillMatch.matched.length > 0) confidence += 10;
    if (features.budgetFit.effectiveRate > 0) confidence += 10;
    if (features.clientQuality.signals.length > 2) confidence += 10;
    if (features.scopeClarity.score > 0.5) confidence += 10;

    // User history boosts confidence
    if (userHistory && userHistory.outcomes && userHistory.outcomes.length > 5) {
      confidence += Math.min(userHistory.outcomes.length, 10);
    }

    return Math.min(95, confidence);
  }

  /**
   * Grade from score
   */
  scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  /**
   * Generate human-readable recommendation
   */
  generateRecommendation(score, features) {
    if (score >= 85) {
      return {
        action: 'STRONG_APPLY',
        text: 'Excellent match — apply with a personalized proposal. This job aligns well with your profile.',
        priority: 'high'
      };
    }
    if (score >= 70) {
      return {
        action: 'APPLY',
        text: 'Good fit — worth applying. Emphasize your matching skills and relevant experience.',
        priority: 'medium'
      };
    }
    if (score >= 50) {
      const weak = this.findWeakestFactor(features);
      return {
        action: 'CONSIDER',
        text: `Moderate match. Weakest area: ${weak}. Apply if you can address this gap in your proposal.`,
        priority: 'low'
      };
    }
    if (score >= 30) {
      return {
        action: 'SKIP',
        text: 'Low compatibility. Better opportunities likely available. Only apply if you need the experience.',
        priority: 'skip'
      };
    }
    return {
      action: 'AVOID',
      text: 'Poor match with multiple red flags. Focus your connects on better-fitting jobs.',
      priority: 'avoid'
    };
  }

  /**
   * Generate a specific apply strategy
   */
  generateApplyStrategy(score, features, userProfile) {
    const strategy = {
      openingHook: '',
      keyPoints: [],
      rateStrategy: '',
      differentiator: ''
    };

    // Opening hook based on timing
    if (features.timingSignal.score >= 0.9) {
      strategy.openingHook = 'Lead with immediate availability — you\'re among the first to apply.';
    } else if (features.competitionLevel.proposals > 20) {
      strategy.openingHook = 'Stand out by leading with a specific result or metric from similar work.';
    } else {
      strategy.openingHook = 'Open with direct relevance to their core requirement.';
    }

    // Key points to emphasize
    if (features.skillMatch.matched.length > 0) {
      strategy.keyPoints.push(`Highlight direct experience with: ${features.skillMatch.matched.slice(0, 3).join(', ')}`);
    }
    if (features.skillMatch.missing.length > 0) {
      strategy.keyPoints.push(`Address skill gap (${features.skillMatch.missing.slice(0, 2).join(', ')}) with transferable experience`);
    }
    if (features.clientQuality.score > 0.7) {
      strategy.keyPoints.push('Reference their strong hiring history — shows you did research');
    }

    // Rate strategy
    const budgetRatio = features.budgetFit.ratio || 100;
    if (budgetRatio >= 120) {
      strategy.rateStrategy = 'Bid at your standard rate — budget supports it.';
    } else if (budgetRatio >= 90) {
      strategy.rateStrategy = 'Bid at your standard rate. Budget is aligned.';
    } else if (budgetRatio >= 70) {
      strategy.rateStrategy = 'Consider a slight discount if the project offers portfolio value or repeat work potential.';
    } else {
      strategy.rateStrategy = 'Budget is below your rate. Only proceed if there\'s significant strategic value.';
    }

    // Differentiator
    if (features.scopeClarity.score < 0.5) {
      strategy.differentiator = 'Offer a free scope clarification call — shows initiative and professionalism.';
    } else if (features.redFlags.count > 0) {
      strategy.differentiator = 'Address potential concerns proactively by proposing clear milestones and boundaries.';
    } else {
      strategy.differentiator = 'Include a brief project approach outline to demonstrate understanding.';
    }

    return strategy;
  }

  /**
   * Find the weakest scoring factor
   */
  findWeakestFactor(features) {
    const factors = [
      { name: 'Skill match', score: features.skillMatch.score },
      { name: 'Budget fit', score: features.budgetFit.score },
      { name: 'Client quality', score: features.clientQuality.score },
      { name: 'Scope clarity', score: features.scopeClarity.score },
      { name: 'Competition', score: features.competitionLevel.score }
    ];
    factors.sort((a, b) => a.score - b.score);
    return factors[0].name;
  }

  // ─── Utility Methods ─────────────────────────────────────────────

  parseBudget(job) {
    const budgetStr = String(job.budget || '');
    const type = /hour|\/hr/i.test(budgetStr) || /hour/i.test(job.budgetType || '') ? 'hourly' : 'fixed';
    const num = parseFloat(budgetStr.replace(/[^0-9.]/g, ''));
    let amount = isNaN(num) ? 0 : num;
    if (/k/i.test(budgetStr)) amount *= 1000;
    if (/m/i.test(budgetStr)) amount *= 1000000;
    return { amount, type };
  }

  estimateProjectHours(job) {
    const raw = String(job.projectLength || job.duration || '').toLowerCase();
    if (/less\s+than\s+(a\s+)?week|few\s+days/i.test(raw)) return 20;
    if (/1[\s-]*(to|-)?\s*4\s*week/i.test(raw)) return 60;
    if (/1[\s-]*(to|-)?\s*3\s*month/i.test(raw)) return 200;
    if (/3[\s-]*(to|-)?\s*6\s*month/i.test(raw)) return 500;
    if (/6\+?\s*month|ongoing|long[\s-]*term/i.test(raw)) return 1000;
    return 40;
  }
}

module.exports = MLJobScorer;
