#!/usr/bin/env python3
"""
Email Templates with Context-Aware Generation and Tone Optimization
Comprehensive email template system for freelancers with smart context awareness.
"""

import json
import re
import datetime
from typing import Dict, List, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import random


class ToneType(Enum):
    """Email tone types with scoring attributes"""
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"  
    FIRM = "firm"
    CASUAL = "casual"
    URGENT = "urgent"


class TemplateCategory(Enum):
    """Email template categories"""
    PROPOSAL = "proposal"
    FOLLOWUP = "followup"
    PAYMENT_REMINDER = "payment_reminder"
    PROJECT_UPDATE = "project_update"
    CLIENT_ONBOARDING = "client_onboarding"
    SCOPE_CHANGE = "scope_change"
    TESTIMONIAL_REQUEST = "testimonial_request"
    COLD_OUTREACH = "cold_outreach"
    THANK_YOU = "thank_you"
    REJECTION_RESPONSE = "rejection_response"


class Platform(Enum):
    """Communication platforms with formatting constraints"""
    EMAIL = "email"
    UPWORK = "upwork"
    LINKEDIN = "linkedin"
    SLACK = "slack"


@dataclass
class ClientContext:
    """Client relationship context"""
    name: str
    company: Optional[str] = None
    relationship_stage: str = "new"  # new, ongoing, established, dormant
    communication_style: str = "professional"  # professional, casual, formal
    payment_history: str = "unknown"  # prompt, delayed, problematic, unknown
    project_count: int = 0
    last_contact: Optional[str] = None
    preferred_platform: str = "email"


@dataclass
class ProjectContext:
    """Project-specific context"""
    title: str
    type: str  # website, app, design, writing, consulting, etc.
    budget: Optional[float] = None
    currency: str = "USD"
    deadline: Optional[str] = None
    status: str = "proposed"  # proposed, active, completed, paused
    completion_percentage: int = 0
    milestone: Optional[str] = None


@dataclass
class EmailContext:
    """Complete email generation context"""
    client: ClientContext
    project: Optional[ProjectContext] = None
    custom_fields: Optional[Dict[str, Any]] = None
    urgency_level: str = "normal"  # low, normal, high, urgent
    follow_up_sequence: bool = False
    sequence_day: int = 1


@dataclass
class ToneMetrics:
    """Tone analysis scoring"""
    professionalism: float  # 0-1
    warmth: float          # 0-1  
    clarity: float         # 0-1
    confidence: float      # 0-1
    urgency: float        # 0-1
    
    
@dataclass
class EmailOutput:
    """Generated email with metadata"""
    subject_line: str
    body: str
    subject_alternatives: List[str]
    tone: ToneType
    platform_optimized: Platform
    estimated_response_rate: float
    tone_metrics: ToneMetrics
    follow_up_suggestions: List[str]


