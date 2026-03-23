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
    await new Promise(r => setTimeout(r, 3000));

    // Extract profile data using page.evaluate
    const profile = await page.evaluate(() => {
      const body = document.body;
      if (!body) return null;

      const text = body.innerText || '';

      // ── Name ──
      const h2 = document.querySelector('h2');
      const name = h2 ? h2.textContent.trim() : null;

      // ── Title ──
      // Usually the element right after the name or a specific selector
      const titleEl = document.querySelector('[data-qa="title"]') ||
                      document.querySelector('h2[role="presentation"]');
      const title = titleEl ? titleEl.textContent.trim() : null;

      // ── Hourly Rate ──
      const rateMatch = text.match(/\$([\d,.]+)\s*\/hr/);
      const hourlyRate = rateMatch ? `$${rateMatch[1]}/hr` : null;

      // ── Location ──
      // Look for common location patterns (City, Country or just Country)
      const locationEl = document.querySelector('[data-qa="location"]') ||
                         document.querySelector('[itemprop="addressLocality"]');
      let location = locationEl ? locationEl.textContent.trim() : null;
      if (!location) {
        // Regex fallback: look for patterns like "Istanbul, Turkey" near location indicators
        const locMatch = text.match(/(?:Located in|Location[:\s]+)([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)/);
        location = locMatch ? locMatch[1].trim() : null;
      }

      // ── Skills ──
      const skills = [];
      document.querySelectorAll('.air3-token').forEach(el => {
        // Get just the first text node or the label, ignoring nested badge counts
        let s = '';
        const label = el.querySelector('.air3-token-label, [data-test="token-label"]');
        if (label) {
          s = label.textContent.trim();
        } else {
          // Get first meaningful text node only
          for (const node of el.childNodes) {
            if (node.nodeType === 3) { // TEXT_NODE
              const t = node.textContent.trim();
              if (t) { s = t; break; }
            }
          }
          if (!s) s = el.textContent.trim();
        }
        // Filter out noise: badge counts, prices, too long (badges with counts)
        if (s && !skills.includes(s) && s.length < 60 && !/^\d+$/.test(s) && !/^From \$/.test(s)) {
          // Clean trailing numbers/whitespace from badge counts
          s = s.replace(/\s+\d+$/, '').trim();
          if (s && !skills.includes(s)) skills.push(s);
        }
      });
      // Fallback selectors
      if (skills.length === 0) {
        document.querySelectorAll('[data-qa="skill"] span, .up-skill-badge').forEach(el => {
          const s = el.textContent.trim();
          if (s && !skills.includes(s)) skills.push(s);
        });
      }

      // ── Job Success Score ──
      const jssMatch = text.match(/(\d+)%\s*Job\s*Success/i);
      const jobSuccess = jssMatch ? parseInt(jssMatch[1], 10) : null;

      // ── Description ──
      const descEl = document.querySelector('[data-qa="description"]') ||
                     document.querySelector('[data-qa="profile-overview"]') ||
                     document.querySelector('.up-line-clamp-v2');
      const description = descEl ? descEl.textContent.trim() : null;

      // ── Portfolio count ──
      const portfolioItems = document.querySelectorAll('[data-qa="portfolio-item"], .up-portfolio-item');
      const portfolioCount = portfolioItems.length || null;

      // ── Earnings ──
      const earningsEl = document.querySelector('[data-qa="total-earnings"]') ||
                         document.querySelector('[data-qa="earnings"]');
      let totalEarnings = earningsEl ? earningsEl.textContent.trim() : null;
      if (!totalEarnings) {
        const earnMatch = text.match(/\$([\d,.]+[KkMm]?\+?)\s*(?:total\s*earn|earned)/i);
        totalEarnings = earnMatch ? `$${earnMatch[1]}` : null;
      }

      // ── Total Jobs ──
      const jobsEl = document.querySelector('[data-qa="total-jobs"]') ||
                     document.querySelector('[data-qa="jobs-count"]');
      let totalJobs = null;
      if (jobsEl) {
        const m = jobsEl.textContent.match(/([\d,]+)/);
        totalJobs = m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
      }

      // ── Total Hours ──
      const hoursEl = document.querySelector('[data-qa="total-hours"]') ||
                      document.querySelector('[data-qa="hours"]');
      let totalHours = null;
      if (hoursEl) {
        const m = hoursEl.textContent.match(/([\d,]+)/);
        totalHours = m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
      }

      // ── Member Since ──
      const memberEl = document.querySelector('[data-qa="member-since"]');
      const memberSince = memberEl ? memberEl.textContent.replace(/^Member since\s*/i, '').trim() : null;

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

    console.log(`[proxy] Success: ${profile.name}`);
    res.json({
      success: true,
      data: {
        ...profile,
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

// ── Start server ────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[upwork-local-proxy] Listening on http://localhost:${PORT}`);
  console.log(`[upwork-local-proxy] CDP endpoint: ${CDP_ENDPOINT}`);
  console.log(`[upwork-local-proxy] Test: curl "http://localhost:${PORT}/scrape?url=https://www.upwork.com/freelancers/~01example"`);
});
