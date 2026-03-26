/* ============================================
   CORTEX FREELANCER — AI Analytics Core
   cf3-020 | analytics-ai-core.js
   Predictive analytics engine: revenue forecasting,
   client lifetime value, churn prediction,
   pricing optimization, productivity analysis
   ============================================ */

;(function(global) {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function formatCurrency(amount, symbol) {
    symbol = symbol || '$';
    return symbol + parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatPercent(val) {
    return (val * 100).toFixed(1) + '%';
  }

  function daysBetween(d1, d2) {
    return Math.abs(d2 - d1) / (1000 * 60 * 60 * 24);
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
  }

  function stdDev(arr) {
    if (arr.length < 2) return 0;
    var m = mean(arr);
    var variance = arr.reduce(function(s, v) { return s + Math.pow(v - m, 2); }, 0) / (arr.length - 1);
    return Math.sqrt(variance);
  }

  function linearRegression(xs, ys) {
    var n = xs.length;
    if (n < 2) return { slope: 0, intercept: mean(ys), r2: 0 };
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += xs[i]; sumY += ys[i];
      sumXY += xs[i] * ys[i];
      sumX2 += xs[i] * xs[i];
      sumY2 += ys[i] * ys[i];
    }
    var denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: mean(ys), r2: 0 };
    var slope = (n * sumXY - sumX * sumY) / denom;
    var intercept = (sumY - slope * sumX) / n;
    var ssTot = sumY2 - (sumY * sumY) / n;
    var ssRes = 0;
    for (var j = 0; j < n; j++) {
      var pred = slope * xs[j] + intercept;
      ssRes += Math.pow(ys[j] - pred, 2);
    }
    var r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { slope: slope, intercept: intercept, r2: Math.max(0, r2) };
  }

  function exponentialSmoothing(data, alpha) {
    alpha = alpha || 0.3;
    if (!data.length) return [];
    var result = [data[0]];
    for (var i = 1; i < data.length; i++) {
      result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  }

  // ── Data Sources ───────────────────────────────────────────
  function getSettings() {
    try {
      var raw = localStorage.getItem('cortex_settings');
      return raw ? JSON.parse(raw) : {};
    } catch(e) { return {}; }
  }

  function getTimeEntries() {
    try {
      if (typeof CortexTimeEngine !== 'undefined' && CortexTimeEngine.getAllEntries) {
        return CortexTimeEngine.getAllEntries();
      }
      var raw = localStorage.getItem('cortex_time_entries');
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function getClients() {
    try {
      var raw = localStorage.getItem('cortex_client_directory');
      if (!raw) return [];
      var data = JSON.parse(raw);
      return data.clients || [];
    } catch(e) { return []; }
  }

  function getProjects() {
    try {
      var raw = localStorage.getItem('cortex_projects');
      if (!raw) return [];
      var data = JSON.parse(raw);
      return data.projects || data || [];
    } catch(e) { return []; }
  }

  function getInvoices() {
    try {
      var raw = localStorage.getItem('cortex_invoices');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch(e) { return []; }
  }

  function getProposals() {
    try {
      var raw = localStorage.getItem('cortex_proposals');
      if (!raw) return [];
      return JSON.parse(raw);
    } catch(e) { return []; }
  }

  // ── Revenue Forecasting Engine ─────────────────────────────
  function getMonthlyRevenue() {
    var invoices = getInvoices();
    var monthly = {};
    invoices.forEach(function(inv) {
      if (!inv.date && !inv.createdAt) return;
      var d = new Date(inv.date || inv.createdAt);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var amount = parseFloat(inv.total || inv.amount || 0);
      if (inv.status === 'paid' || inv.status === 'sent' || !inv.status) {
        monthly[key] = (monthly[key] || 0) + amount;
      }
    });
    // Also check time entries for billable revenue
    var entries = getTimeEntries();
    entries.forEach(function(entry) {
      if (!entry.billable) return;
      var d = new Date(entry.date || entry.startTime);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var hours = parseFloat(entry.hours || entry.duration || 0) / (entry.duration > 100 ? 3600 : 1);
      var rate = parseFloat(entry.rate || entry.hourlyRate || 0);
      if (rate > 0) {
        monthly[key] = (monthly[key] || 0) + hours * rate;
      }
    });
    return monthly;
  }

  function forecastRevenue(months) {
    months = months || 6;
    var monthly = getMonthlyRevenue();
    var keys = Object.keys(monthly).sort();
    if (keys.length < 2) {
      // Generate demo forecast if no data
      return generateDemoForecast(months);
    }
    var values = keys.map(function(k) { return monthly[k]; });
    var xs = keys.map(function(_, i) { return i; });
    var reg = linearRegression(xs, values);
    var smoothed = exponentialSmoothing(values, 0.3);
    var lastSmoothed = smoothed[smoothed.length - 1];
    var sd = stdDev(values);
    var forecast = [];
    var lastDate = new Date(keys[keys.length - 1] + '-01');
    for (var i = 1; i <= months; i++) {
      var nextDate = new Date(lastDate);
      nextDate.setMonth(nextDate.getMonth() + i);
      var monthKey = nextDate.getFullYear() + '-' + String(nextDate.getMonth() + 1).padStart(2, '0');
      var trendVal = reg.slope * (keys.length - 1 + i) + reg.intercept;
      var smoothVal = lastSmoothed + reg.slope * i;
      var predicted = (trendVal + smoothVal) / 2;
      predicted = Math.max(0, predicted);
      var confidence = Math.max(0.5, reg.r2);
      var lowerBound = Math.max(0, predicted - sd * (2 - confidence));
      var upperBound = predicted + sd * (2 - confidence);
      forecast.push({
        month: monthKey,
        predicted: Math.round(predicted),
        lower: Math.round(lowerBound),
        upper: Math.round(upperBound),
        confidence: confidence
      });
    }
    return {
      historical: keys.map(function(k, i) { return { month: k, revenue: monthly[k] }; }),
      forecast: forecast,
      trend: reg.slope > 0 ? 'growing' : reg.slope < 0 ? 'declining' : 'stable',
      trendSlope: reg.slope,
      r2: reg.r2,
      avgMonthly: mean(values),
      insights: generateRevenueInsights(values, reg, forecast)
    };
  }

  function generateDemoForecast(months) {
    var now = new Date();
    var historical = [];
    var baseRevenue = 4500;
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now);
      d.setMonth(d.getMonth() - i);
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      var val = baseRevenue + i * 200 * (Math.random() > 0.3 ? 1 : -0.5) + Math.random() * 1200;
      historical.push({ month: key, revenue: Math.round(val) });
      baseRevenue += 300;
    }
    var forecast = [];
    for (var j = 1; j <= months; j++) {
      var fd = new Date(now);
      fd.setMonth(fd.getMonth() + j);
      var fk = fd.getFullYear() + '-' + String(fd.getMonth() + 1).padStart(2, '0');
      var pred = baseRevenue + j * 350 + Math.random() * 800;
      forecast.push({
        month: fk,
        predicted: Math.round(pred),
        lower: Math.round(pred * 0.75),
        upper: Math.round(pred * 1.25),
        confidence: 0.72
      });
    }
    return {
      historical: historical,
      forecast: forecast,
      trend: 'growing',
      trendSlope: 350,
      r2: 0.72,
      avgMonthly: mean(historical.map(function(h) { return h.revenue; })),
      insights: [
        { type: 'positive', text: 'Revenue trend is upward — projected 15% growth next quarter' },
        { type: 'tip', text: 'Diversify client base to reduce revenue volatility' },
        { type: 'warning', text: 'High dependency on top 2 clients — consider lead generation' }
      ],
      isDemo: true
    };
  }

  function generateRevenueInsights(values, reg, forecast) {
    var insights = [];
    if (reg.slope > 100) {
      insights.push({ type: 'positive', text: 'Revenue trend is upward — projected ' + formatCurrency(reg.slope) + '/month growth' });
    } else if (reg.slope < -100) {
      insights.push({ type: 'warning', text: 'Revenue is declining at ' + formatCurrency(Math.abs(reg.slope)) + '/month — review pipeline' });
    } else {
      insights.push({ type: 'neutral', text: 'Revenue is stable — consider growth strategies' });
    }
    var cv = values.length > 1 ? stdDev(values) / mean(values) : 0;
    if (cv > 0.3) {
      insights.push({ type: 'warning', text: 'High revenue volatility (' + (cv * 100).toFixed(0) + '% CV) — diversify income streams' });
    }
    if (forecast.length > 0 && forecast[0].confidence < 0.6) {
      insights.push({ type: 'tip', text: 'Low forecast confidence — more historical data will improve accuracy' });
    }
    return insights;
  }

  // ── Client Lifetime Value (CLV) ────────────────────────────
  function calculateCLV() {
    var clients = getClients();
    var invoices = getInvoices();
    var entries = getTimeEntries();
    var projects = getProjects();

    if (!clients.length) return generateDemoCLV();

    var clientMetrics = clients.map(function(client) {
      var clientInvoices = invoices.filter(function(inv) {
        return (inv.clientId === client.id) || (inv.clientName && inv.clientName === client.name);
      });
      var clientEntries = entries.filter(function(e) {
        return (e.clientId === client.id) || (e.client === client.name);
      });
      var totalRevenue = clientInvoices.reduce(function(s, inv) {
        return s + parseFloat(inv.total || inv.amount || 0);
      }, 0);
      var totalHours = clientEntries.reduce(function(s, e) {
        var h = parseFloat(e.hours || e.duration || 0);
        return s + (h > 100 ? h / 3600 : h);
      }, 0);
      var dates = clientInvoices.map(function(inv) { return new Date(inv.date || inv.createdAt).getTime(); }).filter(function(t) { return !isNaN(t); });
      var firstContact = dates.length ? Math.min.apply(null, dates) : Date.now();
      var lastContact = dates.length ? Math.max.apply(null, dates) : Date.now();
      var tenureDays = Math.max(1, daysBetween(firstContact, Date.now()));
      var tenureMonths = tenureDays / 30;
      var monthlyRevenue = tenureMonths > 0 ? totalRevenue / tenureMonths : 0;
      var avgProjectSize = clientInvoices.length > 0 ? totalRevenue / clientInvoices.length : 0;
      var effectiveRate = totalHours > 0 ? totalRevenue / totalHours : parseFloat(client.hourlyRate || 0);
      // Churn probability (simple model)
      var daysSinceLastContact = daysBetween(lastContact, Date.now());
      var churnProbability = Math.min(0.95, daysSinceLastContact / 180);
      // CLV = (monthly revenue × expected remaining months) × retention probability
      var expectedLifetime = Math.max(3, 24 - tenureMonths);
      var retentionRate = 1 - churnProbability;
      var clv = monthlyRevenue * expectedLifetime * retentionRate;
      // Score 0-100
      var score = Math.min(100, Math.round(
        (monthlyRevenue / 1000) * 25 +
        (retentionRate) * 25 +
        (effectiveRate / 50) * 25 +
        Math.min(25, tenureMonths * 2)
      ));

      return {
        id: client.id,
        name: client.name || client.company || 'Unknown',
        company: client.company || '',
        totalRevenue: totalRevenue,
        totalHours: totalHours,
        projectCount: clientInvoices.length,
        monthlyRevenue: monthlyRevenue,
        avgProjectSize: avgProjectSize,
        effectiveRate: effectiveRate,
        tenureMonths: tenureMonths,
        churnProbability: churnProbability,
        retentionRate: retentionRate,
        clv: clv,
        score: score,
        status: client.status || 'active',
        daysSinceLastContact: Math.round(daysSinceLastContact),
        risk: churnProbability > 0.6 ? 'high' : churnProbability > 0.3 ? 'medium' : 'low'
      };
    });

    clientMetrics.sort(function(a, b) { return b.clv - a.clv; });
    var totalCLV = clientMetrics.reduce(function(s, c) { return s + c.clv; }, 0);
    var avgCLV = clientMetrics.length > 0 ? totalCLV / clientMetrics.length : 0;
    var atRisk = clientMetrics.filter(function(c) { return c.risk === 'high'; });

    return {
      clients: clientMetrics,
      totalCLV: totalCLV,
      avgCLV: avgCLV,
      atRiskClients: atRisk,
      insights: generateCLVInsights(clientMetrics, atRisk)
    };
  }

  function generateDemoCLV() {
    var demoClients = [
      { id: 'd1', name: 'Acme Corp', company: 'Acme', totalRevenue: 18500, totalHours: 210, projectCount: 4, monthlyRevenue: 2642, avgProjectSize: 4625, effectiveRate: 88, tenureMonths: 7, churnProbability: 0.12, retentionRate: 0.88, clv: 39523, score: 85, status: 'active', daysSinceLastContact: 5, risk: 'low' },
      { id: 'd2', name: 'TechStart Inc', company: 'TechStart', totalRevenue: 12200, totalHours: 155, projectCount: 3, monthlyRevenue: 2033, avgProjectSize: 4067, effectiveRate: 79, tenureMonths: 6, churnProbability: 0.22, retentionRate: 0.78, clv: 28543, score: 72, status: 'active', daysSinceLastContact: 12, risk: 'low' },
      { id: 'd3', name: 'DesignFlow', company: 'DesignFlow Studio', totalRevenue: 8900, totalHours: 95, projectCount: 2, monthlyRevenue: 1780, avgProjectSize: 4450, effectiveRate: 94, tenureMonths: 5, churnProbability: 0.35, retentionRate: 0.65, clv: 21971, score: 68, status: 'active', daysSinceLastContact: 28, risk: 'medium' },
      { id: 'd4', name: 'CloudNine', company: 'CloudNine SaaS', totalRevenue: 6400, totalHours: 78, projectCount: 2, monthlyRevenue: 1600, avgProjectSize: 3200, effectiveRate: 82, tenureMonths: 4, churnProbability: 0.15, retentionRate: 0.85, clv: 27200, score: 65, status: 'active', daysSinceLastContact: 8, risk: 'low' },
      { id: 'd5', name: 'RetailMax', company: 'RetailMax Ltd', totalRevenue: 3200, totalHours: 45, projectCount: 1, monthlyRevenue: 1067, avgProjectSize: 3200, effectiveRate: 71, tenureMonths: 3, churnProbability: 0.65, retentionRate: 0.35, clv: 7844, score: 42, status: 'active', daysSinceLastContact: 52, risk: 'high' },
      { id: 'd6', name: 'EduLearn', company: 'EduLearn Platform', totalRevenue: 2100, totalHours: 32, projectCount: 1, monthlyRevenue: 700, avgProjectSize: 2100, effectiveRate: 66, tenureMonths: 3, churnProbability: 0.72, retentionRate: 0.28, clv: 4116, score: 35, status: 'prospect', daysSinceLastContact: 68, risk: 'high' }
    ];
    return {
      clients: demoClients,
      totalCLV: demoClients.reduce(function(s, c) { return s + c.clv; }, 0),
      avgCLV: mean(demoClients.map(function(c) { return c.clv; })),
      atRiskClients: demoClients.filter(function(c) { return c.risk === 'high'; }),
      insights: [
        { type: 'positive', text: 'Top client (Acme Corp) has strong retention — nurture this relationship' },
        { type: 'warning', text: '2 clients at high churn risk — schedule check-in calls this week' },
        { type: 'tip', text: 'Increasing effective rate by $10/hr would add ~$12K annual CLV' }
      ],
      isDemo: true
    };
  }

  function generateCLVInsights(clients, atRisk) {
    var insights = [];
    if (clients.length > 0) {
      var top = clients[0];
      insights.push({ type: 'positive', text: 'Top client (' + top.name + ') generates ' + formatCurrency(top.monthlyRevenue) + '/mo — protect this relationship' });
    }
    if (atRisk.length > 0) {
      insights.push({ type: 'warning', text: atRisk.length + ' client' + (atRisk.length > 1 ? 's' : '') + ' at high churn risk — immediate outreach recommended' });
    }
    var rates = clients.map(function(c) { return c.effectiveRate; }).filter(function(r) { return r > 0; });
    if (rates.length > 1) {
      var minRate = Math.min.apply(null, rates);
      var maxRate = Math.max.apply(null, rates);
      if (maxRate - minRate > 20) {
        insights.push({ type: 'tip', text: 'Rate range: ' + formatCurrency(minRate) + '-' + formatCurrency(maxRate) + '/hr — standardize pricing upward' });
      }
    }
    return insights;
  }

  // ── Productivity Analytics ─────────────────────────────────
  function analyzeProductivity() {
    var entries = getTimeEntries();
    if (!entries.length) return generateDemoProductivity();

    var hourlyDist = new Array(24).fill(0);
    var dayDist = new Array(7).fill(0);
    var dailyHours = {};
    var projectEfficiency = {};

    entries.forEach(function(entry) {
      var d = new Date(entry.startTime || entry.date);
      if (isNaN(d.getTime())) return;
      var hour = d.getHours();
      var day = d.getDay();
      var dateKey = d.toISOString().split('T')[0];
      var hours = parseFloat(entry.hours || entry.duration || 0);
      if (hours > 100) hours = hours / 3600;

      hourlyDist[hour] += hours;
      dayDist[day] += hours;
      dailyHours[dateKey] = (dailyHours[dateKey] || 0) + hours;

      var project = entry.project || entry.projectName || 'Uncategorized';
      if (!projectEfficiency[project]) {
        projectEfficiency[project] = { hours: 0, billable: 0, revenue: 0 };
      }
      projectEfficiency[project].hours += hours;
      if (entry.billable) projectEfficiency[project].billable += hours;
      var rate = parseFloat(entry.rate || entry.hourlyRate || 0);
      if (rate > 0 && entry.billable) projectEfficiency[project].revenue += hours * rate;
    });

    // Find peak hours
    var peakHour = hourlyDist.indexOf(Math.max.apply(null, hourlyDist));
    var peakDay = dayDist.indexOf(Math.max.apply(null, dayDist));
    var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Daily averages
    var dailyValues = Object.values(dailyHours);
    var avgDaily = mean(dailyValues);
    var maxDaily = dailyValues.length ? Math.max.apply(null, dailyValues) : 0;

    // Billable ratio
    var totalHours = entries.reduce(function(s, e) {
      var h = parseFloat(e.hours || e.duration || 0);
      return s + (h > 100 ? h / 3600 : h);
    }, 0);
    var billableHours = entries.filter(function(e) { return e.billable; }).reduce(function(s, e) {
      var h = parseFloat(e.hours || e.duration || 0);
      return s + (h > 100 ? h / 3600 : h);
    }, 0);
    var billableRatio = totalHours > 0 ? billableHours / totalHours : 0;

    // Project efficiency rankings
    var projectRankings = Object.keys(projectEfficiency).map(function(name) {
      var p = projectEfficiency[name];
      return {
        name: name,
        hours: p.hours,
        billable: p.billable,
        revenue: p.revenue,
        effectiveRate: p.billable > 0 ? p.revenue / p.billable : 0,
        efficiency: p.hours > 0 ? p.billable / p.hours : 0
      };
    }).sort(function(a, b) { return b.effectiveRate - a.effectiveRate; });

    return {
      hourlyDistribution: hourlyDist,
      dailyDistribution: dayDist,
      peakHour: peakHour,
      peakDay: dayNames[peakDay],
      avgDailyHours: avgDaily,
      maxDailyHours: maxDaily,
      billableRatio: billableRatio,
      totalHours: totalHours,
      billableHours: billableHours,
      projectRankings: projectRankings,
      insights: generateProductivityInsights(peakHour, dayNames[peakDay], avgDaily, billableRatio, projectRankings)
    };
  }

  function generateDemoProductivity() {
    var hourlyDist = [0,0,0,0,0,0,0,0.5,2.1,4.8,5.2,4.5,2.1,3.8,4.2,3.9,2.8,1.5,0.8,0.3,0.1,0,0,0];
    var dayDist = [1.2, 7.8, 8.5, 7.2, 8.1, 6.5, 2.3];
    return {
      hourlyDistribution: hourlyDist,
      dailyDistribution: dayDist,
      peakHour: 10,
      peakDay: 'Tuesday',
      avgDailyHours: 5.8,
      maxDailyHours: 9.2,
      billableRatio: 0.73,
      totalHours: 186,
      billableHours: 136,
      projectRankings: [
        { name: 'Web App Redesign', hours: 62, billable: 58, revenue: 5220, effectiveRate: 90, efficiency: 0.94 },
        { name: 'API Integration', hours: 45, billable: 40, revenue: 3400, effectiveRate: 85, efficiency: 0.89 },
        { name: 'Brand Identity', hours: 38, billable: 28, revenue: 2240, effectiveRate: 80, efficiency: 0.74 },
        { name: 'Admin / Internal', hours: 41, billable: 10, revenue: 700, effectiveRate: 70, efficiency: 0.24 }
      ],
      insights: [
        { type: 'positive', text: 'Peak productivity at 10:00 AM — schedule deep work then' },
        { type: 'tip', text: 'Tuesday is your most productive day — front-load complex tasks' },
        { type: 'warning', text: 'Billable ratio at 73% — target 80%+ by reducing admin overhead' },
        { type: 'tip', text: 'Brand Identity project has low efficiency (74%) — review scope' }
      ],
      isDemo: true
    };
  }

  function generateProductivityInsights(peakHour, peakDay, avgDaily, billableRatio, projects) {
    var insights = [];
    var hourStr = peakHour > 12 ? (peakHour - 12) + ':00 PM' : peakHour + ':00 AM';
    insights.push({ type: 'positive', text: 'Peak productivity at ' + hourStr + ' — schedule deep work sessions then' });
    insights.push({ type: 'tip', text: peakDay + ' is your most productive day — front-load complex tasks' });
    if (billableRatio < 0.7) {
      insights.push({ type: 'warning', text: 'Billable ratio at ' + formatPercent(billableRatio) + ' — target 80%+ by automating admin tasks' });
    } else if (billableRatio > 0.85) {
      insights.push({ type: 'positive', text: 'Excellent billable ratio (' + formatPercent(billableRatio) + ') — sustainable and efficient' });
    }
    if (projects.length > 1) {
      var lowest = projects[projects.length - 1];
      if (lowest.efficiency < 0.6) {
        insights.push({ type: 'warning', text: lowest.name + ' has low efficiency (' + formatPercent(lowest.efficiency) + ') — review scope creep' });
      }
    }
    return insights;
  }

  // ── Pricing Optimization ───────────────────────────────────
  function analyzePricing() {
    var clients = getClients();
    var projects = getProjects();
    var entries = getTimeEntries();
    var settings = getSettings();
    var currentRate = parseFloat(settings.hourlyRate || settings.rate || 0);

    if (!clients.length && !entries.length) return generateDemoPricing(currentRate);

    var rates = [];
    entries.forEach(function(e) {
      var r = parseFloat(e.rate || e.hourlyRate || 0);
      if (r > 0) rates.push(r);
    });
    clients.forEach(function(c) {
      var r = parseFloat(c.hourlyRate || 0);
      if (r > 0) rates.push(r);
    });

    var avgRate = rates.length > 0 ? mean(rates) : currentRate || 75;
    var minRate = rates.length > 0 ? Math.min.apply(null, rates) : avgRate * 0.7;
    var maxRate = rates.length > 0 ? Math.max.apply(null, rates) : avgRate * 1.3;

    // Utilization rate
    var productivity = analyzeProductivity();
    var utilizationRate = productivity.billableRatio || 0.75;

    // Optimal rate calculation
    var targetMonthly = 8000; // Can be personalized
    var availableHours = 160 * utilizationRate;
    var optimalRate = availableHours > 0 ? targetMonthly / availableHours : avgRate * 1.15;

    return {
      currentRate: currentRate || avgRate,
      avgRate: avgRate,
      minRate: minRate,
      maxRate: maxRate,
      optimalRate: Math.round(optimalRate),
      utilizationRate: utilizationRate,
      rateImpact: calculateRateImpact(avgRate, utilizationRate),
      insights: [
        { type: avgRate < optimalRate ? 'warning' : 'positive', text: 'Current avg rate (' + formatCurrency(avgRate) + '/hr) is ' + (avgRate < optimalRate ? 'below' : 'at or above') + ' optimal (' + formatCurrency(optimalRate) + '/hr)' },
        { type: 'tip', text: 'A $10/hr increase would add ~' + formatCurrency(10 * 160 * utilizationRate) + '/month at current utilization' },
        { type: 'tip', text: 'Value-based pricing on high-impact projects could yield 2-3x hourly equivalent' }
      ]
    };
  }

  function generateDemoPricing(currentRate) {
    var rate = currentRate || 85;
    return {
      currentRate: rate,
      avgRate: rate,
      minRate: rate * 0.8,
      maxRate: rate * 1.4,
      optimalRate: Math.round(rate * 1.18),
      utilizationRate: 0.73,
      rateImpact: calculateRateImpact(rate, 0.73),
      insights: [
        { type: 'warning', text: 'Current rate (' + formatCurrency(rate) + '/hr) has room for ~18% increase based on market positioning' },
        { type: 'tip', text: 'A $10/hr increase would add ~' + formatCurrency(Math.round(10 * 160 * 0.73)) + '/month at current utilization' },
        { type: 'tip', text: 'Value-based pricing on high-impact projects could yield 2-3x hourly equivalent' }
      ],
      isDemo: true
    };
  }

  function calculateRateImpact(baseRate, utilization) {
    var scenarios = [];
    var increases = [5, 10, 15, 25];
    increases.forEach(function(inc) {
      var newRate = baseRate + inc;
      var monthlyGain = inc * 160 * utilization;
      var annualGain = monthlyGain * 12;
      scenarios.push({
        increase: inc,
        newRate: newRate,
        monthlyGain: Math.round(monthlyGain),
        annualGain: Math.round(annualGain)
      });
    });
    return scenarios;
  }

  // ── Market Opportunity Analysis ────────────────────────────
  function identifyOpportunities() {
    var revenue = forecastRevenue(3);
    var clv = calculateCLV();
    var productivity = analyzeProductivity();
    var pricing = analyzePricing();

    var opportunities = [];

    // Rate optimization opportunity
    if (pricing.avgRate < pricing.optimalRate) {
      var gap = pricing.optimalRate - pricing.avgRate;
      opportunities.push({
        title: 'Rate Increase',
        impact: 'high',
        effort: 'low',
        potentialRevenue: Math.round(gap * 160 * pricing.utilizationRate * 12),
        description: 'Increase average rate by ' + formatCurrency(gap) + '/hr to match optimal pricing',
        icon: '💰'
      });
    }

    // Client retention opportunity
    if (clv.atRiskClients && clv.atRiskClients.length > 0) {
      var atRiskRevenue = clv.atRiskClients.reduce(function(s, c) { return s + c.clv; }, 0);
      opportunities.push({
        title: 'Client Retention',
        impact: 'high',
        effort: 'medium',
        potentialRevenue: Math.round(atRiskRevenue),
        description: 'Retain ' + clv.atRiskClients.length + ' at-risk clients worth ' + formatCurrency(atRiskRevenue) + ' in CLV',
        icon: '🤝'
      });
    }

    // Billable ratio improvement
    if (productivity.billableRatio < 0.8) {
      var currentBillable = productivity.billableHours || 120;
      var targetBillable = productivity.totalHours * 0.8;
      var additionalHours = targetBillable - currentBillable;
      opportunities.push({
        title: 'Efficiency Boost',
        impact: 'medium',
        effort: 'medium',
        potentialRevenue: Math.round(additionalHours * pricing.avgRate * 12),
        description: 'Increase billable ratio to 80% — adds ' + additionalHours.toFixed(0) + ' billable hours/month',
        icon: '⚡'
      });
    }

    // Upsell existing clients
    if (clv.clients && clv.clients.length > 2) {
      var topClients = clv.clients.slice(0, 3);
      var upsellPotential = topClients.reduce(function(s, c) { return s + c.monthlyRevenue * 0.3; }, 0) * 12;
      opportunities.push({
        title: 'Client Upselling',
        impact: 'medium',
        effort: 'low',
        potentialRevenue: Math.round(upsellPotential),
        description: 'Cross-sell services to top 3 clients for 30% revenue uplift',
        icon: '📈'
      });
    }

    opportunities.sort(function(a, b) {
      var impactOrder = { high: 3, medium: 2, low: 1 };
      var effortOrder = { low: 3, medium: 2, high: 1 };
      return (impactOrder[b.impact] * effortOrder[b.effort]) - (impactOrder[a.impact] * effortOrder[a.effort]);
    });

    return opportunities;
  }

  // ── Overall Health Score ───────────────────────────────────
  function calculateHealthScore() {
    var revenue = forecastRevenue(3);
    var clv = calculateCLV();
    var productivity = analyzeProductivity();
    var pricing = analyzePricing();

    var scores = {
      revenue: 0,
      clients: 0,
      productivity: 0,
      pricing: 0
    };

    // Revenue score (0-25)
    if (revenue.trend === 'growing') scores.revenue = 22;
    else if (revenue.trend === 'stable') scores.revenue = 15;
    else scores.revenue = 8;
    if (revenue.r2 > 0.7) scores.revenue = Math.min(25, scores.revenue + 3);

    // Client score (0-25)
    var clientCount = clv.clients ? clv.clients.length : 0;
    scores.clients = Math.min(15, clientCount * 3);
    var lowRisk = clv.clients ? clv.clients.filter(function(c) { return c.risk === 'low'; }).length : 0;
    scores.clients += Math.min(10, lowRisk * 3);

    // Productivity score (0-25)
    scores.productivity = Math.min(25, Math.round(productivity.billableRatio * 30));

    // Pricing score (0-25)
    var rateRatio = pricing.avgRate / Math.max(1, pricing.optimalRate);
    scores.pricing = Math.min(25, Math.round(rateRatio * 25));

    var total = scores.revenue + scores.clients + scores.productivity + scores.pricing;
    var grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : total >= 40 ? 'D' : 'F';

    return {
      total: total,
      grade: grade,
      breakdown: scores,
      label: total >= 85 ? 'Excellent' : total >= 70 ? 'Good' : total >= 55 ? 'Fair' : total >= 40 ? 'Needs Work' : 'Critical'
    };
  }

  // ── UI Rendering ───────────────────────────────────────────
  var activeTab = 'overview';

  function init() {
    renderTabs();
    renderOverview();
    bindEvents();
  }

  function bindEvents() {
    document.addEventListener('click', function(e) {
      var tab = e.target.closest('[data-tab]');
      if (tab) {
        activeTab = tab.dataset.tab;
        $$('.ai-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        renderTabContent(activeTab);
      }
      if (e.target.closest('.refresh-btn')) {
        renderTabContent(activeTab);
      }
    });
  }

  function renderTabs() {
    var container = $('#ai-tabs');
    if (!container) return;
    container.innerHTML =
      '<button class="ai-tab active" data-tab="overview"><span class="tab-icon">🧠</span> Overview</button>' +
      '<button class="ai-tab" data-tab="revenue"><span class="tab-icon">📊</span> Revenue</button>' +
      '<button class="ai-tab" data-tab="clients"><span class="tab-icon">👥</span> Clients</button>' +
      '<button class="ai-tab" data-tab="productivity"><span class="tab-icon">⚡</span> Productivity</button>' +
      '<button class="ai-tab" data-tab="pricing"><span class="tab-icon">💰</span> Pricing</button>' +
      '<button class="ai-tab" data-tab="opportunities"><span class="tab-icon">🚀</span> Opportunities</button>';
  }

  function renderTabContent(tab) {
    switch(tab) {
      case 'overview': renderOverview(); break;
      case 'revenue': renderRevenue(); break;
      case 'clients': renderClients(); break;
      case 'productivity': renderProductivity(); break;
      case 'pricing': renderPricing(); break;
      case 'opportunities': renderOpportunities(); break;
    }
  }

  // ── Overview Tab ───────────────────────────────────────────
  function renderOverview() {
    var content = $('#ai-content');
    if (!content) return;

    var health = calculateHealthScore();
    var revenue = forecastRevenue(3);
    var clv = calculateCLV();
    var productivity = analyzeProductivity();
    var opportunities = identifyOpportunities();

    var html = '';

    // Health Score
    html += '<div class="health-score-section">';
    html += '<div class="health-ring-wrap">';
    html += renderHealthRing(health.total, health.grade);
    html += '<div class="health-label">' + health.label + '</div>';
    html += '</div>';
    html += '<div class="health-breakdown">';
    html += renderBreakdownBar('Revenue', health.breakdown.revenue, 25, 'orange');
    html += renderBreakdownBar('Clients', health.breakdown.clients, 25, 'green');
    html += renderBreakdownBar('Productivity', health.breakdown.productivity, 25, 'blue');
    html += renderBreakdownBar('Pricing', health.breakdown.pricing, 25, 'purple');
    html += '</div>';
    html += '</div>';

    // Quick KPIs
    html += '<div class="kpi-grid">';
    html += renderKPI('📊', 'Projected Revenue', formatCurrency(revenue.forecast && revenue.forecast[0] ? revenue.forecast[0].predicted : 0) + '/mo', revenue.trend === 'growing' ? '+' + formatCurrency(Math.abs(revenue.trendSlope)) + '/mo' : 'stable', revenue.trend === 'growing' ? 'green' : 'orange');
    html += renderKPI('👥', 'Total CLV', formatCurrency(clv.totalCLV), clv.clients ? clv.clients.length + ' clients tracked' : '0 clients', 'blue');
    html += renderKPI('⚡', 'Billable Ratio', formatPercent(productivity.billableRatio), productivity.avgDailyHours ? productivity.avgDailyHours.toFixed(1) + 'h avg/day' : '', productivity.billableRatio > 0.75 ? 'green' : 'orange');
    html += renderKPI('🚀', 'Opportunities', formatCurrency(opportunities.reduce(function(s, o) { return s + o.potentialRevenue; }, 0)), opportunities.length + ' identified', 'purple');
    html += '</div>';

    // AI Insights
    html += '<div class="insights-section">';
    html += '<h3 class="section-title"><span class="title-icon">🤖</span> AI Insights</h3>';
    var allInsights = (revenue.insights || []).concat(clv.insights || []).concat(productivity.insights || []);
    allInsights.slice(0, 6).forEach(function(insight) {
      html += renderInsight(insight);
    });
    html += '</div>';

    // Demo banner
    if (revenue.isDemo || clv.isDemo) {
      html += '<div class="demo-banner">';
      html += '<span class="demo-icon">🎯</span>';
      html += '<div><strong>Demo Mode</strong> — Showing sample data. Start tracking time and adding clients to see your real AI insights.</div>';
      html += '</div>';
    }

    content.innerHTML = html;
    animateHealthRing(health.total);
  }

  function renderHealthRing(score, grade) {
    var circumference = 2 * Math.PI * 52;
    var offset = circumference - (score / 100) * circumference;
    var color = score >= 70 ? '#00ff88' : score >= 50 ? '#ffc800' : '#ff4444';
    return '<svg class="health-ring" viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
      '<circle class="health-ring-progress" cx="60" cy="60" r="52" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + circumference + '" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset 1.5s ease"/>' +
      '<text x="60" y="55" text-anchor="middle" fill="' + color + '" font-size="28" font-weight="900" font-family="Inter">' + score + '</text>' +
      '<text x="60" y="72" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="12" font-weight="600" font-family="Inter">' + grade + '</text>' +
      '</svg>';
  }

  function animateHealthRing(score) {
    setTimeout(function() {
      var ring = document.querySelector('.health-ring-progress');
      if (ring) {
        var circumference = 2 * Math.PI * 52;
        var offset = circumference - (score / 100) * circumference;
        ring.style.strokeDashoffset = offset;
      }
    }, 100);
  }

  function renderBreakdownBar(label, value, max, color) {
    var pct = (value / max * 100).toFixed(0);
    return '<div class="breakdown-row">' +
      '<span class="breakdown-label">' + label + '</span>' +
      '<div class="breakdown-bar"><div class="breakdown-fill ' + color + '" style="width:' + pct + '%"></div></div>' +
      '<span class="breakdown-val">' + value + '/' + max + '</span>' +
      '</div>';
  }

  function renderKPI(icon, label, value, sub, color) {
    return '<div class="kpi-card">' +
      '<div class="kpi-icon">' + icon + '</div>' +
      '<div class="kpi-value ' + color + '">' + value + '</div>' +
      '<div class="kpi-label">' + label + '</div>' +
      '<div class="kpi-sub">' + (sub || '') + '</div>' +
      '</div>';
  }

  function renderInsight(insight) {
    var icons = { positive: '✅', warning: '⚠️', tip: '💡', neutral: 'ℹ️' };
    return '<div class="insight-card ' + insight.type + '">' +
      '<span class="insight-icon">' + (icons[insight.type] || '💡') + '</span>' +
      '<span class="insight-text">' + esc(insight.text) + '</span>' +
      '</div>';
  }

  // ── Revenue Tab ────────────────────────────────────────────
  function renderRevenue() {
    var content = $('#ai-content');
    if (!content) return;
    var data = forecastRevenue(6);
    var html = '';

    html += '<div class="section-header"><h3 class="section-title"><span class="title-icon">📊</span> Revenue Forecast</h3>';
    html += '<button class="refresh-btn">↻ Refresh</button></div>';

    // Chart
    html += '<div class="chart-container">';
    html += renderRevenueChart(data);
    html += '</div>';

    // Forecast table
    html += '<div class="forecast-table">';
    html += '<div class="table-header"><div>Month</div><div>Predicted</div><div>Range</div><div>Confidence</div></div>';
    (data.forecast || []).forEach(function(f) {
      html += '<div class="table-row">';
      html += '<div class="month-cell">' + formatMonth(f.month) + '</div>';
      html += '<div class="amount-cell">' + formatCurrency(f.predicted) + '</div>';
      html += '<div class="range-cell">' + formatCurrency(f.lower) + ' — ' + formatCurrency(f.upper) + '</div>';
      html += '<div class="conf-cell"><div class="conf-bar"><div class="conf-fill" style="width:' + (f.confidence * 100) + '%"></div></div>' + formatPercent(f.confidence) + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Stats
    html += '<div class="stats-row">';
    html += '<div class="stat-card"><div class="stat-val orange">' + formatCurrency(data.avgMonthly) + '</div><div class="stat-label">Avg Monthly</div></div>';
    html += '<div class="stat-card"><div class="stat-val ' + (data.trend === 'growing' ? 'green' : data.trend === 'declining' ? 'red' : 'orange') + '">' + capitalize(data.trend) + '</div><div class="stat-label">Trend</div></div>';
    html += '<div class="stat-card"><div class="stat-val blue">' + formatPercent(data.r2) + '</div><div class="stat-label">Model Fit (R²)</div></div>';
    html += '</div>';

    // Insights
    html += renderInsightsSection(data.insights);

    if (data.isDemo) html += renderDemoBanner();
    content.innerHTML = html;
  }

  function renderRevenueChart(data) {
    var all = (data.historical || []).concat((data.forecast || []).map(function(f) {
      return { month: f.month, revenue: f.predicted, forecast: true, lower: f.lower, upper: f.upper };
    }));
    if (!all.length) return '<div class="empty-chart">No data available</div>';

    var maxVal = Math.max.apply(null, all.map(function(d) { return d.upper || d.revenue || 0; }));
    maxVal = Math.max(maxVal, 1000);
    var barWidth = Math.max(30, Math.min(60, 600 / all.length));
    var chartWidth = all.length * (barWidth + 8) + 60;
    var chartHeight = 240;

    var svg = '<svg class="revenue-chart" viewBox="0 0 ' + chartWidth + ' ' + (chartHeight + 40) + '" preserveAspectRatio="xMidYMid meet">';

    // Grid lines
    for (var g = 0; g <= 4; g++) {
      var gy = chartHeight - (g / 4) * chartHeight;
      var gVal = (g / 4) * maxVal;
      svg += '<line x1="50" y1="' + gy + '" x2="' + (chartWidth - 10) + '" y2="' + gy + '" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>';
      svg += '<text x="45" y="' + (gy + 4) + '" text-anchor="end" fill="rgba(255,255,255,0.3)" font-size="10" font-family="Inter">' + formatCurrencyShort(gVal) + '</text>';
    }

    // Bars
    all.forEach(function(d, i) {
      var x = 55 + i * (barWidth + 8);
      var h = (d.revenue / maxVal) * chartHeight;
      var y = chartHeight - h;

      if (d.forecast) {
        // Confidence range
        var hUpper = ((d.upper || d.revenue) / maxVal) * chartHeight;
        var hLower = ((d.lower || d.revenue) / maxVal) * chartHeight;
        svg += '<rect x="' + (x + barWidth * 0.15) + '" y="' + (chartHeight - hUpper) + '" width="' + (barWidth * 0.7) + '" height="' + (hUpper - hLower) + '" rx="3" fill="rgba(68,136,255,0.1)" stroke="rgba(68,136,255,0.2)" stroke-width="1" stroke-dasharray="3,2"/>';
        svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + h + '" rx="4" fill="url(#forecastGrad)" opacity="0.7"/>';
      } else {
        svg += '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + h + '" rx="4" fill="url(#revenueGrad)"/>';
      }
      // Label
      svg += '<text x="' + (x + barWidth / 2) + '" y="' + (chartHeight + 16) + '" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9" font-family="Inter">' + shortMonth(d.month) + '</text>';
      // Value
      svg += '<text x="' + (x + barWidth / 2) + '" y="' + (y - 6) + '" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="9" font-weight="600" font-family="Inter">' + formatCurrencyShort(d.revenue) + '</text>';
    });

    // Gradients
    svg += '<defs>';
    svg += '<linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff8844"/><stop offset="100%" stop-color="#ff6622"/></linearGradient>';
    svg += '<linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4488ff"/><stop offset="100%" stop-color="#2266dd"/></linearGradient>';
    svg += '</defs>';
    svg += '</svg>';

    // Legend
    svg += '<div class="chart-legend">';
    svg += '<span class="legend-item"><span class="legend-dot orange"></span> Historical</span>';
    svg += '<span class="legend-item"><span class="legend-dot blue"></span> Forecast</span>';
    svg += '<span class="legend-item"><span class="legend-dot blue-light"></span> Confidence Range</span>';
    svg += '</div>';

    return svg;
  }

  // ── Clients Tab ────────────────────────────────────────────
  function renderClients() {
    var content = $('#ai-content');
    if (!content) return;
    var data = calculateCLV();
    var html = '';

    html += '<div class="section-header"><h3 class="section-title"><span class="title-icon">👥</span> Client Intelligence</h3>';
    html += '<button class="refresh-btn">↻ Refresh</button></div>';

    // Summary cards
    html += '<div class="stats-row">';
    html += '<div class="stat-card"><div class="stat-val green">' + formatCurrency(data.totalCLV) + '</div><div class="stat-label">Total CLV</div></div>';
    html += '<div class="stat-card"><div class="stat-val blue">' + formatCurrency(data.avgCLV) + '</div><div class="stat-label">Avg CLV</div></div>';
    html += '<div class="stat-card"><div class="stat-val orange">' + (data.clients ? data.clients.length : 0) + '</div><div class="stat-label">Clients Tracked</div></div>';
    html += '<div class="stat-card"><div class="stat-val ' + (data.atRiskClients && data.atRiskClients.length > 0 ? 'red' : 'green') + '">' + (data.atRiskClients ? data.atRiskClients.length : 0) + '</div><div class="stat-label">At Risk</div></div>';
    html += '</div>';

    // Client table
    html += '<div class="client-table">';
    html += '<div class="table-header client-header">';
    html += '<div>Client</div><div>CLV</div><div>Monthly</div><div>Rate</div><div>Tenure</div><div>Risk</div><div>Score</div>';
    html += '</div>';
    (data.clients || []).forEach(function(c) {
      html += '<div class="table-row client-row">';
      html += '<div class="client-name-cell"><strong>' + esc(c.name) + '</strong><span class="client-company">' + esc(c.company || '') + '</span></div>';
      html += '<div>' + formatCurrency(c.clv) + '</div>';
      html += '<div>' + formatCurrency(c.monthlyRevenue) + '</div>';
      html += '<div>' + formatCurrency(c.effectiveRate) + '/hr</div>';
      html += '<div>' + c.tenureMonths.toFixed(0) + ' mo</div>';
      html += '<div><span class="risk-badge ' + c.risk + '">' + c.risk.toUpperCase() + '</span></div>';
      html += '<div>' + renderMiniScore(c.score) + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Insights
    html += renderInsightsSection(data.insights);
    if (data.isDemo) html += renderDemoBanner();
    content.innerHTML = html;
  }

  function renderMiniScore(score) {
    var color = score >= 70 ? 'green' : score >= 50 ? 'orange' : 'red';
    return '<div class="mini-score ' + color + '">' + score + '</div>';
  }

  // ── Productivity Tab ───────────────────────────────────────
  function renderProductivity() {
    var content = $('#ai-content');
    if (!content) return;
    var data = analyzeProductivity();
    var html = '';

    html += '<div class="section-header"><h3 class="section-title"><span class="title-icon">⚡</span> Productivity Analysis</h3>';
    html += '<button class="refresh-btn">↻ Refresh</button></div>';

    // KPIs
    html += '<div class="stats-row">';
    html += '<div class="stat-card"><div class="stat-val green">' + data.avgDailyHours.toFixed(1) + 'h</div><div class="stat-label">Avg Daily</div></div>';
    html += '<div class="stat-card"><div class="stat-val orange">' + formatPercent(data.billableRatio) + '</div><div class="stat-label">Billable Ratio</div></div>';
    html += '<div class="stat-card"><div class="stat-val blue">' + data.peakHour + ':00</div><div class="stat-label">Peak Hour</div></div>';
    html += '<div class="stat-card"><div class="stat-val purple">' + esc(data.peakDay) + '</div><div class="stat-label">Best Day</div></div>';
    html += '</div>';

    // Hourly heatmap
    html += '<div class="chart-section">';
    html += '<h4 class="chart-title">Hourly Activity Heatmap</h4>';
    html += '<div class="heatmap-container">';
    html += renderHeatmap(data.hourlyDistribution);
    html += '</div></div>';

    // Daily distribution
    html += '<div class="chart-section">';
    html += '<h4 class="chart-title">Weekly Distribution</h4>';
    html += renderWeeklyChart(data.dailyDistribution);
    html += '</div>';

    // Project efficiency
    if (data.projectRankings && data.projectRankings.length > 0) {
      html += '<div class="chart-section">';
      html += '<h4 class="chart-title">Project Efficiency Rankings</h4>';
      html += '<div class="project-rankings">';
      data.projectRankings.forEach(function(p, i) {
        html += '<div class="ranking-row">';
        html += '<div class="rank-num">#' + (i + 1) + '</div>';
        html += '<div class="rank-info"><div class="rank-name">' + esc(p.name) + '</div>';
        html += '<div class="rank-details">' + p.hours.toFixed(1) + 'h total · ' + formatPercent(p.efficiency) + ' efficiency · ' + formatCurrency(p.effectiveRate) + '/hr</div></div>';
        html += '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + (p.efficiency * 100) + '%"></div></div>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    html += renderInsightsSection(data.insights);
    if (data.isDemo) html += renderDemoBanner();
    content.innerHTML = html;
  }

  function renderHeatmap(hourlyDist) {
    var maxVal = Math.max.apply(null, hourlyDist) || 1;
    var html = '<div class="heatmap">';
    for (var h = 0; h < 24; h++) {
      var intensity = hourlyDist[h] / maxVal;
      var bg = intensity > 0.7 ? 'rgba(0,255,136,' + (0.3 + intensity * 0.5) + ')' :
               intensity > 0.3 ? 'rgba(255,136,68,' + (0.2 + intensity * 0.4) + ')' :
               intensity > 0 ? 'rgba(255,255,255,' + (0.03 + intensity * 0.1) + ')' :
               'rgba(255,255,255,0.02)';
      html += '<div class="heatmap-cell" style="background:' + bg + '" title="' + h + ':00 — ' + hourlyDist[h].toFixed(1) + 'h">';
      html += '<span class="heatmap-hour">' + (h < 10 ? '0' : '') + h + '</span>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderWeeklyChart(dayDist) {
    var maxVal = Math.max.apply(null, dayDist) || 1;
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var colors = ['#666', '#ff8844', '#00ff88', '#4488ff', '#aa66ff', '#ffc800', '#666'];
    var html = '<div class="weekly-chart">';
    days.forEach(function(day, i) {
      var pct = (dayDist[i] / maxVal * 100).toFixed(0);
      html += '<div class="weekly-bar-wrap">';
      html += '<div class="weekly-bar" style="height:' + pct + '%;background:' + colors[i] + '"></div>';
      html += '<div class="weekly-label">' + day + '</div>';
      html += '<div class="weekly-val">' + dayDist[i].toFixed(1) + 'h</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ── Pricing Tab ────────────────────────────────────────────
  function renderPricing() {
    var content = $('#ai-content');
    if (!content) return;
    var data = analyzePricing();
    var html = '';

    html += '<div class="section-header"><h3 class="section-title"><span class="title-icon">💰</span> Pricing Optimization</h3>';
    html += '<button class="refresh-btn">↻ Refresh</button></div>';

    // Rate comparison
    html += '<div class="rate-comparison">';
    html += '<div class="rate-card current"><div class="rate-label">Current Rate</div><div class="rate-val">' + formatCurrency(data.currentRate) + '<span>/hr</span></div></div>';
    html += '<div class="rate-arrow">→</div>';
    html += '<div class="rate-card optimal"><div class="rate-label">Optimal Rate</div><div class="rate-val">' + formatCurrency(data.optimalRate) + '<span>/hr</span></div></div>';
    html += '</div>';

    // Rate impact scenarios
    html += '<div class="chart-section">';
    html += '<h4 class="chart-title">Rate Increase Impact</h4>';
    html += '<div class="impact-table">';
    html += '<div class="table-header impact-header"><div>Increase</div><div>New Rate</div><div>Monthly Gain</div><div>Annual Gain</div></div>';
    (data.rateImpact || []).forEach(function(s) {
      html += '<div class="table-row impact-row">';
      html += '<div class="increase-cell">+' + formatCurrency(s.increase) + '/hr</div>';
      html += '<div>' + formatCurrency(s.newRate) + '/hr</div>';
      html += '<div class="gain-cell green">+' + formatCurrency(s.monthlyGain) + '</div>';
      html += '<div class="gain-cell green">+' + formatCurrency(s.annualGain) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Stats
    html += '<div class="stats-row">';
    html += '<div class="stat-card"><div class="stat-val orange">' + formatCurrency(data.avgRate) + '</div><div class="stat-label">Avg Rate</div></div>';
    html += '<div class="stat-card"><div class="stat-val blue">' + formatPercent(data.utilizationRate) + '</div><div class="stat-label">Utilization</div></div>';
    html += '<div class="stat-card"><div class="stat-val green">' + formatCurrency(data.minRate) + '-' + formatCurrency(data.maxRate) + '</div><div class="stat-label">Rate Range</div></div>';
    html += '</div>';

    html += renderInsightsSection(data.insights);
    if (data.isDemo) html += renderDemoBanner();
    content.innerHTML = html;
  }

  // ── Opportunities Tab ──────────────────────────────────────
  function renderOpportunities() {
    var content = $('#ai-content');
    if (!content) return;
    var opportunities = identifyOpportunities();
    var html = '';

    html += '<div class="section-header"><h3 class="section-title"><span class="title-icon">🚀</span> Growth Opportunities</h3>';
    html += '<button class="refresh-btn">↻ Refresh</button></div>';

    var totalPotential = opportunities.reduce(function(s, o) { return s + o.potentialRevenue; }, 0);
    html += '<div class="opportunity-summary">';
    html += '<div class="opp-total"><span class="opp-total-label">Total Annual Potential</span><span class="opp-total-val">' + formatCurrency(totalPotential) + '</span></div>';
    html += '</div>';

    html += '<div class="opportunities-grid">';
    opportunities.forEach(function(opp) {
      html += '<div class="opportunity-card">';
      html += '<div class="opp-header">';
      html += '<span class="opp-icon">' + opp.icon + '</span>';
      html += '<div class="opp-badges">';
      html += '<span class="opp-badge impact-' + opp.impact + '">' + opp.impact + ' impact</span>';
      html += '<span class="opp-badge effort-' + opp.effort + '">' + opp.effort + ' effort</span>';
      html += '</div>';
      html += '</div>';
      html += '<h4 class="opp-title">' + esc(opp.title) + '</h4>';
      html += '<p class="opp-desc">' + esc(opp.description) + '</p>';
      html += '<div class="opp-revenue"><span class="opp-rev-label">Potential Annual Revenue</span><span class="opp-rev-val">' + formatCurrency(opp.potentialRevenue) + '</span></div>';
      html += '</div>';
    });
    html += '</div>';

    content.innerHTML = html;
  }

  // ── Shared Renderers ───────────────────────────────────────
  function renderInsightsSection(insights) {
    if (!insights || !insights.length) return '';
    var html = '<div class="insights-section">';
    html += '<h4 class="chart-title">🤖 AI Insights</h4>';
    insights.forEach(function(i) { html += renderInsight(i); });
    html += '</div>';
    return html;
  }

  function renderDemoBanner() {
    return '<div class="demo-banner"><span class="demo-icon">🎯</span><div><strong>Demo Mode</strong> — Showing sample data. Start using Cortex tools to see real AI-powered insights.</div></div>';
  }

  // ── Formatters ─────────────────────────────────────────────
  function formatMonth(monthStr) {
    var parts = monthStr.split('-');
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(parts[1]) - 1] + ' ' + parts[0];
  }

  function shortMonth(monthStr) {
    var parts = monthStr.split('-');
    var months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    return months[parseInt(parts[1]) - 1];
  }

  function formatCurrencyShort(val) {
    if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
    return '$' + Math.round(val);
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── Boot ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  global.CortexAIAnalytics = {
    forecastRevenue: forecastRevenue,
    calculateCLV: calculateCLV,
    analyzeProductivity: analyzeProductivity,
    analyzePricing: analyzePricing,
    identifyOpportunities: identifyOpportunities,
    calculateHealthScore: calculateHealthScore,
    refresh: function() { renderTabContent(activeTab); }
  };

})(window);
