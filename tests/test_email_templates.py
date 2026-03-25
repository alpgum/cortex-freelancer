#!/usr/bin/env python3
"""
Comprehensive test suite for Email Templates system
Tests all template categories, tone optimization, personalization, and follow-up sequences.
"""

import unittest
import json
import os
import sys
from unittest.mock import patch, MagicMock

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'tools'))

from email_templates import (
    EmailTemplateEngine, 
    ToneType, 
    TemplateCategory, 
    Platform,
    ClientContext,
    ProjectContext, 
    EmailContext,
    ToneMetrics
)


class TestEmailTemplateEngine(unittest.TestCase):
    """Test the core email template engine"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.engine = EmailTemplateEngine()
        
        # Sample client contexts
        self.new_client = ClientContext(
            name="John Smith",
            company="TechStartup Inc",
            relationship_stage="new",
            communication_style="professional"
        )
        
        self.established_client = ClientContext(
            name="Sarah Johnson", 
            company="Johnson & Associates",
            relationship_stage="established",
            communication_style="friendly",
            project_count=5,
            payment_history="prompt"
        )
        
        self.problematic_client = ClientContext(
            name="Mike Wilson",
            company="Wilson Corp",
            relationship_stage="ongoing", 
            payment_history="problematic"
        )
        
        # Sample project contexts
        self.website_project = ProjectContext(
            title="Website Redesign",
            type="website",
            budget=5000,
            deadline="2024-04-30",
            status="proposed"
        )
        
        self.app_project = ProjectContext(
            title="Mobile App Development", 
            type="app",
            budget=15000,
            deadline="2024-06-15",
            status="active",
            completion_percentage=60
        )


class TestTemplateGeneration(TestEmailTemplateEngine):
    """Test email template generation for all categories"""
    
    def test_proposal_generation_new_client(self):
        """Test proposal email for new client"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PROPOSAL, 
            context, 
            ToneType.PROFESSIONAL,
            Platform.EMAIL
        )
        
        # Verify output structure
        self.assertIsInstance(result.subject_line, str)
        self.assertIsInstance(result.body, str) 
        self.assertIsInstance(result.subject_alternatives, list)
        self.assertEqual(result.tone, ToneType.PROFESSIONAL)
        
        # Verify personalization
        self.assertIn(self.new_client.name, result.body)
        self.assertIn(self.website_project.title, result.body)
        
        # Verify subject line alternatives
        self.assertGreater(len(result.subject_alternatives), 0)
        self.assertTrue(all(isinstance(alt, str) for alt in result.subject_alternatives))
    
    def test_followup_generation_established_client(self):
        """Test follow-up email for established client"""
        context = EmailContext(
            client=self.established_client,
            project=self.app_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.FOLLOWUP,
            context,
            ToneType.FRIENDLY, 
            Platform.EMAIL
        )
        
        # Verify friendly tone in content (established clients get casual greeting)
        self.assertIn(self.established_client.name, result.body)
        self.assertNotIn("Dear", result.body)
        
        # Verify established client template used
        self.assertIn(self.established_client.name, result.body)
    
    def test_payment_reminder_escalation(self):
        """Test payment reminder with firm tone for problematic client"""
        context = EmailContext(
            client=self.problematic_client,
            custom_fields={
                'invoice_number': 'INV-2024-001',
                'amount': '2500',
                'due_date': '2024-03-15'
            }
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PAYMENT_REMINDER,
            context,
            ToneType.FIRM,
            Platform.EMAIL
        )
        
        # Verify payment details included
        self.assertIn('INV-2024-001', result.body)
        self.assertIn('2500', result.body)
        self.assertIn('2024-03-15', result.body)
        
        # Verify firm tone
        self.assertIn('must', result.body.lower() + result.subject_line.lower())
    
    def test_project_update_with_progress(self):
        """Test project update email with completion percentage"""
        context = EmailContext(
            client=self.established_client,
            project=self.app_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PROJECT_UPDATE,
            context,
            ToneType.FRIENDLY,
            Platform.EMAIL
        )
        
        # Verify progress percentage included
        self.assertIn('60', result.body)
        self.assertIn('%', result.body)
        
        # Verify project details
        self.assertIn(self.app_project.title, result.body)
    
    def test_all_template_categories(self):
        """Test that all template categories generate valid emails"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project,
            custom_fields={'invoice_number': 'INV-001', 'amount': '1000'}
        )
        
        for category in TemplateCategory:
            with self.subTest(category=category.value):
                result = self.engine.generate_email(
                    category,
                    context,
                    ToneType.PROFESSIONAL,
                    Platform.EMAIL
                )
                
                # Basic validation
                self.assertIsInstance(result.subject_line, str)
                self.assertIsInstance(result.body, str)
                self.assertGreater(len(result.subject_line), 0)
                self.assertGreater(len(result.body), 50)  # Minimum meaningful length
                self.assertEqual(result.tone, ToneType.PROFESSIONAL)


class TestToneOptimization(TestEmailTemplateEngine):
    """Test tone optimization and auto-suggestion"""
    
    def test_tone_auto_suggestion_by_category(self):
        """Test automatic tone suggestion based on email category"""
        context = EmailContext(client=self.new_client)
        
        # Payment reminders should suggest firm tone
        tone = self.engine._suggest_tone(TemplateCategory.PAYMENT_REMINDER, context)
        self.assertEqual(tone, ToneType.FIRM)
        
        # Thank you notes should suggest friendly tone
        tone = self.engine._suggest_tone(TemplateCategory.THANK_YOU, context)
        self.assertEqual(tone, ToneType.FRIENDLY)
        
        # Proposals should suggest professional tone
        tone = self.engine._suggest_tone(TemplateCategory.PROPOSAL, context)
        self.assertEqual(tone, ToneType.PROFESSIONAL)
    
    def test_tone_adjustment_by_relationship(self):
        """Test tone adjustment based on client relationship stage"""
        
        # New client context
        new_context = EmailContext(client=self.new_client)
        tone = self.engine._suggest_tone(TemplateCategory.FOLLOWUP, new_context)
        
        # Established client context  
        established_context = EmailContext(client=self.established_client)
        established_tone = self.engine._suggest_tone(TemplateCategory.FOLLOWUP, established_context)
        
        # Should be same or more casual for established clients
        self.assertIn(established_tone, [ToneType.FRIENDLY, ToneType.CASUAL])
    
    def test_urgency_tone_override(self):
        """Test urgent context overrides other tone suggestions"""
        context = EmailContext(
            client=self.new_client,
            urgency_level="urgent"
        )
        
        tone = self.engine._suggest_tone(TemplateCategory.FOLLOWUP, context)
        self.assertEqual(tone, ToneType.URGENT)
    
    def test_tone_pattern_application(self):
        """Test that tone patterns are properly applied"""
        context = EmailContext(client=self.new_client, project=self.website_project)
        
        # Generate professional vs friendly versions
        professional = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context, 
            ToneType.PROFESSIONAL
        )
        
        friendly = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context,
            ToneType.FRIENDLY
        )
        
        # Verify tone differences
        self.assertNotEqual(professional.body, friendly.body)
        
        # Professional should use formal language
        prof_indicators = ['Dear', 'Best regards', 'I would like', 'Thank you for']
        self.assertTrue(any(indicator in professional.body for indicator in prof_indicators))
        
        # Friendly should use casual language  
        friendly_indicators = ['Hi', 'I\'d love', 'Excited', 'Thanks']
        self.assertTrue(any(indicator in friendly.body for indicator in friendly_indicators))


class TestPersonalization(TestEmailTemplateEngine):
    """Test personalization and merge field functionality"""
    
    def test_basic_personalization_fields(self):
        """Test basic client and project personalization"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context
        )
        
        # Verify client personalization
        self.assertIn(self.new_client.name, result.body)
        # Note: company name may not appear in all templates
        
        # Verify project personalization
        self.assertIn(self.website_project.title, result.body)
        self.assertIn(self.website_project.type, result.body)
    
    def test_custom_fields_integration(self):
        """Test custom fields merge into templates"""
        custom_fields = {
            'previous_project': 'Logo Design',
            'completion_date': '2024-05-15',
            'special_requirements': 'SEO optimization'
        }
        
        context = EmailContext(
            client=self.established_client,
            project=self.website_project,
            custom_fields=custom_fields
        )
        
        # Add custom template with custom field
        template = "We completed {previous_project} and now working on {project_title}. Due date: {completion_date}."
        personalized = self.engine._apply_personalization(template, context)
        
        # Verify custom fields were replaced
        self.assertIn('Logo Design', personalized)
        self.assertIn('2024-05-15', personalized)
        self.assertNotIn('{previous_project}', personalized)
    
    def test_missing_field_handling(self):
        """Test graceful handling of missing personalization fields"""
        context = EmailContext(
            client=ClientContext(name="John"),  # Minimal client
            project=None  # No project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.FOLLOWUP,
            context
        )
        
        # Should not crash and should have default replacements
        self.assertIsInstance(result.body, str)
        self.assertGreater(len(result.body), 0)
        # Should not have unreplaced template variables
        self.assertNotIn('{client_company}', result.body)
    
    def test_budget_formatting(self):
        """Test budget amount formatting in templates"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project  # Has budget of 5000
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context
        )
        
        # Should format budget with currency
        self.assertIn('5,000', result.body)  # Comma formatting
        self.assertIn('$', result.body)  # Currency symbol


class TestFollowUpSequences(TestEmailTemplateEngine):
    """Test follow-up sequence generation and escalation logic"""
    
    def test_follow_up_sequence_generation(self):
        """Test generation of complete follow-up sequence"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        sequence = self.engine.generate_follow_up_sequence(
            TemplateCategory.FOLLOWUP,
            context,
            [1, 3, 7, 14]
        )
        
        # Verify sequence length
        self.assertEqual(len(sequence), 4)
        
        # Verify escalation logic
        self.assertEqual(sequence[0].tone, ToneType.FRIENDLY)      # Day 1
        self.assertEqual(sequence[1].tone, ToneType.PROFESSIONAL)  # Day 3
        self.assertEqual(sequence[2].tone, ToneType.PROFESSIONAL)  # Day 7
        self.assertEqual(sequence[3].tone, ToneType.FIRM)          # Day 14
    
    def test_payment_reminder_escalation(self):
        """Test payment reminder sequence escalation"""
        context = EmailContext(
            client=self.problematic_client,
            custom_fields={
                'invoice_number': 'INV-2024-001',
                'amount': '2500'
            }
        )
        
        sequence = self.engine.generate_follow_up_sequence(
            TemplateCategory.PAYMENT_REMINDER,
            context,
            [1, 7, 14]
        )
        
        # Verify increasing urgency
        day1_urgency = sequence[0].tone_metrics.urgency
        day14_urgency = sequence[2].tone_metrics.urgency
        
        self.assertGreater(day14_urgency, day1_urgency)
    
    def test_sequence_context_modification(self):
        """Test that follow-up sequence modifies context appropriately"""
        context = EmailContext(
            client=self.new_client,
            urgency_level="normal"
        )
        
        # Generate a day 14 follow-up
        follow_up_context = EmailContext(
            client=context.client,
            project=context.project,
            custom_fields=context.custom_fields,
            urgency_level="high",  # Should escalate
            follow_up_sequence=True,
            sequence_day=14
        )
        
        result = self.engine.generate_email(
            TemplateCategory.FOLLOWUP,
            follow_up_context,
            ToneType.FIRM
        )
        
        # Should reflect urgency in content
        urgency_indicators = ['final', 'last', 'closing', 'urgent', 'immediate']
        self.assertTrue(any(indicator in result.body.lower() for indicator in urgency_indicators))


