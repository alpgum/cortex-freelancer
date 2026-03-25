/**
 * Job Matching Algorithm
 * Smart matching engine for freelance jobs against freelancer profiles
 */

class JobMatcher {
    constructor(config = {}) {
        this.config = {
            // Matching weights
            skillsWeight: 0.35,
            budgetWeight: 0.25,
            timelineWeight: 0.15,
            clientQualityWeight: 0.15,
            locationWeight: 0.05,
            experienceWeight: 0.05,
            
            // Skill matching parameters
            exactSkillBonus: 1.0,
            relatedSkillBonus: 0.7,
            categorySkillBonus: 0.5,
            
            // Budget matching parameters
            budgetTolerancePercent: 20,
            budgetPreferenceBonus: 0.2,
            
            // Timeline matching parameters
            timelineFlexibilityDays: 7,
            urgentJobPenalty: 0.1,
            
            // Client quality thresholds
            minClientRating: 4.0,
            minClientReviews: 5,
            verifiedClientBonus: 0.1,
            
            ...config
        };
        
        this.skillCategories = this.loadSkillCategories();
        this.skillRelationships = this.loadSkillRelationships();
    }

    /**
     * Calculate match score between freelancer profile and job
     * @param {Object} profile - Freelancer profile
     * @param {Object} job - Job listing
     * @returns {Promise<number>} Match score (0-100)
     */
    async calculateMatch(profile, job) {
        try {
            const scores = {
                skills: this.calculateSkillsMatch(profile.skills, job.skills),
                budget: this.calculateBudgetMatch(profile.budget, job.budget),
                timeline: this.calculateTimelineMatch(profile.availability, job.timeline),
                clientQuality: this.calculateClientQualityMatch(profile.preferences, job.client),
                location: this.calculateLocationMatch(profile.location, job.location),
                experience: this.calculateExperienceMatch(profile.experience, job)
            };

            // Calculate weighted average
            let totalScore = 0;
            let totalWeight = 0;

            Object.entries(scores).forEach(([factor, score]) => {
                const weight = this.config[`${factor}Weight`] || 0;
                totalScore += score * weight;
                totalWeight += weight;
            });

            const matchScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;

            // Apply bonuses and penalties
            const adjustedScore = this.applyMatchAdjustments(matchScore, profile, job, scores);

            return Math.max(0, Math.min(100, Math.round(adjustedScore)));

        } catch (error) {
            console.error('Match calculation failed:', error);
            return 0;
        }
    }

    /**
     * Calculate skills match score
     * @param {string[]|Object} profileSkills - Freelancer skills
     * @param {string[]} jobSkills - Required job skills
     * @returns {number} Skills match score (0-1)
     */
    calculateSkillsMatch(profileSkills, jobSkills) {
        if (!jobSkills || jobSkills.length === 0) return 1;
        if (!profileSkills || profileSkills.length === 0) return 0;

        // Normalize skills arrays
        const normalizedProfileSkills = this.normalizeSkills(profileSkills);
        const normalizedJobSkills = this.normalizeSkills(jobSkills);

        let totalScore = 0;
        let maxPossibleScore = 0;

        normalizedJobSkills.forEach(jobSkill => {
            maxPossibleScore += this.config.exactSkillBonus;
            
            // Check for exact match
            if (normalizedProfileSkills.includes(jobSkill)) {
                totalScore += this.config.exactSkillBonus;
                return;
            }

            // Check for related skills
            const relatedSkillScore = this.getRelatedSkillScore(jobSkill, normalizedProfileSkills);
            totalScore += relatedSkillScore;
        });

        return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    }

