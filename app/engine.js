/* ===== CORTEX FREELANCER — ANALYSIS ENGINE ===== */

// ── Rate benchmarks ($/hr) ─────────────────────────────────────────────
const BENCHMARKS = {
  "web-development":    { egypt:25, turkey:30, pakistan:20, india:22, nigeria:22, philippines:18, brazil:28, mexico:30, ukraine:32, kenya:20, us:75, uk:65, eu:60 },
  "mobile-development": { egypt:30, turkey:35, pakistan:25, india:28, nigeria:25, philippines:22, brazil:32, mexico:33, ukraine:35, kenya:23, us:85, uk:70, eu:65 },
  "design":             { egypt:20, turkey:25, pakistan:15, india:18, nigeria:18, philippines:14, brazil:22, mexico:24, ukraine:25, kenya:16, us:65, uk:55, eu:50 },
  "writing":            { egypt:15, turkey:20, pakistan:12, india:14, nigeria:15, philippines:10, brazil:18, mexico:18, ukraine:20, kenya:12, us:50, uk:45, eu:40 },
  "data-science":       { egypt:35, turkey:40, pakistan:30, india:32, nigeria:28, philippines:25, brazil:36, mexico:38, ukraine:38, kenya:26, us:90, uk:80, eu:70 },
  "devops":             { egypt:30, turkey:35, pakistan:25, india:28, nigeria:24, philippines:22, brazil:32, mexico:34, ukraine:36, kenya:22, us:85, uk:72, eu:65 },
  "marketing":          { egypt:18, turkey:22, pakistan:14, india:16, nigeria:16, philippines:12, brazil:20, mexico:22, ukraine:22, kenya:14, us:55, uk:48, eu:42 },
  "video":              { egypt:18, turkey:22, pakistan:14, india:16, nigeria:15, philippines:12, brazil:20, mexico:20, ukraine:22, kenya:14, us:55, uk:48, eu:42 },
  "blockchain":         { egypt:40, turkey:45, pakistan:35, india:38, nigeria:32, philippines:30, brazil:42, mexico:42, ukraine:44, kenya:30, us:100, uk:85, eu:78 },
  "qa":                 { egypt:22, turkey:26, pakistan:18, india:20, nigeria:19, philippines:16, brazil:25, mexico:26, ukraine:28, kenya:17, us:60, uk:52, eu:48 },
};

const SKILL_LABELS = {
  "web-development":"Web Development","mobile-development":"Mobile Development","design":"UI/UX Design",
  "writing":"Content Writing","data-science":"Data Science","devops":"DevOps","marketing":"Digital Marketing",
  "video":"Video Editing","blockchain":"Blockchain","qa":"QA Testing",
};

const COUNTRY_LABELS = {
  egypt:"Egypt",turkey:"Turkey",pakistan:"Pakistan",india:"India",nigeria:"Nigeria",
  philippines:"Philippines",brazil:"Brazil",mexico:"Mexico",ukraine:"Ukraine",
  kenya:"Kenya",us:"United States",uk:"United Kingdom",eu:"Europe",
};

const JOB_TEMPLATES = {
  "web-development": ["Full-Stack Web App","React Dashboard","E-commerce Platform","Landing Page Redesign","API Integration","WordPress Custom Theme","SaaS MVP Development","REST API Backend","Next.js Web Application","Admin Panel Build"],
  "mobile-development": ["iOS App Development","React Native App","Flutter Cross-Platform","Android App Redesign","Mobile App UI/UX","App Store Optimization","Push Notifications System","Mobile Payment Integration","Fitness Tracking App","Food Delivery App Clone"],
  "design": ["Brand Identity Design","Mobile App UI Design","Website Redesign","Dashboard UI Kit","Logo + Brand Guide","SaaS Product Design","E-commerce UX Audit","Design System Creation","Social Media Templates","Pitch Deck Design"],
  "writing": ["Blog Content Strategy","SEO Article Writing","Technical Documentation","Email Newsletter Copy","Product Descriptions","Whitepaper Writing","Social Media Content","Case Study Writing","Website Copywriting","Ghostwriting Book"],
  "data-science": ["ML Model Development","Data Pipeline Build","Analytics Dashboard","NLP Chatbot","Predictive Model","Data Visualization","ETL Pipeline","Computer Vision System","Recommendation Engine","A/B Testing Framework"],
  "devops": ["AWS Infrastructure Setup","CI/CD Pipeline","Docker + Kubernetes","Cloud Migration","Monitoring Setup","Terraform IaC","Security Audit","Database Optimization","Auto-scaling Config","Backup & DR Plan"],
  "marketing": ["SEO Strategy","Google Ads Campaign","Social Media Management","Email Marketing Setup","Content Marketing Plan","Influencer Outreach","Conversion Optimization","Marketing Automation","Brand Strategy","Analytics Setup"],
  "video": ["YouTube Video Editing","Product Promo Video","Social Media Reels","Corporate Video","Motion Graphics","Video Ad Creation","Tutorial Video Series","Podcast Video Edit","Wedding Video Edit","Animation Explainer"],
  "blockchain": ["Smart Contract Dev","DeFi Protocol","NFT Marketplace","Token Launch","Web3 dApp","Blockchain Integration","Crypto Wallet","DAO Governance","DEX Development","Audit Smart Contracts"],
  "qa": ["Automated Test Suite","Manual QA Process","Selenium Framework","API Testing","Performance Testing","Mobile App Testing","Security Testing","Regression Suite","Test Documentation","Bug Tracking Setup"],
};

