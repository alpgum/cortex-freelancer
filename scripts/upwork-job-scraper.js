#!/usr/bin/env node
/**
 * CF3-001: Upwork Job Scraper
 *
 * Multi-source scraper for Upwork jobs targeting React/Node.js roles.
 * Upwork RSS feeds are deprecated (410 Gone), so this uses:
 *   1. Upwork search API (JSON) via Scrape.do proxy
 *   2. Upwork search page HTML scraping via Scrape.do
 *   3. Local Chrome proxy fallback (if UPWORK_PROXY_URL set)
 *
 * Usage:
 *   node scripts/upwork-job-scraper.js                          # Run once
 *   node scripts/upwork-job-scraper.js --skills "Python,Django"  # Custom skills
 *   node scripts/upwork-job-scraper.js --dry-run                # Preview without saving
 *
 * Environment:
 *   SCRAPE_DO_API_KEY   — Scrape.do API key (primary method)
 *   UPWORK_PROXY_URL    — Local Chrome proxy base URL (fallback)
 *
 * Output: data/scraped-jobs/YYYY-MM-DD.json
 *
 * Rate Limiting:
 *   - 3 second delay between requests
 *   - Max 2 retries per request
 *   - Respects Cloudflare blocks gracefully
 */

const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────

const DEFAULT_SKILLS = [
  'React', 'Node.js', 'Next.js',
  'TypeScript', 'Full Stack JavaScript',
  'Frontend React', 'Backend Node',
  'MERN Stack', 'React Native',
];

const RATE_LIMIT_MS = 3000;       // 3s between requests (be respectful)
const REQUEST_TIMEOUT_MS = 20000; // 20s per request
const MAX_RETRIES = 2;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'scraped-jobs');
const HISTORY_FILE = path.join(OUTPUT_DIR, '_seen-urls.json');

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

// ── CLI Args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skillsArg = args.find((_, i) => args[i - 1] === '--skills');
const skills = skillsArg
  ? skillsArg.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_SKILLS;

// ── Helpers ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseBudget(text) {
  if (!text) return { budget: null, budgetType: null, budgetMin: null, budgetMax: null };

  const fixedMatch = text.match(/(?:Budget|Fixed[- ]?Price)[:\s]*\$([\d,]+(?:\.\d+)?)/i);
  const hourlyMatch = text.match(/Hourly[:\s]*\$([\d,.]+)\s*-\s*\$([\d,.]+)/i);
  const hourlySimple = text.match(/Hourly[:\s]*\$([\d,.]+)/i);
  const dollarRange = text.match(/\$([\d,]+)\s*-\s*\$([\d,]+)/);
  const dollarSingle = text.match(/\$([\d,]+(?:\.\d+)?)/);

  if (fixedMatch) {
    const val = parseFloat(fixedMatch[1].replace(/,/g, ''));
    return { budget: '$' + fixedMatch[1], budgetType: 'fixed', budgetMin: val, budgetMax: val };
  }
  if (hourlyMatch) {
    return {
      budget: '$' + hourlyMatch[1] + '-$' + hourlyMatch[2] + '/hr',
      budgetType: 'hourly',
      budgetMin: parseFloat(hourlyMatch[1].replace(/,/g, '')),
      budgetMax: parseFloat(hourlyMatch[2].replace(/,/g, '')),
    };
  }
  if (hourlySimple && text.toLowerCase().includes('hour')) {
    const val = parseFloat(hourlySimple[1].replace(/,/g, ''));
    return { budget: '$' + hourlySimple[1] + '/hr', budgetType: 'hourly', budgetMin: val, budgetMax: val };
  }
  if (dollarRange) {
    const min = parseFloat(dollarRange[1].replace(/,/g, ''));
    const max = parseFloat(dollarRange[2].replace(/,/g, ''));
    const type = max <= 200 ? 'hourly' : 'fixed';
    return { budget: '$' + dollarRange[1] + '-$' + dollarRange[2], budgetType: type, budgetMin: min, budgetMax: max };
  }
  if (dollarSingle) {
    const val = parseFloat(dollarSingle[1].replace(/,/g, ''));
    return { budget: '$' + dollarSingle[1], budgetType: val <= 200 ? 'hourly' : 'fixed', budgetMin: val, budgetMax: val };
  }

  return { budget: null, budgetType: null, budgetMin: null, budgetMax: null };
}

