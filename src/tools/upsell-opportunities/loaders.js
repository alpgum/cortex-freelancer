const os = require('os');
const path = require('path');
const { readJson } = require('./utils');

function defaultProjectRoot() {
  // src/tools/upsell-opportunities/* -> src/tools/upsell-opportunities
  // project root is 4 levels up
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function loadClients({ projectRoot } = {}) {
  const root = projectRoot || defaultProjectRoot();

  // Prefer user-local CRM store (integration-ready), fallback to repo data.
  const userFile = path.join(os.homedir(), '.cortex-freelancer', 'crm', 'clients.json');
  const repoFile = path.join(root, 'data', 'crm', 'clients.json');

  const fromUser = readJson(userFile, null);
  const fromRepo = readJson(repoFile, null);

  const clients = Array.isArray(fromUser) ? fromUser : (Array.isArray(fromRepo) ? fromRepo : []);

  return { userFile, repoFile, clients };
}

function loadTimeTracking({ projectRoot } = {}) {
  const root = projectRoot || defaultProjectRoot();
  const file = path.join(root, 'data', 'time_tracking', 'time_entries.json');
  const entries = readJson(file, []);
  return { file, entries: Array.isArray(entries) ? entries : [] };
}

function loadMilestones() {
  const file = path.join(os.homedir(), '.cortex-freelancer', 'milestones', 'milestones.json');
  const milestones = readJson(file, []);
  return { file, milestones: Array.isArray(milestones) ? milestones : [] };
}

function loadPayments() {
  const file = path.join(os.homedir(), '.cortex-freelancer', 'payments', 'invoices.json');
  const invoices = readJson(file, []);
  return { file, invoices: Array.isArray(invoices) ? invoices : [] };
}

function loadCompetitiveSignals() {
  const file = path.join(os.homedir(), '.cortex-freelancer', 'competitive', 'insights.json');
  const insights = readJson(file, []);
  return { file, insights: Array.isArray(insights) ? insights : [] };
}

function loadSkillGapSignals() {
  const file = path.join(os.homedir(), '.cortex-freelancer', 'skill-gap', 'gaps.json');
  const gaps = readJson(file, []);
  return { file, gaps: Array.isArray(gaps) ? gaps : [] };
}

module.exports = {
  defaultProjectRoot,
  loadClients,
  loadTimeTracking,
  loadMilestones,
  loadPayments,
  loadCompetitiveSignals,
  loadSkillGapSignals,
};
