/**
 * [PHASE-2] Proposal Customization & Optimization Engine
 *
 * Automated proposal optimization that learns from win/loss patterns,
 * client preferences, and job characteristics to generate high-converting
 * proposals tailored to each opportunity.
 *
 * Key features:
 * - Win pattern analysis from historical proposals
 * - Client-type adaptive tone selection
 * - Keyword injection from job description
 * - Section scoring with improvement suggestions
 * - A/B variant generation for testing
 */

class ProposalOptimizer {
  constructor() {
    // Proposal section weights for scoring
    this.SECTION_WEIGHTS = {
      opening: 0.20,      // First impression — most critical
      relevance: 0.25,    // How well it addresses the specific job
      approach: 0.20,     // Technical approach / methodology
      credibility: 0.15,  // Social proof, portfolio, metrics
      cta: 0.10,          // Call to action
      formatting: 0.10    // Structure, readability
    };

    // Client archetypes with preferred communication styles
    this.CLIENT_ARCHETYPES = {
      startup: {
        tone: 'energetic',
        values: ['speed', 'iteration', 'mvp', 'growth'],
        avoidWords: ['enterprise', 'waterfall', 'committee'],
        preferWords: ['agile', 'lean', 'ship', 'iterate', 'scale'],
        openingStyle: 'enthusiasm',
        lengthPreference: 'concise'  // 150-250 words
      },
      enterprise: {
        tone: 'professional',
        values: ['reliability', 'process', 'security', 'compliance'],
        avoidWords: ['hack', 'mvp', 'quick-and-dirty'],
        preferWords: ['robust', 'scalable', 'enterprise-grade', 'SLA', 'governance'],
        openingStyle: 'authority',
        lengthPreference: 'detailed'  // 300-500 words
      },
      agency: {
        tone: 'collaborative',
        values: ['teamwork', 'white-label', 'deadline', 'process'],
        avoidWords: ['solo', 'my way'],
        preferWords: ['integrate', 'collaborate', 'workflow', 'handoff', 'team'],
        openingStyle: 'partnership',
        lengthPreference: 'moderate'  // 200-350 words
      },
      smb: {
        tone: 'friendly',
        values: ['value', 'roi', 'simplicity', 'reliability'],
        avoidWords: ['complex', 'enterprise', 'expensive'],
        preferWords: ['straightforward', 'value', 'results', 'affordable', 'done'],
        openingStyle: 'empathy',
        lengthPreference: 'concise'
      },
      individual: {
        tone: 'warm',
        values: ['personal', 'communication', 'trust'],
        avoidWords: ['corporate', 'formal', 'SLA'],
        preferWords: ['together', 'help', 'guide', 'understand', 'your vision'],
        openingStyle: 'personal',
        lengthPreference: 'concise'
      }
    };

    // Power words that increase proposal effectiveness
    this.POWER_WORDS = {
      results: ['achieved', 'delivered', 'increased', 'reduced', 'improved', 'generated', 'saved'],
      expertise: ['specialized', 'expert', 'deep experience', 'proficient', 'certified'],
      reliability: ['on-time', 'milestone-based', 'transparent', 'responsive', 'committed'],
      value: ['ROI', 'cost-effective', 'efficient', 'optimized', 'streamlined']
    };

    // Weak phrases to flag and replace
    this.WEAK_PHRASES = [
      { pattern: /\bI think I can\b/gi, replacement: 'I will', reason: 'Avoid uncertainty' },
      { pattern: /\bI would like to\b/gi, replacement: 'I\'m ready to', reason: 'Show decisiveness' },
      { pattern: /\bI believe\b/gi, replacement: 'Based on my experience', reason: 'Back with evidence' },
      { pattern: /\bmaybe\b/gi, replacement: 'specifically', reason: 'Remove hedging' },
      { pattern: /\bkind of\b/gi, replacement: '', reason: 'Remove filler' },
      { pattern: /\bsort of\b/gi, replacement: '', reason: 'Remove filler' },
      { pattern: /\bjust\b/gi, replacement: '', reason: 'Remove minimizer' },
      { pattern: /\bactually\b/gi, replacement: '', reason: 'Remove filler' },
      { pattern: /\bbasically\b/gi, replacement: '', reason: 'Remove filler' },
      { pattern: /\bI am a freelancer\b/gi, replacement: 'I specialize in', reason: 'Lead with expertise' },
      { pattern: /\bDear Sir\/Madam\b/gi, replacement: 'Hi', reason: 'Modern tone' },
      { pattern: /\bTo Whom It May Concern\b/gi, replacement: 'Hi there', reason: 'Modern tone' }
    ];
  }

