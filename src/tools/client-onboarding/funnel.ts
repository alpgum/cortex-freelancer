/**
 * Conversion Funnel Tracking
 * 
 * Track where prospects drop off in the onboarding pipeline and provide
 * actionable recommendations to improve conversion rates.
 */

export interface ConversionEvent {
  id: string;
  sequenceId: string;
  clientId: string;
  stepId: string;
  stepName: string;
  eventType: 'started' | 'completed' | 'dropped_off' | 'failed';
  timestamp: Date;
  timeSpentMinutes?: number;
  metadata?: Record<string, any>;
}

export interface FunnelStep {
  stepName: string;
  stepType: string;
  entered: number;
  completed: number;
  droppedOff: number;
  conversionRate: number;
  dropoffRate: number;
  averageTimeToComplete: number; // hours
  commonFailureReasons: string[];
}

export interface FunnelAnalysis {
  totalProspects: number;
  overallConversionRate: number;
  averageTimeToConvert: number; // days
  steps: FunnelStep[];
  highestDropoffStep?: FunnelStep;
  bottleneckSteps: FunnelStep[];
  recommendations: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

export interface ConversionMetrics {
  daily: {
    date: string;
    newProspects: number;
    conversions: number;
    conversionRate: number;
  }[];
  weekly: {
    weekOf: string;
    newProspects: number;
    conversions: number;
    conversionRate: number;
  }[];
  monthly: {
    monthOf: string;
    newProspects: number;
    conversions: number;
    conversionRate: number;
  }[];
}

export class ConversionFunnelTracker {
  private events: ConversionEvent[] = [];
  
  constructor() {
    // In a real implementation, this would connect to a database
  }

  // Initialize tracking for a new sequence
  async initializeTracking(sequenceId: string, clientId: string): Promise<void> {
    const event: ConversionEvent = {
      id: this.generateEventId(),
      sequenceId,
      clientId,
      stepId: 'sequence_start',
      stepName: 'Onboarding Started',
      eventType: 'started',
      timestamp: new Date(),
      metadata: {
        source: 'system',
        userAgent: 'cortex-freelancer'
      }
    };
    
    this.events.push(event);
  }

  // Track step start
  async trackStepStart(
    sequenceId: string, 
    clientId: string, 
    stepId: string, 
    stepName: string
  ): Promise<void> {
    const event: ConversionEvent = {
      id: this.generateEventId(),
      sequenceId,
      clientId,
      stepId,
      stepName,
      eventType: 'started',
      timestamp: new Date()
    };
    
    this.events.push(event);
  }

  // Track step completion
  async trackStepCompletion(
    sequenceId: string,
    clientId: string,
    stepId: string,
    stepName: string,
    timeSpentMinutes?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event: ConversionEvent = {
      id: this.generateEventId(),
      sequenceId,
      clientId,
      stepId,
      stepName,
      eventType: 'completed',
      timestamp: new Date(),
      timeSpentMinutes,
      metadata
    };
    
    this.events.push(event);
  }

  // Track step dropout
  async trackStepDropoff(
    sequenceId: string,
    clientId: string,
    stepId: string,
    stepName: string,
    reason?: string
  ): Promise<void> {
    const event: ConversionEvent = {
      id: this.generateEventId(),
      sequenceId,
      clientId,
      stepId,
      stepName,
      eventType: 'dropped_off',
      timestamp: new Date(),
      metadata: reason ? { reason } : undefined
    };
    
    this.events.push(event);
  }

  // Analyze conversion funnel
  async analyzeConversionFunnel(timeRange?: { start: Date; end: Date }): Promise<FunnelAnalysis> {
    const filteredEvents = this.filterEventsByTimeRange(timeRange);
    const stepAnalysis = this.calculateStepMetrics(filteredEvents);
    
    const analysis: FunnelAnalysis = {
      totalProspects: this.getTotalProspects(filteredEvents),
      overallConversionRate: this.calculateOverallConversionRate(filteredEvents),
      averageTimeToConvert: this.calculateAverageTimeToConvert(filteredEvents),
      steps: stepAnalysis,
      highestDropoffStep: this.findHighestDropoffStep(stepAnalysis),
      bottleneckSteps: this.findBottleneckSteps(stepAnalysis),
      recommendations: this.generateRecommendations(stepAnalysis),
      timeRange: timeRange || this.getDefaultTimeRange()
    };

    return analysis;
  }

