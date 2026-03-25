#!/usr/bin/env node
/**
 * Email Templates CLI - Node.js wrapper for Python email template engine
 * Provides user-friendly command interface with JSON handling and formatting
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class EmailTemplatesCLI {
    constructor() {
        this.pythonScript = path.join(__dirname, 'email_templates.py');
        this.samplesDir = path.join(__dirname, '..', 'tests', 'sample-emails');
    }

    async runPythonCommand(args) {
        return new Promise((resolve, reject) => {
            const pythonPath = process.env.PYTHON_PATH || 'python3';
            const child = spawn(pythonPath, [this.pythonScript, ...args], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed: ${stderr}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    formatOutput(data, format = 'text') {
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        
        if (typeof data === 'string') {
            return data;
        }
        
        // Format structured output for readability
        if (data.subject_line && data.body) {
            let output = `📧 EMAIL PREVIEW\n`;
            output += `${'='.repeat(50)}\n`;
            output += `📨 Subject: ${data.subject_line}\n`;
            output += `🎭 Tone: ${data.tone}\n`;
            output += `📱 Platform: ${data.platform_optimized}\n`;
            output += `📊 Response Rate: ${(data.estimated_response_rate * 100).toFixed(1)}%\n`;
            output += `${'='.repeat(50)}\n\n`;
            output += data.body;
            output += `\n\n📋 ALTERNATIVES\n`;
            output += `${'='.repeat(20)}\n`;
            data.subject_alternatives.forEach((alt, i) => {
                output += `${i + 1}. ${alt}\n`;
            });
            
            if (data.follow_up_suggestions.length > 0) {
                output += `\n💡 FOLLOW-UP SUGGESTIONS\n`;
                output += `${'='.repeat(30)}\n`;
                data.follow_up_suggestions.forEach(suggestion => {
                    output += `• ${suggestion}\n`;
                });
            }
            
            return output;
        }
        
        return JSON.stringify(data, null, 2);
    }

    validateContext(contextObj) {
        const errors = [];
        
        if (!contextObj.client) {
            errors.push('Context must include client information');
        } else {
            if (!contextObj.client.name) {
                errors.push('Client name is required');
            }
        }
        
        if (contextObj.project && !contextObj.project.title) {
            errors.push('Project title is required when project context is provided');
        }
        
        return errors;
    }

    parseContextInput(contextInput) {
        try {
            // Handle different input formats
            if (typeof contextInput === 'string') {
                // Try parsing as JSON first
                try {
                    return JSON.parse(contextInput);
                } catch {
                    // Handle key=value format
                    const context = { client: {}, project: {}, custom_fields: {} };
                    const pairs = contextInput.split(',').map(p => p.trim());
                    
                    for (const pair of pairs) {
                        const [key, value] = pair.split('=').map(s => s.trim());
                        if (key && value) {
                            if (key.startsWith('client.')) {
                                context.client[key.substring(7)] = value;
                            } else if (key.startsWith('project.')) {
                                context.project[key.substring(8)] = value;
                            } else {
                                context.custom_fields[key] = value;
                            }
                        }
                    }
                    
                    return context;
                }
            }
            
            return contextInput;
        } catch (error) {
            throw new Error(`Invalid context format: ${error.message}`);
        }
    }

    createSampleContext(template = 'basic') {
        const samples = {
            basic: {
                client: {
                    name: 'John Smith',
                    company: 'Tech Startup Inc',
                    relationship_stage: 'new',
                    communication_style: 'professional'
                },
                project: {
                    title: 'Website Redesign',
                    type: 'website',
                    budget: 5000,
                    deadline: '2024-04-15'
                }
            },
            established: {
                client: {
                    name: 'Sarah Johnson',
                    company: 'Johnson & Associates',
                    relationship_stage: 'established',
                    communication_style: 'friendly',
                    project_count: 3
                },
                project: {
                    title: 'Mobile App Development',
                    type: 'app',
                    budget: 15000,
                    deadline: '2024-05-30',
                    status: 'active',
                    completion_percentage: 60
                }
            },
            payment: {
                client: {
                    name: 'Mike Wilson',
                    company: 'Wilson Enterprises',
                    relationship_stage: 'ongoing',
                    payment_history: 'delayed'
                },
                custom_fields: {
                    invoice_number: 'INV-2024-001',
                    amount: '2500',
                    due_date: '2024-03-15'
                }
            }
        };
        
        return samples[template] || samples.basic;
    }

    async listTemplates() {
        const categories = [
            'proposal',
            'followup', 
            'payment_reminder',
            'project_update',
            'client_onboarding',
            'scope_change',
            'testimonial_request',
            'cold_outreach',
            'thank_you',
            'rejection_response'
        ];

        const tones = ['professional', 'friendly', 'firm', 'casual', 'urgent'];
        const platforms = ['email', 'upwork', 'linkedin', 'slack'];

        console.log('📧 AVAILABLE EMAIL TEMPLATES\n');
        console.log('📋 Categories:');
        categories.forEach(cat => {
            console.log(`  • ${cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
        });

        console.log('\n🎭 Tones:');
        tones.forEach(tone => {
            console.log(`  • ${tone.charAt(0).toUpperCase() + tone.slice(1)}`);
        });

        console.log('\n📱 Platforms:');
        platforms.forEach(platform => {
            console.log(`  • ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
        });

        console.log('\n💡 EXAMPLE USAGE:');
        console.log('  npm run email-templates generate proposal --context basic');
        console.log('  npm run email-templates analyze "Your email text here"');
        console.log('  npm run email-templates sequence followup --context established');
    }

    async generateEmail(category, options = {}) {
        const { context: contextInput, tone, platform, format, template } = options;
        
        let context;
        if (contextInput === 'basic' || contextInput === 'established' || contextInput === 'payment') {
            context = this.createSampleContext(contextInput);
        } else if (contextInput) {
            context = this.parseContextInput(contextInput);
        } else {
            context = this.createSampleContext();
        }

        // Validate context
        const errors = this.validateContext(context);
        if (errors.length > 0) {
            throw new Error(`Context validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
        }

        const args = ['generate', '--category', category, '--context', JSON.stringify(context)];
        
        if (tone) args.push('--tone', tone);
        if (platform) args.push('--platform', platform);
        if (format) args.push('--output', format);

        const result = await this.runPythonCommand(args);
        
        if (format === 'json') {
            return JSON.parse(result);
        } else {
            return result;
        }
    }

    async analyzeEmail(text, format = 'text') {
        const args = ['analyze', '--text', text];
        if (format) args.push('--output', format);

        const result = await this.runPythonCommand(args);
        
        if (format === 'json') {
            const metrics = JSON.parse(result);
            return metrics;
        } else {
            return result;
        }
    }

    async generateSequence(category, options = {}) {
        const { context: contextInput, format, days } = options;
        
        let context;
        if (contextInput === 'basic' || contextInput === 'established' || contextInput === 'payment') {
            context = this.createSampleContext(contextInput);
        } else if (contextInput) {
            context = this.parseContextInput(contextInput);
        } else {
            context = this.createSampleContext();
        }

        // For now, generate individual emails for each day in sequence
        const sequenceDays = days ? days.split(',').map(d => parseInt(d.trim())) : [1, 3, 7, 14];
        const sequence = [];

        for (const day of sequenceDays) {
            // Modify context for follow-up
            const followupContext = {
                ...context,
                follow_up_sequence: true,
                sequence_day: day,
                urgency_level: day >= 7 ? 'high' : 'normal'
            };

            const tone = day === 1 ? 'friendly' : day <= 7 ? 'professional' : 'firm';
            
            const args = ['generate', '--category', category, '--context', JSON.stringify(followupContext)];
            if (tone) args.push('--tone', tone);
            if (format) args.push('--output', format);

            const result = await this.runPythonCommand(args);
            
            if (format === 'json') {
                const emailData = JSON.parse(result);
                sequence.push({ day, ...emailData });
            } else {
                sequence.push(`📅 Day ${day} Follow-up:\n${result}\n${'='.repeat(60)}\n`);
            }
        }

        if (format === 'json') {
            return { sequence };
        } else {
            return `🔄 FOLLOW-UP SEQUENCE\n${'='.repeat(60)}\n\n${sequence.join('\n')}`;
        }
    }

    async getSendTiming(options = {}) {
        const { context: contextInput, platform, format } = options;
        
        let context;
        if (contextInput) {
            context = this.parseContextInput(contextInput);
        } else {
            context = this.createSampleContext();
        }

        const args = ['timing', '--context', JSON.stringify(context)];
        if (platform) args.push('--platform', platform);
        if (format) args.push('--output', format);

        const result = await this.runPythonCommand(args);
        
        if (format === 'json') {
            return JSON.parse(result);
        } else {
            return result;
        }
    }

    async saveSample(emailData, filename) {
        if (!fs.existsSync(this.samplesDir)) {
            fs.mkdirSync(this.samplesDir, { recursive: true });
        }
        
        const filepath = path.join(this.samplesDir, filename);
        const content = typeof emailData === 'string' ? emailData : JSON.stringify(emailData, null, 2);
        
        fs.writeFileSync(filepath, content);
        console.log(`💾 Sample saved to: ${filepath}`);
    }

    async runInteractiveMode() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log('🚀 INTERACTIVE EMAIL TEMPLATE GENERATOR\n');
        console.log('Type "help" for commands or "exit" to quit\n');

        const askQuestion = (question) => {
            return new Promise((resolve) => {
                rl.question(question, resolve);
            });
        };

        while (true) {
            try {
                const input = await askQuestion('📧 > ');
                
                if (input.toLowerCase() === 'exit') {
                    console.log('👋 Goodbye!');
                    break;
                }
                
                if (input.toLowerCase() === 'help') {
                    console.log(`
📋 Available commands:
  generate <category> [--tone <tone>] [--context <context>] - Generate email
  analyze <text> - Analyze email tone
  sequence <category> [--context <context>] - Generate follow-up sequence  
  timing [--context <context>] [--platform <platform>] - Get send timing
  list - Show available templates
  samples - Show sample contexts
  save <filename> - Save last generated email
  help - Show this help
  exit - Quit interactive mode
                    `);
                    continue;
                }

                if (input.toLowerCase() === 'samples') {
                    console.log(`
📋 Sample contexts:
  basic - New client, website project
  established - Returning client, app project  
  payment - Payment reminder scenario
  
📝 Custom context format:
  client.name=John,client.company=TechCorp,project.title=Website
                    `);
                    continue;
                }

                // Parse command
                const parts = input.split(' ');
                const command = parts[0].toLowerCase();
                const args = parts.slice(1);

                if (command === 'generate' && args.length > 0) {
                    const category = args[0];
                    let tone, context = 'basic';
                    
                    for (let i = 1; i < args.length; i += 2) {
                        if (args[i] === '--tone' && args[i + 1]) tone = args[i + 1];
                        if (args[i] === '--context' && args[i + 1]) context = args[i + 1];
                    }
                    
                    const result = await this.generateEmail(category, { context, tone });
                    console.log(this.formatOutput(result));
                }
                else if (command === 'analyze' && args.length > 0) {
                    const text = args.join(' ');
                    const result = await this.analyzeEmail(text);
                    console.log(result);
                }
                else if (command === 'list') {
                    await this.listTemplates();
                }
                else {
                    console.log('❌ Unknown command. Type "help" for available commands.');
                }
                
            } catch (error) {
                console.error(`❌ Error: ${error.message}`);
            }
        }

        rl.close();
    }
}

// CLI Entry Point
async function main() {
    const cli = new EmailTemplatesCLI();
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🚀 Starting interactive mode...\n');
        return cli.runInteractiveMode();
    }

    const command = args[0];
    const options = {};
    
    // Parse command line options
    for (let i = 1; i < args.length; i += 2) {
        const flag = args[i];
        const value = args[i + 1];
        
        if (flag?.startsWith('--') && value) {
            options[flag.substring(2)] = value;
        }
    }

    try {
        let result;
        
        switch (command) {
            case 'generate':
                if (!args[1]) {
                    console.error('❌ Category required for generate command');
                    process.exit(1);
                }
                result = await cli.generateEmail(args[1], options);
                console.log(cli.formatOutput(result, options.format));
                break;
                
            case 'analyze':
                if (!options.text && !args[1]) {
                    console.error('❌ Text required for analyze command');
                    process.exit(1);
                }
                const text = options.text || args.slice(1).join(' ');
                result = await cli.analyzeEmail(text, options.format);
                console.log(result);
                break;
                
            case 'sequence':
                if (!args[1]) {
                    console.error('❌ Category required for sequence command');
                    process.exit(1);
                }
                result = await cli.generateSequence(args[1], options);
                console.log(result);
                break;
                
            case 'timing':
                result = await cli.getSendTiming(options);
                console.log(result);
                break;
                
            case 'list':
                await cli.listTemplates();
                break;
                
            default:
                console.log(`
📧 EMAIL TEMPLATES CLI

Usage: node email-templates.js <command> [options]

Commands:
  generate <category>     Generate email from template
  analyze <text>          Analyze email tone  
  sequence <category>     Generate follow-up sequence
  timing                  Get optimal send timing
  list                   Show available templates

Options:
  --context <context>     Client/project context (JSON or key=value)
  --tone <tone>          Email tone (professional, friendly, firm, casual, urgent)  
  --platform <platform>  Target platform (email, upwork, linkedin, slack)
  --format <format>      Output format (text, json)

Examples:
  node email-templates.js generate proposal --context basic
  node email-templates.js analyze "Your email text here"
  node email-templates.js sequence followup --context established --format json
  node email-templates.js timing --platform linkedin

For interactive mode, run without arguments.
                `);
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
}

// Make CLI executable
if (require.main === module) {
    main().catch(error => {
        console.error(`❌ Fatal error: ${error.message}`);
        process.exit(1);
    });
}

module.exports = EmailTemplatesCLI;