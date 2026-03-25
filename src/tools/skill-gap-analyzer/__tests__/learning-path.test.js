/**
 * Tests for Learning Path Generator
 * CFX-067: Skill Gap Analysis Tests
 */

const fs = require('fs');
const learningPath = require('../learning-path');

// Mock fs to avoid file system side effects in tests
jest.mock('fs');

describe('Learning Path Generator', () => {
  
  beforeEach(() => {
    // Reset mocks
    fs.existsSync.mockClear();
    fs.readFileSync.mockClear();
    fs.writeFileSync.mockClear();
    fs.mkdirSync.mockClear();
  });

  describe('Time Estimation', () => {
    test('should estimate learning time correctly for different skills', () => {
      const jsTime = learningPath.estimateTimeToLearnSkill(2, 'javascript');
      const pythonTime = learningPath.estimateTimeToLearnSkill(2, 'python');
      const communicationTime = learningPath.estimateTimeToLearnSkill(2, 'communication');
      const aiTime = learningPath.estimateTimeToLearnSkill(2, 'ai_ml');

      // JavaScript should take more time than communication (technical vs soft)
      expect(jsTime).toBeGreaterThan(communicationTime);
      
      // AI/ML should take the most time due to high multiplier
      expect(aiTime).toBeGreaterThan(jsTime);
      expect(aiTime).toBeGreaterThan(pythonTime);

      // All estimates should be reasonable (not zero or extremely high)
      [jsTime, pythonTime, communicationTime, aiTime].forEach(time => {
        expect(time).toBeGreaterThan(0);
        expect(time).toBeLessThan(500); // Sanity check
      });
    });

    test('should scale time with gap size', () => {
      const smallGap = learningPath.estimateTimeToLearnSkill(1, 'javascript');
      const mediumGap = learningPath.estimateTimeToLearnSkill(3, 'javascript');
      const largeGap = learningPath.estimateTimeToLearnSkill(5, 'javascript');

      expect(mediumGap).toBeGreaterThan(smallGap);
      expect(largeGap).toBeGreaterThan(mediumGap);
      
      // Should be roughly proportional
      expect(mediumGap / smallGap).toBeCloseTo(3, 0.5);
      expect(largeGap / smallGap).toBeCloseTo(5, 0.5);
    });
  });

  describe('Learning Path Generation', () => {
    test('should generate comprehensive learning path', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const mockGapAnalysis = {
        userId: 'test-user',
        targetRole: 'fullstack-developer',
        gaps: {
          'technical.javascript': {
            skillName: 'JavaScript',
            current: 4,
            required: 8,
            gap: 4,
            priority: 72,
            marketDemand: 9
          },
          'soft.communication': {
            skillName: 'Communication',
            current: 5,
            required: 7,
            gap: 2,
            priority: 30,
            marketDemand: 10
          }
        },
        readinessPercentage: 65
      };

      const options = {
        timeCommitment: 10,
        budget: 500,
        preferredFormat: 'mixed',
        targetTimeframe: 6
      };

      const path = learningPath.generateLearningPath(mockGapAnalysis, options);

      // Check basic structure
      expect(path).toHaveProperty('id');
      expect(path).toHaveProperty('userId', 'test-user');
      expect(path).toHaveProperty('targetRole', 'fullstack-developer');
      expect(path).toHaveProperty('timeline');
      expect(path).toHaveProperty('skills');
      expect(path).toHaveProperty('milestones');
      expect(path).toHaveProperty('weeklySchedule');
      expect(path).toHaveProperty('summary');

      // Check that skills are ordered by priority
      const skillKeys = Object.keys(path.skills);
      expect(skillKeys).toContain('technical.javascript'); // Higher priority
      
      // Check timeline
      expect(Array.isArray(path.timeline)).toBe(true);
      expect(path.timeline.length).toBeGreaterThan(0);

      // Check summary calculations
      expect(path.summary).toHaveProperty('totalSkills');
      expect(path.summary).toHaveProperty('totalWeeks');
      expect(path.summary).toHaveProperty('avgHoursPerWeek', 10);
      expect(path.summary).toHaveProperty('estimatedReadinessImprovement');

      // Validate time and cost calculations
      expect(path.totalEstimatedTime).toBeGreaterThan(0);
      expect(path.totalEstimatedCost).toBeGreaterThanOrEqual(0);
    });

    test('should respect budget constraints', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      const mockGapAnalysis = {
        userId: 'test-user',
        targetRole: 'fullstack-developer',
        gaps: {
          'technical.javascript': {
            skillName: 'JavaScript',
            current: 4,
            required: 8,
            gap: 4,
            priority: 72,
            marketDemand: 9
          }
        },
        readinessPercentage: 50
      };

      const lowBudgetPath = learningPath.generateLearningPath(mockGapAnalysis, {
        timeCommitment: 10,
        budget: 50, // Very low budget
        preferredFormat: 'mixed'
      });

      const highBudgetPath = learningPath.generateLearningPath(mockGapAnalysis, {
        timeCommitment: 10,
        budget: 1000, // High budget
        preferredFormat: 'mixed'
      });

      // High budget path should cost more (can afford more resources)
      expect(highBudgetPath.totalEstimatedCost).toBeGreaterThan(lowBudgetPath.totalEstimatedCost);
    });
  });

  describe('Skill Learning Plan', () => {
    test('should create detailed skill plan', () => {
      const mockGap = {
        skillName: 'JavaScript',
        current: 4,
        required: 8,
        gap: 4,
        priority: 72,
        marketDemand: 9
      };

      const options = {
        timeCommitment: 10,
        budget: 500,
        preferredFormat: 'mixed',
        difficulty: 'progressive'
      };

      const resources = learningPath.DEFAULT_LEARNING_RESOURCES;

      const plan = learningPath.generateSkillLearningPlan(
        'technical.javascript',
        mockGap,
        options,
        resources
      );

      expect(plan).toHaveProperty('skillKey', 'technical.javascript');
      expect(plan).toHaveProperty('skillName', 'JavaScript');
      expect(plan).toHaveProperty('gap', 4);
      expect(plan).toHaveProperty('estimatedHours');
      expect(plan).toHaveProperty('timelineWeeks');
      expect(plan).toHaveProperty('resources');
      expect(plan).toHaveProperty('milestones');

      // Check resources structure
      expect(plan.resources).toHaveProperty('courses');
      expect(plan.resources).toHaveProperty('books');
      expect(plan.resources).toHaveProperty('projects');
      expect(plan.resources).toHaveProperty('certifications');

      // Check milestones
      expect(Array.isArray(plan.milestones)).toBe(true);
      expect(plan.milestones.length).toBe(4); // Foundation, Practice, Application, Mastery

      const milestones = plan.milestones;
      expect(milestones[0]).toHaveProperty('name', 'Foundation');
      expect(milestones[0]).toHaveProperty('progressPercentage', 25);
      expect(milestones[3]).toHaveProperty('name', 'Mastery');
      expect(milestones[3]).toHaveProperty('progressPercentage', 100);
    });

    test('should generate generic plan for unknown skills', () => {
      const mockGap = {
        skillName: 'Unknown Skill',
        current: 3,
        required: 7,
        gap: 4,
        priority: 50
      };

      const options = {
        timeCommitment: 10,
        budget: 500,
        preferredFormat: 'mixed'
      };

      const resources = {};

      const plan = learningPath.generateSkillLearningPlan(
        'unknown.skill',
        mockGap,
        options,
        resources
      );

      expect(plan).toBeDefined();
      expect(plan.skillKey).toBe('unknown.skill');
      expect(plan.estimatedHours).toBe(80); // 4 * 20 (generic rate)
      expect(plan.totalCost).toBe(0); // Generic resources are free
    });
  });

  describe('Milestone Generation', () => {
    test('should create proper milestone structure', () => {
      const mockPlan = {
        estimatedHours: 120
      };

      const milestones = learningPath.generateSkillMilestones(mockPlan);

      expect(milestones).toHaveLength(4);

      milestones.forEach((milestone, index) => {
        expect(milestone).toHaveProperty('name');
        expect(milestone).toHaveProperty('description');
        expect(milestone).toHaveProperty('progressPercentage');
        expect(milestone).toHaveProperty('estimatedHours');
        expect(milestone).toHaveProperty('completed', false);

        // Check progressive percentages
        const expectedPercentage = (index + 1) * 25;
        expect(milestone.progressPercentage).toBe(expectedPercentage);

        // Check hours distribution
        const expectedHours = Math.ceil(120 * (expectedPercentage / 100));
        expect(milestone.estimatedHours).toBe(expectedHours);
      });
    });
  });

  describe('Weekly Schedule Generation', () => {
    test('should create realistic weekly schedule', () => {
      const mockLearningPath = {
        timeline: [
          {
            skillName: 'JavaScript',
            startWeek: 1,
            endWeek: 8,
            estimatedHours: 80
          },
          {
            skillName: 'React',
            startWeek: 5,
            endWeek: 12,
            estimatedHours: 60
          }
        ]
      };

      const timeCommitment = 10;
      const schedule = learningPath.generateWeeklySchedule(mockLearningPath, timeCommitment);

      expect(Array.isArray(schedule)).toBe(true);
      expect(schedule.length).toBe(12); // Max end week

      schedule.forEach(week => {
        expect(week).toHaveProperty('week');
        expect(week).toHaveProperty('totalHours');
        expect(week).toHaveProperty('activities');
        
        // Total hours should not exceed time commitment
        expect(week.totalHours).toBeLessThanOrEqual(timeCommitment);
        
        // Activities should be properly structured
        week.activities.forEach(activity => {
          expect(activity).toHaveProperty('skill');
          expect(activity).toHaveProperty('hours');
          expect(activity).toHaveProperty('focus');
        });
      });

      // Week 1-4 should have JavaScript only
      expect(schedule[0].activities).toHaveLength(1);
      expect(schedule[0].activities[0].skill).toBe('JavaScript');

      // Week 5+ should have both skills (overlap)
      expect(schedule[4].activities.length).toBeGreaterThan(1);
    });
  });

  describe('Progress Tracking', () => {
    test('should track progress correctly', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{}');
      fs.writeFileSync.mockImplementation(() => {});

      const progressData = {
        hoursSpent: 5,
        milestoneCompleted: 'Foundation',
        currentLevel: 6,
        note: 'Completed first project'
      };

      const result = learningPath.trackProgress('test-user', 'technical.javascript', progressData);

      expect(result).toHaveProperty('hoursSpent', 5);
      expect(result).toHaveProperty('currentLevel', 6);
      expect(result).toHaveProperty('milestonesCompleted');
      expect(result).toHaveProperty('notes');
      expect(result).toHaveProperty('lastUpdated');

      expect(result.milestonesCompleted).toHaveLength(1);
      expect(result.milestonesCompleted[0]).toHaveProperty('milestone', 'Foundation');
      expect(result.milestonesCompleted[0]).toHaveProperty('completedAt');

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0]).toHaveProperty('note', 'Completed first project');
    });

    test('should accumulate progress over multiple updates', () => {
      // Mock existing progress
      const existingProgress = {
        'test-user': {
          'technical.javascript': {
            hoursSpent: 10,
            milestonesCompleted: [{ milestone: 'Foundation', completedAt: '2024-01-01' }],
            currentLevel: 5,
            notes: [{ note: 'Initial note', timestamp: '2024-01-01' }]
          }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(existingProgress));
      fs.writeFileSync.mockImplementation(() => {});

      const progressUpdate = {
        hoursSpent: 3,
        milestoneCompleted: 'Practice',
        currentLevel: 6,
        note: 'Second note'
      };

      const result = learningPath.trackProgress('test-user', 'technical.javascript', progressUpdate);

      expect(result.hoursSpent).toBe(13); // 10 + 3
      expect(result.currentLevel).toBe(6); // Updated
      expect(result.milestonesCompleted).toHaveLength(2); // Added one
      expect(result.notes).toHaveLength(2); // Added one
    });
  });

  describe('Learning Resources', () => {
    test('should initialize default learning resources', () => {
      fs.existsSync.mockReturnValue(false);
      fs.writeFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});

      learningPath.initializeLearningResources();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls.find(call => 
        call[0].includes('learning-resources.json')
      );
      expect(writeCall).toBeDefined();

      const resourcesData = JSON.parse(writeCall[1]);
      expect(resourcesData).toHaveProperty('javascript');
      expect(resourcesData).toHaveProperty('react');
      expect(resourcesData).toHaveProperty('python');
      expect(resourcesData).toHaveProperty('communication');

      // Test resource structure
      const jsResources = resourcesData.javascript;
      expect(jsResources).toHaveProperty('courses');
      expect(jsResources).toHaveProperty('books');
      expect(jsResources).toHaveProperty('projects');
      expect(jsResources).toHaveProperty('certifications');

      expect(Array.isArray(jsResources.courses)).toBe(true);
      expect(jsResources.courses.length).toBeGreaterThan(0);

      // Test course structure
      const firstCourse = jsResources.courses[0];
      expect(firstCourse).toHaveProperty('name');
      expect(firstCourse).toHaveProperty('provider');
      expect(firstCourse).toHaveProperty('duration');
      expect(firstCourse).toHaveProperty('cost');
      expect(firstCourse).toHaveProperty('rating');
    });
  });

  describe('ID Generation', () => {
    test('should generate unique learning path IDs', () => {
      const id1 = learningPath.generateLearningPathId();
      const id2 = learningPath.generateLearningPathId();

      expect(id1).toMatch(/^path_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^path_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});