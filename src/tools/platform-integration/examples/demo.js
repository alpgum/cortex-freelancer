/**
 * Platform Integration Demo
 * Demonstrates key features of the platform integration module
 */

const { PlatformIntegration } = require('../index');

class PlatformDemo {
    constructor() {
        this.platformIntegration = new PlatformIntegration({
            // Custom configuration for demo
            skillsWeight: 0.4,
            budgetWeight: 0.3,
            timelineWeight: 0.15,
            clientQualityWeight: 0.15
        });
        
        this.demoProfile = {
            skills: {
                primary: ['javascript', 'react', 'node.js', 'typescript'],
                secondary: ['python', 'aws', 'docker', 'mongodb']
            },
            budget: {
                min: 50,
                max: 120,
                type: 'hourly'
            },
            availability: {
                hoursPerWeek: 35,
                availableFrom: new Date()
            },
            experience: {
                years: 5,
                level: 'senior'
            },
            location: {
                country: 'US',
                timezone: 'EST'
            },
            preferences: {
                clientRating: 4.0,
                minBudget: 1000
            },
            targetSkills: ['machine learning', 'blockchain', 'graphql'],
            portfolio: [
                { category: 'web development', title: 'E-commerce Platform' },
                { category: 'mobile', title: 'React Native App' }
            ]
        };
    }

    async runDemo() {
        console.log('🚀 Platform Integration Demo Starting...\n');

        try {
            await this.demonstrateJobSearch();
            await this.demonstrateJobMatching();
            await this.demonstrateOpportunityScoring();
            await this.demonstrateSmartAlerts();
            await this.demonstrateCLIUsage();
            
            console.log('✅ Demo completed successfully!');
            
        } catch (error) {
            console.error('❌ Demo failed:', error.message);
        }
    }

    async demonstrateJobSearch() {
        console.log('📋 1. Job Search Demonstration');
        console.log('================================');

        const searchCriteria = {
            skills: ['react', 'javascript'],
            budget: { min: 1000, max: 5000 },
            platforms: ['upwork', 'freelancer'],
            limit: 5
        };

        console.log('Search Criteria:');
        console.log(`  Skills: ${searchCriteria.skills.join(', ')}`);
        console.log(`  Budget: $${searchCriteria.budget.min}-$${searchCriteria.budget.max}`);
        console.log(`  Platforms: ${searchCriteria.platforms.join(', ')}`);
        console.log();

        try {
            // Note: In demo mode, this will use mock data since we don't want to make real API calls
            const jobs = await this.getMockJobs();
            
            console.log(`Found ${jobs.length} opportunities:\n`);
            
            jobs.forEach((job, index) => {
                console.log(`${index + 1}. ${job.title}`);
                console.log(`   💰 Budget: ${this.formatBudget(job.budget)}`);
                console.log(`   🏢 Platform: ${job.platform}`);
                console.log(`   🥊 Competition: ${job.competition} bidders`);
                console.log(`   🛠️  Skills: ${job.skills.join(', ')}`);
                console.log();
            });

        } catch (error) {
            console.log('⚠️  Using mock data for demo purposes');
            console.log('In production, this would search real platforms\n');
        }
    }

    async demonstrateJobMatching() {
        console.log('🎯 2. Job Matching Demonstration');
        console.log('=================================');

        const jobs = await this.getMockJobs();
        
        console.log('Profile Summary:');
        console.log(`  Primary Skills: ${this.demoProfile.skills.primary.join(', ')}`);
        console.log(`  Experience: ${this.demoProfile.experience.years} years (${this.demoProfile.experience.level})`);
        console.log(`  Rate Range: $${this.demoProfile.budget.min}-$${this.demoProfile.budget.max}/hour`);
        console.log();

        const matchedJobs = await this.platformIntegration.matchJobs(this.demoProfile, jobs);

        console.log('Match Results (sorted by combined score):\n');
        
        matchedJobs.slice(0, 3).forEach((job, index) => {
            console.log(`${index + 1}. ${job.title}`);
            console.log(`   🎯 Match Score: ${job.matchScore}/100`);
            console.log(`   🏆 Opportunity Score: ${job.opportunityScore}/100`);
            console.log(`   📊 Combined Score: ${job.combinedScore}/100`);
            console.log(`   💡 Recommendation: ${job.combinedScore > 80 ? 'HIGHLY RECOMMENDED' : job.combinedScore > 60 ? 'RECOMMENDED' : 'CONSIDER'}`);
            console.log();
        });
    }

