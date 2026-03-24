#!/usr/bin/env python3
"""
Dynamic Rate Calculator for Freelancers
Integrates market research data with personal factors to suggest optimal rates.
"""

import json
import os
import sys
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import math

# Add the current directory to path to import market_research
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from market_research import MarketResearchAPI, MarketRate, MarketTrend

@dataclass 
class FreelancerProfile:
    """Freelancer's profile and preferences"""
    name: str
    primary_skill: str
    experience_years: float
    skills: List[str]
    location: str
    cost_of_living: str  # very_low, low, medium, high, very_high
    desired_annual_income: float
    billable_hours_per_week: int
    weeks_per_year: int
    portfolio_quality: str  # basic, good, excellent, world_class
    client_testimonials: int
    platform_rating: float  # 0.0 - 5.0
    completed_projects: int
    specializations: List[str]
    languages: List[str]
    certifications: List[str]
    preferred_platforms: List[str]
    current_rate: Optional[float] = None

@dataclass
class ProjectDetails:
    """Details about a specific project for rate calculation"""
    title: str
    description: str
    complexity: str  # simple, standard, complex, enterprise, cutting_edge
    timeline_urgency: str  # relaxed, normal, rushed, urgent, emergency
    estimated_hours: int
    client_type: str  # individual, startup, small_business, medium_business, large_enterprise, fortune_500
    platform: str  # upwork, freelancer, fiverr, toptal, gun.io, direct_client
    skills_required: List[str]
    is_recurring: bool = False
    client_budget_range: Optional[Tuple[float, float]] = None
    geographic_restrictions: Optional[str] = None
    requires_nda: bool = False

@dataclass
class RateRecommendation:
    """Rate recommendation with reasoning"""
    hourly_rate: float
    project_rate: Optional[float]
    value_based_rate: Optional[float]
    minimum_acceptable: float
    target_rate: float
    premium_rate: float
    confidence_score: float
    reasoning: List[str]
    market_position: str  # below_market, at_market, above_market, premium
    should_take_project: bool
    negotiation_tips: List[str]
    alternative_pricing_models: List[str]

