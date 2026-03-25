#!/usr/bin/env python3
"""
Comprehensive tests for the Profile Optimizer tool.
"""

import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Add tools directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))

from profile_optimizer import (
    ProfileAnalysisEngine, SEOKeywordEngine, CompetitorAnalysisEngine,
    ContentOptimizer, PositioningEngine, ScoringEngine,
    FreelancerProfile, KeywordData, CompetitorProfile, OptimizedContent,
    ProfileScore, AnalysisResult, Platform, ExperienceLevel, ContentTone
)


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------

def make_profile(**kwargs) -> FreelancerProfile:
    """Create a sample freelancer profile with defaults"""
    defaults = dict(
        title="Full Stack React Developer",
        overview="I'm a passionate full stack developer with 5 years of experience building modern web applications using React, Node.js, and MongoDB. I help startups and businesses create scalable solutions that drive growth.",
        skills=["React", "Node.js", "JavaScript", "MongoDB", "Express", "HTML", "CSS", "Git"],
        hourly_rate=45.0,
        experience_years=5,
        certifications=["AWS Certified Developer"],
        portfolio_items=[
            {"title": "E-commerce Platform", "description": "Built scalable e-commerce platform for 10k+ users"},
            {"title": "SaaS Dashboard", "description": "React dashboard with real-time analytics"},
            {"title": "Mobile App API", "description": "Node.js API serving 50k+ requests/day"}
        ],
        languages=["English", "Spanish"],
        education=[{"degree": "Computer Science", "institution": "Tech University"}],
        employment_history=[
            {"title": "Senior Developer", "company": "Tech Startup", "duration": "2 years"},
            {"title": "Full Stack Developer", "company": "Digital Agency", "duration": "3 years"}
        ],
        client_feedback={"rating": 4.9, "reviews_count": 42, "testimonials": []},
        platform_specific={}
    )
    defaults.update(kwargs)
    return FreelancerProfile(**defaults)


def make_keyword(**kwargs) -> KeywordData:
    """Create a sample keyword with defaults"""
    defaults = dict(
        keyword="react developer",
        search_volume=8500,
        competition_level="high",
        relevance_score=0.95,
        placement_suggestions=["title", "overview"],
        related_keywords=["react consultant", "react specialist"]
    )
    defaults.update(kwargs)
    return KeywordData(**defaults)


def make_competitor(**kwargs) -> CompetitorProfile:
    """Create a sample competitor with defaults"""
    defaults = dict(
        title="Senior React Developer | 500+ Projects Completed",
        hourly_rate=65.0,
        total_earnings=250000,
        job_success_score=98,
        reviews_count=147,
        skills=["React", "Node.js", "MongoDB", "Express", "JavaScript", "TypeScript"],
        key_differentiators=["500+ projects", "7 years experience", "Enterprise clients"],
        strengths=["High volume delivery", "Enterprise experience", "Full stack expertise"],
        weaknesses=["Premium pricing", "Limited availability"]
    )
    defaults.update(kwargs)
    return CompetitorProfile(**defaults)


# ---------------------------------------------------------------------------
# Test Classes
# ---------------------------------------------------------------------------

