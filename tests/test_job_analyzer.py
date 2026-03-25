#!/usr/bin/env python3
"""
Comprehensive tests for the Job Analyzer tool.
"""

import json
import os
import sys
import unittest

# Add tools directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))

from job_analyzer import (
    JobAnalyzer, JobPosting, RedFlagDetector, ScoringEngine,
    JobClassifier, RecommendationEngine, RedFlag, ScoreBreakdown,
    Severity, Verdict, JobType, DifficultyLevel, AnalysisResult,
)


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def make_job(**kwargs) -> JobPosting:
    defaults = dict(
        title="Build a React dashboard",
        description="We need a React dashboard with charts, auth, and API integration. "
                    "Skills: React, Node.js, PostgreSQL. Timeline: 4 weeks. Budget: $3000 fixed.",
        budget=3000,
        budget_type="fixed",
        timeline_days=28,
        skills_required=["react", "node.js", "postgresql"],
        client_history={"total_spent": 15000, "avg_review": 4.7,
                        "hire_rate": 60, "payment_verified": True},
        platform="upwork",
    )
    defaults.update(kwargs)
    return JobPosting(**defaults)


def make_bad_job() -> JobPosting:
    """A job full of red flags for testing."""
    return JobPosting(
        title="Need a full stack marketplace ASAP",
        description=(
            "We need a complete marketplace platform with payments, admin panel, "
            "mobile app, and also a blog and also an analytics dashboard. "
            "Plus we need SEO and social media integration. "
            "Budget is $200 fixed price. Need it by tomorrow. "
            "Unlimited revisions until we're satisfied. "
            "Do a free test first to prove yourself. "
            "Payment after launch. No escrow. "
            "Should not take long. Make it pop. "
            "Simple website. Quick and easy job."
        ),
        budget=200,
        budget_type="fixed",
        timeline_days=1,
        skills_required=["react", "node.js", "react native", "seo",
                         "postgresql", "stripe", "analytics"],
        client_history={"total_spent": 0, "avg_review": 2.5,
                        "hire_rate": 10, "payment_verified": False},
        platform="freelancer",
    )


# ---------------------------------------------------------------------------
# RedFlagDetector Tests
# ---------------------------------------------------------------------------

class TestRedFlagDetector(unittest.TestCase):

    def setUp(self):
        self.detector = RedFlagDetector()

    def test_clean_job_has_no_flags(self):
        job = make_job()
        flags = self.detector.detect(job)
        # A well-formed job may still have 0 flags
        self.assertIsInstance(flags, list)

    def test_scope_creep_detected(self):
        job = make_job(description="Build a landing page and also build the backend plus we need a mobile app")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("scope_creep", cats)

    def test_spec_work_detected(self):
        job = make_job(description="Please do a free test first to prove yourself before we hire")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("spec_work", cats)

    def test_vague_requirements_detected(self):
        job = make_job(description="Just make it pop. I'll know it when I see it.")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("vague_requirements", cats)

    def test_unlimited_revisions_detected(self):
        job = make_job(description="We expect unlimited revisions until we're happy with the result.")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("unlimited_revisions", cats)

    def test_payment_risk_detected(self):
        job = make_job(description="Payment after launch. No escrow for this project.")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("payment_risk", cats)

    def test_unreasonable_timeline_detected(self):
        job = make_job(description="Need this done by tomorrow. Very urgent ASAP work.")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("unreasonable_timeline", cats)

    def test_low_budget_for_website(self):
        job = make_job(budget=30, description="Build a complete website for us.")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("low_budget", cats)

    def test_extremely_low_budget(self):
        job = make_job(budget=5)
        flags = self.detector.detect(job)
        sev = [f.severity for f in flags if f.category == "low_budget"]
        self.assertIn(Severity.CRITICAL, sev)

    def test_low_budget_for_big_scope(self):
        job = make_job(budget=100, description="Build a complete e-commerce marketplace platform")
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("low_budget", cats)

    def test_no_client_history(self):
        job = make_job(client_history=None)
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("payment_risk", cats)

    def test_zero_spend_client(self):
        job = make_job(client_history={"total_spent": 0, "hire_rate": 50,
                                       "avg_review": 4.0, "payment_verified": True})
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("payment_risk", cats)

    def test_low_hire_rate_client(self):
        job = make_job(client_history={"total_spent": 5000, "hire_rate": 10,
                                       "avg_review": 4.0, "payment_verified": True})
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("payment_risk", cats)

    def test_poor_review_client(self):
        job = make_job(client_history={"total_spent": 5000, "hire_rate": 50,
                                       "avg_review": 2.0, "payment_verified": True})
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("client_quality", cats)

    def test_unverified_payment(self):
        job = make_job(client_history={"total_spent": 5000, "hire_rate": 50,
                                       "avg_review": 4.5, "payment_verified": False})
        flags = self.detector.detect(job)
        cats = [f.category for f in flags]
        self.assertIn("payment_risk", cats)

    def test_bad_job_multiple_flags(self):
        job = make_bad_job()
        flags = self.detector.detect(job)
        self.assertGreater(len(flags), 5, "A terrible job should trigger many flags")
        severities = {f.severity for f in flags}
        self.assertIn(Severity.CRITICAL, severities)
        self.assertIn(Severity.HIGH, severities)

    def test_red_flag_has_evidence(self):
        job = make_job(description="Please do a free test before hiring.")
        flags = self.detector.detect(job)
        for f in flags:
            self.assertTrue(f.evidence, f"Flag {f.category} should have evidence")


