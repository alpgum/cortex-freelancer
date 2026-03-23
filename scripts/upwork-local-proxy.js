#!/usr/bin/env node
/**
 * [U-013] Local Chrome Proxy for Upwork Scraping
 *
 * Connects to the EXISTING host Chrome instance (OpenClaw browser)
 * via CDP and scrapes Upwork profiles using real cookies/session.
 *
 * Usage:
 *   node scripts/upwork-local-proxy.js
 *   # Then: curl "http://localhost:3848/scrape?url=https://www.upwork.com/freelancers/~01abc123"
 *
 * Environment:
 *   CDP_ENDPOINT  — Chrome DevTools Protocol endpoint (default: http://127.0.0.1:18800)
 *   PORT          — Server port (default: 3848)
 */

const express = require('express');
const puppeteer = require('puppeteer-core');

const PORT = parseInt(process.env.PORT || '3848', 10);
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://127.0.0.1:18800';

const app = express();

// ── CORS middleware ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health check ────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, cdp: CDP_ENDPOINT, uptime: process.uptime() });
});

// ── Scrape endpoint ─────────────────────────────────────────────────────
app.get('/scrape', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Missing ?url= parameter' });
  }

  // Validate it's an Upwork profile URL
  if (!/^https?:\/\/(www\.)?upwork\.com\/freelancers\/~[a-zA-Z0-9]+\/?$/.test(url)) {
    return res.status(400).json({ error: 'Invalid Upwork profile URL' });
  }

  let browser = null;
  let page = null;

  try {
    // Connect to the existing Chrome instance via CDP
    // First, get the WebSocket debugger URL from the /json/version endpoint
    const versionRes = await fetch(`${CDP_ENDPOINT}/json/version`);
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;

    if (!wsUrl) {
      return res.status(502).json({ error: 'Could not get WebSocket URL from Chrome CDP' });
    }

    console.log(`[proxy] Connecting to Chrome via: ${wsUrl}`);
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });

    // Open a NEW tab (don't touch existing ones)
    page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 900 });

    console.log(`[proxy] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Wait a bit for dynamic content
    await new Promise(r => setTimeout(r, 2000));

    // Scroll down to trigger lazy-loaded sections, then scroll back
    await page.evaluate(() => window.scrollTo(0, 1000));
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => window.scrollTo(0, 2500));
    await new Promise(r => setTimeout(r, 1500));

    // Extract profile data using regex on full innerText + DOM selectors
    const profile = await page.evaluate(() => {
      const body = document.body;
      if (!body) return null;

      const text = body.innerText || '';

      // ── Name ──
      const h2 = document.querySelector('h2');
      const name = h2 ? h2.textContent.trim() : null;

      // ── Title ──
      // Try structured selectors first, then regex
      const titleEl = document.querySelector('[data-qa="title"]') ||
                      document.querySelector('h2[role="presentation"]');
      const title = titleEl ? titleEl.textContent.trim() : null;

      // ── Hourly Rate ──
      const rateMatch = text.match(/\$([\d,.]+)\s*\/hr/);
      const hourlyRate = rateMatch ? `$${rateMatch[1]}/hr` : null;

      // ── Location ──
      // Pattern: "City, Country – HH:MM am/pm local time"
      let location = null;
      const locMatch = text.match(/([A-Z][\w\s]+,\s*[A-Z][\w\s]+)\s*[–\-]\s*\d{1,2}:\d{2}\s*(am|pm)/i);
      if (locMatch) {
        location = locMatch[1].trim();
      } else {
        // Fallback: "City, Country" near timezone patterns
        const locMatch2 = text.match(/([A-Z][a-zA-ZÀ-ÿ\s]+,\s*[A-Z][a-zA-ZÀ-ÿ\s]+)\s+local\s+time/i);
        location = locMatch2 ? locMatch2[1].trim() : null;
      }

      // ── Skills ──
      const skills = [];
      document.querySelectorAll('.air3-token').forEach(el => {
        let s = '';
        const label = el.querySelector('.air3-token-label, [data-test="token-label"]');
        if (label) {
          s = label.textContent.trim();
        } else {
          for (const node of el.childNodes) {
            if (node.nodeType === 3) {
              const t = node.textContent.trim();
              if (t) { s = t; break; }
            }
          }
          if (!s) s = el.textContent.trim();
        }
        if (s && !skills.includes(s) && s.length < 60 && !/^\d+$/.test(s) && !/^From \$/.test(s)) {
          s = s.replace(/\s+\d+$/, '').trim();
          if (s && !skills.includes(s)) skills.push(s);
        }
      });
      if (skills.length === 0) {
        document.querySelectorAll('[data-qa="skill"] span, .up-skill-badge').forEach(el => {
          const s = el.textContent.trim();
          if (s && !skills.includes(s)) skills.push(s);
        });
      }

      // ── Job Success Score ──
      const jssMatch = text.match(/(\d+)%\s*Job\s*Success/i);
      const jobSuccess = jssMatch ? parseInt(jssMatch[1], 10) : null;

      // ── Description / Overview ──
      // Try DOM selectors first
      let description = null;
      const descEl = document.querySelector('[data-qa="description"]') ||
                     document.querySelector('[data-qa="profile-overview"]') ||
                     document.querySelector('.up-line-clamp-v2');
      if (descEl) {
        description = descEl.textContent.trim();
      }
      if (!description) {
        // Regex: grab text block between hourly rate and "Skills" or "Portfolio" or "Work history"
        const rateIdx = text.indexOf('/hr');
        if (rateIdx > -1) {
          const afterRate = text.substring(rateIdx + 3);
          // Find first section boundary
          const boundaryMatch = afterRate.match(/\n\s*(Skills|Portfolio|Work\s*history|Employment|Specializes\s*in)/i);
          if (boundaryMatch) {
            const descBlock = afterRate.substring(0, boundaryMatch.index).trim();
            // Clean up: skip very short or header-like lines, take the longest paragraph
            const paragraphs = descBlock.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 30);
            if (paragraphs.length > 0) {
              description = paragraphs.join('\n\n');
            }
          }
        }
      }
      // Truncate overly long descriptions
      if (description && description.length > 2000) {
        description = description.substring(0, 2000) + '…';
      }

      // ── Portfolio count ──
      let portfolioCount = null;
      const portfolioItems = document.querySelectorAll('[data-qa="portfolio-item"], .up-portfolio-item, .air3-grid-container [data-qa="portfolio"] .air3-card');
      if (portfolioItems.length > 0) {
        portfolioCount = portfolioItems.length;
      }
      if (!portfolioCount) {
        // Regex: "Portfolio (3)" or "3 portfolio items"
        const pfMatch = text.match(/Portfolio\s*\((\d+)\)/i) ||
                        text.match(/(\d+)\s*portfolio\s*items?/i);
        portfolioCount = pfMatch ? parseInt(pfMatch[1], 10) : null;
      }

      // ── Total Earnings ──
      let totalEarnings = null;
      // Pattern: "$50K+ earned" or "$1M+ total earnings" or "$300K+" near "earned"
      const earnMatch = text.match(/\$([\d,.]+[KkMm]?\+?)\s*(?:total\s*earn|earned|in\s*total\s*earnings)/i);
      if (earnMatch) {
        totalEarnings = `$${earnMatch[1]}`;
      } else {
        // Broader: "$50K+" anywhere near earnings context
        const earnMatch2 = text.match(/\$([\d,.]+[KkMm]\+?)\s*\+?\s*earned/i);
        totalEarnings = earnMatch2 ? `$${earnMatch2[1]}` : null;
      }

      // ── Total Jobs ──
      let totalJobs = null;
      // Pattern: "123 jobs" or "1,234 contracts"
      const jobsMatch = text.match(/([\d,]+)\s+(?:jobs?|contracts?)\b/i);
      if (jobsMatch) {
        totalJobs = parseInt(jobsMatch[1].replace(/,/g, ''), 10);
      }

      // ── Total Hours ──
      let totalHours = null;
      // Pattern: "1,234 hours" or "5,678 hours worked"
      const hoursMatch = text.match(/([\d,]+)\s+hours/i);
      if (hoursMatch) {
        totalHours = parseInt(hoursMatch[1].replace(/,/g, ''), 10);
      }

      // ── Member Since ──
      let memberSince = null;
      const memberMatch = text.match(/Member\s*since\s+(\w+\s+\d{1,2},?\s*\d{4})/i) ||
                          text.match(/Member\s*since\s+(\w+\s+\d{4})/i);
      if (memberMatch) {
        memberSince = memberMatch[1].trim();
      }

      return {
        name,
        title,
        hourlyRate,
        totalEarnings,
        jobSuccess,
        totalJobs,
        totalHours,
        skills,
        portfolioCount,
        description,
        memberSince,
        location,
      };
    });

    // ── Work History extraction ──────────────────────────────────────
    // Scroll further down to ensure work history section is loaded
    await page.evaluate(() => window.scrollTo(0, 5000));
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => window.scrollTo(0, 8000));
    await new Promise(r => setTimeout(r, 1500));

    const workHistory = await page.evaluate(() => {
      const text = document.body?.innerText || '';

      // Find the "Work history" section
      const whIdx = text.search(/Work\s*history/i);
      if (whIdx === -1) return [];

      const afterWH = text.substring(whIdx);

      // Find the end boundary: "Portfolio", "Skills", "Employment", "Education", etc.
      const endMatch = afterWH.match(/\n\s*(Portfolio|Skills|Employment\s*history|Education|Other\s*experiences?|Certifications|Linked\s*accounts|Associated\s*agencies)\b/i);
      const whSection = endMatch ? afterWH.substring(0, endMatch.index) : afterWH.substring(0, 8000);

      const entries = [];

      // Split section into lines
      const lines = whSection.split('\n').map(l => l.trim()).filter(l => l.length > 0);

      // Upwork work history innerText pattern per job entry:
      //   Job Title
      //   Rating is X.X out of 5.        (accessibility text, optional)
      //   X.X                             (numeric rating)
      //   Mon DD, YYYY - Mon DD, YYYY     (date range)
      //   "Feedback text..."              (quoted feedback, optional)
      //   Private earnings  OR  $X,XXX    (earnings)
      //   Optional: "No feedback given", "Show N more"

      // Date pattern: "May 4, 2022 - Jan 18, 2025" or "Dec 18, 2024 - Present"
      const dateRangeRegex = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}\s*[-–]\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}|Present)$/i;

      // Find date range lines as anchors
      const dateAnchors = [];
      for (let i = 0; i < lines.length; i++) {
        if (dateRangeRegex.test(lines[i])) {
          dateAnchors.push(i);
        }
      }

      for (let a = 0; a < dateAnchors.length; a++) {
        const dateLineIdx = dateAnchors[a];
        // Next anchor or end of section
        const nextAnchorIdx = a + 1 < dateAnchors.length ? dateAnchors[a + 1] : lines.length;

        const entry = {
          title: null,
          rating: null,
          dateRange: lines[dateLineIdx],
          earnedAmount: null,
          hoursWorked: null,
          feedbackText: null,
        };

        // Look backwards from date line for title and rating
        for (let b = dateLineIdx - 1; b >= Math.max(0, dateLineIdx - 6); b--) {
          const line = lines[b];

          // Skip "Rating is X.X out of 5." accessibility text
          if (/^Rating\s+is\s+[\d.]+\s+out\s+of\s+5/i.test(line)) continue;

          // Numeric rating: "5.0" or "4.9 of 2 reviews"
          if (!entry.rating && /^\d\.\d(\s+of\s+\d+\s+reviews?)?$/i.test(line)) {
            entry.rating = parseFloat(line.match(/^([\d.]+)/)[1]);
            continue;
          }

          // Skip headers
          if (/^(Completed\s*jobs|In\s*progress|Work\s*history)/i.test(line)) break;
          // Skip "Show N more"
          if (/^Show\s+\d+\s+more/i.test(line)) continue;
          // Skip earnings/feedback from previous entry
          if (/^(Private\s+earnings|No\s+feedback)/i.test(line)) break;
          if (/^"/.test(line)) break;
          // Skip another date range (previous entry)
          if (dateRangeRegex.test(line)) break;

          // The first real text line going backwards is the title
          if (!entry.title && line.length > 3) {
            entry.title = line;
            break; // title found, stop looking backwards
          }
        }

        // Look forward from date line for earnings, hours, feedback
        // Use the next date anchor as hard stop (the title/rating lines just before it
        // will be caught by content-based breaks)
        const forwardLimit = a + 1 < dateAnchors.length ? dateAnchors[a + 1] : lines.length;

        const feedbackParts = [];
        for (let f = dateLineIdx + 1; f < forwardLimit && f < lines.length; f++) {
          const line = lines[f];

          // Stop if we hit a rating line for the next entry
          if (/^Rating\s+is\s+[\d.]+\s+out\s+of\s+5/i.test(line)) break;
          // Stop if we hit a numeric rating line (next entry's rating)
          if (/^\d\.\d(\s+of\s+\d+\s+reviews?)?$/i.test(line)) break;

          // Earnings: "$5,000.00" or "Private earnings"
          if (/^Private\s+earnings$/i.test(line)) {
            entry.earnedAmount = 'Private';
            continue;
          }
          if (!entry.earnedAmount) {
            const earnedMatch = line.match(/^\$([\d,]+(?:\.\d{2})?)$/);
            if (earnedMatch) {
              entry.earnedAmount = `$${earnedMatch[1]}`;
              continue;
            }
          }

          // Hours: "120 hrs" or "Hourly: 120 hrs"
          if (!entry.hoursWorked) {
            const hrsMatch = line.match(/([\d,]+)\s*(?:hrs|hours)/i);
            if (hrsMatch) {
              entry.hoursWorked = hrsMatch[1];
              continue;
            }
          }

          // Fixed price
          if (/Fixed.price/i.test(line) && !entry.hoursWorked) {
            entry.hoursWorked = 'Fixed price';
            continue;
          }

          // Skip UI elements
          if (/^(Show\s+\d+\s+more|See\s+more|Load\s+more|View\s+more)/i.test(line)) continue;
          if (/^(Completed\s*jobs|In\s*progress)/i.test(line)) continue;
          if (/create\s+an\s+account/i.test(line)) continue;

          // "No feedback given"
          if (/^No\s+feedback\s+given/i.test(line)) {
            entry.feedbackText = 'No feedback given';
            continue;
          }

          // Quoted feedback: starts with " character
          if (/^"/.test(line)) {
            let cleaned = line.replace(/^"|"$/g, '').replace(/…\s*See more$/, '…');
            if (cleaned.length > 5) feedbackParts.push(cleaned);
            continue;
          }
        }

        if (feedbackParts.length > 0 && !entry.feedbackText) {
          entry.feedbackText = feedbackParts.join(' ').substring(0, 500);
        }

        if (entry.title || entry.dateRange) {
          entries.push(entry);
        }
      }

      return entries;
    });

    if (!profile || !profile.name) {
      // Check if we got a Cloudflare challenge or login wall
      const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
      console.log(`[proxy] No profile data extracted. Page text preview: ${pageText.substring(0, 200)}`);
      return res.status(422).json({
        error: 'Could not extract profile data',
        hint: 'Page may require login or showed a challenge',
        preview: pageText.substring(0, 300),
      });
    }

    console.log(`[proxy] Success: ${profile.name} (${workHistory.length} work history entries)`);
    res.json({
      success: true,
      data: {
        ...profile,
        workHistory,
        _meta: {
          source: 'local_chrome_proxy',
          profileUrl: url,
          fetchedAt: new Date().toISOString(),
        },
      },
    });

  } catch (err) {
    console.error(`[proxy] Error scraping ${url}:`, err.message);
    res.status(500).json({
      error: 'Scraping failed',
      message: err.message,
    });
  } finally {
    // Close the tab but NOT the browser
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
    // Disconnect (don't close!) the browser connection
    if (browser) {
      try { browser.disconnect(); } catch { /* ignore */ }
    }
  }
});

// ── Jobs search endpoint (fallback for RSS) ────────────────────────────
app.get('/jobs', async (req, res) => {
  const query = req.query.q;
  const limit = Math.min(parseInt(req.query.limit || '5', 10), 20);

  if (!query) {
    return res.status(400).json({ error: 'Missing ?q= parameter' });
  }

  let browser = null;
  let page = null;

  try {
    const versionRes = await fetch(`${CDP_ENDPOINT}/json/version`);
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;

    if (!wsUrl) {
      return res.status(502).json({ error: 'Could not get WebSocket URL from Chrome CDP' });
    }

    console.log(`[proxy/jobs] Connecting to Chrome, searching: "${query}"`);
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const searchUrl = `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(query)}&sort=recency&per_page=${limit}`;
    console.log(`[proxy/jobs] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 25000 });

    // Wait for job tiles to load
    await new Promise(r => setTimeout(r, 3000));

    const jobs = await page.evaluate((maxJobs) => {
      const results = [];
      // Upwork search results use various selectors
      const tiles = document.querySelectorAll('[data-test="job-tile-list"] > div, .job-tile, article[data-ev-label="search_results_impression"]');

      for (let i = 0; i < Math.min(tiles.length, maxJobs); i++) {
        const tile = tiles[i];
        const text = tile.innerText || '';

        // Title
        const titleEl = tile.querySelector('a[data-test="job-tile-title-link"], h2 a, .job-title a, a.up-n-link');
        const title = titleEl ? titleEl.textContent.trim() : null;
        const url = titleEl ? titleEl.href : null;

        // Description
        const descEl = tile.querySelector('[data-test="job-description-text"], .job-description, p');
        const description = descEl ? descEl.textContent.trim().substring(0, 300) : '';

        // Budget
        let budget = null;
        let budgetType = null;
        let budgetMin = null;
        let budgetMax = null;
        const budgetEl = tile.querySelector('[data-test="budget"], .js-budget, [data-test="job-type-label"]');
        if (budgetEl) {
          const bt = budgetEl.textContent.trim();
          const fixedMatch = bt.match(/\$([\d,]+(?:\.\d+)?)/);
          const hourlyMatch = bt.match(/\$([\d,.]+)\s*-\s*\$([\d,.]+)/);
          if (hourlyMatch) {
            budget = '$' + hourlyMatch[1] + '-$' + hourlyMatch[2] + '/hr';
            budgetType = 'hourly';
            budgetMin = parseFloat(hourlyMatch[1].replace(/,/g, ''));
            budgetMax = parseFloat(hourlyMatch[2].replace(/,/g, ''));
          } else if (fixedMatch) {
            budget = '$' + fixedMatch[1];
            budgetType = 'fixed';
            budgetMin = parseFloat(fixedMatch[1].replace(/,/g, ''));
            budgetMax = budgetMin;
          }
        }

        // Posted time
        const timeEl = tile.querySelector('[data-test="posted-on"], .job-posted-on, time, small');
        const postedAt = timeEl ? timeEl.textContent.trim() : null;

        // Skills
        const skills = [];
        tile.querySelectorAll('[data-test="token"], .air3-token, .up-skill-badge, [data-test="attr-item"]').forEach(el => {
          const s = el.textContent.trim();
          if (s && s.length < 50 && !skills.includes(s)) skills.push(s);
        });

        if (title) {
          results.push({ title, url, description, budget, budgetType, budgetMin, budgetMax, postedAt, skills });
        }
      }
      return results;
    }, limit);

    console.log(`[proxy/jobs] Found ${jobs.length} jobs for "${query}"`);
    res.json({ jobs, query, source: 'local_chrome_proxy' });

  } catch (err) {
    console.error(`[proxy/jobs] Error searching "${query}":`, err.message);
    res.status(500).json({ error: 'Job search failed', message: err.message });
  } finally {
    if (page) { try { await page.close(); } catch { /* ignore */ } }
    if (browser) { try { browser.disconnect(); } catch { /* ignore */ } }
  }
});

