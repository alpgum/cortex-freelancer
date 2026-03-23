/**
 * Cortex Freelancer — Upwork Profile Scoring Engine
 * [U-004] Real scoring algorithm
 *
 * Takes parsed Upwork profile data → returns comprehensive score 0-100
 * with grade, category breakdowns, actionable recommendations,
 * strengths, and weaknesses.
 *
 * Compatible: ES module + CommonJS
 */

// ─── Market Benchmark Data ────────────────────────────────────────────
// Hourly rates in USD by skill category × experience tier
const MARKET_BENCHMARKS = {
  'Web Development':        { junior: 25, mid: 50, senior: 85 },
  'Mobile Development':     { junior: 30, mid: 55, senior: 95 },
  'React':                  { junior: 30, mid: 55, senior: 90 },
  'Angular':                { junior: 28, mid: 50, senior: 85 },
  'Vue.js':                 { junior: 25, mid: 48, senior: 80 },
  'Node.js':                { junior: 28, mid: 52, senior: 88 },
  'Python':                 { junior: 30, mid: 55, senior: 95 },
  'Data Science':           { junior: 35, mid: 65, senior: 110 },
  'Machine Learning':       { junior: 40, mid: 70, senior: 120 },
  'UI/UX Design':           { junior: 25, mid: 50, senior: 90 },
  'Graphic Design':         { junior: 20, mid: 40, senior: 70 },
  'WordPress':              { junior: 15, mid: 35, senior: 60 },
  'iOS Development':        { junior: 35, mid: 60, senior: 100 },
  'Android Development':    { junior: 30, mid: 55, senior: 90 },
  'DevOps':                 { junior: 35, mid: 65, senior: 110 },
  'Cloud Architecture':     { junior: 40, mid: 70, senior: 120 },
  'Blockchain':             { junior: 40, mid: 75, senior: 130 },
  'Cybersecurity':          { junior: 35, mid: 65, senior: 115 },
  'QA Testing':             { junior: 18, mid: 35, senior: 60 },
  'Technical Writing':      { junior: 20, mid: 40, senior: 70 },
  'SEO':                    { junior: 18, mid: 38, senior: 65 },
  'Digital Marketing':      { junior: 20, mid: 42, senior: 75 },
  'Video Editing':          { junior: 18, mid: 38, senior: 65 },
  'Copywriting':            { junior: 20, mid: 42, senior: 75 },
  'Project Management':     { junior: 25, mid: 50, senior: 85 },
};

// High-demand skills list (2024-2026 market)
const HIGH_DEMAND_SKILLS = [
  'React', 'Next.js', 'TypeScript', 'Node.js', 'Python',
  'AWS', 'Docker', 'Kubernetes', 'Terraform',
  'Machine Learning', 'AI', 'LLM', 'GPT', 'NLP',
  'Data Science', 'Data Engineering',
  'Flutter', 'React Native', 'Swift', 'Kotlin',
  'Figma', 'UI/UX', 'Product Design',
  'Blockchain', 'Solidity', 'Web3',
  'Cybersecurity', 'DevOps', 'CI/CD',
  'GraphQL', 'REST API', 'Microservices',
  'PostgreSQL', 'MongoDB', 'Redis',
  'Go', 'Rust',
];

// ─── Grade Mapping ────────────────────────────────────────────────────