class TestProfileAnalysisEngine(unittest.TestCase):
    """Test the main profile analysis engine"""
    
    def setUp(self):
        self.engine = ProfileAnalysisEngine()
        self.profile = make_profile()
    
    def test_analyze_profile_basic(self):
        """Test basic profile analysis workflow"""
        result = self.engine.analyze_profile(self.profile, Platform.UPWORK)
        
        # Check result structure
        self.assertIsInstance(result, AnalysisResult)
        self.assertIsInstance(result.profile_score, ProfileScore)
        self.assertIsInstance(result.keyword_research, list)
        self.assertIsInstance(result.competitor_analysis, list)
        self.assertIsInstance(result.optimized_content, OptimizedContent)
        self.assertIsInstance(result.positioning_recommendations, list)
        self.assertIsInstance(result.action_plan, list)
        
        # Check that scores are reasonable
        self.assertGreaterEqual(result.profile_score.overall_score, 0)
        self.assertLessEqual(result.profile_score.overall_score, 100)
    
    def test_detect_niche_web_development(self):
        """Test niche detection for web development profile"""
        profile = make_profile(
            title="React Developer",
            overview="I build modern web applications with React and Node.js",
            skills=["React", "JavaScript", "HTML", "CSS", "Node.js"]
        )
        
        niche = self.engine._detect_niche(profile)
        self.assertEqual(niche, "web-development")
    
    def test_detect_niche_mobile_development(self):
        """Test niche detection for mobile development profile"""
        profile = make_profile(
            title="iOS Developer",
            overview="I create beautiful mobile apps for iOS and Android platforms",
            skills=["Swift", "iOS", "Android", "React Native", "Mobile App"]
        )
        
        niche = self.engine._detect_niche(profile)
        self.assertEqual(niche, "mobile-development")
    
    def test_detect_niche_data_science(self):
        """Test niche detection for data science profile"""
        profile = make_profile(
            title="Data Scientist",
            overview="I analyze data and build machine learning models using Python",
            skills=["Python", "Machine Learning", "Pandas", "TensorFlow", "SQL"]
        )
        
        niche = self.engine._detect_niche(profile)
        self.assertEqual(niche, "data-science")
    
    def test_generate_action_plan(self):
        """Test action plan generation based on scores"""
        # Create a profile with some weaknesses
        low_scoring_profile = make_profile(
            title="Developer",  # Weak title
            overview="I code stuff",  # Weak overview
            skills=["HTML"],  # Limited skills
            portfolio_items=[],  # No portfolio
            client_feedback={"rating": 0, "reviews_count": 0}
        )
        
        # Mock scoring components
        mock_score = ProfileScore(
            overall_score=45,
            category_scores={
                'completeness': 50,
                'seo_strength': 35,
                'positioning': 40,
                'differentiation': 55
            },
            improvement_areas=['Completeness', 'SEO Strength', 'Positioning'],
            strengths=[],
            score_explanation={}
        )
        
        keywords = [make_keyword()]
        competitors = [make_competitor()]
        positioning = ["Improve value proposition"]
        
        action_plan = self.engine._generate_action_plan(mock_score, keywords, competitors, positioning)
        
        # Should have high priority actions for low scores
        self.assertTrue(len(action_plan) > 0)
        self.assertTrue(any(action['priority'] == 'HIGH' for action in action_plan))


class TestSEOKeywordEngine(unittest.TestCase):
    """Test SEO keyword research and analysis"""
    
    def setUp(self):
        self.engine = SEOKeywordEngine()
    
    def test_research_keywords_web_development(self):
        """Test keyword research for web development niche"""
        keywords = self.engine.research_keywords("web-development", Platform.UPWORK, limit=10)
        
        self.assertIsInstance(keywords, list)
        self.assertLessEqual(len(keywords), 10)
        
        for keyword in keywords:
            self.assertIsInstance(keyword, KeywordData)
            self.assertIsInstance(keyword.keyword, str)
            self.assertGreater(keyword.search_volume, 0)
            self.assertIn(keyword.competition_level, ['low', 'medium', 'high'])
            self.assertGreaterEqual(keyword.relevance_score, 0)
            self.assertLessEqual(keyword.relevance_score, 1)
    
    def test_research_keywords_mobile_development(self):
        """Test keyword research for mobile development niche"""
        keywords = self.engine.research_keywords("mobile-development", Platform.UPWORK, limit=5)
        
        self.assertEqual(len(keywords), 5)
        
        # Check that mobile-specific keywords are included
        keyword_texts = [kw.keyword for kw in keywords]
        self.assertTrue(any('ios' in kw.lower() or 'android' in kw.lower() or 'mobile' in kw.lower() 
                          for kw in keyword_texts))
    
    def test_analyze_keyword_density(self):
        """Test keyword density analysis"""
        text = "I am a React developer who specializes in React applications and React consulting"
        keywords = ["react", "developer", "consulting"]
        
        density = self.engine.analyze_keyword_density(text, keywords)
        
        # "react" appears 3 times in ~15 words = ~20%
        self.assertGreater(density["react"], 15)  
        self.assertGreater(density["developer"], 0)
        self.assertGreater(density["consulting"], 0)
    
    def test_suggest_keyword_placement(self):
        """Test keyword placement suggestions"""
        keywords = [
            make_keyword(keyword="react developer", placement_suggestions=["title", "overview"]),
            make_keyword(keyword="javascript expert", placement_suggestions=["title", "skills"]),
            make_keyword(keyword="full stack", placement_suggestions=["overview", "skills"])
        ]
        profile = make_profile()
        
        placement = self.engine.suggest_keyword_placement(profile, keywords)
        
        self.assertIn("title", placement)
        self.assertIn("overview", placement)
        self.assertIn("skills", placement)
        
        # Check that keywords are distributed properly
        self.assertIn("react developer", placement["title"])
        self.assertIn("javascript expert", placement["title"])
        self.assertIn("full stack", placement["overview"])


