/**
 * Portfolio Optimizer Test Suite
 * Comprehensive tests for all portfolio optimization functionality
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  PortfolioAnalysisEngine,
  PerformanceAnalytics,
  ABTestingFramework,
  ProjectShowcaseGenerator,
  SEOPortfolioOptimizer,
  PlatformSpecificFormatter,
  Platform,
  Portfolio,
  PortfolioProject,
  OptimizationSuggestions
} from '../index';

// Test Data Setup
const createMockPortfolio = (): Portfolio => ({
  id: 'test-portfolio-1',
  name: 'Test Freelancer Portfolio',
  projects: [
    {
      id: 'project-1',
      title: 'E-commerce Website',
      description: 'Built a modern e-commerce platform using React and Node.js',
      category: 'web-development',
      tags: ['react', 'node.js', 'e-commerce'],
      images: ['image1.jpg', 'image2.jpg'],
      metrics: {
        views: 100,
        clicks: 20,
        inquiries: 5,
        conversions: 2,
        avgTimeOnPage: 120,
        bounceRate: 0.4
      },
      dateCompleted: new Date('2023-09-01'),
      client: 'Test Client',
      url: 'https://example.com',
      technologies: ['React', 'Node.js', 'MongoDB'],
      results: ['20% increase in sales', 'Improved user experience']
    },
    {
      id: 'project-2',
      title: 'Mobile App Design',
      description: 'Designed user interface for iOS mobile application',
      category: 'design',
      tags: ['ui', 'ux', 'mobile'],
      images: ['mobile1.jpg'],
      metrics: {
        views: 50,
        clicks: 10,
        inquiries: 2,
        conversions: 1,
        avgTimeOnPage: 90,
        bounceRate: 0.5
      },
      dateCompleted: new Date('2023-10-01'),
      client: 'Mobile Corp',
      technologies: ['Figma', 'Adobe XD'],
      results: ['95% user satisfaction']
    }
  ],
  metadata: {
    platforms: [Platform.UPWORK, Platform.LINKEDIN],
    lastUpdated: new Date(),
    totalViews: 150,
    conversionRate: 0.02,
    averageEngagement: 105
  },
  analytics: {
    projectViews: { 'project-1': 100, 'project-2': 50 },
    conversionsByProject: { 'project-1': 2, 'project-2': 1 },
    platformPerformance: {},
    timeSeriesData: [],
    heatmapData: []
  }
});

describe('Portfolio Analysis Engine', () => {
  let analysisEngine: PortfolioAnalysisEngine;
  let mockPortfolio: Portfolio;

  beforeEach(() => {
    analysisEngine = new PortfolioAnalysisEngine();
    mockPortfolio = createMockPortfolio();
  });

  test('should analyze portfolio and return optimization suggestions', () => {
    const suggestions = analysisEngine.analyzePortfolio(mockPortfolio);

    expect(suggestions).toHaveProperty('reorderProjects');
    expect(suggestions).toHaveProperty('improveDescriptions');
    expect(suggestions).toHaveProperty('seoOptimizations');
    expect(suggestions).toHaveProperty('visualImprovements');
    expect(suggestions).toHaveProperty('platformSpecific');
  });

  test('should suggest reordering projects based on performance', () => {
    const suggestions = analysisEngine.analyzePortfolio(mockPortfolio);
    
    expect(Array.isArray(suggestions.reorderProjects)).toBe(true);
    
    // Higher performing project should be suggested to move up
    if (suggestions.reorderProjects.length > 0) {
      const firstSuggestion = suggestions.reorderProjects[0];
      expect(firstSuggestion).toHaveProperty('projectId');
      expect(firstSuggestion).toHaveProperty('currentPosition');
      expect(firstSuggestion).toHaveProperty('suggestedPosition');
      expect(firstSuggestion).toHaveProperty('reasoning');
    }
  });

  test('should identify description improvements', () => {
    const suggestions = analysisEngine.analyzePortfolio(mockPortfolio);
    
    expect(Array.isArray(suggestions.improveDescriptions)).toBe(true);
    expect(suggestions.improveDescriptions).toHaveLength(mockPortfolio.projects.length);
    
    suggestions.improveDescriptions.forEach(improvement => {
      expect(improvement).toHaveProperty('projectId');
      expect(improvement).toHaveProperty('currentDescription');
      expect(improvement).toHaveProperty('suggestedDescription');
      expect(improvement).toHaveProperty('improvements');
      expect(Array.isArray(improvement.improvements)).toBe(true);
    });
  });

  test('should generate SEO optimization suggestions', () => {
    const suggestions = analysisEngine.analyzePortfolio(mockPortfolio);
    
    expect(Array.isArray(suggestions.seoOptimizations)).toBe(true);
    
    suggestions.seoOptimizations.forEach(seo => {
      expect(seo).toHaveProperty('type');
      expect(seo).toHaveProperty('target');
      expect(seo).toHaveProperty('suggestion');
      expect(seo).toHaveProperty('priority');
      expect(['high', 'medium', 'low']).toContain(seo.priority);
    });
  });

  test('should identify visual improvements', () => {
    const suggestions = analysisEngine.analyzePortfolio(mockPortfolio);
    
    expect(Array.isArray(suggestions.visualImprovements)).toBe(true);
    
    suggestions.visualImprovements.forEach(visual => {
      expect(visual).toHaveProperty('projectId');
      expect(visual).toHaveProperty('type');
      expect(['thumbnail', 'gallery', 'layout']).toContain(visual.type);
      expect(visual).toHaveProperty('suggestion');
    });
  });

  test('should generate platform-specific suggestions', () => {
    const suggestions = analysisEngine.analyzePortfolio(mockPortfolio);
    
    expect(Array.isArray(suggestions.platformSpecific)).toBe(true);
    expect(suggestions.platformSpecific.length).toBeGreaterThan(0);
    
    suggestions.platformSpecific.forEach(platform => {
      expect(platform).toHaveProperty('platform');
      expect(platform).toHaveProperty('adaptations');
      expect(Array.isArray(platform.adaptations)).toBe(true);
    });
  });
});

describe('Performance Analytics', () => {
  let analytics: PerformanceAnalytics;
  const testPortfolioId = 'test-analytics-portfolio';
  const testProjectId = 'test-project';
  const testPlatform = Platform.UPWORK;

  beforeEach(() => {
    analytics = new PerformanceAnalytics();
    // Clean up any existing test data
    const analyticsPath = path.join(process.cwd(), 'data', 'analytics', `${testPortfolioId}.json`);
    if (fs.existsSync(analyticsPath)) {
      fs.unlinkSync(analyticsPath);
    }
  });

  afterEach(() => {
    // Cleanup test files
    const analyticsPath = path.join(process.cwd(), 'data', 'analytics', `${testPortfolioId}.json`);
    if (fs.existsSync(analyticsPath)) {
      fs.unlinkSync(analyticsPath);
    }
  });

  test('should track portfolio views correctly', () => {
    analytics.trackView(testPortfolioId, testProjectId, testPlatform);
    
    const report = analytics.generateAnalyticsReport(testPortfolioId);
    expect(report.projectViews[testProjectId]).toBe(1);
    expect(report.platformPerformance[testPlatform]).toHaveProperty('views', 1);
  });

  test('should track conversions correctly', () => {
    analytics.trackConversion(testPortfolioId, testProjectId, testPlatform);
    
    const report = analytics.generateAnalyticsReport(testPortfolioId);
    expect(report.conversionsByProject[testProjectId]).toBe(1);
    expect(report.platformPerformance[testPlatform]).toHaveProperty('conversions', 1);
  });

  test('should generate comprehensive analytics report', () => {
    // Add some test data
    analytics.trackView(testPortfolioId, testProjectId, testPlatform);
    analytics.trackConversion(testPortfolioId, testProjectId, testPlatform);
    
    const report = analytics.generateAnalyticsReport(testPortfolioId);
    
    expect(report).toHaveProperty('projectViews');
    expect(report).toHaveProperty('conversionsByProject');
    expect(report).toHaveProperty('platformPerformance');
    expect(report).toHaveProperty('timeSeriesData');
    expect(Array.isArray(report.timeSeriesData)).toBe(true);
  });

  test('should identify top performing projects', () => {
    // Add data for multiple projects
    analytics.trackConversion(testPortfolioId, 'project-1', testPlatform);
    analytics.trackConversion(testPortfolioId, 'project-1', testPlatform);
    analytics.trackConversion(testPortfolioId, 'project-2', testPlatform);
    
    const topProjects = analytics.getTopPerformingProjects(testPortfolioId, 2);
    
    expect(Array.isArray(topProjects)).toBe(true);
    expect(topProjects[0]).toBe('project-1'); // Should be first due to more conversions
  });
});

describe('A/B Testing Framework', () => {
  let abTesting: ABTestingFramework;
  const testPortfolioId = 'test-ab-portfolio';

  beforeEach(() => {
    abTesting = new ABTestingFramework();
    
    // Create mock portfolio file for testing
    const portfoliosDir = path.join(process.cwd(), 'data', 'portfolios');
    if (!fs.existsSync(portfoliosDir)) {
      fs.mkdirSync(portfoliosDir, { recursive: true });
    }
    
    const portfolio = createMockPortfolio();
    portfolio.id = testPortfolioId;
    fs.writeFileSync(
      path.join(portfoliosDir, `${testPortfolioId}.json`),
      JSON.stringify(portfolio, null, 2)
    );
  });

  afterEach(() => {
    // Cleanup test files
    const portfolioPath = path.join(process.cwd(), 'data', 'portfolios', `${testPortfolioId}.json`);
    if (fs.existsSync(portfolioPath)) {
      fs.unlinkSync(portfolioPath);
    }
    
    // Cleanup test results
    const testsDir = path.join(process.cwd(), 'data', 'ab-tests');
    if (fs.existsSync(testsDir)) {
      const files = fs.readdirSync(testsDir);
      files.forEach(file => {
        if (file.startsWith('test-')) {
          fs.unlinkSync(path.join(testsDir, file));
        }
      });
    }
  });

  test('should create A/B test with variants', () => {
    const variantAChanges = [{
      type: 'reorder' as const,
      description: 'Reorder projects',
      value: { newOrder: ['project-2', 'project-1'] }
    }];
    
    const variantBChanges = [{
      type: 'description' as const,
      projectId: 'project-1',
      description: 'Update description',
      value: 'New improved description'
    }];

    const test = abTesting.createABTest(testPortfolioId, 'Test Reorder', variantAChanges, variantBChanges);

    expect(test).toHaveProperty('testId');
    expect(test).toHaveProperty('variantA');
    expect(test).toHaveProperty('variantB');
    expect(test).toHaveProperty('metrics');
    expect(test.variantA.changes).toEqual(variantAChanges);
    expect(test.variantB.changes).toEqual(variantBChanges);
  });

  test('should record test interactions', () => {
    const test = abTesting.createABTest(testPortfolioId, 'Test Interaction', [], []);
    
    // Record impressions and conversions
    abTesting.recordTestInteraction(test.testId, 'A', 'impression');
    abTesting.recordTestInteraction(test.testId, 'A', 'conversion');
    abTesting.recordTestInteraction(test.testId, 'B', 'impression');
    
    const results = abTesting.getTestResults(test.testId);
    
    expect(results.metrics.impressions.A).toBe(1);
    expect(results.metrics.conversions.A).toBe(1);
    expect(results.metrics.impressions.B).toBe(1);
    expect(results.metrics.conversions.B).toBe(0);
    expect(results.metrics.ctr.A).toBe(1.0);
    expect(results.metrics.ctr.B).toBe(0.0);
  });

  test('should calculate statistical significance', () => {
    const test = abTesting.createABTest(testPortfolioId, 'Test Significance', [], []);
    
    // Add enough data for statistical significance
    for (let i = 0; i < 100; i++) {
      abTesting.recordTestInteraction(test.testId, 'A', 'impression');
      abTesting.recordTestInteraction(test.testId, 'B', 'impression');
    }
    
    // Add more conversions to variant A
    for (let i = 0; i < 20; i++) {
      abTesting.recordTestInteraction(test.testId, 'A', 'conversion');
    }
    
    for (let i = 0; i < 5; i++) {
      abTesting.recordTestInteraction(test.testId, 'B', 'conversion');
    }
    
    const results = abTesting.getTestResults(test.testId);
    
    expect(results.metrics.statistical_significance).toBeGreaterThan(0);
    expect(typeof results.metrics.statistical_significance).toBe('number');
  });

  test('should determine test winner with sufficient data', () => {
    const test = abTesting.createABTest(testPortfolioId, 'Test Winner', [], []);
    
    // Simulate significant difference
    for (let i = 0; i < 1000; i++) {
      abTesting.recordTestInteraction(test.testId, 'A', 'impression');
      abTesting.recordTestInteraction(test.testId, 'B', 'impression');
    }
    
    for (let i = 0; i < 200; i++) {
      abTesting.recordTestInteraction(test.testId, 'A', 'conversion');
    }
    
    for (let i = 0; i < 50; i++) {
      abTesting.recordTestInteraction(test.testId, 'B', 'conversion');
    }
    
    const results = abTesting.getTestResults(test.testId);
    
    if (results.winner) {
      expect(['A', 'B']).toContain(results.winner);
      expect(results.confidence).toBeGreaterThan(0.95);
    }
  });
});

describe('Project Showcase Generator', () => {
  let showcaseGenerator: ProjectShowcaseGenerator;
  let mockProject: PortfolioProject;

  beforeEach(() => {
    showcaseGenerator = new ProjectShowcaseGenerator();
    mockProject = createMockPortfolio().projects[0];
  });

  test('should generate case study for a project', () => {
    const caseStudy = showcaseGenerator.generateCaseStudy(mockProject);
    
    expect(typeof caseStudy).toBe('string');
    expect(caseStudy).toContain(mockProject.title);
    expect(caseStudy.length).toBeGreaterThan(50);
  });

  test('should generate case studies for multiple projects', () => {
    const projects = createMockPortfolio().projects;
    const caseStudies = showcaseGenerator.generateMultipleCaseStudies(projects);
    
    expect(typeof caseStudies).toBe('object');
    expect(Object.keys(caseStudies)).toHaveLength(projects.length);
    
    projects.forEach(project => {
      expect(caseStudies).toHaveProperty(project.id);
      expect(typeof caseStudies[project.id]).toBe('string');
    });
  });

  test('should use appropriate template based on category', () => {
    const webDevProject = { ...mockProject, category: 'web-development' };
    const designProject = { ...mockProject, category: 'design' };
    
    const webCaseStudy = showcaseGenerator.generateCaseStudy(webDevProject);
    const designCaseStudy = showcaseGenerator.generateCaseStudy(designProject);
    
    expect(webCaseStudy).toContain('Tech Stack');
    expect(designCaseStudy).toContain('Creative Process');
  });

  test('should include project technologies and results', () => {
    const caseStudy = showcaseGenerator.generateCaseStudy(mockProject);
    
    mockProject.technologies.forEach(tech => {
      expect(caseStudy).toContain(tech);
    });
    
    mockProject.results.forEach(result => {
      expect(caseStudy).toContain(result);
    });
  });
});

describe('SEO Portfolio Optimizer', () => {
  let seoOptimizer: SEOPortfolioOptimizer;
  let mockPortfolio: Portfolio;

  beforeEach(() => {
    seoOptimizer = new SEOPortfolioOptimizer();
    mockPortfolio = createMockPortfolio();
  });

  test('should optimize portfolio for target keywords', () => {
    const targetKeywords = ['responsive design', 'full-stack', 'user experience'];
    const optimized = seoOptimizer.optimizePortfolioSEO(mockPortfolio, targetKeywords);
    
    expect(optimized).toHaveProperty('projects');
    expect(optimized.projects.length).toBe(mockPortfolio.projects.length);
    
    // Check that projects have been modified
    optimized.projects.forEach((project, index) => {
      expect(project.id).toBe(mockPortfolio.projects[index].id);
      // Some optimization should have occurred
      expect(project.title.length >= mockPortfolio.projects[index].title.length).toBe(true);
    });
  });

  test('should analyze keyword opportunities', () => {
    const analysis = seoOptimizer.analyzeKeywordOpportunities(mockPortfolio);
    
    expect(analysis).toHaveProperty('missing');
    expect(analysis).toHaveProperty('underutilized');
    expect(analysis).toHaveProperty('overused');
    expect(analysis).toHaveProperty('suggestions');
    
    expect(Array.isArray(analysis.missing)).toBe(true);
    expect(Array.isArray(analysis.underutilized)).toBe(true);
    expect(Array.isArray(analysis.overused)).toBe(true);
    expect(Array.isArray(analysis.suggestions)).toBe(true);
  });

  test('should generate comprehensive SEO report', () => {
    const report = seoOptimizer.generateSEOReport(mockPortfolio);
    
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('keywordAnalysis');
    expect(report).toHaveProperty('competitorInsights');
    
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(Array.isArray(report.competitorInsights)).toBe(true);
  });

  test('should calculate reasonable SEO score', () => {
    const report = seoOptimizer.generateSEOReport(mockPortfolio);
    
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test('should provide actionable recommendations', () => {
    const report = seoOptimizer.generateSEOReport(mockPortfolio);
    
    report.recommendations.forEach(recommendation => {
      expect(typeof recommendation).toBe('string');
      expect(recommendation.length).toBeGreaterThan(10);
    });
  });
});

describe('Platform Specific Formatter', () => {
  let platformFormatter: PlatformSpecificFormatter;
  let mockPortfolio: Portfolio;

  beforeEach(() => {
    platformFormatter = new PlatformSpecificFormatter();
    mockPortfolio = createMockPortfolio();
  });

  test('should format portfolio for Upwork', () => {
    const formatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.UPWORK);
    
    expect(formatted).toHaveProperty('projects');
    
    formatted.projects.forEach(project => {
      expect(project.title).toContain('Client Success Story');
      expect(project.description).toContain('Technologies:');
    });
  });

  test('should format portfolio for Fiverr', () => {
    const formatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.FIVERR);
    
    formatted.projects.forEach(project => {
      expect(project.title).toContain('I will');
      expect(project.description).toContain('Fast delivery');
      expect(project.description).toContain('satisfaction guarantee');
    });
  });

  test('should format portfolio for LinkedIn', () => {
    const formatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.LINKEDIN);
    
    formatted.projects.forEach(project => {
      expect(project.title).toContain('Professional Portfolio');
      expect(project.description).toContain('Client:');
      expect(project.description).toMatch(/#\w+/); // Should contain hashtags
    });
  });

  test('should preserve original portfolio structure', () => {
    const original = JSON.parse(JSON.stringify(mockPortfolio));
    const formatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.UPWORK);
    
    expect(formatted.id).toBe(original.id);
    expect(formatted.projects.length).toBe(original.projects.length);
    
    formatted.projects.forEach((project, index) => {
      expect(project.id).toBe(original.projects[index].id);
      expect(project.category).toBe(original.projects[index].category);
    });
  });

  test('should apply different formatting for different platforms', () => {
    const upworkFormatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.UPWORK);
    const fiverrFormatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.FIVERR);
    const linkedinFormatted = platformFormatter.formatForPlatform(mockPortfolio, Platform.LINKEDIN);
    
    // Each platform should have different formatting
    expect(upworkFormatted.projects[0].title).not.toBe(fiverrFormatted.projects[0].title);
    expect(upworkFormatted.projects[0].title).not.toBe(linkedinFormatted.projects[0].title);
    expect(fiverrFormatted.projects[0].title).not.toBe(linkedinFormatted.projects[0].title);
  });

  test('should filter projects appropriately for visual platforms', () => {
    // Add a project without images
    const portfolioWithMixedProjects = { ...mockPortfolio };
    portfolioWithMixedProjects.projects.push({
      ...mockPortfolio.projects[0],
      id: 'no-images-project',
      category: 'design',
      images: [] // No images
    });

    const behanceFormatted = platformFormatter.formatForPlatform(
      portfolioWithMixedProjects, 
      Platform.BEHANCE
    );
    
    // Behance should filter out projects without images
    const projectWithoutImages = behanceFormatted.projects.find(p => p.id === 'no-images-project');
    expect(projectWithoutImages).toBeUndefined();
  });
});

describe('Integration Tests', () => {
  test('should work end-to-end from analysis to optimization', () => {
    const portfolio = createMockPortfolio();
    const analysisEngine = new PortfolioAnalysisEngine();
    const seoOptimizer = new SEOPortfolioOptimizer();
    const platformFormatter = new PlatformSpecificFormatter();
    
    // 1. Analyze portfolio
    const suggestions = analysisEngine.analyzePortfolio(portfolio);
    expect(suggestions).toBeDefined();
    
    // 2. Apply SEO optimization
    const optimized = seoOptimizer.optimizePortfolioSEO(portfolio, ['react', 'design']);
    expect(optimized.projects.length).toBe(portfolio.projects.length);
    
    // 3. Format for platform
    const formatted = platformFormatter.formatForPlatform(optimized, Platform.UPWORK);
    expect(formatted.projects.length).toBeGreaterThan(0);
    
    // Verify the chain of operations maintained data integrity
    expect(formatted.id).toBe(portfolio.id);
    expect(formatted.projects[0].id).toBe(portfolio.projects[0].id);
  });

  test('should handle empty portfolio gracefully', () => {
    const emptyPortfolio: Portfolio = {
      id: 'empty',
      name: 'Empty Portfolio',
      projects: [],
      metadata: {
        platforms: [],
        lastUpdated: new Date(),
        totalViews: 0,
        conversionRate: 0,
        averageEngagement: 0
      },
      analytics: {
        projectViews: {},
        conversionsByProject: {},
        platformPerformance: {},
        timeSeriesData: [],
        heatmapData: []
      }
    };

    const analysisEngine = new PortfolioAnalysisEngine();
    const suggestions = analysisEngine.analyzePortfolio(emptyPortfolio);
    
    expect(suggestions).toBeDefined();
    expect(suggestions.reorderProjects).toHaveLength(0);
    expect(suggestions.improveDescriptions).toHaveLength(0);
  });

  test('should maintain consistent data types throughout processing', () => {
    const portfolio = createMockPortfolio();
    const analysisEngine = new PortfolioAnalysisEngine();
    
    const suggestions = analysisEngine.analyzePortfolio(portfolio);
    
    // Verify all expected properties exist and have correct types
    expect(Array.isArray(suggestions.reorderProjects)).toBe(true);
    expect(Array.isArray(suggestions.improveDescriptions)).toBe(true);
    expect(Array.isArray(suggestions.seoOptimizations)).toBe(true);
    expect(Array.isArray(suggestions.visualImprovements)).toBe(true);
    expect(Array.isArray(suggestions.platformSpecific)).toBe(true);
    
    // Verify numeric properties are numbers
    suggestions.reorderProjects.forEach(suggestion => {
      expect(typeof suggestion.currentPosition).toBe('number');
      expect(typeof suggestion.suggestedPosition).toBe('number');
      expect(typeof suggestion.expectedImprovement).toBe('number');
    });
  });
});