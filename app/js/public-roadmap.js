/**
 * CF-260: Public Roadmap Page
 * Roadmap data management with voting, status tracking, and feature request submission.
 */
(function () {
  'use strict';

  var API_ENDPOINT = '/api/roadmap';
  var VOTE_STORAGE_KEY = 'cortex_roadmap_votes';
  var STATUSES = ['planned', 'building', 'shipped'];

  /**
   * Get locally stored votes.
   * @returns {Object<string, boolean>}
   */
  function getLocalVotes() {
    try {
      return JSON.parse(localStorage.getItem(VOTE_STORAGE_KEY)) || {};
    } catch (_e) {
      return {};
    }
  }

  /**
   * Record a local vote.
   * @param {string} featureId
   */
  function saveLocalVote(featureId) {
    var votes = getLocalVotes();
    votes[featureId] = true;
    localStorage.setItem(VOTE_STORAGE_KEY, JSON.stringify(votes));
  }

  /**
   * Fetch roadmap items from the API.
   * @param {{ status: string }} [filters]
   * @returns {Promise<{ items: Array }>}
   */
  async function fetchItems(filters) {
    var url = API_ENDPOINT + '/items';
    if (filters && filters.status) url += '?status=' + encodeURIComponent(filters.status);

    try {
      var res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (_err) {
      // Fall through
    }
    return { items: [] };
  }

  /**
   * Vote for a feature.
   * @param {string} featureId
   * @returns {Promise<{ success: boolean, votes: number }>}
   */
  async function vote(featureId) {
    if (!featureId) return { success: false, votes: 0 };

    var localVotes = getLocalVotes();
    if (localVotes[featureId]) {
      return { success: false, votes: 0, reason: 'already_voted' };
    }

    try {
      var res = await fetch(API_ENDPOINT + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureId: featureId })
      });

      if (res.ok) {
        saveLocalVote(featureId);
        return await res.json();
      }
    } catch (_err) {
      // Fall through
    }

    return { success: false, votes: 0 };
  }

  /**
   * Check if the user has already voted for a feature.
   * @param {string} featureId
   * @returns {boolean}
   */
  function hasVoted(featureId) {
    return !!getLocalVotes()[featureId];
  }

  /**
   * Submit a feature request.
   * @param {{ title: string, description: string, category: string, email: string }} request
   * @returns {Promise<{ success: boolean, id: string|null }>}
   */
  async function submitRequest(request) {
    if (!request || !request.title || !request.title.trim()) {
      return { success: false, id: null, reason: 'title_required' };
    }

    try {
      var res = await fetch(API_ENDPOINT + '/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: request.title.trim(),
          description: (request.description || '').trim(),
          category: request.category || 'general',
          email: request.email || '',
          timestamp: new Date().toISOString()
        })
      });

      if (res.ok) return await res.json();
    } catch (_err) {
      // Fall through
    }

    return { success: false, id: null };
  }

  /**
   * Render roadmap items into a container element.
   * @param {HTMLElement} container
   * @param {Array} items
   */
  function render(container, items) {
    if (!container) return;
    container.innerHTML = '';

    var grouped = {};
    STATUSES.forEach(function (s) { grouped[s] = []; });
    (items || []).forEach(function (item) {
      var status = STATUSES.indexOf(item.status) >= 0 ? item.status : 'planned';
      grouped[status].push(item);
    });

    var statusLabels = { planned: 'Planned', building: 'In Progress', shipped: 'Shipped' };
    var statusColors = { planned: '#6366f1', building: '#f59e0b', shipped: '#10b981' };

    STATUSES.forEach(function (status) {
      var section = document.createElement('div');
      section.setAttribute('style', 'margin-bottom:32px');

      var header = document.createElement('h3');
      header.setAttribute('style', 'font-size:16px;margin:0 0 12px;display:flex;align-items:center;gap:8px');
      header.innerHTML = '<span style="width:10px;height:10px;border-radius:50%;background:' + statusColors[status] + ';display:inline-block"></span>' +
        statusLabels[status] + ' <span style="color:#9ca3af;font-weight:400">(' + grouped[status].length + ')</span>';
      section.appendChild(header);

      grouped[status].forEach(function (item) {
        var card = document.createElement('div');
        card.setAttribute('style',
          'border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center');

        var info = document.createElement('div');
        info.innerHTML =
          '<div style="font-weight:600;color:#111827">' + escapeHtml(item.title) + '</div>' +
          (item.description ? '<div style="font-size:13px;color:#6b7280;margin-top:4px">' + escapeHtml(item.description) + '</div>' : '');

        var voteBtn = document.createElement('button');
        var voted = hasVoted(item.id);
        voteBtn.textContent = (voted ? '\u2714 ' : '\u25B2 ') + (item.votes || 0);
        voteBtn.setAttribute('style',
          'border:1px solid ' + (voted ? '#10b981' : '#d1d5db') + ';background:' + (voted ? '#ecfdf5' : '#fff') +
          ';border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;font-weight:600;color:' + (voted ? '#059669' : '#374151'));
        voteBtn.disabled = voted;

        voteBtn.addEventListener('click', function () {
          vote(item.id).then(function (result) {
            if (result.success) {
              voteBtn.textContent = '\u2714 ' + result.votes;
              voteBtn.style.background = '#ecfdf5';
              voteBtn.style.borderColor = '#10b981';
              voteBtn.style.color = '#059669';
              voteBtn.disabled = true;
            }
          });
        });

        card.appendChild(info);
        card.appendChild(voteBtn);
        section.appendChild(card);
      });

      container.appendChild(section);
    });
  }

  /**
   * Render the feature request form.
   * @param {HTMLElement} container
   * @param {function} [onSubmit]
   */
  function renderRequestForm(container, onSubmit) {
    if (!container) return;

    container.innerHTML =
      '<h3 style="font-size:16px;margin:0 0 12px">Suggest a Feature</h3>' +
      '<input class="cortex-roadmap-title" placeholder="Feature title" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px;box-sizing:border-box">' +
      '<textarea class="cortex-roadmap-desc" placeholder="Describe your idea..." style="width:100%;min-height:80px;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px;resize:vertical;box-sizing:border-box"></textarea>' +
      '<select class="cortex-roadmap-cat" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:8px">' +
        '<option value="general">General</option>' +
        '<option value="tools">Tools</option>' +
        '<option value="billing">Billing</option>' +
        '<option value="integrations">Integrations</option>' +
      '</select>' +
      '<button class="cortex-roadmap-submit" style="padding:10px 20px;background:#4F46E5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600">Submit Request</button>';

    container.querySelector('.cortex-roadmap-submit').addEventListener('click', function () {
      var title = container.querySelector('.cortex-roadmap-title').value;
      var description = container.querySelector('.cortex-roadmap-desc').value;
      var category = container.querySelector('.cortex-roadmap-cat').value;

      submitRequest({ title: title, description: description, category: category }).then(function (result) {
        if (result.success) {
          container.querySelector('.cortex-roadmap-title').value = '';
          container.querySelector('.cortex-roadmap-desc').value = '';
          if (onSubmit) onSubmit(result);
        }
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Export to namespace
  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.PublicRoadmap = {
    fetchItems: fetchItems,
    vote: vote,
    hasVoted: hasVoted,
    submitRequest: submitRequest,
    render: render,
    renderRequestForm: renderRequestForm
  };
})();