  /**
   * Optimize a proposal for a specific job
   * @param {object} params
   * @param {string} params.proposalText - Draft proposal text
   * @param {object} params.job - Job posting data
   * @param {object} params.userProfile - User skills, experience
   * @param {object} [params.winHistory] - Past proposal win/loss data
   * @returns {object} Optimized proposal with scoring
   */
  optimize(params) {
    const { proposalText, job, userProfile, winHistory } = params;

    // 1. Detect client archetype
    const clientType = this.detectClientType(job);
    const archetype = this.CLIENT_ARCHETYPES[clientType] || this.CLIENT_ARCHETYPES.smb;

    // 2. Extract key terms from job for keyword injection
    const jobKeywords = this.extractJobKeywords(job);

    // 3. Score the current proposal
    const currentScore = this.scoreProposal(proposalText, job, jobKeywords);

    // 4. Generate improvements
    const improvements = this.generateImprovements(proposalText, job, archetype, jobKeywords, currentScore);

    // 5. Apply automatic fixes
    const optimizedText = this.applyAutoFixes(proposalText, improvements);

    // 6. Score the optimized version
    const optimizedScore = this.scoreProposal(optimizedText, job, jobKeywords);

    // 7. Win pattern insights
    const winInsights = winHistory ? this.analyzeWinPatterns(winHistory, job) : null;

    return {
      original: {
        text: proposalText,
        score: currentScore
      },
      optimized: {
        text: optimizedText,
        score: optimizedScore
      },
      improvement: optimizedScore.overall - currentScore.overall,
      clientType,
      archetype: {
        tone: archetype.tone,
        lengthPreference: archetype.lengthPreference,
        preferWords: archetype.preferWords
      },
      jobKeywords,
      improvements,
      winInsights,
      strategy: this.generateStrategy(job, archetype, currentScore, winInsights)
    };
  }

  /**
   * Generate a proposal from scratch for a job
   */
  generateProposal(job, userProfile, options = {}) {
    const clientType = this.detectClientType(job);
    const archetype = this.CLIENT_ARCHETYPES[clientType] || this.CLIENT_ARCHETYPES.smb;
    const jobKeywords = this.extractJobKeywords(job);
    const tone = options.tone || archetype.tone;

    // Build sections
    const opening = this.generateOpening(job, archetype, userProfile);
    const relevance = this.generateRelevanceSection(job, userProfile, jobKeywords);
    const approach = this.generateApproachSection(job, userProfile);
    const credibility = this.generateCredibilitySection(userProfile);
    const cta = this.generateCTA(archetype);

    const sections = { opening, relevance, approach, credibility, cta };
    const fullText = [opening, relevance, approach, credibility, cta].join('\n\n');

    return {
      text: fullText,
      sections,
      clientType,
      tone,
      wordCount: fullText.split(/\s+/).length,
      score: this.scoreProposal(fullText, job, jobKeywords)
    };
  }

  /**
   * Generate A/B variants for testing
   */
  generateVariants(job, userProfile) {
    const variants = [];

    // Variant A: Results-driven (metrics-focused opening)
    variants.push({
      name: 'Results-Driven',
      proposal: this.generateProposal(job, userProfile, { tone: 'professional' }),
      hypothesis: 'Leading with metrics and results builds credibility fast'
    });

    // Variant B: Personal connection (empathy-focused opening)
    variants.push({
      name: 'Personal Connection',
      proposal: this.generateProposal(job, userProfile, { tone: 'warm' }),
      hypothesis: 'Personal touch creates stronger emotional connection'
    });

    // Variant C: Technical authority (approach-focused)
    variants.push({
      name: 'Technical Authority',
      proposal: this.generateProposal(job, userProfile, { tone: 'energetic' }),
      hypothesis: 'Technical depth demonstrates capability for complex projects'
    });

    return variants;
  }

