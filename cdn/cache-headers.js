/**
 * CDN Cache Headers Middleware for Cortex Freelancer
 * 
 * Sets optimal Cache-Control and related headers for different asset types.
 * Works with Cloudflare CDN, Vercel Edge, and any standards-compliant CDN.
 * 
 * Usage: app.use(cacheHeaders) — must be BEFORE express.static()
 */

const path = require('path');

// ── Cache Duration Constants ──
const ONE_YEAR = 31536000;   // Immutable assets (hashed filenames)
const ONE_MONTH = 2592000;   // Static assets (JS, CSS, fonts)
const ONE_WEEK = 604800;     // Images
const ONE_HOUR = 3600;       // HTML pages
const NO_CACHE = 0;          // API / dynamic

// ── Extension → Cache Policy Map ──
const CACHE_POLICIES = {
  // Immutable if content-hashed, otherwise long-lived
  '.js':    { maxAge: ONE_MONTH, public: true, staleWhileRevalidate: ONE_WEEK },
  '.css':   { maxAge: ONE_MONTH, public: true, staleWhileRevalidate: ONE_WEEK },
  '.mjs':   { maxAge: ONE_MONTH, public: true, staleWhileRevalidate: ONE_WEEK },
  
  // Fonts — very stable, cache aggressively
  '.woff2': { maxAge: ONE_YEAR, public: true, immutable: true },
  '.woff':  { maxAge: ONE_YEAR, public: true, immutable: true },
  '.ttf':   { maxAge: ONE_YEAR, public: true, immutable: true },
  '.eot':   { maxAge: ONE_YEAR, public: true, immutable: true },
  
  // Images
  '.png':   { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.jpg':   { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.jpeg':  { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.gif':   { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.svg':   { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.ico':   { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.webp':  { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  '.avif':  { maxAge: ONE_WEEK, public: true, staleWhileRevalidate: ONE_WEEK },
  
  // HTML — short cache, always revalidate
  '.html':  { maxAge: ONE_HOUR, public: true, mustRevalidate: true, staleWhileRevalidate: ONE_HOUR },
  
  // Data files
  '.json':  { maxAge: ONE_HOUR, public: true, mustRevalidate: true },
  '.xml':   { maxAge: ONE_HOUR, public: true, mustRevalidate: true },
  '.txt':   { maxAge: ONE_HOUR, public: true },
};

/**
 * Build Cache-Control header value from policy object
 */
function buildCacheControl(policy) {
  const parts = [];
  
  if (policy.public) parts.push('public');
  else parts.push('private');
  
  parts.push(`max-age=${policy.maxAge}`);
  
  if (policy.immutable) parts.push('immutable');
  if (policy.mustRevalidate) parts.push('must-revalidate');
  if (policy.staleWhileRevalidate) {
    parts.push(`stale-while-revalidate=${policy.staleWhileRevalidate}`);
  }
  
  return parts.join(', ');
}

/**
 * Express middleware: sets Cache-Control based on file extension and path
 */
function cacheHeaders(req, res, next) {
  // Skip API routes — no caching
  if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'CDN-Cache-Control': 'no-store',
      'Surrogate-Control': 'no-store',
    });
    return next();
  }
  
  const ext = path.extname(req.path).toLowerCase();
  const policy = CACHE_POLICIES[ext];
  
  if (policy) {
    const cacheControl = buildCacheControl(policy);
    res.set({
      'Cache-Control': cacheControl,
      // Cloudflare-specific: separate CDN cache from browser cache
      'CDN-Cache-Control': `public, max-age=${Math.max(policy.maxAge * 2, ONE_WEEK)}`,
      'Vary': 'Accept-Encoding',
    });
  } else if (!ext || ext === '') {
    // No extension = likely an HTML route (rewrite)
    res.set({
      'Cache-Control': `public, max-age=${ONE_HOUR}, must-revalidate, stale-while-revalidate=${ONE_HOUR}`,
      'CDN-Cache-Control': `public, max-age=${ONE_HOUR * 4}`,
      'Vary': 'Accept-Encoding, Cookie',
    });
  }
  
  // ETag support — let Express handle it
  // Surrogate-Key for targeted purges (Cloudflare Enterprise or Fastly)
  if (req.path.startsWith('/app/')) {
    res.set('Surrogate-Key', 'app-assets');
  } else if (req.path.startsWith('/landing/')) {
    res.set('Surrogate-Key', 'landing-pages');
  }
  
  next();
}

module.exports = { cacheHeaders, CACHE_POLICIES, buildCacheControl };
