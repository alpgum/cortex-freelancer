#!/usr/bin/env node
/**
 * Team Collaboration Tools for Larger Projects
 * Sprint 2 Task 18 — Cortex Freelancer
 *
 * Manage subcontractors, assign tasks, track team workloads,
 * share project briefs, handle permissions, and coordinate
 * deliverables across multi-person freelance projects.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'teams'
);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const PATHS = {
  members:     () => path.join(DATA_DIR, 'members.json'),
  projects:    () => path.join(DATA_DIR, 'projects.json'),
  tasks:       () => path.join(DATA_DIR, 'tasks.json'),
  briefs:      () => path.join(DATA_DIR, 'briefs.json'),
  timesheets:  () => path.join(DATA_DIR, 'timesheets.json'),
  messages:    () => path.join(DATA_DIR, 'messages.json'),
  settings:    () => path.join(DATA_DIR, 'settings.json'),
};

// ─── Team Members ───────────────────────────────────────────────────────────

function addMember(name, role, opts = {}) {
  const members = readJSON(PATHS.members());

  const member = {
    id: crypto.randomUUID(),
    name,
    role,
    email: opts.email || null,
    rate: opts.rate ? parseFloat(opts.rate) : null,
    rate_type: opts.rate_type || 'hourly', // hourly, fixed, daily
    currency: opts.currency || 'USD',
    skills: opts.skills ? opts.skills.split(',').map(s => s.trim()) : [],
    availability: opts.availability || 'full-time', // full-time, part-time, per-project
    max_hours_week: opts.max_hours ? parseInt(opts.max_hours) : 40,
    timezone: opts.timezone || null,
    status: 'active',
    projects_assigned: [],
    total_hours_logged: 0,
    total_earned: 0,
    rating: null,
    notes: opts.notes || '',
    added_at: new Date().toISOString()
  };

  members.push(member);
  writeJSON(PATHS.members(), members);

  return {
    success: true,
    member_id: member.id,
    message: `👤 Team member added: ${name} (${role})\n` +
             `💰 Rate: ${member.rate ? `$${member.rate}/${member.rate_type}` : 'Not set'}\n` +
             `🔧 Skills: ${member.skills.length > 0 ? member.skills.join(', ') : 'None listed'}`,
    member
  };
}

function listMembers(opts = {}) {
  const members = readJSON(PATHS.members());
  let filtered = [...members];

  if (opts.status) filtered = filtered.filter(m => m.status === opts.status);
  if (opts.role) filtered = filtered.filter(m => m.role.toLowerCase().includes(opts.role.toLowerCase()));
  if (opts.skill) filtered = filtered.filter(m => m.skills.some(s => s.toLowerCase().includes(opts.skill.toLowerCase())));
  if (opts.available === 'true') {
    const tasks = readJSON(PATHS.tasks());
    filtered = filtered.filter(m => {
      const activeTasks = tasks.filter(t => t.assignee_id === m.id && t.status !== 'completed' && t.status !== 'cancelled');
      return activeTasks.length < 3; // Consider available if < 3 active tasks
    });
  }

  return {
    total: filtered.length,
    members: filtered.map(m => ({
      id: m.id.substring(0, 8),
      name: m.name,
      role: m.role,
      rate: m.rate ? `$${m.rate}/${m.rate_type}` : '—',
      availability: m.availability,
      skills: m.skills.slice(0, 5).join(', '),
      status: m.status === 'active' ? '🟢' : '⚪',
      projects: m.projects_assigned.length,
      hours_logged: m.total_hours_logged
    }))
  };
}

function updateMember(memberId, opts = {}) {
  const members = readJSON(PATHS.members());
  const member = members.find(m => m.id === memberId || m.id.startsWith(memberId) || m.name.toLowerCase().includes((memberId || '').toLowerCase()));

  if (!member) return { error: 'Member not found' };

  if (opts.role) member.role = opts.role;
  if (opts.rate) member.rate = parseFloat(opts.rate);
  if (opts.rate_type) member.rate_type = opts.rate_type;
  if (opts.email) member.email = opts.email;
  if (opts.skills) member.skills = opts.skills.split(',').map(s => s.trim());
  if (opts.availability) member.availability = opts.availability;
  if (opts.max_hours) member.max_hours_week = parseInt(opts.max_hours);
  if (opts.timezone) member.timezone = opts.timezone;
  if (opts.status) member.status = opts.status;
  if (opts.notes) member.notes = opts.notes;
  if (opts.rating) member.rating = parseFloat(opts.rating);

  member.updated_at = new Date().toISOString();
  writeJSON(PATHS.members(), members);

  return { success: true, message: `✅ Updated ${member.name}`, member };
}

// ─── Project Management ─────────────────────────────────────────────────────

function createProject(name, clientName, opts = {}) {
  const projects = readJSON(PATHS.projects());

  const project = {
    id: crypto.randomUUID(),
    name,
    client: clientName,
    description: opts.description || '',
    status: 'planning', // planning, active, on-hold, completed, cancelled
    budget: opts.budget ? parseFloat(opts.budget) : null,
    budget_used: 0,
    currency: opts.currency || 'USD',
    start_date: opts.start || new Date().toISOString().split('T')[0],
    deadline: opts.deadline || null,
    team_members: [],
    task_count: 0,
    completed_tasks: 0,
    total_hours: 0,
    tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : [],
    notes: opts.notes || '',
    created_at: new Date().toISOString()
  };

  projects.push(project);
  writeJSON(PATHS.projects(), projects);

  return {
    success: true,
    project_id: project.id,
    message: `📁 Project created: "${name}" for ${clientName}\n` +
             `💰 Budget: ${project.budget ? `$${project.budget.toFixed(2)}` : 'Not set'}\n` +
             `📅 Deadline: ${project.deadline || 'Not set'}`,
    project
  };
}

function assignToProject(projectId, memberId, opts = {}) {
  const projects = readJSON(PATHS.projects());
  const members = readJSON(PATHS.members());

  const project = projects.find(p => p.id === projectId || p.id.startsWith(projectId) || p.name.toLowerCase().includes((projectId || '').toLowerCase()));
  const member = members.find(m => m.id === memberId || m.id.startsWith(memberId) || m.name.toLowerCase().includes((memberId || '').toLowerCase()));

  if (!project) return { error: 'Project not found' };
  if (!member) return { error: 'Member not found' };

  if (project.team_members.find(tm => tm.id === member.id)) {
    return { error: `${member.name} is already assigned to ${project.name}` };
  }

  project.team_members.push({
    id: member.id,
    name: member.name,
    role: opts.role || member.role,
    assigned_at: new Date().toISOString(),
    hours_allocated: opts.hours ? parseInt(opts.hours) : null,
    hours_logged: 0
  });

  if (!member.projects_assigned.includes(project.id)) {
    member.projects_assigned.push(project.id);
  }

  writeJSON(PATHS.projects(), projects);
  writeJSON(PATHS.members(), members);

  return {
    success: true,
    message: `✅ ${member.name} assigned to "${project.name}" as ${opts.role || member.role}`,
    team_size: project.team_members.length
  };
}

function listProjects(opts = {}) {
  const projects = readJSON(PATHS.projects());
  let filtered = [...projects];

  if (opts.status) filtered = filtered.filter(p => p.status === opts.status);
  if (opts.client) filtered = filtered.filter(p => p.client.toLowerCase().includes(opts.client.toLowerCase()));

  return {
    total: filtered.length,
    projects: filtered.map(p => {
      const progress = p.task_count > 0 ? Math.round((p.completed_tasks / p.task_count) * 100) : 0;
      const budgetUsedPct = p.budget ? Math.round((p.budget_used / p.budget) * 100) : 0;
      const statusIcon = { planning: '📝', active: '🔵', 'on-hold': '⏸️', completed: '✅', cancelled: '❌' }[p.status] || '❓';

      return {
        id: p.id.substring(0, 8),
        icon: statusIcon,
        name: p.name,
        client: p.client,
        status: p.status,
        team_size: p.team_members.length,
        tasks: `${p.completed_tasks}/${p.task_count} (${progress}%)`,
        budget: p.budget ? `$${p.budget_used.toFixed(0)}/$${p.budget.toFixed(0)} (${budgetUsedPct}%)` : '—',
        deadline: p.deadline || '—',
        hours: p.total_hours
      };
    })
  };
}

// ─── Task Management ────────────────────────────────────────────────────────

function createTask(projectId, title, opts = {}) {
  const tasks = readJSON(PATHS.tasks());
  const projects = readJSON(PATHS.projects());
  const members = readJSON(PATHS.members());

  const project = projects.find(p => p.id === projectId || p.id.startsWith(projectId) || p.name.toLowerCase().includes((projectId || '').toLowerCase()));
  if (!project) return { error: 'Project not found' };

  let assignee = null;
  if (opts.assignee) {
    assignee = members.find(m => m.id === opts.assignee || m.id.startsWith(opts.assignee) || m.name.toLowerCase().includes(opts.assignee.toLowerCase()));
  }

  const task = {
    id: crypto.randomUUID(),
    project_id: project.id,
    project_name: project.name,
    title,
    description: opts.description || '',
    status: 'todo', // todo, in-progress, review, blocked, completed, cancelled
    priority: opts.priority || 'medium', // low, medium, high, urgent
    assignee_id: assignee ? assignee.id : null,
    assignee_name: assignee ? assignee.name : null,
    due_date: opts.due || null,
    estimated_hours: opts.hours ? parseFloat(opts.hours) : null,
    actual_hours: 0,
    tags: opts.tags ? opts.tags.split(',').map(t => t.trim()) : [],
    dependencies: opts.depends ? opts.depends.split(',').map(d => d.trim()) : [],
    deliverables: opts.deliverables ? opts.deliverables.split(',').map(d => d.trim()) : [],
    comments: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  tasks.push(task);
  project.task_count += 1;
  writeJSON(PATHS.tasks(), tasks);
  writeJSON(PATHS.projects(), projects);

  const priorityIcon = { low: '⬜', medium: '🟨', high: '🟧', urgent: '🔴' }[task.priority];
  return {
    success: true,
    task_id: task.id,
    message: `${priorityIcon} Task created: "${title}"\n` +
             `📁 Project: ${project.name}\n` +
             `👤 Assigned: ${assignee ? assignee.name : 'Unassigned'}\n` +
             `📅 Due: ${task.due_date || 'Not set'}`,
    task
  };
}

function updateTask(taskId, opts = {}) {
  const tasks = readJSON(PATHS.tasks());
  const projects = readJSON(PATHS.projects());
  const members = readJSON(PATHS.members());

  const task = tasks.find(t => t.id === taskId || t.id.startsWith(taskId));
  if (!task) return { error: 'Task not found' };

  const oldStatus = task.status;

  if (opts.status) task.status = opts.status;
  if (opts.priority) task.priority = opts.priority;
  if (opts.title) task.title = opts.title;
  if (opts.description) task.description = opts.description;
  if (opts.due) task.due_date = opts.due;
  if (opts.hours) task.actual_hours = parseFloat(opts.hours);

  if (opts.assignee) {
    const assignee = members.find(m => m.id === opts.assignee || m.id.startsWith(opts.assignee) || m.name.toLowerCase().includes(opts.assignee.toLowerCase()));
    if (assignee) {
      task.assignee_id = assignee.id;
      task.assignee_name = assignee.name;
    }
  }

  // Handle completion
  if (opts.status === 'completed' && oldStatus !== 'completed') {
    task.completed_at = new Date().toISOString();
    const project = projects.find(p => p.id === task.project_id);
    if (project) {
      project.completed_tasks += 1;
      if (task.actual_hours) project.total_hours += task.actual_hours;
      writeJSON(PATHS.projects(), projects);
    }
  }

  if (opts.comment) {
    task.comments.push({
      id: crypto.randomUUID(),
      text: opts.comment,
      author: opts.author || 'freelancer',
      timestamp: new Date().toISOString()
    });
  }

  task.updated_at = new Date().toISOString();
  writeJSON(PATHS.tasks(), tasks);

  return {
    success: true,
    task_id: task.id,
    message: `✅ Task updated: "${task.title}"` +
             (opts.status ? `\n  Status: ${oldStatus} → ${opts.status}` : '') +
             (opts.comment ? '\n  💬 Comment added' : ''),
    task
  };
}

function listTasks(opts = {}) {
  const tasks = readJSON(PATHS.tasks());
  let filtered = [...tasks];

  if (opts.project) filtered = filtered.filter(t => t.project_name.toLowerCase().includes(opts.project.toLowerCase()) || t.project_id.startsWith(opts.project));
  if (opts.assignee) filtered = filtered.filter(t => t.assignee_name && t.assignee_name.toLowerCase().includes(opts.assignee.toLowerCase()));
  if (opts.status) filtered = filtered.filter(t => t.status === opts.status);
  if (opts.priority) filtered = filtered.filter(t => t.priority === opts.priority);
  if (opts.overdue === 'true') {
    const today = new Date().toISOString().split('T')[0];
    filtered = filtered.filter(t => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled');
  }

  // Sort by priority then due date
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  filtered.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    if (pDiff !== 0) return pDiff;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.due_date ? -1 : 1;
  });

  const limit = opts.limit ? parseInt(opts.limit) : 50;

  return {
    total: filtered.length,
    tasks: filtered.slice(0, limit).map(t => {
      const priorityIcon = { low: '⬜', medium: '🟨', high: '🟧', urgent: '🔴' }[t.priority];
      const statusIcon = { todo: '📋', 'in-progress': '🔵', review: '👀', blocked: '🚫', completed: '✅', cancelled: '❌' }[t.status];
      const today = new Date().toISOString().split('T')[0];
      const overdue = t.due_date && t.due_date < today && t.status !== 'completed';

      return {
        id: t.id.substring(0, 8),
        priority: priorityIcon,
        status: statusIcon,
        title: t.title,
        assignee: t.assignee_name || '—',
        project: t.project_name,
        due: t.due_date ? (overdue ? `⚠️ ${t.due_date}` : t.due_date) : '—',
        hours: t.estimated_hours ? `${t.actual_hours}/${t.estimated_hours}h` : '—'
      };
    })
  };
}

// ─── Time Logging ───────────────────────────────────────────────────────────

function logTime(taskId, hours, opts = {}) {
  const timesheets = readJSON(PATHS.timesheets());
  const tasks = readJSON(PATHS.tasks());
  const members = readJSON(PATHS.members());
  const projects = readJSON(PATHS.projects());

  const task = tasks.find(t => t.id === taskId || t.id.startsWith(taskId));
  if (!task) return { error: 'Task not found' };

  const hoursNum = parseFloat(hours);
  if (isNaN(hoursNum) || hoursNum <= 0) return { error: 'Invalid hours' };

  let member = null;
  if (opts.member) {
    member = members.find(m => m.id === opts.member || m.id.startsWith(opts.member) || m.name.toLowerCase().includes(opts.member.toLowerCase()));
  }

  const entry = {
    id: crypto.randomUUID(),
    task_id: task.id,
    task_title: task.title,
    project_id: task.project_id,
    project_name: task.project_name,
    member_id: member ? member.id : task.assignee_id,
    member_name: member ? member.name : task.assignee_name || 'Unknown',
    date: opts.date || new Date().toISOString().split('T')[0],
    hours: hoursNum,
    description: opts.description || '',
    billable: opts.billable !== 'false',
    created_at: new Date().toISOString()
  };

  timesheets.push(entry);
  task.actual_hours += hoursNum;

  // Update member total
  if (member || task.assignee_id) {
    const m = members.find(mem => mem.id === (member ? member.id : task.assignee_id));
    if (m) {
      m.total_hours_logged += hoursNum;
      if (m.rate && entry.billable) {
        m.total_earned += hoursNum * m.rate;
      }
    }
  }

  // Update project
  const project = projects.find(p => p.id === task.project_id);
  if (project) {
    project.total_hours += hoursNum;
    if (member) {
      const tm = project.team_members.find(t => t.id === member.id);
      if (tm) tm.hours_logged += hoursNum;
    }
    // Update budget usage
    if (member && member.rate && entry.billable) {
      project.budget_used += hoursNum * member.rate;
    }
  }

  writeJSON(PATHS.timesheets(), timesheets);
  writeJSON(PATHS.tasks(), tasks);
  writeJSON(PATHS.members(), members);
  writeJSON(PATHS.projects(), projects);

  return {
    success: true,
    timesheet_id: entry.id,
    message: `⏱️ ${hoursNum}h logged on "${task.title}"\n` +
             `👤 ${entry.member_name} | 📁 ${task.project_name}\n` +
             `📊 Task total: ${task.actual_hours}h${task.estimated_hours ? `/${task.estimated_hours}h` : ''}`,
    entry
  };
}

function getTimesheetReport(opts = {}) {
  const timesheets = readJSON(PATHS.timesheets());
  let filtered = [...timesheets];

  if (opts.project) filtered = filtered.filter(t => t.project_name.toLowerCase().includes(opts.project.toLowerCase()));
  if (opts.member) filtered = filtered.filter(t => t.member_name.toLowerCase().includes(opts.member.toLowerCase()));
  if (opts.from) filtered = filtered.filter(t => t.date >= opts.from);
  if (opts.to) filtered = filtered.filter(t => t.date <= opts.to);

  // This week default
  if (!opts.from && !opts.to && !opts.project && !opts.member) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    filtered = filtered.filter(t => t.date >= weekStart.toISOString().split('T')[0]);
  }

  const totalHours = filtered.reduce((sum, t) => sum + t.hours, 0);
  const billableHours = filtered.filter(t => t.billable).reduce((sum, t) => sum + t.hours, 0);

  // By member
  const byMember = {};
  for (const entry of filtered) {
    if (!byMember[entry.member_name]) byMember[entry.member_name] = { hours: 0, entries: 0 };
    byMember[entry.member_name].hours += entry.hours;
    byMember[entry.member_name].entries += 1;
  }

  // By project
  const byProject = {};
  for (const entry of filtered) {
    if (!byProject[entry.project_name]) byProject[entry.project_name] = { hours: 0, entries: 0 };
    byProject[entry.project_name].hours += entry.hours;
    byProject[entry.project_name].entries += 1;
  }

  return {
    period: {
      from: opts.from || 'this week',
      to: opts.to || 'now'
    },
    total_hours: totalHours.toFixed(1),
    billable_hours: billableHours.toFixed(1),
    total_entries: filtered.length,
    by_member: Object.entries(byMember).map(([name, data]) => ({
      name,
      hours: data.hours.toFixed(1),
      entries: data.entries
    })),
    by_project: Object.entries(byProject).map(([name, data]) => ({
      name,
      hours: data.hours.toFixed(1),
      entries: data.entries
    })),
    recent: filtered.slice(-10).reverse().map(e => ({
      date: e.date,
      member: e.member_name,
      task: e.task_title,
      hours: e.hours,
      billable: e.billable ? '✅' : '❌'
    }))
  };
}

// ─── Project Briefs ─────────────────────────────────────────────────────────

function createBrief(projectId, opts = {}) {
  const projects = readJSON(PATHS.projects());
  const briefs = readJSON(PATHS.briefs());

  const project = projects.find(p => p.id === projectId || p.id.startsWith(projectId) || p.name.toLowerCase().includes((projectId || '').toLowerCase()));
  if (!project) return { error: 'Project not found' };

  const brief = {
    id: crypto.randomUUID(),
    project_id: project.id,
    project_name: project.name,
    client: project.client,
    title: opts.title || `${project.name} — Project Brief`,
    overview: opts.overview || '',
    objectives: opts.objectives ? opts.objectives.split('|').map(o => o.trim()) : [],
    scope: opts.scope || '',
    deliverables: opts.deliverables ? opts.deliverables.split('|').map(d => d.trim()) : [],
    timeline: opts.timeline || '',
    constraints: opts.constraints ? opts.constraints.split('|').map(c => c.trim()) : [],
    communication: opts.communication || 'Slack for daily updates, weekly video call',
    tools: opts.tools ? opts.tools.split(',').map(t => t.trim()) : [],
    status: 'draft',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  briefs.push(brief);
  writeJSON(PATHS.briefs(), briefs);

  // Format readable brief
  let formatted = `# 📋 ${brief.title}\n\n`;
  formatted += `**Client:** ${brief.client}\n`;
  formatted += `**Project:** ${brief.project_name}\n`;
  formatted += `**Date:** ${brief.created_at.split('T')[0]}\n\n`;

  if (brief.overview) formatted += `## Overview\n${brief.overview}\n\n`;
  if (brief.objectives.length > 0) {
    formatted += `## Objectives\n`;
    brief.objectives.forEach((o, i) => { formatted += `${i + 1}. ${o}\n`; });
    formatted += '\n';
  }
  if (brief.scope) formatted += `## Scope\n${brief.scope}\n\n`;
  if (brief.deliverables.length > 0) {
    formatted += `## Deliverables\n`;
    brief.deliverables.forEach(d => { formatted += `- ${d}\n`; });
    formatted += '\n';
  }
  if (brief.timeline) formatted += `## Timeline\n${brief.timeline}\n\n`;
  if (brief.constraints.length > 0) {
    formatted += `## Constraints\n`;
    brief.constraints.forEach(c => { formatted += `- ${c}\n`; });
    formatted += '\n';
  }
  formatted += `## Communication\n${brief.communication}\n\n`;
  if (brief.tools.length > 0) formatted += `## Tools\n${brief.tools.join(', ')}\n\n`;
  formatted += `## Team\n`;
  project.team_members.forEach(tm => {
    formatted += `- **${tm.name}** — ${tm.role}\n`;
  });

  return {
    success: true,
    brief_id: brief.id,
    message: `📋 Brief created for "${project.name}"`,
    formatted,
    brief
  };
}

// ─── Workload Analysis ──────────────────────────────────────────────────────

function getWorkload(opts = {}) {
  const members = readJSON(PATHS.members());
  const tasks = readJSON(PATHS.tasks());
  const timesheets = readJSON(PATHS.timesheets());

  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const workload = members.filter(m => m.status === 'active').map(member => {
    const memberTasks = tasks.filter(t => t.assignee_id === member.id);
    const activeTasks = memberTasks.filter(t => t.status === 'in-progress' || t.status === 'todo');
    const overdueTasks = memberTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled');
    const weekHours = timesheets.filter(ts => ts.member_id === member.id && ts.date >= weekStartStr).reduce((sum, ts) => sum + ts.hours, 0);

    const capacityUsed = member.max_hours_week > 0 ? Math.round((weekHours / member.max_hours_week) * 100) : 0;

    let loadIcon = '🟢';
    if (capacityUsed > 90) loadIcon = '🔴';
    else if (capacityUsed > 70) loadIcon = '🟡';

    return {
      name: member.name,
      role: member.role,
      load: loadIcon,
      active_tasks: activeTasks.length,
      overdue_tasks: overdueTasks.length,
      hours_this_week: `${weekHours.toFixed(1)}/${member.max_hours_week}h`,
      capacity_used: `${capacityUsed}%`,
      availability: capacityUsed < 70 ? 'Available' : capacityUsed < 90 ? 'Busy' : 'Overloaded'
    };
  });

  // Team summary
  const totalActive = tasks.filter(t => t.status === 'in-progress' || t.status === 'todo').length;
  const totalOverdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled').length;
  const totalBlocked = tasks.filter(t => t.status === 'blocked').length;

  return {
    team_size: workload.length,
    summary: {
      total_active_tasks: totalActive,
      total_overdue: totalOverdue,
      total_blocked: totalBlocked,
    },
    members: workload
  };
}

// ─── Team Messages ──────────────────────────────────────────────────────────

function sendMessage(projectId, message, opts = {}) {
  const messages = readJSON(PATHS.messages());
  const projects = readJSON(PATHS.projects());

  const project = projects.find(p => p.id === projectId || p.id.startsWith(projectId) || p.name.toLowerCase().includes((projectId || '').toLowerCase()));

  const msg = {
    id: crypto.randomUUID(),
    project_id: project ? project.id : null,
    project_name: project ? project.name : 'General',
    from: opts.from || 'Lead',
    to: opts.to || 'team', // 'team' or specific member name
    type: opts.type || 'update', // update, request, question, announcement
    priority: opts.priority || 'normal',
    message,
    read_by: [],
    timestamp: new Date().toISOString()
  };

  messages.push(msg);
  writeJSON(PATHS.messages(), messages);

  const typeIcon = { update: '📝', request: '🙏', question: '❓', announcement: '📢' }[msg.type] || '💬';
  return {
    success: true,
    message_id: msg.id,
    display: `${typeIcon} [${msg.project_name}] ${msg.from} → ${msg.to}:\n${message}`
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
👥 Team Collaboration Tools
━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEAM MEMBERS:
  add-member <name> <role>           Add team member
    --email, --rate, --rate-type, --skills, --availability, --max-hours, --timezone
  list-members                       List team members
    --status, --role, --skill, --available
  update-member <id>                 Update member
    --role, --rate, --skills, --status, --rating, --notes

PROJECTS:
  create-project <name> <client>     Create team project
    --description, --budget, --deadline, --start, --currency, --tags
  assign <project> <member>          Assign member to project
    --role, --hours
  list-projects                      List projects
    --status, --client

TASKS:
  create-task <project> <title>      Create task
    --assignee, --priority, --due, --hours, --description, --tags, --deliverables
  update-task <id>                   Update task
    --status, --priority, --assignee, --due, --hours, --comment, --author
  list-tasks                         List tasks
    --project, --assignee, --status, --priority, --overdue

TIME:
  log-time <task-id> <hours>         Log time on task
    --member, --date, --description, --billable
  timesheet                          Timesheet report
    --project, --member, --from, --to

COLLABORATION:
  brief <project>                    Create project brief
    --title, --overview, --objectives, --scope, --deliverables, --timeline
  workload                           Team workload analysis
  message <project> <text>           Send team message
    --from, --to, --type, --priority

  help                               Show this help

EXAMPLES:
  node team-collaboration.js add-member "Sarah Chen" "Designer" --rate 75 --skills "UI,UX,Figma"
  node team-collaboration.js create-task "website" "Design landing page" --assignee "Sarah" --priority high --due 2024-02-01
  node team-collaboration.js log-time abc123 4 --member "Sarah" --description "Homepage mockups"
  node team-collaboration.js workload
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printHelp();
    return;
  }

  const command = args[0];
  const getFlag = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  let result;

  switch (command) {
    case 'add-member':
      result = addMember(args[1], args[2], {
        email: getFlag('--email'), rate: getFlag('--rate'), rate_type: getFlag('--rate-type'),
        skills: getFlag('--skills'), availability: getFlag('--availability'),
        max_hours: getFlag('--max-hours'), timezone: getFlag('--timezone'), notes: getFlag('--notes'),
        currency: getFlag('--currency'),
      });
      break;
    case 'list-members':
      result = listMembers({
        status: getFlag('--status'), role: getFlag('--role'),
        skill: getFlag('--skill'), available: getFlag('--available'),
      });
      break;
    case 'update-member':
      result = updateMember(args[1], {
        role: getFlag('--role'), rate: getFlag('--rate'), rate_type: getFlag('--rate-type'),
        email: getFlag('--email'), skills: getFlag('--skills'), availability: getFlag('--availability'),
        max_hours: getFlag('--max-hours'), timezone: getFlag('--timezone'),
        status: getFlag('--status'), notes: getFlag('--notes'), rating: getFlag('--rating'),
      });
      break;
    case 'create-project':
      result = createProject(args[1], args[2], {
        description: getFlag('--description'), budget: getFlag('--budget'),
        deadline: getFlag('--deadline'), start: getFlag('--start'),
        currency: getFlag('--currency'), tags: getFlag('--tags'), notes: getFlag('--notes'),
      });
      break;
    case 'assign':
      result = assignToProject(args[1], args[2], {
        role: getFlag('--role'), hours: getFlag('--hours'),
      });
      break;
    case 'list-projects':
      result = listProjects({
        status: getFlag('--status'), client: getFlag('--client'),
      });
      break;
    case 'create-task':
      result = createTask(args[1], args[2], {
        assignee: getFlag('--assignee'), priority: getFlag('--priority'),
        due: getFlag('--due'), hours: getFlag('--hours'),
        description: getFlag('--description'), tags: getFlag('--tags'),
        deliverables: getFlag('--deliverables'), depends: getFlag('--depends'),
      });
      break;
    case 'update-task':
      result = updateTask(args[1], {
        status: getFlag('--status'), priority: getFlag('--priority'),
        assignee: getFlag('--assignee'), due: getFlag('--due'),
        hours: getFlag('--hours'), title: getFlag('--title'),
        description: getFlag('--description'), comment: getFlag('--comment'),
        author: getFlag('--author'),
      });
      break;
    case 'list-tasks':
      result = listTasks({
        project: getFlag('--project'), assignee: getFlag('--assignee'),
        status: getFlag('--status'), priority: getFlag('--priority'),
        overdue: getFlag('--overdue'), limit: getFlag('--limit'),
      });
      break;
    case 'log-time':
      result = logTime(args[1], args[2], {
        member: getFlag('--member'), date: getFlag('--date'),
        description: getFlag('--description'), billable: getFlag('--billable'),
      });
      break;
    case 'timesheet':
      result = getTimesheetReport({
        project: getFlag('--project'), member: getFlag('--member'),
        from: getFlag('--from'), to: getFlag('--to'),
      });
      break;
    case 'brief':
      result = createBrief(args[1], {
        title: getFlag('--title'), overview: getFlag('--overview'),
        objectives: getFlag('--objectives'), scope: getFlag('--scope'),
        deliverables: getFlag('--deliverables'), timeline: getFlag('--timeline'),
        constraints: getFlag('--constraints'), communication: getFlag('--communication'),
        tools: getFlag('--tools'),
      });
      break;
    case 'workload':
      result = getWorkload();
      break;
    case 'message':
      result = sendMessage(args[1], args[2], {
        from: getFlag('--from'), to: getFlag('--to'),
        type: getFlag('--type'), priority: getFlag('--priority'),
      });
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

main();
