const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ── Platform Detection ──────────────────────────────────────────────────

const PLATFORM_PATTERNS = {
  upwork: /^https?:\/\/(www\.)?upwork\.com\/freelancers\/~[a-zA-Z0-9]+\/?$/,
  fiverr: /^https?:\/\/(www\.)?fiverr\.com\/[a-zA-Z0-9_]+\/?$/,
  freelancer: /^https?:\/\/(www\.)?freelancer\.com\/u\/[a-zA-Z0-9_-]+\/?$/,
};

function detectPlatform(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname.endsWith('upwork.com')) return 'upwork';
    if (u.hostname.endsWith('fiverr.com')) return 'fiverr';
    if (u.hostname.endsWith('freelancer.com')) return 'freelancer';
  } catch { /* ignore */ }
  return null;
}

// ── URL Normalization ───────────────────────────────────────────────────

function normalizeUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const platform = detectPlatform(url);
    if (!platform) return null;

    const path = u.pathname.replace(/\/+$/, '');

    if (platform === 'upwork') {
      if (!path.startsWith('/freelancers/~')) return null;
      return `https://www.upwork.com${path}`;
    }
    if (platform === 'fiverr') {
      // Fiverr seller URL: /username (top-level path, no sub-paths like /categories/)
      const match = path.match(/^\/([a-zA-Z0-9_]+)$/);
      if (!match) return null;
      return `https://www.fiverr.com/${match[1]}`;
    }
    if (platform === 'freelancer') {
      // Freelancer.com: /u/username
      const match = path.match(/^\/u\/([a-zA-Z0-9_-]+)$/);
      if (!match) return null;
      return `https://www.freelancer.com/u/${match[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fetch ───────────────────────────────────────────────────────────────

async function fetchProfile(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (res.status === 404) return { status: 'not_found' };
    if (res.status === 403 || res.status === 429) return { status: 'blocked' };
    if (!res.ok) return { status: 'error', code: res.status };

    const html = await res.text();
    return { status: 'ok', html };
  } finally {
    clearTimeout(timeout);
  }
}

// ── Upwork Parser ───────────────────────────────────────────────────────

function parseUpworkProfile(html) {
  const $ = loadCheerio(html);

  const bodyText = $('body').text();
  if (bodyText.includes('This profile is private') || bodyText.includes('Profile not available')) {
    return null;
  }

  const jsonLd = $('script[type="application/ld+json"]').first().html();
  let ldData = null;
  if (jsonLd) {
    try { ldData = JSON.parse(jsonLd); } catch { /* ignore */ }
  }

  const name =
    ldData?.name ||
    $('h1[itemprop="name"]').text().trim() ||
    $('[data-qa="freelancer-name"]').text().trim() ||
    $('h1').first().text().trim() ||
    null;

  const title =
    ldData?.jobTitle ||
    $('[data-qa="title"]').text().trim() ||
    $('h2[role="presentation"]').first().text().trim() ||
    $('.up-card-section h2').first().text().trim() ||
    null;

  const description =
    ldData?.description ||
    $('[data-qa="description"]').text().trim() ||
    $('[data-qa="profile-overview"]').text().trim() ||
    $('.up-line-clamp-v2').first().text().trim() ||
    null;

  const hourlyRateRaw =
    $('[data-qa="hourly-rate"]').text().trim() ||
    $('[data-qa="rate"]').text().trim() ||
    '';
  const hourlyRate = hourlyRateRaw.replace(/[^\d.$]/g, '') || null;

  const jobSuccessRaw =
    $('[data-qa="job-success"]').text().trim() ||
    $('[data-qa="job-success-score"]').text().trim() ||
    '';
  const jobSuccessMatch = jobSuccessRaw.match(/(\d+)%/);
  const jobSuccess = jobSuccessMatch ? parseInt(jobSuccessMatch[1], 10) : null;

  const totalEarningsRaw =
    $('[data-qa="total-earnings"]').text().trim() ||
    $('[data-qa="earnings"]').text().trim() ||
    '';
  const totalEarnings = totalEarningsRaw.replace(/[^\d.$K+kM]/g, '') || null;

  const totalJobsRaw =
    $('[data-qa="total-jobs"]').text().trim() ||
    $('[data-qa="jobs-count"]').text().trim() ||
    '';
  const totalJobsMatch = totalJobsRaw.match(/([\d,]+)/);
  const totalJobs = totalJobsMatch ? parseInt(totalJobsMatch[1].replace(/,/g, ''), 10) : null;

  const totalHoursRaw =
    $('[data-qa="total-hours"]').text().trim() ||
    $('[data-qa="hours"]').text().trim() ||
    '';
  const totalHoursMatch = totalHoursRaw.match(/([\d,]+)/);
  const totalHours = totalHoursMatch ? parseInt(totalHoursMatch[1].replace(/,/g, ''), 10) : null;

  const skills = [];
  $('[data-qa="skill"] span, .up-skill-badge, [data-qa="skills-list"] span, .air3-token').each((_, el) => {
    const s = $(el).text().trim();
    if (s && !skills.includes(s)) skills.push(s);
  });

  const portfolio = [];
  $('[data-qa="portfolio-item"], .up-portfolio-item, [data-qa="portfolio"] a').each((_, el) => {
    const item = {
      title: $(el).find('h3, .up-portfolio-title, [data-qa="portfolio-title"]').text().trim() || null,
      image: $(el).find('img').attr('src') || null,
      link: $(el).attr('href') || null,
    };
    if (item.title || item.image) portfolio.push(item);
  });

  const location =
    ldData?.address?.addressLocality ||
    $('[data-qa="location"]').text().trim() ||
    $('[itemprop="addressLocality"]').text().trim() ||
    null;

  const memberSinceRaw =
    $('[data-qa="member-since"]').text().trim() ||
    '';
  const memberSince = memberSinceRaw.replace(/^Member since\s*/i, '').trim() || null;

  const categories = [];
  $('[data-qa="category"], [data-qa="specialization"], .up-category-badge').each((_, el) => {
    const c = $(el).text().trim();
    if (c && !categories.includes(c)) categories.push(c);
  });

  return {
    name, title, hourlyRate, totalEarnings, jobSuccess,
    totalJobs, totalHours, skills, portfolio, description,
    memberSince, location, categories,
  };
}

// ── Fiverr Parser ───────────────────────────────────────────────────────

function parseFiverrProfile(html) {
  const $ = loadCheerio(html);

  const bodyText = $('body').text();
  if (bodyText.includes('page you requested is no longer available') || bodyText.includes('Page Not Found')) {
    return null;
  }

  // JSON-LD
  const jsonLd = $('script[type="application/ld+json"]').first().html();
  let ldData = null;
  if (jsonLd) {
    try { ldData = JSON.parse(jsonLd); } catch { /* ignore */ }
  }

  // Name
  const name =
    ldData?.name ||
    $('.seller-card .username, .seller-overview h1, [data-testid="seller-name"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    null;

  // Title / one-liner
  const title =
    ldData?.jobTitle ||
    $('.seller-card .one-liner, .seller-overview .one-liner, [data-testid="seller-title"]').first().text().trim() ||
    $('h2').first().text().trim() ||
    null;

  // Description
  const description =
    ldData?.description ||
    $('.seller-desc .inner, .seller-profile .description, [data-testid="seller-desc"]').first().text().trim() ||
    null;

  // Seller level (Level 1, Level 2, Top Rated)
  const levelRaw =
    $('.seller-level, .level, [data-testid="seller-level"]').first().text().trim() || '';

  // Rating (e.g. 4.9)
  const ratingRaw =
    $('.rating-score, .seller-rating .rating, [data-testid="rating-score"]').first().text().trim() || '';
  const ratingMatch = ratingRaw.match(/([\d.]+)/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  // Reviews count
  const reviewsRaw =
    $('.ratings-count, .seller-rating .ratings-count, [data-testid="ratings-count"]').first().text().trim() || '';
  const reviewsMatch = reviewsRaw.match(/([\d,]+)/);
  const reviewsCount = reviewsMatch ? parseInt(reviewsMatch[1].replace(/,/g, ''), 10) : null;

  // Response time
  const responseTimeRaw =
    $('.response-time, .stat-value, [data-testid="response-time"]').first().text().trim() || '';

  // Gigs count
  const gigsElements = $('.gig-card, .gig-wrapper, [data-testid="gig-card"]');
  const gigsCount = gigsElements.length || null;

  // Starting price from gigs
  const priceRaw =
    $('.price .price-num, .gig-card .price, [data-testid="gig-price"]').first().text().trim() || '';
  const priceMatch = priceRaw.match(/([\d,.]+)/);
  const startingPrice = priceMatch ? priceMatch[1] : null;

  // Skills / tags from gigs
  const skills = [];
  $('.skill-tag, .gig-tag, .tag, [data-testid="skill-tag"], .seller-skills .skill').each((_, el) => {
    const s = $(el).text().trim();
    if (s && !skills.includes(s)) skills.push(s);
  });

  // Location
  const location =
    ldData?.address?.addressLocality ||
    $('.seller-location, .location, [data-testid="seller-location"]').first().text().trim() ||
    null;

  // Member since
  const memberSinceRaw =
    $('.member-since, .user-stats .since, [data-testid="member-since"]').first().text().trim() || '';
  const memberSince = memberSinceRaw.replace(/^Member since\s*/i, '').trim() || null;

  // Map Fiverr level to a job-success-like score
  let jobSuccess = null;
  const levelLower = levelRaw.toLowerCase();
  if (levelLower.includes('top rated')) jobSuccess = 97;
  else if (levelLower.includes('level 2') || levelLower.includes('level two')) jobSuccess = 90;
  else if (levelLower.includes('level 1') || levelLower.includes('level one')) jobSuccess = 80;
  else if (rating && rating >= 4.7) jobSuccess = Math.round(rating * 20);

  // Estimate earnings from reviews
  let totalEarnings = null;
  if (reviewsCount) {
    // Rough estimate: avg order $100-200
    const est = reviewsCount * 150;
    if (est >= 1000000) totalEarnings = '$' + (est / 1000000).toFixed(1) + 'M';
    else if (est >= 1000) totalEarnings = '$' + Math.round(est / 1000) + 'K+';
    else totalEarnings = '$' + est;
  }

  return {
    name,
    title,
    hourlyRate: startingPrice,
    totalEarnings,
    jobSuccess,
    totalJobs: reviewsCount,
    totalHours: null,
    skills,
    portfolio: [],
    description,
    memberSince,
    location,
    categories: [],
    _fiverr: { level: levelRaw || null, rating, reviewsCount, responseTime: responseTimeRaw || null, gigsCount },
  };
}

// ── Freelancer.com Parser ───────────────────────────────────────────────

function parseFreelancerProfile(html) {
  const $ = loadCheerio(html);

  const bodyText = $('body').text();
  if (bodyText.includes('User Not Found') || bodyText.includes('This page is no longer available')) {
    return null;
  }

  // JSON-LD
  const jsonLd = $('script[type="application/ld+json"]').first().html();
  let ldData = null;
  if (jsonLd) {
    try { ldData = JSON.parse(jsonLd); } catch { /* ignore */ }
  }

  // Name
  const name =
    ldData?.name ||
    $('.profile-header-info h1, .profile-summary-name, [data-testid="profile-name"]').first().text().trim() ||
    $('h1').first().text().trim() ||
    null;

  // Title / tagline
  const title =
    ldData?.jobTitle ||
    $('.profile-header-info .tagline, .profile-summary-tagline, [data-testid="profile-tagline"]').first().text().trim() ||
    null;

  // Description
  const description =
    ldData?.description ||
    $('.profile-about .content, .profile-description, [data-testid="profile-description"]').first().text().trim() ||
    null;

  // Hourly rate
  const hourlyRateRaw =
    $('.profile-hourly-rate, .hourly-rate, [data-testid="hourly-rate"]').first().text().trim() || '';
  const hourlyRate = hourlyRateRaw.replace(/[^\d.$]/g, '') || null;

  // Rating
  const ratingRaw =
    $('.reputation-score, .rating-score, [data-testid="rating"]').first().text().trim() || '';
  const ratingMatch = ratingRaw.match(/([\d.]+)/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

  // Reviews count
  const reviewsRaw =
    $('.review-count, .reviews-count, [data-testid="reviews-count"]').first().text().trim() || '';
  const reviewsMatch = reviewsRaw.match(/([\d,]+)/);
  const reviewsCount = reviewsMatch ? parseInt(reviewsMatch[1].replace(/,/g, ''), 10) : null;

  // Earnings
  const earningsRaw =
    $('.earnings, .total-earnings, [data-testid="earnings"]').first().text().trim() || '';
  const totalEarnings = earningsRaw.replace(/[^\d.$K+kM]/g, '') || null;

  // Jobs completed
  const jobsRaw =
    $('.jobs-completed, .completed-projects, [data-testid="completed-jobs"]').first().text().trim() || '';
  const jobsMatch = jobsRaw.match(/([\d,]+)/);
  const totalJobs = jobsMatch ? parseInt(jobsMatch[1].replace(/,/g, ''), 10) : null;

  // Skills
  const skills = [];
  $('.profile-skill, .skill-badge, .UserProfileSkills .Skill, [data-testid="skill"]').each((_, el) => {
    const s = $(el).text().trim();
    if (s && !skills.includes(s)) skills.push(s);
  });

  // Portfolio
  const portfolio = [];
  $('.portfolio-item, .ProjectCard, [data-testid="portfolio-item"]').each((_, el) => {
    const item = {
      title: $(el).find('h3, .title, .ProjectCard-title').text().trim() || null,
      image: $(el).find('img').attr('src') || null,
      link: $(el).find('a').attr('href') || null,
    };
    if (item.title || item.image) portfolio.push(item);
  });

  // Location
  const location =
    ldData?.address?.addressLocality ||
    $('.profile-location, .location, [data-testid="location"]').first().text().trim() ||
    null;

  // Member since
  const memberSinceRaw =
    $('.member-since, .registration-date, [data-testid="member-since"]').first().text().trim() || '';
  const memberSince = memberSinceRaw.replace(/^Member since\s*/i, '').trim() || null;

  // Categories
  const categories = [];
  $('.profile-category, .category-badge, [data-testid="category"]').each((_, el) => {
    const c = $(el).text().trim();
    if (c && !categories.includes(c)) categories.push(c);
  });

  // Map rating to job success (Freelancer.com uses 5-star scale)
  let jobSuccess = null;
  if (rating) {
    jobSuccess = Math.round(rating * 20); // 5.0 → 100, 4.5 → 90
  }

  return {
    name, title, hourlyRate, totalEarnings, jobSuccess,
    totalJobs, totalHours: null, skills, portfolio, description,
    memberSince, location, categories,
    _freelancer: { rating, reviewsCount },
  };
}

// ── Cheerio Loader ──────────────────────────────────────────────────────

function loadCheerio(html) {
  let cheerio;
  try {
    cheerio = require('cheerio');
  } catch {
    throw new Error('cheerio dependency not installed');
  }
  return cheerio.load(html);
}

// ── Platform-aware parser dispatch ──────────────────────────────────────

function parseProfile(html, platform) {
  if (platform === 'fiverr') return parseFiverrProfile(html);
  if (platform === 'freelancer') return parseFreelancerProfile(html);
  return parseUpworkProfile(html);
}

// ── Google Cache Fallback ───────────────────────────────────────────────

async function fallbackGoogleCache(profileUrl, platform) {
  const searchUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(profileUrl)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': randomUA() },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    const profile = parseProfile(html, platform);
    if (profile) {
      profile._source = 'google_cache';
      profile._warning = 'Data may be stale (sourced from Google cache)';
    }
    return profile;
  } catch {
    return null;
  }
}

// ── Platform Labels ─────────────────────────────────────────────────────

const PLATFORM_LABELS = {
  upwork: 'Upwork',
  fiverr: 'Fiverr',
  freelancer: 'Freelancer.com',
};

// ── Handler ─────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const rawUrl = req.method === 'GET'
    ? req.query?.url
    : req.body?.url;

  if (!rawUrl) {
    return sendError(res, 400, 'Missing required parameter: url (profile URL)', 'MISSING_URL', 'validation_error');
  }

  const platform = detectPlatform(rawUrl);
  if (!platform) {
    return sendError(res, 400, 'Unsupported platform. Paste an Upwork, Fiverr, or Freelancer.com profile URL.', 'UNSUPPORTED_PLATFORM', 'validation_error');
  }

  const profileUrl = normalizeUrl(rawUrl);
  if (!profileUrl) {
    const label = PLATFORM_LABELS[platform] || platform;
    return sendError(res, 400, `Invalid ${label} profile URL. Check the URL format and try again.`, 'INVALID_URL', 'validation_error');
  }

  // Attempt direct fetch
  const result = await fetchProfile(profileUrl);

  if (result.status === 'not_found') {
    return sendError(res, 404, 'Profile not found. The user may have deleted their account.', 'PROFILE_NOT_FOUND', 'not_found');
  }

  let profile = null;
  let source = 'direct';

  if (result.status === 'ok') {
    profile = parseProfile(result.html, platform);
    if (!profile) {
      return sendError(res, 403, 'This profile is private or not available.', 'PROFILE_PRIVATE', 'access_error');
    }
  }

  // Fallback: if blocked or scrape returned no usable data
  if (!profile) {
    profile = await fallbackGoogleCache(profileUrl, platform);
    source = 'google_cache';
  }

  if (!profile) {
    const label = PLATFORM_LABELS[platform] || platform;
    return sendError(
      res,
      503,
      `Unable to fetch profile. ${label} may be blocking requests. Please try again later.`,
      'SCRAPE_BLOCKED',
      'service_error'
    );
  }

  // Cache response for 1 hour
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  res.status(200).json({
    success: true,
    data: {
      ...profile,
      _meta: {
        platform,
        source,
        profileUrl,
        fetchedAt: new Date().toISOString(),
      },
    },
  });
});
