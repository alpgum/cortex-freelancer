/**
 * Headless Chrome scraper using @sparticuz/chromium + puppeteer-core.
 * Designed for Vercel serverless (works locally too with system Chrome).
 */

let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  _browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  return _browser;
}

/**
 * Scrape a URL using headless Chrome and return the rendered HTML.
 * @param {string} url - The URL to scrape
 * @param {object} [options] - Options
 * @param {number} [options.timeout=20000] - Navigation timeout in ms
 * @param {string} [options.waitFor] - Optional CSS selector to wait for
 * @returns {Promise<string>} Rendered HTML
 */
async function scrapeUrl(url, options = {}) {
  const { timeout = 20000, waitFor } = options;
  let browser = null;
  let page = null;

  try {
    browser = await getBrowser();
    page = await browser.newPage();

    // Randomize user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout,
    });

    // If a specific selector is requested, wait for it
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {});
    }

    const html = await page.content();
    return html;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    // Close browser after each invocation in serverless to avoid memory leaks
    if (browser) {
      await browser.close().catch(() => {});
      _browser = null;
    }
  }
}

module.exports = { scrapeUrl };
