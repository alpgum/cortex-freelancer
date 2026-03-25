// Cortex Freelancer - Client Communication Automation
// Sprint 2 - Task 8/50

class ClientCommunication {
    constructor() {
        this.templates = new Map();
        this.scheduledMessages = [];
        this.communicationLog = [];
        this.clientProfiles = new Map();
        this.initializeTemplates();
    }

    initializeTemplates() {
        // Project status update templates
        this.templates.set('status_update', {
            subject: 'Project Update - {{project_name}}',
            body: `Hi {{client_name}},

Here's the weekly update for {{project_name}}:

✅ **Completed This Week:**
{{completed_tasks}}

🔄 **In Progress:**
{{in_progress_tasks}}

📅 **Next Week Goals:**
{{next_week_goals}}

⏰ **Timeline Status:** {{timeline_status}}
💰 **Budget Status:** {{budget_status}}

{{additional_notes}}

Best regards,
{{freelancer_name}}`
        });

        // Project delivery template
        this.templates.set('delivery', {
            subject: '🎉 {{project_name}} - Delivery Complete',
            body: `Hi {{client_name}},

Exciting news! I've completed {{project_name}} and it's ready for your review.

📦 **Deliverables:**
{{deliverables_list}}

🔗 **Access Links:**
{{access_links}}

📋 **Next Steps:**
1. Please review the deliverables
2. Test functionality in your environment  
3. Share feedback within {{review_timeline}}
4. I'll address any revisions needed

⭐ **Post-Launch Support:**
{{support_details}}

Thank you for your trust in this project!

Best regards,
{{freelancer_name}}`
        });

        // Invoice template
        this.templates.set('invoice', {
            subject: 'Invoice #{{invoice_number}} - {{project_name}}',
            body: `Hi {{client_name}},

Please find attached invoice #{{invoice_number}} for {{project_name}}.

📊 **Invoice Details:**
- Period: {{billing_period}}
- Hours: {{total_hours}}
- Rate: ${{hourly_rate}}/hour
- Total: ${{total_amount}}

💳 **Payment Details:**
- Due Date: {{due_date}}
- Payment Method: {{payment_method}}
- Terms: {{payment_terms}}

📄 **Work Summary:**
{{work_summary}}

Thank you for your business!

Best regards,
{{freelancer_name}}`
        });

        // Follow-up templates
        this.templates.set('follow_up', {
            subject: 'Following up on {{project_name}}',
            body: `Hi {{client_name}},

I wanted to follow up on {{follow_up_context}}.

{{follow_up_message}}

Please let me know if you need any clarification or have questions.

Looking forward to hearing from you!

Best regards,
{{freelancer_name}}`
        });

        // Upsell template
        this.templates.set('upsell', {
            subject: '💡 Enhancement Opportunity for {{project_name}}',
            body: `Hi {{client_name}},

Great news about {{project_name}}! Based on the success we've achieved, I have some ideas that could add even more value:

🚀 **Enhancement Opportunities:**
{{enhancement_list}}

💰 **Investment & ROI:**
- Estimated effort: {{estimated_hours}} hours
- Investment: ${{estimated_cost}}
- Expected benefits: {{roi_benefits}}

📅 **Timeline:**
{{timeline_estimate}}

Would you like to discuss these opportunities? I'm happy to provide more details.

Best regards,
{{freelancer_name}}`
        });
    }

    // Generate personalized message
    generateMessage(templateName, clientId, variables) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        const clientProfile = this.clientProfiles.get(clientId);
        
        // Merge client profile with provided variables
        const allVariables = {
            ...clientProfile,
            ...variables,
            freelancer_name: variables.freelancer_name || 'Your Freelancer'
        };

        // Replace template variables
        let subject = template.subject;
        let body = template.body;

        Object.entries(allVariables).forEach(([key, value]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            subject = subject.replace(regex, value || `[${key}]`);
            body = body.replace(regex, value || `[${key}]`);
        });

