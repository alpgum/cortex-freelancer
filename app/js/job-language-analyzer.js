/**
 * [CF-028] Job Posting Language Analyzer
 * Detect job post language quality, urgency signals, budget negotiability hints.
 * Score clarity 1-10, flag vague requirements, detect rush job signals.
 *
 * v2.0.0 — Added tone formality detection, keyword density analysis,
 *           scope complexity estimator, client experience signals.
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

  // ─── Tone Formality Patterns (v2.0.0) ─────────────────────────────

  var FORMAL_PATTERNS = [
    { re: /\bwe\s+are\s+seeking\b/i, label: '"We are seeking"' },
    { re: /\bthe\s+ideal\s+candidate\b/i, label: '"The ideal candidate"' },
    { re: /\bqualifications\s+include\b/i, label: '"Qualifications include"' },
    { re: /\bresponsibilities\s+encompass\b/i, label: '"Responsibilities encompass"' },
    { re: /\bcompensation\s+package\b/i, label: '"Compensation package"' },
    { re: /\bhereby\b/i, label: 'Formal language ("hereby")' },
    { re: /\bpursuant\s+to\b/i, label: 'Legal language ("pursuant to")' },
    { re: /\bin\s+accordance\s+with\b/i, label: 'Formal phrasing ("in accordance with")' },
    { re: /\bthe\s+successful\s+(candidate|applicant)\b/i, label: '"The successful candidate"' },
    { re: /\bprior\s+experience\b/i, label: '"Prior experience"' },
    { re: /\bdemonstrated\s+(ability|experience|expertise)\b/i, label: '"Demonstrated ability"' },
    { re: /\bproficiency\s+in\b/i, label: '"Proficiency in"' },
    { re: /\bcommensurate\s+with\b/i, label: '"Commensurate with"' },
    { re: /\brequisite\b/i, label: 'Formal vocabulary ("requisite")' },
    { re: /\bpertaining\s+to\b/i, label: 'Formal phrasing ("pertaining to")' },
    { re: /\bshall\s+be\b/i, label: 'Formal obligation ("shall be")' },
    { re: /\bis\s+required\s+to\b/i, label: 'Formal requirement language' },
    { re: /\bscope\s+of\s+work\b/i, label: '"Scope of work"' }
  ];

  var INFORMAL_PATTERNS = [
    { re: /\bhey\b/i, label: 'Casual greeting ("Hey")' },
    { re: /\bwe\s+need\s+someone\b/i, label: '"We need someone"' },
    { re: /\byou'?ll\s+love\s+this\b/i, label: '"You\'ll love this"' },
    { re: /\bcool\s+project\b/i, label: '"Cool project"' },
    { re: /\bchill\s+team\b/i, label: '"Chill team"' },
    { re: /\bawesome\b/i, label: 'Slang ("awesome")' },
    { re: /\bsuper\s+(easy|fun|cool|exciting)\b/i, label: 'Casual intensifier ("super ...")' },
    { re: /\brocky?star\b/i, label: 'Slang ("rockstar")' },
    { re: /\bninja\b/i, label: 'Slang ("ninja")' },
    { re: /\bguru\b/i, label: 'Slang ("guru")' },
    { re: /\bhustl(e|er|ing)\b/i, label: 'Slang ("hustle")' },
    { re: /\bcrushing\s+it\b/i, label: 'Slang ("crushing it")' },
    { re: /\bkiller\s+(app|feature|product)\b/i, label: 'Slang ("killer ...")' },
    { re: /\bvibes?\b/i, label: 'Slang ("vibe/vibes")' },
    { re: /\bdope\b/i, label: 'Slang ("dope")' },
    { re: /\blit\b/i, label: 'Slang ("lit")' },
    { re: /\bbro\b/i, label: 'Slang ("bro")' },
    { re: /\bfam\b/i, label: 'Slang ("fam")' },
    { re: /\byo\b/i, label: 'Casual greeting ("yo")' },
    { re: /\bwhat'?s\s+up\b/i, label: 'Casual greeting ("what\'s up")' },
    { re: /\blmk\b/i, label: 'Abbreviation ("lmk")' },
    { re: /\bhmu\b/i, label: 'Abbreviation ("hmu")' },
    { re: /\btbh\b/i, label: 'Abbreviation ("tbh")' }
  ];

  // ─── Scope Complexity Patterns (v2.0.0) ────────────────────────────

  var TECHNOLOGY_PATTERNS = [
    /\breact\b/i, /\bangular\b/i, /\bvue\b/i, /\bnode\.?js\b/i, /\bexpress\b/i,
    /\bpython\b/i, /\bdjango\b/i, /\bflask\b/i, /\bjava\b/i, /\bspring\b/i,
    /\bphp\b/i, /\blaravel\b/i, /\bruby\b/i, /\brails\b/i, /\bswift\b/i,
    /\bkotlin\b/i, /\btypescript\b/i, /\bjavascript\b/i, /\bhtml\b/i, /\bcss\b/i,
    /\bsass\b/i, /\bless\b/i, /\btailwind\b/i, /\bbootstrap\b/i,
    /\baws\b/i, /\bazure\b/i, /\bgcp\b/i, /\bgoogle\s+cloud\b/i,
    /\bdocker\b/i, /\bkubernetes\b/i, /\bterraform\b/i, /\bjenkins\b/i,
    /\bmongodb\b/i, /\bpostgresql?\b/i, /\bmysql\b/i, /\bredis\b/i,
    /\belasticsearch\b/i, /\bgraphql\b/i, /\brest\s*api\b/i, /\bgrpc\b/i,
    /\bnext\.?js\b/i, /\bnuxt\b/i, /\bgatsby\b/i, /\bsvelte\b/i,
    /\bflutter\b/i, /\breact\s*native\b/i, /\bfigma\b/i, /\bsketch\b/i,
    /\bwordpress\b/i, /\bshopify\b/i, /\bmagento\b/i, /\bstripe\b/i,
    /\bfirebase\b/i, /\bsupabase\b/i, /\bc#\b/i, /\b\.net\b/i,
    /\bgo(lang)?\b/i, /\brust\b/i, /\bsolidity\b/i, /\bblockchain\b/i
  ];

  var DELIVERABLE_PATTERNS = [
    /\b(landing\s+page|homepage|web\s*page)\b/i,
    /\b(mobile\s+app|ios\s+app|android\s+app)\b/i,
    /\b(web\s+app|web\s+application|dashboard)\b/i,
    /\b(api|backend|server)\b/i,
    /\b(database|schema|data\s+model)\b/i,
    /\b(design|mockup|wireframe|prototype)\b/i,
    /\b(logo|branding|brand\s+identity)\b/i,
    /\b(documentation|user\s+guide|manual)\b/i,
    /\b(testing|test\s+suite|unit\s+tests)\b/i,
    /\b(deployment|ci\s*\/?\s*cd|pipeline)\b/i,
    /\b(plugin|extension|widget)\b/i,
    /\b(migration|integration|connector)\b/i,
    /\b(report|analytics|monitoring)\b/i,
    /\b(email\s+template|newsletter)\b/i,
    /\b(payment\s+system|checkout)\b/i,
    /\b(authentication|login\s+system|auth)\b/i,
    /\b(admin\s+panel|cms)\b/i,
    /\b(search\s+functionality|search\s+engine)\b/i
  ];

  var TIMELINE_PATTERNS = [
    { re: /\b(\d+)\s*days?\b/i, label: 'Days-based timeline' },
    { re: /\b(\d+)\s*weeks?\b/i, label: 'Weeks-based timeline' },
    { re: /\b(\d+)\s*months?\b/i, label: 'Months-based timeline' },
    { re: /\bphase\s*\d/i, label: 'Multi-phase project' },
    { re: /\bsprint/i, label: 'Sprint-based timeline' },
    { re: /\bmilestone/i, label: 'Milestone-based timeline' },
    { re: /\bquarter\b/i, label: 'Quarter-based timeline' },
    { re: /\bdeadline\b/i, label: 'Has deadline' }
  ];

  var TEAM_SIZE_PATTERNS = [
    { re: /\bteam\s+of\s+(\d+)/i, label: 'Team size mentioned' },
    { re: /\b(\d+)\s*(developers?|designers?|engineers?|members?)\b/i, label: 'Team members mentioned' },
    { re: /\bcross[\s-]*functional\b/i, label: 'Cross-functional team' },
    { re: /\bmultiple\s+(teams?|departments?)\b/i, label: 'Multiple teams involved' },
    { re: /\bstakeholders?\b/i, label: 'Stakeholder involvement' }
  ];

  // ─── Client Experience Patterns (v2.0.0) ───────────────────────────

  var CLIENT_EXPERIENCE_PATTERNS = [
    { re: /\bmilestone[\s-]*(based|payment|schedule)\b/i, label: 'Mentions milestone-based payments' },
    { re: /\bmilestones?\b/i, label: 'References milestones' },
    { re: /\bescrow\b/i, label: 'Mentions escrow' },
    { re: /\bnet[\s-]*(15|30|60)\b/i, label: 'Standard payment terms (Net)' },
    { re: /\bpayment\s+(terms|schedule|upon\s+completion)\b/i, label: 'Clear payment terms' },
    { re: /\b(jira|trello|asana|basecamp|monday\.com|clickup|notion|linear)\b/i, label: 'Uses project management tools' },
    { re: /\b(slack|teams|discord)\b/i, label: 'Uses communication tools' },
    { re: /\bgit(hub|lab)?\b/i, label: 'Uses version control' },
    { re: /\b(figma|zeplin|invision|sketch)\b/i, label: 'Uses design tools' },
    { re: /\b(confluence|wiki|documentation)\b/i, label: 'Has documentation practices' },
    { re: /\bsow\b|\bscope\s+of\s+work\b/i, label: 'Mentions scope of work (SOW)' },
    { re: /\brfp\b|\brequest\s+for\s+proposal\b/i, label: 'Uses RFP process' },
    { re: /\bsla\b|\bservice\s+level\b/i, label: 'Mentions SLA' },
    { re: /\bkpi\b|\bmetrics?\b/i, label: 'Defines KPIs/metrics' },
    { re: /\bonboarding\b/i, label: 'Has onboarding process' },
    { re: /\bcode\s+review\b/i, label: 'Has code review process' },
    { re: /\bagile\b|\bscrum\b|\bkanban\b/i, label: 'Uses agile methodology' },
    { re: /\buser\s+stor(y|ies)\b/i, label: 'Uses user stories' },
    { re: /\bacceptance\s+criteria\b/i, label: 'Defines acceptance criteria' },
    { re: /\bproject\s+manager\b|\bpm\b/i, label: 'Has dedicated project manager' },
    { re: /\btechnical\s+(lead|architect|director)\b/i, label: 'Has technical leadership' },
    { re: /\bqa\b|\bquality\s+assurance\b/i, label: 'Has QA process' },
    { re: /\bstaging\b|\buat\b|\buser\s+acceptance\b/i, label: 'Has staging/UAT environment' }
  ];

  // ─── Stop Words for Keyword Density (v2.0.0) ──────────────────────

  var STOP_WORDS = [
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
    'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'need',
    'dare', 'ought', 'used', 'it', 'its', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'mine', 'we', 'us', 'our', 'ours', 'you', 'your',
    'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them',
    'their', 'theirs', 'what', 'which', 'who', 'whom', 'whose', 'where',
    'when', 'how', 'why', 'not', 'no', 'nor', 'if', 'then', 'else',
    'than', 'too', 'very', 'just', 'about', 'above', 'after', 'again',
    'all', 'also', 'am', 'any', 'because', 'before', 'below', 'between',
    'both', 'each', 'few', 'further', 'get', 'got', 'here', 'into',
    'more', 'most', 'much', 'must', 'only', 'other', 'out', 'over',
    'own', 'same', 'so', 'some', 'still', 'such', 'through', 'under',
    'until', 'up', 'while', 'will', 'able', 'etc', 'well', 'also',
    'like', 'looking', 'want', 'work', 'working', 'make', 'using'
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

  // ─── Tone Formality Detection (v2.0.0) ─────────────────────────────

  function detectToneFormality(text) {
    if (!text || !text.trim()) {
      return { score: 5, level: 'neutral', formalSignals: [], informalSignals: [] };
    }

    var clean = text.trim();
    var formalSignals = matchPatterns(clean, FORMAL_PATTERNS);
    var informalSignals = matchPatterns(clean, INFORMAL_PATTERNS);

    var formalCount = formalSignals.length;
    var informalCount = informalSignals.length;
    var totalSignals = formalCount + informalCount;

    // Base score starts at 5 (neutral)
    var score = 5;

    if (totalSignals > 0) {
      // Shift score based on ratio of formal to informal signals
      var ratio = (formalCount - informalCount) / totalSignals;
      score = Math.round((5 + (ratio * 5)) * 10) / 10;
    }

    // Additional heuristics: sentence structure and word choice
    var sentences = splitSentences(clean);
    var avgSentLen = clean.split(/\s+/).length / Math.max(sentences.length, 1);

    // Longer sentences tend to be more formal
    if (avgSentLen > 20) { score += 0.5; }
    else if (avgSentLen < 8) { score -= 0.5; }

    // Contractions are informal
    var contractionCount = (clean.match(/\b\w+'(t|s|re|ve|ll|d|m)\b/gi) || []).length;
    if (contractionCount > 3) { score -= 0.5; }
    else if (contractionCount === 0 && clean.split(/\s+/).length > 30) { score += 0.5; }

    // Exclamation marks are informal
    var exclamationCount = (clean.match(/!/g) || []).length;
    if (exclamationCount > 2) { score -= 0.5; }

    // Clamp to 1-10
    score = Math.round(Math.max(1, Math.min(10, score)) * 10) / 10;

    var level;
    if (score >= 8.5) level = 'very_formal';
    else if (score >= 6.5) level = 'formal';
    else if (score >= 4) level = 'neutral';
    else if (score >= 2) level = 'informal';
    else level = 'very_informal';

    return {
      score: score,
      level: level,
      formalSignals: formalSignals,
      informalSignals: informalSignals
    };
  }

  // ─── Keyword Density Analysis (v2.0.0) ─────────────────────────────

  function analyzeKeywordDensity(text) {
    if (!text || !text.trim()) {
      return { keywords: [], totalWords: 0 };
    }

    var clean = text.trim().toLowerCase();
    var words = clean.replace(/[^a-z0-9\s-]/g, '').split(/\s+/);
    var totalWords = words.length;

    // Build a lookup map for stop words
    var stopMap = {};
    for (var s = 0; s < STOP_WORDS.length; s++) {
      stopMap[STOP_WORDS[s]] = true;
    }

    // Count word frequencies
    var freq = {};
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      // Skip stop words, short words (1-2 chars), and pure numbers
      if (!w || w.length <= 2 || stopMap[w] || /^\d+$/.test(w)) {
        continue;
      }
      if (freq[w]) {
        freq[w] += 1;
      } else {
        freq[w] = 1;
      }
    }

    // Convert to sorted array
    var entries = [];
    for (var word in freq) {
      if (freq.hasOwnProperty(word)) {
        entries.push({ word: word, count: freq[word], density: Math.round((freq[word] / Math.max(totalWords, 1)) * 10000) / 100 });
      }
    }

    // Sort by count descending, then alphabetically
    entries.sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.word < b.word ? -1 : 1;
    });

    // Return top 10
    var top = entries.slice(0, 10);

    return {
      keywords: top,
      totalWords: totalWords
    };
  }

  // ─── Scope Complexity Estimator (v2.0.0) ───────────────────────────

  function estimateScopeComplexity(text) {
    if (!text || !text.trim()) {
      return { complexity: 'simple', score: 1, factors: [] };
    }

    var clean = text.trim();
    var factors = [];
    var points = 0;

    // Count technologies mentioned
    var techCount = 0;
    for (var t = 0; t < TECHNOLOGY_PATTERNS.length; t++) {
      if (TECHNOLOGY_PATTERNS[t].test(clean)) {
        techCount++;
      }
    }
    if (techCount >= 8) {
      factors.push('Large tech stack (' + techCount + ' technologies)');
      points += 3;
    } else if (techCount >= 4) {
      factors.push('Moderate tech stack (' + techCount + ' technologies)');
      points += 2;
    } else if (techCount >= 2) {
      factors.push('Small tech stack (' + techCount + ' technologies)');
      points += 1;
    } else if (techCount === 1) {
      factors.push('Single technology mentioned');
      points += 0.5;
    }

    // Count deliverables
    var deliverableCount = 0;
    for (var d = 0; d < DELIVERABLE_PATTERNS.length; d++) {
      if (DELIVERABLE_PATTERNS[d].test(clean)) {
        deliverableCount++;
      }
    }
    if (deliverableCount >= 6) {
      factors.push('Many deliverables (' + deliverableCount + ' identified)');
      points += 3;
    } else if (deliverableCount >= 3) {
      factors.push('Multiple deliverables (' + deliverableCount + ' identified)');
      points += 2;
    } else if (deliverableCount >= 1) {
      factors.push('Few deliverables (' + deliverableCount + ' identified)');
      points += 1;
    }

    // Timeline indicators
    var timelineMatches = matchPatterns(clean, TIMELINE_PATTERNS);
    if (timelineMatches.length >= 3) {
      factors.push('Complex timeline with multiple phases');
      points += 2;
    } else if (timelineMatches.length >= 1) {
      factors.push('Timeline defined (' + timelineMatches[0].label + ')');
      points += 1;
    }

    // Multi-phase detection
    var phaseMatches = clean.match(/\bphase\s*\d/gi);
    if (phaseMatches && phaseMatches.length >= 2) {
      factors.push('Multi-phase project (' + phaseMatches.length + ' phases)');
      points += 1.5;
    }

    // Team size mentions
    var teamMatches = matchPatterns(clean, TEAM_SIZE_PATTERNS);
    if (teamMatches.length >= 2) {
      factors.push('Team coordination required');
      points += 2;
    } else if (teamMatches.length === 1) {
      factors.push(teamMatches[0].label);
      points += 1;
    }

    // Word count as complexity signal
    var wordCount = clean.split(/\s+/).length;
    if (wordCount >= 500) {
      factors.push('Very detailed posting (' + wordCount + ' words)');
      points += 1;
    } else if (wordCount >= 200) {
      factors.push('Detailed posting (' + wordCount + ' words)');
      points += 0.5;
    }

    // Integration mentions
    var integrationMatch = clean.match(/\bintegrat(e|ion|ing)\b/gi);
    if (integrationMatch && integrationMatch.length >= 2) {
      factors.push('Multiple integrations required');
      points += 1.5;
    } else if (integrationMatch && integrationMatch.length === 1) {
      factors.push('Integration work required');
      points += 0.5;
    }

    // Normalize score to 1-10
    var score = Math.round(Math.max(1, Math.min(10, points)) * 10) / 10;

    var complexity;
    if (score >= 8) complexity = 'enterprise';
    else if (score >= 5) complexity = 'complex';
    else if (score >= 3) complexity = 'moderate';
    else complexity = 'simple';

    return {
      complexity: complexity,
      score: score,
      factors: factors
    };
  }

  // ─── Client Experience Signals (v2.0.0) ────────────────────────────

  function detectClientExperience(text) {
    if (!text || !text.trim()) {
      return { experienceLevel: 'new', signals: [] };
    }

    var clean = text.trim();
    var signals = matchPatterns(clean, CLIENT_EXPERIENCE_PATTERNS);

    var experienceLevel;
    if (signals.length >= 6) experienceLevel = 'experienced';
    else if (signals.length >= 3) experienceLevel = 'moderate';
    else experienceLevel = 'new';

    return {
      experienceLevel: experienceLevel,
      signals: signals
    };
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
    var toneFormality = detectToneFormality(safeText);
    var keywordDensity = analyzeKeywordDensity(safeText);
    var scopeComplexity = estimateScopeComplexity(safeText);
    var clientExperience = detectClientExperience(safeText);

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
      toneFormality: toneFormality, keywordDensity: keywordDensity,
      scopeComplexity: scopeComplexity, clientExperience: clientExperience,
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

    // Tone Formality (v2.0.0)
    if (a.toneFormality) {
      var tf = a.toneFormality;
      var toneColor = tf.score >= 7 ? '#3b82f6' : tf.score >= 4 ? '#eab308' : '#f97316';
      h += '<div style="margin-top:14px;"><span style="color:#ccc;font-size:13px;font-weight:600;">Tone Formality</span> ';
      h += '<span style="background:' + toneColor + '18;color:' + toneColor + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">' + escapeHtml(tf.level.toUpperCase().replace(/_/g, ' ')) + ' (' + tf.score + '/10)</span>';

      if (tf.formalSignals.length > 0) {
        h += '<div style="color:#3b82f6;font-size:11px;margin-top:6px;font-weight:600;">Formal signals:</div>';
        for (var fi = 0; fi < tf.formalSignals.length; fi++) {
          h += '<div style="color:#888;font-size:12px;padding-left:10px;border-left:2px solid #1e3a5f;margin-top:3px;">' + escapeHtml(tf.formalSignals[fi].label) + '</div>';
        }
      }

      if (tf.informalSignals.length > 0) {
        h += '<div style="color:#f97316;font-size:11px;margin-top:6px;font-weight:600;">Informal signals:</div>';
        for (var ii = 0; ii < tf.informalSignals.length; ii++) {
          h += '<div style="color:#888;font-size:12px;padding-left:10px;border-left:2px solid #5f3a1e;margin-top:3px;">' + escapeHtml(tf.informalSignals[ii].label) + '</div>';
        }
      }

      h += '</div>';
    }

    // Scope Complexity (v2.0.0)
    if (a.scopeComplexity) {
      var sc = a.scopeComplexity;
      var complexityColors = { simple: '#22c55e', moderate: '#eab308', complex: '#f97316', enterprise: '#ef4444' };
      var scColor = complexityColors[sc.complexity] || '#888';
      h += '<div style="margin-top:14px;"><span style="color:#ccc;font-size:13px;font-weight:600;">Scope Complexity</span> ';
      h += '<span style="background:' + scColor + '18;color:' + scColor + ';font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;">' + escapeHtml(sc.complexity.toUpperCase()) + ' (' + sc.score + '/10)</span>';

      if (sc.factors.length > 0) {
        for (var sf = 0; sf < sc.factors.length; sf++) {
          h += '<div style="color:#888;font-size:12px;padding-left:10px;border-left:2px solid #222;margin-top:4px;">' + escapeHtml(sc.factors[sf]) + '</div>';
        }
      }

      h += '</div>';
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
    detectToneFormality: detectToneFormality,
    analyzeKeywordDensity: analyzeKeywordDensity,
    estimateScopeComplexity: estimateScopeComplexity,
    detectClientExperience: detectClientExperience,
    renderAnalysis: renderAnalysis,
    version: '2.0.0'
  };

})();