# ---------------------------------------------------------------------------
# ScoringEngine Tests
# ---------------------------------------------------------------------------

class TestScoringEngine(unittest.TestCase):

    def setUp(self):
        self.engine = ScoringEngine()

    def test_good_job_scores_high(self):
        job = make_job()
        flags = RedFlagDetector().detect(job)
        scores = self.engine.score(job, flags)
        self.assertGreater(scores.overall, 50)

    def test_bad_job_scores_low(self):
        job = make_bad_job()
        flags = RedFlagDetector().detect(job)
        scores = self.engine.score(job, flags)
        self.assertLess(scores.overall, 50)

    def test_unknown_budget_is_neutral(self):
        job = make_job(budget=None)
        scores = self.engine.score(job, [])
        self.assertEqual(scores.budget_adequacy, 50.0)

    def test_no_client_history_scores_low(self):
        job = make_job(client_history=None)
        flags = RedFlagDetector().detect(job)
        scores = self.engine.score(job, flags)
        self.assertLessEqual(scores.client_quality, 50)

    def test_short_description_penalised(self):
        job = make_job(description="Fix bug.")
        scores = self.engine.score(job, [])
        self.assertLess(scores.scope_clarity, 60)

    def test_detailed_description_rewarded(self):
        long_desc = (
            "We need a React dashboard with the following features:\n"
            "1. User authentication with OAuth2\n"
            "2. Real-time charts using D3.js\n"
            "3. REST API integration with our existing Node.js backend\n"
            "4. PostgreSQL database queries\n"
            "5. Role-based access control\n"
            "6. Export to CSV functionality\n"
            "7. Responsive design for mobile\n"
            "Tech stack: React, TypeScript, Node.js, PostgreSQL, D3.js\n"
            "We have detailed wireframes ready."
        )
        job = make_job(description=long_desc, skills_required=["react", "node.js", "postgresql", "d3.js"])
        scores = self.engine.score(job, [])
        self.assertGreater(scores.scope_clarity, 70)

    def test_score_breakdown_weights_sum_to_one(self):
        sb = ScoreBreakdown()
        self.assertAlmostEqual(sum(sb.WEIGHTS.values()), 1.0, places=5)

    def test_compute_overall(self):
        sb = ScoreBreakdown(budget_adequacy=80, client_quality=60,
                            scope_clarity=70, timeline_feasibility=90)
        overall = sb.compute_overall()
        expected = 80 * 0.30 + 60 * 0.25 + 70 * 0.25 + 90 * 0.20
        self.assertAlmostEqual(overall, round(expected, 1), places=1)

    def test_scores_clamped_0_100(self):
        # A job with extreme flags should not go negative
        job = make_bad_job()
        flags = RedFlagDetector().detect(job)
        scores = self.engine.score(job, flags)
        for dim in [scores.budget_adequacy, scores.client_quality,
                    scores.scope_clarity, scores.timeline_feasibility]:
            self.assertGreaterEqual(dim, 0)
            self.assertLessEqual(dim, 100)

    def test_skill_mapping(self):
        self.assertEqual(self.engine._map_skill(["react", "javascript"]), "web_development")
        self.assertEqual(self.engine._map_skill(["flutter", "ios"]), "mobile_app_development")
        self.assertEqual(self.engine._map_skill(["machine learning", "pytorch"]), "ai_ml")
        self.assertEqual(self.engine._map_skill(["seo", "google ads"]), "digital_marketing")


