/**
 * CF-238: Structured Data (JSON-LD) for SaaS Product
 *
 * Injects SoftwareApplication schema markup on the landing page
 * for rich search results. Includes pricing, ratings, and features.
 */
window.CortexFreelancer = window.CortexFreelancer || {};

(function () {
  'use strict';

  var SCRIPT_ID = 'cf-structured-data-jsonld';

  var DEFAULT_SCHEMA = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Cortex Freelancer',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'AI-powered analytics and productivity tools for Upwork freelancers. Optimize your profile, track earnings, benchmark rates, and win more clients.',
    url: window.location.origin,
    image: window.location.origin + '/assets/og-default.png',
    author: {
      '@type': 'Organization',
      name: 'Cortex Freelancer',
      url: window.location.origin
    },
    offers: [
      {
        '@type': 'Offer',
        name: 'Free',
        price: '0',
        priceCurrency: 'USD',
        description: 'Core tools with limited usage'
      },
      {
        '@type': 'Offer',
        name: 'Pro Monthly',
        price: '19',
        priceCurrency: 'USD',
        description: 'Full access to all tools, priority support',
        priceValidUntil: '2026-12-31'
      },
      {
        '@type': 'Offer',
        name: 'Pro Annual',
        price: '182.40',
        priceCurrency: 'USD',
        description: 'Annual billing — save 20%',
        priceValidUntil: '2026-12-31'
      }
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '1247',
      bestRating: '5',
      worstRating: '1'
    },
    featureList: [
      'Profile Scoring & Optimization',
      'AI Proposal Analyzer',
      'Rate Benchmarking',
      'Earnings Dashboard & Projections',
      'Client CRM & Red Flag Detection',
      'Tax Estimation & Invoice Generation',
      'Job Match Scoring',
      'Competition Analysis'
    ]
  };

  function injectScript(schema) {
    // Remove existing
    var existing = document.getElementById(SCRIPT_ID);
    if (existing) existing.remove();

    var script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema, null, 2);
    document.head.appendChild(script);
  }

  /**
   * Inject structured data.
   * @param {Object} [overrides] - Merge into default schema
   */
  function inject(overrides) {
    var schema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
    if (overrides) {
      Object.keys(overrides).forEach(function (key) {
        schema[key] = overrides[key];
      });
    }
    injectScript(schema);
    return schema;
  }

  /**
   * Inject Organization schema alongside the SoftwareApplication.
   */
  function injectOrganization() {
    var orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Cortex Freelancer',
      url: window.location.origin,
      logo: window.location.origin + '/assets/logo.png',
      sameAs: [],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@cortexfreelancer.com'
      }
    };

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.className = 'cf-structured-data-org';
    script.textContent = JSON.stringify(orgSchema, null, 2);
    document.head.appendChild(script);
    return orgSchema;
  }

  /**
   * Inject FAQ structured data (pairs with CF-235 FAQSection).
   * @param {Array} faqs - Array of {q, a} objects
   */
  function injectFAQ(faqs) {
    var faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(function (faq) {
        return {
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a
          }
        };
      })
    };

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.className = 'cf-structured-data-faq';
    script.textContent = JSON.stringify(faqSchema, null, 2);
    document.head.appendChild(script);
    return faqSchema;
  }

  /** Remove all injected structured data */
  function removeAll() {
    var scripts = document.querySelectorAll('#' + SCRIPT_ID + ', .cf-structured-data-org, .cf-structured-data-faq');
    scripts.forEach(function (s) { s.remove(); });
  }

  // ── Public API ──────────────────────────────────────────────────────
  window.CortexFreelancer.StructuredData = {
    inject: inject,
    injectOrganization: injectOrganization,
    injectFAQ: injectFAQ,
    removeAll: removeAll,
    getDefaultSchema: function () { return JSON.parse(JSON.stringify(DEFAULT_SCHEMA)); }
  };
})();
