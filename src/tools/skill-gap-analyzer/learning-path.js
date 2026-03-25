#!/usr/bin/env node
/**
 * Learning Path Generator
 * CFX-067: Skill Gap Analysis with Personalized Learning Path Recommendations
 *
 * Personalized learning recommendations based on identified gaps
 * Priority scoring: high-ROI skills first (market demand × gap size)
 * Resource recommendations (courses, books, projects, certifications)
 * Time estimates for skill acquisition at different commitment levels
 * Milestone-based progress tracking
 */

const fs = require('fs');
const path = require('path');

// ─── Storage helpers ────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'skill-gap-analyzer'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  learningPaths: () => path.join(DATA_DIR, 'learning-paths.json'),
  resources: () => path.join(DATA_DIR, 'learning-resources.json'),
  progress: () => path.join(DATA_DIR, 'learning-progress.json'),
  milestones: () => path.join(DATA_DIR, 'milestones.json'),
};

// ─── Learning Resource Database ────────────────────────────────────────────

/**
 * Default learning resources for different skills
 */
const DEFAULT_LEARNING_RESOURCES = {
  javascript: {
    courses: [
      { name: "JavaScript: Understanding the Weird Parts", provider: "Udemy", duration: "11.5h", cost: 49.99, rating: 4.6 },
      { name: "The Complete JavaScript Course 2024", provider: "Udemy", duration: "69h", cost: 59.99, rating: 4.7 },
      { name: "JavaScript Algorithms and Data Structures", provider: "freeCodeCamp", duration: "300h", cost: 0, rating: 4.8 }
    ],
    books: [
      { name: "Eloquent JavaScript", author: "Marijn Haverbeke", cost: 39.95, difficulty: "intermediate" },
      { name: "You Don't Know JS", author: "Kyle Simpson", cost: 0, difficulty: "advanced" },
      { name: "JavaScript: The Good Parts", author: "Douglas Crockford", cost: 29.99, difficulty: "intermediate" }
    ],
    projects: [
      { name: "Build a Todo App", difficulty: "beginner", timeEstimate: "1-2 weeks" },
      { name: "Create a Weather Dashboard", difficulty: "intermediate", timeEstimate: "2-3 weeks" },
      { name: "Build a Real-time Chat App", difficulty: "advanced", timeEstimate: "4-6 weeks" }
    ],
    certifications: [
      { name: "JavaScript Institute Certification", provider: "JavaScript Institute", cost: 295, duration: "3 months" },
      { name: "Mozilla Developer Certification", provider: "Mozilla", cost: 149, duration: "2 months" }
    ]
  },
  react: {
    courses: [
      { name: "React - The Complete Guide", provider: "Udemy", duration: "48.5h", cost: 59.99, rating: 4.6 },
      { name: "Complete React Developer", provider: "Zero to Mastery", duration: "40h", cost: 39, rating: 4.7 },
      { name: "React Router", provider: "Frontend Masters", duration: "4h", cost: 39, rating: 4.5 }
    ],
    books: [
      { name: "Learning React", author: "Alex Banks", cost: 49.99, difficulty: "beginner" },
      { name: "React Up & Running", author: "Stoyan Stefanov", cost: 39.99, difficulty: "intermediate" },
      { name: "Pro React", author: "Cassio de Sousa Antonio", cost: 59.99, difficulty: "advanced" }
    ],
    projects: [
      { name: "Build a Netflix Clone", difficulty: "intermediate", timeEstimate: "3-4 weeks" },
      { name: "Create an E-commerce Site", difficulty: "advanced", timeEstimate: "6-8 weeks" },
      { name: "Build a Social Media Dashboard", difficulty: "intermediate", timeEstimate: "4-5 weeks" }
    ],
    certifications: [
      { name: "Meta React Developer Certificate", provider: "Meta/Coursera", cost: 49, duration: "3 months" },
      { name: "React Developer Certification", provider: "HackerRank", cost: 199, duration: "1 month" }
    ]
  },
  python: {
    courses: [
      { name: "Complete Python Bootcamp", provider: "Udemy", duration: "22h", cost: 49.99, rating: 4.6 },
      { name: "Python for Everybody", provider: "University of Michigan/Coursera", duration: "32h", cost: 0, rating: 4.8 },
      { name: "Automate the Boring Stuff with Python", provider: "Udemy", duration: "9.5h", cost: 49.99, rating: 4.6 }
    ],
    books: [
      { name: "Python Crash Course", author: "Eric Matthes", cost: 39.99, difficulty: "beginner" },
      { name: "Fluent Python", author: "Luciano Ramalho", cost: 59.99, difficulty: "advanced" },
      { name: "Effective Python", author: "Brett Slatkin", cost: 49.99, difficulty: "intermediate" }
    ],
    projects: [
      { name: "Build a Web Scraper", difficulty: "beginner", timeEstimate: "1-2 weeks" },
      { name: "Create a REST API with Django", difficulty: "intermediate", timeEstimate: "3-4 weeks" },
      { name: "Build a Machine Learning Model", difficulty: "advanced", timeEstimate: "6-8 weeks" }
    ],
    certifications: [
      { name: "Python Institute PCAP", provider: "Python Institute", cost: 295, duration: "3 months" },
      { name: "Microsoft Python Certification", provider: "Microsoft", cost: 165, duration: "2 months" }
    ]
  },
  communication: {
    courses: [
      { name: "Communication Skills Machine", provider: "Udemy", duration: "2.5h", cost: 34.99, rating: 4.5 },
      { name: "Business Communication", provider: "University of Pennsylvania/Coursera", duration: "16h", cost: 49, rating: 4.4 },
      { name: "Public Speaking Foundations", provider: "LinkedIn Learning", duration: "2h", cost: 29.99, rating: 4.3 }
    ],
    books: [
      { name: "How to Win Friends and Influence People", author: "Dale Carnegie", cost: 15.99, difficulty: "beginner" },
      { name: "Crucial Conversations", author: "Kerry Patterson", cost: 24.99, difficulty: "intermediate" },
      { name: "Made to Stick", author: "Chip Heath", cost: 16.99, difficulty: "intermediate" }
    ],
    projects: [
      { name: "Start a Newsletter", difficulty: "beginner", timeEstimate: "2-3 weeks" },
      { name: "Give a Tech Talk", difficulty: "intermediate", timeEstimate: "1 month" },
      { name: "Create a Video Course", difficulty: "advanced", timeEstimate: "2-3 months" }
    ],
    certifications: [
      { name: "Toastmasters Competent Communicator", provider: "Toastmasters", cost: 90, duration: "6 months" },
      { name: "Dale Carnegie Communication Certificate", provider: "Dale Carnegie", cost: 1990, duration: "3 months" }
    ]
  },
  project_management: {
    courses: [
      { name: "Project Management Professional (PMP)", provider: "Udemy", duration: "35h", cost: 59.99, rating: 4.5 },
      { name: "Agile Project Management", provider: "Google/Coursera", duration: "24h", cost: 49, rating: 4.6 },
      { name: "Scrum Master Certification", provider: "Scrum Alliance", duration: "16h", cost: 995, rating: 4.7 }
    ],
    books: [
      { name: "PMBOK Guide", author: "PMI", cost: 89.99, difficulty: "advanced" },
      { name: "Agile Project Management with Scrum", author: "Ken Schwaber", cost: 34.99, difficulty: "intermediate" },
      { name: "The Lean Startup", author: "Eric Ries", cost: 17.99, difficulty: "beginner" }
    ],
    projects: [
      { name: "Manage a Small Team Project", difficulty: "beginner", timeEstimate: "1 month" },
      { name: "Lead a Product Launch", difficulty: "intermediate", timeEstimate: "3 months" },
      { name: "Run an Agile Transformation", difficulty: "advanced", timeEstimate: "6 months" }
    ],
    certifications: [
      { name: "PMP Certification", provider: "PMI", cost: 555, duration: "3-6 months" },
      { name: "Certified ScrumMaster", provider: "Scrum Alliance", cost: 1395, duration: "2 months" },
      { name: "Google Project Management Certificate", provider: "Google/Coursera", cost: 49, duration: "6 months" }
    ]
  }
};