        return {
            to: clientProfile?.email || '[email]',
            subject,
            body,
            template: templateName,
            clientId,
            generated: new Date()
        };
    }

    // Set client communication preferences
    setClientProfile(clientId, profile) {
        this.clientProfiles.set(clientId, {
            ...profile,
            lastContact: new Date(),
            communicationStyle: profile.communicationStyle || 'professional',
            preferredFrequency: profile.preferredFrequency || 'weekly',
            timezone: profile.timezone || 'UTC'
        });
    }

    // Schedule automated follow-ups
    scheduleFollowUp(clientId, projectName, days = 3, context = 'project status') {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + days);

        const scheduledMessage = {
            id: `followup_${Date.now()}`,
            clientId,
            type: 'follow_up',
            scheduledDate: followUpDate,
            variables: {
                project_name: projectName,
                follow_up_context: context,
                follow_up_message: this.getContextualFollowUpMessage(context)
            },
            status: 'scheduled'
        };

        this.scheduledMessages.push(scheduledMessage);
        
        console.log(`📅 Follow-up scheduled for ${clientId} on ${followUpDate.toLocaleDateString()}`);
        return scheduledMessage.id;
    }

    getContextualFollowUpMessage(context) {
        const messages = {
            'project status': 'I wanted to check in on the project progress and see if you have any questions or need clarification on anything.',
            'feedback': 'I\'d love to hear your thoughts on the deliverables. Any feedback would be greatly appreciated.',
            'payment': 'I wanted to follow up on the invoice sent last week. Please let me know if you need any additional information.',
            'proposal': 'I wanted to check if you had a chance to review the proposal I sent. I\'m happy to discuss any questions you might have.',
            'upsell': 'I hope the project is performing well! I had some additional ideas that might interest you.'
        };

        return messages[context] || 'I wanted to touch base and see how things are going.';
    }

    // Automatic status update generation
    generateStatusUpdate(clientId, projectName, completedTasks, inProgressTasks, nextGoals, timelineStatus = 'On track', budgetStatus = 'Within budget') {
        const variables = {
            project_name: projectName,
            completed_tasks: this.formatTaskList(completedTasks),
            in_progress_tasks: this.formatTaskList(inProgressTasks),
            next_week_goals: this.formatTaskList(nextGoals),
            timeline_status: timelineStatus,
            budget_status: budgetStatus,
            additional_notes: this.getTimelineMessage(timelineStatus)
        };

        return this.generateMessage('status_update', clientId, variables);
    }

    formatTaskList(tasks) {
        if (!Array.isArray(tasks)) return tasks || 'None specified';
        
        return tasks.map(task => `• ${task}`).join('\n');
    }

    getTimelineMessage(status) {
        const messages = {
            'On track': 'Everything is progressing smoothly as planned.',
            'Ahead of schedule': 'Great news! We\'re ahead of the original timeline.',
            'Minor delay': 'There\'s a small delay, but it won\'t impact the final delivery date.',
            'Significant delay': 'We\'ve encountered some challenges that will affect the timeline. Let me know when you\'re available to discuss.'
        };

        return messages[status] || '';
    }

    // Process scheduled messages
    processScheduledMessages() {
        const now = new Date();
        const dueMessages = this.scheduledMessages.filter(
            msg => msg.status === 'scheduled' && msg.scheduledDate <= now
        );

        dueMessages.forEach(msg => {
            const message = this.generateMessage(msg.type, msg.clientId, msg.variables);
            
            // Log the communication
            this.logCommunication(msg.clientId, msg.type, 'automated');
            
            // Mark as sent
            msg.status = 'sent';
            msg.sentDate = now;
            
            console.log(`📧 Automated message sent to ${msg.clientId}: ${message.subject}`);
        });

        return dueMessages.length;
    }

    // Log communication for tracking
    logCommunication(clientId, type, method = 'manual', notes = '') {
        this.communicationLog.push({
            clientId,
            type,
            method,
            timestamp: new Date(),
            notes
        });

        // Update client profile last contact
        if (this.clientProfiles.has(clientId)) {
            this.clientProfiles.get(clientId).lastContact = new Date();
        }
    }

    // Get communication frequency analysis
    getCommunicationAnalysis(clientId) {
        const clientLogs = this.communicationLog.filter(log => log.clientId === clientId);
        
        if (clientLogs.length < 2) {
            return { frequency: 'insufficient_data', recommendation: 'Continue regular communication' };
        }

        // Calculate average days between communications
        const intervals = [];
        for (let i = 1; i < clientLogs.length; i++) {
            const days = (clientLogs[i].timestamp - clientLogs[i-1].timestamp) / (1000 * 60 * 60 * 24);
            intervals.push(days);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        
        let frequency, recommendation;
        
        if (avgInterval < 3) {
            frequency = 'high';
            recommendation = 'Good communication frequency, maintain current level';
        } else if (avgInterval < 7) {
            frequency = 'moderate';
            recommendation = 'Optimal communication frequency for most clients';
        } else if (avgInterval < 14) {
            frequency = 'low';
            recommendation = 'Consider increasing communication frequency for better engagement';
        } else {
            frequency = 'very_low';
            recommendation = 'Increase communication frequency to maintain client relationship';
        }

        return {
            frequency,
            avgInterval: Math.round(avgInterval),
            totalCommunications: clientLogs.length,
            recommendation,
            lastContact: Math.max(...clientLogs.map(log => log.timestamp))
        };
    }

    // OpenClaw integration - send message via session
    async sendMessage(message, sessionKey = null) {
        const formattedMessage = `📧 **Draft Email**

**To:** ${message.to}
**Subject:** ${message.subject}

---

${message.body}

---

*Generated via Cortex Freelancer communication automation*`;

        if (sessionKey) {
            console.log(`Sending to session: ${sessionKey}`);
            return formattedMessage;
        } else {
            console.log(formattedMessage);
            return formattedMessage;
        }
    }

    // Bulk status update for multiple clients
    generateBulkStatusUpdates(projects) {
        const updates = [];
        
        projects.forEach(project => {
            try {
                const update = this.generateStatusUpdate(
                    project.clientId,
                    project.name,
                    project.completedTasks,
                    project.inProgressTasks,
                    project.nextGoals,
                    project.timelineStatus,
                    project.budgetStatus
                );
                
                updates.push(update);
            } catch (error) {
                console.error(`Failed to generate update for ${project.name}: ${error.message}`);
            }
        });

        return updates;
    }

    // Get overdue communications
    getOverdueCommunications() {
        const overdue = [];
        
        this.clientProfiles.forEach((profile, clientId) => {
            if (!profile.lastContact) return;
            
            const daysSinceContact = (new Date() - profile.lastContact) / (1000 * 60 * 60 * 24);
            const frequencyDays = this.getFrequencyDays(profile.preferredFrequency);
            
            if (daysSinceContact > frequencyDays) {
                overdue.push({
                    clientId,
                    daysSinceContact: Math.round(daysSinceContact),
                    preferredFrequency: profile.preferredFrequency,
                    urgency: daysSinceContact > frequencyDays * 2 ? 'high' : 'medium'
                });
            }
        });

        return overdue.sort((a, b) => b.daysSinceContact - a.daysSinceContact);
    }

    getFrequencyDays(frequency) {
        const frequencies = {
            'daily': 1,
            'every_other_day': 2,
            'weekly': 7,
            'biweekly': 14,
            'monthly': 30
        };
        
        return frequencies[frequency] || 7;
    }
}

module.exports = { ClientCommunication };