    async demonstrateOpportunityScoring() {
        console.log('🏆 3. Opportunity Scoring Demonstration');
        console.log('=======================================');

        const job = (await this.getMockJobs())[0]; // Use first job for detailed analysis
        
        const scoring = await this.platformIntegration.opportunityScorer.scoreOpportunity(job, this.demoProfile);

        console.log(`Analyzing: ${job.title}\n`);
        
        console.log('📊 Score Breakdown:');
        console.log(`  Win Probability: ${scoring.breakdown.winProbability}/100`);
        console.log(`  Revenue Potential: ${scoring.breakdown.revenuePotential}/100`);
        console.log(`  Time Investment: ${scoring.breakdown.timeInvestment}/100`);
        console.log(`  Risk Factors: ${scoring.breakdown.riskFactors.score}/100`);
        console.log(`  Strategic Value: ${scoring.breakdown.strategicValue}/100`);
        console.log(`  Competition: ${scoring.breakdown.competition}/100`);
        console.log();
        
        console.log(`🎯 Overall Score: ${scoring.totalScore}/100`);
        console.log(`💰 Estimated ROI: ${scoring.estimatedROI}x`);
        console.log(`⚠️  Risk Level: ${scoring.riskLevel}`);
        console.log(`🥊 Competition: ${scoring.competitionLevel}`);
        console.log(`📋 Recommendation: ${scoring.recommendation}`);
        console.log();

        if (scoring.insights.length > 0) {
            console.log('💡 Key Insights:');
            scoring.insights.forEach(insight => {
                console.log(`  • ${insight}`);
            });
            console.log();
        }
    }

    async demonstrateSmartAlerts() {
        console.log('🚨 4. Smart Alerts Demonstration');
        console.log('=================================');

        const alertCriteria = {
            skills: ['machine learning', 'ai'],
            budgetMin: 3000,
            platforms: ['upwork', 'toptal'],
            matchThreshold: 85,
            alertTypes: ['high_match', 'low_competition', 'premium_client']
        };

        console.log('Setting up monitoring with criteria:');
        console.log(`  Skills: ${alertCriteria.skills.join(', ')}`);
        console.log(`  Min Budget: $${alertCriteria.budgetMin}`);
        console.log(`  Match Threshold: ${alertCriteria.matchThreshold}%`);
        console.log(`  Alert Types: ${alertCriteria.alertTypes.join(', ')}`);
        console.log();

        const alertCallback = (alert) => {
            console.log(`📢 ALERT RECEIVED:`);
            console.log(`  Job: ${alert.job.title}`);
            console.log(`  Priority: ${alert.priority}`);
            console.log(`  Score: ${alert.job.opportunityScore?.totalScore || 'N/A'}/100`);
            console.log(`  Triggers: ${alert.alertTypes.join(', ')}`);
            console.log();
        };

        const monitorId = await this.platformIntegration.setupMonitoring(alertCriteria, alertCallback);
        console.log(`✅ Monitor created with ID: ${monitorId}`);
        
        // Simulate alert
        console.log('📡 Simulating alert for demo...');
        setTimeout(() => {
            const mockAlert = {
                type: 'job_alert',
                job: {
                    title: 'Senior AI Engineer - Machine Learning Platform',
                    platform: 'upwork',
                    opportunityScore: { totalScore: 92 }
                },
                priority: 'CRITICAL',
                alertTypes: ['high_match', 'low_competition'],
                timestamp: new Date(),
                monitorId: monitorId
            };
            alertCallback(mockAlert);
        }, 1000);

        // Show monitoring stats
        setTimeout(() => {
            const stats = this.platformIntegration.smartAlerts.getStats();
            console.log('📊 Monitoring Statistics:');
            console.log(`  Active Monitors: ${stats.activeMonitors}`);
            console.log(`  Total Alerts: ${stats.totalAlerts}`);
            console.log(`  Rate Limit: ${stats.rateLimitStatus.hourly}`);
            console.log(`  Status: ${stats.isRunning ? 'Running' : 'Stopped'}`);
            console.log();

            // Cleanup
            this.platformIntegration.stopMonitoring(monitorId);
            console.log(`🛑 Monitor ${monitorId} stopped`);
            console.log();
        }, 2000);
    }

