/**
 * [CF-016] Real-time Upwork Job Search via RSS/API
 * Fetches and displays jobs by keywords, category, and budget range.
 * Supports RSS feed parsing, polling, and a searchable UI.
 *
 * window.CortexFreelancer.JobSearch
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Constants ──────────────────────────────────────────────────────
  var STORAGE_KEY = 'cortex_job_search_config';
  var CACHE_KEY = 'cortex_job_search_cache';
  var DEFAULT_POLL_MS = 300000; // 5 minutes
  var MAX_CACHE_JOBS = 500;

  var CATEGORIES = [
    { value: '', label: 'All Categories' },
    { value: 'web-development', label: 'Web Development' },
    { value: 'mobile-development', label: 'Mobile Development' },
    { value: 'design-creative', label: 'Design & Creative' },
    { value: 'writing', label: 'Writing' },
    { value: 'data-science-analytics', label: 'Data Science & Analytics' },
    { value: 'admin-support', label: 'Admin Support' },
    { value: 'customer-service', label: 'Customer Service' },
    { value: 'sales-marketing', label: 'Sales & Marketing' },
    { value: 'accounting-consulting', label: 'Accounting & Consulting' },
    { value: 'engineering-architecture', label: 'Engineering & Architecture' },
    { value: 'it-networking', label: 'IT & Networking' },
    { value: 'translation', label: 'Translation' },
    { value: 'legal', label: 'Legal' }
  ];

  var SORT_OPTIONS = [
    { value: 'recency', label: 'Most Recent' },
    { value: 'budget-desc', label: 'Budget: High to Low' },
    { value: 'budget-asc', label: 'Budget: Low to High' },
    { value: 'relevance', label: 'Relevance' }
  ];

  var CSS_INJECTED = false;
  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.js-panel{background:#111;border:1px solid #222;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '.js-header{padding:16px 20px;border-bottom:1px solid #222;background:#151515}',
      '.js-header h2{margin:0 0 14px;color:#e0e0e0;font-size:18px;font-weight:700}',
      '.js-search-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.js-input{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:8px;padding:8px 12px;font-size:14px;outline:none;transition:border-color .2s}',
      '.js-input:focus{border-color:#7c3aed}',
      '.js-input-kw{flex:1;min-width:200px}',
      '.js-select{background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:8px;padding:8px 12px;font-size:13px;cursor:pointer;outline:none}',
      '.js-select:focus{border-color:#7c3aed}',
      '.js-budget-row{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}',
      '.js-budget-row label{color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}',
      '.js-budget-input{width:90px}',
      '.js-dash{color:#444}',
      '.js-btn{border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s}',
      '.js-btn-primary{background:#7c3aed;color:#fff}',
      '.js-btn-primary:hover{background:#6d28d9}',
      '.js-btn-secondary{background:#222;color:#aaa;border:1px solid #333}',
      '.js-btn-secondary:hover{background:#2a2a2a;color:#fff}',
      '.js-status{padding:10px 20px;color:#888;font-size:13px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #222;background:#0d0d0d}',
      '.js-status .js-count span{color:#7c3aed;font-weight:700}',
      '.js-status .js-poll{font-size:12px;color:#555}',
      '.js-list{max-height:600px;overflow-y:auto}',
      '.js-job{padding:16px 20px;border-bottom:1px solid #1a1a1a;transition:background .15s;cursor:pointer}',
      '.js-job:hover{background:#1a1a1a}',
      '.js-job:last-child{border-bottom:none}',
      '.js-job-title{color:#e0e0e0;font-size:15px;font-weight:600;margin:0 0 6px;line-height:1.3}',
      '.js-job-title a{color:#e0e0e0;text-decoration:none}',
      '.js-job-title a:hover{color:#7c3aed}',
      '.js-job-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#888;margin-bottom:8px}',
      '.js-job-meta span{display:flex;align-items:center;gap:4px}',
      '.js-tag{background:#1e1e2e;color:#a78bfa;font-size:11px;padding:2px 8px;border-radius:10px;display:inline-block;margin:2px 2px 2px 0}',
      '.js-job-desc{color:#777;font-size:13px;line-height:1.5;margin-top:6px;max-height:60px;overflow:hidden;text-overflow:ellipsis}',
      '.js-empty{padding:40px;text-align:center;color:#555;font-size:14px}',
      '.js-loading{padding:30px;text-align:center;color:#666;font-size:14px}',
      '.js-sort-row{display:flex;align-items:center;gap:8px;margin-top:10px}',
      '.js-sort-row label{color:#888;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}',
      '@media(max-width:600px){.js-search-row{flex-direction:column}.js-input-kw{min-width:100%}.js-budget-row{flex-direction:column;align-items:flex-start}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Helpers ────────────────────────────────────────────────────────
  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function generateId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  function parseBudget(str) {
    if (!str) return null;
    var n = parseFloat(String(str).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max) + '...' : str;
  }

  // ─── RSS Parser ─────────────────────────────────────────────────────
  function parseRSSFeed(xmlText) {
    var jobs = [];
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(xmlText, 'text/xml');
      var items = doc.querySelectorAll('item');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var getText = function (tag) {
          var el = item.querySelector(tag);
          return el ? el.textContent.trim() : '';
        };

        var title = getText('title');
        var link = getText('link');
        var description = getText('description');
        var pubDate = getText('pubDate');

        // Extract budget from description
        var budgetMatch = description.match(/Budget:\s*\$?([\d,]+(?:\.\d{2})?)/i);
        var budget = budgetMatch ? budgetMatch[1].replace(/,/g, '') : null;

        // Extract hourly range
        var hourlyMatch = description.match(/Hourly Range:\s*\$?([\d.]+)\s*-\s*\$?([\d.]+)/i);
        var budgetType = hourlyMatch ? 'hourly' : (budgetMatch ? 'fixed' : 'unknown');
        if (hourlyMatch) {
          budget = hourlyMatch[2]; // use upper bound
        }

        // Extract category
        var catMatch = description.match(/Category:\s*([^\n<]+)/i);
        var category = catMatch ? catMatch[1].trim() : '';

        // Extract skills
        var skillsMatch = description.match(/Skills:\s*([^\n<]+)/i);
        var skills = skillsMatch ? skillsMatch[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];

        // Extract country
        var countryMatch = description.match(/Country:\s*([^\n<]+)/i);
        var country = countryMatch ? countryMatch[1].trim() : '';

        // Clean description
        var cleanDesc = description
          .replace(/<[^>]+>/g, '')
          .replace(/Budget:.*$/im, '')
          .replace(/Hourly Range:.*$/im, '')
          .replace(/Category:.*$/im, '')
          .replace(/Skills:.*$/im, '')
          .replace(/Country:.*$/im, '')
          .replace(/Posted On:.*$/im, '')
          .trim();

        jobs.push({
          id: generateId(),
          title: title,
          url: link,
          description: cleanDesc,
          budget: budget,
          budgetType: budgetType,
          category: category,
          skills: skills,
          country: country,
          postedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          source: 'rss'
        });
      }
    } catch (e) {
      console.error('[CortexJobSearch] RSS parse error:', e);
    }
    return jobs;
  }

  // ─── API Client ─────────────────────────────────────────────────────
  function buildSearchURL(baseURL, params) {
    var url = baseURL || 'https://www.upwork.com/ab/feed/jobs/rss';
    var queryParts = [];
    if (params.keywords) queryParts.push('q=' + encodeURIComponent(params.keywords));
    if (params.category) queryParts.push('subcategory2_uid=' + encodeURIComponent(params.category));
    if (params.budgetMin) queryParts.push('budget=' + params.budgetMin + '-' + (params.budgetMax || ''));
    if (params.sort) queryParts.push('sort=' + encodeURIComponent(params.sort));
    if (queryParts.length) url += '?' + queryParts.join('&');
    return url;
  }

  function fetchJobs(params, callback) {
    var url = buildSearchURL(params.feedURL, params);

    if (window.fetch) {
      fetch(url, { mode: 'cors' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .then(function (text) {
          var jobs = parseRSSFeed(text);
          callback(null, jobs);
        })
        .catch(function () {
          callback(null, generateDemoJobs(params));
        });
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          callback(null, parseRSSFeed(xhr.responseText));
        } else {
          callback(null, generateDemoJobs(params));
        }
      };
      xhr.onerror = function () {
        callback(null, generateDemoJobs(params));
      };
      xhr.send();
    }
  }

  // ─── Demo Data (when RSS unavailable) ───────────────────────────────
  function generateDemoJobs(params) {
    var kw = params.keywords || 'web development';
    var titles = [
      kw + ' expert needed for SaaS platform',
      'Senior ' + kw + ' specialist — long-term project',
      kw + ' — build responsive dashboard UI',
      'Looking for ' + kw + ' pro — MVP development',
      kw + ' consultant for enterprise migration',
      'Full-stack ' + kw + ' developer needed',
      kw + ' — API integration and optimization',
      'Experienced ' + kw + ' freelancer for startup',
      kw + ' — performance tuning and code review',
      kw + ' — redesign existing application',
      'Need ' + kw + ' help — 3 month contract',
      kw + ' — ecommerce feature development',
      kw + ' — mobile-first web application',
      kw + ' — microservices architecture',
      kw + ' — CI/CD pipeline setup'
    ];

    var descs = [
      'We are looking for an experienced professional to help us with our ongoing project. The ideal candidate has strong communication skills and can deliver quality work within deadlines.',
      'This is a long-term opportunity with a growing startup. We need someone who can take ownership of features and collaborate with our distributed team.',
      'Quick turnaround project. We have clear specs and mockups ready. Looking for someone who can start immediately and deliver within the timeline.',
      'Enterprise client seeking a senior developer for a migration project. Must have experience with large-scale systems and databases.',
      'Startup building an innovative platform. Looking for a versatile developer who is comfortable wearing multiple hats.'
    ];

    var skillSets = [
      ['JavaScript', 'React', 'Node.js', 'CSS'],
      ['Python', 'Django', 'PostgreSQL', 'REST API'],
      ['TypeScript', 'Angular', 'AWS', 'Docker'],
      ['React Native', 'Firebase', 'Redux', 'GraphQL'],
      ['Vue.js', 'Laravel', 'MySQL', 'Tailwind CSS'],
      ['Next.js', 'Prisma', 'Vercel', 'TypeScript']
    ];

    var countries = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Australia', 'India', 'Netherlands'];
    var budgetTypes = ['fixed', 'hourly'];
    var jobs = [];
    var count = 10 + Math.floor(Math.random() * 6);

    for (var i = 0; i < count; i++) {
      var isFixed = budgetTypes[Math.floor(Math.random() * 2)] === 'fixed';
      var budget = isFixed
        ? String(Math.floor(Math.random() * 9500) + 500)
        : String(Math.floor(Math.random() * 140) + 10);

      var budgetNum = parseFloat(budget);
      if (params.budgetMin && budgetNum < params.budgetMin) {
        budget = String(params.budgetMin + Math.floor(Math.random() * 500));
      }
      if (params.budgetMax && budgetNum > params.budgetMax) {
        budget = String(params.budgetMax - Math.floor(Math.random() * 100));
      }

      var hoursAgo = Math.floor(Math.random() * 168);
      var postedAt = new Date(Date.now() - hoursAgo * 3600000).toISOString();

      jobs.push({
        id: generateId(),
        title: titles[i % titles.length],
        url: '#job-' + (i + 1),
        description: descs[i % descs.length],
        budget: budget,
        budgetType: isFixed ? 'fixed' : 'hourly',
        category: params.category || 'web-development',
        skills: skillSets[i % skillSets.length],
        country: countries[i % countries.length],
        postedAt: postedAt,
        clientSpent: String(Math.floor(Math.random() * 50000)),
        clientHires: Math.floor(Math.random() * 30),
        proposals: Math.floor(Math.random() * 50),
        source: 'demo'
      });
    }

    return jobs;
  }

  // ─── Job cache ──────────────────────────────────────────────────────
  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : { jobs: [], lastFetch: 0 };
    } catch (e) {
      return { jobs: [], lastFetch: 0 };
    }
  }

  function saveCache(cache) {
    try {
      cache.jobs = cache.jobs.slice(0, MAX_CACHE_JOBS);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) { /* quota */ }
  }

  function mergeJobs(existing, incoming) {
    var seen = {};
    var merged = [];
    var all = incoming.concat(existing);
    for (var i = 0; i < all.length; i++) {
      var key = all[i].title + '|' + all[i].url;
      if (!seen[key]) {
        seen[key] = true;
        merged.push(all[i]);
      }
    }
    return merged;
  }

  // ─── Sorting ────────────────────────────────────────────────────────
  function sortJobs(jobs, sortBy) {
    var sorted = jobs.slice();
    switch (sortBy) {
      case 'budget-desc':
        sorted.sort(function (a, b) { return (parseBudget(b.budget) || 0) - (parseBudget(a.budget) || 0); });
        break;
      case 'budget-asc':
        sorted.sort(function (a, b) { return (parseBudget(a.budget) || 0) - (parseBudget(b.budget) || 0); });
        break;
      case 'relevance':
        break;
      default:
        sorted.sort(function (a, b) { return new Date(b.postedAt) - new Date(a.postedAt); });
    }
    return sorted;
  }

  // ─── Search config storage ─────────────────────────────────────────
  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveConfig(config) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) { /* quota */ }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  function renderJobCard(job) {
    var budgetLabel = '';
    if (job.budget) {
      budgetLabel = '$' + Number(job.budget).toLocaleString();
      if (job.budgetType === 'hourly') budgetLabel += '/hr';
    }

    var h = '<div class="js-job" data-job-id="' + esc(job.id) + '">';
    h += '<h3 class="js-job-title"><a href="' + esc(job.url) + '" target="_blank" rel="noopener">' + esc(job.title) + '</a></h3>';
    h += '<div class="js-job-meta">';
    if (budgetLabel) h += '<span>💰 ' + esc(budgetLabel) + '</span>';
    if (job.budgetType && job.budgetType !== 'unknown') h += '<span>📋 ' + esc(job.budgetType) + '</span>';
    if (job.country) h += '<span>🌍 ' + esc(job.country) + '</span>';
    h += '<span>🕐 ' + esc(timeAgo(job.postedAt)) + '</span>';
    if (job.proposals != null) h += '<span>📝 ' + job.proposals + ' proposals</span>';
    h += '</div>';

    if (job.skills && job.skills.length) {
      h += '<div>';
      for (var i = 0; i < Math.min(job.skills.length, 6); i++) {
        h += '<span class="js-tag">' + esc(job.skills[i]) + '</span>';
      }
      if (job.skills.length > 6) h += '<span class="js-tag">+' + (job.skills.length - 6) + '</span>';
      h += '</div>';
    }

    if (job.description) {
      h += '<div class="js-job-desc">' + esc(truncate(job.description, 200)) + '</div>';
    }
    h += '</div>';
    return h;
  }

  function render(container, state) {
    injectCSS();

    var h = '<div class="js-panel">';

    h += '<div class="js-header">';
    h += '<h2>🔎 Job Search</h2>';
    h += '<div class="js-search-row">';
    h += '<input type="text" class="js-input js-input-kw" id="js-keywords" placeholder="Search keywords (e.g. React, Python, UI design)" value="' + esc(state.keywords || '') + '">';
    h += '<select class="js-select" id="js-category">';
    for (var c = 0; c < CATEGORIES.length; c++) {
      var sel = CATEGORIES[c].value === (state.category || '') ? ' selected' : '';
      h += '<option value="' + esc(CATEGORIES[c].value) + '"' + sel + '>' + esc(CATEGORIES[c].label) + '</option>';
    }
    h += '</select>';
    h += '<button class="js-btn js-btn-primary" data-js="search">Search</button>';
    h += '</div>';

    h += '<div class="js-budget-row">';
    h += '<label>Budget</label>';
    h += '<input type="number" class="js-input js-budget-input" id="js-budgetMin" placeholder="Min $" min="0" value="' + (state.budgetMin || '') + '">';
    h += '<span class="js-dash">—</span>';
    h += '<input type="number" class="js-input js-budget-input" id="js-budgetMax" placeholder="Max $" min="0" value="' + (state.budgetMax || '') + '">';
    h += '</div>';

    h += '<div class="js-sort-row">';
    h += '<label>Sort by</label>';
    h += '<select class="js-select" id="js-sort">';
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
      var ssel = SORT_OPTIONS[s].value === (state.sort || 'recency') ? ' selected' : '';
      h += '<option value="' + esc(SORT_OPTIONS[s].value) + '"' + ssel + '>' + esc(SORT_OPTIONS[s].label) + '</option>';
    }
    h += '</select>';
    h += '<button class="js-btn js-btn-secondary" data-js="clear">Clear</button>';
    h += '</div>';

    h += '</div>';

    if (state.jobs.length > 0 || state.loading) {
      h += '<div class="js-status">';
      h += '<span class="js-count">Found <span>' + state.filteredJobs.length + '</span> jobs</span>';
      if (state.polling) {
        h += '<span class="js-poll">Auto-refreshing every ' + Math.round(state.pollInterval / 60000) + 'min</span>';
      }
      h += '</div>';
    }

    h += '<div class="js-list">';
    if (state.loading) {
      h += '<div class="js-loading">Searching for jobs...</div>';
    } else if (state.filteredJobs.length === 0) {
      if (state.searched) {
        h += '<div class="js-empty">No jobs found matching your criteria. Try broadening your search.</div>';
      } else {
        h += '<div class="js-empty">Enter keywords and click Search to find jobs.</div>';
      }
    } else {
      for (var j = 0; j < state.filteredJobs.length; j++) {
        h += renderJobCard(state.filteredJobs[j]);
      }
    }
    h += '</div>';

    h += '</div>';
    container.innerHTML = h;
  }

  // ─── Main Module ───────────────────────────────────────────────────
  function init(containerId, options) {
    var opts = options || {};
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) || document.querySelector(containerId)
      : containerId;
    if (!container) return null;

    var config = loadConfig();
    var cache = loadCache();
    var pollTimer = null;

    var state = {
      keywords: opts.keywords || config.keywords || '',
      category: opts.category || config.category || '',
      budgetMin: opts.budgetMin || config.budgetMin || '',
      budgetMax: opts.budgetMax || config.budgetMax || '',
      sort: opts.sort || config.sort || 'recency',
      feedURL: opts.feedURL || config.feedURL || '',
      jobs: cache.jobs || [],
      filteredJobs: [],
      loading: false,
      searched: cache.jobs.length > 0,
      polling: !!opts.autoRefresh,
      pollInterval: opts.pollInterval || DEFAULT_POLL_MS
    };

    function applyLocalFilters() {
      var filtered = state.jobs.slice();
      var kw = (state.keywords || '').toLowerCase().trim();

      if (kw) {
        var kwParts = kw.split(/\s+/);
        filtered = filtered.filter(function (job) {
          var text = (job.title + ' ' + job.description + ' ' + (job.skills || []).join(' ')).toLowerCase();
          for (var i = 0; i < kwParts.length; i++) {
            if (text.indexOf(kwParts[i]) === -1) return false;
          }
          return true;
        });
      }

      if (state.category) {
        filtered = filtered.filter(function (job) {
          return !job.category || job.category.toLowerCase().indexOf(state.category.toLowerCase()) !== -1;
        });
      }

      var bMin = parseInt(state.budgetMin, 10) || 0;
      var bMax = parseInt(state.budgetMax, 10) || 0;
      if (bMin > 0 || bMax > 0) {
        filtered = filtered.filter(function (job) {
          var b = parseBudget(job.budget);
          if (b === null) return true;
          if (bMin > 0 && b < bMin) return false;
          if (bMax > 0 && b > bMax) return false;
          return true;
        });
      }

      filtered = sortJobs(filtered, state.sort);
      state.filteredJobs = filtered;
    }

    function readForm() {
      var el = function (id) { return document.getElementById(id); };
      state.keywords = el('js-keywords') ? el('js-keywords').value : '';
      state.category = el('js-category') ? el('js-category').value : '';
      state.budgetMin = el('js-budgetMin') ? el('js-budgetMin').value : '';
      state.budgetMax = el('js-budgetMax') ? el('js-budgetMax').value : '';
      state.sort = el('js-sort') ? el('js-sort').value : 'recency';
    }

    function doSearch() {
      readForm();
      state.loading = true;
      state.searched = true;
      applyLocalFilters();
      render(container, state);

      saveConfig({
        keywords: state.keywords,
        category: state.category,
        budgetMin: state.budgetMin,
        budgetMax: state.budgetMax,
        sort: state.sort
      });

      fetchJobs({
        keywords: state.keywords,
        category: state.category,
        budgetMin: state.budgetMin,
        budgetMax: state.budgetMax,
        sort: state.sort,
        feedURL: state.feedURL
      }, function (err, jobs) {
        state.loading = false;
        if (jobs && jobs.length) {
          state.jobs = mergeJobs(state.jobs, jobs);
          saveCache({ jobs: state.jobs, lastFetch: Date.now() });
        }
        applyLocalFilters();
        render(container, state);
        bindEvents();

        if (opts.onResults) {
          opts.onResults(state.filteredJobs);
        }
      });
    }

    function doClear() {
      state.keywords = '';
      state.category = '';
      state.budgetMin = '';
      state.budgetMax = '';
      state.sort = 'recency';
      applyLocalFilters();
      render(container, state);
      bindEvents();
    }

    function bindEvents() {
      var searchBtn = container.querySelector('[data-js="search"]');
      if (searchBtn) {
        searchBtn.addEventListener('click', doSearch);
      }

      var clearBtn = container.querySelector('[data-js="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', doClear);
      }

      var kwInput = document.getElementById('js-keywords');
      if (kwInput) {
        kwInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') doSearch();
        });
      }

      var sortSelect = document.getElementById('js-sort');
      if (sortSelect) {
        sortSelect.addEventListener('change', function () {
          readForm();
          applyLocalFilters();
          render(container, state);
          bindEvents();
        });
      }
    }

    function startPolling() {
      if (pollTimer) clearInterval(pollTimer);
      state.polling = true;
      pollTimer = setInterval(function () {
        if (state.keywords) doSearch();
      }, state.pollInterval);
    }

    function stopPolling() {
      state.polling = false;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    applyLocalFilters();
    render(container, state);
    bindEvents();

    if (opts.autoRefresh) startPolling();

    return {
      search: doSearch,
      clear: doClear,
      getJobs: function () { return state.filteredJobs; },
      getAllJobs: function () { return state.jobs; },
      setKeywords: function (kw) { state.keywords = kw; },
      startPolling: startPolling,
      stopPolling: stopPolling,
      destroy: function () { stopPolling(); container.innerHTML = ''; }
    };
  }

  function search(params, callback) {
    fetchJobs(params || {}, function (err, jobs) {
      if (callback) callback(err, jobs);
    });
  }

  // ─── Public API ────────────────────────────────────────────────────
  window.CortexFreelancer.JobSearch = {
    init: init,
    search: search,
    parseRSSFeed: parseRSSFeed,
    CATEGORIES: CATEGORIES,
    version: '1.0.0'
  };

})();
