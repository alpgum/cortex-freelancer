/**
 * Compression Middleware for Cortex Freelancer
 * 
 * Brotli + Gzip compression with smart thresholds.
 * Cloudflare handles compression at the edge, but this ensures
 * origin responses are also compressed for:
 *   - Cache misses hitting origin
 *   - Non-Cloudflare deployments (Railway, Render, Docker)
 * 
 * Usage: app.use(compression) — should be one of the first middleware
 */

const zlib = require('zlib');

// Minimum size to compress (bytes) — below this, compression overhead > savings
const MIN_COMPRESS_SIZE = 1024; // 1KB

// Content types worth compressing
const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'image/svg+xml',
  'application/manifest+json',
  'application/ld+json',
]);

/**
 * Check if content type is compressible
 */
function isCompressible(contentType) {
  if (!contentType) return false;
  const type = contentType.split(';')[0].trim().toLowerCase();
  return COMPRESSIBLE_TYPES.has(type);
}

/**
 * Express compression middleware with Brotli priority
 */
function compressionMiddleware(req, res, next) {
  // Skip if already compressed or WebSocket
  if (req.headers['sec-websocket-key']) return next();
  
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  // Store original write/end to intercept
  const originalWrite = res.write;
  const originalEnd = res.end;
  
  let compressor = null;
  let encoding = null;
  
  // Prefer Brotli > Gzip > Deflate
  if (acceptEncoding.includes('br')) {
    encoding = 'br';
  } else if (acceptEncoding.includes('gzip')) {
    encoding = 'gzip';
  }
  
  if (!encoding) return next();
  
  // Lazy init — only compress if response is large enough and compressible
  let headersSent = false;
  let chunks = [];
  
  res.write = function(chunk, ...args) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  };
  
  res.end = function(chunk, ...args) {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    
    const body = Buffer.concat(chunks);
    const contentType = res.getHeader('content-type');
    
    // Don't compress small responses or non-compressible types
    if (body.length < MIN_COMPRESS_SIZE || !isCompressible(contentType)) {
      originalWrite.call(res, body);
      return originalEnd.call(res);
    }
    
    // Compress
    const compressFn = encoding === 'br'
      ? zlib.brotliCompressSync(body, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 4, // Balance speed vs ratio
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length,
          }
        })
      : zlib.gzipSync(body, { level: 6 });
    
    // Only use compressed if actually smaller
    if (compressFn.length < body.length) {
      res.setHeader('Content-Encoding', encoding);
      res.setHeader('Content-Length', compressFn.length);
      res.removeHeader('Content-Length'); // Let it recalculate
      res.setHeader('Vary', 'Accept-Encoding');
      originalWrite.call(res, compressFn);
    } else {
      originalWrite.call(res, body);
    }
    
    return originalEnd.call(res);
  };
  
  next();
}

module.exports = { compressionMiddleware, isCompressible, COMPRESSIBLE_TYPES };