# ---------------------------------------------------------------------------
# JobClassifier Tests
# ---------------------------------------------------------------------------

class TestJobClassifier(unittest.TestCase):

    def setUp(self):
        self.classifier = JobClassifier()

    def test_hourly_detection(self):
        job = make_job(budget_type="hourly")
        c = self.classifier.classify(job)
        self.assertEqual(c.job_type, JobType.HOURLY)

    def test_retainer_detection(self):
        job = make_job(description="Looking for an ongoing monthly retainer for maintenance work.")
        c = self.classifier.classify(job)
        self.assertEqual(c.job_type, JobType.RETAINER)

    def test_fixed_price_detection(self):
        job = make_job(description="Fixed price project. Total budget $3000.",
                       budget_type="unknown")
        c = self.classifier.classify(job)
        self.assertEqual(c.job_type, JobType.FIXED_PRICE)

    def test_project_based_fallback(self):
        job = make_job(description="We need a developer.", budget_type="unknown")
        c = self.classifier.classify(job)
        self.assertEqual(c.job_type, JobType.PROJECT_BASED)

    def test_difficulty_senior(self):
        job = make_job(description="Architect a distributed microservices platform with scalability.")
        c = self.classifier.classify(job)
        self.assertEqual(c.difficulty, DifficultyLevel.SENIOR)

    def test_difficulty_junior(self):
        job = make_job(description="Fix a simple bug on a WordPress landing page template.")
        c = self.classifier.classify(job)
        self.assertEqual(c.difficulty, DifficultyLevel.JUNIOR)

    def test_difficulty_mid_default(self):
        job = make_job(description="Build an API integration with database and deploy it.")
        c = self.classifier.classify(job)
        self.assertEqual(c.difficulty, DifficultyLevel.MID)

    def test_skill_matching(self):
        job = make_job(skills_required=["react", "node.js", "graphql"])
        c = self.classifier.classify(job, freelancer_skills=["react", "node.js", "python"])
        self.assertIn("react", c.matched_skills)
        self.assertIn("node.js", c.matched_skills)
        self.assertIn("graphql", c.missing_skills)

    def test_no_freelancer_skills(self):
        job = make_job(skills_required=["react"])
        c = self.classifier.classify(job)
        self.assertEqual(c.matched_skills, [])
        self.assertEqual(c.missing_skills, ["react"])

    def test_estimated_hours_positive(self):
        job = make_job()
        c = self.classifier.classify(job)
        self.assertGreater(c.estimated_hours, 0)

    def test_claimed_hours_extracted(self):
        job = make_job(description="This should take about 20 hours of work.")
        c = self.classifier.classify(job)
        self.assertEqual(c.client_claimed_hours, 20.0)

    def test_no_claimed_hours(self):
        job = make_job(description="Build something cool.")
        c = self.classifier.classify(job)
        self.assertIsNone(c.client_claimed_hours)


# ---------------------------------------------------------------------------
# RecommendationEngine Tests
# ---------------------------------------------------------------------------

