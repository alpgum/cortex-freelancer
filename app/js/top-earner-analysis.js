/**
 * [CF-065] Top Earner Reverse Engineering
 * Analyze top earners in user's category: skills, rates, portfolio items,
 * profile elements they share. Mock dataset, pattern extraction.
 *
 * Exposed on window.CortexFreelancer.topEarnerAnalysis
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Mock Top Earner Datasets by Category ─────────────────────────

  var TOP_EARNERS = {
    'Web Development': [
      { name: 'Alex K.', rate: 125, earned: 890000, jss: 99, jobs: 312, skills: ['React','Node.js','TypeScript','AWS','GraphQL','PostgreSQL'], portfolio: 8, certifications: ['AWS Certified','Meta Front-End'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'Full-stack SaaS', yearsOnPlatform: 6 },
      { name: 'Maria S.', rate: 110, earned: 720000, jss: 98, jobs: 245, skills: ['React','Next.js','TypeScript','Tailwind','Vercel','Prisma'], portfolio: 12, certifications: ['Upwork Expert-Vetted'], profileLength: 'long', hasVideo: true, responseTime: '< 2hr', specialization: 'Frontend Architecture', yearsOnPlatform: 5 },
      { name: 'James R.', rate: 95, earned: 650000, jss: 97, jobs: 289, skills: ['Vue.js','Node.js','MongoDB','Docker','CI/CD','REST API'], portfolio: 6, certifications: ['Google Cloud','Docker DCA'], profileLength: 'medium', hasVideo: false, responseTime: '< 4hr', specialization: 'API & Microservices', yearsOnPlatform: 7 },
      { name: 'Sarah L.', rate: 115, earned: 580000, jss: 100, jobs: 178, skills: ['React','TypeScript','GraphQL','AWS','Terraform','Redis'], portfolio: 10, certifications: ['AWS Solutions Architect'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'Enterprise Web Apps', yearsOnPlatform: 4 },
      { name: 'Chen W.', rate: 90, earned: 540000, jss: 96, jobs: 320, skills: ['Angular','Node.js','PostgreSQL','Docker','Kubernetes','RxJS'], portfolio: 5, certifications: [], profileLength: 'medium', hasVideo: false, responseTime: '< 2hr', specialization: 'Enterprise Angular', yearsOnPlatform: 8 }
    ],
    'AI/LLM': [
      { name: 'Dr. Priya M.', rate: 200, earned: 420000, jss: 100, jobs: 67, skills: ['Python','LangChain','OpenAI API','RAG','Vector DBs','Fine-tuning','PyTorch'], portfolio: 6, certifications: ['DeepLearning.AI','Stanford ML'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'LLM Applications', yearsOnPlatform: 2 },
      { name: 'Raj T.', rate: 175, earned: 380000, jss: 98, jobs: 85, skills: ['Python','GPT-4','Claude API','LangChain','Pinecone','FastAPI','Docker'], portfolio: 8, certifications: ['AWS ML Specialty'], profileLength: 'long', hasVideo: true, responseTime: '< 2hr', specialization: 'AI Chatbots & Agents', yearsOnPlatform: 3 },
      { name: 'Elena V.', rate: 160, earned: 310000, jss: 97, jobs: 72, skills: ['Python','Transformers','HuggingFace','LLM Fine-tuning','RLHF','MLOps'], portfolio: 4, certifications: ['Google ML Engineer'], profileLength: 'medium', hasVideo: false, responseTime: '< 4hr', specialization: 'Model Fine-tuning', yearsOnPlatform: 2 },
      { name: 'Marcus J.', rate: 150, earned: 290000, jss: 96, jobs: 94, skills: ['Python','OpenAI','Anthropic','RAG','Weaviate','Next.js','Vercel AI'], portfolio: 10, certifications: [], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'AI-Powered Products', yearsOnPlatform: 3 },
      { name: 'Yuki H.', rate: 185, earned: 260000, jss: 99, jobs: 48, skills: ['Python','PyTorch','Transformers','CUDA','MLOps','Kubernetes'], portfolio: 3, certifications: ['NVIDIA DLI'], profileLength: 'medium', hasVideo: false, responseTime: '< 2hr', specialization: 'Deep Learning R&D', yearsOnPlatform: 1 }
    ],
    'Mobile Development': [
      { name: 'David P.', rate: 120, earned: 780000, jss: 99, jobs: 201, skills: ['React Native','iOS','Android','TypeScript','Firebase','Redux'], portfolio: 15, certifications: ['Meta React Native'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'Cross-platform Apps', yearsOnPlatform: 6 },
      { name: 'Fatima A.', rate: 105, earned: 620000, jss: 98, jobs: 175, skills: ['Swift','SwiftUI','Objective-C','CoreData','CloudKit','CI/CD'], portfolio: 12, certifications: ['Apple Developer'], profileLength: 'long', hasVideo: true, responseTime: '< 2hr', specialization: 'iOS Native', yearsOnPlatform: 7 },
      { name: 'Tom B.', rate: 95, earned: 550000, jss: 97, jobs: 230, skills: ['Kotlin','Jetpack Compose','Android','Firebase','Room','Retrofit'], portfolio: 9, certifications: ['Google Associate Android'], profileLength: 'medium', hasVideo: false, responseTime: '< 4hr', specialization: 'Android Native', yearsOnPlatform: 5 },
      { name: 'Ling Z.', rate: 110, earned: 490000, jss: 96, jobs: 156, skills: ['Flutter','Dart','Firebase','REST API','BLoC','CI/CD'], portfolio: 11, certifications: [], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'Flutter Apps', yearsOnPlatform: 4 },
      { name: 'Carlos M.', rate: 100, earned: 430000, jss: 98, jobs: 189, skills: ['React Native','Expo','TypeScript','GraphQL','AWS Amplify'], portfolio: 7, certifications: ['AWS Developer'], profileLength: 'medium', hasVideo: false, responseTime: '< 2hr', specialization: 'RN + Backend', yearsOnPlatform: 5 }
    ],
    'Data Science': [
      { name: 'Dr. Anna W.', rate: 150, earned: 520000, jss: 100, jobs: 112, skills: ['Python','R','SQL','Tableau','Spark','Scikit-learn','Pandas'], portfolio: 6, certifications: ['Google Data Analytics','IBM Data Science'], profileLength: 'long', hasVideo: true, responseTime: '< 2hr', specialization: 'Business Intelligence', yearsOnPlatform: 5 },
      { name: 'Oleg N.', rate: 130, earned: 480000, jss: 98, jobs: 145, skills: ['Python','SQL','Power BI','Airflow','dbt','Snowflake'], portfolio: 8, certifications: ['Snowflake SnowPro'], profileLength: 'long', hasVideo: false, responseTime: '< 4hr', specialization: 'Data Engineering', yearsOnPlatform: 6 },
      { name: 'Nina F.', rate: 140, earned: 390000, jss: 97, jobs: 98, skills: ['Python','Pandas','Matplotlib','Jupyter','Statistical Modeling','A/B Testing'], portfolio: 5, certifications: ['Coursera ML Specialization'], profileLength: 'medium', hasVideo: true, responseTime: '< 1hr', specialization: 'Product Analytics', yearsOnPlatform: 4 },
      { name: 'Hassan K.', rate: 120, earned: 360000, jss: 96, jobs: 167, skills: ['Python','SQL','Tableau','Excel','ETL','BigQuery'], portfolio: 4, certifications: [], profileLength: 'medium', hasVideo: false, responseTime: '< 2hr', specialization: 'Data Analysis', yearsOnPlatform: 7 },
      { name: 'Sophie T.', rate: 135, earned: 330000, jss: 99, jobs: 89, skills: ['Python','R','NLP','Deep Learning','TensorFlow','MLflow'], portfolio: 7, certifications: ['DeepLearning.AI','TensorFlow Developer'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'NLP & Text Analytics', yearsOnPlatform: 3 }
    ],
    'DevOps': [
      { name: 'Mike R.', rate: 140, earned: 610000, jss: 99, jobs: 178, skills: ['AWS','Terraform','Kubernetes','Docker','CI/CD','Linux','Python'], portfolio: 5, certifications: ['AWS DevOps Pro','CKA','Terraform Associate'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'Cloud Infrastructure', yearsOnPlatform: 6 },
      { name: 'Katya S.', rate: 125, earned: 490000, jss: 98, jobs: 145, skills: ['GCP','Kubernetes','Helm','ArgoCD','Prometheus','Grafana'], portfolio: 4, certifications: ['GCP Professional Cloud DevOps'], profileLength: 'long', hasVideo: false, responseTime: '< 2hr', specialization: 'GCP & K8s', yearsOnPlatform: 5 },
      { name: 'Bruno L.', rate: 115, earned: 420000, jss: 97, jobs: 210, skills: ['AWS','Docker','Jenkins','Ansible','Terraform','Bash'], portfolio: 3, certifications: ['AWS Solutions Architect'], profileLength: 'medium', hasVideo: false, responseTime: '< 4hr', specialization: 'CI/CD Pipelines', yearsOnPlatform: 7 },
      { name: 'Aisha D.', rate: 130, earned: 380000, jss: 96, jobs: 120, skills: ['Azure','Kubernetes','Terraform','GitHub Actions','Datadog','Python'], portfolio: 6, certifications: ['Azure DevOps Expert','CKA'], profileLength: 'long', hasVideo: true, responseTime: '< 1hr', specialization: 'Azure & Monitoring', yearsOnPlatform: 4 },
      { name: 'Sven O.', rate: 120, earned: 350000, jss: 98, jobs: 165, skills: ['AWS','Pulumi','ECS','Lambda','CloudFormation','Go'], portfolio: 7, certifications: ['AWS Developer Associate'], profileLength: 'medium', hasVideo: false, responseTime: '< 2hr', specialization: 'Serverless', yearsOnPlatform: 5 }
    ]
  };

  // ─── Default/fallback earners for unknown categories ──────────────
  var DEFAULT_EARNERS = [
    { name: 'Top Performer A', rate: 100, earned: 500000, jss: 98, jobs: 200, skills: ['Communication','Problem Solving','Delivery','Documentation'], portfolio: 6, certifications: ['Industry Cert'], profileLength: 'long', hasVideo: true, responseTime: '< 2hr', specialization: 'Generalist', yearsOnPlatform: 5 },
    { name: 'Top Performer B', rate: 90, earned: 400000, jss: 97, jobs: 180, skills: ['Communication','Time Management','Quality','Reporting'], portfolio: 4, certifications: [], profileLength: 'medium', hasVideo: false, responseTime: '< 4hr', specialization: 'Generalist', yearsOnPlatform: 6 }
  ];

  // ─── Pattern Extraction ───────────────────────────────────────────

  function _getEarners(category) {
    return TOP_EARNERS[category] || DEFAULT_EARNERS;
  }

  /**
   * Extract common skills among top earners.
   */
  function _extractSkillPatterns(earners) {
    var skillCount = {};
    earners.forEach(function (e) {
      (e.skills || []).forEach(function (s) {
        skillCount[s] = (skillCount[s] || 0) + 1;
      });
    });
    var total = earners.length;
    return Object.keys(skillCount)
      .map(function (s) { return { skill: s, count: skillCount[s], frequency: Math.round((skillCount[s] / total) * 100) }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  /**
   * Extract profile element patterns.
   */
  function _extractProfilePatterns(earners) {
    var total = earners.length;
    var withVideo = earners.filter(function (e) { return e.hasVideo; }).length;
    var withCerts = earners.filter(function (e) { return e.certifications && e.certifications.length > 0; }).length;
    var longProfile = earners.filter(function (e) { return e.profileLength === 'long'; }).length;
    var fastResponse = earners.filter(function (e) { return e.responseTime === '< 1hr'; }).length;
    var avgPortfolio = Math.round(earners.reduce(function (s, e) { return s + (e.portfolio || 0); }, 0) / total);
    var avgJSS = Math.round(earners.reduce(function (s, e) { return s + (e.jss || 0); }, 0) / total * 10) / 10;
    var avgYears = Math.round(earners.reduce(function (s, e) { return s + (e.yearsOnPlatform || 0); }, 0) / total * 10) / 10;

    return {
      videoIntroPercent: Math.round((withVideo / total) * 100),
      certificationsPercent: Math.round((withCerts / total) * 100),
      longProfilePercent: Math.round((longProfile / total) * 100),
      fastResponsePercent: Math.round((fastResponse / total) * 100),
      avgPortfolioItems: avgPortfolio,
      avgJSS: avgJSS,
      avgYearsOnPlatform: avgYears
    };
  }

  /**
   * Extract rate statistics.
   */
  function _extractRateStats(earners) {
    var rates = earners.map(function (e) { return e.rate; }).sort(function (a, b) { return a - b; });
    var earnings = earners.map(function (e) { return e.earned; }).sort(function (a, b) { return a - b; });
    return {
      minRate: rates[0],
      maxRate: rates[rates.length - 1],
      medianRate: rates[Math.floor(rates.length / 2)],
      avgRate: Math.round(rates.reduce(function (s, v) { return s + v; }, 0) / rates.length),
      minEarned: earnings[0],
      maxEarned: earnings[earnings.length - 1],
      avgEarned: Math.round(earnings.reduce(function (s, v) { return s + v; }, 0) / earnings.length)
    };
  }

  // ─── Public API ───────────────────────────────────────────────────

  /**
   * Full analysis of top earners in a category.
   */
  function analyzeCategory(category) {
    var earners = _getEarners(category);
    var skillPatterns = _extractSkillPatterns(earners);
    var profilePatterns = _extractProfilePatterns(earners);
    var rateStats = _extractRateStats(earners);

    // Must-have skills (>= 60% frequency)
    var mustHaveSkills = skillPatterns.filter(function (s) { return s.frequency >= 60; });
    // Differentiator skills (20-59%)
    var differentiatorSkills = skillPatterns.filter(function (s) { return s.frequency >= 20 && s.frequency < 60; });

    // Specialization patterns
    var specializations = earners.map(function (e) { return e.specialization; });

    return {
      category: category,
      sampleSize: earners.length,
      rateStats: rateStats,
      skillPatterns: skillPatterns,
      mustHaveSkills: mustHaveSkills.map(function (s) { return s.skill; }),
      differentiatorSkills: differentiatorSkills.map(function (s) { return s.skill; }),
      profilePatterns: profilePatterns,
      specializations: specializations,
      topEarners: earners.map(function (e) {
        return { name: e.name, rate: e.rate, earned: e.earned, jss: e.jss, specialization: e.specialization };
      })
    };
  }

  /**
   * Compare user profile against top earners, return gap analysis.
   */
  function compareToTopEarners(category, userProfile) {
    userProfile = userProfile || {};
    var analysis = analyzeCategory(category);
    var earners = _getEarners(category);

    // Skill gap
    var userSkills = (userProfile.skills || []).map(function (s) { return s.toLowerCase(); });
    var missingMustHave = analysis.mustHaveSkills.filter(function (s) {
      return userSkills.indexOf(s.toLowerCase()) === -1;
    });
    var missingDifferentiators = analysis.differentiatorSkills.filter(function (s) {
      return userSkills.indexOf(s.toLowerCase()) === -1;
    });
    var matchedSkills = analysis.mustHaveSkills.filter(function (s) {
      return userSkills.indexOf(s.toLowerCase()) !== -1;
    });

    // Profile gap
    var profileGaps = [];
    var pp = analysis.profilePatterns;
    if (pp.videoIntroPercent >= 60 && !userProfile.hasVideo) profileGaps.push('Add a video introduction (' + pp.videoIntroPercent + '% of top earners have one)');
    if (pp.certificationsPercent >= 60 && !(userProfile.certifications && userProfile.certifications.length)) profileGaps.push('Add relevant certifications (' + pp.certificationsPercent + '% of top earners have them)');
    if (pp.longProfilePercent >= 60 && userProfile.profileLength !== 'long') profileGaps.push('Write a detailed profile bio (top earners average long-form profiles)');
    if ((userProfile.portfolio || 0) < pp.avgPortfolioItems) profileGaps.push('Add more portfolio items (top earners average ' + pp.avgPortfolioItems + ', you have ' + (userProfile.portfolio || 0) + ')');

    // Rate positioning
    var userRate = userProfile.hourlyRate || userProfile.rate || 0;
    var ratePosition = 'unknown';
    if (userRate > 0) {
      if (userRate >= analysis.rateStats.maxRate) ratePosition = 'above_top';
      else if (userRate >= analysis.rateStats.medianRate) ratePosition = 'competitive';
      else if (userRate >= analysis.rateStats.minRate) ratePosition = 'below_median';
      else ratePosition = 'well_below';
    }

    // Score (0-100)
    var score = 0;
    var maxScore = 100;
    // Skills: 40 pts
    var skillScore = analysis.mustHaveSkills.length > 0
      ? Math.round((matchedSkills.length / analysis.mustHaveSkills.length) * 40)
      : 20;
    score += skillScore;
    // Profile completeness: 30 pts
    var profileScore = 0;
    if (userProfile.hasVideo) profileScore += 8;
    if (userProfile.certifications && userProfile.certifications.length) profileScore += 7;
    if (userProfile.profileLength === 'long') profileScore += 8;
    if ((userProfile.portfolio || 0) >= pp.avgPortfolioItems) profileScore += 7;
    score += profileScore;
    // Rate: 15 pts
    if (ratePosition === 'competitive' || ratePosition === 'above_top') score += 15;
    else if (ratePosition === 'below_median') score += 8;
    // JSS: 15 pts
    if ((userProfile.jss || 0) >= pp.avgJSS) score += 15;
    else if ((userProfile.jss || 0) >= 90) score += 10;
    else if ((userProfile.jss || 0) >= 80) score += 5;

    // Recommendations
    var recommendations = [];
    if (missingMustHave.length > 0) recommendations.push('Learn these must-have skills: ' + missingMustHave.join(', '));
    if (missingDifferentiators.length > 0) recommendations.push('Consider adding differentiator skills: ' + missingDifferentiators.slice(0, 3).join(', '));
    profileGaps.forEach(function (g) { recommendations.push(g); });
    if (ratePosition === 'well_below') recommendations.push('Your rate ($' + userRate + '/hr) is well below top earners ($' + analysis.rateStats.minRate + '-' + analysis.rateStats.maxRate + '/hr). Gradually increase as you build reputation.');
    if (recommendations.length === 0) recommendations.push('Your profile closely matches top earner patterns. Focus on maintaining quality and accumulating reviews.');

    return {
      category: category,
      score: Math.min(score, maxScore),
      matchedSkills: matchedSkills,
      missingMustHave: missingMustHave,
      missingDifferentiators: missingDifferentiators,
      profileGaps: profileGaps,
      ratePosition: ratePosition,
      recommendations: recommendations,
      benchmarks: {
        avgRate: analysis.rateStats.avgRate,
        avgPortfolio: pp.avgPortfolioItems,
        avgJSS: pp.avgJSS,
        videoPercent: pp.videoIntroPercent,
        certPercent: pp.certificationsPercent
      }
    };
  }

  /**
   * Get ranked list of skills to learn for a category.
   */
  function getSkillRoadmap(category, currentSkills) {
    var earners = _getEarners(category);
    var patterns = _extractSkillPatterns(earners);
    var current = (currentSkills || []).map(function (s) { return s.toLowerCase(); });

    return patterns
      .filter(function (p) { return current.indexOf(p.skill.toLowerCase()) === -1; })
      .map(function (p, idx) {
        var priority;
        if (p.frequency >= 80) priority = 'critical';
        else if (p.frequency >= 60) priority = 'high';
        else if (p.frequency >= 40) priority = 'medium';
        else priority = 'nice-to-have';

        return {
          rank: idx + 1,
          skill: p.skill,
          frequency: p.frequency,
          priority: priority,
          reason: p.frequency + '% of top earners in ' + category + ' list this skill'
        };
      });
  }

  /**
   * Get available categories with data.
   */
  function getAvailableCategories() {
    return Object.keys(TOP_EARNERS);
  }

  // ─── Expose ───────────────────────────────────────────────────────
  window.CortexFreelancer.topEarnerAnalysis = {
    analyzeCategory: analyzeCategory,
    compareToTopEarners: compareToTopEarners,
    getSkillRoadmap: getSkillRoadmap,
    getAvailableCategories: getAvailableCategories
  };
})();
