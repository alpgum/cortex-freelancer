/**
 * Onboarding Sequence Builder
 * 
 * Define multi-step onboarding sequences with templates, timing rules, 
 * and fallback actions.
 */

import { v4 as uuidv4 } from 'uuid';
import { SmartTimingEngine } from './timing';

export enum OnboardingStepType {
  EMAIL = 'email',
  QUESTIONNAIRE = 'questionnaire', 
  DOCUMENT_REVIEW = 'document_review',
  CONTRACT_SIGNING = 'contract_signing',
  PAYMENT_SETUP = 'payment_setup',
  MEETING = 'meeting',
  DELIVERABLE = 'deliverable'
}

export enum OnboardingStepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed'
}

export interface OnboardingStep {
  id: string;
  name: string;
  type: OnboardingStepType;
  description: string;
  templateId?: string;
  dependencies: string[]; // Step IDs that must complete first
  timingRules: {
    delayAfterPrevious?: number; // Minutes to wait after previous step
    deadlineHours?: number; // Max hours to complete
    businessHoursOnly?: boolean;
    followUpIntervals?: number[]; // Follow-up reminder intervals
  };
  fallbackActions: {
    onTimeout?: string; // Action to take if deadline exceeded
    onFailure?: string; // Action to take if step fails
  };
  automatable: boolean;
  priority: number; // 1-5, 1 being highest
  estimatedDuration: number; // Minutes
  status: OnboardingStepStatus;
  startedAt?: Date;
  completedAt?: Date;
  data?: Record<string, any>; // Step-specific data
}

export interface OnboardingSequence {
  id: string;
  clientId: string;
  name: string;
  templateId?: string;
  steps: OnboardingStep[];
  currentStepIndex: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expectedCompletionDate?: Date;
  actualCompletionDate?: Date;
  metadata: {
    clientType: string;
    projectType: string;
    estimatedBudget?: number;
    timeline?: string;
    priority: number;
  };
}

export class OnboardingSequenceBuilder {
  private timingEngine: SmartTimingEngine;

  constructor() {
    this.timingEngine = new SmartTimingEngine();
  }

  // Create a new onboarding sequence from template
  buildSequence(
    template: any, 
    clientProfile: any, 
    customizations?: Partial<OnboardingSequence>
  ): OnboardingSequence {
    const sequenceId = uuidv4();
    
    const sequence: OnboardingSequence = {
      id: sequenceId,
      clientId: clientProfile.id,
      name: template.name || `${clientProfile.name} Onboarding`,
      templateId: template.id,
      steps: this.buildStepsFromTemplate(template, clientProfile),
      currentStepIndex: 0,
      status: 'active',
      createdAt: new Date(),
      expectedCompletionDate: this.calculateExpectedCompletion(template.steps),
      metadata: {
        clientType: clientProfile.type,
        projectType: clientProfile.projectType,
        estimatedBudget: clientProfile.budget,
        timeline: clientProfile.timeline,
        priority: clientProfile.priority || 3
      },
      ...customizations
    };

    return sequence;
  }