// ── Source 1: Upwork Search via Scrape.do ────────────────────────────────

async function fetchViaScrapeDo(skill) {
  const apiKey = process.env.SCRAPE_DO_API_KEY;
  if (!apiKey) return null;

  const searchUrl = `https://www.upwork.com/ab/feed/jobs/search/url?q=${encodeURIComponent(skill)}&sort=recency&per_page=50`;
  const proxyUrl = `https://api.scrape.do?token=${apiKey}&url=${encodeURIComponent(searchUrl)}&render=true&super=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(proxyUrl, {
      headers: { 'Accept': 'text/html, application/json, */*', 'User-Agent': randomUA() },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`  ⚠ Scrape.do HTTP ${res.status} for "${skill}"`);
      return null;
    }

    const html = await res.text();

    // Try parsing as JSON first (some Upwork endpoints return JSON)
    try {
      const data = JSON.parse(html);
      if (data.searchResults?.jobs) {
        return data.searchResults.jobs.map(j => parseUpworkApiJob(j, skill));
      }
    } catch { /* not JSON, parse as HTML */ }

    return parseUpworkSearchHtml(html, skill);
  } catch (err) {
    clearTimeout(timeout);
    console.log(`  ⚠ Scrape.do error for "${skill}": ${err.message}`);
    return null;
  }
}

function parseUpworkApiJob(job, searchSkill) {
  const budgetInfo = parseBudget(
    job.amount?.amount
      ? `$${job.amount.amount}`
      : job.tierText || job.hourlyBudgetText || ''
  );

  return {
    title: job.title || '',
    url: job.ciphertext ? `https://www.upwork.com/jobs/~${job.ciphertext}` : '',
    description: stripHtml(job.description || job.snippet || '').substring(0, 500),
    ...budgetInfo,
    postedAt: job.createdOn || job.publishedOn || null,
    skills: (job.attrs || job.skills || []).map(s => typeof s === 'string' ? s : s.prettyName || s.name || '').filter(Boolean),
    category: job.subcategory2 || job.category2 || null,
    country: job.client?.location?.country || null,
    proposalCount: job.proposalsTier || job.totalApplicants || null,
    clientRating: job.client?.feedback || null,
    clientSpent: job.client?.totalSpent || null,
    searchSkill,
    scrapedAt: new Date().toISOString(),
  };
}

function parseUpworkSearchHtml(html, searchSkill) {
  // Parse Upwork search results HTML
  // Look for job cards with data attributes or structured sections
  const jobs = [];

  // Pattern 1: JSON-LD or embedded data
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (Array.isArray(ld.itemListElement)) {
        for (const item of ld.itemListElement) {
          const job = item.item || item;
          if (job.title || job.name) {
            const budgetInfo = parseBudget(job.baseSalary?.value?.value || job.estimatedSalary?.value || '');
            jobs.push({
              title: job.title || job.name || '',
              url: job.url || '',
              description: stripHtml(job.description || '').substring(0, 500),
              ...budgetInfo,
              postedAt: job.datePosted || null,
              skills: [],
              category: null,
              country: job.jobLocation?.address?.addressCountry || null,
              searchSkill,
              scrapedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* not valid JSON-LD */ }
  }

  // Pattern 2: Regex-based extraction from HTML job tiles
  const titleLinks = html.matchAll(/<a[^>]*href="(\/jobs\/[^"]*~[^"]*)"[^>]*>([^<]+)<\/a>/gi);
  for (const match of titleLinks) {
    const url = `https://www.upwork.com${match[1]}`;
    const title = stripHtml(match[2]);
    if (title && !jobs.some(j => j.url === url)) {
      jobs.push({
        title,
        url,
        description: '',
        budget: null, budgetType: null, budgetMin: null, budgetMax: null,
        postedAt: null,
        skills: [],
        category: null,
        country: null,
        searchSkill,
        scrapedAt: new Date().toISOString(),
      });
    }
  }

  // Pattern 3: Look for embedded Next.js/React data
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1]);
      const searchResults = nextData?.props?.pageProps?.searchResults?.jobs
        || nextData?.props?.initialProps?.searchResults?.jobs
        || [];
      for (const j of searchResults) {
        jobs.push(parseUpworkApiJob(j, searchSkill));
      }
    } catch { /* ignore */ }
  }

  return jobs.length > 0 ? jobs : null;
}

