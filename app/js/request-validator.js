/**
 * CF-264: Request Validation & Sanitization (Enhanced)
 * Schema-driven input validator with XSS sanitizer, type/length checks,
 * and validate(schema, data) → {valid, errors} API.
 */
(function () {
  'use strict';

  // ─── Patterns ─────────────────────────────────────────────
  var PATTERNS = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
    slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    isoDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    amount: /^\d+(\.\d{1,2})?$/,
    phone: /^\+?[1-9]\d{6,14}$/,
    hex: /^#?[0-9a-fA-F]{3,8}$/
  };

  // ─── XSS Sanitizer ───────────────────────────────────────
  var SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  var EVENT_RE = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
  var TAG_RE = /<\/?[^>]+(>|$)/g;

  /**
   * Strip script tags, event handlers, and all HTML tags.
   * @param {string} str
   * @returns {string}
   */
  function stripTags(str) {
    if (!str) return '';
    return String(str)
      .replace(SCRIPT_RE, '')
      .replace(EVENT_RE, '')
      .replace(TAG_RE, '');
  }

  /**
   * HTML-entity escape for safe display.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitize a string: strip tags then escape remaining entities.
   * @param {string} str
   * @returns {string}
   */
  function sanitize(str) {
    return escapeHtml(stripTags(str));
  }

  /**
   * Trim whitespace and truncate to maxLen.
   * @param {string} str
   * @param {number} [maxLen]
   * @returns {string}
   */
  function trimTruncate(str, maxLen) {
    str = String(str || '').trim();
    return maxLen && str.length > maxLen ? str.slice(0, maxLen) : str;
  }

  // ─── Field Validators ─────────────────────────────────────

  /**
   * Validate a single value against a field definition.
   * @param {*} value
   * @param {Object} field — { type, required, minLen, maxLen, min, max, pattern, enum, custom }
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateField(value, field) {
    var empty = value === undefined || value === null || value === '';

    if (field.required && empty) {
      return { valid: false, error: 'required' };
    }
    if (empty) return { valid: true };

    switch (field.type) {
      case 'string':
        if (typeof value !== 'string') return { valid: false, error: 'must_be_string' };
        if (field.minLen && value.length < field.minLen) return { valid: false, error: 'too_short' };
        if (field.maxLen && value.length > field.maxLen) return { valid: false, error: 'too_long' };
        if (field.pattern && !field.pattern.test(value)) return { valid: false, error: 'invalid_format' };
        break;

      case 'email':
        if (!PATTERNS.email.test(String(value))) return { valid: false, error: 'invalid_email' };
        if (field.maxLen && String(value).length > field.maxLen) return { valid: false, error: 'too_long' };
        break;

      case 'url':
        if (!PATTERNS.url.test(String(value))) return { valid: false, error: 'invalid_url' };
        if (field.maxLen && String(value).length > field.maxLen) return { valid: false, error: 'too_long' };
        break;

      case 'date':
        if (!PATTERNS.date.test(String(value))) return { valid: false, error: 'invalid_date' };
        if (isNaN(Date.parse(value))) return { valid: false, error: 'invalid_date' };
        break;

      case 'amount':
        if (!PATTERNS.amount.test(String(value))) return { valid: false, error: 'invalid_amount' };
        var amt = parseFloat(value);
        if (field.min !== undefined && amt < field.min) return { valid: false, error: 'below_min' };
        if (field.max !== undefined && amt > field.max) return { valid: false, error: 'above_max' };
        break;

      case 'number':
        var n = Number(value);
        if (isNaN(n)) return { valid: false, error: 'must_be_number' };
        if (field.min !== undefined && n < field.min) return { valid: false, error: 'below_min' };
        if (field.max !== undefined && n > field.max) return { valid: false, error: 'above_max' };
        break;

      case 'enum':
        if (field.enum && field.enum.indexOf(value) === -1) return { valid: false, error: 'invalid_value' };
        break;

      case 'boolean':
        if (typeof value !== 'boolean') return { valid: false, error: 'must_be_boolean' };
        break;

      case 'array':
        if (!Array.isArray(value)) return { valid: false, error: 'must_be_array' };
        if (field.minLen && value.length < field.minLen) return { valid: false, error: 'too_few_items' };
        if (field.maxLen && value.length > field.maxLen) return { valid: false, error: 'too_many_items' };
        break;
    }

    // Custom validator function
    if (typeof field.custom === 'function') {
      var customResult = field.custom(value);
      if (customResult !== true) {
        return { valid: false, error: typeof customResult === 'string' ? customResult : 'custom_validation_failed' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate an object against a schema.
   * @param {Object} schema — { fieldName: fieldDef, ... }
   * @param {Object} data
   * @returns {{ valid: boolean, errors: Object }}
   */
  function validate(schema, data) {
    data = data || {};
    var errors = {};
    var valid = true;

    Object.keys(schema).forEach(function (key) {
      var result = validateField(data[key], schema[key]);
      if (!result.valid) {
        valid = false;
        errors[key] = result.error;
      }
    });

    return { valid: valid, errors: errors };
  }

  /**
   * Sanitize all string fields in data based on schema.
   * @param {Object} schema
   * @param {Object} data
   * @returns {Object}
   */
  function sanitizePayload(schema, data) {
    data = data || {};
    var clean = {};

    Object.keys(schema).forEach(function (key) {
      var val = data[key];
      var field = schema[key];

      if (val === undefined || val === null) {
        if (!field.required) clean[key] = field.default !== undefined ? field.default : null;
        return;
      }

      if (field.type === 'string' || field.type === 'email' || field.type === 'url') {
        clean[key] = trimTruncate(sanitize(String(val)), field.maxLen);
      } else if (field.type === 'number' || field.type === 'amount') {
        clean[key] = Number(val);
      } else if (field.type === 'boolean') {
        clean[key] = Boolean(val);
      } else {
        clean[key] = val;
      }
    });

    return clean;
  }

  /**
   * Validate and sanitize in one step.
   * @param {Object} schema
   * @param {Object} data
   * @returns {{ valid: boolean, errors: Object, data: Object|null }}
   */
  function validateAndSanitize(schema, data) {
    var result = validate(schema, data);
    if (!result.valid) return { valid: false, errors: result.errors, data: null };
    return { valid: true, errors: {}, data: sanitizePayload(schema, data) };
  }

  // ─── Common Schemas ───────────────────────────────────────
  var SCHEMAS = {
    contact: {
      name:    { type: 'string', required: true, minLen: 1, maxLen: 100 },
      email:   { type: 'email',  required: true, maxLen: 254 },
      message: { type: 'string', required: true, minLen: 10, maxLen: 2000 }
    },
    feedback: {
      rating:  { type: 'number', required: true, min: 1, max: 5 },
      message: { type: 'string', required: false, maxLen: 1000 },
      tool:    { type: 'string', required: false, maxLen: 50 }
    },
    waitlist: {
      email:   { type: 'email',  required: true, maxLen: 254 },
      source:  { type: 'string', required: false, maxLen: 50 }
    },
    chat: {
      message: { type: 'string', required: true, minLen: 1, maxLen: 4000 },
      tool:    { type: 'string', required: false, maxLen: 50 }
    },
    proposal: {
      title:   { type: 'string', required: true,  minLen: 5, maxLen: 200 },
      body:    { type: 'string', required: true,  minLen: 50, maxLen: 10000 },
      rate:    { type: 'amount', required: true,  min: 1, max: 999999 },
      currency: { type: 'enum',  required: false, enum: ['USD', 'EUR', 'GBP', 'TRY'] }
    },
    profile: {
      name:     { type: 'string', required: true,  minLen: 2, maxLen: 100 },
      title:    { type: 'string', required: true,  minLen: 5, maxLen: 150 },
      bio:      { type: 'string', required: false, maxLen: 5000 },
      hourlyRate: { type: 'amount', required: false, min: 1, max: 999 },
      website:  { type: 'url',    required: false, maxLen: 500 }
    },
    invoice: {
      clientName: { type: 'string', required: true, minLen: 1, maxLen: 200 },
      amount:     { type: 'amount', required: true, min: 0.01, max: 9999999 },
      dueDate:    { type: 'date',   required: true },
      description: { type: 'string', required: false, maxLen: 2000 }
    }
  };

  // ─── Export ───────────────────────────────────────────────
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RequestValidator = {
    validate: validate,
    validateField: validateField,
    validateAndSanitize: validateAndSanitize,
    sanitize: sanitize,
    sanitizePayload: sanitizePayload,
    stripTags: stripTags,
    escapeHtml: escapeHtml,
    trimTruncate: trimTruncate,
    SCHEMAS: SCHEMAS,
    PATTERNS: PATTERNS,
    version: '1.0.0'
  };
})();