class TestCompetitorAnalysisEngine(unittest.TestCase):
    """Test competitor analysis functionality"""
    
    def setUp(self):
        self.engine = CompetitorAnalysisEngine(Platform.UPWORK)
        self.profile = make_profile()
    
    def test_analyze_competitors(self):
        """Test basic competitor analysis"""
        competitors = self.engine.analyze_competitors("web-development", self.profile, Platform.UPWORK, top_count=5)
        
        self.assertIsInstance(competitors, list)
        self.assertLessEqual(len(competitors), 5)
        
        for competitor in competitors:
            self.assertIsInstance(competitor, CompetitorProfile)
            self.assertIsInstance(competitor.title, str)
            self.assertIsInstance(competitor.skills, list)
            self.assertGreater(len(competitor.skills), 0)
    
    def test_identify_market_gaps(self):
        """Test market gap identification"""
        competitors = [
            make_competitor(weaknesses=["Premium pricing", "Limited availability"]),
            make_competitor(weaknesses=["Premium pricing", "Limited design skills"]),
            make_competitor(weaknesses=["Limited availability", "Framework limitations"])
        ]
        
        gaps = self.engine.identify_market_gaps(competitors, self.profile)
        
        self.assertIsInstance(gaps, list)
        # Should identify "Premium pricing" as common weakness (appears in 2/3 competitors)
        self.assertTrue(any("affordable" in gap.lower() or "budget" in gap.lower() for gap in gaps))
    
    def test_benchmark_against_competitors(self):
        """Test competitive benchmarking"""
        competitors = [
            make_competitor(hourly_rate=50.0),
            make_competitor(hourly_rate=60.0),
            make_competitor(hourly_rate=70.0)
        ]
        
        # Profile with below-market rate
        low_rate_profile = make_profile(hourly_rate=35.0)
        
        benchmark = self.engine.benchmark_against_competitors(low_rate_profile, competitors)
        
        self.assertIn("pricing", benchmark)
        self.assertIn("below market", benchmark["pricing"].lower())
    
    def test_benchmark_skills_comparison(self):
        """Test skills benchmarking against competitors"""
        competitors = [
            make_competitor(skills=["React", "Node.js", "TypeScript", "GraphQL"]),
            make_competitor(skills=["React", "Vue.js", "TypeScript", "AWS"]),
            make_competitor(skills=["React", "Angular", "TypeScript", "Docker"])
        ]
        
        # Profile missing TypeScript (common among competitors)
        profile = make_profile(skills=["React", "Node.js", "JavaScript"])
        
        benchmark = self.engine.benchmark_against_competitors(profile, competitors)
        
        # Should suggest adding TypeScript as it appears in all competitors
        if "skill_gaps" in benchmark:
            self.assertIn("typescript", benchmark["skill_gaps"].lower())


