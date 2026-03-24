/**
 * [CF-071] Cortex Skill Gap Analyzer with Personalized Learning Paths
 * Compares user skills against high-demand market data,
 * identifies gaps, and creates personalized learning paths
 * with course recommendations based on skill gaps.
 * Exposed as window.CortexFreelancer.SkillGapAnalyzer
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ══════════════════════════════════════════════
   * STORAGE
   * ══════════════════════════════════════════════ */
  var STORAGE_KEY = 'cortex_skill_gap_data';
  var PROGRESS_KEY = 'cortex_learning_progress';

  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch (_) { return {}; }
  }
  function saveData(d) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch (_) {}
  }
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; } catch (_) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * FREE LEARNING RESOURCES DATABASE (60+ real URLs)
   * ══════════════════════════════════════════════ */
  var LEARNING_RESOURCES = {
    'AI/LLM Integration': [
      { name: 'Hugging Face NLP Course', url: 'https://huggingface.co/learn/nlp-course', type: 'free', hours: 40 },
      { name: 'LangChain Docs & Tutorials', url: 'https://python.langchain.com/docs/get_started/introduction', type: 'free', hours: 20 },
      { name: 'OpenAI Cookbook', url: 'https://cookbook.openai.com', type: 'free', hours: 15 },
    ],
    'Prompt Engineering': [
      { name: 'Learn Prompting (open source)', url: 'https://learnprompting.org', type: 'free', hours: 10 },
      { name: 'OpenAI Prompt Engineering Guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering', type: 'free', hours: 5 },
      { name: 'Anthropic Prompt Engineering', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', type: 'free', hours: 8 },
    ],
    'React': [
      { name: 'React Official Docs', url: 'https://react.dev/learn', type: 'free', hours: 30 },
      { name: 'Scrimba – Learn React Free', url: 'https://scrimba.com/learn/learnreact', type: 'free', hours: 20 },
      { name: 'freeCodeCamp React Course', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react', type: 'free', hours: 40 },
    ],
    'Python': [
      { name: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial/', type: 'free', hours: 20 },
      { name: 'Automate the Boring Stuff', url: 'https://automatetheboringstuff.com', type: 'free', hours: 30 },
      { name: 'Real Python Tutorials', url: 'https://realpython.com', type: 'free', hours: 40 },
    ],
    'Machine Learning': [
      { name: 'fast.ai – Practical Deep Learning', url: 'https://course.fast.ai', type: 'free', hours: 60 },
      { name: 'Google ML Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', type: 'free', hours: 15 },
      { name: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', type: 'free', hours: 30 },
    ],
    'TypeScript': [
      { name: 'TypeScript Official Handbook', url: 'https://www.typescriptlang.org/docs/handbook/', type: 'free', hours: 15 },
      { name: 'Total TypeScript Beginners', url: 'https://www.totaltypescript.com/tutorials/beginners-typescript', type: 'free', hours: 10 },
      { name: 'Type Challenges', url: 'https://github.com/type-challenges/type-challenges', type: 'free', hours: 20 },
    ],
    'AWS': [
      { name: 'AWS Skill Builder (free tier)', url: 'https://skillbuilder.aws', type: 'free', hours: 40 },
      { name: 'AWS Well-Architected Labs', url: 'https://www.wellarchitectedlabs.com', type: 'free', hours: 20 },
    ],
    'Next.js': [
      { name: 'Next.js Learn Course', url: 'https://nextjs.org/learn', type: 'free', hours: 15 },
      { name: 'Next.js Official Docs', url: 'https://nextjs.org/docs', type: 'free', hours: 20 },
    ],
    'Kubernetes': [
      { name: 'Kubernetes Official Tutorials', url: 'https://kubernetes.io/docs/tutorials/', type: 'free', hours: 30 },
      { name: 'KodeKloud Free Labs', url: 'https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners/', type: 'free', hours: 25 },
    ],
    'Docker': [
      { name: 'Docker Official Getting Started', url: 'https://docs.docker.com/get-started/', type: 'free', hours: 10 },
      { name: 'Play with Docker Labs', url: 'https://labs.play-with-docker.com', type: 'free', hours: 15 },
    ],
    'Node.js': [
      { name: 'Node.js Official Guides', url: 'https://nodejs.org/en/learn', type: 'free', hours: 20 },
      { name: 'The Odin Project – NodeJS', url: 'https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs', type: 'free', hours: 40 },
    ],
    'Go/Golang': [
      { name: 'Go by Example', url: 'https://gobyexample.com', type: 'free', hours: 15 },
      { name: 'A Tour of Go', url: 'https://go.dev/tour/', type: 'free', hours: 10 },
    ],
    'Rust': [
      { name: 'The Rust Book', url: 'https://doc.rust-lang.org/book/', type: 'free', hours: 40 },
      { name: 'Rustlings Exercises', url: 'https://github.com/rust-lang/rustlings', type: 'free', hours: 20 },
    ],
    'Cybersecurity': [
      { name: 'TryHackMe Free Rooms', url: 'https://tryhackme.com', type: 'free', hours: 40 },
      { name: 'OWASP Web Security Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide/', type: 'free', hours: 25 },
    ],
    'Figma/UI Design': [
      { name: 'Figma Official Tutorials', url: 'https://help.figma.com/hc/en-us/categories/360002051613', type: 'free', hours: 20 },
      { name: 'Google UX Design (Coursera audit)', url: 'https://www.coursera.org/professional-certificates/google-ux-design', type: 'free', hours: 50 },
    ],
    'SEO': [
      { name: 'Moz Beginner Guide to SEO', url: 'https://moz.com/beginners-guide-to-seo', type: 'free', hours: 10 },
      { name: 'Google Search Central', url: 'https://developers.google.com/search/docs', type: 'free', hours: 15 },
    ],
    'Data Visualization': [
      { name: 'D3.js Official Tutorial', url: 'https://d3js.org/getting-started', type: 'free', hours: 25 },
    ],
    'PostgreSQL': [
      { name: 'PostgreSQL Official Tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html', type: 'free', hours: 15 },
      { name: 'SQLBolt Interactive Lessons', url: 'https://sqlbolt.com', type: 'free', hours: 8 },
    ],
  };

  /* ══════════════════════════════════════════════
   * SKILL META — salary boost & time estimates
   * ══════════════════════════════════════════════ */
  var SKILL_META = {
    'AI/LLM Integration':    { salaryBoost: '$15-30/hr', timeWeeks: 8,  priority: 10 },
    'Prompt Engineering':     { salaryBoost: '$10-25/hr', timeWeeks: 3,  priority: 9 },
    'React':                  { salaryBoost: '$10-20/hr', timeWeeks: 8,  priority: 8 },
    'Python':                 { salaryBoost: '$10-20/hr', timeWeeks: 6,  priority: 8 },
    'Machine Learning':       { salaryBoost: '$20-40/hr', timeWeeks: 16, priority: 9 },
    'TypeScript':             { salaryBoost: '$8-15/hr',  timeWeeks: 3,  priority: 7 },
    'AWS':                    { salaryBoost: '$10-25/hr', timeWeeks: 8,  priority: 8 },
    'Next.js':                { salaryBoost: '$8-15/hr',  timeWeeks: 3,  priority: 6 },
    'Kubernetes':             { salaryBoost: '$12-25/hr', timeWeeks: 8,  priority: 7 },
    'Docker':                 { salaryBoost: '$8-15/hr',  timeWeeks: 3,  priority: 7 },
    'Node.js':                { salaryBoost: '$8-15/hr',  timeWeeks: 6,  priority: 7 },
    'Go/Golang':              { salaryBoost: '$10-25/hr', timeWeeks: 8,  priority: 6 },
    'Rust':                   { salaryBoost: '$12-25/hr', timeWeeks: 12, priority: 5 },
    'Cybersecurity':          { salaryBoost: '$15-30/hr', timeWeeks: 16, priority: 6 },
    'Figma/UI Design':        { salaryBoost: '$5-15/hr',  timeWeeks: 6,  priority: 5 },
    'SEO':                    { salaryBoost: '$5-15/hr',  timeWeeks: 6,  priority: 5 },
    'Data Visualization':     { salaryBoost: '$5-15/hr',  timeWeeks: 6,  priority: 5 },
    'PostgreSQL':             { salaryBoost: '$5-12/hr',  timeWeeks: 3,  priority: 6 },
  };

  /* ══════════════════════════════════════════════
   * SKILL COMPLEMENTARITY
   * ══════════════════════════════════════════════ */
  var COMPLEMENTS = {
    'React':              ['JavaScript', 'CSS', 'HTML', 'Node.js', 'TypeScript', 'Next.js'],
    'TypeScript':         ['JavaScript', 'React', 'Node.js', 'Angular', 'Next.js'],
    'Next.js':            ['React', 'TypeScript', 'Node.js'],
    'Node.js':            ['JavaScript', 'TypeScript', 'React', 'Express', 'MongoDB'],
    'Python':             ['Data Analysis', 'Machine Learning', 'Django', 'FastAPI'],
    'Machine Learning':   ['Python', 'Data Analysis', 'Statistics', 'TensorFlow', 'PyTorch'],
    'AI/LLM Integration': ['Python', 'Prompt Engineering', 'Node.js', 'API Development'],
    'Prompt Engineering': ['AI/LLM Integration', 'Writing', 'Python'],
    'AWS':                ['Docker', 'Terraform', 'Linux', 'Kubernetes', 'DevOps/CI-CD'],
    'Docker':             ['Kubernetes', 'AWS', 'Linux', 'DevOps/CI-CD'],
    'Kubernetes':         ['Docker', 'AWS', 'Terraform', 'Linux', 'Go/Golang'],
    'Go/Golang':          ['Microservices', 'Docker', 'Kubernetes', 'Cloud'],
    'Rust':               ['Systems Programming', 'WebAssembly', 'C/C++'],
    'Cybersecurity':      ['Linux', 'Networking', 'Python'],
  };

  /* ══════════════════════════════════════════════
   * DEFAULT HIGH-DEMAND & BENCHMARK DATA
   * ══════════════════════════════════════════════ */
  var DEFAULT_HIGH_DEMAND = {
    skills: [
      { skill: 'AI/LLM Integration', demand: 'very-high', rank: 1, trend: 'rising', category: 'development' },
      { skill: 'Prompt Engineering', demand: 'very-high', rank: 2, trend: 'rising', category: 'development' },
      { skill: 'React', demand: 'very-high', rank: 3, trend: 'stable', category: 'development' },
      { skill: 'Python', demand: 'very-high', rank: 4, trend: 'stable', category: 'development' },
      { skill: 'TypeScript', demand: 'high', rank: 5, trend: 'rising', category: 'development' },
      { skill: 'AWS', demand: 'high', rank: 6, trend: 'stable', category: 'development' },
      { skill: 'Node.js', demand: 'high', rank: 7, trend: 'stable', category: 'development' },
      { skill: 'Machine Learning', demand: 'high', rank: 8, trend: 'rising', category: 'data' },
      { skill: 'Next.js', demand: 'high', rank: 9, trend: 'rising', category: 'development' },
      { skill: 'Docker', demand: 'high', rank: 10, trend: 'stable', category: 'development' },
      { skill: 'Kubernetes', demand: 'medium', rank: 11, trend: 'stable', category: 'development' },
      { skill: 'Go/Golang', demand: 'medium', rank: 12, trend: 'rising', category: 'development' },
      { skill: 'Rust', demand: 'medium', rank: 13, trend: 'rising', category: 'development' },
      { skill: 'Cybersecurity', demand: 'medium', rank: 14, trend: 'rising', category: 'development' },
      { skill: 'Figma/UI Design', demand: 'high', rank: 15, trend: 'stable', category: 'design' },
      { skill: 'SEO', demand: 'medium', rank: 16, trend: 'stable', category: 'marketing' },
      { skill: 'Data Visualization', demand: 'medium', rank: 17, trend: 'stable', category: 'data' },
      { skill: 'PostgreSQL', demand: 'high', rank: 18, trend: 'stable', category: 'development' },
    ],
  };

  var DEFAULT_BENCHMARKS = { categories: {} };

  /* ══════════════════════════════════════════════
   * CORE ANALYSIS ENGINE
   * ══════════════════════════════════════════════ */

  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function skillMatches(userSkill, hdSkill) {
    var a = normalize(userSkill);
    var b = normalize(hdSkill);
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    var aliases = {
      'js': 'javascript', 'ts': 'typescript', 'py': 'python',
      'k8s': 'kubernetes', 'rn': 'reactnative', 'golang': 'gogolang',
      'pg': 'postgresql', 'postgres': 'postgresql',
    };
    return (aliases[a] || a) === (aliases[b] || b);
  }

  function analyzeSkillGaps(profileData, highDemandSkills, marketBenchmarks) {
    var userSkills = profileData.skills || [];
    var userCategory = profileData.category || '';
    var allHD = (highDemandSkills || DEFAULT_HIGH_DEMAND).skills || [];

    var categorySkills = allHD.filter(function (s) { return s.category === userCategory; });
    var crossCategorySkills = allHD.filter(function (s) { return s.category !== userCategory; });
    var orderedSkills = categorySkills.concat(crossCategorySkills);

    var strengths = [];
    var gaps = [];
    var opportunities = [];

    orderedSkills.forEach(function (hd) {
      var matched = userSkills.some(function (us) { return skillMatches(us, hd.skill); });
      if (matched) {
        strengths.push({ skill: hd.skill, demand: hd.demand, rank: hd.rank, trend: hd.trend, category: hd.category });
      } else {
        var meta = SKILL_META[hd.skill] || { salaryBoost: '$5-15/hr', timeWeeks: 6, priority: 5 };
        var resources = LEARNING_RESOURCES[hd.skill] || [
          { name: hd.skill + ' — Google Search', url: 'https://www.google.com/search?q=learn+' + encodeURIComponent(hd.skill) + '+free', type: 'free', hours: 20 },
        ];

        var complements = [];
        var compMap = COMPLEMENTS[hd.skill] || [];
        userSkills.forEach(function (us) {
          if (compMap.some(function (c) { return skillMatches(us, c); })) {
            complements.push('Works great with your ' + us + ' skills');
          }
        });

        var entry = {
          skill: hd.skill,
          demandTier: hd.demand,
          rank: hd.rank,
          trend: hd.trend,
          category: hd.category,
          estimatedSalaryBoost: meta.salaryBoost,
          timeWeeks: meta.timeWeeks,
          priority: meta.priority,
          learningResources: resources,
          complementsExisting: complements.length > 0 ? complements : ['Expands your skillset into ' + hd.category],
        };

        if (hd.trend === 'rising') opportunities.push(entry);
        gaps.push(entry);
      }
    });

    // Sort gaps by priority + demand
    var tierOrder = { 'very-high': 0, 'high': 1, 'medium': 2 };
    gaps.sort(function (a, b) {
      var catA = a.category === userCategory ? 0 : 1;
      var catB = b.category === userCategory ? 0 : 1;
      if (catA !== catB) return catA - catB;
      var tA = tierOrder[a.demandTier] || 3;
      var tB = tierOrder[b.demandTier] || 3;
      if (tA !== tB) return tA - tB;
      return b.priority - a.priority;
    });

    var learningPath = gaps.slice(0, 10);

    var topGapSkills = learningPath.slice(0, 3).map(function (g) { return g.skill; });
    var earningsBoostText = topGapSkills.length >= 2
      ? 'Learning ' + topGapSkills.slice(0, 2).join(' + ') + ' could increase your rate by $15-30/hr'
      : topGapSkills.length === 1
        ? 'Learning ' + topGapSkills[0] + ' could increase your rate by $10-20/hr'
        : 'Your skills already cover the top demand areas!';

    return {
      strengths: strengths,
      gaps: gaps,
      opportunities: opportunities.slice(0, 15),
      learningPath: learningPath,
      earningsBoost: { text: earningsBoostText, topSkills: topGapSkills },
      stats: {
        totalHighDemandSkills: allHD.length,
        matchedSkills: strengths.length,
        missingSkills: gaps.length,
        matchRate: allHD.length > 0 ? Math.round((strengths.length / allHD.length) * 100) : 0,
      },
    };
  }

  /* ══════════════════════════════════════════════
   * PERSONALIZED LEARNING PATH GENERATOR
   * ══════════════════════════════════════════════ */

  function generateLearningPath(config) {
    config = config || {};
    var targetSkills = config.targetSkills || [];
    var hoursPerWeek = config.hoursPerWeek || 10;
    var currentSkills = config.currentSkills || [];
    var goalType = config.goalType || 'career_growth'; // career_growth | rate_increase | new_niche

    var path = [];
    var weekCounter = 0;

    targetSkills.forEach(function (skillName) {
      var meta = SKILL_META[skillName] || { salaryBoost: '$5-15/hr', timeWeeks: 6, priority: 5 };
      var resources = LEARNING_RESOURCES[skillName] || [];
      var totalHours = meta.timeWeeks * hoursPerWeek;

      // Build week-by-week plan
      var weeks = [];
      var resourceIdx = 0;

      for (var w = 0; w < meta.timeWeeks; w++) {
        var weekPlan = {
          week: weekCounter + w + 1,
          hours: hoursPerWeek,
          tasks: [],
          milestone: '',
        };

        // Phase-based learning
        var phase = w / meta.timeWeeks;
        if (phase < 0.3) {
          weekPlan.tasks.push('Study fundamentals and core concepts');
          weekPlan.tasks.push('Complete introductory tutorials');
          if (resources[resourceIdx]) {
            weekPlan.tasks.push('Work through: ' + resources[resourceIdx].name);
          }
          weekPlan.milestone = 'Understand core concepts of ' + skillName;
        } else if (phase < 0.6) {
          weekPlan.tasks.push('Build hands-on projects');
          weekPlan.tasks.push('Practice with real-world examples');
          if (resources[resourceIdx]) {
            weekPlan.tasks.push('Deep-dive: ' + resources[resourceIdx].name);
          }
          weekPlan.milestone = 'Complete first project with ' + skillName;
        } else if (phase < 0.85) {
          weekPlan.tasks.push('Work on portfolio-worthy project');
          weekPlan.tasks.push('Explore advanced patterns and best practices');
          weekPlan.milestone = 'Build portfolio piece demonstrating ' + skillName;
        } else {
          weekPlan.tasks.push('Polish portfolio project');
          weekPlan.tasks.push('Update freelance profile with new skill');
          weekPlan.tasks.push('Apply to jobs requiring ' + skillName);
          weekPlan.milestone = 'Ready to take paid ' + skillName + ' work';
        }

        if (resourceIdx < resources.length - 1 && w % Math.ceil(meta.timeWeeks / resources.length) === 0) {
          resourceIdx++;
        }

        weeks.push(weekPlan);
      }

      path.push({
        skill: skillName,
        salaryBoost: meta.salaryBoost,
        totalWeeks: meta.timeWeeks,
        totalHours: totalHours,
        startWeek: weekCounter + 1,
        endWeek: weekCounter + meta.timeWeeks,
        resources: resources,
        weeks: weeks,
        prerequisites: (COMPLEMENTS[skillName] || []).filter(function (c) {
          return currentSkills.some(function (us) { return skillMatches(us, c); });
        }),
      });

      weekCounter += meta.timeWeeks;
    });

    return {
      totalWeeks: weekCounter,
      totalHours: weekCounter * hoursPerWeek,
      hoursPerWeek: hoursPerWeek,
      goalType: goalType,
      skills: path,
      estimatedCompletion: new Date(Date.now() + weekCounter * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
  }

  /* ══════════════════════════════════════════════
   * COURSE RECOMMENDER
   * ══════════════════════════════════════════════ */

  function recommendCourses(skillName, currentLevel) {
    currentLevel = currentLevel || 'beginner';
    var resources = LEARNING_RESOURCES[skillName] || [];
    var meta = SKILL_META[skillName] || {};

    var recommendations = resources.map(function (r, idx) {
      var difficulty = idx === 0 ? 'beginner' : idx === resources.length - 1 ? 'advanced' : 'intermediate';
      return {
        name: r.name,
        url: r.url,
        type: r.type,
        estimatedHours: r.hours || 20,
        difficulty: difficulty,
        recommended: (currentLevel === 'beginner' && difficulty === 'beginner') ||
                     (currentLevel === 'intermediate' && difficulty !== 'beginner') ||
                     (currentLevel === 'advanced' && difficulty === 'advanced'),
      };
    });

    return {
      skill: skillName,
      salaryBoost: meta.salaryBoost || 'N/A',
      timeWeeks: meta.timeWeeks || 6,
      courses: recommendations,
      quickStart: recommendations[0] || null,
    };
  }

  /* ══════════════════════════════════════════════
   * RENDER (containerId version)
   * ══════════════════════════════════════════════ */

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function trendIcon(trend) {
    if (trend === 'rising') return '↗';
    if (trend === 'declining') return '↘';
    return '→';
  }

  function render(containerId) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;

    var data = loadData();
    var profileData = data.profileData || { skills: [], category: 'development' };
    var analysis = analyzeSkillGaps(profileData, DEFAULT_HIGH_DEMAND, DEFAULT_BENCHMARKS);
    var progress = loadProgress();

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:800px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:24px;">';
    html += '<h2 style="margin:0 0 6px;font-size:22px;color:#f4f4f5;">🧠 Skill Gap Analysis</h2>';
    html += '<p style="margin:0;font-size:14px;color:#a1a1aa;">Comparing your skills against top ' + analysis.stats.totalHighDemandSkills + ' in-demand skills</p>';
    html += '</div>';

    // Stats cards
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px;">';
    var stats = [
      { value: analysis.stats.matchRate + '%', label: 'Market Match', color: '#4ade80' },
      { value: analysis.stats.matchedSkills, label: 'Strengths', color: '#4ade80' },
      { value: analysis.stats.missingSkills, label: 'To Learn', color: '#fbbf24' },
      { value: analysis.opportunities.length, label: 'Rising Trends', color: '#818cf8' },
    ];
    stats.forEach(function (s) {
      html += '<div style="flex:1;min-width:120px;background:#1a1a2e;border-radius:12px;padding:14px;text-align:center;">';
      html += '<div style="font-size:24px;font-weight:700;color:' + s.color + ';">' + s.value + '</div>';
      html += '<div style="font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">' + s.label + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Strengths
    if (analysis.strengths.length > 0) {
      html += '<div style="margin-bottom:24px;">';
      html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 12px;">💪 Your Strengths</h3>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
      analysis.strengths.forEach(function (s) {
        html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:20px;font-size:13px;background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.25);">';
        html += esc(s.skill) + ' <span style="font-size:11px;opacity:0.7;">' + trendIcon(s.trend) + '</span>';
        html += '</span>';
      });
      html += '</div></div>';
    }

    // Learning Path
    html += '<div style="margin-bottom:24px;">';
    html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 12px;">🗺️ Recommended Learning Path</h3>';

    analysis.learningPath.forEach(function (item, idx) {
      var isComplete = progress[item.skill] === 'complete';
      var opacity = isComplete ? '0.5' : '1';

      html += '<div style="background:#1a1a2e;border-radius:12px;padding:16px;margin-bottom:10px;border-left:3px solid ' + (isComplete ? '#22c55e' : '#6366f1') + ';opacity:' + opacity + ';">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">';
      html += '<span style="font-size:14px;font-weight:600;color:#f4f4f5;">' + (idx + 1) + '. ' + esc(item.skill) + '</span>';
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
      html += '<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(99,102,241,0.15);color:#a5b4fc;">⏱ ' + item.timeWeeks + ' weeks</span>';
      html += '<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(34,197,94,0.15);color:#86efac;">💰 ' + esc(item.estimatedSalaryBoost) + '</span>';
      html += '</div></div>';

      // Resources
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">';
      item.learningResources.forEach(function (r) {
        html += '<a href="' + esc(r.url) + '" target="_blank" rel="noopener" style="font-size:12px;color:#60a5fa;text-decoration:none;background:rgba(96,165,250,0.1);padding:3px 8px;border-radius:6px;">' + esc(r.name) + '</a>';
      });
      html += '</div>';

      if (item.complementsExisting.length > 0) {
        html += '<div style="font-size:12px;color:#a1a1aa;margin-top:6px;font-style:italic;">' + esc(item.complementsExisting[0]) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';

    // Earnings boost card
    html += '<div style="background:linear-gradient(135deg,rgba(34,197,94,0.12) 0%,rgba(99,102,241,0.12) 100%);border:1px solid rgba(34,197,94,0.2);border-radius:14px;padding:24px;text-align:center;">';
    html += '<div style="font-size:32px;margin-bottom:8px;">💸</div>';
    html += '<p style="font-size:16px;font-weight:600;color:#4ade80;margin:0 0 6px;">' + esc(analysis.earningsBoost.text) + '</p>';
    html += '<p style="font-size:13px;color:#a1a1aa;margin:0;">Based on current market rates and skill demand data</p>';
    html += '</div>';

    html += '</div>';
    el.innerHTML = html;
    return analysis;
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */

  function init(options) {
    options = options || {};
    if (options.skills || options.category) {
      saveData({ profileData: { skills: options.skills || [], category: options.category || 'development' } });
    }
    return {
      ready: true,
      data: loadData(),
      progress: loadProgress(),
    };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.SkillGapAnalyzer = {
    init: init,
    render: render,
    analyzeSkillGaps: analyzeSkillGaps,
    generateLearningPath: generateLearningPath,
    recommendCourses: recommendCourses,
    saveProfile: function (profileData) { saveData({ profileData: profileData }); },
    markSkillComplete: function (skill) { var p = loadProgress(); p[skill] = 'complete'; saveProgress(p); },
    markSkillInProgress: function (skill) { var p = loadProgress(); p[skill] = 'in_progress'; saveProgress(p); },
    getProgress: loadProgress,
    LEARNING_RESOURCES: LEARNING_RESOURCES,
    SKILL_META: SKILL_META,
    COMPLEMENTS: COMPLEMENTS,
    version: '2.0.0',
  };

  // Legacy compatibility
  window.CortexSkillGapAnalyzer = window.CortexFreelancer.SkillGapAnalyzer;

})();