class EmailTemplateEngine:
    """Core email template generation engine"""
    
    def __init__(self):
        self.templates = self._load_template_library()
        self.tone_patterns = self._load_tone_patterns()
        self.platform_constraints = self._load_platform_constraints()
    
    def generate_email(self, category: TemplateCategory, context: EmailContext, 
                      tone: Optional[ToneType] = None, platform: Platform = Platform.EMAIL) -> EmailOutput:
        """Generate context-aware email with tone optimization"""
        
        # Auto-suggest tone if not provided
        if tone is None:
            tone = self._suggest_tone(category, context)
        
        # Get base template
        base_template = self._get_template(category, context.client.relationship_stage)
        
        # Apply context personalization
        personalized_content = self._apply_personalization(base_template, context)
        
        # Optimize for tone
        tone_optimized = self._optimize_tone(personalized_content, tone, context)
        
        # Platform-specific optimization
        platform_optimized = self._optimize_for_platform(tone_optimized, platform)
        
        # Generate subject lines
        subject_line, alternatives = self._generate_subject_lines(category, context, tone)
        
        # Analyze tone metrics
        tone_metrics = self._analyze_tone_metrics(platform_optimized['body'])
        
        # Generate follow-up suggestions
        follow_ups = self._generate_follow_up_suggestions(category, context, tone)
        
        return EmailOutput(
            subject_line=subject_line,
            body=platform_optimized['body'],
            subject_alternatives=alternatives,
            tone=tone,
            platform_optimized=platform,
            estimated_response_rate=self._estimate_response_rate(category, context, tone_metrics),
            tone_metrics=tone_metrics,
            follow_up_suggestions=follow_ups
        )
    
    def analyze_existing_email(self, email_text: str) -> ToneMetrics:
        """Analyze tone of existing email draft"""
        return self._analyze_tone_metrics(email_text)
    
    def generate_follow_up_sequence(self, category: TemplateCategory, context: EmailContext, 
                                  days: List[int] = [1, 3, 7, 14]) -> List[EmailOutput]:
        """Generate escalating follow-up sequence"""
        sequence = []
        
        for day in days:
            # Escalate tone based on day
            if day == 1:
                tone = ToneType.FRIENDLY
            elif day <= 7:
                tone = ToneType.PROFESSIONAL
            else:
                tone = ToneType.FIRM
            
            # Update context for follow-up
            follow_up_context = EmailContext(
                client=context.client,
                project=context.project,
                custom_fields=context.custom_fields,
                urgency_level="normal" if day <= 3 else "high",
                follow_up_sequence=True,
                sequence_day=day
            )
            
            email = self.generate_email(category, follow_up_context, tone)

            # For payment reminders, progressively increase urgency language across the sequence.
            # This keeps the requested tone escalation for generic follow-ups (tests) while
            # ensuring payment collection becomes more explicit over time.
            if category == TemplateCategory.PAYMENT_REMINDER:
                escalation_lines = []
                if day >= 7:
                    escalation_lines.append("Note: This invoice is now overdue.")
                if day >= 14:
                    escalation_lines.append("Immediate attention is required to resolve this payment.")
                if day >= 30:
                    escalation_lines.append("Payment must be made immediately to avoid further action.")

                if escalation_lines:
                    email.body = (email.body.rstrip() + "\n\n" + "\n".join(escalation_lines)).strip()
                    email.tone_metrics = self._analyze_tone_metrics(email.body)

            sequence.append(email)
        
        return sequence
    
    def suggest_send_timing(self, context: EmailContext, platform: Platform = Platform.EMAIL) -> Dict[str, Any]:
        """Smart timing suggestions for email sending"""
        
        # Platform-specific timing
        platform_timing = {
            Platform.EMAIL: {
                'best_days': ['Tuesday', 'Wednesday', 'Thursday'],
                'best_hours': [9, 10, 11, 14, 15],
                'avoid_hours': [0, 1, 2, 3, 4, 5, 6, 7, 20, 21, 22, 23]
            },
            Platform.UPWORK: {
                'best_days': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                'best_hours': [8, 9, 10, 11, 13, 14, 15, 16],
                'avoid_hours': [17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]
            },
            Platform.LINKEDIN: {
                'best_days': ['Tuesday', 'Wednesday', 'Thursday'],
                'best_hours': [8, 9, 10, 17, 18],
                'avoid_hours': [12, 13, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]
            }
        }
        
        timing = platform_timing.get(platform, platform_timing[Platform.EMAIL])
        
        # Adjust for urgency
        if context.urgency_level == "urgent":
            timing['send_immediately'] = True
        
        # Adjust for relationship stage
        if context.client.relationship_stage == "new":
            timing['wait_hours'] = 2  # Don't seem too eager
        
        return {
            'recommended_timing': timing,
            'next_send_window': self._calculate_next_send_window(timing),
            'urgency_override': context.urgency_level == "urgent"
        }
    
    # Private methods for core functionality
    
    def _load_template_library(self) -> Dict[str, Dict[str, str]]:
        """Load base email templates by category and relationship stage"""
        return {
            'proposal': {
                'new': """Subject: {project_title} - Proposal for {client_name}

Dear {client_name},

Thank you for considering me for your {project_title} project. Based on our conversation, I understand you need {project_summary}.

Here's what I propose:

**Project Scope:**
{scope_details}

**Timeline:** {timeline}
**Investment:** {budget_range}

I've successfully completed {similar_projects_count} similar projects with {success_metric}. You can view my portfolio at {portfolio_link}.

I'd love to discuss this further. Are you available for a brief call this week?

Best regards,
{your_name}""",
                
                'ongoing': """Subject: New Project Proposal - {project_title}

Hi {client_name},

I hope you're doing well! I have an exciting proposal for our next collaboration.

Given our successful work on {previous_project}, I'd like to propose {new_project_summary}.

**What this includes:**
{scope_details}

**Timeline:** {timeline}
**Investment:** {budget_range}

Based on our previous projects, I'm confident this will deliver {expected_outcome}.

When would be a good time to discuss this?

Best,
{your_name}""",
                
                'established': """Subject: {project_title} - Let's make it happen!

{client_name},

Ready for another great project together? 

{project_summary}

**The plan:**
{scope_details}

**Timeline:** {timeline}
**Investment:** {budget_range}

You know my work - let's get started! I can begin as early as {start_date}.

Talk soon,
{your_name}"""
            },
            
            'followup': {
                'new': """Subject: Following up on {project_title} proposal

Hi {client_name},

I hope you're well. I wanted to follow up on the proposal I sent for {project_title}.

Have you had a chance to review it? I'm happy to answer any questions or adjust the scope based on your feedback.

I'm excited about the possibility of working together on this project.

Best regards,
{your_name}""",
                
                'ongoing': """Subject: Checking in on {project_title}

Hi {client_name},

Just checking in on the {project_title} proposal I sent last week.

Is there anything I can clarify or modify to better fit your needs?

Looking forward to hearing from you.

Best,
{your_name}""",
                
                'established': """Subject: {project_title} - Still interested?

{client_name},

Following up on that {project_title} project we discussed.

Ready when you are! Let me know if you'd like to move forward.

{your_name}"""
            },
            
            'payment_reminder': {
                'new': """Subject: Payment Reminder - Invoice #{invoice_number}

Dear {client_name},

I hope this email finds you well. I'm writing to remind you that payment for invoice #{invoice_number} (${amount}) was due on {due_date}.

I understand that oversights happen. If there are any issues with the invoice or payment, please let me know so we can resolve them quickly.

I appreciate your prompt attention to this matter.

Best regards,
{your_name}""",
                
                'ongoing': """Subject: Payment Follow-up - Invoice #{invoice_number}

Hi {client_name},

I wanted to follow up on invoice #{invoice_number} for ${amount}, which was due on {due_date}.

Could you please let me know the status of this payment? If there are any concerns or questions about the invoice, I'm happy to discuss them.

Thanks for your attention to this.

Best,
{your_name}""",
                
                'established': """Subject: Payment Reminder - #{invoice_number}

{client_name},

Quick reminder that invoice #{invoice_number} (${amount}) is now overdue.

Let me know if there's anything I can help clarify.

Thanks,
{your_name}"""
            },
            
            'project_update': {
                'new': """Subject: {project_title} - Progress Update

Dear {client_name},

I wanted to share an update on your {project_title} project.

**Current Progress:** {completion_percentage}% complete

**What's been accomplished:**
{completed_items}

**Next steps:**
{upcoming_tasks}

**Timeline:** On track for {deadline}

Please let me know if you have any questions or feedback.

Best regards,
{your_name}""",
                
                'ongoing': """Subject: {project_title} Update - {milestone}

Hi {client_name},

Quick update on {project_title}:

✓ {completed_items}
→ {upcoming_tasks}

We're {completion_percentage}% done and on track for {deadline}.

Any feedback on the progress so far?

Best,
{your_name}""",
                
                'established': """Subject: {project_title} - {completion_percentage}% Done!

{client_name},

Great progress on {project_title}! We're {completion_percentage}% complete.

Completed: {completed_items}
Up next: {upcoming_tasks}

On track for {deadline}. Looking good!

{your_name}"""
            },
            
            'client_onboarding': {
                'new': """Subject: Welcome! Let's get started on {project_title}

Dear {client_name},

Welcome aboard! Thank you for choosing to work with me on {project_title} — I'm excited to get started.

**Next steps:**
1. {onboarding_step_1}
2. {onboarding_step_2}
3. {onboarding_step_3}

**What I need from you:**
{required_materials}

**Project timeline:**
{milestone_timeline}

**Communication:** I'll send updates every {update_frequency} and am available via {communication_channels}.

Let's make this project a success!

Best regards,
{your_name}""",
                
                'ongoing': """Subject: New Project Kickoff - {project_title}

Hi {client_name},

Excited to start our new project together!

**Getting started:**
{onboarding_steps}

**Timeline:** {project_timeline}

You know the drill - I'll keep you updated every step of the way.

Let's do this!

Best,
{your_name}""",
                
                'established': """Subject: {project_title} - Let's roll!

{client_name},

Ready to kick off {project_title}!

Send me: {required_materials}
Timeline: {project_timeline}

You know I'll keep you in the loop. Let's make this one even better than the last!

{your_name}"""
            },
            
            'scope_change': {
                'new': """Subject: {project_title} - Scope Adjustment Needed

Dear {client_name},

I hope you're well. As we've been working on {project_title}, some additional requirements have come up that fall outside our original scope.

**Original scope:** {original_scope}
**New requirements:** {additional_requirements}

**Impact:**
- Additional time: {additional_time}
- Additional cost: ${additional_cost}
- New timeline: {new_deadline}

I want to ensure we deliver exactly what you need while being transparent about scope changes.

Can we schedule a call to discuss this?

Best regards,
{your_name}""",
                
                'ongoing': """Subject: {project_title} - Scope Update

Hi {client_name},

We need to discuss some scope changes for {project_title}.

**What's changed:** {scope_changes}
**Additional work:** {additional_work}
**Cost impact:** ${additional_cost}

This will add {additional_time} to our timeline but will give you {additional_value}.

Worth discussing?

Best,
{your_name}""",
                
                'established': """Subject: {project_title} - Scope Expansion

{client_name},

Heads up - we've got some scope creep on {project_title}.

New stuff: {additional_requirements}
Extra cost: ${additional_cost}
Extra time: {additional_time}

But it'll be worth it for {additional_value}. Sound good?

{your_name}"""
            },
            
            'testimonial_request': {
                'new': """Subject: Would you mind sharing your experience?

Dear {client_name},

I hope you're thrilled with the {project_title} we recently completed together!

Your feedback would mean the world to me. Would you mind taking a few minutes to share your experience? A brief testimonial helps me continue providing excellent service to clients like yourself.

**What would be helpful:**
- What problem we solved together
- The results you achieved
- Your overall experience working with me

You can reply to this email or leave a review on {review_platform}.

Thank you so much for your time and for being such a wonderful client to work with.

Best regards,
{your_name}""",
                
                'ongoing': """Subject: Quick favor - testimonial request

Hi {client_name},

Hope you're loving the results from {project_title}!

Would you mind writing a quick testimonial about our work together? It would really help me grow my business.

Just a few sentences about:
- The results you got
- Working with me

Thanks in advance!

Best,
{your_name}""",
                
                'established': """Subject: Testimonial request - pretty please!

{client_name},

You know I do great work (we've done {project_count} projects together!).

Mind writing a quick testimonial? Just a few words about working together.

It'd really help me out!

Thanks,
{your_name}"""
            },
            
            'cold_outreach': {
                'new': """Subject: {personalized_subject}

Hi {client_name},

I noticed {personalized_observation} and thought you might be interested in how I helped {similar_client} {achievement}.

I specialize in {expertise_area} and have helped companies like yours {specific_outcome}.

**Quick example:**
{case_study_snippet}

Would you be open to a brief call to discuss how this could work for {client_company}?

Best regards,
{your_name}
{credentials}""",
                
                'ongoing': """Subject: Re: {previous_conversation}

Hi {client_name},

Following up on our previous conversation about {topic}.

I've been thinking about your {challenge} and have some ideas that might help.

Quick call this week?

Best,
{your_name}""",
                
                'established': """Subject: New opportunity for {client_company}

{client_name},

Saw {trigger_event} and thought of you.

This could be perfect for {opportunity_description}.

Interested in exploring this?

{your_name}"""
            },
            
            'thank_you': {
                'new': """Subject: Thank you for choosing me for {project_title}

Dear {client_name},

Thank you so much for entrusting me with {project_title}. It was a pleasure working with you and your team.

I'm proud of what we accomplished together:
{project_achievements}

I hope the results exceed your expectations and contribute to your continued success.

Please don't hesitate to reach out if you need any adjustments or have future projects in mind.

Best regards,
{your_name}""",
                
                'ongoing': """Subject: Thanks for another great project!

Hi {client_name},

Just wanted to say thanks for another successful project together!

{project_title} turned out great, and I'm excited to see how it performs for you.

Looking forward to our next collaboration.

Best,
{your_name}""",
                
                'established': """Subject: Another one in the books!

{client_name},

{project_title} - done and dusted!

As always, it was great working with you. Can't wait for the next one!

{your_name}"""
            },
            
            'rejection_response': {
                'new': """Subject: Thank you for your consideration

Dear {client_name},

Thank you for taking the time to consider me for {project_title}. While I'm disappointed we won't be working together this time, I completely understand your decision.

I appreciate the opportunity to learn about your project and wish you the best of luck with its implementation.

If your needs change or you have future projects where my skills might be a better fit, please don't hesitate to reach out.

Best regards,
{your_name}""",
                
                'ongoing': """Subject: Thanks for the update

Hi {client_name},

Thanks for letting me know about your decision on {project_title}.

I understand the direction you've chosen and respect your choice.

Keep me in mind for future projects - you know I'd love to work with you again!

Best,
{your_name}""",
                
                'established': """Subject: No worries!

{client_name},

All good on the {project_title} decision!

You know where to find me when you need me.

{your_name}"""
            }
        }
    
    def _load_tone_patterns(self) -> Dict[str, Dict[str, List[str]]]:
        """Load tone-specific language patterns"""
        return {
            'professional': {
                'greetings': ['Dear', 'Hello', 'Good morning', 'Good afternoon'],
                'closings': ['Best regards', 'Sincerely', 'Best', 'Kind regards'],
                'phrases': ['I would like to', 'Please find', 'I am writing to', 'Thank you for'],
                'modifiers': ['please', 'kindly', 'greatly appreciate', 'would be happy to']
            },
            'friendly': {
                'greetings': ['Hi', 'Hey', 'Hello'],
                'closings': ['Best', 'Thanks', 'Cheers', 'Talk soon'],
                'phrases': ["I'd love to", "Let's", "Hope you're well", "Excited about"],
                'modifiers': ['really', 'super', 'totally', 'absolutely']
            },
            'firm': {
                'greetings': ['Hello', 'Dear'],
                'closings': ['Regards', 'Best regards', 'Thank you'],
                'phrases': ['I need to', 'Please note', 'It is important', 'I must emphasize'],
                'modifiers': ['must', 'need', 'require', 'expect']
            },
            'casual': {
                'greetings': ['Hey', 'Hi there', 'Hello'],
                'closings': ['Thanks', 'Cheers', 'Talk soon', 'Later'],
                'phrases': ["What's up", "Hope you're doing well", "Just wanted to", "Quick question"],
                'modifiers': ['just', 'pretty', 'kinda', 'totally']
            },
            'urgent': {
                'greetings': ['Hello', 'Hi'],
                'closings': ['Urgently', 'Please respond ASAP', 'Time-sensitive'],
                'phrases': ['Urgent:', 'Time-sensitive', 'Immediate action needed', 'Please prioritize'],
                'modifiers': ['immediately', 'ASAP', 'urgent', 'critical']
            }
        }
    
    def _load_platform_constraints(self) -> Dict[str, Dict[str, Any]]:
        """Load platform-specific formatting constraints"""
        return {
            'email': {
                'max_length': 2000,
                'supports_html': True,
                'supports_attachments': True,
                'signature_required': True
            },
            'upwork': {
                'max_length': 1000,
                'supports_html': False,
                'supports_attachments': False,
                'signature_required': False,
                'avoid_external_links': True
            },
            'linkedin': {
                'max_length': 300,
                'supports_html': False,
                'supports_attachments': False,
                'signature_required': False,
                'professional_tone_only': True
            },
            'slack': {
                'max_length': 4000,
                'supports_html': False,
                'supports_attachments': True,
                'signature_required': False,
                'emoji_friendly': True
            }
        }
    
    def _suggest_tone(self, category: TemplateCategory, context: EmailContext) -> ToneType:
        """Auto-suggest appropriate tone based on context"""
        
        # Base tone suggestions by category
        category_tones = {
            TemplateCategory.PROPOSAL: ToneType.PROFESSIONAL,
            TemplateCategory.FOLLOWUP: ToneType.FRIENDLY,
            TemplateCategory.PAYMENT_REMINDER: ToneType.FIRM,
            TemplateCategory.PROJECT_UPDATE: ToneType.PROFESSIONAL,
            TemplateCategory.CLIENT_ONBOARDING: ToneType.FRIENDLY,
            TemplateCategory.SCOPE_CHANGE: ToneType.PROFESSIONAL,
            TemplateCategory.TESTIMONIAL_REQUEST: ToneType.FRIENDLY,
            TemplateCategory.COLD_OUTREACH: ToneType.PROFESSIONAL,
            TemplateCategory.THANK_YOU: ToneType.FRIENDLY,
            TemplateCategory.REJECTION_RESPONSE: ToneType.PROFESSIONAL
        }
        
        base_tone = category_tones.get(category, ToneType.PROFESSIONAL)
        
        # Adjust based on relationship stage
        if context.client.relationship_stage == "established":
            if base_tone == ToneType.PROFESSIONAL:
                return ToneType.FRIENDLY
            elif base_tone == ToneType.FIRM:
                return ToneType.PROFESSIONAL
        
        # Adjust based on urgency
        if context.urgency_level == "urgent":
            return ToneType.URGENT
        
        # Adjust based on follow-up sequence
        if context.follow_up_sequence:
            if context.sequence_day >= 7:
                return ToneType.FIRM
            elif context.sequence_day >= 3:
                return ToneType.PROFESSIONAL
        
        # Adjust based on payment history for payment reminders
        if category == TemplateCategory.PAYMENT_REMINDER:
            if context.client.payment_history == "problematic":
                return ToneType.FIRM
            elif context.client.payment_history == "delayed":
                return ToneType.PROFESSIONAL
        
        return base_tone
    
    def _get_template(self, category: TemplateCategory, relationship_stage: str) -> str:
        """Get base template for category and relationship stage"""
        category_key = category.value
        stage_key = relationship_stage if relationship_stage in ['new', 'ongoing', 'established'] else 'new'
        
        return self.templates.get(category_key, {}).get(stage_key, 
                                 self.templates.get(category_key, {}).get('new', ''))
    
    def _apply_personalization(self, template: str, context: EmailContext) -> str:
        """Apply context-based personalization to template"""
        
        # Basic client personalization
        personalized = template.replace('{client_name}', context.client.name or 'there')
        personalized = personalized.replace('{client_company}', context.client.company or context.client.name or 'your company')
        
        # Project personalization
        if context.project:
            personalized = personalized.replace('{project_title}', context.project.title or 'your project')
            personalized = personalized.replace('{project_type}', context.project.type or 'project')
            personalized = personalized.replace('{project_summary}', f"a {context.project.type} project")
            
            if context.project.budget:
                personalized = personalized.replace('{budget_range}', f"${context.project.budget:,.0f} {context.project.currency}")
            
            if context.project.deadline:
                personalized = personalized.replace('{deadline}', context.project.deadline)
                personalized = personalized.replace('{timeline}', context.project.deadline)
            
            if context.project.completion_percentage:
                personalized = personalized.replace('{completion_percentage}', str(context.project.completion_percentage))
        
        # Custom fields
        if context.custom_fields:
            for key, value in context.custom_fields.items():
                personalized = personalized.replace(f'{{{key}}}', str(value))
        
        # Default replacements for any remaining placeholders
        default_replacements = {
            '{your_name}': 'Your Name',
            '{portfolio_link}': 'your-portfolio.com',
            '{similar_projects_count}': '10+',
            '{success_metric}': '95% client satisfaction',
            '{start_date}': 'next week',
            '{update_frequency}': 'weekly',
            '{communication_channels}': 'email and Slack'
        }
        
        for placeholder, default in default_replacements.items():
            if placeholder in personalized:
                personalized = personalized.replace(placeholder, default)
        
        return personalized
    
    def _optimize_tone(self, content: str, tone: ToneType, context: EmailContext) -> Dict[str, str]:
        """Optimize content for specific tone"""
        
        tone_patterns = self.tone_patterns.get(tone.value, self.tone_patterns['professional'])
        
        # Split content into subject and body
        lines = content.split('\n')
        subject_line = lines[0].replace('Subject: ', '') if lines[0].startswith('Subject: ') else ''
        body_lines = lines[1:] if subject_line else lines
        body = '\n'.join(body_lines)
        
        # Apply tone adjustments to body
        optimized_body = self._apply_tone_adjustments(body, tone_patterns, tone)
        
        return {
            'subject': subject_line,
            'body': optimized_body
        }
    
    def _apply_tone_adjustments(self, text: str, patterns: Dict[str, List[str]], tone: ToneType) -> str:
        """Apply specific tone adjustments to text"""
        
        # Tone-specific transformations
        if tone == ToneType.PROFESSIONAL:
            # Make more formal
            text = text.replace("I'd love to", 'I would like to')
            text = text.replace('Hi ', 'Dear ')
            text = text.replace('Best,', 'Best regards,')
            text = text.replace('Thanks', 'Thank you')
            
        elif tone == ToneType.FRIENDLY:
            # Add warmth
            text = text.replace('I am writing to', "I'd love to")
            text = text.replace('Please find', 'Here is')
            text = text.replace('I would like to', "I'd like to")
            text = text.replace('Dear ', 'Hi ')
            text = text.replace('Best regards', 'Best')
            text = text.replace('I would', "I'd")
            
        elif tone == ToneType.FIRM:
            # Add authority
            text = text.replace("I'd like to", 'I need to')
            text = text.replace('Could you please', 'Please')
            text = text.replace('Could you', 'Please')  
            text = text.replace('If possible', 'It is important that')
            text = text.replace('I hope', 'I trust')  # Better grammar
            text = text.replace('would appreciate', 'require')
            text = text.replace('let me know', 'provide me with')
            if 'must' not in text.lower():
                text = text.replace('Please provide me with', 'You must provide me with')
            text = text.replace('Thanks for your attention', 'I require your immediate attention')
            # Add final follow-up language for sequences
            if 'follow up' in text.lower() and ('final' not in text.lower()):
                text = text.replace('follow up', 'final follow-up')
            
        elif tone == ToneType.CASUAL:
            # Add informality
            text = text.replace('Dear ', 'Hey ')
            text = text.replace('I am ', "I'm ")
            text = text.replace('I would ', "I'd ")
            text = text.replace('You are ', "You're ")
            
        elif tone == ToneType.URGENT:
            # Add urgency markers
            if not any(urgent_word in text.lower() for urgent_word in ['urgent', 'asap', 'immediate']):
                text = '[URGENT] ' + text
        
        return text
    
    def _optimize_for_platform(self, content: Dict[str, str], platform: Platform) -> Dict[str, str]:
        """Optimize content for specific platform constraints"""
        
        constraints = self.platform_constraints.get(platform.value, {})
        max_length = constraints.get('max_length', 2000)
        
        body = content['body']
        
        # Apply length constraints
        if len(body) > max_length:
            # Truncate while preserving structure
            paragraphs = body.split('\n\n')
            truncated = ''
            for paragraph in paragraphs:
                if len(truncated + paragraph) < max_length - 100:  # Leave room for closing
                    truncated += paragraph + '\n\n'
                else:
                    break
            
            # Add appropriate closing if truncated
            if len(truncated) < len(body):
                truncated += "...\n\n[Message truncated for platform - full details available via email]"
            
            body = truncated
        
        # Platform-specific adjustments
        if platform == Platform.UPWORK:
            # Remove external links
            body = re.sub(r'https?://[^\s]+', '[link removed]', body)
            
        elif platform == Platform.LINKEDIN:
            # Force professional tone
            body = body.replace('Hey ', 'Hello ')
            body = body.replace('Thanks!', 'Thank you.')
            
        elif platform == Platform.SLACK:
            # Make emoji-friendly
            body = body.replace(':)', '😊')
            body = body.replace('!', '! 🚀')
        
        return {
            'subject': content['subject'],
            'body': body.strip()
        }
    
    def _generate_subject_lines(self, category: TemplateCategory, context: EmailContext, tone: ToneType) -> Tuple[str, List[str]]:
        """Generate subject line with A/B variants"""
        
        project_title = context.project.title if context.project else 'your project'
        client_name = context.client.name or 'there'
        
        # Category-specific subject templates
        subject_templates = {
            TemplateCategory.PROPOSAL: [
                f"Proposal: {project_title}",
                f"Your {project_title} project - proposal attached",
                f"Let's discuss {project_title}",
                f"Excited about {project_title}!"
            ],
            TemplateCategory.FOLLOWUP: [
                f"Following up on {project_title}",
                f"Quick check-in about {project_title}",
                f"Any questions about {project_title}?",
                f"Still interested in {project_title}?"
            ],
            TemplateCategory.PAYMENT_REMINDER: [
                f"Payment reminder - Invoice #{(context.custom_fields or {}).get('invoice_number', 'XXX')}",
                f"Overdue invoice #{(context.custom_fields or {}).get('invoice_number', 'XXX')}",
                f"Payment follow-up needed",
                f"Invoice #{(context.custom_fields or {}).get('invoice_number', 'XXX')} - action required"
            ]
        }
        
        templates = subject_templates.get(category, [f"Re: {project_title}"])
        
        # Apply tone modifications
        if tone == ToneType.URGENT:
            templates = [f"URGENT: {template}" for template in templates]
        elif tone == ToneType.FRIENDLY:
            templates = [template.replace('Payment reminder', 'Friendly payment reminder') for template in templates]
        
        # Return primary subject and alternatives
        return templates[0], templates[1:]
    
    def _analyze_tone_metrics(self, text: str) -> ToneMetrics:
        """Analyze tone metrics of text"""
        
        text_lower = text.lower()
        
        # Professionalism indicators
        professional_words = ['please', 'thank you', 'regards', 'sincerely', 'appreciate', 'understand']
        professional_score = sum(1 for word in professional_words if word in text_lower) / len(professional_words)
        
        # Warmth indicators
        warm_words = ['excited', 'love', 'happy', 'great', 'wonderful', 'pleasure', 'looking forward']
        warmth_score = sum(1 for word in warm_words if word in text_lower) / len(warm_words)
        
        # Clarity indicators (sentence length, complexity)
        sentences = text.split('.')
        avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
        clarity_score = min(1.0, max(0.0, (25 - avg_sentence_length) / 25))  # Shorter = clearer
        
        # Confidence indicators
        confident_words = ['will', 'can', 'confident', 'ensure', 'guarantee', 'definitely']
        confidence_score = sum(1 for word in confident_words if word in text_lower) / len(confident_words)
        
        # Urgency indicators
        urgent_words = ['urgent', 'asap', 'immediately', 'immediate', 'now', 'quickly', 'deadline', 'overdue', 'must', 'require']
        urgency_score = sum(1 for word in urgent_words if word in text_lower) / len(urgent_words)
        
        return ToneMetrics(
            professionalism=min(1.0, professional_score),
            warmth=min(1.0, warmth_score),
            clarity=clarity_score,
            confidence=min(1.0, confidence_score),
            urgency=min(1.0, urgency_score)
        )
    
    def _generate_follow_up_suggestions(self, category: TemplateCategory, context: EmailContext, tone: ToneType) -> List[str]:
        """Generate context-aware follow-up suggestions"""
        
        suggestions = []
        
        if category == TemplateCategory.PROPOSAL:
            suggestions = [
                "Follow up in 3-5 business days if no response",
                "Offer to jump on a quick call to discuss",
                "Send portfolio examples relevant to their industry",
                "Provide 2-3 client references upon request"
            ]
            
        elif category == TemplateCategory.FOLLOWUP:
            if context.follow_up_sequence and context.sequence_day >= 7:
                suggestions = [
                    "Consider this the final follow-up",
                    "Move prospect to long-term nurture sequence",
                    "Connect on LinkedIn for future opportunities"
                ]
            else:
                suggestions = [
                    "Wait 1 week before next follow-up",
                    "Try different communication channel",
                    "Offer something of value (free consultation, resource)"
                ]
                
        elif category == TemplateCategory.PAYMENT_REMINDER:
            suggestions = [
                "Follow up in 3 days if no response",
                "Consider calling directly for overdue payments",
                "Implement late fees for future projects",
                "Require deposits for new work if payment issues persist"
            ]
        
        return suggestions
    
    def _estimate_response_rate(self, category: TemplateCategory, context: EmailContext, tone_metrics: ToneMetrics) -> float:
        """Estimate email response rate based on various factors"""
        
        base_rates = {
            TemplateCategory.PROPOSAL: 0.25,
            TemplateCategory.FOLLOWUP: 0.15,
            TemplateCategory.PAYMENT_REMINDER: 0.80,
            TemplateCategory.PROJECT_UPDATE: 0.40,
            TemplateCategory.CLIENT_ONBOARDING: 0.90,
            TemplateCategory.SCOPE_CHANGE: 0.70,
            TemplateCategory.TESTIMONIAL_REQUEST: 0.30,
            TemplateCategory.COLD_OUTREACH: 0.05,
            TemplateCategory.THANK_YOU: 0.20,
            TemplateCategory.REJECTION_RESPONSE: 0.05
        }
        
        base_rate = base_rates.get(category, 0.20)
        
        # Adjust for relationship stage
        relationship_multipliers = {
            'new': 1.0,
            'ongoing': 1.3,
            'established': 1.5,
            'dormant': 0.7
        }
        
        relationship_mult = relationship_multipliers.get(context.client.relationship_stage, 1.0)
        
        # Adjust for tone quality
        tone_quality = (tone_metrics.professionalism + tone_metrics.clarity + tone_metrics.warmth) / 3
        tone_multiplier = 0.7 + (tone_quality * 0.6)  # Range: 0.7 - 1.3
        
        # Adjust for timing and context
        if context.follow_up_sequence:
            sequence_multiplier = max(0.3, 1.0 - (context.sequence_day * 0.1))
        else:
            sequence_multiplier = 1.0
        
        final_rate = base_rate * relationship_mult * tone_multiplier * sequence_multiplier
        return min(0.95, max(0.01, final_rate))  # Cap between 1% and 95%
    
    def _calculate_next_send_window(self, timing: Dict[str, Any]) -> str:
        """Calculate next optimal send window"""
        
        now = datetime.datetime.now()
        best_days = timing['best_days']
        best_hours = timing['best_hours']
        
        # Find next best day
        current_day = now.strftime('%A')
        if current_day in best_days:
            # Check if we're still in a good hour today
            if now.hour in best_hours:
                return "Send now - optimal timing"
            else:
                # Wait for next good hour today or tomorrow
                next_good_hour = min([h for h in best_hours if h > now.hour] + [min(best_hours)])
                if next_good_hour > now.hour:
                    return f"Send today at {next_good_hour}:00"
                else:
                    return f"Send tomorrow at {next_good_hour}:00"
        else:
            # Find next best day
            days_of_week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            current_day_index = days_of_week.index(current_day)
            
            for i in range(1, 8):
                next_day_index = (current_day_index + i) % 7
                next_day = days_of_week[next_day_index]
                if next_day in best_days:
                    optimal_hour = best_hours[0]  # First optimal hour of the day
                    return f"Send {next_day} at {optimal_hour}:00"
        
        return "Send during business hours"


