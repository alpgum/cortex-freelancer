/* ===== i18n Framework — Cortex Freelancer ===== */
/* Usage: <script src="/app/i18n.js"></script>
   Translate elements: <span data-i18n="nav.home">Home</span>
   JS access: window.t('nav.home') => translated string
   Language selector auto-injected into footer */

(function () {
  'use strict';

  var SUPPORTED = ['en', 'tr', 'ar'];
  var RTL_LANGS = ['ar'];
  var STORAGE_KEY = 'cortex_lang';
  var loaded = {};
  var currentLang = 'en';

  /* ── Detect preferred language ── */
  function detectLang() {
    // 1. Saved preference
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;

    // 2. URL param ?lang=xx
    var params = new URLSearchParams(window.location.search);
    var param = params.get('lang');
    if (param && SUPPORTED.indexOf(param) !== -1) return param;

    // 3. Browser language
    var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    for (var i = 0; i < SUPPORTED.length; i++) {
      if (nav.startsWith(SUPPORTED[i])) return SUPPORTED[i];
    }
    return 'en';
  }

  /* ── Fetch locale JSON ── */
  function loadLocale(lang, cb) {
    if (loaded[lang]) { cb(loaded[lang]); return; }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/locales/' + lang + '.json', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            loaded[lang] = JSON.parse(xhr.responseText);
          } catch (e) {
            loaded[lang] = {};
          }
        } else {
          loaded[lang] = {};
        }
        cb(loaded[lang]);
      }
    };
    xhr.send();
  }

  /* ── Resolve nested key like "nav.home" ── */
  function resolve(obj, key) {
    var parts = key.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur && typeof cur === 'object' && parts[i] in cur) {
        cur = cur[parts[i]];
      } else {
        return undefined;
      }
    }
    return typeof cur === 'string' ? cur : undefined;
  }

  /* ── t() function ── */
  function t(key, fallback) {
    var val = resolve(loaded[currentLang] || {}, key);
    if (val !== undefined) return val;
    // Fallback to English
    val = resolve(loaded['en'] || {}, key);
    if (val !== undefined) return val;
    return fallback || key;
  }

  /* ── Apply translations to DOM ── */
  function applyTranslations() {
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-i18n');
      var val = t(key);
      if (val && val !== key) {
        els[i].textContent = val;
      }
    }
    // Also translate placeholder attributes
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      var pKey = placeholders[j].getAttribute('data-i18n-placeholder');
      var pVal = t(pKey);
      if (pVal && pVal !== pKey) {
        placeholders[j].setAttribute('placeholder', pVal);
      }
    }
    // Translate title attributes
    var titles = document.querySelectorAll('[data-i18n-title]');
    for (var k = 0; k < titles.length; k++) {
      var tKey = titles[k].getAttribute('data-i18n-title');
      var tVal = t(tKey);
      if (tVal && tVal !== tKey) {
        titles[k].setAttribute('title', tVal);
      }
    }
  }

  /* ── Set RTL/LTR direction ── */
  function setDirection(lang) {
    var isRTL = RTL_LANGS.indexOf(lang) !== -1;
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);

    // Load RTL stylesheet if needed
    var rtlLink = document.getElementById('cortex-rtl-css');
    if (isRTL) {
      if (!rtlLink) {
        rtlLink = document.createElement('link');
        rtlLink.rel = 'stylesheet';
        rtlLink.href = '/app/rtl.css';
        rtlLink.id = 'cortex-rtl-css';
        document.head.appendChild(rtlLink);
      }
    } else if (rtlLink) {
      rtlLink.parentNode.removeChild(rtlLink);
    }
  }

  /* ── Switch language ── */
  function switchLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    setDirection(lang);

    loadLocale(lang, function () {
      // Also ensure English is loaded as fallback
      loadLocale('en', function () {
        applyTranslations();
        updateSelector();
      });
    });
  }

  /* ── Language selector sync ── */
  var LANG_NAMES = { en: 'English', tr: 'T\u00FCrk\u00E7e', ar: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629' };

  function updateSelector() {
    // Sync with the footer dropdown (rendered by footer.js)
    var label = document.getElementById('lang-current-label');
    if (label) label.textContent = LANG_NAMES[currentLang] || currentLang;

    // Also sync legacy select if present
    var sel = document.getElementById('cortex-lang-select');
    if (sel) sel.value = currentLang;
  }

  function injectSelector() {
    // Footer dropdown is now rendered by footer.js — just sync the label
    updateSelector();
  }

  /* ── Initialize ── */
  function init() {
    currentLang = detectLang();
    setDirection(currentLang);

    // Load English first (always needed as fallback), then current lang
    loadLocale('en', function () {
      if (currentLang === 'en') {
        applyTranslations();
        injectSelector();
      } else {
        loadLocale(currentLang, function () {
          applyTranslations();
          injectSelector();
        });
      }
    });
  }

  // Expose globally
  window.t = t;
  window.cortexI18n = {
    t: t,
    switchLang: switchLang,
    currentLang: function () { return currentLang; },
    supported: SUPPORTED
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
