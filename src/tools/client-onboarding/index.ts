/**
 * Client Onboarding Automation System
 * 
 * A comprehensive module for optimizing new client experience and tracking 
 * conversion at every step of the onboarding pipeline.
 * 
 * @author ZEPHYR
 * @version 1.0.0
 */

export { OnboardingSequenceBuilder, OnboardingStep, OnboardingSequence } from './sequences';
export { ConversionFunnelTracker, ConversionMetrics, FunnelAnalysis } from './funnel';
export { SmartTimingEngine, TimingRule, BusinessHours } from './timing';
export { TemplateLibrary, OnboardingTemplate, ClientType } from './templates';
export { IntakeAutomation, SmartQuestionnaire, ClientProfile } from './intake';
export { MetricsTracker, OnboardingMetrics, SuccessMetrics } from './metrics';
export { CLI } from './cli';

// Main onboarding system
export class ClientOnboardingSystem {
  private sequenceBuilder: OnboardingSequenceBuilder;
  private funnelTracker: ConversionFunnelTracker;
  private timingEngine: SmartTimingEngine;
  private templateLibrary: TemplateLibrary;
  private intakeAutomation: IntakeAutomation;
  private metricsTracker: MetricsTracker;

  constructor() {
    this.sequenceBuilder = new OnboardingSequenceBuilder();
    this.funnelTracker = new ConversionFunnelTracker();
    this.timingEngine = new SmartTimingEngine();
    this.templateLibrary = new TemplateLibrary();
    this.intakeAutomation = new IntakeAutomation();
    this.metricsTracker = new MetricsTracker();
  }

  // Create new onboarding sequence for client
  async createOnboardingFlow(clientData: any): Promise<OnboardingSequence> {
    const clientProfile = await this.intakeAutomation.processClient(clientData);
    const template = this.templateLibrary.getTemplateForClient(clientProfile.type);
    const sequence = this.sequenceBuilder.buildSequence(template, clientProfile);
    
    // Start tracking
    await this.funnelTracker.initializeTracking(sequence.id, clientProfile.id);
    await this.metricsTracker.startTracking(sequence.id);
    
    return sequence;
  }

  // Get conversion funnel analysis
  async getFunnelAnalysis(timeRange?: { start: Date; end: Date }): Promise<FunnelAnalysis> {
    return await this.funnelTracker.analyzeConversionFunnel(timeRange);
  }

  // Get optimization recommendations
  async getOptimizationRecommendations(): Promise<string[]> {
    const analysis = await this.getFunnelAnalysis();
    const metrics = await this.metricsTracker.getMetrics();
    
    return this.generateRecommendations(analysis, metrics);
  }

  private generateRecommendations(analysis: FunnelAnalysis, metrics: OnboardingMetrics): string[] {
    const recommendations: string[] = [];
    
    // Analyze drop-off points
    if (analysis.highestDropoffStep) {
      recommendations.push(
        `Critical: ${analysis.highestDropoffStep.name} has ${analysis.highestDropoffStep.dropoffRate}% drop-off rate. Consider simplifying this step.`
      );
    }

    // Analyze timing issues
    if (metrics.averageTimeToKickoff > 7) {
      recommendations.push(
        `Time-to-kickoff is ${metrics.averageTimeToKickoff} days. Target: 3-5 days. Review timing rules and automate follow-ups.`
      );
    }

    // Analyze completion rates
    if (metrics.completionRate < 0.8) {
      recommendations.push(
        `Completion rate is ${(metrics.completionRate * 100).toFixed(1)}%. Target: 80%+. Check for friction points in contract signing and payment setup.`
      );
    }

    return recommendations;
  }

  // Get CLI interface
  getCLI(): CLI {
    return new CLI(this);
  }
}

export default ClientOnboardingSystem;