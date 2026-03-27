/**
 * Cortex Freelancer Demo Workflow
 * End-to-end demo experience showing AI-powered freelancer assistance
 */

class DemoWorkflow {
    constructor() {
        this.currentStep = 0;
        this.demoData = null;
        this.userId = 'demo_user_001';
        this.loadDemoData();
    }

    async loadDemoData() {
        try {
            const response = await fetch('/data/mock/jobs-database.json');
            this.demoData = await response.json();
            this.initializeDemo();
        } catch (error) {
            console.error('Failed to load demo data:', error);
            this.initializeDemo(); // Continue with fallback
        }
    }

    initializeDemo() {
        this.steps = [
            {
                name: 'Job Discovery',
                description: 'AI shows personalized job matches',
                action: () => this.showJobMatches()
            },
            {
                name: 'Job Analysis',
                description: 'AI analyzes job compatibility',
                action: () => this.analyzeJob()
            },
            {
                name: 'Proposal Generation',
                description: 'AI creates personalized proposal',
                action: () => this.generateProposal()
            },
            {
                name: 'Client Research',
                description: 'AI researches client background',
                action: () => this.researchClient()
            },
            {
                name: 'Application Sent',
                description: 'Track application status',
                action: () => this.trackApplication()
            },
            {
                name: 'Project Won',
                description: 'Celebrate success and next steps',
                action: () => this.celebrateWin()
            }
        ];
        
        this.setupDemoInterface();
    }

