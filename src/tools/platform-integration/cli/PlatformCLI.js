/**
 * Platform Integration CLI
 * Command-line interface for platform integration features
 */

class PlatformCLI {
    constructor(platformIntegration) {
        this.platform = platformIntegration;
        this.commands = new Map();
        this.registerCommands();
    }

    /**
     * Register available CLI commands
     */
    registerCommands() {
        this.commands.set('search', {
            description: 'Search for jobs across platforms',
            usage: 'platform search --skills "react,node" --budget 5000+ [options]',
            handler: this.handleSearch.bind(this)
        });

        this.commands.set('match', {
            description: 'Match a profile against a specific job',
            usage: 'platform match --profile myprofile.json --job joburl',
            handler: this.handleMatch.bind(this)
        });

        this.commands.set('monitor', {
            description: 'Monitor for new job opportunities',
            usage: 'platform monitor --keywords "react native" --min-budget 3000 [options]',
            handler: this.handleMonitor.bind(this)
        });

        this.commands.set('analyze', {
            description: 'Analyze a specific job URL',
            usage: 'platform analyze --url "upwork.com/job/..."',
            handler: this.handleAnalyze.bind(this)
        });

        this.commands.set('status', {
            description: 'Show platform integration status',
            usage: 'platform status',
            handler: this.handleStatus.bind(this)
        });

        this.commands.set('config', {
            description: 'Configure platform settings',
            usage: 'platform config [--set key=value] [--get key] [--list]',
            handler: this.handleConfig.bind(this)
        });

        this.commands.set('history', {
            description: 'Show search and alert history',
            usage: 'platform history [--alerts] [--searches] [--limit 10]',
            handler: this.handleHistory.bind(this)
        });

        this.commands.set('help', {
            description: 'Show help information',
            usage: 'platform help [command]',
            handler: this.handleHelp.bind(this)
        });
    }

    /**
     * Execute a CLI command
     * @param {string[]} args - Command arguments
     * @returns {Promise<string>} Command output
     */
    async execute(args) {
        try {
            if (args.length === 0) {
                return this.showHelp();
            }

            const commandName = args[0];
            const command = this.commands.get(commandName);

            if (!command) {
                return `Error: Unknown command '${commandName}'. Use 'platform help' for available commands.`;
            }

            const parsedArgs = this.parseArguments(args.slice(1));
            return await command.handler(parsedArgs);

        } catch (error) {
            console.error('CLI execution failed:', error);
            return `Error: ${error.message}`;
        }
    }

