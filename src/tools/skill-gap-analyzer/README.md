# Skill Gap Analyzer

**CFX-067: Skill Gap Analysis with Personalized Learning Path Recommendations**

A comprehensive AI-powered system for freelancers to assess their skills, identify gaps, and receive personalized learning recommendations based on market demand and career goals.

## Features

### 🎯 Skill Assessment Engine
- **Comprehensive Evaluation**: Covers technical, soft, business, and domain skills
- **Evidence-Based Scoring**: 1-10 rating system with confidence intervals
- **Market Demand Mapping**: Links skills to current freelancer market trends
- **Gap Identification**: Compares current skills against target role requirements

### 🗺️ Learning Path Generator  
- **Personalized Recommendations**: Tailored to your skill gaps and learning preferences
- **ROI-Optimized Prioritization**: High-demand skills with maximum gap impact first
- **Multi-Format Resources**: Courses, books, projects, and certifications
- **Realistic Time Estimates**: Based on commitment level and skill complexity
- **Milestone Tracking**: Progressive achievement markers with time estimates

### 📊 Market Demand Analyzer
- **Trending Skills Detection**: Identifies growing and declining skills in freelancer markets
- **Pricing Impact Analysis**: Shows how skills affect hourly rates and project values  
- **Competitive Advantage Scoring**: Evaluates skill combinations for market differentiation
- **Platform Optimization**: Recommends best freelancing platforms for your skillset
- **Future-Proofing**: Warns about at-risk skills and suggests emerging alternatives

### 💻 CLI Interface
- **cortex skill-gap assess** — Comprehensive skill evaluation
- **cortex skill-gap analyze** — Gap analysis against target roles
- **cortex skill-gap learn** — Generate personalized learning paths
- **cortex skill-gap market** — Market trends and pricing insights
- **cortex skill-gap progress** — Track learning progress and milestones

## Installation

```bash
# From the Cortex Freelancer project root
cd src/tools/skill-gap-analyzer

# Install dependencies (if any)
npm install

# Make CLI executable
chmod +x cli.js
```

## Quick Start

### 1. Run Your First Assessment

```bash
# Interactive assessment
cortex skill-gap assess --interactive

# Or quick assessment with defaults
cortex skill-gap assess --user your-name
```

### 2. Analyze Skill Gaps

```bash
# Analyze gaps for a specific role
cortex skill-gap analyze --role fullstack-developer

# Available roles: frontend-developer, fullstack-developer, ai-consultant, digital-marketer
cortex skill-gap analyze --role ai-consultant --user your-name
```

### 3. Generate Learning Path

```bash
# Generate personalized learning path
cortex skill-gap learn --time 15 --budget 800

# Specify preferences
cortex skill-gap learn --role ai-consultant --time 20 --budget 1000 --format courses --difficulty progressive
```

### 4. Explore Market Data

```bash
# View trending skills
cortex skill-gap market --trends

# Analyze your skill pricing
cortex skill-gap market --pricing --skills javascript react nodejs python

# Check competitive advantages
cortex skill-gap market --competitive --skills react nodejs aws

# Future-proofing analysis
cortex skill-gap market --future-proof --skills javascript jquery php
```

### 5. Track Learning Progress

```bash
# View progress overview
cortex skill-gap progress

# Update progress
cortex skill-gap progress --update --skill javascript --hours 8 --level 7 --milestone "Practice"
```

## Command Reference

### Assessment Commands

```bash
# Basic assessment
cortex skill-gap assess

# Interactive mode with guided questions
cortex skill-gap assess --interactive

# Specify user
cortex skill-gap assess --user john-doe
```

### Analysis Commands

```bash
# Analyze gaps against target role
cortex skill-gap analyze --role TARGET_ROLE

# Available target roles:
# - frontend-developer
# - fullstack-developer  
# - ai-consultant
# - digital-marketer

# Examples
cortex skill-gap analyze --role fullstack-developer --user john-doe
```

### Learning Path Commands

