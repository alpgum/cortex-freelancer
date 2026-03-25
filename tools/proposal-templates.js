#!/usr/bin/env node
/**
 * Proposal Templates with Dynamic Pricing
 * Sprint 2 Task 19 — Cortex Freelancer
 *
 * Professional proposal generation with dynamic pricing models,
 * scope customization, multi-tier packages, revision tracking,
 * and conversion analytics. Build winning proposals faster.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'proposals'
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
  proposals:  () => path.join(DATA_DIR, 'proposals.json'),
  templates:  () => path.join(DATA_DIR, 'templates.json'),
  pricing:    () => path.join(DATA_DIR, 'pricing.json'),
  analytics:  () => path.join(DATA_DIR, 'analytics.json'),
  settings:   () => path.join(DATA_DIR, 'settings.json'),
};

// ─── Pricing Models ─────────────────────────────────────────────────────────

const PRICING_MODELS = {
  hourly: {
    id: 'hourly',
    name: 'Hourly Rate',
    description: 'Billed per hour worked',
    calculate: (rate, hours, opts = {}) => {
      const discount = opts.discount || 0;
      const subtotal = rate * hours;
      const discountAmount = subtotal * (discount / 100);
      return {
        rate,
        hours,
        subtotal,
        discount_pct: discount,
        discount_amount: discountAmount,
        total: subtotal - discountAmount,
        breakdown: `${hours}h × $${rate}/hr = $${subtotal.toFixed(2)}${discount > 0 ? ` (-${discount}% = $${(subtotal - discountAmount).toFixed(2)})` : ''}`
      };
    }
  },
  fixed: {
    id: 'fixed',
    name: 'Fixed Price',
    description: 'Single price for entire project',
    calculate: (price, _unused, opts = {}) => {
      const discount = opts.discount || 0;
      const discountAmount = price * (discount / 100);
      return {
        price,
        subtotal: price,
        discount_pct: discount,
        discount_amount: discountAmount,
        total: price - discountAmount,
        breakdown: `Fixed: $${price.toFixed(2)}${discount > 0 ? ` (-${discount}% = $${(price - discountAmount).toFixed(2)})` : ''}`
      };
    }
  },
  value_based: {
    id: 'value_based',
    name: 'Value-Based Pricing',
    description: 'Priced based on value delivered to client',
    calculate: (estimatedValue, multiplier, opts = {}) => {
      const pricingMultiplier = multiplier || 0.1; // 10% of estimated value by default
      const price = estimatedValue * pricingMultiplier;
      return {
        estimated_client_value: estimatedValue,
        multiplier: pricingMultiplier,
        subtotal: price,
        total: price,
        breakdown: `Value: $${estimatedValue.toFixed(0)} × ${(pricingMultiplier * 100).toFixed(0)}% = $${price.toFixed(2)}`,
        roi_message: `Projected ROI: ${((1 / pricingMultiplier - 1) * 100).toFixed(0)}%`
      };
    }
  },
  retainer: {
    id: 'retainer',
    name: 'Monthly Retainer',
    description: 'Fixed monthly fee for ongoing services',
    calculate: (monthlyRate, months, opts = {}) => {
      const discount = opts.discount || 0;
      const subtotal = monthlyRate * months;
      const discountAmount = subtotal * (discount / 100);
      return {
        monthly_rate: monthlyRate,
        months,
        subtotal,
        discount_pct: discount,
        discount_amount: discountAmount,
        total: subtotal - discountAmount,
        breakdown: `$${monthlyRate.toFixed(2)}/mo × ${months} months = $${subtotal.toFixed(2)}${discount > 0 ? ` (-${discount}%)` : ''}`
      };
    }
  },
  milestone: {
    id: 'milestone',
    name: 'Milestone-Based',
    description: 'Payment tied to project milestones',
    calculate: (milestones) => {
      // milestones is an array of {name, amount}
      const total = milestones.reduce((sum, m) => sum + m.amount, 0);
      return {
        milestones: milestones.map((m, i) => ({
          order: i + 1,
          name: m.name,
          amount: m.amount,
          pct: `${((m.amount / total) * 100).toFixed(0)}%`
        })),
        total,
        breakdown: milestones.map((m, i) => `  ${i + 1}. ${m.name}: $${m.amount.toFixed(2)}`).join('\n')
      };
    }
  }
};

// ─── Package Tiers ──────────────────────────────────────────────────────────

function generatePackages(basePrice, opts = {}) {
  const markup = {
    basic_discount: opts.basic_discount || 0.8,  // 80% of standard
    standard: 1.0,
    premium_markup: opts.premium_markup || 1.6,   // 160% of standard
  };

  const basicPrice = basePrice * markup.basic_discount;
  const premiumPrice = basePrice * markup.premium_markup;

  return [
    {
      tier: 'Basic',
      emoji: '🥉',
      price: Math.round(basicPrice),
      description: opts.basic_desc || 'Essential features to get started',
      includes: opts.basic_includes || ['Core deliverables', '1 revision round', 'Email support', '7-day delivery'],
      excludes: opts.basic_excludes || ['Priority support', 'Source files', 'Extended revisions'],
      recommended: false
    },
    {
      tier: 'Standard',
      emoji: '🥈',
      price: Math.round(basePrice),
      description: opts.standard_desc || 'Best value for most projects',
      includes: opts.standard_includes || ['All Basic features', '3 revision rounds', 'Source files included', '5-day delivery', 'Priority email support'],
      excludes: opts.standard_excludes || ['Dedicated Slack channel', 'Rush delivery'],
      recommended: true
    },
    {
      tier: 'Premium',
      emoji: '🥇',
      price: Math.round(premiumPrice),
      description: opts.premium_desc || 'Full-service with white-glove support',
      includes: opts.premium_includes || ['All Standard features', 'Unlimited revisions', 'Dedicated Slack channel', '3-day rush delivery', 'Monthly maintenance (3 months)', 'Strategy consultation'],
      excludes: [],
      recommended: false
    }
  ];
}

// ─── Proposal Templates ─────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = {
  web_development: {
    id: 'web_development',
    name: 'Web Development Proposal',
    sections: ['executive_summary', 'problem_statement', 'proposed_solution', 'scope_of_work', 'timeline', 'pricing', 'terms', 'about_me'],
    default_scope: [
      'Requirements analysis & planning',
      'UI/UX design (wireframes + mockups)',
      'Frontend development (responsive)',
      'Backend development & API',
      'Testing & QA',
      'Deployment & launch support',
      'Post-launch support (30 days)'
    ],
    suggested_milestones: [
      { name: 'Discovery & Planning', pct: 20 },
      { name: 'Design Approval', pct: 20 },
      { name: 'Development Complete', pct: 30 },
      { name: 'Testing & Launch', pct: 20 },
      { name: 'Post-Launch Review', pct: 10 },
    ]
  },
  design: {
    id: 'design',
    name: 'Design Proposal',
    sections: ['executive_summary', 'creative_brief', 'process', 'deliverables', 'timeline', 'pricing', 'terms'],
    default_scope: [
      'Discovery & brand research',
      'Mood board & concept exploration',
      'Initial design concepts (3 directions)',
      'Revision rounds',
      'Final deliverables in all formats',
      'Brand guidelines document'
    ],
    suggested_milestones: [
      { name: 'Research & Concepts', pct: 30 },
      { name: 'Design Direction Approved', pct: 30 },
      { name: 'Final Deliverables', pct: 30 },
      { name: 'Handoff & Support', pct: 10 },
    ]
  },
  consulting: {
    id: 'consulting',
    name: 'Consulting Proposal',
    sections: ['executive_summary', 'situation_analysis', 'approach', 'deliverables', 'timeline', 'investment', 'terms', 'qualifications'],
    default_scope: [
      'Initial assessment & stakeholder interviews',
      'Data analysis & benchmarking',
      'Strategy recommendations report',
      'Implementation roadmap',
      'Presentation to leadership',
      'Follow-up support (2 weeks)'
    ],
    suggested_milestones: [
      { name: 'Assessment Phase', pct: 25 },
      { name: 'Analysis & Strategy', pct: 35 },
      { name: 'Recommendations Delivery', pct: 25 },
      { name: 'Implementation Support', pct: 15 },
    ]
  },
  marketing: {
    id: 'marketing',
    name: 'Marketing Services Proposal',
    sections: ['executive_summary', 'market_analysis', 'strategy', 'tactics', 'timeline', 'pricing', 'kpis', 'terms'],
    default_scope: [
      'Market research & competitor analysis',
      'Target audience profiling',
      'Campaign strategy & creative',
      'Content creation & copywriting',
      'Campaign execution & management',
      'Performance tracking & optimization',
      'Monthly reporting'
    ],
    suggested_milestones: [
      { name: 'Research & Strategy', pct: 25 },
      { name: 'Creative Development', pct: 25 },
      { name: 'Campaign Launch', pct: 25 },
      { name: 'Optimization & Report', pct: 25 },
    ]
  }
};

// ─── Core Functions ─────────────────────────────────────────────────────────

function createProposal(clientName, projectTitle, opts = {}) {
  const proposals = readJSON(PATHS.proposals());
  const settings = readJSON(PATHS.settings(), {});

  const templateId = opts.template || 'web_development';
  const template = DEFAULT_TEMPLATES[templateId];
  if (!template) {
    return { error: `Template "${templateId}" not found`, available: Object.keys(DEFAULT_TEMPLATES) };
  }

  // Calculate pricing
  let pricing = null;
  const pricingModel = opts.pricing_model || 'fixed';

  if (opts.price) {
    const price = parseFloat(opts.price);
    const hours = opts.hours ? parseFloat(opts.hours) : null;

    if (pricingModel === 'hourly' && hours) {
      pricing = PRICING_MODELS.hourly.calculate(price, hours, { discount: opts.discount ? parseFloat(opts.discount) : 0 });
    } else if (pricingModel === 'retainer') {
      pricing = PRICING_MODELS.retainer.calculate(price, opts.months ? parseInt(opts.months) : 3, { discount: opts.discount ? parseFloat(opts.discount) : 0 });
    } else if (pricingModel === 'value_based') {
      pricing = PRICING_MODELS.value_based.calculate(price, opts.multiplier ? parseFloat(opts.multiplier) : 0.1);
    } else {
      pricing = PRICING_MODELS.fixed.calculate(price, null, { discount: opts.discount ? parseFloat(opts.discount) : 0 });
    }
  }

  // Generate packages if price given
  let packages = null;
  if (opts.price && opts.packages !== 'false') {
    packages = generatePackages(parseFloat(opts.price), {
      basic_discount: opts.basic_discount ? parseFloat(opts.basic_discount) : 0.8,
      premium_markup: opts.premium_markup ? parseFloat(opts.premium_markup) : 1.6,
    });
  }

  // Generate milestones from template
  let milestones = null;
  if (pricing && template.suggested_milestones) {
    const total = pricing.total || parseFloat(opts.price);
    milestones = template.suggested_milestones.map((m, i) => ({
      order: i + 1,
      name: m.name,
      amount: Math.round(total * (m.pct / 100)),
      pct: `${m.pct}%`
    }));
  }

  const proposal = {
    id: crypto.randomUUID(),
    proposal_number: `PROP-${(proposals.length + 1).toString().padStart(4, '0')}`,
    client_name: clientName,
    project_title: projectTitle,
    template_id: templateId,
    template_name: template.name,
    status: 'draft', // draft, sent, viewed, accepted, rejected, expired
    version: 1,
    pricing_model: pricingModel,
    pricing,
    packages,
    milestones,
    currency: opts.currency || settings.default_currency || 'USD',
    scope: opts.scope ? opts.scope.split('|').map(s => s.trim()) : template.default_scope,
    timeline: opts.timeline || null,
    deadline: opts.deadline || null,
    valid_until: opts.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    payment_terms: opts.payment_terms || '50% upfront, 50% on completion',
    notes: opts.notes || '',
    custom_sections: {},
    freelancer_name: settings.freelancer_name || opts.name || '',
    freelancer_business: settings.business_name || opts.business || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: null,
    viewed_at: null,
    responded_at: null
  };

  proposals.push(proposal);
  writeJSON(PATHS.proposals(), proposals);

  return {
    success: true,
    proposal_id: proposal.id,
    proposal_number: proposal.proposal_number,
    message: `📝 Proposal created: ${proposal.proposal_number}\n` +
             `👤 Client: ${clientName}\n` +
             `📋 Project: ${projectTitle}\n` +
             `💰 ${pricing ? `Total: $${pricing.total.toFixed(2)} (${pricingModel})` : 'Pricing: Not set'}\n` +
             `📅 Valid until: ${proposal.valid_until}`,
    proposal
  };
}

function generateProposalDocument(proposalId) {
  const proposals = readJSON(PATHS.proposals());
  const settings = readJSON(PATHS.settings(), {});
  const proposal = proposals.find(p => p.id === proposalId || p.id.startsWith(proposalId) || p.proposal_number === proposalId);

  if (!proposal) return { error: 'Proposal not found' };

  let doc = '';

  // Header
  doc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  doc += `  📝 PROPOSAL — ${proposal.proposal_number}\n`;
  doc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  doc += `**Prepared for:** ${proposal.client_name}\n`;
  doc += `**Project:** ${proposal.project_title}\n`;
  doc += `**Date:** ${proposal.created_at.split('T')[0]}\n`;
  doc += `**Valid until:** ${proposal.valid_until}\n`;
  if (proposal.freelancer_name) doc += `**Prepared by:** ${proposal.freelancer_name}`;
  if (proposal.freelancer_business) doc += ` (${proposal.freelancer_business})`;
  doc += '\n\n';

  // Executive Summary
  doc += `## Executive Summary\n\n`;
  doc += `Thank you for considering ${proposal.freelancer_business || proposal.freelancer_name || 'us'} for your ${proposal.project_title.toLowerCase()} project. `;
  doc += `This proposal outlines our approach, timeline, and investment for delivering exceptional results.\n\n`;

  // Scope of Work
  doc += `## Scope of Work\n\n`;
  proposal.scope.forEach((item, i) => {
    doc += `${i + 1}. ${item}\n`;
  });
  doc += '\n';

  // Timeline
  if (proposal.timeline) {
    doc += `## Timeline\n\n${proposal.timeline}\n\n`;
  } else if (proposal.milestones) {
    doc += `## Timeline & Milestones\n\n`;
    proposal.milestones.forEach(m => {
      doc += `**Phase ${m.order}: ${m.name}** — ${m.pct}\n`;
    });
    doc += '\n';
  }

  // Pricing / Packages
  doc += `## Investment\n\n`;

  if (proposal.packages) {
    doc += `Choose the package that best fits your needs:\n\n`;
    for (const pkg of proposal.packages) {
      doc += `### ${pkg.emoji} ${pkg.tier} ${pkg.recommended ? '⭐ RECOMMENDED' : ''}\n`;
      doc += `**$${pkg.price.toLocaleString()}** — ${pkg.description}\n\n`;
      doc += `Includes:\n`;
      pkg.includes.forEach(item => { doc += `  ✅ ${item}\n`; });
      if (pkg.excludes.length > 0) {
        pkg.excludes.forEach(item => { doc += `  ❌ ${item}\n`; });
      }
      doc += '\n';
    }
  } else if (proposal.pricing) {
    doc += `**Pricing Model:** ${proposal.pricing_model}\n`;
    doc += `${proposal.pricing.breakdown}\n`;
    doc += `**Total: $${proposal.pricing.total.toFixed(2)} ${proposal.currency}**\n\n`;
  }

  // Payment Milestones
  if (proposal.milestones) {
    doc += `### Payment Schedule\n\n`;
    proposal.milestones.forEach(m => {
      doc += `  ${m.order}. ${m.name}: $${m.amount.toLocaleString()} (${m.pct})\n`;
    });
    doc += '\n';
  }

  // Terms
  doc += `## Terms & Conditions\n\n`;
  doc += `- **Payment Terms:** ${proposal.payment_terms}\n`;
  doc += `- **Proposal Valid Until:** ${proposal.valid_until}\n`;
  doc += `- Revisions beyond scope will be billed at the agreed hourly rate\n`;
  doc += `- All work remains property of the client upon final payment\n`;
  doc += `- A deposit is required to begin work\n\n`;

  // CTA
  doc += `## Next Steps\n\n`;
  doc += `Ready to move forward? Here's how:\n\n`;
  doc += `1. ✅ Select your preferred package/option\n`;
  doc += `2. ✍️ Sign the agreement\n`;
  doc += `3. 💳 Submit the deposit\n`;
  doc += `4. 🚀 We'll schedule the kick-off call!\n\n`;

  doc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  doc += `  Questions? Reply to this proposal or reach out directly.\n`;
  doc += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return {
    success: true,
    proposal_number: proposal.proposal_number,
    client: proposal.client_name,
    document: doc,
    word_count: doc.split(/\s+/).length
  };
}

function updateProposalStatus(proposalId, newStatus) {
  const proposals = readJSON(PATHS.proposals());
  const analytics = readJSON(PATHS.analytics(), []);
  const proposal = proposals.find(p => p.id === proposalId || p.id.startsWith(proposalId) || p.proposal_number === proposalId);

  if (!proposal) return { error: 'Proposal not found' };

  const validStatuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
  if (!validStatuses.includes(newStatus)) {
    return { error: `Invalid status. Use: ${validStatuses.join(', ')}` };
  }

  const oldStatus = proposal.status;
  proposal.status = newStatus;
  proposal.updated_at = new Date().toISOString();

  if (newStatus === 'sent') proposal.sent_at = new Date().toISOString();
  if (newStatus === 'viewed') proposal.viewed_at = new Date().toISOString();
  if (newStatus === 'accepted' || newStatus === 'rejected') proposal.responded_at = new Date().toISOString();

  // Track analytics
  analytics.push({
    proposal_id: proposal.id,
    proposal_number: proposal.proposal_number,
    action: `status_${newStatus}`,
    from_status: oldStatus,
    to_status: newStatus,
    timestamp: new Date().toISOString(),
    value: proposal.pricing ? proposal.pricing.total : null
  });

  writeJSON(PATHS.proposals(), proposals);
  writeJSON(PATHS.analytics(), analytics);

  const statusIcons = { draft: '📝', sent: '📤', viewed: '👁️', accepted: '✅', rejected: '❌', expired: '⏰' };
  return {
    success: true,
    proposal_number: proposal.proposal_number,
    message: `${statusIcons[newStatus]} Proposal ${proposal.proposal_number}: ${oldStatus} → ${newStatus}`,
    proposal
  };
}

function listProposals(opts = {}) {
  const proposals = readJSON(PATHS.proposals());
  let filtered = [...proposals];

  if (opts.status) filtered = filtered.filter(p => p.status === opts.status);
  if (opts.client) filtered = filtered.filter(p => p.client_name.toLowerCase().includes(opts.client.toLowerCase()));
  if (opts.template) filtered = filtered.filter(p => p.template_id === opts.template);

  // Check for expired proposals
  const today = new Date().toISOString().split('T')[0];
  for (const p of filtered) {
    if (p.status === 'sent' && p.valid_until < today) {
      p.status = 'expired';
    }
  }

  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const statusIcons = { draft: '📝', sent: '📤', viewed: '👁️', accepted: '✅', rejected: '❌', expired: '⏰' };
  return {
    total: filtered.length,
    proposals: filtered.map(p => ({
      number: p.proposal_number,
      icon: statusIcons[p.status],
      client: p.client_name,
      project: p.project_title,
      status: p.status,
      value: p.pricing ? `$${p.pricing.total.toFixed(0)}` : '—',
      valid_until: p.valid_until,
      created: p.created_at.split('T')[0],
      version: `v${p.version}`
    }))
  };
}

function duplicateProposal(proposalId, opts = {}) {
  const proposals = readJSON(PATHS.proposals());
  const original = proposals.find(p => p.id === proposalId || p.id.startsWith(proposalId) || p.proposal_number === proposalId);

  if (!original) return { error: 'Proposal not found' };

  const duplicate = {
    ...JSON.parse(JSON.stringify(original)),
    id: crypto.randomUUID(),
    proposal_number: `PROP-${(proposals.length + 1).toString().padStart(4, '0')}`,
    client_name: opts.client || original.client_name,
    project_title: opts.project || original.project_title,
    status: 'draft',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sent_at: null,
    viewed_at: null,
    responded_at: null,
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  };

  proposals.push(duplicate);
  writeJSON(PATHS.proposals(), proposals);

  return {
    success: true,
    proposal_number: duplicate.proposal_number,
    message: `📋 Duplicated from ${original.proposal_number} → ${duplicate.proposal_number}\n` +
             `Client: ${duplicate.client_name} | Project: ${duplicate.project_title}`,
    proposal_id: duplicate.id
  };
}

function calculatePrice(opts = {}) {
  const model = opts.model || 'fixed';
  const price = opts.price ? parseFloat(opts.price) : 0;
  const hours = opts.hours ? parseFloat(opts.hours) : 0;
  const discount = opts.discount ? parseFloat(opts.discount) : 0;

  if (model === 'hourly') {
    return PRICING_MODELS.hourly.calculate(price, hours, { discount });
  } else if (model === 'retainer') {
    return PRICING_MODELS.retainer.calculate(price, opts.months ? parseInt(opts.months) : 3, { discount });
  } else if (model === 'value_based') {
    return PRICING_MODELS.value_based.calculate(price, opts.multiplier ? parseFloat(opts.multiplier) : 0.1);
  } else if (model === 'milestone') {
    const milestones = opts.milestones ? opts.milestones.split('|').map(m => {
      const parts = m.split(':');
      return { name: parts[0].trim(), amount: parseFloat(parts[1]) };
    }) : [];
    return PRICING_MODELS.milestone.calculate(milestones);
  } else {
    return PRICING_MODELS.fixed.calculate(price, null, { discount });
  }
}

function getAnalytics(opts = {}) {
  const proposals = readJSON(PATHS.proposals());
  const analytics = readJSON(PATHS.analytics(), []);

  if (proposals.length === 0) return { message: 'No proposals to analyze.' };

  const total = proposals.length;
  const byStatus = {};
  for (const p of proposals) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }

  const accepted = proposals.filter(p => p.status === 'accepted');
  const rejected = proposals.filter(p => p.status === 'rejected');
  const sent = proposals.filter(p => p.sent_at);

  const winRate = sent.length > 0
    ? `${((accepted.length / (accepted.length + rejected.length || 1)) * 100).toFixed(1)}%`
    : 'N/A';

  const totalValue = accepted.reduce((sum, p) => sum + (p.pricing ? p.pricing.total : 0), 0);
  const avgValue = accepted.length > 0 ? totalValue / accepted.length : 0;

  // Average response time
  const responseTimes = proposals.filter(p => p.sent_at && p.responded_at).map(p => {
    return (new Date(p.responded_at) - new Date(p.sent_at)) / 86400000;
  });
  const avgResponseDays = responseTimes.length > 0
    ? (responseTimes.reduce((s, d) => s + d, 0) / responseTimes.length).toFixed(1)
    : 'N/A';

  // By template
  const byTemplate = {};
  for (const p of proposals) {
    if (!byTemplate[p.template_id]) byTemplate[p.template_id] = { total: 0, won: 0, value: 0 };
    byTemplate[p.template_id].total += 1;
    if (p.status === 'accepted') {
      byTemplate[p.template_id].won += 1;
      byTemplate[p.template_id].value += p.pricing ? p.pricing.total : 0;
    }
  }

  return {
    overview: {
      total_proposals: total,
      win_rate: winRate,
      total_won_value: `$${totalValue.toFixed(0)}`,
      avg_deal_size: `$${avgValue.toFixed(0)}`,
      avg_response_days: avgResponseDays
    },
    by_status: Object.entries(byStatus).map(([status, count]) => ({
      status,
      count,
      pct: `${((count / total) * 100).toFixed(0)}%`
    })),
    by_template: Object.entries(byTemplate).map(([template, data]) => ({
      template,
      proposals: data.total,
      won: data.won,
      win_rate: data.total > 0 ? `${((data.won / data.total) * 100).toFixed(0)}%` : 'N/A',
      revenue: `$${data.value.toFixed(0)}`
    })),
    insights: generateInsights(proposals)
  };
}

function generateInsights(proposals) {
  const insights = [];
  const sent = proposals.filter(p => p.sent_at);
  const accepted = proposals.filter(p => p.status === 'accepted');

  if (sent.length >= 5) {
    const rate = (accepted.length / sent.length) * 100;
    if (rate < 30) insights.push('⚠️ Win rate below 30% — consider revising pricing or qualification criteria');
    if (rate > 70) insights.push('🚀 Win rate above 70% — you might be underpricing. Test higher rates.');
  }

  const drafts = proposals.filter(p => p.status === 'draft');
  if (drafts.length > 3) {
    insights.push(`📝 ${drafts.length} unsent drafts — review and either send or archive`);
  }

  const expired = proposals.filter(p => p.status === 'expired');
  if (expired.length > 0) {
    insights.push(`⏰ ${expired.length} expired proposals — follow up or archive`);
  }

  return insights;
}

function listTemplates() {
  return {
    templates: Object.values(DEFAULT_TEMPLATES).map(t => ({
      id: t.id,
      name: t.name,
      sections: t.sections.length,
      scope_items: t.default_scope.length,
      milestones: t.suggested_milestones.length
    }))
  };
}

function configureSettings(opts = {}) {
  const settings = readJSON(PATHS.settings(), {});
  if (opts.name) settings.freelancer_name = opts.name;
  if (opts.business) settings.business_name = opts.business;
  if (opts.email) settings.email = opts.email;
  if (opts.website) settings.website = opts.website;
  if (opts.currency) settings.default_currency = opts.currency;
  if (opts.payment_terms) settings.default_payment_terms = opts.payment_terms;
  if (opts.validity_days) settings.default_validity_days = parseInt(opts.validity_days);
  settings.updated_at = new Date().toISOString();
  writeJSON(PATHS.settings(), settings);
  return { success: true, settings };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
📝 Proposal Templates with Dynamic Pricing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMANDS:
  create <client> <project>     Create new proposal
    --template <id>             Template: web_development|design|consulting|marketing
    --pricing-model <model>     Model: fixed|hourly|retainer|value_based|milestone
    --price <amount>            Base price / hourly rate
    --hours <n>                 Hours (for hourly model)
    --months <n>                Months (for retainer model)
    --discount <pct>            Discount percentage
    --packages <true|false>     Generate tier packages (default: true)
    --scope <item1|item2>       Scope items (pipe-separated)
    --timeline <text>           Project timeline
    --deadline <date>           Project deadline
    --payment-terms <text>      Payment terms
    --currency <code>           Currency
    --notes <text>              Notes

  generate <id|number>          Generate formatted proposal document
  status <id|number> <status>   Update status: draft|sent|viewed|accepted|rejected
  list                          List all proposals
    --status, --client, --template
  duplicate <id|number>         Duplicate a proposal
    --client, --project
  calculate                     Calculate pricing
    --model, --price, --hours, --discount, --months, --multiplier
    --milestones <name1:100|name2:200>

  templates                     List available templates
  analytics                     Proposal conversion analytics
  settings                      Configure defaults
    --name, --business, --email, --website, --currency, --payment-terms, --validity-days

  help                          Show this help

EXAMPLES:
  node proposal-templates.js create "Acme Corp" "E-Commerce Platform" --template web_development --price 15000 --pricing-model fixed
  node proposal-templates.js create "StartupXYZ" "Brand Design" --template design --price 5000 --packages true
  node proposal-templates.js generate PROP-0001
  node proposal-templates.js status PROP-0001 sent
  node proposal-templates.js calculate --model hourly --price 150 --hours 80 --discount 10
  node proposal-templates.js analytics
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printHelp();
    return;
  }

  const command = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  let result;

  switch (command) {
    case 'create':
      result = createProposal(args[1], args[2], {
        template: getFlag('--template'),
        pricing_model: getFlag('--pricing-model'),
        price: getFlag('--price'),
        hours: getFlag('--hours'),
        months: getFlag('--months'),
        discount: getFlag('--discount'),
        packages: getFlag('--packages'),
        basic_discount: getFlag('--basic-discount'),
        premium_markup: getFlag('--premium-markup'),
        scope: getFlag('--scope'),
        timeline: getFlag('--timeline'),
        deadline: getFlag('--deadline'),
        payment_terms: getFlag('--payment-terms'),
        currency: getFlag('--currency'),
        notes: getFlag('--notes'),
        name: getFlag('--name'),
        business: getFlag('--business'),
        valid_until: getFlag('--valid-until'),
        multiplier: getFlag('--multiplier'),
      });
      break;
    case 'generate':
      result = generateProposalDocument(args[1]);
      break;
    case 'status':
      result = updateProposalStatus(args[1], args[2]);
      break;
    case 'list':
      result = listProposals({
        status: getFlag('--status'),
        client: getFlag('--client'),
        template: getFlag('--template'),
      });
      break;
    case 'duplicate':
      result = duplicateProposal(args[1], {
        client: getFlag('--client'),
        project: getFlag('--project'),
      });
      break;
    case 'calculate':
      result = calculatePrice({
        model: getFlag('--model'),
        price: getFlag('--price'),
        hours: getFlag('--hours'),
        discount: getFlag('--discount'),
        months: getFlag('--months'),
        multiplier: getFlag('--multiplier'),
        milestones: getFlag('--milestones'),
      });
      break;
    case 'templates':
      result = listTemplates();
      break;
    case 'analytics':
      result = getAnalytics();
      break;
    case 'settings':
      result = configureSettings({
        name: getFlag('--name'),
        business: getFlag('--business'),
        email: getFlag('--email'),
        website: getFlag('--website'),
        currency: getFlag('--currency'),
        payment_terms: getFlag('--payment-terms'),
        validity_days: getFlag('--validity-days'),
      });
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
