import { TemplateLibrary, ClientType } from '../templates';
import { IntakeAutomation } from '../intake';
import { MetricsTracker } from '../metrics';
import os from 'os';
import path from 'path';
import fs from 'fs';

describe('TemplateLibrary', () => {
  test('personalizeContent replaces variables', () => {
    const lib = new TemplateLibrary();
    const out = lib.personalizeContent('Hi {{ clientName }}', { clientName: 'Alice' });
    expect(out).toBe('Hi Alice');
  });

  test('getTemplateForClient returns a template for SMB', () => {
    const lib = new TemplateLibrary();
    const tpl = lib.getTemplateForClient(ClientType.SMB);
    expect(tpl.clientType).toBe(ClientType.SMB);
  });
});

describe('IntakeAutomation', () => {
  test('processClient assigns Individual when no company', async () => {
    const intake = new IntakeAutomation();
    const profile = await intake.processClient({ name: 'Bob', email: 'bob@example.com' });
    expect(profile.type).toBe(ClientType.INDIVIDUAL);
  });
});

describe('MetricsTracker', () => {
  test('getMetrics computes completion rate and dropoff', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onboarding-metrics-'));
    const tracker = new MetricsTracker(dir);

    tracker.trackEvent({ sequenceId: 's1', clientId: 'c1', name: 'Onboarding Started', type: 'started', at: new Date('2026-03-01T00:00:00Z') });
    tracker.trackEvent({ sequenceId: 's1', clientId: 'c1', name: 'Kickoff Meeting', type: 'completed', at: new Date('2026-03-03T00:00:00Z') });
    tracker.trackEvent({ sequenceId: 's1', clientId: 'c1', name: 'First Deliverable', type: 'completed', at: new Date('2026-03-05T00:00:00Z') });

    tracker.trackEvent({ sequenceId: 's2', clientId: 'c2', name: 'Onboarding Started', type: 'started', at: new Date('2026-03-01T00:00:00Z') });
    tracker.trackEvent({ sequenceId: 's2', clientId: 'c2', name: 'Contract Signing', type: 'started', at: new Date('2026-03-02T00:00:00Z') });
    tracker.trackEvent({ sequenceId: 's2', clientId: 'c2', name: 'Contract Signing', type: 'dropped_off', at: new Date('2026-03-04T00:00:00Z') });

    const m = await tracker.getMetrics();
    expect(m.totalSequences).toBe(2);
    expect(m.completedSequences).toBe(1);
    expect(m.completionRate).toBeCloseTo(0.5, 5);
    expect(m.dropoffByStep['Contract Signing'].dropoffRate).toBeCloseTo(1, 5);
  });
});
