/**
 * Resource Hints Middleware for Cortex Freelancer
 * 
 * Injects preload, prefetch, dns-prefetch, and preconnect hints
 * into HTML responses via Link headers (HTTP 103 Early Hints compatible).
 * 
 * This works at the CDN/edge level — Cloudflare Early Hints will pick up
 * these Link headers and serve them as 103 responses on subsequent visits.
 */

// ── Critical Resources (preload on every page) ──
const PRELOAD_RESOURCES = [
  { href: '/app/styles.css', as: 'style' },
  { href: '/app/typography.css', as: 'style' },
];

// ── DNS Prefetch / Preconnect for third-party origins ──
const PRECONNECT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://www.googletagmanager.com',
  'https://firebaseinstallations.googleapis.com',
  'https://identitytoolkit.googleapis.com',
];

// ── Route-specific prefetch hints ──
const ROUTE_PREFETCH = {
  '/': [
    { href: '/app/engine.js', as: 'script' },
    { href: '/app/login.html', as: 'document' },
  ],
  '/pricing': [
    { href: '/checkout-success.html', as: 'document' },
  ],
  '/app': [
    { href: '/app/dashboard.js', as: 'script' },
    { href: '/app/engine.js', as: 'script' },
  ],
  '/app/chat': [
    { href: '/app/engine.js', as: 'script' },
  ],
  '/tools': [
    { href: '/app/js/tool-registry.js', as: 'script' },
  ],
};

/**
 * Build Link header value from resource hints
 */
function buildLinkHeaders(resources, type = 'preload') {
  return resources.map(r => {
    const parts = [`<${r.href}>`, `rel=${type}`];
    if (r.as) parts.push(`as=${r.as}`);
    if (r.crossorigin || type === 'preconnect') parts.push('crossorigin');
    return parts.join('; ');
  });
}

/**
 * Express middleware: adds Link headers for resource hints
 */
function resourceHints(req, res, next) {
  // Only for HTML responses (page navigations)
  const ext = require('path').extname(req.path);
  if (ext && ext !== '.html') return next();
  
  const links = [];
  
  // DNS prefetch + preconnect for third-party origins
  for (const origin of PRECONNECT_ORIGINS) {
    links.push(`<${origin}>; rel=preconnect; crossorigin`);
    links.push(`<${origin}>; rel=dns-prefetch`);
  }
  
  // Preload critical resources
  links.push(...buildLinkHeaders(PRELOAD_RESOURCES, 'preload'));
  
  // Route-specific prefetch
  const routeHints = ROUTE_PREFETCH[req.path] || ROUTE_PREFETCH[req.path.replace(/\/$/, '')];
  if (routeHints) {
    links.push(...buildLinkHeaders(routeHints, 'prefetch'));
  }
  
  if (links.length > 0) {
    res.set('Link', links.join(', '));
  }
  
  next();
}

module.exports = { resourceHints, PRELOAD_RESOURCES, PRECONNECT_ORIGINS, ROUTE_PREFETCH };