  // Get conversion metrics over time
  async getConversionMetrics(timeRange?: { start: Date; end: Date }): Promise<ConversionMetrics> {
    const filteredEvents = this.filterEventsByTimeRange(timeRange);
    
    return {
      daily: this.calculateDailyMetrics(filteredEvents),
      weekly: this.calculateWeeklyMetrics(filteredEvents),
      monthly: this.calculateMonthlyMetrics(filteredEvents)
    };
  }

  private filterEventsByTimeRange(timeRange?: { start: Date; end: Date }): ConversionEvent[] {
    if (!timeRange) {
      return this.events;
    }
    
    return this.events.filter(event => 
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );
  }

  private calculateStepMetrics(events: ConversionEvent[]): FunnelStep[] {
    const stepMap = new Map<string, FunnelStep>();
    
    // Initialize steps
    const uniqueSteps = [...new Set(events.map(e => e.stepName))];
    uniqueSteps.forEach(stepName => {
      stepMap.set(stepName, {
        stepName,
        stepType: this.getStepType(stepName),
        entered: 0,
        completed: 0,
        droppedOff: 0,
        conversionRate: 0,
        dropoffRate: 0,
        averageTimeToComplete: 0,
        commonFailureReasons: []
      });
    });

    // Calculate metrics
    events.forEach(event => {
      const step = stepMap.get(event.stepName);
      if (!step) return;

      switch (event.eventType) {
        case 'started':
          step.entered++;
          break;
        case 'completed':
          step.completed++;
          break;
        case 'dropped_off':
          step.droppedOff++;
          if (event.metadata?.reason) {
            step.commonFailureReasons.push(event.metadata.reason);
          }
          break;
      }
    });

    // Calculate rates
    stepMap.forEach(step => {
      if (step.entered > 0) {
        step.conversionRate = (step.completed / step.entered) * 100;
        step.dropoffRate = (step.droppedOff / step.entered) * 100;
      }
      step.averageTimeToComplete = this.calculateAverageTimeForStep(events, step.stepName);
    });

    return Array.from(stepMap.values()).sort((a, b) => 
      this.getStepOrder(a.stepName) - this.getStepOrder(b.stepName)
    );
  }

  private calculateAverageTimeForStep(events: ConversionEvent[], stepName: string): number {
    const completedEvents = events.filter(e => 
      e.stepName === stepName && 
      e.eventType === 'completed' && 
      e.timeSpentMinutes
    );
    
    if (completedEvents.length === 0) return 0;
    
    const totalMinutes = completedEvents.reduce((sum, e) => sum + (e.timeSpentMinutes || 0), 0);
    return totalMinutes / completedEvents.length / 60; // Convert to hours
  }

  private getTotalProspects(events: ConversionEvent[]): number {
    return new Set(events.map(e => e.clientId)).size;
  }

  private calculateOverallConversionRate(events: ConversionEvent[]): number {
    const totalProspects = this.getTotalProspects(events);
    const conversions = events.filter(e => 
      e.stepName === 'First Deliverable' && e.eventType === 'completed'
    ).length;
    
    return totalProspects > 0 ? (conversions / totalProspects) * 100 : 0;
  }

  private calculateAverageTimeToConvert(events: ConversionEvent[]): number {
    const conversions = events.filter(e => 
      e.stepName === 'First Deliverable' && e.eventType === 'completed'
    );
    
    if (conversions.length === 0) return 0;
    
    let totalDays = 0;
    conversions.forEach(completion => {
      const start = events.find(e => 
        e.clientId === completion.clientId && 
        e.stepName === 'Onboarding Started'
      );
      
      if (start) {
        const days = (completion.timestamp.getTime() - start.timestamp.getTime()) / 
          (1000 * 60 * 60 * 24);
        totalDays += days;
      }
    });
    
    return totalDays / conversions.length;
  }

  private findHighestDropoffStep(steps: FunnelStep[]): FunnelStep | undefined {
    return steps.reduce((highest, current) => 
      current.dropoffRate > (highest?.dropoffRate || 0) ? current : highest
    , undefined as FunnelStep | undefined);
  }

  private findBottleneckSteps(steps: FunnelStep[], threshold: number = 30): FunnelStep[] {
    return steps.filter(step => step.dropoffRate >= threshold);
  }

