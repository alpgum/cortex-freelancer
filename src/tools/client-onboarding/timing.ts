/**
 * Smart Timing Engine
 * 
 * Optimal timing for each step with respect to business hours,
 * time zones, and configurable delay rules.
 */

export interface BusinessHours {
  timezone: string;
  workdays: number[]; // 0-6, 0 = Sunday
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  holidays?: string[]; // YYYY-MM-DD format
}

export interface TimingRule {
  id: string;
  name: string;
  description: string;
  stepType?: string; // Apply to specific step types
  condition?: {
    clientType?: string;
    projectValue?: { min?: number; max?: number };
    priority?: number;
  };
  timing: {
    delayMinutes?: number;
    delayHours?: number;
    delayDays?: number;
    respectBusinessHours: boolean;
    respectTimeZone: boolean;
    allowWeekends?: boolean;
    allowHolidays?: boolean;
  };
  followUp: {
    enabled: boolean;
    intervals?: number[]; // Hours after initial action
    maxAttempts?: number;
    escalationRules?: {
      afterAttempts: number;
      action: 'assign_senior' | 'schedule_call' | 'mark_priority';
    }[];
  };
}

export interface ScheduledAction {
  id: string;
  sequenceId: string;
  stepId: string;
  actionType: 'send_email' | 'send_reminder' | 'schedule_call' | 'escalate' | 'mark_complete';
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  metadata: Record<string, any>;
}

export class SmartTimingEngine {
  private businessHours: BusinessHours;
  private timingRules: TimingRule[] = [];
  private scheduledActions: ScheduledAction[] = [];

  constructor(businessHours?: BusinessHours) {
    this.businessHours = businessHours || this.getDefaultBusinessHours();
    this.initializeDefaultRules();
  }