// ─── Learning Path Generation ──────────────────────────────────────────────

/**
 * Generate personalized learning path based on skill gaps
 * @param {Object} gapAnalysis - Output from assessment.analyzeSkillGaps()
 * @param {Object} options - Learning preferences and constraints
 * @returns {Object} Personalized learning path
 */
function generateLearningPath(gapAnalysis, options = {}) {
  const {
    timeCommitment = 10, // hours per week
    budget = 500, // monthly budget in USD
    preferredFormat = 'mixed', // 'courses', 'books', 'projects', 'mixed'
    targetTimeframe = 6, // months
    difficulty = 'progressive' // 'beginner', 'intermediate', 'advanced', 'progressive'
  } = options;

  initializeLearningResources();
  const resources = readJSON(PATHS.resources(), DEFAULT_LEARNING_RESOURCES);

  // Sort gaps by priority (market demand × gap size)
  const prioritizedGaps = Object.entries(gapAnalysis.gaps)
    .sort((a, b) => b[1].priority - a[1].priority);

  const learningPath = {
    id: generateLearningPathId(),
    userId: gapAnalysis.userId || 'default',
    targetRole: gapAnalysis.targetRole,
    createdAt: new Date().toISOString(),
    options,
    timeline: [],
    totalEstimatedTime: 0,
    totalEstimatedCost: 0,
    skills: {},
    milestones: [],
    weeklySchedule: []
  };

  let cumulativeWeeks = 0;
  let cumulativeCost = 0;
  
  // Generate learning plan for each skill gap
  for (const [skillKey, gap] of prioritizedGaps.slice(0, 8)) { // Top 8 priorities
    const skillPlan = generateSkillLearningPlan(
      skillKey,
      gap,
      { timeCommitment, budget, preferredFormat, difficulty },
      resources
    );

    if (skillPlan) {
      learningPath.skills[skillKey] = skillPlan;
      learningPath.totalEstimatedTime += skillPlan.estimatedHours;
      learningPath.totalEstimatedCost += skillPlan.totalCost;
      
      // Add to timeline
      const startWeek = cumulativeWeeks + 1;
      const endWeek = startWeek + skillPlan.timelineWeeks - 1;
      
      learningPath.timeline.push({
        skill: skillKey,
        skillName: gap.skillName,
        startWeek,
        endWeek,
        priority: gap.priority,
        estimatedHours: skillPlan.estimatedHours,
        cost: skillPlan.totalCost
      });

      // Add milestones
      learningPath.milestones.push(...skillPlan.milestones.map(m => ({
        ...m,
        skill: skillKey,
        skillName: gap.skillName,
        week: startWeek + Math.floor((m.progressPercentage / 100) * skillPlan.timelineWeeks)
      })));

      // Update cumulative tracking
      if (startWeek % 4 === 0) { // Start new skills every 4 weeks for parallel learning
        cumulativeWeeks += skillPlan.timelineWeeks;
      } else {
        cumulativeWeeks = Math.max(cumulativeWeeks, endWeek);
      }
      
      cumulativeCost += skillPlan.totalCost;
    }
  }

  // Generate weekly schedule
  learningPath.weeklySchedule = generateWeeklySchedule(learningPath, timeCommitment);
  
  // Add summary metrics
  learningPath.summary = {
    totalSkills: Object.keys(learningPath.skills).length,
    totalWeeks: Math.max(...learningPath.timeline.map(t => t.endWeek)),
    avgHoursPerWeek: timeCommitment,
    costPerMonth: Math.round(learningPath.totalEstimatedCost / (learningPath.timeline.length / 4)),
    estimatedReadinessImprovement: calculateReadinessImprovement(gapAnalysis, learningPath)
  };

  // Save learning path
  saveLearningPath(learningPath);
  
  return learningPath;
}

