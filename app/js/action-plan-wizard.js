/**
 * [CF-072] Action Plan Wizard with Weekly Goals
 * Generate 4-week action plans with daily tasks and milestones.
 * Also includes profile completeness action plans (legacy UW-020).
 * Exposed as window.CortexFreelancer.ActionPlanWizard
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  /* ══════════════════════════════════════════════
   * STORAGE
   * ══════════════════════════════════════════════ */
  var STORAGE_KEY = 'cortex_action_plans';
  var TASK_KEY = 'cortex_action_tasks';

  function loadPlans() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (_) { return []; }
  }
  function savePlans(plans) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plans)); } catch (_) {}
  }
  function loadTasks() {
    try { return JSON.parse(localStorage.getItem(TASK_KEY)) || {}; } catch (_) { return {}; }
  }
  function saveTasks(tasks) {
    try { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); } catch (_) {}
  }

  /* ══════════════════════════════════════════════
   * PLAN TEMPLATES
   * ══════════════════════════════════════════════ */
  var PLAN_TEMPLATES = {
    launch_freelance: {
      name: 'Launch Freelance Career',
      description: 'Go from zero to first paying client in 4 weeks',
      weeks: [
        {
          theme: 'Foundation & Profile Setup',
          milestone: 'Professional profile live and optimized',
          daily: [
            { day: 'Mon', task: 'Research your niche — pick top 3 services to offer', duration: '2h' },
            { day: 'Tue', task: 'Write professional bio and title (use ContractNegotiation for rate research)', duration: '1.5h' },
            { day: 'Wed', task: 'Create/polish freelance profiles on 2 platforms', duration: '2h' },
            { day: 'Thu', task: 'Build 1 portfolio piece (even a sample project counts)', duration: '3h' },
            { day: 'Fri', task: 'Set up contracts template and payment terms', duration: '1.5h' },
            { day: 'Sat', task: 'Research 10 potential clients or job postings', duration: '1h' },
            { day: 'Sun', task: 'Review and refine — get feedback from a peer', duration: '1h' },
          ],
        },
        {
          theme: 'Outreach & First Proposals',
          milestone: 'Send 15+ proposals/pitches',
          daily: [
            { day: 'Mon', task: 'Write 3 personalized proposals/pitches', duration: '2h' },
            { day: 'Tue', task: 'Send 3 proposals + follow up on yesterday\'s', duration: '1.5h' },
            { day: 'Wed', task: 'Write 3 more proposals, research client pain points', duration: '2h' },
            { day: 'Thu', task: 'Respond to all messages within 2 hours, send 2 proposals', duration: '1.5h' },
            { day: 'Fri', task: 'Send 3 proposals + write a case study template', duration: '2h' },
            { day: 'Sat', task: 'Analyze proposal response rates, adjust approach', duration: '1h' },
            { day: 'Sun', task: 'Plan next week\'s targets based on learnings', duration: '45m' },
          ],
        },
        {
          theme: 'Close First Deal & Deliver',
          milestone: 'Land and begin first paid project',
          daily: [
            { day: 'Mon', task: 'Follow up on top 5 warmest leads', duration: '1.5h' },
            { day: 'Tue', task: 'Negotiate terms with interested clients (use ContractNegotiation)', duration: '2h' },
            { day: 'Wed', task: 'Finalize contract and set up project milestones', duration: '1.5h' },
            { day: 'Thu', task: 'Begin work on first deliverable', duration: '3h' },
            { day: 'Fri', task: 'Send progress update to client, continue work', duration: '3h' },
            { day: 'Sat', task: 'Polish deliverable, prepare for review', duration: '2h' },
            { day: 'Sun', task: 'Self-review and quality check', duration: '1h' },
          ],
        },
        {
          theme: 'Deliver, Review & Scale',
          milestone: 'Complete first project with 5-star review',
          daily: [
            { day: 'Mon', task: 'Submit first deliverable, request feedback', duration: '2h' },
            { day: 'Tue', task: 'Incorporate client feedback, revise', duration: '2h' },
            { day: 'Wed', task: 'Deliver final version, close milestone', duration: '1.5h' },
            { day: 'Thu', task: 'Ask for review/testimonial, update portfolio', duration: '1h' },
            { day: 'Fri', task: 'Generate case study from completed project', duration: '1.5h' },
            { day: 'Sat', task: 'Send 5 new proposals to build pipeline', duration: '2h' },
            { day: 'Sun', task: 'Reflect on month, plan next 30 days', duration: '1h' },
          ],
        },
      ],
    },
    increase_rate: {
      name: 'Increase Your Rate by 50%',
      description: 'Systematically raise your rates over 4 weeks',
      weeks: [
        {
          theme: 'Market Research & Positioning',
          milestone: 'Know your market rate and value proposition',
          daily: [
            { day: 'Mon', task: 'Research market rates for your skills (use Rate Advisor)', duration: '1.5h' },
            { day: 'Tue', task: 'Analyze your top 5 competitors\' profiles and rates', duration: '1.5h' },
            { day: 'Wed', task: 'Calculate your true hourly cost (tools, taxes, overhead)', duration: '1h' },
            { day: 'Thu', task: 'List 10 unique value props that justify higher rates', duration: '1.5h' },
            { day: 'Fri', task: 'Rewrite your profile emphasizing outcomes over tasks', duration: '2h' },
            { day: 'Sat', task: 'Create 3 case studies with measurable results', duration: '2h' },
            { day: 'Sun', task: 'Review: can you articulate your value in 30 seconds?', duration: '30m' },
          ],
        },
        {
          theme: 'Portfolio & Social Proof',
          milestone: 'Portfolio updated with ROI-focused case studies',
          daily: [
            { day: 'Mon', task: 'Add metrics to all portfolio pieces (%, $, time saved)', duration: '2h' },
            { day: 'Tue', task: 'Collect 3 client testimonials highlighting business impact', duration: '1h' },
            { day: 'Wed', task: 'Create a "Results" section on your profile', duration: '1.5h' },
            { day: 'Thu', task: 'Write a thought-leadership article in your niche', duration: '2h' },
            { day: 'Fri', task: 'Update profile title to signal expertise level', duration: '45m' },
            { day: 'Sat', task: 'Record a 2-minute video intro showcasing your expertise', duration: '1.5h' },
            { day: 'Sun', task: 'Get peer feedback on updated profile', duration: '30m' },
          ],
        },
        {
          theme: 'Gradual Rate Increase',
          milestone: 'New proposals at 25% higher rate',
          daily: [
            { day: 'Mon', task: 'Raise profile rate by 25% for new clients', duration: '15m' },
            { day: 'Tue', task: 'Send 3 proposals at new rate with strong value pitches', duration: '2h' },
            { day: 'Wed', task: 'Practice handling rate objections (3 common scenarios)', duration: '1h' },
            { day: 'Thu', task: 'Offer a premium package option alongside standard', duration: '1.5h' },
            { day: 'Fri', task: 'Follow up on proposals, track acceptance rate', duration: '1h' },
            { day: 'Sat', task: 'Analyze which value props are resonating', duration: '45m' },
            { day: 'Sun', task: 'Adjust messaging based on feedback', duration: '30m' },
          ],
        },
        {
          theme: 'Anchor & Sustain',
          milestone: 'Consistently booking at 50% higher rate',
          daily: [
            { day: 'Mon', task: 'Raise profile rate to full 50% increase', duration: '15m' },
            { day: 'Tue', task: 'Create a pricing page/rate card for your services', duration: '1.5h' },
            { day: 'Wed', task: 'Notify existing long-term clients of rate adjustment', duration: '1h' },
            { day: 'Thu', task: 'Send proposals at new rate, use anchoring technique', duration: '2h' },
            { day: 'Fri', task: 'Plan next skill to learn for further rate leverage', duration: '1h' },
            { day: 'Sat', task: 'Review 4-week progress: what worked, what didn\'t', duration: '1h' },
            { day: 'Sun', task: 'Set 90-day rate growth targets', duration: '45m' },
          ],
        },
      ],
    },
    learn_new_skill: {
      name: 'Learn a New High-Demand Skill',
      description: 'Go from zero to job-ready in a new skill area',
      weeks: [
        {
          theme: 'Fundamentals & Setup',
          milestone: 'Development environment set up, basics understood',
          daily: [
            { day: 'Mon', task: 'Research the skill landscape — tools, frameworks, ecosystem', duration: '2h' },
            { day: 'Tue', task: 'Set up development environment and tools', duration: '1.5h' },
            { day: 'Wed', task: 'Complete official "Getting Started" tutorial', duration: '2h' },
            { day: 'Thu', task: 'Read documentation — understand core concepts', duration: '2h' },
            { day: 'Fri', task: 'Build a "Hello World" project from scratch', duration: '1.5h' },
            { day: 'Sat', task: 'Watch/read 2 beginner tutorials', duration: '1.5h' },
            { day: 'Sun', task: 'Review concepts, write notes on key learnings', duration: '1h' },
          ],
        },
        {
          theme: 'Hands-on Practice',
          milestone: 'Complete 3 small practice projects',
          daily: [
            { day: 'Mon', task: 'Build mini-project #1 applying core concepts', duration: '2.5h' },
            { day: 'Tue', task: 'Debug and refine mini-project #1', duration: '1.5h' },
            { day: 'Wed', task: 'Build mini-project #2 with more complexity', duration: '2.5h' },
            { day: 'Thu', task: 'Learn testing/debugging patterns for this skill', duration: '2h' },
            { day: 'Fri', task: 'Build mini-project #3 combining multiple concepts', duration: '2.5h' },
            { day: 'Sat', task: 'Code review your own projects — refactor for best practices', duration: '1.5h' },
            { day: 'Sun', task: 'Document learnings and common patterns', duration: '1h' },
          ],
        },
        {
          theme: 'Portfolio Project',
          milestone: 'Impressive portfolio piece completed',
          daily: [
            { day: 'Mon', task: 'Plan portfolio project — wireframes and requirements', duration: '2h' },
            { day: 'Tue', task: 'Build core functionality', duration: '3h' },
            { day: 'Wed', task: 'Add features and handle edge cases', duration: '3h' },
            { day: 'Thu', task: 'Write clean code, add comments, optimize', duration: '2h' },
            { day: 'Fri', task: 'Add README, deploy or create demo', duration: '2h' },
            { day: 'Sat', task: 'Get peer feedback, iterate on design', duration: '1.5h' },
            { day: 'Sun', task: 'Final polish and screenshot documentation', duration: '1h' },
          ],
        },
        {
          theme: 'Market Yourself',
          milestone: 'Profile updated, first proposals sent for new skill',
          daily: [
            { day: 'Mon', task: 'Add new skill to all freelance profiles', duration: '1h' },
            { day: 'Tue', task: 'Write 2 portfolio descriptions highlighting new skill', duration: '1.5h' },
            { day: 'Wed', task: 'Generate case study from portfolio project', duration: '1.5h' },
            { day: 'Thu', task: 'Send 5 proposals for jobs requiring this skill', duration: '2h' },
            { day: 'Fri', task: 'Network: join 2 communities related to the skill', duration: '1h' },
            { day: 'Sat', task: 'Write a blog post / article about what you learned', duration: '2h' },
            { day: 'Sun', task: 'Review month, identify gaps to fill next', duration: '1h' },
          ],
        },
      ],
    },
    client_pipeline: {
      name: 'Build a Steady Client Pipeline',
      description: 'Never run out of work — build repeatable lead gen',
      weeks: [
        {
          theme: 'Define Your Ideal Client',
          milestone: 'Ideal Client Profile (ICP) documented',
          daily: [
            { day: 'Mon', task: 'Analyze past clients — who was best to work with?', duration: '1.5h' },
            { day: 'Tue', task: 'Define ideal client avatar: industry, size, budget', duration: '1h' },
            { day: 'Wed', task: 'Research where ideal clients hang out online', duration: '1.5h' },
            { day: 'Thu', task: 'Create specialized service packages for your ICP', duration: '2h' },
            { day: 'Fri', task: 'Write ICP-focused profile and proposal templates', duration: '2h' },
            { day: 'Sat', task: 'List 20 potential ideal clients to target', duration: '1.5h' },
            { day: 'Sun', task: 'Set weekly outreach targets: 5 warm, 10 cold', duration: '30m' },
          ],
        },
        {
          theme: 'Outreach Systems',
          milestone: 'Outreach playbook created and tested',
          daily: [
            { day: 'Mon', task: 'Write 3 cold outreach templates (email, DM, proposal)', duration: '2h' },
            { day: 'Tue', task: 'Send 5 personalized outreach messages', duration: '1.5h' },
            { day: 'Wed', task: 'Engage with 10 potential clients on social media', duration: '1h' },
            { day: 'Thu', task: 'Follow up on all pending conversations', duration: '1h' },
            { day: 'Fri', task: 'Send 5 more outreach + apply to 3 job postings', duration: '2h' },
            { day: 'Sat', task: 'Track response rates — what\'s working?', duration: '45m' },
            { day: 'Sun', task: 'Refine templates based on responses', duration: '30m' },
          ],
        },
        {
          theme: 'Content & Visibility',
          milestone: 'Published 4+ pieces of content driving inbound leads',
          daily: [
            { day: 'Mon', task: 'Write a helpful article / post for your niche', duration: '2h' },
            { day: 'Tue', task: 'Share on 3 platforms, engage with comments', duration: '1h' },
            { day: 'Wed', task: 'Answer 5 questions on forums in your expertise area', duration: '1h' },
            { day: 'Thu', task: 'Create a free resource (template, checklist, tool)', duration: '2h' },
            { day: 'Fri', task: 'Publish resource, promote across channels', duration: '1.5h' },
            { day: 'Sat', task: 'Review analytics — what content drives leads?', duration: '45m' },
            { day: 'Sun', task: 'Plan next week\'s content calendar', duration: '30m' },
          ],
        },
        {
          theme: 'Systematize & Scale',
          milestone: 'Repeatable pipeline generating 3+ leads/week',
          daily: [
            { day: 'Mon', task: 'Document your full lead-gen playbook', duration: '2h' },
            { day: 'Tue', task: 'Set up automated follow-up reminders', duration: '1h' },
            { day: 'Wed', task: 'Create a referral request template for past clients', duration: '1h' },
            { day: 'Thu', task: 'Ask 5 past clients for referrals', duration: '1h' },
            { day: 'Fri', task: 'Review pipeline metrics: leads, conversion, revenue', duration: '1h' },
            { day: 'Sat', task: 'Identify bottlenecks and optimization opportunities', duration: '45m' },
            { day: 'Sun', task: 'Set 90-day pipeline goals, celebrate wins', duration: '30m' },
          ],
        },
      ],
    },
  };

  /* ══════════════════════════════════════════════
   * CUSTOM PLAN GENERATOR
   * ══════════════════════════════════════════════ */

  function generateCustomPlan(config) {
    config = config || {};
    var goal = config.goal || 'Achieve freelance goal';
    var tasks = config.tasks || [];
    var hoursPerDay = config.hoursPerDay || 2;
    var daysPerWeek = config.daysPerWeek || 5;
    var dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, daysPerWeek);

    // Distribute tasks across 4 weeks
    var tasksPerWeek = Math.ceil(tasks.length / 4);
    var weeks = [];

    for (var w = 0; w < 4; w++) {
      var weekTasks = tasks.slice(w * tasksPerWeek, (w + 1) * tasksPerWeek);
      var daily = [];

      weekTasks.forEach(function (t, idx) {
        daily.push({
          day: dayNames[idx % dayNames.length],
          task: typeof t === 'string' ? t : t.task || t.name || 'Task ' + (idx + 1),
          duration: hoursPerDay + 'h',
        });
      });

      // Fill remaining days
      while (daily.length < daysPerWeek) {
        daily.push({
          day: dayNames[daily.length],
          task: 'Review progress and plan ahead',
          duration: '1h',
        });
      }

      weeks.push({
        theme: 'Week ' + (w + 1) + ': ' + (config.weekThemes ? config.weekThemes[w] || 'Focus & Execute' : 'Focus & Execute'),
        milestone: config.weekMilestones ? config.weekMilestones[w] || '' : '',
        daily: daily,
      });
    }

    return {
      id: 'custom_' + Date.now(),
      name: goal,
      description: config.description || 'Custom 4-week action plan',
      weeks: weeks,
      createdAt: new Date().toISOString(),
      type: 'custom',
    };
  }

  /* ══════════════════════════════════════════════
   * PLAN MANAGEMENT
   * ══════════════════════════════════════════════ */

  function createPlan(templateKey, startDate) {
    var template = PLAN_TEMPLATES[templateKey];
    if (!template) return null;

    var start = startDate ? new Date(startDate) : new Date();
    // Adjust to next Monday if not already Monday
    var dayOfWeek = start.getDay();
    if (dayOfWeek !== 1) {
      start.setDate(start.getDate() + ((8 - dayOfWeek) % 7));
    }

    var plan = {
      id: templateKey + '_' + Date.now(),
      name: template.name,
      description: template.description,
      weeks: JSON.parse(JSON.stringify(template.weeks)),
      startDate: start.toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      type: templateKey,
    };

    var plans = loadPlans();
    plans.unshift(plan);
    if (plans.length > 20) plans = plans.slice(0, 20);
    savePlans(plans);

    return plan;
  }

  function toggleTask(planId, weekIdx, dayIdx) {
    var tasks = loadTasks();
    var key = planId + '_w' + weekIdx + '_d' + dayIdx;
    if (tasks[key]) {
      delete tasks[key];
    } else {
      tasks[key] = new Date().toISOString();
    }
    saveTasks(tasks);
    return !!tasks[key];
  }

  function getPlanProgress(planId, plan) {
    var tasks = loadTasks();
    var total = 0;
    var done = 0;
    var weekProgress = [];

    plan.weeks.forEach(function (week, wIdx) {
      var weekTotal = week.daily.length;
      var weekDone = 0;
      week.daily.forEach(function (_, dIdx) {
        total++;
        var key = planId + '_w' + wIdx + '_d' + dIdx;
        if (tasks[key]) {
          done++;
          weekDone++;
        }
      });
      weekProgress.push({ total: weekTotal, done: weekDone, pct: weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0 });
    });

    return {
      total: total,
      done: done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
      weekProgress: weekProgress,
    };
  }

  /* ══════════════════════════════════════════════
   * RENDER
   * ══════════════════════════════════════════════ */

  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function render(containerId) {
    var el = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!el) return;

    var plans = loadPlans();
    var tasks = loadTasks();

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#e0e0e0;max-width:820px;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:24px;">';
    html += '<h2 style="margin:0 0 6px;font-size:22px;color:#fff;">🎯 Action Plan Wizard</h2>';
    html += '<p style="margin:0;font-size:14px;color:#94a3b8;">4-week plans with daily tasks and milestones</p>';
    html += '</div>';

    // Template picker (if no active plans)
    if (plans.length === 0) {
      html += '<div style="margin-bottom:24px;">';
      html += '<h3 style="font-size:15px;color:#f4f4f5;margin:0 0 12px;">Choose Your Plan</h3>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">';

      Object.keys(PLAN_TEMPLATES).forEach(function (key) {
        var t = PLAN_TEMPLATES[key];
        html += '<div class="apw-template" data-template="' + key + '" style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;cursor:pointer;transition:border-color 0.2s;">';
        html += '<h4 style="margin:0 0 6px;font-size:14px;color:#fff;">' + esc(t.name) + '</h4>';
        html += '<p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">' + esc(t.description) + '</p>';
        html += '<div style="margin-top:10px;font-size:11px;color:#6366f1;">4 weeks · 28 tasks →</div>';
        html += '</div>';
      });

      html += '</div></div>';
    }

    // Active plans
    plans.forEach(function (plan) {
      var progress = getPlanProgress(plan.id, plan);

      html += '<div style="background:#0f172a;border:1px solid #334155;border-radius:16px;padding:24px;margin-bottom:20px;">';

      // Plan header
      html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:16px;">';
      html += '<div>';
      html += '<h3 style="margin:0;font-size:18px;color:#fff;">' + esc(plan.name) + '</h3>';
      html += '<p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">' + esc(plan.description) + '</p>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-size:24px;font-weight:700;color:' + (progress.pct >= 75 ? '#22c55e' : progress.pct >= 50 ? '#fbbf24' : '#6366f1') + ';">' + progress.pct + '%</div>';
      html += '<div style="font-size:11px;color:#94a3b8;">' + progress.done + '/' + progress.total + ' tasks</div>';
      html += '</div></div>';

      // Progress bar
      html += '<div style="height:6px;background:#1e293b;border-radius:3px;margin-bottom:20px;overflow:hidden;">';
      html += '<div style="height:100%;width:' + progress.pct + '%;background:linear-gradient(90deg,#6366f1,#22c55e);border-radius:3px;transition:width 0.5s;"></div>';
      html += '</div>';

      // Weeks
      plan.weeks.forEach(function (week, wIdx) {
        var wp = progress.weekProgress[wIdx];
        var isCurrentWeek = false;
        if (plan.startDate) {
          var start = new Date(plan.startDate);
          var weekStart = new Date(start.getTime() + wIdx * 7 * 24 * 60 * 60 * 1000);
          var weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
          var now = new Date();
          isCurrentWeek = now >= weekStart && now <= weekEnd;
        }

        html += '<div style="margin-bottom:16px;' + (isCurrentWeek ? 'border:1px solid #6366f1;border-radius:12px;padding:14px;' : '') + '">';

        // Week header
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<span style="font-size:14px;font-weight:600;color:#f4f4f5;">Week ' + (wIdx + 1) + ': ' + esc(week.theme) + '</span>';
        if (isCurrentWeek) {
          html += '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:#6366f1;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Current</span>';
        }
        html += '</div>';
        html += '<span style="font-size:12px;color:' + (wp.pct === 100 ? '#22c55e' : '#94a3b8') + ';">' + wp.done + '/' + wp.total + (wp.pct === 100 ? ' ✅' : '') + '</span>';
        html += '</div>';

        // Milestone
        if (week.milestone) {
          html += '<div style="font-size:12px;color:#818cf8;margin-bottom:10px;padding:6px 10px;background:rgba(99,102,241,0.1);border-radius:6px;">🏁 Milestone: ' + esc(week.milestone) + '</div>';
        }

        // Daily tasks
        week.daily.forEach(function (d, dIdx) {
          var taskKey = plan.id + '_w' + wIdx + '_d' + dIdx;
          var isDone = !!tasks[taskKey];

          html += '<div class="apw-task" data-plan="' + plan.id + '" data-week="' + wIdx + '" data-day="' + dIdx + '" ';
          html += 'style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:4px;cursor:pointer;transition:background 0.15s;' + (isDone ? 'opacity:0.5;' : '') + 'background:#1e293b;">';

          // Checkbox
          html += '<span style="flex-shrink:0;width:20px;height:20px;border-radius:6px;border:2px solid ' + (isDone ? '#22c55e' : '#475569') + ';display:flex;align-items:center;justify-content:center;font-size:12px;margin-top:1px;' + (isDone ? 'background:#22c55e20;color:#22c55e;' : '') + '">' + (isDone ? '✓' : '') + '</span>';

          html += '<div style="flex:1;">';
          html += '<span style="font-size:13px;color:' + (isDone ? '#6b7280' : '#e0e0e0') + ';' + (isDone ? 'text-decoration:line-through;' : '') + '">' + esc(d.task) + '</span>';
          html += '</div>';

          html += '<div style="display:flex;gap:8px;flex-shrink:0;align-items:center;">';
          html += '<span style="font-size:11px;color:#94a3b8;padding:2px 6px;background:#0f172a;border-radius:4px;">' + esc(d.day) + '</span>';
          html += '<span style="font-size:11px;color:#6b7280;">' + esc(d.duration) + '</span>';
          html += '</div>';

          html += '</div>';
        });

        html += '</div>';
      });

      // Delete plan button
      html += '<div style="text-align:right;margin-top:12px;">';
      html += '<button class="apw-delete" data-plan="' + plan.id + '" style="background:transparent;color:#ef4444;border:1px solid #ef444440;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;">Delete Plan</button>';
      html += '</div>';

      html += '</div>';
    });

    html += '</div>';
    el.innerHTML = html;

    // Event listeners
    el.querySelectorAll('.apw-template').forEach(function (card) {
      card.addEventListener('click', function () {
        var key = this.getAttribute('data-template');
        createPlan(key);
        render(el);
      });
      card.addEventListener('mouseenter', function () { this.style.borderColor = '#6366f1'; });
      card.addEventListener('mouseleave', function () { this.style.borderColor = '#334155'; });
    });

    el.querySelectorAll('.apw-task').forEach(function (row) {
      row.addEventListener('click', function () {
        var planId = this.getAttribute('data-plan');
        var wIdx = parseInt(this.getAttribute('data-week'));
        var dIdx = parseInt(this.getAttribute('data-day'));
        toggleTask(planId, wIdx, dIdx);
        render(el);
      });
    });

    el.querySelectorAll('.apw-delete').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var planId = this.getAttribute('data-plan');
        var p = loadPlans().filter(function (p) { return p.id !== planId; });
        savePlans(p);
        render(el);
      });
    });
  }

  /* ══════════════════════════════════════════════
   * INIT
   * ══════════════════════════════════════════════ */

  function init(options) {
    options = options || {};
    return {
      plans: loadPlans(),
      templates: Object.keys(PLAN_TEMPLATES),
      ready: true,
    };
  }

  /* ══════════════════════════════════════════════
   * PUBLIC API
   * ══════════════════════════════════════════════ */
  window.CortexFreelancer.ActionPlanWizard = {
    init: init,
    render: render,
    createPlan: createPlan,
    generateCustomPlan: generateCustomPlan,
    toggleTask: toggleTask,
    getPlanProgress: getPlanProgress,
    loadPlans: loadPlans,
    templates: PLAN_TEMPLATES,
    version: '2.0.0',
  };

  // Legacy compat
  window.CortexActionPlanWizard = window.CortexFreelancer.ActionPlanWizard;

})();
