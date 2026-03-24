/**
 * [CF-062] Competitor Profile Tracker
 * Monitor top 5 competitors — track profiles, get alerts when they change
 * rates, skills, or availability.
 *
 * Persists to localStorage key: 'cortex_competitor_profiles'
 * Exposed on window.CortexFreelancer.competitorProfileTracker
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_competitor_profiles';
  var MAX_COMPETITORS = 5;

  // ─── Mock self-profile (for comparison) ─────────────────────────────

  var selfProfile = {
    name: 'You',
    title: 'Senior Full-Stack Developer',
    hourlyRate: 85,
    skills: ['JavaScript', 'React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
    availability: 'Available',
    jobSuccessScore: 94,
    totalEarnings: 187500,
    totalJobs: 62,
    responseTime: '1.2 hours'
  };

  // ─── Realistic mock competitor data ─────────────────────────────────

  var mockCompetitors = [
    {
      id: 'comp_001',
      name: 'Elena Vasquez',
      title: 'Full-Stack Developer & Cloud Architect',
      hourlyRate: 95,
      skills: ['JavaScript', 'React', 'Node.js', 'AWS', 'Docker', 'GraphQL'],
      availability: 'Available',
      jobSuccessScore: 97,
      totalEarnings: 342000,
      totalJobs: 118,
      memberSince: '2018-03-15',
      lastActive: '2026-03-23',
      profileUrl: 'https://www.upwork.com/freelancers/~elenavasquez',
      specializations: ['Microservices', 'Serverless Architecture', 'CI/CD Pipelines'],
      changeHistory: [
        { type: 'rate_change', from: 85, to: 90, date: '2025-11-10', direction: 'up' },
        { type: 'rate_change', from: 90, to: 95, date: '2026-02-18', direction: 'up' },
        { type: 'skill_added', skill: 'GraphQL', date: '2026-01-05' },
        { type: 'availability_change', from: 'Not Available', to: 'Available', date: '2026-03-01' }
      ]
    },
    {
      id: 'comp_002',
      name: 'Marcus Chen',
      title: 'React & TypeScript Specialist',
      hourlyRate: 78,
      skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'Redux', 'Jest'],
      availability: 'Available',
      jobSuccessScore: 92,
      totalEarnings: 215800,
      totalJobs: 89,
      memberSince: '2019-07-22',
      lastActive: '2026-03-22',
      profileUrl: 'https://www.upwork.com/freelancers/~marcuschen',
      specializations: ['SPA Development', 'Design Systems', 'Performance Optimization'],
      changeHistory: [
        { type: 'rate_change', from: 80, to: 78, date: '2026-01-15', direction: 'down' },
        { type: 'skill_added', skill: 'Next.js', date: '2025-12-20' },
        { type: 'skill_added', skill: 'Tailwind CSS', date: '2026-02-08' },
        { type: 'availability_change', from: 'Limited', to: 'Available', date: '2026-03-10' }
      ]
    },
    {
      id: 'comp_003',
      name: 'Sarah Mitchell',
      title: 'Backend Engineer & DevOps Expert',
      hourlyRate: 110,
      skills: ['Node.js', 'Python', 'AWS', 'Kubernetes', 'Terraform', 'PostgreSQL'],
      availability: 'Limited',
      jobSuccessScore: 99,
      totalEarnings: 528000,
      totalJobs: 156,
      memberSince: '2016-11-03',
      lastActive: '2026-03-24',
      profileUrl: 'https://www.upwork.com/freelancers/~sarahmitchell',
      specializations: ['Infrastructure as Code', 'Database Architecture', 'API Design'],
      changeHistory: [
        { type: 'rate_change', from: 100, to: 105, date: '2025-09-20', direction: 'up' },
        { type: 'rate_change', from: 105, to: 110, date: '2026-03-05', direction: 'up' },
        { type: 'availability_change', from: 'Available', to: 'Limited', date: '2026-03-12' },
        { type: 'skill_added', skill: 'Terraform', date: '2025-10-15' }
      ]
    },
    {
      id: 'comp_004',
      name: 'Raj Patel',
      title: 'MERN Stack Developer',
      hourlyRate: 65,
      skills: ['JavaScript', 'React', 'Node.js', 'MongoDB', 'Express', 'TypeScript'],
      availability: 'Available',
      jobSuccessScore: 88,
      totalEarnings: 124300,
      totalJobs: 74,
      memberSince: '2020-02-14',
      lastActive: '2026-03-21',
      profileUrl: 'https://www.upwork.com/freelancers/~rajpatel',
      specializations: ['E-commerce Platforms', 'REST APIs', 'Real-time Applications'],
      changeHistory: [
        { type: 'rate_change', from: 55, to: 60, date: '2025-08-01', direction: 'up' },
        { type: 'rate_change', from: 60, to: 65, date: '2026-01-20', direction: 'up' },
        { type: 'skill_added', skill: 'TypeScript', date: '2026-02-25' },
        { type: 'availability_change', from: 'Not Available', to: 'Available', date: '2026-02-01' }
      ]
    },
    {
      id: 'comp_005',
      name: 'Anna Kowalski',
      title: 'Senior Frontend Engineer',
      hourlyRate: 90,
      skills: ['React', 'Vue.js', 'TypeScript', 'CSS3', 'Figma', 'Storybook'],
      availability: 'Not Available',
      jobSuccessScore: 95,
      totalEarnings: 276400,
      totalJobs: 103,
      memberSince: '2017-09-08',
      lastActive: '2026-03-18',
      profileUrl: 'https://www.upwork.com/freelancers/~annakowalski',
      specializations: ['UI/UX Implementation', 'Accessibility', 'Animation & Motion'],
      changeHistory: [
        { type: 'rate_change', from: 95, to: 90, date: '2026-03-15', direction: 'down' },
        { type: 'skill_added', skill: 'Storybook', date: '2026-01-12' },
        { type: 'skill_added', skill: 'Figma', date: '2025-11-28' },
        { type: 'availability_change', from: 'Available', to: 'Not Available', date: '2026-03-20' }
      ]
    }
  ];

  // ─── Persistence helpers ────────────────────────────────────────────

  function _load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupted data, reset */ }
    return null;
  }

  function _save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[CompetitorProfileTracker] localStorage write failed:', e);
    }
  }

  function _getData() {
    var data = _load();
    if (!data || !data.competitors || data.competitors.length === 0) {
      data = { competitors: mockCompetitors, lastUpdated: new Date().toISOString() };
      _save(data);
    }
    return data;
  }

  // ─── Utility helpers ────────────────────────────────────────────────

  function _generateId() {
    return 'comp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  function _formatDate(dateStr) {
    var d = new Date(dateStr);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function _formatCurrency(amount) {
    return '$' + amount.toLocaleString();
  }

  function _daysSince(dateStr) {
    var now = new Date();
    var then = new Date(dateStr);
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  }

  function _getAvailabilityColor(availability) {
    if (availability === 'Available') return '#27ae60';
    if (availability === 'Limited') return '#f39c12';
    return '#e74c3c';
  }

  function _getAlertColor(type, direction) {
    if (type === 'rate_change' && direction === 'up') return { bg: '#fdecea', border: '#e74c3c', text: '#c0392b', label: 'WARNING' };
    if (type === 'rate_change' && direction === 'down') return { bg: '#eafaf1', border: '#27ae60', text: '#1e8449', label: 'OPPORTUNITY' };
    if (type === 'skill_added') return { bg: '#ebf5fb', border: '#3498db', text: '#2471a3', label: 'INFO' };
    if (type === 'availability_change') return { bg: '#fef9e7', border: '#f39c12', text: '#d68910', label: 'NOTICE' };
    return { bg: '#f4f6f7', border: '#95a5a6', text: '#717d7e', label: 'UPDATE' };
  }

  function _getSkillOverlap(competitorSkills) {
    var overlap = [];
    for (var i = 0; i < selfProfile.skills.length; i++) {
      for (var j = 0; j < competitorSkills.length; j++) {
        if (selfProfile.skills[i].toLowerCase() === competitorSkills[j].toLowerCase()) {
          overlap.push(selfProfile.skills[i]);
          break;
        }
      }
    }
    return overlap;
  }

  // ─── Core Functions ─────────────────────────────────────────────────

  function init() {
    var data = _getData();
    return {
      competitors: data.competitors,
      count: data.competitors.length,
      maxAllowed: MAX_COMPETITORS,
      lastUpdated: data.lastUpdated
    };
  }

  function addCompetitor(profile) {
    if (!profile || !profile.name) {
      throw new Error('Competitor name is required');
    }

    var data = _getData();

    if (data.competitors.length >= MAX_COMPETITORS) {
      return {
        success: false,
        error: 'Maximum of ' + MAX_COMPETITORS + ' competitors allowed. Remove one before adding another.'
      };
    }

    var newCompetitor = {
      id: _generateId(),
      name: profile.name,
      title: profile.title || 'Freelancer',
      hourlyRate: profile.hourlyRate || 0,
      skills: profile.skills || [],
      availability: profile.availability || 'Unknown',
      jobSuccessScore: profile.jobSuccessScore || 0,
      totalEarnings: profile.totalEarnings || 0,
      totalJobs: profile.totalJobs || 0,
      memberSince: profile.memberSince || new Date().toISOString().split('T')[0],
      lastActive: profile.lastActive || new Date().toISOString().split('T')[0],
      profileUrl: profile.profileUrl || '',
      specializations: profile.specializations || [],
      changeHistory: []
    };

    data.competitors.push(newCompetitor);
    data.lastUpdated = new Date().toISOString();
    _save(data);

    return { success: true, competitor: newCompetitor, totalTracked: data.competitors.length };
  }

  function removeCompetitor(competitorId) {
    var data = _getData();
    var initialLength = data.competitors.length;

    data.competitors = data.competitors.filter(function (c) {
      return c.id !== competitorId;
    });

    if (data.competitors.length === initialLength) {
      return { success: false, error: 'Competitor not found with id: ' + competitorId };
    }

    data.lastUpdated = new Date().toISOString();
    _save(data);

    return { success: true, removed: competitorId, remaining: data.competitors.length };
  }

  function getAlerts() {
    var data = _getData();
    var allAlerts = [];

    for (var i = 0; i < data.competitors.length; i++) {
      var comp = data.competitors[i];
      if (!comp.changeHistory) continue;

      for (var j = 0; j < comp.changeHistory.length; j++) {
        var change = comp.changeHistory[j];
        var alertInfo = _getAlertColor(change.type, change.direction);
        var message = '';

        if (change.type === 'rate_change') {
          message = comp.name + ' changed rate from $' + change.from + '/hr to $' + change.to + '/hr';
        } else if (change.type === 'skill_added') {
          message = comp.name + ' added new skill: ' + change.skill;
        } else if (change.type === 'availability_change') {
          message = comp.name + ' changed availability from "' + change.from + '" to "' + change.to + '"';
        }

        allAlerts.push({
          competitorId: comp.id,
          competitorName: comp.name,
          type: change.type,
          message: message,
          date: change.date,
          severity: alertInfo.label,
          color: alertInfo
        });
      }
    }

    allAlerts.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    return allAlerts;
  }

  function compareWithSelf() {
    var data = _getData();
    var comparisons = [];

    for (var i = 0; i < data.competitors.length; i++) {
      var comp = data.competitors[i];
      var overlap = _getSkillOverlap(comp.skills);
      var rateDiff = selfProfile.hourlyRate - comp.hourlyRate;

      comparisons.push({
        competitor: comp.name,
        yourRate: selfProfile.hourlyRate,
        theirRate: comp.hourlyRate,
        rateDifference: rateDiff,
        rateAdvantage: rateDiff < 0 ? 'They charge more' : rateDiff > 0 ? 'You charge more' : 'Same rate',
        yourJSS: selfProfile.jobSuccessScore,
        theirJSS: comp.jobSuccessScore,
        skillsOverlap: overlap,
        skillsOverlapCount: overlap.length,
        yourUniqueSkills: selfProfile.skills.filter(function (s) { return overlap.indexOf(s) === -1; }),
        theirUniqueSkills: comp.skills.filter(function (s) {
          var found = false;
          for (var k = 0; k < overlap.length; k++) {
            if (overlap[k].toLowerCase() === s.toLowerCase()) { found = true; break; }
          }
          return !found;
        }),
        theirAvailability: comp.availability,
        yourResponseTime: selfProfile.responseTime
      });
    }

    return comparisons;
  }

  function getChangeHistory(competitorId) {
    var data = _getData();
    var comp = null;

    for (var i = 0; i < data.competitors.length; i++) {
      if (data.competitors[i].id === competitorId) {
        comp = data.competitors[i];
        break;
      }
    }

    if (!comp) {
      return { success: false, error: 'Competitor not found' };
    }

    var history = (comp.changeHistory || []).slice();
    history.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    return {
      success: true,
      competitor: comp.name,
      changes: history,
      totalChanges: history.length
    };
  }

  // ─── Render ─────────────────────────────────────────────────────────

  function render() {
    var data = _getData();
    var competitors = data.competitors;
    var alerts = getAlerts();
    var comparisons = compareWithSelf();
    var html = '';

    // ── Container ──
    html += '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; max-width: 1100px; margin: 0 auto; padding: 24px; background: #f8f9fa; border-radius: 12px;">';

    // ── Header ──
    html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #e9ecef;">';
    html += '<div>';
    html += '<h2 style="margin: 0 0 4px 0; font-size: 22px; color: #2c3e50;">Competitor Profile Tracker</h2>';
    html += '<p style="margin: 0; font-size: 13px; color: #7f8c8d;">Monitoring ' + competitors.length + ' of ' + MAX_COMPETITORS + ' competitor slots used</p>';
    html += '</div>';
    html += '<div style="display: flex; gap: 8px;">';
    html += '<span style="display: inline-block; padding: 6px 14px; background: #3498db; color: #fff; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;" data-action="add-competitor">+ Add Competitor</span>';
    html += '<span style="display: inline-block; padding: 6px 14px; background: #ecf0f1; color: #2c3e50; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;" data-action="refresh">Refresh All</span>';
    html += '</div>';
    html += '</div>';

    // ── Competitor Cards ──
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 24px;">';

    for (var i = 0; i < competitors.length; i++) {
      var comp = competitors[i];
      var availColor = _getAvailabilityColor(comp.availability);
      var initials = comp.name.split(' ').map(function (n) { return n[0]; }).join('');
      var daysActive = _daysSince(comp.lastActive);
      var activeLabel = daysActive === 0 ? 'Active today' : daysActive === 1 ? 'Active yesterday' : 'Active ' + daysActive + 'd ago';

      html += '<div style="background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e9ecef; position: relative;">';

      // Remove button
      html += '<span style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #fdecea; color: #e74c3c; border-radius: 50%; font-size: 14px; cursor: pointer; font-weight: bold;" data-action="remove-competitor" data-id="' + comp.id + '" title="Remove competitor">&times;</span>';

      // Avatar + Name row
      html += '<div style="display: flex; align-items: center; gap: 14px; margin-bottom: 14px;">';
      html += '<div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 16px;">' + initials + '</div>';
      html += '<div style="flex: 1;">';
      html += '<div style="font-weight: 600; font-size: 15px; color: #2c3e50; margin-bottom: 2px;">' + comp.name + '</div>';
      html += '<div style="font-size: 12px; color: #7f8c8d;">' + comp.title + '</div>';
      html += '</div>';
      html += '</div>';

      // Stats row
      html += '<div style="display: flex; gap: 12px; margin-bottom: 14px;">';
      html += '<div style="flex: 1; text-align: center; padding: 10px 6px; background: #f8f9fa; border-radius: 8px;">';
      html += '<div style="font-size: 18px; font-weight: 700; color: #2c3e50;">$' + comp.hourlyRate + '</div>';
      html += '<div style="font-size: 11px; color: #95a5a6; margin-top: 2px;">per hour</div>';
      html += '</div>';
      html += '<div style="flex: 1; text-align: center; padding: 10px 6px; background: #f8f9fa; border-radius: 8px;">';
      html += '<div style="font-size: 18px; font-weight: 700; color: #27ae60;">' + comp.jobSuccessScore + '%</div>';
      html += '<div style="font-size: 11px; color: #95a5a6; margin-top: 2px;">JSS</div>';
      html += '</div>';
      html += '<div style="flex: 1; text-align: center; padding: 10px 6px; background: #f8f9fa; border-radius: 8px;">';
      html += '<div style="font-size: 18px; font-weight: 700; color: #8e44ad;">' + comp.totalJobs + '</div>';
      html += '<div style="font-size: 11px; color: #95a5a6; margin-top: 2px;">jobs</div>';
      html += '</div>';
      html += '</div>';

      // Availability badge
      html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">';
      html += '<span style="display: inline-block; padding: 4px 12px; background: ' + availColor + '20; color: ' + availColor + '; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid ' + availColor + '40;">' + comp.availability + '</span>';
      html += '<span style="font-size: 11px; color: #95a5a6;">' + activeLabel + '</span>';
      html += '</div>';

      // Skills
      html += '<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px;">';
      for (var s = 0; s < comp.skills.length; s++) {
        var isShared = selfProfile.skills.indexOf(comp.skills[s]) !== -1;
        var skillBg = isShared ? '#ebf5fb' : '#f4f6f7';
        var skillColor = isShared ? '#2471a3' : '#717d7e';
        var skillBorder = isShared ? '#3498db' : '#d5dbdb';
        html += '<span style="display: inline-block; padding: 3px 8px; background: ' + skillBg + '; color: ' + skillColor + '; border: 1px solid ' + skillBorder + '; border-radius: 4px; font-size: 11px;">' + comp.skills[s] + '</span>';
      }
      html += '</div>';

      // Footer
      html += '<div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #95a5a6;">';
      html += '<span>Earned: ' + _formatCurrency(comp.totalEarnings) + '</span>';
      html += '<span>Since: ' + _formatDate(comp.memberSince) + '</span>';
      html += '</div>';

      html += '</div>';
    }

    html += '</div>';

    // ── Change Alerts Panel ──
    html += '<div style="background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e9ecef; margin-bottom: 24px;">';
    html += '<h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c3e50; display: flex; align-items: center; gap: 8px;">';
    html += '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #e74c3c; animation: pulse 2s infinite;"></span>';
    html += 'Change Alerts <span style="font-size: 12px; font-weight: 400; color: #95a5a6;">(' + alerts.length + ' detected)</span></h3>';

    if (alerts.length === 0) {
      html += '<p style="margin: 0; color: #95a5a6; font-size: 13px; text-align: center; padding: 20px 0;">No changes detected yet. Alerts will appear here when competitors update their profiles.</p>';
    } else {
      html += '<div style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto;">';
      var alertLimit = Math.min(alerts.length, 15);
      for (var a = 0; a < alertLimit; a++) {
        var alert = alerts[a];
        var ac = alert.color;
        html += '<div style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; background: ' + ac.bg + '; border-left: 4px solid ' + ac.border + '; border-radius: 6px;">';
        html += '<span style="display: inline-block; padding: 2px 8px; background: ' + ac.border + '; color: #fff; border-radius: 3px; font-size: 10px; font-weight: 700; white-space: nowrap; margin-top: 2px;">' + ac.label + '</span>';
        html += '<div style="flex: 1;">';
        html += '<div style="font-size: 13px; color: ' + ac.text + '; font-weight: 500;">' + alert.message + '</div>';
        html += '<div style="font-size: 11px; color: #95a5a6; margin-top: 3px;">' + _formatDate(alert.date) + '</div>';
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';

    // ── Comparison Table ──
    html += '<div style="background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e9ecef; margin-bottom: 24px; overflow-x: auto;">';
    html += '<h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c3e50;">You vs. Competitors</h3>';

    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    html += '<thead>';
    html += '<tr style="background: #f8f9fa;">';
    html += '<th style="padding: 10px 14px; text-align: left; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #e9ecef;">Metric</th>';
    html += '<th style="padding: 10px 14px; text-align: center; font-weight: 600; color: #3498db; border-bottom: 2px solid #3498db; background: #ebf5fb;">You</th>';

    for (var h = 0; h < comparisons.length; h++) {
      html += '<th style="padding: 10px 14px; text-align: center; font-weight: 600; color: #2c3e50; border-bottom: 2px solid #e9ecef;">' + comparisons[h].competitor + '</th>';
    }
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';

    // Rate row
    html += '<tr>';
    html += '<td style="padding: 10px 14px; font-weight: 500; color: #2c3e50; border-bottom: 1px solid #f0f0f0;">Hourly Rate</td>';
    html += '<td style="padding: 10px 14px; text-align: center; font-weight: 600; color: #3498db; border-bottom: 1px solid #f0f0f0; background: #fafcfe;">$' + selfProfile.hourlyRate + '</td>';
    for (var r = 0; r < comparisons.length; r++) {
      var rateColor = comparisons[r].theirRate > selfProfile.hourlyRate ? '#e74c3c' : comparisons[r].theirRate < selfProfile.hourlyRate ? '#27ae60' : '#2c3e50';
      html += '<td style="padding: 10px 14px; text-align: center; color: ' + rateColor + '; font-weight: 500; border-bottom: 1px solid #f0f0f0;">$' + comparisons[r].theirRate + '</td>';
    }
    html += '</tr>';

    // JSS row
    html += '<tr>';
    html += '<td style="padding: 10px 14px; font-weight: 500; color: #2c3e50; border-bottom: 1px solid #f0f0f0;">Job Success Score</td>';
    html += '<td style="padding: 10px 14px; text-align: center; font-weight: 600; color: #3498db; border-bottom: 1px solid #f0f0f0; background: #fafcfe;">' + selfProfile.jobSuccessScore + '%</td>';
    for (var js = 0; js < comparisons.length; js++) {
      var jssColor = comparisons[js].theirJSS > selfProfile.jobSuccessScore ? '#e74c3c' : '#27ae60';
      html += '<td style="padding: 10px 14px; text-align: center; color: ' + jssColor + '; font-weight: 500; border-bottom: 1px solid #f0f0f0;">' + comparisons[js].theirJSS + '%</td>';
    }
    html += '</tr>';

    // Skills overlap row
    html += '<tr>';
    html += '<td style="padding: 10px 14px; font-weight: 500; color: #2c3e50; border-bottom: 1px solid #f0f0f0;">Skills Overlap</td>';
    html += '<td style="padding: 10px 14px; text-align: center; font-weight: 600; color: #3498db; border-bottom: 1px solid #f0f0f0; background: #fafcfe;">' + selfProfile.skills.length + ' skills</td>';
    for (var so = 0; so < comparisons.length; so++) {
      html += '<td style="padding: 10px 14px; text-align: center; color: #2c3e50; font-weight: 500; border-bottom: 1px solid #f0f0f0;">' + comparisons[so].skillsOverlapCount + ' shared</td>';
    }
    html += '</tr>';

    // Availability row
    html += '<tr>';
    html += '<td style="padding: 10px 14px; font-weight: 500; color: #2c3e50; border-bottom: 1px solid #f0f0f0;">Availability</td>';
    html += '<td style="padding: 10px 14px; text-align: center; font-weight: 600; color: #27ae60; border-bottom: 1px solid #f0f0f0; background: #fafcfe;">' + selfProfile.availability + '</td>';
    for (var av = 0; av < comparisons.length; av++) {
      var avColor = _getAvailabilityColor(comparisons[av].theirAvailability);
      html += '<td style="padding: 10px 14px; text-align: center; color: ' + avColor + '; font-weight: 500; border-bottom: 1px solid #f0f0f0;">' + comparisons[av].theirAvailability + '</td>';
    }
    html += '</tr>';

    // Response time row
    html += '<tr>';
    html += '<td style="padding: 10px 14px; font-weight: 500; color: #2c3e50;">Response Time</td>';
    html += '<td style="padding: 10px 14px; text-align: center; font-weight: 600; color: #3498db; background: #fafcfe;">' + selfProfile.responseTime + '</td>';
    for (var rt = 0; rt < comparisons.length; rt++) {
      html += '<td style="padding: 10px 14px; text-align: center; color: #95a5a6;">N/A</td>';
    }
    html += '</tr>';

    html += '</tbody>';
    html += '</table>';
    html += '</div>';

    // ── Rate History Trend Chart ──
    html += '<div style="background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e9ecef; margin-bottom: 24px;">';
    html += '<h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c3e50;">Rate History Trends</h3>';

    // SVG chart area
    var chartWidth = 700;
    var chartHeight = 220;
    var chartPadding = 50;
    var chartColors = ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6'];

    html += '<div style="text-align: center; overflow-x: auto;">';
    html += '<svg width="' + chartWidth + '" height="' + (chartHeight + 60) + '" viewBox="0 0 ' + chartWidth + ' ' + (chartHeight + 60) + '" style="max-width: 100%;">';

    // Y-axis labels
    var maxRate = 120;
    var minRate = 40;
    var rateStep = 20;
    for (var yl = minRate; yl <= maxRate; yl += rateStep) {
      var yPos = chartHeight - ((yl - minRate) / (maxRate - minRate)) * (chartHeight - chartPadding);
      html += '<text x="38" y="' + (yPos + 4) + '" font-size="11" fill="#95a5a6" text-anchor="end">$' + yl + '</text>';
      html += '<line x1="' + chartPadding + '" y1="' + yPos + '" x2="' + (chartWidth - 20) + '" y2="' + yPos + '" stroke="#f0f0f0" stroke-width="1"/>';
    }

    // Your rate line (constant)
    var selfY = chartHeight - ((selfProfile.hourlyRate - minRate) / (maxRate - minRate)) * (chartHeight - chartPadding);
    html += '<line x1="' + chartPadding + '" y1="' + selfY + '" x2="' + (chartWidth - 20) + '" y2="' + selfY + '" stroke="#3498db" stroke-width="2" stroke-dasharray="6,4"/>';
    html += '<text x="' + (chartWidth - 16) + '" y="' + (selfY - 6) + '" font-size="10" fill="#3498db" text-anchor="end">You ($' + selfProfile.hourlyRate + ')</text>';

    // Draw competitor rate histories
    for (var ci = 0; ci < competitors.length; ci++) {
      var c = competitors[ci];
      var color = chartColors[ci % chartColors.length];
      var rateChanges = [];

      // Build rate history points from changeHistory
      for (var ch = 0; ch < c.changeHistory.length; ch++) {
        if (c.changeHistory[ch].type === 'rate_change') {
          rateChanges.push({ date: c.changeHistory[ch].date, rate: c.changeHistory[ch].from });
          rateChanges.push({ date: c.changeHistory[ch].date, rate: c.changeHistory[ch].to });
        }
      }

      // Add current rate as final point
      if (rateChanges.length === 0) {
        rateChanges.push({ date: c.memberSince, rate: c.hourlyRate });
      }
      rateChanges.push({ date: c.lastActive, rate: c.hourlyRate });

      rateChanges.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });

      // Map to chart coordinates
      var dateRange = new Date('2026-03-24') - new Date('2025-07-01');
      var points = [];
      for (var pt = 0; pt < rateChanges.length; pt++) {
        var xFrac = (new Date(rateChanges[pt].date) - new Date('2025-07-01')) / dateRange;
        var px = chartPadding + xFrac * (chartWidth - chartPadding - 20);
        var py = chartHeight - ((rateChanges[pt].rate - minRate) / (maxRate - minRate)) * (chartHeight - chartPadding);
        if (px >= chartPadding && px <= chartWidth - 20) {
          points.push(Math.round(px) + ',' + Math.round(py));
        }
      }

      if (points.length > 1) {
        html += '<polyline points="' + points.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      }

      // Dot for current rate
      if (points.length > 0) {
        var lastPoint = points[points.length - 1].split(',');
        html += '<circle cx="' + lastPoint[0] + '" cy="' + lastPoint[1] + '" r="4" fill="' + color + '"/>';
      }
    }

    // X-axis month labels
    var months = ['Jul \'25', 'Sep \'25', 'Nov \'25', 'Jan \'26', 'Mar \'26'];
    for (var ml = 0; ml < months.length; ml++) {
      var mx = chartPadding + (ml / (months.length - 1)) * (chartWidth - chartPadding - 20);
      html += '<text x="' + mx + '" y="' + (chartHeight + 20) + '" font-size="11" fill="#95a5a6" text-anchor="middle">' + months[ml] + '</text>';
    }

    html += '</svg>';
    html += '</div>';

    // Legend
    html += '<div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin-top: 12px;">';
    html += '<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #3498db;"><span style="width: 20px; height: 2px; background: #3498db; display: inline-block; border-top: 2px dashed #3498db;"></span>You</span>';
    for (var lg = 0; lg < competitors.length; lg++) {
      html += '<span style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ' + chartColors[lg % chartColors.length] + ';"><span style="width: 12px; height: 12px; background: ' + chartColors[lg % chartColors.length] + '; display: inline-block; border-radius: 50%;"></span>' + competitors[lg].name + '</span>';
    }
    html += '</div>';

    html += '</div>';

    // ── Add Competitor Form ──
    html += '<div style="background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid #e9ecef;">';
    html += '<h3 style="margin: 0 0 16px 0; font-size: 16px; color: #2c3e50;">Add / Remove Competitors</h3>';

    if (competitors.length >= MAX_COMPETITORS) {
      html += '<div style="padding: 14px; background: #fef9e7; border: 1px solid #f9e79f; border-radius: 8px; margin-bottom: 16px;">';
      html += '<p style="margin: 0; font-size: 13px; color: #d68910;"><strong>Maximum reached.</strong> Remove a competitor above to add a new one.</p>';
      html += '</div>';
    }

    html += '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">';

    html += '<div>';
    html += '<label style="display: block; font-size: 12px; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">Name *</label>';
    html += '<input type="text" placeholder="Competitor name" style="width: 100%; padding: 8px 12px; border: 1px solid #d5dbdb; border-radius: 6px; font-size: 13px; box-sizing: border-box;" data-field="comp-name"/>';
    html += '</div>';

    html += '<div>';
    html += '<label style="display: block; font-size: 12px; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">Title</label>';
    html += '<input type="text" placeholder="e.g. Full-Stack Developer" style="width: 100%; padding: 8px 12px; border: 1px solid #d5dbdb; border-radius: 6px; font-size: 13px; box-sizing: border-box;" data-field="comp-title"/>';
    html += '</div>';

    html += '<div>';
    html += '<label style="display: block; font-size: 12px; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">Hourly Rate ($)</label>';
    html += '<input type="number" placeholder="75" style="width: 100%; padding: 8px 12px; border: 1px solid #d5dbdb; border-radius: 6px; font-size: 13px; box-sizing: border-box;" data-field="comp-rate"/>';
    html += '</div>';

    html += '<div>';
    html += '<label style="display: block; font-size: 12px; font-weight: 600; color: #2c3e50; margin-bottom: 4px;">Skills (comma-separated)</label>';
    html += '<input type="text" placeholder="React, Node.js, AWS" style="width: 100%; padding: 8px 12px; border: 1px solid #d5dbdb; border-radius: 6px; font-size: 13px; box-sizing: border-box;" data-field="comp-skills"/>';
    html += '</div>';

    html += '</div>';

    html += '<div style="display: flex; gap: 8px;">';
    html += '<button style="padding: 8px 20px; background: #27ae60; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;" data-action="submit-competitor">Add Competitor</button>';
    html += '<button style="padding: 8px 20px; background: #ecf0f1; color: #2c3e50; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;" data-action="reset-defaults">Reset to Defaults</button>';
    html += '</div>';

    html += '</div>';

    // Close container
    html += '</div>';

    return html;
  }

  // ─── Public API ─────────────────────────────────────────────────────

  window.CortexFreelancer.competitorProfileTracker = {
    init: init,
    render: render,
    addCompetitor: addCompetitor,
    removeCompetitor: removeCompetitor,
    getAlerts: getAlerts,
    compareWithSelf: compareWithSelf,
    getChangeHistory: getChangeHistory
  };

})();