```bash
# Generate learning path with options
cortex skill-gap learn [OPTIONS]

# Options:
--role ROLE              Target role (default: fullstack-developer)
--time HOURS             Weekly time commitment (default: 10)  
--budget AMOUNT          Monthly budget in USD (default: 500)
--format FORMAT          courses|books|projects|mixed (default: mixed)
--difficulty LEVEL       beginner|intermediate|advanced|progressive (default: progressive)

# Examples
cortex skill-gap learn --time 20 --budget 1000
cortex skill-gap learn --role ai-consultant --format courses
```

### Market Analysis Commands

```bash
# Show trending skills
cortex skill-gap market --trends

# Analyze pricing for specific skills  
cortex skill-gap market --pricing --skills SKILL1 SKILL2 SKILL3

# Competitive advantage analysis
cortex skill-gap market --competitive --skills SKILL1 SKILL2 SKILL3

# Future-proofing recommendations
cortex skill-gap market --future-proof --skills SKILL1 SKILL2 SKILL3

# Combine multiple analyses
cortex skill-gap market --trends --pricing --skills javascript react nodejs
```

### Progress Tracking Commands

```bash
# View progress overview
cortex skill-gap progress

# Update progress
cortex skill-gap progress --update --skill SKILL --hours N --level N --milestone "NAME"

# Add progress note
cortex skill-gap progress --update --skill javascript --note "Completed React tutorial"

# Full progress update example
cortex skill-gap progress --update --skill javascript --hours 5 --level 7 --milestone "Application" --note "Built first full-stack app"
```

## Example Workflows

### New Freelancer Workflow

```bash
# 1. Assess current skills
cortex skill-gap assess --interactive

# 2. Choose target role and analyze gaps  
cortex skill-gap analyze --role fullstack-developer

# 3. Generate learning path
cortex skill-gap learn --time 15 --budget 600

# 4. Check market trends
cortex skill-gap market --trends

# 5. Start learning and track progress
cortex skill-gap progress --update --skill javascript --hours 4 --level 5
```

### Experienced Developer Workflow

```bash
# 1. Quick assessment
cortex skill-gap assess

# 2. Analyze competitive position
cortex skill-gap market --competitive --pricing --skills python django aws

# 3. Check future-proofing
cortex skill-gap market --future-proof --skills jquery php mysql

# 4. Generate upgrade path for AI skills
cortex skill-gap analyze --role ai-consultant
cortex skill-gap learn --role ai-consultant --budget 1000
```

### Market Research Workflow  

```bash
# 1. Trending skills analysis
cortex skill-gap market --trends

# 2. Pricing analysis for skill combinations
cortex skill-gap market --pricing --skills react nodejs aws docker

# 3. Platform optimization
cortex skill-gap market --pricing --skills javascript react python

# 4. Future opportunities  
cortex skill-gap market --future-proof --skills ai_ml blockchain
```

## Data Storage

All data is stored locally in `~/.cortex-freelancer/skill-gap-analyzer/`:

```
~/.cortex-freelancer/skill-gap-analyzer/
├── assessments.json          # User skill assessments
├── learning-paths.json       # Generated learning paths  
├── learning-progress.json    # Progress tracking data
├── learning-resources.json   # Course/book/project database
├── market-data.json          # Skill market trends & pricing
├── skill-categories.json     # Skill taxonomy & definitions
└── target-roles.json         # Role requirements & salary data
```

## Skill Categories

### Technical Skills
- **Programming**: JavaScript, Python, React, Node.js, etc.
- **DevOps**: AWS, Docker, Git, etc.  
- **Design**: Figma, Photoshop, UI/UX

### Soft Skills  
- **Communication**: Writing, speaking, presentation
- **Management**: Project management, time management, leadership
- **Interpersonal**: Client relations, negotiation, adaptability

### Business Skills
- **Marketing**: SEO, social media, content, branding
- **Sales**: Lead generation, closing, pricing strategy
- **Finance**: Budgeting, invoicing, tax planning

