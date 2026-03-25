#!/usr/bin/env node
/**
 * Client Testimonial Collection System
 * Sprint 2 Task 14 — Cortex Freelancer
 *
 * Automated testimonial requests, structured feedback collection,
 * social proof management, and showcase generation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'testimonials'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  testimonials: () => path.join(DATA_DIR, 'testimonials.json'),
  requests:     () => path.join(DATA_DIR, 'requests.json'),
  campaigns:    () => path.join(DATA_DIR, 'campaigns.json'),
  settings:     () => path.join(DATA_DIR, 'settings.json'),
};

// ─── Default Settings ───────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  freelancerName: 'Freelancer',
  autoRequestDays: 7,        // days after project completion
  followUpDays: 14,          // follow up if no response
  maxFollowUps: 2,
  defaultQuestions: [
    'How would you describe the quality of work delivered?',
    'What specific results did you achieve from this project?',
    'Would you recommend this service to others? Why?',
    'What was the best part of working together?',
    'Is there anything that could have been improved?',
  ],
  ratingScale: 5,
  categories: ['quality', 'communication', 'timeliness', 'value', 'expertise'],
};

// ─── Request Templates ──────────────────────────────────────────────────────

const REQUEST_TEMPLATES = {
  standard: {
    subject: 'Would you share your experience working with {freelancerName}?',
    body: `Hi {clientName},

Thank you for choosing to work with me on {projectName}! I hope you're happy with the results.

Your feedback means a lot and helps me improve while also helping others make informed decisions. Would you mind taking a few minutes to share your experience?

Here are some optional prompts to guide your response:
{questions}

Even a few sentences would be incredibly valuable!

Best regards,
{freelancerName}`,
  },
  brief: {
    subject: 'Quick feedback request — {projectName}',
    body: `Hi {clientName},

I really enjoyed working on {projectName} with you! Would you be willing to share a brief testimonial about your experience? Even 2-3 sentences would be amazing.

Thanks so much!
{freelancerName}`,
  },
  detailed: {
    subject: 'Your feedback on {projectName}',
    body: `Hi {clientName},

Now that {projectName} is complete, I'd love to hear your detailed thoughts. Your feedback helps me grow and serves as a reference for future clients.

Could you share your thoughts on:
{questions}

Additionally, I'd appreciate ratings (1-5) on:
{categories}

Thank you for your time!
{freelancerName}`,
  },
  followUp: {
    subject: 'Gentle reminder: Feedback on {projectName}',
    body: `Hi {clientName},

Just a friendly follow-up on my earlier request for feedback about {projectName}. I completely understand you're busy — even a one-line testimonial would be greatly appreciated!

Best,
{freelancerName}`,
  },
};

// ─── Testimonial Engine ─────────────────────────────────────────────────────

class TestimonialCollector {
  constructor() {
    this.testimonials = readJSON(PATHS.testimonials());
    this.requests = readJSON(PATHS.requests());
    this.campaigns = readJSON(PATHS.campaigns());
    this.settings = { ...DEFAULT_SETTINGS, ...readJSON(PATHS.settings(), {}) };
  }

  save() {
    writeJSON(PATHS.testimonials(), this.testimonials);
    writeJSON(PATHS.requests(), this.requests);
    writeJSON(PATHS.campaigns(), this.campaigns);
  }

  // ── Request Testimonial ─────────────────────────────────────────────────

  requestTestimonial({
    clientName, clientEmail = '', projectName,
    template = 'standard', customQuestions = null,
  }) {
    const questions = customQuestions || this.settings.defaultQuestions;
    const tmpl = REQUEST_TEMPLATES[template] || REQUEST_TEMPLATES.standard;

    const vars = {
      clientName,
      projectName,
      freelancerName: this.settings.freelancerName,
      questions: questions.map((q, i) => `  ${i + 1}. ${q}`).join('\n'),
      categories: this.settings.categories.map(c =>
        `  - ${c.charAt(0).toUpperCase() + c.slice(1)}: ___/5`
      ).join('\n'),
    };

    const subject = this._interpolate(tmpl.subject, vars);
    const body = this._interpolate(tmpl.body, vars);

    const request = {
      id: crypto.randomUUID(),
      clientName,
      clientEmail,
      projectName,
      template,
      status: 'sent', // sent, reminded, received, expired
      questions,
      sentDate: new Date().toISOString(),
      followUps: [],
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.requests.push(request);
    this.save();

    return {
      success: true,
      request,
      notification: {
        type: 'testimonial_request',
        to: clientEmail,
        subject,
        body,
      },
      summary: `📧 Testimonial request sent to ${clientName} for "${projectName}"`,
    };
  }

  // ── Follow Up ───────────────────────────────────────────────────────────

  sendFollowUp(requestId) {
    const req = this.requests.find(r => r.id === requestId);
    if (!req) return { success: false, error: 'Request not found' };
    if (req.status === 'received') return { success: false, error: 'Already received' };

    if (req.followUps.length >= this.settings.maxFollowUps) {
      return { success: false, error: `Max follow-ups (${this.settings.maxFollowUps}) reached` };
    }

    const tmpl = REQUEST_TEMPLATES.followUp;
    const vars = {
      clientName: req.clientName,
      projectName: req.projectName,
      freelancerName: this.settings.freelancerName,
    };

    req.followUps.push({ date: new Date().toISOString(), number: req.followUps.length + 1 });
    req.status = 'reminded';
    this.save();

    return {
      success: true,
      followUpNumber: req.followUps.length,
      notification: {
        type: 'testimonial_followup',
        to: req.clientEmail,
        subject: this._interpolate(tmpl.subject, vars),
        body: this._interpolate(tmpl.body, vars),
      },
      summary: `🔔 Follow-up #${req.followUps.length} sent to ${req.clientName}`,
    };
  }

  // ── Process Due Follow-ups ──────────────────────────────────────────────

  processDueFollowUps() {
    const now = new Date();
    const due = this.requests.filter(req => {
      if (['received', 'expired'].includes(req.status)) return false;
      if (req.followUps.length >= this.settings.maxFollowUps) return false;
      const lastContact = req.followUps.length > 0
        ? new Date(req.followUps[req.followUps.length - 1].date)
        : new Date(req.sentDate);
      const daysSince = (now - lastContact) / 86400000;
      return daysSince >= this.settings.followUpDays;
    });

    const results = due.map(req => this.sendFollowUp(req.id));
    return {
      processed: results.filter(r => r.success).length,
      skipped: results.filter(r => !r.success).length,
      details: results,
    };
  }

  // ── Record Testimonial ──────────────────────────────────────────────────

  recordTestimonial({
    clientName, clientTitle = '', clientCompany = '',
    projectName = '', text, ratings = {},
    imageUrl = null, videoUrl = null,
    platform = 'direct', // direct, linkedin, upwork, email
    requestId = null,
  }) {
    // Calculate overall rating
    const ratingValues = Object.values(ratings).filter(v => typeof v === 'number');
    const overallRating = ratingValues.length > 0
      ? ratingValues.reduce((s, v) => s + v, 0) / ratingValues.length
      : null;

    const testimonial = {
      id: crypto.randomUUID(),
      clientName,
      clientTitle,
      clientCompany,
      projectName,
      text,
      excerpt: text.length > 150 ? text.substring(0, 147) + '...' : text,
      ratings,
      overallRating: overallRating ? parseFloat(overallRating.toFixed(1)) : null,
      stars: overallRating ? '⭐'.repeat(Math.round(overallRating)) : null,
      imageUrl,
      videoUrl,
      platform,
      featured: false,
      approved: true,
      tags: this._extractTags(text),
      sentiment: this._analyzeSentiment(text),
      displayOnPortfolio: true,
      requestId,
      receivedDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.testimonials.push(testimonial);

    // Update request status if linked
    if (requestId) {
      const req = this.requests.find(r => r.id === requestId);
      if (req) req.status = 'received';
    }

    this.save();

    return {
      success: true,
      testimonial,
      summary: `✨ Testimonial from ${clientName} recorded! Rating: ${testimonial.stars || 'N/A'}`,
    };
  }

  // ── Feature/Unfeature ───────────────────────────────────────────────────

  toggleFeatured(testimonialId) {
    const t = this.testimonials.find(x => x.id === testimonialId);
    if (!t) return { success: false, error: 'Testimonial not found' };
    t.featured = !t.featured;
    this.save();
    return { success: true, featured: t.featured, summary: `${t.featured ? '⭐ Featured' : 'Unfeatured'}: "${t.excerpt}"` };
  }

  // ── Showcase Generation ─────────────────────────────────────────────────

  generateShowcase({ format = 'markdown', maxItems = 10, featured = false, minRating = 0 } = {}) {
    let items = this.testimonials
      .filter(t => t.approved && t.displayOnPortfolio)
      .filter(t => !featured || t.featured)
      .filter(t => !t.overallRating || t.overallRating >= minRating)
      .sort((a, b) => {
        // Featured first, then by rating, then by date
        if (a.featured !== b.featured) return b.featured ? 1 : -1;
        if ((b.overallRating || 0) !== (a.overallRating || 0)) return (b.overallRating || 0) - (a.overallRating || 0);
        return new Date(b.receivedDate) - new Date(a.receivedDate);
      })
      .slice(0, maxItems);

    if (format === 'markdown') {
      return this._markdownShowcase(items);
    } else if (format === 'html') {
      return this._htmlShowcase(items);
    } else {
      return { items };
    }
  }

  // ── Statistics ──────────────────────────────────────────────────────────

  getStats() {
    const t = this.testimonials;
    const rated = t.filter(x => x.overallRating);
    const avgRating = rated.length > 0
      ? (rated.reduce((s, x) => s + x.overallRating, 0) / rated.length).toFixed(1)
      : 'N/A';

    // Category averages
    const categoryTotals = {};
    const categoryCounts = {};
    for (const item of t) {
      for (const [cat, val] of Object.entries(item.ratings || {})) {
        if (typeof val === 'number') {
          categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }
    }

    const categoryAverages = {};
    for (const cat of Object.keys(categoryTotals)) {
      categoryAverages[cat] = (categoryTotals[cat] / categoryCounts[cat]).toFixed(1);
    }

    // Sentiment breakdown
    const sentiments = { positive: 0, neutral: 0, negative: 0 };
    for (const item of t) {
      sentiments[item.sentiment || 'neutral']++;
    }

    // Collection rate
    const totalRequests = this.requests.length;
    const received = this.requests.filter(r => r.status === 'received').length;
    const collectionRate = totalRequests > 0
      ? `${((received / totalRequests) * 100).toFixed(0)}%`
      : 'N/A';

    // Platform breakdown
    const platforms = {};
    for (const item of t) {
      platforms[item.platform] = (platforms[item.platform] || 0) + 1;
    }

    return {
      total: t.length,
      featured: t.filter(x => x.featured).length,
      averageRating: avgRating,
      ratingDistribution: {
        '5': rated.filter(x => Math.round(x.overallRating) === 5).length,
        '4': rated.filter(x => Math.round(x.overallRating) === 4).length,
        '3': rated.filter(x => Math.round(x.overallRating) === 3).length,
        '2': rated.filter(x => Math.round(x.overallRating) === 2).length,
        '1': rated.filter(x => Math.round(x.overallRating) === 1).length,
      },
      categoryAverages,
      sentimentBreakdown: sentiments,
      collectionRate,
      pendingRequests: this.requests.filter(r => !['received', 'expired'].includes(r.status)).length,
      platforms,
      topTags: this._getTopTags(10),
    };
  }

  // ── Campaign (Batch Collection) ─────────────────────────────────────────

  createCampaign({ name, clients = [], template = 'standard', customQuestions = null }) {
    const campaign = {
      id: crypto.randomUUID(),
      name,
      template,
      customQuestions,
      clientCount: clients.length,
      requests: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const results = [];
    for (const client of clients) {
      const result = this.requestTestimonial({
        clientName: client.name,
        clientEmail: client.email || '',
        projectName: client.projectName || 'Our project together',
        template,
        customQuestions,
      });
      if (result.success) {
        campaign.requests.push(result.request.id);
        results.push(result);
      }
    }

    this.campaigns.push(campaign);
    this.save();

    return {
      success: true,
      campaign,
      sent: results.length,
      summary: `📣 Campaign "${name}" launched — ${results.length} requests sent`,
    };
  }

  // ── List ────────────────────────────────────────────────────────────────

  listTestimonials({ featured, minRating, limit = 20 } = {}) {
    let results = [...this.testimonials];
    if (featured) results = results.filter(t => t.featured);
    if (minRating) results = results.filter(t => (t.overallRating || 0) >= minRating);

    return results
      .sort((a, b) => new Date(b.receivedDate) - new Date(a.receivedDate))
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        client: t.clientName,
        company: t.clientCompany,
        project: t.projectName,
        excerpt: t.excerpt,
        rating: t.overallRating,
        stars: t.stars,
        featured: t.featured,
        sentiment: t.sentiment,
        date: new Date(t.receivedDate).toLocaleDateString(),
      }));
  }

  listRequests({ status } = {}) {
    let results = [...this.requests];
    if (status) results = results.filter(r => r.status === status);

    return results
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(r => ({
        id: r.id,
        client: r.clientName,
        project: r.projectName,
        status: r.status,
        followUps: r.followUps.length,
        sentDate: new Date(r.sentDate).toLocaleDateString(),
      }));
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  _interpolate(template, vars) {
    return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || '');
  }

  _extractTags(text) {
    const keywords = [
      'professional', 'responsive', 'quality', 'creative', 'reliable',
      'excellent', 'fast', 'thorough', 'expert', 'recommend',
      'deadline', 'budget', 'communication', 'flexible', 'innovative',
      'detail', 'patience', 'skill', 'knowledge', 'value',
    ];
    const lower = text.toLowerCase();
    return keywords.filter(kw => lower.includes(kw));
  }

  _analyzeSentiment(text) {
    const positive = ['excellent', 'amazing', 'great', 'fantastic', 'love', 'recommend',
      'outstanding', 'exceptional', 'perfect', 'wonderful', 'brilliant', 'best',
      'impressed', 'delighted', 'thrilled', 'superb'];
    const negative = ['poor', 'bad', 'terrible', 'worst', 'disappointed', 'issue',
      'problem', 'late', 'slow', 'unprofessional', 'missing', 'wrong'];

    const lower = text.toLowerCase();
    const posScore = positive.filter(w => lower.includes(w)).length;
    const negScore = negative.filter(w => lower.includes(w)).length;

    if (posScore > negScore + 1) return 'positive';
    if (negScore > posScore) return 'negative';
    return posScore > 0 ? 'positive' : 'neutral';
  }

  _getTopTags(limit = 10) {
    const tagCounts = {};
    for (const t of this.testimonials) {
      for (const tag of t.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  _markdownShowcase(items) {
    const lines = ['# Client Testimonials', ''];
    const avgRating = items.filter(i => i.overallRating)
      .reduce((s, i) => s + i.overallRating, 0) /
      Math.max(items.filter(i => i.overallRating).length, 1);

    if (avgRating > 0) {
      lines.push(`**Average Rating:** ${'⭐'.repeat(Math.round(avgRating))} (${avgRating.toFixed(1)}/5)`);
      lines.push('');
    }

    for (const item of items) {
      lines.push(`---`);
      lines.push('');
      if (item.featured) lines.push('⭐ **Featured**');
      lines.push(`> "${item.text}"`);
      lines.push('');
      const attribution = [item.clientName];
      if (item.clientTitle) attribution.push(item.clientTitle);
      if (item.clientCompany) attribution.push(item.clientCompany);
      lines.push(`— **${attribution.join(', ')}**`);
      if (item.projectName) lines.push(`*Project: ${item.projectName}*`);
      if (item.stars) lines.push(`Rating: ${item.stars}`);
      lines.push('');
    }

    return { format: 'markdown', content: lines.join('\n'), count: items.length };
  }

  _htmlShowcase(items) {
    const cards = items.map(item => {
      const attribution = [item.clientName, item.clientTitle, item.clientCompany].filter(Boolean).join(', ');
      return `
      <div class="testimonial-card${item.featured ? ' featured' : ''}">
        ${item.featured ? '<span class="badge">⭐ Featured</span>' : ''}
        <blockquote>"${item.text}"</blockquote>
        <div class="attribution">
          <strong>${attribution}</strong>
          ${item.projectName ? `<span class="project">${item.projectName}</span>` : ''}
          ${item.stars ? `<div class="rating">${item.stars}</div>` : ''}
        </div>
      </div>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Client Testimonials</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #fafafa; }
  h1 { text-align: center; margin-bottom: 2rem; }
  .testimonial-card { background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .testimonial-card.featured { border-left: 4px solid #f59e0b; }
  .badge { background: #fef3c7; color: #92400e; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
  blockquote { font-style: italic; font-size: 1.1rem; color: #374151; margin: 1rem 0; line-height: 1.6; }
  .attribution { color: #6b7280; }
  .attribution strong { color: #1f2937; }
  .project { display: block; font-size: 0.9rem; margin-top: 0.25rem; }
  .rating { margin-top: 0.5rem; font-size: 1.2rem; }
</style>
</head>
<body>
<h1>What Our Clients Say</h1>
${cards}
</body>
</html>`;

    return { format: 'html', content: html, count: items.length };
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const engine = new TestimonialCollector();

  const commands = {
    request: () => {
      const clientName = args[1] || 'Client';
      const projectName = getArg(args, '--project') || 'Project';
      const template = getArg(args, '--template') || 'standard';
      const email = getArg(args, '--email') || '';
      console.log(JSON.stringify(engine.requestTestimonial({
        clientName, clientEmail: email, projectName, template,
      }), null, 2));
    },

    followup: () => {
      if (args[1] === 'auto') {
        console.log(JSON.stringify(engine.processDueFollowUps(), null, 2));
      } else {
        console.log(JSON.stringify(engine.sendFollowUp(args[1]), null, 2));
      }
    },

    record: () => {
      const clientName = args[1] || 'Client';
      const text = getArg(args, '--text') || args.slice(2).join(' ');
      const project = getArg(args, '--project') || '';
      const rating = parseFloat(getArg(args, '--rating') || '0') || null;
      const company = getArg(args, '--company') || '';
      const title = getArg(args, '--title') || '';
      const ratings = rating ? { overall: rating } : {};
      console.log(JSON.stringify(engine.recordTestimonial({
        clientName, clientTitle: title, clientCompany: company,
        projectName: project, text, ratings,
      }), null, 2));
    },

    feature: () => {
      console.log(JSON.stringify(engine.toggleFeatured(args[1]), null, 2));
    },

    list: () => {
      const featured = args.includes('--featured');
      const minRating = parseFloat(getArg(args, '--min-rating') || '0');
      console.log(JSON.stringify(engine.listTestimonials({ featured, minRating }), null, 2));
    },

    requests: () => {
      const status = getArg(args, '--status');
      console.log(JSON.stringify(engine.listRequests({ status }), null, 2));
    },

    showcase: () => {
      const format = getArg(args, '--format') || 'markdown';
      const featured = args.includes('--featured');
      const result = engine.generateShowcase({ format, featured });
      if (result.content) {
        if (format === 'html') {
          const outPath = path.join(DATA_DIR, 'showcase.html');
          fs.writeFileSync(outPath, result.content);
          console.log(`Showcase written to ${outPath} (${result.count} testimonials)`);
        } else {
          console.log(result.content);
        }
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    },

    campaign: () => {
      const name = args[1] || 'Campaign';
      // Parse --client "name:email:project" flags
      const clients = [];
      for (let i = 2; i < args.length; i++) {
        if (args[i] === '--client' && args[i + 1]) {
          const [cname, email, proj] = args[++i].split(':');
          clients.push({ name: cname, email: email || '', projectName: proj || '' });
        }
      }
      console.log(JSON.stringify(engine.createCampaign({ name, clients }), null, 2));
    },

    stats: () => {
      console.log(JSON.stringify(engine.getStats(), null, 2));
    },

    help: () => {
      console.log(`
Testimonial Collector — Cortex Freelancer

Commands:
  request <client> --project <p> [--email e] [--template standard|brief|detailed]
  followup <request-id>                    Send follow-up
  followup auto                            Process all due follow-ups
  record <client> --text "..." [--project p] [--rating 5] [--company c] [--title t]
  feature <testimonial-id>                 Toggle featured status
  list [--featured] [--min-rating n]       List testimonials
  requests [--status sent|reminded|received] List requests
  showcase [--format markdown|html] [--featured] Generate showcase
  campaign <name> --client "name:email:project"...  Batch request
  stats                                    Collection statistics
      `);
    },
  };

  (commands[cmd] || commands.help)();
}

main();