function scoreToGrade(score) {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

// ─── 1. Job Success Score (25%) ───────────────────────────────────────

function scoreJobSuccess(jobSuccess) {
  let score = 0;
  let details = '';

  if (jobSuccess == null) {
    score = 0;
    details = 'No Job Success Score available — likely a new profile with insufficient feedback.';
  } else if (jobSuccess < 70) {
    score = 20;
    details = `Job Success Score of ${jobSuccess}% is critically low. Most clients filter for 90%+.`;
  } else if (jobSuccess < 80) {
    score = 50;
    details = `Job Success Score of ${jobSuccess}% is below average. Aim for 90%+ to unlock Top Rated.`;
  } else if (jobSuccess < 90) {
    score = 70;
    details = `Job Success Score of ${jobSuccess}% is decent but below the Top Rated threshold (90%).`;
  } else if (jobSuccess < 95) {
    score = 85;
    details = `Job Success Score of ${jobSuccess}% qualifies for Top Rated status. Push for 95%+ for Top Rated Plus.`;
  } else {
    score = 100;
    details = `Excellent Job Success Score of ${jobSuccess}%. Top Rated Plus territory.`;
  }

  return { score, weight: 0.25, details };
}

// ─── 2. Hourly Rate vs Market (20%) ──────────────────────────────────

function findBestBenchmark(skills, categories) {
  // Try to match skills/categories against benchmarks
  const candidates = [...(skills || []), ...(categories || [])];
  for (const candidate of candidates) {
    // Direct match
    if (MARKET_BENCHMARKS[candidate]) return { category: candidate, benchmark: MARKET_BENCHMARKS[candidate] };
    // Partial match
    const key = Object.keys(MARKET_BENCHMARKS).find(
      k => k.toLowerCase().includes(candidate.toLowerCase()) ||
           candidate.toLowerCase().includes(k.toLowerCase())
    );
    if (key) return { category: key, benchmark: MARKET_BENCHMARKS[key] };
  }
  // Fallback: Web Development as default
  return { category: 'Web Development', benchmark: MARKET_BENCHMARKS['Web Development'] };
}

function estimateTier(totalEarnings, totalJobs, totalHours) {
  // Estimate experience tier from earnings/jobs/hours
  if ((totalEarnings || 0) > 50000 || (totalJobs || 0) > 50 || (totalHours || 0) > 2000) return 'senior';
  if ((totalEarnings || 0) > 10000 || (totalJobs || 0) > 15 || (totalHours || 0) > 500) return 'mid';
  return 'junior';
}

function scoreHourlyRate(profile) {
  const { hourlyRate, skills, categories, totalEarnings, totalJobs, totalHours } = profile;

  if (!hourlyRate || hourlyRate <= 0) {
    return { score: 0, weight: 0.20, details: 'No hourly rate set. This is a red flag for clients.', benchmark: null };
  }

  const { category, benchmark } = findBestBenchmark(skills, categories);
  const tier = estimateTier(totalEarnings, totalJobs, totalHours);
  const marketRate = benchmark[tier];
  const ratio = hourlyRate / marketRate;

  let score;
  let details;

  if (ratio < 0.5) {
    // Way too low — signals inexperience or desperation
    score = 30;
    details = `Your rate of $${hourlyRate}/hr is ${Math.round((1 - ratio) * 100)}% below market for ${tier} ${category} ($${marketRate}/hr). Extremely low rates erode perceived value.`;
  } else if (ratio < 0.75) {
    // Below market
    score = 55;
    details = `Your rate of $${hourlyRate}/hr is ${Math.round((1 - ratio) * 100)}% below market for ${tier} ${category} ($${marketRate}/hr). Consider raising to at least $${Math.round(marketRate * 0.85)}/hr.`;
  } else if (ratio < 0.9) {
    // Slightly below
    score = 75;
    details = `Your rate of $${hourlyRate}/hr is slightly below market for ${tier} ${category} ($${marketRate}/hr). Room to increase.`;
  } else if (ratio <= 1.15) {
    // Sweet spot
    score = 100;
    details = `Your rate of $${hourlyRate}/hr is well-positioned for ${tier} ${category} (market: $${marketRate}/hr).`;
  } else if (ratio <= 1.4) {
    // Above market — premium positioning
    score = 85;
    details = `Your rate of $${hourlyRate}/hr is ${Math.round((ratio - 1) * 100)}% above market for ${tier} ${category} ($${marketRate}/hr). Premium but may reduce invites.`;
  } else {
    // Way above — limits opportunities
    score = 60;
    details = `Your rate of $${hourlyRate}/hr is ${Math.round((ratio - 1) * 100)}% above market for ${tier} ${category} ($${marketRate}/hr). May significantly reduce client interest unless you have exceptional credentials.`;
  }

  return { score, weight: 0.20, details, benchmark: { category, tier, marketRate } };
}

// ─── 3. Total Earnings Tier (15%) ────────────────────────────────────

function scoreEarnings(totalEarnings) {
  let score, details;
  const e = totalEarnings || 0;

  if (e === 0) {
    score = 0;
    details = 'No earnings yet. New profiles start here — focus on landing first contracts.';
  } else if (e < 1000) {
    score = 20;
    details = `$${e.toLocaleString()} earned. Still in early stages — prioritize building reviews over rate.`;
  } else if (e < 10000) {
    score = 40;
    details = `$${e.toLocaleString()} earned. Building momentum. Focus on repeat clients and longer contracts.`;
  } else if (e < 50000) {
    score = 60;
    details = `$${e.toLocaleString()} earned. Solid track record forming. Clients see you as established.`;
  } else if (e < 100000) {
    score = 80;
    details = `$${e.toLocaleString()} earned. Strong earnings history. You're in the top tier of freelancers.`;
  } else {
    score = 100;
    details = `$${e.toLocaleString()} earned. Elite earner. This alone builds massive client confidence.`;
  }

  return { score, weight: 0.15, details };
}

// ─── 4. Profile Completeness (15%) ──────────────────────────────────

function scoreProfileCompleteness(profile) {
  let points = 0;
  const maxPoints = 100; // title(10)+desc(15)+skills(10)+portfolio(15)+rate(10)+cat(10)+loc(10)+member(10)+jss(10)
  const breakdown = [];

  if (profile.title && profile.title.trim().length > 0) {
    points += 10;
    breakdown.push('✓ Title set');
  } else {
    breakdown.push('✗ Missing title (-10)');
  }

  if (profile.description && profile.description.length > 200) {
    points += 15;
    breakdown.push('✓ Description >200 chars');
  } else if (profile.description && profile.description.length > 0) {
    points += 7;
    breakdown.push(`✗ Description too short (${profile.description.length} chars, need 200+) (-8)`);
  } else {
    breakdown.push('✗ No description (-15)');
  }

  const skillCount = (profile.skills || []).length;
  if (skillCount > 5) {
    points += 10;
    breakdown.push(`✓ ${skillCount} skills listed`);
  } else if (skillCount > 0) {
    points += 5;
    breakdown.push(`✗ Only ${skillCount} skills (need 6+) (-5)`);
  } else {
    breakdown.push('✗ No skills listed (-10)');
  }

  const portfolioCount = (profile.portfolio || []).length;
  if (portfolioCount > 0) {
    points += 15;
    breakdown.push(`✓ ${portfolioCount} portfolio item(s)`);
  } else {
    breakdown.push('✗ No portfolio items (-15)');
  }

  if (profile.hourlyRate && profile.hourlyRate > 0) {
    points += 10;
    breakdown.push('✓ Hourly rate set');
  } else {
    breakdown.push('✗ No hourly rate set (-10)');
  }

  if (profile.categories && profile.categories.length > 0) {
    points += 10;
    breakdown.push('✓ Categories set');
  } else {
    breakdown.push('✗ No categories (-10)');
  }

  if (profile.location && profile.location.trim().length > 0) {
    points += 10;
    breakdown.push('✓ Location set');
  } else {
    breakdown.push('✗ No location (-10)');
  }

  if (profile.memberSince) {
    points += 10;
    breakdown.push('✓ Member since visible');
  } else {
    breakdown.push('✗ Member since not available (-10)');
  }

  if (profile.jobSuccess != null) {
    points += 10;
    breakdown.push('✓ Job Success Score visible');
  } else {
    breakdown.push('✗ No Job Success Score yet (-10)');
  }

  const score = Math.round((points / maxPoints) * 100);
  return {
    score,
    weight: 0.15,
    details: `Profile ${score}% complete (${points}/${maxPoints} points).`,
    breakdown,
  };
}

// ─── 5. Skills Diversity & Demand (10%) ──────────────────────────────

function scoreSkills(skills) {
  const list = skills || [];
  if (list.length === 0) {
    return { score: 0, weight: 0.10, details: 'No skills listed. Add at least 5-10 relevant skills.' };
  }

  // Count: more skills = better (up to a point)
  let countScore;
  if (list.length >= 10) countScore = 50;
  else if (list.length >= 7) countScore = 40;
  else if (list.length >= 5) countScore = 30;
  else if (list.length >= 3) countScore = 20;
  else countScore = 10;

  // Demand overlap
  const highDemandMatches = list.filter(skill =>
    HIGH_DEMAND_SKILLS.some(hd =>
      hd.toLowerCase() === skill.toLowerCase() ||
      skill.toLowerCase().includes(hd.toLowerCase()) ||
      hd.toLowerCase().includes(skill.toLowerCase())
    )
  );

  let demandScore;
  const matchRatio = highDemandMatches.length / Math.max(list.length, 1);
  if (matchRatio >= 0.6) demandScore = 50;
  else if (matchRatio >= 0.4) demandScore = 40;
  else if (matchRatio >= 0.25) demandScore = 30;
  else if (matchRatio >= 0.1) demandScore = 20;
  else demandScore = 10;

  const score = countScore + demandScore;
  const details = `${list.length} skills listed, ${highDemandMatches.length} are high-demand (${highDemandMatches.join(', ') || 'none'}).`;

  return { score, weight: 0.10, details, highDemandMatches };
}

// ─── 6. Portfolio Quality (10%) ──────────────────────────────────────

function scorePortfolio(portfolio) {
  const items = portfolio || [];
  if (items.length === 0) {
    return { score: 0, weight: 0.10, details: 'No portfolio items. Adding even 2-3 projects can significantly boost credibility.' };
  }

  let score = 0;

  // Count score (max 40)
  if (items.length >= 6) score += 40;
  else if (items.length >= 4) score += 30;
  else if (items.length >= 2) score += 20;
  else score += 10;

  // Image coverage (max 30)
  const withImages = items.filter(i => i.image || i.thumbnail || i.images?.length > 0).length;
  const imageRatio = withImages / items.length;
  if (imageRatio >= 0.8) score += 30;
  else if (imageRatio >= 0.5) score += 20;
  else if (imageRatio > 0) score += 10;

  // Description coverage (max 30)
  const withDesc = items.filter(i => i.description && i.description.length > 50).length;
  const descRatio = withDesc / items.length;
  if (descRatio >= 0.8) score += 30;
  else if (descRatio >= 0.5) score += 20;
  else if (descRatio > 0) score += 10;

  const details = `${items.length} portfolio items. ${withImages} with images, ${withDesc} with detailed descriptions.`;
  return { score: Math.min(score, 100), weight: 0.10, details };
}

// ─── 7. Bonus: Tenure & Activity (5%) ───────────────────────────────

function scoreTenureActivity(profile) {
  const { memberSince, totalJobs, totalHours } = profile;

  let tenureYears = 0;
  if (memberSince) {
    const memberDate = new Date(memberSince);
    if (!isNaN(memberDate.getTime())) {
      tenureYears = (Date.now() - memberDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    }
  }

  let score = 0;

  // Tenure score (max 40)
  if (tenureYears >= 5) score += 40;
  else if (tenureYears >= 3) score += 30;
  else if (tenureYears >= 1) score += 20;
  else if (tenureYears >= 0.5) score += 10;

  // Activity — jobs per year of tenure (max 30)
  const jobsPerYear = tenureYears > 0 ? (totalJobs || 0) / tenureYears : (totalJobs || 0);
  if (jobsPerYear >= 12) score += 30;
  else if (jobsPerYear >= 6) score += 20;
  else if (jobsPerYear >= 2) score += 10;

  // Hours logged (max 30)
  if ((totalHours || 0) >= 1000) score += 30;
  else if ((totalHours || 0) >= 500) score += 20;
  else if ((totalHours || 0) >= 100) score += 10;

  const details = tenureYears > 0
    ? `${tenureYears.toFixed(1)} years on Upwork, ${totalJobs || 0} jobs, ${totalHours || 0} hours logged.`
    : 'Tenure data not available.';

  return { score: Math.min(score, 100), weight: 0.05, details };
}

// ─── Recommendation Generator ────────────────────────────────────────

function generateRecommendations(profile, categories) {
  const recs = [];
  const strengths = [];
  const weaknesses = [];

  // Job Success
  const jss = categories.jobSuccess;
  if (jss.score === 0 && profile.jobSuccess == null) {
    weaknesses.push('No Job Success Score yet');
    recs.push({
      title: 'Build your Job Success Score',
      description: 'Complete 2-3 small contracts with 5-star reviews to establish your JSS. Focus on clear communication and on-time delivery.',
      priority: 'high',
      impact: 'high',
    });
  } else if (jss.score <= 50) {
    weaknesses.push(`Low Job Success Score (${profile.jobSuccess}%)`);
    recs.push({
      title: 'Improve your Job Success Score',
      description: `Your Job Success Score of ${profile.jobSuccess}% is well below the 90% threshold most clients look for. Avoid taking on projects you can't complete, communicate proactively, and never abandon contracts.`,
      priority: 'critical',
      impact: 'high',
    });
  } else if (jss.score === 70) {
    weaknesses.push(`Job Success Score of ${profile.jobSuccess}% — below Top Rated`);
    recs.push({
      title: 'Push for Top Rated status',
      description: `Your Job Success Score of ${profile.jobSuccess}% is good but below the Top Rated threshold (90%). Focus on client communication, avoid contract disputes, and close contracts cleanly.`,
      priority: 'medium',
      impact: 'high',
    });
  } else if (jss.score >= 85) {
    strengths.push(`Strong Job Success Score (${profile.jobSuccess}%)`);
  }

  // Rate
  const rate = categories.rate;
  if (rate.score === 0) {
    weaknesses.push('No hourly rate set');
    recs.push({
      title: 'Set your hourly rate',
      description: 'Profiles without a rate appear incomplete. Set a competitive rate based on your experience and skill category.',
      priority: 'high',
      impact: 'medium',
    });
  } else if (rate.benchmark && rate.score <= 55) {
    const { category, tier, marketRate } = rate.benchmark;
    weaknesses.push(`Rate significantly below market ($${profile.hourlyRate}/hr vs $${marketRate}/hr market)`);
    const suggestedRate = Math.round(marketRate * 0.85);
    recs.push({
      title: `Raise your hourly rate to at least $${suggestedRate}/hr`,
      description: `Your rate of $${profile.hourlyRate}/hr is ${Math.round((1 - profile.hourlyRate / marketRate) * 100)}% below market for ${tier} ${category} developers ($${marketRate}/hr). Low rates signal inexperience. Consider raising to $${suggestedRate}-$${marketRate}/hr.`,
      priority: 'high',
      impact: 'medium',
    });
  } else if (rate.score >= 85) {
    strengths.push(`Well-positioned hourly rate ($${profile.hourlyRate}/hr)`);
  }

  // Earnings
  const earn = categories.earnings;
  if (earn.score <= 20) {
    weaknesses.push('Very low or no earnings');
    recs.push({
      title: 'Focus on landing your first contracts',
      description: 'Apply to 10-15 jobs per week. Write personalized proposals. Start with smaller fixed-price projects to build reviews quickly.',
      priority: 'high',
      impact: 'high',
    });
  } else if (earn.score >= 80) {
    strengths.push(`Strong earnings history ($${(profile.totalEarnings || 0).toLocaleString()})`);
  }

  // Profile completeness
  const pc = categories.profileCompleteness;
  if (pc.score < 60) {
    weaknesses.push('Incomplete profile');
    const missing = (pc.breakdown || []).filter(b => b.startsWith('✗'));
    recs.push({
      title: 'Complete your profile',
      description: `Your profile is only ${pc.score}% complete. Fix these: ${missing.join('; ')}. A complete profile can increase your score by ${100 - pc.score} points in this category.`,
      priority: 'high',
      impact: 'medium',
    });
  } else if (pc.score >= 90) {
    strengths.push('Nearly complete profile');
  }

  // Specific completeness gaps
  if (profile.description && profile.description.length > 0 && profile.description.length <= 200) {
    recs.push({
      title: `Expand your profile description to 200+ characters`,
      description: `Your description is ${profile.description.length} characters — add ${200 - profile.description.length} more characters. Include specific technologies, project types, and results you've delivered.`,
      priority: 'medium',
      impact: 'low',
    });
  }

  // Skills
  const sk = categories.skills;
  const skillCount = (profile.skills || []).length;
  if (sk.score < 50) {
    weaknesses.push(`Only ${skillCount} skills listed`);
    if (skillCount < 5) {
      recs.push({
        title: `Add ${Math.max(5 - skillCount, 3)} more skills to your profile`,
        description: `You have ${skillCount} skills listed. Adding relevant high-demand skills (${HIGH_DEMAND_SKILLS.slice(0, 5).join(', ')}) improves search visibility and match rate.`,
        priority: 'medium',
        impact: 'medium',
      });
    }
  } else if (sk.highDemandMatches && sk.highDemandMatches.length >= 3) {
    strengths.push(`${sk.highDemandMatches.length} high-demand skills`);
  }

  // Portfolio
  const pf = categories.portfolio;
  const portfolioCount = (profile.portfolio || []).length;
  if (pf.score === 0) {
    weaknesses.push('Empty portfolio');
    const potentialGain = Math.round(pf.weight * 40); // rough estimate
    recs.push({
      title: 'Add portfolio items to showcase your work',
      description: `Adding ${3} portfolio items with images and descriptions could increase your profile score by ~${potentialGain + 5} points. Include project screenshots, technologies used, and outcomes.`,
      priority: 'medium',
      impact: 'medium',
    });
  } else if (pf.score < 50) {
    const itemsWithoutImages = portfolioCount - ((profile.portfolio || []).filter(i => i.image || i.thumbnail || i.images?.length > 0).length);
    if (itemsWithoutImages > 0) {
      recs.push({
        title: `Add images to ${itemsWithoutImages} portfolio item(s)`,
        description: 'Portfolio items with visuals get significantly more attention. Add screenshots, mockups, or demo images.',
        priority: 'low',
        impact: 'low',
      });
    }
  } else if (pf.score >= 70) {
    strengths.push(`Strong portfolio (${portfolioCount} items)`);
  }

  // Tenure
  const ta = categories.tenureActivity;
  if (ta.score >= 60) {
    strengths.push('Established presence on Upwork');
  }

  // Sort recs by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recs.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  return { recommendations: recs, strengths, weaknesses };
}

// ─── Main Scoring Function ───────────────────────────────────────────

function scoreProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('scoreProfile requires a profile object');
  }

  // Score each category
  const jobSuccess = scoreJobSuccess(profile.jobSuccess);
  const rate = scoreHourlyRate(profile);
  const earnings = scoreEarnings(profile.totalEarnings);
  const profileCompleteness = scoreProfileCompleteness(profile);
  const skills = scoreSkills(profile.skills);
  const portfolio = scorePortfolio(profile.portfolio);
  const tenureActivity = scoreTenureActivity(profile);

  const cats = { jobSuccess, rate, earnings, profileCompleteness, skills, portfolio, tenureActivity };

  // Weighted overall score
  const overall = Math.round(
    jobSuccess.score * jobSuccess.weight +
    rate.score * rate.weight +
    earnings.score * earnings.weight +
    profileCompleteness.score * profileCompleteness.weight +
    skills.score * skills.weight +
    portfolio.score * portfolio.weight +
    tenureActivity.score * tenureActivity.weight
  );

  const grade = scoreToGrade(overall);

  // Generate recommendations
  const { recommendations, strengths, weaknesses } = generateRecommendations(profile, cats);

  return {
    overall,
    grade,
    categories: cats,
    recommendations,
    strengths,
    weaknesses,
  };
}

// ─── Exports (ES module + CommonJS) ──────────────────────────────────

// Named exports for ES module consumers
const exports_obj = {
  scoreProfile,
  scoreToGrade,
  MARKET_BENCHMARKS,
  HIGH_DEMAND_SKILLS,
};

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exports_obj;
  module.exports.scoreProfile = scoreProfile;
  module.exports.scoreToGrade = scoreToGrade;
  module.exports.MARKET_BENCHMARKS = MARKET_BENCHMARKS;
  module.exports.HIGH_DEMAND_SKILLS = HIGH_DEMAND_SKILLS;
}

// ES module default + named (for bundlers that support both)
export { scoreProfile, scoreToGrade, MARKET_BENCHMARKS, HIGH_DEMAND_SKILLS };
export default scoreProfile;
