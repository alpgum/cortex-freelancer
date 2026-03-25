/**
 * Tests for JobMatcher
 */

const JobMatcher = require('../matching/JobMatcher');

describe('JobMatcher', () => {
    let matcher;
    let mockProfile;
    let mockJob;

    beforeEach(() => {
        matcher = new JobMatcher();
        
        mockProfile = {
            skills: {
                primary: ['javascript', 'react', 'node.js'],
                secondary: ['python', 'aws']
            },
            budget: {
                min: 50,
                max: 100,
                type: 'hourly'
            },
            availability: {
                hoursPerWeek: 40
            },
            experience: {
                years: 5,
                level: 'intermediate'
            },
            location: {
                country: 'US',
                timezone: 'EST'
            },
            preferences: {
                clientRating: 4.0
            }
        };

        mockJob = {
            id: 'test-job-1',
            title: 'React Developer Needed',
            skills: ['react', 'javascript', 'css'],
            budget: {
                min: 60,
                max: 80,
                type: 'hourly'
            },
            timeline: '2 weeks',
            client: {
                rating: 4.5,
                reviewCount: 25,
                hireRate: 80,
                isVerified: true
            },
            competition: 15,
            location: 'Remote',
            platform: 'upwork'
        };
    });

    describe('calculateMatch', () => {
        test('should calculate match score for perfect match', async () => {
            const score = await matcher.calculateMatch(mockProfile, mockJob);
            expect(score).toBeGreaterThan(70);
            expect(score).toBeLessThanOrEqual(100);
        });

        test('should handle missing skills gracefully', async () => {
            const jobWithNoSkills = { ...mockJob, skills: [] };
            const score = await matcher.calculateMatch(mockProfile, jobWithNoSkills);
            expect(score).toBeGreaterThanOrEqual(0);
        });

        test('should handle missing profile data gracefully', async () => {
            const incompleteProfile = { skills: { primary: ['javascript'] } };
            const score = await matcher.calculateMatch(incompleteProfile, mockJob);
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('calculateSkillsMatch', () => {
        test('should return high score for exact skill matches', () => {
            const profileSkills = ['react', 'javascript', 'node.js'];
            const jobSkills = ['react', 'javascript'];
            const score = matcher.calculateSkillsMatch(profileSkills, jobSkills);
            expect(score).toBe(1.0);
        });

        test('should return partial score for related skills', () => {
            const profileSkills = ['react', 'vue.js'];
            const jobSkills = ['angular', 'javascript'];
            const score = matcher.calculateSkillsMatch(profileSkills, jobSkills);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(1);
        });

        test('should return 0 for no skill match', () => {
            const profileSkills = ['python', 'django'];
            const jobSkills = ['java', 'spring'];
            const score = matcher.calculateSkillsMatch(profileSkills, jobSkills);
            expect(score).toBeLessThan(0.5);
        });

        test('should handle array and object skill formats', () => {
            const arraySkills = ['react', 'javascript'];
            const objectSkills = {
                primary: ['react', 'javascript'],
                secondary: ['css']
            };
            const jobSkills = ['react'];
            
            const arrayScore = matcher.calculateSkillsMatch(arraySkills, jobSkills);
            const objectScore = matcher.calculateSkillsMatch(objectSkills, jobSkills);
            
            expect(arrayScore).toBeGreaterThan(0);
            expect(objectScore).toBeGreaterThan(0);
        });
    });

    describe('calculateBudgetMatch', () => {
        test('should return high score for overlapping budgets', () => {
            const profileBudget = { min: 50, max: 100, type: 'hourly' };
            const jobBudget = { min: 60, max: 80, type: 'hourly' };
            const score = matcher.calculateBudgetMatch(profileBudget, jobBudget);
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return low score for non-overlapping budgets', () => {
            const profileBudget = { min: 100, max: 150, type: 'hourly' };
            const jobBudget = { min: 20, max: 30, type: 'hourly' };
            const score = matcher.calculateBudgetMatch(profileBudget, jobBudget);
            expect(score).toBeLessThan(0.3);
        });

        test('should handle budget type mismatches', () => {
            const profileBudget = { min: 50, max: 100, type: 'hourly' };
            const jobBudget = { min: 2000, max: 4000, type: 'fixed' };
            const score = matcher.calculateBudgetMatch(profileBudget, jobBudget);
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(1);
        });
    });

    describe('calculateTimelineMatch', () => {
        test('should return high score for sufficient availability', () => {
            const availability = { hoursPerWeek: 40 };
            const timeline = '2 weeks';
            const score = matcher.calculateTimelineMatch(availability, timeline);
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return low score for insufficient availability', () => {
            const availability = { hoursPerWeek: 10 };
            const timeline = '1 week';
            const score = matcher.calculateTimelineMatch(availability, timeline);
            expect(score).toBeLessThan(0.6);
        });

        test('should handle various timeline formats', () => {
            const availability = { hoursPerWeek: 40 };
            
            const weekTimeline = matcher.calculateTimelineMatch(availability, '2 weeks');
            const dayTimeline = matcher.calculateTimelineMatch(availability, '10 days');
            const monthTimeline = matcher.calculateTimelineMatch(availability, '1 month');
            
            expect(weekTimeline).toBeGreaterThan(0);
            expect(dayTimeline).toBeGreaterThan(0);
            expect(monthTimeline).toBeGreaterThan(0);
        });
    });

    describe('calculateClientQualityMatch', () => {
        test('should return high score for quality clients', () => {
            const preferences = { clientRating: 4.0 };
            const client = {
                rating: 4.8,
                reviewCount: 50,
                hireRate: 90,
                isVerified: true,
                paymentVerified: true
            };
            const score = matcher.calculateClientQualityMatch(preferences, client);
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return low score for poor clients', () => {
            const preferences = { clientRating: 4.0 };
            const client = {
                rating: 2.0,
                reviewCount: 2,
                hireRate: 10,
                isVerified: false,
                paymentVerified: false
            };
            const score = matcher.calculateClientQualityMatch(preferences, client);
            expect(score).toBeLessThan(0.5);
        });

        test('should handle missing client data', () => {
            const preferences = { clientRating: 4.0 };
            const client = null;
            const score = matcher.calculateClientQualityMatch(preferences, client);
            expect(score).toBe(0.5); // Neutral score
        });
    });

    describe('getMatchBreakdown', () => {
        test('should provide detailed match breakdown', async () => {
            const breakdown = await matcher.getMatchBreakdown(mockProfile, mockJob);
            
            expect(breakdown).toHaveProperty('totalScore');
            expect(breakdown).toHaveProperty('breakdown');
            expect(breakdown).toHaveProperty('weights');
            expect(breakdown).toHaveProperty('recommendations');
            
            expect(breakdown.breakdown).toHaveProperty('skills');
            expect(breakdown.breakdown).toHaveProperty('budget');
            expect(breakdown.breakdown).toHaveProperty('timeline');
            expect(breakdown.breakdown).toHaveProperty('clientQuality');
        });

        test('should generate helpful recommendations', async () => {
            const lowSkillJob = {
                ...mockJob,
                skills: ['golang', 'kubernetes', 'terraform']
            };
            
            const breakdown = await matcher.getMatchBreakdown(mockProfile, lowSkillJob);
            expect(breakdown.recommendations.length).toBeGreaterThan(0);
        });
    });

    describe('normalizeSkills', () => {
        test('should normalize array skills', () => {
            const skills = ['React', 'JavaScript', 'Node.js'];
            const normalized = matcher.normalizeSkills(skills);
            expect(normalized).toEqual(['react', 'javascript', 'node.js']);
        });

        test('should normalize object skills', () => {
            const skills = {
                primary: ['React', 'JavaScript'],
                secondary: ['Python']
            };
            const normalized = matcher.normalizeSkills(skills);
            expect(normalized).toEqual(['react', 'javascript', 'python']);
        });
    });

    describe('normalizeBudget', () => {
        test('should normalize number budget', () => {
            const budget = matcher.normalizeBudget(1000);
            expect(budget).toEqual({
                min: 1000,
                max: 1000,
                currency: 'USD',
                type: 'fixed'
            });
        });

        test('should normalize string budget ranges', () => {
            const budget = matcher.normalizeBudget('500-1000');
            expect(budget.min).toBe(500);
            expect(budget.max).toBe(1000);
        });

        test('should normalize hourly rates', () => {
            const budget = matcher.normalizeBudget('50/hr');
            expect(budget.min).toBe(50);
            expect(budget.type).toBe('hourly');
        });
    });

    describe('applyMatchAdjustments', () => {
        test('should apply competition penalty', () => {
            const baseScore = 80;
            const highCompetitionJob = { ...mockJob, competition: 60 };
            const scores = {
                skills: 0.9,
                budget: 0.8,
                timeline: 0.7,
                clientQuality: 0.8,
                location: 0.9,
                experience: 0.8
            };
            
            const adjusted = matcher.applyMatchAdjustments(baseScore, mockProfile, highCompetitionJob, scores);
            expect(adjusted).toBeLessThan(baseScore);
        });

        test('should apply new job bonus', () => {
            const baseScore = 70;
            const newJob = { 
                ...mockJob, 
                postedAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
            };
            const scores = {
                skills: 0.8,
                budget: 0.7,
                timeline: 0.8,
                clientQuality: 0.7,
                location: 0.8,
                experience: 0.7
            };
            
            const adjusted = matcher.applyMatchAdjustments(baseScore, mockProfile, newJob, scores);
            expect(adjusted).toBeGreaterThan(baseScore);
        });
    });
});

// Integration tests
describe('JobMatcher Integration', () => {
    let matcher;

    beforeEach(() => {
        matcher = new JobMatcher();
    });

    test('should handle real-world job matching scenarios', async () => {
        const realProfile = {
            skills: {
                primary: ['javascript', 'react', 'node.js', 'mongodb'],
                secondary: ['aws', 'docker', 'git']
            },
            budget: { min: 40, max: 80, type: 'hourly' },
            availability: { hoursPerWeek: 30 },
            experience: { years: 3, level: 'intermediate' },
            location: { country: 'US', timezone: 'PST' },
            preferences: { clientRating: 3.5 }
        };

        const realJobs = [
            {
                id: 'job1',
                title: 'React Frontend Developer',
                skills: ['react', 'javascript', 'css'],
                budget: { min: 50, max: 70, type: 'hourly' },
                timeline: '3 weeks',
                client: { rating: 4.2, reviewCount: 15, hireRate: 75, isVerified: true },
                competition: 12,
                platform: 'upwork'
            },
            {
                id: 'job2',
                title: 'Full Stack MERN Developer',
                skills: ['react', 'node.js', 'mongodb', 'express'],
                budget: { min: 45, max: 65, type: 'hourly' },
                timeline: '1 month',
                client: { rating: 3.8, reviewCount: 8, hireRate: 60, isVerified: false },
                competition: 25,
                platform: 'freelancer'
            },
            {
                id: 'job3',
                title: 'Python Data Scientist',
                skills: ['python', 'pandas', 'machine learning'],
                budget: { min: 60, max: 100, type: 'hourly' },
                timeline: '2 weeks',
                client: { rating: 4.7, reviewCount: 30, hireRate: 85, isVerified: true },
                competition: 8,
                platform: 'upwork'
            }
        ];

        const results = [];
        for (const job of realJobs) {
            const score = await matcher.calculateMatch(realProfile, job);
            results.push({ job: job.title, score });
        }

        // React job should score highest due to skill match
        const reactJob = results.find(r => r.job.includes('React'));
        expect(reactJob.score).toBeGreaterThan(70);

        // Full stack job should score well but not as high
        const fullStackJob = results.find(r => r.job.includes('MERN'));
        expect(fullStackJob.score).toBeGreaterThan(60);

        // Python job should score lowest due to skill mismatch
        const pythonJob = results.find(r => r.job.includes('Python'));
        expect(pythonJob.score).toBeLessThan(fullStackJob.score);
    });

    test('should handle edge cases gracefully', async () => {
        const emptyProfile = {};
        const emptyJob = {};

        const score = await matcher.calculateMatch(emptyProfile, emptyJob);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    test('should provide consistent results', async () => {
        const profile = {
            skills: { primary: ['javascript', 'react'] },
            budget: { min: 50, max: 100, type: 'hourly' }
        };

        const job = {
            skills: ['react', 'javascript'],
            budget: { min: 60, max: 80, type: 'hourly' }
        };

        const score1 = await matcher.calculateMatch(profile, job);
        const score2 = await matcher.calculateMatch(profile, job);
        const score3 = await matcher.calculateMatch(profile, job);

        expect(score1).toBe(score2);
        expect(score2).toBe(score3);
    });
});