class TestContentOptimizer(unittest.TestCase):
    """Test content optimization functionality"""
    
    def setUp(self):
        self.optimizer = ContentOptimizer()
        self.profile = make_profile()
        self.keywords = [
            make_keyword(keyword="react developer", placement_suggestions=["title", "overview"]),
            make_keyword(keyword="full stack developer", placement_suggestions=["title"]),
            make_keyword(keyword="javascript expert", placement_suggestions=["overview", "skills"])
        ]
        self.competitors = [make_competitor()]
    
    def test_optimize_content_basic(self):
        """Test basic content optimization"""
        optimized = self.optimizer.optimize_content(self.profile, self.keywords, self.competitors)
        
        self.assertIsInstance(optimized, OptimizedContent)
        self.assertIsInstance(optimized.title_variants, list)
        self.assertIsInstance(optimized.overview_variants, list)
        self.assertIsInstance(optimized.skills_recommendations, list)
        self.assertIsInstance(optimized.keyword_integration, dict)
        self.assertIsInstance(optimized.a_b_test_suggestions, list)
        
        # Check that we get multiple variants
        self.assertGreater(len(optimized.title_variants), 0)
        self.assertGreater(len(optimized.overview_variants), 0)
    
    def test_generate_title_variants(self):
        """Test title variant generation"""
        variants = self.optimizer._generate_title_variants(self.profile, self.keywords, self.competitors)
        
        self.assertIsInstance(variants, list)
        self.assertGreater(len(variants), 0)
        
        # Check that keywords are integrated
        variant_text = " ".join(variants).lower()
        self.assertIn("react", variant_text)
    
    def test_generate_overview_variants_different_tones(self):
        """Test overview generation with different tones"""
        # Professional tone
        professional = self.optimizer._create_professional_overview(self.profile, self.keywords)
        self.assertIsInstance(professional, str)
        self.assertGreater(len(professional), 100)
        
        # Conversational tone
        conversational = self.optimizer._create_conversational_overview(self.profile, self.keywords)
        self.assertIsInstance(conversational, str)
        self.assertGreater(len(conversational), 100)
        
        # Technical tone
        technical = self.optimizer._create_technical_overview(self.profile, self.keywords)
        self.assertIsInstance(technical, str)
        self.assertGreater(len(technical), 100)
        
        # Should be different
        self.assertNotEqual(professional, conversational)
        self.assertNotEqual(professional, technical)
    
    def test_recommend_skills(self):
        """Test skills recommendation"""
        recommendations = self.optimizer._recommend_skills(self.profile, self.keywords, self.competitors)
        
        self.assertIsInstance(recommendations, list)
        self.assertLessEqual(len(recommendations), 8)  # Should limit to 8 recommendations
        
        # Should not recommend skills already in profile
        current_skills_lower = [skill.lower() for skill in self.profile.skills]
        for rec in recommendations:
            self.assertNotIn(rec.lower(), current_skills_lower)
    
    def test_plan_keyword_integration(self):
        """Test keyword integration planning"""
        integration = self.optimizer._plan_keyword_integration(self.keywords)
        
        self.assertIn("title", integration)
        self.assertIn("overview", integration)
        self.assertIn("skills", integration)
        
        # Check that keywords are distributed according to their placement suggestions
        self.assertIn("react developer", integration["title"])
        self.assertIn("javascript expert", integration["overview"])
    
    def test_generate_ab_test_suggestions(self):
        """Test A/B test suggestion generation"""
        titles = ["React Developer | 5+ Years Experience", "Senior React Developer - Quality Guaranteed"]
        overviews = ["Professional overview...", "Conversational overview..."]
        
        suggestions = self.optimizer._generate_ab_test_suggestions(titles, overviews)
        
        self.assertIsInstance(suggestions, list)
        self.assertGreater(len(suggestions), 0)
        
        # Should include different test types
        test_types = [suggestion["type"] for suggestion in suggestions]
        self.assertIn("title", test_types)


class TestPositioningEngine(unittest.TestCase):
    """Test positioning recommendation functionality"""
    
    def setUp(self):
        self.engine = PositioningEngine()
        self.profile = make_profile()
        self.keywords = [make_keyword()]
        self.competitors = [make_competitor()]
    
    def test_generate_recommendations_basic(self):
        """Test basic recommendation generation"""
        recommendations = self.engine.generate_recommendations(self.profile, self.competitors, self.keywords)
        
        self.assertIsInstance(recommendations, list)
        self.assertGreater(len(recommendations), 0)
        
        # Should be strings with actionable advice
        for rec in recommendations:
            self.assertIsInstance(rec, str)
            self.assertGreater(len(rec), 50)  # Substantial recommendations
    
    def test_rate_positioning_recommendations(self):
        """Test rate positioning recommendations"""
        # Profile with below-market rates
        low_rate_profile = make_profile(hourly_rate=25.0)
        high_rate_competitors = [make_competitor(hourly_rate=65.0), make_competitor(hourly_rate=70.0)]
        
        recommendations = self.engine.generate_recommendations(low_rate_profile, high_rate_competitors, self.keywords)
        
        # Should recommend rate optimization
        rec_text = " ".join(recommendations).lower()
        self.assertTrue("rate" in rec_text or "price" in rec_text or "hourly" in rec_text)
    
    def test_experience_positioning_recommendations(self):
        """Test experience-based positioning recommendations"""
        # Junior developer profile
        junior_profile = make_profile(experience_years=2)
        
        recommendations = self.engine.generate_recommendations(junior_profile, self.competitors, self.keywords)
        
        rec_text = " ".join(recommendations).lower()
        self.assertTrue("junior" in rec_text or "enthusiasm" in rec_text or "competitive" in rec_text)
        
        # Senior developer profile
        senior_profile = make_profile(experience_years=10)
        
        recommendations = self.engine.generate_recommendations(senior_profile, self.competitors, self.keywords)
        
        rec_text = " ".join(recommendations).lower()
        self.assertTrue("senior" in rec_text or "expert" in rec_text or "premium" in rec_text)


