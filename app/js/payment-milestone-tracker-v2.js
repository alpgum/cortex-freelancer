/**
 * [CF-059] Payment Milestone Tracker V2
 * Track payment milestones per active contract: funded, submitted, approved, released.
 * Exposed on window.CortexFreelancer.paymentMilestoneTrackerV2
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cortex_payment_milestones_v2';

  /** @type {string[]} */
  var VALID_STATUSES = ['pending', 'funded', 'submitted', 'approved', 'released', 'disputed'];

  var STATUS_COLORS = {
    pending:   { bg: '#e5e7eb', text: '#4b5563', label: 'Pending' },
    funded:    { bg: '#dbeafe', text: '#1d4ed8', label: 'Funded' },
    submitted: { bg: '#ffedd5', text: '#c2410c', label: 'Submitted' },
    approved:  { bg: '#dcfce7', text: '#15803d', label: 'Approved' },
    released:  { bg: '#f3e8ff', text: '#7e22ce', label: 'Released' },
    disputed:  { bg: '#fee2e2', text: '#dc2626', label: 'Disputed' }
  };

  var PIPELINE_ORDER = ['pending', 'funded', 'submitted', 'approved', 'released'];

  // ---------------------------------------------------------------------------
  // Mock data
  // ---------------------------------------------------------------------------

  function generateMockData() {
    var now = new Date();
    return [
      {
        id: 'CTR-2401',
        client: 'Nexora Digital',
        title: 'E-Commerce Platform Redesign',
        totalAmount: 18500,
        milestones: [
          { id: 'M-2401-1', title: 'Discovery & Wireframes', amount: 3000, dueDate: '2026-02-15', status: 'released' },
          { id: 'M-2401-2', title: 'UI Design System', amount: 4500, dueDate: '2026-03-01', status: 'approved' },
          { id: 'M-2401-3', title: 'Frontend Implementation', amount: 5500, dueDate: '2026-03-20', status: 'submitted' },
          { id: 'M-2401-4', title: 'Backend Integration', amount: 3500, dueDate: '2026-04-10', status: 'funded' },
          { id: 'M-2401-5', title: 'QA & Launch', amount: 2000, dueDate: '2026-04-30', status: 'pending' }
        ],
        createdAt: '2026-01-10T09:00:00Z',
        updatedAt: '2026-03-18T14:22:00Z'
      },
      {
        id: 'CTR-2402',
        client: 'BrightPath Analytics',
        title: 'Data Dashboard MVP',
        totalAmount: 12000,
        milestones: [
          { id: 'M-2402-1', title: 'Requirements & Architecture', amount: 2000, dueDate: '2026-02-20', status: 'released' },
          { id: 'M-2402-2', title: 'Core Dashboard Components', amount: 4000, dueDate: '2026-03-10', status: 'released' },
          { id: 'M-2402-3', title: 'Data Pipeline Integration', amount: 3500, dueDate: '2026-03-25', status: 'approved' },
          { id: 'M-2402-4', title: 'Reporting & Export', amount: 2500, dueDate: '2026-04-15', status: 'funded' }
        ],
        createdAt: '2026-02-01T11:30:00Z',
        updatedAt: '2026-03-20T09:45:00Z'
      },
      {
        id: 'CTR-2403',
        client: 'Verdant Health',
        title: 'Patient Portal Mobile App',
        totalAmount: 24000,
        milestones: [
          { id: 'M-2403-1', title: 'UX Research & Prototyping', amount: 4000, dueDate: '2026-02-28', status: 'released' },
          { id: 'M-2403-2', title: 'Authentication & Profile', amount: 5000, dueDate: '2026-03-15', status: 'disputed' },
          { id: 'M-2403-3', title: 'Appointment Booking Flow', amount: 6000, dueDate: '2026-04-01', status: 'funded' },
          { id: 'M-2403-4', title: 'Messaging & Notifications', amount: 5000, dueDate: '2026-04-20', status: 'pending' },
          { id: 'M-2403-5', title: 'Testing & App Store Release', amount: 4000, dueDate: '2026-05-10', status: 'pending' }
        ],
        createdAt: '2026-01-25T08:15:00Z',
        updatedAt: '2026-03-16T17:00:00Z'
      },
      {
        id: 'CTR-2404',
        client: 'Quantum Retail',
        title: 'Inventory Management System',
        totalAmount: 15000,
        milestones: [
          { id: 'M-2404-1', title: 'Database Schema & API Design', amount: 3000, dueDate: '2026-03-05', status: 'released' },
          { id: 'M-2404-2', title: 'CRUD Operations & Search', amount: 4000, dueDate: '2026-03-22', status: 'submitted' },
          { id: 'M-2404-3', title: 'Barcode Scanner Integration', amount: 4500, dueDate: '2026-04-08', status: 'funded' },
          { id: 'M-2404-4', title: 'Reports & Analytics Module', amount: 3500, dueDate: '2026-04-25', status: 'pending' }
        ],
        createdAt: '2026-02-12T10:00:00Z',
        updatedAt: '2026-03-19T11:30:00Z'
      },
      {
        id: 'CTR-2405',
        client: 'Elevate Learning Co.',
        title: 'LMS Course Builder',
        totalAmount: 20000,
        milestones: [
          { id: 'M-2405-1', title: 'Course Structure & Editor', amount: 5000, dueDate: '2026-03-01', status: 'released' },
          { id: 'M-2405-2', title: 'Video & Media Hosting', amount: 5000, dueDate: '2026-03-18', status: 'approved' },
          { id: 'M-2405-3', title: 'Quiz & Assessment Engine', amount: 4000, dueDate: '2026-04-05', status: 'submitted' },
          { id: 'M-2405-4', title: 'Student Progress Tracking', amount: 3500, dueDate: '2026-04-22', status: 'funded' },
          { id: 'M-2405-5', title: 'Certification & Badges', amount: 2500, dueDate: '2026-05-05', status: 'pending' }
        ],
        createdAt: '2026-02-05T13:00:00Z',
        updatedAt: '2026-03-21T08:10:00Z'
      },
      {
        id: 'CTR-2406',
        client: 'SilverLine Finance',
        title: 'Client Onboarding Workflow',
        totalAmount: 9500,
        milestones: [
          { id: 'M-2406-1', title: 'KYC Form Builder', amount: 2500, dueDate: '2026-03-10', status: 'released' },
          { id: 'M-2406-2', title: 'Document Upload & Verification', amount: 3000, dueDate: '2026-03-28', status: 'approved' },
          { id: 'M-2406-3', title: 'Approval Workflow & Notifications', amount: 4000, dueDate: '2026-04-15', status: 'funded' }
        ],
        createdAt: '2026-02-18T14:45:00Z',
        updatedAt: '2026-03-22T16:20:00Z'
      }
    ];
  }

  // ---------------------------------------------------------------------------
  // Storage helpers
  // ---------------------------------------------------------------------------

  function readContracts() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('[CF-059 V2] Failed to read milestones:', e);
      return [];
    }
  }

  function writeContracts(contracts) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
      return true;
    } catch (e) {
      console.warn('[CF-059 V2] Failed to write milestones:', e);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Core functions
  // ---------------------------------------------------------------------------

  function init() {
    var contracts = readContracts();
    if (contracts.length === 0) {
      contracts = generateMockData();
      writeContracts(contracts);
    }
    return { success: true, contractCount: contracts.length };
  }

  function addContract(contract) {
    if (!contract || !contract.id || !contract.client || !contract.title) {
      return { success: false, contract: null, error: 'Missing required fields: id, client, title' };
    }

    var contracts = readContracts();
    var existing = null;
    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === contract.id) { existing = contracts[i]; break; }
    }
    if (existing) {
      return { success: false, contract: null, error: 'Contract with id "' + contract.id + '" already exists' };
    }

    var milestones = (contract.milestones || []).map(function (m, idx) {
      return {
        id: contract.id + '-M' + (idx + 1),
        title: m.title || 'Untitled Milestone',
        amount: m.amount || 0,
        dueDate: m.dueDate || null,
        status: 'pending'
      };
    });

    var now = new Date().toISOString();
    var newContract = {
      id: contract.id,
      client: contract.client,
      title: contract.title,
      totalAmount: contract.totalAmount || 0,
      milestones: milestones,
      createdAt: now,
      updatedAt: now
    };

    contracts.push(newContract);
    writeContracts(contracts);
    return { success: true, contract: newContract, error: null };
  }

  function updateMilestoneStatus(contractId, milestoneId, newStatus) {
    if (VALID_STATUSES.indexOf(newStatus) === -1) {
      return { success: false, error: 'Invalid status "' + newStatus + '". Valid: ' + VALID_STATUSES.join(', ') };
    }

    var contracts = readContracts();
    var contract = null;
    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === contractId) { contract = contracts[i]; break; }
    }
    if (!contract) {
      return { success: false, error: 'Contract "' + contractId + '" not found' };
    }

    var milestone = null;
    for (var j = 0; j < contract.milestones.length; j++) {
      if (contract.milestones[j].id === milestoneId) { milestone = contract.milestones[j]; break; }
    }
    if (!milestone) {
      return { success: false, error: 'Milestone "' + milestoneId + '" not found in contract "' + contractId + '"' };
    }

    var oldStatus = milestone.status;
    milestone.status = newStatus;
    contract.updatedAt = new Date().toISOString();
    writeContracts(contracts);

    return { success: true, contractId: contractId, milestoneId: milestoneId, oldStatus: oldStatus, newStatus: newStatus };
  }

  function getContractSummary(contractId) {
    var contracts = readContracts();
    var contract = null;
    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === contractId) { contract = contracts[i]; break; }
    }
    if (!contract) {
      return { success: false, error: 'Contract not found', data: null };
    }

    var statusTotals = {};
    for (var s = 0; s < VALID_STATUSES.length; s++) {
      statusTotals[VALID_STATUSES[s]] = { count: 0, amount: 0 };
    }
    for (var m = 0; m < contract.milestones.length; m++) {
      var ms = contract.milestones[m];
      if (statusTotals[ms.status]) {
        statusTotals[ms.status].count++;
        statusTotals[ms.status].amount += ms.amount;
      }
    }

    var completedAmount = statusTotals.released.amount + statusTotals.approved.amount;
    var progressPct = contract.totalAmount > 0 ? Math.round((completedAmount / contract.totalAmount) * 100) : 0;

    return {
      success: true,
      error: null,
      data: {
        id: contract.id,
        client: contract.client,
        title: contract.title,
        totalAmount: contract.totalAmount,
        milestoneCount: contract.milestones.length,
        statusTotals: statusTotals,
        completedAmount: completedAmount,
        progressPct: progressPct
      }
    };
  }

  function getOverview() {
    var contracts = readContracts();
    var totalValue = 0;
    var fundedAmount = 0;
    var releasedAmount = 0;
    var pendingAmount = 0;
    var allMilestones = [];

    for (var i = 0; i < contracts.length; i++) {
      var c = contracts[i];
      totalValue += c.totalAmount;
      for (var j = 0; j < c.milestones.length; j++) {
        var ms = c.milestones[j];
        allMilestones.push({ contractId: c.id, client: c.client, contractTitle: c.title, milestone: ms });
        if (ms.status === 'funded') fundedAmount += ms.amount;
        if (ms.status === 'released') releasedAmount += ms.amount;
        if (ms.status === 'pending') pendingAmount += ms.amount;
      }
    }

    return {
      totalContracts: contracts.length,
      totalMilestones: allMilestones.length,
      totalValue: totalValue,
      fundedAmount: fundedAmount,
      releasedAmount: releasedAmount,
      pendingAmount: pendingAmount,
      contracts: contracts
    };
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  function formatCurrency(amount) {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function renderStatusBadge(status) {
    var sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return '<span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;' +
      'background:' + sc.bg + ';color:' + sc.text + ';letter-spacing:0.3px;">' +
      sc.label + '</span>';
  }

  function renderOverviewCards(overview) {
    var cards = [
      { label: 'Active Contracts', value: overview.totalContracts, color: '#3b82f6', icon: '&#128196;' },
      { label: 'Total Value',      value: formatCurrency(overview.totalValue), color: '#6366f1', icon: '&#128176;' },
      { label: 'Funded',           value: formatCurrency(overview.fundedAmount), color: '#1d4ed8', icon: '&#9989;' },
      { label: 'Released',         value: formatCurrency(overview.releasedAmount), color: '#7e22ce', icon: '&#127881;' },
      { label: 'Pending',          value: formatCurrency(overview.pendingAmount), color: '#6b7280', icon: '&#9203;' }
    ];

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:28px;">';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div style="background:#fff;border-radius:12px;padding:20px 18px;box-shadow:0 1px 4px rgba(0,0,0,0.06);border-left:4px solid ' + c.color + ';">';
      html += '<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">' + c.icon + ' ' + c.label + '</div>';
      html += '<div style="font-size:24px;font-weight:700;color:#111827;">' + c.value + '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderPipeline(overview) {
    var contracts = overview.contracts;
    var stageCounts = {};
    for (var s = 0; s < PIPELINE_ORDER.length; s++) {
      stageCounts[PIPELINE_ORDER[s]] = 0;
    }
    for (var i = 0; i < contracts.length; i++) {
      for (var j = 0; j < contracts[i].milestones.length; j++) {
        var st = contracts[i].milestones[j].status;
        if (stageCounts.hasOwnProperty(st)) {
          stageCounts[st]++;
        }
      }
    }

    var html = '<div style="background:#fff;border-radius:12px;padding:22px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:28px;">';
    html += '<h3 style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#111827;">Milestone Pipeline</h3>';
    html += '<div style="display:flex;align-items:center;gap:0;overflow-x:auto;">';

    for (var p = 0; p < PIPELINE_ORDER.length; p++) {
      var stage = PIPELINE_ORDER[p];
      var sc = STATUS_COLORS[stage];
      var count = stageCounts[stage];
      var isLast = p === PIPELINE_ORDER.length - 1;

      html += '<div style="flex:1;text-align:center;padding:14px 10px;background:' + sc.bg + ';' +
        (p === 0 ? 'border-radius:8px 0 0 8px;' : '') +
        (isLast ? 'border-radius:0 8px 8px 0;' : '') +
        'position:relative;">';
      html += '<div style="font-size:22px;font-weight:700;color:' + sc.text + ';">' + count + '</div>';
      html += '<div style="font-size:11px;font-weight:600;color:' + sc.text + ';text-transform:uppercase;letter-spacing:0.4px;margin-top:2px;">' + sc.label + '</div>';
      html += '</div>';

      if (!isLast) {
        html += '<div style="font-size:16px;color:#9ca3af;padding:0 2px;">&#9654;</div>';
      }
    }

    html += '</div></div>';
    return html;
  }

  function renderMilestoneProgressBar(milestones) {
    var total = milestones.length;
    if (total === 0) return '';

    var html = '<div style="display:flex;border-radius:6px;overflow:hidden;height:10px;background:#f3f4f6;">';
    for (var i = 0; i < milestones.length; i++) {
      var sc = STATUS_COLORS[milestones[i].status] || STATUS_COLORS.pending;
      var widthPct = (100 / total).toFixed(2);
      html += '<div style="width:' + widthPct + '%;background:' + sc.text + ';' +
        (i > 0 ? 'border-left:1px solid rgba(255,255,255,0.4);' : '') +
        '" title="' + milestones[i].title + ' (' + milestones[i].status + ')"></div>';
    }
    html += '</div>';
    return html;
  }

  function renderContractCard(contract) {
    var summary = getContractSummary(contract.id);
    var data = summary.data;
    var accordionId = 'cf059-acc-' + contract.id.replace(/[^a-zA-Z0-9]/g, '');

    var html = '<div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:14px;overflow:hidden;">';

    // Header
    html += '<div onclick="(function(){var el=document.getElementById(\'' + accordionId + '\');var arrow=document.getElementById(\'' + accordionId + '-arrow\');' +
      'if(el.style.display===\'none\'){el.style.display=\'block\';arrow.innerHTML=\'&#9660;\';}else{el.style.display=\'none\';arrow.innerHTML=\'&#9654;\';}})()" ' +
      'style="padding:18px 20px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f3f4f6;">';

    html += '<div style="flex:1;">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">';
    html += '<span style="font-size:15px;font-weight:700;color:#111827;">' + contract.title + '</span>';
    html += '<span style="font-size:11px;color:#9ca3af;font-weight:500;">' + contract.id + '</span>';
    html += '</div>';
    html += '<div style="font-size:13px;color:#6b7280;">' + contract.client + ' &middot; ' +
      formatCurrency(contract.totalAmount) + ' &middot; ' +
      contract.milestones.length + ' milestones &middot; ' +
      data.progressPct + '% complete</div>';
    html += '<div style="margin-top:8px;">' + renderMilestoneProgressBar(contract.milestones) + '</div>';
    html += '</div>';

    html += '<span id="' + accordionId + '-arrow" style="font-size:14px;color:#9ca3af;margin-left:12px;">&#9654;</span>';
    html += '</div>';

    // Accordion body (hidden by default)
    html += '<div id="' + accordionId + '" style="display:none;padding:16px 20px;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:2px solid #f3f4f6;">';
    html += '<th style="text-align:left;padding:8px 6px;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Milestone</th>';
    html += '<th style="text-align:right;padding:8px 6px;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Amount</th>';
    html += '<th style="text-align:center;padding:8px 6px;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Due Date</th>';
    html += '<th style="text-align:center;padding:8px 6px;color:#6b7280;font-weight:600;font-size:11px;text-transform:uppercase;">Status</th>';
    html += '</tr></thead><tbody>';

    for (var m = 0; m < contract.milestones.length; m++) {
      var ms = contract.milestones[m];
      var isOverdue = ms.dueDate && ms.status !== 'released' && ms.status !== 'approved' && new Date(ms.dueDate) < new Date();
      var rowBg = m % 2 === 0 ? '#fff' : '#fafbfc';

      html += '<tr style="background:' + rowBg + ';border-bottom:1px solid #f3f4f6;">';
      html += '<td style="padding:10px 6px;color:#111827;font-weight:500;">' + ms.title;
      if (isOverdue) {
        html += ' <span style="font-size:10px;color:#dc2626;font-weight:700;">OVERDUE</span>';
      }
      html += '</td>';
      html += '<td style="padding:10px 6px;text-align:right;color:#111827;font-weight:600;">' + formatCurrency(ms.amount) + '</td>';
      html += '<td style="padding:10px 6px;text-align:center;color:' + (isOverdue ? '#dc2626' : '#6b7280') + ';">' + (ms.dueDate || '—') + '</td>';
      html += '<td style="padding:10px 6px;text-align:center;">' + renderStatusBadge(ms.status) + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table>';

    // Status summary row
    html += '<div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;">';
    for (var sk = 0; sk < VALID_STATUSES.length; sk++) {
      var stKey = VALID_STATUSES[sk];
      var stData = data.statusTotals[stKey];
      if (stData.count > 0) {
        html += '<div style="font-size:12px;color:#6b7280;">' + renderStatusBadge(stKey) +
          ' <span style="margin-left:4px;">' + stData.count + ' (' + formatCurrency(stData.amount) + ')</span></div>';
      }
    }
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  function renderUpcomingDueDates(contracts) {
    var upcoming = [];
    var today = new Date();
    var futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + 30);

    for (var i = 0; i < contracts.length; i++) {
      var c = contracts[i];
      for (var j = 0; j < c.milestones.length; j++) {
        var ms = c.milestones[j];
        if (!ms.dueDate || ms.status === 'released') continue;
        var due = new Date(ms.dueDate);
        if (due <= futureLimit) {
          var daysLeft = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
          upcoming.push({
            contractId: c.id,
            client: c.client,
            contractTitle: c.title,
            milestone: ms,
            dueDate: due,
            daysLeft: daysLeft
          });
        }
      }
    }

    upcoming.sort(function (a, b) { return a.dueDate - b.dueDate; });

    var html = '<div style="background:#fff;border-radius:12px;padding:22px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:28px;">';
    html += '<h3 style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#111827;">Upcoming Due Dates <span style="font-size:12px;color:#9ca3af;font-weight:400;">(next 30 days)</span></h3>';

    if (upcoming.length === 0) {
      html += '<div style="color:#9ca3af;font-size:13px;padding:12px 0;">No upcoming milestones due.</div>';
    } else {
      for (var u = 0; u < upcoming.length; u++) {
        var item = upcoming[u];
        var isOverdue = item.daysLeft < 0;
        var isUrgent = item.daysLeft >= 0 && item.daysLeft <= 7;
        var urgencyColor = isOverdue ? '#dc2626' : (isUrgent ? '#f59e0b' : '#6b7280');
        var daysLabel = isOverdue ? Math.abs(item.daysLeft) + ' day' + (Math.abs(item.daysLeft) !== 1 ? 's' : '') + ' overdue' :
          item.daysLeft === 0 ? 'Due today' :
          item.daysLeft + ' day' + (item.daysLeft !== 1 ? 's' : '') + ' left';

        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;' +
          (u < upcoming.length - 1 ? 'border-bottom:1px solid #f3f4f6;' : '') + '">';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:13px;font-weight:600;color:#111827;">' + item.milestone.title + '</div>';
        html += '<div style="font-size:12px;color:#9ca3af;margin-top:2px;">' + item.client + ' &middot; ' + item.contractTitle + '</div>';
        html += '</div>';
        html += '<div style="text-align:right;margin-left:16px;">';
        html += renderStatusBadge(item.milestone.status);
        html += '<div style="font-size:11px;font-weight:600;color:' + urgencyColor + ';margin-top:4px;">' +
          item.milestone.dueDate + ' &middot; ' + daysLabel + '</div>';
        html += '</div>';
        html += '</div>';
      }
    }

    html += '</div>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  function render() {
    var overview = getOverview();
    var contracts = overview.contracts;

    var html = '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;max-width:960px;margin:0 auto;padding:24px 16px;background:#f9fafb;min-height:100vh;">';

    // Header
    html += '<div style="margin-bottom:24px;">';
    html += '<h2 style="margin:0 0 4px 0;font-size:22px;font-weight:700;color:#111827;">Payment Milestone Tracker</h2>';
    html += '<p style="margin:0;font-size:13px;color:#6b7280;">Track milestone payments across all active contracts</p>';
    html += '</div>';

    // Overview cards
    html += renderOverviewCards(overview);

    // Pipeline visualization
    html += renderPipeline(overview);

    // Upcoming due dates
    html += renderUpcomingDueDates(contracts);

    // Contract cards
    html += '<h3 style="margin:0 0 14px 0;font-size:15px;font-weight:600;color:#111827;">Contracts (' + contracts.length + ')</h3>';
    for (var i = 0; i < contracts.length; i++) {
      html += renderContractCard(contracts[i]);
    }

    html += '</div>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Expose module
  // ---------------------------------------------------------------------------

  window.CortexFreelancer.paymentMilestoneTrackerV2 = {
    init: init,
    render: render,
    addContract: addContract,
    updateMilestoneStatus: updateMilestoneStatus,
    getContractSummary: getContractSummary,
    getOverview: getOverview
  };

})();
