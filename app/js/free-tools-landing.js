/**
 * CF-242: Free Tools Landing Pages — SEO-optimised standalone page generators.
 */
(function () {
  'use strict';

  var TOOLS = [
    {
      id: 'proposal-writer',
      name: 'Free AI Proposal Writer',
      slug: 'free-proposal-writer',
      headline: 'Write Winning Upwork Proposals in Seconds',
      subheadline: 'Our AI analyses the job post and generates a personalised, high-converting proposal tailored to each client.',
      metaTitle: 'Free AI Proposal Writer for Upwork | Cortex Freelancer',
      metaDescription: 'Generate personalised Upwork proposals that win jobs. Free AI-powered proposal writer — no signup required.',
      keywords: ['upwork proposal writer', 'freelance proposal generator', 'ai proposal writer', 'upwork cover letter'],
      features: [
        'Analyses job descriptions to identify key client needs',
        'Generates personalised opening hooks that grab attention',
        'Includes relevant experience matching and skill highlighting',
        'Optimises proposal length based on job complexity',
        'Multiple tone options: professional, friendly, or bold'
      ],
      faq: [
        { q: 'Is this proposal writer really free?', a: 'Yes — you can generate up to 3 proposals per day for free. No credit card required.' },
        { q: 'Will my proposals sound generic?', a: 'No. Our AI reads the specific job post and customises every proposal to the client\'s needs and your skills.' },
        { q: 'Does it work for platforms other than Upwork?', a: 'Yes. While optimised for Upwork, the proposals work great on Freelancer, Fiverr, and direct outreach too.' }
      ],
      ctaText: 'Write Your First Proposal Free',
      ctaLink: '/tools/proposal-generator'
    },
    {
      id: 'rate-calculator',
      name: 'Freelancer Rate Calculator',
      slug: 'free-rate-calculator',
      headline: 'Calculate Your Ideal Freelance Rate',
      subheadline: 'Factor in expenses, taxes, desired income, and market rates to find the perfect price for your services.',
      metaTitle: 'Free Freelancer Rate Calculator | Cortex Freelancer',
      metaDescription: 'Calculate your ideal freelance hourly rate based on expenses, goals, and market data. Free rate calculator for freelancers.',
      keywords: ['freelance rate calculator', 'hourly rate calculator', 'freelancer pricing', 'consulting rate calculator'],
      features: [
        'Bottom-up calculation from desired annual income',
        'Accounts for taxes, expenses, and non-billable time',
        'Market rate comparison by skill and experience level',
        'Hourly, daily, and project rate breakdowns',
        'Export results as a pricing reference sheet'
      ],
      faq: [
        { q: 'What data does the market comparison use?', a: 'We aggregate anonymised rate data from major freelance platforms to provide accurate market benchmarks.' },
        { q: 'Does it account for different countries?', a: 'Yes. You can set your location and currency, and we\'ll adjust tax rates and cost-of-living factors accordingly.' },
        { q: 'How often should I recalculate my rate?', a: 'We recommend quarterly reviews, or whenever your expenses, skills, or market conditions change significantly.' }
      ],
      ctaText: 'Calculate Your Rate Now',
      ctaLink: '/tools/rate-calculator'
    },
    {
      id: 'fee-calculator',
      name: 'Upwork Fee Calculator',
      slug: 'free-fee-calculator',
      headline: 'See Exactly What You\'ll Earn After Upwork Fees',
      subheadline: 'Calculate your net earnings on any Upwork contract after service fees, taxes, and withdrawal costs.',
      metaTitle: 'Free Upwork Fee Calculator | Cortex Freelancer',
      metaDescription: 'Calculate your take-home pay after Upwork fees. Free fee calculator shows net earnings for any contract size.',
      keywords: ['upwork fee calculator', 'upwork commission calculator', 'freelance fee calculator', 'upwork earnings calculator'],
      features: [
        'Accurate fee calculation using current Upwork rates',
        'Breakdown of service fees at each tier',
        'Net earnings comparison: hourly vs fixed-price',
        'Withdrawal fee estimates by payment method',
        'Annual earnings projection after all fees'
      ],
      faq: [
        { q: 'Are the fee tiers up to date?', a: 'Yes, we update our calculator whenever Upwork changes their fee structure.' },
        { q: 'Does it include payment processing fees?', a: 'Yes. We include withdrawal fees for all payment methods including PayPal, Payoneer, and direct deposit.' },
        { q: 'Can I compare different contract sizes?', a: 'Yes. Run multiple scenarios to see how your net earnings change with different contract values.' }
      ],
      ctaText: 'Calculate Your Fees',
      ctaLink: '/tools/fee-calculator'
    },
    {
      id: 'invoice-generator',
      name: 'Free Invoice Generator',
      slug: 'free-invoice-generator',
      headline: 'Create Professional Invoices in Under a Minute',
      subheadline: 'Generate branded, professional invoices with automatic calculations. Download as PDF — no signup needed.',
      metaTitle: 'Free Invoice Generator for Freelancers | Cortex Freelancer',
      metaDescription: 'Create professional freelance invoices instantly. Free invoice generator with PDF export — no signup required.',
      keywords: ['freelance invoice generator', 'free invoice maker', 'invoice template freelancer', 'online invoice creator'],
      features: [
        'Professional invoice template with your branding',
        'Automatic tax and total calculations',
        'Multi-currency support for international clients',
        'PDF export with one click',
        'Recurring invoice scheduling'
      ],
      faq: [
        { q: 'Can I add my logo?', a: 'Yes. Upload your logo and it will appear on every invoice you generate.' },
        { q: 'Does it support multiple currencies?', a: 'Yes. Choose from 50+ currencies with automatic formatting.' },
        { q: 'Can I save invoice templates?', a: 'Yes — create templates for recurring clients to save time on future invoices.' }
      ],
      ctaText: 'Create Your Invoice Free',
      ctaLink: '/tools/invoice-generator'
    },
    {
      id: 'bio-generator',
      name: 'AI Bio Generator for Freelancers',
      slug: 'free-bio-generator',
      headline: 'Generate a Standout Freelancer Bio in Seconds',
      subheadline: 'Our AI creates a compelling, keyword-optimised bio that attracts clients and ranks in Upwork search.',
      metaTitle: 'Free AI Bio Generator for Freelancers | Cortex Freelancer',
      metaDescription: 'Generate a professional freelancer bio optimised for Upwork search. Free AI bio generator — multiple tones available.',
      keywords: ['freelancer bio generator', 'upwork profile generator', 'freelance overview writer', 'ai bio writer'],
      features: [
        'AI-powered bio generation from your skills and experience',
        'SEO-optimised for Upwork search algorithm',
        'Multiple tone options: professional, friendly, bold',
        'Keyword injection for your target niche',
        'Before/after comparison with improvement tips'
      ],
      faq: [
        { q: 'How does the AI know what to write?', a: 'You input your skills, experience, and target niche. The AI combines this with proven bio frameworks that attract clients.' },
        { q: 'Will it sound like me?', a: 'Choose the tone that matches your personality. You can also edit the generated bio to add your personal touch.' },
        { q: 'Is it optimised for Upwork search?', a: 'Yes. We incorporate relevant keywords and phrases that help your profile appear in client searches.' }
      ],
      ctaText: 'Generate Your Bio Free',
      ctaLink: '/tools/bio-rewriter'
    }
  ];

  /**
   * Get all tool definitions.
   * @returns {object[]}
   */
  function getAllTools() {
    return TOOLS.slice();
  }

  /**
   * Get a tool by its slug.
   * @param {string} slug
   * @returns {object|null}
   */
  function getToolBySlug(slug) {
    for (var i = 0; i < TOOLS.length; i++) {
      if (TOOLS[i].slug === slug) return TOOLS[i];
    }
    return null;
  }

  /**
   * Generate meta tags HTML for a tool landing page.
   * @param {object} tool
   * @returns {string}
   */
  function generateMetaTags(tool) {
    return '<title>' + tool.metaTitle + '</title>\n' +
      '<meta name="description" content="' + tool.metaDescription + '">\n' +
      '<meta name="keywords" content="' + tool.keywords.join(', ') + '">\n' +
      '<meta property="og:title" content="' + tool.metaTitle + '">\n' +
      '<meta property="og:description" content="' + tool.metaDescription + '">\n' +
      '<meta property="og:type" content="website">\n' +
      '<link rel="canonical" href="https://cortexfreelancer.com/tools/' + tool.slug + '">';
  }

  /**
   * Generate structured data (JSON-LD) for a tool landing page.
   * @param {object} tool
   * @returns {string}
   */
  function generateStructuredData(tool) {
    var data = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: tool.name,
      description: tool.metaDescription,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: 'https://cortexfreelancer.com/tools/' + tool.slug
    };
    return '<script type="application/ld+json">' + JSON.stringify(data) + '</script>';
  }

  /**
   * Generate FAQ structured data for a tool.
   * @param {object} tool
   * @returns {string}
   */
  function generateFAQSchema(tool) {
    var faqData = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: tool.faq.map(function (item) {
        return {
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a }
        };
      })
    };
    return '<script type="application/ld+json">' + JSON.stringify(faqData) + '</script>';
  }

  /**
   * Render a full landing page HTML for a tool.
   * @param {object} tool
   * @returns {string}
   */
  function renderLandingPage(tool) {
    var featuresHTML = tool.features.map(function (f) {
      return '<li class="ftl-feature">' + f + '</li>';
    }).join('');

    var faqHTML = tool.faq.map(function (item) {
      return '<div class="ftl-faq__item">' +
        '<h3 class="ftl-faq__question">' + item.q + '</h3>' +
        '<p class="ftl-faq__answer">' + item.a + '</p>' +
        '</div>';
    }).join('');

    return '<div class="ftl-landing" data-tool="' + tool.id + '">' +
      '<section class="ftl-hero">' +
      '<h1 class="ftl-hero__title">' + tool.headline + '</h1>' +
      '<p class="ftl-hero__subtitle">' + tool.subheadline + '</p>' +
      '<a href="' + tool.ctaLink + '" class="ftl-hero__cta btn btn--primary">' + tool.ctaText + '</a>' +
      '</section>' +
      '<section class="ftl-features">' +
      '<h2>What You Get</h2>' +
      '<ul class="ftl-features__list">' + featuresHTML + '</ul>' +
      '</section>' +
      '<section class="ftl-faq">' +
      '<h2>Frequently Asked Questions</h2>' +
      faqHTML +
      '</section>' +
      '<section class="ftl-cta-bottom">' +
      '<h2>Ready to Get Started?</h2>' +
      '<a href="' + tool.ctaLink + '" class="btn btn--primary">' + tool.ctaText + '</a>' +
      '</section>' +
      '</div>';
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.FreeToolsLanding = {
    getAllTools: getAllTools,
    getToolBySlug: getToolBySlug,
    generateMetaTags: generateMetaTags,
    generateStructuredData: generateStructuredData,
    generateFAQSchema: generateFAQSchema,
    renderLandingPage: renderLandingPage
  };
})();