/**
 * Generate learning plan for a specific skill
 * @param {string} skillKey - Skill identifier
 * @param {Object} gap - Gap analysis for the skill  
 * @param {Object} options - Learning preferences
 * @param {Object} resources - Available learning resources
 * @returns {Object} Skill learning plan
 */
function generateSkillLearningPlan(skillKey, gap, options, resources) {
  const { timeCommitment, budget, preferredFormat, difficulty } = options;
  const [category, skillName] = skillKey.split('.');
  
  const skillResources = resources[skillName];
  if (!skillResources) {
    // Generate generic plan for unknown skills
    return generateGenericSkillPlan(skillKey, gap, options);
  }

  const plan = {
    skillKey,
    skillName: gap.skillName,
    currentLevel: gap.current,
    targetLevel: gap.required,
    gap: gap.gap,
    priority: gap.priority,
    estimatedHours: estimateTimeToLearnSkill(gap.gap, skillName),
    timelineWeeks: 0,
    totalCost: 0,
    resources: {
      courses: [],
      books: [],
      projects: [],
      certifications: []
    },
    milestones: [],
    phase: determineLearningPhase(gap.current, difficulty)
  };

  // Select appropriate resources based on current level and preferences
  if (preferredFormat === 'mixed' || preferredFormat === 'courses') {
    plan.resources.courses = selectCourses(skillResources.courses, plan.phase, budget);
  }
  
  if (preferredFormat === 'mixed' || preferredFormat === 'books') {
    plan.resources.books = selectBooks(skillResources.books, plan.phase, budget);
  }
  
  if (preferredFormat === 'mixed' || preferredFormat === 'projects') {
    plan.resources.projects = selectProjects(skillResources.projects, plan.phase);
  }
  
  if (gap.gap >= 3) { // Only suggest certifications for larger gaps
    plan.resources.certifications = selectCertifications(skillResources.certifications, budget);
  }

  // Calculate timeline and costs
  plan.totalCost = calculateTotalResourceCost(plan.resources);
  plan.timelineWeeks = Math.ceil(plan.estimatedHours / timeCommitment);
  
  // Generate milestones
  plan.milestones = generateSkillMilestones(plan);
  
  return plan;
}