    /**
     * Calculate budget compatibility score
     * @param {Object} profileBudget - Freelancer budget preferences
     * @param {Object} jobBudget - Job budget
     * @returns {number} Budget match score (0-1)
     */
    calculateBudgetMatch(profileBudget, jobBudget) {
        if (!jobBudget || !profileBudget) return 0.5; // Neutral if no budget info

        const jobMin = jobBudget.min || 0;
        const jobMax = jobBudget.max || jobMin;
        const profileMin = profileBudget.min || 0;
        const profileMax = profileBudget.max || profileMin;

        // Handle hourly vs fixed price
        if (jobBudget.type !== profileBudget.type) {
            // Convert to comparable rates if possible
            const convertedJobBudget = this.convertBudgetTypes(jobBudget, jobBudget.type, profileBudget.type);
            if (convertedJobBudget) {
                return this.calculateBudgetOverlap(profileMin, profileMax, convertedJobBudget.min, convertedJobBudget.max);
            }
            return 0.3; // Penalty for type mismatch
        }

        return this.calculateBudgetOverlap(profileMin, profileMax, jobMin, jobMax);
    }

    /**
     * Calculate timeline feasibility score
     * @param {Object} availability - Freelancer availability
     * @param {string|Object} jobTimeline - Job timeline requirements
     * @returns {number} Timeline match score (0-1)
     */
    calculateTimelineMatch(availability, jobTimeline) {
        if (!availability || !jobTimeline) return 0.7; // Neutral if no timeline info

        const requiredDays = this.parseTimelineToDays(jobTimeline);
        const availableDays = this.parseAvailabilityToDays(availability);

        if (requiredDays === 0 || availableDays === 0) return 0.7;

        // Calculate timeline compatibility
        const timelineRatio = availableDays / requiredDays;
        
        if (timelineRatio >= 1) {
            // Can complete within timeline
            return 1.0;
        } else if (timelineRatio >= 0.8) {
            // Close to timeline
            return 0.8;
        } else if (timelineRatio >= 0.6) {
            // Might be manageable
            return 0.5;
        } else {
            // Unlikely to meet timeline
            return 0.2;
        }
    }

    /**
     * Calculate client quality score
     * @param {Object} preferences - Freelancer preferences
     * @param {Object} client - Client information
     * @returns {number} Client quality score (0-1)
     */
    calculateClientQualityMatch(preferences, client) {
        if (!client) return 0.5; // Neutral if no client info

        let score = 0.5; // Base score

        // Rating factor
        if (client.rating) {
            const ratingScore = Math.max(0, (client.rating - 2) / 3); // Normalize 2-5 to 0-1
            score = (score + ratingScore) / 2;
        }

        // Review count factor
        if (client.reviewCount) {
            const reviewScore = Math.min(1, client.reviewCount / 50); // Normalize to 0-1, cap at 50 reviews
            score = (score + reviewScore) / 2;
        }

        // Hire rate factor
        if (client.hireRate) {
            const hireRateScore = client.hireRate / 100; // Convert percentage to 0-1
            score = (score + hireRateScore) / 2;
        }

        // Verification bonuses
        if (client.isVerified) {
            score += this.config.verifiedClientBonus;
        }
        
        if (client.paymentVerified) {
            score += this.config.verifiedClientBonus;
        }

        // Apply preferences
        if (preferences && preferences.clientRating && client.rating < preferences.clientRating) {
            score *= 0.7; // Penalty for below preferred rating
        }

        return Math.min(1, score);
    }

    /**
     * Calculate geographic/timezone compatibility
     * @param {Object} profileLocation - Freelancer location
     * @param {string} jobLocation - Job location requirements
     * @returns {number} Location match score (0-1)
     */
    calculateLocationMatch(profileLocation, jobLocation) {
        if (!jobLocation || jobLocation.toLowerCase() === 'remote') return 1;
        if (!profileLocation) return 0.7; // Neutral if no location info

        const profileLocationStr = typeof profileLocation === 'string' ? 
            profileLocation : `${profileLocation.country || ''} ${profileLocation.timezone || ''}`;

        // Simple location matching
        if (profileLocationStr.toLowerCase().includes(jobLocation.toLowerCase()) ||
            jobLocation.toLowerCase().includes(profileLocationStr.toLowerCase())) {
            return 1;
        }

        // Timezone compatibility for remote work
        if (this.isTimezoneCompatible(profileLocation.timezone, jobLocation)) {
            return 0.8;
        }

        return 0.5; // Neutral for different locations
    }