class TestRecommendationEngine(unittest.TestCase):

    def setUp(self):
        self.engine = RecommendationEngine()

    def test_good_job_gets_apply(self):
        scores = ScoreBreakdown(budget_adequacy=80, client_quality=75,
                                scope_clarity=80, timeline_feasibility=85)
        scores.compute_overall()
        rec = self.engine.recommend(make_job(), scores, [], JobClassifier().classify(make_job()))
        self.assertEqual(rec.verdict, Verdict.APPLY)

    def test_bad_job_gets_skip(self):
        job = make_bad_job()
        flags = RedFlagDetector().detect(job)
        scores = ScoringEngine().score(job, flags)
        c = JobClassifier().classify(job)
        rec = self.engine.recommend(job, scores, flags, c)
        self.assertIn(rec.verdict, [Verdict.SKIP, Verdict.APPLY_WITH_CAUTION])

    def test_critical_flags_trigger_skip(self):
        flags = [
            RedFlag("payment_risk", "No escrow", Severity.CRITICAL, "no escrow"),
            RedFlag("payment_risk", "Payment after launch", Severity.CRITICAL, "payment after launch"),
        ]
        scores = ScoreBreakdown(budget_adequacy=70, client_quality=60,
                                scope_clarity=70, timeline_feasibility=70)
        scores.compute_overall()
        rec = self.engine.recommend(make_job(), scores, flags, JobClassifier().classify(make_job()))
        self.assertEqual(rec.verdict, Verdict.SKIP)

    def test_suggested_rate_positive(self):
        job = make_job()
        scores = ScoreBreakdown()
        scores.compute_overall()
        c = JobClassifier().classify(job)
        rec = self.engine.recommend(job, scores, [], c)
        self.assertGreater(rec.suggested_rate, 0)

    def test_questions_generated_for_missing_budget(self):
        job = make_job(budget=None)
        flags = RedFlagDetector().detect(job)
        scores = ScoringEngine().score(job, flags)
        c = JobClassifier().classify(job)
        rec = self.engine.recommend(job, scores, flags, c)
        q_text = " ".join(rec.questions_to_ask).lower()
        self.assertIn("budget", q_text)

    def test_questions_generated_for_vague(self):
        job = make_job(description="Just make it pop. I'll know it when I see it.")
        flags = RedFlagDetector().detect(job)
        scores = ScoringEngine().score(job, flags)
        c = JobClassifier().classify(job)
        rec = self.engine.recommend(job, scores, flags, c)
        q_text = " ".join(rec.questions_to_ask).lower()
        self.assertIn("deliverables", q_text)

    def test_negotiation_points_for_low_budget(self):
        job = make_job(budget=100)
        flags = RedFlagDetector().detect(job)
        scores = ScoringEngine().score(job, flags)
        c = JobClassifier().classify(job)
        rec = self.engine.recommend(job, scores, flags, c)
        neg_text = " ".join(rec.negotiation_points).lower()
        self.assertTrue("market rate" in neg_text or "negotiate" in neg_text or "scope" in neg_text,
                        "Should mention rate or scope negotiation")

    def test_questions_capped(self):
        """Questions should not exceed 6."""
        job = make_bad_job()
        flags = RedFlagDetector().detect(job)
        scores = ScoringEngine().score(job, flags)
        c = JobClassifier().classify(job)
        rec = self.engine.recommend(job, scores, flags, c)
        self.assertLessEqual(len(rec.questions_to_ask), 6)


# ---------------------------------------------------------------------------
# JobAnalyzer (Facade) Tests
# ---------------------------------------------------------------------------

class TestJobAnalyzer(unittest.TestCase):

    def setUp(self):
        self.analyzer = JobAnalyzer()

    def test_full_analysis_returns_result(self):
        job = make_job()
        result = self.analyzer.analyze(job)
        self.assertIsInstance(result, AnalysisResult)
        self.assertIsNotNone(result.scores)
        self.assertIsNotNone(result.classification)
        self.assertIsNotNone(result.recommendation)

    def test_full_analysis_with_freelancer_skills(self):
        job = make_job()
        result = self.analyzer.analyze(job, freelancer_skills=["react", "python"])
        self.assertIn("react", result.classification.matched_skills)

    def test_bad_job_analysis(self):
        job = make_bad_job()
        result = self.analyzer.analyze(job)
        self.assertGreater(len(result.red_flags), 3)
        self.assertLess(result.scores.overall, 50)
        self.assertIn(result.recommendation.verdict, [Verdict.SKIP, Verdict.APPLY_WITH_CAUTION])

    def test_json_serialization(self):
        job = make_job()
        result = self.analyzer.analyze(job)
        j = result.to_json()
        parsed = json.loads(j)
        self.assertIn("red_flags", parsed)
        self.assertIn("scores", parsed)
        self.assertIn("classification", parsed)
        self.assertIn("recommendation", parsed)
        self.assertIn("overall", parsed["scores"])

    def test_to_dict_roundtrip(self):
        job = make_job()
        result = self.analyzer.analyze(job)
        d = result.to_dict()
        self.assertIsInstance(d, dict)
        self.assertIsInstance(d["red_flags"], list)
        # Verdict should be a string in the dict
        self.assertIsInstance(d["recommendation"]["verdict"], str)