  private generateRecommendations(steps: FunnelStep[]): string[] {
    const recommendations: string[] = [];
    
    steps.forEach(step => {
      if (step.dropoffRate > 30) {
        recommendations.push(
          `High dropout in "${step.stepName}" (${step.dropoffRate.toFixed(1)}%). Consider: simplifying requirements, adding help content, or splitting into smaller steps.`
        );
      }
      
      if (step.averageTimeToComplete > 72 && step.stepType !== 'deliverable') {
        recommendations.push(
          `"${step.stepName}" takes ${step.averageTimeToComplete.toFixed(1)} hours on average. Consider: clearer instructions, templates, or automation.`
        );
      }
      
      if (step.conversionRate < 50 && step.stepType === 'contract_signing') {
        recommendations.push(
          `Low contract signing rate (${step.conversionRate.toFixed(1)}%). Consider: simplified terms, payment flexibility, or personal call.`
        );
      }
    });
    
    return recommendations;
  }

  private calculateDailyMetrics(events: ConversionEvent[]): ConversionMetrics['daily'] {
    const dailyData = new Map<string, { newProspects: Set<string>; conversions: number }>();
    
    events.forEach(event => {
      const dateKey = event.timestamp.toISOString().split('T')[0];
      
      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, { newProspects: new Set(), conversions: 0 });
      }
      
      const dayData = dailyData.get(dateKey)!;
      
      if (event.stepName === 'Onboarding Started') {
        dayData.newProspects.add(event.clientId);
      }
      
      if (event.stepName === 'First Deliverable' && event.eventType === 'completed') {
        dayData.conversions++;
      }
    });
    
    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      newProspects: data.newProspects.size,
      conversions: data.conversions,
      conversionRate: data.newProspects.size > 0 ? 
        (data.conversions / data.newProspects.size) * 100 : 0
    }));
  }

  private calculateWeeklyMetrics(events: ConversionEvent[]): ConversionMetrics['weekly'] {
    // Implementation for weekly metrics aggregation
    return [];
  }

  private calculateMonthlyMetrics(events: ConversionEvent[]): ConversionMetrics['monthly'] {
    // Implementation for monthly metrics aggregation
    return [];
  }

  private getStepType(stepName: string): string {
    const typeMap: Record<string, string> = {
      'Welcome Email': 'email',
      'Intake Questionnaire': 'questionnaire',
      'Project Brief Review': 'document_review',
      'Contract Signing': 'contract_signing',
      'Payment Setup': 'payment_setup',
      'Kickoff Meeting': 'meeting',
      'First Deliverable': 'deliverable'
    };
    
    return typeMap[stepName] || 'unknown';
  }

  private getStepOrder(stepName: string): number {
    const orderMap: Record<string, number> = {
      'Onboarding Started': 0,
      'Welcome Email': 1,
      'Intake Questionnaire': 2,
      'Project Brief Review': 3,
      'Contract Signing': 4,
      'Payment Setup': 5,
      'Kickoff Meeting': 6,
      'First Deliverable': 7
    };
    
    return orderMap[stepName] || 99;
  }

  private getDefaultTimeRange(): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days
    
    return { start, end };
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Identify specific friction points
  async identifyFrictionPoints(): Promise<{
    step: string;
    issue: string;
    impact: 'high' | 'medium' | 'low';
    recommendation: string;
  }[]> {
    const analysis = await this.analyzeConversionFunnel();
    const frictionPoints: {
      step: string;
      issue: string;
      impact: 'high' | 'medium' | 'low';
      recommendation: string;
    }[] = [];

    analysis.steps.forEach(step => {
      // High dropout rate
      if (step.dropoffRate > 40) {
        frictionPoints.push({
          step: step.stepName,
          issue: `High dropout rate: ${step.dropoffRate.toFixed(1)}%`,
          impact: 'high',
          recommendation: 'Simplify step requirements or add guidance'
        });
      }
      
      // Long completion time
      if (step.averageTimeToComplete > 48) {
        frictionPoints.push({
          step: step.stepName,
          issue: `Long completion time: ${step.averageTimeToComplete.toFixed(1)} hours`,
          impact: 'medium',
          recommendation: 'Break down into smaller sub-steps or automate'
        });
      }
      
      // Low conversion with common failures
      if (step.conversionRate < 60 && step.commonFailureReasons.length > 0) {
        frictionPoints.push({
          step: step.stepName,
          issue: `Common failures: ${step.commonFailureReasons.slice(0, 2).join(', ')}`,
          impact: 'medium',
          recommendation: 'Address most common failure reasons'
        });
      }
    });

    return frictionPoints.sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }
}