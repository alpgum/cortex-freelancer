#!/usr/bin/env python3
"""
Unit tests for the Dynamic Rate Calculator
"""

import unittest
import sys
import os
from unittest.mock import patch, MagicMock

# Add tools directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))

from rate_calculator import RateCalculator, FreelancerProfile, ProjectDetails
from market_research import MarketResearchAPI, MarketRate, MarketTrend

class TestRateCalculator(unittest.TestCase):
    """Test cases for RateCalculator class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.calculator = RateCalculator()
        
        # Sample freelancer profile
        self.sample_profile = FreelancerProfile(
            name="Test Freelancer",
            primary_skill="web_development", 
            experience_years=3.5,
            skills=["web_development", "javascript", "react"],
            location="United States",
            cost_of_living="medium",
            desired_annual_income=75000,
            billable_hours_per_week=40,
            weeks_per_year=50,
            portfolio_quality="good",
            client_testimonials=8,
            platform_rating=4.6,
            completed_projects=25,
            specializations=["react", "e-commerce"],
            languages=["English"],
            certifications=["AWS Certified Developer"],
            preferred_platforms=["upwork", "direct_client"],
            current_rate=45.0
        )
        
        # Sample project
        self.sample_project = ProjectDetails(
            title="E-commerce Website Development",
            description="Build a modern e-commerce website with payment integration",
            complexity="complex",
            timeline_urgency="normal",
            estimated_hours=80,
            client_type="small_business",
            platform="upwork",
            skills_required=["web_development", "react", "e-commerce"],
            is_recurring=False,
            client_budget_range=(3000, 5000)
        )
    
    def test_calculate_experience_level(self):
        """Test experience level calculation"""
        # Test junior level
        junior_profile = FreelancerProfile(
            name="Junior Dev", primary_skill="web_development", experience_years=1.0,
            skills=[], location="US", cost_of_living="medium", desired_annual_income=50000,
            billable_hours_per_week=40, weeks_per_year=50, portfolio_quality="basic",
            client_testimonials=2, platform_rating=4.0, completed_projects=5,
            specializations=[], languages=["English"], certifications=[], preferred_platforms=["upwork"]
        )
        self.assertEqual(self.calculator.calculate_experience_level(junior_profile), "junior")
        
        # Test mid level
        mid_profile = self.sample_profile
        self.assertEqual(self.calculator.calculate_experience_level(mid_profile), "mid")
        
        # Test senior level
        senior_profile = FreelancerProfile(
            name="Senior Dev", primary_skill="web_development", experience_years=7.0,
            skills=["web_development"], location="US", cost_of_living="medium", desired_annual_income=120000,
            billable_hours_per_week=40, weeks_per_year=50, portfolio_quality="excellent",
            client_testimonials=20, platform_rating=4.9, completed_projects=75,
            specializations=["react", "node.js"], languages=["English"], certifications=["Multiple"],
            preferred_platforms=["upwork"]
        )
        self.assertEqual(self.calculator.calculate_experience_level(senior_profile), "senior")
    
    def test_get_market_rate_range(self):
        """Test market rate range calculation"""
        range_data = self.calculator.get_market_rate_range("web_development", "mid", "United States")
        
        self.assertIn("min", range_data)
        self.assertIn("median", range_data)
        self.assertIn("max", range_data)
        self.assertGreater(range_data["max"], range_data["median"])
        self.assertGreater(range_data["median"], range_data["min"])
    
    def test_calculate_target_hourly_rate(self):
        """Test target hourly rate calculation"""
        target_rate = self.calculator.calculate_target_hourly_rate(self.sample_profile)
        
        # Expected: (75000 * 1.35) / (40 * 50) = 50.625
        expected_rate = (75000 * 1.35) / (40 * 50)
        self.assertAlmostEqual(target_rate, expected_rate, places=1)
        self.assertGreater(target_rate, 40)  # Should be reasonable rate
    
    def test_apply_project_adjustments(self):
        """Test project-specific adjustments"""
        base_rate = 50.0
        adjusted_rate, reasoning = self.calculator.apply_project_adjustments(
            base_rate, self.sample_project, self.sample_profile
        )
        
        self.assertIsInstance(adjusted_rate, float)
        self.assertIsInstance(reasoning, list)
        self.assertGreater(len(reasoning), 0)  # Should have some reasoning
        
        # Complex project should increase rate
        self.assertGreater(adjusted_rate, base_rate)
    
    def test_quick_rate_assessment(self):
        """Test quick rate assessment functionality"""
        assessment = self.calculator.quick_rate_assessment(
            hourly_rate=60.0,
            skill="web_development", 
            experience_level="mid",
            location="United States"
        )
        
        self.assertIn("assessment", assessment)
        self.assertIn("message", assessment)
        self.assertIn("market_percentile", assessment)
        self.assertIn("recommendations", assessment)
        
        self.assertIn(assessment["assessment"], ["below_market", "competitive", "above_market", "premium"])
        self.assertIsInstance(assessment["market_percentile"], (int, float))
        self.assertIsInstance(assessment["recommendations"], list)
    
    def test_calculate_optimal_rates(self):
        """Test full rate calculation"""
        with patch.object(self.calculator.market_api, 'get_comprehensive_market_data') as mock_market:
            # Mock market data
            mock_market.return_value = {
                'market_statistics': {
                    'overall': {
                        'median': 55.0,
                        'avg': 58.0,
                        'min': 30.0,
                        'max': 100.0
                    }
                }
            }
            
            recommendation = self.calculator.calculate_optimal_rates(self.sample_profile, self.sample_project)
            
            self.assertIsNotNone(recommendation.hourly_rate)
            self.assertIsNotNone(recommendation.minimum_acceptable)
            self.assertIsNotNone(recommendation.target_rate)
            self.assertIsNotNone(recommendation.premium_rate)
            self.assertIsInstance(recommendation.reasoning, list)
            self.assertIsInstance(recommendation.negotiation_tips, list)
            
            # Sanity checks
            self.assertGreater(recommendation.hourly_rate, 0)
            self.assertLess(recommendation.minimum_acceptable, recommendation.target_rate)
            self.assertLess(recommendation.target_rate, recommendation.premium_rate)
            self.assertGreaterEqual(recommendation.confidence_score, 0)
            self.assertLessEqual(recommendation.confidence_score, 1)
    
    def test_assess_project_viability(self):
        """Test project viability assessment"""
        should_take, reasoning = self.calculator.assess_project_viability(
            rate=55.0,
            project=self.sample_project,
            profile=self.sample_profile
        )
        
        self.assertIsInstance(should_take, bool)
        self.assertIsInstance(reasoning, list)
        self.assertGreater(len(reasoning), 0)
    
    def test_save_and_load_user_preferences(self):
        """Test saving and loading user preferences"""
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as tmp:
            temp_file = tmp.name
        
        try:
            # Test saving
            self.calculator.save_user_preferences(self.sample_profile, temp_file)
            self.assertTrue(os.path.exists(temp_file))
            
            # Test loading
            loaded_profile = self.calculator.load_user_preferences(temp_file)
            self.assertIsNotNone(loaded_profile)
            self.assertEqual(loaded_profile.name, self.sample_profile.name)
            self.assertEqual(loaded_profile.primary_skill, self.sample_profile.primary_skill)
            self.assertEqual(loaded_profile.experience_years, self.sample_profile.experience_years)
            
        finally:
            # Clean up
            if os.path.exists(temp_file):
                os.unlink(temp_file)
    
    def test_regional_multiplier(self):
        """Test regional multiplier calculation"""
        # Test US (should be 1.0)
        us_multiplier = self.calculator._get_regional_multiplier("United States")
        self.assertEqual(us_multiplier, 1.0)
        
        # Test Canada (should be 0.85)
        canada_multiplier = self.calculator._get_regional_multiplier("Canada")
        self.assertEqual(canada_multiplier, 0.85)
        
        # Test unknown location (should default to 1.0)
        unknown_multiplier = self.calculator._get_regional_multiplier("Unknown Country")
        self.assertEqual(unknown_multiplier, 1.0)
    
    def test_value_based_pricing(self):
        """Test value-based pricing calculation"""
        # Create a high-value project
        value_project = ProjectDetails(
            title="Revenue Optimization System",
            description="Build automated system to increase sales conversion rates and reduce costs",
            complexity="complex",
            timeline_urgency="normal",
            estimated_hours=100,
            client_type="large_enterprise",
            platform="direct_client",
            skills_required=["web_development", "analytics"],
            is_recurring=False
        )
        
        value_rate = self.calculator.calculate_value_based_rate(value_project, 80.0)
        
        # Should return a value-based rate for this type of project
        self.assertIsNotNone(value_rate)
        self.assertGreater(value_rate, 100 * 80.0)  # Should be more than just hourly * hours
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        # Test with minimal profile
        minimal_profile = FreelancerProfile(
            name="Minimal", primary_skill="unknown_skill", experience_years=0,
            skills=[], location="Unknown", cost_of_living="medium", desired_annual_income=30000,
            billable_hours_per_week=10, weeks_per_year=30, portfolio_quality="basic",
            client_testimonials=0, platform_rating=0, completed_projects=0,
            specializations=[], languages=[], certifications=[], preferred_platforms=[]
        )
        
        # Should not crash
        recommendation = self.calculator.calculate_optimal_rates(minimal_profile)
        self.assertIsNotNone(recommendation)
        
        # Test with very high rates
        high_assessment = self.calculator.quick_rate_assessment(500.0, "web_development", "expert", "US")
        self.assertEqual(high_assessment["assessment"], "premium")

class TestMarketResearchAPI(unittest.TestCase):
    """Test cases for MarketResearchAPI class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.api = MarketResearchAPI()
    
    def test_fetch_rates(self):
        """Test fetching market rates"""
        rates = self.api.fetch_upwork_rates("web_development", "United States")
        
        self.assertIsInstance(rates, list)
        self.assertGreater(len(rates), 0)
        
        # Check first rate object
        if rates:
            rate = rates[0]
            self.assertIsInstance(rate.skill, str)
            self.assertIsInstance(rate.hourly_rate, (int, float))
            self.assertIn(rate.experience_level, ["junior", "mid", "senior", "expert"])
    
    def test_cache_functionality(self):
        """Test caching of market data"""
        # First call
        rates1 = self.api.fetch_upwork_rates("web_development", "US")
        
        # Second call should use cache
        rates2 = self.api.fetch_upwork_rates("web_development", "US")
        
        # Should be identical (from cache)
        self.assertEqual(len(rates1), len(rates2))
    
    def test_trend_analysis(self):
        """Test trend analysis"""
        trend = self.api.analyze_rate_trends("web_development", 30)
        
        self.assertIsInstance(trend, MarketTrend)
        self.assertIn(trend.trend_direction, ["up", "down", "stable"])
        self.assertIsInstance(trend.rate_change_percent, (int, float))
        self.assertGreater(trend.confidence_score, 0)
    
    def test_comprehensive_market_data(self):
        """Test comprehensive market data fetching"""
        data = self.api.get_comprehensive_market_data("web_development", "United States")
        
        self.assertIn("skill", data)
        self.assertIn("total_data_points", data)
        self.assertIn("market_statistics", data)
        self.assertIn("trend_analysis", data)
        self.assertGreater(data["total_data_points"], 0)

if __name__ == "__main__":
    # Run tests
    unittest.main(verbosity=2)