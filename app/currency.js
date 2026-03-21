/* ===== Currency Detection — Cortex Freelancer ===== */
/* Detects user's country via timezone heuristic, shows local currency alongside USD.
   Usage: <script src="/app/currency.js"></script>
   API: window.cortexCurrency.local() => { code, symbol, rate, country } */

(function () {
  'use strict';

  var CURRENCIES = {
    EG: { code: 'EGP', symbol: 'E\u00A3', rate: 48.5, country: 'Egypt' },
    PK: { code: 'PKR', symbol: '\u20A8', rate: 278, country: 'Pakistan' },
    NG: { code: 'NGN', symbol: '\u20A6', rate: 1550, country: 'Nigeria' },
    TR: { code: 'TRY', symbol: '\u20BA', rate: 32.5, country: 'Turkey' },
    IN: { code: 'INR', symbol: '\u20B9', rate: 83.5, country: 'India' },
    BD: { code: 'BDT', symbol: '\u09F3', rate: 110, country: 'Bangladesh' },
    PH: { code: 'PHP', symbol: '\u20B1', rate: 56.5, country: 'Philippines' },
    KE: { code: 'KES', symbol: 'KSh', rate: 153, country: 'Kenya' },
    BR: { code: 'BRL', symbol: 'R$', rate: 5.05, country: 'Brazil' },
    MX: { code: 'MXN', symbol: 'MX$', rate: 17.2, country: 'Mexico' },
    AR: { code: 'ARS', symbol: 'AR$', rate: 870, country: 'Argentina' },
    CO: { code: 'COP', symbol: 'COL$', rate: 3950, country: 'Colombia' },
    SA: { code: 'SAR', symbol: '\uFDFC', rate: 3.75, country: 'Saudi Arabia' },
    AE: { code: 'AED', symbol: 'AED', rate: 3.67, country: 'UAE' },
    GB: { code: 'GBP', symbol: '\u00A3', rate: 0.79, country: 'United Kingdom' },
    EU: { code: 'EUR', symbol: '\u20AC', rate: 0.92, country: 'Europe' },
    CA: { code: 'CAD', symbol: 'CA$', rate: 1.36, country: 'Canada' },
    AU: { code: 'AUD', symbol: 'A$', rate: 1.53, country: 'Australia' }
  };

  /* Map timezone to country code */
  var TZ_MAP = {
    'Africa/Cairo': 'EG',
    'Asia/Karachi': 'PK',
    'Africa/Lagos': 'NG',
    'Europe/Istanbul': 'TR',
    'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
    'Asia/Dhaka': 'BD',
    'Asia/Manila': 'PH',
    'Africa/Nairobi': 'KE',
    'America/Sao_Paulo': 'BR',
    'America/Mexico_City': 'MX',
    'America/Argentina/Buenos_Aires': 'AR',
    'America/Bogota': 'CO',
    'Asia/Riyadh': 'SA',
    'Asia/Dubai': 'AE',
    'Europe/London': 'GB',
    'Europe/Paris': 'EU', 'Europe/Berlin': 'EU', 'Europe/Amsterdam': 'EU',
    'Europe/Rome': 'EU', 'Europe/Madrid': 'EU',
    'America/Toronto': 'CA', 'America/Vancouver': 'CA',
    'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU'
  };

  function detectCountry() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return TZ_MAP[tz] || null;
    } catch (e) {
      return null;
    }
  }

  function getLocalCurrency() {
    var country = detectCountry();
    if (!country || !CURRENCIES[country]) return null;
    return CURRENCIES[country];
  }

  /* Format USD amount in local currency */
  function formatLocal(usdAmount) {
    var cur = getLocalCurrency();
    if (!cur) return null;
    var localAmount = Math.round(usdAmount * cur.rate);
    return cur.symbol + localAmount.toLocaleString();
  }

  /* Auto-annotate elements with data-usd attribute */
  function annotateUSD() {
    var cur = getLocalCurrency();
    if (!cur) return;

    var els = document.querySelectorAll('[data-usd]');
    for (var i = 0; i < els.length; i++) {
      var usd = parseFloat(els[i].getAttribute('data-usd'));
      if (isNaN(usd)) continue;

      // Don't add twice
      if (els[i].querySelector('.local-price')) continue;

      var localAmount = Math.round(usd * cur.rate);
      var span = document.createElement('span');
      span.className = 'local-price';
      span.style.cssText = 'display:block;font-size:.8em;color:var(--text3,#666);font-weight:400;margin-top:.15rem;';
      span.textContent = '\u2248 ' + cur.symbol + localAmount.toLocaleString() + ' ' + cur.code;
      els[i].appendChild(span);
    }
  }

  /* Init */
  function init() {
    annotateUSD();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Public API */
  window.cortexCurrency = {
    local: getLocalCurrency,
    format: formatLocal,
    detect: detectCountry,
    annotate: annotateUSD
  };
})();