class TestPlatformOptimization(TestEmailTemplateEngine):
    """Test platform-specific optimizations"""
    
    def test_upwork_optimization(self):
        """Test Upwork platform constraints"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context,
            ToneType.PROFESSIONAL,
            Platform.UPWORK
        )
        
        # Should be shorter for Upwork
        self.assertLess(len(result.body), 1200)  # Upwork max ~1000 chars
        
        # Should not have external links
        self.assertNotIn('http', result.body)
        self.assertNotIn('www.', result.body)
    
    def test_linkedin_optimization(self):
        """Test LinkedIn platform constraints"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.COLD_OUTREACH,
            context,
            ToneType.CASUAL,
            Platform.LINKEDIN
        )
        
        # Should be very short for LinkedIn
        self.assertLess(len(result.body), 400)
        
        # Should force professional tone even if casual requested
        self.assertNotIn('Hey', result.body)  # Should convert to professional greeting
    
    def test_email_platform_full_features(self):
        """Test email platform supports all features"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context,
            ToneType.PROFESSIONAL,
            Platform.EMAIL
        )
        
        # Email should support full content
        self.assertGreater(len(result.body), 200)  # Can be longer
        self.assertTrue(result.follow_up_suggestions)  # Has follow-up suggestions


class TestToneAnalyzer(TestEmailTemplateEngine):
    """Test the tone analyzer functionality"""
    
    def test_tone_metrics_calculation(self):
        """Test tone metrics scoring"""
        # Professional email text
        professional_text = """
        Dear Mr. Johnson,
        
        Thank you for your consideration. I appreciate the opportunity to work with you.
        Please find the attached proposal for your review.
        
        I look forward to your response.
        
        Best regards,
        John
        """
        
        metrics = self.engine.analyze_existing_email(professional_text)
        
        # Verify metrics structure
        self.assertIsInstance(metrics, ToneMetrics)
        self.assertIsInstance(metrics.professionalism, float)
        self.assertIsInstance(metrics.warmth, float)
        self.assertIsInstance(metrics.clarity, float)
        self.assertIsInstance(metrics.confidence, float)
        self.assertIsInstance(metrics.urgency, float)
        
        # Professional text should score high on professionalism
        self.assertGreater(metrics.professionalism, 0.3)
    
    def test_urgent_tone_detection(self):
        """Test detection of urgent tone in existing emails"""
        urgent_text = """
        URGENT: Payment Required Immediately
        
        Your payment is now 30 days overdue. Please send payment ASAP or we will need to 
        take immediate action. This is critical and requires your urgent attention.
        """
        
        metrics = self.engine.analyze_existing_email(urgent_text)
        
        # Should score high on urgency
        self.assertGreater(metrics.urgency, 0.5)
    
    def test_warmth_detection(self):
        """Test detection of warmth/friendliness in emails"""
        warm_text = """
        Hi Sarah!
        
        I'm so excited to work with you on this project! It's going to be wonderful.
        I love collaborating with great clients like you. Looking forward to creating 
        something amazing together!
        
        Thanks,
        John
        """
        
        metrics = self.engine.analyze_existing_email(warm_text)
        
        # Should score high on warmth
        self.assertGreater(metrics.warmth, 0.3)
    
    def test_clarity_scoring(self):
        """Test clarity scoring based on sentence complexity"""
        # Clear, simple text
        clear_text = "Hi John. Thanks for your email. I can help you. Let me know if you have questions."
        
        # Complex, unclear text
        complex_text = """
        I am writing to inform you that, pursuant to our previous correspondence regarding 
        the aforementioned project deliverables, and notwithstanding the various 
        complications that have arisen in connection therewith, I believe we should 
        consider alternative methodological approaches to achieve the desired outcomes.
        """
        
        clear_metrics = self.engine.analyze_existing_email(clear_text)
        complex_metrics = self.engine.analyze_existing_email(complex_text)
        
        # Clear text should score higher on clarity
        self.assertGreater(clear_metrics.clarity, complex_metrics.clarity)


class TestTimingSuggestions(TestEmailTemplateEngine):
    """Test email timing suggestions"""
    
    def test_timing_suggestions_by_platform(self):
        """Test platform-specific timing recommendations"""
        context = EmailContext(client=self.new_client)
        
        # Test email timing
        email_timing = self.engine.suggest_send_timing(context, Platform.EMAIL)
        self.assertIn('recommended_timing', email_timing)
        self.assertIn('next_send_window', email_timing)
        
        # Test Upwork timing  
        upwork_timing = self.engine.suggest_send_timing(context, Platform.UPWORK)
        self.assertIn('recommended_timing', upwork_timing)
        
        # Different platforms should have different optimal times
        self.assertNotEqual(
            email_timing['recommended_timing']['best_hours'],
            upwork_timing['recommended_timing']['best_hours']
        )
    
    def test_urgency_override(self):
        """Test urgent emails override timing recommendations"""
        urgent_context = EmailContext(
            client=self.new_client,
            urgency_level="urgent"
        )
        
        timing = self.engine.suggest_send_timing(urgent_context)
        
        # Should recommend immediate sending
        self.assertTrue(timing.get('urgency_override', False))
    
    def test_relationship_timing_adjustment(self):
        """Test timing adjustments based on relationship stage"""
        new_context = EmailContext(client=self.new_client)  # New client
        established_context = EmailContext(client=self.established_client)  # Established
        
        new_timing = self.engine.suggest_send_timing(new_context)
        established_timing = self.engine.suggest_send_timing(established_context)
        
        # Both should have timing recommendations
        self.assertIn('recommended_timing', new_timing)
        self.assertIn('recommended_timing', established_timing)


class TestEdgeCases(TestEmailTemplateEngine):
    """Test edge cases and error handling"""
    
    def test_minimal_context(self):
        """Test generation with minimal context information"""
        minimal_client = ClientContext(name="Test")
        minimal_context = EmailContext(client=minimal_client)
        
        # Should not crash with minimal context
        result = self.engine.generate_email(
            TemplateCategory.FOLLOWUP,
            minimal_context
        )
        
        self.assertIsInstance(result.subject_line, str)
        self.assertIsInstance(result.body, str)
        self.assertGreater(len(result.body), 0)
    
    def test_empty_custom_fields(self):
        """Test handling of empty custom fields"""
        context = EmailContext(
            client=self.new_client,
            custom_fields={}
        )
        
        # Should handle empty custom fields gracefully
        result = self.engine.generate_email(
            TemplateCategory.PAYMENT_REMINDER,
            context
        )
        
        self.assertIsInstance(result.body, str)
    
    def test_very_long_client_name(self):
        """Test handling of unusually long client names"""
        long_name_client = ClientContext(
            name="John Jacob Jingleheimer Schmidt-Anderson von Trapp III",
            company="Very Long Company Name International Incorporated LLC"
        )
        
        context = EmailContext(client=long_name_client)
        
        result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context,
            platform=Platform.LINKEDIN  # Short platform
        )
        
        # Should still fit platform constraints
        self.assertLess(len(result.body), 400)
    
    def test_unicode_handling(self):
        """Test handling of unicode characters in names and content"""
        unicode_client = ClientContext(
            name="José María García-López",
            company="Nuñez & Associés"
        )
        
        context = EmailContext(client=unicode_client)
        
        result = self.engine.generate_email(
            TemplateCategory.THANK_YOU,
            context
        )
        
        # Should preserve unicode characters
        self.assertIn("José", result.body)
        self.assertIn("García-López", result.body)


class TestResponseRateEstimation(TestEmailTemplateEngine):
    """Test response rate estimation algorithm"""
    
    def test_response_rate_by_category(self):
        """Test response rate varies appropriately by email category"""
        context = EmailContext(client=self.new_client)
        
        # Payment reminders should have high response rate
        payment_result = self.engine.generate_email(
            TemplateCategory.PAYMENT_REMINDER,
            context
        )
        
        # Cold outreach should have low response rate
        outreach_result = self.engine.generate_email(
            TemplateCategory.COLD_OUTREACH,
            context
        )
        
        self.assertGreater(
            payment_result.estimated_response_rate,
            outreach_result.estimated_response_rate
        )
    
    def test_response_rate_by_relationship(self):
        """Test response rate increases with relationship strength"""
        new_context = EmailContext(client=self.new_client)
        established_context = EmailContext(client=self.established_client)
        
        new_result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            new_context
        )
        
        established_result = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            established_context
        )
        
        # Established clients should have higher response rates
        self.assertGreater(
            established_result.estimated_response_rate,
            new_result.estimated_response_rate
        )
    
    def test_response_rate_bounds(self):
        """Test response rate estimates are within reasonable bounds"""
        context = EmailContext(client=self.new_client)
        
        for category in TemplateCategory:
            result = self.engine.generate_email(category, context)
            
            # Should be between 1% and 95%
            self.assertGreaterEqual(result.estimated_response_rate, 0.01)
            self.assertLessEqual(result.estimated_response_rate, 0.95)


class TestIntegration(TestEmailTemplateEngine):
    """Integration tests for complete workflows"""
    
    def test_complete_proposal_workflow(self):
        """Test complete proposal generation and follow-up workflow"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        # 1. Generate initial proposal
        proposal = self.engine.generate_email(
            TemplateCategory.PROPOSAL,
            context
        )
        
        self.assertIsInstance(proposal.subject_line, str)
        self.assertIn(self.new_client.name, proposal.body)
        
        # 2. Generate follow-up sequence
        followups = self.engine.generate_follow_up_sequence(
            TemplateCategory.FOLLOWUP,
            context
        )
        
        self.assertEqual(len(followups), 4)  # Default sequence
        
        # 3. Verify escalation pattern
        tones = [email.tone for email in followups]
        self.assertEqual(tones[0], ToneType.FRIENDLY)
        self.assertEqual(tones[-1], ToneType.FIRM)
    
    def test_payment_collection_workflow(self):
        """Test complete payment collection workflow"""
        context = EmailContext(
            client=self.problematic_client,
            custom_fields={
                'invoice_number': 'INV-2024-001',
                'amount': '2500',
                'due_date': '2024-03-01'
            }
        )
        
        # Generate escalating payment reminders
        sequence = self.engine.generate_follow_up_sequence(
            TemplateCategory.PAYMENT_REMINDER,
            context,
            [1, 7, 14, 30]
        )
        
        # Verify escalation
        urgency_scores = [email.tone_metrics.urgency for email in sequence]
        
        # Should increase over time
        self.assertGreater(urgency_scores[1], urgency_scores[0])
        self.assertGreater(urgency_scores[2], urgency_scores[1])
        self.assertGreater(urgency_scores[3], urgency_scores[2])
    
    def test_client_onboarding_to_updates(self):
        """Test workflow from onboarding through project updates"""
        context = EmailContext(
            client=self.new_client,
            project=self.website_project
        )
        
        # 1. Onboarding email
        onboarding = self.engine.generate_email(
            TemplateCategory.CLIENT_ONBOARDING,
            context
        )
        
        self.assertIn("welcome", onboarding.body.lower())
        self.assertIn("get started", onboarding.body.lower())
        
        # 2. Project update emails at different stages
        for progress in [25, 50, 75]:
            update_context = EmailContext(
                client=context.client,
                project=ProjectContext(
                    title=self.website_project.title,
                    type=self.website_project.type,
                    completion_percentage=progress
                )
            )
            
            update = self.engine.generate_email(
                TemplateCategory.PROJECT_UPDATE,
                update_context
            )
            
            self.assertIn(str(progress), update.body)
        
        # 3. Thank you email at completion
        completion_context = EmailContext(
            client=context.client,
            project=ProjectContext(
                title=self.website_project.title,
                type=self.website_project.type,
                status="completed"
            )
        )
        
        thanks = self.engine.generate_email(
            TemplateCategory.THANK_YOU,
            completion_context
        )
        
        self.assertIn("thank", thanks.body.lower())


if __name__ == '__main__':
    # Create test runner with detailed output
    unittest.main(verbosity=2)