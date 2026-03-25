import { OnboardingSequenceBuilder, OnboardingStepStatus } from '../sequences';
import { ClientType } from '../templates';

describe('OnboardingSequenceBuilder', () => {
  test('buildStandardSequence creates 7 steps and progress starts at 0%', () => {
    const builder = new OnboardingSequenceBuilder();
    const seq = builder.buildStandardSequence({
      id: 'c1',
      name: 'Acme',
      type: ClientType.SMB,
      projectType: 'web_development'
    });

    expect(seq.steps).toHaveLength(7);
    expect(builder.getProgressPercentage(seq)).toBe(0);
    expect(builder.getCurrentStep(seq)?.name).toBe('Welcome Email');
  });

  test('getProgressPercentage reflects completed steps', () => {
    const builder = new OnboardingSequenceBuilder();
    const seq = builder.buildStandardSequence({ id: 'c1', name: 'Acme', type: ClientType.SMB });

    seq.steps[0].status = OnboardingStepStatus.COMPLETED;
    seq.steps[1].status = OnboardingStepStatus.COMPLETED;

    expect(builder.getProgressPercentage(seq)).toBe(Math.round((2 / 7) * 100));
  });
});
