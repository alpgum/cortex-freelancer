#!/usr/bin/env node
/**
 * Profile Optimizer — Comprehensive Freelancer Profile Optimization Tool
 * 
 * Features:
 * - Profile Analysis Engine (completeness, keyword density, positioning)
 * - SEO Keyword Research (high-value keywords, trends, placement suggestions)
 * - Positioning Recommendations (competitor analysis, unique value props)
 * - Title & Overview Optimizer (SEO-optimized content with A/B testing)
 * - Skills Tag Optimization (market demand-based recommendations)
 * - Profile Scoring (0-100 across multiple categories)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ProfileOptimizer {
    constructor() {
        // Handle Node.js module compatibility
        this.toolsDir = path.dirname(__filename);
        this.pythonScript = path.join(this.toolsDir, 'profile_optimizer.py');
    }

    /**
     * Analyze a freelancer profile and provide comprehensive optimization recommendations
     */
    async analyzeProfile(profileData, options = {}) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                this.pythonScript,
                'analyze',
                '--input', JSON.stringify(profileData),
                ...(options.platform ? ['--platform', options.platform] : []),
                ...(options.niche ? ['--niche', options.niche] : []),
                ...(options.experience_level ? ['--experience-level', options.experience_level] : []),
                ...(options.target_budget ? ['--target-budget', options.target_budget.toString()] : []),
                ...(options.verbose ? ['--verbose'] : [])
            ]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Profile analysis failed: ${stderr}`));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse analysis result: ${error.message}`));
                    }
                }
            });
        });
    }

    /**
     * Research SEO keywords for a specific niche
     */
    async researchKeywords(niche, options = {}) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                this.pythonScript,
                'keywords',
                '--niche', niche,
                ...(options.platform ? ['--platform', options.platform] : []),
                ...(options.limit ? ['--limit', options.limit.toString()] : []),
                ...(options.include_trends ? ['--include-trends'] : [])
            ]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Keyword research failed: ${stderr}`));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse keyword research result: ${error.message}`));
                    }
                }
            });
        });
    }

    /**
     * Generate optimized profile content (title, overview, skills)
     */
    async optimizeContent(profileData, keywords, options = {}) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                this.pythonScript,
                'optimize',
                '--profile', JSON.stringify(profileData),
                '--keywords', JSON.stringify(keywords),
                ...(options.platform ? ['--platform', options.platform] : []),
                ...(options.variants ? ['--variants', options.variants.toString()] : []),
                ...(options.tone ? ['--tone', options.tone] : [])
            ]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Content optimization failed: ${stderr}`));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse optimization result: ${error.message}`));
                    }
                }
            });
        });
    }

    /**
     * Get competitor analysis and positioning recommendations
     */
    async analyzeCompetitors(niche, profileData, options = {}) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                this.pythonScript,
                'competitors',
                '--niche', niche,
                '--profile', JSON.stringify(profileData),
                ...(options.platform ? ['--platform', options.platform] : []),
                ...(options.top_count ? ['--top-count', options.top_count.toString()] : [])
            ]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Competitor analysis failed: ${stderr}`));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse competitor analysis result: ${error.message}`));
                    }
                }
            });
        });
    }

    /**
     * Score profile across all categories
     */
    async scoreProfile(profileData, options = {}) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python3', [
                this.pythonScript,
                'score',
                '--profile', JSON.stringify(profileData),
                ...(options.platform ? ['--platform', options.platform] : []),
                ...(options.detailed ? ['--detailed'] : [])
            ]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Profile scoring failed: ${stderr}`));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (error) {
                        reject(new Error(`Failed to parse scoring result: ${error.message}`));
                    }
                }
            });
        });
    }

    /**
     * Full optimization workflow - analyze, research keywords, optimize content, and score
     */
    async optimizeProfileFull(profileData, options = {}) {
        try {
            // Step 1: Initial analysis
            const analysis = await this.analyzeProfile(profileData, options);
            
            // Step 2: Keyword research based on detected niche
            const niche = options.niche || analysis.detected_niche || 'web-development';
            const keywords = await this.researchKeywords(niche, options);
            
            // Step 3: Content optimization
            const optimizedContent = await this.optimizeContent(profileData, keywords.keywords, options);
            
            // Step 4: Competitor analysis
            const competitorAnalysis = await this.analyzeCompetitors(niche, profileData, options);
            
            // Step 5: Final scoring
            const scoring = await this.scoreProfile(profileData, { ...options, detailed: true });
            
            return {
                analysis,
                keywords,
                optimizedContent,
                competitorAnalysis,
                scoring,
                recommendations: this._generateFinalRecommendations(analysis, keywords, optimizedContent, competitorAnalysis, scoring)
            };
        } catch (error) {
            throw new Error(`Full optimization workflow failed: ${error.message}`);
        }
    }

    /**
     * Generate final actionable recommendations
     */
    _generateFinalRecommendations(analysis, keywords, optimizedContent, competitorAnalysis, scoring) {
        const recommendations = [];
        
        // High-impact recommendations based on scoring gaps
        Object.entries(scoring.category_scores).forEach(([category, score]) => {
            if (score < 70) {
                switch (category) {
                    case 'completeness':
                        recommendations.push({
                            priority: 'high',
                            category: 'Profile Completeness',
                            action: 'Fill missing profile sections',
                            impact: 'Increases visibility and client trust',
                            specifics: analysis.missing_sections || []
                        });
                        break;
                    case 'seo_strength':
                        recommendations.push({
                            priority: 'high',
                            category: 'SEO Optimization',
                            action: 'Integrate high-value keywords',
                            impact: 'Improves search ranking and discoverability',
                            specifics: keywords.top_opportunities || []
                        });
                        break;
                    case 'positioning':
                        recommendations.push({
                            priority: 'medium',
                            category: 'Market Positioning',
                            action: 'Differentiate from competitors',
                            impact: 'Reduces price competition and increases perceived value',
                            specifics: competitorAnalysis.differentiation_opportunities || []
                        });
                        break;
                }
            }
        });

        return recommendations;
    }
}

// CLI interface when run directly
async function main() {
    if (require.main === module) {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log(`