class TestScoringEngine(unittest.TestCase):
    """Test profile scoring functionality"""
    
    def setUp(self):
        self.engine = ScoringEngine(Platform.UPWORK)
        self.profile = make_profile()
    
    def test_score_profile_basic(self):
        """Test basic profile scoring"""
        score = self.engine.score_profile(self.profile)
        
        self.assertIsInstance(score, ProfileScore)
        self.assertGreaterEqual(score.overall_score, 0)
        self.assertLessEqual(score.overall_score, 100)
        
        # Check category scores
        expected_categories = ['completeness', 'seo_strength', 'positioning', 'differentiation']
        for category in expected_categories:
            self.assertIn(category, score.category_scores)
            self.assertGreaterEqual(score.category_scores[category], 0)
            self.assertLessEqual(score.category_scores[category], 100)
    
    def test_score_completeness_full_profile(self):
        """Test completeness scoring with full profile"""
        complete_profile = make_profile()  # Default profile is quite complete
        
        completeness_score = self.engine._score_completeness(complete_profile)
        
        self.assertGreaterEqual(completeness_score, 70)  # Should score well
    
    def test_score_completeness_minimal_profile(self):
        """Test completeness scoring with minimal profile"""
        minimal_profile = make_profile(
            title="Dev",
            overview="",
            skills=[],
            portfolio_items=[],
            employment_history=[],
            client_feedback=None
        )
        
        completeness_score = self.engine._score_completeness(minimal_profile)
        
        self.assertLess(completeness_score, 50)  # Should score poorly
    
    def test_score_seo_strength(self):
        """Test SEO strength scoring"""
        seo_optimized_profile = make_profile(
            title="Senior React Developer | JavaScript Expert | 5+ Years Experience",
            overview="I'm a React developer with extensive JavaScript experience building modern web applications. I help businesses create scalable solutions using React, Node.js, and modern development practices. Contact me to discuss your project requirements.",
            skills=["React", "JavaScript", "Node.js", "TypeScript", "MongoDB"]
        )
        
        seo_score = self.engine._score_seo_strength(seo_optimized_profile)
        
        self.assertGreaterEqual(seo_score, 60)  # Should score reasonably well
    
    def test_score_positioning(self):
        """Test positioning scoring"""
        well_positioned_profile = make_profile(
            overview="I help startups build scalable React applications that drive business growth. With 5+ years of experience and a focus on delivering results, I've helped over 40 clients achieve their goals.",
            client_feedback={"rating": 4.9, "reviews_count": 42},
            portfolio_items=[
                {"title": "Project 1"}, {"title": "Project 2"}, 
                {"title": "Project 3"}, {"title": "Project 4"}
            ]
        )
        
        positioning_score = self.engine._score_positioning(well_positioned_profile)
        
        self.assertGreaterEqual(positioning_score, 70)
    
    def test_score_differentiation(self):
        """Test differentiation scoring"""
        differentiated_profile = make_profile(
            skills=["React", "TypeScript", "GraphQL", "Next.js", "Serverless"],  # Modern stack
            certifications=["AWS Certified", "React Certified"],
            overview="I specialize in fintech applications with a unique focus on blockchain integration",
            languages=["English", "Spanish", "German"]  # Multiple languages
        )
        
        differentiation_score = self.engine._score_differentiation(differentiated_profile)
        
        self.assertGreaterEqual(differentiation_score, 60)
    
    def test_analyze_title_seo(self):
        """Test title SEO analysis"""
        good_title = "Senior React Developer | JavaScript Expert | 5+ Years Experience"
        poor_title = "Dev"
        
        good_score = self.engine._analyze_title_seo(good_title)
        poor_score = self.engine._analyze_title_seo(poor_title)
        
        self.assertGreater(good_score, poor_score)
        self.assertGreaterEqual(good_score, 60)
        self.assertLess(poor_score, 30)
    
    def test_analyze_overview_seo(self):
        """Test overview SEO analysis"""
        good_overview = """
        I'm a passionate React developer with 5 years of experience building modern web applications. 
        I specialize in JavaScript development, API integration, and database design. My expertise includes 
        React, Node.js, MongoDB, and creating scalable solutions for startups and enterprises. 
        I help businesses achieve their goals through high-quality software development. 
        Contact me to discuss your project requirements and how I can help bring your vision to life.
        """
        
        poor_overview = "I code stuff. Contact me."
        
        good_score = self.engine._analyze_overview_seo(good_overview)
        poor_score = self.engine._analyze_overview_seo(poor_overview)
        
        self.assertGreater(good_score, poor_score)
        self.assertGreaterEqual(good_score, 60)
        self.assertLess(poor_score, 30)
    
    def test_analyze_skills_seo(self):
        """Test skills SEO analysis"""
        good_skills = ["React", "JavaScript", "Node.js", "TypeScript", "MongoDB", "AWS"]
        poor_skills = ["Programming"]
        empty_skills = []
        
        good_score = self.engine._analyze_skills_seo(good_skills)
        poor_score = self.engine._analyze_skills_seo(poor_skills)
        empty_score = self.engine._analyze_skills_seo(empty_skills)
        
        self.assertGreater(good_score, poor_score)
        self.assertGreater(poor_score, empty_score)
        self.assertEqual(empty_score, 0)