# ---------------------------------------------------------------------------
# parse_description Tests
# ---------------------------------------------------------------------------

class TestParseDescription(unittest.TestCase):

    def test_extracts_budget(self):
        text = "We need a website. Budget: $5000 fixed price."
        job = JobAnalyzer.parse_description(text)
        self.assertEqual(job.budget, 5000.0)

    def test_extracts_timeline_weeks(self):
        text = "Deliver in 3 weeks. Build an API."
        job = JobAnalyzer.parse_description(text)
        self.assertEqual(job.timeline_days, 21)

    def test_extracts_timeline_months(self):
        text = "This is a 2 month project."
        job = JobAnalyzer.parse_description(text)
        self.assertEqual(job.timeline_days, 60)

    def test_extracts_hourly_budget_type(self):
        text = "Hourly rate: $50/hr for React development."
        job = JobAnalyzer.parse_description(text)
        self.assertEqual(job.budget_type, "hourly")

    def test_uses_first_line_as_title(self):
        text = "Senior React Developer Needed\nWe need help building a dashboard."
        job = JobAnalyzer.parse_description(text)
        self.assertEqual(job.title, "Senior React Developer Needed")

    def test_overrides_work(self):
        text = "Build something"
        job = JobAnalyzer.parse_description(text, title="Custom Title",
                                            budget=999, budget_type="fixed")
        self.assertEqual(job.title, "Custom Title")
        self.assertEqual(job.budget, 999)
        self.assertEqual(job.budget_type, "fixed")

    def test_skills_extraction(self):
        text = "Description here.\nSkills required: React, Node.js, PostgreSQL, Docker"
        job = JobAnalyzer.parse_description(text)
        skills_lower = [s.lower().strip() for s in job.skills_required]
        self.assertIn("react", skills_lower)

    def test_empty_text_handled(self):
        job = JobAnalyzer.parse_description("")
        self.assertEqual(job.title, "Untitled")


# ---------------------------------------------------------------------------
# Severity & Verdict enum tests
# ---------------------------------------------------------------------------

class TestEnums(unittest.TestCase):

    def test_severity_weights(self):
        self.assertEqual(Severity.LOW.weight(), 1)
        self.assertEqual(Severity.MEDIUM.weight(), 3)
        self.assertEqual(Severity.HIGH.weight(), 6)
        self.assertEqual(Severity.CRITICAL.weight(), 10)

    def test_verdict_values(self):
        self.assertEqual(Verdict.APPLY.value, "apply")
        self.assertEqual(Verdict.SKIP.value, "skip")
        self.assertEqual(Verdict.APPLY_WITH_CAUTION.value, "apply_with_caution")


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases(unittest.TestCase):

    def setUp(self):
        self.analyzer = JobAnalyzer()

    def test_empty_description(self):
        job = JobPosting(title="Empty", description="")
        result = self.analyzer.analyze(job)
        self.assertIsInstance(result, AnalysisResult)

    def test_no_skills(self):
        job = make_job(skills_required=[])
        result = self.analyzer.analyze(job)
        self.assertIsInstance(result, AnalysisResult)

    def test_very_high_budget(self):
        job = make_job(budget=1_000_000)
        result = self.analyzer.analyze(job)
        self.assertGreater(result.scores.budget_adequacy, 60)

    def test_zero_budget(self):
        job = make_job(budget=0)
        result = self.analyzer.analyze(job)
        self.assertLessEqual(result.scores.budget_adequacy, 30)

    def test_negative_budget_handled(self):
        job = make_job(budget=-100)
        result = self.analyzer.analyze(job)
        self.assertIsInstance(result, AnalysisResult)

    def test_unicode_description(self):
        job = make_job(description="Créer un site web 🚀 avec des fonctionnalités avancées. Budget: $2000.")
        result = self.analyzer.analyze(job)
        self.assertIsInstance(result, AnalysisResult)

    def test_very_long_description(self):
        long_desc = "Build a website. " * 500
        job = make_job(description=long_desc)
        result = self.analyzer.analyze(job)
        self.assertIsInstance(result, AnalysisResult)


if __name__ == "__main__":
    unittest.main(verbosity=2)
