const { stableIdFromString, clamp } = require('./utils');

function inferProjectType(project) {
  const t = (project?.type || project?.projectType || project?.category || '').toLowerCase();
  const name = (project?.name || project?.projectName || '').toLowerCase();
  const s = `${t} ${name}`;
  if (s.includes('website') || s.includes('landing') || s.includes('web')) return 'web';
  if (s.includes('mobile') || s.includes('ios') || s.includes('android') || s.includes('app')) return 'mobile';
  if (s.includes('api') || s.includes('backend') || s.includes('integration')) return 'backend';
  if (s.includes('seo') || s.includes('content') || s.includes('marketing')) return 'marketing';
  if (s.includes('data') || s.includes('analytics') || s.includes('dashboard')) return 'analytics';
  return 'general';
}

function inferClientType(client) {
  const t = (client?.type || client?.clientType || '').toLowerCase();
  if (t) return t;
  const tier = (client?.budgetTier || '').toString().toLowerCase();
  if (tier.includes('enterprise')) return 'enterprise';
  if (tier.includes('startup') || tier.includes('small')) return 'startup';
  return 'smb';
}

function confidenceFromScore(score) {
  return clamp(score / 100, 0.1, 0.95);
}

function makeOffer({ kind, title, description, pricingModel, why, effort = 'small', confidence = 0.6, tags = [] }) {
  return {
    id: stableIdFromString(`${kind}-${title}`),
    kind,
    title,
    description,
    pricingModel,
    why,
    effort,
    confidence: Math.round(confidence * 100) / 100,
    tags,
  };
}

/**
 * OfferGenerator (CFX-078)
 * Returns 3-5 tailored upsell offers.
 */
function generateOffers({ client, project, scoreResult, signals = {} }) {
  const projectType = inferProjectType(project);
  const clientType = inferClientType(client);

  const score = scoreResult?.score ?? 50;
  const baseConf = confidenceFromScore(score);

  const adminBurden = signals.timeSignals?.adminBurden01 ?? null; // 0-1 (higher = worse)
  const effectiveRate = signals.timeSignals?.effectiveRate ?? null;
  const skillGaps = Array.isArray(signals.skillGaps) ? signals.skillGaps : [];
  const competitive = Array.isArray(signals.competitive) ? signals.competitive : [];

  const offers = [];

  // 1) Retainer
  offers.push(makeOffer({
    kind: 'retainer',
    title: projectType === 'marketing' ? 'Growth & content retainer' : 'Product/engineering retainer',
    description: 'A fixed monthly package for continuous improvements, faster turnaround, and proactive monitoring.',
    pricingModel: clientType === 'enterprise' ? 'monthly (tiered)' : 'monthly (fixed)',
    why: 'Smooths delivery, reduces context switching, and makes planning easier for both sides.',
    effort: 'medium',
    confidence: baseConf,
    tags: [projectType, clientType]
  }));

  // 2) Maintenance
  offers.push(makeOffer({
    kind: 'maintenance',
    title: projectType === 'web' ? 'Website maintenance + uptime monitoring' : 'Maintenance + incident response',
    description: 'Lightweight monthly maintenance: updates, monitoring, small fixes, and a rapid-response SLA.',
    pricingModel: 'monthly (SLA add-on)',
    why: 'Natural next step after delivery; protects their investment and prevents fire drills.',
    effort: 'small',
    confidence: baseConf * 0.95,
    tags: ['maintenance', projectType]
  }));

  // 3) Optimization (performance / conversion)
  if (['web', 'mobile', 'backend'].includes(projectType)) {
    offers.push(makeOffer({
      kind: 'optimization',
      title: projectType === 'web' ? 'Performance + conversion optimization sprint' : 'Performance optimization sprint',
      description: 'A 1–2 week sprint focused on measurable wins (speed, reliability, funnel, or API latency).',
      pricingModel: 'one-time (sprint)',
      why: 'Easy to justify with KPIs; builds on what already exists.',
      effort: 'medium',
      confidence: baseConf * 0.9,
      tags: ['optimization', projectType]
    }));
  }

  // 4) Add-on feature (based on competitive / gaps)
  const compHint = competitive.find(x => String(x?.recommendation || x?.feature || '').length > 0);
  const addOnTitle = compHint
    ? `Add-on: ${compHint.recommendation || compHint.feature}`
    : (projectType === 'analytics' ? 'Add-on: executive dashboard' : 'Add-on: a high-leverage feature');

  offers.push(makeOffer({
    kind: 'add_on_feature',
    title: addOnTitle,
    description: 'A targeted feature that increases value without reopening the entire scope.',
    pricingModel: 'one-time (fixed scope)',
    why: compHint ? 'Competitive positioning improvement based on market signals.' : 'Keeps momentum and increases ROI from the existing system.',
    effort: 'medium',
    confidence: baseConf * 0.85,
    tags: ['add-on', projectType]
  }));

  // 5) Training / enablement
  offers.push(makeOffer({
    kind: 'training',
    title: 'Team training + handover workshop',
    description: 'A live session + documentation package so their team can operate the system confidently.',
    pricingModel: 'one-time (workshop)',
    why: 'Reduces support load and increases adoption; especially good after milestones.',
    effort: 'small',
    confidence: baseConf * 0.8,
    tags: ['training']
  }));

  // 6) Analytics / reporting (optional, replace if too many)
  offers.push(makeOffer({
    kind: 'analytics',
    title: 'Analytics + monthly insights report',
    description: 'Instrument key events and deliver a monthly report with recommendations.',
    pricingModel: 'monthly (reporting)',
    why: 'Turns delivery into ongoing decision support; improves retention and LTV.',
    effort: 'medium',
    confidence: baseConf * 0.85,
    tags: ['analytics']
  }));

  // Tailor / prune to 3-5.
  // If admin burden is high, prefer retainer/maintenance/training.
  let ranked = offers;
  if (adminBurden !== null && adminBurden > 0.6) {
    ranked = offers
      .slice()
      .sort((a, b) => {
        const aBoost = ['retainer', 'maintenance', 'training'].includes(a.kind) ? 1 : 0;
        const bBoost = ['retainer', 'maintenance', 'training'].includes(b.kind) ? 1 : 0;
        return bBoost - aBoost;
      });
  }

  // If there are skill gaps, avoid very complex add-ons.
  if (skillGaps.length > 0) {
    ranked = ranked.map(o => {
      if (o.kind === 'add_on_feature') {
        return { ...o, effort: 'medium', confidence: Math.round(o.confidence * 0.95 * 100) / 100 };
      }
      return o;
    });
  }

  // If effective rate is low, push retainer/optimization.
  if (effectiveRate !== null && effectiveRate < 50) {
    ranked = ranked
      .slice()
      .sort((a, b) => {
        const aBoost = ['retainer', 'optimization'].includes(a.kind) ? 1 : 0;
        const bBoost = ['retainer', 'optimization'].includes(b.kind) ? 1 : 0;
        return bBoost - aBoost;
      });
  }

  // Unique by kind, then take top 5.
  const seen = new Set();
  const out = [];
  for (const o of ranked) {
    if (seen.has(o.kind)) continue;
    seen.add(o.kind);
    out.push(o);
    if (out.length >= 5) break;
  }

  return {
    clientType,
    projectType,
    offers: out,
  };
}

module.exports = {
  generateOffers,
};
