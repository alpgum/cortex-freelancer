const os = require('os');
const path = require('path');
const { readJson } = require('./utils');

function defaultProjectRoot() {
  // scope-creep-detection/* -> src/tools/scope-creep-detection
  // project root is 4 levels up
  return path.resolve(__dirname, '..', '..', '..', '..');
}

function loadTimeEntries({ projectRoot } = {}) {
  const root = projectRoot || defaultProjectRoot();
  const file = path.join(root, 'data', 'time_tracking', 'time_entries.json');
  const entries = readJson(file, []);
  return { file, entries: Array.isArray(entries) ? entries : [] };
}

function loadP2DWorkflows() {
  const file = path.join(os.homedir(), '.cortex-freelancer', 'p2d', 'workflows.json');
  const store = readJson(file, { workflows: {} });
  const workflows = store && store.workflows ? Object.values(store.workflows) : [];
  return { file, workflows };
}

function loadCommunications() {
  const base = path.join(os.homedir(), '.cortex-freelancer', 'communications');
  const messagesFile = path.join(base, 'messages.json');
  const responsesFile = path.join(base, 'responses.json');
  const messages = readJson(messagesFile, []);
  const responses = readJson(responsesFile, []);
  return {
    base,
    messagesFile,
    responsesFile,
    messages: Array.isArray(messages) ? messages : [],
    responses: Array.isArray(responses) ? responses : [],
  };
}

function loadMilestoneEvents() {
  const file = path.join(os.homedir(), '.cortex-freelancer', 'scope-creep', 'milestone-events.json');
  const events = readJson(file, []);
  return { file, events: Array.isArray(events) ? events : [] };
}

module.exports = {
  defaultProjectRoot,
  loadTimeEntries,
  loadP2DWorkflows,
  loadCommunications,
  loadMilestoneEvents,
};
