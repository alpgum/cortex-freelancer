import { ConversionFunnelTracker } from '../funnel';

describe('ConversionFunnelTracker', () => {
  test('analyzeConversionFunnel computes overall conversion rate', async () => {
    const tracker = new ConversionFunnelTracker();

    // Two prospects
    await tracker.initializeTracking('s1', 'c1');
    await tracker.initializeTracking('s2', 'c2');

    // One converts
    await tracker.trackStepCompletion('s1', 'c1', 'd1', 'First Deliverable', 120);

    const analysis = await tracker.analyzeConversionFunnel();
    expect(analysis.totalProspects).toBe(2);
    expect(analysis.overallConversionRate).toBeCloseTo(50, 5);
  });

  test('identifyFrictionPoints returns highest impact issues first', async () => {
    const tracker = new ConversionFunnelTracker();
    await tracker.initializeTracking('s1', 'c1');

    await tracker.trackStepStart('s1', 'c1', 'q1', 'Intake Questionnaire');
    await tracker.trackStepDropoff('s1', 'c1', 'q1', 'Intake Questionnaire', 'too long');

    const frictions = await tracker.identifyFrictionPoints();
    expect(frictions.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(frictions[0].impact);
  });
});
