// CF-242: Free Tools SEO Landing Pages
(function() {
  'use strict';

  var TOOL_PAGES = {
    'proposal-writer': {
      id: 'proposal-writer',
      slug: 'proposal-writer',
      h1: 'Free AI Upwork Proposal Writer — Win More Clients Instantly',
      metaTitle: 'Free AI Proposal Writer for Upwork | Cortex Freelancer',
      metaDescription: 'Generate winning Upwork proposals in seconds with our free AI proposal writer. Personalized, professional proposals that get you hired. No signup required.',
      keywords: ['upwork proposal writer', 'ai proposal generator', 'freelance proposal tool', 'upwork proposal template', 'free proposal writer'],
      heroSubtitle: 'Craft personalized, high-converting Upwork proposals in seconds. Powered by AI, tailored to every job post.',
      features: [
        { title: 'AI-Powered Personalization', description: 'Analyzes the job post and generates a unique proposal that addresses the client\'s specific needs and pain points.' },
        { title: 'Proven Templates', description: 'Built on proposal structures that have won thousands of contracts across 50+ categories on Upwork.' },
        { title: 'Tone Customization', description: 'Adjust your proposal tone from formal to conversational to match the client\'s communication style.' },
        { title: 'Portfolio Integration', description: 'Automatically weaves your relevant experience and portfolio pieces into each proposal.' },
        { title: 'One-Click Copy', description: 'Copy your finished proposal with a single click, ready to paste directly into Upwork.' }
      ],
      benefits: [
        'Save 15+ minutes per proposal',
        'Increase your response rate by up to 3x',
        'Apply to more jobs without sacrificing quality',
        'Stand out from generic copy-paste proposals',
        'Never stare at a blank proposal screen again'
      ],
      cta: { text: 'Write Your First Proposal Free', url: '/tools/proposal-writer' },
      faq: [
        { q: 'Is the proposal writer really free?', a: 'Yes, you can generate proposals for free. No credit card or signup required.' },
        { q: 'Will my proposals sound generic?', a: 'No. The AI analyzes each job post individually and generates unique, personalized proposals every time.' },
        { q: 'Can I customize the output?', a: 'Absolutely. You can adjust tone, length, and emphasis areas before generating. You can also edit the result.' }
      ]
    },
    'rate-calculator': {
      id: 'rate-calculator',
      slug: 'rate-calculator',
      h1: 'Free Freelance Rate Calculator — Know Your True Hourly Rate',
      metaTitle: 'Free Freelance Rate Calculator | Cortex Freelancer',
      metaDescription: 'Calculate your ideal freelance hourly rate with our free calculator. Factors in taxes, Upwork fees, expenses, and desired income for accurate pricing.',
      keywords: ['freelance rate calculator', 'hourly rate calculator', 'upwork rate calculator', 'freelancer pricing tool', 'calculate freelance rate'],
      heroSubtitle: 'Stop guessing your rate. Calculate exactly what to charge based on your income goals, expenses, taxes, and Upwork fees.',
      features: [
        { title: 'Tax-Aware Calculations', description: 'Automatically factors in self-employment taxes so your rate covers what you actually owe.' },
        { title: 'Upwork Fee Integration', description: 'Accounts for Upwork\'s sliding fee structure (20%/10%/5%) based on your client relationships.' },
        { title: 'Expense Tracking', description: 'Include business expenses like software, equipment, and insurance in your rate calculation.' },
        { title: 'Market Comparison', description: 'See how your calculated rate compares to market rates for your skill and experience level.' },
        { title: 'Multiple Scenarios', description: 'Model different scenarios — full-time, part-time, project-based — to find your optimal pricing.' }
      ],
      benefits: [
        'Never undercharge for your work again',
        'Account for hidden costs most freelancers miss',
        'Confidently negotiate rates with clients',
        'Plan your income and financial goals accurately',
        'Understand the true impact of Upwork fees on your earnings'
      ],
      cta: { text: 'Calculate Your Rate Now', url: '/tools/rate-calculator' },
      faq: [
        { q: 'How does the calculator account for Upwork fees?', a: 'It applies Upwork\'s tiered fee structure (20%/10%/5%) based on your estimated billing per client to calculate your true take-home rate.' },
        { q: 'Does it work for non-US freelancers?', a: 'Yes. You can input your local tax rate and currency. The calculation principles apply globally.' },
        { q: 'Should I charge hourly or fixed-price?', a: 'The calculator helps with both. It shows your minimum hourly rate, which you can use to estimate fixed-price quotes based on time estimates.' }
      ]
    },
    'fee-calculator': {
      id: 'fee-calculator',
      slug: 'fee-calculator',
      h1: 'Free Upwork Fee Calculator — See Your Exact Take-Home Pay',
      metaTitle: 'Free Upwork Fee Calculator | Cortex Freelancer',
      metaDescription: 'Calculate your exact Upwork take-home pay with our free fee calculator. See how Upwork\'s 20%/10%/5% fee tiers affect your earnings on any project.',
      keywords: ['upwork fee calculator', 'upwork commission calculator', 'upwork service fee', 'upwork take home pay', 'upwork fees breakdown'],
      heroSubtitle: 'Instantly see what you\'ll actually earn on any Upwork project after fees. No surprises, no hidden costs.',
      features: [
        { title: 'Tiered Fee Breakdown', description: 'See exactly how Upwork\'s 20%/10%/5% sliding fee structure applies to your specific project amount.' },
        { title: 'Client History Tracking', description: 'Input your existing billing history with a client to calculate fees at your current tier.' },
        { title: 'Comparison View', description: 'Compare take-home amounts across different project sizes to optimize your bidding strategy.' },
        { title: 'Currency Support', description: 'Calculate fees in your local currency with real-time conversion rates.' },
        { title: 'Payment Method Fees', description: 'Factor in withdrawal fees for PayPal, bank transfer, Payoneer, and other methods.' }
      ],
      benefits: [
        'Know your exact earnings before you bid',
        'Price projects to hit your income targets',
        'Understand how long-term clients save you money',
        'Compare Upwork fees to other platforms',
        'Make smarter decisions about which projects to pursue'
      ],
      cta: { text: 'Calculate Your Fees Now', url: '/tools/fee-calculator' },
      faq: [
        { q: 'How does Upwork\'s fee structure work?', a: 'Upwork charges 20% on the first $500 with each client, 10% on $500-$10,000, and 5% over $10,000. Our calculator applies these tiers automatically.' },
        { q: 'Are payment processing fees included?', a: 'Yes. You can select your withdrawal method to see the total fees including payment processing.' },
        { q: 'Does the calculator update with Upwork fee changes?', a: 'We keep the calculator updated with the latest Upwork fee structure.' }
      ]
    },
    'invoice-generator': {
      id: 'invoice-generator',
      slug: 'invoice-generator',
      h1: 'Free Freelance Invoice Generator — Professional Invoices in Seconds',
      metaTitle: 'Free Invoice Generator for Freelancers | Cortex Freelancer',
      metaDescription: 'Create professional freelance invoices in seconds with our free generator. Customizable templates, automatic calculations, and PDF export. No signup needed.',
      keywords: ['freelance invoice generator', 'free invoice maker', 'invoice template freelancer', 'create invoice online', 'freelancer billing tool'],
      heroSubtitle: 'Generate clean, professional invoices in 30 seconds. Add your details, customize the template, and download as PDF.',
      features: [
        { title: 'Professional Templates', description: 'Choose from multiple invoice templates designed specifically for freelancers and consultants.' },
        { title: 'Auto-Calculations', description: 'Automatically calculates subtotals, taxes, discounts, and grand totals. No spreadsheet needed.' },
        { title: 'PDF Export', description: 'Download your invoice as a print-ready PDF with one click. Attach it to any email.' },
        { title: 'Client Management', description: 'Save client details for faster invoicing on repeat projects. Build your client database.' },
        { title: 'Payment Terms', description: 'Set custom payment terms, late fees, and accepted payment methods on every invoice.' }
      ],
      benefits: [
        'Look professional without expensive invoicing software',
        'Get paid faster with clear, well-structured invoices',
        'Track invoice history and payment status',
        'Save time with reusable client and service templates',
        'Include all legally required invoice elements automatically'
      ],
      cta: { text: 'Create Your First Invoice Free', url: '/tools/invoice-generator' },
      faq: [
        { q: 'Can I add my logo to invoices?', a: 'Yes. Upload your logo and it will appear on all your invoices for a professional, branded look.' },
        { q: 'Is this a replacement for accounting software?', a: 'It\'s perfect for generating and tracking invoices. For full accounting, we recommend pairing it with dedicated accounting software.' },
        { q: 'Can I send invoices directly from the tool?', a: 'You can download the PDF and attach it to your email or message. Direct sending is coming soon.' }
      ]
    },
    'bio-generator': {
      id: 'bio-generator',
      slug: 'bio-generator',
      h1: 'Free Upwork Bio Generator — Stand Out With an AI-Written Profile',
      metaTitle: 'Free Upwork Bio Generator | Cortex Freelancer',
      metaDescription: 'Generate a professional Upwork bio that attracts clients with our free AI bio generator. Optimized for Upwork search, tailored to your skills and niche.',
      keywords: ['upwork bio generator', 'upwork profile writer', 'freelance bio generator', 'upwork overview generator', 'freelancer profile tool'],
      heroSubtitle: 'Get a compelling, keyword-optimized Upwork profile bio written by AI in seconds. Tailored to your skills, experience, and target clients.',
      features: [
        { title: 'Niche-Specific Bios', description: 'Generates bios tailored to your specific freelance niche, speaking directly to your ideal clients.' },
        { title: 'Keyword Optimization', description: 'Includes relevant keywords that help your profile appear in Upwork search results.' },
        { title: 'Multiple Variations', description: 'Generate 3 different bio versions and choose the one that fits your style best.' },
        { title: 'Tone Selection', description: 'Choose between professional, friendly, or authoritative tones to match your personal brand.' },
        { title: 'Instant Results', description: 'Get your optimized bio in under 10 seconds. Copy, paste into Upwork, and start attracting clients.' }
      ],
      benefits: [
        'Stop struggling with what to write about yourself',
        'Get found more often in Upwork search results',
        'Make a strong first impression on every client who views your profile',
        'Highlight your strengths in the most compelling way',
        'Update your bio in minutes instead of hours'
      ],
      cta: { text: 'Generate Your Bio Free', url: '/tools/bio-generator' },
      faq: [
        { q: 'Will the bio sound robotic or generic?', a: 'No. The AI generates natural, human-sounding bios based on your specific input. Each bio is unique to your experience.' },
        { q: 'Can I edit the generated bio?', a: 'Absolutely. The generated bio is a starting point. Edit, rearrange, and personalize it to make it yours.' },
        { q: 'How long should my Upwork bio be?', a: 'We recommend 200-400 words. Long enough to showcase your value, short enough to hold attention.' }
      ]
    }
  };

  var ToolLandingPages = {
    pages: TOOL_PAGES,

    getAll: function() {
      return Object.values(this.pages);
    },

    getBySlug: function(slug) {
      return this.pages[slug] || null;
    },

    generateMetaTags: function(slug) {
      var page = this.pages[slug];
      if (!page) return null;

      return {
        title: page.metaTitle,
        description: page.metaDescription,
        keywords: page.keywords.join(', '),
        ogTitle: page.h1,
        ogDescription: page.metaDescription,
        ogType: 'website',
        canonicalUrl: '/tools/' + page.slug
      };
    },

    renderPage: function(slug) {
      var page = this.pages[slug];
      if (!page) return '';

      var hero = '<section class="tool-hero">' +
        '<h1>' + page.h1 + '</h1>' +
        '<p class="tool-hero-subtitle">' + page.heroSubtitle + '</p>' +
        '<a href="' + page.cta.url + '" class="tool-cta-btn">' + page.cta.text + '</a>' +
        '</section>';

      var features = '<section class="tool-features"><h2>Features</h2><div class="features-grid">' +
        page.features.map(function(f) {
          return '<div class="feature-card">' +
            '<h3>' + f.title + '</h3>' +
            '<p>' + f.description + '</p>' +
            '</div>';
        }).join('') +
        '</div></section>';

      var benefits = '<section class="tool-benefits"><h2>Why Use Our ' + page.h1.split('—')[0].trim() + '?</h2><ul>' +
        page.benefits.map(function(b) {
          return '<li>' + b + '</li>';
        }).join('') +
        '</ul></section>';

      var faq = '<section class="tool-faq"><h2>Frequently Asked Questions</h2>' +
        page.faq.map(function(item) {
          return '<div class="faq-item">' +
            '<h3>' + item.q + '</h3>' +
            '<p>' + item.a + '</p>' +
            '</div>';
        }).join('') +
        '</section>';

      var ctaBottom = '<section class="tool-cta-bottom">' +
        '<h2>Ready to Get Started?</h2>' +
        '<a href="' + page.cta.url + '" class="tool-cta-btn">' + page.cta.text + '</a>' +
        '</section>';

      return '<div class="tool-landing-page" data-tool="' + slug + '">' +
        hero + features + benefits + faq + ctaBottom +
        '</div>';
    },

    renderToolIndex: function() {
      var pages = this.getAll();
      var cards = pages.map(function(page) {
        return '<div class="tool-index-card">' +
          '<h2><a href="/tools/' + page.slug + '">' + page.h1.split('—')[0].trim() + '</a></h2>' +
          '<p>' + page.metaDescription + '</p>' +
          '<a href="/tools/' + page.slug + '" class="tool-index-link">Try it free</a>' +
          '</div>';
      }).join('');

      return '<div class="tool-index">' +
        '<h1>Free Freelancer Tools</h1>' +
        '<p>Powerful, free tools to grow your freelance business</p>' +
        '<div class="tool-index-grid">' + cards + '</div>' +
        '</div>';
    },

    generateStructuredData: function(slug) {
      var page = this.pages[slug];
      if (!page) return null;

      return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: page.h1.split('—')[0].trim(),
        description: page.metaDescription,
        applicationCategory: 'BusinessApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        },
        operatingSystem: 'Web',
        url: 'https://cortexfreelancer.com/tools/' + page.slug
      };
    }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.ToolLandingPages = ToolLandingPages;
})();
