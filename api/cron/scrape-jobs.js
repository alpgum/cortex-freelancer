/**
 * CF3-001: Daily Job Scrape Cron
 *
 * GET /api/cron/scrape-jobs
 *
 * Triggered daily (via Vercel cron or external scheduler).
 * Scrapes Upwork search pages for React/Node.js jobs.
 * Protected by CRON_SECRET header.
 *
 * Sources (in priority order):
 *   1. Scrape.do proxy (SCRAPE_DO_API_KEY)
 *   2. Local Chrome proxy (UPWORK_PROXY_URL)
 *   3. Direct fetch (usually CF-blocked)
 */

const fs = require('fs');
const path = require('path');
const { withErrorHandler, sendError } = require('../middleware/error-handler');

const SKILLS = [
  'React', 'Node.js', 'Next.js',
  'TypeScript', 'Full Stack JavaScript',
  'Frontend React', 'Backend Node',
  'MERN Stack', 'React Native',
];

const RATE_LIMIT_MS = 3000;
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'scraped-jobs');

// ── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseBudget(text) {
  if (!text) return { budget: null, budgetType: null, budgetMin: null, budgetMax: null };
  const fixedMatch = text.match(/(?:Budget|Fixed[- ]?Price)[:\s]*\$([\d,]+(?:\.\d+)?)/i);
  const hourlyMatch = text.match(/Hourly[:\s]*\$([\d,.]+)\s*-\s*\$([\d,.]+)/i);
  const hourlySimple = text.match(/Hourly[:\s]*\$([\d,.]+)/i);

  if (fixedMatch) {
    const val = parseFloat(fixedMatch[1].replace(/,/g, ''));
    return { budget: '$' + fixedMatch[1], budgetType: 'fixed', budgetMin: val, budgetMax: val };
  }
  if (hourlyMatch) {
    return {
      budget: '$' + hourlyMatch[1] + '-$' + hourlyMatch[2] + '/hr', budgetType: 'hourly',
      budgetMin: parseFloat(hourlyMatch[1].replace(/,/g, '')),
      budgetMax: parseFloat(hourlyMatch[2].replace(/,/g, '')),
    };
  }
  if (hourlySimple) {
    const val = parseFloat(hourlySimple[1].replace(/,/g, ''));
    return { budget: '$' + hourlySimple[1] + '/hr', budgetType: 'hourly', budgetMin: val, budgetMax: val };
  }
  return { budget: null, budgetType: null, budgetMin: null, budgetMax: null };
}

function parseUpworkApiJob(job, searchSkill) {
  const budgetInfo = parseBudget(
    job.amount?.amount ? `$${job.amount.amount}` : job.tierText || job.hourlyBudgetText || ''
  );
  return {
    title: job.title || '', url: job.ciphertext ? `https://www.upwork.com/jobs/~${job.ciphertext}` : '',
    description: stripHtml(job.description || job.snippet || '').substring(0, 500),
    ...budgetInfo, postedAt: job.createdOn || job.publishedOn || null,
    skills: (job.attrs || job.skills || []).map(s => typeof s === 'string' ? s : s.prettyName || s.name || '').filter(Boolean),
    category: job.subcategory2 || job.category2 || null,
    country: job.client?.location?.country || null,
    searchSkill, scrapedAt: new Date().toISOString(),
  };
}