  // ─── Core Scoring ─────────────────────────────────────────────────

  /**
   * Score a proposal across all dimensions
   */
  scoreProposal(text, job, jobKeywords) {
    const sections = {
      opening: this.scoreOpening(text),
      relevance: this.scoreRelevance(text, job, jobKeywords),
      approach: this.scoreApproach(text),
      credibility: this.scoreCredibility(text),
      cta: this.scoreCTA(text),
      formatting: this.scoreFormatting(text)
    };

    let overall = 0;
    for (const [key, section] of Object.entries(sections)) {
      overall += section.score * (this.SECTION_WEIGHTS[key] || 0);
    }

    return {
      overall: Math.round(overall),
      sections,
      grade: this.scoreToGrade(Math.round(overall))
    };
  }

  scoreOpening(text) {
    const firstParagraph = text.split('\n\n')[0] || text.substring(0, 200);
    let score = 50;
    const feedback = [];

    // Personalization (uses client name or project name)
    if (/\b(Hi|Hello|Hey)\s+\w+/i.test(firstParagraph)) {
      score += 15;
      feedback.push('Personalized greeting');
    }

    // Hooks with results/numbers
    if (/\d+/.test(firstParagraph)) {
      score += 10;
      feedback.push('Contains specifics/numbers');
    }

    // Avoids generic openings
    if (/\bI am (a|an) (experienced|skilled|professional)\b/i.test(firstParagraph)) {
      score -= 15;
      feedback.push('Generic self-introduction — lead with value instead');
    }

    // Length (ideal: 2-4 sentences)
    const sentences = firstParagraph.split(/[.!?]+/).filter(s => s.trim()).length;
    if (sentences >= 2 && sentences <= 4) {
      score += 10;
    } else if (sentences > 6) {
      score -= 10;
      feedback.push('Opening too long — keep to 2-4 sentences');
    }

    // Addresses the specific need
    if (/\b(your|you're looking|you need|your project)\b/i.test(firstParagraph)) {
      score += 15;
      feedback.push('Client-focused language');
    }

    return { score: Math.max(0, Math.min(100, score)), feedback };
  }

  scoreRelevance(text, job, jobKeywords) {
    let score = 30;
    const feedback = [];
    const textLower = text.toLowerCase();

    // Keyword coverage
    const coveredKeywords = jobKeywords.filter(kw => textLower.includes(kw.toLowerCase()));
    const coverage = jobKeywords.length > 0 ? coveredKeywords.length / jobKeywords.length : 0;

    score += Math.round(coverage * 40);
    if (coverage >= 0.6) {
      feedback.push(`Good keyword coverage (${coveredKeywords.length}/${jobKeywords.length})`);
    } else {
      feedback.push(`Low keyword coverage (${coveredKeywords.length}/${jobKeywords.length}) — mirror job language`);
    }

    // Addresses specific requirements
    const reqPatterns = (job.description || '').match(/\b(need|require|must|should|looking for)\s+\w+/gi) || [];
    const addressedReqs = reqPatterns.filter(req => {
      const words = req.split(/\s+/).slice(1);
      return words.some(w => textLower.includes(w.toLowerCase()));
    }).length;

    if (reqPatterns.length > 0) {
      const reqCoverage = addressedReqs / reqPatterns.length;
      score += Math.round(reqCoverage * 20);
      if (reqCoverage < 0.5) {
        feedback.push('Address more of the stated requirements directly');
      }
    }

    // Portfolio/example link relevant
    if (/\b(portfolio|example|similar project|built|created|developed)\b/i.test(text)) {
      score += 10;
      feedback.push('References relevant work');
    }

    return { score: Math.max(0, Math.min(100, score)), feedback, keywordCoverage: Math.round(coverage * 100) };
  }

  scoreApproach(text) {
    let score = 40;
    const feedback = [];

    // Has a structured approach
    if (/\b(step\s*\d|phase\s*\d|first|then|finally|approach|methodology)\b/i.test(text)) {
      score += 20;
      feedback.push('Structured approach described');
    }

    // Timeline mention
    if (/\b(\d+\s*(day|week|month|hour)|timeline|deadline|delivery)\b/i.test(text)) {
      score += 15;
      feedback.push('Timeline included');
    }

    // Technology specifics
    if (/\b(using|with|via|through|leverage)\s+(React|Node|Python|AWS|Docker|API)/i.test(text)) {
      score += 15;
      feedback.push('Technology approach specified');
    }

    // Milestone/deliverable mention
    if (/\b(milestone|deliverable|checkpoint|review point)\b/i.test(text)) {
      score += 10;
      feedback.push('Milestones mentioned');
    }

    return { score: Math.max(0, Math.min(100, score)), feedback };
  }

  scoreCredibility(text) {
    let score = 30;
    const feedback = [];

    // Numbers/metrics
    const metrics = text.match(/\d+[\+%xX]|\$\d+/g) || [];
    if (metrics.length >= 2) {
      score += 25;
      feedback.push('Multiple metrics/numbers (strong social proof)');
    } else if (metrics.length === 1) {
      score += 15;
      feedback.push('Contains metrics');
    } else {
      feedback.push('Add specific metrics (e.g., "reduced load time by 40%")');
    }

    // Power words
    const powerWordCount = this.POWER_WORDS.results
      .filter(pw => text.toLowerCase().includes(pw.toLowerCase())).length;
    if (powerWordCount >= 2) {
      score += 20;
    } else if (powerWordCount >= 1) {
      score += 10;
    }

    // Years of experience
    if (/\b\d+\+?\s*years?\b/i.test(text)) {
      score += 15;
      feedback.push('Experience duration mentioned');
    }

    // Similar work reference
    if (/\b(similar|related|comparable)\s+(project|work|client)\b/i.test(text)) {
      score += 10;
      feedback.push('References similar work');
    }

    return { score: Math.max(0, Math.min(100, score)), feedback };
  }

  scoreCTA(text) {
    let score = 30;
    const feedback = [];
    const lastParagraph = text.split('\n\n').pop() || text.slice(-200);

    // Has a clear call to action
    if (/\b(call|chat|discuss|meeting|available|schedule|let's|let me know|reach out)\b/i.test(lastParagraph)) {
      score += 30;
      feedback.push('Clear call to action');
    } else {
      feedback.push('Missing call to action — end with a specific next step');
    }

    // Offers something free
    if (/\b(free|complimentary|no[\s-]?cost|no[\s-]?obligation)\b/i.test(lastParagraph)) {
      score += 15;
      feedback.push('Value-add offer');
    }

    // Creates urgency (positive)
    if (/\b(available|start|ready|this week|today|immediately)\b/i.test(lastParagraph)) {
      score += 15;
      feedback.push('Availability mentioned');
    }

    // Question engagement
    if (/\?/.test(lastParagraph)) {
      score += 10;
      feedback.push('Ends with engagement question');
    }

    return { score: Math.max(0, Math.min(100, score)), feedback };
  }

  scoreFormatting(text) {
    let score = 50;
    const feedback = [];
    const words = text.split(/\s+/).length;

    // Length
    if (words >= 150 && words <= 400) {
      score += 20;
      feedback.push('Good length (' + words + ' words)');
    } else if (words < 100) {
      score -= 10;
      feedback.push('Too short — expand with specific details');
    } else if (words > 500) {
      score -= 10;
      feedback.push('Too long — tighten for readability');
    }

    // Paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim()).length;
    if (paragraphs >= 3 && paragraphs <= 6) {
      score += 15;
    }

    // Has formatting (bold, bullets)
    if (/[*•\-]\s|^\d+[.)]/m.test(text) || /\*\*.+\*\*/m.test(text)) {
      score += 15;
      feedback.push('Good use of formatting');
    }

    return { score: Math.max(0, Math.min(100, score)), feedback, wordCount: words };
  }

  // ─── Generation Helpers ───────────────────────────────────────────

  generateOpening(job, archetype, userProfile) {
    const title = job.title || 'your project';
    const style = archetype.openingStyle;

    switch (style) {
      case 'enthusiasm':
        return `Hi! Your ${title} caught my attention — it\'s exactly the kind of challenge I love tackling. I\'ve delivered similar work for ${userProfile.successMetrics?.completedProjects || '10+'}  clients with great results.`;
      case 'authority':
        return `Hello,\n\nI\'ve reviewed your requirements for ${title} in detail. With ${userProfile.experience || '5+'}  years of specialized experience and a ${userProfile.successMetrics?.proposalWinRate ? Math.round(userProfile.successMetrics.proposalWinRate * 100) + '%' : 'strong'} success rate, I\'m confident I can deliver exactly what you need.`;
      case 'partnership':
        return `Hi there,\n\nYour ${title} aligns perfectly with my core expertise. I\'d love to collaborate and bring my experience to complement your team\'s workflow.`;
      case 'empathy':
        return `Hi,\n\nI understand what you\'re looking for with ${title}, and I can help you get there efficiently. Let me show you how I\'d approach this.`;
      case 'personal':
      default:
        return `Hi,\n\nI read through your ${title} posting carefully and I\'m excited about the opportunity. Here\'s why I think we\'d work well together.`;
    }
  }

  generateRelevanceSection(job, userProfile, jobKeywords) {
    const skills = userProfile.skills || [];
    const matchedKeywords = jobKeywords.filter(kw =>
      skills.some(s => s.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(s.toLowerCase()))
    );

    let section = '**Why I\'m the right fit:**\n';
    if (matchedKeywords.length > 0) {
      section += `• Direct experience with ${matchedKeywords.slice(0, 4).join(', ')}\n`;
    }
    section += `• ${skills.slice(0, 3).join(', ')} specialist with hands-on project experience\n`;
    section += `• Track record of delivering similar work on time and within scope`;

    return section;
  }

  generateApproachSection(job, userProfile) {
    return `**My approach:**\n` +
      `1. **Discovery** — Quick review of your requirements and any existing codebase\n` +
      `2. **Planning** — Detailed roadmap with milestones and clear deliverables\n` +
      `3. **Development** — Iterative delivery with regular check-ins\n` +
      `4. **Testing & Delivery** — Thorough QA before each milestone\n` +
      `5. **Support** — Post-delivery support to ensure everything runs smoothly`;
  }

  generateCredibilitySection(userProfile) {
    const rate = userProfile.hourlyRate || userProfile.rate;
    let section = '**What you can expect:**\n';
    section += `• Clear, responsive communication throughout the project\n`;
    section += `• Milestone-based delivery so you see progress at every stage\n`;
    if (rate) {
      section += `• Transparent pricing at $${rate}/hr with detailed time tracking`;
    }
    return section;
  }

  generateCTA(archetype) {
    switch (archetype.tone) {
      case 'energetic':
        return 'I\'m available to start this week. Want to jump on a quick call to discuss the details? I can share some relevant examples from my portfolio.';
      case 'professional':
        return 'I\'m available for a brief consultation call at your convenience. I\'d be happy to walk you through my approach and relevant project examples.';
      case 'collaborative':
        return 'Would you like to set up a quick sync to discuss how I can integrate with your team\'s workflow? Happy to share relevant work samples.';
      default:
        return 'I\'d love to learn more about your project. When would be a good time for a quick chat? I can share some examples of similar work I\'ve done.';
    }
  }

  // ─── Analysis & Optimization ──────────────────────────────────────

  /**
   * Detect client type from job posting signals
   */
  detectClientType(job) {
    const text = ((job.description || '') + ' ' + (job.title || '') + ' ' + (job.clientType || '')).toLowerCase();

    const signals = {
      startup: 0,
      enterprise: 0,
      agency: 0,
      smb: 0,
      individual: 0
    };

    // Startup signals
    if (/\b(startup|saas|mvp|seed|series [a-d]|y combinator|yc|techstars|launch|disrupt)\b/.test(text)) signals.startup += 3;
    if (/\b(agile|sprint|iterate|growth|scale)\b/.test(text)) signals.startup += 1;

    // Enterprise signals
    if (/\b(enterprise|fortune|corporation|compliance|security|sla|governance)\b/.test(text)) signals.enterprise += 3;
    if (/\b(team of|department|stakeholder|integration|legacy)\b/.test(text)) signals.enterprise += 1;

    // Agency signals
    if (/\b(agency|client work|white[\s-]?label|subcontract|team)\b/.test(text)) signals.agency += 3;
    if (/\b(design|creative|brand|campaign|marketing)\b/.test(text)) signals.agency += 1;

    // SMB signals
    if (/\b(small business|local|shop|store|restaurant|service)\b/.test(text)) signals.smb += 3;
    if (/\b(simple|straightforward|basic|website|landing page)\b/.test(text)) signals.smb += 1;

    // Individual signals
    if (/\b(my project|personal|side project|hobby|I need|I want|I'm looking)\b/.test(text)) signals.individual += 3;
    if (/\b(blog|portfolio|resume)\b/.test(text)) signals.individual += 1;

    // Budget-based inference
    const budget = parseFloat(String(job.budget || '').replace(/[^0-9.]/g, '')) || 0;
    if (budget > 50000) signals.enterprise += 2;
    else if (budget > 10000) signals.startup += 1;
    else if (budget < 500) signals.individual += 2;

    // Find highest scoring type
    return Object.entries(signals).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Extract important keywords from job posting
   */
  extractJobKeywords(job) {
    const text = (job.description || '') + ' ' + (job.title || '');
    const keywords = new Set();

    // Explicit skills
    if (job.skills) {
      job.skills.forEach(s => keywords.add(s));
    }

    // Tech terms from description
    const techPattern = /\b(React|Angular|Vue|Next\.?js|Node\.?js|Python|Django|Flask|AWS|Docker|Kubernetes|GraphQL|REST|API|TypeScript|JavaScript|SQL|MongoDB|Redis|Firebase|Stripe|Shopify|WordPress|Figma|Flutter|Swift|Kotlin)\b/gi;
    const techMatches = text.match(techPattern) || [];
    techMatches.forEach(m => keywords.add(m));

    // Business terms
    const bizPattern = /\b(e-commerce|ecommerce|saas|crm|erp|dashboard|analytics|payment|authentication|real-time|mobile|responsive|seo|landing page)\b/gi;
    const bizMatches = text.match(bizPattern) || [];
    bizMatches.forEach(m => keywords.add(m));

    return [...keywords];
  }

  /**
   * Generate specific improvements for a proposal
   */
  generateImprovements(text, job, archetype, jobKeywords, currentScore) {
    const improvements = [];

    // Opening improvements
    if (currentScore.sections.opening.score < 70) {
      improvements.push({
        section: 'opening',
        type: 'rewrite',
        priority: 'high',
        suggestion: `Rewrite opening to use ${archetype.openingStyle} style. Lead with value, not self-introduction.`,
        example: this.generateOpening(job, archetype, {})
      });
    }

    // Keyword injection
    const textLower = text.toLowerCase();
    const missingKeywords = jobKeywords.filter(kw => !textLower.includes(kw.toLowerCase()));
    if (missingKeywords.length > 0) {
      improvements.push({
        section: 'relevance',
        type: 'keyword_injection',
        priority: 'high',
        suggestion: `Add these job-specific terms: ${missingKeywords.slice(0, 5).join(', ')}`,
        keywords: missingKeywords
      });
    }

    // Weak phrase detection
    for (const wp of this.WEAK_PHRASES) {
      if (wp.pattern.test(text)) {
        improvements.push({
          section: 'language',
          type: 'phrase_fix',
          priority: 'medium',
          suggestion: `Replace weak phrase — ${wp.reason}`,
          find: wp.pattern.source,
          replace: wp.replacement
        });
      }
    }

    // CTA improvements
    if (currentScore.sections.cta.score < 60) {
      improvements.push({
        section: 'cta',
        type: 'add',
        priority: 'high',
        suggestion: 'Add a clear call-to-action with availability and next step',
        example: this.generateCTA(archetype)
      });
    }

    // Length check
    const words = text.split(/\s+/).length;
    const idealRange = archetype.lengthPreference === 'concise' ? [150, 250]
      : archetype.lengthPreference === 'detailed' ? [300, 500]
      : [200, 350];

    if (words < idealRange[0]) {
      improvements.push({
        section: 'formatting',
        type: 'expand',
        priority: 'medium',
        suggestion: `Proposal too short (${words} words). Expand to ${idealRange[0]}-${idealRange[1]} words for ${archetype.tone} tone.`
      });
    } else if (words > idealRange[1]) {
      improvements.push({
        section: 'formatting',
        type: 'trim',
        priority: 'low',
        suggestion: `Proposal may be too long (${words} words). Trim to ${idealRange[1]} words max.`
      });
    }

    return improvements.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] || 9) - (p[b.priority] || 9);
    });
  }

