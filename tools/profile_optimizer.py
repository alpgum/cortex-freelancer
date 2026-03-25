#!/usr/bin/env python3
"""
Profile Optimizer — Comprehensive Freelancer Profile Optimization Tool

Features:
1. Profile Analysis Engine - Analyze completeness, keyword density, positioning strength
2. SEO Keyword Research - High-value keywords, trends, placement suggestions  
3. Positioning Recommendations - Competitor analysis, unique value propositions
4. Title & Overview Optimizer - SEO-optimized content with A/B testing suggestions
5. Skills Tag Optimization - Market demand-based recommendations
6. Profile Scoring - 0-100 scoring across categories: completeness, SEO, positioning, differentiation
"""

import json
import os
import sys
import re
import argparse
import math
from dataclasses import dataclass, asdict, field
from typing import Dict, List, Optional, Tuple, Set
from enum import Enum
from collections import Counter, defaultdict


# ---------------------------------------------------------------------------
# Enums & Data Classes
# ---------------------------------------------------------------------------

class Platform(str, Enum):
    UPWORK = "upwork"
    FIVERR = "fiverr" 
    LINKEDIN = "linkedin"
    FREELANCER = "freelancer"


class ExperienceLevel(str, Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    EXPERT = "expert"


class ContentTone(str, Enum):
    PROFESSIONAL = "professional"
    CONVERSATIONAL = "conversational"
    TECHNICAL = "technical"
    CREATIVE = "creative"


@dataclass
class FreelancerProfile:
    """Represents a freelancer profile across platforms"""
    title: str = ""
    overview: str = ""
    skills: List[str] = field(default_factory=list)
    hourly_rate: Optional[float] = None
    experience_years: Optional[int] = None
    certifications: List[str] = field(default_factory=list)
    portfolio_items: List[Dict] = field(default_factory=list)
    languages: List[str] = field(default_factory=list)
    education: List[Dict] = field(default_factory=list)
    employment_history: List[Dict] = field(default_factory=list)
    client_feedback: Optional[Dict] = None  # {rating, reviews_count, testimonials}
    platform_specific: Dict = field(default_factory=dict)  # Platform-specific fields


@dataclass
class KeywordData:
    """SEO keyword information"""
    keyword: str
    search_volume: int
    competition_level: str  # low, medium, high
    relevance_score: float  # 0-1
    placement_suggestions: List[str]  # title, overview, skills, etc.
    related_keywords: List[str]


@dataclass
class CompetitorProfile:
    """Competitor analysis data"""
    title: str
    hourly_rate: Optional[float]
    total_earnings: Optional[float]
    job_success_score: Optional[int]
    reviews_count: int
    skills: List[str]
    key_differentiators: List[str]
    strengths: List[str]
    weaknesses: List[str]


@dataclass
class OptimizedContent:
    """Optimized profile content suggestions"""
    title_variants: List[str]
    overview_variants: List[str] 
    skills_recommendations: List[str]
    keyword_integration: Dict[str, List[str]]  # section -> keywords
    a_b_test_suggestions: List[Dict]


@dataclass
class ProfileScore:
    """Profile scoring breakdown"""
    overall_score: int  # 0-100
    category_scores: Dict[str, int]  # completeness, seo_strength, positioning, differentiation
    improvement_areas: List[str]
    strengths: List[str]
    score_explanation: Dict[str, str]


@dataclass
class AnalysisResult:
    """Complete profile analysis result"""
    profile_score: ProfileScore
    keyword_research: List[KeywordData]
    competitor_analysis: List[CompetitorProfile]
    optimized_content: OptimizedContent
    positioning_recommendations: List[str]
    action_plan: List[Dict[str, str]]  # priority, action, impact


# ---------------------------------------------------------------------------
# Core Analysis Engine
# ---------------------------------------------------------------------------

class ProfileAnalysisEngine:
    """Main engine for analyzing freelancer profiles"""
    
    def __init__(self):
        self.keyword_db = self._load_keyword_database()
        self.market_data = self._load_market_data()
        
    def analyze_profile(self, profile: FreelancerProfile, platform: Platform = Platform.UPWORK) -> AnalysisResult:
        """Main analysis method - orchestrates all analysis components"""
        
        # Core analysis components
        score_engine = ScoringEngine(platform)
        keyword_engine = SEOKeywordEngine()
        competitor_engine = CompetitorAnalysisEngine(platform)
        content_optimizer = ContentOptimizer()
        positioning_engine = PositioningEngine()
        
        # Run analysis
        profile_score = score_engine.score_profile(profile)
        
        # Detect niche from profile
        detected_niche = self._detect_niche(profile)
        
        # Keyword research
        keyword_research = keyword_engine.research_keywords(detected_niche, platform)
        
        # Competitor analysis  
        competitor_analysis = competitor_engine.analyze_competitors(detected_niche, profile, platform)
        
        # Content optimization
        optimized_content = content_optimizer.optimize_content(
            profile, keyword_research, competitor_analysis
        )
        
        # Positioning recommendations
        positioning_recommendations = positioning_engine.generate_recommendations(
            profile, competitor_analysis, keyword_research
        )
        
        # Action plan
        action_plan = self._generate_action_plan(
            profile_score, keyword_research, competitor_analysis, positioning_recommendations
        )
        
        return AnalysisResult(
            profile_score=profile_score,
            keyword_research=keyword_research,
            competitor_analysis=competitor_analysis,
            optimized_content=optimized_content,
            positioning_recommendations=positioning_recommendations,
            action_plan=action_plan
        )
    
    def _detect_niche(self, profile: FreelancerProfile) -> str:
        """Auto-detect freelancer niche from profile data"""
        
        # Combine all text for analysis
        text_content = " ".join([
            profile.title,
            profile.overview,
            " ".join(profile.skills),
            " ".join([item.get('title', '') for item in profile.portfolio_items])
        ]).lower()
        
        # Niche keywords mapping
        niche_keywords = {
            'web-development': ['react', 'angular', 'vue', 'javascript', 'html', 'css', 'node.js', 'frontend', 'backend', 'fullstack'],
            'mobile-development': ['ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'mobile app'],
            'data-science': ['python', 'machine learning', 'data analysis', 'pandas', 'tensorflow', 'sql', 'analytics'],
            'graphic-design': ['photoshop', 'illustrator', 'logo design', 'branding', 'ui design', 'graphic'],
            'content-writing': ['copywriting', 'blog writing', 'content creation', 'seo writing', 'technical writing'],
            'digital-marketing': ['google ads', 'facebook ads', 'seo', 'social media', 'email marketing', 'ppc'],
            'video-editing': ['after effects', 'premiere pro', 'video editing', 'motion graphics', 'animation'],
            'wordpress': ['wordpress', 'woocommerce', 'elementor', 'wp', 'cms'],
            'translation': ['translation', 'localization', 'multilingual', 'interpreter']
        }
        
        # Score each niche
        niche_scores = {}
        for niche, keywords in niche_keywords.items():
            score = sum(1 for keyword in keywords if keyword in text_content)
            niche_scores[niche] = score
        
        # Return highest scoring niche
        return max(niche_scores.items(), key=lambda x: x[1])[0] if niche_scores else 'web-development'
    
    def _generate_action_plan(self, score: ProfileScore, keywords: List[KeywordData], 
                            competitors: List[CompetitorProfile], positioning: List[str]) -> List[Dict[str, str]]:
        """Generate prioritized action plan"""
        
        actions = []
        
        # High priority actions based on low scores
        if score.category_scores.get('completeness', 100) < 70:
            actions.append({
                'priority': 'HIGH',
                'action': 'Complete missing profile sections',
                'impact': 'Increases visibility and client trust by 20-30%',
                'time_estimate': '2-3 hours'
            })
        
        if score.category_scores.get('seo_strength', 100) < 60:
            top_keywords = [kw.keyword for kw in keywords[:5]]
            actions.append({
                'priority': 'HIGH', 
                'action': f'Integrate top keywords: {", ".join(top_keywords)}',
                'impact': 'Improves search ranking and discovery',
                'time_estimate': '1-2 hours'
            })
        
        if score.category_scores.get('positioning', 100) < 65:
            actions.append({
                'priority': 'MEDIUM',
                'action': 'Refine unique value proposition',
                'impact': 'Reduces price competition, increases perceived value',
                'time_estimate': '3-4 hours'
            })
        
        if score.category_scores.get('differentiation', 100) < 60:
            actions.append({
                'priority': 'MEDIUM',
                'action': 'Highlight unique differentiators vs competitors',
                'impact': 'Stands out in crowded marketplace',
                'time_estimate': '2-3 hours'
            })
        
        # Always include content refresh
        actions.append({
            'priority': 'LOW',
            'action': 'A/B test optimized title and overview variations',
            'impact': 'Continuous improvement of conversion rates',
            'time_estimate': '1 hour setup + ongoing monitoring'
        })
        
        return actions
    
    def _load_keyword_database(self) -> Dict:
        """Load keyword database (in production, this would be from a real DB)"""
        return {
            'web-development': {
                'high_value': ['react developer', 'full stack developer', 'javascript expert', 'node.js specialist'],
                'medium_value': ['frontend developer', 'backend developer', 'web app developer'],
                'long_tail': ['react ecommerce developer', 'javascript api integration specialist']
            },
            'mobile-development': {
                'high_value': ['ios developer', 'android developer', 'react native developer', 'flutter expert'],
                'medium_value': ['mobile app developer', 'cross platform developer'],
                'long_tail': ['ios ecommerce app developer', 'android fintech specialist']
            }
        }
    
    def _load_market_data(self) -> Dict:
        """Load market data for competitive analysis"""
        return {
            'average_rates': {
                'web-development': {'junior': 25, 'mid': 45, 'senior': 75, 'expert': 100},
                'mobile-development': {'junior': 30, 'mid': 50, 'senior': 80, 'expert': 120}
            },
            'skill_demand': {
                'react': 0.95, 'javascript': 0.90, 'python': 0.85, 'ios': 0.80
            }
        }


# ---------------------------------------------------------------------------
# SEO Keyword Research Engine
# ---------------------------------------------------------------------------

class SEOKeywordEngine:
    """Research and analyze SEO keywords for freelancer profiles"""
    
    def research_keywords(self, niche: str, platform: Platform, limit: int = 20) -> List[KeywordData]:
        """Research high-value keywords for the given niche"""
        
        # Simulated keyword data (in production, integrate with real keyword APIs)
        keyword_database = {
            'web-development': [
                ('react developer', 8500, 'high', 0.95, ['title', 'overview']),
                ('full stack developer', 12000, 'high', 0.90, ['title', 'skills']),
                ('javascript expert', 6500, 'medium', 0.85, ['title', 'overview', 'skills']),
                ('node.js specialist', 4200, 'medium', 0.80, ['title', 'skills']),
                ('frontend developer', 15000, 'high', 0.75, ['title', 'overview']),
                ('react hooks', 3800, 'low', 0.70, ['overview', 'skills']),
                ('responsive web design', 7200, 'medium', 0.85, ['overview', 'skills']),
                ('api integration', 5500, 'medium', 0.80, ['overview', 'skills']),
                ('ecommerce developer', 4800, 'medium', 0.90, ['title', 'overview']),
                ('react native', 6200, 'medium', 0.85, ['title', 'skills'])
            ],
            'mobile-development': [
                ('ios developer', 9500, 'high', 0.95, ['title', 'overview']),
                ('android developer', 8800, 'high', 0.90, ['title', 'overview']),
                ('react native developer', 6200, 'medium', 0.85, ['title', 'skills']),
                ('flutter developer', 5800, 'medium', 0.88, ['title', 'skills']),
                ('mobile app developer', 18000, 'high', 0.80, ['title', 'overview']),
                ('swift developer', 4500, 'medium', 0.82, ['title', 'skills']),
                ('kotlin developer', 3800, 'medium', 0.78, ['title', 'skills']),
                ('cross platform', 4200, 'medium', 0.75, ['overview', 'skills']),
                ('mobile ui/ux', 5200, 'medium', 0.85, ['overview', 'skills']),
                ('app store optimization', 2800, 'low', 0.80, ['overview'])
            ],
            'data-science': [
                ('python developer', 11000, 'high', 0.90, ['title', 'overview']),
                ('data scientist', 13500, 'high', 0.95, ['title', 'overview']),
                ('machine learning', 8500, 'medium', 0.85, ['title', 'skills']),
                ('data analysis', 9200, 'medium', 0.80, ['overview', 'skills']),
                ('pandas expert', 3500, 'low', 0.75, ['skills']),
                ('tensorflow', 4200, 'medium', 0.82, ['skills']),
                ('sql developer', 7800, 'medium', 0.78, ['title', 'skills']),
                ('data visualization', 5500, 'medium', 0.80, ['overview', 'skills']),
                ('statistical analysis', 4800, 'medium', 0.85, ['overview', 'skills']),
                ('deep learning', 6200, 'medium', 0.88, ['title', 'skills'])
            ]
        }
        
        niche_keywords = keyword_database.get(niche, keyword_database['web-development'])
        
        keywords = []
        for keyword, volume, competition, relevance, placements in niche_keywords[:limit]:
            
            # Generate related keywords
            related = self._generate_related_keywords(keyword, niche)
            
            keywords.append(KeywordData(
                keyword=keyword,
                search_volume=volume,
                competition_level=competition,
                relevance_score=relevance,
                placement_suggestions=placements,
                related_keywords=related
            ))
        
        # Sort by relevance score and search volume
        keywords.sort(key=lambda x: (x.relevance_score * math.log(x.search_volume)), reverse=True)
        
        return keywords
    
    def _generate_related_keywords(self, main_keyword: str, niche: str) -> List[str]:
        """Generate related keywords for better SEO coverage"""
        
        related_patterns = {
            'web-development': {
                'react developer': ['react consultant', 'react specialist', 'react freelancer'],
                'full stack developer': ['full stack consultant', 'full stack engineer', 'mern developer'],
                'javascript expert': ['js developer', 'javascript freelancer', 'javascript consultant']
            },
            'mobile-development': {
                'ios developer': ['ios consultant', 'ios freelancer', 'swift developer'],
                'android developer': ['android consultant', 'kotlin developer', 'android freelancer']
            }
        }
        
        niche_patterns = related_patterns.get(niche, {})
        return niche_patterns.get(main_keyword, [])
    
    def analyze_keyword_density(self, text: str, keywords: List[str]) -> Dict[str, float]:
        """Analyze keyword density in given text"""
        
        text_lower = text.lower()
        word_count = len(text.split())
        
        density = {}
        for keyword in keywords:
            keyword_lower = keyword.lower()
            occurrences = text_lower.count(keyword_lower)
            density[keyword] = (occurrences / word_count) * 100 if word_count > 0 else 0
        
        return density
    
    def suggest_keyword_placement(self, profile: FreelancerProfile, keywords: List[KeywordData]) -> Dict[str, List[str]]:
        """Suggest optimal keyword placement across profile sections"""
        
        placement_suggestions = {
            'title': [],
            'overview': [],
            'skills': [],
            'portfolio': []
        }
        
        for keyword_data in keywords:
            for placement in keyword_data.placement_suggestions:
                if placement in placement_suggestions:
                    placement_suggestions[placement].append(keyword_data.keyword)
        
        return placement_suggestions


# ---------------------------------------------------------------------------
# Competitor Analysis Engine
# ---------------------------------------------------------------------------

class CompetitorAnalysisEngine:
    """Analyze competitors and market positioning"""
    
    def __init__(self, platform: Platform):
        self.platform = platform
        
    def analyze_competitors(self, niche: str, user_profile: FreelancerProfile, 
                          platform: Platform, top_count: int = 10) -> List[CompetitorProfile]:
        """Analyze top competitors in the niche"""
        
        # Simulated competitor data (in production, scrape from platforms)
        competitors_data = {
            'web-development': [
                {
                    'title': 'Senior Full Stack React Developer | 500+ Projects Completed',
                    'hourly_rate': 65.0,
                    'total_earnings': 250000,
                    'job_success_score': 98,
                    'reviews_count': 147,
                    'skills': ['React', 'Node.js', 'MongoDB', 'Express', 'JavaScript', 'TypeScript'],
                    'key_differentiators': ['500+ projects', '7 years experience', 'Enterprise clients'],
                    'strengths': ['High volume delivery', 'Enterprise experience', 'Full stack expertise'],
                    'weaknesses': ['Premium pricing', 'Limited availability']
                },
                {
                    'title': 'React & Node.js Expert - Fast Delivery & Quality Code',
                    'hourly_rate': 45.0,
                    'total_earnings': 120000,
                    'job_success_score': 95,
                    'reviews_count': 89,
                    'skills': ['React', 'Node.js', 'JavaScript', 'AWS', 'Docker', 'PostgreSQL'],
                    'key_differentiators': ['Fast delivery', 'Quality focus', '24/7 availability'],
                    'strengths': ['Quick turnaround', 'Modern tech stack', 'Good communication'],
                    'weaknesses': ['Mid-level pricing', 'Limited design skills']
                },
                {
                    'title': 'Full Stack JavaScript Developer | MERN Stack Specialist',
                    'hourly_rate': 38.0,
                    'total_earnings': 85000,
                    'job_success_score': 93,
                    'reviews_count': 62,
                    'skills': ['React', 'MongoDB', 'Express', 'Node.js', 'JavaScript', 'Redux'],
                    'key_differentiators': ['MERN specialization', 'Startup experience', 'Agile methodology'],
                    'strengths': ['Specialized stack', 'Startup experience', 'Agile practices'],
                    'weaknesses': ['Limited portfolio', 'Newer to platform']
                }
            ],
            'mobile-development': [
                {
                    'title': 'Senior iOS Developer | Published 50+ Apps on App Store',
                    'hourly_rate': 75.0,
                    'total_earnings': 180000,
                    'job_success_score': 99,
                    'reviews_count': 95,
                    'skills': ['Swift', 'SwiftUI', 'Objective-C', 'Core Data', 'CloudKit', 'ARKit'],
                    'key_differentiators': ['50+ published apps', 'App Store expertise', 'AR experience'],
                    'strengths': ['Proven track record', 'App Store optimization', 'Cutting-edge tech'],
                    'weaknesses': ['Premium pricing', 'iOS only focus']
                },
                {
                    'title': 'Cross-Platform Mobile Developer | React Native & Flutter Expert',
                    'hourly_rate': 55.0,
                    'total_earnings': 95000,
                    'job_success_score': 96,
                    'reviews_count': 73,
                    'skills': ['React Native', 'Flutter', 'Dart', 'JavaScript', 'Firebase', 'Redux'],
                    'key_differentiators': ['Cross-platform expertise', 'Cost-effective solutions', 'Modern frameworks'],
                    'strengths': ['Dual platform expertise', 'Cost efficiency', 'Modern tech'],
                    'weaknesses': ['Less native experience', 'Framework limitations']
                }
            ]
        }
        
        niche_competitors = competitors_data.get(niche, competitors_data['web-development'])
        
        competitors = []
        for comp_data in niche_competitors[:top_count]:
            competitors.append(CompetitorProfile(**comp_data))
        
        return competitors
    
    def identify_market_gaps(self, competitors: List[CompetitorProfile], user_profile: FreelancerProfile) -> List[str]:
        """Identify gaps in the market that user can exploit"""
        
        gaps = []
        
        # Analyze competitor weaknesses
        common_weaknesses = []
        for competitor in competitors:
            common_weaknesses.extend(competitor.weaknesses)
        
        weakness_counts = Counter(common_weaknesses)
        
        # Identify common pain points
        # Use proportion-based thresholds so small samples still work
        premium_pricing = weakness_counts.get('Premium pricing', 0)
        limited_availability = weakness_counts.get('Limited availability', 0)
        limited_design = weakness_counts.get('Limited design skills', 0)
        
        if competitors and premium_pricing / len(competitors) >= 0.6:
            gaps.append('Affordable high-quality solutions for budget-conscious clients')
        
        if competitors and limited_availability / len(competitors) >= 0.4:
            gaps.append('24/7 availability and quick response times')
        
        if competitors and limited_design / len(competitors) >= 0.4:
            gaps.append('Full-service development with strong UI/UX design capabilities')
        
        # Skill gap analysis
        all_competitor_skills = []
        for competitor in competitors:
            all_competitor_skills.extend(competitor.skills)
        
        skill_counts = Counter(all_competitor_skills)
        emerging_skills = ['TypeScript', 'GraphQL', 'Next.js', 'Serverless', 'Microservices']
        
        for skill in emerging_skills:
            if skill_counts.get(skill, 0) < len(competitors) * 0.3:  # Less than 30% coverage
                gaps.append(f'Specialization in {skill} - emerging technology with low competition')
        
        return gaps[:5]  # Return top 5 opportunities
    
    def benchmark_against_competitors(self, user_profile: FreelancerProfile, 
                                    competitors: List[CompetitorProfile]) -> Dict[str, str]:
        """Benchmark user against competitors"""
        
        benchmark = {}
        
        # Rate comparison
        competitor_rates = [c.hourly_rate for c in competitors if c.hourly_rate]
        if competitor_rates and user_profile.hourly_rate:
            avg_rate = sum(competitor_rates) / len(competitor_rates)
            if user_profile.hourly_rate < avg_rate * 0.8:
                benchmark['pricing'] = 'Below market - opportunity to increase rates'
            elif user_profile.hourly_rate > avg_rate * 1.2:
                benchmark['pricing'] = 'Above market - justify with premium positioning'
            else:
                benchmark['pricing'] = 'Competitively priced'
        
        # Skills comparison
        user_skills = set([skill.lower() for skill in user_profile.skills])
        competitor_skills = set()
        for competitor in competitors:
            competitor_skills.update([skill.lower() for skill in competitor.skills])
        
        unique_skills = user_skills - competitor_skills
        missing_skills = competitor_skills - user_skills
        
        if unique_skills:
            benchmark['unique_skills'] = f'Unique advantages: {", ".join(sorted(list(unique_skills))[:3])}'
        
        if missing_skills:
            # Prefer the most common competitor skills (deterministic ordering)
            comp_skill_counts = Counter([s.lower() for c in competitors for s in c.skills])
            ordered_missing = sorted(list(missing_skills), key=lambda s: (-comp_skill_counts.get(s, 0), s))
            benchmark['skill_gaps'] = f'Consider adding: {", ".join(ordered_missing[:3])}'
        
        return benchmark


# ---------------------------------------------------------------------------
# Content Optimization Engine
# ---------------------------------------------------------------------------

class ContentOptimizer:
    """Generate optimized profile content with SEO integration"""
    
    def optimize_content(self, profile: FreelancerProfile, keywords: List[KeywordData], 
                        competitors: List[CompetitorProfile], tone: ContentTone = ContentTone.PROFESSIONAL) -> OptimizedContent:
        """Generate optimized content across all profile sections"""
        
        title_variants = self._generate_title_variants(profile, keywords, competitors)
        overview_variants = self._generate_overview_variants(profile, keywords, competitors, tone)
        skills_recommendations = self._recommend_skills(profile, keywords, competitors)
        keyword_integration = self._plan_keyword_integration(keywords)
        a_b_test_suggestions = self._generate_ab_test_suggestions(title_variants, overview_variants)
        
        return OptimizedContent(
            title_variants=title_variants,
            overview_variants=overview_variants,
            skills_recommendations=skills_recommendations,
            keyword_integration=keyword_integration,
            a_b_test_suggestions=a_b_test_suggestions
        )
    
    def _generate_title_variants(self, profile: FreelancerProfile, keywords: List[KeywordData], 
                               competitors: List[CompetitorProfile]) -> List[str]:
        """Generate multiple optimized title variations"""
        
        # Extract top keywords for titles
        title_keywords = [kw for kw in keywords if 'title' in kw.placement_suggestions][:3]
        
        # Analyze competitor title patterns
        competitor_patterns = self._analyze_title_patterns(competitors)
        
        variants = []
        
        # Pattern 1: Expertise + Results
        if title_keywords:
            variants.append(f"{title_keywords[0].keyword.title()} | {profile.experience_years or '5'}+ Years Experience")
        
        # Pattern 2: Skills + Value Proposition  
        if len(title_keywords) >= 2:
            variants.append(f"{title_keywords[0].keyword.title()} & {title_keywords[1].keyword.title()} Expert - Quality & Speed Guaranteed")
        
        # Pattern 3: Niche Specialization
        if title_keywords:
            variants.append(f"Senior {title_keywords[0].keyword.title()} | Helping Startups Build Amazing Products")
        
        # Pattern 4: Results-Focused
        variants.append(f"Certified {title_keywords[0].keyword if title_keywords else 'Full Stack'} Developer | 100% Job Success Rate")
        
        # Pattern 5: Problem-Solution
        if title_keywords:
            variants.append(f"{title_keywords[0].keyword.title()} Specialist - From Concept to Production in Record Time")
        
        return variants
    
    def _generate_overview_variants(self, profile: FreelancerProfile, keywords: List[KeywordData], 
                                  competitors: List[CompetitorProfile], tone: ContentTone) -> List[str]:
        """Generate optimized overview variations"""
        
        # Extract relevant keywords for overview
        overview_keywords = [kw for kw in keywords if 'overview' in kw.placement_suggestions][:5]
        
        variants = []
        
        # Variant 1: Results-Driven Professional Tone
        if tone in [ContentTone.PROFESSIONAL, ContentTone.TECHNICAL]:
            variant1 = self._create_professional_overview(profile, overview_keywords)
            variants.append(variant1)
        
        # Variant 2: Conversational Problem-Solver
        if tone in [ContentTone.CONVERSATIONAL, ContentTone.CREATIVE]:
            variant2 = self._create_conversational_overview(profile, overview_keywords)
            variants.append(variant2)
        
        # Variant 3: Technical Expert Focus
        variant3 = self._create_technical_overview(profile, overview_keywords)
        variants.append(variant3)
        
        return variants
    
    def _create_professional_overview(self, profile: FreelancerProfile, keywords: List[KeywordData]) -> str:
        """Create professional tone overview"""
        
        key_phrases = [kw.keyword for kw in keywords[:3]]
        
        overview = f"""
I'm a dedicated {key_phrases[0] if key_phrases else 'software developer'} with {profile.experience_years or '5'}+ years of experience delivering high-quality solutions for clients worldwide.

🎯 **Core Expertise:**
{chr(10).join(['• ' + kw.keyword.title() for kw in keywords[:4]])}

💼 **What I Deliver:**
• Scalable, maintainable code that follows best practices
• On-time delivery with clear communication throughout
• Post-launch support and optimization
• Solutions tailored to your specific business needs

🏆 **Why Choose Me:**
• {(profile.client_feedback or {}).get('reviews_count', '50')}+ successful projects completed
• {(profile.client_feedback or {}).get('rating', '4.9')} star rating from satisfied clients
• Available for both short-term projects and long-term partnerships

Ready to bring your vision to life? Let's discuss how I can help grow your business!
        """.strip()
        
        return overview
    
    def _create_conversational_overview(self, profile: FreelancerProfile, keywords: List[KeywordData]) -> str:
        """Create conversational tone overview"""
        
        key_phrases = [kw.keyword for kw in keywords[:3]]
        
        overview = f"""
Hi there! 👋 

I'm passionate about turning great ideas into reality through code. As a {key_phrases[0] if key_phrases else 'full stack developer'}, I love working with businesses to build digital solutions that actually make a difference.

Here's what I bring to the table:
✨ {profile.experience_years or '5'}+ years building everything from simple websites to complex web applications
✨ Expertise in {', '.join([kw.keyword for kw in keywords[:3]])}
✨ A knack for understanding what you really need (even when you're not sure yourself!)

I believe great software comes from great communication. That's why I keep you in the loop every step of the way, explain technical stuff in plain English, and make sure you're 100% happy with the result.

Got a project in mind? I'd love to hear about it! Drop me a message and let's see how we can make it happen. 🚀
        """.strip()
        
        return overview
    
    def _create_technical_overview(self, profile: FreelancerProfile, keywords: List[KeywordData]) -> str:
        """Create technical expert overview"""
        
        tech_keywords = [kw.keyword for kw in keywords if any(tech in kw.keyword.lower() 
                        for tech in ['react', 'node', 'python', 'javascript', 'api', 'database'])][:4]
        
        overview = f"""
Senior {keywords[0].keyword if keywords else 'Software Developer'} specializing in modern web technologies and scalable architecture.

**Technical Stack:**
{chr(10).join(['• ' + kw.title() + ' - Production-grade applications with performance optimization' for kw in tech_keywords[:3]])}

**Architecture Expertise:**
• Microservices and API design
• Database optimization and query performance
• CI/CD pipeline implementation
• Cloud deployment (AWS, Docker, Kubernetes)

**Delivered Solutions:**
• {profile.experience_years or '5'}+ years in enterprise software development
• Scalable applications handling 100K+ concurrent users
• Performance improvements achieving 3x faster load times
• Security-first development with comprehensive testing

I focus on building robust, maintainable systems that can scale with your business. Every project includes comprehensive documentation, automated testing, and performance monitoring.

Let's discuss your technical requirements and build something exceptional together.
        """.strip()
        
        return overview
    
    def _recommend_skills(self, profile: FreelancerProfile, keywords: List[KeywordData], 
                         competitors: List[CompetitorProfile]) -> List[str]:
        """Recommend skills to add/emphasize based on market demand"""
        
        # Extract skills from keywords
        keyword_skills = []
        for kw in keywords:
            if 'skills' in kw.placement_suggestions:
                # Extract technical skills from keyword phrases
                if any(tech in kw.keyword.lower() for tech in ['react', 'node', 'python', 'javascript', 'ios', 'android']):
                    keyword_skills.append(kw.keyword)
        
        # Analyze competitor skills
        competitor_skills = []
        for competitor in competitors:
            competitor_skills.extend(competitor.skills)
        
        skill_demand = Counter(competitor_skills)
        high_demand_skills = [skill for skill, count in skill_demand.most_common(10)]
        
        # Current user skills (normalized)
        current_skills = [skill.lower() for skill in profile.skills]
        
        recommendations = []
        
        # Add high-demand skills not currently listed
        for skill in high_demand_skills:
            if skill.lower() not in current_skills:
                recommendations.append(skill)
        
        # Add keyword-derived skills
        for skill in keyword_skills:
            if skill.lower() not in current_skills:
                recommendations.append(skill)
        
        # Emerging skills based on market trends
        emerging_skills = ['TypeScript', 'GraphQL', 'Next.js', 'React Native', 'Vue.js', 'Docker', 'AWS', 'MongoDB']
        for skill in emerging_skills:
            if skill.lower() not in current_skills and skill not in recommendations:
                recommendations.append(skill)
        
        return recommendations[:8]  # Return top 8 recommendations
    
    def _plan_keyword_integration(self, keywords: List[KeywordData]) -> Dict[str, List[str]]:
        """Plan optimal keyword integration across profile sections"""
        
        integration_plan = {
            'title': [],
            'overview': [],
            'skills': [],
            'portfolio': []
        }
        
        # Distribute keywords based on placement suggestions and priority
        for keyword in keywords:
            for placement in keyword.placement_suggestions:
                if placement in integration_plan:
                    integration_plan[placement].append(keyword.keyword)
        
        # Limit keywords per section to avoid stuffing
        for section in integration_plan:
            integration_plan[section] = integration_plan[section][:5]
        
        return integration_plan
    
    def _generate_ab_test_suggestions(self, titles: List[str], overviews: List[str]) -> List[Dict]:
        """Generate A/B testing suggestions for optimized content"""
        
        suggestions = []
        
        # Title A/B tests
        if len(titles) >= 2:
            suggestions.append({
                'type': 'title',
                'variant_a': titles[0],
                'variant_b': titles[1],
                'hypothesis': 'Professional credentials vs. value proposition emphasis',
                'metrics_to_track': ['profile_views', 'contact_rate', 'proposal_invitations'],
                'test_duration': '2-3 weeks'
            })
        
        # Overview A/B tests  
        if len(overviews) >= 2:
            suggestions.append({
                'type': 'overview',
                'variant_a': overviews[0][:200] + '...',  # Truncated for display
                'variant_b': overviews[1][:200] + '...',
                'hypothesis': 'Professional tone vs. conversational approach',
                'metrics_to_track': ['profile_conversion', 'message_response_rate'],
                'test_duration': '3-4 weeks'
            })
        
        # Skills section test
        suggestions.append({
            'type': 'skills_order',
            'variant_a': 'Technical skills first',
            'variant_b': 'High-demand keywords first',
            'hypothesis': 'Technical depth vs. search optimization',
            'metrics_to_track': ['search_rankings', 'profile_views'],
            'test_duration': '2 weeks'
        })
        
        return suggestions
    
    def _analyze_title_patterns(self, competitors: List[CompetitorProfile]) -> Dict[str, int]:
        """Analyze successful title patterns from competitors"""
        
        patterns = {
            'years_experience': 0,
            'project_count': 0,  
            'specialization': 0,
            'value_proposition': 0,
            'credentials': 0
        }
        
        for competitor in competitors:
            title = competitor.title.lower()
            
            if any(word in title for word in ['years', 'year', 'experience']):
                patterns['years_experience'] += 1
            
            if any(word in title for word in ['projects', 'apps', 'clients']):
                patterns['project_count'] += 1
                
            if any(word in title for word in ['specialist', 'expert', 'consultant']):
                patterns['specialization'] += 1
                
            if any(word in title for word in ['fast', 'quality', 'reliable', 'guaranteed']):
                patterns['value_proposition'] += 1
                
            if any(word in title for word in ['certified', 'senior', 'lead', 'principal']):
                patterns['credentials'] += 1
        
        return patterns


# ---------------------------------------------------------------------------
# Positioning & Recommendation Engine  
# ---------------------------------------------------------------------------

class PositioningEngine:
    """Generate strategic positioning recommendations"""
    
    def generate_recommendations(self, profile: FreelancerProfile, competitors: List[CompetitorProfile], 
                               keywords: List[KeywordData]) -> List[str]:
        """Generate strategic positioning recommendations"""
        
        recommendations = []
        
        # Analyze competitive landscape
        avg_competitor_rate = sum(c.hourly_rate for c in competitors if c.hourly_rate) / len(competitors)
        
        # Rate positioning recommendations
        if profile.hourly_rate and profile.hourly_rate < avg_competitor_rate * 0.7:
            recommendations.append(
                "💰 **Rate Optimization**: Your rates are significantly below market average. "
                f"Consider gradually increasing to ${avg_competitor_rate * 0.85:.0f}-${avg_competitor_rate:.0f}/hr "
                "to better reflect your expertise and improve perceived value."
            )
        
        # Specialization recommendations
        competitor_skills = []
        for competitor in competitors:
            competitor_skills.extend(competitor.skills)
        
        skill_saturation = Counter(competitor_skills)
        oversaturated_skills = [skill for skill, count in skill_saturation.items() if count >= len(competitors) * 0.8]
        
        if any(skill in profile.skills for skill in oversaturated_skills):
            recommendations.append(
                "🎯 **Differentiation Strategy**: Focus on emerging technologies or niche specializations. "
                "Many competitors offer similar core skills. Consider positioning around unique combinations "
                "or specialized use cases to stand out."
            )
        
        # Experience positioning
        if profile.experience_years and profile.experience_years < 3:
            recommendations.append(
                "🚀 **Junior Positioning**: Emphasize enthusiasm, modern skills, and competitive pricing. "
                "Highlight recent projects, certifications, and willingness to go the extra mile. "
                "Consider offering guarantees or bonuses for first-time clients."
            )
        elif profile.experience_years and profile.experience_years > 7:
            recommendations.append(
                "👑 **Senior Expert Positioning**: Leverage your experience with strategic consulting, "
                "architecture decisions, and mentoring junior developers. Command premium rates by "
                "focusing on complex projects and enterprise clients."
            )
        
        # Keyword-based positioning
        high_value_keywords = [kw for kw in keywords if kw.search_volume > 5000 and kw.relevance_score > 0.8]
        if high_value_keywords:
            recommendations.append(
                f"🔍 **SEO Opportunity**: Target high-value keyword '{high_value_keywords[0].keyword}' "
                "in your title and overview. This keyword has strong search volume with good relevance "
                "to your skills, offering significant visibility potential."
            )
        
        # Portfolio recommendations
        if len(profile.portfolio_items) < 3:
            recommendations.append(
                "📁 **Portfolio Enhancement**: Add 3-5 diverse portfolio pieces showcasing different "
                "skills and project types. Include case studies with problem-solution narratives "
                "and measurable results to build credibility."
            )
        
        # Unique value proposition
        recommendations.append(
            "✨ **Unique Value Proposition**: Develop a signature approach or specialization that "
            "competitors can't easily copy. This could be a unique tech stack combination, "
            "industry expertise, or service delivery method that becomes your competitive moat."
        )
        
        return recommendations


# ---------------------------------------------------------------------------
# Profile Scoring Engine
# ---------------------------------------------------------------------------

class ScoringEngine:
    """Score profiles across multiple dimensions"""
    
    def __init__(self, platform: Platform):
        self.platform = platform
        
    def score_profile(self, profile: FreelancerProfile, detailed: bool = True) -> ProfileScore:
        """Score profile across all categories"""
        
        # Category scoring
        completeness_score = self._score_completeness(profile)
        seo_score = self._score_seo_strength(profile)
        positioning_score = self._score_positioning(profile)
        differentiation_score = self._score_differentiation(profile)
        
        # Weighted overall score
        weights = {
            'completeness': 0.25,
            'seo_strength': 0.25, 
            'positioning': 0.25,
            'differentiation': 0.25
        }
        
        category_scores = {
            'completeness': completeness_score,
            'seo_strength': seo_score,
            'positioning': positioning_score,
            'differentiation': differentiation_score
        }
        
        overall_score = sum(score * weights[category] for category, score in category_scores.items())
        
        # Generate improvement areas and strengths
        improvement_areas = []
        strengths = []
        
        for category, score in category_scores.items():
            if score < 70:
                improvement_areas.append(category.replace('_', ' ').title())
            elif score >= 85:
                strengths.append(category.replace('_', ' ').title())
        
        # Score explanations
        score_explanation = self._generate_score_explanations(category_scores, profile)
        
        return ProfileScore(
            overall_score=int(overall_score),
            category_scores=category_scores,
            improvement_areas=improvement_areas,
            strengths=strengths,
            score_explanation=score_explanation
        )
    
    def _score_completeness(self, profile: FreelancerProfile) -> int:
        """Score profile completeness (0-100)"""
        
        score = 0
        max_score = 100
        
        # Core fields (60 points total)
        if profile.title and len(profile.title) > 10:
            score += 15
        elif profile.title:
            score += 8
            
        if profile.overview and len(profile.overview) > 100:
            score += 20
        elif profile.overview:
            score += 10
            
        if profile.skills and len(profile.skills) >= 5:
            score += 15
        elif profile.skills:
            score += 8
            
        if profile.hourly_rate:
            score += 10
        
        # Experience and background (25 points)
        if profile.experience_years:
            score += 8
            
        if profile.employment_history:
            score += 8
        
        if profile.education:
            score += 5
            
        if profile.certifications:
            score += 4
        
        # Portfolio and social proof (15 points)
        if profile.portfolio_items and len(profile.portfolio_items) >= 3:
            score += 10
        elif profile.portfolio_items:
            score += 5
            
        if profile.client_feedback and profile.client_feedback.get('reviews_count', 0) > 0:
            score += 5
        
        return min(score, max_score)
    
    def _score_seo_strength(self, profile: FreelancerProfile) -> int:
        """Score SEO optimization strength"""
        
        score = 0
        
        # Analyze title for SEO
        title_score = self._analyze_title_seo(profile.title)
        score += title_score * 0.3
        
        # Analyze overview for SEO
        overview_score = self._analyze_overview_seo(profile.overview)
        score += overview_score * 0.4
        
        # Skills keyword optimization
        skills_score = self._analyze_skills_seo(profile.skills)
        score += skills_score * 0.3

        # Small bonus for having all key SEO surfaces populated
        if profile.title and profile.overview and profile.skills and len(profile.skills) >= 5:
            score += 2
        
        return int(round(min(score, 100)))
    
    def _score_positioning(self, profile: FreelancerProfile) -> int:
        """Score market positioning strength"""
        
        score = 0
        
        # Value proposition clarity
        if profile.overview:
            if any(word in profile.overview.lower() for word in ['help', 'solve', 'deliver', 'achieve', 'results']):
                score += 25
        
        # Specialization vs generalist
        if profile.skills and len(profile.skills) <= 8:  # Focused specialization
            score += 20
        elif profile.skills and len(profile.skills) <= 12:
            score += 15
        else:
            score += 5  # Too broad
        
        # Experience positioning
        if profile.experience_years:
            if profile.experience_years >= 5:
                score += 15
            elif profile.experience_years >= 2:
                score += 10
            else:
                score += 5
        
        # Social proof integration
        if profile.client_feedback:
            rating = profile.client_feedback.get('rating', 0)
            reviews = profile.client_feedback.get('reviews_count', 0)
            
            if rating >= 4.8 and reviews >= 10:
                score += 20
            elif rating >= 4.5 and reviews >= 5:
                score += 15
            elif reviews > 0:
                score += 10
        
        # Portfolio quality indicator
        if profile.portfolio_items:
            if len(profile.portfolio_items) >= 5:
                score += 20
            elif len(profile.portfolio_items) >= 3:
                score += 15
            else:
                score += 10
        
        return min(score, 100)
    
    def _score_differentiation(self, profile: FreelancerProfile) -> int:
        """Score competitive differentiation"""
        
        score = 0
        
        # Unique skill combinations
        if profile.skills:
            # Check for modern/emerging tech combinations
            emerging_skills = ['typescript', 'graphql', 'next.js', 'react native', 'flutter', 'serverless']
            emerging_count = sum(1 for skill in profile.skills if skill.lower() in emerging_skills)
            
            if emerging_count >= 2:
                score += 20
            elif emerging_count >= 1:
                score += 10
        
        # Certifications as differentiator
        if profile.certifications:
            score += min(len(profile.certifications) * 5, 15)
        
        # Industry/domain expertise
        if profile.overview:
            industry_keywords = ['fintech', 'healthcare', 'ecommerce', 'saas', 'blockchain', 'ai', 'ml']
            if any(keyword in profile.overview.lower() for keyword in industry_keywords):
                score += 15
        
        # Languages as differentiator
        if profile.languages and len(profile.languages) > 1:
            score += 10
        
        # Unique value propositions in overview
        if profile.overview:
            value_indicators = ['guarantee', 'unique', 'exclusive', 'proprietary', 'innovative', 'patent']
            if any(indicator in profile.overview.lower() for indicator in value_indicators):
                score += 15
        
        # Portfolio diversity
        if profile.portfolio_items and len(profile.portfolio_items) >= 4:
            # Check for diverse project types (would need more detailed analysis in production)
            score += 15
        
        # Experience diversity (employment history)
        if profile.employment_history and len(profile.employment_history) >= 2:
            score += 10
        
        return min(score, 100)
    
    def _analyze_title_seo(self, title: str) -> int:
        """Analyze SEO strength of profile title"""
        
        if not title:
            return 0
            
        score = 0
        title_lower = title.lower()
        
        # Length optimization
        if 40 <= len(title) <= 80:
            score += 20
        elif 20 <= len(title) <= 100:
            score += 15
        else:
            score += 5
        
        # Keyword presence
        seo_keywords = ['developer', 'expert', 'specialist', 'consultant', 'engineer']
        if any(keyword in title_lower for keyword in seo_keywords):
            score += 20
        
        # Technology keywords
        tech_keywords = ['react', 'javascript', 'python', 'node.js', 'ios', 'android', 'full stack']
        tech_count = sum(1 for keyword in tech_keywords if keyword in title_lower)
        score += min(tech_count * 10, 30)
        
        # Value indicators
        value_keywords = ['senior', 'experienced', 'certified', 'proven', 'professional']
        if any(keyword in title_lower for keyword in value_keywords):
            score += 15
        
        # Numbers/metrics
        if re.search(r'\d+', title):
            score += 15
        
        return min(score, 100)
    
    def _analyze_overview_seo(self, overview: str) -> int:
        """Analyze SEO strength of profile overview"""
        
        if not overview:
            return 0
            
        score = 0
        overview_lower = overview.lower()
        word_count = len(overview.split())
        
        # Length optimization (very short overviews should be heavily penalized)
        if word_count < 50:
            score += 2
        elif 50 <= word_count < 100:
            score += 18
        elif 150 <= word_count <= 400:
            score += 25
        elif 100 <= word_count <= 500:
            score += 20
        else:
            score += 10
        
        # Keyword density (should be natural, not stuffed)
        tech_keywords = ['developer', 'development', 'programming', 'software', 'application', 'website', 'web app']
        # Count occurrences (not just presence) for a better density proxy
        keyword_occurrences = sum(overview_lower.count(keyword) for keyword in tech_keywords)
        keyword_density = (keyword_occurrences / word_count) * 100 if word_count > 0 else 0
        
        if 2 <= keyword_density <= 5:  # Optimal density
            score += 25
        elif keyword_density <= 7:
            score += 20
        else:
            score += 5  # Keyword stuffing penalty
        
        # Technical skills mention
        tech_skills = ['javascript', 'python', 'react', 'node.js', 'api', 'database', 'frontend', 'backend']
        tech_mentions = sum(1 for skill in tech_skills if skill in overview_lower)
        score += min(tech_mentions * 5, 25)
        
        # Call-to-action presence (only meaningful if overview is not extremely short)
        cta_phrases = ['contact me', 'get in touch', 'lets discuss', "let's discuss", 'message me', 'reach out']
        if word_count >= 50 and any(phrase in overview_lower for phrase in cta_phrases):
            score += 15
        
        # Social proof indicators
        proof_keywords = ['clients', 'projects', 'experience', 'years', 'successful']
        proof_hits = sum(1 for keyword in proof_keywords if keyword in overview_lower)
        if proof_hits:
            score += min(5 * proof_hits, 15)

        # Bonus for strong length + structure
        if word_count >= 120:
            score += 5
        
        return min(score, 100)
    
    def _analyze_skills_seo(self, skills: List[str]) -> int:
        """Analyze SEO optimization of skills section"""
        
        if not skills:
            return 0
            
        score = 0
        
        # Skills count optimization
        if 5 <= len(skills) <= 10:
            score += 25
        elif 3 <= len(skills) <= 15:
            score += 20
        else:
            score += 10
        
        # High-demand skills presence
        high_demand_skills = ['javascript', 'react', 'python', 'node.js', 'aws', 'docker', 'api']
        demand_count = sum(1 for skill in skills if skill.lower() in high_demand_skills)
        score += min(demand_count * 10, 40)
        
        # Modern technology presence
        modern_tech = ['typescript', 'graphql', 'next.js', 'vue.js', 'mongodb', 'postgresql']
        modern_count = sum(1 for skill in skills if skill.lower() in modern_tech)
        score += min(modern_count * 8, 25)
        
        # Specialization vs generalization
        categories = {
            'frontend': ['react', 'vue', 'angular', 'javascript', 'html', 'css'],
            'backend': ['node.js', 'python', 'django', 'flask', 'express', 'api'],
            'database': ['mongodb', 'postgresql', 'mysql', 'redis'],
            'cloud': ['aws', 'azure', 'gcp', 'docker', 'kubernetes']
        }
        
        category_scores = {}
        for category, category_skills in categories.items():
            category_scores[category] = sum(1 for skill in skills if skill.lower() in category_skills)
        
        # Bonus for balanced full-stack skills
        if category_scores.get('frontend', 0) >= 2 and category_scores.get('backend', 0) >= 2:
            score += 10
        
        return min(score, 100)
    
    def _generate_score_explanations(self, scores: Dict[str, int], profile: FreelancerProfile) -> Dict[str, str]:
        """Generate detailed explanations for each score category"""
        
        explanations = {}
        
        # Completeness explanation
        if scores['completeness'] >= 85:
            explanations['completeness'] = "Excellent profile completeness with all major sections filled out comprehensively."
        elif scores['completeness'] >= 70:
            explanations['completeness'] = "Good profile completeness with minor sections missing or incomplete."
        else:
            explanations['completeness'] = "Profile needs significant completion - missing key sections that impact visibility."
        
        # SEO explanation
        if scores['seo_strength'] >= 85:
            explanations['seo_strength'] = "Strong SEO optimization with well-integrated keywords and optimal content length."
        elif scores['seo_strength'] >= 70:
            explanations['seo_strength'] = "Good SEO foundation with room for keyword optimization improvements."
        else:
            explanations['seo_strength'] = "SEO needs major improvement - low keyword integration and suboptimal content structure."
        
        # Positioning explanation
        if scores['positioning'] >= 85:
            explanations['positioning'] = "Excellent market positioning with clear value proposition and strong differentiation."
        elif scores['positioning'] >= 70:
            explanations['positioning'] = "Good positioning foundation with opportunities to sharpen unique value proposition."
        else:
            explanations['positioning'] = "Positioning needs improvement - unclear value proposition and weak competitive differentiation."
        
        # Differentiation explanation
        if scores['differentiation'] >= 85:
            explanations['differentiation'] = "Strong competitive differentiation with unique skills and clear specialization."
        elif scores['differentiation'] >= 70:
            explanations['differentiation'] = "Good differentiation with some unique elements but room for stronger positioning."
        else:
            explanations['differentiation'] = "Lacks competitive differentiation - appears too similar to other freelancers in the market."
        
        return explanations


# ---------------------------------------------------------------------------
# CLI Interface
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Profile Optimizer - Comprehensive Freelancer Profile Analysis')
    parser.add_argument('command', choices=['analyze', 'keywords', 'optimize', 'competitors', 'score'], 
                       help='Command to execute')
    
    # Common arguments
    parser.add_argument('--platform', choices=['upwork', 'fiverr', 'linkedin'], default='upwork',
                       help='Target platform')
    parser.add_argument('--verbose', action='store_true', help='Verbose output')
    
    # Command-specific arguments
    parser.add_argument('--input', help='JSON input for profile data')
    parser.add_argument('--profile', help='JSON profile data')
    parser.add_argument('--niche', help='Freelancer niche/category')
    parser.add_argument('--keywords', help='JSON keywords data')
    parser.add_argument('--experience-level', choices=['junior', 'mid', 'senior'], help='Experience level')
    parser.add_argument('--target-budget', type=float, help='Target project budget')
    parser.add_argument('--limit', type=int, default=20, help='Limit for keyword research')
    parser.add_argument('--include-trends', action='store_true', help='Include trend analysis')
    parser.add_argument('--variants', type=int, default=3, help='Number of content variants')
    parser.add_argument('--tone', choices=['professional', 'conversational', 'technical', 'creative'], 
                       default='professional', help='Content tone')
    parser.add_argument('--top-count', type=int, default=10, help='Number of top competitors to analyze')
    parser.add_argument('--detailed', action='store_true', help='Detailed scoring breakdown')
    
    args = parser.parse_args()
    
    # Initialize engines
    analyzer = ProfileAnalysisEngine()
    keyword_engine = SEOKeywordEngine()
    competitor_engine = CompetitorAnalysisEngine(Platform(args.platform))
    content_optimizer = ContentOptimizer()
    score_engine = ScoringEngine(Platform(args.platform))
    
    try:
        if args.command == 'analyze':
            if not args.input:
                raise ValueError("Profile data required for analyze command")
            
            profile_data = json.loads(args.input)
            profile = FreelancerProfile(**profile_data)
            
            result = analyzer.analyze_profile(profile, Platform(args.platform))
            print(json.dumps(asdict(result), indent=2, default=str))
        
        elif args.command == 'keywords':
            if not args.niche:
                raise ValueError("Niche required for keywords command")
            
            keywords = keyword_engine.research_keywords(args.niche, Platform(args.platform), args.limit)
            result = {
                'niche': args.niche,
                'keywords': [asdict(kw) for kw in keywords],
                'top_opportunities': [kw.keyword for kw in keywords[:5]]
            }
            print(json.dumps(result, indent=2))
        
        elif args.command == 'optimize':
            if not args.profile or not args.keywords:
                raise ValueError("Profile and keywords data required for optimize command")
            
            profile_data = json.loads(args.profile)
            profile = FreelancerProfile(**profile_data)
            
            keywords_data = json.loads(args.keywords)
            keywords = [KeywordData(**kw) for kw in keywords_data]
            
            # Mock competitor data for optimization
            competitors = competitor_engine.analyze_competitors(args.niche or 'web-development', profile, Platform(args.platform))
            
            optimized = content_optimizer.optimize_content(profile, keywords, competitors, ContentTone(args.tone))
            print(json.dumps(asdict(optimized), indent=2))
        
        elif args.command == 'competitors':
            if not args.niche or not args.profile:
                raise ValueError("Niche and profile data required for competitors command")
            
            profile_data = json.loads(args.profile)
            profile = FreelancerProfile(**profile_data)
            
            competitors = competitor_engine.analyze_competitors(args.niche, profile, Platform(args.platform), args.top_count)
            gaps = competitor_engine.identify_market_gaps(competitors, profile)
            benchmark = competitor_engine.benchmark_against_competitors(profile, competitors)
            
            result = {
                'competitors': [asdict(comp) for comp in competitors],
                'market_gaps': gaps,
                'benchmark': benchmark,
                'differentiation_opportunities': gaps[:3]
            }
            print(json.dumps(result, indent=2))
        
        elif args.command == 'score':
            if not args.profile:
                raise ValueError("Profile data required for score command")
            
            profile_data = json.loads(args.profile)
            profile = FreelancerProfile(**profile_data)
            
            score = score_engine.score_profile(profile, args.detailed)
            print(json.dumps(asdict(score), indent=2))
    
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()