  // Calculate optimal timing for a step
  calculateOptimalTiming(
    stepType: string,
    clientProfile: any,
    previousStepCompletedAt: Date
  ): Date {
    const rule = this.findApplicableRule(stepType, clientProfile);
    
    let scheduledTime = new Date(previousStepCompletedAt);
    
    // Apply delay
    if (rule.timing.delayMinutes) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + rule.timing.delayMinutes);
    }
    if (rule.timing.delayHours) {
      scheduledTime.setHours(scheduledTime.getHours() + rule.timing.delayHours);
    }
    if (rule.timing.delayDays) {
      scheduledTime.setDate(scheduledTime.getDate() + rule.timing.delayDays);
    }

    // Adjust for business hours if required
    if (rule.timing.respectBusinessHours) {
      scheduledTime = this.adjustToBusinessHours(scheduledTime, clientProfile.timezone);
    }

    // Adjust for weekends if not allowed
    if (!rule.timing.allowWeekends) {
      scheduledTime = this.adjustForWeekends(scheduledTime);
    }

    // Adjust for holidays if not allowed
    if (!rule.timing.allowHolidays) {
      scheduledTime = this.adjustForHolidays(scheduledTime);
    }

    return scheduledTime;
  }

  // Schedule follow-up actions
  scheduleFollowUps(
    sequenceId: string,
    stepId: string,
    stepType: string,
    clientProfile: any,
    initialActionTime: Date
  ): ScheduledAction[] {
    const rule = this.findApplicableRule(stepType, clientProfile);
    const followUps: ScheduledAction[] = [];
    
    if (!rule.followUp.enabled || !rule.followUp.intervals) {
      return followUps;
    }

    rule.followUp.intervals.forEach((intervalHours, index) => {
      const followUpTime = new Date(initialActionTime);
      followUpTime.setHours(followUpTime.getHours() + intervalHours);
      
      // Adjust to business hours
      const adjustedTime = this.adjustToBusinessHours(followUpTime, clientProfile.timezone);
      
      const scheduledAction: ScheduledAction = {
        id: this.generateActionId(),
        sequenceId,
        stepId,
        actionType: index === 0 ? 'send_reminder' : 'escalate',
        scheduledFor: adjustedTime,
        attempts: 0,
        maxAttempts: rule.followUp.maxAttempts || 3,
        status: 'pending',
        metadata: {
          interval: intervalHours,
          isFollowUp: true,
          ruleId: rule.id
        }
      };
      
      followUps.push(scheduledAction);
      this.scheduledActions.push(scheduledAction);
    });
    
    return followUps;
  }

  // Check if current time is within business hours
  isBusinessHours(date: Date, timezone?: string): boolean {
    const tz = timezone || this.businessHours.timezone;
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
    
    const dayOfWeek = localDate.getDay();
    if (!this.businessHours.workdays.includes(dayOfWeek)) {
      return false;
    }
    
    const currentTime = localDate.toTimeString().substring(0, 5);
    return currentTime >= this.businessHours.startTime && 
           currentTime <= this.businessHours.endTime;
  }

  // Adjust time to the next moment that falls within business hours.
  // Note: Time zone-safe scheduling is tricky without a full TZ library.
  // We use a robust (if slightly brute-force) approach: step forward until
  // `isBusinessHours()` returns true in the requested time zone.
  adjustToBusinessHours(date: Date, timezone?: string): Date {
    const tz = timezone || this.businessHours.timezone;
    let adjusted = new Date(date);

    if (this.isBusinessHours(adjusted, tz)) return adjusted;

    // Start by moving forward to the next hour to avoid edge cases around minutes.
    adjusted.setMinutes(0, 0, 0);
    adjusted.setHours(adjusted.getHours() + 1);

    // Iterate up to 14 days ahead in 30-minute increments.
    const maxIterations = 14 * 24 * 2;
    for (let i = 0; i < maxIterations; i++) {
      if (this.isBusinessHours(adjusted, tz)) return adjusted;
      adjusted = new Date(adjusted.getTime() + 30 * 60 * 1000);
    }

    // Fallback: return original date if we couldn't find a slot.
    return new Date(date);
  }

  // Adjust for weekends
  adjustForWeekends(date: Date): Date {
    const dayOfWeek = date.getDay();
    
    // If Saturday (6) or Sunday (0), move to Monday
    if (dayOfWeek === 0) { // Sunday
      date.setDate(date.getDate() + 1);
    } else if (dayOfWeek === 6) { // Saturday
      date.setDate(date.getDate() + 2);
    }
    
    return date;
  }

  // Adjust for holidays
  adjustForHolidays(date: Date): Date {
    const dateString = date.toISOString().split('T')[0];
    
    if (this.businessHours.holidays?.includes(dateString)) {
      // Move to next day and check again
      date.setDate(date.getDate() + 1);
      return this.adjustForHolidays(date);
    }
    
    return date;
  }

  // Get pending actions that should be executed now
  getPendingActions(now: Date = new Date()): ScheduledAction[] {
    return this.scheduledActions.filter(action => 
      action.status === 'pending' && 
      action.scheduledFor <= now
    );
  }

  // Execute a scheduled action
  async executeAction(actionId: string): Promise<boolean> {
    const action = this.scheduledActions.find(a => a.id === actionId);
    if (!action) return false;
    
    try {
      action.attempts++;
      
      // Execute based on action type
      switch (action.actionType) {
        case 'send_email':
          await this.sendEmail(action);
          break;
        case 'send_reminder':
          await this.sendReminder(action);
          break;
        case 'schedule_call':
          await this.scheduleCall(action);
          break;
        case 'escalate':
          await this.escalateIssue(action);
          break;
        default:
          console.log(`Unknown action type: ${action.actionType}`);
      }
      
      action.status = 'executed';
      return true;
      
    } catch (error) {
      action.status = action.attempts >= action.maxAttempts ? 'failed' : 'pending';
      
      if (action.status === 'pending') {
        // Reschedule for later
        action.scheduledFor = new Date(Date.now() + 60 * 60 * 1000); // 1 hour later
      }
      
      return false;
    }
  }

  // Add custom timing rule
  addTimingRule(rule: TimingRule): void {
    this.timingRules.push(rule);
  }

  // Remove timing rule
  removeTimingRule(ruleId: string): void {
    this.timingRules = this.timingRules.filter(rule => rule.id !== ruleId);
  }

  // Get applicable timing rules
  getApplicableRules(stepType: string, clientProfile: any): TimingRule[] {
    return this.timingRules.filter(rule => 
      this.ruleMatches(rule, stepType, clientProfile)
    );
  }

  private findApplicableRule(stepType: string, clientProfile: any): TimingRule {
    const applicableRules = this.getApplicableRules(stepType, clientProfile);
    
    // Return the most specific rule or default
    return applicableRules[0] || this.getDefaultRule();
  }

  private ruleMatches(rule: TimingRule, stepType: string, clientProfile: any): boolean {
    // Check step type match
    if (rule.stepType && rule.stepType !== stepType) {
      return false;
    }
    
    // Check condition matching
    if (rule.condition) {
      const condition = rule.condition;
      
      if (condition.clientType && condition.clientType !== clientProfile.type) {
        return false;
      }
      
      if (condition.projectValue) {
        const budget = clientProfile.budget || 0;
        if (condition.projectValue.min && budget < condition.projectValue.min) {
          return false;
        }
        if (condition.projectValue.max && budget > condition.projectValue.max) {
          return false;
        }
      }
      
      if (condition.priority && condition.priority !== clientProfile.priority) {
        return false;
      }
    }
    
    return true;
  }

  private initializeDefaultRules(): void {
    // Welcome email - immediate
    this.timingRules.push({
      id: 'welcome-email-immediate',
      name: 'Welcome Email - Immediate',
      description: 'Send welcome email immediately after signup',
      stepType: 'email',
      timing: {
        delayMinutes: 0,
        respectBusinessHours: false,
        respectTimeZone: false
      },
      followUp: {
        enabled: false
      }
    });

    // Questionnaire follow-up
    this.timingRules.push({
      id: 'questionnaire-followup',
      name: 'Questionnaire Follow-up',
      description: 'Follow up on incomplete questionnaires',
      stepType: 'questionnaire',
      timing: {
        delayHours: 1,
        respectBusinessHours: true,
        respectTimeZone: true
      },
      followUp: {
        enabled: true,
        intervals: [24, 48],
        maxAttempts: 3,
        escalationRules: [
          {
            afterAttempts: 2,
            action: 'schedule_call'
          }
        ]
      }
    });

    // Contract signing - high priority clients
    this.timingRules.push({
      id: 'contract-highpriority',
      name: 'Contract Signing - High Priority',
      description: 'Expedited contract process for high-value clients',
      stepType: 'contract_signing',
      condition: {
        projectValue: { min: 25000 }
      },
      timing: {
        delayMinutes: 30,
        respectBusinessHours: true,
        respectTimeZone: true
      },
      followUp: {
        enabled: true,
        intervals: [24, 48],
        maxAttempts: 5,
        escalationRules: [
          {
            afterAttempts: 1,
            action: 'assign_senior'
          },
          {
            afterAttempts: 3,
            action: 'schedule_call'
          }
        ]
      }
    });

    // Payment setup
    this.timingRules.push({
      id: 'payment-setup-standard',
      name: 'Payment Setup - Standard',
      description: 'Standard payment setup timing',
      stepType: 'payment_setup',
      timing: {
        delayMinutes: 0,
        respectBusinessHours: true,
        respectTimeZone: true
      },
      followUp: {
        enabled: true,
        intervals: [12, 24],
        maxAttempts: 3
      }
    });
  }

  private getDefaultBusinessHours(): BusinessHours {
    return {
      timezone: 'America/New_York',
      workdays: [1, 2, 3, 4, 5], // Monday-Friday
      startTime: '09:00',
      endTime: '17:00',
      holidays: [
        '2024-01-01', // New Year's Day
        '2024-07-04', // Independence Day
        '2024-12-25'  // Christmas Day
      ]
    };
  }

  private getDefaultRule(): TimingRule {
    return {
      id: 'default-rule',
      name: 'Default Timing Rule',
      description: 'Default timing for unmatched steps',
      timing: {
        delayHours: 1,
        respectBusinessHours: true,
        respectTimeZone: true
      },
      followUp: {
        enabled: false
      }
    };
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Mock implementation methods (would be real in production)
  private async sendEmail(action: ScheduledAction): Promise<void> {
    console.log(`Sending email for action ${action.id}`);
  }

  private async sendReminder(action: ScheduledAction): Promise<void> {
    console.log(`Sending reminder for action ${action.id}`);
  }

  private async scheduleCall(action: ScheduledAction): Promise<void> {
    console.log(`Scheduling call for action ${action.id}`);
  }

  private async escalateIssue(action: ScheduledAction): Promise<void> {
    console.log(`Escalating issue for action ${action.id}`);
  }

  // Utility: Get next business day
  getNextBusinessDay(from: Date = new Date()): Date {
    let nextDay = new Date(from);
    nextDay.setDate(nextDay.getDate() + 1);
    
    return this.adjustToBusinessHours(nextDay);
  }

  // Utility: Calculate business hours between two dates
  calculateBusinessHoursBetween(start: Date, end: Date): number {
    let current = new Date(start);
    let totalHours = 0;
    
    while (current < end) {
      if (this.isBusinessHours(current)) {
        totalHours++;
      }
      current.setHours(current.getHours() + 1);
    }
    
    return totalHours;
  }

  // Update business hours configuration
  updateBusinessHours(businessHours: BusinessHours): void {
    this.businessHours = businessHours;
  }
}