/**
 * Estimate time needed to learn a skill based on gap size
 * @param {number} gap - Skill level gap
 * @param {string} skillName - Name of the skill
 * @returns {number} Estimated hours
 */
function estimateTimeToLearnSkill(gap, skillName) {
  // Base hours per skill level increase
  const baseHoursPerLevel = {
    technical: 25, // Technical skills need more practice
    soft: 15,      // Soft skills develop through experience
    business: 20,  // Business skills need theoretical + practical
    domain: 30     // Domain expertise requires deep knowledge
  };

  // Skill-specific multipliers
  const skillMultipliers = {
    javascript: 1.2,
    python: 1.1,
    react: 1.3,
    aws: 1.5,
    communication: 0.8,
    project_management: 1.0,
    ai_ml: 1.8,
    blockchain: 1.6
  };

  const category = determineSkillCategory(skillName);
  const baseHours = baseHoursPerLevel[category] || 20;
  const multiplier = skillMultipliers[skillName] || 1.0;
  
  return Math.ceil(gap * baseHours * multiplier);
}

/**
 * Determine skill category for time estimation
 * @param {string} skillName - Name of the skill
 * @returns {string} Category
 */
function determineSkillCategory(skillName) {
  const technicalSkills = ['javascript', 'python', 'react', 'nodejs', 'aws', 'docker', 'sql', 'git'];
  const softSkills = ['communication', 'leadership', 'negotiation', 'adaptability'];
  const businessSkills = ['marketing', 'sales', 'finance', 'pricing', 'branding'];
  const domainSkills = ['ai_ml', 'blockchain', 'fintech', 'healthcare'];

  if (technicalSkills.includes(skillName)) return 'technical';
  if (softSkills.includes(skillName)) return 'soft';
  if (businessSkills.includes(skillName)) return 'business';
  if (domainSkills.includes(skillName)) return 'domain';
  
  return 'technical'; // default
}

/**
 * Determine learning phase based on current level
 * @param {number} currentLevel - Current skill level
 * @param {string} difficulty - Preferred difficulty
 * @returns {string} Learning phase
 */
function determineLearningPhase(currentLevel, difficulty) {
  if (difficulty === 'progressive') {
    if (currentLevel <= 2) return 'beginner';
    if (currentLevel <= 5) return 'intermediate';
    return 'advanced';
  }
  return difficulty;
}

/**
 * Select appropriate courses based on phase and budget
 * @param {Array} courses - Available courses
 * @param {string} phase - Learning phase
 * @param {number} budget - Monthly budget
 * @returns {Array} Selected courses
 */
function selectCourses(courses, phase, budget) {
  if (!courses) return [];
  
  return courses
    .filter(course => course.cost <= budget * 0.3) // Max 30% of budget per course
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 2); // Top 2 courses
}

/**
 * Select appropriate books based on phase and budget
 * @param {Array} books - Available books
 * @param {string} phase - Learning phase
 * @param {number} budget - Monthly budget  
 * @returns {Array} Selected books
 */
function selectBooks(books, phase, budget) {
  if (!books) return [];
  
  return books
    .filter(book => 
      book.difficulty === phase && 
      book.cost <= budget * 0.1 // Max 10% of budget per book
    )
    .slice(0, 2);
}

/**
 * Select appropriate projects based on phase
 * @param {Array} projects - Available projects
 * @param {string} phase - Learning phase
 * @returns {Array} Selected projects
 */
function selectProjects(projects, phase) {
  if (!projects) return [];
  
  return projects
    .filter(project => project.difficulty === phase)
    .slice(0, 2);
}

/**
 * Select appropriate certifications based on budget
 * @param {Array} certifications - Available certifications
 * @param {number} budget - Monthly budget
 * @returns {Array} Selected certifications
 */
