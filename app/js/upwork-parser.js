/**
 * Upwork Profile Parser — Cortex Freelancer
 * Parses pasted Upwork profile text/HTML to extract structured data.
 * Export: window.parseUpworkProfile(rawText) → structured object
 */
(function () {
  'use strict';

  // ── Helpers ──

  function clean(str) {
    if (!str) return null;
    return str.replace(/\s+/g, ' ').trim() || null;
  }

  function extractNumber(str) {
    if (!str) return null;
    var m = str.replace(/,/g, '').match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
  }

  function extractCurrency(str) {
    if (!str) return null;
    var m = str.replace(/,/g, '').match(/\$\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
  }

  // ── Main Parser ──

  function parseUpworkProfile(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;

    // Strip HTML tags if pasted HTML
    var text = rawText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '');
    text = text.replace(/\s+/g, ' ');

    var profile = {
      name: null,
      title: null,
      country: null,
      timezone: null,
      hourlyRate: null,
      overview: null,
      skills: [],
      portfolio: [],
      workHistory: [],
      totalEarnings: null,
      jobSuccessScore: null,
      totalHours: null,
      certifications: [],
      languages: [],
      availability: null,
      profilePhoto: null,
      memberSince: null,
      responseTime: null,
      _raw: rawText.substring(0, 200),
      _parsedAt: new Date().toISOString()
    };

    // ── Name ──
    // Upwork profiles often show name at top, before title
    var namePatterns = [
      /(?:^|\n)\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z]\.?)?)\s*\n/,
      /(?:Hi,?\s*I'?m\s+)([A-Z][a-z]+ [A-Z][a-z]+)/i,
      /(?:name|freelancer)[:\s]+([A-Z][a-zA-Z]+ [A-Z][a-zA-Z]+)/i
    ];
    for (var i = 0; i < namePatterns.length; i++) {
      var nm = text.match(namePatterns[i]);
      if (nm) { profile.name = clean(nm[1]); break; }
    }

    // ── Title ──
    var titlePatterns = [
      /(?:title|headline|tagline)[:\s]+["']?([^"'\n]{5,80})["']?/i,
      /(?:^|\n)\s*([A-Z][^\n]{10,80}(?:Developer|Designer|Engineer|Writer|Specialist|Consultant|Expert|Manager|Analyst|Architect|Freelancer)[^\n]{0,30})/i,
      /(?:^|\n)\s*([^\n]{10,80}(?:\||\-|\–)[^\n]{5,60})/
    ];
    for (i = 0; i < titlePatterns.length; i++) {
      var tt = text.match(titlePatterns[i]);
      if (tt) { profile.title = clean(tt[1]); break; }
    }

    // ── Country ──
    var countryPatterns = [
      /(?:location|based in|from|country|located)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})/i,
      /(?:,\s*)?(Turkey|Egypt|Nigeria|Pakistan|India|Philippines|United States|United Kingdom|Germany|Netherlands|Canada|Australia|Brazil|Mexico|Indonesia|Bangladesh|Ukraine|Poland|Romania|Kenya|South Africa|Morocco|Ghana|Colombia|Argentina|Vietnam|Thailand|Malaysia|Singapore|Japan|South Korea|France|Spain|Italy|Portugal|Ireland|Sweden|Norway|Denmark|Finland|Czech Republic|Hungary|Serbia|Croatia|Bulgaria|Greece|Israel|UAE|Saudi Arabia|Jordan|Lebanon|Tunisia|Algeria)/i,
      /\b(Istanbul|Cairo|Lagos|Karachi|Lahore|Mumbai|Delhi|Manila|Berlin|Amsterdam|London|New York|San Francisco|Toronto|Sydney|Dubai|Riyadh)\b/i
    ];
    for (i = 0; i < countryPatterns.length; i++) {
      var ct = text.match(countryPatterns[i]);
      if (ct) { profile.country = clean(ct[1]); break; }
    }

    // Map cities to countries if needed
    var cityToCountry = {
      istanbul: 'Turkey', cairo: 'Egypt', lagos: 'Nigeria', karachi: 'Pakistan',
      lahore: 'Pakistan', mumbai: 'India', delhi: 'India', manila: 'Philippines',
      berlin: 'Germany', amsterdam: 'Netherlands', london: 'United Kingdom',
      'new york': 'United States', 'san francisco': 'United States',
      toronto: 'Canada', sydney: 'Australia', dubai: 'UAE', riyadh: 'Saudi Arabia'
    };
    if (profile.country) {
      var lower = profile.country.toLowerCase();
      if (cityToCountry[lower]) profile.country = cityToCountry[lower];
    }

    // ── Timezone ──
    var tzMatch = text.match(/(?:timezone|time zone|tz)[:\s]+([^\n,]{3,30})/i) ||
                  text.match(/(UTC[+-]\d{1,2}(?::\d{2})?|GMT[+-]\d{1,2}|EST|PST|CST|MST|CET|EET|IST|PKT|TRT)/i);
    if (tzMatch) profile.timezone = clean(tzMatch[1]);

    // ── Hourly Rate ──
    var ratePatterns = [
      /\$\s*(\d{1,4}(?:\.\d{2})?)\s*(?:\/\s*hr|per\s*hour|hourly|\/ hour)/i,
      /(?:rate|hourly)[:\s]*\$\s*(\d{1,4}(?:\.\d{2})?)/i,
      /(\d{1,4}(?:\.\d{2})?)\s*(?:USD)?\s*(?:\/\s*hr|per\s*hour|hourly)/i
    ];
    for (i = 0; i < ratePatterns.length; i++) {
      var rt = text.match(ratePatterns[i]);
      if (rt) { profile.hourlyRate = parseFloat(rt[1]); break; }
    }

    // ── Overview/Bio ──
    // Look for the overview section
    var overviewPatterns = [
      /(?:overview|about me|bio|description|summary|profile description)[:\s]*\n?\s*(.{50,2000}?)(?=\n\s*(?:skills|work history|portfolio|employment|education|certifications|languages|$))/is,
      /(?:overview|about me|bio|description|summary)[:\s]*\n?\s*(.{50,2000}?)(?=\n\s*\n)/is
    ];
    for (i = 0; i < overviewPatterns.length; i++) {
      var ov = text.match(overviewPatterns[i]);
      if (ov) { profile.overview = clean(ov[1]); break; }
    }
    // Fallback: grab longest paragraph
    if (!profile.overview) {
      var paragraphs = text.split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(function (p) { return p.length > 80; });
      if (paragraphs.length) {
        paragraphs.sort(function (a, b) { return b.length - a.length; });
        profile.overview = clean(paragraphs[0]);
      }
    }

    // ── Skills ──
    var skillSection = text.match(/(?:skills|expertise|technologies|tech stack)[:\s]*\n?\s*(.{10,1000}?)(?=\n\s*(?:portfolio|work history|employment|education|certifications|languages|overview|$))/is);
    if (skillSection) {
      var skillText = skillSection[1];
      // Split by common delimiters
      var rawSkills = skillText.split(/[,\n•·|·]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 1 && s.length < 50; });
      profile.skills = rawSkills.slice(0, 30);
    }
    // Fallback: find known skill keywords
    if (profile.skills.length === 0) {
      var knownSkills = ['JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Python', 'Django', 'Flask',
        'Ruby', 'Rails', 'PHP', 'Laravel', 'WordPress', 'Java', 'Spring', 'C#', '.NET', 'Go', 'Rust', 'Swift',
        'Kotlin', 'Flutter', 'React Native', 'iOS', 'Android', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
        'GraphQL', 'REST API', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase', 'Figma', 'Sketch',
        'Adobe XD', 'Photoshop', 'Illustrator', 'UI/UX', 'UX Design', 'Web Design', 'Graphic Design',
        'SEO', 'SEM', 'PPC', 'Google Ads', 'Facebook Ads', 'Content Writing', 'Copywriting', 'Blog Writing',
        'Technical Writing', 'Translation', 'Data Analysis', 'Machine Learning', 'AI', 'Deep Learning',
        'TensorFlow', 'PyTorch', 'NLP', 'Data Science', 'Power BI', 'Tableau', 'Excel', 'Google Sheets',
        'Shopify', 'WooCommerce', 'Magento', 'Stripe', 'API Integration', 'Automation', 'Zapier',
        'Project Management', 'Agile', 'Scrum', 'Jira', 'HTML', 'CSS', 'SASS', 'Tailwind', 'Bootstrap',
        'Next.js', 'Nuxt', 'Svelte', 'Express', 'FastAPI', 'Solidity', 'Blockchain', 'Web3',
        'Video Editing', 'After Effects', 'Premiere Pro', 'DaVinci Resolve', 'Motion Graphics'];
      for (var k = 0; k < knownSkills.length; k++) {
        var re = new RegExp('\\b' + knownSkills[k].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (re.test(text)) profile.skills.push(knownSkills[k]);
      }
    }

    // ── Work History ──
    var workSection = text.match(/(?:work history|completed jobs|past projects|employment history)[:\s]*\n?\s*([\s\S]{20,5000}?)(?=\n\s*(?:skills|portfolio|education|certifications|languages|$))/i);
    if (workSection) {
      // Try to find individual job entries
      var jobBlocks = workSection[1].split(/\n{2,}|\n(?=\$|★|⭐|Rating)/);
      for (var j = 0; j < Math.min(jobBlocks.length, 20); j++) {
        var block = jobBlocks[j].trim();
        if (block.length < 15) continue;
        var job = {
          title: null,
          client: null,
          dates: null,
          rating: null,
          feedback: null,
          earnings: null
        };
        // First line often title
        var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
        if (lines[0]) job.title = lines[0].substring(0, 100);
        // Rating
        var ratingMatch = block.match(/(\d(?:\.\d{1,2})?)\s*(?:\/\s*5|stars?|★|⭐|out of 5)/i) ||
                          block.match(/(?:rating|score)[:\s]*(\d(?:\.\d{1,2})?)/i);
        if (ratingMatch) job.rating = parseFloat(ratingMatch[1]);
        // Earnings
        var earnMatch = block.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
        if (earnMatch) job.earnings = parseFloat(earnMatch[1].replace(/,/g, ''));
        // Feedback
        var fbMatch = block.match(/(?:feedback|review|comment)[:\s]*["']?(.{10,300})["']?/i);
        if (fbMatch) job.feedback = clean(fbMatch[1]);

        if (job.title && job.title.length > 5) profile.workHistory.push(job);
      }
    }

    // ── Total Earnings ──
    var earningsMatch = text.match(/(?:total\s*earnings?|earned)[:\s]*\$\s*([\d,]+(?:\.\d{2})?)/i) ||
                        text.match(/\$\s*([\d,]+)(?:k|\+)?\s*(?:earned|total earnings)/i);
    if (earningsMatch) profile.totalEarnings = parseFloat(earningsMatch[1].replace(/,/g, ''));
    // Handle $XXk format
    if (!profile.totalEarnings) {
      var kMatch = text.match(/\$\s*(\d+)k\+?\s*(?:earned|\+)/i);
      if (kMatch) profile.totalEarnings = parseFloat(kMatch[1]) * 1000;
    }

    // ── Job Success Score ──
    var jssMatch = text.match(/(\d{1,3})\s*%?\s*(?:job success|JSS|success score|success rate)/i) ||
                   text.match(/(?:job success|JSS|success score)[:\s]*(\d{1,3})\s*%?/i);
    if (jssMatch) {
      var jss = parseInt(jssMatch[1], 10);
      if (jss >= 0 && jss <= 100) profile.jobSuccessScore = jss;
    }

    // ── Total Hours ──
    var hoursMatch = text.match(/([\d,]+)\s*(?:hours?\s*(?:worked|logged|billed|total))/i) ||
                     text.match(/(?:hours?\s*(?:worked|logged|billed|total))[:\s]*([\d,]+)/i) ||
                     text.match(/([\d,]+)\s*(?:hrs)/i);
    if (hoursMatch) profile.totalHours = parseInt(hoursMatch[1].replace(/,/g, ''), 10);

    // ── Certifications ──
    var certSection = text.match(/(?:certifications?|credentials?|certificates?)[:\s]*\n?\s*(.{10,500}?)(?=\n\s*(?:skills|portfolio|work history|education|languages|$))/is);
    if (certSection) {
      profile.certifications = certSection[1].split(/[,\n•·]+/).map(function (c) { return c.trim(); }).filter(function (c) { return c.length > 3 && c.length < 100; });
    }

    // ── Languages ──
    var langSection = text.match(/(?:languages?)[:\s]*\n?\s*(.{5,300}?)(?=\n\s*(?:skills|portfolio|work history|education|certifications|$))/is);
    if (langSection) {
      profile.languages = langSection[1].split(/[,\n•·]+/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 1 && l.length < 60; });
    }
    // Fallback: detect common languages
    if (profile.languages.length === 0) {
      var knownLangs = ['English', 'Turkish', 'Arabic', 'Spanish', 'French', 'German', 'Portuguese',
        'Hindi', 'Urdu', 'Chinese', 'Japanese', 'Korean', 'Russian', 'Italian', 'Dutch', 'Polish',
        'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Greek', 'Hebrew', 'Persian', 'Thai',
        'Vietnamese', 'Indonesian', 'Malay', 'Filipino', 'Tagalog', 'Bengali', 'Punjabi'];
      for (var lg = 0; lg < knownLangs.length; lg++) {
        if (text.indexOf(knownLangs[lg]) !== -1) profile.languages.push(knownLangs[lg]);
      }
    }

    // ── Availability ──
    var availMatch = text.match(/(?:availability|available)[:\s]*(full[- ]?time|part[- ]?time|as needed|more than 30|less than 30|10-30|open)/i) ||
                     text.match(/(full[- ]?time|part[- ]?time|as needed)\s*(?:availability|available)/i);
    if (availMatch) {
      var av = availMatch[1].toLowerCase().replace(/[\s-]+/g, '-');
      if (av.indexOf('full') !== -1 || av.indexOf('more') !== -1) profile.availability = 'full-time';
      else if (av.indexOf('part') !== -1 || av.indexOf('10-30') !== -1 || av.indexOf('less') !== -1) profile.availability = 'part-time';
      else profile.availability = 'as-needed';
    }

    // ── Profile Photo ──
    var photoMatch = rawText.match(/(?:src|href)=["'](https?:\/\/[^"']+(?:\.jpg|\.jpeg|\.png|\.webp|profile[^"']+))/i);
    if (photoMatch) profile.profilePhoto = photoMatch[1];

    // ── Member Since ──
    var memberMatch = text.match(/(?:member since|joined|on upwork since)[:\s]*([A-Z][a-z]+\.?\s+\d{4}|\d{4})/i);
    if (memberMatch) profile.memberSince = clean(memberMatch[1]);

    // ── Response Time ──
    var respMatch = text.match(/(?:response time|responds?)[:\s]*(within \d+\s*\w+|\d+\s*(?:hours?|hrs?|minutes?|mins?))/i);
    if (respMatch) profile.responseTime = clean(respMatch[1]);

    return profile;
  }

  // ── Demo Profile ──

  function getDemoProfile() {
    return {
      name: 'Emre Yilmaz',
      title: 'Full-Stack Web Developer | React & Node.js Expert',
      country: 'Turkey',
      timezone: 'UTC+3',
      hourlyRate: 45,
      overview: 'Experienced full-stack developer with 6+ years building web applications for startups and enterprises. I specialize in React, Next.js, Node.js, and TypeScript. I\'ve helped 40+ clients ship products faster — from MVPs to production-scale SaaS platforms. Strong focus on clean architecture, performance optimization, and meeting deadlines. Previously worked at a Y Combinator startup. I communicate clearly, deliver on time, and care about code quality.',
      skills: ['JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'AWS', 'Docker', 'GraphQL', 'REST API', 'Tailwind', 'Firebase', 'Git'],
      portfolio: [
        { title: 'SaaS Dashboard for FinTech Startup', description: 'Built a real-time analytics dashboard with React, Node.js, and PostgreSQL. 50K+ monthly users.' },
        { title: 'E-Commerce Platform Migration', description: 'Migrated a legacy PHP store to Next.js + Stripe. 3x faster load times, 40% increase in conversions.' },
        { title: 'AI Content Generator', description: 'Full-stack app using OpenAI API, React frontend, Express backend. 10K users in first month.' }
      ],
      workHistory: [
        { title: 'Full-Stack Development for SaaS Platform', client: null, dates: 'Oct 2025 - Jan 2026', rating: 5.0, feedback: 'Emre is exceptional. Delivered ahead of schedule with great communication. Will hire again.', earnings: 12500 },
        { title: 'React Dashboard & API Development', client: null, dates: 'Jul 2025 - Sep 2025', rating: 5.0, feedback: 'Outstanding work. Clean code, great architecture decisions.', earnings: 8200 },
        { title: 'E-Commerce Site Rebuild', client: null, dates: 'Mar 2025 - Jun 2025', rating: 4.9, feedback: 'Very professional. Handled scope changes gracefully.', earnings: 15000 },
        { title: 'MVP Development for Health-Tech Startup', client: null, dates: 'Dec 2024 - Feb 2025', rating: 5.0, feedback: 'Turned our idea into a working product in 8 weeks. Highly recommend.', earnings: 9800 },
        { title: 'API Integration & Automation', client: null, dates: 'Oct 2024 - Nov 2024', rating: 5.0, feedback: 'Fast, reliable, and great at problem solving.', earnings: 4500 }
      ],
      totalEarnings: 78000,
      jobSuccessScore: 97,
      totalHours: 2840,
      certifications: ['AWS Certified Developer – Associate'],
      languages: ['English', 'Turkish'],
      availability: 'full-time',
      profilePhoto: null,
      memberSince: 'March 2020',
      responseTime: 'within 1 hour',
      _demo: true,
      _parsedAt: new Date().toISOString()
    };
  }

  // ── Expose ──
  window.parseUpworkProfile = parseUpworkProfile;
  window.getDemoUpworkProfile = getDemoProfile;
})();
