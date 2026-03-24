const express = require('express');
const path = require('path');
const fs = require('fs');

// ── Load and validate configuration ──
const config = require('./config');
config.validateOrDie({ requireStripe: config.isProd() });
config.printSummary();

const app = express();
const PORT = config.port;

// ── Trust proxy (for reverse proxies on Railway, Render, DO, etc.) ──
if (config.lb.trustProxy) {
  app.set('trust proxy', 1);
}

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

// ── CDN Cache Headers & Resource Hints ──
const { cacheHeaders } = require('./cdn/cache-headers');
const { resourceHints } = require('./cdn/resource-hints');
app.use(cacheHeaders);
app.use(resourceHints);

// ── Body parsing ──
// Stripe webhooks require raw body for signature verification
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── CFX-020: Monitoring ──
const { setupMonitoring } = require('./monitoring/setup-monitoring');
setupMonitoring(app);

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
const SKIP_FILES = new Set(['stripe.js', 'download.js', 'chat-stream.js', 'chat-stream-railway.js']); // Already mounted above / manually mounted
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
  '/admin/analytics': '/admin-analytics.html',
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
  '/webrtc-test': '/webrtc-test.html',
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
const server = app.listen(PORT, () => {
  console.log(`\nCortex Freelancer running at http://localhost:${PORT}`);
  if (config.stripe.isMockMode) {
    console.log('  → Stripe MOCK MODE (no STRIPE_SECRET_KEY set)');
  }
  console.log(`  → Environment: ${config.env} (${config.platform})`);
});

// ── SSE Streaming (CFX-021: WebSocket fallback) ──
// Mount the correct SSE handler based on environment.
// Railway: uses Anthropic SDK directly; Local: spawns openclaw CLI.
const sseModule = config.isRailway ? './api/chat-stream-railway' : './api/chat-stream';
const sseHandler = require(sseModule);
app.all('/api/chat-stream', sseHandler);
console.log(`  → SSE stream: ${config.isRailway ? 'Railway direct (Anthropic SDK)' : 'Local (OpenClaw CLI)'}`);

// ── SSE Health endpoint (CFX-021 + CFX-005) ──
app.get('/api/sse/health', (req, res) => {
  const metrics = typeof sseHandler.getSSEMetrics === 'function'
    ? sseHandler.getSSEMetrics()
    : { status: 'no metrics available' };
  res.json(metrics);
});

// ── WebSocket Bridge (real-time streaming) ──
// Railway mode: uses Anthropic SDK directly (no OpenClaw gateway needed)
// Local mode: spawns openclaw CLI (requires local gateway)
const bridgeModule = config.isRailway ? './api/ws-bridge-railway' : './api/ws-bridge';
console.log(`  → WS bridge: ${config.isRailway ? 'Railway direct (Anthropic SDK)' : 'Local (OpenClaw CLI)'}`);
const { attachWebSocket } = require(bridgeModule);
attachWebSocket(server);

// ── Socket.io Bridge (CFX-024: battle-tested WebSocket alternative) ──
const { attachSocketIO } = require('./api/socketio-bridge');
const socketioResult = attachSocketIO(server);
app.get('/api/socketio/health', (req, res) => {
  res.json(socketioResult.getMetrics());
});

// ── CFX-025: WebRTC Signaling Server & Bridge ──
const { attachSignalingServer, getSignalingStats } = require('./src/signaling-server');
const { attachWebRTCBridge, isWebRTCAvailable } = require('./api/webrtc-bridge');

try {
  if (isWebRTCAvailable()) {
    const signalingServer = attachSignalingServer(server);
    console.log('  → WebRTC signaling: /signaling');
    
    // Attach WebRTC bridge to signaling events
    const webrtcBridge = attachWebRTCBridge(signalingServer.signalingEvents);
    console.log('  → WebRTC bridge: attached to signaling');
    
    // Health endpoints
    app.get('/api/webrtc/health', (req, res) => {
      res.json({
        signaling: getSignalingStats(),
        bridge: webrtcBridge.getStats()
      });
    });
    
    app.get('/api/webrtc/sessions', (req, res) => {
      res.json({
        sessions: webrtcBridge.getSessions().map(s => s.getStats())
      });
    });
  } else {
    console.warn('  → WebRTC disabled: node-datachannel not available');
  }
} catch (err) {
  console.warn('  → WebRTC disabled:', err.message);
}
