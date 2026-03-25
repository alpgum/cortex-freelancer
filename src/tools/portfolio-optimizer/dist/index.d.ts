#!/usr/bin/env node
interface Portfolio {
    id: string;
    name: string;
    projects: PortfolioProject[];
    metadata: PortfolioMetadata;
    analytics: PortfolioAnalytics;
    optimization?: OptimizationSuggestions;
}
interface PortfolioProject {
    id: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
    images: string[];
    metrics: ProjectMetrics;
    dateCompleted: Date;
    client: string;
    url?: string;
    technologies: string[];
    results: string[];
}
interface PortfolioMetadata {
    platforms: Platform[];
    lastUpdated: Date;
    totalViews: number;
    conversionRate: number;
    averageEngagement: number;
}
interface PortfolioAnalytics {
    projectViews: {
        [projectId: string]: number;
    };
    conversionsByProject: {
        [projectId: string]: number;
    };
    platformPerformance: {
        [platform: string]: PlatformMetrics;
    };
    timeSeriesData: TimeSeriesData[];
    heatmapData: ViewHeatmap[];
}
interface ProjectMetrics {
    views: number;
    clicks: number;
    inquiries: number;
    conversions: number;
    avgTimeOnPage: number;
    bounceRate: number;
}
interface PlatformMetrics {
    views: number;
    conversions: number;
    avgCtr: number;
    topPerformingProjects: string[];
}
interface TimeSeriesData {
    date: string;
    views: number;
    conversions: number;
    platform: string;
}
interface ViewHeatmap {
    projectId: string;
    position: number;
    views: number;
    conversions: number;
}
interface OptimizationSuggestions {
    reorderProjects: ProjectReorderSuggestion[];
    improveDescriptions: DescriptionImprovement[];
    seoOptimizations: SEOOptimization[];
    visualImprovements: VisualImprovement[];
    platformSpecific: PlatformSpecificSuggestion[];
}
interface ProjectReorderSuggestion {
    projectId: string;
    currentPosition: number;
    suggestedPosition: number;
    reasoning: string;
    expectedImprovement: number;
}
interface DescriptionImprovement {
    projectId: string;
    currentDescription: string;
    suggestedDescription: string;
    improvements: string[];
    keywordDensity: number;
}
interface SEOOptimization {
    type: 'keyword' | 'meta' | 'structure';
    target: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: number;
}
interface VisualImprovement {
    projectId: string;
    type: 'thumbnail' | 'gallery' | 'layout';
    suggestion: string;
    mockupUrl?: string;
}
interface PlatformSpecificSuggestion {
    platform: Platform;
    adaptations: PlatformAdaptation[];
}
interface PlatformAdaptation {
    type: 'format' | 'content' | 'presentation';
    suggestion: string;
    implementation: string;
}
declare enum Platform {
    UPWORK = "upwork",
    FIVERR = "fiverr",
    LINKEDIN = "linkedin",
    PERSONAL_SITE = "personal_site",
    BEHANCE = "behance",
    DRIBBBLE = "dribbble"
}
interface ABTestResult {
    testId: string;
    variantA: PortfolioVariant;
    variantB: PortfolioVariant;
    metrics: ABTestMetrics;
    winner?: 'A' | 'B' | 'inconclusive';
    confidence: number;
}
interface PortfolioVariant {
    id: string;
    name: string;
    changes: VariantChange[];
    portfolio: Portfolio;
}
interface VariantChange {
    type: 'reorder' | 'description' | 'visual' | 'content';
    projectId?: string;
    description: string;
    value: any;
}
interface ABTestMetrics {
    impressions: {
        A: number;
        B: number;
    };
    conversions: {
        A: number;
        B: number;
    };
    ctr: {
        A: number;
        B: number;
    };
    duration: number;
    statistical_significance: number;
}
declare class PortfolioAnalysisEngine {
    analyzePortfolio(portfolio: Portfolio): OptimizationSuggestions;
    private analyzeProjectOrder;
    private analyzeDescriptions;
    private analyzeSEO;
    private analyzeVisualPresentation;
    private analyzePlatformOptimizations;
    private getConversionRate;
    private calculateProjectImpact;
    private calculateRecency;
    private calculateOptimalOrder;
    private generateReorderReasoning;
    private calculateExpectedImprovement;
    private identifyDescriptionImprovements;
    private optimizeDescription;
    private calculateKeywordDensity;
    private getCategoryKeywords;
    private findKeywordOpportunities;
    private analyzeMetaOptimizations;
    private identifyVisualIssues;
    private determineVisualImprovementType;
    private generateVisualSuggestion;
    private generateMockupUrl;
    private generatePlatformAdaptations;
}
declare class PerformanceAnalytics {
    trackView(portfolioId: string, projectId: string, platform: Platform): void;
    trackConversion(portfolioId: string, projectId: string, platform: Platform): void;
    generateAnalyticsReport(portfolioId: string): PortfolioAnalytics;
    getTopPerformingProjects(portfolioId: string, limit?: number): string[];
    private loadAnalytics;
    private saveAnalytics;
    private getAnalyticsPath;
    private createEmptyAnalytics;
}
declare class ABTestingFramework {
    createABTest(portfolioId: string, testName: string, variantAChanges: VariantChange[], variantBChanges: VariantChange[]): ABTestResult;
    recordTestInteraction(testId: string, variant: 'A' | 'B', interaction: 'impression' | 'conversion'): void;
    getTestResults(testId: string): ABTestResult;
    getAllActiveTests(): ABTestResult[];
    private createVariant;
    private applyVariantChange;
    private calculateStatisticalSignificance;
    private generateTestId;
    private loadPortfolio;
    private loadABTest;
    private saveABTest;
    private getTestsDir;
}
declare class ProjectShowcaseGenerator {
    generateCaseStudy(project: PortfolioProject, template?: string): string;
    generateMultipleCaseStudies(projects: PortfolioProject[], options?: {
        includeMetrics?: boolean;
        tone?: 'professional' | 'conversational' | 'technical';
        length?: 'short' | 'medium' | 'detailed';
    }): {
        [projectId: string]: string;
    };
    private selectTemplate;
    private applyTemplate;
    private generateTechnicalShowcase;
    private generateAppShowcase;
    private generateVisualShowcase;
    private generateResultsShowcase;
    private generateImpactShowcase;
    private generateGeneralShowcase;
    private generateClientTestimonial;
    private extractChallenge;
    private extractSolution;
    private extractResults;
    private extractPurpose;
    private extractGoal;
    private extractStrategy;
    private extractExecution;
    private extractMetrics;
    private extractStory;
    private extractRole;
    private extractUniqueValue;
    private extractSection;
}
declare class SEOPortfolioOptimizer {
    optimizePortfolioSEO(portfolio: Portfolio, targetKeywords: string[]): Portfolio;
    optimizeProjectSEO(project: PortfolioProject, targetKeywords: string[]): PortfolioProject;
    analyzeKeywordOpportunities(portfolio: Portfolio): {
        missing: string[];
        underutilized: string[];
        overused: string[];
        suggestions: string[];
    };
    generateSEOReport(portfolio: Portfolio): {
        score: number;
        recommendations: string[];
        keywordAnalysis: any;
        competitorInsights: string[];
    };
    private optimizeTitle;
    private optimizeDescription;
    private optimizeTags;
    private isKeywordRelevant;
    private getRelatedTerms;
    private extractAllText;
    private analyzeKeywordFrequency;
    private getCategoryKeywords;
    private generateKeywordSuggestions;
    private getTrendingKeywords;
    private calculateSEOScore;
    private generateSEORecommendations;
    private generateCompetitorInsights;
}
declare class PlatformSpecificFormatter {
    formatForPlatform(portfolio: Portfolio, platform: Platform): Portfolio;
    private formatForUpwork;
    private formatForFiverr;
    private formatForLinkedIn;
    private formatForPersonalSite;
    private formatForBehance;
    private formatForDribbble;
    private addUpworkTitleFormat;
    private addUpworkDescription;
    private filterUpworkTags;
    private addFiverrTitleFormat;
    private addFiverrDescription;
    private filterFiverrTags;
    private addLinkedInTitleFormat;
    private addLinkedInDescription;
    private filterLinkedInTags;
    private expandForPersonalSite;
    private addBehanceDescription;
    private addDribbbleDescription;
}
declare class PortfolioOptimizerCLI {
    private analysisEngine;
    private analytics;
    private abTesting;
    private showcaseGenerator;
    private seoOptimizer;
    private platformFormatter;
    constructor();
    run(): Promise<void>;
    private analyzePortfolio;
    private generateShowcase;
    private optimizeSEO;
    private formatForPlatform;
    private generateAnalyticsReport;
    private createABTest;
    private getTestResults;
    private createSamplePortfolio;
    private loadPortfolio;
    private savePortfolio;
    private displayOptimizationSuggestions;
}
export { PortfolioOptimizerCLI, PortfolioAnalysisEngine, PerformanceAnalytics, ABTestingFramework, ProjectShowcaseGenerator, SEOPortfolioOptimizer, PlatformSpecificFormatter, Platform, Portfolio, PortfolioProject, OptimizationSuggestions };
//# sourceMappingURL=index.d.ts.map