/**
 * Data Migration Service for Cortex Freelancer
 * Handles migration from mock data to Firestore
 */

const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs').promises;

class DataMigrationService {
    constructor() {
        this.db = getFirestore();
        this.mockDataPath = path.join(__dirname, '../../data/mock');
    }

    /**
     * Run complete data migration
     */
    async runMigration() {
        try {
            console.log('🚀 Starting data migration...');
            
            const results = {
                jobs: await this.migrateJobs(),
                templates: await this.migrateEmailTemplates(),
                skillsData: await this.migrateSkillsData(),
                analytics: await this.initializeAnalytics()
            };
            
            console.log('✅ Data migration completed successfully');
            return {
                success: true,
                results: results
            };
        } catch (error) {
            console.error('❌ Data migration failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Migrate jobs data from mock to Firestore
     */
    async migrateJobs() {
        try {
            const jobsFile = path.join(this.mockDataPath, 'jobs-database.json');
            const jobsData = JSON.parse(await fs.readFile(jobsFile, 'utf8'));
            
            const batch = this.db.batch();
            let count = 0;
            
            for (const job of jobsData.jobs) {
                const jobRef = this.db.collection('jobs').doc(job.id);
                
                const jobDoc = {
                    ...job,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    isActive: true,
                    source: 'migration',
                    // Add search-friendly fields
                    searchKeywords: [
                        ...job.title.toLowerCase().split(' '),
                        ...job.skills.map(skill => skill.toLowerCase()),
                        job.platform,
                        job.clientType,
                        job.location.toLowerCase()
                    ].filter(Boolean),
                    // Add computed fields
                    budgetRange: this.categorizeBudget(job.budget, job.budgetType),
                    experienceLevel: this.determineExperienceLevel(job),
                    urgency: this.determineUrgency(job),
                    quality_score: this.calculateQualityScore(job)
                };
                
                batch.set(jobRef, jobDoc);
                count++;
            }
            
            await batch.commit();
            
            // Create composite indexes
            await this.createJobIndexes();
            
            console.log(`✅ Migrated ${count} jobs to Firestore`);
            return { count, status: 'success' };
        } catch (error) {
            console.error('❌ Jobs migration failed:', error);
            return { count: 0, status: 'failed', error: error.message };
        }
    }

    /**
     * Migrate email templates to Firestore
     */
    async migrateEmailTemplates() {
        try {
            const templates = [
                {
                    id: 'proposal_followup',
                    name: 'Proposal Follow-up',
                    category: 'outreach',
                    subject: 'Following up on {{jobTitle}} proposal',
                    body: `Hi {{clientName}},\n\nI hope this email finds you well. I wanted to follow up on the proposal I submitted for your {{jobTitle}} project.\n\nI'm very excited about the opportunity because:\n- {{reason1}}\n- {{reason2}}\n- {{reason3}}\n\nWould you be available for a brief call this week?\n\nBest regards,\n{{freelancerName}}`,
                    variables: ['clientName', 'jobTitle', 'reason1', 'reason2', 'reason3', 'freelancerName'],
                    usage_count: 0,
                    success_rate: 0,
                    created_at: new Date(),
                    is_active: true
                },
                {
                    id: 'project_kickoff',
                    name: 'Project Kickoff',
                    category: 'project_management',
                    subject: 'Project kickoff - {{projectName}}',
                    body: `Hi {{clientName}},\n\nThank you for choosing me for your {{projectName}} project!\n\nProject Overview:\n- Start Date: {{startDate}}\n- Estimated Completion: {{estimatedCompletion}}\n- Total Investment: {{totalBudget}}\n\nNext Steps:\n1. {{nextStep1}}\n2. {{nextStep2}}\n3. {{nextStep3}}\n\nI'll provide regular updates on progress.\n\nBest regards,\n{{freelancerName}}`,
                    variables: ['clientName', 'projectName', 'startDate', 'estimatedCompletion', 'totalBudget', 'nextStep1', 'nextStep2', 'nextStep3', 'freelancerName'],
                    usage_count: 0,
                    success_rate: 0,
                    created_at: new Date(),
                    is_active: true
                },
                {
                    id: 'milestone_update',
                    name: 'Milestone Completion',
                    category: 'project_management',
                    subject: '{{projectName}} - Milestone {{milestoneNumber}} Completed',
                    body: `Hi {{clientName}},\n\nGreat news! I've completed Milestone {{milestoneNumber}} for your {{projectName}} project.\n\nDelivered:\n- {{deliverable1}}\n- {{deliverable2}}\n- {{deliverable3}}\n\nNext milestone: {{nextMilestone}}\nExpected completion: {{nextMilestoneDate}}\n\nPlease review and let me know your feedback.\n\nBest regards,\n{{freelancerName}}`,
                    variables: ['clientName', 'projectName', 'milestoneNumber', 'deliverable1', 'deliverable2', 'deliverable3', 'nextMilestone', 'nextMilestoneDate', 'freelancerName'],
                    usage_count: 0,
                    success_rate: 0,
                    created_at: new Date(),
                    is_active: true
                }
            ];
            
            const batch = this.db.batch();
            
            for (const template of templates) {
                const templateRef = this.db.collection('email_templates').doc(template.id);
                batch.set(templateRef, template);
            }
            
            await batch.commit();
            
            console.log(`✅ Migrated ${templates.length} email templates to Firestore`);
            return { count: templates.length, status: 'success' };
        } catch (error) {
            console.error('❌ Email templates migration failed:', error);
            return { count: 0, status: 'failed', error: error.message };
        }
    }

    /**
     * Migrate skills and market data
     */
    async migrateSkillsData() {
        try {
            const skillsData = {
                popular_skills: [
                    { name: 'JavaScript', demand_score: 95, avg_rate: 45, growth_trend: 'up' },
                    { name: 'React', demand_score: 92, avg_rate: 48, growth_trend: 'up' },
                    { name: 'Node.js', demand_score: 88, avg_rate: 47, growth_trend: 'stable' },
                    { name: 'Python', demand_score: 90, avg_rate: 52, growth_trend: 'up' },
                    { name: 'WordPress', demand_score: 85, avg_rate: 35, growth_trend: 'stable' },
                    { name: 'PHP', demand_score: 78, avg_rate: 38, growth_trend: 'down' },
                    { name: 'TypeScript', demand_score: 89, avg_rate: 55, growth_trend: 'up' },
                    { name: 'Vue.js', demand_score: 82, avg_rate: 44, growth_trend: 'up' },
                    { name: 'Flutter', demand_score: 86, avg_rate: 49, growth_trend: 'up' },
                    { name: 'React Native', demand_score: 84, avg_rate: 46, growth_trend: 'stable' }
                ],
                market_rates: {
                    regions: {
                        'United States': { min: 35, max: 150, avg: 65 },
                        'Canada': { min: 30, max: 120, avg: 55 },
                        'United Kingdom': { min: 25, max: 100, avg: 50 },
                        'Germany': { min: 30, max: 110, avg: 60 },
                        'Australia': { min: 28, max: 95, avg: 52 }
                    },
                    experience_levels: {
                        'entry': { multiplier: 0.6, description: '0-2 years' },
                        'intermediate': { multiplier: 1.0, description: '2-5 years' },
                        'senior': { multiplier: 1.5, description: '5+ years' },
                        'expert': { multiplier: 2.0, description: '10+ years' }
                    }
                }
            };
            
            // Store skills data
            const skillsRef = this.db.collection('market_data').doc('skills');
            await skillsRef.set({
                ...skillsData,
                updated_at: new Date(),
                version: '1.0'
            });
            
            console.log('✅ Migrated skills and market data to Firestore');
            return { count: skillsData.popular_skills.length, status: 'success' };
        } catch (error) {
            console.error('❌ Skills data migration failed:', error);
            return { count: 0, status: 'failed', error: error.message };
        }
    }

    /**
     * Initialize analytics collections
     */
    async initializeAnalytics() {
        try {
            const analyticsData = {
                global_stats: {
                    total_users: 0,
                    total_applications: 0,
                    total_proposals: 0,
                    avg_success_rate: 0,
                    updated_at: new Date()
                },
                platform_stats: {
                    upwork: { jobs: 0, applications: 0, success_rate: 0 },
                    fiverr: { jobs: 0, applications: 0, success_rate: 0 },
                    freelancer: { jobs: 0, applications: 0, success_rate: 0 },
                    guru: { jobs: 0, applications: 0, success_rate: 0 }
                }
            };
            
            const analyticsRef = this.db.collection('analytics').doc('global');
            await analyticsRef.set(analyticsData);
            
            console.log('✅ Initialized analytics collections');
            return { status: 'success' };
        } catch (error) {
            console.error('❌ Analytics initialization failed:', error);
            return { status: 'failed', error: error.message };
        }
    }

    /**
     * Helper: Categorize budget
     */
    categorizeBudget(budget, budgetType) {
        if (budgetType === 'hourly') {
            if (budget < 25) return 'low';
            if (budget < 50) return 'medium';
            if (budget < 100) return 'high';
            return 'premium';
        } else {
            if (budget < 500) return 'low';
            if (budget < 2000) return 'medium';
            if (budget < 5000) return 'high';
            return 'premium';
        }
    }

    /**
     * Helper: Determine experience level
     */
    determineExperienceLevel(job) {
        const title = job.title.toLowerCase();
        const description = job.description.toLowerCase();
        
        if (title.includes('senior') || title.includes('lead') || description.includes('5+ years')) {
            return 'senior';
        }
        if (title.includes('junior') || description.includes('entry level')) {
            return 'entry';
        }
        return 'intermediate';
    }

    /**
     * Helper: Determine urgency
     */
    determineUrgency(job) {
        const description = job.description.toLowerCase();
        const duration = job.duration.toLowerCase();
        
        if (description.includes('urgent') || description.includes('asap') || duration.includes('1 week')) {
            return 'high';
        }
        if (duration.includes('1-2 weeks') || duration.includes('less than 1 month')) {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Helper: Calculate quality score
     */
    calculateQualityScore(job) {
        let score = 50; // Base score
        
        // Client quality factors
        if (job.clientRating > 4.5) score += 20;
        else if (job.clientRating > 4.0) score += 10;
        
        // Budget factors
        if (job.budgetType === 'hourly' && job.budget > 40) score += 15;
        if (job.budgetType === 'fixed' && job.budget > 1000) score += 15;
        
        // Description quality
        if (job.description.length > 200) score += 10;
        if (job.skills && job.skills.length > 3) score += 5;
        
        return Math.min(100, Math.max(0, score));
    }

    /**
     * Create necessary Firestore indexes
     */
    async createJobIndexes() {
        // This would typically be done via Firebase Console or CLI
        // Here we just log the required indexes
        const requiredIndexes = [
            {
                collection: 'jobs',
                fields: [
                    { field: 'platform', order: 'ASCENDING' },
                    { field: 'posted', order: 'DESCENDING' }
                ]
            },
            {
                collection: 'jobs',
                fields: [
                    { field: 'budgetRange', order: 'ASCENDING' },
                    { field: 'quality_score', order: 'DESCENDING' }
                ]
            },
            {
                collection: 'jobs',
                fields: [
                    { field: 'searchKeywords', order: 'ARRAY_CONTAINS' },
                    { field: 'posted', order: 'DESCENDING' }
                ]
            }
        ];
        
        console.log('📝 Required Firestore indexes:', JSON.stringify(requiredIndexes, null, 2));
        return requiredIndexes;
    }

    /**
     * Clean up old mock data (optional)
     */
    async cleanupMockData() {
        try {
            // This would remove mock data files after successful migration
            console.log('🧹 Mock data cleanup would run here in production');
            return { status: 'skipped' };
        } catch (error) {
            return { status: 'failed', error: error.message };
        }
    }

    /**
     * Verify migration integrity
     */
    async verifyMigration() {
        try {
            const collections = ['jobs', 'email_templates', 'market_data', 'analytics'];
            const results = {};
            
            for (const collection of collections) {
                const snapshot = await this.db.collection(collection).get();
                results[collection] = {
                    count: snapshot.size,
                    status: snapshot.size > 0 ? 'success' : 'warning'
                };
            }
            
            console.log('🔍 Migration verification results:', results);
            return {
                success: true,
                results: results
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = DataMigrationService;