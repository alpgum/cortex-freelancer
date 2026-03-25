/**
 * Tests for OpportunityScorer
 */

const OpportunityScorer = require('../scoring/OpportunityScorer');

describe('OpportunityScorer', () => {
    let scorer;
    let mockJob;
    let mockProfile;

    beforeEach(() => {
        scorer = new OpportunityScorer();
        
        mockJob = {
            id: 'test-job-1',
            title: 'React Developer Position',
            description: 'Build a modern React application with TypeScript and Redux',
            skills: ['react', 'javascript', 'typescript'],
            budget: {
                min: 2000,
                max: 3000,
                type: 'fixed'
            },
            competition: 10,
            isUrgent: false,
            timeline: '4 weeks',
            client: {
                rating: 4.5,
                reviewCount: 25,
                hireRate: 80,
                totalSpent: 15000,
                isVerified: true,
                paymentVerified: true
            },
            platform: 'upwork',
            postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        };

        mockProfile = {
            skills: {
                primary: ['react', 'javascript', 'typescript'],
                secondary: ['node.js', 'css']
            },
            experience: { years: 5 },
            targetSkills: ['typescript', 'redux'],
            portfolio: [
                { category: 'web development', title: 'E-commerce site' },
                { category: 'mobile', title: 'React Native app' }
            ]
        };
    });

    describe('scoreOpportunity', () => {
        test('should return a complete opportunity score', async () => {
            const result = await scorer.scoreOpportunity(mockJob, mockProfile);
            
            expect(result).toHaveProperty('totalScore');
            expect(result).toHaveProperty('breakdown');
            expect(result).toHaveProperty('insights');
            expect(result).toHaveProperty('recommendation');
            expect(result).toHaveProperty('estimatedROI');
            expect(result).toHaveProperty('riskLevel');
            expect(result).toHaveProperty('competitionLevel');
            
            expect(result.totalScore).toBeGreaterThanOrEqual(0);
            expect(result.totalScore).toBeLessThanOrEqual(100);
        });

        test('should handle jobs without profile', async () => {
            const result = await scorer.scoreOpportunity(mockJob);
            
            expect(result.totalScore).toBeGreaterThanOrEqual(0);
            expect(result.breakdown).toHaveProperty('winProbability');
            expect(result.breakdown).toHaveProperty('revenuePotential');
        });

        test('should handle incomplete job data', async () => {
            const incompleteJob = {
                id: 'incomplete',
                title: 'Simple task'
            };
            
            const result = await scorer.scoreOpportunity(incompleteJob, mockProfile);
            
            expect(result.totalScore).toBeGreaterThanOrEqual(0);
            expect(result.riskLevel).toBeDefined();
        });
    });

    describe('calculateWinProbability', () => {
        test('should return high probability for low competition', () => {
            const lowCompetitionJob = { ...mockJob, competition: 3 };
            const probability = scorer.calculateWinProbability(lowCompetitionJob, mockProfile);
            expect(probability).toBeGreaterThan(70);
        });

        test('should return low probability for high competition', () => {
            const highCompetitionJob = { ...mockJob, competition: 50 };
            const probability = scorer.calculateWinProbability(highCompetitionJob, mockProfile);
            expect(probability).toBeLessThan(40);
        });

        test('should consider client hire rate', () => {
            const highHireRateJob = {
                ...mockJob,
                client: { ...mockJob.client, hireRate: 95 }
            };
            const lowHireRateJob = {
                ...mockJob,
                client: { ...mockJob.client, hireRate: 10 }
            };
            
            const highProb = scorer.calculateWinProbability(highHireRateJob, mockProfile);
            const lowProb = scorer.calculateWinProbability(lowHireRateJob, mockProfile);
            
            expect(highProb).toBeGreaterThan(lowProb);
        });

        test('should apply platform-specific adjustments', () => {
            const upworkJob = { ...mockJob, platform: 'upwork' };
            const toptalJob = { ...mockJob, platform: 'toptal' };
            
            const upworkProb = scorer.calculateWinProbability(upworkJob, mockProfile);
            const toptalProb = scorer.calculateWinProbability(toptalJob, mockProfile);
            
            expect(upworkProb).toBeGreaterThan(toptalProb);
        });
    });

    describe('calculateRevenuePotential', () => {
        test('should return high score for high-value projects', () => {
            const highValueJob = {
                ...mockJob,
                budget: { min: 10000, max: 15000, type: 'fixed' }
            };
            
            const score = scorer.calculateRevenuePotential(highValueJob, mockProfile);
            expect(score).toBeGreaterThan(80);
        });

        test('should return low score for low-value projects', () => {
            const lowValueJob = {
                ...mockJob,
                budget: { min: 100, max: 200, type: 'fixed' }
            };
            
            const score = scorer.calculateRevenuePotential(lowValueJob, mockProfile);
            expect(score).toBeLessThan(50);
        });

        test('should handle hourly rate projects', () => {
            const hourlyJob = {
                ...mockJob,
                budget: { min: 75, max: 100, type: 'hourly' }
            };
            
            const score = scorer.calculateRevenuePotential(hourlyJob, mockProfile);
            expect(score).toBeGreaterThan(0);
        });

        test('should apply premium skill bonuses', () => {
            const premiumSkillJob = {
                ...mockJob,
                skills: ['machine learning', 'blockchain', 'ai'],
                budget: { min: 2000, max: 3000, type: 'fixed' }
            };
            
            const score = scorer.calculateRevenuePotential(premiumSkillJob, mockProfile);
            // Should get bonus for premium skills even if profile doesn't match
            expect(score).toBeGreaterThan(0);
        });

        test('should apply long-term project bonus', () => {
            const longTermJob = {
                ...mockJob,
                isLongTerm: true,
                description: 'Ongoing maintenance and feature development'
            };
            
            const regularJob = { ...mockJob };
            
            const longTermScore = scorer.calculateRevenuePotential(longTermJob, mockProfile);
            const regularScore = scorer.calculateRevenuePotential(regularJob, mockProfile);
            
            expect(longTermScore).toBeGreaterThan(regularScore);
        });
    });

    describe('calculateTimeInvestment', () => {
        test('should return high score for simple, well-paid projects', () => {
            const simpleJob = {
                ...mockJob,
                description: 'Simple basic website with detailed requirements and wireframes',
                budget: { min: 100, max: 100, type: 'hourly' }
            };
            
            const score = scorer.calculateTimeInvestment(simpleJob);
            expect(score).toBeGreaterThan(70);
        });

        test('should return low score for complex projects', () => {
            const complexJob = {
                ...mockJob,
                description: 'Complex enterprise application with advanced features and tight timeline',
                budget: { min: 25, max: 25, type: 'hourly' },
                timeline: '1 week'
            };
            
            const score = scorer.calculateTimeInvestment(complexJob);
            expect(score).toBeLessThan(50);
        });

        test('should consider timeline pressure', () => {
            const tightTimelineJob = {
                ...mockJob,
                timeline: '3 days',
                description: 'Standard React application'
            };
            
            const comfortableTimelineJob = {
                ...mockJob,
                timeline: '2 months',
                description: 'Standard React application'
            };
            
            const tightScore = scorer.calculateTimeInvestment(tightTimelineJob);
            const comfortableScore = scorer.calculateTimeInvestment(comfortableTimelineJob);
            
            expect(comfortableScore).toBeGreaterThan(tightScore);
        });
    });

    describe('calculateRiskFactors', () => {
        test('should return high score (low risk) for verified clients', () => {
            const lowRiskJob = {
                ...mockJob,
                client: {
                    rating: 4.8,
                    reviewCount: 50,
                    hireRate: 90,
                    isVerified: true,
                    paymentVerified: true
                },
                budget: { min: 5000, max: 8000, type: 'fixed' }
            };
            
            const result = scorer.calculateRiskFactors(lowRiskJob);
            expect(result.score).toBeGreaterThan(80);
            expect(result.risks.length).toBeLessThan(3);
        });

        test('should return low score (high risk) for problematic jobs', () => {
            const highRiskJob = {
                ...mockJob,
                client: {
                    rating: 2.0,
                    reviewCount: 1,
                    hireRate: 5,
                    isVerified: false,
                    paymentVerified: false
                },
                budget: { min: 50, max: 100, type: 'fixed' },
                description: 'Need this ASAP, very urgent, budget project',
                isUrgent: true
            };
            
            const result = scorer.calculateRiskFactors(highRiskJob);
            expect(result.score).toBeLessThan(40);
            expect(result.risks.length).toBeGreaterThan(3);
        });

        test('should identify specific risk factors', () => {
            const riskyJob = {
                ...mockJob,
                client: null, // No client info
                description: '', // No description
                budget: { min: 25, max: 50, type: 'fixed' }, // Very low budget
                isUrgent: true
            };
            
            const result = scorer.calculateRiskFactors(riskyJob);
            
            expect(result.risks).toContain('No client information available');
            expect(result.risks).toContain('No project description');
            expect(result.risks).toContain('Very low budget');
            expect(result.risks).toContain('Rush job indicators');
        });
    });

    describe('calculateStrategicValue', () => {
        test('should return high score for skill development opportunities', () => {
            const skillDevJob = {
                ...mockJob,
                skills: ['typescript', 'redux', 'graphql'], // Includes target skills
                category: 'web development'
            };
            
            const score = scorer.calculateStrategicValue(skillDevJob, mockProfile);
            expect(score).toBeGreaterThan(70);
        });

        test('should return bonus for high-spending clients', () => {
            const enterpriseJob = {
                ...mockJob,
                client: {
                    ...mockJob.client,
                    totalSpent: 100000 // High-spending client
                }
            };
            
            const regularJob = { ...mockJob };
            
            const enterpriseScore = scorer.calculateStrategicValue(enterpriseJob, mockProfile);
            const regularScore = scorer.calculateStrategicValue(regularJob, mockProfile);
            
            expect(enterpriseScore).toBeGreaterThan(regularScore);
        });

        test('should identify portfolio gaps', () => {
            const portfolioGapJob = {
                ...mockJob,
                category: 'fintech', // Not in current portfolio
                description: 'Fintech startup application'
            };
            
            const existingCategoryJob = {
                ...mockJob,
                category: 'web development' // Already in portfolio
            };
            
            const gapScore = scorer.calculateStrategicValue(portfolioGapJob, mockProfile);
            const existingScore = scorer.calculateStrategicValue(existingCategoryJob, mockProfile);
            
            expect(gapScore).toBeGreaterThan(existingScore);
        });

        test('should identify innovative projects', () => {
            const innovativeJob = {
                ...mockJob,
                description: 'Cutting edge AI-powered blockchain application using machine learning'
            };
            
            const regularJob = {
                ...mockJob,
                description: 'Standard business website'
            };
            
            const innovativeScore = scorer.calculateStrategicValue(innovativeJob, mockProfile);
            const regularScore = scorer.calculateStrategicValue(regularJob, mockProfile);
            
            expect(innovativeScore).toBeGreaterThan(regularScore);
        });
    });

    describe('calculateCompetitionScore', () => {
        test('should return high score for low competition', () => {
            const score = scorer.calculateCompetitionScore({ competition: 2 });
            expect(score).toBeGreaterThan(80);
        });

        test('should return low score for high competition', () => {
            const score = scorer.calculateCompetitionScore({ competition: 60 });
            expect(score).toBeLessThan(30);
        });

        test('should return max score for no competition', () => {
            const score = scorer.calculateCompetitionScore({ competition: 0 });
            expect(score).toBe(100);
        });
    });

    describe('generateInsights', () => {
        test('should generate relevant insights', () => {
            const scores = {
                winProbability: 85,
                revenuePotential: 90,
                timeInvestment: 45,
                riskFactors: { score: 30, risks: ['High risk factors'] },
                strategicValue: 80,
                competition: 90
            };
            
            const insights = scorer.generateInsights(scores, mockJob, mockProfile);
            
            expect(insights.length).toBeGreaterThan(0);
            expect(insights.some(insight => insight.includes('High win probability'))).toBe(true);
            expect(insights.some(insight => insight.includes('High revenue potential'))).toBe(true);
            expect(insights.some(insight => insight.includes('High risk factors'))).toBe(true);
        });

        test('should provide different insights for different score ranges', () => {
            const highScores = {
                winProbability: 90,
                revenuePotential: 95,
                timeInvestment: 85,
                riskFactors: { score: 90, risks: [] },
                strategicValue: 85,
                competition: 95
            };
            
            const lowScores = {
                winProbability: 25,
                revenuePotential: 30,
                timeInvestment: 35,
                riskFactors: { score: 25, risks: ['Multiple risks'] },
                strategicValue: 20,
                competition: 15
            };
            
            const highInsights = scorer.generateInsights(highScores, mockJob, mockProfile);
            const lowInsights = scorer.generateInsights(lowScores, mockJob, mockProfile);
            
            expect(highInsights).not.toEqual(lowInsights);
        });
    });

    describe('generateRecommendation', () => {
        test('should recommend high-scoring opportunities', () => {
            const recommendation = scorer.generateRecommendation(85, {});
            expect(recommendation).toContain('HIGHLY RECOMMENDED');
        });

        test('should not recommend low-scoring opportunities', () => {
            const recommendation = scorer.generateRecommendation(35, {});
            expect(recommendation).toContain('NOT RECOMMENDED');
        });

        test('should provide conditional recommendations for medium scores', () => {
            const recommendation = scorer.generateRecommendation(65, {});
            expect(recommendation).toContain('CONSIDER');
        });
    });

    describe('scoreOpportunities', () => {
        test('should batch score multiple opportunities', async () => {
            const jobs = [
                { ...mockJob, id: 'job1', title: 'Job 1' },
                { ...mockJob, id: 'job2', title: 'Job 2', competition: 50 },
                { ...mockJob, id: 'job3', title: 'Job 3', budget: { min: 100, max: 200, type: 'fixed' } }
            ];
            
            const results = await scorer.scoreOpportunities(jobs, mockProfile);
            
            expect(results).toHaveLength(3);
            expect(results[0].opportunityScore).toBeDefined();
            expect(results[1].opportunityScore).toBeDefined();
            expect(results[2].opportunityScore).toBeDefined();
            
            // Should be sorted by total score (highest first)
            expect(results[0].opportunityScore.totalScore)
                .toBeGreaterThanOrEqual(results[1].opportunityScore.totalScore);
        });

        test('should handle errors gracefully in batch scoring', async () => {
            const jobs = [
                { ...mockJob, id: 'good-job' },
                { id: 'bad-job' }, // Incomplete job that might cause errors
                { ...mockJob, id: 'another-good-job' }
            ];
            
            const results = await scorer.scoreOpportunities(jobs, mockProfile);
            
            expect(results).toHaveLength(3);
            // All jobs should have some score, even if it's the default
            results.forEach(result => {
                expect(result.opportunityScore).toBeDefined();
                expect(result.opportunityScore.totalScore).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('helper methods', () => {
        test('estimateProjectHours should provide reasonable estimates', () => {
            const simpleJob = {
                description: 'Simple landing page',
                category: 'website'
            };
            
            const complexJob = {
                description: 'Complex enterprise application with multiple features and modules',
                category: 'mobile app'
            };
            
            const simpleHours = scorer.estimateProjectHours(simpleJob);
            const complexHours = scorer.estimateProjectHours(complexJob);
            
            expect(simpleHours).toBeGreaterThan(0);
            expect(complexHours).toBeGreaterThan(simpleHours);
            expect(simpleHours).toBeLessThanOrEqual(500);
            expect(complexHours).toBeLessThanOrEqual(500);
        });

        test('calculateROI should provide meaningful ROI estimates', () => {
            const highPotentialScores = {
                revenuePotential: 90,
                winProbability: 80,
                riskFactors: { score: 85 }
            };
            
            const lowPotentialScores = {
                revenuePotential: 30,
                winProbability: 25,
                riskFactors: { score: 40 }
            };
            
            const highROI = scorer.calculateROI(highPotentialScores);
            const lowROI = scorer.calculateROI(lowPotentialScores);
            
            expect(highROI).toBeGreaterThan(lowROI);
            expect(highROI).toBeGreaterThan(1.0);
        });

        test('getRiskLevel should categorize risk appropriately', () => {
            expect(scorer.getRiskLevel({ score: 90 })).toBe('LOW');
            expect(scorer.getRiskLevel({ score: 70 })).toBe('MEDIUM');
            expect(scorer.getRiskLevel({ score: 50 })).toBe('HIGH');
            expect(scorer.getRiskLevel({ score: 20 })).toBe('VERY HIGH');
        });

        test('getCompetitionLevel should categorize competition appropriately', () => {
            expect(scorer.getCompetitionLevel(2)).toBe('LOW');
            expect(scorer.getCompetitionLevel(10)).toBe('MEDIUM');
            expect(scorer.getCompetitionLevel(25)).toBe('HIGH');
            expect(scorer.getCompetitionLevel(50)).toBe('VERY HIGH');
        });
    });
});