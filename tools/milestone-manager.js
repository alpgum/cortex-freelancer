#!/usr/bin/env node
/**
 * Project Milestone Management System
 * Sprint 2 Task 13 — Cortex Freelancer
 *
 * Track project milestones, deliverables, dependencies, progress,
 * timeline visualization, and client-facing status updates.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Storage ────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.cortex-freelancer',
  'milestones'
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
  projects:    () => path.join(DATA_DIR, 'projects.json'),
  milestones:  () => path.join(DATA_DIR, 'milestones.json'),
  deliverables:() => path.join(DATA_DIR, 'deliverables.json'),
  updates:     () => path.join(DATA_DIR, 'status-updates.json'),
};

// ─── Milestone Engine ───────────────────────────────────────────────────────

class MilestoneManager {
  constructor() {
    this.projects = readJSON(PATHS.projects());
    this.milestones = readJSON(PATHS.milestones());
    this.deliverables = readJSON(PATHS.deliverables());
    this.updates = readJSON(PATHS.updates());
  }

  save() {
    writeJSON(PATHS.projects(), this.projects);
    writeJSON(PATHS.milestones(), this.milestones);
    writeJSON(PATHS.deliverables(), this.deliverables);
    writeJSON(PATHS.updates(), this.updates);
  }

  // ── Project Management ──────────────────────────────────────────────────

  createProject({
    name, clientName, description = '', startDate = null,
    endDate = null, budget = 0, currency = 'USD',
  }) {
    const project = {
      id: crypto.randomUUID(),
      name,
      clientName,
      description,
      status: 'active',
      startDate: startDate || new Date().toISOString(),
      endDate,
      budget,
      currency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.projects.push(project);
    this.save();

    return {
      success: true,
      project,
      summary: `Project "${name}" created for ${clientName}`,
    };
  }

  // ── Milestone CRUD ──────────────────────────────────────────────────────

  addMilestone({
    projectId, title, description = '', dueDate,
    paymentAmount = 0, dependencies = [], priority = 'medium',
    phase = null,
  }) {
    const project = this.projects.find(p => p.id === projectId || p.name === projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const order = this.milestones.filter(m => m.projectId === project.id).length + 1;

    const milestone = {
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      title,
      description,
      status: 'pending', // pending, in_progress, review, completed, blocked
      priority, // low, medium, high, critical
      phase: phase || `Phase ${order}`,
      order,
      dueDate: dueDate || null,
      completedDate: null,
      paymentAmount,
      paymentStatus: paymentAmount > 0 ? 'unpaid' : 'n/a',
      dependencies, // array of milestone IDs
      progress: 0,
      blockers: [],
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.milestones.push(milestone);
    this.save();

    return {
      success: true,
      milestone,
      summary: `Milestone "${title}" added to ${project.name} (${milestone.phase})`,
    };
  }

  updateMilestoneStatus(milestoneId, status, note = '') {
    const ms = this.milestones.find(m => m.id === milestoneId || m.title === milestoneId);
    if (!ms) return { success: false, error: 'Milestone not found' };

    const oldStatus = ms.status;
    ms.status = status;
    ms.updatedAt = new Date().toISOString();

    if (status === 'completed') {
      ms.completedDate = new Date().toISOString();
      ms.progress = 100;
    }

    if (note) {
      ms.notes.push({
        date: new Date().toISOString(),
        text: note,
        statusChange: `${oldStatus} → ${status}`,
      });
    }

    // Check if dependent milestones can now proceed
    const unblocked = [];
    if (status === 'completed') {
      for (const other of this.milestones) {
        if (other.dependencies.includes(ms.id) && other.status === 'blocked') {
          const allDepsComplete = other.dependencies.every(depId =>
            this.milestones.find(m => m.id === depId)?.status === 'completed'
          );
          if (allDepsComplete) {
            other.status = 'pending';
            other.updatedAt = new Date().toISOString();
            unblocked.push(other.title);
          }
        }
      }
    }

    this.save();

    return {
      success: true,
      milestone: ms,
      unblocked: unblocked.length > 0 ? unblocked : undefined,
      summary: `Milestone "${ms.title}": ${oldStatus} → ${status}` +
        (unblocked.length > 0 ? `. Unblocked: ${unblocked.join(', ')}` : ''),
    };
  }

  updateProgress(milestoneId, progress, note = '') {
    const ms = this.milestones.find(m => m.id === milestoneId || m.title === milestoneId);
    if (!ms) return { success: false, error: 'Milestone not found' };

    ms.progress = Math.min(100, Math.max(0, progress));
    ms.updatedAt = new Date().toISOString();

    if (ms.progress === 100 && ms.status !== 'completed') {
      ms.status = 'review'; // auto-move to review when 100%
    } else if (ms.progress > 0 && ms.status === 'pending') {
      ms.status = 'in_progress';
    }

    if (note) {
      ms.notes.push({ date: new Date().toISOString(), text: note, progress: ms.progress });
    }

    this.save();
    return {
      success: true,
      milestone: ms,
      summary: `"${ms.title}" progress: ${ms.progress}% (${ms.status})`,
    };
  }

  addBlocker(milestoneId, blockerText) {
    const ms = this.milestones.find(m => m.id === milestoneId || m.title === milestoneId);
    if (!ms) return { success: false, error: 'Milestone not found' };

    ms.blockers.push({
      id: crypto.randomUUID(),
      text: blockerText,
      status: 'active',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
    ms.status = 'blocked';
    ms.updatedAt = new Date().toISOString();
    this.save();

    return {
      success: true,
      summary: `⛔ Blocker added to "${ms.title}": ${blockerText}`,
    };
  }

  resolveBlocker(milestoneId, blockerId) {
    const ms = this.milestones.find(m => m.id === milestoneId || m.title === milestoneId);
    if (!ms) return { success: false, error: 'Milestone not found' };

    const blocker = ms.blockers.find(b => b.id === blockerId);
    if (blocker) {
      blocker.status = 'resolved';
      blocker.resolvedAt = new Date().toISOString();
    }

    const activeBlockers = ms.blockers.filter(b => b.status === 'active');
    if (activeBlockers.length === 0) {
      ms.status = ms.progress > 0 ? 'in_progress' : 'pending';
    }

    ms.updatedAt = new Date().toISOString();
    this.save();

    return { success: true, summary: `Blocker resolved. ${activeBlockers.length} remaining.` };
  }

  // ── Deliverables ────────────────────────────────────────────────────────

  addDeliverable({
    milestoneId, title, description = '', type = 'document',
    fileUrl = null, acceptanceCriteria = [],
  }) {
    const ms = this.milestones.find(m => m.id === milestoneId || m.title === milestoneId);
    if (!ms) return { success: false, error: 'Milestone not found' };

    const deliverable = {
      id: crypto.randomUUID(),
      milestoneId: ms.id,
      milestoneName: ms.title,
      projectId: ms.projectId,
      title,
      description,
      type, // document, code, design, prototype, report, other
      fileUrl,
      status: 'pending', // pending, in_progress, submitted, approved, rejected
      acceptanceCriteria,
      feedback: [],
      version: 1,
      submittedDate: null,
      approvedDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.deliverables.push(deliverable);
    this.save();

    return {
      success: true,
      deliverable,
      summary: `Deliverable "${title}" added to milestone "${ms.title}"`,
    };
  }

  submitDeliverable(deliverableId, fileUrl = null) {
    const d = this.deliverables.find(x => x.id === deliverableId || x.title === deliverableId);
    if (!d) return { success: false, error: 'Deliverable not found' };

    d.status = 'submitted';
    d.submittedDate = new Date().toISOString();
    if (fileUrl) d.fileUrl = fileUrl;
    d.updatedAt = new Date().toISOString();
    this.save();

    return {
      success: true,
      summary: `📦 Deliverable "${d.title}" submitted for review`,
      notification: {
        type: 'deliverable_submitted',
        milestone: d.milestoneName,
        deliverable: d.title,
      },
    };
  }

  reviewDeliverable(deliverableId, { approved, feedback = '' }) {
    const d = this.deliverables.find(x => x.id === deliverableId || x.title === deliverableId);
    if (!d) return { success: false, error: 'Deliverable not found' };

    d.status = approved ? 'approved' : 'rejected';
    if (approved) d.approvedDate = new Date().toISOString();
    if (feedback) d.feedback.push({ date: new Date().toISOString(), text: feedback, approved });
    if (!approved) d.version++;
    d.updatedAt = new Date().toISOString();

    // Check if all deliverables for the milestone are approved
    const msDeliverables = this.deliverables.filter(x => x.milestoneId === d.milestoneId);
    const allApproved = msDeliverables.every(x => x.status === 'approved');

    this.save();

    return {
      success: true,
      status: d.status,
      allMilestoneDeliverablesApproved: allApproved,
      summary: approved
        ? `✅ Deliverable "${d.title}" approved!${allApproved ? ' All deliverables complete!' : ''}`
        : `🔄 Deliverable "${d.title}" needs revision (v${d.version}): ${feedback}`,
    };
  }

  // ── Status Updates ──────────────────────────────────────────────────────

  generateStatusUpdate(projectId) {
    const project = this.projects.find(p => p.id === projectId || p.name === projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const projectMilestones = this.milestones.filter(m => m.projectId === project.id);
    const now = new Date();

    const completed = projectMilestones.filter(m => m.status === 'completed');
    const inProgress = projectMilestones.filter(m => m.status === 'in_progress');
    const blocked = projectMilestones.filter(m => m.status === 'blocked');
    const upcoming = projectMilestones.filter(m =>
      m.status === 'pending' && m.dueDate && new Date(m.dueDate) > now
    ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const overallProgress = projectMilestones.length > 0
      ? Math.round(projectMilestones.reduce((s, m) => s + m.progress, 0) / projectMilestones.length)
      : 0;

    // Timeline health
    const overdue = projectMilestones.filter(m =>
      m.dueDate && new Date(m.dueDate) < now && m.status !== 'completed'
    );
    const health = overdue.length > 2 ? 'at_risk' : overdue.length > 0 ? 'warning' : 'on_track';

    const update = {
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      clientName: project.clientName,
      date: now.toISOString(),
      overallProgress,
      health,
      summary: {
        total: projectMilestones.length,
        completed: completed.length,
        inProgress: inProgress.length,
        blocked: blocked.length,
        overdue: overdue.length,
      },
      completedRecently: completed
        .filter(m => {
          const d = new Date(m.completedDate);
          return (now - d) < 7 * 86400000; // last 7 days
        })
        .map(m => ({ title: m.title, completedDate: m.completedDate })),
      currentWork: inProgress.map(m => ({
        title: m.title,
        progress: m.progress,
        dueDate: m.dueDate,
      })),
      blockers: blocked.map(m => ({
        milestone: m.title,
        blockers: m.blockers.filter(b => b.status === 'active').map(b => b.text),
      })),
      nextUp: upcoming.slice(0, 3).map(m => ({
        title: m.title,
        dueDate: m.dueDate,
      })),
      clientMessage: this._generateClientMessage(project, overallProgress, health, completed, inProgress, blocked, upcoming),
    };

    this.updates.push(update);
    this.save();

    return { success: true, update };
  }

  // ── Timeline View ───────────────────────────────────────────────────────

  getTimeline(projectId) {
    const project = this.projects.find(p => p.id === projectId || p.name === projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const projectMilestones = this.milestones
      .filter(m => m.projectId === project.id)
      .sort((a, b) => a.order - b.order);

    const now = new Date();
    const statusIcons = {
      completed: '✅', in_progress: '🔄', review: '👀',
      pending: '⏳', blocked: '⛔',
    };

    const timeline = projectMilestones.map(ms => {
      const delivs = this.deliverables.filter(d => d.milestoneId === ms.id);
      const isOverdue = ms.dueDate && new Date(ms.dueDate) < now && ms.status !== 'completed';

      return {
        icon: statusIcons[ms.status] || '⏳',
        phase: ms.phase,
        title: ms.title,
        status: ms.status,
        progress: `${ms.progress}%`,
        progressBar: this._progressBar(ms.progress),
        dueDate: ms.dueDate ? new Date(ms.dueDate).toLocaleDateString() : 'TBD',
        isOverdue,
        payment: ms.paymentAmount > 0 ? `$${ms.paymentAmount}` : null,
        deliverables: delivs.map(d => ({
          title: d.title,
          status: d.status,
          type: d.type,
        })),
        blockerCount: ms.blockers.filter(b => b.status === 'active').length,
        deps: ms.dependencies.length,
      };
    });

    const overallProgress = projectMilestones.length > 0
      ? Math.round(projectMilestones.reduce((s, m) => s + m.progress, 0) / projectMilestones.length)
      : 0;

    return {
      project: project.name,
      client: project.clientName,
      overallProgress: `${overallProgress}%`,
      overallBar: this._progressBar(overallProgress),
      milestones: timeline,
    };
  }

  // ── Gantt-Style Text View ───────────────────────────────────────────────

  getGanttView(projectId) {
    const project = this.projects.find(p => p.id === projectId || p.name === projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const milestones = this.milestones
      .filter(m => m.projectId === project.id)
      .sort((a, b) => a.order - b.order);

    if (milestones.length === 0) return { success: true, gantt: 'No milestones yet.' };

    const lines = [`📊 ${project.name} — Gantt View`, ''];
    const maxTitle = Math.max(...milestones.map(m => m.title.length), 20);

    for (const ms of milestones) {
      const title = ms.title.padEnd(maxTitle);
      const bar = this._progressBar(ms.progress, 20);
      const status = ms.status === 'completed' ? '✅' :
        ms.status === 'blocked' ? '⛔' :
        ms.status === 'in_progress' ? '🔄' : '⏳';
      const due = ms.dueDate ? new Date(ms.dueDate).toLocaleDateString() : 'TBD';
      lines.push(`${status} ${title} ${bar} ${ms.progress}%  Due: ${due}`);
    }

    return { success: true, gantt: lines.join('\n') };
  }

  // ── Project Dashboard ───────────────────────────────────────────────────

  getDashboard() {
    const now = new Date();
    const activeProjects = this.projects.filter(p => p.status === 'active');

    return {
      activeProjects: activeProjects.length,
      projects: activeProjects.map(project => {
        const ms = this.milestones.filter(m => m.projectId === project.id);
        const completed = ms.filter(m => m.status === 'completed').length;
        const blocked = ms.filter(m => m.status === 'blocked').length;
        const overdue = ms.filter(m =>
          m.dueDate && new Date(m.dueDate) < now && m.status !== 'completed'
        ).length;
        const progress = ms.length > 0
          ? Math.round(ms.reduce((s, m) => s + m.progress, 0) / ms.length)
          : 0;

        return {
          name: project.name,
          client: project.clientName,
          progress: `${progress}%`,
          milestones: `${completed}/${ms.length}`,
          blocked,
          overdue,
          health: overdue > 2 ? '🔴' : overdue > 0 ? '🟡' : blocked > 0 ? '🟠' : '🟢',
          nextDue: ms
            .filter(m => m.dueDate && m.status !== 'completed')
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            [0]?.dueDate
            ? new Date(ms.filter(m => m.dueDate && m.status !== 'completed')
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0].dueDate)
                .toLocaleDateString()
            : 'N/A',
        };
      }),
      totalMilestones: this.milestones.length,
      completedMilestones: this.milestones.filter(m => m.status === 'completed').length,
      totalDeliverables: this.deliverables.length,
      approvedDeliverables: this.deliverables.filter(d => d.status === 'approved').length,
    };
  }

  // ── List Projects ───────────────────────────────────────────────────────

  listProjects() {
    return this.projects.map(p => ({
      id: p.id,
      name: p.name,
      client: p.clientName,
      status: p.status,
      created: new Date(p.createdAt).toLocaleDateString(),
    }));
  }

  // ── Private Helpers ─────────────────────────────────────────────────────

  _progressBar(pct, width = 15) {
    const filled = Math.round((pct / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  }

  _generateClientMessage(project, progress, health, completed, inProgress, blocked, upcoming) {
    const healthLabel = { on_track: 'On Track ✅', warning: 'Minor Delays ⚠️', at_risk: 'At Risk 🔴' };
    let msg = `Project Update: ${project.name}\n`;
    msg += `Status: ${healthLabel[health]} | Progress: ${progress}%\n\n`;

    if (completed.length > 0) {
      msg += `✅ Completed:\n${completed.slice(-3).map(m => `  - ${m.title}`).join('\n')}\n\n`;
    }
    if (inProgress.length > 0) {
      msg += `🔄 In Progress:\n${inProgress.map(m => `  - ${m.title} (${m.progress}%)`).join('\n')}\n\n`;
    }
    if (blocked.length > 0) {
      msg += `⛔ Needs Attention:\n${blocked.map(m => `  - ${m.title}`).join('\n')}\n\n`;
    }
    if (upcoming.length > 0) {
      msg += `📅 Coming Up:\n${upcoming.slice(0, 3).map(m =>
        `  - ${m.title} (${m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'TBD'})`
      ).join('\n')}\n`;
    }

    return msg;
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function getArg(args, flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const sub = args[1];
  const mgr = new MilestoneManager();

  const commands = {
    'project-create': () => {
      const name = args[1] || 'New Project';
      const client = getArg(args, '--client') || 'Client';
      console.log(JSON.stringify(mgr.createProject({ name, clientName: client }), null, 2));
    },

    'projects': () => {
      console.log(JSON.stringify(mgr.listProjects(), null, 2));
    },

    'add': () => {
      const projectId = getArg(args, '--project');
      const title = args[1] || 'New Milestone';
      const dueDate = getArg(args, '--due');
      const payment = parseFloat(getArg(args, '--payment') || '0');
      const priority = getArg(args, '--priority') || 'medium';
      console.log(JSON.stringify(mgr.addMilestone({
        projectId, title, dueDate, paymentAmount: payment, priority,
      }), null, 2));
    },

    'status': () => {
      const id = args[1];
      const status = args[2];
      const note = getArg(args, '--note') || '';
      console.log(JSON.stringify(mgr.updateMilestoneStatus(id, status, note), null, 2));
    },

    'progress': () => {
      const id = args[1];
      const pct = parseInt(args[2] || '0');
      const note = getArg(args, '--note') || '';
      console.log(JSON.stringify(mgr.updateProgress(id, pct, note), null, 2));
    },

    'block': () => {
      console.log(JSON.stringify(mgr.addBlocker(args[1], args.slice(2).join(' ')), null, 2));
    },

    'deliverable': () => {
      const milestoneId = getArg(args, '--milestone');
      const title = args[1] || 'Deliverable';
      const type = getArg(args, '--type') || 'document';
      console.log(JSON.stringify(mgr.addDeliverable({ milestoneId, title, type }), null, 2));
    },

    'submit': () => {
      console.log(JSON.stringify(mgr.submitDeliverable(args[1], getArg(args, '--url')), null, 2));
    },

    'review': () => {
      const approved = args[2] === 'approve';
      const feedback = getArg(args, '--feedback') || '';
      console.log(JSON.stringify(mgr.reviewDeliverable(args[1], { approved, feedback }), null, 2));
    },

    'update': () => {
      console.log(JSON.stringify(mgr.generateStatusUpdate(args[1]), null, 2));
    },

    'timeline': () => {
      console.log(JSON.stringify(mgr.getTimeline(args[1]), null, 2));
    },

    'gantt': () => {
      const result = mgr.getGanttView(args[1]);
      if (result.gantt) console.log(result.gantt);
      else console.log(JSON.stringify(result, null, 2));
    },

    'dashboard': () => {
      console.log(JSON.stringify(mgr.getDashboard(), null, 2));
    },

    'help': () => {
      console.log(`
Milestone Manager — Cortex Freelancer

Commands:
  project-create <name> --client <c>      Create project
  projects                                 List projects
  add <title> --project <id> [--due date] [--payment n] [--priority p]
  status <milestone> <new-status> [--note text]
  progress <milestone> <percent> [--note text]
  block <milestone> <reason...>           Add blocker
  deliverable <title> --milestone <id> [--type document|code|design]
  submit <deliverable-id> [--url file-url]
  review <deliverable-id> approve|reject [--feedback text]
  update <project-id>                     Generate status update
  timeline <project-id>                   View project timeline
  gantt <project-id>                      Gantt-style text view
  dashboard                               Overview of all projects

Statuses: pending, in_progress, review, completed, blocked
      `);
    },
  };

  (commands[cmd] || commands.help)();
}

main();
