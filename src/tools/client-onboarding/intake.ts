/**
 * Intake Automation
 * 
 * Smart questionnaire system that adapts based on project type and
 * auto-extracts key information with early warning detection.
 */

import { QuestionnaireTemplate, Question, ClientType } from './templates';

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  industry?: string;
  type: ClientType;
  projectType: string;
  budget?: number;
  timeline?: string;
  priority: number;
  riskLevel: 'low' | 'medium' | 'high';
  communicationPreference: 'email' | 'phone' | 'slack' | 'teams';
  timezone: string;
  createdAt: Date;
  lastUpdated: Date;
  tags: string[];
  notes: string[];
  flaggedConcerns: string[];
}

export interface QuestionnaireResponse {
  questionId: string;
  value: any;
  timestamp: Date;
  timeSpentSeconds?: number;
}

export interface SmartQuestionnaire {
  id: string;
  templateId: string;
  clientId: string;
  responses: QuestionnaireResponse[];
  currentSectionId?: string;
  completionPercentage: number;
  startedAt: Date;
  completedAt?: Date;
  adaptations: QuestionnaireAdaptation[];
  extractedInfo: ExtractedInfo;
  concerns: DetectedConcern[];
  recommendedActions: string[];
}

export interface QuestionnaireAdaptation {
  timestamp: Date;
  reason: string;
  changes: {
    questionsAdded?: string[];
    questionsRemoved?: string[];
    sectionsModified?: string[];
  };
}

export interface ExtractedInfo {
  estimatedBudget?: {
    min: number;
    max: number;
    confidence: number;
  };
  projectComplexity: 'low' | 'medium' | 'high';
  timelinePressure: 'low' | 'medium' | 'high';
  stakeholderCount: number;
  technicalRequirements: string[];
  riskFactors: string[];
  opportunityFlags: string[];
}

export interface DetectedConcern {
  id: string;
  type: 'budget_mismatch' | 'timeline_unrealistic' | 'scope_unclear' | 'stakeholder_conflict' | 'technical_risk' | 'communication_red_flag';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedAction: string;
  confidence: number;
  detectedAt: Date;
  relatedQuestions: string[];
}

export class IntakeAutomation {
  private budgetKeywords = {
    low: ['budget', 'tight', 'small', 'limited', 'affordable', 'cheap'],
    high: ['enterprise', 'comprehensive', 'premium', 'extensive', 'robust']
  };

  private timelineKeywords = {
    urgent: ['asap', 'urgent', 'rush', 'immediately', 'yesterday', 'emergency'],
    relaxed: ['flexible', 'when possible', 'no rush', 'eventually']
  };

  constructor() {}

  // Process new client data and create profile
  async processClient(clientData: any): Promise<ClientProfile> {
    const profile: ClientProfile = {
      id: clientData.id || this.generateClientId(),
      name: clientData.name,
      email: clientData.email,
      phone: clientData.phone,
      company: clientData.company,
      industry: clientData.industry,
      type: this.detectClientType(clientData),
      projectType: clientData.projectType || 'general',
      budget: this.parseBudget(clientData.budget),
      timeline: clientData.timeline,
      priority: this.calculatePriority(clientData),
      riskLevel: this.assessRiskLevel(clientData),
      communicationPreference: clientData.communicationPreference || 'email',
      timezone: clientData.timezone || 'America/New_York',
      createdAt: new Date(),
      lastUpdated: new Date(),
      tags: this.generateTags(clientData),
      notes: [],
      flaggedConcerns: []
    };

    return profile;
  }

  // Create adaptive questionnaire based on client profile
  async createAdaptiveQuestionnaire(
    templateId: string, 
    clientProfile: ClientProfile
  ): Promise<SmartQuestionnaire> {
    const questionnaire: SmartQuestionnaire = {
      id: this.generateQuestionnaireId(),
      templateId,
      clientId: clientProfile.id,
      responses: [],
      completionPercentage: 0,
      startedAt: new Date(),
      adaptations: [],
      extractedInfo: {
        projectComplexity: 'medium',
        timelinePressure: 'medium',
        stakeholderCount: 1,
        technicalRequirements: [],
        riskFactors: [],
        opportunityFlags: []
      },
      concerns: [],
      recommendedActions: []
    };

    // Apply initial adaptations based on client profile
    await this.applyInitialAdaptations(questionnaire, clientProfile);

    return questionnaire;
  }