Profile Optimizer - Freelancer Profile Optimization Tool

Usage:
  node profile-optimizer.js <command> [options]

Commands:
  analyze <profile.json>     Analyze existing profile
  keywords <niche>           Research SEO keywords
  optimize <profile.json>    Generate optimized content
  competitors <niche>        Analyze competitors
  score <profile.json>       Score profile
  full <profile.json>        Complete optimization workflow

Options:
  --platform <upwork|fiverr|linkedin>  Target platform (default: upwork)
  --niche <category>                    Freelance niche
  --experience-level <junior|mid|senior>
  --target-budget <amount>              Target project budget
  --verbose                             Detailed output

Example:
  node profile-optimizer.js analyze sample-profile.json --platform upwork --niche web-development
            `);
            process.exit(1);
        }

        const optimizer = new ProfileOptimizer();
        const command = args[0];
        
        try {
            switch (command) {
                case 'analyze':
                    if (args.length < 2) {
                        throw new Error('Profile file required for analyze command');
                    }
                    const profileData = JSON.parse(fs.readFileSync(args[1], 'utf8'));
                    const analysis = await optimizer.analyzeProfile(profileData);
                    console.log(JSON.stringify(analysis, null, 2));
                    break;
                
                case 'keywords':
                    if (args.length < 2) {
                        throw new Error('Niche required for keywords command');
                    }
                    const keywords = await optimizer.researchKeywords(args[1]);
                    console.log(JSON.stringify(keywords, null, 2));
                    break;
                
                case 'score':
                    if (args.length < 2) {
                        throw new Error('Profile file required for score command');
                    }
                    const scoreProfile = JSON.parse(fs.readFileSync(args[1], 'utf8'));
                    const profileScore = await optimizer.scoreProfile(scoreProfile);
                    console.log(JSON.stringify(profileScore, null, 2));
                    break;
                
                case 'full':
                    if (args.length < 2) {
                        throw new Error('Profile file required for full optimization');
                    }
                    const profile = JSON.parse(fs.readFileSync(args[1], 'utf8'));
                    const fullOptimization = await optimizer.optimizeProfileFull(profile);
                    console.log(JSON.stringify(fullOptimization, null, 2));
                    break;
                
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        } catch (error) {
            console.error(`Error: ${error.message}`);
            process.exit(1);
        }
    }
}

module.exports = ProfileOptimizer;

if (require.main === module) {
    main().catch(error => {
        console.error(error);
        process.exit(1);
    });
}