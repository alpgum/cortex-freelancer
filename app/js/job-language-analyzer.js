/**
 * [CF-028] Job Posting Language Analyzer
 * Detect job post language quality, urgency signals, budget negotiability hints.
 * Score clarity 1-10, flag vague requirements, detect rush job signals.
 *
 * window.CortexFreelancer.JobLanguageAnalyzer
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Pattern Dictionaries ───────────────────────────────────────────

  var URGENCY_PATTERNS = [
    { re: /\basap\b/i, label: 'ASAP mentioned', weight: 3 },
    { re: /\burgent(ly)?\b/i, label: 'Urgent request', weight: 3 },
    { re: /\bimmediately?\b/i, label: 'Immediate start', weight: 3 },
    { re: /\bright away\b/i, label: 'Right away', weight: 2 },
    { re: /\btoday\b/i, label: 'Today deadline', weight: 2 },
    { re: /\btomorrow\b/i, label: 'Tomorrow deadline', weight: 2 },
    { re: /\bthis week\b/i, label: 'This week deadline', weight: 2 },
    { re: /\brush\s*(job|project|order)?\b/i, label: 'Rush job', weight: 3 },
    { re: /\btight\s+deadline\b/i, label: 'Tight deadline', weight: 2 },
    { re: /\bstart\s+(now|today|immediately)\b/i, label: 'Start now', weight: 3 },
    { re: /\btime[\s-]*sensitive\b/i, label: 'Time-sensitive', weight: 2 },
    { re: /\bfast\s+turnaround\b/i, label: 'Fast turnaround', weight: 2 },
    { re: /\bby\s+(tonight|end\s+of\s+day|eod|tomorrow)\b/i, label: 'Short deadline', weight: 3 },
    { re: /\bwithin\s+\d+\s*hours?\b/i, label: 'Hours-based deadline', weight: 3 },
    { re: /\bovernight\b/i, label: 'Overnight delivery', weight: 2 }
  ];

  var BUDGET_FLEXIBLE_PATTERNS = [
    { re: /\bnegotiable\b/i, label: 'Budget negotiable', weight: 3 },
    { re: /\bflexible\s+(budget|rate|price)\b/i, label: 'Flexible budget', weight: 3 },
    { re: /\bopen\s+to\s+(discuss|negotiat)/i, label: 'Open to discussion', weight: 2 },
    { re: /\bbudget\s+is\s+(flexible|open)\b/i, label: 'Budget is flexible', weight: 3 },
    { re: /\bwilling\s+to\s+pay\s+more\b/i, label: 'Willing to pay more', weight: 3 },
    { re: /\brate\s+depends\b/i, label: 'Rate depends on quality', weight: 2 },
    { re: /\bfor\s+the\s+right\s+(person|candidate|freelancer)\b/i, label: 'Quality over price', weight: 2 },
    { re: /\bcompetitive\s+(rate|pay|compensation)\b/i, label: 'Competitive rate', weight: 1 },
    { re: /\bbonus\b/i, label: 'Bonus mentioned', weight: 1 }
  ];

  var BUDGET_FIXED_PATTERNS = [
    { re: /\bfixed\s+(budget|price|rate)\b/i, label: 'Fixed budget', weight: 3 },
    { re: /\bnon[\s-]*negotiable\b/i, label: 'Non-negotiable', weight: 3 },
    { re: /\bstrict\s+budget\b/i, label: 'Strict budget', weight: 3 },
    { re: /\bmax(imum)?\s+(budget|rate)\b/i, label: 'Maximum budget stated', weight: 2 },
    { re: /\bcannot\s+exceed\b/i, label: 'Cannot exceed', weight: 2 },
    { re: /\bno\s+more\s+than\b/i, label: 'Capped budget', weight: 2 },
    { re: /\blow[\s-]*budget\b/i, label: 'Low budget', weight: 1 },
    { re: /\bcheap(est|ly)?\b/i, label: 'Seeking cheapest option', weight: 2 }
  ];

  var VAGUE_PATTERNS = [
    { re: /\bvarious\s+tasks\b/i, label: 'Vague: "various tasks"' },
    { re: /\betc\.?\b/i, label: 'Open-ended scope ("etc")' },
    { re: /\band\s+more\b/i, label: 'Open-ended scope ("and more")' },
    { re: /\bas\s+needed\b/i, label: 'Undefined scope ("as needed")' },
    { re: /\bwhatever\s+(is\s+)?needed\b/i, label: 'Undefined scope' },
    { re: /\btbd\b/i, label: 'Requirements TBD' },
    { re: /\bto\s+be\s+determined\b/i, label: 'To be determined' },
    { re: /\bwe'?ll\s+(figure|decide|determine)\b/i, label: 'Requirements undecided' },
    { re: /\bsimple\s+(job|task|project)\b/i, label: 'Vague: "simple" without detail' },
    { re: /\beasy\s+(job|task|project|work)\b/i, label: 'Vague: "easy" without detail' },
    { re: /\bquick\s+(job|task|fix)\b/i, label: 'Vague: "quick" without specifics' },
    { re: /\bsome(thing)?\s+like\b/i, label: 'Imprecise requirements' },
    { re: /\bbasically\b/i, label: 'Hand-wavy language ("basically")' },
    { re: /\bpretty\s+(simple|easy|straightforward)\b/i, label: 'Assumed simplicity' }
  ];

  var RED_FLAG_PATTERNS = [
    { re: /\b(free|unpaid)\s+(trial|test|sample|work)\b/i, label: 'Unpaid work request', severity: 'high' },
    { re: /\bwork\s+for\s+free\b/i, label: 'Work for free', severity: 'high' },
    { re: /\bequity\s+only\b|\bfor\s+equity\b/i, label: 'Equity-only compensation', severity: 'high' },
    { re: /\bexposure\b.*\b(pay|compensation)\b/i, label: 'Paid in exposure', severity: 'high' },
    { re: /\bspec\s+work\b/i, label: 'Spec work', severity: 'high' },
    { re: /\btest\s+task\b.*\b(unpaid|free)\b/i, label: 'Unpaid test task', severity: 'high' },
    { re: /\b(build|create|develop)\b.*\b(like|similar\s+to|clone)\b.*\b(uber|airbnb|facebook|amazon|netflix|instagram)\b/i, label: 'Clone a major platform', severity: 'high' },
    { re: /\b24\s*\/\s*7\b|\bround[\s-]*the[\s-]*clock\b/i, label: '24/7 availability expected', severity: 'medium' },
    { re: /\balways[\s-]*available\b/i, label: 'Always available expected', severity: 'medium' },
    { re: /\bnda\s+(before|required|first)\b/i, label: 'NDA before details', severity: 'low' },
    { re: /\bmultiple\s+(revisions|rounds)\s*(unlimited|no\s+limit)/i, label: 'Unlimited revisions', severity: 'medium' },
    { re: /\bguarantee\s+(results|success|sales|revenue)\b/i, label: 'Guaranteed results expected', severity: 'medium' },
    { re: /\b(must|need)\s+\d{3,}\s+hours?\b/i, label: 'Extremely large scope', severity: 'low' }
  ];

  var POSITIVE_INDICATORS = [
    { re: /\blong[\s-]*term\b/i, label: 'Long-term opportunity' },
    { re: /\bongoing\s+(work|collaboration|partnership)\b/i, label: 'Ongoing work' },
    { re: /\bgreat\s+team\b/i, label: 'Good team culture' },
    { re: /\bcompetitive\s+(rate|pay|salary)\b/i, label: 'Competitive pay' },
    { re: /\bbonus\b/i, label: 'Bonus offered' },
    { re: /\bgrowth\s+opportunit/i, label: 'Growth opportunity' },
    { re: /\brespect(ful|s)?\s+(your|freelancer)\b/i, label: 'Respectful tone' },
    { re: /\bwork[\s-]*life\s+balance\b/i, label: 'Work-life balance' },
    { re: /\bflexible\s+(hours|schedule)\b/i, label: 'Flexible schedule' }
  ];

  var NEGATIVE_INDICATORS = [
    { re: /\bcheap(est|ly)?\b/i, label: 'Seeking cheapest option' },
    { re: /\blow(est)?\s+bid(der)?\b/i, label: 'Lowest bidder mentality' },
    { re: /\bdon'?t\s+waste\s+my\s+time\b/i, label: 'Hostile tone' },
    { re: /\bno\s+excuses\b/i, label: 'Demanding language' },
    { re: /\bmust\s+be\s+perfect\b/i, label: 'Perfectionism demand' },
    { re: /\bfailure\s+is\s+not\s+an?\s+option\b/i, label: 'Unrealistic expectations' },
    { re: /\bdo\s+not\s+apply\s+if\b/i, label: 'Gatekeeping language' },
    { re: /\b(serious|real)\s+(freelancers?|applicants?)\s+only\b/i, label: 'Condescending tone' }
  ];

  // ─── Helpers ──────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function splitSentences(text) {
    return text.split(/(?<=[.!?])\s+/).filter(function (s) { return s.trim().length > 0; });
  }

  function countSyllables(text) {
    var words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    var total = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w || w.length <= 2) { total += 1; continue; }
      w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
      var matches = w.match(/[aeiouy]{1,2}/g);
      total += matches ? Math.max(matches.length, 1) : 1;
    }
    return total;
  }

  function matchPatterns(text, patterns) {
    var results = [];
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i].re);
      if (m) results.push({ label: patterns[i].label, match: m[0] });
    }
    return results;
  }

  function matchPatternsWeighted(text, patterns) {
    var results = [];
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i].re);
      if (m) results.push({ label: patterns[i].label, match: m[0], weight: patterns[i].weight });
    }
    return results;
  }

  function scoreColor(score) {
    if (score >= 8) return '#22c55e';
    if (score >= 6.5) return '#84cc16';
    if (score >= 5) return '#eab308';
    if (score >= 3.5) return '#f97316';
    return '#ef4444';
  }

  // ─── Score Clarity (1-10) ─────────────────────────────────────────

  function scoreClarity(text) {
    if (!text || !text.trim()) return { score: 1, breakdown: {}, details: ['No text provided'] };

    var clean = text.trim();
    var words = clean.split(/\s+/);
    var wordCount = words.length;
    var sentences = splitSentences(clean);
    var sentenceCount = Math.max(sentences.length, 1);
    var details = [];
    var points = 0;

    // Length (0-2 pts)
    var lengthScore = 0;
    if (wordCount >= 100 && wordCount <= 800) { lengthScore = 2; details.push('Good description length'); }
    else if (wordCount >= 50) { lengthScore = 1.5; details.push('Adequate length'); }
    else if (wordCount >= 20) { lengthScore = 0.5; details.push('Short description'); }
    else { lengthScore = 0; details.push('Very short description (' + wordCount + ' words)'); }
    points += lengthScore;

    // Structure (0-2 pts)
    var structureScore = 0;
    var paragraphs = clean.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; }).length;
    var hasBullets = /[-\u2022*]\s|^\d+[.)]\s/m.test(clean);
    var hasHeadings = /^#+\s|^[A-Z][A-Z\s]{3,}$/m.test(clean);
    if (paragraphs >= 3) { structureScore += 1; details.push('Well-structured with paragraphs'); }
    else if (paragraphs >= 2) structureScore += 0.5;
    if (hasBullets) { structureScore += 0.5; details.push('Uses bullet points'); }
    if (hasHeadings) { structureScore += 0.5; details.push('Has section headings'); }
    structureScore = Math.min(structureScore, 2);
    points += structureScore;

    // Specificity (0-2 pts)
    var specificityScore = 0;
    if (/\d+/.test(clean)) { specificityScore += 0.5; details.push('Contains specific numbers'); }
    if (/\b(react|angular|vue|node|python|java|php|ruby|swift|kotlin|aws|docker)\b/i.test(clean)) {
      specificityScore += 0.5; details.push('Names specific technologies');
    }
    if (/\b(deliver|milestone|deadline|timeline|phase|scope|output)\b/i.test(clean)) {
      specificityScore += 0.5; details.push('Defines deliverables');
    }
    if (/\b(require|must\s+have|should\s+have|need|essential|mandatory)\b/i.test(clean)) {
      specificityScore += 0.5; details.push('States requirements');
    }
    specificityScore = Math.min(specificityScore, 2);
    points += specificityScore;

    // Criteria (0-1 pt)
    var criteriaScore = 0;
    if (/\b(experience|expertise|skill|proficient|knowledge)\b/i.test(clean)) {
      criteriaScore += 0.5; details.push('Mentions skill needs');
    }
    if (/\b\d+\+?\s*(years?|yrs?)\b/i.test(clean)) {
      criteriaScore += 0.5; details.push('Specifies experience level');
    }
    points += Math.min(criteriaScore, 1);

    // Communication quality (0-1.5 pts)
    var commScore = 0;
    var avgSentLen = wordCount / sentenceCount;
    if (avgSentLen >= 8 && avgSentLen <= 25) { commScore += 0.5; details.push('Good sentence length'); }
    if (!/[!?]{3,}/.test(clean)) commScore += 0.5;
    else details.push('Excessive punctuation');
    var capsRatio = (clean.match(/[A-Z]/g) || []).length / Math.max(clean.length, 1);
    if (capsRatio <= 0.3 || clean.length < 50) commScore += 0.5;
    else details.push('Excessive capitalization');
    commScore = Math.max(0, Math.min(commScore, 1.5));
    points += commScore;

    // Vagueness penalty
    var vagueMatches = matchPatterns(clean, VAGUE_PATTERNS);
    if (vagueMatches.length >= 3) { points -= 1; details.push('Multiple vague statements'); }
    else if (vagueMatches.length >= 1) { points -= 0.5; details.push('Some vague language'); }

    var score = Math.round(Math.max(1, Math.min(10, points)) * 10) / 10;

    return {
      score: score,
      breakdown: { length: lengthScore, structure: structureScore, specificity: specificityScore, criteria: criteriaScore, communication: commScore },
      details: details
    };
  }

  // ─── Urgency Detection ────────────────────────────────────────────

  function detectUrgencySignals(text) {
    if (!text || !text.trim()) return { signals: [], urgencyLevel: 'none', urgencyScore: 0 };

    var matches = matchPatternsWeighted(text, URGENCY_PATTERNS);
    var totalWeight = 0;
    for (var i = 0; i < matches.length; i++) totalWeight += matches[i].weight;

    var urgencyScore = Math.min(100, Math.round((totalWeight / 15) * 100));
    var urgencyLevel;
    if (urgencyScore >= 60) urgencyLevel = 'critical';
    else if (urgencyScore >= 40) urgencyLevel = 'high';
    else if (urgencyScore >= 20) urgencyLevel = 'moderate';
    else if (urgencyScore > 0) urgencyLevel = 'low';
    else urgencyLevel = 'none';

    return { signals: matches, urgencyLevel: urgencyLevel, urgencyScore: urgencyScore };
  }

  // ─── Budget Negotiability ─────────────────────────────────────────

  function detectBudgetNegotiability(text) {
    if (!text || !text.trim()) return { flexibility: 'unknown', flexibleSignals: [], fixedSignals: [], score: 0 };

    var flexibleMatches = matchPatternsWeighted(text, BUDGET_FLEXIBLE_PATTERNS);
    var fixedMatches = matchPatternsWeighted(text, BUDGET_FIXED_PATTERNS);

    var flexWeight = 0, fixedWeight = 0;
    for (var i = 0; i < flexibleMatches.length; i++) flexWeight += flexibleMatches[i].weight;
    for (var j = 0; j < fixedMatches.length; j++) fixedWeight += fixedMatches[j].weight;

    var score = 0;
    if (flexWeight + fixedWeight > 0) {
      score = Math.round(((flexWeight - fixedWeight) / Math.max(flexWeight + fixedWeight, 1)) * 100);
    }

    var flexibility;
    if (score >= 40) flexibility = 'very_flexible';
    else if (score >= 15) flexibility = 'flexible';
    else if (score <= -40) flexibility = 'rigid';
    else if (score <= -15) flexibility = 'fixed';
    else if (flexWeight === 0 && fixedWeight === 0) flexibility = 'unknown';
    else flexibility = 'neutral';

    return { flexibility: flexibility, flexibleSignals: flexibleMatches, fixedSignals: fixedMatches, score: score };
  }

  // ─── Vague Requirements ───────────────────────────────────────────

  function flagVagueRequirements(text) {
    if (!text || !text.trim()) return { flags: [{ label: 'No description provided' }], vagueCount: 1, severity: 'high' };

    var flags = matchPatterns(text, VAGUE_PATTERNS);
    var wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 20) flags.push({ label: 'Extremely short description (' + wordCount + ' words)' });

    if (wordCount > 100) {
      var paragraphs = text.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; }).length;
      if (paragraphs <= 1 && !/[-\u2022*]\s/m.test(text)) {
        flags.push({ label: 'Long post with no structure (wall of text)' });
      }
    }

    if (!/\b(deliver|build|create|design|develop|implement|fix|update|write|set\s+up)\b/i.test(text)) {
      flags.push({ label: 'No clear action verbs or deliverables' });
    }

    var severity;
    if (flags.length >= 4) severity = 'high';
    else if (flags.length >= 2) severity = 'medium';
    else if (flags.length >= 1) severity = 'low';
    else severity = 'none';

    return { flags: flags, vagueCount: flags.length, severity: severity };
  }

  // ─── Language Quality ─────────────────────────────────────────────

  function analyzeLanguageQuality(text) {
    if (!text || !text.trim()) {
      return {
        readability: { score: 0, level: 'N/A', fleschScore: 0, avgWordsPerSentence: 0, avgSyllablesPerWord: 0 },
        professionalism: { score: 0, level: 'N/A', issues: [] },
        grammar: { score: 0, issues: [] },
        wordCount: 0, sentenceCount: 0
      };
    }

    var clean = text.trim();
    var words = clean.split(/\s+/);
    var wordCount = words.length;
    var sentences = splitSentences(clean);
    var sentenceCount = Math.max(sentences.length, 1);
    var syllableCount = countSyllables(clean);

    // Flesch Reading Ease
    var avgWPS = wordCount / sentenceCount;
    var avgSPW = syllableCount / Math.max(wordCount, 1);
    var fleschScore = Math.max(0, Math.min(100, Math.round(206.835 - (1.015 * avgWPS) - (84.6 * avgSPW))));

    var readabilityLevel;
    if (fleschScore >= 80) readabilityLevel = 'Very Easy';
    else if (fleschScore >= 60) readabilityLevel = 'Easy';
    else if (fleschScore >= 40) readabilityLevel = 'Moderate';
    else if (fleschScore >= 20) readabilityLevel = 'Difficult';
    else readabilityLevel = 'Very Difficult';

    var readabilityScore = Math.max(1, Math.min(10, Math.round((fleschScore / 100) * 10)));

    // Professionalism
    var profIssues = [];
    var profPoints = 10;
    if (/[!]{2,}/.test(clean)) { profIssues.push('Multiple exclamation marks'); profPoints -= 1; }
    if (/\b(lol|lmao|omg|wtf|smh|tbh|imo)\b/i.test(clean)) { profIssues.push('Informal abbreviations'); profPoints -= 1.5; }
    if (/[A-Z]{5,}/.test(clean) && !/\b(API|HTML|CSS|JSON|REST|SQL|AWS|SDK|URL|PDF)\b/.test(clean)) { profIssues.push('Excessive caps lock'); profPoints -= 1; }
    if (/\b(gonna|wanna|gotta|ain'?t|dunno|kinda|sorta)\b/i.test(clean)) { profIssues.push('Informal contractions'); profPoints -= 1; }
    if (/\$\$\$|\bca\$h\b|\bmoney\b.*\b(fast|quick|easy)\b/i.test(clean)) { profIssues.push('Spammy language'); profPoints -= 2; }
    profPoints = Math.max(1, Math.min(10, Math.round(profPoints)));

    var profLevel;
    if (profPoints >= 9) profLevel = 'Professional';
    else if (profPoints >= 7) profLevel = 'Good';
    else if (profPoints >= 5) profLevel = 'Casual';
    else profLevel = 'Unprofessional';

    // Grammar
    var grammarIssues = [];
    var grammarPoints = 10;
    if (/\bi\s+[a-z]/g.test(clean)) { grammarIssues.push('Lowercase "i" as pronoun'); grammarPoints -= 1; }
    if (/\s{2,}/.test(clean.replace(/\n/g, ''))) { grammarIssues.push('Multiple consecutive spaces'); grammarPoints -= 0.5; }
    if (/\b(alot)\b/i.test(clean)) { grammarIssues.push('"Alot" should be "a lot"'); grammarPoints -= 0.5; }
    if (/\b(definately|seperate|occured|recieve|wierd|accomodate)\b/i.test(clean)) { grammarIssues.push('Common misspellings'); grammarPoints -= 1; }
    grammarPoints = Math.max(1, Math.min(10, Math.round(grammarPoints)));

    return {
      readability: { score: readabilityScore, level: readabilityLevel, fleschScore: fleschScore, avgWordsPerSentence: Math.round(avgWPS * 10) / 10, avgSyllablesPerWord: Math.round(avgSPW * 100) / 100 },
      professionalism: { score: profPoints, level: profLevel, issues: profIssues },
      grammar: { score: grammarPoints, issues: grammarIssues },
      wordCount: wordCount, sentenceCount: sentenceCount
    };
  }

  // ─── Red Flags ────────────────────────────────────────────────────

  function detectRedFlags(text) {
    if (!text || !text.trim()) return { flags: [], riskScore: 0, riskLevel: 'none' };

    var flags = [];
    for (var i = 0; i < RED_FLAG_PATTERNS.length; i++) {
      var p = RED_FLAG_PATTERNS[i];
      if (p.re.test(text)) {
        var match = text.match(p.re);
        flags.push({ label: p.label, severity: p.severity, match: match ? match[0] : '' });
      }
    }

    var severityScores = { high: 3, medium: 2, low: 1 };
    var totalSeverity = 0;
    for (var j = 0; j < flags.length; j++) totalSeverity += severityScores[flags[j].severity] || 1;

    var riskScore = Math.min(100, Math.round((totalSeverity / (RED_FLAG_PATTERNS.length * 3)) * 100 * 3));
    var riskLevel;
    if (riskScore >= 60) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';
    else if (riskScore > 0) riskLevel = 'low';
    else riskLevel = 'none';

    return { flags: flags, riskScore: riskScore, riskLevel: riskLevel };
  }

  // ─── Sentiment Indicators ─────────────────────────────────────────

  function getSentimentIndicators(text) {
    if (!text || !text.trim()) return { positive: [], negative: [], sentiment: 'neutral', score: 0 };

    var positive = matchPatterns(text, POSITIVE_INDICATORS);
    var negative = matchPatterns(text, NEGATIVE_INDICATORS);
    var total = positive.length + negative.length;
    var score = total > 0 ? Math.round(((positive.length - negative.length) / total) * 100) : 0;

    var sentiment;
    if (score >= 40) sentiment = 'very_positive';
    else if (score >= 15) sentiment = 'positive';
    else if (score <= -40) sentiment = 'very_negative';
    else if (score <= -15) sentiment = 'negative';
    else sentiment = 'neutral';

    return { positive: positive, negative: negative, sentiment: sentiment, score: score };
  }

  // ─── Main Analysis ────────────────────────────────────────────────

  function analyzeJobPosting(text) {
    var safeText = (text || '').trim();
    var clarity = scoreClarity(safeText);
    var urgency = detectUrgencySignals(safeText);
    var budget = detectBudgetNegotiability(safeText);
    var vague = flagVagueRequirements(safeText);
    var language = analyzeLanguageQuality(safeText);
    var redFlags = detectRedFlags(safeText);
    var sentiment = getSentimentIndicators(safeText);

    var overallScore = Math.round(
      (clarity.score * 0.3 +
       language.readability.score * 0.15 +
       language.professionalism.score * 0.15 +
       language.grammar.score * 0.1 +
       (10 - Math.min(10, redFlags.riskScore / 10)) * 0.15 +
       (10 - Math.min(10, urgency.urgencyScore / 10)) * 0.05 +
       Math.max(1, (sentiment.score + 100) / 20) * 0.1
      ) * 10
    ) / 10;
    overallScore = Math.max(1, Math.min(10, overallScore));

    var recommendation;
    if (overallScore >= 8) recommendation = 'Excellent posting — well-written, clear scope, low risk.';
    else if (overallScore >= 6.5) recommendation = 'Good posting — mostly clear with minor concerns.';
    else if (overallScore >= 5) recommendation = 'Average posting — some vagueness or concerns to clarify before applying.';
    else if (overallScore >= 3.5) recommendation = 'Below average — significant vagueness or red flags. Proceed with caution.';
    else recommendation = 'Poor quality posting — multiple red flags or very unclear. Consider skipping.';

    return {
      overallScore: overallScore, recommendation: recommendation,
      clarity: clarity, urgency: urgency, budgetNegotiability: budget,
      vagueRequirements: vague, languageQuality: language, redFlags: redFlags, sentiment: sentiment,
      meta: { wordCount: language.wordCount, sentenceCount: language.sentenceCount, analyzedAt: new Date().toISOString() }
    };
  }

  // ─── Render ───────────────────────────────────────────────────────

  function renderAnalysis(containerId, analysis) {
    var container = document.getElementById(containerId);
    if (!container) return '';

    var a = analysis;
    var overallColor = scoreColor(a.overallScore);
    var h = '<div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:12px;padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:640px;">';

    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">';
    h += '<span style="font-size:16px;font-weight:700;">Language Analysis</span>';
    h += '<span style="background:' + overallColor + '18;color:' + overallColor + ';padding:5px 12px;border-radius:8px;font-size:14px;font-weight:700;">' + a.overallScore.toFixed(1) + '/10</span>';
    h += '</div>';

    h += '<div style="color:#999;font-size:13px;margin-bottom:16px;line-height:1.5;">' + escapeHtml(a.recommendation) + '</div>';

    var bars = [
      { label: 'Clarity', score: a.clarity.score, max: 10 },
      { label: 'Readability', score: a.languageQuality.readability.score, max: 10 },
      { label: 'Professionalism', score: a.languageQuality.professionalism.score, max: 10 },
      { label: 'Grammar', score: a.languageQuality.grammar.score, max: 10 }
    ];

    for (var b = 0; b < bars.length; b++) {
      var bar = bars[b];
      var pct = (bar.score / bar.max) * 100;
      var barColor = scoreColor(bar.score);
      h += '<div style="margin-bottom:10px;">';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">';
      h += '<span style="color:#888;">' + bar.label + '</span>';
      h += '<span style="color:' + barColor + ';font-weight:600;">' + bar.score + '/' + bar.max + '</span>';
      h += '</div>';
      h += '<div style="background:#1a1a1a;border-radius:4px;height:6px;overflow:hidden;">';
      h += '<div style="background:' + barColor + ';height:100%;width:' + pct + '%;border-radius:4px;"></div>';
      h += '</div></div>';
    }

    // Urgency
    if (a.urgency.signals.length > 0) {
      var urgColor = a.urgency.urgencyLevel === 'critical' ? '#ef4444' : '#f97316';
      h += '<div style="margin-top:14px;"><span style="color:#ccc;font-size:13px;font-weight:600;">Urgency Signals</span> ';
      h += '<span style="background:' + urgColor + '18;color:' + urgColor + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">' + escapeHtml(a.urgency.urgencyLevel.toUpperCase()) + '</span>';
      for (var u = 0; u < a.urgency.signals.length; u++) {
        h += '<div style="color:#888;font-size:12px;padding-left:10px;border-left:2px solid #222;margin-top:4px;">' + escapeHtml(a.urgency.signals[u].label) + '</div>';
      }
      h += '</div>';
    }

    // Red flags
    if (a.redFlags.flags.length > 0) {
      h += '<div style="margin-top:14px;"><span style="color:#ccc;font-size:13px;font-weight:600;">Red Flags</span> ';
      h += '<span style="background:#ef444418;color:#ef4444;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">RISK ' + a.redFlags.riskScore + '/100</span>';
      for (var r = 0; r < a.redFlags.flags.length; r++) {
        h += '<div style="color:#888;font-size:12px;padding-left:10px;border-left:2px solid #222;margin-top:4px;">' + escapeHtml(a.redFlags.flags[r].label) + '</div>';
      }
      h += '</div>';
    }

    h += '</div>';
    container.innerHTML = h;
    return h;
  }

  // ─── Public API ───────────────────────────────────────────────────

  // ─── State ──────────────────────────────────────────────────────

  var _container = null;
  var _currentAnalysis = null;
  var _initialized = false;

  /** @returns {void} */
  function init() {
    if (_initialized) return;
    _initialized = true;
  }

  /**
   * Render the analyzer UI into a container element.
   * @param {HTMLElement|string} container - DOM element or selector
   * @param {Object} [options] - { text: string } pre-fill text to analyze
   */
  function render(container) {
    init();
    var el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return;
    _container = el;

    var h = '<div style="background:#0a0a0a;border:1px solid #1e1e1e;border-radius:12px;padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:640px;">';
    h += '<div style="font-size:16px;font-weight:700;margin-bottom:14px;">Job Language Analyzer</div>';
    h += '<textarea id="cf-jla-input" placeholder="Paste a job description to analyze..." style="width:100%;min-height:120px;background:#111;border:1px solid #222;border-radius:8px;color:#e0e0e0;padding:10px 12px;font-size:13px;resize:vertical;box-sizing:border-box;outline:none;font-family:inherit;"></textarea>';
    h += '<button id="cf-jla-btn" style="margin-top:10px;background:#7c3aed;color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;cursor:pointer;">Analyze</button>';
    h += '<div id="cf-jla-results" style="margin-top:16px;"></div>';
    h += '</div>';

    el.innerHTML = h;

    var btn = el.querySelector('#cf-jla-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var input = el.querySelector('#cf-jla-input');
        if (!input || !input.value.trim()) return;
        _currentAnalysis = analyzeJobPosting(input.value);
        renderAnalysis('cf-jla-results', _currentAnalysis);
      });
    }
  }

  /** @returns {void} */
  function destroy() {
    if (_container) {
      _container.innerHTML = '';
      _container = null;
    }
    _currentAnalysis = null;
    _initialized = false;
  }

  CF.JobLanguageAnalyzer = {
    init: init,
    render: render,
    destroy: destroy,
    analyzeJobPosting: analyzeJobPosting,
    scoreClarity: scoreClarity,
    detectUrgencySignals: detectUrgencySignals,
    detectBudgetNegotiability: detectBudgetNegotiability,
    flagVagueRequirements: flagVagueRequirements,
    analyzeLanguageQuality: analyzeLanguageQuality,
    detectRedFlags: detectRedFlags,
    getSentimentIndicators: getSentimentIndicators,
    renderAnalysis: renderAnalysis,
    version: '1.0.0'
  };

})();
