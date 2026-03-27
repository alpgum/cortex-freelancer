/**
 * [U-015] Upwork Job Matching API
 *
 * POST { skills: [...], title: "...", hourlyRate: 200 }
 * Returns top 10 matching Upwork jobs scored against user profile.
 *
 * Primary: Upwork RSS job feeds
 * Fallback: Local Chrome proxy /jobs endpoint
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');

// ── Upwork OAuth API search (preferred when user is connected) ──────────
async function fetchFromOAuthAPI(uid, skills) {
  if (!uid) return null;

  try {
    const upworkOAuth = require('./lib/upwork-oauth');
    const firestore = getFirestore();
    if (!firestore) return null;

    const doc = await firestore.collection('upwork_tokens').doc(uid).get();
    if (!doc.exists) return null;

    const tokens = await upworkOAuth.getValidToken(doc.data());

    // Update tokens if refreshed
    if (tokens.access_token !== doc.data().access_token) {
      await firestore.collection('upwork_tokens').doc(uid).set(tokens, { merge: true });
    }

    const query = skills.slice(0, 3).join(' OR ');
    const result = await upworkOAuth.searchJobs(tokens.access_token, {
      query,
      skills: skills.slice(0, 5),
      paging: 20,
    });

    if (!result?.jobs) return null;

    return result.jobs.map(job => ({
      title: job.title,
      url: `https://www.upwork.com/jobs/${job.ciphertext || job.id}`,
      description: (job.snippet || job.description || '').substring(0, 300),
      budget: job.budget?.amount ? `$${job.budget.amount}` : null,
      budgetType: job.budget?.amount ? (job.job_type === 'hourly' ? 'hourly' : 'fixed') : null,
      budgetMin: job.budget?.amount ? parseFloat(job.budget.amount) : null,
      budgetMax: job.budget?.amount ? parseFloat(job.budget.amount) : null,
      postedAt: job.date_created || null,
      skills: job.skills?.map(s => s.name || s) || [],
    }));
  } catch (err) {
    console.log('[upwork-jobs] OAuth API search failed:', err.message);
    return null;
  }
}

// ── RSS Feed URL builder ────────────────────────────────────────────────
function buildRssUrl(skill) {
  const q = encodeURIComponent(skill);
  return `https://www.upwork.com/ab/feed/jobs/rss?q=${q}&sort=recency&paging=0%3B10`;
}

// ── XML helpers (lightweight, no dependencies) ──────────────────────────
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractAllItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    items.push(m[1]);
  }
  return items;
}

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Parse a single RSS item ─────────────────────────────────────────────
function parseRssItem(itemXml) {
  const rawTitle = decodeEntities(extractTag(itemXml, 'title'));
  const link = decodeEntities(extractTag(itemXml, 'link'));
  const rawDesc = decodeEntities(extractTag(itemXml, 'description'));
  const pubDate = extractTag(itemXml, 'pubDate');

  // Clean up
  const title = stripHtml(rawTitle);
  const description = stripHtml(rawDesc);

  // Extract budget from description
  // Patterns: "Budget: $500", "Hourly: $20-$50", "Fixed Price: $1,000"
  let budget = null;
  let budgetType = null;
  let budgetMin = null;
  let budgetMax = null;

  const fixedMatch = description.match(/(?:Budget|Fixed[- ]?Price)[:\s]*\$([\d,]+(?:\.\d+)?)/i);
  const hourlyMatch = description.match(/Hourly[:\s]*\$([\d,.]+)\s*-\s*\$([\d,.]+)/i);
  const hourlySimple = description.match(/Hourly[:\s]*\$([\d,.]+)/i);

  if (fixedMatch) {
    budget = '$' + fixedMatch[1];
    budgetType = 'fixed';
    budgetMin = parseFloat(fixedMatch[1].replace(/,/g, ''));
    budgetMax = budgetMin;
  } else if (hourlyMatch) {
    budget = '$' + hourlyMatch[1] + '-$' + hourlyMatch[2] + '/hr';
    budgetType = 'hourly';
    budgetMin = parseFloat(hourlyMatch[1].replace(/,/g, ''));
    budgetMax = parseFloat(hourlyMatch[2].replace(/,/g, ''));
  } else if (hourlySimple) {
    budget = '$' + hourlySimple[1] + '/hr';
    budgetType = 'hourly';
    budgetMin = parseFloat(hourlySimple[1].replace(/,/g, ''));
    budgetMax = budgetMin;
  }

  // Extract skills from description
  // Upwork RSS often has "Skills: skill1, skill2, skill3" or similar
  const skillsMatch = description.match(/Skills?[:\s]*([\w\s,+#/.()-]+?)(?:\s*(?:Budget|Hourly|Posted|Country|Category|$))/i);
  const jobSkills = skillsMatch
    ? skillsMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 50)
    : [];

  return {
    title,
    url: link,
    description: description.substring(0, 300),
    budget,
    budgetType,
    budgetMin,
    budgetMax,
    postedAt: pubDate || null,
    skills: jobSkills,
  };
}

// ── Fetch RSS feed for a skill ──────────────────────────────────────────
async function fetchRssFeed(skill) {
  const url = buildRssUrl(skill);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`[upwork-jobs] RSS feed returned ${res.status} for "${skill}"`);
      return null;
    }

    const xml = await res.text();

    // Detect blocks
    if (xml.includes('cf-browser-verification') || xml.includes('Just a moment')) {
      console.log(`[upwork-jobs] Cloudflare block on RSS for "${skill}"`);
      return null;
    }

    const items = extractAllItems(xml);
    return items.map(parseRssItem).filter(item => item.title);
  } catch (err) {
    clearTimeout(timeout);
    console.log(`[upwork-jobs] RSS fetch error for "${skill}":`, err.message);
    return null;
  }
}

// ── Fallback: local Chrome proxy ────────────────────────────────────────
async function fetchFromLocalProxy(skill) {
  const proxyUrl = process.env.UPWORK_PROXY_URL;
  if (!proxyUrl) return null;

  // Derive base URL from the profile proxy URL
  const base = proxyUrl.replace(/\/scrape\/?$/, '');
  const url = `${base}/jobs?q=${encodeURIComponent(skill)}&limit=5`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    return data?.jobs || null;
  } catch (err) {
    console.log(`[upwork-jobs] Local proxy fallback error for "${skill}":`, err.message);
    return null;
  }
}

// ── Scoring ─────────────────────────────────────────────────────────────

function calculateSkillOverlap(userSkills, jobSkills) {
  if (!jobSkills || jobSkills.length === 0) return 50; // neutral if we can't determine
  if (!userSkills || userSkills.length === 0) return 30;

  const normalizedUser = userSkills.map(s => s.toLowerCase().trim());
  const normalizedJob = jobSkills.map(s => s.toLowerCase().trim());

  let matches = 0;
  for (const js of normalizedJob) {
    for (const us of normalizedUser) {
      // Fuzzy match: exact, contains, or contained-in
      if (us === js || us.includes(js) || js.includes(us)) {
        matches++;
        break;
      }
    }
  }

  const overlap = normalizedJob.length > 0
    ? (matches / normalizedJob.length) * 100
    : 50;

  return Math.min(100, Math.round(overlap));
}

function calculateRateFit(userRate, job) {
  if (!userRate || userRate <= 0) return 50; // neutral

  if (job.budgetType === 'hourly') {
    if (job.budgetMax && job.budgetMax >= userRate) return 100;
    if (job.budgetMin && job.budgetMin >= userRate * 0.7) return 80;
    if (job.budgetMax && job.budgetMax >= userRate * 0.5) return 60;
    return 30;
  }

  if (job.budgetType === 'fixed' && job.budgetMin) {
    // Estimate: fixed budget / 40 hours = effective hourly rate
    const effectiveRate = job.budgetMin / 40;
    if (effectiveRate >= userRate) return 100;
    if (effectiveRate >= userRate * 0.7) return 80;
    if (effectiveRate >= userRate * 0.5) return 60;
    return 40;
  }

  return 50; // no budget info
}

function calculateRecency(postedAt) {
  if (!postedAt) return 40;

  try {
    const posted = new Date(postedAt);
    const now = new Date();
    const hoursAgo = (now - posted) / (1000 * 60 * 60);

    if (hoursAgo <= 24) return 100;
    if (hoursAgo <= 48) return 80;
    if (hoursAgo <= 72) return 60;
    return 40;
  } catch {
    return 40;
  }
}

function scoreJob(job, userSkills, userRate) {
  const skillOverlap = calculateSkillOverlap(userSkills, job.skills);
  const rateFit = calculateRateFit(userRate, job);
  const recency = calculateRecency(job.postedAt);

  const matchScore = Math.round(
    (skillOverlap * 0.5) + (rateFit * 0.3) + (recency * 0.2)
  );

  return {
    ...job,
    matchScore,
    skillOverlap,
    rateFit,
    recency,
  };
}

// ── Deduplicate jobs by URL ─────────────────────────────────────────────
function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    if (!job.url || seen.has(job.url)) return false;
    seen.add(job.url);
    return true;
  });
}

// ── Handler ─────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed. Use POST.', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { skills, title, hourlyRate, uid } = req.body || {};

  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return sendError(res, 400, 'Missing required field: skills (array)', 'MISSING_SKILLS', 'validation_error');
  }

  const userRate = parseFloat(String(hourlyRate || '0').replace(/[^0-9.]/g, '')) || 0;
  const topSkills = skills.slice(0, 3); // Use top 3 skills for search

  console.log(`[upwork-jobs] Searching for jobs: skills=${topSkills.join(', ')}, rate=$${userRate}`);

  let allJobs = [];
  let source = 'none';

  // Priority 1: Upwork OAuth API (authenticated, best results)
  const oauthJobs = await fetchFromOAuthAPI(uid, skills);
  if (oauthJobs && oauthJobs.length > 0) {
    allJobs = oauthJobs;
    source = 'upwork_api';
    console.log(`[upwork-jobs] Got ${oauthJobs.length} jobs from Upwork API`);
  }

  // Priority 2: RSS feeds (public, no auth needed)
  if (allJobs.length === 0) {
    const rssResults = await Promise.all(topSkills.map(fetchRssFeed));
    const rssWorked = rssResults.some(r => r !== null && r.length > 0);

    if (rssWorked) {
      for (const jobs of rssResults) {
        if (jobs) allJobs.push(...jobs);
      }
      source = 'rss';
    }
  }

  // Priority 3: Local Chrome proxy fallback
  if (allJobs.length === 0) {
    console.log('[upwork-jobs] RSS feeds blocked, trying local proxy fallback...');
    const proxyResults = await Promise.all(topSkills.map(fetchFromLocalProxy));
    for (const jobs of proxyResults) {
      if (jobs) allJobs.push(...jobs);
    }
    if (allJobs.length > 0) source = 'local_proxy';
  }

  // No jobs from any source
  if (allJobs.length === 0) {
    return res.status(200).json({
      jobs: [],
      _meta: {
        source: 'none',
        message: 'Unable to fetch jobs. Upwork may be blocking requests. Try connecting your Upwork account for better results.',
        searchedSkills: topSkills,
      },
    });
  }

  // Deduplicate
  allJobs = deduplicateJobs(allJobs);

  // Score each job
  const scored = allJobs.map(job => scoreJob(job, skills, userRate));

  // Sort by match score descending, take top 10
  scored.sort((a, b) => b.matchScore - a.matchScore);
  const top10 = scored.slice(0, 10);

  // Cache for 30 min
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  res.status(200).json({
    jobs: top10,
    _meta: {
      source,
      searchedSkills: topSkills,
      totalFound: allJobs.length,
      fetchedAt: new Date().toISOString(),
      upworkConnected: source === 'upwork_api',
    },
  });
});
