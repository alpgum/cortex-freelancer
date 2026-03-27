/**
 * Jobs API — Serve mock job listings with filtering, sorting, and pagination
 *
 * GET /api/jobs                        — List all jobs (paginated)
 * GET /api/jobs?category=web-dev       — Filter by category
 * GET /api/jobs?skills=React,Node.js   — Filter by skills (comma-separated)
 * GET /api/jobs?budget_min=1000        — Filter by minimum budget
 * GET /api/jobs?budget_max=10000       — Filter by maximum budget
 * GET /api/jobs?experience=expert      — Filter by experience level
 * GET /api/jobs?platform=upwork        — Filter by platform
 * GET /api/jobs?urgency=high           — Filter by urgency
 * GET /api/jobs?search=react           — Full-text search
 * GET /api/jobs?sort=budget_desc       — Sort: budget_asc, budget_desc, posted_desc, competition_asc
 * GET /api/jobs?page=1&limit=20        — Pagination
 * GET /api/jobs?id=job_001             — Get single job by ID
 */

const path = require('path');
const fs = require('fs');
const { cors } = require('./middleware/cors');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

let jobsCache = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

function loadJobs() {
  const now = Date.now();
  if (jobsCache && (now - cacheTime) < CACHE_TTL) return jobsCache;

  const filePath = path.join(__dirname, '..', 'data', 'mock-jobs.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  jobsCache = data.jobs;
  cacheTime = now;
  return jobsCache;
}

function getBudgetValue(job) {
  if (!job.budget) return 0;
  if (job.budget.type === 'hourly' || job.budget.type === 'monthly' || job.budget.type === 'per-episode') {
    return (job.budget.min + job.budget.max) / 2;
  }
  return (job.budget.min + job.budget.max) / 2;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const jobs = loadJobs();
  const q = req.query;

  // Single job by ID
  if (q.id) {
    const job = jobs.find(j => j.id === q.id);
    if (!job) return sendError(res, 404, 'Job not found');
    return res.json({ success: true, job });
  }

  let filtered = [...jobs];

  // Category filter
  if (q.category) {
    const cats = q.category.split(',').map(c => c.trim().toLowerCase());
    filtered = filtered.filter(j => cats.includes(j.category));
  }

  // Skills filter (any match)
  if (q.skills) {
    const skills = q.skills.split(',').map(s => s.trim().toLowerCase());
    filtered = filtered.filter(j =>
      j.skills.some(s => skills.includes(s.toLowerCase()))
    );
  }

  // Budget filters
  if (q.budget_min) {
    const min = parseFloat(q.budget_min);
    filtered = filtered.filter(j => getBudgetValue(j) >= min);
  }
  if (q.budget_max) {
    const max = parseFloat(q.budget_max);
    filtered = filtered.filter(j => getBudgetValue(j) <= max);
  }

  // Experience level
  if (q.experience) {
    filtered = filtered.filter(j => j.experience_level === q.experience);
  }

  // Platform
  if (q.platform) {
    filtered = filtered.filter(j => j.platform === q.platform);
  }

  // Urgency
  if (q.urgency) {
    filtered = filtered.filter(j => j.urgency === q.urgency);
  }

  // Full-text search
  if (q.search) {
    const term = q.search.toLowerCase();
    filtered = filtered.filter(j =>
      j.title.toLowerCase().includes(term) ||
      j.description.toLowerCase().includes(term) ||
      j.skills.some(s => s.toLowerCase().includes(term)) ||
      j.category.toLowerCase().includes(term)
    );
  }

  // Sorting
  const sort = q.sort || 'posted_desc';
  switch (sort) {
    case 'budget_asc':
      filtered.sort((a, b) => getBudgetValue(a) - getBudgetValue(b));
      break;
    case 'budget_desc':
      filtered.sort((a, b) => getBudgetValue(b) - getBudgetValue(a));
      break;
    case 'posted_desc':
      filtered.sort((a, b) => new Date(b.posted) - new Date(a.posted));
      break;
    case 'posted_asc':
      filtered.sort((a, b) => new Date(a.posted) - new Date(b.posted));
      break;
    case 'competition_asc':
      filtered.sort((a, b) => a.competition.proposals - b.competition.proposals);
      break;
    case 'competition_desc':
      filtered.sort((a, b) => b.competition.proposals - a.competition.proposals);
      break;
    default:
      filtered.sort((a, b) => new Date(b.posted) - new Date(a.posted));
  }

  // Pagination
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 20));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  // Category summary
  const categories = {};
  jobs.forEach(j => {
    categories[j.category] = (categories[j.category] || 0) + 1;
  });

  res.json({
    success: true,
    data: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    filters: {
      category: q.category || null,
      skills: q.skills || null,
      search: q.search || null,
      sort
    },
    categories
  });
});
