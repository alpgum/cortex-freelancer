/**
 * Template Library
 * 
 * Pre-built onboarding templates for different client types with
 * customizable content and automated personalization.
 */

import { OnboardingStep, OnboardingStepType, OnboardingStepStatus } from './sequences';

export enum ClientType {
  ENTERPRISE = 'enterprise',
  SMB = 'smb',
  INDIVIDUAL = 'individual',
  STARTUP = 'startup',
  AGENCY = 'agency'
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  variables: string[]; // Available template variables
  attachments?: {
    name: string;
    path: string;
    required: boolean;
  }[];
}

export interface QuestionnaireTemplate {
  id: string;
  name: string;
  description: string;
  sections: QuestionnaireSection[];
  conditional: boolean; // Shows questions based on previous answers
  estimatedTime: number; // Minutes
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  showIf?: {
    questionId: string;
    value: any;
  };
}

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'boolean' | 'file';
  required: boolean;
  options?: string[]; // For select/multiselect
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
  };
  helpText?: string;
  placeholder?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'contract' | 'proposal' | 'brief' | 'sow' | 'faq';
  content: string;
  variables: string[];
  sections: {
    id: string;
    title: string;
    content: string;
    editable: boolean;
  }[];
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  clientType: ClientType;
  projectTypes: string[]; // e.g., ['web_development', 'mobile_app', 'consulting']
  steps: Partial<OnboardingStep>[];
  emailTemplates: { [stepId: string]: string }; // Map step to email template ID
  questionnaireTemplates: { [stepId: string]: string };
  documentTemplates: { [stepId: string]: string };
  estimatedDuration: number; // Days
  successCriteria: string[];
}

export class TemplateLibrary {
  private emailTemplates: Map<string, EmailTemplate> = new Map();
  private questionnaireTemplates: Map<string, QuestionnaireTemplate> = new Map();
  private documentTemplates: Map<string, DocumentTemplate> = new Map();
  private onboardingTemplates: Map<string, OnboardingTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  // Get template for specific client type
  getTemplateForClient(clientType: ClientType, projectType?: string): OnboardingTemplate {
    // Find matching template
    const templates = Array.from(this.onboardingTemplates.values())
      .filter(template => template.clientType === clientType);
    
    if (projectType) {
      const projectSpecific = templates.find(template => 
        template.projectTypes.includes(projectType)
      );
      if (projectSpecific) return projectSpecific;
    }
    
    // Return general template for client type
    return templates[0] || this.getDefaultTemplate();
  }

  // Get email template
  getEmailTemplate(templateId: string): EmailTemplate | undefined {
    return this.emailTemplates.get(templateId);
  }

  // Get questionnaire template
  getQuestionnaireTemplate(templateId: string): QuestionnaireTemplate | undefined {
    return this.questionnaireTemplates.get(templateId);
  }

  // Get document template
  getDocumentTemplate(templateId: string): DocumentTemplate | undefined {
    return this.documentTemplates.get(templateId);
  }

  // Add custom email template
  addEmailTemplate(template: EmailTemplate): void {
    this.emailTemplates.set(template.id, template);
  }

  // Add custom questionnaire template
  addQuestionnaireTemplate(template: QuestionnaireTemplate): void {
    this.questionnaireTemplates.set(template.id, template);
  }

  // Add custom document template
  addDocumentTemplate(template: DocumentTemplate): void {
    this.documentTemplates.set(template.id, template);
  }

  // Add custom onboarding template
  addOnboardingTemplate(template: OnboardingTemplate): void {
    this.onboardingTemplates.set(template.id, template);
  }

