/**
 * Gmail API Integration for Cortex Freelancer
 * Handles email automation, template management, and OAuth 2.0
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GmailService {
    constructor() {
        this.scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.modify'
        ];
        
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );
        
        this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    }

    /**
     * Generate OAuth 2.0 authorization URL
     */
    generateAuthUrl(userId) {
        const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
        
        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.scopes,
            state: state,
            prompt: 'consent'
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code, userId) {
        try {
            const { tokens } = await this.oauth2Client.getAccessToken(code);
            
            // Store tokens securely (in production, encrypt these)
            await this.storeUserTokens(userId, tokens);
            
            this.oauth2Client.setCredentials(tokens);
            
            return {
                success: true,
                tokens: tokens
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Set user credentials for Gmail API
     */
    async setUserCredentials(userId) {
        try {
            const tokens = await this.getUserTokens(userId);
            
            if (!tokens) {
                throw new Error('No tokens found for user');
            }
            
            this.oauth2Client.setCredentials(tokens);
            
            // Refresh token if needed
            if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
                const { credentials } = await this.oauth2Client.refreshAccessToken();
                await this.storeUserTokens(userId, credentials);
                this.oauth2Client.setCredentials(credentials);
            }
            
            return true;
        } catch (error) {
            console.error('Error setting user credentials:', error);
            return false;
        }
    }

    /**
     * Send email using Gmail API
     */
    async sendEmail(userId, emailData) {
        try {
            const credentialsSet = await this.setUserCredentials(userId);
            if (!credentialsSet) {
                throw new Error('Gmail authentication required');
            }

            const { to, subject, body, attachments = [] } = emailData;
            
            // Create email message
            const email = this.createEmailMessage(to, subject, body, attachments);
            
            const response = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: email
                }
            });
            
            return {
                success: true,
                messageId: response.data.id,
                threadId: response.data.threadId
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create properly formatted email message
     */
    createEmailMessage(to, subject, body, attachments = []) {
        const boundary = 'cortex_boundary_' + Date.now();
        
        let email = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/mixed; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            'Content-Transfer-Encoding: quoted-printable',
            '',
            this.encodeQuotedPrintable(body),
            ''
        ].join('\r\n');
        
        // Add attachments if any
        attachments.forEach(attachment => {
            email += [
                `--${boundary}`,
                `Content-Type: ${attachment.mimeType}`,
                'Content-Transfer-Encoding: base64',
                `Content-Disposition: attachment; filename="${attachment.filename}"`,
                '',
                attachment.data, // Should be base64 encoded
                ''
            ].join('\r\n');
        });
        
        email += `--${boundary}--`;
        
        return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    }

    /**
     * Encode text as quoted-printable
     */
    encodeQuotedPrintable(text) {
        return text
            .replace(/[^\x09\x20\x21-\x3C\x3E-\x7E]/g, (match) => {
                const hex = match.charCodeAt(0).toString(16).toUpperCase();
                return `=${hex.length === 1 ? '0' + hex : hex}`;
            })
            .replace(/(.{75})/g, '$1=\r\n');
    }

    /**
     * Get user's Gmail profile
     */
    async getProfile(userId) {
        try {
            const credentialsSet = await this.setUserCredentials(userId);
            if (!credentialsSet) {
                throw new Error('Gmail authentication required');
            }

            const response = await this.gmail.users.getProfile({
                userId: 'me'
            });
            
            return {
                success: true,
                profile: {
                    emailAddress: response.data.emailAddress,
                    messagesTotal: response.data.messagesTotal,
                    threadsTotal: response.data.threadsTotal,
                    historyId: response.data.historyId
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get recent emails
     */
    async getRecentEmails(userId, maxResults = 10) {
        try {
            const credentialsSet = await this.setUserCredentials(userId);
            if (!credentialsSet) {
                throw new Error('Gmail authentication required');
            }

            const response = await this.gmail.users.messages.list({
                userId: 'me',
                maxResults: maxResults,
                q: 'in:inbox'
            });
            
            const messages = [];
            
            if (response.data.messages) {
                for (const message of response.data.messages) {
                    const details = await this.gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                        format: 'metadata',
                        metadataHeaders: ['From', 'Subject', 'Date']
                    });
                    
                    const headers = details.data.payload.headers;
                    const from = headers.find(h => h.name === 'From')?.value;
                    const subject = headers.find(h => h.name === 'Subject')?.value;
                    const date = headers.find(h => h.name === 'Date')?.value;
                    
                    messages.push({
                        id: message.id,
                        threadId: message.threadId,
                        from: from,
                        subject: subject,
                        date: new Date(date),
                        snippet: details.data.snippet
                    });
                }
            }
            
            return {
                success: true,
                messages: messages
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                messages: []
            };
        }
    }

    /**
     * Send email from template
     */
    async sendFromTemplate(userId, templateId, templateData, to, subject = null) {
        try {
            const template = this.getEmailTemplate(templateId);
            
            if (!template) {
                throw new Error('Template not found');
            }
            
            // Replace template variables
            let body = template.body;
            let emailSubject = subject || template.subject;
            
            Object.keys(templateData).forEach(key => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                body = body.replace(regex, templateData[key]);
                emailSubject = emailSubject.replace(regex, templateData[key]);
            });
            
            return await this.sendEmail(userId, {
                to,
                subject: emailSubject,
                body
            });
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get email template by ID
     */
    getEmailTemplate(templateId) {
        const templates = {
            'proposal_followup': {
                subject: 'Following up on {{jobTitle}} proposal',
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Hi {{clientName}},</p>
                        
                        <p>I hope this email finds you well. I wanted to follow up on the proposal I submitted for your <strong>{{jobTitle}}</strong> project.</p>
                        
                        <p>I'm very excited about the opportunity to work with you on this project because:</p>
                        <ul>
                            <li>{{reason1}}</li>
                            <li>{{reason2}}</li>
                            <li>{{reason3}}</li>
                        </ul>
                        
                        <p>I'd love to discuss your project in more detail and answer any questions you might have. Would you be available for a brief call this week?</p>
                        
                        <p>Looking forward to hearing from you!</p>
                        
                        <p>Best regards,<br>
                        {{freelancerName}}<br>
                        {{freelancerTitle}}<br>
                        {{freelancerContact}}</p>
                    </div>
                `
            },
            
            'project_started': {
                subject: 'Project kickoff - {{projectName}}',
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Hi {{clientName}},</p>
                        
                        <p>Thank you for choosing me for your <strong>{{projectName}}</strong> project! I'm excited to get started.</p>
                        
                        <p><strong>Project Overview:</strong></p>
                        <ul>
                            <li><strong>Start Date:</strong> {{startDate}}</li>
                            <li><strong>Estimated Completion:</strong> {{estimatedCompletion}}</li>
                            <li><strong>Total Investment:</strong> {{totalBudget}}</li>
                        </ul>
                        
                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>{{nextStep1}}</li>
                            <li>{{nextStep2}}</li>
                            <li>{{nextStep3}}</li>
                        </ol>
                        
                        <p>I'll provide regular updates on progress and will reach out if I need any clarification or additional information.</p>
                        
                        <p>Thanks again for this opportunity!</p>
                        
                        <p>Best regards,<br>
                        {{freelancerName}}</p>
                    </div>
                `
            },
            
            'milestone_completed': {
                subject: '{{projectName}} - Milestone {{milestoneNumber}} Completed',
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Hi {{clientName}},</p>
                        
                        <p>Great news! I've completed <strong>Milestone {{milestoneNumber}}</strong> for your {{projectName}} project.</p>
                        
                        <p><strong>What was delivered:</strong></p>
                        <ul>
                            <li>{{deliverable1}}</li>
                            <li>{{deliverable2}}</li>
                            <li>{{deliverable3}}</li>
                        </ul>
                        
                        <p><strong>Next milestone:</strong> {{nextMilestone}}</p>
                        <p><strong>Expected completion:</strong> {{nextMilestoneDate}}</p>
                        
                        <p>Please review the deliverables and let me know if you have any feedback or questions.</p>
                        
                        <p>{{additionalNotes}}</p>
                        
                        <p>Best regards,<br>
                        {{freelancerName}}</p>
                    </div>
                `
            },
            
            'project_completed': {
                subject: '{{projectName}} - Project Completed Successfully! 🎉',
                body: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Hi {{clientName}},</p>
                        
                        <p>I'm thrilled to announce that your <strong>{{projectName}}</strong> project has been completed successfully!</p>
                        
                        <p><strong>Project Summary:</strong></p>
                        <ul>
                            <li><strong>Duration:</strong> {{projectDuration}}</li>
                            <li><strong>Deliverables:</strong> {{totalDeliverables}}</li>
                            <li><strong>Total Investment:</strong> {{finalBudget}}</li>
                        </ul>
                        
                        <p><strong>Final deliverables include:</strong></p>
                        <ul>
                            <li>{{finalDeliverable1}}</li>
                            <li>{{finalDeliverable2}}</li>
                            <li>{{finalDeliverable3}}</li>
                        </ul>
                        
                        <p>It's been a pleasure working with you on this project. I hope the results exceed your expectations!</p>
                        
                        <p>If you need any future assistance or have other projects in mind, please don't hesitate to reach out.</p>
                        
                        <p>Thank you for your trust and collaboration!</p>
                        
                        <p>Best regards,<br>
                        {{freelancerName}}<br>
                        {{freelancerTitle}}</p>
                    </div>
                `
            }
        };
        
        return templates[templateId] || null;
    }

    /**
     * Store user tokens securely
     */
    async storeUserTokens(userId, tokens) {
        // In production, encrypt tokens before storing
        const FirebaseAuthService = require('../auth/firebase-auth');
        const authService = new FirebaseAuthService();
        
        return await authService.updateUserProfile(userId, {
            gmailTokens: tokens,
            gmailConnected: true,
            gmailConnectedAt: new Date()
        });
    }

    /**
     * Get stored user tokens
     */
    async getUserTokens(userId) {
        const FirebaseAuthService = require('../auth/firebase-auth');
        const authService = new FirebaseAuthService();
        
        const profile = await authService.getUserProfile(userId);
        return profile?.gmailTokens || null;
    }

    /**
     * Disconnect Gmail integration
     */
    async disconnectGmail(userId) {
        try {
            const FirebaseAuthService = require('../auth/firebase-auth');
            const authService = new FirebaseAuthService();
            
            await authService.updateUserProfile(userId, {
                gmailTokens: null,
                gmailConnected: false,
                gmailConnectedAt: null
            });
            
            return {
                success: true,
                message: 'Gmail integration disconnected'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Health check for Gmail API
     */
    async healthCheck(userId) {
        try {
            const profile = await this.getProfile(userId);
            
            return {
                success: profile.success,
                status: profile.success ? 'connected' : 'disconnected',
                email: profile.success ? profile.profile.emailAddress : null
            };
        } catch (error) {
            return {
                success: false,
                status: 'disconnected',
                error: error.message
            };
        }
    }
}

module.exports = GmailService;