    /**
     * Calculate experience level match
     * @param {Object} experience - Freelancer experience
     * @param {Object} job - Job requirements
     * @returns {number} Experience match score (0-1)
     */
    calculateExperienceMatch(experience, job) {
        if (!experience || !job.experienceLevel) return 0.7; // Neutral

        const experienceYears = experience.years || 0;
        const requiredLevel = job.experienceLevel.toLowerCase();

        const levelMapping = {
            'entry': { min: 0, max: 2 },
            'intermediate': { min: 2, max: 5 },
            'expert': { min: 5, max: Infinity },
            'senior': { min: 7, max: Infinity }
        };

        const required = levelMapping[requiredLevel];
        if (!required) return 0.7;

        if (experienceYears >= required.min && experienceYears <= required.max) {
            return 1;
        } else if (experienceYears >= required.min - 1 && experienceYears <= required.max + 2) {
            return 0.8;
        } else {
            return 0.4;
        }
    }

    /**
     * Apply bonuses and penalties to match score
     * @param {number} baseScore - Base match score
     * @param {Object} profile - Freelancer profile
     * @param {Object} job - Job listing
     * @param {Object} scores - Individual factor scores
     * @returns {number} Adjusted match score
     */
    applyMatchAdjustments(baseScore, profile, job, scores) {
        let adjustedScore = baseScore;

        // Perfect skills match bonus
        if (scores.skills >= 0.9) {
            adjustedScore += 5;
        }

        // High competition penalty
        if (job.competition > 50) {
            adjustedScore -= 10;
        } else if (job.competition > 20) {
            adjustedScore -= 5;
        }

        // Urgent job penalty (usually low quality or problematic)
        if (job.isUrgent) {
            adjustedScore -= 5;
        }

        // New job bonus (less competition)
        const hoursOld = (Date.now() - new Date(job.postedAt).getTime()) / (1000 * 60 * 60);
        if (hoursOld < 24) {
            adjustedScore += 3;
        } else if (hoursOld < 72) {
            adjustedScore += 1;
        }

        // High-value project bonus
        if (job.budget && job.budget.min > 5000) {
            adjustedScore += 3;
        }

        // Platform-specific adjustments
        if (job.platform === 'upwork' && scores.clientQuality > 0.8) {
            adjustedScore += 2;
        }

        // Specialty skill bonus
        if (this.hasSpecialtySkills(profile.skills, job.skills)) {
            adjustedScore += 5;
        }

        return adjustedScore;
    }

    // Helper methods
    normalizeSkills(skills) {
        if (Array.isArray(skills)) {
            return skills.map(skill => skill.toLowerCase().trim());
        } else if (typeof skills === 'object' && skills.primary) {
            return [
                ...skills.primary.map(s => s.toLowerCase().trim()),
                ...(skills.secondary || []).map(s => s.toLowerCase().trim())
            ];
        }
        return [];
    }

    getRelatedSkillScore(jobSkill, profileSkills) {
        const relatedSkills = this.skillRelationships[jobSkill] || [];
        
        for (const relatedSkill of relatedSkills) {
            if (profileSkills.includes(relatedSkill)) {
                return this.config.relatedSkillBonus;
            }
        }

        // Check category match
        const jobCategory = this.getSkillCategory(jobSkill);
        for (const profileSkill of profileSkills) {
            if (this.getSkillCategory(profileSkill) === jobCategory) {
                return this.config.categorySkillBonus;
            }
        }

        return 0;
    }

