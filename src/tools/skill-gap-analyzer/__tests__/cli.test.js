/**
 * Tests for CLI Interface
 * CFX-067: Skill Gap Analysis Tests
 */

const cli = require('../cli');

// Mock console to capture output
const mockConsole = {
  log: jest.fn(),
  error: jest.fn()
};
global.console = mockConsole;

// Mock process.exit to prevent actual exit
const mockExit = jest.fn();
process.exit = mockExit;

// Mock the modules
jest.mock('../assessment');
jest.mock('../learning-path');
jest.mock('../market-demand');

const assessment = require('../assessment');
const learningPath = require('../learning-path');
const marketDemand = require('../market-demand');

describe('CLI Interface', () => {
  
  beforeEach(() => {
    // Clear all mocks
    mockConsole.log.mockClear();
    mockConsole.error.mockClear();
    mockExit.mockClear();
    
    jest.clearAllMocks();
  });

  describe('Help Command', () => {
    test('should display help information', () => {
      cli.showHelp();

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      
      expect(output).toContain('CORTEX SKILL GAP ANALYZER');
      expect(output).toContain('assess');
      expect(output).toContain('analyze');
      expect(output).toContain('learn');
      expect(output).toContain('market');
      expect(output).toContain('progress');
      expect(output).toContain('USAGE:');
      expect(output).toContain('EXAMPLES:');
    });
  });

  describe('Assessment Command', () => {
    test('should run assessment successfully', () => {
      const mockAssessmentResult = {
        id: 'test-assessment-123',
        userId: 'test-user',
        timestamp: '2024-01-01T00:00:00.000Z',
        skills: {
          'technical.javascript': 8,
          'technical.react': 7,
          'soft.communication': 9,
          'business.marketing': 5
        }
      };

      assessment.conductAssessment.mockReturnValue(mockAssessmentResult);

      cli.runAssessment(['--user', 'test-user']);

      expect(assessment.conductAssessment).toHaveBeenCalledWith({
        userId: 'test-user',
        interactive: false
      });

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Assessment Results');
      expect(output).toContain('test-assessment-123');
      expect(output).toContain('Top Skills');
      expect(output).toContain('Areas for Improvement');
    });

    test('should handle assessment errors', () => {
      assessment.conductAssessment.mockImplementation(() => {
        throw new Error('Assessment failed');
      });

      cli.runAssessment([]);

      expect(mockConsole.error).toHaveBeenCalledWith(
        '❌ Error running assessment:', 
        'Assessment failed'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Gap Analysis Command', () => {
    test('should analyze gaps successfully', () => {
      const mockAssessment = {
        userId: 'test-user',
        skills: { 'technical.javascript': 5 }
      };

      const mockGapAnalysis = {
        targetRole: 'fullstack-developer',
        readinessPercentage: 65,
        overallGapScore: 3.2,
        gaps: {
          'technical.javascript': {
            skillName: 'JavaScript',
            current: 5,
            required: 8,
            gap: 3,
            priority: 54,
            marketDemand: 9
          }
        },
        strengths: {
          'soft.communication': {
            skillName: 'Communication',
            current: 9,
            required: 7,
            excess: 2
          }
        },
        analysis: 'Analysis: 1 skills need improvement, 1 skills exceed requirements.'
      };

      assessment.getLatestAssessment.mockReturnValue(mockAssessment);
      assessment.analyzeSkillGaps.mockReturnValue(mockGapAnalysis);

      cli.analyzeGaps(['--role', 'fullstack-developer']);

      expect(assessment.getLatestAssessment).toHaveBeenCalledWith('default');
      expect(assessment.analyzeSkillGaps).toHaveBeenCalledWith(
        mockAssessment,
        'fullstack-developer'
      );

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Gap Analysis Summary');
      expect(output).toContain('fullstack-developer');
      expect(output).toContain('65%');
      expect(output).toContain('Priority Skills to Develop');
      expect(output).toContain('Your Strengths');
    });

    test('should handle missing assessment', () => {
      assessment.getLatestAssessment.mockReturnValue(null);

      cli.analyzeGaps([]);

      expect(mockConsole.error).toHaveBeenCalledWith(
        '❌ No assessment found. Please run "cortex skill-gap assess" first.'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Learning Path Command', () => {
    test('should generate learning path successfully', () => {
      const mockAssessment = {
        userId: 'test-user',
        skills: { 'technical.javascript': 5 }
      };

      const mockGapAnalysis = {
        targetRole: 'fullstack-developer',
        gaps: {
          'technical.javascript': {
            skillName: 'JavaScript',
            gap: 3,
            priority: 54
          }
        }
      };

      const mockLearningPath = {
        id: 'path-123',
        summary: {
          totalSkills: 1,
          totalWeeks: 12,
          costPerMonth: 167,
          estimatedReadinessImprovement: 25
        },
        totalEstimatedTime: 120,
        totalEstimatedCost: 500,
        timeline: [
          {
            skillName: 'JavaScript',
            startWeek: 1,
            endWeek: 12,
            estimatedHours: 120,
            cost: 500,
            priority: 54
          }
        ],
        weeklySchedule: [
          {
            week: 1,
            totalHours: 10,
            activities: [
              {
                skill: 'JavaScript',
                hours: 10,
                focus: 'Foundation & Theory'
              }
            ]
          }
        ],
        skills: {
          'technical.javascript': {
            skillName: 'JavaScript',
            resources: {
              courses: [
                {
                  name: 'JavaScript Fundamentals',
                  provider: 'Udemy',
                  duration: '12h',
                  cost: 49.99,
                  rating: 4.6
                }
              ],
              books: [
                {
                  name: 'Eloquent JavaScript',
                  author: 'Marijn Haverbeke',
                  cost: 39.95,
                  difficulty: 'intermediate'
                }
              ],
              projects: [
                {
                  name: 'Build a Todo App',
                  difficulty: 'beginner',
                  timeEstimate: '1-2 weeks'
                }
              ]
            },
            milestones: [
              {
                name: 'Foundation',
                description: 'Basic concepts and setup',
                progressPercentage: 25,
                estimatedHours: 30
              }
            ]
          }
        }
      };

      assessment.getLatestAssessment.mockReturnValue(mockAssessment);
      assessment.analyzeSkillGaps.mockReturnValue(mockGapAnalysis);
      learningPath.generateLearningPath.mockReturnValue(mockLearningPath);

      cli.generateLearning(['--time', '15', '--budget', '1000']);

      expect(learningPath.generateLearningPath).toHaveBeenCalledWith(
        mockGapAnalysis,
        expect.objectContaining({
          timeCommitment: 15,
          budget: 1000,
          targetRole: 'fullstack-developer'
        })
      );

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Learning Path Summary');
      expect(output).toContain('path-123');
      expect(output).toContain('Learning Timeline');
      expect(output).toContain('Weekly Schedule Preview');
      expect(output).toContain('Resources for JavaScript');
    });
  });

  describe('Market Data Command', () => {
    test('should show trending skills', () => {
      const mockTrends = {
        trending: [
          {
            skill: 'ai_ml',
            demand: 9.8,
            growth: 0.45,
            avgRate: 125,
            jobCount: 18000,
            futureProof: 10,
            trendScore: 95.2
          },
          {
            skill: 'react',
            demand: 9.5,
            growth: 0.25,
            avgRate: 85,
            jobCount: 35000,
            futureProof: 9,
            trendScore: 87.5
          }
        ],
        declining: [
          {
            skill: 'blockchain',
            demand: 6.5,
            growth: -0.1,
            riskScore: 45.0
          }
        ],
        analysis: 'Market Analysis:\n• 2 skills showing strong growth\n• 1 skills declining'
      };

      marketDemand.initializeMarketData.mockImplementation(() => {});
      marketDemand.analyzeTrendingSkills.mockReturnValue(mockTrends);

      cli.showMarketData(['--trends']);

      expect(marketDemand.analyzeTrendingSkills).toHaveBeenCalled();

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Trending Skills');
      expect(output).toContain('ai_ml');
      expect(output).toContain('react');
      expect(output).toContain('Declining Skills');
      expect(output).toContain('blockchain');
      expect(output).toContain('Market Analysis');
    });

    test('should analyze skill pricing', () => {
      const mockPricing = {
        totalMarketValue: 850,
        rateMultiplier: 1.15,
        recommendedRate: {
          min: 72,
          mid: 85,
          max: 98,
          confidence: 78
        },
        competitivePosition: {
          position: 'strong',
          avgDemand: 8.5,
          avgGrowth: 18,
          avgFutureProof: 8.2
        },
        skillPricing: [
          {
            skill: 'javascript',
            baseRate: 75,
            demand: 9,
            marketValue: 82
          },
          {
            skill: 'react',
            baseRate: 85,
            demand: 9,
            marketValue: 88
          }
        ],
        platformRecommendations: [
          {
            platform: 'toptal',
            avgRate: 110,
            skillCoverage: 100,
            score: 95,
            recommendation: 'Excellent fit - prioritize this platform'
          }
        ]
      };

      marketDemand.initializeMarketData.mockImplementation(() => {});
      marketDemand.analyzeSkillPricing.mockReturnValue(mockPricing);

      cli.showMarketData(['--pricing', '--skills', 'javascript', 'react']);

      expect(marketDemand.analyzeSkillPricing).toHaveBeenCalledWith(['javascript', 'react']);

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Pricing Analysis for Your Skills');
      expect(output).toContain('strong');
      expect(output).toContain('$85.00/hour');
      expect(output).toContain('Platform Recommendations');
      expect(output).toContain('toptal');
    });

    test('should analyze competitive advantage', () => {
      const mockAdvantage = {
        advantageScore: 75,
        uniquePositioning: {
          positioning: 'technical_specialist',
          uniqueness: 85
        },
        currentAdvantages: [
          {
            combination: 'react+nodejs',
            multiplier: 1.25,
            demand: 9.5
          }
        ],
        potentialAdvantages: [
          {
            combination: 'python+ai_ml',
            missingSkill: 'ai_ml',
            multiplier: 1.4,
            demand: 9.8
          }
        ]
      };

      marketDemand.initializeMarketData.mockImplementation(() => {});
      marketDemand.analyzeCompetitiveAdvantage.mockReturnValue(mockAdvantage);

      cli.showMarketData(['--competitive', '--skills', 'react', 'nodejs', 'python']);

      expect(marketDemand.analyzeCompetitiveAdvantage).toHaveBeenCalledWith(['react', 'nodejs', 'python']);

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Competitive Advantage Analysis');
      expect(output).toContain('technical_specialist');
      expect(output).toContain('react+nodejs');
      expect(output).toContain('Potential Skill Combinations');
    });
  });

  describe('Progress Tracking Command', () => {
    test('should show progress overview', () => {
      const mockProgress = {
        'technical.javascript': {
          hoursSpent: 25,
          currentLevel: 6,
          milestonesCompleted: [
            {
              milestone: 'Foundation',
              completedAt: '2024-01-15T00:00:00.000Z'
            }
          ],
          startedAt: '2024-01-01T00:00:00.000Z',
          lastUpdated: '2024-01-20T00:00:00.000Z',
          notes: [
            {
              note: 'Completed first project',
              timestamp: '2024-01-15T00:00:00.000Z'
            }
          ]
        }
      };

      learningPath.getUserProgress.mockReturnValue(mockProgress);

      cli.trackProgress([]);

      expect(learningPath.getUserProgress).toHaveBeenCalledWith('default');

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Learning Progress Overview');
      expect(output).toContain('technical.javascript');
      expect(output).toContain('25');
      expect(output).toContain('6/10');
      expect(output).toContain('Detailed Progress');
      expect(output).toContain('Foundation');
    });

    test('should update progress', () => {
      const mockUpdatedProgress = {
        hoursSpent: 30,
        currentLevel: 7,
        milestonesCompleted: [
          {
            milestone: 'Foundation',
            completedAt: '2024-01-15T00:00:00.000Z'
          },
          {
            milestone: 'Practice',
            completedAt: '2024-01-25T00:00:00.000Z'
          }
        ],
        lastUpdated: '2024-01-25T00:00:00.000Z'
      };

      learningPath.trackProgress.mockReturnValue(mockUpdatedProgress);

      cli.trackProgress([
        '--update',
        '--skill', 'technical.javascript',
        '--hours', '5',
        '--milestone', 'Practice',
        '--level', '7',
        '--note', 'Completed React basics'
      ]);

      expect(learningPath.trackProgress).toHaveBeenCalledWith(
        'default',
        'technical.javascript',
        {
          hoursSpent: 5,
          milestoneCompleted: 'Practice',
          currentLevel: 7,
          note: 'Completed React basics'
        }
      );

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('Progress updated for technical.javascript');
      expect(output).toContain('30');
      expect(output).toContain('7/10');
      expect(output).toContain('2');
    });

    test('should handle no progress data', () => {
      learningPath.getUserProgress.mockReturnValue({});

      cli.trackProgress([]);

      const output = mockConsole.log.mock.calls.map(call => call[0]).join('\n');
      expect(output).toContain('No progress data found');
      expect(output).toContain('cortex skill-gap progress --update');
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown commands', () => {
      // Mock process.argv for main function
      const originalArgv = process.argv;
      process.argv = ['node', 'cli.js', 'unknown-command'];

      try {
        cli.main();
        
        expect(mockConsole.error).toHaveBeenCalledWith(
          '❌ Unknown command: unknown-command'
        );
        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle module errors gracefully', () => {
      assessment.getLatestAssessment.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      cli.analyzeGaps([]);

      expect(mockConsole.error).toHaveBeenCalledWith(
        '❌ Error analyzing gaps:',
        'Database connection failed'
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  describe('Argument Parsing', () => {
    test('should parse assessment arguments correctly', () => {
      assessment.conductAssessment.mockReturnValue({
        id: 'test',
        userId: 'custom-user',
        timestamp: '2024-01-01T00:00:00.000Z',
        skills: {}
      });

      cli.runAssessment(['--user', 'custom-user', '--interactive']);

      expect(assessment.conductAssessment).toHaveBeenCalledWith({
        userId: 'custom-user',
        interactive: true
      });
    });

    test('should use default arguments when none provided', () => {
      const mockAssessment = {
        id: 'test',
        userId: 'default',
        timestamp: '2024-01-01T00:00:00.000Z',
        skills: {}
      };

      const mockGapAnalysis = {
        targetRole: 'fullstack-developer',
        gaps: {},
        strengths: {},
        readinessPercentage: 50,
        overallGapScore: 5,
        analysis: 'Test analysis'
      };

      assessment.getLatestAssessment.mockReturnValue(mockAssessment);
      assessment.analyzeSkillGaps.mockReturnValue(mockGapAnalysis);

      cli.analyzeGaps([]);

      expect(assessment.analyzeSkillGaps).toHaveBeenCalledWith(
        mockAssessment,
        'fullstack-developer' // Default target role
      );
    });
  });
});