  /**
   * Apply automatic fixes to proposal text
   */
  applyAutoFixes(text, improvements) {
    let fixed = text;

    // Apply weak phrase replacements
    for (const imp of improvements) {
      if (imp.type === 'phrase_fix' && imp.find && imp.replace !== undefined) {
        const regex = new RegExp(imp.find, 'gi');
        fixed = fixed.replace(regex, imp.replace).replace(/\s{2,}/g, ' ');
      }
    }

    return fixed.trim();
  }

  /**
   * Analyze win patterns from proposal history
   */
  analyzeWinPatterns(winHistory, currentJob) {
    if (!winHistory || !winHistory.proposals || winHistory.proposals.length < 3) {
      return null;
    }

    const wins = winHistory.proposals.filter(p => p.won);
    const losses = winHistory.proposals.filter(p => !p.won);

    if (wins.length === 0) return { winRate: 0, insights: ['No wins yet — focus on quality over quantity'] };

    // Analyze winning proposal characteristics
    const winLengths = wins.map(p => (p.text || '').split(/\s+/).length);
    const avgWinLength = Math.round(winLengths.reduce((a, b) => a + b, 0) / winLengths.length);

    // Common words in winning proposals
    const winWords = {};
    for (const w of wins) {
      const words = (w.text || '').toLowerCase().split(/\s+/);
      for (const word of words) {
        if (word.length > 4) winWords[word] = (winWords[word] || 0) + 1;
      }
    }
    const topWinWords = Object.entries(winWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    const insights = [];
    insights.push(`Your winning proposals average ${avgWinLength} words`);
    insights.push(`Win rate: ${Math.round(wins.length / winHistory.proposals.length * 100)}%`);
    if (topWinWords.length > 0) {
      insights.push(`Common winning words: ${topWinWords.slice(0, 5).join(', ')}`);
    }

    return {
      winRate: Math.round(wins.length / winHistory.proposals.length * 100),
      avgWinLength,
      topWinWords,
      insights,
      totalAnalyzed: winHistory.proposals.length
    };
  }

  /**
   * Generate an overall strategy recommendation
   */
  generateStrategy(job, archetype, currentScore, winInsights) {
    const strategy = [];

    strategy.push(`**Tone:** ${archetype.tone} — this client type responds best to ${archetype.openingStyle} openings`);

    if (winInsights && winInsights.avgWinLength) {
      strategy.push(`**Length:** Aim for ~${winInsights.avgWinLength} words based on your winning proposal patterns`);
    }

    if (currentScore.overall < 60) {
      strategy.push('**Priority:** Focus on relevance and opening — these have the highest impact on conversion');
    }

    strategy.push(`**Key words to include:** ${archetype.preferWords.slice(0, 3).join(', ')}`);
    strategy.push(`**Words to avoid:** ${archetype.avoidWords.slice(0, 3).join(', ')}`);

    return strategy;
  }

  scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    return 'D';
  }
}

module.exports = ProposalOptimizer;