    calculateBudgetOverlap(profileMin, profileMax, jobMin, jobMax) {
        const tolerance = this.config.budgetTolerancePercent / 100;
        
        // Adjust ranges with tolerance
        const adjustedProfileMin = profileMin * (1 - tolerance);
        const adjustedProfileMax = profileMax * (1 + tolerance);
        
        // Calculate overlap
        const overlapMin = Math.max(adjustedProfileMin, jobMin);
        const overlapMax = Math.min(adjustedProfileMax, jobMax);
        
        if (overlapMax <= overlapMin) return 0; // No overlap
        
        const overlapSize = overlapMax - overlapMin;
        const jobRangeSize = jobMax - jobMin;
        const profileRangeSize = adjustedProfileMax - adjustedProfileMin;
        
        const avgRangeSize = (jobRangeSize + profileRangeSize) / 2;
        
        return Math.min(1, overlapSize / avgRangeSize);
    }

    convertBudgetTypes(budget, fromType, toType) {
        // Simplified conversion - would need more sophisticated logic in practice
        if (fromType === 'fixed' && toType === 'hourly') {
            const assumedHours = 40; // Assume 40 hours for fixed projects
            return {
                min: budget.min / assumedHours,
                max: budget.max / assumedHours
            };
        } else if (fromType === 'hourly' && toType === 'fixed') {
            const assumedHours = 40;
            return {
                min: budget.min * assumedHours,
                max: budget.max * assumedHours
            };
        }
        return null;
    }

    parseTimelineToDays(timeline) {
        if (!timeline) return 0;
        
        if (typeof timeline === 'number') return timeline;
        
        if (typeof timeline === 'string') {
            const timelineStr = timeline.toLowerCase();
            
            if (timelineStr.includes('day')) {
                const match = timelineStr.match(/(\d+)\s*days?/);
                return match ? parseInt(match[1]) : 0;
            } else if (timelineStr.includes('week')) {
                const match = timelineStr.match(/(\d+)\s*weeks?/);
                return match ? parseInt(match[1]) * 7 : 0;
            } else if (timelineStr.includes('month')) {
                const match = timelineStr.match(/(\d+)\s*months?/);
                return match ? parseInt(match[1]) * 30 : 0;
            }
        }
        
        return 0;
    }

    parseAvailabilityToDays(availability) {
        if (!availability) return 0;
        
        if (typeof availability === 'number') return availability;
        
        if (availability.hoursPerWeek) {
            // Convert hours per week to project completion days
            const fullTimeHours = 40;
            const weeksToComplete = fullTimeHours / availability.hoursPerWeek;
            return weeksToComplete * 7;
        }
        
        if (availability.availableFrom) {
            const availableDate = new Date(availability.availableFrom);
            const now = new Date();
            const daysUntilAvailable = Math.max(0, (availableDate - now) / (1000 * 60 * 60 * 24));
            return 30 - daysUntilAvailable; // Assume 30 days max availability
        }
        
        return 30; // Default availability
    }

    isTimezoneCompatible(profileTimezone, jobLocation) {
        // Simplified timezone compatibility check
        // In a real implementation, you'd use proper timezone libraries
        const commonTimezones = {
            'est': -5, 'pst': -8, 'cst': -6, 'mst': -7,
            'gmt': 0, 'utc': 0, 'cet': 1, 'ist': 5.5
        };
        
        // Allow 4-hour difference for reasonable collaboration
        const maxTimeDiff = 4;
        
        // This is a simplified implementation
        return true; // Default to compatible
    }

    hasSpecialtySkills(profileSkills, jobSkills) {
        const specialtySkills = [
            'machine learning', 'blockchain', 'ai', 'devops', 'security',
            'data science', 'cloud architecture', 'microservices'
        ];
        
        const normalizedJobSkills = this.normalizeSkills(jobSkills);
        const normalizedProfileSkills = this.normalizeSkills(profileSkills);
        
        return specialtySkills.some(specialty => 
            normalizedJobSkills.some(jobSkill => jobSkill.includes(specialty)) &&
            normalizedProfileSkills.some(profileSkill => profileSkill.includes(specialty))
        );
    }

