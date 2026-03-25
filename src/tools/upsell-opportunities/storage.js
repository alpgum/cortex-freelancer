const os = require('os');
const path = require('path');
const { readJson, writeJson, stableIdFromString, isoNow } = require('./utils');

function baseDir() {
  return path.join(os.homedir(), '.cortex-freelancer', 'upsell');
}

function opportunitiesFile() {
  return path.join(baseDir(), 'opportunities.json');
}

function outcomesFile() {
  return path.join(baseDir(), 'outcomes.json');
}

function loadOpportunities() {
  const fp = opportunitiesFile();
  const store = readJson(fp, { opportunities: {} });
  return {
    file: fp,
    opportunities: store && store.opportunities ? store.opportunities : {},
  };
}

function saveOpportunities(opportunities) {
  const fp = opportunitiesFile();
  writeJson(fp, { opportunities, updatedAt: isoNow() });
  return fp;
}

function loadOutcomes() {
  const fp = outcomesFile();
  const store = readJson(fp, { outcomes: [] });
  return {
    file: fp,
    outcomes: store && Array.isArray(store.outcomes) ? store.outcomes : [],
  };
}

function appendOutcome(outcome) {
  const { outcomes } = loadOutcomes();
  const enriched = {
    id: outcome.id || stableIdFromString(`${outcome.clientId || 'client'}-${outcome.opportunityId || 'opp'}-${isoNow()}`),
    createdAt: isoNow(),
    ...outcome,
  };
  outcomes.push(enriched);
  const fp = outcomesFile();
  writeJson(fp, { outcomes, updatedAt: isoNow() });
  return { file: fp, outcome: enriched };
}

module.exports = {
  baseDir,
  loadOpportunities,
  saveOpportunities,
  loadOutcomes,
  appendOutcome,
};
