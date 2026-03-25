# Platform Integration Module

A comprehensive freelance platform integration system for Cortex Freelancer that provides unified job discovery, intelligent matching, opportunity scoring, and smart alerts across multiple platforms.

## Features

### 🔗 Platform Connectors
- **Upwork Integration**: RSS feed parsing, job scraping, detailed analysis
- **Fiverr Integration**: Buyer requests monitoring, gig analysis, market opportunities
- **Freelancer.com Integration**: Project discovery, bid analysis, client evaluation
- **Toptal Integration**: Screening preparation, skill demand analysis, market insights

### 🎯 Job Matching Algorithm
- **Skills-based Matching**: Weighted scoring with exact, related, and category matches
- **Budget Compatibility**: Range overlap analysis with tolerance factors
- **Timeline Feasibility**: Availability vs requirements assessment
- **Client Quality Scoring**: Rating, reviews, hire rate, verification status
- **Geographic Compatibility**: Location and timezone matching
- **Competition Assessment**: Proposal count and market saturation analysis

### 🏆 Opportunity Scoring
- **Win Probability**: Competition analysis, profile match, client history
- **Revenue Potential**: Budget analysis, skill premiums, long-term value
- **Time Investment**: Complexity assessment, rate efficiency, timeline pressure
- **Risk Factors**: Client verification, payment history, project clarity
- **Strategic Value**: Skill development, portfolio building, client relationships
- **Competition Level**: Market saturation and proposal density

### 🚨 Smart Alerts
- **Real-time Monitoring**: Configurable job monitoring with multiple criteria
- **Intelligent Filtering**: High-match, low-competition, high-budget alerts
- **Rate Limiting**: Prevents alert spam with hourly/daily limits
- **Multi-channel Delivery**: Email, push notifications, webhooks
- **Priority Scoring**: Critical, high, medium, low priority classification

### 💻 CLI Interface
- **Job Search**: `platform search --skills "react,node" --budget 5000+`
- **Profile Matching**: `platform match --profile myprofile.json --job joburl`
- **Monitoring Setup**: `platform monitor --keywords "react native" --min-budget 3000`
- **Job Analysis**: `platform analyze --url "upwork.com/job/..."`

## Installation

```javascript
const { PlatformIntegration } = require('./src/tools/platform-integration');

// Initialize with custom configuration
const platformIntegration = new PlatformIntegration({
    skillsWeight: 0.35,
    budgetWeight: 0.25,
    timelineWeight: 0.15,
    clientQualityWeight: 0.15,
    locationWeight: 0.05,
    experienceWeight: 0.05
});
```

## Quick Start

### Basic Job Search

```javascript
// Search across all platforms
const jobs = await platformIntegration.searchJobs({
    skills: ['react', 'javascript', 'node.js'],
    budget: { min: 1000, max: 5000 },
    platforms: ['upwork', 'freelancer'],
    limit: 20
});

console.log(`Found ${jobs.length} opportunities`);
```

### Profile Matching

```javascript
const profile = {
    skills: {
        primary: ['react', 'javascript', 'typescript'],
        secondary: ['python', 'aws', 'docker']
    },
    budget: { min: 50, max: 100, type: 'hourly' },
    availability: { hoursPerWeek: 30 },
    experience: { years: 5, level: 'senior' },
    location: { country: 'US', timezone: 'EST' }
};

const matchedJobs = await platformIntegration.matchJobs(profile, jobs);

// Jobs are sorted by combined match + opportunity score
matchedJobs.forEach(job => {
    console.log(`${job.title}: ${job.combinedScore}/100`);
});
```

### Smart Monitoring

```javascript
// Set up intelligent job monitoring
const monitorId = await platformIntegration.setupMonitoring({
    skills: ['machine learning', 'python'],
    budgetMin: 2000,
    platforms: ['upwork', 'toptal'],
    matchThreshold: 80,
    alertTypes: ['high_match', 'low_competition', 'premium_client']
}, (alert) => {
    console.log(`🚨 NEW OPPORTUNITY: ${alert.job.title}`);
    console.log(`Score: ${alert.job.opportunityScore.totalScore}/100`);
    console.log(`Priority: ${alert.priority}`);
});
```

### Job Analysis

```javascript
// Analyze specific job opportunities
const analysis = await platformIntegration.analyzeJob(
    'https://www.upwork.com/jobs/React-Developer-Needed_~123456'
);

console.log(`Opportunity Score: ${analysis.opportunityScore.totalScore}/100`);
console.log(`Recommendation: ${analysis.opportunityScore.recommendation}`);
console.log(`Risk Level: ${analysis.opportunityScore.riskLevel}`);
```

### CLI Usage

```bash
# Search for React jobs with minimum $5000 budget
platform search --skills "react,typescript" --min-budget 5000 --platforms upwork,freelancer

# Match a profile against a specific job
platform match --profile ./my-profile.json --job "https://upwork.com/job/123"

# Set up monitoring for React Native jobs
platform monitor --keywords "react native" --min-budget 3000 --threshold 75

# Analyze a specific job opportunity
platform analyze --url "https://www.freelancer.com/projects/123"

# Check platform status
platform status

# View recent alerts
platform history --alerts --limit 10
```

## Configuration

### Default Weights

```javascript
{
    skillsWeight: 0.35,        // 35% - Skills matching importance
    budgetWeight: 0.25,        // 25% - Budget compatibility
    timelineWeight: 0.15,      // 15% - Timeline feasibility
    clientQualityWeight: 0.15, // 15% - Client quality
    locationWeight: 0.05,      // 5% - Geographic compatibility
    experienceWeight: 0.05     // 5% - Experience level match
}
```

