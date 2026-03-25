#!/usr/bin/env node
/**
 * Skill Gap Analyzer CLI Interface
 * CFX-067: Skill Gap Analysis with Personalized Learning Path Recommendations
 *
 * CLI commands:
 * - cortex skill-gap assess — Run skill assessment
 * - cortex skill-gap analyze — Show gaps with priorities
 * - cortex skill-gap learn — Generate learning path
 * - cortex skill-gap market — Show market demand data
 * - cortex skill-gap progress — Track learning progress
 */

const fs = require('fs');
const path = require('path');

// Import our modules
const assessment = require('./assessment');
const learningPath = require('./learning-path');
const marketDemand = require('./market-demand');

// ─── CLI Utilities ─────────────────────────────────────────────────────────

function displayHeader(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`🎯 CORTEX SKILL GAP ANALYZER - ${title.toUpperCase()}`);
  console.log('='.repeat(50) + '\n');
}

function displaySection(title, emoji = '📊') {
  console.log(`\n${emoji} ${title}`);
  console.log('-'.repeat(title.length + 4));
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function formatPercentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function displayTable(data, headers) {
  if (data.length === 0) {
    console.log('No data to display');
    return;
  }

  const colWidths = headers.map(header => 
    Math.max(header.length, ...data.map(row => String(row[header] || '').length))
  );

  // Header
  const headerRow = headers.map((header, i) => 
    String(header).padEnd(colWidths[i])
  ).join(' | ');
  console.log(headerRow);
  console.log(headers.map((_, i) => '-'.repeat(colWidths[i])).join('-|-'));

  // Data rows
  data.forEach(row => {
    const dataRow = headers.map((header, i) => 
      String(row[header] || '').padEnd(colWidths[i])
    ).join(' | ');
    console.log(dataRow);
  });
}

function promptForInput(question, defaultValue = '') {
  // In a real implementation, this would use readline or inquirer
  // For now, return default or generate realistic sample data
  return defaultValue || generateSampleInput(question);
}

function generateSampleInput(question) {
  // Generate sample inputs for demonstration
  if (question.includes('target role')) {
    return 'fullstack-developer';
  }
  if (question.includes('time commitment')) {
    return '10';
  }
  if (question.includes('budget')) {
    return '500';
  }
  if (question.includes('user ID')) {
    return 'default';
  }
  return '';
}

// ─── Command Implementations ───────────────────────────────────────────────

/**
 * Run skill assessment
 * @param {Array} args - Command arguments
 */
function runAssessment(args) {
  displayHeader('Skill Assessment');
  
  const options = parseAssessmentArgs(args);
  
  console.log('Starting comprehensive skill assessment...\n');
  
  try {
    const assessmentResult = assessment.conductAssessment(options);
    
    displaySection('Assessment Results', '✅');
    console.log(`Assessment ID: ${assessmentResult.id}`);
    console.log(`User ID: ${assessmentResult.userId}`);
    console.log(`Timestamp: ${new Date(assessmentResult.timestamp).toLocaleString()}`);
    console.log(`Skills Assessed: ${Object.keys(assessmentResult.skills).length}`);
    
    // Show top skills
    displaySection('Top Skills', '🏆');
    const topSkills = Object.entries(assessmentResult.skills)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    topSkills.forEach(([skillKey, rating], index) => {
      const [category, skillName] = skillKey.split('.');
      console.log(`${index + 1}. ${skillName}: ${rating}/10 (${category})`);
    });
    
    // Show areas for improvement
    displaySection('Areas for Improvement', '📈');
    const improvementAreas = Object.entries(assessmentResult.skills)
      .filter(([_, rating]) => rating < 6)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5);
    
    if (improvementAreas.length > 0) {
      improvementAreas.forEach(([skillKey, rating], index) => {
        const [category, skillName] = skillKey.split('.');
        console.log(`${index + 1}. ${skillName}: ${rating}/10 (${category})`);
      });
    } else {
      console.log('No critical areas identified! Strong skill portfolio.');
    }
    
    console.log(`\n💡 Run 'cortex skill-gap analyze' to see gaps against target roles`);
    
  } catch (error) {
    console.error('❌ Error running assessment:', error.message);
    process.exit(1);
  }
}

/**
 * Analyze skill gaps
 * @param {Array} args - Command arguments
 */