// ── Freelancer search endpoint ──────────────────────────────────────────
app.get('/search', async (req, res) => {
  const query = req.query.q;
  const limit = Math.min(parseInt(req.query.limit || '5', 10), 20);

  if (!query) {
    return res.status(400).json({ error: 'Missing ?q= parameter' });
  }

  let browser = null;
  let page = null;

  try {
    const versionRes = await fetch(`${CDP_ENDPOINT}/json/version`);
    const versionData = await versionRes.json();
    const wsUrl = versionData.webSocketDebuggerUrl;

    if (!wsUrl) {
      return res.status(502).json({ error: 'Could not get WebSocket URL from Chrome CDP' });
    }

    console.log(`[proxy/search] Connecting to Chrome, searching freelancers: "${query}"`);
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const searchUrl = `https://www.upwork.com/nx/search/talent/?q=${encodeURIComponent(query)}&sort=relevance`;
    console.log(`[proxy/search] Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 25000 });

    // Wait for freelancer cards to load
    await new Promise(r => setTimeout(r, 3000));

    const freelancers = await page.evaluate((maxResults) => {
      const results = [];
      // Upwork talent search cards
      const cards = document.querySelectorAll('[data-test="freelancer-tile"], .up-card-section, article.freelancer-tile, [data-qa="freelancer-card"]');

      // Fallback: try broader selectors if nothing found
      const tiles = cards.length > 0 ? cards : document.querySelectorAll('.air3-card-section, [data-test="search-results-list"] > div, .up-card-hover');

      for (let i = 0; i < Math.min(tiles.length, maxResults); i++) {
        const tile = tiles[i];
        const text = tile.innerText || '';

        // Name
        const nameEl = tile.querySelector('a[data-test="freelancer-name"], h4 a, .identity-name a, [data-qa="tile-name"] a, a.freelancer-tile-name');
        const name = nameEl ? nameEl.textContent.trim() : null;

        // Profile URL
        let profileUrl = null;
        if (nameEl && nameEl.href) {
          profileUrl = nameEl.href;
        } else {
          const linkEl = tile.querySelector('a[href*="/freelancers/~"], a[href*="/fl/"]');
          if (linkEl) profileUrl = linkEl.href;
        }

        // Title
        const titleEl = tile.querySelector('[data-test="freelancer-title"], .freelancer-title, [data-qa="tile-title"]');
        const title = titleEl ? titleEl.textContent.trim() : null;

        // Hourly Rate
        let rate = null;
        const rateMatch = text.match(/\$([\d,.]+)\s*\/\s*hr/);
        if (rateMatch) rate = `$${rateMatch[1]}/hr`;

        // Job Success Score
        let jss = null;
        const jssMatch = text.match(/(\d+)%\s*(?:Job\s*Success|JSS)/i);
        if (jssMatch) jss = parseInt(jssMatch[1], 10);

        // Earnings
        let earnings = null;
        const earnMatch = text.match(/\$([\d,.]+[KkMm]?\+?)\s*(?:earned|\+?\s*earned|in\s*earnings)/i);
        if (earnMatch) earnings = `$${earnMatch[1]}`;
        if (!earnings) {
          const earnMatch2 = text.match(/\$([\d,.]+[KkMm]\+?)/);
          if (earnMatch2 && /earned/i.test(text)) earnings = `$${earnMatch2[1]}`;
        }

        // Location
        let location = null;
        const locEl = tile.querySelector('[data-test="freelancer-location"], .freelancer-location, [data-qa="tile-location"]');
        if (locEl) {
          location = locEl.textContent.trim();
        } else {
          const locMatch = text.match(/([A-Z][a-zA-ZÀ-ÿ\s]+,\s*[A-Z][a-zA-ZÀ-ÿ\s]+)/);
          if (locMatch) location = locMatch[1].trim();
        }

        // Skills
        const skills = [];
        tile.querySelectorAll('.air3-token, [data-test="token"], .up-skill-badge, [data-test="attr-item"]').forEach(el => {
          const s = el.textContent.trim();
          if (s && s.length < 60 && !skills.includes(s)) skills.push(s);
        });

        if (name || title) {
          results.push({ name, title, rate, jss, earnings, location, skills, profileUrl });
        }
      }
      return results;
    }, limit);

    console.log(`[proxy/search] Found ${freelancers.length} freelancers for "${query}"`);
    res.json({ freelancers, query, source: 'local_chrome_proxy' });

  } catch (err) {
    console.error(`[proxy/search] Error searching "${query}":`, err.message);
    res.status(500).json({ error: 'Freelancer search failed', message: err.message });
  } finally {
    if (page) { try { await page.close(); } catch { /* ignore */ } }
    if (browser) { try { browser.disconnect(); } catch { /* ignore */ } }
  }
});

// ── Start server ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[upwork-local-proxy] Listening on http://localhost:${PORT}`);
  console.log(`[upwork-local-proxy] CDP endpoint: ${CDP_ENDPOINT}`);
  console.log(`[upwork-local-proxy] Test: curl "http://localhost:${PORT}/scrape?url=https://www.upwork.com/freelancers/~01example"`);
});