function selectCertifications(certifications, budget) {
  if (!certifications) return [];
  
  return certifications
    .filter(cert => cert.cost <= budget * 0.8) // Max 80% of budget for certification
    .sort((a, b) => a.cost - b.cost)
    .slice(0, 1); // One certification per skill
}

/**
 * Calculate total cost of selected resources
 * @param {Object} resources - Selected resources
 * @returns {number} Total cost
 */
function calculateTotalResourceCost(resources) {
  let total = 0;
  
  ['courses', 'books', 'projects', 'certifications'].forEach(type => {
    if (resources[type]) {
      total += resources[type].reduce((sum, resource) => sum + (resource.cost || 0), 0);
    }
  });
  
  return total;
}

/**
 * Generate milestones for skill learning
 * @param {Object} plan - Skill learning plan
 * @returns {Array} Milestones
 */
function generateSkillMilestones(plan) {
  const milestones = [];
  const phases = [
    { name: 'Foundation', percentage: 25, description: 'Basic concepts and setup' },
    { name: 'Practice', percentage: 50, description: 'Hands-on exercises and small projects' },
    { name: 'Application', percentage: 75, description: 'Real-world projects and integration' },
    { name: 'Mastery', percentage: 100, description: 'Portfolio projects and advanced concepts' }
  ];

  phases.forEach(phase => {
    milestones.push({
      name: phase.name,
      description: phase.description,
      progressPercentage: phase.percentage,
      estimatedHours: Math.ceil(plan.estimatedHours * (phase.percentage / 100)),
      completed: false,
      completedAt: null
    });
  });

  return milestones;
}

/**
 * Generate weekly schedule for learning path
 * @param {Object} learningPath - Complete learning path
 * @param {number} timeCommitment - Hours per week
 * @returns {Array} Weekly schedule
 */
function generateWeeklySchedule(learningPath, timeCommitment) {
  const schedule = [];
  const maxWeeks = Math.max(...learningPath.timeline.map(t => t.endWeek));
  
  for (let week = 1; week <= maxWeeks; week++) {
    const weekActivities = learningPath.timeline.filter(
      t => week >= t.startWeek && week <= t.endWeek
    );
    
    const weekSchedule = {
      week,
      totalHours: Math.min(timeCommitment, weekActivities.length * (timeCommitment / 3)),
      activities: weekActivities.map(activity => ({
        skill: activity.skillName,
        hours: Math.round(timeCommitment / weekActivities.length),
        focus: determineFocusForWeek(activity, week - activity.startWeek + 1)
      }))
    };
    
    schedule.push(weekSchedule);
  }
  
  return schedule;
}

/**
 * Determine focus area for a given week in skill learning
 * @param {Object} activity - Timeline activity
 * @param {number} relativeWeek - Week relative to skill start
 * @returns {string} Focus description
 */
function determineFocusForWeek(activity, relativeWeek) {
  const totalWeeks = activity.endWeek - activity.startWeek + 1;
  const progressPercentage = (relativeWeek / totalWeeks) * 100;
  
  if (progressPercentage <= 25) return 'Foundation & Theory';
  if (progressPercentage <= 50) return 'Practice & Exercises';
  if (progressPercentage <= 75) return 'Projects & Application';
  return 'Mastery & Portfolio';
}

/**
 * Calculate estimated readiness improvement
 * @param {Object} gapAnalysis - Original gap analysis
 * @param {Object} learningPath - Generated learning path
 * @returns {number} Percentage improvement
 */
function calculateReadinessImprovement(gapAnalysis, learningPath) {
  const originalReadiness = gapAnalysis.readinessPercentage;
  
  // Assume 70% success rate in learning (realistic expectation)
  const successRate = 0.7;
  let skillsImproved = 0;
  let totalSkillsTargeted = Object.keys(learningPath.skills).length;
  
  Object.values(learningPath.skills).forEach(skill => {
    const expectedImprovement = skill.gap * successRate;
    skillsImproved += expectedImprovement;
  });
  
  // Calculate new readiness percentage
  const averageImprovement = skillsImproved / totalSkillsTargeted;
  const estimatedNewReadiness = Math.min(
    100, 
    originalReadiness + (averageImprovement * 10) // Each skill level = ~10% readiness
  );
  
  return Math.round(estimatedNewReadiness - originalReadiness);
}

/**
 * Generate generic learning plan for unknown skills
 * @param {string} skillKey - Skill identifier
 * @param {Object} gap - Gap analysis
 * @param {Object} options - Learning options
 * @returns {Object} Generic plan
 */