  // Personalize template content
  personalizeContent(template: string, variables: Record<string, any>): string {
    let personalized = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      personalized = personalized.replace(placeholder, String(value));
    });
    
    return personalized;
  }

  // Generate personalized email
  generatePersonalizedEmail(
    templateId: string, 
    clientData: any
  ): { subject: string; htmlBody: string; textBody?: string } | null {
    const template = this.emailTemplates.get(templateId);
    if (!template) return null;

    const variables = this.extractVariables(clientData);
    
    return {
      subject: this.personalizeContent(template.subject, variables),
      htmlBody: this.personalizeContent(template.htmlBody, variables),
      textBody: template.textBody ? this.personalizeContent(template.textBody, variables) : undefined
    };
  }

  // Generate personalized questionnaire
  generatePersonalizedQuestionnaire(
    templateId: string,
    clientData: any
  ): QuestionnaireTemplate | null {
    const template = this.questionnaireTemplates.get(templateId);
    if (!template) return null;

    // Clone template and personalize
    const personalized = JSON.parse(JSON.stringify(template));
    const variables = this.extractVariables(clientData);

    // Personalize question text and help text
    personalized.sections.forEach((section: QuestionnaireSection) => {
      section.title = this.personalizeContent(section.title, variables);
      if (section.description) {
        section.description = this.personalizeContent(section.description, variables);
      }

      section.questions.forEach((question: Question) => {
        question.text = this.personalizeContent(question.text, variables);
        if (question.helpText) {
          question.helpText = this.personalizeContent(question.helpText, variables);
        }
        if (question.placeholder) {
          question.placeholder = this.personalizeContent(question.placeholder, variables);
        }
      });
    });

    return personalized;
  }

  private initializeDefaultTemplates(): void {
    // Initialize email templates
    this.initializeEmailTemplates();
    
    // Initialize questionnaire templates
    this.initializeQuestionnaireTemplates();
    
    // Initialize document templates
    this.initializeDocumentTemplates();
    
    // Initialize onboarding templates
    this.initializeOnboardingTemplates();
  }

  private initializeEmailTemplates(): void {
    // Welcome email template
    this.emailTemplates.set('welcome-standard', {
      id: 'welcome-standard',
      name: 'Standard Welcome Email',
      subject: 'Welcome to {{ freelancerName }}! Let\'s get started on {{ projectName }}',
      htmlBody: `
        <h2>Welcome, {{ clientName }}!</h2>
        
        <p>Thank you for choosing me for {{ projectName }}. I'm excited to work with you and deliver exceptional results.</p>
        
        <h3>What's Next?</h3>
        <ol>
          <li>Complete the project questionnaire (link below)</li>
          <li>Review and approve the project brief</li>
          <li>Sign the project contract</li>
          <li>Process initial payment</li>
          <li>Schedule our kickoff meeting</li>
        </ol>
        
        <p><a href="{{ questionnaireLink }}" style="background-color: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Questionnaire</a></p>
        
        <p>If you have any questions, feel free to reply to this email or call me at {{ phoneNumber }}.</p>
        
        <p>Best regards,<br>{{ freelancerName }}</p>
      `,
      textBody: `
        Welcome, {{ clientName }}!
        
        Thank you for choosing me for {{ projectName }}. I'm excited to work with you and deliver exceptional results.
        
        What's Next?
        1. Complete the project questionnaire: {{ questionnaireLink }}
        2. Review and approve the project brief
        3. Sign the project contract
        4. Process initial payment
        5. Schedule our kickoff meeting
        
        If you have any questions, feel free to reply to this email or call me at {{ phoneNumber }}.
        
        Best regards,
        {{ freelancerName }}
      `,
      variables: ['clientName', 'projectName', 'freelancerName', 'phoneNumber', 'questionnaireLink']
    });

    // Questionnaire reminder
    this.emailTemplates.set('questionnaire-reminder', {
      id: 'questionnaire-reminder',
      name: 'Questionnaire Reminder',
      subject: 'Quick reminder: {{ projectName }} questionnaire pending',
      htmlBody: `
        <p>Hi {{ clientName }},</p>
        
        <p>I wanted to follow up on the project questionnaire for {{ projectName }}. Completing this will help me understand your requirements better and ensure we deliver exactly what you need.</p>
        
        <p><a href="{{ questionnaireLink }}" style="background-color: #007cba; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Complete Questionnaire (5 minutes)</a></p>
        
        <p>If you're having any issues or have questions about the questionnaire, please let me know.</p>
        
        <p>Thanks!<br>{{ freelancerName }}</p>
      `,
      variables: ['clientName', 'projectName', 'freelancerName', 'questionnaireLink']
    });

    // Contract ready
    this.emailTemplates.set('contract-ready', {
      id: 'contract-ready',
      name: 'Contract Ready for Signature',
      subject: '{{ projectName }} contract ready for your signature',
      htmlBody: `
        <p>Hi {{ clientName }},</p>
        
        <p>Great news! Based on your questionnaire responses, I've prepared your project contract for {{ projectName }}.</p>
        
        <h3>Project Summary:</h3>
        <ul>
          <li>Timeline: {{ timeline }}</li>
          <li>Investment: {{ budget }}</li>
          <li>Deliverables: {{ deliverables }}</li>
        </ul>
        
        <p><a href="{{ contractLink }}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Review & Sign Contract</a></p>
        
        <p>The contract includes all the details we discussed, plus my standard terms and payment schedule. If you have any questions or need modifications, please let me know.</p>
        
        <p>Once signed, we'll process the initial payment and schedule our kickoff meeting.</p>
        
        <p>Best regards,<br>{{ freelancerName }}</p>
      `,
      variables: ['clientName', 'projectName', 'freelancerName', 'timeline', 'budget', 'deliverables', 'contractLink']
    });
  }

  private initializeQuestionnaireTemplates(): void {
    // Standard project questionnaire
    this.questionnaireTemplates.set('standard-project', {
      id: 'standard-project',
      name: 'Standard Project Questionnaire',
      description: 'Comprehensive questionnaire for most project types',
      conditional: true,
      estimatedTime: 10,
      sections: [
        {
          id: 'basic-info',
          title: 'Basic Information',
          questions: [
            {
              id: 'project-name',
              text: 'What would you like to call this project?',
              type: 'text',
              required: true,
              placeholder: 'e.g., Company Website Redesign'
            },
            {
              id: 'project-type',
              text: 'What type of project is this?',
              type: 'select',
              required: true,
              options: ['Website Development', 'Mobile App', 'Branding', 'Consulting', 'Other']
            },
            {
              id: 'timeline',
              text: 'What\'s your ideal timeline?',
              type: 'select',
              required: true,
              options: ['ASAP (Rush job)', '2-4 weeks', '1-2 months', '2-3 months', '3+ months', 'Flexible']
            }
          ]
        },
        {
          id: 'requirements',
          title: 'Project Requirements',
          questions: [
            {
              id: 'objectives',
              text: 'What are your main objectives for this project?',
              type: 'textarea',
              required: true,
              helpText: 'Describe what you want to achieve and why this project is important'
            },
            {
              id: 'target-audience',
              text: 'Who is your target audience?',
              type: 'textarea',
              required: true,
              helpText: 'Describe your ideal customers/users'
            },
            {
              id: 'existing-assets',
              text: 'Do you have existing brand assets (logo, colors, fonts, etc.)?',
              type: 'boolean',
              required: true
            }
          ]
        },
        {
          id: 'budget-timeline',
          title: 'Budget & Timeline',
          questions: [
            {
              id: 'budget-range',
              text: 'What\'s your budget range for this project?',
              type: 'select',
              required: true,
              options: ['Under $5,000', '$5,000 - $10,000', '$10,000 - $25,000', '$25,000 - $50,000', '$50,000+']
            },
            {
              id: 'deadline',
              text: 'Do you have a hard deadline?',
              type: 'date',
              required: false
            }
          ]
        }
      ]
    });

    // Enterprise questionnaire
    this.questionnaireTemplates.set('enterprise-detailed', {
      id: 'enterprise-detailed',
      name: 'Enterprise Project Questionnaire',
      description: 'Detailed questionnaire for enterprise clients',
      conditional: true,
      estimatedTime: 20,
      sections: [
        {
          id: 'company-info',
          title: 'Company Information',
          questions: [
            {
              id: 'company-size',
              text: 'How many employees does your company have?',
              type: 'select',
              required: true,
              options: ['1-10', '11-50', '51-200', '201-1000', '1000+']
            },
            {
              id: 'industry',
              text: 'What industry are you in?',
              type: 'text',
              required: true
            },
            {
              id: 'stakeholders',
              text: 'Who are the key stakeholders for this project?',
              type: 'textarea',
              required: true,
              helpText: 'Include names, roles, and decision-making authority'
            }
          ]
        }
        // Additional enterprise-specific sections...
      ]
    });
  }

  private initializeDocumentTemplates(): void {
    // Standard contract template
    this.documentTemplates.set('standard-contract', {
      id: 'standard-contract',
      name: 'Standard Service Contract',
      type: 'contract',
      content: 'Standard contract template content...',
      variables: ['clientName', 'projectName', 'totalAmount', 'timeline'],
      sections: [
        {
          id: 'scope',
          title: 'Scope of Work',
          content: 'Project scope details...',
          editable: true
        },
        {
          id: 'timeline',
          title: 'Timeline & Milestones',
          content: 'Project timeline...',
          editable: true
        },
        {
          id: 'payment',
          title: 'Payment Terms',
          content: 'Payment schedule and terms...',
          editable: true
        }
      ]
    });

    // Project brief template
    this.documentTemplates.set('project-brief', {
      id: 'project-brief',
      name: 'Project Brief Template',
      type: 'brief',
      content: 'Project brief template content...',
      variables: ['clientName', 'projectName', 'objectives', 'deliverables'],
      sections: [
        {
          id: 'overview',
          title: 'Project Overview',
          content: 'High-level project description...',
          editable: true
        },
        {
          id: 'deliverables',
          title: 'Deliverables',
          content: 'List of project deliverables...',
          editable: true
        }
      ]
    });
  }

  private initializeOnboardingTemplates(): void {
    // Standard SMB template
    this.onboardingTemplates.set('smb-standard', {
      id: 'smb-standard',
      name: 'SMB Standard Onboarding',
      description: 'Streamlined onboarding for small-medium businesses',
      clientType: ClientType.SMB,
      projectTypes: ['web_development', 'branding', 'consulting'],
      estimatedDuration: 7,
      successCriteria: [
        'Questionnaire completed within 48 hours',
        'Contract signed within 5 days',
        'Payment processed within 24 hours of signing',
        'Kickoff meeting scheduled within 7 days'
      ],
      steps: [], // Would be populated with actual steps
      emailTemplates: {
        'welcome': 'welcome-standard',
        'questionnaire-followup': 'questionnaire-reminder',
        'contract': 'contract-ready'
      },
      questionnaireTemplates: {
        'intake': 'standard-project'
      },
      documentTemplates: {
        'contract': 'standard-contract',
        'brief': 'project-brief'
      }
    });

    // Enterprise template
    this.onboardingTemplates.set('enterprise-comprehensive', {
      id: 'enterprise-comprehensive',
      name: 'Enterprise Comprehensive Onboarding',
      description: 'Detailed onboarding for enterprise clients',
      clientType: ClientType.ENTERPRISE,
      projectTypes: ['web_development', 'mobile_app', 'consulting', 'digital_transformation'],
      estimatedDuration: 14,
      successCriteria: [
        'Detailed requirements gathered within 1 week',
        'Stakeholder alignment achieved',
        'Contract negotiated and signed within 2 weeks',
        'Project kickoff with all stakeholders'
      ],
      steps: [], // Would be populated with actual steps
      emailTemplates: {
        'welcome': 'welcome-standard',
        'questionnaire-followup': 'questionnaire-reminder',
        'contract': 'contract-ready'
      },
      questionnaireTemplates: {
        'intake': 'enterprise-detailed'
      },
      documentTemplates: {
        'contract': 'enterprise-contract',
        'brief': 'project-brief'
      }
    });
  }

  private extractVariables(clientData: any): Record<string, any> {
    return {
      clientName: clientData.name || 'Valued Client',
      companyName: clientData.company || '',
      projectName: clientData.projectName || 'Your Project',
      freelancerName: 'John Doe', // Would come from config
      phoneNumber: '+1 (555) 123-4567', // Would come from config
      timeline: clientData.timeline || 'To be determined',
      budget: clientData.budget || 'To be determined',
      deliverables: clientData.deliverables || 'As specified in project brief',
      questionnaireLink: `https://forms.example.com/questionnaire/${clientData.id}`,
      contractLink: `https://contracts.example.com/sign/${clientData.id}`
    };
  }

  private getDefaultTemplate(): OnboardingTemplate {
    return this.onboardingTemplates.get('smb-standard')!;
  }

  // List all available templates
  listTemplates(): {
    onboarding: OnboardingTemplate[];
    emails: EmailTemplate[];
    questionnaires: QuestionnaireTemplate[];
    documents: DocumentTemplate[];
  } {
    return {
      onboarding: Array.from(this.onboardingTemplates.values()),
      emails: Array.from(this.emailTemplates.values()),
      questionnaires: Array.from(this.questionnaireTemplates.values()),
      documents: Array.from(this.documentTemplates.values())
    };
  }

  // Clone template for customization
  cloneTemplate(templateId: string, newId: string, newName: string): OnboardingTemplate | null {
    const original = this.onboardingTemplates.get(templateId);
    if (!original) return null;

    const cloned: OnboardingTemplate = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      name: newName
    };

    this.onboardingTemplates.set(newId, cloned);
    return cloned;
  }
}