// ── Source 2: Local Chrome Proxy ────────────────────────────────────────

async function fetchFromLocalProxy(skill) {
  const proxyUrl = process.env.UPWORK_PROXY_URL;
  if (!proxyUrl) return [];

  const base = proxyUrl.replace(/\/scrape\/?$/, '');
  const url = `${base}/jobs?q=${encodeURIComponent(skill)}&limit=20`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();
    const jobs = data?.jobs || [];
    console.log(`  ✓ ${jobs.length} jobs from local proxy for "${skill}"`);
    return jobs.map(j => ({ ...j, searchSkill: skill, scrapedAt: new Date().toISOString() }));
  } catch (err) {
    console.log(`  ⚠ Local proxy error for "${skill}": ${err.message}`);
    return [];
  }
}

// ── Source 3: Direct Upwork search API (may be blocked without proxy) ───

async function fetchDirectSearch(skill) {
  const q = encodeURIComponent(skill);
  const url = `https://www.upwork.com/ab/jobs/search/url?q=${q}&sort=recency&per_page=20`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();

    if (html.includes('cf-browser-verification') || html.includes('Just a moment')) {
      return null;
    }

    return parseUpworkSearchHtml(html, skill);
  } catch (err) {
    clearTimeout(timeout);
    return null;
  }
}

// ── Deduplication ───────────────────────────────────────────────────────

function loadSeenUrls() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = {};
      for (const [url, ts] of Object.entries(data)) {
        if (ts > cutoff) filtered[url] = ts;
      }
      return filtered;
    }
  } catch { /* start fresh */ }
  return {};
}

function saveSeenUrls(seen) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(seen, null, 2));
}

