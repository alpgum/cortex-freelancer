/**
 * [UW-006] Cortex Skill Gap Analyzer
 * Compares user skills against high-demand market data,
 * identifies gaps, and provides learning paths with resources.
 * Exposed as window.CortexSkillGapAnalyzer
 */
(function () {
  'use strict';

  /* ──────────────────────────────────────────────
   * FREE LEARNING RESOURCES DATABASE (30+ real URLs)
   * ────────────────────────────────────────────── */
  const LEARNING_RESOURCES = {
    'AI/LLM Integration': [
      { name: 'Hugging Face NLP Course', url: 'https://huggingface.co/learn/nlp-course', type: 'free' },
      { name: 'LangChain Docs & Tutorials', url: 'https://python.langchain.com/docs/get_started/introduction', type: 'free' },
      { name: 'OpenAI Cookbook', url: 'https://cookbook.openai.com', type: 'free' },
    ],
    'Prompt Engineering': [
      { name: 'Learn Prompting (open source)', url: 'https://learnprompting.org', type: 'free' },
      { name: 'OpenAI Prompt Engineering Guide', url: 'https://platform.openai.com/docs/guides/prompt-engineering', type: 'free' },
      { name: 'Anthropic Prompt Engineering', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview', type: 'free' },
    ],
    'React': [
      { name: 'React Official Docs', url: 'https://react.dev/learn', type: 'free' },
      { name: 'Scrimba – Learn React Free', url: 'https://scrimba.com/learn/learnreact', type: 'free' },
      { name: 'freeCodeCamp React Course', url: 'https://www.freecodecamp.org/learn/front-end-development-libraries/#react', type: 'free' },
    ],
    'Python': [
      { name: 'Python Official Tutorial', url: 'https://docs.python.org/3/tutorial/', type: 'free' },
      { name: 'Automate the Boring Stuff', url: 'https://automatetheboringstuff.com', type: 'free' },
      { name: 'Real Python Tutorials', url: 'https://realpython.com', type: 'free' },
    ],
    'Machine Learning': [
      { name: 'fast.ai – Practical Deep Learning', url: 'https://course.fast.ai', type: 'free' },
      { name: 'Google ML Crash Course', url: 'https://developers.google.com/machine-learning/crash-course', type: 'free' },
      { name: 'Kaggle Learn', url: 'https://www.kaggle.com/learn', type: 'free' },
    ],
    'TypeScript': [
      { name: 'TypeScript Official Handbook', url: 'https://www.typescriptlang.org/docs/handbook/', type: 'free' },
      { name: 'Total TypeScript Beginners', url: 'https://www.totaltypescript.com/tutorials/beginners-typescript', type: 'free' },
      { name: 'Type Challenges', url: 'https://github.com/type-challenges/type-challenges', type: 'free' },
    ],
    'AWS': [
      { name: 'AWS Skill Builder (free tier)', url: 'https://skillbuilder.aws', type: 'free' },
      { name: 'AWS Well-Architected Labs', url: 'https://www.wellarchitectedlabs.com', type: 'free' },
      { name: 'freeCodeCamp AWS Course', url: 'https://www.freecodecamp.org/news/tag/aws/', type: 'free' },
    ],
    'Next.js': [
      { name: 'Next.js Learn Course', url: 'https://nextjs.org/learn', type: 'free' },
      { name: 'Next.js Official Docs', url: 'https://nextjs.org/docs', type: 'free' },
    ],
    'RAG Systems': [
      { name: 'LlamaIndex Docs', url: 'https://docs.llamaindex.ai/en/stable/', type: 'free' },
      { name: 'Pinecone Learning Center', url: 'https://www.pinecone.io/learn/', type: 'free' },
    ],
    'Kubernetes': [
      { name: 'Kubernetes Official Tutorials', url: 'https://kubernetes.io/docs/tutorials/', type: 'free' },
      { name: 'KodeKloud Free Labs', url: 'https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners/', type: 'free' },
    ],
    'Flutter': [
      { name: 'Flutter Official Codelabs', url: 'https://docs.flutter.dev/codelabs', type: 'free' },
      { name: 'Flutter Apprentice (free sample)', url: 'https://docs.flutter.dev/get-started/codelab', type: 'free' },
    ],
    'Cybersecurity': [
      { name: 'TryHackMe Free Rooms', url: 'https://tryhackme.com', type: 'free' },
      { name: 'OWASP Web Security Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide/', type: 'free' },
      { name: 'Cybrary Free Courses', url: 'https://www.cybrary.it', type: 'free' },
    ],
    'Node.js': [
      { name: 'Node.js Official Guides', url: 'https://nodejs.org/en/learn', type: 'free' },
      { name: 'The Odin Project – NodeJS', url: 'https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs', type: 'free' },
    ],
    'DevOps/CI-CD': [
      { name: 'GitHub Actions Docs', url: 'https://docs.github.com/en/actions', type: 'free' },
      { name: 'GitLab CI/CD Tutorial', url: 'https://docs.gitlab.com/ee/ci/', type: 'free' },
    ],
    'React Native': [
      { name: 'React Native Official Docs', url: 'https://reactnative.dev/docs/getting-started', type: 'free' },
      { name: 'Expo Tutorial', url: 'https://docs.expo.dev/tutorial/introduction/', type: 'free' },
    ],
    'Docker': [
      { name: 'Docker Official Getting Started', url: 'https://docs.docker.com/get-started/', type: 'free' },
      { name: 'Play with Docker Labs', url: 'https://labs.play-with-docker.com', type: 'free' },
    ],
    'Terraform': [
      { name: 'HashiCorp Terraform Tutorials', url: 'https://developer.hashicorp.com/terraform/tutorials', type: 'free' },
    ],
    'Computer Vision': [
      { name: 'OpenCV Official Tutorials', url: 'https://docs.opencv.org/4.x/d9/df8/tutorial_root.html', type: 'free' },
      { name: 'PyImageSearch University (free)', url: 'https://pyimagesearch.com/start-here/', type: 'free' },
    ],
    'Go/Golang': [
      { name: 'Go by Example', url: 'https://gobyexample.com', type: 'free' },
      { name: 'A Tour of Go', url: 'https://go.dev/tour/', type: 'free' },
      { name: 'Go Official Docs', url: 'https://go.dev/doc/', type: 'free' },
    ],
    'Rust': [
      { name: 'The Rust Programming Language Book', url: 'https://doc.rust-lang.org/book/', type: 'free' },
      { name: 'Rustlings Exercises', url: 'https://github.com/rust-lang/rustlings', type: 'free' },
      { name: 'Rust by Example', url: 'https://doc.rust-lang.org/rust-by-example/', type: 'free' },
    ],
    'Figma/UI Design': [
      { name: 'Figma Official Tutorials', url: 'https://help.figma.com/hc/en-us/categories/360002051613', type: 'free' },
      { name: 'Google UX Design (Coursera audit)', url: 'https://www.coursera.org/professional-certificates/google-ux-design', type: 'free' },
    ],
    'Full Stack Development': [
      { name: 'The Odin Project', url: 'https://www.theodinproject.com', type: 'free' },
      { name: 'Full Stack Open (Helsinki)', url: 'https://fullstackopen.com/en/', type: 'free' },
    ],
    'iOS/Swift': [
      { name: 'Swift Playgrounds', url: 'https://developer.apple.com/swift-playgrounds/', type: 'free' },
      { name: 'Hacking with Swift', url: 'https://www.hackingwithswift.com', type: 'free' },
    ],
    'Android/Kotlin': [
      { name: 'Android Developers Training', url: 'https://developer.android.com/courses', type: 'free' },
      { name: 'Kotlin Official Docs', url: 'https://kotlinlang.org/docs/getting-started.html', type: 'free' },
    ],
    'PostgreSQL': [
      { name: 'PostgreSQL Official Tutorial', url: 'https://www.postgresql.org/docs/current/tutorial.html', type: 'free' },
      { name: 'SQLBolt Interactive Lessons', url: 'https://sqlbolt.com', type: 'free' },
    ],
    'SEO': [
      { name: 'Moz Beginner Guide to SEO', url: 'https://moz.com/beginners-guide-to-seo', type: 'free' },
      { name: 'Google Search Central', url: 'https://developers.google.com/search/docs', type: 'free' },
    ],
    'Copywriting': [
      { name: 'Copyblogger Free Resources', url: 'https://copyblogger.com/blog/', type: 'free' },
      { name: 'HubSpot Copywriting Guide', url: 'https://blog.hubspot.com/marketing/copywriting-tips', type: 'free' },
    ],
    'Video Editing': [
      { name: 'DaVinci Resolve Training', url: 'https://www.blackmagicdesign.com/products/davinciresolve/training', type: 'free' },
    ],
    'GraphQL': [
      { name: 'How to GraphQL', url: 'https://www.howtographql.com', type: 'free' },
      { name: 'GraphQL Official Learn', url: 'https://graphql.org/learn/', type: 'free' },
    ],
    'MongoDB': [
      { name: 'MongoDB University', url: 'https://learn.mongodb.com', type: 'free' },
    ],
    'Django/FastAPI': [
      { name: 'Django Official Tutorial', url: 'https://docs.djangoproject.com/en/stable/intro/tutorial01/', type: 'free' },
      { name: 'FastAPI Official Tutorial', url: 'https://fastapi.tiangolo.com/tutorial/', type: 'free' },
    ],
    'Shopify Development': [
      { name: 'Shopify Dev Docs', url: 'https://shopify.dev/docs', type: 'free' },
    ],
    'Google Ads/PPC': [
      { name: 'Google Skillshop', url: 'https://skillshop.withgoogle.com', type: 'free' },
    ],
    'Data Visualization': [
      { name: 'D3.js Official Tutorial', url: 'https://d3js.org/getting-started', type: 'free' },
    ],
    'Power BI/Tableau': [
      { name: 'Tableau Free Training', url: 'https://www.tableau.com/learn/training', type: 'free' },
      { name: 'Microsoft Power BI Learning', url: 'https://learn.microsoft.com/en-us/power-bi/', type: 'free' },
    ],
    'Azure': [
      { name: 'Microsoft Learn – Azure', url: 'https://learn.microsoft.com/en-us/training/azure/', type: 'free' },
    ],
    'Selenium/Test Automation': [
      { name: 'Selenium Official Docs', url: 'https://www.selenium.dev/documentation/', type: 'free' },
    ],
    'Penetration Testing': [
      { name: 'Hack The Box Academy', url: 'https://academy.hackthebox.com', type: 'free' },
      { name: 'PortSwigger Web Security Academy', url: 'https://portswigger.net/web-security', type: 'free' },
    ],
    'Solidity/Web3': [
      { name: 'CryptoZombies', url: 'https://cryptozombies.io', type: 'free' },
      { name: 'Solidity by Example', url: 'https://solidity-by-example.org', type: 'free' },
    ],
    'Unity/Game Dev': [
      { name: 'Unity Learn', url: 'https://learn.unity.com', type: 'free' },
    ],
    'Technical Writing': [
      { name: 'Google Technical Writing Course', url: 'https://developers.google.com/tech-writing', type: 'free' },
    ],
    'Blender/3D Modeling': [
      { name: 'Blender Official Tutorials', url: 'https://www.blender.org/support/tutorials/', type: 'free' },
    ],
    'Email Marketing': [
      { name: 'Mailchimp Email Marketing Guide', url: 'https://mailchimp.com/resources/email-marketing-field-guide/', type: 'free' },
    ],
    'Marketing Automation': [
      { name: 'HubSpot Academy', url: 'https://academy.hubspot.com', type: 'free' },
    ],
    'Short-form Video Content': [
      { name: 'CapCut Official Tutorials', url: 'https://www.capcut.com/resource/how-to-use-capcut', type: 'free' },
    ],
    'After Effects/Motion Graphics': [
      { name: 'School of Motion – Free Tutorials', url: 'https://www.schoolofmotion.com/blog', type: 'free' },
    ],
    'WordPress Development': [
      { name: 'WordPress Developer Resources', url: 'https://developer.wordpress.org', type: 'free' },
    ],
    'Laravel/PHP': [
      { name: 'Laravel Official Docs', url: 'https://laravel.com/docs', type: 'free' },
      { name: 'Laracasts Free Series', url: 'https://laracasts.com/series?curated', type: 'free' },
    ],
    'Product Management': [
      { name: 'Product School Free Resources', url: 'https://productschool.com/resources', type: 'free' },
    ],
    'Salesforce': [
      { name: 'Trailhead by Salesforce', url: 'https://trailhead.salesforce.com', type: 'free' },
    ],
  };

  /* ──────────────────────────────────────────────
   * SALARY BOOST & TIME-TO-LEARN ESTIMATES
   * ────────────────────────────────────────────── */
  const SKILL_META = {
    'AI/LLM Integration':       { salaryBoost: '$15-30/hr increase', timeToLearn: '1-3 months' },
    'Prompt Engineering':        { salaryBoost: '$10-25/hr increase', timeToLearn: '2-4 weeks' },
    'React':                     { salaryBoost: '$10-20/hr increase', timeToLearn: '1-3 months' },
    'Python':                    { salaryBoost: '$10-20/hr increase', timeToLearn: '1-2 months' },
    'Machine Learning':          { salaryBoost: '$20-40/hr increase', timeToLearn: '3-6 months' },
    'TypeScript':                { salaryBoost: '$8-15/hr increase',  timeToLearn: '2-4 weeks' },
    'AWS':                       { salaryBoost: '$10-25/hr increase', timeToLearn: '1-3 months' },
    'Next.js':                   { salaryBoost: '$8-15/hr increase',  timeToLearn: '2-4 weeks' },
    'RAG Systems':               { salaryBoost: '$15-30/hr increase', timeToLearn: '1-2 months' },
    'Kubernetes':                { salaryBoost: '$12-25/hr increase', timeToLearn: '1-3 months' },
    'Flutter':                   { salaryBoost: '$10-20/hr increase', timeToLearn: '1-3 months' },
    'Cybersecurity':             { salaryBoost: '$15-30/hr increase', timeToLearn: '3-6 months' },
    'Node.js':                   { salaryBoost: '$8-15/hr increase',  timeToLearn: '1-2 months' },
    'DevOps/CI-CD':              { salaryBoost: '$10-20/hr increase', timeToLearn: '1-3 months' },
    'React Native':              { salaryBoost: '$10-20/hr increase', timeToLearn: '1-2 months' },
    'Docker':                    { salaryBoost: '$8-15/hr increase',  timeToLearn: '2-4 weeks' },
    'Terraform':                 { salaryBoost: '$10-20/hr increase', timeToLearn: '1-2 months' },
    'Computer Vision':           { salaryBoost: '$15-30/hr increase', timeToLearn: '2-4 months' },
    'Go/Golang':                 { salaryBoost: '$10-25/hr increase', timeToLearn: '1-3 months' },
    'Rust':                      { salaryBoost: '$12-25/hr increase', timeToLearn: '2-4 months' },
    'Figma/UI Design':           { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'Full Stack Development':    { salaryBoost: '$10-20/hr increase', timeToLearn: '3-6 months' },
    'iOS/Swift':                 { salaryBoost: '$10-20/hr increase', timeToLearn: '2-4 months' },
    'Android/Kotlin':            { salaryBoost: '$10-20/hr increase', timeToLearn: '2-4 months' },
    'PostgreSQL':                { salaryBoost: '$5-12/hr increase',  timeToLearn: '2-4 weeks' },
    'SEO':                       { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'Copywriting':               { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'Video Editing':             { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-3 months' },
    'Shopify Development':       { salaryBoost: '$5-12/hr increase',  timeToLearn: '2-4 weeks' },
    'Google Ads/PPC':            { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'Data Visualization':        { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'GraphQL':                   { salaryBoost: '$5-12/hr increase',  timeToLearn: '2-4 weeks' },
    'MongoDB':                   { salaryBoost: '$5-10/hr increase',  timeToLearn: '2-4 weeks' },
    'Email Marketing':           { salaryBoost: '$5-10/hr increase',  timeToLearn: '2-4 weeks' },
    'WordPress Development':     { salaryBoost: '$3-8/hr increase',   timeToLearn: '2-4 weeks' },
    'Short-form Video Content':  { salaryBoost: '$5-15/hr increase',  timeToLearn: '2-4 weeks' },
    'Penetration Testing':       { salaryBoost: '$15-30/hr increase', timeToLearn: '3-6 months' },
    'Power BI/Tableau':          { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'Django/FastAPI':            { salaryBoost: '$8-15/hr increase',  timeToLearn: '1-2 months' },
    'Azure':                     { salaryBoost: '$8-18/hr increase',  timeToLearn: '1-3 months' },
    'Selenium/Test Automation':  { salaryBoost: '$5-12/hr increase',  timeToLearn: '1-2 months' },
    'Laravel/PHP':               { salaryBoost: '$5-12/hr increase',  timeToLearn: '1-2 months' },
    'Marketing Automation':      { salaryBoost: '$5-15/hr increase',  timeToLearn: '1-2 months' },
    'After Effects/Motion Graphics': { salaryBoost: '$5-15/hr increase', timeToLearn: '2-4 months' },
    'Salesforce':                { salaryBoost: '$8-18/hr increase',  timeToLearn: '1-3 months' },
    'Solidity/Web3':             { salaryBoost: '$15-30/hr increase', timeToLearn: '2-4 months' },
    'Unity/Game Dev':            { salaryBoost: '$5-15/hr increase',  timeToLearn: '2-4 months' },
    'Technical Writing':         { salaryBoost: '$5-12/hr increase',  timeToLearn: '1-2 months' },
    'Product Management':        { salaryBoost: '$8-20/hr increase',  timeToLearn: '2-4 months' },
    'Blender/3D Modeling':       { salaryBoost: '$5-15/hr increase',  timeToLearn: '2-4 months' },
  };

  /* ──────────────────────────────────────────────
   * SKILL COMPLEMENTARITY MAP
   * ────────────────────────────────────────────── */
  const COMPLEMENTS = {
    'React':              ['JavaScript', 'CSS', 'HTML', 'Node.js', 'TypeScript', 'Next.js'],
    'TypeScript':         ['JavaScript', 'React', 'Node.js', 'Angular', 'Next.js'],
    'Next.js':            ['React', 'TypeScript', 'Node.js', 'Vercel'],
    'Node.js':            ['JavaScript', 'TypeScript', 'React', 'Express', 'MongoDB'],
    'Python':             ['Data Analysis', 'Machine Learning', 'Django', 'FastAPI', 'Automation'],
    'Machine Learning':   ['Python', 'Data Analysis', 'Statistics', 'Math', 'TensorFlow', 'PyTorch'],
    'AI/LLM Integration': ['Python', 'Prompt Engineering', 'RAG Systems', 'Node.js', 'API Development'],
    'Prompt Engineering': ['AI/LLM Integration', 'Writing', 'Python', 'RAG Systems'],
    'RAG Systems':        ['Python', 'AI/LLM Integration', 'Vector Databases', 'Node.js'],
    'AWS':                ['Docker', 'Terraform', 'Linux', 'Kubernetes', 'DevOps/CI-CD'],
    'Docker':             ['Kubernetes', 'AWS', 'Linux', 'DevOps/CI-CD', 'Terraform'],
    'Kubernetes':         ['Docker', 'AWS', 'Terraform', 'Linux', 'Go/Golang'],
    'Terraform':          ['AWS', 'Docker', 'Kubernetes', 'Azure', 'DevOps/CI-CD'],
    'DevOps/CI-CD':       ['Docker', 'AWS', 'Kubernetes', 'Linux', 'Git'],
    'Flutter':            ['Dart', 'Mobile Development', 'Firebase', 'UI Design'],
    'React Native':       ['React', 'JavaScript', 'TypeScript', 'Mobile Development'],
    'Go/Golang':          ['Microservices', 'Docker', 'Kubernetes', 'Cloud', 'Systems Programming'],
    'Rust':               ['Systems Programming', 'WebAssembly', 'C/C++', 'Performance'],
    'Cybersecurity':      ['Linux', 'Networking', 'Python', 'Penetration Testing'],
    'Computer Vision':    ['Python', 'Machine Learning', 'Deep Learning', 'OpenCV', 'TensorFlow'],
    'PostgreSQL':         ['SQL', 'Node.js', 'Django', 'Data Modeling'],
    'GraphQL':            ['React', 'Node.js', 'TypeScript', 'API Development'],
    'Figma/UI Design':    ['CSS', 'HTML', 'React', 'User Research', 'Prototyping'],
    'SEO':                ['Content Writing', 'Google Analytics', 'Marketing', 'HTML'],
    'Video Editing':      ['After Effects', 'Short-form Video', 'Color Grading', 'Storytelling'],
  };

  /* ──────────────────────────────────────────────
   * CORE ANALYSIS ENGINE
   * ────────────────────────────────────────────── */

  /**
   * Normalize a skill name for fuzzy matching.
   */
  function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Check if userSkill matches a high-demand skill (fuzzy).
   */
  function skillMatches(userSkill, hdSkill) {
    const a = normalize(userSkill);
    const b = normalize(hdSkill);
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    // Common aliases
    const aliases = {
      'js': 'javascript', 'ts': 'typescript', 'py': 'python',
      'k8s': 'kubernetes', 'tf': 'terraform', 'rn': 'reactnative',
      'nextjs': 'nextjs', 'nodejs': 'nodejs', 'golang': 'gogolang',
      'vue': 'vuejs', 'pg': 'postgresql', 'postgres': 'postgresql',
    };
    const na = aliases[a] || a;
    const nb = aliases[b] || b;
    return na === nb;
  }

  /**
   * Analyze skill gaps for a user profile.
   * @param {Object} profileData - { skills: string[], category: string }
   * @param {Object} highDemandSkills - parsed high-demand-skills.json
   * @param {Object} marketBenchmarks - parsed market-benchmarks.json
   * @returns {Object} analysis result
   */
  function analyzeSkillGaps(profileData, highDemandSkills, marketBenchmarks) {
    const userSkills = profileData.skills || [];
    const userCategory = profileData.category || '';

    const allHD = highDemandSkills.skills || [];

    // Partition: skills in user's category first, then cross-category
    const categorySkills = allHD.filter(s => s.category === userCategory);
    const crossCategorySkills = allHD.filter(s => s.category !== userCategory);
    const orderedSkills = [...categorySkills, ...crossCategorySkills];

    const strengths = [];
    const gaps = [];
    const opportunities = [];

    for (const hd of orderedSkills) {
      const matched = userSkills.some(us => skillMatches(us, hd.skill));
      if (matched) {
        strengths.push({
          skill: hd.skill,
          demand: hd.demand,
          rank: hd.rank,
          trend: hd.trend,
          category: hd.category,
        });
      } else {
        const meta = SKILL_META[hd.skill] || {
          salaryBoost: '$5-15/hr increase',
          timeToLearn: '1-3 months',
        };
        const resources = LEARNING_RESOURCES[hd.skill] || [
          { name: `${hd.skill} – Google Search`, url: `https://www.google.com/search?q=learn+${encodeURIComponent(hd.skill)}+free`, type: 'free' },
        ];

        // Find complements with user's existing skills
        const complements = [];
        const compMap = COMPLEMENTS[hd.skill] || [];
        for (const us of userSkills) {
          if (compMap.some(c => skillMatches(us, c))) {
            complements.push(`Works great with your ${us} skills`);
          }
        }

        const entry = {
          skill: hd.skill,
          demandTier: hd.demand,
          rank: hd.rank,
          trend: hd.trend,
          category: hd.category,
          estimatedSalaryBoost: meta.salaryBoost,
          timeToLearn: meta.timeToLearn,
          learningResources: resources,
          complementsExisting: complements.length > 0 ? complements : [`Expands your skillset into ${hd.category.replace(/-/g, ' ')}`],
        };

        if (hd.trend === 'rising') {
          opportunities.push(entry);
        }
        gaps.push(entry);
      }
    }

    // Build recommended learning path: prioritize by category match + demand + trend
    const learningPath = [...gaps].sort((a, b) => {
      // Same category first
      const aCat = a.category === userCategory ? 0 : 1;
      const bCat = b.category === userCategory ? 0 : 1;
      if (aCat !== bCat) return aCat - bCat;
      // Then by demand tier
      const tierOrder = { 'very-high': 0, 'high': 1, 'medium': 2 };
      const aTier = tierOrder[a.demandTier] ?? 3;
      const bTier = tierOrder[b.demandTier] ?? 3;
      if (aTier !== bTier) return aTier - bTier;
      // Then rising first
      if (a.trend === 'rising' && b.trend !== 'rising') return -1;
      if (b.trend === 'rising' && a.trend !== 'rising') return 1;
      return a.rank - b.rank;
    }).slice(0, 10);

    // Calculate potential earnings boost
    const catBenchmark = marketBenchmarks.categories?.[userCategory];
    const topGapSkills = learningPath.slice(0, 3).map(g => g.skill);
    let earningsBoostText = '';
    if (topGapSkills.length >= 2) {
      earningsBoostText = `Learning ${topGapSkills.slice(0, 2).join(' + ')} could increase your rate by $15-30/hr`;
    } else if (topGapSkills.length === 1) {
      earningsBoostText = `Learning ${topGapSkills[0]} could increase your rate by $10-20/hr`;
    } else {
      earningsBoostText = 'Your skills already cover the top demand areas!';
    }

    return {
      strengths,
      gaps,
      opportunities: opportunities.slice(0, 15),
      learningPath,
      earningsBoost: {
        text: earningsBoostText,
        topSkills: topGapSkills,
      },
      stats: {
        totalHighDemandSkills: allHD.length,
        matchedSkills: strengths.length,
        missingSkills: gaps.length,
        matchRate: allHD.length > 0 ? Math.round((strengths.length / allHD.length) * 100) : 0,
      },
    };
  }

  /* ──────────────────────────────────────────────
   * CSS INJECTION (dark theme)
   * ────────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById('cortex-skill-gap-styles')) return;
    const style = document.createElement('style');
    style.id = 'cortex-skill-gap-styles';
    style.textContent = `
      .csg-container {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e4e4e7;
        background: #18181b;
        padding: 24px;
        border-radius: 16px;
        max-width: 900px;
        margin: 0 auto;
      }
      .csg-header {
        text-align: center;
        margin-bottom: 32px;
      }
      .csg-header h2 {
        font-size: 24px;
        font-weight: 700;
        color: #f4f4f5;
        margin: 0 0 6px 0;
      }
      .csg-header p {
        font-size: 14px;
        color: #a1a1aa;
        margin: 0;
      }
      .csg-stats-row {
        display: flex;
        gap: 12px;
        margin-bottom: 28px;
        flex-wrap: wrap;
      }
      .csg-stat-card {
        flex: 1;
        min-width: 140px;
        background: #27272a;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
      }
      .csg-stat-card .csg-stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #f4f4f5;
      }
      .csg-stat-card .csg-stat-label {
        font-size: 12px;
        color: #a1a1aa;
        margin-top: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .csg-section {
        margin-bottom: 28px;
      }
      .csg-section-title {
        font-size: 16px;
        font-weight: 600;
        color: #f4f4f5;
        margin: 0 0 14px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .csg-section-title .csg-icon {
        font-size: 18px;
      }
      .csg-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .csg-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .csg-badge:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .csg-badge--strength {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border: 1px solid rgba(34, 197, 94, 0.25);
      }
      .csg-badge--gap {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.25);
        cursor: pointer;
        text-decoration: none;
      }
      .csg-badge--gap:hover {
        background: rgba(245, 158, 11, 0.25);
      }
      .csg-badge--opportunity {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
        border: 1px solid rgba(99, 102, 241, 0.25);
      }
      .csg-badge .csg-trend {
        font-size: 11px;
        opacity: 0.7;
      }
      .csg-demand-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
      }
      .csg-demand-dot--very-high { background: #ef4444; }
      .csg-demand-dot--high { background: #f59e0b; }
      .csg-demand-dot--medium { background: #6366f1; }

      /* Learning Path */
      .csg-path-list {
        list-style: none;
        padding: 0;
        margin: 0;
        counter-reset: path-counter;
      }
      .csg-path-item {
        counter-increment: path-counter;
        background: #27272a;
        border-radius: 12px;
        padding: 16px 18px;
        margin-bottom: 10px;
        border-left: 3px solid #6366f1;
        transition: border-color 0.2s;
      }
      .csg-path-item:hover {
        border-left-color: #818cf8;
      }
      .csg-path-item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      .csg-path-item-title {
        font-weight: 600;
        color: #f4f4f5;
        font-size: 14px;
      }
      .csg-path-item-title::before {
        content: counter(path-counter) ". ";
        color: #6366f1;
        font-weight: 700;
      }
      .csg-path-meta {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .csg-path-tag {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 500;
      }
      .csg-path-tag--time {
        background: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
      }
      .csg-path-tag--salary {
        background: rgba(34, 197, 94, 0.15);
        color: #86efac;
      }
      .csg-path-tag--demand {
        background: rgba(239, 68, 68, 0.15);
        color: #fca5a5;
      }
      .csg-path-tag--demand-high {
        background: rgba(245, 158, 11, 0.15);
        color: #fcd34d;
      }
      .csg-path-tag--demand-medium {
        background: rgba(99, 102, 241, 0.15);
        color: #c4b5fd;
      }
      .csg-path-resources {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .csg-resource-link {
        font-size: 12px;
        color: #60a5fa;
        text-decoration: none;
        background: rgba(96, 165, 250, 0.1);
        padding: 3px 10px;
        border-radius: 6px;
        transition: background 0.15s;
      }
      .csg-resource-link:hover {
        background: rgba(96, 165, 250, 0.2);
        text-decoration: underline;
      }
      .csg-complements {
        font-size: 12px;
        color: #a1a1aa;
        margin-top: 6px;
        font-style: italic;
      }

      /* Earnings Boost Card */
      .csg-boost-card {
        background: linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(99, 102, 241, 0.12) 100%);
        border: 1px solid rgba(34, 197, 94, 0.2);
        border-radius: 14px;
        padding: 24px;
        text-align: center;
      }
      .csg-boost-card .csg-boost-emoji {
        font-size: 32px;
        margin-bottom: 8px;
      }
      .csg-boost-card .csg-boost-text {
        font-size: 16px;
        font-weight: 600;
        color: #4ade80;
        margin: 0 0 6px 0;
      }
      .csg-boost-card .csg-boost-sub {
        font-size: 13px;
        color: #a1a1aa;
        margin: 0;
      }

      /* Match rate ring */
      .csg-ring-wrap {
        display: flex;
        justify-content: center;
        margin-bottom: 12px;
      }
      .csg-ring {
        position: relative;
        width: 80px;
        height: 80px;
      }
      .csg-ring svg {
        transform: rotate(-90deg);
      }
      .csg-ring-bg {
        fill: none;
        stroke: #3f3f46;
        stroke-width: 6;
      }
      .csg-ring-fill {
        fill: none;
        stroke: #4ade80;
        stroke-width: 6;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.6s ease;
      }
      .csg-ring-text {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 700;
        color: #f4f4f5;
      }

      /* Empty state */
      .csg-empty {
        text-align: center;
        padding: 32px;
        color: #71717a;
        font-size: 14px;
      }

      /* Responsive */
      @media (max-width: 600px) {
        .csg-container { padding: 16px; }
        .csg-stat-card { min-width: 110px; }
        .csg-path-item-header { flex-direction: column; align-items: flex-start; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ──────────────────────────────────────────────
   * RENDER ENGINE
   * ────────────────────────────────────────────── */

  function trendIcon(trend) {
    if (trend === 'rising') return '↗';
    if (trend === 'declining') return '↘';
    return '→';
  }

  function demandTagClass(tier) {
    if (tier === 'very-high') return 'csg-path-tag--demand';
    if (tier === 'high') return 'csg-path-tag--demand-high';
    return 'csg-path-tag--demand-medium';
  }

  function createMatchRing(percent) {
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ - (percent / 100) * circ;
    return `
      <div class="csg-ring-wrap">
        <div class="csg-ring">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle class="csg-ring-bg" cx="40" cy="40" r="${r}"/>
            <circle class="csg-ring-fill" cx="40" cy="40" r="${r}"
              stroke-dasharray="${circ}"
              stroke-dashoffset="${offset}"/>
          </svg>
          <div class="csg-ring-text">${percent}%</div>
        </div>
      </div>
    `;
  }

  /**
   * Render skill gap analysis into a container.
   * @param {Object} profileData - { skills: string[], category: string, highDemandSkills?, marketBenchmarks? }
   * @param {HTMLElement} container
   */
  function renderSkillGap(profileData, container) {
    injectStyles();

    // Allow passing data directly or use globally loaded data
    const hdData = profileData.highDemandSkills || window._cortexHighDemandSkills;
    const mbData = profileData.marketBenchmarks || window._cortexMarketBenchmarks;

    if (!hdData || !mbData) {
      container.innerHTML = '<div class="csg-container"><div class="csg-empty">⚠️ Missing data files. Load high-demand-skills.json and market-benchmarks.json first.</div></div>';
      return null;
    }

    const analysis = analyzeSkillGaps(profileData, hdData, mbData);
    const { strengths, gaps, opportunities, learningPath, earningsBoost, stats } = analysis;

    let html = '<div class="csg-container">';

    // Header
    html += `
      <div class="csg-header">
        <h2>🧠 Skill Gap Analysis</h2>
        <p>Comparing your skills against the top ${stats.totalHighDemandSkills} in-demand freelance skills</p>
      </div>
    `;

    // Stats row with ring
    html += `
      <div class="csg-stats-row">
        <div class="csg-stat-card">
          ${createMatchRing(stats.matchRate)}
          <div class="csg-stat-label">Market Match</div>
        </div>
        <div class="csg-stat-card">
          <div class="csg-stat-value" style="color:#4ade80">${stats.matchedSkills}</div>
          <div class="csg-stat-label">Your Strengths</div>
        </div>
        <div class="csg-stat-card">
          <div class="csg-stat-value" style="color:#fbbf24">${stats.missingSkills}</div>
          <div class="csg-stat-label">Skills to Learn</div>
        </div>
        <div class="csg-stat-card">
          <div class="csg-stat-value" style="color:#818cf8">${opportunities.length}</div>
          <div class="csg-stat-label">Rising Trends</div>
        </div>
      </div>
    `;

    // Strengths
    html += '<div class="csg-section">';
    html += '<h3 class="csg-section-title"><span class="csg-icon">💪</span> Your Skills (High-Demand Matches)</h3>';
    if (strengths.length > 0) {
      html += '<div class="csg-badges">';
      for (const s of strengths) {
        html += `<span class="csg-badge csg-badge--strength">
          <span class="csg-demand-dot csg-demand-dot--${s.demand}"></span>
          ${s.skill}
          <span class="csg-trend">${trendIcon(s.trend)}</span>
        </span>`;
      }
      html += '</div>';
    } else {
      html += '<p style="color:#71717a;font-size:13px;">No matches found yet — check your profile skills.</p>';
    }
    html += '</div>';

    // Missing High-Demand Skills
    html += '<div class="csg-section">';
    html += '<h3 class="csg-section-title"><span class="csg-icon">🎯</span> Missing High-Demand Skills</h3>';
    if (gaps.length > 0) {
      html += '<div class="csg-badges">';
      const displayGaps = gaps.slice(0, 20);
      for (const g of displayGaps) {
        const learnUrl = g.learningResources[0]?.url || '#';
        html += `<a href="${learnUrl}" target="_blank" rel="noopener" class="csg-badge csg-badge--gap" title="${g.estimatedSalaryBoost} · ${g.timeToLearn}">
          <span class="csg-demand-dot csg-demand-dot--${g.demandTier}"></span>
          ${g.skill}
          <span class="csg-trend">${trendIcon(g.trend)}</span>
        </a>`;
      }
      if (gaps.length > 20) {
        html += `<span class="csg-badge" style="color:#71717a;border:1px dashed #3f3f46;">+${gaps.length - 20} more</span>`;
      }
      html += '</div>';
    }
    html += '</div>';

    // Recommended Learning Path
    html += '<div class="csg-section">';
    html += '<h3 class="csg-section-title"><span class="csg-icon">🗺️</span> Recommended Learning Path</h3>';
    html += '<ol class="csg-path-list">';
    for (const item of learningPath) {
      html += `<li class="csg-path-item">
        <div class="csg-path-item-header">
          <span class="csg-path-item-title">${item.skill}</span>
          <div class="csg-path-meta">
            <span class="csg-path-tag csg-path-tag--time">⏱ ${item.timeToLearn}</span>
            <span class="csg-path-tag csg-path-tag--salary">💰 ${item.estimatedSalaryBoost}</span>
            <span class="csg-path-tag ${demandTagClass(item.demandTier)}">${item.demandTier} demand</span>
          </div>
        </div>
        <div class="csg-path-resources">
          ${item.learningResources.map(r => `<a href="${r.url}" target="_blank" rel="noopener" class="csg-resource-link">${r.name}</a>`).join('')}
        </div>
        <div class="csg-complements">${item.complementsExisting[0] || ''}</div>
      </li>`;
    }
    html += '</ol></div>';

    // Earnings Boost Card
    html += `
      <div class="csg-section">
        <div class="csg-boost-card">
          <div class="csg-boost-emoji">💸</div>
          <p class="csg-boost-text">${earningsBoost.text}</p>
          <p class="csg-boost-sub">Based on current market rates and skill demand data</p>
        </div>
      </div>
    `;

    html += '</div>'; // close csg-container

    container.innerHTML = html;
    return analysis;
  }

  /* ──────────────────────────────────────────────
   * DATA LOADING HELPERS
   * ────────────────────────────────────────────── */

  /**
   * Load JSON data files and store globally.
   */
  async function loadData(highDemandUrl, benchmarksUrl) {
    const [hdRes, mbRes] = await Promise.all([
      fetch(highDemandUrl || '../data/high-demand-skills.json'),
      fetch(benchmarksUrl || '../data/market-benchmarks.json'),
    ]);
    window._cortexHighDemandSkills = await hdRes.json();
    window._cortexMarketBenchmarks = await mbRes.json();
    return {
      highDemandSkills: window._cortexHighDemandSkills,
      marketBenchmarks: window._cortexMarketBenchmarks,
    };
  }

  /* ──────────────────────────────────────────────
   * PUBLIC API
   * ────────────────────────────────────────────── */
  /* ──────────────────────────────────────────────
   * [CF-071] PERSONALIZED LEARNING PATH BUILDER
   * Builds structured learning paths with course recommendations,
   * time estimates, prerequisites, and milestone checkpoints.
   * ────────────────────────────────────────────── */

  const COURSE_CATALOG = {
    'React': [
      { name: 'React Foundations', provider: 'React.dev', url: 'https://react.dev/learn', duration: '2 weeks', level: 'beginner', format: 'interactive', free: true },
      { name: 'Full Stack Open – React', provider: 'University of Helsinki', url: 'https://fullstackopen.com/en/', duration: '4 weeks', level: 'intermediate', format: 'project-based', free: true },
      { name: 'Scrimba React', provider: 'Scrimba', url: 'https://scrimba.com/learn/learnreact', duration: '2 weeks', level: 'beginner', format: 'interactive', free: true },
    ],
    'TypeScript': [
      { name: 'TypeScript Handbook', provider: 'Microsoft', url: 'https://www.typescriptlang.org/docs/handbook/', duration: '1 week', level: 'beginner', format: 'docs', free: true },
      { name: 'Total TypeScript Beginners', provider: 'Matt Pocock', url: 'https://www.totaltypescript.com/tutorials/beginners-typescript', duration: '1 week', level: 'beginner', format: 'video', free: true },
      { name: 'Type Challenges', provider: 'Community', url: 'https://github.com/type-challenges/type-challenges', duration: '2 weeks', level: 'advanced', format: 'challenges', free: true },
    ],
    'Python': [
      { name: 'Python Official Tutorial', provider: 'Python.org', url: 'https://docs.python.org/3/tutorial/', duration: '2 weeks', level: 'beginner', format: 'docs', free: true },
      { name: 'Automate the Boring Stuff', provider: 'Al Sweigart', url: 'https://automatetheboringstuff.com', duration: '4 weeks', level: 'beginner', format: 'book', free: true },
      { name: 'Python for Everybody', provider: 'Coursera/UMich', url: 'https://www.py4e.com', duration: '6 weeks', level: 'beginner', format: 'course', free: true },
    ],
    'Machine Learning': [
      { name: 'Google ML Crash Course', provider: 'Google', url: 'https://developers.google.com/machine-learning/crash-course', duration: '2 weeks', level: 'beginner', format: 'course', free: true },
      { name: 'fast.ai Practical DL', provider: 'fast.ai', url: 'https://course.fast.ai', duration: '7 weeks', level: 'intermediate', format: 'video+code', free: true },
      { name: 'Kaggle Learn ML', provider: 'Kaggle', url: 'https://www.kaggle.com/learn', duration: '3 weeks', level: 'beginner', format: 'notebooks', free: true },
    ],
    'AWS': [
      { name: 'AWS Cloud Practitioner Path', provider: 'AWS', url: 'https://skillbuilder.aws', duration: '4 weeks', level: 'beginner', format: 'course', free: true },
      { name: 'AWS Well-Architected Labs', provider: 'AWS', url: 'https://www.wellarchitectedlabs.com', duration: '3 weeks', level: 'intermediate', format: 'hands-on', free: true },
    ],
    'Docker': [
      { name: 'Docker Getting Started', provider: 'Docker', url: 'https://docs.docker.com/get-started/', duration: '1 week', level: 'beginner', format: 'docs', free: true },
      { name: 'Play with Docker', provider: 'Docker', url: 'https://labs.play-with-docker.com', duration: '1 week', level: 'beginner', format: 'hands-on', free: true },
    ],
    'Next.js': [
      { name: 'Next.js Learn Course', provider: 'Vercel', url: 'https://nextjs.org/learn', duration: '2 weeks', level: 'intermediate', format: 'interactive', free: true },
    ],
    'Node.js': [
      { name: 'Node.js Official Guides', provider: 'Node.js', url: 'https://nodejs.org/en/learn', duration: '2 weeks', level: 'beginner', format: 'docs', free: true },
      { name: 'The Odin Project – NodeJS', provider: 'Odin Project', url: 'https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs', duration: '6 weeks', level: 'intermediate', format: 'project-based', free: true },
    ],
    'GraphQL': [
      { name: 'How to GraphQL', provider: 'Community', url: 'https://www.howtographql.com', duration: '2 weeks', level: 'beginner', format: 'interactive', free: true },
    ],
    'AI/LLM Integration': [
      { name: 'OpenAI Cookbook', provider: 'OpenAI', url: 'https://cookbook.openai.com', duration: '2 weeks', level: 'intermediate', format: 'notebooks', free: true },
      { name: 'LangChain Tutorials', provider: 'LangChain', url: 'https://python.langchain.com/docs/get_started/introduction', duration: '3 weeks', level: 'intermediate', format: 'docs+code', free: true },
      { name: 'Hugging Face NLP Course', provider: 'Hugging Face', url: 'https://huggingface.co/learn/nlp-course', duration: '6 weeks', level: 'intermediate', format: 'course', free: true },
    ],
    'Figma': [
      { name: 'Figma Learn', provider: 'Figma', url: 'https://help.figma.com/hc/en-us/categories/360002051613', duration: '2 weeks', level: 'beginner', format: 'docs', free: true },
    ],
    'SEO': [
      { name: 'Google SEO Starter Guide', provider: 'Google', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', duration: '1 week', level: 'beginner', format: 'docs', free: true },
      { name: 'Moz Beginner Guide to SEO', provider: 'Moz', url: 'https://moz.com/beginners-guide-to-seo', duration: '2 weeks', level: 'beginner', format: 'guide', free: true },
    ],
  };

  const SKILL_PREREQUISITES = {
    'React': ['JavaScript', 'HTML', 'CSS'],
    'Next.js': ['React', 'JavaScript'],
    'TypeScript': ['JavaScript'],
    'Node.js': ['JavaScript'],
    'GraphQL': ['JavaScript', 'API basics'],
    'Machine Learning': ['Python', 'Math/Statistics basics'],
    'AI/LLM Integration': ['Python', 'API basics'],
    'Docker': ['Command line basics', 'Linux basics'],
    'AWS': ['Networking basics', 'Linux basics'],
    'Tailwind CSS': ['CSS', 'HTML'],
  };

  /**
   * Build a personalized learning path with phases, prerequisites,
   * course recommendations, and weekly milestones.
   * @param {Object} profileData - User profile with skills, category, rate
   * @param {Array} gaps - Skill gap entries from analyzeSkillGaps
   * @param {Object} options - { maxSkills, weeklyHours, preferredFormat }
   * @returns {Object} Structured learning path
   */
  function buildPersonalizedLearningPath(profileData, gaps, options) {
    options = options || {};
    const maxSkills = options.maxSkills || 5;
    const weeklyHours = options.weeklyHours || 10;
    const preferredFormat = options.preferredFormat || null;
    const userSkills = (profileData.skills || []).map(s => s.toLowerCase());

    // Select top gaps
    const selectedGaps = gaps.slice(0, maxSkills);

    // Check prerequisites
    const phases = [];
    const prereqsNeeded = new Set();

    selectedGaps.forEach(function(gap) {
      const prereqs = SKILL_PREREQUISITES[gap.skill] || [];
      prereqs.forEach(function(p) {
        if (!userSkills.some(us => us.toLowerCase().includes(p.toLowerCase()))) {
          prereqsNeeded.add(p);
        }
      });
    });

    // Phase 0: Prerequisites (if any)
    if (prereqsNeeded.size > 0) {
      const prereqItems = [];
      prereqsNeeded.forEach(function(p) {
        const courses = COURSE_CATALOG[p] || [];
        const filtered = preferredFormat ? courses.filter(c => c.format === preferredFormat) : courses;
        prereqItems.push({
          skill: p,
          isPrerequisite: true,
          courses: (filtered.length ? filtered : courses).slice(0, 2),
          estimatedWeeks: 1,
          milestone: 'Complete basics of ' + p,
        });
      });
      phases.push({
        phase: 0,
        name: 'Foundation Prerequisites',
        description: 'Fill knowledge gaps needed before learning target skills',
        items: prereqItems,
        totalWeeks: Math.max(1, Math.ceil(prereqItems.length * 0.75)),
      });
    }

    // Group remaining skills into phases by priority
    const highPriority = selectedGaps.filter(g => g.demandTier === 'very-high' || g.demandTier === 'high');
    const medPriority = selectedGaps.filter(g => g.demandTier !== 'very-high' && g.demandTier !== 'high');

    function buildPhaseItems(gapList) {
      return gapList.map(function(gap) {
        const allCourses = COURSE_CATALOG[gap.skill] || gap.learningResources.map(r => ({
          name: r.name, provider: 'Various', url: r.url, duration: '2-4 weeks',
          level: 'beginner', format: 'mixed', free: r.type === 'free'
        }));
        const filtered = preferredFormat ? allCourses.filter(c => c.format === preferredFormat) : allCourses;
        const courses = (filtered.length ? filtered : allCourses).slice(0, 3);

        const durationMatch = (gap.timeToLearn || '').match(/(\d+)/);
        const weeks = durationMatch ? parseInt(durationMatch[1]) : 4;

        return {
          skill: gap.skill,
          demandTier: gap.demandTier,
          trend: gap.trend,
          courses: courses,
          estimatedWeeks: Math.ceil(weeks * (10 / weeklyHours)),
          salaryBoost: gap.estimatedSalaryBoost,
          complementsExisting: gap.complementsExisting,
          milestone: 'Build a small project using ' + gap.skill,
          weeklyGoals: generateWeeklyGoals(gap.skill, weeks, courses),
        };
      });
    }

    if (highPriority.length) {
      const items = buildPhaseItems(highPriority);
      phases.push({
        phase: phases.length,
        name: 'High-Impact Skills',
        description: 'Focus on the highest-demand skills first for maximum ROI',
        items: items,
        totalWeeks: items.reduce((s, i) => s + i.estimatedWeeks, 0),
      });
    }

    if (medPriority.length) {
      const items = buildPhaseItems(medPriority);
      phases.push({
        phase: phases.length,
        name: 'Growth Skills',
        description: 'Expand your capabilities with complementary skills',
        items: items,
        totalWeeks: items.reduce((s, i) => s + i.estimatedWeeks, 0),
      });
    }

    // Total timeline
    const totalWeeks = phases.reduce((s, p) => s + p.totalWeeks, 0);

    // Projected rate increase
    const currentRate = profileData.rate || 30;
    const rateBoostPct = selectedGaps.reduce(function(sum, g) {
      if (g.demandTier === 'very-high') return sum + 12;
      if (g.demandTier === 'high') return sum + 8;
      return sum + 4;
    }, 0);
    const projectedRate = Math.round(currentRate * (1 + Math.min(rateBoostPct, 40) / 100));

    return {
      phases: phases,
      totalWeeks: totalWeeks,
      weeklyHours: weeklyHours,
      currentRate: currentRate,
      projectedRate: projectedRate,
      rateBoostPct: Math.min(rateBoostPct, 40),
      selectedSkills: selectedGaps.map(g => g.skill),
      prerequisites: Array.from(prereqsNeeded),
      summary: 'Learn ' + selectedGaps.length + ' skills in ~' + totalWeeks + ' weeks (' + weeklyHours + 'hrs/wk). Projected rate: $' + currentRate + ' → $' + projectedRate + '/hr.',
    };
  }

  function generateWeeklyGoals(skill, totalWeeks, courses) {
    var goals = [];
    var mainCourse = courses[0];
    var courseName = mainCourse ? mainCourse.name : skill + ' fundamentals';

    goals.push({
      week: 1,
      title: 'Setup & Foundations',
      tasks: [
        'Set up development environment for ' + skill,
        'Start ' + courseName,
        'Complete intro chapters/modules',
        'Write notes on core concepts',
      ],
    });

    if (totalWeeks >= 2) {
      goals.push({
        week: 2,
        title: 'Core Concepts',
        tasks: [
          'Continue ' + courseName + ' (50% completion)',
          'Build first hands-on exercise',
          'Join ' + skill + ' community (Reddit, Discord)',
          'Review best practices and patterns',
        ],
      });
    }

    if (totalWeeks >= 3) {
      goals.push({
        week: 3,
        title: 'Practice Project',
        tasks: [
          'Complete ' + courseName,
          'Start building a mini-project',
          'Apply concepts from course in project',
          courses[1] ? 'Explore ' + courses[1].name + ' for deeper knowledge' : 'Read advanced documentation',
        ],
      });
    }

    if (totalWeeks >= 4) {
      goals.push({
        week: totalWeeks,
        title: 'Portfolio & Apply',
        tasks: [
          'Finish and polish mini-project',
          'Add ' + skill + ' to your profile',
          'Write a brief case study of your project',
          'Apply to 3 jobs requiring ' + skill,
        ],
      });
    }

    return goals;
  }

  /**
   * Render the personalized learning path into a container
   */
  function renderLearningPath(profileData, gaps, container, options) {
    if (!container) return;
    const path = buildPersonalizedLearningPath(profileData, gaps, options);

    let html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:720px;">';

    // Summary header
    html += '<div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;">';
    html += '<h3 style="margin:0 0 8px;color:#7c83ff;font-size:18px;">🗺️ Your Personalized Learning Path</h3>';
    html += '<p style="margin:0;font-size:14px;color:#d1d5db;">' + esc(path.summary) + '</p>';
    html += '<div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">';
    html += '<div style="background:#0d0d1a;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:10px;color:#888;text-transform:uppercase;">Duration</div><div style="font-size:18px;font-weight:700;color:#fbbf24;">' + path.totalWeeks + ' weeks</div></div>';
    html += '<div style="background:#0d0d1a;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:10px;color:#888;text-transform:uppercase;">Rate Boost</div><div style="font-size:18px;font-weight:700;color:#00d4aa;">+' + path.rateBoostPct + '%</div></div>';
    html += '<div style="background:#0d0d1a;border-radius:8px;padding:8px 14px;text-align:center;"><div style="font-size:10px;color:#888;text-transform:uppercase;">Projected Rate</div><div style="font-size:18px;font-weight:700;color:#00d4aa;">$' + path.projectedRate + '/hr</div></div>';
    html += '</div></div>';

    // Phases
    path.phases.forEach(function(phase) {
      html += '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:12px;">';
      html += '<h4 style="margin:0 0 4px;color:#7c83ff;font-size:14px;">Phase ' + phase.phase + ': ' + esc(phase.name) + ' <span style="color:#888;font-weight:400;">(' + phase.totalWeeks + ' weeks)</span></h4>';
      html += '<p style="margin:0 0 14px;font-size:12px;color:#888;">' + esc(phase.description) + '</p>';

      phase.items.forEach(function(item) {
        html += '<div style="background:#1a1a2e;border-radius:8px;padding:14px;margin-bottom:10px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:8px;">';
        html += '<span style="font-weight:600;font-size:14px;color:#e0e0e0;">' + esc(item.skill) + '</span>';
        var badges = '';
        if (item.demandTier) badges += '<span style="font-size:10px;background:#2d2d44;padding:2px 8px;border-radius:4px;color:#fbbf24;">' + item.demandTier + '</span> ';
        if (item.salaryBoost) badges += '<span style="font-size:10px;background:#2d2d44;padding:2px 8px;border-radius:4px;color:#00d4aa;">' + esc(item.salaryBoost) + '</span>';
        if (item.isPrerequisite) badges += '<span style="font-size:10px;background:#7c3aed;padding:2px 8px;border-radius:4px;color:#fff;">prerequisite</span>';
        html += '<div>' + badges + '</div></div>';

        // Courses
        if (item.courses && item.courses.length) {
          html += '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Recommended Courses</div>';
          item.courses.forEach(function(c) {
            html += '<a href="' + c.url + '" target="_blank" rel="noopener" style="display:block;font-size:12px;color:#818cf8;text-decoration:none;margin-bottom:4px;padding:4px 8px;background:#0d0d1a;border-radius:4px;">';
            html += '📚 ' + esc(c.name) + ' <span style="color:#888;">(' + esc(c.provider) + ' · ' + esc(c.duration) + ' · ' + c.level + ')</span></a>';
          });
        }

        // Weekly goals
        if (item.weeklyGoals && item.weeklyGoals.length) {
          html += '<details style="margin-top:8px;"><summary style="font-size:11px;color:#888;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">📅 Weekly Goals (' + item.weeklyGoals.length + ' weeks)</summary>';
          html += '<div style="margin-top:6px;">';
          item.weeklyGoals.forEach(function(wg) {
            html += '<div style="padding:6px 8px;border-left:2px solid #3d3d5c;margin:4px 0;font-size:12px;">';
            html += '<strong style="color:#fbbf24;">Week ' + wg.week + ':</strong> <span style="color:#d1d5db;">' + esc(wg.title) + '</span>';
            html += '<ul style="margin:4px 0 0;padding-left:14px;color:#9ca3af;font-size:11px;">';
            wg.tasks.forEach(function(t) { html += '<li style="margin:2px 0;">' + esc(t) + '</li>'; });
            html += '</ul></div>';
          });
          html += '</div></details>';
        }

        html += '</div>';
      });
      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
    return path;
  }

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  window.CortexSkillGapAnalyzer = {
    analyzeSkillGaps,
    renderSkillGap,
    buildPersonalizedLearningPath,
    renderLearningPath,
    loadData,
    LEARNING_RESOURCES,
    COURSE_CATALOG,
    SKILL_PREREQUISITES,
    SKILL_META,
    COMPLEMENTS,
    version: '2.0.0',
  };
})();
