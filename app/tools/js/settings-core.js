/* ============================================
   CORTEX FREELANCER — Settings Core Engine
   cf3-009 | settings-core.js
   ============================================
   Centralized settings system for the entire platform.
   Provides: get/set/subscribe/export/import/reset with
   localStorage persistence and validation.
   ============================================ */

;(function(global) {
  'use strict';

  const STORAGE_KEY = 'cortex_settings';
  const VERSION = 1;

  // ---- Default Settings Schema ----
  const DEFAULTS = {
    _version: VERSION,
    _lastModified: null,

    // User Preferences
    user: {
      displayName: '',
      email: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      currency: 'USD',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      language: 'en',
      weekStart: 'monday',
    },

    // Appearance
    appearance: {
      theme: 'dark',
      accentColor: 'orange', // orange, blue, green, purple
      compactMode: false,
      animations: true,
    },

    // Business Info
    business: {
      name: '',
      title: '', // e.g. "Full Stack Developer"
      address: '',
      city: '',
      country: '',
      postalCode: '',
      phone: '',
      website: '',
      taxId: '',
      logo: '', // base64 data URL (optional)
    },

    // Rates & Billing
    rates: {
      defaultHourlyRate: 0,
      defaultCurrency: 'USD',
      minimumProjectBudget: 0,
      overtimeMultiplier: 1.5,
      roundingIncrement: 15, // minutes (0, 1, 5, 15, 30, 60)
      taxRate: 0, // percentage
      taxLabel: 'Tax',
    },

    // Payment Terms
    payment: {
      defaultTerms: 'net30', // due-on-receipt, net15, net30, net45, net60, custom
      customTermsDays: 30,
      acceptedMethods: ['bank_transfer', 'paypal'],
      bankName: '',
      bankAccountName: '',
      bankAccountNumber: '',
      bankRoutingNumber: '',
      bankSwift: '',
      bankIban: '',
      paypalEmail: '',
      lateFeePercent: 0,
      depositPercent: 0,
      notes: '', // default payment notes on invoices
    },

    // Notifications
    notifications: {
      emailNotifications: true,
      browserNotifications: false,
      invoiceReminders: true,
      paymentAlerts: true,
      weeklyDigest: true,
      projectDeadlines: true,
      reminderDaysBefore: 3,
    },

    // Integrations (keys stored here, actual tokens should be more secure)
    integrations: {
      googleCalendarEnabled: false,
      slackWebhook: '',
      stripeEnabled: false,
    },
  };

  // ---- Validation Rules ----
  const VALIDATORS = {
    'user.email': v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'user.displayName': v => typeof v === 'string' && v.length <= 100,
    'user.timezone': v => typeof v === 'string' && v.length > 0,
    'business.phone': v => !v || /^[+\d\s\-().]{0,20}$/.test(v),
    'business.website': v => !v || /^https?:\/\/.+/.test(v) || /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}/.test(v),
    'business.taxId': v => typeof v === 'string' && v.length <= 50,
    'rates.defaultHourlyRate': v => typeof v === 'number' && v >= 0 && v <= 99999,
    'rates.taxRate': v => typeof v === 'number' && v >= 0 && v <= 100,
    'rates.overtimeMultiplier': v => typeof v === 'number' && v >= 1 && v <= 5,
    'rates.roundingIncrement': v => [0,1,5,15,30,60].includes(Number(v)),
    'rates.minimumProjectBudget': v => typeof v === 'number' && v >= 0,
    'payment.defaultTerms': v => ['due-on-receipt','net15','net30','net45','net60','custom'].includes(v),
    'payment.customTermsDays': v => typeof v === 'number' && v >= 1 && v <= 365,
    'payment.lateFeePercent': v => typeof v === 'number' && v >= 0 && v <= 100,
    'payment.depositPercent': v => typeof v === 'number' && v >= 0 && v <= 100,
    'payment.paypalEmail': v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    'notifications.reminderDaysBefore': v => typeof v === 'number' && v >= 0 && v <= 30,
  };

  // ---- Listeners ----
  let _listeners = [];
  let _settings = null;

  // ---- Deep Merge ----
  function deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        out[key] = deepMerge(target[key], source[key]);
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }

  // ---- Deep Clone ----
  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ---- Path Helpers ----
  function getByPath(obj, path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }

  function setByPath(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    let target = obj;
    for (const k of keys) {
      if (!target[k] || typeof target[k] !== 'object') target[k] = {};
      target = target[k];
    }
    target[last] = value;
  }

  // ---- Load ----
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to fill any new fields
        _settings = deepMerge(deepClone(DEFAULTS), parsed);
        _settings._version = VERSION;
      } else {
        _settings = deepClone(DEFAULTS);
      }
    } catch (e) {
      console.warn('[CortexSettings] Failed to load, using defaults:', e);
      _settings = deepClone(DEFAULTS);
    }
    return _settings;
  }

  // ---- Save ----
  function save() {
    try {
      _settings._lastModified = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
      return true;
    } catch (e) {
      console.error('[CortexSettings] Save failed:', e);
      return false;
    }
  }

  // ---- Notify listeners ----
  function notify(path, value, oldValue) {
    _listeners.forEach(fn => {
      try { fn(path, value, oldValue); } catch(e) { console.error('[CortexSettings] Listener error:', e); }
    });
  }

  // ---- Public API ----
  const CortexSettings = {
    /**
     * Initialize — call once on app boot.
     * Returns the full settings object.
     */
    init() {
      if (!_settings) load();
      return deepClone(_settings);
    },

    /**
     * Get a setting by dot-path, e.g. 'rates.defaultHourlyRate'
     * Returns undefined if not found.
     */
    get(path) {
      if (!_settings) load();
      if (!path) return deepClone(_settings);
      return deepClone(getByPath(_settings, path));
    },

    /**
     * Set a setting by dot-path.
     * Returns { ok: true } or { ok: false, error: string }
     */
    set(path, value) {
      if (!_settings) load();
      const validator = VALIDATORS[path];
      if (validator && !validator(value)) {
        return { ok: false, error: `Validation failed for "${path}"` };
      }
      const oldValue = getByPath(_settings, path);
      setByPath(_settings, path, value);
      const saved = save();
      if (saved) {
        notify(path, value, oldValue);
        return { ok: true };
      }
      return { ok: false, error: 'Failed to persist to localStorage' };
    },

    /**
     * Bulk update: pass an object of { 'dot.path': value, ... }
     * Returns { ok, errors[] }
     */
    update(changes) {
      if (!_settings) load();
      const errors = [];
      for (const [path, value] of Object.entries(changes)) {
        const validator = VALIDATORS[path];
        if (validator && !validator(value)) {
          errors.push({ path, error: `Validation failed for "${path}"` });
          continue;
        }
        const oldValue = getByPath(_settings, path);
        setByPath(_settings, path, value);
        notify(path, value, oldValue);
      }
      save();
      return { ok: errors.length === 0, errors };
    },

    /**
     * Subscribe to any change.
     * Callback: fn(path, newValue, oldValue)
     * Returns unsubscribe function.
     */
    subscribe(fn) {
      _listeners.push(fn);
      return () => {
        _listeners = _listeners.filter(l => l !== fn);
      };
    },

    /**
     * Validate a single field.
     * Returns true/false. Returns true if no validator exists.
     */
    validate(path, value) {
      const validator = VALIDATORS[path];
      if (!validator) return true;
      return validator(value);
    },

    /**
     * Validate all current settings.
     * Returns { valid: bool, errors: [{path, value}] }
     */
    validateAll() {
      if (!_settings) load();
      const errors = [];
      for (const [path, validator] of Object.entries(VALIDATORS)) {
        const value = getByPath(_settings, path);
        if (value !== undefined && value !== '' && !validator(value)) {
          errors.push({ path, value });
        }
      }
      return { valid: errors.length === 0, errors };
    },

    /**
     * Export all settings as a JSON string.
     */
    export() {
      if (!_settings) load();
      const exportData = {
        _export: true,
        _exportDate: new Date().toISOString(),
        _app: 'cortex-freelancer',
        _version: VERSION,
        settings: deepClone(_settings),
      };
      return JSON.stringify(exportData, null, 2);
    },

    /**
     * Import settings from a JSON string.
     * Returns { ok, error? }
     */
    import(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        if (!data._export || data._app !== 'cortex-freelancer') {
          return { ok: false, error: 'Invalid settings file. Not a Cortex export.' };
        }
        const imported = data.settings || data;
        _settings = deepMerge(deepClone(DEFAULTS), imported);
        _settings._version = VERSION;
        const saved = save();
        if (saved) {
          notify('*', _settings, null);
          return { ok: true };
        }
        return { ok: false, error: 'Failed to save imported settings.' };
      } catch (e) {
        return { ok: false, error: 'Invalid JSON: ' + e.message };
      }
    },

    /**
     * Reset a section or all settings to defaults.
     * section: 'user' | 'appearance' | 'business' | 'rates' | 'payment' | 'notifications' | 'integrations' | null (all)
     */
    reset(section) {
      if (!_settings) load();
      if (section && DEFAULTS[section]) {
        _settings[section] = deepClone(DEFAULTS[section]);
      } else if (!section) {
        _settings = deepClone(DEFAULTS);
      }
      save();
      notify(section || '*', _settings[section] || _settings, null);
      return { ok: true };
    },

    /**
     * Get list of accepted currencies.
     */
    getCurrencies() {
      return [
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'EUR', symbol: '€', name: 'Euro' },
        { code: 'GBP', symbol: '£', name: 'British Pound' },
        { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
        { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
        { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
        { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
        { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
        { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
        { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
        { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
        { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
        { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
        { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
        { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
        { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
        { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
        { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
      ];
    },

    /**
     * Get list of common timezones.
     */
    getTimezones() {
      return [
        'UTC',
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Istanbul',
        'Europe/Moscow', 'Europe/Amsterdam', 'Europe/Stockholm',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Dubai',
        'Asia/Kolkata', 'Asia/Seoul', 'Asia/Hong_Kong',
        'Australia/Sydney', 'Australia/Melbourne',
        'Pacific/Auckland',
        'Africa/Johannesburg', 'Africa/Cairo',
      ];
    },

    /**
     * Get currency symbol for a code.
     */
    getCurrencySymbol(code) {
      const c = this.getCurrencies().find(c => c.code === code);
      return c ? c.symbol : code;
    },

    /**
     * Get formatted rate display, e.g. "$150/hr"
     */
    getFormattedRate() {
      if (!_settings) load();
      const rate = _settings.rates.defaultHourlyRate;
      const sym = this.getCurrencySymbol(_settings.rates.defaultCurrency || _settings.user.currency);
      return rate > 0 ? `${sym}${rate}/hr` : 'Not set';
    },

    /**
     * Get payment terms display string.
     */
    getPaymentTermsLabel() {
      if (!_settings) load();
      const terms = _settings.payment.defaultTerms;
      const labels = {
        'due-on-receipt': 'Due on Receipt',
        'net15': 'Net 15',
        'net30': 'Net 30',
        'net45': 'Net 45',
        'net60': 'Net 60',
        'custom': `Net ${_settings.payment.customTermsDays}`,
      };
      return labels[terms] || terms;
    },

    /**
     * Get business display name (business name or user name).
     */
    getBusinessDisplayName() {
      if (!_settings) load();
      return _settings.business.name || _settings.user.displayName || 'My Business';
    },

    /**
     * Check if settings have been modified from defaults.
     */
    isConfigured() {
      if (!_settings) load();
      return !!_settings._lastModified;
    },

    /** Direct access to DEFAULTS for reference */
    DEFAULTS: deepClone(DEFAULTS),
  };

  // Auto-init
  CortexSettings.init();

  // Expose globally
  global.CortexSettings = CortexSettings;

})(typeof window !== 'undefined' ? window : globalThis);
