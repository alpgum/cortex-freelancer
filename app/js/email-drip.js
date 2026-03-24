// CF-245: Email Drip Campaign for Waitlist (5 Emails)
(function() {
  'use strict';

  var DRIP_SCHEDULE = [
    { day: 0, id: 'welcome' },
    { day: 2, id: 'value-props' },
    { day: 5, id: 'tool-spotlight' },
    { day: 8, id: 'social-proof' },
    { day: 12, id: 'launch-invite' }
  ];

  var EMAIL_TEMPLATES = {
    'welcome': {
      subject: 'Welcome to Cortex Freelancer — You\'re on the list!',
      preheader: 'You\'re one step closer to smarter freelancing.',
      body: function(data) {
        return '<h1>Welcome aboard, ' + (data.firstName || 'there') + '!</h1>' +
          '<p>Thanks for joining the Cortex Freelancer waitlist. You\'re now part of a growing community of freelancers who want to work smarter on Upwork.</p>' +
          '<h2>What is Cortex Freelancer?</h2>' +
          '<p>Cortex Freelancer is an AI-powered toolkit designed specifically for Upwork freelancers. We\'re building tools that help you:</p>' +
          '<ul>' +
            '<li><strong>Write winning proposals</strong> in seconds, not hours</li>' +
            '<li><strong>Price your services correctly</strong> with our rate calculator</li>' +
            '<li><strong>Understand Upwork fees</strong> so you keep more of what you earn</li>' +
            '<li><strong>Create professional invoices</strong> and bios instantly</li>' +
          '</ul>' +
          '<p>We\'ll keep you updated as we get closer to launch. In the meantime, reply to this email and tell us: what\'s the hardest part of freelancing on Upwork for you?</p>' +
          '<p>We read every reply.</p>' +
          '<p>— The Cortex Freelancer Team</p>';
      }
    },
    'value-props': {
      subject: 'The 3 biggest time wasters for Upwork freelancers',
      preheader: 'And how AI can eliminate them.',
      body: function(data) {
        return '<h1>Stop wasting time on these 3 things</h1>' +
          '<p>Hi ' + (data.firstName || 'there') + ',</p>' +
          '<p>We talked to hundreds of Upwork freelancers. Here are the top 3 time wasters they all share:</p>' +
          '<h2>1. Writing proposals from scratch</h2>' +
          '<p>The average freelancer spends 20-30 minutes per proposal. At 10 proposals a day, that\'s 3-5 hours just writing proposals — before doing any billable work.</p>' +
          '<p><strong>Our solution:</strong> AI Proposal Writer generates personalized, high-quality proposals in under 30 seconds.</p>' +
          '<h2>2. Guessing their rate</h2>' +
          '<p>Most freelancers either undercharge (and burn out) or overcharge (and lose bids). Very few actually calculate their rate based on real numbers.</p>' +
          '<p><strong>Our solution:</strong> Rate Calculator factors in taxes, Upwork fees, expenses, and your desired income to find your perfect rate.</p>' +
          '<h2>3. Administrative busywork</h2>' +
          '<p>Invoicing, profile updates, fee calculations — none of this is billable, but it all takes time.</p>' +
          '<p><strong>Our solution:</strong> A suite of AI tools that handle the busywork so you can focus on client work.</p>' +
          '<p>We\'re building Cortex Freelancer to give you those hours back. Stay tuned.</p>' +
          '<p>— The Cortex Freelancer Team</p>';
      }
    },
    'tool-spotlight': {
      subject: 'Sneak peek: Our AI Proposal Writer in action',
      preheader: 'See how it writes a winning proposal in 30 seconds.',
      body: function(data) {
        return '<h1>Tool Spotlight: AI Proposal Writer</h1>' +
          '<p>Hi ' + (data.firstName || 'there') + ',</p>' +
          '<p>Today we\'re giving you a behind-the-scenes look at our most requested tool: the AI Proposal Writer.</p>' +
          '<h2>How it works</h2>' +
          '<ol>' +
            '<li><strong>Paste the job URL or description</strong> — The AI reads and understands the client\'s needs</li>' +
            '<li><strong>Add your relevant experience</strong> — Tell it about your skills and past work</li>' +
            '<li><strong>Choose your tone</strong> — Professional, friendly, or authoritative</li>' +
            '<li><strong>Generate</strong> — Get a personalized, ready-to-send proposal in seconds</li>' +
          '</ol>' +
          '<h2>What makes it different</h2>' +
          '<p>Unlike generic templates, our AI:</p>' +
          '<ul>' +
            '<li>References specific details from the job post</li>' +
            '<li>Highlights your most relevant experience</li>' +
            '<li>Follows proven proposal structures that win contracts</li>' +
            '<li>Creates unique proposals every time — no two are alike</li>' +
          '</ul>' +
          '<p>We can\'t wait to put this in your hands. You\'ll be among the first to try it.</p>' +
          '<p>— The Cortex Freelancer Team</p>';
      }
    },
    'social-proof': {
      subject: 'Freelancers are already seeing results',
      preheader: 'Real stories from our beta testers.',
      body: function(data) {
        return '<h1>What early users are saying</h1>' +
          '<p>Hi ' + (data.firstName || 'there') + ',</p>' +
          '<p>We\'ve been testing Cortex Freelancer with a small group of beta users. Here\'s what they\'re experiencing:</p>' +
          '<blockquote>' +
            '<p>"I used to spend 2 hours a day on proposals. Now I spend 20 minutes and my response rate actually went up."</p>' +
            '<cite>— Sarah M., UX Designer</cite>' +
          '</blockquote>' +
          '<blockquote>' +
            '<p>"The rate calculator showed me I was undercharging by $15/hour after accounting for taxes and fees. That\'s $18,000 a year I was leaving on the table."</p>' +
            '<cite>— James T., Web Developer</cite>' +
          '</blockquote>' +
          '<blockquote>' +
            '<p>"I went from 3% proposal acceptance to 12% in my first month. The AI proposals just hit different."</p>' +
            '<cite>— Maria L., Content Writer</cite>' +
          '</blockquote>' +
          '<h2>The numbers</h2>' +
          '<ul>' +
            '<li><strong>3x</strong> average increase in proposal response rate</li>' +
            '<li><strong>15 min</strong> saved per proposal</li>' +
            '<li><strong>94%</strong> of beta users said they\'d recommend it</li>' +
          '</ul>' +
          '<p>You\'re on the list to get these results too. Launch is coming soon.</p>' +
          '<p>— The Cortex Freelancer Team</p>';
      }
    },
    'launch-invite': {
      subject: 'You\'re invited: Cortex Freelancer is live!',
      preheader: 'Get early access + your exclusive discount.',
      body: function(data) {
        return '<h1>It\'s launch day!</h1>' +
          '<p>Hi ' + (data.firstName || 'there') + ',</p>' +
          '<p>The wait is over. Cortex Freelancer is officially live, and as a waitlist member, you get first access.</p>' +
          '<h2>Your exclusive benefits</h2>' +
          '<ul>' +
            '<li><strong>Early access</strong> to all tools before the public launch</li>' +
            '<li><strong>30% off</strong> any paid plan for life (waitlist exclusive)</li>' +
            '<li><strong>Priority support</strong> — your feedback shapes the product</li>' +
            '<li><strong>Free tools forever</strong> — proposal writer, rate calculator, and more</li>' +
          '</ul>' +
          '<div style="text-align:center;margin:32px 0;">' +
            '<a href="{{cta_url}}" style="background:#2563eb;color:#fff;padding:16px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:18px;">Get Started Now</a>' +
          '</div>' +
          '<p>This discount is only available for the first 48 hours after you receive this email. After that, it\'s full price.</p>' +
          '<p>Thank you for believing in us from the beginning. Let\'s make freelancing smarter, together.</p>' +
          '<p>— The Cortex Freelancer Team</p>' +
          '<p style="font-size:12px;color:#666;">P.S. Know another freelancer who\'d love this? Forward this email — they\'ll get 20% off too.</p>';
      }
    }
  };

  function EmailDripCampaign(options) {
    options = options || {};
    this.apiEndpoint = options.apiEndpoint || '/api/email/send';
    this.fromName = options.fromName || 'Cortex Freelancer';
    this.fromEmail = options.fromEmail || 'hello@cortexfreelancer.com';
    this.schedule = DRIP_SCHEDULE;
    this.templates = EMAIL_TEMPLATES;
  }

  EmailDripCampaign.prototype.getEmailSequence = function() {
    var self = this;
    return this.schedule.map(function(item) {
      var template = self.templates[item.id];
      return {
        id: item.id,
        day: item.day,
        subject: template.subject,
        preheader: template.preheader
      };
    });
  };

  EmailDripCampaign.prototype.renderEmail = function(emailId, data) {
    var template = this.templates[emailId];
    if (!template) return null;

    data = data || {};

    var html = '<!DOCTYPE html>' +
      '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + template.subject + '</title>' +
      '<style>' +
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;padding:20px;}' +
        'h1{color:#1e293b;font-size:24px;}' +
        'h2{color:#334155;font-size:20px;margin-top:24px;}' +
        'blockquote{border-left:4px solid #2563eb;margin:16px 0;padding:12px 20px;background:#f0f7ff;border-radius:0 8px 8px 0;}' +
        'blockquote cite{display:block;margin-top:8px;font-style:normal;font-weight:600;color:#2563eb;}' +
        'ul,ol{padding-left:20px;}' +
        'li{margin:8px 0;}' +
        'a{color:#2563eb;}' +
      '</style>' +
      '</head><body>' +
      '<div style="display:none;max-height:0;overflow:hidden;">' + template.preheader + '</div>' +
      template.body(data) +
      '<hr style="margin-top:40px;border:none;border-top:1px solid #e5e7eb;">' +
      '<p style="font-size:12px;color:#9ca3af;text-align:center;">' +
        'Cortex Freelancer | AI-powered tools for Upwork freelancers<br>' +
        '<a href="{{unsubscribe_url}}" style="color:#9ca3af;">Unsubscribe</a>' +
      '</p>' +
      '</body></html>';

    return html;
  };

  EmailDripCampaign.prototype.getScheduledDate = function(emailId, signupDate) {
    var scheduleItem = this.schedule.find(function(item) { return item.id === emailId; });
    if (!scheduleItem) return null;

    var date = new Date(signupDate);
    date.setDate(date.getDate() + scheduleItem.day);
    return date;
  };

  EmailDripCampaign.prototype.getNextEmail = function(signupDate, sentEmails) {
    sentEmails = sentEmails || [];
    var now = new Date();

    for (var i = 0; i < this.schedule.length; i++) {
      var item = this.schedule[i];
      if (sentEmails.indexOf(item.id) !== -1) continue;

      var sendDate = this.getScheduledDate(item.id, signupDate);
      if (sendDate && sendDate <= now) {
        return {
          emailId: item.id,
          scheduledDate: sendDate,
          subject: this.templates[item.id].subject
        };
      }
    }

    return null;
  };

  EmailDripCampaign.prototype.sendEmail = function(emailId, recipientData) {
    var template = this.templates[emailId];
    if (!template) {
      return Promise.reject(new Error('Unknown email template: ' + emailId));
    }

    var html = this.renderEmail(emailId, recipientData);

    var payload = {
      to: recipientData.email,
      from: this.fromName + ' <' + this.fromEmail + '>',
      subject: template.subject,
      html: html,
      tags: ['drip', 'waitlist', emailId],
      metadata: {
        emailId: emailId,
        userId: recipientData.userId || null,
        campaign: 'waitlist-drip'
      }
    };

    // API integration stub — replace with actual email service
    return this._sendViaAPI(payload);
  };

  EmailDripCampaign.prototype._sendViaAPI = function(payload) {
    var endpoint = this.apiEndpoint;

    if (typeof fetch !== 'function') {
      console.log('[EmailDrip] Would send email:', payload.subject, 'to:', payload.to);
      return Promise.resolve({ success: true, messageId: 'stub-' + Date.now() });
    }

    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(response) {
      if (!response.ok) throw new Error('Email send failed: ' + response.status);
      return response.json();
    })
    .catch(function(error) {
      console.error('[EmailDrip] Send error:', error);
      return { success: false, error: error.message };
    });
  };

  EmailDripCampaign.prototype.processQueue = function(subscribers) {
    var self = this;
    var results = [];

    subscribers.forEach(function(subscriber) {
      var next = self.getNextEmail(subscriber.signupDate, subscriber.sentEmails || []);
      if (next) {
        results.push({
          subscriber: subscriber,
          email: next
        });
      }
    });

    return results;
  };

  EmailDripCampaign.prototype.previewEmail = function(emailId, container) {
    var html = this.renderEmail(emailId, { firstName: 'Preview User', email: 'preview@example.com' });
    if (!html) return;

    if (container) {
      var iframe = document.createElement('iframe');
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      iframe.style.border = '1px solid #e5e7eb';
      iframe.style.borderRadius = '8px';
      container.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
    }

    return html;
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.EmailDripCampaign = EmailDripCampaign;
})();