  // Process questionnaire response and update intelligence
  async processResponse(
    questionnaireId: string,
    questionId: string,
    value: any,
    timeSpentSeconds?: number
  ): Promise<{
    nextQuestion?: Question;
    adaptations?: QuestionnaireAdaptation;
    concerns?: DetectedConcern[];
    extractedInfo?: Partial<ExtractedInfo>;
  }> {
    // Record response
    const response: QuestionnaireResponse = {
      questionId,
      value,
      timestamp: new Date(),
      timeSpentSeconds
    };

    // Analyze response for insights
    const analysis = this.analyzeResponse(questionId, value, timeSpentSeconds);

    // Detect concerns
    const concerns = this.detectConcerns(questionId, value, analysis);

    // Update extracted information
    const extractedInfo = this.updateExtractedInfo(questionId, value, analysis);

    // Determine next question (adaptive flow)
    const nextQuestion = await this.determineNextQuestion(questionnaireId, questionId, value);

    // Apply adaptations if needed
    const adaptations = await this.applyAdaptations(questionnaireId, analysis);

    return {
      nextQuestion,
      adaptations,
      concerns,
      extractedInfo
    };
  }

  // Analyze completed questionnaire and generate insights
  async analyzeCompletedQuestionnaire(questionnaireId: string): Promise<{
    clientProfile: Partial<ClientProfile>;
    projectInsights: {
      complexity: 'low' | 'medium' | 'high';
      estimatedHours: number;
      suggestedPrice: { min: number; max: number };
      riskAssessment: string;
      successProbability: number;
    };
    recommendations: string[];
    redFlags: string[];
  }> {
    // Implementation would analyze all responses and provide comprehensive insights
    return {
      clientProfile: {},
      projectInsights: {
        complexity: 'medium',
        estimatedHours: 40,
        suggestedPrice: { min: 5000, max: 8000 },
        riskAssessment: 'Medium risk project with clear requirements',
        successProbability: 85
      },
      recommendations: [
        'Consider adding a discovery phase for complex requirements',
        'Request 50% upfront payment due to project scope'
      ],
      redFlags: []
    };
  }

  // Extract key information from responses
  private analyzeResponse(questionId: string, value: any, timeSpentSeconds?: number): {
    budgetSignals: string[];
    timelineSignals: string[];
    complexityIndicators: string[];
    riskIndicators: string[];
    opportunityIndicators: string[];
  } {
    const analysis: {
      budgetSignals: string[];
      timelineSignals: string[];
      complexityIndicators: string[];
      riskIndicators: string[];
      opportunityIndicators: string[];
    } = {
      budgetSignals: [],
      timelineSignals: [],
      complexityIndicators: [],
      riskIndicators: [],
      opportunityIndicators: []
    };

    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();

      // Analyze budget signals
      this.budgetKeywords.low.forEach(keyword => {
        if (lowerValue.includes(keyword)) {
          analysis.budgetSignals.push(`low_budget_signal: ${keyword}`);
        }
      });

      this.budgetKeywords.high.forEach(keyword => {
        if (lowerValue.includes(keyword)) {
          analysis.budgetSignals.push(`high_budget_signal: ${keyword}`);
        }
      });

      // Analyze timeline signals
      this.timelineKeywords.urgent.forEach(keyword => {
        if (lowerValue.includes(keyword)) {
          analysis.timelineSignals.push(`urgent_timeline: ${keyword}`);
        }
      });

      this.timelineKeywords.relaxed.forEach(keyword => {
        if (lowerValue.includes(keyword)) {
          analysis.timelineSignals.push(`relaxed_timeline: ${keyword}`);
        }
      });

      // Complexity indicators
      if (lowerValue.includes('integration') || lowerValue.includes('api') || lowerValue.includes('database')) {
        analysis.complexityIndicators.push('technical_integration');
      }

      if (lowerValue.includes('multiple') || lowerValue.includes('various') || lowerValue.includes('many')) {
        analysis.complexityIndicators.push('multiple_requirements');
      }

      // Risk indicators
      if (lowerValue.includes('never done') || lowerValue.includes('first time') || lowerValue.includes('not sure')) {
        analysis.riskIndicators.push('inexperienced_client');
      }

      if (lowerValue.includes('changed') || lowerValue.includes('modify') || lowerValue.includes('might need')) {
        analysis.riskIndicators.push('scope_creep_risk');
      }

      // Opportunity indicators
      if (lowerValue.includes('ongoing') || lowerValue.includes('long term') || lowerValue.includes('future')) {
        analysis.opportunityIndicators.push('long_term_relationship');
      }

      if (lowerValue.includes('referrals') || lowerValue.includes('recommend') || lowerValue.includes('other projects')) {
        analysis.opportunityIndicators.push('referral_potential');
      }
    }

    // Analyze time spent (if too quick, might indicate rushed/unclear answers)
    if (timeSpentSeconds && timeSpentSeconds < 10) {
      analysis.riskIndicators.push('rushed_response');
    }