function analyzeGaps(args) {
  displayHeader('Gap Analysis');
  
  const options = parseAnalysisArgs(args);
  
  // Get latest assessment
  const latestAssessment = assessment.getLatestAssessment(options.userId);
  if (!latestAssessment) {
    console.error('❌ No assessment found. Please run "cortex skill-gap assess" first.');
    process.exit(1);
  }
  
  console.log(`Analyzing gaps for target role: ${options.targetRole}\n`);
  
  try {
    const gapAnalysis = assessment.analyzeSkillGaps(latestAssessment, options.targetRole);
    
    displaySection('Gap Analysis Summary', '🎯');
    console.log(`Target Role: ${gapAnalysis.targetRole}`);
    console.log(`Current Readiness: ${gapAnalysis.readinessPercentage}%`);
    console.log(`Overall Gap Score: ${gapAnalysis.overallGapScore}/10`);
    console.log(`Skills to Improve: ${Object.keys(gapAnalysis.gaps).length}`);
    console.log(`Existing Strengths: ${Object.keys(gapAnalysis.strengths).length}`);
    
    // Priority gaps
    if (Object.keys(gapAnalysis.gaps).length > 0) {
      displaySection('Priority Skills to Develop', '🚀');
      const priorityGaps = Object.entries(gapAnalysis.gaps)
        .sort((a, b) => b[1].priority - a[1].priority)
        .slice(0, 8);
      
      const gapTableData = priorityGaps.map(([skillKey, gap]) => ({
        'Skill': gap.skillName,
        'Current': `${gap.current}/10`,
        'Required': `${gap.required}/10`,
        'Gap': gap.gap,
        'Priority': gap.priority,
        'Market Demand': `${gap.marketDemand}/10`
      }));
      
      displayTable(gapTableData, ['Skill', 'Current', 'Required', 'Gap', 'Priority', 'Market Demand']);
    }
    
    // Existing strengths
    if (Object.keys(gapAnalysis.strengths).length > 0) {
      displaySection('Your Strengths', '💪');
      const topStrengths = Object.entries(gapAnalysis.strengths)
        .slice(0, 5);
      
      topStrengths.forEach(([skillKey, strength], index) => {
        console.log(`${index + 1}. ${strength.skillName}: ${strength.current}/10 (${strength.excess} above requirement)`);
      });
    }
    
    // Analysis text
    displaySection('Detailed Analysis', '📝');
    console.log(gapAnalysis.analysis);
    
    console.log(`\n💡 Run 'cortex skill-gap learn' to get personalized learning recommendations`);
    
  } catch (error) {
    console.error('❌ Error analyzing gaps:', error.message);
    process.exit(1);
  }
}

/**
 * Generate learning path
 * @param {Array} args - Command arguments
 */
