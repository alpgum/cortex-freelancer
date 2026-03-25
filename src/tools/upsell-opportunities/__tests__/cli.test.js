const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// CLI test runs the actual script and checks output.

describe('CFX-078 CLI', () => {
  const cliPath = path.join(__dirname, '..', 'cli.js');
  let tmpHome;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-upsell-home-'));
    process.env.HOME = tmpHome;

    // Seed CRM clients
    const crmDir = path.join(tmpHome, '.cortex-freelancer', 'crm');
    fs.mkdirSync(crmDir, { recursive: true });
    fs.writeFileSync(
      path.join(crmDir, 'clients.json'),
      JSON.stringify([
        {
          id: 'client-1',
          name: 'Acme',
          relationshipScore: 82,
          satisfactionFlags: ['happy'],
          budgetTier: 'mid',
          weeklyCapacityHours: 40,
          weeklyAllocatedHours: 20,
          scopeCreepRisk: 10,
          activeProject: { projectName: 'Website Redesign', type: 'web' }
        }
      ], null, 2)
    );

    // Seed milestones
    const msDir = path.join(tmpHome, '.cortex-freelancer', 'milestones');
    fs.mkdirSync(msDir, { recursive: true });
    fs.writeFileSync(
      path.join(msDir, 'milestones.json'),
      JSON.stringify([
        { id: 'm1', clientId: 'client-1', status: 'delivered', deliveredAt: '2026-03-24T00:00:00.000Z' }
      ], null, 2)
    );

    // Seed payments
    const payDir = path.join(tmpHome, '.cortex-freelancer', 'payments');
    fs.mkdirSync(payDir, { recursive: true });
    fs.writeFileSync(
      path.join(payDir, 'invoices.json'),
      JSON.stringify([
        { id: 'i1', clientId: 'client-1', status: 'paid', paidAt: '2026-03-22T00:00:00.000Z' }
      ], null, 2)
    );
  });

  test('recommend prints offers and timing', () => {
    const out = execFileSync('node', [cliPath, 'recommend', '--client', 'Acme', '--project-root', path.join(__dirname, '..', '..', '..', '..')], {
      encoding: 'utf8',
      env: { ...process.env, HOME: tmpHome }
    });

    expect(out).toContain('Client: Acme');
    expect(out).toContain('Offers:');
    expect(out).toMatch(/Best timing window:/);
  });
});
