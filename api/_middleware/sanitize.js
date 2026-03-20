const MAX_LENGTH = 1000;

/**
 * Strip HTML tags from a string.
 */
function stripTags(str) {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a single string value: trim, strip HTML tags, limit length.
 */
function sanitizeString(value, maxLen = MAX_LENGTH) {
  if (typeof value !== 'string') return value;
  return stripTags(value).trim().slice(0, maxLen);
}

/**
 * Recursively sanitize all string values in an object or array.
 */
function sanitizeDeep(obj, maxLen = MAX_LENGTH) {
  if (typeof obj === 'string') return sanitizeString(obj, maxLen);
  if (Array.isArray(obj)) return obj.map(item => sanitizeDeep(item, maxLen));
  if (obj && typeof obj === 'object') {
    const cleaned = {};
    for (const key of Object.keys(obj)) {
      cleaned[key] = sanitizeDeep(obj[key], maxLen);
    }
    return cleaned;
  }
  return obj;
}

/**
 * Middleware: sanitize req.body and req.query string values.
 * Call as: sanitize(req) — mutates req.body and req.query in place.
 */
function sanitize(req) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeDeep(req.query);
  }
}

module.exports = { sanitize, sanitizeString, sanitizeDeep };