function generateLearning(args) {
  displayHeader('Learning Path Generation');
  
  const options = parseLearningArgs(args);
  
  // Get latest assessment
  const latestAssessment = assessment.getLatestAssessment(options.userId);
  if (!latestAssessment) {
    console.error('❌ No assessment found. Please run "cortex skill-gap assess" first.');
    process.exit(1);
  }
  
  // Get gap analysis
  const gapAnalysis = assessment.analyzeSkillGaps(latestAssessment, options.targetRole);
  
  console.log(`Generating personalized learning path for: ${options.targetRole}\n`);
  console.log(`Time Commitment: ${options.timeCommitment} hours/week`);
  console.log(`Budget: ${formatCurrency(options.budget)}/month`);
  console.log(`Preferred Format: ${options.preferredFormat}\n`);
  
  try {
    const learningPathResult = learningPath.generateLearningPath(gapAnalysis, options);
    
    displaySection('Learning Path Summary', '🗺️');
    console.log(`Path ID: ${learningPathResult.id}`);
    console.log(`Total Skills: ${learningPathResult.summary.totalSkills}`);
    console.log(`Timeline: ${learningPathResult.summary.totalWeeks} weeks`);
    console.log(`Total Time: ${learningPathResult.totalEstimatedTime} hours`);
    console.log(`Total Cost: ${formatCurrency(learningPathResult.totalEstimatedCost)}`);
    console.log(`Cost per Month: ${formatCurrency(learningPathResult.summary.costPerMonth)}`);
    console.log(`Expected Improvement: +${learningPathResult.summary.estimatedReadinessImprovement}% readiness`);
    
    // Timeline overview
    displaySection('Learning Timeline', '⏱️');
    if (learningPathResult.timeline.length > 0) {
      const timelineData = learningPathResult.timeline.map(item => ({
        'Skill': item.skillName,
        'Start Week': item.startWeek,
        'End Week': item.endWeek,
        'Hours': item.estimatedHours,
        'Cost': formatCurrency(item.cost),
        'Priority': item.priority
      }));
      
      displayTable(timelineData, ['Skill', 'Start Week', 'End Week', 'Hours', 'Cost', 'Priority']);
    }
    
    // Weekly schedule preview
    displaySection('Weekly Schedule Preview (First 4 Weeks)', '📅');
    const firstFourWeeks = learningPathResult.weeklySchedule.slice(0, 4);
    firstFourWeeks.forEach(week => {
      console.log(`\nWeek ${week.week} (${week.totalHours} hours):`);
      week.activities.forEach(activity => {
        console.log(`  • ${activity.skill}: ${activity.hours}h - ${activity.focus}`);
      });
    });
    
    // Resource recommendations for top priority skill
    if (Object.keys(learningPathResult.skills).length > 0) {
      const topSkill = Object.values(learningPathResult.skills)[0];
      
      displaySection(`Resources for ${topSkill.skillName} (Top Priority)`, '📚');
      
      if (topSkill.resources.courses.length > 0) {
        console.log('\n📺 Recommended Courses:');
        topSkill.resources.courses.forEach((course, i) => {
          console.log(`  ${i + 1}. ${course.name} (${course.provider})`);
          console.log(`     Duration: ${course.duration}, Cost: ${formatCurrency(course.cost)}, Rating: ${course.rating}/5`);
        });
      }
      
      if (topSkill.resources.books.length > 0) {
        console.log('\n📖 Recommended Books:');
        topSkill.resources.books.forEach((book, i) => {
          console.log(`  ${i + 1}. ${book.name} by ${book.author}`);
          console.log(`     Cost: ${formatCurrency(book.cost)}, Level: ${book.difficulty}`);
        });
      }
      
      if (topSkill.resources.projects.length > 0) {
        console.log('\n🛠️ Recommended Projects:');
        topSkill.resources.projects.forEach((project, i) => {
          console.log(`  ${i + 1}. ${project.name}`);
          console.log(`     Difficulty: ${project.difficulty}, Time: ${project.timeEstimate}`);
        });
      }
      
      // Milestones
      if (topSkill.milestones.length > 0) {
        console.log(`\n🎯 ${topSkill.skillName} Learning Milestones:`);
        topSkill.milestones.forEach((milestone, i) => {
          console.log(`  ${i + 1}. ${milestone.name} (${milestone.progressPercentage}%)`);
          console.log(`     ${milestone.description} - ${milestone.estimatedHours}h`);
        });
      }
    }
    
    console.log(`\n💡 Track your progress with 'cortex skill-gap progress'`);
    console.log(`💡 View market data with 'cortex skill-gap market'`);
    
  } catch (error) {
    console.error('❌ Error generating learning path:', error.message);
    process.exit(1);
  }
}

/**
 * Show market demand data
 * @param {Array} args - Command arguments
 */
