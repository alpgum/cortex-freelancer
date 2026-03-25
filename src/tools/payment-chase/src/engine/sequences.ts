import { ChaseSequence, EscalationLevel } from '../types';

/**
 * Default chase sequences. These can be customized per client or situation.
 */
export const DEFAULT_CHASE_SEQUENCE: ChaseSequence = {
  id: 'default',
  name: 'Standard Chase Sequence',
  description: 'Balanced approach: friendly start, escalating over 60 days',
  isDefault: true,
  steps: [
    {
      escalation: EscalationLevel.FriendlyReminder,
      daysAfterDue: 3,
      maxAttempts: 2,
      channels: ['email'],
      templateId: 'default-friendly-email',
    },
    {
      escalation: EscalationLevel.FriendlyReminder,
      daysAfterDue: 7,
      maxAttempts: 1,
      channels: ['email', 'sms'],
      templateId: 'default-friendly-sms',
    },
    {
      escalation: EscalationLevel.FirmFollowUp,
      daysAfterDue: 14,
      maxAttempts: 2,
      channels: ['email'],
      templateId: 'default-firm-email',
    },
    {
      escalation: EscalationLevel.FormalNotice,
      daysAfterDue: 30,
      maxAttempts: 1,
      channels: ['email'],
      templateId: 'default-formal-email',
    },
    {
      escalation: EscalationLevel.FinalWarning,
      daysAfterDue: 45,
      maxAttempts: 1,
      channels: ['email'],
      templateId: 'default-final-email',
    },
    {
      escalation: EscalationLevel.CollectionsReferral,
      daysAfterDue: 60,
      maxAttempts: 1,
      channels: ['email'],
      templateId: 'default-collections-email',
    },
  ],
};

export const RELAXED_CHASE_SEQUENCE: ChaseSequence = {
  id: 'relaxed',
  name: 'Relaxed Chase Sequence',
  description: 'For reliable clients: longer intervals, friendlier tone',
  isDefault: false,
  steps: [
    {
      escalation: EscalationLevel.FriendlyReminder,
      daysAfterDue: 7,
      maxAttempts: 2,
      channels: ['email'],
      templateId: 'default-friendly-email',
    },
    {
      escalation: EscalationLevel.FirmFollowUp,
      daysAfterDue: 21,
      maxAttempts: 2,
      channels: ['email'],
      templateId: 'default-firm-email',
    },
    {
      escalation: EscalationLevel.FormalNotice,
      daysAfterDue: 45,
      maxAttempts: 1,
      channels: ['email'],
      templateId: 'default-formal-email',
    },
    {
      escalation: EscalationLevel.FinalWarning,
      daysAfterDue: 60,
      maxAttempts: 1,
      channels: ['email'],
      templateId: 'default-final-email',
    },
  ],
};

export const AGGRESSIVE_CHASE_SEQUENCE: ChaseSequence = {
  id: 'aggressive',
  name: 'Aggressive Chase Sequence',
  description: 'For unreliable clients: shorter intervals, faster escalation',
  isDefault: false,
  steps: [
    {
      escalation: EscalationLevel.FriendlyReminder,
      daysAfterDue: 1,
      maxAttempts: 1,
      channels: ['email', 'sms'],
      templateId: 'default-friendly-email',
    },
    {
      escalation: EscalationLevel.FirmFollowUp,
      daysAfterDue: 5,
      maxAttempts: 2,
      channels: ['email', 'sms'],
      templateId: 'default-firm-email',
    },
    {
      escalation: EscalationLevel.FormalNotice,
      daysAfterDue: 14,
      maxAttempts: 1,
      channels: ['email', 'phone'],
      templateId: 'default-formal-email',
    },
    {
      escalation: EscalationLevel.FinalWarning,
      daysAfterDue: 21,
      maxAttempts: 1,
      channels: ['email', 'letter'],
      templateId: 'default-final-email',
    },
    {
      escalation: EscalationLevel.CollectionsReferral,
      daysAfterDue: 30,
      maxAttempts: 1,
      channels: ['email'],
      templateId: 'default-collections-email',
    },
  ],
};

export const ALL_DEFAULT_SEQUENCES = [
  DEFAULT_CHASE_SEQUENCE,
  RELAXED_CHASE_SEQUENCE,
  AGGRESSIVE_CHASE_SEQUENCE,
];