function parseUpworkSearchHtml(html, searchSkill) {
  const jobs = [];

  // Try __NEXT_DATA__
  const nextMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try {
      const nd = JSON.parse(nextMatch[1]);
      const results = nd?.props?.pageProps?.searchResults?.jobs || nd?.props?.initialProps?.searchResults?.jobs || [];
      for (const j of results) jobs.push(parseUpworkApiJob(j, searchSkill));
    } catch { /* ignore */ }
  }

  // Try JSON-LD
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (ldMatch && jobs.length === 0) {
    try {
      const ld = JSON.parse(ldMatch[1]);
      if (Array.isArray(ld.itemListElement)) {
        for (const item of ld.itemListElement) {
          const job = item.item || item;
          if (job.title || job.name) {
            jobs.push({
              title: job.title || job.name, url: job.url || '',
              description: stripHtml(job.description || '').substring(0, 500),
              ...parseBudget(''), postedAt: job.datePosted || null,
              skills: [], category: null, country: null, searchSkill,
              scrapedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Regex fallback for job links
  if (jobs.length === 0) {
    const links = html.matchAll(/<a[^>]*href="(\/jobs\/[^"]*~[^"]*)"[^>]*>([^<]+)<\/a>/gi);
    for (const m of links) {
      const url = `https://www.upwork.com${m[1]}`;
      if (!jobs.some(j => j.url === url)) {
        jobs.push({
          title: stripHtml(m[2]), url, description: '',
          budget: null, budgetType: null, budgetMin: null, budgetMax: null,
          postedAt: null, skills: [], category: null, country: null,
          searchSkill, scrapedAt: new Date().toISOString(),
        });
      }
    }
  }

  return jobs.length > 0 ? jobs : null;
}

async function fetchViaScrapeDo(skill) {
  const apiKey = process.env.SCRAPE_DO_API_KEY;
  if (!apiKey) return null;

  const searchUrl = `https://www.upwork.com/ab/jobs/search/url?q=${encodeURIComponent(skill)}&sort=recency&per_page=50`;
  const proxyUrl = `https://api.scrape.do?token=${apiKey}&url=${encodeURIComponent(searchUrl)}&render=true&super=true`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    try {
      const data = JSON.parse(html);
      if (data.searchResults?.jobs) return data.searchResults.jobs.map(j => parseUpworkApiJob(j, skill));
    } catch { /* parse as HTML */ }
    return parseUpworkSearchHtml(html, skill);
  } catch { return null; }
}

async function fetchFromLocalProxy(skill) {
  const proxyUrl = process.env.UPWORK_PROXY_URL;
  if (!proxyUrl) return [];
  const base = proxyUrl.replace(/\/scrape\/?$/, '');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${base}/jobs?q=${encodeURIComponent(skill)}&limit=20`, {
      signal: controller.signal, headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.jobs || []).map(j => ({ ...j, searchSkill: skill, scrapedAt: new Date().toISOString() }));
  } catch { return []; }
}

// ── Handler ─────────────────────────────────────────────────────────────

module.exports = withErrorHandler(async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED', 'access_error');
  }

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Use GET', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const today = new Date().toISOString().split('T')[0];
  const hasScrapeDo = !!process.env.SCRAPE_DO_API_KEY;
  const hasLocalProxy = !!process.env.UPWORK_PROXY_URL;
  let allJobs = [];
  let source = 'none';

  for (let i = 0; i < SKILLS.length; i++) {
    let jobs = null;

    if (hasScrapeDo) {
      jobs = await fetchViaScrapeDo(SKILLS[i]);
      if (jobs?.length) source = 'scrape.do';
    }
    if (!jobs && hasLocalProxy) {
      const pj = await fetchFromLocalProxy(SKILLS[i]);
      if (pj.length) { jobs = pj; source = 'local_proxy'; }
    }

    if (jobs) allJobs.push(...jobs);
    if (i < SKILLS.length - 1) await sleep(RATE_LIMIT_MS);
  }

  // Deduplicate
  const seen = new Set();
  const jobs = allJobs.filter(j => {
    if (!j.url || seen.has(j.url)) return false;
    seen.add(j.url);
    return true;
  });

  const output = {
    _meta: {
      scrapeDate: today, scrapedAt: new Date().toISOString(),
      skills: SKILLS, source, totalScraped: allJobs.length, afterDedup: jobs.length,
    },
    jobs,
  };

  // Save to disk (works on Railway/Render, not on Vercel)
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUTPUT_DIR, `${today}.json`), JSON.stringify(output, null, 2));
    fs.writeFileSync(path.join(OUTPUT_DIR, 'latest.json'), JSON.stringify(output, null, 2));
  } catch (err) {
    console.log('[scrape-jobs] File save skipped (serverless):', err.message);
  }

  res.status(200).json({
    success: true,
    message: `Scraped ${jobs.length} unique jobs via ${source} from ${SKILLS.length} skill feeds`,
    _meta: output._meta,
  });
});
