/**
 * [CF-012] Hourly Rate Benchmarking by Category and Region
 * Hardcoded dataset of rate ranges per category × region.
 * Exposed as window.CortexFreelancer.RateBenchmark
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ───────── Rate data: [low, p25, median, p75, high] in USD/hr ───────── */

  var RATES = {
    'Web Dev': {
      US:   [35, 55, 75, 110, 150],
      EU:   [25, 40, 60, 90, 130],
      UK:   [30, 50, 70, 100, 140],
      TR:   [8, 15, 25, 40, 65],
      EG:   [6, 12, 20, 35, 55],
      PK:   [5, 10, 18, 30, 50],
      NG:   [5, 10, 18, 30, 50],
      IN:   [5, 12, 22, 38, 60],
      PH:   [5, 10, 18, 30, 50],
      LatAm:[10, 20, 35, 55, 80],
    },
    'Mobile': {
      US:   [40, 60, 85, 120, 160],
      EU:   [30, 45, 65, 95, 135],
      UK:   [35, 55, 75, 110, 150],
      TR:   [10, 18, 30, 50, 75],
      EG:   [8, 15, 25, 40, 60],
      PK:   [6, 12, 22, 35, 55],
      NG:   [6, 12, 20, 35, 55],
      IN:   [7, 15, 25, 42, 65],
      PH:   [6, 12, 20, 35, 55],
      LatAm:[12, 22, 38, 60, 90],
    },
    'Design': {
      US:   [25, 40, 60, 90, 130],
      EU:   [20, 35, 50, 75, 110],
      UK:   [25, 40, 55, 85, 120],
      TR:   [6, 12, 20, 35, 55],
      EG:   [5, 10, 18, 30, 45],
      PK:   [4, 8, 15, 25, 40],
      NG:   [4, 8, 15, 25, 40],
      IN:   [5, 10, 18, 30, 50],
      PH:   [4, 8, 15, 25, 40],
      LatAm:[8, 15, 28, 45, 70],
    },
    'Writing': {
      US:   [20, 35, 50, 75, 110],
      EU:   [15, 28, 40, 60, 90],
      UK:   [20, 32, 45, 70, 100],
      TR:   [5, 8, 15, 25, 40],
      EG:   [4, 7, 12, 20, 35],
      PK:   [3, 6, 10, 18, 30],
      NG:   [3, 6, 10, 18, 30],
      IN:   [4, 8, 15, 25, 40],
      PH:   [3, 6, 10, 18, 30],
      LatAm:[6, 12, 22, 35, 55],
    },
    'Marketing': {
      US:   [25, 40, 60, 90, 130],
      EU:   [20, 32, 48, 72, 105],
      UK:   [22, 38, 55, 82, 120],
      TR:   [6, 10, 18, 30, 50],
      EG:   [5, 8, 15, 25, 40],
      PK:   [4, 7, 12, 22, 35],
      NG:   [4, 7, 12, 22, 35],
      IN:   [5, 10, 18, 30, 48],
      PH:   [4, 8, 14, 24, 38],
      LatAm:[8, 15, 25, 42, 65],
    },
    'Data Science': {
      US:   [45, 70, 95, 130, 175],
      EU:   [35, 55, 75, 105, 145],
      UK:   [40, 60, 85, 120, 160],
      TR:   [12, 22, 35, 55, 80],
      EG:   [8, 16, 28, 45, 65],
      PK:   [7, 14, 24, 40, 60],
      NG:   [7, 14, 22, 38, 58],
      IN:   [8, 18, 30, 50, 75],
      PH:   [7, 14, 24, 40, 60],
      LatAm:[15, 28, 45, 68, 100],
    },
    'DevOps': {
      US:   [45, 65, 90, 125, 170],
      EU:   [35, 50, 70, 100, 140],
      UK:   [40, 58, 80, 115, 155],
      TR:   [12, 20, 32, 50, 75],
      EG:   [8, 15, 25, 42, 62],
      PK:   [7, 12, 22, 38, 55],
      NG:   [7, 12, 20, 35, 55],
      IN:   [8, 16, 28, 48, 70],
      PH:   [7, 12, 22, 38, 55],
      LatAm:[15, 25, 40, 62, 95],
    },
    'QA': {
      US:   [25, 38, 55, 80, 110],
      EU:   [18, 30, 42, 62, 90],
      UK:   [22, 35, 48, 72, 100],
      TR:   [6, 10, 18, 28, 45],
      EG:   [5, 8, 15, 24, 38],
      PK:   [4, 7, 12, 20, 32],
      NG:   [4, 7, 12, 20, 32],
      IN:   [5, 10, 16, 28, 42],
      PH:   [4, 8, 14, 22, 35],
      LatAm:[8, 15, 25, 40, 60],
    },
    'PM': {
      US:   [35, 55, 75, 105, 145],
      EU:   [28, 42, 60, 85, 120],
      UK:   [32, 48, 68, 95, 130],
      TR:   [8, 15, 25, 40, 60],
      EG:   [6, 12, 20, 32, 50],
      PK:   [5, 10, 16, 28, 42],
      NG:   [5, 10, 16, 28, 42],
      IN:   [6, 12, 22, 35, 55],
      PH:   [5, 10, 18, 28, 45],
      LatAm:[10, 20, 32, 50, 75],
    },
    'Consulting': {
      US:   [50, 80, 115, 160, 225],
      EU:   [40, 60, 90, 130, 180],
      UK:   [45, 70, 100, 145, 200],
      TR:   [12, 22, 35, 55, 85],
      EG:   [8, 16, 28, 45, 68],
      PK:   [7, 12, 22, 38, 58],
      NG:   [7, 12, 20, 35, 55],
      IN:   [8, 18, 30, 50, 78],
      PH:   [7, 14, 24, 40, 60],
      LatAm:[15, 30, 48, 72, 110],
    },
  };

  /** Category aliases for flexible lookup */
  var CATEGORY_ALIASES = {
    'web dev':            'Web Dev',
    'web development':    'Web Dev',
    'frontend':           'Web Dev',
    'backend':            'Web Dev',
    'full stack':         'Web Dev',
    'fullstack':          'Web Dev',
    'mobile':             'Mobile',
    'mobile development': 'Mobile',
    'ios':                'Mobile',
    'android':            'Mobile',
    'react native':       'Mobile',
    'flutter':            'Mobile',
    'design':             'Design',
    'ui/ux':              'Design',
    'graphic design':     'Design',
    'ux design':          'Design',
    'ui design':          'Design',
    'writing':            'Writing',
    'copywriting':        'Writing',
    'content writing':    'Writing',
    'technical writing':  'Writing',
    'marketing':          'Marketing',
    'digital marketing':  'Marketing',
    'seo':                'Marketing',
    'social media':       'Marketing',
    'data science':       'Data Science',
    'machine learning':   'Data Science',
    'ai':                 'Data Science',
    'data analytics':     'Data Science',
    'devops':             'DevOps',
    'cloud':              'DevOps',
    'sre':                'DevOps',
    'infrastructure':     'DevOps',
    'qa':                 'QA',
    'testing':            'QA',
    'quality assurance':  'QA',
    'pm':                 'PM',
    'project management': 'PM',
    'product management': 'PM',
    'scrum master':       'PM',
    'consulting':         'Consulting',
    'strategy':           'Consulting',
    'advisory':           'Consulting',
  };

  /** Country aliases */
  var COUNTRY_ALIASES = {
    'united states': 'US', 'usa': 'US', 'us': 'US',
    'europe': 'EU', 'eu': 'EU', 'germany': 'EU', 'france': 'EU', 'netherlands': 'EU', 'spain': 'EU',
    'united kingdom': 'UK', 'uk': 'UK', 'england': 'UK',
    'turkey': 'TR', 'tr': 'TR', 'türkiye': 'TR',
    'egypt': 'EG', 'eg': 'EG',
    'pakistan': 'PK', 'pk': 'PK',
    'nigeria': 'NG', 'ng': 'NG',
    'india': 'IN', 'in': 'IN',
    'philippines': 'PH', 'ph': 'PH',
    'latam': 'LatAm', 'latin america': 'LatAm', 'brazil': 'LatAm', 'mexico': 'LatAm',
    'argentina': 'LatAm', 'colombia': 'LatAm',
  };

  /**
   * Resolve category string to canonical key.
   * @param {string} category
   * @returns {string|null}
   */
  function resolveCategory(category) {
    if (!category) return null;
    var key = category.trim();
    if (RATES[key]) return key;
    var alias = CATEGORY_ALIASES[key.toLowerCase()];
    return alias || null;
  }

  /**
   * Resolve country string to canonical code.
   * @param {string} country
   * @returns {string|null}
   */
  function resolveCountry(country) {
    if (!country) return null;
    var key = country.trim();
    var upper = key.toUpperCase();
    // Direct code match
    var cats = Object.keys(RATES);
    if (cats.length > 0) {
      var sample = RATES[cats[0]];
      if (sample[upper]) return upper;
      if (sample[key]) return key;
    }
    var alias = COUNTRY_ALIASES[key.toLowerCase()];
    return alias || null;
  }

  /**
   * Get rate benchmark for a category and country.
   * @param {string} category - e.g. "Web Dev", "mobile development", "design"
   * @param {string} country - e.g. "US", "Turkey", "IN"
   * @returns {{low: number, percentile25: number, median: number, percentile75: number, high: number, category: string, country: string}|null}
   */
  function getRateBenchmark(category, country) {
    var cat = resolveCategory(category);
    var cty = resolveCountry(country);
    if (!cat || !cty) return null;
    var data = RATES[cat] && RATES[cat][cty];
    if (!data) return null;
    return {
      low: data[0],
      percentile25: data[1],
      median: data[2],
      percentile75: data[3],
      high: data[4],
      category: cat,
      country: cty,
    };
  }

  /**
   * Determine where a freelancer's rate falls relative to the market.
   * @param {number} rate - Freelancer's hourly rate in USD
   * @param {string} category
   * @param {string} country
   * @returns {{percentile: number, label: string, benchmark: object}|null}
   */
  function getUserRatePosition(rate, category, country) {
    var bm = getRateBenchmark(category, country);
    if (!bm) return null;
    rate = parseFloat(rate) || 0;

    // Linear interpolation between known percentile points
    var points = [
      { pct: 0,   val: bm.low },
      { pct: 25,  val: bm.percentile25 },
      { pct: 50,  val: bm.median },
      { pct: 75,  val: bm.percentile75 },
      { pct: 100, val: bm.high },
    ];

    var percentile;
    if (rate <= points[0].val) {
      percentile = 0;
    } else if (rate >= points[4].val) {
      percentile = 100;
    } else {
      for (var i = 0; i < points.length - 1; i++) {
        if (rate >= points[i].val && rate <= points[i + 1].val) {
          var range = points[i + 1].val - points[i].val;
          var pctRange = points[i + 1].pct - points[i].pct;
          percentile = range > 0
            ? points[i].pct + ((rate - points[i].val) / range) * pctRange
            : points[i].pct;
          break;
        }
      }
    }

    percentile = Math.round(percentile);

    var label;
    if (percentile >= 75) label = 'Premium';
    else if (percentile >= 50) label = 'Above average';
    else if (percentile >= 25) label = 'Average';
    else label = 'Below market';

    return { percentile: percentile, label: label, benchmark: bm };
  }

  /* ───────── Public API ───────── */

  window.CortexFreelancer.RateBenchmark = {
    getRateBenchmark: getRateBenchmark,
    getUserRatePosition: getUserRatePosition,
    categories: Object.keys(RATES),
    regions: ['US', 'EU', 'UK', 'TR', 'EG', 'PK', 'NG', 'IN', 'PH', 'LatAm'],
    version: '1.0.0',
  };
})();