### Alert Thresholds

```javascript
{
    highMatchThreshold: 80,     // High match alert trigger
    mediumMatchThreshold: 60,   // Medium match threshold
    lowCompetitionThreshold: 10, // Low competition alert
    highBudgetThreshold: 1000,  // High budget alert
    maxAlertsPerHour: 20,       // Rate limiting
    maxAlertsPerDay: 100        // Daily rate limit
}
```

## Platform-Specific Features

### Upwork
- RSS feed integration for real-time job monitoring
- Client verification and payment history analysis
- Proposal count and competition assessment
- Job category and skill tag extraction

### Fiverr
- Buyer request monitoring (requires authentication)
- Market opportunity analysis through gig examination
- Pricing gap identification for competitive positioning
- Niche discovery through competition analysis

### Freelancer.com
- Project search across all categories
- Bid competition analysis
- Client hire rate and payment verification
- Sealed vs open bidding detection

### Toptal
- Screening preparation and requirements analysis
- Skill demand assessment in top-tier market
- Technical interview preparation guidance
- Portfolio and experience recommendations

## API Reference

### Core Classes

#### PlatformIntegration
- `searchJobs(criteria)` - Search across platforms
- `matchJobs(profile, jobs)` - Match jobs to profile
- `analyzeJob(url)` - Analyze specific job
- `setupMonitoring(criteria, callback)` - Set up alerts
- `stopMonitoring(monitorId)` - Stop monitoring

#### JobMatcher
- `calculateMatch(profile, job)` - Calculate match score
- `getMatchBreakdown(profile, job)` - Detailed analysis

#### OpportunityScorer
- `scoreOpportunity(job, profile)` - Score opportunity
- `scoreOpportunities(jobs, profile)` - Batch scoring

#### SmartAlerts
- `setupMonitor(criteria, callback)` - Create monitor
- `stopMonitor(monitorId)` - Remove monitor
- `getStats()` - Get statistics
- `getAlertHistory(filters)` - Get alert history

### Platform Connectors

Each platform connector implements:
- `searchJobs(criteria)` - Platform-specific job search
- `getJob(jobId)` - Get detailed job information
- `analyzeJob(url)` - Analyze job from URL
- `getJobCategories()` - Get platform categories
- `getSkillKeywords()` - Get common skills

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test suites
npm test JobMatcher.test.js
npm test OpportunityScorer.test.js
npm test SmartAlerts.test.js
npm test PlatformIntegration.test.js

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

- **JobMatcher**: Match calculation, skill scoring, budget compatibility
- **OpportunityScorer**: Win probability, revenue potential, risk assessment
- **SmartAlerts**: Monitoring, rate limiting, alert generation
- **Platform Connectors**: Job parsing, data normalization
- **Integration Tests**: End-to-end workflows

## Error Handling

The module implements comprehensive error handling:

```javascript
try {
    const jobs = await platformIntegration.searchJobs(criteria);
} catch (error) {
    if (error.message.includes('rate limit')) {
        // Handle rate limiting
        await delay(60000); // Wait 1 minute
        retry();
    } else if (error.message.includes('authentication')) {
        // Handle auth errors
        await reauthenticate();
    } else {
        console.error('Search failed:', error.message);
    }
}
```

## Best Practices

### Job Search Optimization
- Use specific skills rather than generic terms
- Set realistic budget ranges based on market rates
- Filter by recent postings (< 24 hours) for best opportunities
- Monitor multiple platforms for comprehensive coverage

### Profile Optimization
- Keep skills list current and comprehensive
- Include both technical and related skills
- Set competitive but realistic budget expectations
- Maintain updated portfolio and experience data

### Alert Management
- Start with higher thresholds (80+) to avoid spam
- Use multiple alert types for comprehensive coverage
- Review and adjust criteria based on alert quality
- Monitor rate limits to ensure continuous operation

### Risk Mitigation
- Always verify client payment methods
- Check client history and reviews carefully
- Avoid jobs with vague or incomplete descriptions
- Be cautious of unusually high or low budgets

## Troubleshooting

### Common Issues

**No jobs found**
- Check if search criteria are too restrictive
- Verify platform connectivity
- Ensure skills are spelled correctly

**Low match scores**
- Review profile completeness
- Adjust skill keywords
- Check budget compatibility
- Verify location/timezone settings

**Missing alerts**
- Check monitor status with `platform status`
- Verify alert criteria aren't too restrictive
- Check rate limiting status
- Ensure callback function is working

**Platform connection errors**
- Check internet connectivity
- Verify platform isn't blocking requests
- Consider using VPN if rate limited
- Check for platform maintenance windows

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-connector`
3. Add comprehensive tests
4. Ensure all tests pass: `npm test`
5. Submit pull request with detailed description

### Adding New Platforms

To add a new platform connector:

1. Extend `PlatformConnector` base class
2. Implement required methods: `searchJobs`, `getJob`, `analyzeJob`
3. Add platform-specific parsing logic
4. Include comprehensive test suite
5. Update documentation

## License

MIT License - see LICENSE file for details

## Changelog

### v1.0.0
- Initial release with Upwork, Fiverr, Freelancer.com, Toptal support
- Complete job matching algorithm implementation
- Opportunity scoring system
- Smart alerts with rate limiting
- Comprehensive CLI interface
- Full test suite coverage