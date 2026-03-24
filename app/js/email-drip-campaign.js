/**
 * CF-245: Email Drip Campaign — 5-email waitlist sequence configuration.
 */
(function () {
  'use strict';

  var API_ENDPOINT = '/api/email-drip';

  /**
   * Email sequence: Welcome → Value Props → Tool Spotlight → Social Proof → Launch Invite
   */
  var SEQUENCE = [
    {
      id: 'welcome',
      step: 1,
      delayDays: 0,
      subject: 'Welcome to Cortex Freelancer — You\'re on the List!',
      preheader: 'Here\'s what to expect and how to get early access.',
      category: 'onboarding',
      body: {
        greeting: 'Hey {{firstName}},',
        sections: [
          {
            type: 'text',
            content: 'Thanks for joining the Cortex Freelancer waitlist! You\'re now part of a community of freelancers who are ready to work smarter, not harder.'
          },
          {
            type: 'text',
            content: 'Cortex Freelancer is an AI-powered toolkit built specifically for Upwork and freelance professionals. We\'re putting the finishing touches on something special, and you\'ll be among the first to try it.'
          },
          {
            type: 'list',
            heading: 'Here\'s what\'s coming your way:',
            items: [
              'AI proposal writer that personalises every application',
              'Smart rate calculator based on real market data',
              'Client red flag detector to protect your time',
              'Earnings analytics and tax estimation tools'
            ]
          },
          {
            type: 'cta',
            text: 'Explore Our Free Tools Now',
            url: '{{baseUrl}}/tools',
            style: 'primary'
          }
        ],
        closing: 'Talk soon,\nThe Cortex Freelancer Team'
      }
    },
    {
      id: 'value-props',
      step: 2,
      delayDays: 3,
      subject: '3 Ways Cortex Freelancer Saves You 10+ Hours a Week',
      preheader: 'Stop doing manually what AI can do in seconds.',
      category: 'education',
      body: {
        greeting: 'Hey {{firstName}},',
        sections: [
          {
            type: 'text',
            content: 'Most freelancers spend 30-40% of their time on non-billable work: writing proposals, calculating rates, chasing invoices, and researching clients. That\'s 15-20 hours a week you\'re not getting paid for.'
          },
          {
            type: 'feature',
            heading: '1. Write proposals 10x faster',
            content: 'Our AI reads the job post, matches it to your skills, and generates a personalised proposal in under 30 seconds. Top-rated freelancers have seen their win rate jump 40%.'
          },
          {
            type: 'feature',
            heading: '2. Price with confidence',
            content: 'Stop guessing your rate. Our calculator factors in your expenses, taxes, market data, and desired income to find your ideal price point — for hourly and fixed-price work.'
          },
          {
            type: 'feature',
            heading: '3. Spot red flags before you commit',
            content: 'Our client analyser scans job posts and client history to flag potential issues: unrealistic expectations, low budgets, poor review patterns, and scope creep risks.'
          },
          {
            type: 'cta',
            text: 'Try the Free Proposal Writer',
            url: '{{baseUrl}}/tools/proposal-generator',
            style: 'primary'
          }
        ],
        closing: 'To your success,\nThe Cortex Freelancer Team'
      }
    },
    {
      id: 'tool-spotlight',
      step: 3,
      delayDays: 7,
      subject: 'Tool Spotlight: The AI Proposal Writer (Free to Try)',
      preheader: 'Generate your first winning proposal in 30 seconds.',
      category: 'product',
      body: {
        greeting: 'Hey {{firstName}},',
        sections: [
          {
            type: 'text',
            content: 'Today we\'re giving you early access to our most popular tool: the AI Proposal Writer. It\'s completely free, no signup required.'
          },
          {
            type: 'text',
            content: 'Here\'s how it works:'
          },
          {
            type: 'list',
            heading: '',
            items: [
              'Paste the Upwork job URL or description',
              'Add your relevant skills and experience',
              'Choose your tone: professional, friendly, or bold',
              'Get a personalised, ready-to-send proposal in seconds'
            ]
          },
          {
            type: 'text',
            content: 'Beta testers are reporting a 35% higher response rate compared to their manually written proposals. The AI doesn\'t just fill in a template — it analyses the job requirements and crafts a unique response every time.'
          },
          {
            type: 'cta',
            text: 'Write Your First Proposal Free',
            url: '{{baseUrl}}/tools/proposal-generator',
            style: 'primary'
          },
          {
            type: 'text',
            content: 'P.S. — Share the tool with a freelancer friend and move up our priority access list.'
          }
        ],
        closing: 'Happy freelancing,\nThe Cortex Freelancer Team'
      }
    },
    {
      id: 'social-proof',
      step: 4,
      delayDays: 12,
      subject: 'How Sarah Went from $25/hr to $85/hr Using Cortex Freelancer',
      preheader: 'Real stories from freelancers who transformed their business.',
      category: 'social-proof',
      body: {
        greeting: 'Hey {{firstName}},',
        sections: [
          {
            type: 'text',
            content: 'We wanted to share some results from freelancers already using Cortex Freelancer tools during our beta:'
          },
          {
            type: 'testimonial',
            quote: 'I was stuck at $25/hr for two years. The rate calculator showed me I was undercharging by 60%. After optimising my profile and proposals with Cortex, I\'m now consistently booking at $85/hr.',
            author: 'Sarah K., UX Designer',
            metric: '240% rate increase'
          },
          {
            type: 'testimonial',
            quote: 'The proposal writer alone saved me 8 hours a week. I used to spend 30 minutes per proposal — now it takes 3 minutes, and my win rate actually went up.',
            author: 'Marcus T., Full-Stack Developer',
            metric: '8 hrs/week saved'
          },
          {
            type: 'testimonial',
            quote: 'The client red flag detector saved me from a nightmare project. The warning signs were all there in the job post — I just didn\'t know what to look for.',
            author: 'Priya R., Content Strategist',
            metric: 'Avoided $0 project'
          },
          {
            type: 'stats',
            items: [
              { label: 'Waitlist signups', value: '{{waitlistCount}}' },
              { label: 'Proposals generated', value: '{{proposalsGenerated}}' },
              { label: 'Avg. win rate improvement', value: '35%' }
            ]
          },
          {
            type: 'cta',
            text: 'Join {{waitlistCount}} Freelancers on the Waitlist',
            url: '{{baseUrl}}/#waitlist',
            style: 'primary'
          }
        ],
        closing: 'See you inside,\nThe Cortex Freelancer Team'
      }
    },
    {
      id: 'launch-invite',
      step: 5,
      delayDays: 18,
      subject: '🚀 You\'re Invited: Cortex Freelancer is Live',
      preheader: 'Your early access is ready. Claim your spot now.',
      category: 'launch',
      body: {
        greeting: 'Hey {{firstName}},',
        sections: [
          {
            type: 'text',
            content: 'The wait is over. Cortex Freelancer is officially live, and as a waitlist member, you get priority access starting today.'
          },
          {
            type: 'text',
            content: 'Your exclusive early-bird offer:'
          },
          {
            type: 'list',
            heading: '',
            items: [
              '30-day free trial of all Pro features',
              '40% off your first 3 months (code: EARLYBIRD)',
              'Lifetime "Founding Member" badge on your profile',
              'Priority support during your trial'
            ]
          },
          {
            type: 'cta',
            text: 'Claim Your Early Access Now',
            url: '{{baseUrl}}/signup?code=EARLYBIRD&ref={{userId}}',
            style: 'primary'
          },
          {
            type: 'text',
            content: 'This offer expires in 72 hours and is only available to waitlist members. After that, standard pricing applies.'
          },
          {
            type: 'text',
            content: 'P.S. — Know a freelancer who could use this? Forward this email and they\'ll get 20% off too.'
          }
        ],
        closing: 'Let\'s go,\nThe Cortex Freelancer Team'
      }
    }
  ];

  /**
   * Get the full email sequence.
   * @returns {object[]}
   */
  function getSequence() {
    return SEQUENCE.slice();
  }

  /**
   * Get a specific email by step number (1-indexed).
   * @param {number} step
   * @returns {object|null}
   */
  function getByStep(step) {
    for (var i = 0; i < SEQUENCE.length; i++) {
      if (SEQUENCE[i].step === step) return SEQUENCE[i];
    }
    return null;
  }

  /**
   * Get a specific email by ID.
   * @param {string} id
   * @returns {object|null}
   */
  function getById(id) {
    for (var i = 0; i < SEQUENCE.length; i++) {
      if (SEQUENCE[i].id === id) return SEQUENCE[i];
    }
    return null;
  }

  /**
   * Render an email body to HTML with template variable substitution.
   * @param {object} email - Email object from the sequence
   * @param {object} vars - Template variables (firstName, baseUrl, userId, etc.)
   * @returns {string} HTML
   */
  function renderEmail(email, vars) {
    vars = vars || {};
    var body = email.body;
    var html = [];

    html.push('<div class="drip-email" data-step="' + email.step + '">');
    html.push('<p class="drip-email__greeting">' + replaceVars(body.greeting, vars) + '</p>');

    body.sections.forEach(function (section) {
      switch (section.type) {
        case 'text':
          html.push('<p>' + replaceVars(section.content, vars) + '</p>');
          break;
        case 'list':
          if (section.heading) html.push('<p><strong>' + replaceVars(section.heading, vars) + '</strong></p>');
          html.push('<ul>' + section.items.map(function (item) {
            return '<li>' + replaceVars(item, vars) + '</li>';
          }).join('') + '</ul>');
          break;
        case 'feature':
          html.push('<div class="drip-email__feature">');
          html.push('<h3>' + replaceVars(section.heading, vars) + '</h3>');
          html.push('<p>' + replaceVars(section.content, vars) + '</p>');
          html.push('</div>');
          break;
        case 'testimonial':
          html.push('<blockquote class="drip-email__testimonial">');
          html.push('<p>"' + replaceVars(section.quote, vars) + '"</p>');
          html.push('<cite>— ' + section.author + '</cite>');
          if (section.metric) html.push('<span class="drip-email__metric">' + section.metric + '</span>');
          html.push('</blockquote>');
          break;
        case 'stats':
          html.push('<div class="drip-email__stats">');
          section.items.forEach(function (stat) {
            html.push('<div class="drip-email__stat"><span class="drip-email__stat-value">' +
              replaceVars(stat.value, vars) + '</span><span class="drip-email__stat-label">' +
              stat.label + '</span></div>');
          });
          html.push('</div>');
          break;
        case 'cta':
          html.push('<div class="drip-email__cta">');
          html.push('<a href="' + replaceVars(section.url, vars) + '" class="btn btn--' +
            (section.style || 'primary') + '">' + replaceVars(section.text, vars) + '</a>');
          html.push('</div>');
          break;
      }
    });

    html.push('<p class="drip-email__closing">' + replaceVars(body.closing, vars).replace(/\n/g, '<br>') + '</p>');
    html.push('</div>');

    return html.join('\n');
  }

  /**
   * Replace template variables in a string.
   * @param {string} str
   * @param {object} vars
   * @returns {string}
   */
  function replaceVars(str, vars) {
    if (!str) return '';
    return str.replace(/\{\{(\w+)\}\}/g, function (match, key) {
      return vars[key] !== undefined ? vars[key] : match;
    });
  }

  /**
   * Schedule an email for a subscriber via API.
   * @param {object} params
   * @param {string} params.email - Subscriber email
   * @param {number} params.step - Email step to schedule
   * @param {object} [params.vars] - Template variables
   * @returns {Promise<object>}
   */
  async function scheduleEmail(params) {
    var emailConfig = getByStep(params.step);
    if (!emailConfig) return { success: false, error: 'Invalid step' };

    try {
      var res = await fetch(API_ENDPOINT + '/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          step: params.step,
          emailId: emailConfig.id,
          delayDays: emailConfig.delayDays,
          subject: replaceVars(emailConfig.subject, params.vars || {}),
          vars: params.vars || {}
        })
      });
      if (res.ok) return await res.json();
    } catch (_err) {
      // Fail silently
    }
    return { success: false };
  }

  /**
   * Enrol a new subscriber into the full drip sequence.
   * @param {string} email
   * @param {object} [vars] - Template variables
   * @returns {Promise<object>}
   */
  async function enrolSubscriber(email, vars) {
    try {
      var res = await fetch(API_ENDPOINT + '/enrol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, vars: vars || {}, sequenceLength: SEQUENCE.length })
      });
      if (res.ok) return await res.json();
    } catch (_err) {
      // Fail silently
    }
    return { success: false };
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmailDripCampaign = {
    getSequence: getSequence,
    getByStep: getByStep,
    getById: getById,
    renderEmail: renderEmail,
    scheduleEmail: scheduleEmail,
    enrolSubscriber: enrolSubscriber
  };
})();
