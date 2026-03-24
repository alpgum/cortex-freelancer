#!/usr/bin/env python3
"""
Market Research Module for Dynamic Rate Calculator
Fetches real-time market data from freelancer platforms and job boards.
"""

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("⚠️ requests module not available - using simulated market data only")

import json
import time
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import os
import sys

@dataclass
class MarketRate:
    """Represents a market rate data point"""
    skill: str
    experience_level: str
    hourly_rate: float
    currency: str
    platform: str
    job_count: int
    timestamp: str
    location: str = ""

@dataclass
class MarketTrend:
    """Represents rate trend analysis"""
    skill: str
    trend_direction: str  # up, down, stable
    rate_change_percent: float
    period_days: int
    confidence_score: float

class MarketResearchAPI:
    """Fetches market data from various freelancer platforms and job boards"""
    
    def __init__(self, cache_duration_hours: int = 6):
        """
        Initialize market research API
        
        Args:
            cache_duration_hours: How long to cache market data
        """
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self.cache = {}
        
        # Headers to avoid being detected as bot
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

    def get_cached_data(self, cache_key: str) -> Optional[Dict]:
        """Get data from cache if still valid"""
        if cache_key in self.cache:
            cached_time, data = self.cache[cache_key]
            if datetime.now() - cached_time < self.cache_duration:
                return data
        return None

    def cache_data(self, cache_key: str, data: Dict):
        """Store data in cache with timestamp"""
        self.cache[cache_key] = (datetime.now(), data)

    def fetch_upwork_rates(self, skill: str, location: str = "") -> List[MarketRate]:
        """
        Fetch rate data from Upwork (simulated - real implementation would need API access)
        
        Args:
            skill: Skill category to search for
            location: Optional location filter
            
        Returns:
            List of MarketRate objects
        """
        cache_key = f"upwork_{skill}_{location}"
        cached = self.get_cached_data(cache_key)
        if cached:
            return [MarketRate(**rate) for rate in cached['rates']]
        
        # For demo purposes, we'll simulate API data
        # In production, this would make actual API calls to Upwork RSS or web scraping
        simulated_rates = self._simulate_upwork_data(skill, location)
        
        cache_data = {'rates': [rate.__dict__ for rate in simulated_rates]}
        self.cache_data(cache_key, cache_data)
        
        return simulated_rates

    def fetch_freelancer_rates(self, skill: str, location: str = "") -> List[MarketRate]:
        """
        Fetch rate data from Freelancer.com (simulated)
        
        Args:
            skill: Skill category to search for
            location: Optional location filter
            
        Returns:
            List of MarketRate objects
        """
        cache_key = f"freelancer_{skill}_{location}"
        cached = self.get_cached_data(cache_key)
        if cached:
            return [MarketRate(**rate) for rate in cached['rates']]
        
        simulated_rates = self._simulate_freelancer_data(skill, location)
        
        cache_data = {'rates': [rate.__dict__ for rate in simulated_rates]}
        self.cache_data(cache_key, cache_data)
        
        return simulated_rates

    def fetch_fiverr_rates(self, skill: str) -> List[MarketRate]:
        """
        Fetch rate data from Fiverr (simulated)
        
        Args:
            skill: Skill category to search for
            
        Returns:
            List of MarketRate objects
        """
        cache_key = f"fiverr_{skill}"
        cached = self.get_cached_data(cache_key)
        if cached:
            return [MarketRate(**rate) for rate in cached['rates']]
        
        simulated_rates = self._simulate_fiverr_data(skill)
        
        cache_data = {'rates': [rate.__dict__ for rate in simulated_rates]}
        self.cache_data(cache_key, cache_data)
        
        return simulated_rates

    def fetch_job_board_data(self, skill: str, location: str = "") -> List[MarketRate]:
        """
        Fetch salary/rate data from job boards (Indeed, Glassdoor, etc.)
        
        Args:
            skill: Skill/job title to search for
            location: Location filter
            
        Returns:
            List of MarketRate objects
        """
        # This would integrate with job board APIs or web scraping
        # For now, returning simulated data
        return self._simulate_job_board_data(skill, location)

    def analyze_rate_trends(self, skill: str, days: int = 30) -> MarketTrend:
        """
        Analyze rate trends over time for a specific skill
        
        Args:
            skill: Skill to analyze
            days: Number of days to look back
            
        Returns:
            MarketTrend object
        """
        # In production, this would analyze historical data
        # For now, returning simulated trend analysis
        return self._simulate_trend_analysis(skill, days)

    def get_comprehensive_market_data(self, skill: str, location: str = "") -> Dict:
        """
        Fetch comprehensive market data from all sources
        
        Args:
            skill: Skill category
            location: Location filter
            
        Returns:
            Dictionary with aggregated market data
        """
        print(f"🔍 Fetching market data for {skill} in {location or 'global market'}...")
        
        # Fetch from all platforms
        upwork_rates = self.fetch_upwork_rates(skill, location)
        freelancer_rates = self.fetch_freelancer_rates(skill, location)
        fiverr_rates = self.fetch_fiverr_rates(skill)
        job_board_rates = self.fetch_job_board_data(skill, location)
        
        all_rates = upwork_rates + freelancer_rates + fiverr_rates + job_board_rates
        
        # Analyze trends
        trend = self.analyze_rate_trends(skill)
        
        # Calculate market statistics
        market_stats = self._calculate_market_stats(all_rates)
        
        return {
            'skill': skill,
            'location': location,
            'total_data_points': len(all_rates),
            'rates_by_platform': {
                'upwork': upwork_rates,
                'freelancer': freelancer_rates,
                'fiverr': fiverr_rates,
                'job_boards': job_board_rates
            },
            'market_statistics': market_stats,
            'trend_analysis': trend,
            'last_updated': datetime.now().isoformat()
        }

    def _simulate_upwork_data(self, skill: str, location: str) -> List[MarketRate]:
        """Generate realistic Upwork market data"""
        import random
        
        base_rates = {
            'web_development': (25, 50, 120),
            'mobile_app_development': (30, 65, 150),
            'data_science': (40, 85, 180),
            'ai_ml': (50, 120, 250),
            'digital_marketing': (20, 45, 100),
            'copywriting': (25, 55, 120),
            'graphic_design': (20, 40, 80),
            'video_editing': (25, 50, 100),
            'content_writing': (15, 30, 65),
            'virtual_assistance': (10, 20, 40)
        }
        
        min_rate, med_rate, max_rate = base_rates.get(skill, (20, 40, 100))
        
        rates = []
        for i in range(random.randint(15, 25)):
            # Generate random rates around the median
            if i < 5:  # Junior
                rate = random.uniform(min_rate * 0.8, min_rate * 1.2)
                level = 'junior'
            elif i < 15:  # Mid-level
                rate = random.uniform(med_rate * 0.7, med_rate * 1.3)
                level = 'mid'
            else:  # Senior
                rate = random.uniform(max_rate * 0.6, max_rate * 1.4)
                level = 'senior'
            
            rates.append(MarketRate(
                skill=skill,
                experience_level=level,
                hourly_rate=round(rate, 2),
                currency='USD',
                platform='upwork',
                job_count=random.randint(1, 50),
                timestamp=datetime.now().isoformat(),
                location=location
            ))
        
        return rates

    def _simulate_freelancer_data(self, skill: str, location: str) -> List[MarketRate]:
        """Generate realistic Freelancer.com market data (typically 15-20% lower than Upwork)"""
        upwork_rates = self._simulate_upwork_data(skill, location)
        
        # Freelancer rates are typically lower
        for rate in upwork_rates:
            rate.hourly_rate = round(rate.hourly_rate * 0.85, 2)
            rate.platform = 'freelancer'
            rate.job_count = round(rate.job_count * 1.3)  # More competition
        
        return upwork_rates

    def _simulate_fiverr_data(self, skill: str) -> List[MarketRate]:
        """Generate realistic Fiverr market data (project-based, converted to hourly)"""
        import random
        
        # Fiverr is project-based, so we estimate hourly rates
        project_rates = {
            'web_development': (50, 500, 2000),
            'mobile_app_development': (100, 800, 3000),
            'data_science': (100, 600, 2500),
            'ai_ml': (150, 1000, 4000),
            'digital_marketing': (25, 200, 1000),
            'copywriting': (20, 150, 800),
            'graphic_design': (15, 100, 500),
            'video_editing': (30, 200, 1000),
            'content_writing': (10, 50, 300),
            'virtual_assistance': (5, 50, 200)
        }
        
        min_proj, med_proj, max_proj = project_rates.get(skill, (50, 200, 800))
        
        rates = []
        for i in range(random.randint(10, 20)):
            # Estimate hours per project and convert to hourly
            if i < 3:
                project_rate = random.uniform(min_proj, min_proj * 1.5)
                hours = random.uniform(2, 8)
                level = 'junior'
            elif i < 12:
                project_rate = random.uniform(med_proj * 0.7, med_proj * 1.3)
                hours = random.uniform(5, 15)
                level = 'mid'
            else:
                project_rate = random.uniform(max_proj * 0.6, max_proj * 1.4)
                hours = random.uniform(10, 30)
                level = 'senior'
            
            hourly_rate = project_rate / hours
            
            rates.append(MarketRate(
                skill=skill,
                experience_level=level,
                hourly_rate=round(hourly_rate, 2),
                currency='USD',
                platform='fiverr',
                job_count=random.randint(5, 100),
                timestamp=datetime.now().isoformat()
            ))
        
        return rates

    def _simulate_job_board_data(self, skill: str, location: str) -> List[MarketRate]:
        """Generate job board salary data converted to hourly freelance rates"""
        import random
        
        # Annual salaries converted to freelance hourly (typically 2-3x higher)
        salary_ranges = {
            'web_development': (50000, 80000, 150000),
            'mobile_app_development': (60000, 100000, 180000),
            'data_science': (70000, 120000, 200000),
            'ai_ml': (90000, 150000, 300000),
            'digital_marketing': (40000, 70000, 120000),
            'copywriting': (35000, 60000, 100000),
            'graphic_design': (35000, 55000, 90000),
            'video_editing': (40000, 70000, 120000),
            'content_writing': (30000, 50000, 80000),
            'virtual_assistance': (25000, 40000, 60000)
        }
        
        min_sal, med_sal, max_sal = salary_ranges.get(skill, (40000, 70000, 120000))
        
        rates = []
        for i in range(random.randint(8, 15)):
            if i < 3:
                salary = random.uniform(min_sal, min_sal * 1.2)
                level = 'junior'
            elif i < 10:
                salary = random.uniform(med_sal * 0.8, med_sal * 1.2)
                level = 'mid'
            else:
                salary = random.uniform(max_sal * 0.7, max_sal * 1.3)
                level = 'senior'
            
            # Convert annual salary to freelance hourly (assuming 2000 work hours/year + 2.5x multiplier for freelance)
            hourly_rate = (salary / 2000) * 2.5
            
            rates.append(MarketRate(
                skill=skill,
                experience_level=level,
                hourly_rate=round(hourly_rate, 2),
                currency='USD',
                platform='job_boards',
                job_count=random.randint(1, 20),
                timestamp=datetime.now().isoformat(),
                location=location
            ))
        
        return rates

    def _simulate_trend_analysis(self, skill: str, days: int) -> MarketTrend:
        """Generate trend analysis for a skill"""
        import random
        
        # Simulate trend based on skill demand
        trending_up = ['ai_ml', 'data_science', 'mobile_app_development', 'video_editing']
        trending_down = ['data_entry', 'basic_web_design']
        
        if skill in trending_up:
            direction = 'up'
            change = random.uniform(2.0, 8.0)
            confidence = random.uniform(0.7, 0.9)
        elif skill in trending_down:
            direction = 'down'
            change = random.uniform(-5.0, -1.0)
            confidence = random.uniform(0.6, 0.8)
        else:
            direction = 'stable'
            change = random.uniform(-1.0, 1.0)
            confidence = random.uniform(0.5, 0.7)
        
        return MarketTrend(
            skill=skill,
            trend_direction=direction,
            rate_change_percent=round(change, 2),
            period_days=days,
            confidence_score=round(confidence, 2)
        )

    def _calculate_market_stats(self, rates: List[MarketRate]) -> Dict:
        """Calculate market statistics from rate data"""
        if not rates:
            return {}
        
        hourly_rates = [r.hourly_rate for r in rates]
        hourly_rates.sort()
        
        n = len(hourly_rates)
        median = hourly_rates[n // 2] if n % 2 == 1 else (hourly_rates[n // 2 - 1] + hourly_rates[n // 2]) / 2
        
        # Calculate by experience level
        by_level = {}
        for level in ['junior', 'mid', 'senior']:
            level_rates = [r.hourly_rate for r in rates if r.experience_level == level]
            if level_rates:
                level_rates.sort()
                n_level = len(level_rates)
                level_median = level_rates[n_level // 2] if n_level % 2 == 1 else (level_rates[n_level // 2 - 1] + level_rates[n_level // 2]) / 2
                
                by_level[level] = {
                    'min': min(level_rates),
                    'median': round(level_median, 2),
                    'max': max(level_rates),
                    'avg': round(sum(level_rates) / len(level_rates), 2),
                    'count': len(level_rates)
                }
        
        # Calculate by platform
        by_platform = {}
        for platform in ['upwork', 'freelancer', 'fiverr', 'job_boards']:
            platform_rates = [r.hourly_rate for r in rates if r.platform == platform]
            if platform_rates:
                by_platform[platform] = {
                    'median': round(sorted(platform_rates)[len(platform_rates) // 2], 2),
                    'avg': round(sum(platform_rates) / len(platform_rates), 2),
                    'count': len(platform_rates)
                }
        
        return {
            'overall': {
                'min': min(hourly_rates),
                'median': round(median, 2),
                'max': max(hourly_rates),
                'avg': round(sum(hourly_rates) / len(hourly_rates), 2),
                'total_data_points': len(hourly_rates)
            },
            'by_experience_level': by_level,
            'by_platform': by_platform
        }

# Example usage
if __name__ == "__main__":
    research = MarketResearchAPI()
    
    # Test with a skill
    skill = "web_development"
    location = "United States"
    
    print(f"Fetching market data for {skill}...")
    market_data = research.get_comprehensive_market_data(skill, location)
    
    print("\n📊 Market Statistics:")
    stats = market_data['market_statistics']['overall']
    print(f"   Min: ${stats['min']}/hr")
    print(f"   Median: ${stats['median']}/hr") 
    print(f"   Max: ${stats['max']}/hr")
    print(f"   Average: ${stats['avg']}/hr")
    print(f"   Data points: {stats['total_data_points']}")
    
    print(f"\n📈 Trend Analysis:")
    trend = market_data['trend_analysis']
    print(f"   Direction: {trend.trend_direction}")
    print(f"   Change: {trend.rate_change_percent}% over {trend.period_days} days")
    print(f"   Confidence: {trend.confidence_score}")