/**
 * [CF-126] Rate Calculator — Cost-of-Living Adjustment
 * Factor in location-based cost of living to recommend minimum viable rate.
 * Exposed on window.CortexFreelancer.RateCOLAdjustment
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_col_prefs';
  var CSS_INJECTED = false;

  // Cost of living index data (relative to US average = 100)
  // Sources: Numbeo, ERI, Bureau of Economic Analysis
  var COL_DATA = {
    // US Cities
    'us-sf': { name: 'San Francisco, CA', country: 'US', index: 179, rent: 235, groceries: 115, transport: 110 },
    'us-nyc': { name: 'New York, NY', country: 'US', index: 187, rent: 245, groceries: 120, transport: 95 },
    'us-la': { name: 'Los Angeles, CA', country: 'US', index: 150, rent: 185, groceries: 108, transport: 115 },
    'us-chicago': { name: 'Chicago, IL', country: 'US', index: 107, rent: 120, groceries: 102, transport: 105 },
    'us-austin': { name: 'Austin, TX', country: 'US', index: 112, rent: 135, groceries: 98, transport: 105 },
    'us-miami': { name: 'Miami, FL', country: 'US', index: 128, rent: 155, groceries: 105, transport: 108 },
    'us-denver': { name: 'Denver, CO', country: 'US', index: 118, rent: 140, groceries: 103, transport: 102 },
    'us-seattle': { name: 'Seattle, WA', country: 'US', index: 152, rent: 180, groceries: 112, transport: 108 },
    'us-avg': { name: 'US Average', country: 'US', index: 100, rent: 100, groceries: 100, transport: 100 },

    // Europe
    'uk-london': { name: 'London, UK', country: 'UK', index: 145, rent: 200, groceries: 105, transport: 120 },
    'uk-manchester': { name: 'Manchester, UK', country: 'UK', index: 85, rent: 90, groceries: 95, transport: 100 },
    'de-berlin': { name: 'Berlin, Germany', country: 'DE', index: 82, rent: 85, groceries: 90, transport: 88 },
    'de-munich': { name: 'Munich, Germany', country: 'DE', index: 105, rent: 120, groceries: 95, transport: 90 },
    'fr-paris': { name: 'Paris, France', country: 'FR', index: 112, rent: 145, groceries: 100, transport: 85 },
    'nl-amsterdam': { name: 'Amsterdam, Netherlands', country: 'NL', index: 105, rent: 130, groceries: 95, transport: 85 },
    'es-madrid': { name: 'Madrid, Spain', country: 'ES', index: 72, rent: 75, groceries: 80, transport: 78 },
    'es-barcelona': { name: 'Barcelona, Spain', country: 'ES', index: 75, rent: 82, groceries: 82, transport: 75 },
    'pt-lisbon': { name: 'Lisbon, Portugal', country: 'PT', index: 62, rent: 65, groceries: 72, transport: 70 },
    'it-milan': { name: 'Milan, Italy', country: 'IT', index: 90, rent: 100, groceries: 88, transport: 82 },
    'pl-warsaw': { name: 'Warsaw, Poland', country: 'PL', index: 52, rent: 50, groceries: 55, transport: 50 },

    // Turkey
    'tr-istanbul': { name: 'Istanbul, Turkey', country: 'TR', index: 38, rent: 30, groceries: 42, transport: 35 },
    'tr-ankara': { name: 'Ankara, Turkey', country: 'TR', index: 30, rent: 22, groceries: 38, transport: 30 },
    'tr-izmir': { name: 'Izmir, Turkey', country: 'TR', index: 32, rent: 25, groceries: 38, transport: 32 },

    // Asia & Other
    'in-bangalore': { name: 'Bangalore, India', country: 'IN', index: 28, rent: 18, groceries: 32, transport: 22 },
    'in-mumbai': { name: 'Mumbai, India', country: 'IN', index: 32, rent: 25, groceries: 30, transport: 20 },
    'ph-manila': { name: 'Manila, Philippines', country: 'PH', index: 35, rent: 22, groceries: 42, transport: 28 },
    'br-sao-paulo': { name: 'São Paulo, Brazil', country: 'BR', index: 42, rent: 35, groceries: 45, transport: 38 },
    'mx-cdmx': { name: 'Mexico City, Mexico', country: 'MX', index: 38, rent: 28, groceries: 42, transport: 30 },
    'ca-toronto': { name: 'Toronto, Canada', country: 'CA', index: 105, rent: 130, groceries: 100, transport: 95 },
    'au-sydney': { name: 'Sydney, Australia', country: 'AU', index: 120, rent: 145, groceries: 105, transport: 100 },
    'sg-singapore': { name: 'Singapore', country: 'SG', index: 125, rent: 155, groceries: 100, transport: 88 },
    'jp-tokyo': { name: 'Tokyo, Japan', country: 'JP', index: 98, rent: 110, groceries: 102, transport: 80 },
    'ae-dubai': { name: 'Dubai, UAE', country: 'AE', index: 95, rent: 110, groceries: 88, transport: 78 },
    'eg-cairo': { name: 'Cairo, Egypt', country: 'EG', index: 25, rent: 15, groceries: 30, transport: 18 },

    // Remote/Digital Nomad hubs
    'th-bangkok': { name: 'Bangkok, Thailand', country: 'TH', index: 40, rent: 28, groceries: 42, transport: 30 },
    'id-bali': { name: 'Bali, Indonesia', country: 'ID', index: 35, rent: 25, groceries: 38, transport: 28 },
    'co-medellin': { name: 'Medellín, Colombia', country: 'CO', index: 32, rent: 22, groceries: 38, transport: 25 }
  };

  // ─── Init ─────────────────────────────────────────────────────────

  function init(config) {
    if (config && config.location) _savePrefs(config.location);
  }

  function _loadPrefs() {
    try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
    catch (e) { return {}; }
  }

  function _savePrefs(locationKey) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ location: locationKey })); }
    catch (e) { /* ignore */ }
  }

  // ─── Minimum Viable Rate Calculation ──────────────────────────────

  function calculateMinimumRate(locationKey, options) {
    var opts = options || {};
    var location = COL_DATA[locationKey];
    if (!location) return null;

    // Configurable assumptions
    var annualExpensesBaseline = opts.annualExpenses || 60000; // US avg baseline
    var targetSavingsRate = opts.savingsRate || 0.20; // 20% savings target
    var taxRate = opts.taxRate || 0.25; // Estimated tax rate
    var billableHoursPerWeek = opts.hoursPerWeek || 30;
    var billableWeeksPerYear = opts.weeksPerYear || 48;
    var healthInsurance = opts.healthInsurance || 6000; // Annual health insurance (US baseline)
    var retirement = opts.retirement || 3000; // Annual retirement contribution baseline

    // Adjust expenses by COL index
    var colMultiplier = location.index / 100;
    var adjustedExpenses = annualExpensesBaseline * colMultiplier;
    var adjustedHealth = healthInsurance * Math.max(0.3, colMultiplier);
    var adjustedRetirement = retirement * colMultiplier;

    // Total annual needs
    var totalNeeds = adjustedExpenses + adjustedHealth + adjustedRetirement;
    var withSavings = totalNeeds / (1 - targetSavingsRate);
    var preTax = withSavings / (1 - taxRate);

    // Minimum viable rate
    var totalBillableHours = billableHoursPerWeek * billableWeeksPerYear;
    var minimumRate = Math.ceil(preTax / totalBillableHours);

    // Comfort tiers
    var survivalRate = Math.ceil((totalNeeds / (1 - taxRate)) / totalBillableHours);
    var comfortRate = Math.ceil((preTax * 1.15) / totalBillableHours);
    var thriveRate = Math.ceil((preTax * 1.4) / totalBillableHours);

    return {
      location: {
        key: locationKey,
        name: location.name,
        country: location.country,
        colIndex: location.index
      },
      rates: {
        survival: survivalRate,
        minimum: minimumRate,
        comfort: comfortRate,
        thrive: thriveRate
      },
      breakdown: {
        annualExpenses: Math.round(adjustedExpenses),
        healthInsurance: Math.round(adjustedHealth),
        retirement: Math.round(adjustedRetirement),
        totalNeeds: Math.round(totalNeeds),
        withSavings: Math.round(withSavings),
        preTax: Math.round(preTax),
        totalBillableHours: totalBillableHours
      },
      assumptions: {
        savingsRate: targetSavingsRate,
        taxRate: taxRate,
        hoursPerWeek: billableHoursPerWeek,
        weeksPerYear: billableWeeksPerYear
      }
    };
  }

  // ─── COL Comparison ───────────────────────────────────────────────

  function compareLocations(locationA, locationB) {
    var a = COL_DATA[locationA];
    var b = COL_DATA[locationB];
    if (!a || !b) return null;

    var ratio = b.index / a.index;
    return {
      from: { key: locationA, name: a.name, index: a.index },
      to: { key: locationB, name: b.name, index: b.index },
      ratio: Math.round(ratio * 100) / 100,
      percentDiff: Math.round((ratio - 1) * 100),
      rateAdjustment: function (currentRate) {
        return Math.round(currentRate * ratio);
      },
      categories: {
        rent: { from: a.rent, to: b.rent, ratio: Math.round((b.rent / a.rent) * 100) / 100 },
        groceries: { from: a.groceries, to: b.groceries, ratio: Math.round((b.groceries / a.groceries) * 100) / 100 },
        transport: { from: a.transport, to: b.transport, ratio: Math.round((b.transport / a.transport) * 100) / 100 }
      }
    };
  }

  function adjustRateForLocation(rate, fromLocation, toLocation) {
    var comparison = compareLocations(fromLocation, toLocation);
    if (!comparison) return rate;
    return comparison.rateAdjustment(rate);
  }

  // ─── Render: COL Calculator ───────────────────────────────────────

  function renderCOLCalculator(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var prefs = _loadPrefs();
    var currentLocation = opts.location || prefs.location || 'us-avg';
    var currentRate = opts.currentRate || 50;

    function refresh(loc, rate) {
      _renderCalculator(container, loc, rate, opts);
    }

    _renderCalculator(container, currentLocation, currentRate, opts);
  }

  function _renderCalculator(container, locationKey, currentRate, opts) {
    var result = calculateMinimumRate(locationKey, opts);
    if (!result) {
      container.innerHTML = '<div class="col-panel"><div class="col-empty">Invalid location selected.</div></div>';
      return;
    }

    var h = '<div class="col-panel">';

    // Header
    h += '<div class="col-header">';
    h += '<div><h3 class="col-title">Cost-of-Living Rate Advisor</h3>';
    h += '<div class="col-subtitle">' + _escapeHtml(result.location.name) + ' &middot; COL Index: ' + result.location.colIndex + '</div></div>';
    h += '</div>';

    // Rate tiers
    h += '<div class="col-tiers">';
    h += _renderTierCard('Survival', result.rates.survival, currentRate, '#ef4444', 'Covers basic expenses only');
    h += _renderTierCard('Minimum Viable', result.rates.minimum, currentRate, '#eab308', 'Covers expenses + savings');
    h += _renderTierCard('Comfortable', result.rates.comfort, currentRate, '#22c55e', 'Room for growth & buffer');
    h += _renderTierCard('Thriving', result.rates.thrive, currentRate, '#06b6d4', 'Premium lifestyle + investing');
    h += '</div>';

    // Your rate comparison
    var rateStatus;
    if (currentRate < result.rates.survival) rateStatus = { label: 'Below Survival', color: '#ef4444', msg: 'Your rate does not cover basic living expenses in ' + result.location.name + '. Consider raising it immediately.' };
    else if (currentRate < result.rates.minimum) rateStatus = { label: 'Below Minimum', color: '#f59e0b', msg: 'Your rate covers basics but leaves no room for savings or emergencies.' };
    else if (currentRate < result.rates.comfort) rateStatus = { label: 'Viable', color: '#eab308', msg: 'Your rate meets minimum needs. Aim for the comfort zone to build financial security.' };
    else if (currentRate < result.rates.thrive) rateStatus = { label: 'Comfortable', color: '#22c55e', msg: 'Solid rate for your location. You have room for savings and occasional treats.' };
    else rateStatus = { label: 'Thriving', color: '#06b6d4', msg: 'Excellent rate for your location. Focus on investing and long-term wealth building.' };

    h += '<div class="col-assessment" style="border-left-color:' + rateStatus.color + '">';
    h += '<div class="col-assessment-header">';
    h += '<span>Your Rate: <strong>$' + currentRate + '/hr</strong></span>';
    h += '<span class="col-status-badge" style="background:' + rateStatus.color + '20;color:' + rateStatus.color + '">' + rateStatus.label + '</span>';
    h += '</div>';
    h += '<div class="col-assessment-msg">' + rateStatus.msg + '</div>';
    h += '</div>';

    // Expense breakdown
    h += '<div class="col-breakdown">';
    h += '<div class="col-breakdown-title">Annual Expense Breakdown</div>';
    h += '<div class="col-breakdown-items">';
    h += _renderBreakdownItem('Living Expenses', result.breakdown.annualExpenses);
    h += _renderBreakdownItem('Health Insurance', result.breakdown.healthInsurance);
    h += _renderBreakdownItem('Retirement', result.breakdown.retirement);
    h += _renderBreakdownItem('Total Needs', result.breakdown.totalNeeds, true);
    h += _renderBreakdownItem('+ Savings (' + Math.round(result.assumptions.savingsRate * 100) + '%)', result.breakdown.withSavings);
    h += _renderBreakdownItem('Pre-Tax Required', result.breakdown.preTax, true);
    h += '</div></div>';

    // Location selector
    h += '<div class="col-location-select">';
    h += '<div class="col-location-label">Change Location</div>';
    h += '<select class="col-select" id="col-location-select">';

    var regions = _groupByCountry();
    for (var region in regions) {
      if (!regions.hasOwnProperty(region)) continue;
      h += '<optgroup label="' + _escapeHtml(region) + '">';
      for (var ri = 0; ri < regions[region].length; ri++) {
        var loc = regions[region][ri];
        var selected = loc.key === locationKey ? ' selected' : '';
        h += '<option value="' + loc.key + '"' + selected + '>' + _escapeHtml(loc.name) + ' (COL: ' + loc.index + ')</option>';
      }
      h += '</optgroup>';
    }
    h += '</select>';

    // Rate input
    h += '<div class="col-rate-input-wrap">';
    h += '<label class="col-location-label">Your Hourly Rate ($)</label>';
    h += '<input class="col-rate-input" id="col-rate-input" type="number" value="' + currentRate + '" min="1" step="1">';
    h += '</div>';
    h += '</div>';

    h += '</div>';
    container.innerHTML = h;

    // Bind events
    var locSelect = container.querySelector('#col-location-select');
    var rateInput = container.querySelector('#col-rate-input');

    if (locSelect) {
      locSelect.addEventListener('change', function () {
        var newLoc = this.value;
        var rate = parseInt(rateInput.value, 10) || 50;
        _savePrefs(newLoc);
        _renderCalculator(container, newLoc, rate, opts);
      });
    }

    if (rateInput) {
      var debounce = null;
      rateInput.addEventListener('input', function () {
        var rate = parseInt(this.value, 10);
        if (!rate || rate < 1) return;
        clearTimeout(debounce);
        var loc = locSelect.value;
        debounce = setTimeout(function () {
          _renderCalculator(container, loc, rate, opts);
        }, 500);
      });
    }
  }

  function _renderTierCard(label, rate, currentRate, color, desc) {
    var isAbove = currentRate >= rate;
    var h = '<div class="col-tier' + (isAbove ? ' col-tier-achieved' : '') + '">';
    h += '<div class="col-tier-color" style="background:' + color + '"></div>';
    h += '<div class="col-tier-body">';
    h += '<div class="col-tier-label">' + label + '</div>';
    h += '<div class="col-tier-rate" style="color:' + color + '">$' + rate + '<small>/hr</small></div>';
    h += '<div class="col-tier-desc">' + desc + '</div>';
    h += '</div></div>';
    return h;
  }

  function _renderBreakdownItem(label, amount, highlight) {
    var cls = highlight ? ' col-bd-highlight' : '';
    return '<div class="col-bd-item' + cls + '"><span>' + label + '</span><span>$' + amount.toLocaleString() + '</span></div>';
  }

  function _groupByCountry() {
    var COUNTRY_NAMES = { US: 'United States', UK: 'United Kingdom', DE: 'Germany', FR: 'France', NL: 'Netherlands', ES: 'Spain', PT: 'Portugal', IT: 'Italy', PL: 'Poland', TR: 'Turkey', IN: 'India', PH: 'Philippines', BR: 'Brazil', MX: 'Mexico', CA: 'Canada', AU: 'Australia', SG: 'Singapore', JP: 'Japan', AE: 'UAE', EG: 'Egypt', TH: 'Thailand', ID: 'Indonesia', CO: 'Colombia' };
    var groups = {};
    for (var key in COL_DATA) {
      if (!COL_DATA.hasOwnProperty(key)) continue;
      var loc = COL_DATA[key];
      var regionName = COUNTRY_NAMES[loc.country] || loc.country;
      if (!groups[regionName]) groups[regionName] = [];
      groups[regionName].push({ key: key, name: loc.name, index: loc.index });
    }
    return groups;
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function getLocations() {
    var locs = [];
    for (var key in COL_DATA) {
      if (COL_DATA.hasOwnProperty(key)) {
        locs.push({ key: key, name: COL_DATA[key].name, country: COL_DATA[key].country, index: COL_DATA[key].index });
      }
    }
    return locs.sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function searchLocations(query) {
    if (!query) return getLocations();
    var q = query.toLowerCase();
    return getLocations().filter(function (loc) {
      return loc.name.toLowerCase().indexOf(q) !== -1 || loc.country.toLowerCase().indexOf(q) !== -1;
    });
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.col-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.col-header{padding:16px 18px;border-bottom:1px solid #222;background:#151515}',
      '.col-title{margin:0;color:#e0e0e0;font-size:17px;font-weight:700}',
      '.col-subtitle{color:#666;font-size:12px;margin-top:2px}',
      '.col-empty{padding:20px;text-align:center;color:#666;font-size:13px}',
      '.col-tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid #222}',
      '@media(max-width:600px){.col-tiers{grid-template-columns:repeat(2,1fr)}}',
      '.col-tier{display:flex;border-right:1px solid #222;padding:14px;transition:background .2s}',
      '.col-tier:last-child{border-right:none}',
      '.col-tier-achieved{background:#ffffff08}',
      '.col-tier-color{width:3px;border-radius:2px;margin-right:10px;flex-shrink:0}',
      '.col-tier-body{flex:1}',
      '.col-tier-label{font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px}',
      '.col-tier-rate{font-size:20px;font-weight:700;margin:4px 0 2px}',
      '.col-tier-rate small{font-size:12px;font-weight:400;color:#666}',
      '.col-tier-desc{font-size:11px;color:#555;line-height:1.4}',
      '.col-assessment{background:#1a1a1a;margin:12px;border-radius:8px;padding:14px;border-left:3px solid}',
      '.col-assessment-header{display:flex;align-items:center;justify-content:space-between;font-size:14px;color:#ccc;margin-bottom:6px}',
      '.col-status-badge{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700}',
      '.col-assessment-msg{font-size:13px;color:#999;line-height:1.5}',
      '.col-breakdown{padding:14px 18px;border-bottom:1px solid #222}',
      '.col-breakdown-title{font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}',
      '.col-bd-item{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#999;border-bottom:1px solid #1a1a1a}',
      '.col-bd-item:last-child{border-bottom:none}',
      '.col-bd-highlight{color:#e0e0e0;font-weight:600;border-bottom-color:#333}',
      '.col-location-select{padding:14px 18px}',
      '.col-location-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;display:block}',
      '.col-select,.col-rate-input{width:100%;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:8px 10px;color:#e0e0e0;font-size:13px;outline:none;box-sizing:border-box;margin-bottom:10px}',
      '.col-select:focus,.col-rate-input:focus{border-color:#7c3aed}',
      '.col-rate-input-wrap{margin-top:10px}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.RateCOLAdjustment = {
    init: init,
    calculateMinimumRate: calculateMinimumRate,
    compareLocations: compareLocations,
    adjustRateForLocation: adjustRateForLocation,
    renderCOLCalculator: renderCOLCalculator,
    getLocations: getLocations,
    searchLocations: searchLocations,
    COL_DATA: COL_DATA,
    version: '1.0.0'
  };

})();