    async demonstrateCLIUsage() {
        console.log('💻 5. CLI Interface Demonstration');
        console.log('=================================');

        const cli = this.platformIntegration.getCLI();

        console.log('Available CLI commands:\n');

        // Demonstrate help command
        const helpOutput = await cli.execute(['help']);
        console.log(helpOutput);
        console.log();

        // Demonstrate search command
        console.log('Example: Search for React jobs with min $5000 budget');
        console.log('Command: platform search --skills "react,typescript" --min-budget 5000');
        console.log();

        // In a real scenario, you would run:
        // const searchOutput = await cli.execute(['search', '--skills', 'react,typescript', '--min-budget', '5000']);
        // console.log(searchOutput);

        console.log('Example: Analyze a specific job');
        console.log('Command: platform analyze --url "https://www.upwork.com/jobs/react-developer_~123456"');
        console.log();

        console.log('Example: Set up monitoring');
        console.log('Command: platform monitor --keywords "machine learning" --min-budget 3000 --threshold 80');
        console.log();

        console.log('Example: Check platform status');
        console.log('Command: platform status');
        
        const statusOutput = await cli.execute(['status']);
        console.log(statusOutput);
        console.log();
    }

    // Helper methods for demo

    async getMockJobs() {
        // Mock job data for demonstration
        return [
            {
                id: 'demo-job-1',
                title: 'Senior React Developer - E-commerce Platform',
                description: 'Build a modern e-commerce platform using React, TypeScript, and Node.js with detailed requirements provided.',
                skills: ['react', 'typescript', 'node.js', 'mongodb'],
                budget: { min: 4000, max: 6000, type: 'fixed' },
                timeline: '6 weeks',
                client: {
                    name: 'TechCorp Solutions',
                    rating: 4.8,
                    reviewCount: 45,
                    hireRate: 85,
                    totalSpent: 250000,
                    isVerified: true,
                    paymentVerified: true,
                    location: 'San Francisco, CA'
                },
                competition: 8,
                isUrgent: false,
                isFixed: true,
                location: 'Remote',
                category: 'Web Development',
                platform: 'upwork',
                postedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                url: 'https://www.upwork.com/jobs/react-developer-ecommerce_~demo1'
            },
            {
                id: 'demo-job-2',
                title: 'Python Data Scientist - Machine Learning Model',
                description: 'Develop machine learning models for predictive analytics. Experience with TensorFlow and scikit-learn required.',
                skills: ['python', 'machine learning', 'tensorflow', 'scikit-learn'],
                budget: { min: 75, max: 100, type: 'hourly' },
                timeline: '3 months',
                client: {
                    name: 'DataInsights Inc',
                    rating: 4.2,
                    reviewCount: 12,
                    hireRate: 70,
                    totalSpent: 85000,
                    isVerified: true,
                    paymentVerified: true,
                    location: 'New York, NY'
                },
                competition: 25,
                isUrgent: false,
                isFixed: false,
                location: 'Remote',
                category: 'Data Science',
                platform: 'freelancer',
                postedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
                url: 'https://www.freelancer.com/projects/python-ml_~demo2'
            },
            {
                id: 'demo-job-3',
                title: 'Full Stack JavaScript Developer - Startup MVP',
                description: 'Build MVP for innovative startup using MERN stack. Fast-paced environment with growth potential.',
                skills: ['javascript', 'react', 'node.js', 'mongodb', 'express'],
                budget: { min: 2500, max: 4000, type: 'fixed' },
                timeline: '4 weeks',
                client: {
                    name: 'InnovateNow Startup',
                    rating: 3.9,
                    reviewCount: 3,
                    hireRate: 60,
                    totalSpent: 15000,
                    isVerified: false,
                    paymentVerified: true,
                    location: 'Austin, TX'
                },
                competition: 35,
                isUrgent: true,
                isFixed: true,
                location: 'Remote',
                category: 'Web Development',
                platform: 'upwork',
                postedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                url: 'https://www.upwork.com/jobs/fullstack-startup-mvp_~demo3'
            }
        ];
    }

    formatBudget(budget) {
        if (!budget) return 'TBD';
        
        if (budget.type === 'hourly') {
            return `$${budget.min}-$${budget.max}/hr`;
        } else {
            return `$${budget.min}-$${budget.max}`;
        }
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    const demo = new PlatformDemo();
    demo.runDemo().catch(console.error);
}

module.exports = PlatformDemo;