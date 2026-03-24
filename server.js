const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3847;

// ── Security headers (migrated from vercel.json) ──
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-DNS-Prefetch-Control': 'on',
  });
  next();
});

// ── Body parsing ──
// Stripe webhooks require raw body for signature verification
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ──
const { rateLimitMiddleware } = require('./api/middleware/rate-limit');
app.use('/api', rateLimitMiddleware);

// ── Express-style route setups (these register their own paths) ──
const { setupStripeRoutes } = require('./api/stripe');
const { setupDownloadRoutes } = require('./api/download');
setupStripeRoutes(app);
setupDownloadRoutes(app);

// ── Auto-mount all Vercel-style serverless handlers ──
// Scans api/*.js and api/cron/*.js, mounts as app.all('/api/<name>', handler)
const SKIP_FILES = new Set(['stripe.js', 'download.js']); // Already mounted above
const API_DIR = path.join(__dirname, 'api');

function mountHandlers(dir, prefix) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    if (SKIP_FILES.has(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;

    const mod = require(fullPath);
    // Only mount if it exports a function (Vercel serverless handler)
    const handler = typeof mod === 'function' ? mod
      : typeof mod.default === 'function' ? mod.default
      : null;
    if (!handler) continue;

    const routeName = file.replace('.js', '');
    const route = `${prefix}/${routeName}`;
    app.all(route, handler);
    console.log(`  ✓ ${route}`);
  }
}

console.log('Mounting API routes:');
mountHandlers(API_DIR, '/api');

// Mount cron handlers
const CRON_DIR = path.join(API_DIR, 'cron');
if (fs.existsSync(CRON_DIR)) {
  mountHandlers(CRON_DIR, '/api/cron');
}

// ── URL rewrites (migrated from vercel.json routes) ──
// Firebase Auth proxy
app.use('/__/auth', (req, res) => {
  const target = `https://tets-e825e.firebaseapp.com/__/auth${req.path}`;
  res.redirect(307, target);
});

// Tool routes: /tools/<name> → /app/tools/<name>.html
app.get('/tools/:name', (req, res, next) => {
  const file = path.join(__dirname, 'app', 'tools', `${req.params.name}.html`);
  if (fs.existsSync(file)) return res.sendFile(file);
  next();
});

// App routes: /app/<name> → /app/<name>.html
const APP_REWRITES = {
  '/app': '/app/index.html',
  '/chat': '/app/chat.html',
  '/app/chat': '/app/chat.html',
  '/login': '/app/login.html',
  '/app/login': '/app/login.html',
  '/app/signup': '/app/signup.html',
  '/signup': '/app/signup.html',
  '/app/dashboard': '/app/dashboard.html',
  '/app/agents': '/app/agents.html',
  '/app/onboarding': '/app/onboarding.html',
  '/app/share': '/app/share.html',
  '/app/referral': '/app/referral.html',
  '/referral': '/app/referral.html',
  '/tools': '/app/tools/index.html',
};

// Page rewrites: /pricing → /pricing.html etc.
const PAGE_REWRITES = {
  '/support': '/support.html',
  '/pricing': '/pricing.html',
  '/about': '/about.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
  '/careers': '/careers.html',
  '/accessibility': '/accessibility.html',
  '/launch': '/launch.html',
  '/lifetime-deal': '/lifetime-deal.html',
  '/admin': '/admin.html',
  '/hq': '/cortex-hq.html',
  '/checkout-success': '/checkout-success.html',
  '/refund': '/refund.html',
  '/faq': '/faq.html',
  '/contact': '/contact.html',
  '/status': '/status.html',
  '/changelog': '/changelog.html',
  '/help/getting-started': '/help/getting-started.html',
  '/help/tools-guide': '/help/tools-guide.html',
  '/help/billing': '/help/billing.html',
};

// Landing page rewrites
const LANDING_REWRITES = {
  '/landing/egypt': '/landing/egypt.html',
  '/landing/pakistan': '/landing/pakistan.html',
  '/landing/nigeria': '/landing/nigeria.html',
  '/landing/turkey': '/landing/turkey.html',
};

const ALL_REWRITES = { ...APP_REWRITES, ...PAGE_REWRITES, ...LANDING_REWRITES };

for (const [src, dest] of Object.entries(ALL_REWRITES)) {
  app.get(src, (req, res) => {
    res.sendFile(path.join(__dirname, dest));
  });
}

// ── Static files ──
app.use(express.static(__dirname, { extensions: ['html'] }));

// ── 404 handler ──
app.use((req, res) => {
  const notFoundPage = path.join(__dirname, '404.html');
  if (fs.existsSync(notFoundPage)) {
    return res.status(404).sendFile(notFoundPage);
  }
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ── Start ──
const mockMode = !process.env.STRIPE_SECRET_KEY;
const server = app.listen(PORT, () => {
  console.log(`\nCortex Freelancer running at http://localhost:${PORT}`);
  if (mockMode) {
    console.log('  → Stripe MOCK MODE (no STRIPE_SECRET_KEY set)');
  }
  console.log(`  → Environment: ${process.env.RAILWAY_ENVIRONMENT || 'local'}`);
});

// ── WebSocket Bridge (real-time streaming) ──
// Railway mode: uses Anthropic SDK directly (no OpenClaw gateway needed)
// Local mode: spawns openclaw CLI (requires local gateway)
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
const bridgeModule = isRailway ? './api/ws-bridge-railway' : './api/ws-bridge';
console.log(`  → WS bridge: ${isRailway ? 'Railway direct (Anthropic SDK)' : 'Local (OpenClaw CLI)'}`);
const { attachWebSocket } = require(bridgeModule);
attachWebSocket(server);
