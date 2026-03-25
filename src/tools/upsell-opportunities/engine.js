const { scoreUpsellOpportunity } = require('./scorer');
const { generateOffers } = require('./offer-generator');
const { optimizeTiming } = require('./timing-optimizer');
const { stableIdFromString, isoNow } = require('./utils');

function aggregateSignalsForClient({ client, timeEntries, milestones, invoices, skillGaps, competitive }) {
  // Time signals
  const te = Array.isArray(timeEntries) ? timeEntries : [];
  const clientId = client.id || client.clientId || null;

  const clientEntries = clientId
    ? te.filter(e => (e.clientId && e.clientId === clientId) || (e.client && e.client === clientId) || (e.client_name && e.client_name === client.name))
    : te.filter(e => e.client_name && client.name && e.client_name === client.name);

  const totalSeconds = clientEntries.reduce((s, e) => s + (Number(e.duration_seconds || e.durationSeconds || 0) || 0), 0);
  const adminSeconds = clientEntries
    .filter(e => {
      const task = String(e.task || '').toLowerCase();
      const tags = Array.isArray(e.tags) ? e.tags.map(t => String(t).toLowerCase()) : [];
      return task.includes('admin') || task.includes('email') || task.includes('invoic') || tags.includes('admin');
    })
    .reduce((s, e) => s + (Number(e.duration_seconds || e.durationSeconds || 0) || 0), 0);

  const adminBurden01 = totalSeconds > 0 ? adminSeconds / totalSeconds : null;

  // Effective rate (if amount exists in entry notes/fields)
  const revenue = clientEntries.reduce((s, e) => s + (Number(e.amount || e.revenue || 0) || 0), 0);
  const hours = totalSeconds / 3600;
  const effectiveRate = hours > 0 && revenue > 0 ? revenue / hours : null;

  // Capacity: allow client to override, otherwise null (scorer will ignore)
  const weeklyCapacityHours = client.weeklyCapacityHours ?? null;
  const weeklyAllocatedHours = client.weeklyAllocatedHours ?? null;

  // Milestones
  const ms = Array.isArray(milestones) ? milestones : [];
  const clientMilestones = clientId
    ? ms.filter(m => m.clientId === clientId)
    : ms.filter(m => client.name && m.clientName === client.name);

  const delivered = clientMilestones.filter(m => (m.status || '').toLowerCase() === 'delivered' || (m.status || '').toLowerCase() === 'completed');
  const plannedCount = clientMilestones.length || (client.plannedMilestonesCount ?? null);

  // Payments
  const inv = Array.isArray(invoices) ? invoices : [];
  const clientInvoices = clientId
    ? inv.filter(i => i.clientId === clientId)
    : inv.filter(i => client.name && i.clientName === client.name);

  const paid = clientInvoices.filter(i => (i.status || '').toLowerCase() === 'paid');
  const overdue = clientInvoices.filter(i => ['overdue', 'late'].includes(String(i.status || '').toLowerCase()));

  const onTimeRate = clientInvoices.length ? paid.length / clientInvoices.length : null;
  const overdueRisk = clientInvoices.length ? overdue.length / clientInvoices.length : null;
  const lastPaidAt = paid
    .map(i => i.paidAt || i.paid_at || i.updatedAt)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || null;

  // Risks
  const scopeCreepRisk = client.scopeCreepRisk ?? null; // integration point to CFX-075

  return {
    timeSignals: {
      adminBurden01,
      effectiveRate,
      weeklyCapacityHours,
      weeklyAllocatedHours,
    },
    milestones: {
      delivered,
      plannedCount,
    },
    payments: {
      onTimeRate,
      overdueRisk,
      lastPaidAt,
    },
    risks: {
      scopeCreepRisk,
    },
    skillGaps: Array.isArray(skillGaps) ? skillGaps.filter(g => !clientId || g.clientId === clientId) : [],
    competitive: Array.isArray(competitive) ? competitive.filter(c => !clientId || c.clientId === clientId) : [],
  };
}

function buildOpportunity({ client, signals, nowIso }) {
  const scoreResult = scoreUpsellOpportunity({
    nowIso,
    client,
    milestones: signals.milestones,
    payments: signals.payments,
    timeSignals: signals.timeSignals,
    risks: signals.risks,
  });

  // Simplified project placeholder — can be wired to lifecycle/workflow later.
  const project = client.activeProject || client.project || null;

  const offerResult = generateOffers({ client, project, scoreResult, signals });
  const timing = optimizeTiming({
    nowIso,
    milestones: signals.milestones,
    payments: signals.payments,
    project: project || {},
    client,
    scoreResult,
  });

  const opportunityId = stableIdFromString(`${client.id || client.clientId || client.name || 'client'}-${nowIso}`);

  return {
    id: opportunityId,
    clientId: client.id || client.clientId || stableIdFromString(client.name || 'client'),
    clientName: client.name || client.clientName || null,
    createdAt: nowIso,
    score: scoreResult.score,
    band: scoreResult.band,
    drivers: scoreResult.drivers,
    offers: offerResult.offers,
    timing,
  };
}

function scanAll({ clients, timeEntries, milestones, invoices, skillGaps, competitive, nowIso }) {
  const now = nowIso || isoNow();
  const out = [];
  for (const client of (Array.isArray(clients) ? clients : [])) {
    const signals = aggregateSignalsForClient({
      client,
      timeEntries,
      milestones,
      invoices,
      skillGaps,
      competitive,
    });
    out.push(buildOpportunity({ client, signals, nowIso: now }));
  }

  // Sort by score desc
  out.sort((a, b) => b.score - a.score);
  return out;
}

module.exports = {
  aggregateSignalsForClient,
  buildOpportunity,
  scanAll,
};