    return analysis;
  }

  // Detect concerns based on response analysis
  private detectConcerns(questionId: string, value: any, analysis: any): DetectedConcern[] {
    const concerns: DetectedConcern[] = [];

    // Budget mismatch detection (lightweight heuristic)
    // If response implies low budget *and* the same response implies high complexity, flag it.
    if (analysis.budgetSignals.some((signal: string) => signal.includes('low_budget')) && analysis.complexityIndicators.length > 2) {
      concerns.push({
        id: this.generateConcernId(),
        type: 'budget_mismatch',
        severity: 'high',
        description: 'Potential budget vs scope mismatch detected (low budget signals + high complexity indicators)',
        suggestedAction: 'Clarify budget vs scope expectations early and propose phased scope options',
        confidence: 0.75,
        detectedAt: new Date(),
        relatedQuestions: [questionId]
      });
    }

    // Unrealistic timeline detection
    if (analysis.timelineSignals.includes('urgent_timeline') && analysis.complexityIndicators.length > 1) {
      concerns.push({
        id: this.generateConcernId(),
        type: 'timeline_unrealistic',
        severity: 'medium',
        description: 'Client wants urgent timeline for complex project',
        suggestedAction: 'Discuss realistic timeline options and rush job pricing',
        confidence: 0.7,
        detectedAt: new Date(),
        relatedQuestions: [questionId]
      });
    }

    // Scope unclear detection
    if (questionId.includes('objectives') && typeof value === 'string' && value.length < 50) {
      concerns.push({
        id: this.generateConcernId(),
        type: 'scope_unclear',
        severity: 'medium',
        description: 'Vague project objectives provided',
        suggestedAction: 'Schedule discovery call to clarify requirements',
        confidence: 0.6,
        detectedAt: new Date(),
        relatedQuestions: [questionId]
      });
    }

    return concerns;
  }

  // Update extracted information based on new response
  private updateExtractedInfo(questionId: string, value: any, analysis: any): Partial<ExtractedInfo> {
    const updates: Partial<ExtractedInfo> = {};

    // Update budget estimate
    if (questionId === 'budget-range' && typeof value === 'string') {
      updates.estimatedBudget = this.parseBudgetRange(value);
    }

    // Update complexity assessment
    const complexityScore = analysis.complexityIndicators.length;
    if (complexityScore >= 3) {
      updates.projectComplexity = 'high';
    } else if (complexityScore >= 1) {
      updates.projectComplexity = 'medium';
    } else {
      updates.projectComplexity = 'low';
    }

    // Update timeline pressure
    if (analysis.timelineSignals.some((signal: string) => signal.includes('urgent'))) {
      updates.timelinePressure = 'high';
    } else if (analysis.timelineSignals.some((signal: string) => signal.includes('relaxed'))) {
      updates.timelinePressure = 'low';
    }

    // Extract technical requirements
    if (typeof value === 'string' && questionId.includes('technical')) {
      updates.technicalRequirements = this.extractTechnicalRequirements(value);
    }

    return updates;
  }

  private detectClientType(clientData: any): ClientType {
    // Company size indicators
    if (clientData.company) {
      if (clientData.employeeCount && clientData.employeeCount > 1000) {
        return ClientType.ENTERPRISE;
      } else if (clientData.employeeCount && clientData.employeeCount > 50) {
        return ClientType.SMB;
      } else if (clientData.industry && ['agency', 'marketing', 'design'].includes(clientData.industry.toLowerCase())) {
        return ClientType.AGENCY;
      } else if (clientData.company.toLowerCase().includes('startup')) {
        return ClientType.STARTUP;
      }
      return ClientType.SMB;
    }
    
    return ClientType.INDIVIDUAL;
  }

  private parseBudget(budgetString?: string): number | undefined {
    if (!budgetString) return undefined;
    
    const numbers = budgetString.match(/\d+/g);
    if (numbers) {
      return parseInt(numbers[numbers.length - 1]);
    }
    
    return undefined;
  }

  private parseBudgetRange(budgetString: string): { min: number; max: number; confidence: number } {
    const ranges: Record<string, { min: number; max: number }> = {
      'under $5,000': { min: 1000, max: 5000 },
      '$5,000 - $10,000': { min: 5000, max: 10000 },
      '$10,000 - $25,000': { min: 10000, max: 25000 },
      '$25,000 - $50,000': { min: 25000, max: 50000 },
      '$50,000+': { min: 50000, max: 100000 }
    };

    const range = ranges[budgetString.toLowerCase()] || { min: 5000, max: 15000 };
    return { ...range, confidence: 0.8 };
  }

  private calculatePriority(clientData: any): number {
    let priority = 3; // Default medium priority

    // Higher budget = higher priority
    if (clientData.budget && clientData.budget > 25000) {
      priority = 1;
    } else if (clientData.budget && clientData.budget > 10000) {
      priority = 2;
    }

    // Enterprise clients get higher priority
    if (clientData.company && clientData.employeeCount > 100) {
      priority = Math.min(priority, 2);
    }

    // Rush jobs get higher priority
    if (clientData.timeline && clientData.timeline.toLowerCase().includes('asap')) {
      priority = Math.min(priority, 2);
    }

    return priority;
  }

  private assessRiskLevel(clientData: any): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Budget concerns
    if (clientData.budget && clientData.budget < 5000) {
      riskScore += 1;
    }

    // Timeline pressure
    if (clientData.timeline && clientData.timeline.toLowerCase().includes('asap')) {
      riskScore += 1;
    }

    // Vague requirements
    if (!clientData.projectDescription || clientData.projectDescription.length < 50) {
      riskScore += 1;
    }

    // Communication quality
    if (!clientData.email || !clientData.email.includes('@')) {
      riskScore += 2;
    }

    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  private generateTags(clientData: any): string[] {
    const tags: string[] = [];

    if (clientData.industry) {
      tags.push(clientData.industry.toLowerCase());
    }

    if (clientData.projectType) {
      tags.push(clientData.projectType.toLowerCase());
    }

    if (clientData.budget) {
      if (clientData.budget > 25000) {
        tags.push('high-value');
      } else if (clientData.budget < 5000) {
        tags.push('budget-conscious');
      }
    }

    return tags;
  }

  private async applyInitialAdaptations(
    questionnaire: SmartQuestionnaire,
    clientProfile: ClientProfile
  ): Promise<void> {
    // Add industry-specific questions
    if (clientProfile.industry === 'healthcare') {
      questionnaire.adaptations.push({
        timestamp: new Date(),
        reason: 'Healthcare industry detected - adding compliance questions',
        changes: {
          questionsAdded: ['hipaa-compliance', 'patient-data-handling']
        }
      });
    }

    // Add budget-specific adaptations
    if (clientProfile.type === ClientType.ENTERPRISE) {
      questionnaire.adaptations.push({
        timestamp: new Date(),
        reason: 'Enterprise client - adding stakeholder management questions',
        changes: {
          questionsAdded: ['stakeholder-list', 'approval-process', 'procurement-requirements']
        }
      });
    }
  }

  private async determineNextQuestion(
    questionnaireId: string,
    currentQuestionId: string,
    value: any
  ): Promise<Question | undefined> {
    // Adaptive logic to determine next question based on responses
    // This would implement conditional questionnaire flow
    return undefined;
  }

  private async applyAdaptations(
    questionnaireId: string,
    analysis: any
  ): Promise<QuestionnaireAdaptation | undefined> {
    // Apply real-time adaptations based on response analysis
    return undefined;
  }

  private extractTechnicalRequirements(description: string): string[] {
    const requirements: string[] = [];
    const techKeywords = [
      'api', 'database', 'integration', 'mobile', 'responsive', 
      'cms', 'ecommerce', 'payment', 'security', 'hosting'
    ];

    techKeywords.forEach(keyword => {
      if (description.toLowerCase().includes(keyword)) {
        requirements.push(keyword);
      }
    });

    return requirements;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateQuestionnaireId(): string {
    return `questionnaire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConcernId(): string {
    return `concern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate project recommendations based on intake data
  async generateProjectRecommendations(clientProfile: ClientProfile, responses: QuestionnaireResponse[]): Promise<{
    contractTemplate: string;
    suggestedTimeline: string;
    riskMitigation: string[];
    pricingStrategy: string;
    communicationPlan: string;
  }> {
    const recommendations = {
      contractTemplate: 'standard_contract',
      suggestedTimeline: 'standard_timeline',
      riskMitigation: [] as string[],
      pricingStrategy: 'hourly',
      communicationPlan: 'weekly_updates'
    };

    // Customize based on client type
    if (clientProfile.type === ClientType.ENTERPRISE) {
      recommendations.contractTemplate = 'enterprise_contract';
      recommendations.communicationPlan = 'formal_reporting';
      recommendations.pricingStrategy = 'milestone_based';
    }

    // Risk mitigation based on detected concerns
    if (clientProfile.riskLevel === 'high') {
      recommendations.riskMitigation.push('Require 50% upfront payment');
      recommendations.riskMitigation.push('Include detailed scope documentation');
      recommendations.riskMitigation.push('Add change request process');
    }

    return recommendations;
  }
}