function showMarketData(args) {
  displayHeader('Market Demand Analysis');
  
  const options = parseMarketArgs(args);
  
  try {
    marketDemand.initializeMarketData();
    
    if (options.trends) {
      const trends = marketDemand.analyzeTrendingSkills();
      
      displaySection('Trending Skills', '📈');
      if (trends.trending.length > 0) {
        const trendingData = trends.trending.slice(0, 10).map(skill => ({
          'Skill': skill.skill,
          'Demand': `${skill.demand}/10`,
          'Growth': formatPercentage(skill.growth),
          'Avg Rate': formatCurrency(skill.avgRate),
          'Jobs': skill.jobCount.toLocaleString(),
          'Future Proof': `${skill.futureProof}/10`
        }));
        
        displayTable(trendingData, ['Skill', 'Demand', 'Growth', 'Avg Rate', 'Jobs', 'Future Proof']);
      }
      
      if (trends.declining.length > 0) {
        displaySection('Declining Skills (Avoid)', '📉');
        trends.declining.forEach(skill => {
          console.log(`❌ ${skill.skill}: ${formatPercentage(skill.growth)} decline (Risk: ${skill.riskScore.toFixed(1)})`);
        });
      }
      
      displaySection('Market Analysis', '📊');
      console.log(trends.analysis);
    }
    
    if (options.pricing && options.skills.length > 0) {
      const pricing = marketDemand.analyzeSkillPricing(options.skills);
      
      displaySection(`Pricing Analysis for Your Skills`, '💰');
      console.log(`Total Market Value: ${pricing.totalMarketValue.toFixed(0)} points`);
      console.log(`Rate Multiplier: ${pricing.rateMultiplier.toFixed(2)}x`);
      console.log(`Competitive Position: ${pricing.competitivePosition.position}`);
      
      console.log('\n💵 Recommended Rates:');
      const rates = pricing.recommendedRate;
      console.log(`  Min Rate: ${formatCurrency(rates.min)}/hour`);
      console.log(`  Target Rate: ${formatCurrency(rates.mid)}/hour`);
      console.log(`  Max Rate: ${formatCurrency(rates.max)}/hour`);
      console.log(`  Confidence: ${rates.confidence}%`);
      
      if (pricing.skillPricing.length > 0) {
        displaySection('Individual Skill Rates', '💵');
        const skillPricingData = pricing.skillPricing.map(skill => ({
          'Skill': skill.skill,
          'Base Rate': formatCurrency(skill.baseRate),
          'Demand': `${skill.demand}/10`,
          'Market Value': skill.marketValue.toFixed(0)
        }));
        
        displayTable(skillPricingData, ['Skill', 'Base Rate', 'Demand', 'Market Value']);
      }
      
      if (pricing.platformRecommendations.length > 0) {
        displaySection('Platform Recommendations', '🌐');
        pricing.platformRecommendations.forEach((platform, i) => {
          console.log(`${i + 1}. ${platform.platform.toUpperCase()}`);
          console.log(`   Average Rate: ${formatCurrency(platform.avgRate)}/hour`);
          console.log(`   Skill Coverage: ${platform.skillCoverage.toFixed(1)}%`);
          console.log(`   Recommendation: ${platform.recommendation}`);
          console.log('');
        });
      }
    }
    
    if (options.competitive && options.skills.length > 0) {
      const competitive = marketDemand.analyzeCompetitiveAdvantage(options.skills);
      
      displaySection('Competitive Advantage Analysis', '⚔️');
      console.log(`Overall Advantage Score: ${competitive.advantageScore}/100`);
      console.log(`Unique Positioning: ${competitive.uniquePositioning.positioning}`);
      console.log(`Uniqueness Score: ${competitive.uniquePositioning.uniqueness}/100`);
      
      if (competitive.currentAdvantages.length > 0) {
        displaySection('Current Skill Combinations', '💼');
        competitive.currentAdvantages.forEach((combo, i) => {
          console.log(`${i + 1}. ${combo.combination}: ${combo.multiplier}x rate multiplier (Demand: ${combo.demand}/10)`);
        });
      }
      
      if (competitive.potentialAdvantages.length > 0) {
        displaySection('Potential Skill Combinations', '🎯');
        competitive.potentialAdvantages.slice(0, 3).forEach((combo, i) => {
          console.log(`${i + 1}. Learn "${combo.missingSkill}" to unlock: ${combo.combination}`);
          console.log(`   Potential: ${combo.multiplier}x rate multiplier (Demand: ${combo.demand}/10)`);
        });
      }
    }
    
    if (options.futureProof && options.skills.length > 0) {
      const futureProof = marketDemand.generateFutureProofingRecommendations(options.skills);
      
      displaySection('Future-Proofing Analysis', '🔮');
      console.log(`Overall Future-Proof Score: ${futureProof.overallFutureProofScore}/10`);
      console.log(`Risk Level: ${futureProof.riskLevel}`);
      
      if (futureProof.emergingSkillsToLearn.length > 0) {
        displaySection('Emerging Skills to Learn', '🚀');
        const emergingData = futureProof.emergingSkillsToLearn.map(skill => ({
          'Skill': skill.skill,
          'Future Proof': `${skill.futureProof}/10`,
          'Growth': formatPercentage(skill.growth),
          'Demand': `${skill.demand}/10`,
          'Urgency': skill.urgency
        }));
        
        displayTable(emergingData, ['Skill', 'Future Proof', 'Growth', 'Demand', 'Urgency']);
      }
      
      if (futureProof.timeline.length > 0) {
        displaySection('Learning Timeline', '📅');
        futureProof.timeline.forEach(item => {
          console.log(`${item.quarter}: ${item.skill} (Urgency: ${item.urgency}) - ${item.rationale}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error analyzing market data:', error.message);
    process.exit(1);
  }
}

/**
 * Track learning progress
 * @param {Array} args - Command arguments
 */
function trackProgress(args) {
  displayHeader('Learning Progress Tracking');
  
  const options = parseProgressArgs(args);
  
  try {
    if (options.update) {
      // Update progress
      const progressData = {};
      
      if (options.hours) {
        progressData.hoursSpent = parseInt(options.hours);
      }
      
      if (options.milestone) {
        progressData.milestoneCompleted = options.milestone;
      }
      
      if (options.level) {
        progressData.currentLevel = parseInt(options.level);
      }
      
      if (options.note) {
        progressData.note = options.note;
      }
      
      const updatedProgress = learningPath.trackProgress(options.userId, options.skill, progressData);
      
      console.log(`✅ Progress updated for ${options.skill}:`);
      console.log(`   Total Hours: ${updatedProgress.hoursSpent}`);
      console.log(`   Current Level: ${updatedProgress.currentLevel}/10`);
      console.log(`   Milestones: ${updatedProgress.milestonesCompleted.length}`);
      console.log(`   Last Updated: ${new Date(updatedProgress.lastUpdated).toLocaleString()}`);
      
    } else {
      // Show progress
      const userProgress = learningPath.getUserProgress(options.userId);
      
      if (Object.keys(userProgress).length === 0) {
        console.log('No progress data found. Start tracking with:');
        console.log('cortex skill-gap progress --update --skill javascript --hours 5 --level 6');
        return;
      }
      
      displaySection('Learning Progress Overview', '📊');
      
      const progressData = Object.entries(userProgress).map(([skill, data]) => ({
        'Skill': skill,
        'Hours Spent': data.hoursSpent,
        'Current Level': `${data.currentLevel}/10`,
        'Milestones': data.milestonesCompleted.length,
        'Started': new Date(data.startedAt).toLocaleDateString(),
        'Last Update': new Date(data.lastUpdated).toLocaleDateString()
      }));
      
      displayTable(progressData, ['Skill', 'Hours Spent', 'Current Level', 'Milestones', 'Started', 'Last Update']);
      
      // Show detailed progress for each skill
      Object.entries(userProgress).forEach(([skill, data]) => {
        if (data.milestonesCompleted.length > 0 || data.notes.length > 0) {
          displaySection(`${skill} - Detailed Progress`, '📈');
          
          if (data.milestonesCompleted.length > 0) {
            console.log('Completed Milestones:');
            data.milestonesCompleted.forEach(milestone => {
              console.log(`  ✅ ${milestone.milestone} - ${new Date(milestone.completedAt).toLocaleDateString()}`);
            });
          }
          
          if (data.notes.length > 0) {
            console.log('\nNotes:');
            data.notes.slice(-3).forEach(note => { // Last 3 notes
              console.log(`  📝 ${note.note} (${new Date(note.timestamp).toLocaleDateString()})`);
            });
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error tracking progress:', error.message);
    process.exit(1);
  }
}

// ─── Argument Parsing ──────────────────────────────────────────────────────

function parseAssessmentArgs(args) {
  const options = {
    userId: 'default',
    interactive: false
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--user':
        options.userId = args[i + 1];
        i++;
        break;
      case '--interactive':
        options.interactive = true;
        break;
    }
  }
  
  return options;
}

function parseAnalysisArgs(args) {
  const options = {
    userId: 'default',
    targetRole: 'fullstack-developer'
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--user':
        options.userId = args[i + 1];
        i++;
        break;
      case '--role':
        options.targetRole = args[i + 1];
        i++;
        break;
    }
  }
  
  return options;
}

function parseLearningArgs(args) {
  const options = {
    userId: 'default',
    targetRole: 'fullstack-developer',
    timeCommitment: 10,
    budget: 500,
    preferredFormat: 'mixed',
    targetTimeframe: 6,
    difficulty: 'progressive'
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--user':
        options.userId = args[i + 1];
        i++;
        break;
      case '--role':
        options.targetRole = args[i + 1];
        i++;
        break;
      case '--time':
        options.timeCommitment = parseInt(args[i + 1]);
        i++;
        break;
      case '--budget':
        options.budget = parseInt(args[i + 1]);
        i++;
        break;
      case '--format':
        options.preferredFormat = args[i + 1];
        i++;
        break;
      case '--difficulty':
        options.difficulty = args[i + 1];
        i++;
        break;
    }
  }
  
  return options;
}

function parseMarketArgs(args) {
  const options = {
    trends: false,
    pricing: false,
    competitive: false,
    futureProof: false,
    skills: []
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--trends':
        options.trends = true;
        break;
      case '--pricing':
        options.pricing = true;
        break;
      case '--competitive':
        options.competitive = true;
        break;
      case '--future-proof':
        options.futureProof = true;
        break;
      case '--skills':
        // Collect remaining args as skills
        options.skills = args.slice(i + 1);
        return options;
    }
  }
  
  // If no specific analysis requested, show trends by default
  if (!options.trends && !options.pricing && !options.competitive && !options.futureProof) {
    options.trends = true;
  }
  
  return options;
}

function parseProgressArgs(args) {
  const options = {
    userId: 'default',
    update: false,
    skill: null,
    hours: null,
    milestone: null,
    level: null,
    note: null
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--user':
        options.userId = args[i + 1];
        i++;
        break;
      case '--update':
        options.update = true;
        break;
      case '--skill':
        options.skill = args[i + 1];
        i++;
        break;
      case '--hours':
        options.hours = args[i + 1];
        i++;
        break;
      case '--milestone':
        options.milestone = args[i + 1];
        i++;
        break;
      case '--level':
        options.level = args[i + 1];
        i++;
        break;
      case '--note':
        options.note = args[i + 1];
        i++;
        break;
    }
  }
  
  return options;
}

// ─── Main CLI Router ───────────────────────────────────────────────────────

function showHelp() {
  displayHeader('Help');
  
  console.log('🎯 Cortex Skill Gap Analyzer - AI-Powered Freelancer Skill Development');
  console.log('\nUSAGE:');
  console.log('  cortex skill-gap <command> [options]');
  
  console.log('\nCOMMANDS:');
  console.log('  assess     Run comprehensive skill assessment');
  console.log('  analyze    Analyze skill gaps against target roles');
  console.log('  learn      Generate personalized learning path');
  console.log('  market     Show market demand and pricing data');
  console.log('  progress   Track learning progress');
  console.log('  help       Show this help message');
  
  console.log('\nASSESSMENT OPTIONS:');
  console.log('  --user <id>       User identifier (default: "default")');
  console.log('  --interactive     Interactive assessment mode');
  
  console.log('\nANALYSIS OPTIONS:');
  console.log('  --user <id>       User identifier');
  console.log('  --role <role>     Target role (fullstack-developer, ai-consultant, etc.)');
  
  console.log('\nLEARNING PATH OPTIONS:');
  console.log('  --user <id>       User identifier');
  console.log('  --role <role>     Target role');
  console.log('  --time <hours>    Weekly time commitment (default: 10)');
  console.log('  --budget <amount> Monthly budget in USD (default: 500)');
  console.log('  --format <type>   Preferred format: courses, books, projects, mixed');
  console.log('  --difficulty <level> Learning difficulty: beginner, intermediate, advanced, progressive');
  
  console.log('\nMARKET DATA OPTIONS:');
  console.log('  --trends          Show trending skills');
  console.log('  --pricing         Analyze skill pricing');
  console.log('  --competitive     Analyze competitive advantage');
  console.log('  --future-proof    Future-proofing recommendations');
  console.log('  --skills <list>   Space-separated list of skills to analyze');
  
  console.log('\nPROGRESS TRACKING:');
  console.log('  --update          Update progress');
  console.log('  --skill <name>    Skill to update');
  console.log('  --hours <num>     Hours spent studying');
  console.log('  --milestone <text> Milestone completed');
  console.log('  --level <num>     Current skill level (1-10)');
  console.log('  --note <text>     Add a progress note');
  
  console.log('\nEXAMPLES:');
  console.log('  cortex skill-gap assess --interactive');
  console.log('  cortex skill-gap analyze --role ai-consultant');
  console.log('  cortex skill-gap learn --time 15 --budget 1000');
  console.log('  cortex skill-gap market --pricing --skills javascript react nodejs');
  console.log('  cortex skill-gap market --trends');
  console.log('  cortex skill-gap progress --update --skill javascript --hours 5 --level 7');
  
  console.log('\nFor more information, visit: https://cortex-freelancer.com');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }
  
  switch (command) {
    case 'assess':
      runAssessment(args.slice(1));
      break;
    case 'analyze':
      analyzeGaps(args.slice(1));
      break;
    case 'learn':
      generateLearning(args.slice(1));
      break;
    case 'market':
      showMarketData(args.slice(1));
      break;
    case 'progress':
      trackProgress(args.slice(1));
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "cortex skill-gap help" for available commands.');
      process.exit(1);
  }
}

// ─── Module Exports ─────────────────────────────────────────────────────────

module.exports = {
  main,
  runAssessment,
  analyzeGaps,
  generateLearning,
  showMarketData,
  trackProgress,
  showHelp
};

// CLI execution
if (require.main === module) {
  main();
}