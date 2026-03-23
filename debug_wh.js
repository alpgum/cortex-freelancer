const puppeteer = require('puppeteer-core');
(async () => {
  const CDP_ENDPOINT = 'http://127.0.0.1:18800';
  const versionRes = await fetch(`${CDP_ENDPOINT}/json/version`);
  const versionData = await versionRes.json();
  const wsUrl = versionData.webSocketDebuggerUrl;
  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('https://www.upwork.com/freelancers/~0185af9c92ecd76021', { waitUntil: 'networkidle2', timeout: 25000 });
  await new Promise(r => setTimeout(r, 2000));
  
  // Scroll aggressively
  for (let y = 0; y <= 12000; y += 1000) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await new Promise(r => setTimeout(r, 500));
  }
  
  const text = await page.evaluate(() => document.body.innerText);
  
  // Find work history section
  const whIdx = text.search(/Work\s*history/i);
  if (whIdx === -1) {
    console.log("NO 'Work history' FOUND in innerText");
    console.log("Looking for related terms...");
    const terms = ['history', 'completed', 'job', 'contract', 'earned'];
    for (const t of terms) {
      const idx = text.toLowerCase().indexOf(t);
      if (idx > -1) console.log(`Found '${t}' at index ${idx}: "${text.substring(idx, idx+80)}"`);
    }
  } else {
    console.log(`Found 'Work history' at index ${whIdx}`);
    console.log("=== WORK HISTORY SECTION (2000 chars) ===");
    console.log(text.substring(whIdx, whIdx + 2000));
    console.log("=== END ===");
  }
  
  await page.close();
  browser.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
