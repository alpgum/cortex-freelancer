/**
 * [CF3-002] NLP Job-Skill Matching Algorithm
 *
 * Advanced scoring system that matches freelancer skills to job requirements
 * using NLP-based skill extraction, semantic relationships, and confidence scoring.
 *
 * Exports: window.CortexNLPMatcher
 */
(function () {
  'use strict';

  // ─── Skill Taxonomy: canonical skills + aliases + relationships ────

  /**
   * Each entry: canonical name → { aliases, related (with weight), category }
   * Related skills get partial credit (weight 0.0–1.0) when matched.
   */
  var SKILL_TAXONOMY = {
    'react': {
      aliases: ['reactjs', 'react.js', 'react js', 'react 18', 'react 19'],
      related: { 'javascript': 0.5, 'typescript': 0.4, 'redux': 0.6, 'next.js': 0.5, 'jsx': 0.7, 'hooks': 0.7, 'frontend': 0.4, 'spa': 0.5 },
      category: 'frontend'
    },
    'next.js': {
      aliases: ['nextjs', 'next js', 'next.js 14', 'next.js 15', 'nextjs app router'],
      related: { 'react': 0.7, 'typescript': 0.4, 'vercel': 0.5, 'ssr': 0.6, 'frontend': 0.4, 'fullstack': 0.4 },
      category: 'frontend'
    },
    'vue': {
      aliases: ['vuejs', 'vue.js', 'vue js', 'vue 3', 'vue3'],
      related: { 'javascript': 0.5, 'nuxt': 0.6, 'frontend': 0.4, 'typescript': 0.3 },
      category: 'frontend'
    },
    'angular': {
      aliases: ['angularjs', 'angular js', 'angular 17', 'angular 18'],
      related: { 'typescript': 0.6, 'rxjs': 0.7, 'frontend': 0.4, 'javascript': 0.4 },
      category: 'frontend'
    },
    'svelte': {
      aliases: ['sveltejs', 'svelte.js', 'sveltekit'],
      related: { 'javascript': 0.5, 'frontend': 0.4, 'typescript': 0.3 },
      category: 'frontend'
    },
    'javascript': {
      aliases: ['js', 'es6', 'es2015', 'ecmascript', 'vanilla js', 'vanilla javascript'],
      related: { 'typescript': 0.6, 'node.js': 0.4, 'react': 0.3, 'frontend': 0.3 },
      category: 'language'
    },
    'typescript': {
      aliases: ['ts', 'type script'],
      related: { 'javascript': 0.7, 'node.js': 0.3, 'react': 0.3, 'angular': 0.3 },
      category: 'language'
    },
    'node.js': {
      aliases: ['nodejs', 'node js', 'node', 'node 20', 'node 22'],
      related: { 'javascript': 0.6, 'express': 0.7, 'backend': 0.5, 'api': 0.4, 'typescript': 0.3 },
      category: 'backend'
    },
    'express': {
      aliases: ['expressjs', 'express.js', 'express js'],
      related: { 'node.js': 0.8, 'api': 0.5, 'backend': 0.5, 'javascript': 0.3 },
      category: 'backend'
    },
    'python': {
      aliases: ['python3', 'python 3', 'py'],
      related: { 'django': 0.4, 'flask': 0.4, 'fastapi': 0.4, 'data science': 0.3, 'machine learning': 0.3 },
      category: 'language'
    },
    'django': {
      aliases: ['django rest framework', 'drf', 'django rest'],
      related: { 'python': 0.8, 'backend': 0.5, 'api': 0.4 },
      category: 'backend'
    },
    'flask': {
      aliases: ['flask api'],
      related: { 'python': 0.8, 'backend': 0.5, 'api': 0.4 },
      category: 'backend'
    },
    'fastapi': {
      aliases: ['fast api'],
      related: { 'python': 0.8, 'backend': 0.5, 'api': 0.5 },
      category: 'backend'
    },
    'ruby on rails': {
      aliases: ['rails', 'ror', 'ruby rails'],
      related: { 'ruby': 0.8, 'backend': 0.5, 'api': 0.4 },
      category: 'backend'
    },
    'ruby': {
      aliases: [],
      related: { 'ruby on rails': 0.6, 'backend': 0.3 },
      category: 'language'
    },
    'php': {
      aliases: ['php8', 'php 8'],
      related: { 'laravel': 0.5, 'wordpress': 0.4, 'backend': 0.4 },
      category: 'language'
    },
    'laravel': {
      aliases: ['laravel 10', 'laravel 11'],
      related: { 'php': 0.8, 'backend': 0.5, 'api': 0.4 },
      category: 'backend'
    },
    'go': {
      aliases: ['golang', 'go lang'],
      related: { 'backend': 0.5, 'api': 0.4, 'microservices': 0.4 },
      category: 'language'
    },
    'rust': {
      aliases: ['rust lang', 'rustlang'],
      related: { 'systems programming': 0.5, 'backend': 0.3, 'wasm': 0.4 },
      category: 'language'
    },
    'java': {
      aliases: ['java 17', 'java 21'],
      related: { 'spring': 0.6, 'spring boot': 0.6, 'backend': 0.4, 'kotlin': 0.4 },
      category: 'language'
    },
    'spring boot': {
      aliases: ['spring', 'spring framework', 'springboot'],
      related: { 'java': 0.8, 'backend': 0.5, 'api': 0.4, 'microservices': 0.4 },
      category: 'backend'
    },
    'c#': {
      aliases: ['csharp', 'c sharp', '.net c#'],
      related: { '.net': 0.8, 'asp.net': 0.6, 'backend': 0.4 },
      category: 'language'
    },
    '.net': {
      aliases: ['dotnet', 'dot net', 'asp.net', '.net core', '.net 8'],
      related: { 'c#': 0.8, 'backend': 0.5, 'api': 0.4 },
      category: 'backend'
    },
    'sql': {
      aliases: ['structured query language'],
      related: { 'postgresql': 0.6, 'mysql': 0.6, 'database': 0.7, 'data analysis': 0.3 },
      category: 'database'
    },
    'postgresql': {
      aliases: ['postgres', 'psql', 'pg'],
      related: { 'sql': 0.8, 'database': 0.7, 'backend': 0.3 },
      category: 'database'
    },
    'mysql': {
      aliases: ['my sql'],
      related: { 'sql': 0.8, 'database': 0.7, 'backend': 0.3 },
      category: 'database'
    },
    'mongodb': {
      aliases: ['mongo', 'mongo db', 'mongoose'],
      related: { 'nosql': 0.7, 'database': 0.6, 'node.js': 0.3 },
      category: 'database'
    },
    'redis': {
      aliases: [],
      related: { 'caching': 0.7, 'database': 0.4, 'backend': 0.3 },
      category: 'database'
    },
    'firebase': {
      aliases: ['firestore', 'firebase auth', 'firebase db'],
      related: { 'google cloud': 0.4, 'nosql': 0.4, 'backend': 0.3, 'realtime': 0.4 },
      category: 'backend'
    },
    'aws': {
      aliases: ['amazon web services', 'amazon aws'],
      related: { 'cloud': 0.7, 'devops': 0.5, 's3': 0.6, 'ec2': 0.6, 'lambda': 0.5 },
      category: 'cloud'
    },
    'google cloud': {
      aliases: ['gcp', 'google cloud platform'],
      related: { 'cloud': 0.7, 'devops': 0.4, 'bigquery': 0.5 },
      category: 'cloud'
    },
    'azure': {
      aliases: ['microsoft azure', 'azure cloud'],
      related: { 'cloud': 0.7, 'devops': 0.4, '.net': 0.3 },
      category: 'cloud'
    },
    'docker': {
      aliases: ['dockerfile', 'docker compose', 'docker-compose'],
      related: { 'kubernetes': 0.5, 'devops': 0.6, 'containers': 0.8, 'cloud': 0.3 },
      category: 'devops'
    },
    'kubernetes': {
      aliases: ['k8s', 'kube'],
      related: { 'docker': 0.6, 'devops': 0.6, 'cloud': 0.4, 'containers': 0.7 },
      category: 'devops'
    },
    'terraform': {
      aliases: ['tf', 'hcl'],
      related: { 'devops': 0.6, 'cloud': 0.5, 'infrastructure': 0.7, 'aws': 0.3 },
      category: 'devops'
    },
    'ci/cd': {
      aliases: ['cicd', 'ci cd', 'continuous integration', 'continuous deployment'],
      related: { 'devops': 0.7, 'github actions': 0.6, 'jenkins': 0.5 },
      category: 'devops'
    },
    'github actions': {
      aliases: ['gh actions'],
      related: { 'ci/cd': 0.7, 'devops': 0.5, 'git': 0.4 },
      category: 'devops'
    },
    'git': {
      aliases: ['github', 'gitlab', 'version control'],
      related: { 'devops': 0.3 },
      category: 'tool'
    },
    'graphql': {
      aliases: ['graph ql', 'gql'],
      related: { 'api': 0.6, 'apollo': 0.7, 'backend': 0.3, 'frontend': 0.3 },
      category: 'api'
    },
    'rest api': {
      aliases: ['restful', 'restful api', 'rest', 'api development', 'api design'],
      related: { 'backend': 0.5, 'node.js': 0.3, 'api': 0.8 },
      category: 'api'
    },
    'tailwind css': {
      aliases: ['tailwind', 'tailwindcss'],
      related: { 'css': 0.6, 'frontend': 0.4, 'responsive design': 0.4 },
      category: 'frontend'
    },
    'css': {
      aliases: ['css3', 'cascading style sheets', 'scss', 'sass', 'less'],
      related: { 'frontend': 0.5, 'html': 0.5, 'responsive design': 0.5, 'tailwind css': 0.4 },
      category: 'frontend'
    },
    'html': {
      aliases: ['html5'],
      related: { 'frontend': 0.5, 'css': 0.5, 'web development': 0.4 },
      category: 'frontend'
    },
    'react native': {
      aliases: ['react-native', 'rn'],
      related: { 'react': 0.6, 'mobile': 0.7, 'javascript': 0.4, 'ios': 0.4, 'android': 0.4 },
      category: 'mobile'
    },
    'flutter': {
      aliases: [],
      related: { 'dart': 0.8, 'mobile': 0.7, 'ios': 0.4, 'android': 0.4 },
      category: 'mobile'
    },
    'swift': {
      aliases: ['swiftui'],
      related: { 'ios': 0.8, 'mobile': 0.5, 'apple': 0.4 },
      category: 'mobile'
    },
    'kotlin': {
      aliases: [],
      related: { 'android': 0.8, 'java': 0.5, 'mobile': 0.5 },
      category: 'mobile'
    },
    'figma': {
      aliases: [],
      related: { 'ui design': 0.7, 'ux design': 0.5, 'prototyping': 0.6, 'design': 0.6 },
      category: 'design'
    },
    'ui design': {
      aliases: ['ui', 'user interface', 'user interface design', 'ui/ux'],
      related: { 'ux design': 0.7, 'figma': 0.5, 'design': 0.7, 'frontend': 0.3 },
      category: 'design'
    },
    'ux design': {
      aliases: ['ux', 'user experience', 'user experience design'],
      related: { 'ui design': 0.7, 'user research': 0.6, 'wireframing': 0.6, 'design': 0.6 },
      category: 'design'
    },
    'machine learning': {
      aliases: ['ml', 'machine-learning'],
      related: { 'python': 0.5, 'deep learning': 0.7, 'data science': 0.7, 'tensorflow': 0.5, 'pytorch': 0.5, 'ai': 0.6 },
      category: 'data'
    },
    'deep learning': {
      aliases: ['dl'],
      related: { 'machine learning': 0.8, 'tensorflow': 0.6, 'pytorch': 0.6, 'neural networks': 0.8, 'ai': 0.5 },
      category: 'data'
    },
    'data science': {
      aliases: ['data scientist'],
      related: { 'python': 0.5, 'machine learning': 0.5, 'data analysis': 0.7, 'statistics': 0.5 },
      category: 'data'
    },
    'data analysis': {
      aliases: ['data analytics', 'data analyst'],
      related: { 'sql': 0.5, 'python': 0.4, 'excel': 0.4, 'power bi': 0.5, 'tableau': 0.5 },
      category: 'data'
    },
    'tensorflow': {
      aliases: ['tf', 'tensor flow'],
      related: { 'machine learning': 0.7, 'deep learning': 0.7, 'python': 0.5, 'keras': 0.8 },
      category: 'data'
    },
    'pytorch': {
      aliases: ['torch'],
      related: { 'machine learning': 0.7, 'deep learning': 0.7, 'python': 0.5 },
      category: 'data'
    },
    'seo': {
      aliases: ['search engine optimization'],
      related: { 'content marketing': 0.5, 'google analytics': 0.5, 'marketing': 0.5 },
      category: 'marketing'
    },
    'google ads': {
      aliases: ['google adwords', 'adwords', 'google ppc'],
      related: { 'ppc': 0.7, 'sem': 0.6, 'marketing': 0.5, 'digital marketing': 0.4 },
      category: 'marketing'
    },
    'facebook ads': {
      aliases: ['meta ads', 'fb ads', 'instagram ads'],
      related: { 'social media marketing': 0.5, 'marketing': 0.5, 'ppc': 0.4 },
      category: 'marketing'
    },
    'wordpress': {
      aliases: ['wp', 'woocommerce'],
      related: { 'php': 0.5, 'cms': 0.6, 'web development': 0.4 },
      category: 'cms'
    },
    'shopify': {
      aliases: ['shopify plus', 'liquid'],
      related: { 'ecommerce': 0.7, 'web development': 0.3 },
      category: 'cms'
    },
    'stripe': {
      aliases: ['stripe api', 'stripe payments'],
      related: { 'payments': 0.8, 'api': 0.4, 'ecommerce': 0.4 },
      category: 'api'
    },
    'redux': {
      aliases: ['redux toolkit', 'rtk'],
      related: { 'react': 0.7, 'state management': 0.8, 'javascript': 0.3 },
      category: 'frontend'
    },
    'web scraping': {
      aliases: ['scraping', 'web crawler', 'data scraping', 'screen scraping'],
      related: { 'python': 0.5, 'beautifulsoup': 0.7, 'selenium': 0.6, 'puppeteer': 0.6 },
      category: 'data'
    },
    'selenium': {
      aliases: [],
      related: { 'testing': 0.5, 'web scraping': 0.5, 'automation': 0.5 },
      category: 'testing'
    },
    'jest': {
      aliases: [],
      related: { 'testing': 0.7, 'javascript': 0.4, 'react': 0.3 },
      category: 'testing'
    },
    'cypress': {
      aliases: [],
      related: { 'testing': 0.7, 'e2e testing': 0.8, 'frontend': 0.3 },
      category: 'testing'
    },
    'power bi': {
      aliases: ['powerbi'],
      related: { 'data visualization': 0.7, 'data analysis': 0.5, 'reporting': 0.5 },
      category: 'data'
    },
    'tableau': {
      aliases: [],
      related: { 'data visualization': 0.7, 'data analysis': 0.5, 'reporting': 0.5 },
      category: 'data'
    },
    'excel': {
      aliases: ['microsoft excel', 'google sheets', 'spreadsheet'],
      related: { 'data analysis': 0.4, 'reporting': 0.4 },
      category: 'tool'
    },
    'linux': {
      aliases: ['ubuntu', 'debian', 'centos', 'rhel'],
      related: { 'devops': 0.4, 'bash': 0.6, 'server administration': 0.5 },
      category: 'devops'
    },
    'nginx': {
      aliases: [],
      related: { 'linux': 0.4, 'devops': 0.4, 'web server': 0.8 },
      category: 'devops'
    },
    'elasticsearch': {
      aliases: ['elastic', 'elk', 'opensearch'],
      related: { 'search': 0.7, 'database': 0.4, 'backend': 0.3 },
      category: 'database'
    },
    'rabbitmq': {
      aliases: ['rabbit mq'],
      related: { 'message queue': 0.8, 'microservices': 0.5, 'backend': 0.3 },
      category: 'backend'
    },
    'kafka': {
      aliases: ['apache kafka'],
      related: { 'message queue': 0.6, 'streaming': 0.7, 'microservices': 0.4, 'backend': 0.3 },
      category: 'backend'
    },
    'microservices': {
      aliases: ['micro services', 'micro-services'],
      related: { 'docker': 0.4, 'kubernetes': 0.4, 'api': 0.4, 'backend': 0.5 },
      category: 'architecture'
    },
    'blockchain': {
      aliases: ['web3', 'smart contracts', 'solidity'],
      related: { 'ethereum': 0.6, 'defi': 0.5, 'cryptocurrency': 0.4 },
      category: 'blockchain'
    },
    'openai': {
      aliases: ['chatgpt api', 'gpt api', 'openai api'],
      related: { 'ai': 0.7, 'llm': 0.8, 'python': 0.3, 'api': 0.4 },
      category: 'ai'
    },
    'langchain': {
      aliases: [],
      related: { 'llm': 0.7, 'ai': 0.6, 'python': 0.4, 'openai': 0.5 },
      category: 'ai'
    },
    'llm': {
      aliases: ['large language model', 'large language models'],
      related: { 'ai': 0.7, 'openai': 0.5, 'machine learning': 0.4, 'nlp': 0.6 },
      category: 'ai'
    }
  };

  // ─── Build reverse-lookup index: normalized alias → canonical name ──

  var _aliasIndex = {};
  var _canonicalSet = {};
  (function buildIndex() {
    var keys = Object.keys(SKILL_TAXONOMY);
    for (var i = 0; i < keys.length; i++) {
      var canon = keys[i];
      var norm = _normalize(canon);
      _aliasIndex[norm] = canon;
      _canonicalSet[canon] = true;
      var aliases = SKILL_TAXONOMY[canon].aliases || [];
      for (var j = 0; j < aliases.length; j++) {
        _aliasIndex[_normalize(aliases[j])] = canon;
      }
    }
  })();

  // ─── Utility functions ────────────────────────────────────────────

  function _normalize(s) {
    return (s || '').toLowerCase().trim()
      .replace(/\.js$/i, '')
      .replace(/[-_./]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _normalizeStrict(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9#+.]/g, '').trim();
  }

  /**
   * Resolve a skill string to its canonical taxonomy name.
   * Returns canonical name or null if not in taxonomy.
   */
  function resolveCanonical(skill) {
    var norm = _normalize(skill);
    if (_aliasIndex[norm]) return _aliasIndex[norm];
    // Try strict normalize
    var strict = _normalizeStrict(skill);
    if (_aliasIndex[strict]) return _aliasIndex[strict];
    // Try partial match: check if any canonical/alias contains or is contained
    var keys = Object.keys(_aliasIndex);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].length > 2 && (norm.indexOf(keys[i]) !== -1 || keys[i].indexOf(norm) !== -1)) {
        return _aliasIndex[keys[i]];
      }
    }
    return null;
  }

  // ─── NLP Skill Extraction from Job Description ────────────────────

  /**
   * Extract skills from free-text job description using pattern matching.
   * Returns array of { skill, source, position, confidence }
   *
   * @param {string} text - Job title + description text
   * @returns {{ skill: string, source: string, position: number, confidence: number }[]}
   */
  function extractSkillsFromText(text) {
    if (!text || typeof text !== 'string') return [];

    var results = [];
    var seen = {};
    var lowerText = text.toLowerCase();

    // Phase 1: Match against taxonomy (canonical + aliases)
    var allPatterns = Object.keys(_aliasIndex);
    for (var i = 0; i < allPatterns.length; i++) {
      var pattern = allPatterns[i];
      var canon = _aliasIndex[pattern];
      if (seen[canon]) continue;

      // Build regex for this pattern — word-boundary aware
      var escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use word boundaries, but handle special chars
      var regex;
      try {
        regex = new RegExp('(?:^|[\\s,;(/])(' + escaped + ')(?:[\\s,;)/.]|$)', 'gi');
      } catch (e) {
        continue;
      }

      var match = regex.exec(lowerText);
      if (match) {
        seen[canon] = true;
        // Confidence based on where in text it appears
        var position = match.index / lowerText.length;
        var confidence = 0.9; // high confidence for taxonomy match
        // Boost if appears in first 20% (likely title/requirements)
        if (position < 0.2) confidence = 0.95;

        results.push({
          skill: canon,
          source: 'taxonomy',
          position: match.index,
          confidence: confidence
        });
      }
    }

    // Phase 2: Extract from "Skills:" / "Requirements:" sections
    var sectionPatterns = [
      /skills?\s*(?:required|needed|:)\s*[:\-]?\s*([^\n.]+)/gi,
      /requirements?\s*[:\-]\s*([^\n]+)/gi,
      /must\s+(?:have|know|be\s+familiar\s+with)\s*[:\-]?\s*([^\n.]+)/gi,
      /experience\s+(?:with|in)\s*[:\-]?\s*([^\n.]+)/gi,
      /proficien(?:t|cy)\s+(?:in|with)\s*[:\-]?\s*([^\n.]+)/gi,
      /expertise\s+(?:in|with)\s*[:\-]?\s*([^\n.]+)/gi,
      /familiar(?:ity)?\s+with\s*[:\-]?\s*([^\n.]+)/gi,
      /knowledge\s+of\s*[:\-]?\s*([^\n.]+)/gi,
      /tech(?:nology)?\s*stack\s*[:\-]?\s*([^\n.]+)/gi
    ];

    for (var p = 0; p < sectionPatterns.length; p++) {
      var sMatch;
      while ((sMatch = sectionPatterns[p].exec(text)) !== null) {
        var segment = sMatch[1];
        // Split by commas, "and", slashes
        var parts = segment.split(/[,/&]|\band\b|\bor\b/i);
        for (var k = 0; k < parts.length; k++) {
          var part = parts[k].trim().replace(/^[-•·]\s*/, '');
          if (part.length < 2 || part.length > 40) continue;
          var resolved = resolveCanonical(part);
          if (resolved && !seen[resolved]) {
            seen[resolved] = true;
            results.push({
              skill: resolved,
              source: 'section',
              position: sMatch.index,
              confidence: 0.85
            });
          }
        }
      }
    }

    // Phase 3: Context-based implicit skill detection
    var contextSignals = [
      { pattern: /\bfrontend\b|\bfront[- ]end\b/i, skills: ['html', 'css', 'javascript'], confidence: 0.4 },
      { pattern: /\bbackend\b|\bback[- ]end\b/i, skills: ['node.js', 'sql', 'rest api'], confidence: 0.3 },
      { pattern: /\bfull[- ]?stack\b/i, skills: ['javascript', 'node.js', 'sql', 'rest api', 'html', 'css'], confidence: 0.3 },
      { pattern: /\bmobile\s+(?:app|developer|development)\b/i, skills: ['react native', 'flutter'], confidence: 0.3 },
      { pattern: /\bios\s+(?:app|developer|development)\b/i, skills: ['swift', 'react native'], confidence: 0.4 },
      { pattern: /\bandroid\s+(?:app|developer|development)\b/i, skills: ['kotlin', 'react native'], confidence: 0.4 },
      { pattern: /\bdata\s+(?:engineer|pipeline|warehouse)\b/i, skills: ['python', 'sql', 'aws'], confidence: 0.35 },
      { pattern: /\bdevops\s+engineer\b/i, skills: ['docker', 'kubernetes', 'aws', 'ci/cd', 'terraform'], confidence: 0.4 },
      { pattern: /\bai\b|\bartificial\s+intelligence\b|\bllm\b|\bchatbot\b/i, skills: ['python', 'machine learning', 'openai'], confidence: 0.35 },
      { pattern: /\becommerce\b|\be-commerce\b|\bonline\s+store\b/i, skills: ['shopify', 'stripe'], confidence: 0.3 },
      { pattern: /\bwordpress\s+(?:site|website|theme|plugin)\b/i, skills: ['wordpress', 'php', 'css'], confidence: 0.5 },
    ];

    for (var c = 0; c < contextSignals.length; c++) {
      if (contextSignals[c].pattern.test(text)) {
        var ctxSkills = contextSignals[c].skills;
        for (var cs = 0; cs < ctxSkills.length; cs++) {
          if (!seen[ctxSkills[cs]]) {
            seen[ctxSkills[cs]] = true;
            results.push({
              skill: ctxSkills[cs],
              source: 'context',
              position: -1,
              confidence: contextSignals[c].confidence
            });
          }
        }
      }
    }

    return results;
  }

  // ─── NLP Match Scoring Engine ─────────────────────────────────────

  /**
   * Calculate NLP-powered match score between a job and user profile.
   *
   * @param {object} jobData - { title, description, skills[], budget, budgetType, budgetMin, budgetMax, experienceLevel }
   * @param {object} profileData - { skills[], hourlyRate, experienceLevel, title }
   * @returns {NLPMatchResult}
   *
   * @typedef {object} NLPMatchResult
   * @property {number} matchPercent - Overall match 0–100
   * @property {number} confidence - Confidence in the score 0–1
   * @property {object} breakdown - { skillScore, rateScore, expScore, contextScore }
   * @property {SkillMatchDetail[]} skillMatches - Per-skill match details
   * @property {string[]} missingSkills - Skills job wants but user lacks
   * @property {string[]} bonusSkills - User skills not required but related/valuable
   * @property {string} matchTier - 'excellent' | 'good' | 'fair' | 'low'
   * @property {string} recommendation - Actionable text
   */
  function calculateNLPMatch(jobData, profileData) {
    if (!jobData || !profileData) {
      return _emptyResult();
    }

    // 1. Extract skills from job description + listed skills
    var jobText = (jobData.title || '') + ' ' + (jobData.description || '');
    var extractedSkills = extractSkillsFromText(jobText);

    // Also include explicitly listed job skills
    var listedSkills = jobData.skills || [];
    var seenExtracted = {};
    for (var i = 0; i < extractedSkills.length; i++) {
      seenExtracted[extractedSkills[i].skill] = true;
    }
    for (var j = 0; j < listedSkills.length; j++) {
      var resolved = resolveCanonical(listedSkills[j]);
      var skillName = resolved || _normalize(listedSkills[j]);
      if (!seenExtracted[skillName]) {
        seenExtracted[skillName] = true;
        extractedSkills.push({
          skill: skillName,
          source: 'listed',
          position: -1,
          confidence: 0.95
        });
      }
    }

    // 2. Resolve user skills to canonical names
    var userSkills = profileData.skills || [];
    var userCanonical = {};
    for (var u = 0; u < userSkills.length; u++) {
      var uResolved = resolveCanonical(userSkills[u]);
      var uName = uResolved || _normalize(userSkills[u]);
      userCanonical[uName] = userSkills[u]; // canonical → original
    }

    // 3. Score each extracted job skill against user skills
    var skillMatches = [];
    var totalWeight = 0;
    var totalScore = 0;
    var matchedSkillNames = [];
    var missingSkillNames = [];

    for (var e = 0; e < extractedSkills.length; e++) {
      var ex = extractedSkills[e];
      var skillWeight = _skillImportanceWeight(ex);
      totalWeight += skillWeight;

      var matchResult = _scoreSkillMatch(ex.skill, userCanonical);

      skillMatches.push({
        skill: ex.skill,
        source: ex.source,
        confidence: ex.confidence,
        matchType: matchResult.type,
        matchScore: matchResult.score,
        matchedVia: matchResult.matchedVia,
        weight: skillWeight
      });

      totalScore += matchResult.score * skillWeight;

      if (matchResult.score >= 0.7) {
        matchedSkillNames.push(ex.skill);
      } else if (matchResult.score < 0.3 && ex.source !== 'context') {
        missingSkillNames.push(ex.skill);
      }
    }

    var skillScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 50;

    // 4. Find bonus skills: user has but job doesn't require, yet related
    var bonusSkills = _findBonusSkills(userCanonical, extractedSkills);

    // 5. Rate score
    var rateResult = _scoreRate(jobData, profileData);

    // 6. Experience score
    var expResult = _scoreExperience(jobData, profileData);

    // 7. Context relevance bonus (title match, category alignment)
    var contextScore = _scoreContext(jobData, profileData, extractedSkills);

    // 8. Weighted final score
    // Skills: 55%, Rate: 20%, Experience: 10%, Context: 15%
    var rawMatch = (skillScore * 0.55) +
                   (rateResult.score * 0.20) +
                   (expResult.score * 0.10) +
                   (contextScore * 0.15);

    var matchPercent = Math.max(0, Math.min(100, Math.round(rawMatch)));

    // 9. Calculate overall confidence
    var confidence = _calculateConfidence(extractedSkills, jobData, skillMatches);

    // 10. Determine tier and recommendation
    var tier = matchPercent >= 80 ? 'excellent' :
               matchPercent >= 60 ? 'good' :
               matchPercent >= 40 ? 'fair' : 'low';

    var recommendation = _generateRecommendation(tier, matchedSkillNames, missingSkillNames, bonusSkills, rateResult);

    return {
      matchPercent: matchPercent,
      confidence: Math.round(confidence * 100) / 100,
      breakdown: {
        skillScore: Math.round(skillScore),
        rateScore: Math.round(rateResult.score),
        expScore: Math.round(expResult.score),
        contextScore: Math.round(contextScore)
      },
      skillMatches: skillMatches,
      matchedSkills: matchedSkillNames,
      missingSkills: missingSkillNames,
      bonusSkills: bonusSkills,
      extractedSkills: extractedSkills.map(function (s) { return s.skill; }),
      matchTier: tier,
      rateMatch: rateResult.match,
      experienceMatch: expResult.match,
      recommendation: recommendation
    };
  }

  // ─── Internal scoring helpers ─────────────────────────────────────

  function _emptyResult() {
    return {
      matchPercent: 0, confidence: 0,
      breakdown: { skillScore: 0, rateScore: 0, expScore: 0, contextScore: 0 },
      skillMatches: [], matchedSkills: [], missingSkills: [],
      bonusSkills: [], extractedSkills: [],
      matchTier: 'low', rateMatch: false, experienceMatch: false,
      recommendation: 'Insufficient data to calculate match.'
    };
  }

  /**
   * Weight a skill's importance based on how it was found and where.
   */
  function _skillImportanceWeight(extracted) {
    var base = 1.0;
    // Listed skills (explicit) are most important
    if (extracted.source === 'listed') base = 1.2;
    // Section-extracted (in requirements/skills section)
    else if (extracted.source === 'section') base = 1.1;
    // Taxonomy match in body text
    else if (extracted.source === 'taxonomy') base = 1.0;
    // Context-inferred skills are less important
    else if (extracted.source === 'context') base = 0.5;

    // Boost if found early in text (title/first paragraph)
    if (extracted.position >= 0 && extracted.position < 100) {
      base *= 1.15;
    }

    return base;
  }

  /**
   * Score how well a single job-required skill matches user's skill set.
   * Returns { score: 0-1, type: 'exact'|'related'|'partial'|'none', matchedVia: string|null }
   */
  function _scoreSkillMatch(jobSkill, userCanonical) {
    // Direct/exact match
    if (userCanonical[jobSkill]) {
      return { score: 1.0, type: 'exact', matchedVia: userCanonical[jobSkill] };
    }

    // Check if user has a related skill (via taxonomy)
    var entry = SKILL_TAXONOMY[jobSkill];
    if (entry && entry.related) {
      var bestRelated = 0;
      var bestVia = null;
      var relKeys = Object.keys(entry.related);
      for (var r = 0; r < relKeys.length; r++) {
        var relSkill = relKeys[r];
        var relWeight = entry.related[relSkill];
        if (userCanonical[relSkill] && relWeight > bestRelated) {
          bestRelated = relWeight;
          bestVia = userCanonical[relSkill];
        }
      }
      if (bestRelated > 0) {
        return { score: bestRelated, type: 'related', matchedVia: bestVia };
      }
    }

    // Check reverse: does any user skill list this job skill as related?
    var uKeys = Object.keys(userCanonical);
    for (var u = 0; u < uKeys.length; u++) {
      var uEntry = SKILL_TAXONOMY[uKeys[u]];
      if (uEntry && uEntry.related && uEntry.related[jobSkill]) {
        return { score: uEntry.related[jobSkill] * 0.8, type: 'related', matchedVia: userCanonical[uKeys[u]] };
      }
    }

    // Category match: user has skills in same category
    if (entry && entry.category) {
      for (var uc = 0; uc < uKeys.length; uc++) {
        var ucEntry = SKILL_TAXONOMY[uKeys[uc]];
        if (ucEntry && ucEntry.category === entry.category) {
          return { score: 0.2, type: 'partial', matchedVia: userCanonical[uKeys[uc]] + ' (same category)' };
        }
      }
    }

    return { score: 0, type: 'none', matchedVia: null };
  }

  /**
   * Find user skills that are bonus: not required but related to job skills.
   */
  function _findBonusSkills(userCanonical, extractedSkills) {
    var required = {};
    for (var i = 0; i < extractedSkills.length; i++) {
      required[extractedSkills[i].skill] = true;
    }

    var bonus = [];
    var uKeys = Object.keys(userCanonical);
    for (var u = 0; u < uKeys.length; u++) {
      if (required[uKeys[u]]) continue;
      // Check if this user skill is related to any required skill
      var entry = SKILL_TAXONOMY[uKeys[u]];
      if (entry && entry.related) {
        var relKeys = Object.keys(entry.related);
        for (var r = 0; r < relKeys.length; r++) {
          if (required[relKeys[r]]) {
            bonus.push(userCanonical[uKeys[u]]);
            break;
          }
        }
      }
    }
    return bonus;
  }

  /**
   * Score rate fit. Returns { score: 0-100, match: boolean }
   */
  function _scoreRate(jobData, profileData) {
    var userRate = parseFloat(String(profileData.hourlyRate || '').replace(/[^0-9.]/g, '')) || 0;
    if (userRate <= 0) return { score: 50, match: true }; // no rate → neutral

    if (jobData.budgetType === 'hourly') {
      var budgetMin = parseFloat(jobData.budgetMin) || 0;
      var budgetMax = parseFloat(jobData.budgetMax) || parseFloat(jobData.budget) || 0;
      if (budgetMin <= 0 && budgetMax <= 0) return { score: 50, match: true };

      if (budgetMax <= 0) budgetMax = budgetMin * 1.3;
      if (budgetMin <= 0) budgetMin = budgetMax * 0.7;

      if (userRate >= budgetMin && userRate <= budgetMax) {
        return { score: 100, match: true };
      } else if (userRate < budgetMin) {
        // Under budget = still a match
        return { score: 85, match: true };
      } else {
        var overPct = ((userRate - budgetMax) / budgetMax) * 100;
        if (overPct <= 15) return { score: 65, match: true };
        if (overPct <= 30) return { score: 40, match: false };
        return { score: Math.max(10, 30 - overPct), match: false };
      }
    }

    if (jobData.budgetType === 'fixed') {
      var fixedBudget = parseFloat(jobData.budget) || 0;
      if (fixedBudget <= 0) return { score: 50, match: true };
      // Estimate hours: $budget / $rate → check if reasonable (10-200 hours)
      var estHours = fixedBudget / userRate;
      if (estHours >= 5 && estHours <= 500) return { score: 75, match: true };
      if (estHours < 5) return { score: 30, match: false }; // too few hours
      return { score: 50, match: true };
    }

    return { score: 50, match: true };
  }

  /**
   * Score experience level fit. Returns { score: 0-100, match: boolean }
   */
  var EXP_LEVELS = { entry: 1, junior: 2, intermediate: 3, mid: 3, senior: 4, expert: 5, lead: 5 };

  function _scoreExperience(jobData, profileData) {
    var jobLevel = EXP_LEVELS[(jobData.experienceLevel || '').toLowerCase()] || 0;
    var userLevel = EXP_LEVELS[(profileData.experienceLevel || '').toLowerCase()] || 0;
    if (jobLevel === 0 || userLevel === 0) return { score: 50, match: true };

    if (userLevel >= jobLevel) return { score: 100, match: true };
    if (userLevel === jobLevel - 1) return { score: 60, match: true };
    return { score: 20, match: false };
  }

  /**
   * Score contextual relevance (title similarity, domain alignment).
   */
  function _scoreContext(jobData, profileData, extractedSkills) {
    var score = 50; // neutral base

    // Title word overlap
    var jobTitle = _normalize(jobData.title || '');
    var userTitle = _normalize(profileData.title || '');
    if (jobTitle && userTitle) {
      var jobWords = jobTitle.split(/\s+/).filter(function (w) { return w.length > 2; });
      var userWords = userTitle.split(/\s+/).filter(function (w) { return w.length > 2; });
      var overlap = 0;
      for (var i = 0; i < jobWords.length; i++) {
        for (var j = 0; j < userWords.length; j++) {
          if (jobWords[i] === userWords[j] || jobWords[i].indexOf(userWords[j]) !== -1 || userWords[j].indexOf(jobWords[i]) !== -1) {
            overlap++;
            break;
          }
        }
      }
      if (jobWords.length > 0) {
        score += (overlap / jobWords.length) * 40;
      }
    }

    // Skill density: more extracted skills = more data = slight boost
    if (extractedSkills.length >= 5) score += 5;
    if (extractedSkills.length >= 10) score += 5;

    return Math.min(100, score);
  }

  /**
   * Calculate overall confidence in the match score.
   * Confidence drops when: few skills extracted, vague description, missing data.
   */
  function _calculateConfidence(extractedSkills, jobData, skillMatches) {
    var conf = 0.7; // base

    // More extracted skills = higher confidence
    var skillCount = extractedSkills.length;
    if (skillCount >= 5) conf += 0.1;
    if (skillCount >= 8) conf += 0.05;
    if (skillCount === 0) conf -= 0.3;
    if (skillCount < 3) conf -= 0.15;

    // Has explicit skill list?
    if (jobData.skills && jobData.skills.length > 0) conf += 0.1;

    // Has budget info?
    if (jobData.budget || jobData.budgetMin) conf += 0.05;

    // Description length
    var descLen = (jobData.description || '').length;
    if (descLen > 500) conf += 0.05;
    if (descLen < 100) conf -= 0.15;
    if (descLen < 30) conf -= 0.15;

    // High proportion of taxonomy matches = more reliable
    var taxonomyMatches = 0;
    for (var i = 0; i < extractedSkills.length; i++) {
      if (extractedSkills[i].source === 'taxonomy' || extractedSkills[i].source === 'listed') {
        taxonomyMatches++;
      }
    }
    if (skillCount > 0 && taxonomyMatches / skillCount > 0.7) conf += 0.05;

    return Math.max(0.1, Math.min(1.0, conf));
  }

  /**
   * Generate actionable recommendation text.
   */
  function _generateRecommendation(tier, matched, missing, bonus, rateResult) {
    if (tier === 'excellent') {
      var msg = 'Strong match — your skills align well with this job.';
      if (bonus.length > 0) msg += ' Highlight your ' + bonus.slice(0, 2).join(' and ') + ' as bonus value.';
      if (!rateResult.match) msg += ' Note: your rate may be above budget — consider negotiating.';
      return msg;
    }
    if (tier === 'good') {
      var msg2 = 'Good fit. You match ' + matched.length + ' key skills.';
      if (missing.length > 0) msg2 += ' Gap: ' + missing.slice(0, 3).join(', ') + '. Mention transferable experience.';
      return msg2;
    }
    if (tier === 'fair') {
      if (missing.length > 0) {
        return 'Partial match. Missing: ' + missing.slice(0, 4).join(', ') + '. Consider if these are learnable quickly or if you have equivalent experience.';
      }
      return 'Partial match. Your profile partially overlaps with requirements.';
    }
    return 'Low match. This job requires skills significantly different from your profile.' +
           (missing.length > 0 ? ' Key gaps: ' + missing.slice(0, 3).join(', ') + '.' : '');
  }

  // ─── Batch NLP Matching ───────────────────────────────────────────

  /**
   * Match multiple jobs at once with NLP scoring.
   *
   * @param {object[]} jobs
   * @param {object} profileData
   * @param {object} [options]
   * @param {number} [options.minMatch] - Min match % (default 0)
   * @param {number} [options.minConfidence] - Min confidence 0-1 (default 0)
   * @param {number} [options.limit] - Max results (default 0 = all)
   * @param {string} [options.sortBy] - 'matchPercent' (default), 'confidence', 'skillScore'
   * @returns {{ job: object, match: NLPMatchResult }[]}
   */
  function batchNLPMatch(jobs, profileData, options) {
    if (!Array.isArray(jobs) || !profileData) return [];
    options = options || {};
    var minMatch = options.minMatch || 0;
    var minConf = options.minConfidence || 0;
    var sortBy = options.sortBy || 'matchPercent';
    var limit = options.limit || 0;

    var results = [];
    for (var i = 0; i < jobs.length; i++) {
      var match = calculateNLPMatch(jobs[i], profileData);
      if (match.matchPercent >= minMatch && match.confidence >= minConf) {
        results.push({ job: jobs[i], match: match });
      }
    }

    results.sort(function (a, b) {
      if (sortBy === 'confidence') {
        return b.match.confidence - a.match.confidence || b.match.matchPercent - a.match.matchPercent;
      }
      if (sortBy === 'skillScore') {
        return b.match.breakdown.skillScore - a.match.breakdown.skillScore;
      }
      return b.match.matchPercent - a.match.matchPercent;
    });

    if (limit > 0) results = results.slice(0, limit);
    return results;
  }

  // ─── Skill Gap Report ─────────────────────────────────────────────

  /**
   * Analyze skill gaps across multiple jobs using NLP extraction.
   *
   * @param {object[]} jobs
   * @param {object} profileData
   * @returns {{ demandedSkills: object[], ownedDemanded: string[], gapSkills: object[], categoryBreakdown: object }}
   */
  function nlpSkillGapReport(jobs, profileData) {
    if (!Array.isArray(jobs) || !profileData) return { demandedSkills: [], ownedDemanded: [], gapSkills: [], categoryBreakdown: {} };

    var userSkills = profileData.skills || [];
    var userCanonical = {};
    for (var u = 0; u < userSkills.length; u++) {
      var resolved = resolveCanonical(userSkills[u]);
      userCanonical[resolved || _normalize(userSkills[u])] = true;
    }

    var demand = {}; // skill → { count, sources }
    var catCount = {}; // category → count

    for (var i = 0; i < jobs.length; i++) {
      var text = (jobs[i].title || '') + ' ' + (jobs[i].description || '');
      var extracted = extractSkillsFromText(text);
      // Include listed skills
      var listed = jobs[i].skills || [];
      for (var l = 0; l < listed.length; l++) {
        var res = resolveCanonical(listed[l]);
        if (res) {
          var found = false;
          for (var x = 0; x < extracted.length; x++) {
            if (extracted[x].skill === res) { found = true; break; }
          }
          if (!found) extracted.push({ skill: res, source: 'listed', position: -1, confidence: 0.95 });
        }
      }

      var seenInJob = {};
      for (var e = 0; e < extracted.length; e++) {
        var sk = extracted[e].skill;
        if (seenInJob[sk]) continue;
        seenInJob[sk] = true;

        if (!demand[sk]) demand[sk] = { count: 0, avgConfidence: 0, confSum: 0 };
        demand[sk].count++;
        demand[sk].confSum += extracted[e].confidence;
        demand[sk].avgConfidence = demand[sk].confSum / demand[sk].count;

        var entry = SKILL_TAXONOMY[sk];
        if (entry && entry.category) {
          catCount[entry.category] = (catCount[entry.category] || 0) + 1;
        }
      }
    }

    var demandedSkills = [];
    var ownedDemanded = [];
    var gapSkills = [];

    var dKeys = Object.keys(demand);
    dKeys.sort(function (a, b) { return demand[b].count - demand[a].count; });

    for (var d = 0; d < dKeys.length; d++) {
      var sk2 = dKeys[d];
      var info = {
        skill: sk2,
        demandCount: demand[sk2].count,
        demandPercent: Math.round((demand[sk2].count / jobs.length) * 100),
        avgConfidence: Math.round(demand[sk2].avgConfidence * 100) / 100,
        isOwned: !!userCanonical[sk2]
      };
      demandedSkills.push(info);
      if (info.isOwned) {
        ownedDemanded.push(sk2);
      } else {
        gapSkills.push(info);
      }
    }

    return {
      demandedSkills: demandedSkills,
      ownedDemanded: ownedDemanded,
      gapSkills: gapSkills,
      categoryBreakdown: catCount,
      totalJobs: jobs.length
    };
  }

  // ─── Render NLP match detail ──────────────────────────────────────

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  /**
   * Render detailed NLP match breakdown for a job.
   */
  function renderNLPMatchDetail(jobData, profileData, container) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container || !jobData || !profileData) return;

    var m = calculateNLPMatch(jobData, profileData);
    var tierColors = { excellent: '#00ff88', good: '#88cc00', fair: '#ffaa00', low: '#ff4444' };
    var tc = tierColors[m.matchTier] || '#888';

    var html = '<div class="nlp-match-detail" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;color:#e0e0e0;border-radius:16px;overflow:hidden;border:1px solid #222;max-width:600px;">';

    // Header
    html += '<div style="padding:20px 24px;background:linear-gradient(135deg,#0a1a0a,#0a0a2e);border-bottom:1px solid #222;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    html += '<div>';
    html += '<h3 style="margin:0;font-size:16px;font-weight:700;color:#fff;">' + escapeHtml(jobData.title || 'Job') + '</h3>';
    html += '<div style="font-size:13px;color:' + tc + ';font-weight:600;margin-top:4px;text-transform:uppercase;">' + m.matchTier + ' match</div>';
    html += '</div>';
    html += '<div style="text-align:center;">';
    html += '<div style="font-size:32px;font-weight:900;color:' + tc + ';">' + m.matchPercent + '%</div>';
    html += '<div style="font-size:11px;color:#666;">confidence: ' + Math.round(m.confidence * 100) + '%</div>';
    html += '</div>';
    html += '</div></div>';

    // Score breakdown
    html += '<div style="display:flex;border-bottom:1px solid #222;">';
    var factors = [
      { label: 'Skills', value: m.breakdown.skillScore, weight: '55%' },
      { label: 'Rate', value: m.breakdown.rateScore, weight: '20%' },
      { label: 'Level', value: m.breakdown.expScore, weight: '10%' },
      { label: 'Context', value: m.breakdown.contextScore, weight: '15%' }
    ];
    for (var f = 0; f < factors.length; f++) {
      var fc = factors[f].value >= 70 ? '#00ff88' : factors[f].value >= 40 ? '#ffaa00' : '#ff4444';
      html += '<div style="flex:1;padding:12px 8px;text-align:center;' + (f < 3 ? 'border-right:1px solid #1a1a1a;' : '') + '">';
      html += '<div style="font-size:18px;font-weight:800;color:' + fc + ';">' + factors[f].value + '</div>';
      html += '<div style="font-size:10px;color:#666;text-transform:uppercase;">' + factors[f].label + ' (' + factors[f].weight + ')</div>';
      html += '</div>';
    }
    html += '</div>';

    // Skill matches detail
    if (m.skillMatches.length > 0) {
      html += '<div style="padding:14px 24px;border-bottom:1px solid #111;">';
      html += '<div style="font-size:12px;color:#aaa;font-weight:600;margin-bottom:8px;text-transform:uppercase;">Skill Analysis (' + m.extractedSkills.length + ' detected)</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      for (var s = 0; s < m.skillMatches.length; s++) {
        var sm = m.skillMatches[s];
        var tagColor, tagBg;
        if (sm.matchType === 'exact') { tagColor = '#00ff88'; tagBg = '#00ff8815'; }
        else if (sm.matchType === 'related') { tagColor = '#88cc00'; tagBg = '#88cc0015'; }
        else if (sm.matchType === 'partial') { tagColor = '#ffaa00'; tagBg = '#ffaa0015'; }
        else { tagColor = '#ff4444'; tagBg = '#ff444415'; }

        var tooltip = sm.matchType === 'exact' ? 'Direct match' :
                      sm.matchType === 'related' ? 'Related via ' + (sm.matchedVia || '?') :
                      sm.matchType === 'partial' ? 'Partial: ' + (sm.matchedVia || 'same category') :
                      'Not matched';

        html += '<span title="' + escapeHtml(tooltip) + '" style="font-size:11px;padding:3px 10px;border-radius:10px;background:' + tagBg + ';color:' + tagColor + ';border:1px solid ' + tagColor + '30;cursor:help;">';
        html += escapeHtml(sm.skill);
        if (sm.matchType === 'related') html += ' ~';
        html += '</span>';
      }
      html += '</div></div>';
    }

    // Bonus skills
    if (m.bonusSkills.length > 0) {
      html += '<div style="padding:10px 24px;border-bottom:1px solid #111;">';
      html += '<div style="font-size:11px;color:#00aaff;font-weight:600;margin-bottom:6px;text-transform:uppercase;">Your Bonus Skills</div>';
      html += '<div style="font-size:12px;color:#88bbff;">' + m.bonusSkills.map(escapeHtml).join(', ') + '</div>';
      html += '</div>';
    }

    // Recommendation
    html += '<div style="padding:14px 24px;font-size:13px;color:#999;">' + escapeHtml(m.recommendation) + '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  // ─── Public API ───────────────────────────────────────────────────

  window.CortexNLPMatcher = {
    calculateNLPMatch: calculateNLPMatch,
    batchNLPMatch: batchNLPMatch,
    extractSkillsFromText: extractSkillsFromText,
    nlpSkillGapReport: nlpSkillGapReport,
    renderNLPMatchDetail: renderNLPMatchDetail,
    resolveCanonical: resolveCanonical,
    version: '1.0.0'
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.NLPMatcher = window.CortexNLPMatcher;

})();
