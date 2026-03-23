/**
 * [U-008] Profile Completeness Checker
 *
 * Analyzes a parsed Upwork profile object and returns a completeness score,
 * grade, per-item breakdown, missing items, and quick-win suggestions.
 */

// Generic titles that don't count as "professional"
const GENERIC_TITLES = [
  'freelancer', 'worker', 'professional', 'expert', 'specialist',
  'virtual assistant', 'assistant', 'contractor', 'consultant',
  'developer', 'designer', 'writer', 'engineer',
];

function isGenericTitle(title) {
  if (!title || typeof title !== 'string') return true;
  const normalized = title.trim().toLowerCase();
  if (normalized.length < 3) return true;
  return GENERIC_TITLES.includes(normalized);
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Check profile completeness.
 *
 * @param {object} profile - Parsed Upwork profile with fields like:
 *   title, description, skills[], portfolio[], jobSuccessScore,
 *   hourlyRate, location, categories[], memberSince (Date|string),
 *   totalJobs, totalEarnings
 * @returns {{ score: number, grade: string, items: object[], missing: string[], quickWins: string[] }}
 */
function checkCompleteness(profile) {
  if (!profile || typeof profile !== 'object') {
    throw new TypeError('profile must be a non-null object');
  }

  const items = [];
  const missing = [];
  const quickWins = [];
  let totalScore = 0;

  const p = profile;

  // Helper: description length
  const descLen = (p.description && typeof p.description === 'string')
    ? p.description.trim().length : 0;

  // Helper: skills count
  const skills = Array.isArray(p.skills) ? p.skills : [];
  const skillsCount = skills.length;

  // Helper: portfolio count
  const portfolio = Array.isArray(p.portfolio) ? p.portfolio : [];
  const portfolioCount = portfolio.length;

  // Helper: membership months
  let memberMonths = 0;
  if (p.memberSince) {
    const since = new Date(p.memberSince);
    if (!isNaN(since.getTime())) {
      const now = new Date();
      memberMonths = (now.getFullYear() - since.getFullYear()) * 12
        + (now.getMonth() - since.getMonth());
    }
  }

  // Helper: earnings
  const earnings = typeof p.totalEarnings === 'number' ? p.totalEarnings
    : (typeof p.totalEarnings === 'string' ? parseFloat(p.totalEarnings.replace(/[^0-9.]/g, '')) : 0);

  const totalJobs = typeof p.totalJobs === 'number' ? p.totalJobs : 0;

  // --- 1) Professional title (10%) ---
  const hasTitle = !isGenericTitle(p.title);
  items.push({
    name: 'Professional Title',
    status: hasTitle ? 'pass' : 'fail',
    weight: 10,
    detail: hasTitle
      ? `Your title '${p.title}' is specific ✓`
      : `Your title '${p.title || '(empty)'}' is too generic — use something like 'Senior React Developer' or 'Data Analyst | Python & SQL'`,
  });
  if (hasTitle) totalScore += 10;
  else {
    missing.push('Set a specific professional title (not just "Freelancer" or "Developer")');
    quickWins.push('Changing your title to something specific is an easy way to gain 10 points');
  }

  // --- 2) Description >200 chars (15%) ---
  const descOver200 = descLen > 200;
  items.push({
    name: 'Description Length (>200 chars)',
    status: descOver200 ? 'pass' : 'fail',
    weight: 15,
    detail: descOver200
      ? `Description is ${descLen} chars ✓`
      : `Description is ${descLen} chars — aim for at least 200 (need ${200 - descLen} more)`,
  });
  if (descOver200) totalScore += 15;
  else {
    missing.push(`Write a longer description (currently ${descLen} chars, aim for 300+)`);
    quickWins.push(`Adding ${200 - descLen} more characters to your description gains you 15 points`);
  }

  // --- 3) Description >500 chars (bonus 5%) ---
  const descOver500 = descLen > 500;
  items.push({
    name: 'Description Length (>500 chars)',
    status: descOver500 ? 'bonus' : (descOver200 ? 'fail' : 'fail'),
    weight: 5,
    detail: descOver500
      ? `Description is ${descLen} chars — bonus earned ✓`
      : `Description is ${descLen} chars — write 500+ for a bonus 5 points (need ${500 - descLen} more)`,
  });
  if (descOver500) totalScore += 5;

  // --- 4) Skills >5 (10%) ---
  const hasSkills5 = skillsCount > 5;
  items.push({
    name: 'Skills Count (>5)',
    status: hasSkills5 ? 'pass' : 'fail',
    weight: 10,
    detail: hasSkills5
      ? `You have ${skillsCount} skills listed ✓`
      : `You have ${skillsCount} skills — add at least ${6 - skillsCount} more to reach 6`,
  });
  if (hasSkills5) totalScore += 10;
  else {
    missing.push(`Add more skills (currently ${skillsCount}, need at least 6)`);
    quickWins.push(`Adding ${6 - skillsCount} more skill${6 - skillsCount === 1 ? '' : 's'} gains you 10 points`);
  }

  // --- 5) Skills >10 (bonus 5%) ---
  const hasSkills10 = skillsCount > 10;
  items.push({
    name: 'Skills Count (>10)',
    status: hasSkills10 ? 'bonus' : 'fail',
    weight: 5,
    detail: hasSkills10
      ? `${skillsCount} skills listed — bonus earned ✓`
      : `${skillsCount} skills — list 11+ for a bonus 5 points`,
  });
  if (hasSkills10) totalScore += 5;

  // --- 6) Has portfolio items (15%) ---
  const hasPortfolio = portfolioCount > 0;
  items.push({
    name: 'Portfolio Items',
    status: hasPortfolio ? 'pass' : 'fail',
    weight: 15,
    detail: hasPortfolio
      ? `You have ${portfolioCount} portfolio item${portfolioCount === 1 ? '' : 's'} ✓`
      : 'No portfolio items — add at least one project to showcase your work',
  });
  if (hasPortfolio) totalScore += 15;
  else {
    missing.push('Add at least 1 portfolio item to showcase your work');
    quickWins.push('Adding a portfolio item is the easiest way to gain 15 points');
  }

  // --- 7) Portfolio >3 items (bonus 5%) ---
  const hasPortfolio3 = portfolioCount > 3;
  items.push({
    name: 'Portfolio Items (>3)',
    status: hasPortfolio3 ? 'bonus' : 'fail',
    weight: 5,
    detail: hasPortfolio3
      ? `${portfolioCount} portfolio items — bonus earned ✓`
      : `${portfolioCount} portfolio items — add ${4 - portfolioCount} more for a bonus 5 points`,
  });
  if (hasPortfolio3) totalScore += 5;
  else if (hasPortfolio && portfolioCount <= 3) {
    missing.push(`Add at least ${4 - portfolioCount} more portfolio item${4 - portfolioCount === 1 ? '' : 's'} (currently ${portfolioCount}, target 4+)`);
  }

  // --- 8) Job Success Score (10%) ---
  const hasJSS = p.jobSuccessScore != null && p.jobSuccessScore !== '' && !isNaN(Number(p.jobSuccessScore));
  items.push({
    name: 'Job Success Score',
    status: hasJSS ? 'pass' : 'fail',
    weight: 10,
    detail: hasJSS
      ? `Job Success Score is ${p.jobSuccessScore}% ✓`
      : 'No Job Success Score yet — complete more contracts with good feedback',
  });
  if (hasJSS) totalScore += 10;
  else missing.push('Earn a Job Success Score by completing contracts with positive feedback');

  // --- 9) Hourly rate set (10%) ---
  const hasRate = p.hourlyRate != null && Number(p.hourlyRate) > 0;
  items.push({
    name: 'Hourly Rate',
    status: hasRate ? 'pass' : 'fail',
    weight: 10,
    detail: hasRate
      ? `Hourly rate is $${p.hourlyRate}/hr ✓`
      : 'No hourly rate set — set a competitive rate for your skill level',
  });
  if (hasRate) totalScore += 10;
  else {
    missing.push('Set an hourly rate on your profile');
    quickWins.push('Setting your hourly rate is quick and gains you 10 points');
  }

  // --- 10) Location (5%) ---
  const hasLocation = p.location && typeof p.location === 'string' && p.location.trim().length > 0;
  items.push({
    name: 'Location',
    status: hasLocation ? 'pass' : 'fail',
    weight: 5,
    detail: hasLocation
      ? `Location set to ${p.location} ✓`
      : 'No location set — add your city or country',
  });
  if (hasLocation) totalScore += 5;
  else missing.push('Add your location to your profile');

  // --- 11) Categories / specialization (5%) ---
  const cats = Array.isArray(p.categories) ? p.categories : [];
  const hasCats = cats.length > 0;
  items.push({
    name: 'Categories / Specialization',
    status: hasCats ? 'pass' : 'fail',
    weight: 5,
    detail: hasCats
      ? `${cats.length} categor${cats.length === 1 ? 'y' : 'ies'} set ✓`
      : 'No categories or specializations selected',
  });
  if (hasCats) totalScore += 5;
  else missing.push('Select at least one category or specialization');

  // --- 12) Member >6 months (5%) ---
  const isMember6m = memberMonths > 6;
  items.push({
    name: 'Account Age (>6 months)',
    status: isMember6m ? 'pass' : 'fail',
    weight: 5,
    detail: isMember6m
      ? `Member for ${memberMonths} months ✓`
      : `Member for ${memberMonths} months — this improves naturally over time`,
  });
  if (isMember6m) totalScore += 5;

  // --- 13) Total jobs >0 (5%) ---
  const hasJobs = totalJobs > 0;
  items.push({
    name: 'Completed Jobs',
    status: hasJobs ? 'pass' : 'fail',
    weight: 5,
    detail: hasJobs
      ? `${totalJobs} job${totalJobs === 1 ? '' : 's'} completed ✓`
      : 'No completed jobs yet — land your first contract to boost credibility',
  });
  if (hasJobs) totalScore += 5;
  else missing.push('Complete at least one job on the platform');

  // --- 14) Total earnings >$0 (5%) ---
  const hasEarnings = earnings > 0;
  items.push({
    name: 'Total Earnings',
    status: hasEarnings ? 'pass' : 'fail',
    weight: 5,
    detail: hasEarnings
      ? `Total earnings: $${earnings.toLocaleString()} ✓`
      : 'No earnings yet — completing paid contracts builds your profile strength',
  });
  if (hasEarnings) totalScore += 5;
  else missing.push('Earn revenue by completing paid contracts');

  // Sort quick wins by potential weight gain (highest first) — already ordered above
  // Cap score at 100
  const finalScore = Math.min(totalScore, 100);

  return {
    score: finalScore,
    grade: scoreToGrade(finalScore),
    items,
    missing,
    quickWins: quickWins.slice(0, 5), // top 5 quick wins
  };
}

// Browser global (for <script> tag usage)
if (typeof window !== 'undefined') {
  window.CortexCompletenessChecker = {
    checkCompleteness: checkCompleteness,
    isGenericTitle: isGenericTitle,
    scoreToGrade: scoreToGrade,
  };
}

// CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkCompleteness, isGenericTitle, scoreToGrade };
}