function generateGenericSkillPlan(skillKey, gap, options) {
  return {
    skillKey,
    skillName: gap.skillName,
    currentLevel: gap.current,
    targetLevel: gap.required,
    gap: gap.gap,
    priority: gap.priority,
    estimatedHours: gap.gap * 20, // Generic estimate
    timelineWeeks: Math.ceil((gap.gap * 20) / options.timeCommitment),
    totalCost: 0,
    resources: {
      courses: [{ name: `Find online courses for ${gap.skillName}`, cost: 0 }],
      books: [{ name: `Research books on ${gap.skillName}`, cost: 0 }],
      projects: [{ name: `Practice projects for ${gap.skillName}`, cost: 0 }]
    },
    milestones: [],
    phase: 'intermediate'
  };
}

/**
 * Initialize learning resources if not present
 */
function initializeLearningResources() {
  const resourcesPath = PATHS.resources();
  if (!fs.existsSync(resourcesPath)) {
    writeJSON(resourcesPath, DEFAULT_LEARNING_RESOURCES);
  }
}

/**
 * Save learning path to storage
 * @param {Object} learningPath - Learning path data
 */
function saveLearningPath(learningPath) {
  const pathsData = readJSON(PATHS.learningPaths(), {});
  pathsData[learningPath.id] = learningPath;
  writeJSON(PATHS.learningPaths(), pathsData);
}

/**
 * Get learning path by ID
 * @param {string} pathId - Learning path ID
 * @returns {Object|null} Learning path
 */
function getLearningPath(pathId) {
  const paths = readJSON(PATHS.learningPaths(), {});
  return paths[pathId] || null;
}

/**
 * Track learning progress for a user
 * @param {string} userId - User ID
 * @param {string} skillKey - Skill being tracked
 * @param {Object} progressData - Progress update
 * @returns {Object} Updated progress
 */
function trackProgress(userId, skillKey, progressData) {
  const progressPath = PATHS.progress();
  const allProgress = readJSON(progressPath, {});
  
  if (!allProgress[userId]) {
    allProgress[userId] = {};
  }
  
  if (!allProgress[userId][skillKey]) {
    allProgress[userId][skillKey] = {
      startedAt: new Date().toISOString(),
      hoursSpent: 0,
      milestonesCompleted: [],
      currentLevel: 0,
      notes: []
    };
  }
  
  const userSkillProgress = allProgress[userId][skillKey];
  
  // Update progress
  if (progressData.hoursSpent) {
    userSkillProgress.hoursSpent += progressData.hoursSpent;
  }
  
  if (progressData.milestoneCompleted) {
    userSkillProgress.milestonesCompleted.push({
      milestone: progressData.milestoneCompleted,
      completedAt: new Date().toISOString()
    });
  }
  
  if (progressData.currentLevel) {
    userSkillProgress.currentLevel = progressData.currentLevel;
  }
  
  if (progressData.note) {
    userSkillProgress.notes.push({
      note: progressData.note,
      timestamp: new Date().toISOString()
    });
  }
  
  userSkillProgress.lastUpdated = new Date().toISOString();
  
  writeJSON(progressPath, allProgress);
  return userSkillProgress;
}

/**
 * Get learning progress for user
 * @param {string} userId - User ID
 * @returns {Object} User progress data
 */
function getUserProgress(userId) {
  const allProgress = readJSON(PATHS.progress(), {});
  return allProgress[userId] || {};
}

/**
 * Generate unique learning path ID
 * @returns {string} Unique path ID
 */
function generateLearningPathId() {
  return `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Module Exports ─────────────────────────────────────────────────────────

module.exports = {
  generateLearningPath,
  generateSkillLearningPlan,
  initializeLearningResources,
  saveLearningPath,
  getLearningPath,
  trackProgress,
  getUserProgress,
  estimateTimeToLearnSkill,
  generateSkillMilestones,
  generateWeeklySchedule,
  
  // Constants
  DEFAULT_LEARNING_RESOURCES,
  PATHS
};

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'resources':
      initializeLearningResources();
      console.log('Learning resources initialized');
      break;
    case 'progress':
      const userId = args[1] || 'default';
      console.log(JSON.stringify(getUserProgress(userId), null, 2));
      break;
    default:
      console.log('Available commands:');
      console.log('  resources  - Initialize learning resources');
      console.log('  progress <userId>  - Show user progress');
  }
}