### Domain Expertise
- **Industries**: FinTech, Healthcare, E-commerce, SaaS
- **Emerging**: AI/ML, Blockchain, IoT

## Target Roles

### Frontend Developer
- **Focus**: UI/UX, JavaScript frameworks, responsive design
- **Key Skills**: JavaScript (8/10), React (7/10), Figma (6/10)
- **Average Salary**: $75,000
- **Market Demand**: 9/10

### Full Stack Developer  
- **Focus**: End-to-end web development
- **Key Skills**: JavaScript (8/10), Python/Node.js (7/10), AWS (6/10)
- **Average Salary**: $85,000  
- **Market Demand**: 9/10

### AI/ML Consultant
- **Focus**: Machine learning, data science, AI solutions  
- **Key Skills**: Python (9/10), AI/ML (8/10), Communication (8/10)
- **Average Salary**: $120,000
- **Market Demand**: 10/10

### Digital Marketing Specialist
- **Focus**: Online marketing, growth, content strategy
- **Key Skills**: Marketing (9/10), Sales (7/10), Branding (8/10)  
- **Average Salary**: $60,000
- **Market Demand**: 8/10

## Market Data Sources

The analyzer includes realistic market data based on:

- **Freelancing Platforms**: Upwork, Freelancer.com, Toptal, Fiverr
- **Job Demand**: Current job posting volumes and growth rates
- **Salary Data**: Average hourly rates by skill and platform
- **Growth Trends**: Year-over-year skill demand changes
- **Future-Proofing**: Technology adoption and obsolescence patterns

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test assessment.test.js
```

## Development

### Project Structure

```
src/tools/skill-gap-analyzer/
├── assessment.js           # Skill assessment engine
├── learning-path.js        # Learning path generation  
├── market-demand.js        # Market analysis & trends
├── cli.js                  # Command-line interface
├── package.json            # Node.js configuration
├── README.md               # This file
└── __tests__/              # Test suite
    ├── assessment.test.js
    ├── learning-path.test.js  
    ├── market-demand.test.js
    └── cli.test.js
```

### Key Functions

**Assessment Engine** (`assessment.js`):
- `conductAssessment()` - Run comprehensive skill evaluation
- `analyzeSkillGaps()` - Compare skills against target roles
- `getSkillPortfolio()` - Generate skill portfolio summary

**Learning Path Generator** (`learning-path.js`):
- `generateLearningPath()` - Create personalized learning plan
- `estimateTimeToLearnSkill()` - Calculate learning time estimates  
- `trackProgress()` - Update learning progress

**Market Demand Analyzer** (`market-demand.js`):
- `analyzeTrendingSkills()` - Identify trending/declining skills
- `analyzeSkillPricing()` - Calculate rate recommendations
- `analyzeCompetitiveAdvantage()` - Evaluate skill combinations

### Adding New Skills

1. Update `DEFAULT_SKILL_CATEGORIES` in `assessment.js`
2. Add market data to `DEFAULT_MARKET_DATA` in `market-demand.js`  
3. Include learning resources in `DEFAULT_LEARNING_RESOURCES` in `learning-path.js`
4. Update target role requirements as needed

### Adding New Target Roles

1. Define role in `initializeTargetRoles()` in `assessment.js`
2. Specify required skill levels and market data
3. Test gap analysis and learning path generation

## Integration with Cortex Freelancer

This tool integrates with the broader Cortex Freelancer ecosystem:

- **Time Tracking**: Links with `cortex time` for learning time logs
- **Project Management**: Connects skill development to project requirements
- **Revenue Forecasting**: Feeds skill data into rate optimization
- **Client Communication**: Helps communicate capabilities to prospects

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-skill-category`)
3. Make changes and add tests
4. Run test suite (`npm test`)
5. Submit pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests:
- GitHub Issues: [cortex-freelancer/issues](https://github.com/cortex-freelancer/issues)
- Documentation: [cortex-freelancer.com/docs](https://cortex-freelancer.com/docs)
- Community: [Discord](https://discord.gg/cortex-freelancer)