function deduplicateJobs(jobs, seenUrls) {
  const urlSet = new Set();
  const deduped = [];

  for (const job of jobs) {
    if (!job.url) continue;
    if (urlSet.has(job.url)) continue;
    urlSet.add(job.url);

    const isNew = !seenUrls[job.url];
    deduped.push({ ...job, isNew });
    seenUrls[job.url] = Date.now();
  }

  return deduped;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  const hasScrapeDo = !!process.env.SCRAPE_DO_API_KEY;
  const hasLocalProxy = !!process.env.UPWORK_PROXY_URL;

  console.log(`\n🔍 Upwork Job Scraper — ${today}`);
  console.log(`   Skills: ${skills.join(', ')}`);
  console.log(`   Sources: ${[hasScrapeDo && 'Scrape.do', hasLocalProxy && 'Local Proxy', 'Direct'].filter(Boolean).join(', ')}`);
  console.log(`   Dry run: ${dryRun}\n`);

  if (!dryRun) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const seenUrls = loadSeenUrls();
  let allJobs = [];
  let source = 'none';

  // Strategy: try sources in priority order for each skill
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    console.log(`  📡 [${i + 1}/${skills.length}] "${skill}"...`);

    let jobs = null;

    // Try Scrape.do first (most reliable for bypassing blocks)
    if (hasScrapeDo && !jobs) {
      jobs = await fetchViaScrapeDo(skill);
      if (jobs && jobs.length > 0) {
        source = 'scrape.do';
        console.log(`  ✓ ${jobs.length} jobs via Scrape.do`);
      }
    }

    // Try local Chrome proxy
    if (!jobs && hasLocalProxy) {
      const proxyJobs = await fetchFromLocalProxy(skill);
      if (proxyJobs.length > 0) {
        jobs = proxyJobs;
        source = 'local_proxy';
      }
    }

    // Try direct (usually blocked by Cloudflare but worth trying)
    if (!jobs) {
      jobs = await fetchDirectSearch(skill);
      if (jobs && jobs.length > 0) {
        source = 'direct';
        console.log(`  ✓ ${jobs.length} jobs via direct search`);
      }
    }

    if (!jobs || jobs.length === 0) {
      console.log(`  ✗ No jobs found for "${skill}"`);
    }

    if (jobs) allJobs.push(...jobs);

    // Rate limit between requests
    if (i < skills.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  // Deduplicate
  const jobs = deduplicateJobs(allJobs, seenUrls);
  const newJobs = jobs.filter(j => j.isNew);

  // Stats
  const fixedBudgets = [];
  const hourlyBudgets = [];
  const stats = {
    date: today,
    source,
    totalScraped: allJobs.length,
    afterDedup: jobs.length,
    newJobs: newJobs.length,
    bySkill: {},
    byBudgetType: { fixed: 0, hourly: 0, unknown: 0 },
    avgBudget: { fixed: 0, hourly: 0 },
    durationMs: Date.now() - startTime,
  };

  for (const job of jobs) {
    const sk = job.searchSkill || 'unknown';
    stats.bySkill[sk] = (stats.bySkill[sk] || 0) + 1;

    if (job.budgetType === 'fixed') {
      stats.byBudgetType.fixed++;
      if (job.budgetMin) fixedBudgets.push(job.budgetMin);
    } else if (job.budgetType === 'hourly') {
      stats.byBudgetType.hourly++;
      if (job.budgetMin) hourlyBudgets.push(job.budgetMin);
    } else {
      stats.byBudgetType.unknown++;
    }
  }

  if (fixedBudgets.length) {
    stats.avgBudget.fixed = Math.round(fixedBudgets.reduce((a, b) => a + b, 0) / fixedBudgets.length);
  }
  if (hourlyBudgets.length) {
    stats.avgBudget.hourly = Math.round(hourlyBudgets.reduce((a, b) => a + b, 0) / hourlyBudgets.length);
  }

  const output = {
    _meta: {
      scrapeDate: today,
      scrapedAt: new Date().toISOString(),
      skills,
      stats,
    },
    jobs,
  };

  console.log(`\n📊 Results:`);
  console.log(`   Source:        ${source}`);
  console.log(`   Total scraped: ${stats.totalScraped}`);
  console.log(`   After dedup:   ${stats.afterDedup}`);
  console.log(`   New jobs:      ${stats.newJobs}`);
  console.log(`   Fixed budget:  ${stats.byBudgetType.fixed} (avg $${stats.avgBudget.fixed})`);
  console.log(`   Hourly budget: ${stats.byBudgetType.hourly} (avg $${stats.avgBudget.hourly}/hr)`);
  console.log(`   Duration:      ${(stats.durationMs / 1000).toFixed(1)}s`);

  if (dryRun) {
    console.log('\n🏁 Dry run — no files written.');
    if (jobs.length > 0) {
      console.log('\nSample job:');
      console.log(JSON.stringify(jobs[0], null, 2));
    }
  } else {
    const outputFile = path.join(OUTPUT_DIR, `${today}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved: ${outputFile}`);

    saveSeenUrls(seenUrls);

    const latestFile = path.join(OUTPUT_DIR, 'latest.json');
    fs.writeFileSync(latestFile, JSON.stringify(output, null, 2));
    console.log(`💾 Updated: ${latestFile}`);
  }

  console.log(`\n✅ Done.\n`);
}

main().catch(err => {
  console.error('❌ Scraper failed:', err.message);
  process.exit(1);
});
