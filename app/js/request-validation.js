/**
 * CF-264: Request Validation & Sanitization
 * Client-side input validation helpers + schema definitions for API payloads.
 */
(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var URL_RE = /^https?:\/\/.+/;
  var SLUG_RE = /^[a-z0-9_-]+$/;

  /**
   * Sanitize an HTML string to plain text.
   * @param {string} str
   * @returns {string}
   */
  function sanitize(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Trim and truncate a string.
   * @param {string} str
   * @param {number} maxLen
   * @returns {string}
   */
  function trimTruncate(str, maxLen) {
    str = String(str || '').trim();
    return maxLen && str.length > maxLen ? str.slice(0, maxLen) : str;
  }

  /**
   * Validate a value against a schema field definition.
   * @param {*} value
   * @param {{ type: string, required?: boolean, minLen?: number, maxLen?: number, pattern?: RegExp, min?: number, max?: number, enum?: Array }} field
   * @returns {{ valid: boolean, error?: string }}
   */
  function validateField(value, field) {
    if (field.required && (value === undefined || value === null || value === '')) {
      return { valid: false, error: 'required' };
    }
    if (value === undefined || value === null || value === '') {
      return { valid: true };
    }

    if (field.type === 'string') {
      if (typeof value !== 'string') return { valid: false, error: 'must_be_string' };
      if (field.minLen && value.length < field.minLen) return { valid: false, error: 'too_short' };
      if (field.maxLen && value.length > field.maxLen) return { valid: false, error: 'too_long' };
      if (field.pattern && !field.pattern.test(value)) return { valid: false, error: 'invalid_format' };
    }

    if (field.type === 'email') {
      if (!EMAIL_RE.test(String(value))) return { valid: false, error: 'invalid_email' };
    }

    if (field.type === 'url') {
      if (!URL_RE.test(String(value))) return { valid: false, error: 'invalid_url' };
    }

    if (field.type === 'number') {
      var n = Number(value);
      if (isNaN(n)) return { valid: false, error: 'must_be_number' };
      if (field.min !== undefined && n < field.min) return { valid: false, error: 'below_min' };
      if (field.max !== undefined && n > field.max) return { valid: false, error: 'above_max' };
    }

    if (field.type === 'enum' && field.enum) {
      if (field.enum.indexOf(value) === -1) return { valid: false, error: 'invalid_value' };
    }

    return { valid: true };
  }

  /**
   * Validate an object against a schema.
   * @param {Object} data
   * @param {Object<string, Object>} schema — field name → field def
   * @returns {{ valid: boolean, errors: Object<string, string> }}
   */
  function validate(data, schema) {
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
   * Sanitize all string fields in a data object.
   * @param {Object} data
   * @param {Object} schema
   * @returns {Object}
   */
  function sanitizePayload(data, schema) {
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
      } else if (field.type === 'number') {
        clean[key] = Number(val);
      } else {
        clean[key] = val;
      }
    });

    return clean;
  }

  // Common schemas
  var SCHEMAS = {
    contact: {
      name: { type: 'string', required: true, minLen: 1, maxLen: 100 },
      email: { type: 'email', required: true },
      message: { type: 'string', required: true, minLen: 10, maxLen: 2000 }
    },
    feedback: {
      rating: { type: 'number', required: true, min: 1, max: 5 },
      message: { type: 'string', required: false, maxLen: 1000 },
      tool: { type: 'string', required: false, maxLen: 50 }
    },
    waitlist: {
      email: { type: 'email', required: true },
      source: { type: 'string', required: false, maxLen: 50 }
    },
    chat: {
      message: { type: 'string', required: true, minLen: 1, maxLen: 4000 },
      tool: { type: 'string', required: false, maxLen: 50 }
    }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RequestValidation = {
    sanitize: sanitize,
    trimTruncate: trimTruncate,
    validateField: validateField,
    validate: validate,
    sanitizePayload: sanitizePayload,
    SCHEMAS: SCHEMAS,
    EMAIL_RE: EMAIL_RE,
    URL_RE: URL_RE,
    SLUG_RE: SLUG_RE
  };
})();