    setupDemoInterface() {
        const demoContainer = document.createElement('div');
        demoContainer.id = 'demo-workflow';
        demoContainer.className = 'demo-workflow-container';
        demoContainer.innerHTML = `
            <div class="demo-header">
                <h2>🤖 AI Freelancer Assistant Demo</h2>
                <div class="demo-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span class="progress-text">Step 1 of ${this.steps.length}</span>
                </div>
            </div>
            
            <div class="demo-content">
                <div class="demo-step-info">
                    <h3 id="step-title">Getting Started</h3>
                    <p id="step-description">Let me show you how AI can transform your freelancing workflow</p>
                </div>
                
                <div class="demo-display" id="demo-display">
                    <div class="welcome-screen">
                        <div class="ai-avatar">🧠</div>
                        <h3>Welcome to Cortex Freelancer</h3>
                        <p>I'm your AI-powered freelance assistant. I'll help you find jobs, write proposals, and manage your business more efficiently.</p>
                        <button class="demo-start-btn" onclick="demoWorkflow.startDemo()">Start Demo</button>
                    </div>
                </div>
                
                <div class="demo-controls">
                    <button class="demo-btn prev" onclick="demoWorkflow.prevStep()" disabled>← Previous</button>
                    <button class="demo-btn next" onclick="demoWorkflow.nextStep()" disabled>Next →</button>
                    <button class="demo-btn restart" onclick="demoWorkflow.restart()">🔄 Restart</button>
                </div>
            </div>
            
            <div class="demo-footer">
                <div class="demo-stats">
                    <div class="stat">
                        <span class="stat-value">92%</span>
                        <span class="stat-label">Proposal Win Rate</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">$85/hr</span>
                        <span class="stat-label">Average Rate</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">127</span>
                        <span class="stat-label">Projects Completed</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add CSS styles
        this.addDemoStyles();
        
        // Insert into page
        const targetContainer = document.getElementById('main-content') || document.body;
        targetContainer.appendChild(demoContainer);
        
        // Make demo globally accessible
        window.demoWorkflow = this;
    }

    addDemoStyles() {
        const styles = `
        <style>
        .demo-workflow-container {
            max-width: 1000px;
            margin: 20px auto;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 20px;
            padding: 30px;
            color: white;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            font-family: 'Inter', sans-serif;
        }
        
        .demo-header h2 {
            text-align: center;
            margin-bottom: 20px;
            font-size: 28px;
            font-weight: 600;
        }
        
        .demo-progress {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .progress-bar {
            background: rgba(255,255,255,0.2);
            height: 8px;
            border-radius: 4px;
            margin-bottom: 10px;
            overflow: hidden;
        }
        
        .progress-fill {
            background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%);
            height: 100%;
            transition: width 0.5s ease;
        }
        
        .progress-text {
            font-size: 14px;
            opacity: 0.8;
        }
        
        .demo-content {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 20px;
        }
        
        .demo-step-info {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .demo-step-info h3 {
            font-size: 24px;
            margin-bottom: 10px;
        }
        
        .demo-display {
            background: white;
            color: #333;
            border-radius: 12px;
            padding: 30px;
            min-height: 400px;
            position: relative;
        }
        
        .welcome-screen {
            text-align: center;
            padding: 50px 20px;
        }
        
        .ai-avatar {
            font-size: 60px;
            margin-bottom: 20px;
        }
        
        .welcome-screen h3 {
            color: #333;
            margin-bottom: 15px;
        }
        
        .demo-start-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 50px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }
        
        .demo-start-btn:hover {
            transform: translateY(-2px);
        }
        
        .demo-controls {
            text-align: center;
            gap: 15px;
            display: flex;
            justify-content: center;
        }
        
        .demo-btn {
            background: rgba(255,255,255,0.2);
            color: white;
            border: 2px solid rgba(255,255,255,0.3);
            padding: 12px 24px;
            border-radius: 25px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }
        
        .demo-btn:hover:not(:disabled) {
            background: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
        
        .demo-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .demo-footer {
            text-align: center;
        }
        
        .demo-stats {
            display: flex;
            justify-content: space-around;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .stat {
            text-align: center;
        }
        
        .stat-value {
            display: block;
            font-size: 24px;
            font-weight: 700;
            color: #4facfe;
        }
        
        .stat-label {
            display: block;
            font-size: 12px;
            opacity: 0.8;
            margin-top: 5px;
        }
        
        .job-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid #667eea;
        }
        
        .job-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
        }
        
        .job-meta {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        
        .job-skills {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .skill-tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
        }
        
        .match-score {
            float: right;
            background: #4caf50;
            color: white;
            padding: 4px 12px;
            border-radius: 12px;
            font-weight: 600;
        }
        
        .ai-analysis {
            background: #f0f7ff;
            border: 2px solid #2196f3;
            border-radius: 8px;
            padding: 20px;
            margin: 15px 0;
        }
        
        .analysis-header {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .ai-thinking {
            animation: pulse 1.5s infinite;
            margin-right: 10px;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    startDemo() {
        this.currentStep = 0;
        this.nextStep();
    }

    nextStep() {
        if (this.currentStep < this.steps.length) {
            this.steps[this.currentStep].action();
            this.currentStep++;
            this.updateProgress();
        }
        
        this.updateControls();
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.steps[this.currentStep - 1].action();
            this.updateProgress();
        }
        
        this.updateControls();
    }

    updateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        const percentage = (this.currentStep / this.steps.length) * 100;
        progressFill.style.width = percentage + '%';
        progressText.textContent = `Step ${this.currentStep} of ${this.steps.length}`;
        
        if (this.currentStep <= this.steps.length) {
            const step = this.steps[this.currentStep - 1];
            document.getElementById('step-title').textContent = step.name;
            document.getElementById('step-description').textContent = step.description;
        }
    }

    updateControls() {
        const prevBtn = document.querySelector('.demo-btn.prev');
        const nextBtn = document.querySelector('.demo-btn.next');
        
        prevBtn.disabled = this.currentStep <= 1;
        nextBtn.disabled = this.currentStep >= this.steps.length;
        
        if (this.currentStep >= this.steps.length) {
            nextBtn.textContent = '🎉 Complete';
        } else {
            nextBtn.textContent = 'Next →';
        }
    }

    showJobMatches() {
        const display = document.getElementById('demo-display');
        const jobs = this.demoData?.jobs?.slice(0, 3) || this.getFallbackJobs();
        
        display.innerHTML = `
            <div class="ai-analysis">
                <div class="analysis-header">
                    <span class="ai-thinking">🧠</span>
                    <strong>AI Analysis Complete</strong>
                </div>
                <p>I found ${jobs.length} high-potential job matches based on your profile:</p>
            </div>
            
            ${jobs.map((job, index) => `
                <div class="job-card" onclick="demoWorkflow.selectJob(${index})">
                    <div class="job-title">
                        ${job.title}
                        <span class="match-score">${85 + index * 5}% Match</span>
                    </div>
                    <div class="job-meta">
                        💰 ${job.budgetType === 'hourly' ? '$' + job.budget + '/hour' : '$' + job.budget + ' fixed'} • 
                        ⏱️ ${job.duration} • 
                        📍 ${job.location}
                    </div>
                    <div class="job-skills">
                        ${job.skills.slice(0, 4).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                    </div>
                </div>
            `).join('')}
            
            <div style="text-align: center; margin-top: 20px;">
                <p style="color: #666; font-style: italic;">Click on any job to see detailed AI analysis</p>
            </div>
        `;
    }

    selectJob(index) {
        this.selectedJob = index;
        this.nextStep();
    }

    analyzeJob() {
        const display = document.getElementById('demo-display');
        const job = this.demoData?.jobs?.[this.selectedJob || 0] || this.getFallbackJobs()[0];
        
        display.innerHTML = `
            <div class="ai-analysis">
                <div class="analysis-header">
                    <span class="ai-thinking">🧠</span>
                    <strong>Deep Job Analysis</strong>
                </div>
                
                <h3 style="color: #333; margin-bottom: 15px;">${job.title}</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4>✅ Strengths</h4>
                        <ul>
                            <li>Perfect skill match (React, TypeScript)</li>
                            <li>Rate within your range ($${job.budget || 45}/hr)</li>
                            <li>Established client (${job.clientRating || 4.8}★ rating)</li>
                        </ul>
                    </div>
                    
                    <div>
                        <h4>⚠️ Considerations</h4>
                        <ul>
                            <li>${job.proposals || 12} other proposals submitted</li>
                            <li>Client prefers ${job.location || 'US'} timezone</li>
                            <li>Long-term project requires commitment</li>
                        </ul>
                    </div>
                </div>
                
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-top: 15px;">
                    <strong>🎯 AI Recommendation:</strong> 
                    <span style="color: #2e7d32;">STRONG MATCH - Apply with confidence!</span>
                    <br><br>
                    <strong>Strategy:</strong> Emphasize your e-commerce experience and propose a discovery phase to stand out.
                </div>
            </div>
        `;
    }

    generateProposal() {
        const display = document.getElementById('demo-display');
        
        // Simulate typing effect
        display.innerHTML = `
            <div class="ai-analysis">
                <div class="analysis-header">
                    <span class="ai-thinking">✍️</span>
                    <strong>Generating Personalized Proposal...</strong>
                </div>
                <div id="proposal-content" style="background: white; padding: 20px; border-radius: 8px; margin-top: 15px; min-height: 200px;">
                    <div style="text-align: center; padding: 50px;">
                        <div class="ai-thinking" style="font-size: 30px;">💭</div>
                        <p>AI is crafting your proposal...</p>
                    </div>
                </div>
            </div>
        `;
        
        setTimeout(() => {
            document.getElementById('proposal-content').innerHTML = `
                <h4>Subject: React E-commerce Development - Let's Build Something Amazing</h4>
                <hr>
                <p>Hi there,</p>
                
                <p>I've reviewed your React e-commerce platform requirements and I'm excited about the opportunity to help you create something exceptional.</p>
                
                <p><strong>Why I'm the perfect fit:</strong></p>
                <ul>
                    <li>5+ years of React development with TypeScript and Redux</li>
                    <li>Specialized in e-commerce platforms (built 15+ stores)</li>
                    <li>Expert in payment gateway integration (Stripe, PayPal, Apple Pay)</li>
                    <li>Track record of delivering projects 20% ahead of schedule</li>
                </ul>
                
                <p><strong>My approach:</strong></p>
                <ol>
                    <li><strong>Discovery Phase (Week 1):</strong> Deep dive into your business requirements and user journey mapping</li>
                    <li><strong>MVP Development (Weeks 2-8):</strong> Core features with weekly demos</li>
                    <li><strong>Optimization (Weeks 9-12):</strong> Performance tuning and advanced features</li>
                </ol>
                
                <p><strong>Investment:</strong> $45/hour (within your budget)</p>
                <p><strong>Timeline:</strong> 3 months for full platform</p>
                
                <p>I'd love to discuss your vision in detail. When would be a good time for a quick call?</p>
                
                <p>Best regards,<br>Alex Johnson</p>
                
                <div style="background: #f0f7ff; padding: 10px; border-radius: 5px; margin-top: 15px;">
                    <small><strong>🤖 AI Enhancement:</strong> Personalized based on client's startup background and previous positive feedback on communication style.</small>
                </div>
            `;
        }, 2000);
    }

    researchClient() {
        const display = document.getElementById('demo-display');
        
        display.innerHTML = `
            <div class="ai-analysis">
                <div class="analysis-header">
                    <span class="ai-thinking">🔍</span>
                    <strong>Client Background Research</strong>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h4>💼 Company Profile</h4>
                    <p><strong>TechStart Solutions</strong></p>
                    <p>📍 San Francisco, CA</p>
                    <p>👥 15-50 employees</p>
                    <p>💰 Series A funded ($2.3M)</p>
                    <p>🎯 B2B SaaS platform for inventory management</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h4>📊 Project History</h4>
                    <p>✅ 15+ completed projects</p>
                    <p>💳 Average budget: $2,500</p>
                    <p>⭐ 4.8/5 client rating</p>
                    <p>💰 $50k+ total spent</p>
                    <p>🕒 Always pays on time</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h4>🎯 Preferences</h4>
                    <ul>
                        <li>Values clear communication</li>
                        <li>Prefers milestone-based delivery</li>
                        <li>Appreciates proactive updates</li>
                        <li>Tech-savvy, understands development</li>
                    </ul>
                </div>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                    <h4>💡 AI Insights</h4>
                    <ul>
                        <li>Mention experience with inventory systems</li>
                        <li>Emphasize milestone-based approach</li>
                        <li>Include technical architecture details</li>
                        <li>Offer post-launch support</li>
                    </ul>
                </div>
            </div>
        `;
    }

    trackApplication() {
        const display = document.getElementById('demo-display');
        
        display.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 60px; margin-bottom: 20px;">📧</div>
                <h3>Proposal Sent Successfully!</h3>
                <p>Your AI-optimized proposal has been submitted.</p>
                
                <div style="background: #e8f5e8; padding: 20px; border-radius: 12px; margin: 20px 0; display: inline-block;">
                    <h4>📊 Application Analytics</h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                        <div>
                            <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">92%</div>
                            <div style="font-size: 12px;">AI Optimization Score</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">3.2x</div>
                            <div style="font-size: 12px;">Higher Response Rate</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: bold; color: #2e7d32;">24h</div>
                            <div style="font-size: 12px;">Avg Response Time</div>
                        </div>
                    </div>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px;">
                    <strong>🤖 AI Tip:</strong> Based on this client's pattern, they typically respond within 24-48 hours. 
                    I'll remind you to follow up if needed!
                </div>
            </div>
        `;
    }

    celebrateWin() {
        const display = document.getElementById('demo-display');
        
        display.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 80px; margin-bottom: 20px;">🎉</div>
                <h2 style="color: #2e7d32; margin-bottom: 15px;">Congratulations!</h2>
                <h3>You Won the Project!</h3>
                <p>The client was impressed by your personalized proposal and chose you for the React e-commerce project.</p>
                
                <div style="background: linear-gradient(135deg, #4caf50 0%, #66bb6a 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0; display: inline-block;">
                    <h4>📈 Project Details</h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; text-align: left;">
                        <div>
                            <strong>Project Value:</strong> $13,500<br>
                            <strong>Duration:</strong> 3 months<br>
                            <strong>Rate:</strong> $45/hour
                        </div>
                        <div>
                            <strong>Client Rating:</strong> 4.8/5<br>
                            <strong>Payment:</strong> Milestone-based<br>
                            <strong>Start Date:</strong> This Monday
                        </div>
                    </div>
                </div>
                
                <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-top: 20px;">
                    <h4>🚀 Next Steps with AI Assistant</h4>
                    <div style="text-align: left; margin-top: 10px;">
                        <p>✅ Project timeline automatically generated</p>
                        <p>✅ Client onboarding email template ready</p>
                        <p>✅ Invoice template prepared for first milestone</p>
                        <p>✅ Calendar integration set up for regular check-ins</p>
                    </div>
                </div>
                
                <button class="demo-start-btn" onclick="demoWorkflow.restart()" style="margin-top: 20px;">
                    🔄 Try Demo Again
                </button>
            </div>
        `;
    }

    restart() {
        this.currentStep = 0;
        this.selectedJob = null;
        
        const display = document.getElementById('demo-display');
        display.innerHTML = `
            <div class="welcome-screen">
                <div class="ai-avatar">🧠</div>
                <h3>Welcome Back to Cortex Freelancer</h3>
                <p>Ready to see how AI can transform your freelancing again?</p>
                <button class="demo-start-btn" onclick="demoWorkflow.startDemo()">Start Demo</button>
            </div>
        `;
        
        this.updateControls();
        
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        progressFill.style.width = '0%';
        progressText.textContent = `Step 1 of ${this.steps.length}`;
        
        document.getElementById('step-title').textContent = 'Getting Started';
        document.getElementById('step-description').textContent = 'Let me show you how AI can transform your freelancing workflow';
    }

    getFallbackJobs() {
        return [
            {
                title: 'React Developer for E-commerce Platform',
                budget: 45,
                budgetType: 'hourly',
                duration: '3-6 months',
                location: 'United States',
                clientRating: 4.8,
                proposals: 12,
                skills: ['React', 'TypeScript', 'Redux', 'E-commerce']
            },
            {
                title: 'WordPress Website Development',
                budget: 1200,
                budgetType: 'fixed', 
                duration: '1-3 months',
                location: 'Canada',
                clientRating: 4.2,
                proposals: 8,
                skills: ['WordPress', 'SEO', 'Custom Theme', 'Page Speed']
            },
            {
                title: 'Mobile App UI/UX Design',
                budget: 35,
                budgetType: 'hourly',
                duration: '2-4 weeks', 
                location: 'United Kingdom',
                clientRating: 4.6,
                proposals: 6,
                skills: ['React Native', 'Figma', 'UI/UX', 'Mobile']
            }
        ];
    }
}

// Initialize demo when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.demoWorkflow = new DemoWorkflow();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DemoWorkflow;
}