class TestIntegrationWorkflow(unittest.TestCase):
    """Integration tests for complete workflows"""
    
    def setUp(self):
        self.engine = ProfileAnalysisEngine()
        self.profile = make_profile()
    
    def test_complete_analysis_workflow(self):
        """Test the complete analysis workflow from start to finish"""
        result = self.engine.analyze_profile(self.profile, Platform.UPWORK)
        
        # Verify complete workflow produces all expected outputs
        self.assertIsInstance(result, AnalysisResult)
        
        # Profile score should be reasonable for a well-constructed profile
        self.assertGreaterEqual(result.profile_score.overall_score, 60)
        
        # Should have keyword research results
        self.assertGreater(len(result.keyword_research), 0)
        
        # Should have competitor analysis
        self.assertGreater(len(result.competitor_analysis), 0)
        
        # Should have optimized content
        self.assertGreater(len(result.optimized_content.title_variants), 0)
        self.assertGreater(len(result.optimized_content.overview_variants), 0)
        
        # Should have positioning recommendations
        self.assertGreater(len(result.positioning_recommendations), 0)
        
        # Should have actionable plan
        self.assertGreater(len(result.action_plan), 0)
        
        # Action plan should have prioritized items
        priorities = [action.get('priority', '') for action in result.action_plan]
        self.assertTrue(any(p in priorities for p in ['HIGH', 'MEDIUM', 'LOW']))
    
    def test_different_niches_produce_relevant_results(self):
        """Test that different niches produce relevant, differentiated results"""
        # Web development profile
        web_profile = make_profile(
            title="React Developer",
            overview="I build modern web applications",
            skills=["React", "JavaScript", "Node.js"]
        )
        
        # Mobile development profile
        mobile_profile = make_profile(
            title="iOS Developer", 
            overview="I create beautiful mobile apps",
            skills=["Swift", "iOS", "Objective-C"]
        )
        
        web_result = self.engine.analyze_profile(web_profile, Platform.UPWORK)
        mobile_result = self.engine.analyze_profile(mobile_profile, Platform.UPWORK)
        
        # Should detect different niches
        web_keywords = [kw.keyword for kw in web_result.keyword_research]
        mobile_keywords = [kw.keyword for kw in mobile_result.keyword_research]
        
        # Web keywords should contain web-related terms
        web_text = " ".join(web_keywords).lower()
        self.assertTrue(any(term in web_text for term in ["react", "javascript", "web", "frontend"]))
        
        # Mobile keywords should contain mobile-related terms  
        mobile_text = " ".join(mobile_keywords).lower()
        self.assertTrue(any(term in mobile_text for term in ["ios", "mobile", "app", "swift"]))
    
    def test_profile_improvement_over_iterations(self):
        """Test that applying recommendations improves profile scores"""
        # Start with a basic profile
        basic_profile = make_profile(
            title="Developer",
            overview="I write code",
            skills=["HTML", "CSS"],
            portfolio_items=[],
            client_feedback=None
        )
        
        initial_result = self.engine.analyze_profile(basic_profile, Platform.UPWORK)
        initial_score = initial_result.profile_score.overall_score
        
        # Apply some recommendations (simulate improvement)
        improved_profile = make_profile(
            title="Senior React Developer | JavaScript Expert | 5+ Years Experience",
            overview=initial_result.optimized_content.overview_variants[0],  # Use optimized overview
            skills=basic_profile.skills + initial_result.optimized_content.skills_recommendations[:5],
            portfolio_items=[
                {"title": "E-commerce Platform", "description": "React/Node.js application"},
                {"title": "Dashboard App", "description": "Analytics dashboard"}
            ],
            client_feedback={"rating": 4.8, "reviews_count": 15}
        )
        
        improved_result = self.engine.analyze_profile(improved_profile, Platform.UPWORK)
        improved_score = improved_result.profile_score.overall_score
        
        # Improved profile should score higher
        self.assertGreater(improved_score, initial_score)
        
        # Should have fewer improvement areas
        self.assertLessEqual(len(improved_result.profile_score.improvement_areas),
                           len(initial_result.profile_score.improvement_areas))