    /**
     * Parse command line arguments
     * @param {string[]} args - Raw arguments
     * @returns {Object} Parsed arguments
     */
    parseArguments(args) {
        const parsed = {
            flags: {},
            values: {},
            positional: []
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];

            if (arg.startsWith('--')) {
                const key = arg.substring(2);
                
                if (key.includes('=')) {
                    const [k, v] = key.split('=', 2);
                    parsed.values[k] = this.parseValue(v);
                } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
                    parsed.values[key] = this.parseValue(args[i + 1]);
                    i++;
                } else {
                    parsed.flags[key] = true;
                }
            } else if (arg.startsWith('-')) {
                parsed.flags[arg.substring(1)] = true;
            } else {
                parsed.positional.push(arg);
            }
        }

        return parsed;
    }

    /**
     * Parse a string value to appropriate type
     * @param {string} value - Value to parse
     * @returns {*} Parsed value
     */
    parseValue(value) {
        // Try to parse as number
        if (/^\d+$/.test(value)) {
            return parseInt(value);
        }
        
        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }

        // Try to parse as boolean
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Try to parse as array (comma-separated)
        if (value.includes(',')) {
            return value.split(',').map(s => s.trim());
        }

        // Return as string
        return value;
    }

    /**
     * Handle search command
     */
    async handleSearch(args) {
        try {
            // Build search criteria from arguments
            const criteria = {
                skills: args.values.skills || [],
                budgetMin: this.parseBudget(args.values.budget, 'min'),
                budgetMax: this.parseBudget(args.values.budget, 'max'),
                platforms: args.values.platforms || ['upwork', 'freelancer', 'fiverr'],
                location: args.values.location,
                category: args.values.category,
                limit: args.values.limit || 20
            };

            if (args.values['min-budget']) {
                criteria.budgetMin = args.values['min-budget'];
            }

            if (args.values['max-budget']) {
                criteria.budgetMax = args.values['max-budget'];
            }

            console.log('🔍 Searching for jobs...');
            const jobs = await this.platform.searchJobs(criteria);

            // Sort by opportunity score if available
            jobs.sort((a, b) => (b.opportunityScore?.totalScore || 0) - (a.opportunityScore?.totalScore || 0));

            let output = `\n📋 Found ${jobs.length} opportunities:\n\n`;

            for (const [index, job] of jobs.entries()) {
                if (index >= criteria.limit) break;

                output += this.formatJobSummary(job, index + 1);
                output += '\n';
            }

            if (args.flags.verbose || args.flags.v) {
                output += '\n📊 Search Statistics:\n';
                output += `• Total results: ${jobs.length}\n`;
                output += `• Platforms searched: ${criteria.platforms.join(', ')}\n`;
                output += `• Average match score: ${this.calculateAverageScore(jobs)}/100\n`;
            }

            return output;

        } catch (error) {
            return `❌ Search failed: ${error.message}`;
        }
    }

    /**
     * Handle match command
     */
    async handleMatch(args) {
        try {
            const profilePath = args.values.profile;
            const jobUrl = args.values.job;

            if (!profilePath) {
                return '❌ Profile file path is required (--profile)';
            }

            if (!jobUrl) {
                return '❌ Job URL is required (--job)';
            }

            // Load profile
            const profile = await this.loadProfile(profilePath);

            // Analyze job
            console.log('🔍 Analyzing job...');
            const job = await this.platform.analyzeJob(jobUrl);

            // Calculate match
            console.log('🎯 Calculating match score...');
            const matchedJob = await this.platform.matchJobs(profile, [job]);

            if (matchedJob.length === 0) {
                return '❌ Unable to match job against profile';
            }

            const result = matchedJob[0];
            
            let output = '\n🎯 Job Match Analysis:\n\n';
            output += this.formatJobDetails(result);
            output += '\n📊 Match Breakdown:\n';
            
            if (result.matchBreakdown) {
                for (const [factor, score] of Object.entries(result.matchBreakdown.breakdown)) {
                    output += `• ${factor}: ${Math.round(score * 100)}/100\n`;
                }
            }

            if (result.matchBreakdown?.recommendations) {
                output += '\n💡 Recommendations:\n';
                for (const rec of result.matchBreakdown.recommendations) {
                    output += `• ${rec}\n`;
                }
            }

            return output;

        } catch (error) {
            return `❌ Match analysis failed: ${error.message}`;
        }
    }

    /**
     * Handle monitor command
     */
    async handleMonitor(args) {
        try {
            const keywords = args.values.keywords || [];
            const minBudget = args.values['min-budget'] || 0;
            const platforms = args.values.platforms || ['upwork', 'freelancer'];
            const threshold = args.values.threshold || 70;

            const criteria = {
                skills: keywords,
                budgetMin: minBudget,
                platforms: platforms,
                matchThreshold: threshold,
                alertTypes: ['high_match', 'low_competition', 'high_budget']
            };

            if (args.flags.stop) {
                const monitorId = args.values.id;
                if (!monitorId) {
                    return '❌ Monitor ID required for --stop (use --id)';
                }
                
                const stopped = await this.platform.stopMonitoring(monitorId);
                return stopped ? 
                    `✅ Monitor ${monitorId} stopped` : 
                    `❌ Monitor ${monitorId} not found`;
            }

            if (args.flags.list) {
                return this.listMonitors();
            }

            // Create callback function for alerts
            const alertCallback = (alert) => {
                console.log('\n🚨 JOB ALERT:');
                console.log(alert.message);
            };

            console.log('🔔 Setting up job monitor...');
            const monitorId = await this.platform.setupMonitoring(criteria, alertCallback);

            let output = `✅ Monitor created successfully!\n\n`;
            output += `📋 Monitor Details:\n`;
            output += `• ID: ${monitorId}\n`;
            output += `• Keywords: ${keywords.join(', ')}\n`;
            output += `• Min Budget: $${minBudget}\n`;
            output += `• Platforms: ${platforms.join(', ')}\n`;
            output += `• Match Threshold: ${threshold}%\n\n`;
            output += `💡 Use 'platform monitor --stop --id ${monitorId}' to stop monitoring\n`;
            output += `💡 Use 'platform monitor --list' to see all monitors`;

            return output;

        } catch (error) {
            return `❌ Monitor setup failed: ${error.message}`;
        }
    }

    /**
     * Handle analyze command
     */
    async handleAnalyze(args) {
        try {
            const url = args.values.url;

            if (!url) {
                return '❌ Job URL is required (--url)';
            }

            console.log('🔍 Analyzing job...');
            const analysis = await this.platform.analyzeJob(url);

            let output = '\n📊 Job Analysis:\n\n';
            output += this.formatJobDetails(analysis);

            if (analysis.opportunityScore) {
                output += '\n🏆 Opportunity Score:\n';
                output += `• Overall: ${analysis.opportunityScore.totalScore}/100\n`;
                output += `• Recommendation: ${analysis.opportunityScore.recommendation}\n`;
                output += `• Risk Level: ${analysis.opportunityScore.riskLevel}\n`;
                output += `• Competition: ${analysis.opportunityScore.competitionLevel}\n`;

                if (analysis.opportunityScore.insights.length > 0) {
                    output += '\n💡 Insights:\n';
                    for (const insight of analysis.opportunityScore.insights) {
                        output += `• ${insight}\n`;
                    }
                }
            }

            return output;

        } catch (error) {
            return `❌ Analysis failed: ${error.message}`;
        }
    }

    /**
     * Handle status command
     */
    async handleStatus(args) {
        try {
            const connectors = this.platform.getConnectors();
            
            let output = '\n📊 Platform Integration Status:\n\n';
            
            // Platform connector status
            output += '🔗 Platform Connectors:\n';
            for (const [name, connector] of connectors) {
                const status = connector.isAuthenticated ? '✅ Connected' : '⚠️  Not authenticated';
                output += `• ${name}: ${status}\n`;
            }

            // Smart alerts status
            const smartAlerts = this.platform.smartAlerts;
            const alertStats = smartAlerts.getStats();
            
            output += '\n🔔 Smart Alerts:\n';
            output += `• Status: ${alertStats.isRunning ? '✅ Running' : '⏸️  Stopped'}\n`;
            output += `• Active Monitors: ${alertStats.activeMonitors}\n`;
            output += `• Alerts Today: ${alertStats.alertsToday}\n`;
            output += `• Rate Limit: ${alertStats.rateLimitStatus.hourly} (hourly)\n`;

            // System information
            output += '\n⚙️  System:\n';
            output += `• Memory Usage: ${this.getMemoryUsage()}\n`;
            output += `• Uptime: ${this.getUptime()}\n`;

            return output;

        } catch (error) {
            return `❌ Status check failed: ${error.message}`;
        }
    }

    /**
     * Handle config command
     */
    async handleConfig(args) {
        try {
            if (args.flags.list) {
                return this.listConfiguration();
            }

            if (args.values.get) {
                return this.getConfigValue(args.values.get);
            }

            if (args.values.set) {
                return this.setConfigValue(args.values.set);
            }

            return this.listConfiguration();

        } catch (error) {
            return `❌ Config operation failed: ${error.message}`;
        }
    }

    /**
     * Handle history command
     */
    async handleHistory(args) {
        try {
            const limit = args.values.limit || 10;
            let output = '\n📜 History:\n\n';

            if (args.flags.alerts || (!args.flags.searches && !args.flags.alerts)) {
                const smartAlerts = this.platform.smartAlerts;
                const alertHistory = smartAlerts.getAlertHistory({ limit });

                output += '🚨 Recent Alerts:\n';
                for (const alert of alertHistory) {
                    output += `• ${alert.timestamp.toLocaleString()}: ${alert.jobTitle} (${alert.priority})\n`;
                }
                output += '\n';
            }

            if (args.flags.searches) {
                output += '🔍 Recent Searches:\n';
                output += '• Search history feature coming soon...\n';
            }

            return output;

        } catch (error) {
            return `❌ History retrieval failed: ${error.message}`;
        }
    }

    /**
     * Handle help command
     */
    async handleHelp(args) {
        const commandName = args.positional[0];

        if (commandName) {
            const command = this.commands.get(commandName);
            if (command) {
                return `\n${command.description}\n\nUsage: ${command.usage}\n`;
            } else {
                return `❌ Unknown command: ${commandName}`;
            }
        }

        return this.showHelp();
    }

    // Helper methods

    showHelp() {
        let output = '\n🔧 Platform Integration CLI\n\n';
        output += 'Available commands:\n\n';

        for (const [name, command] of this.commands) {
            output += `• ${name.padEnd(12)} ${command.description}\n`;
        }

        output += '\nUse "platform help <command>" for detailed usage information.\n';
        return output;
    }

    formatJobSummary(job, index) {
        const budget = job.budget ? 
            `$${job.budget.min}${job.budget.max !== job.budget.min ? `-$${job.budget.max}` : ''}` : 
            'Budget TBD';
        
        const score = job.opportunityScore?.totalScore || job.matchScore || 0;
        const competition = job.competition ? `${job.competition} bidders` : 'Unknown';

        let output = `${index}. 📋 ${job.title}\n`;
        output += `   💰 ${budget} | 🎯 ${score}/100 | 🥊 ${competition} | 🏢 ${job.platform}\n`;
        
        if (job.skills && job.skills.length > 0) {
            output += `   🛠️  ${job.skills.slice(0, 4).join(', ')}${job.skills.length > 4 ? '...' : ''}\n`;
        }
        
        if (job.url) {
            output += `   🔗 ${job.url}\n`;
        }

        return output;
    }

    formatJobDetails(job) {
        let output = `📋 ${job.title}\n\n`;
        
        if (job.description) {
            const shortDesc = job.description.length > 200 ? 
                job.description.substring(0, 200) + '...' : 
                job.description;
            output += `📝 ${shortDesc}\n\n`;
        }

        output += `💰 Budget: ${this.formatBudget(job.budget)}\n`;
        output += `🏢 Platform: ${job.platform}\n`;
        output += `📅 Posted: ${this.formatDate(job.postedAt)}\n`;

        if (job.competition !== undefined) {
            output += `🥊 Competition: ${job.competition} bidders\n`;
        }

        if (job.skills && job.skills.length > 0) {
            output += `🛠️  Skills: ${job.skills.join(', ')}\n`;
        }

        if (job.client) {
            output += `👤 Client: ${job.client.name || 'Anonymous'}`;
            if (job.client.rating) {
                output += ` (${job.client.rating}⭐)`;
            }
            output += '\n';
        }

        return output;
    }

    formatBudget(budget) {
        if (!budget) return 'TBD';
        
        if (budget.type === 'hourly') {
            return `$${budget.min}/hr`;
        } else if (budget.min === budget.max) {
            return `$${budget.min}`;
        } else {
            return `$${budget.min}-$${budget.max}`;
        }
    }

    formatDate(date) {
        if (!date) return 'Unknown';
        
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 24) {
            return `${diffHours} hours ago`;
        } else {
            return `${diffDays} days ago`;
        }
    }

    parseBudget(budgetStr, type) {
        if (!budgetStr) return undefined;
        
        const str = budgetStr.toString();
        
        if (str.includes('+')) {
            return type === 'min' ? parseInt(str.replace('+', '')) : undefined;
        } else if (str.includes('-')) {
            const [min, max] = str.split('-').map(s => parseInt(s));
            return type === 'min' ? min : max;
        } else {
            const value = parseInt(str);
            return type === 'min' ? value : value;
        }
    }

    calculateAverageScore(jobs) {
        if (jobs.length === 0) return 0;
        
        const total = jobs.reduce((sum, job) => 
            sum + (job.opportunityScore?.totalScore || job.matchScore || 0), 0
        );
        
        return Math.round(total / jobs.length);
    }

    async loadProfile(profilePath) {
        // This would typically load from a JSON file
        // For now, return a default profile structure
        return {
            skills: {
                primary: ['javascript', 'react', 'node.js'],
                secondary: ['python', 'aws', 'mongodb']
            },
            budget: {
                min: 50,
                max: 150,
                type: 'hourly'
            },
            availability: {
                hoursPerWeek: 40,
                availableFrom: new Date()
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
                clientRating: 4.0,
                minBudget: 1000
            }
        };
    }

    listMonitors() {
        const smartAlerts = this.platform.smartAlerts;
        const monitors = smartAlerts.getMonitors();

        if (monitors.length === 0) {
            return '📭 No active monitors';
        }

        let output = '\n🔔 Active Monitors:\n\n';
        
        for (const monitor of monitors) {
            output += `• ${monitor.id}\n`;
            output += `  Keywords: ${monitor.criteria.skills.join(', ')}\n`;
            output += `  Budget: $${monitor.criteria.budgetMin}+\n`;
            output += `  Alerts: ${monitor.alertCount}\n`;
            output += `  Last Check: ${this.formatDate(monitor.lastChecked)}\n\n`;
        }

        return output;
    }

    listConfiguration() {
        let output = '\n⚙️  Configuration:\n\n';
        output += '• Default search limit: 20\n';
        output += '• Alert threshold: 70%\n';
        output += '• Monitoring interval: 15 minutes\n';
        output += '• Rate limit: 20 alerts/hour\n';
        return output;
    }

    getConfigValue(key) {
        return `Config value for '${key}': Not implemented yet`;
    }

    setConfigValue(keyValue) {
        return `Set config '${keyValue}': Not implemented yet`;
    }

    getMemoryUsage() {
        const used = process.memoryUsage();
        return `${Math.round(used.heapUsed / 1024 / 1024)} MB`;
    }

    getUptime() {
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

module.exports = PlatformCLI;