def main():
    """CLI interface for email template engine"""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description="Email Template Generator")
    parser.add_argument('action', choices=['generate', 'analyze', 'sequence', 'timing'], 
                       help='Action to perform')
    parser.add_argument('--category', choices=[c.value for c in TemplateCategory], 
                       help='Email template category')
    parser.add_argument('--context', help='Context JSON string')
    parser.add_argument('--tone', choices=[t.value for t in ToneType], 
                       help='Email tone')
    parser.add_argument('--platform', choices=[p.value for p in Platform], 
                       default='email', help='Target platform')
    parser.add_argument('--text', help='Email text to analyze')
    parser.add_argument('--output', choices=['json', 'text'], default='text', 
                       help='Output format')
    
    args = parser.parse_args()
    
    engine = EmailTemplateEngine()
    
    try:
        if args.action == 'generate':
            if not args.category:
                print("Error: --category required for generate action")
                sys.exit(1)
                
            # Parse context
            context_data = {}
            if args.context:
                context_data = json.loads(args.context)
            
            # Create context objects
            client_data = context_data.get('client', {})
            client = ClientContext(
                name=client_data.get('name', 'Client'),
                company=client_data.get('company'),
                relationship_stage=client_data.get('relationship_stage', 'new'),
                communication_style=client_data.get('communication_style', 'professional'),
                payment_history=client_data.get('payment_history', 'unknown'),
                project_count=client_data.get('project_count', 0)
            )
            
            project = None
            if 'project' in context_data:
                project_data = context_data['project']
                project = ProjectContext(
                    title=project_data.get('title', 'New Project'),
                    type=project_data.get('type', 'project'),
                    budget=project_data.get('budget'),
                    deadline=project_data.get('deadline'),
                    status=project_data.get('status', 'proposed')
                )
            
            context = EmailContext(
                client=client,
                project=project,
                custom_fields=context_data.get('custom_fields', {}),
                urgency_level=context_data.get('urgency_level', 'normal')
            )
            
            # Generate email
            category = TemplateCategory(args.category)
            tone = ToneType(args.tone) if args.tone else None
            platform = Platform(args.platform)
            
            result = engine.generate_email(category, context, tone, platform)
            
            if args.output == 'json':
                # Convert to JSON-serializable format
                output = {
                    'subject_line': result.subject_line,
                    'body': result.body,
                    'subject_alternatives': result.subject_alternatives,
                    'tone': result.tone.value,
                    'platform_optimized': result.platform_optimized.value,
                    'estimated_response_rate': result.estimated_response_rate,
                    'tone_metrics': asdict(result.tone_metrics),
                    'follow_up_suggestions': result.follow_up_suggestions
                }
                print(json.dumps(output, indent=2))
            else:
                print(f"Subject: {result.subject_line}")
                print(f"Tone: {result.tone.value}")
                print(f"Estimated response rate: {result.estimated_response_rate:.1%}")
                print(f"Platform: {result.platform_optimized.value}")
                print("\nBody:")
                print(result.body)
                print(f"\nAlternative subjects:")
                for alt in result.subject_alternatives:
                    print(f"  - {alt}")
        
        elif args.action == 'analyze':
            if not args.text:
                print("Error: --text required for analyze action")
                sys.exit(1)
            
            metrics = engine.analyze_existing_email(args.text)
            
            if args.output == 'json':
                print(json.dumps(asdict(metrics), indent=2))
            else:
                print("Tone Analysis:")
                print(f"  Professionalism: {metrics.professionalism:.1%}")
                print(f"  Warmth: {metrics.warmth:.1%}")
                print(f"  Clarity: {metrics.clarity:.1%}")
                print(f"  Confidence: {metrics.confidence:.1%}")
                print(f"  Urgency: {metrics.urgency:.1%}")
        
        elif args.action == 'sequence':
            # Similar to generate but for sequences
            print("Follow-up sequence generation - implement similar to generate")
        
        elif args.action == 'timing':
            # Timing suggestions
            context_data = json.loads(args.context) if args.context else {}
            client = ClientContext(name=context_data.get('client', {}).get('name', 'Client'))
            context = EmailContext(client=client)
            
            timing = engine.suggest_send_timing(context, Platform(args.platform))
            
            if args.output == 'json':
                print(json.dumps(timing, indent=2))
            else:
                print("Send timing recommendations:")
                print(f"  {timing['next_send_window']}")
                if timing.get('urgency_override'):
                    print("  Note: Urgency override - send immediately")
                    
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()