  // Build standard onboarding sequence
  buildStandardSequence(clientProfile: any): OnboardingSequence {
    const steps: OnboardingStep[] = [
      {
        id: uuidv4(),
        name: 'Welcome Email',
        type: OnboardingStepType.EMAIL,
        description: 'Send personalized welcome email with next steps',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 0, // Immediate
          businessHoursOnly: false
        },
        fallbackActions: {},
        automatable: true,
        priority: 1,
        estimatedDuration: 5,
        status: OnboardingStepStatus.PENDING
      },
      {
        id: uuidv4(),
        name: 'Intake Questionnaire',
        type: OnboardingStepType.QUESTIONNAIRE,
        description: 'Client completes detailed project requirements questionnaire',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 60, // 1 hour after welcome
          deadlineHours: 72, // 3 days to complete
          businessHoursOnly: true,
          followUpIntervals: [24, 48] // Remind after 1 and 2 days
        },
        fallbackActions: {
          onTimeout: 'send_personal_follow_up'
        },
        automatable: false,
        priority: 1,
        estimatedDuration: 30,
        status: OnboardingStepStatus.PENDING
      },
      {
        id: uuidv4(),
        name: 'Project Brief Review',
        type: OnboardingStepType.DOCUMENT_REVIEW,
        description: 'Review questionnaire and create project brief for approval',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 120, // 2 hours to review
          deadlineHours: 24,
          businessHoursOnly: true
        },
        fallbackActions: {
          onTimeout: 'escalate_to_senior'
        },
        automatable: false,
        priority: 2,
        estimatedDuration: 60,
        status: OnboardingStepStatus.PENDING
      },
      {
        id: uuidv4(),
        name: 'Contract Signing',
        type: OnboardingStepType.CONTRACT_SIGNING,
        description: 'Client reviews and signs project contract',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 30, // 30 min after brief approval
          deadlineHours: 120, // 5 days to sign
          businessHoursOnly: true,
          followUpIntervals: [48, 96] // Remind after 2 and 4 days
        },
        fallbackActions: {
          onTimeout: 'schedule_call'
        },
        automatable: true,
        priority: 1,
        estimatedDuration: 15,
        status: OnboardingStepStatus.PENDING
      },
      {
        id: uuidv4(),
        name: 'Payment Setup',
        type: OnboardingStepType.PAYMENT_SETUP,
        description: 'Process initial payment and set up billing',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 0, // Immediate after contract
          deadlineHours: 48,
          businessHoursOnly: true,
          followUpIntervals: [24]
        },
        fallbackActions: {
          onTimeout: 'send_payment_reminder'
        },
        automatable: true,
        priority: 1,
        estimatedDuration: 10,
        status: OnboardingStepStatus.PENDING
      },
      {
        id: uuidv4(),
        name: 'Kickoff Meeting',
        type: OnboardingStepType.MEETING,
        description: 'Schedule and conduct project kickoff meeting',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 60, // 1 hour after payment
          deadlineHours: 72,
          businessHoursOnly: true
        },
        fallbackActions: {
          onTimeout: 'suggest_alternative_times'
        },
        automatable: false,
        priority: 2,
        estimatedDuration: 60,
        status: OnboardingStepStatus.PENDING
      },
      {
        id: uuidv4(),
        name: 'First Deliverable',
        type: OnboardingStepType.DELIVERABLE,
        description: 'Deliver initial project milestone or wireframes',
        dependencies: [],
        timingRules: {
          delayAfterPrevious: 1440, // 24 hours after kickoff
          deadlineHours: 168, // 1 week
          businessHoursOnly: true,
          followUpIntervals: [96] // Remind after 4 days
        },
        fallbackActions: {
          onTimeout: 'send_progress_update'
        },
        automatable: false,
        priority: 3,
        estimatedDuration: 480, // 8 hours
        status: OnboardingStepStatus.PENDING
      }
    ];

    return {
      id: uuidv4(),
      clientId: clientProfile.id,
      name: `${clientProfile.name} Standard Onboarding`,
      steps,
      currentStepIndex: 0,
      status: 'active',
      createdAt: new Date(),
      expectedCompletionDate: this.calculateExpectedCompletion(steps),
      metadata: {
        clientType: clientProfile.type,
        projectType: clientProfile.projectType || 'general',
        estimatedBudget: clientProfile.budget,
        timeline: clientProfile.timeline,
        priority: clientProfile.priority || 3
      }
    };
  }

  private buildStepsFromTemplate(template: any, clientProfile: any): OnboardingStep[] {
    return template.steps.map((templateStep: any) => ({
      id: uuidv4(),
      ...templateStep,
      status: OnboardingStepStatus.PENDING,
      data: this.personalizeStepData(templateStep, clientProfile)
    }));
  }

  private personalizeStepData(templateStep: any, clientProfile: any): Record<string, any> {
    const data: Record<string, any> = {};
    
    // Personalize based on step type
    switch (templateStep.type) {
      case OnboardingStepType.EMAIL:
        data.recipientName = clientProfile.name;
        data.projectType = clientProfile.projectType;
        break;
      case OnboardingStepType.QUESTIONNAIRE:
        data.prefillData = {
          companyName: clientProfile.company,
          industry: clientProfile.industry,
          estimatedBudget: clientProfile.budget
        };
        break;
      case OnboardingStepType.CONTRACT_SIGNING:
        data.contractTemplate = this.selectContractTemplate(clientProfile);
        break;
    }

    return data;
  }

  private selectContractTemplate(clientProfile: any): string {
    if (clientProfile.budget && clientProfile.budget > 50000) {
      return 'enterprise_contract';
    } else if (clientProfile.type === 'individual') {
      return 'individual_contract';
    }
    return 'standard_contract';
  }

  private calculateExpectedCompletion(steps: OnboardingStep[]): Date {
    let totalMinutes = 0;
    
    for (const step of steps) {
      totalMinutes += step.estimatedDuration;
      if (step.timingRules.delayAfterPrevious) {
        totalMinutes += step.timingRules.delayAfterPrevious;
      }
    }

    // Add buffer for business hours restrictions
    const businessDayMinutes = 8 * 60; // 8 hour business days
    const totalBusinessDays = Math.ceil(totalMinutes / businessDayMinutes);
    
    const completion = new Date();
    completion.setDate(completion.getDate() + totalBusinessDays);
    
    return completion;
  }

  // Progress to next step
  async advanceStep(sequenceId: string, stepId: string, completionData?: any): Promise<void> {
    // Implementation would update step status and advance sequence
    console.log(`Advancing step ${stepId} in sequence ${sequenceId}`);
  }

  // Get current step
  getCurrentStep(sequence: OnboardingSequence): OnboardingStep | null {
    if (sequence.currentStepIndex >= sequence.steps.length) {
      return null;
    }
    return sequence.steps[sequence.currentStepIndex];
  }

  // Get next pending steps
  getNextSteps(sequence: OnboardingSequence, limit: number = 3): OnboardingStep[] {
    return sequence.steps
      .filter(step => step.status === OnboardingStepStatus.PENDING)
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit);
  }

  // Check if step dependencies are met
  checkDependencies(sequence: OnboardingSequence, stepId: string): boolean {
    const step = sequence.steps.find(s => s.id === stepId);
    if (!step) return false;

    return step.dependencies.every(depId => {
      const dependency = sequence.steps.find(s => s.id === depId);
      return dependency?.status === OnboardingStepStatus.COMPLETED;
    });
  }

  // Get sequence progress percentage
  getProgressPercentage(sequence: OnboardingSequence): number {
    const completedSteps = sequence.steps.filter(
      step => step.status === OnboardingStepStatus.COMPLETED
    ).length;
    
    return Math.round((completedSteps / sequence.steps.length) * 100);
  }
}