# ---------------------------------------------------------------------------
# Test CLI Interface
# ---------------------------------------------------------------------------

class TestCLIInterface(unittest.TestCase):
    """Test command-line interface"""
    
    def test_profile_data_parsing(self):
        """Test that profile data can be properly parsed from JSON"""
        profile_json = {
            "title": "React Developer",
            "overview": "I build web applications",
            "skills": ["React", "JavaScript"],
            "hourly_rate": 50.0,
            "experience_years": 3
        }
        
        profile = FreelancerProfile(**profile_json)
        
        self.assertEqual(profile.title, "React Developer")
        self.assertEqual(profile.hourly_rate, 50.0)
        self.assertEqual(len(profile.skills), 2)
    
    def test_keyword_data_serialization(self):
        """Test that keyword data can be properly serialized to JSON"""
        keyword = make_keyword()
        
        # Should be able to convert to dict for JSON serialization
        keyword_dict = keyword.__dict__
        
        self.assertIn("keyword", keyword_dict)
        self.assertIn("search_volume", keyword_dict) 
        self.assertIn("competition_level", keyword_dict)
        self.assertIn("relevance_score", keyword_dict)


# ---------------------------------------------------------------------------
# Sample Data for Manual Testing
# ---------------------------------------------------------------------------

def create_sample_profiles():
    """Create sample profiles for manual testing"""
    
    # Junior developer profile
    junior = make_profile(
        title="Junior React Developer",
        overview="I'm a motivated junior developer looking to build amazing web applications",
        skills=["React", "JavaScript", "HTML", "CSS"],
        hourly_rate=25.0,
        experience_years=1,
        portfolio_items=[
            {"title": "Personal Website", "description": "Built my portfolio site with React"}
        ],
        client_feedback={"rating": 4.5, "reviews_count": 3}
    )
    
    # Senior expert profile
    senior = make_profile(
        title="Senior Full Stack Architect | React & Node.js Expert | 500+ Projects",
        overview="I'm a senior software architect with 10+ years of experience leading development teams and building scalable enterprise applications. I specialize in React, Node.js, and cloud architecture, helping Fortune 500 companies modernize their technology stack.",
        skills=["React", "Node.js", "TypeScript", "GraphQL", "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB", "Redis"],
        hourly_rate=95.0,
        experience_years=10,
        certifications=["AWS Solutions Architect", "Google Cloud Professional", "React Certified"],
        portfolio_items=[
            {"title": "Enterprise SaaS Platform", "description": "Led development of multi-tenant SaaS serving 100k+ users"},
            {"title": "Financial Trading System", "description": "Real-time trading platform processing millions of transactions"},
            {"title": "E-commerce Marketplace", "description": "Scalable marketplace handling $50M+ in transactions"},
            {"title": "Healthcare Management System", "description": "HIPAA-compliant system for 500+ healthcare providers"},
            {"title": "IoT Analytics Dashboard", "description": "Real-time analytics for 10k+ connected devices"}
        ],
        client_feedback={"rating": 4.98, "reviews_count": 247}
    )
    
    # Needs improvement profile
    needs_work = make_profile(
        title="Coder",
        overview="I code",
        skills=["Programming"],
        hourly_rate=15.0,
        experience_years=None,
        portfolio_items=[],
        client_feedback=None
    )
    
    return {
        "junior_developer": junior,
        "senior_expert": senior, 
        "needs_improvement": needs_work
    }


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)