    getSkillCategory(skill) {
        for (const [category, skills] of Object.entries(this.skillCategories)) {
            if (skills.includes(skill.toLowerCase())) {
                return category;
            }
        }
        return 'other';
    }

    loadSkillCategories() {
        return {
            'frontend': ['javascript', 'react', 'vue', 'angular', 'html', 'css', 'typescript'],
            'backend': ['node.js', 'python', 'java', 'php', 'ruby', 'go', 'rust'],
            'mobile': ['react native', 'flutter', 'swift', 'kotlin', 'ios', 'android'],
            'devops': ['docker', 'kubernetes', 'aws', 'azure', 'terraform', 'jenkins'],
            'design': ['figma', 'photoshop', 'sketch', 'ui/ux', 'graphic design'],
            'data': ['machine learning', 'data science', 'python', 'r', 'sql', 'tableau'],
            'marketing': ['seo', 'content marketing', 'social media', 'google ads', 'copywriting']
        };
    }

    loadSkillRelationships() {
        return {
            'javascript': ['typescript', 'node.js', 'react', 'vue.js', 'angular'],
            'react': ['javascript', 'jsx', 'redux', 'next.js', 'gatsby'],
            'node.js': ['javascript', 'express', 'npm', 'mongodb', 'api development'],
            'python': ['django', 'flask', 'pandas', 'numpy', 'machine learning'],
            'java': ['spring', 'hibernate', 'maven', 'gradle', 'android'],
            'php': ['laravel', 'symfony', 'wordpress', 'mysql', 'composer'],
            'css': ['sass', 'less', 'bootstrap', 'tailwind', 'styled-components'],
            'aws': ['cloud computing', 'ec2', 's3', 'lambda', 'devops'],
            'machine learning': ['python', 'tensorflow', 'pytorch', 'data science', 'ai']
        };
    }

    /**
     * Get detailed match breakdown for debugging/explanation
     * @param {Object} profile - Freelancer profile
     * @param {Object} job - Job listing
     * @returns {Promise<Object>} Detailed match breakdown
     */
    async getMatchBreakdown(profile, job) {
        const scores = {
            skills: this.calculateSkillsMatch(profile.skills, job.skills),
            budget: this.calculateBudgetMatch(profile.budget, job.budget),
            timeline: this.calculateTimelineMatch(profile.availability, job.timeline),
            clientQuality: this.calculateClientQualityMatch(profile.preferences, job.client),
            location: this.calculateLocationMatch(profile.location, job.location),
            experience: this.calculateExperienceMatch(profile.experience, job)
        };

        const totalScore = await this.calculateMatch(profile, job);

        return {
            totalScore,
            breakdown: scores,
            weights: {
                skills: this.config.skillsWeight,
                budget: this.config.budgetWeight,
                timeline: this.config.timelineWeight,
                clientQuality: this.config.clientQualityWeight,
                location: this.config.locationWeight,
                experience: this.config.experienceWeight
            },
            recommendations: this.generateRecommendations(scores, profile, job)
        };
    }

    /**
     * Generate recommendations for improving match score
     * @param {Object} scores - Individual factor scores
     * @param {Object} profile - Freelancer profile
     * @param {Object} job - Job listing
     * @returns {string[]} Recommendations
     */
    generateRecommendations(scores, profile, job) {
        const recommendations = [];

        if (scores.skills < 0.7) {
            recommendations.push(`Consider learning: ${job.skills.slice(0, 3).join(', ')} to improve skill match`);
        }

        if (scores.budget < 0.5) {
            recommendations.push('Adjust your rate expectations to better match this project budget');
        }

        if (scores.timeline < 0.6) {
            recommendations.push('Consider if you can adjust your availability to meet the project timeline');
        }

        if (scores.clientQuality < 0.6) {
            recommendations.push('This client may have quality concerns - review their history carefully');
        }

        return recommendations;
    }
}

module.exports = JobMatcher;