// ── Utility ─────────────────────────────────────────────────────────────
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function seededRand(seed) {
  let s = seed;
  return function() { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function fmt$(n) { return '$' + n.toLocaleString('en-US'); }

// ── State ───────────────────────────────────────────────────────────────
let currentUser = null; // { name, email } or null
let analysisResult = null;
let feedInterval = null;

// ── Screen management ───────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── Auth ────────────────────────────────────────────────────────────────
function mockGoogleLogin() {
  const name = prompt('Enter your name (mock Google login):');
  if (!name) return;
  currentUser = { name, email: name.toLowerCase().replace(/\s/g, '.') + '@gmail.com' };
  localStorage.setItem('cortex_user', JSON.stringify(currentUser));
  toast('Signed in as ' + currentUser.name);
}

function skipLogin() {
  currentUser = null;
  toast('Continuing as guest');
}

// ── Toast ───────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Manual form toggle ──────────────────────────────────────────────────
function toggleManualForm() {
  const f = document.getElementById('manual-form');
  f.classList.toggle('visible');
}

// ── Analysis entry points ───────────────────────────────────────────────
function analyzeFromURL() {
  const url = document.getElementById('upwork-url').value.trim();
  if (!url) { toast('Please enter a URL or use manual form'); return; }
  const username = url.replace(/\/+$/, '').split('/').pop() || url;
  const seed = hashStr(username);
  const rand = seededRand(seed);
  const skills = Object.keys(BENCHMARKS);
  const skill = skills[Math.floor(rand() * skills.length)];
  const countries = Object.keys(COUNTRY_LABELS);
  const country = countries[Math.floor(rand() * countries.length)];
  const benchmark = BENCHMARKS[skill][country] || 30;
  const rate = Math.round(benchmark * (0.7 + rand() * 0.6));
  const exp = Math.floor(1 + rand() * 10);
  runAnalysis({ skill, country, rate, exp, seed, username });
}

function analyzeFromManual() {
  const skill = document.getElementById('skill-select').value;
  const country = document.getElementById('country-select').value;
  const rate = parseInt(document.getElementById('rate-input').value) || 0;
  const exp = parseInt(document.getElementById('exp-input').value) || 0;
  if (!skill || !country) { toast('Please select your skill and country'); return; }
  if (!rate) { toast('Please enter your hourly rate'); return; }
  const seed = hashStr(skill + country + rate + exp);
  runAnalysis({ skill, country, rate, exp, seed, username: null });
}

// ── Main analysis pipeline ──────────────────────────────────────────────
function runAnalysis(input) {
  showScreen('screen-terminal');
  const result = generateAnalysis(input);
  analysisResult = result;
  runTerminalAnimation(() => {
    renderDashboard(result);
    showScreen('screen-dashboard');
  });
}

// ── Terminal animation ──────────────────────────────────────────────────
function runTerminalAnimation(onComplete) {
  const body = document.getElementById('terminal-body');
  const bar = document.getElementById('progress-bar');
  body.innerHTML = '';
  bar.style.width = '0%';

  const lines = [
    { text: 'Connecting to Upwork...', delay: 300 },
    { text: 'Crawling profile data...', delay: 500 },
    { text: 'Analyzing 847 similar freelancers...', delay: 600 },
    { text: 'Scanning 2,341 open jobs...', delay: 500 },
    { text: 'Calculating optimal rates...', delay: 400 },
    { text: 'Checking payment efficiency...', delay: 400 },
    { text: 'Generating your report...', delay: 500 },
  ];

  // Create DOM elements
  lines.forEach((l, i) => {
    const div = document.createElement('div');
    div.className = 'term-line';
    div.innerHTML = `<span class="prompt">&gt; </span><span class="typing">${l.text}</span><span class="check">&#10003;</span>`;
    body.appendChild(div);
  });

  const els = body.querySelectorAll('.term-line');
  let elapsed = 0;

  lines.forEach((l, i) => {
    const showAt = elapsed;
    const doneAt = showAt + l.delay + 400;
    const pct = Math.round(((i + 1) / lines.length) * 100);

    setTimeout(() => {
      els[i].classList.add('visible');
    }, showAt);

    setTimeout(() => {
      els[i].classList.add('done');
      bar.style.width = pct + '%';
    }, doneAt);

    elapsed = doneAt + 100;
  });

  setTimeout(onComplete, elapsed + 400);
}

// ── Generate analysis data ──────────────────────────────────────────────
function generateAnalysis({ skill, country, rate, exp, seed }) {
  const rand = seededRand(seed);
  const benchmark = BENCHMARKS[skill]?.[country] || 30;
  const skillLabel = SKILL_LABELS[skill] || skill;
  const countryLabel = COUNTRY_LABELS[country] || country;

  // Profile scores
  const headline = clamp(Math.round(4 + rand() * 5 + (exp > 5 ? 1 : 0)), 3, 10);
  const overview = clamp(Math.round(5 + rand() * 4 + (exp > 3 ? 1 : 0)), 4, 10);
  const skillsScore = clamp(Math.round(4 + rand() * 5), 3, 10);
  const portfolio = clamp(Math.round(3 + rand() * 5), 2, 10);
  const rateScore = clamp(Math.round(rate >= benchmark * 0.8 && rate <= benchmark * 1.3 ? 7 + rand() * 3 : 4 + rand() * 3), 3, 10);
  const totalScore = +((headline + overview + skillsScore + portfolio + rateScore) / 5).toFixed(1);

  const hints = {
    headline: headline < 7 ? 'Too generic, add your specialty' : 'Strong headline with clear value',
    overview: overview < 7 ? 'Good length, add metrics and results' : 'Well-written with clear outcomes',
    skills: skillsScore < 7 ? 'Missing trending skills in your niche' : 'Good skill coverage',
    portfolio: portfolio < 7 ? 'Add ' + (3 + Math.floor(rand() * 3)) + ' more case studies' : 'Solid portfolio with proof',
    rate: rate < benchmark ? 'Below market — raise to ' + fmt$(benchmark) + '/hr' : (rate > benchmark * 1.4 ? 'Above average — justify with results' : 'Competitive for your market'),
  };

  // Jobs
  const templates = JOB_TEMPLATES[skill] || JOB_TEMPLATES["web-development"];
  const jobCount = 10 + Math.floor(rand() * 12);
  const jobs = [];
  for (let i = 0; i < Math.min(5, templates.length); i++) {
    const budgetMult = 20 + Math.floor(rand() * 80);
    const budget = Math.round(benchmark * budgetMult / 10) * 10;
    const match = Math.round(68 + rand() * 27);
    const rating = +(4.2 + rand() * 0.8).toFixed(1);
    const hoursAgo = Math.floor(1 + rand() * 48);
    jobs.push({ title: templates[i], budget, match, rating, hoursAgo });
  }
  jobs.sort((a, b) => b.match - a.match);

  // Fee calculation
  const annualIncome = rate * 30 * 48;
  const payoneerFees = 29 + (annualIncome * 0.02) + (12 * 1.50);
  const cenoaFees = annualIncome * 0.0075;
  const savings = Math.round(payoneerFees - cenoaFees);

  // Rate insight
  const rateDiff = Math.round(((benchmark - rate) / benchmark) * 100);
  const rateInsight = rate < benchmark
    ? `Your rate is ${Math.abs(rateDiff)}% below market for ${skillLabel} in ${countryLabel}`
    : (rate > benchmark * 1.3
        ? `Your rate is ${Math.abs(rateDiff)}% above average — make sure your profile justifies it`
        : `Your rate is competitive for ${skillLabel} in ${countryLabel}`);

  // Feed items
  const feedItems = [
    { icon: '📝', text: `Draft proposal for '${templates[0]}' — ${fmt$(jobs[0]?.budget || 2000)} budget` },
    { icon: '📊', text: `Weekly revenue report ready — you earned ${fmt$(Math.round(rate * 30 * (0.8 + rand() * 0.4)))} this week` },
    { icon: '⚠️', text: `Invoice #INV-2026-${String(Math.floor(rand() * 50)).padStart(3, '0')} is ${Math.floor(2 + rand() * 8)} days overdue — sending reminder` },
    { icon: '🔍', text: `Found ${Math.floor(2 + rand() * 6)} new jobs matching your skills posted in last 2 hours` },
    { icon: '📈', text: `Tip: Raise your rate by $${Math.floor(2 + rand() * 8)}/hr — market supports it` },
    { icon: '📅', text: `Client meeting tomorrow ${Math.floor(9 + rand() * 8)}:00 ${rand() > 0.5 ? 'EST' : 'GMT'} — timezone reminder set` },
    { icon: '🎯', text: `Profile optimization: add "${['TypeScript', 'Figma', 'Python', 'AWS', 'React', 'Node.js'][Math.floor(rand() * 6)]}" to trending skills` },
    { icon: '💰', text: `Payment received: ${fmt$(Math.round(500 + rand() * 3000))} from client "${['TechCorp', 'StartupX', 'DesignCo', 'DataFlow', 'BuildIt'][Math.floor(rand() * 5)]}"` },
    { icon: '📋', text: `Auto-generated invoice #INV-2026-${String(Math.floor(rand() * 99)).padStart(3, '0')} for this week's work` },
    { icon: '🚀', text: `Your proposal for '${templates[2] || templates[0]}' was viewed by the client` },
  ];

  return {
    totalScore, headline, overview, skillsScore, portfolio, rateScore, hints,
    skillLabel, countryLabel, skill, country, rate, benchmark, exp,
    jobCount, jobs,
    annualIncome, payoneerFees: Math.round(payoneerFees), cenoaFees: Math.round(cenoaFees), savings,
    rateInsight,
    feedItems,
  };
}

// ── Render Dashboard ────────────────────────────────────────────────────
function renderDashboard(r) {
  // ── Panel A: Score ──
  const ring = document.getElementById('score-ring-fg');
  const circumference = 2 * Math.PI * 50; // r=50
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference;
  // Animate after paint
  requestAnimationFrame(() => {
    setTimeout(() => {
      const offset = circumference - (circumference * (r.totalScore / 10));
      ring.style.strokeDashoffset = offset;
    }, 100);
  });

  // Animate score number
  animateNumber('score-num', 0, r.totalScore, 1500, 1);

  // Breakdown
  const bd = document.getElementById('breakdown');
  const items = [
    { label: 'Headline', val: r.headline, hint: r.hints.headline },
    { label: 'Overview', val: r.overview, hint: r.hints.overview },
    { label: 'Skills', val: r.skillsScore, hint: r.hints.skills },
    { label: 'Portfolio', val: r.portfolio, hint: r.hints.portfolio },
    { label: 'Rate', val: r.rateScore, hint: r.hints.rate },
  ];
  bd.innerHTML = items.map(it => `
    <div class="breakdown-item">
      <span class="label">${it.label}</span>
      <div class="bar-wrap"><div class="bar-fill" data-width="${it.val * 10}"></div></div>
      <span class="val">${it.val}/10</span>
    </div>
    <div class="breakdown-hint">${it.hint}</div>
  `).join('');
  // Animate bars
  setTimeout(() => {
    bd.querySelectorAll('.bar-fill').forEach(b => { b.style.width = b.dataset.width + '%'; });
  }, 200);

  // ── Panel B: Jobs ──
  document.getElementById('jobs-count').innerHTML =
    `<span>${r.jobCount}</span> jobs match your profile this week`;
  const jl = document.getElementById('job-list');
  jl.innerHTML = r.jobs.map(j => `
    <div class="job-item">
      <div class="job-match ${j.match >= 80 ? 'high' : 'mid'}">${j.match}%</div>
      <div class="job-info">
        <div class="job-title">${j.title}</div>
        <div class="job-meta">
          <span>${fmt$(j.budget)}</span>
          <span>&#9733; ${j.rating}</span>
          <span>${j.hoursAgo}h ago</span>
        </div>
      </div>
      <button class="btn-sm" onclick="showScreen('screen-signup')">Draft Proposal</button>
    </div>
  `).join('');

  // ── Panel C: Money ──
  const mc = document.getElementById('money-content');
  const maxFee = Math.max(r.payoneerFees, r.cenoaFees);
  mc.innerHTML = `
    <div class="money-headline">You're losing <span class="savings">${fmt$(r.savings)}/year</span> in payment fees</div>
    <div class="fee-compare">
      <div class="fee-bar">
        <span class="fee-label">Payoneer</span>
        <div class="fee-track">
          <div class="fee-fill current" data-width="${(r.payoneerFees / maxFee) * 100}" style="width:0%">${fmt$(r.payoneerFees)}/yr</div>
        </div>
      </div>
      <div class="fee-bar">
        <span class="fee-label">With Cenoa</span>
        <div class="fee-track">
          <div class="fee-fill cenoa" data-width="${(r.cenoaFees / maxFee) * 100}" style="width:0%">${fmt$(r.cenoaFees)}/yr</div>
        </div>
      </div>
    </div>
    <div class="money-tip">${r.rateInsight}. <strong>Recommended: ${fmt$(r.benchmark)}/hr</strong></div>
  `;
  setTimeout(() => {
    mc.querySelectorAll('.fee-fill').forEach(b => { b.style.width = b.dataset.width + '%'; });
  }, 400);

  // ── Panel D: Feed ──
  if (feedInterval) clearInterval(feedInterval);
  const fc = document.getElementById('feed-container');
  fc.innerHTML = '';
  let feedIdx = 0;
  function addFeedItem() {
    const item = r.feedItems[feedIdx % r.feedItems.length];
    const el = document.createElement('div');
    el.className = 'feed-item';
    el.innerHTML = `
      <span class="feed-icon">${item.icon}</span>
      <div>
        <div class="feed-text">${item.text}</div>
        <div class="feed-time">Just now</div>
      </div>`;
    fc.insertBefore(el, fc.firstChild);
    if (fc.children.length > 8) fc.removeChild(fc.lastChild);
    feedIdx++;
  }
  // Initial batch
  for (let i = 0; i < 4; i++) { addFeedItem(); }
  feedInterval = setInterval(addFeedItem, 2000);

  // ── Share bar ──
  const sb = document.getElementById('share-bar');
  sb.innerHTML = `
    <div class="share-card-preview">
      <div class="scp-top">
        <span class="scp-brand">Cortex Freelancer</span>
        <div class="scp-score">${r.totalScore}<small>/10</small></div>
      </div>
      <div class="scp-stats">
        <div>${r.skillLabel} &middot; <span>${r.countryLabel}</span></div>
        <div>Saves <span>${fmt$(r.savings)}/yr</span></div>
      </div>
    </div>
    <div class="share-actions">
      <h3>Share your Freelancer Score</h3>
      <div class="share-btns">
        <button class="btn-share copy" onclick="copyShareLink()">&#128203; Copy Link</button>
        <button class="btn-share twitter" onclick="shareTwitter()">&#120143; Share on Twitter</button>
        <button class="btn-share linkedin" onclick="shareLinkedIn()">in Share on LinkedIn</button>
      </div>
    </div>
  `;

  // Update signup savings
  document.getElementById('signup-savings-li').innerHTML =
    `&#10003;&ensp;Save ${fmt$(r.savings)}/year on payment fees with Cenoa`;
}

// ── Animate number ──────────────────────────────────────────────────────
function animateNumber(elId, from, to, duration, decimals) {
  const el = document.getElementById(elId);
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
    el.textContent = (from + (to - from) * ease).toFixed(decimals);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── Share functions ─────────────────────────────────────────────────────
function getShareURL() {
  const r = analysisResult;
  if (!r) return location.href;
  const params = new URLSearchParams({
    score: r.totalScore,
    skills: r.skill,
    country: r.country,
    savings: r.savings,
  });
  return location.href.replace(/[^/]*$/, 'share.html') + '?' + params.toString();
}

function copyShareLink() {
  const url = getShareURL();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied!'));
  } else {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Link copied!');
  }
}

function shareTwitter() {
  const r = analysisResult;
  const text = `My Freelancer Score is ${r.totalScore}/10 — Cortex analyzed my profile and found I'm losing ${fmt$(r.savings)}/yr in fees 🤯 Check yours →`;
  const url = getShareURL();
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
}

function shareLinkedIn() {
  const url = getShareURL();
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
}

// ── Signup handler ──────────────────────────────────────────────────────
function handleSignup() {
  const email = document.getElementById('signup-email').value.trim();
  if (!email || !email.includes('@')) { toast('Please enter a valid email'); return; }
  localStorage.setItem('cortex_signup', JSON.stringify({ email, date: new Date().toISOString() }));
  toast('Welcome! Your 14-day trial has started.');
}

// ── Init ────────────────────────────────────────────────────────────────
(function init() {
  // Restore user
  const saved = localStorage.getItem('cortex_user');
  if (saved) { try { currentUser = JSON.parse(saved); } catch(e) {} }

  // Handle Enter key on URL input
  document.getElementById('upwork-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') analyzeFromURL();
  });
})();