class RateCalculator:
    """Main rate calculator class"""
    
    def __init__(self, benchmarks_path: Optional[str] = None):
        """
        Initialize rate calculator
        
        Args:
            benchmarks_path: Path to rate benchmarks JSON file
        """
        self.market_api = MarketResearchAPI()
        
        # Load benchmark data
        if benchmarks_path is None:
            benchmarks_path = os.path.join(
                os.path.dirname(__file__), 
                '..', 
                'references', 
                'rate_benchmarks.json'
            )
        
        with open(benchmarks_path, 'r') as f:
            self.benchmarks = json.load(f)
    
    def calculate_experience_level(self, profile: FreelancerProfile) -> str:
        """
        Determine experience level based on multiple factors
        
        Args:
            profile: Freelancer profile
            
        Returns:
            Experience level: junior, mid, senior, expert
        """
        # Base score from years of experience
        if profile.experience_years < 1:
            base_score = 1
        elif profile.experience_years < 3:
            base_score = 2
        elif profile.experience_years < 6:
            base_score = 3
        else:
            base_score = 4
        
        # Adjust based on other factors
        adjustments = 0
        
        # Portfolio quality bonus
        portfolio_bonus = {
            'basic': 0,
            'good': 0.5,
            'excellent': 1.0,
            'world_class': 1.5
        }
        adjustments += portfolio_bonus.get(profile.portfolio_quality, 0)
        
        # Platform performance bonus
        if profile.platform_rating >= 4.8 and profile.completed_projects >= 50:
            adjustments += 1.0
        elif profile.platform_rating >= 4.5 and profile.completed_projects >= 20:
            adjustments += 0.5
        
        # Specialization bonus
        if len(profile.specializations) >= 2:
            adjustments += 0.5
        
        # Certification bonus
        if len(profile.certifications) >= 1:
            adjustments += 0.3
        
        final_score = base_score + adjustments
        
        if final_score < 2:
            return 'junior'
        elif final_score < 3.5:
            return 'mid'
        elif final_score < 5:
            return 'senior'
        else:
            return 'expert'
    
    def get_market_rate_range(self, skill: str, experience_level: str, location: str) -> Dict:
        """
        Get market rate range for skill/experience/location combination
        
        Args:
            skill: Primary skill
            experience_level: junior, mid, senior, expert
            location: Geographic location
            
        Returns:
            Dictionary with rate ranges
        """
        # Get base rates from benchmarks
        skill_data = self.benchmarks['skill_categories'].get(skill, {})
        if not skill_data:
            # Default to web development rates if skill not found
            skill_data = self.benchmarks['skill_categories']['web_development']
        
        level_rates = skill_data.get(experience_level, skill_data.get('mid', {}))
        
        # Apply regional multiplier
        regional_multiplier = self._get_regional_multiplier(location)
        
        base_min = level_rates.get('min', 20) * regional_multiplier
        base_median = level_rates.get('median', 50) * regional_multiplier  
        base_max = level_rates.get('max', 100) * regional_multiplier
        
        return {
            'min': round(base_min, 2),
            'median': round(base_median, 2),
            'max': round(base_max, 2),
            'trend': skill_data.get('trending', 'stable'),
            'demand_score': skill_data.get('demand_score', 7),
            'saturation_level': skill_data.get('saturation_level', 'medium')
        }
    
    def _get_regional_multiplier(self, location: str) -> float:
        """Get regional rate multiplier based on location"""
        location_lower = location.lower()
        
        for region, countries in self.benchmarks['regional_multipliers'].items():
            for country, multiplier in countries.items():
                if country.lower() in location_lower or country.replace('_', ' ') in location_lower:
                    return multiplier
        
        # Default to US rates if location not found
        return 1.0
    
    def calculate_target_hourly_rate(self, profile: FreelancerProfile) -> float:
        """
        Calculate target hourly rate based on desired income and availability
        
        Args:
            profile: Freelancer profile
            
        Returns:
            Target hourly rate to meet income goals
        """
        total_billable_hours = profile.billable_hours_per_week * profile.weeks_per_year
        
        # Account for taxes, expenses, and unbillable time (typically 20-30% overhead)
        overhead_multiplier = 1.35
        
        target_rate = (profile.desired_annual_income * overhead_multiplier) / total_billable_hours
        
        return round(target_rate, 2)
    
    def apply_project_adjustments(self, base_rate: float, project: ProjectDetails, profile: FreelancerProfile) -> Tuple[float, List[str]]:
        """
        Apply project-specific adjustments to base rate
        
        Args:
            base_rate: Base hourly rate
            project: Project details
            profile: Freelancer profile
            
        Returns:
            Tuple of (adjusted_rate, reasoning_list)
        """
        adjusted_rate = base_rate
        reasoning = []
        
        # Complexity adjustment
        complexity_multiplier = self.benchmarks['project_complexity_multipliers'].get(
            project.complexity, 1.0
        )
        if complexity_multiplier != 1.0:
            adjusted_rate *= complexity_multiplier
            reasoning.append(f"Project complexity ({project.complexity}): {complexity_multiplier:.1f}x multiplier")
        
        # Timeline urgency adjustment
        urgency_multiplier = self.benchmarks['timeline_urgency_multipliers'].get(
            project.timeline_urgency, 1.0
        )
        if urgency_multiplier != 1.0:
            adjusted_rate *= urgency_multiplier
            reasoning.append(f"Timeline urgency ({project.timeline_urgency}): {urgency_multiplier:.1f}x multiplier")
        
        # Client type adjustment
        client_multiplier = self.benchmarks['client_type_multipliers'].get(
            project.client_type, 1.0
        )
        if client_multiplier != 1.0:
            adjusted_rate *= client_multiplier
            reasoning.append(f"Client type ({project.client_type}): {client_multiplier:.1f}x multiplier")
        
        # Platform adjustment
        platform_multiplier = self.benchmarks['platform_rate_adjustments'].get(
            project.platform, 1.0
        )
        if platform_multiplier != 1.0:
            adjusted_rate *= platform_multiplier
            reasoning.append(f"Platform ({project.platform}): {platform_multiplier:.1f}x multiplier")
        
        # Specialization bonus
        required_specializations = set(project.skills_required) & set(profile.specializations)
        if required_specializations:
            spec_bonus = 1.1 + (0.05 * len(required_specializations))
            adjusted_rate *= spec_bonus
            reasoning.append(f"Specialization match: {spec_bonus:.2f}x multiplier")
        
        # Recurring work discount/stability bonus
        if project.is_recurring:
            adjusted_rate *= 0.95  # Small discount for guaranteed recurring work
            reasoning.append("Recurring work: 5% discount for stability")
        
        return round(adjusted_rate, 2), reasoning
    
    def calculate_value_based_rate(self, project: ProjectDetails, market_rate: float) -> Optional[float]:
        """
        Calculate value-based pricing for high-impact projects
        
        Args:
            project: Project details
            market_rate: Standard market hourly rate
            
        Returns:
            Value-based rate or None if not applicable
        """
        # Only calculate value-based pricing for certain project types
        value_keywords = [
            'revenue', 'sales', 'conversion', 'optimization', 'automation',
            'efficiency', 'cost reduction', 'roi', 'growth', 'launch'
        ]
        
        project_text = f"{project.title} {project.description}".lower()
        value_indicators = sum(1 for keyword in value_keywords if keyword in project_text)
        
        if value_indicators >= 2 and project.client_type in ['medium_business', 'large_enterprise', 'fortune_500']:
            # For high-value projects, charge 2-5x market rate
            value_multiplier = 2.0 + (value_indicators * 0.5)
            value_rate = market_rate * min(value_multiplier, 5.0)
            
            # Convert to project rate instead of hourly
            project_rate = value_rate * project.estimated_hours
            
            return round(project_rate, 2)
        
        return None
    
    def assess_project_viability(self, rate: float, project: ProjectDetails, profile: FreelancerProfile) -> Tuple[bool, List[str]]:
        """
        Assess whether a project is worth taking at the calculated rate
        
        Args:
            rate: Proposed hourly rate
            project: Project details
            profile: Freelancer profile
            
        Returns:
            Tuple of (should_take, reasoning)
        """
        target_rate = self.calculate_target_hourly_rate(profile)
        reasoning = []
        
        # Financial viability
        if rate >= target_rate * 0.8:
            reasoning.append("✅ Rate meets 80% of income target")
            financial_score = 1
        elif rate >= target_rate * 0.6:
            reasoning.append("⚠️ Rate is below target but acceptable short-term")
            financial_score = 0.5
        else:
            reasoning.append("❌ Rate is significantly below income needs")
            financial_score = 0
        
        # Skill match
        skill_match = len(set(project.skills_required) & set(profile.skills)) / len(project.skills_required)
        if skill_match >= 0.8:
            reasoning.append("✅ Strong skill match")
            skill_score = 1
        elif skill_match >= 0.5:
            reasoning.append("⚠️ Partial skill match - some learning required")
            skill_score = 0.7
        else:
            reasoning.append("❌ Poor skill match - significant learning curve")
            skill_score = 0.3
        
        # Client quality indicators
        if project.client_type in ['large_enterprise', 'fortune_500']:
            reasoning.append("✅ High-quality client type")
            client_score = 1
        elif project.client_type in ['medium_business', 'small_business']:
            reasoning.append("✅ Decent client type")
            client_score = 0.8
        elif project.client_type == 'startup':
            reasoning.append("⚠️ Startup client - verify funding")
            client_score = 0.6
        else:
            reasoning.append("⚠️ Individual client - assess carefully")
            client_score = 0.5
        
        # Timeline assessment
        if project.timeline_urgency in ['urgent', 'emergency']:
            reasoning.append("⚠️ Very tight timeline - assess workload")
            timeline_score = 0.7
        elif project.timeline_urgency == 'rushed':
            reasoning.append("⚠️ Rushed timeline")
            timeline_score = 0.8
        else:
            reasoning.append("✅ Reasonable timeline")
            timeline_score = 1
        
        # Overall score
        overall_score = (financial_score * 0.4 + skill_score * 0.3 + client_score * 0.2 + timeline_score * 0.1)
        
        should_take = overall_score >= 0.6
        
        if not should_take:
            reasoning.append(f"❌ Overall project score: {overall_score:.1f}/1.0 (below 0.6 threshold)")
        else:
            reasoning.append(f"✅ Overall project score: {overall_score:.1f}/1.0")
        
        return should_take, reasoning
    
    def generate_negotiation_tips(self, rate: float, market_data: Dict, project: ProjectDetails) -> List[str]:
        """Generate negotiation tips based on rate and market position"""
        tips = []
        
        market_median = market_data['median']
        
        if rate > market_median * 1.2:
            tips.append("Lead with unique value proposition - explain why you charge premium")
            tips.append("Provide case studies or testimonials showing ROI")
            tips.append("Offer flexible payment terms or milestone structure")
        elif rate > market_median:
            tips.append("Emphasize specialization and experience")
            tips.append("Mention similar successful projects")
            tips.append("Be confident but flexible on scope")
        else:
            tips.append("Focus on reliability and communication skills")
            tips.append("Offer quick turnaround or revisions")
            tips.append("Consider offering small test project at this rate")
        
        if project.timeline_urgency in ['urgent', 'emergency']:
            tips.append("Justify urgency premium - explain resource reallocation")
            tips.append("Offer dedicated time slots")
        
        if project.complexity in ['complex', 'enterprise', 'cutting_edge']:
            tips.append("Break down complexity factors")
            tips.append("Explain methodology and risk mitigation")
        
        return tips
    
    def calculate_optimal_rates(self, profile: FreelancerProfile, project: Optional[ProjectDetails] = None) -> RateRecommendation:
        """
        Calculate optimal rate recommendations
        
        Args:
            profile: Freelancer profile
            project: Optional project details for project-specific recommendations
            
        Returns:
            RateRecommendation object
        """
        print(f"🔢 Calculating rates for {profile.name}...")
        
        # Determine experience level
        experience_level = self.calculate_experience_level(profile)
        print(f"   Experience level: {experience_level}")
        
        # Get market data
        market_range = self.get_market_rate_range(profile.primary_skill, experience_level, profile.location)
        print(f"   Market range: ${market_range['min']}-${market_range['max']}/hr (median: ${market_range['median']})")
        
        # Fetch real-time market data
        try:
            live_market_data = self.market_api.get_comprehensive_market_data(profile.primary_skill, profile.location)
            live_median = live_market_data['market_statistics']['overall']['median']
            print(f"   Live market median: ${live_median}/hr")
            
            # Blend benchmark and live data
            blended_median = (market_range['median'] + live_median) / 2
        except:
            blended_median = market_range['median']
            print(f"   Using benchmark data (live data unavailable)")
        
        # Calculate target rate based on income goals
        target_rate = self.calculate_target_hourly_rate(profile)
        print(f"   Target rate for income goal: ${target_rate}/hr")
        
        # Use the higher of market median or target rate as base
        base_rate = max(blended_median, target_rate)
        
        # Apply cost of living adjustment
        col_multiplier = self.benchmarks['cost_of_living_adjustments'].get(profile.cost_of_living, 1.0)
        base_rate *= col_multiplier
        
        reasoning = [
            f"Experience level: {experience_level}",
            f"Market median for {profile.primary_skill}: ${blended_median}/hr",
            f"Target rate for ${profile.desired_annual_income:,.0f} annual income: ${target_rate}/hr",
            f"Cost of living adjustment ({profile.cost_of_living}): {col_multiplier:.2f}x"
        ]
        
        # Apply project-specific adjustments if project provided
        if project:
            adjusted_rate, project_reasoning = self.apply_project_adjustments(base_rate, project, profile)
            reasoning.extend(project_reasoning)
            
            # Calculate project rate
            project_rate = adjusted_rate * project.estimated_hours
            
            # Calculate value-based rate
            value_based_rate = self.calculate_value_based_rate(project, adjusted_rate)
            
            # Assess project viability
            should_take, viability_reasoning = self.assess_project_viability(adjusted_rate, project, profile)
            reasoning.extend(viability_reasoning)
            
            # Generate negotiation tips
            negotiation_tips = self.generate_negotiation_tips(adjusted_rate, market_range, project)
        else:
            adjusted_rate = base_rate
            project_rate = None
            value_based_rate = None
            should_take = True
            negotiation_tips = []
        
        # Calculate rate ranges
        minimum_acceptable = adjusted_rate * 0.75  # 25% below target
        target_rate_final = adjusted_rate
        premium_rate = adjusted_rate * 1.3  # 30% above target
        
        # Determine market position
        if adjusted_rate > blended_median * 1.2:
            market_position = "premium"
        elif adjusted_rate > blended_median * 1.05:
            market_position = "above_market"
        elif adjusted_rate > blended_median * 0.95:
            market_position = "at_market"
        else:
            market_position = "below_market"
        
        # Calculate confidence score based on data quality and market factors
        confidence_factors = [
            min(profile.completed_projects / 20, 1.0),  # Experience
            min(profile.platform_rating / 5.0, 1.0),   # Reputation
            1.0 if market_range['demand_score'] >= 7 else 0.8,  # Market demand
            1.0 if project and len(set(project.skills_required) & set(profile.skills)) >= 2 else 0.9  # Skill match
        ]
        confidence_score = sum(confidence_factors) / len(confidence_factors)
        
        # Alternative pricing models
        alternative_models = []
        if project:
            if project.is_recurring:
                alternative_models.append(f"Monthly retainer: ${adjusted_rate * 40:.0f}/month for 10 hours")
            if project.complexity in ['simple', 'standard']:
                alternative_models.append(f"Fixed project rate: ${project_rate:.0f}")
            if value_based_rate:
                alternative_models.append(f"Value-based pricing: ${value_based_rate:.0f} (based on project impact)")
        
        return RateRecommendation(
            hourly_rate=round(adjusted_rate, 2),
            project_rate=round(project_rate, 2) if project_rate else None,
            value_based_rate=value_based_rate,
            minimum_acceptable=round(minimum_acceptable, 2),
            target_rate=round(target_rate_final, 2),
            premium_rate=round(premium_rate, 2),
            confidence_score=round(confidence_score, 2),
            reasoning=reasoning,
            market_position=market_position,
            should_take_project=should_take if project else True,
            negotiation_tips=negotiation_tips,
            alternative_pricing_models=alternative_models
        )
    
    def save_user_preferences(self, profile: FreelancerProfile, file_path: str = "user_rate_preferences.json"):
        """Save user rate preferences for personalization"""
        preferences = {
            'profile': asdict(profile),
            'last_updated': datetime.now().isoformat()
        }
        
        with open(file_path, 'w') as f:
            json.dump(preferences, f, indent=2)
        
        print(f"✅ User preferences saved to {file_path}")
    
    def load_user_preferences(self, file_path: str = "user_rate_preferences.json") -> Optional[FreelancerProfile]:
        """Load user rate preferences"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            profile_data = data['profile']
            return FreelancerProfile(**profile_data)
        except FileNotFoundError:
            return None
    
    def quick_rate_assessment(self, hourly_rate: float, skill: str, experience_level: str, location: str = "") -> Dict:
        """
        Quick assessment of whether a proposed rate is competitive
        
        Args:
            hourly_rate: Proposed hourly rate
            skill: Skill category
            experience_level: junior, mid, senior, expert
            location: Location
            
        Returns:
            Assessment dictionary
        """
        market_range = self.get_market_rate_range(skill, experience_level, location)
        
        if hourly_rate < market_range['min']:
            assessment = "below_market"
            message = "Rate is below market minimum - consider raising"
        elif hourly_rate <= market_range['median']:
            assessment = "competitive"
            message = "Rate is competitive for the market"
        elif hourly_rate <= market_range['max']:
            assessment = "above_market"
            message = "Rate is above market median - ensure value justification"
        else:
            assessment = "premium"
            message = "Premium rate - requires strong value proposition"
        
        percentile = ((hourly_rate - market_range['min']) / (market_range['max'] - market_range['min'])) * 100
        percentile = max(0, min(100, percentile))
        
        return {
            'assessment': assessment,
            'message': message,
            'market_percentile': round(percentile, 1),
            'market_range': market_range,
            'recommendations': self._get_rate_recommendations(assessment, hourly_rate, market_range)
        }
    
    def _get_rate_recommendations(self, assessment: str, rate: float, market_range: Dict) -> List[str]:
        """Get recommendations based on rate assessment"""
        recommendations = []
        
        if assessment == "below_market":
            recommendations.extend([
                f"Consider raising to ${market_range['median']}/hr (market median)",
                "Review portfolio and highlight best work",
                "Collect client testimonials to justify higher rates"
            ])
        elif assessment == "competitive":
            recommendations.extend([
                "Rate is well-positioned for consistent work",
                "Focus on building reputation and client relationships",
                f"Target ${market_range['max']}/hr as next milestone"
            ])
        elif assessment == "above_market":
            recommendations.extend([
                "Prepare clear value proposition",
                "Emphasize unique skills or specializations",
                "Consider offering payment plans or milestone structure"
            ])
        else:  # premium
            recommendations.extend([
                "Ensure portfolio demonstrates exceptional quality",
                "Target enterprise clients or specialized niches",
                "Be prepared to justify premium with ROI examples"
            ])
        
        return recommendations

# Command-line interface
def main():
    """Command-line interface for rate calculator"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Dynamic Rate Calculator for Freelancers")
    parser.add_argument('--skill', required=True, help='Primary skill (e.g., web_development)')
    parser.add_argument('--experience', type=float, default=2.0, help='Years of experience')
    parser.add_argument('--location', default='United States', help='Location')
    parser.add_argument('--income-target', type=float, default=75000, help='Desired annual income')
    parser.add_argument('--hours-per-week', type=int, default=40, help='Billable hours per week')
    parser.add_argument('--quick-assessment', type=float, help='Quick rate assessment for given hourly rate')
    
    args = parser.parse_args()
    
    calculator = RateCalculator()
    
    if args.quick_assessment:
        # Quick assessment mode
        experience_level = 'mid' if args.experience >= 3 else 'junior'
        if args.experience >= 6:
            experience_level = 'senior'
        
        result = calculator.quick_rate_assessment(
            args.quick_assessment, 
            args.skill, 
            experience_level, 
            args.location
        )
        
        print(f"💰 Rate Assessment for ${args.quick_assessment}/hr")
        print(f"   Assessment: {result['assessment']}")
        print(f"   Market percentile: {result['market_percentile']}%")
        print(f"   {result['message']}")
        print("\n📋 Recommendations:")
        for rec in result['recommendations']:
            print(f"   • {rec}")
    else:
        # Full calculation mode
        profile = FreelancerProfile(
            name="Demo User",
            primary_skill=args.skill,
            experience_years=args.experience,
            skills=[args.skill],
            location=args.location,
            cost_of_living='medium',
            desired_annual_income=args.income_target,
            billable_hours_per_week=args.hours_per_week,
            weeks_per_year=50,
            portfolio_quality='good',
            client_testimonials=5,
            platform_rating=4.5,
            completed_projects=15,
            specializations=[],
            languages=['English'],
            certifications=[],
            preferred_platforms=['upwork']
        )
        
        recommendation = calculator.calculate_optimal_rates(profile)
        
        print(f"\n💰 Rate Recommendations:")
        print(f"   Target hourly rate: ${recommendation.hourly_rate}/hr")
        print(f"   Range: ${recommendation.minimum_acceptable} - ${recommendation.premium_rate}/hr")
        print(f"   Market position: {recommendation.market_position}")
        print(f"   Confidence: {recommendation.confidence_score:.1%}")
        
        print(f"\n🎯 Reasoning:")
        for reason in recommendation.reasoning:
            print(f"   • {reason}")

if __name__ == "__main__":
    main()