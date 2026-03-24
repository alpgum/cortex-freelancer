(function(){
  'use strict';

  var CHECKLIST_ITEMS = [
    { id: 'lc-payment-terms', label: 'Payment terms defined', check: checkPaymentTerms },
    { id: 'lc-ip-ownership', label: 'IP ownership clause', check: checkIPOwnership },
    { id: 'lc-revision-limits', label: 'Revision limits specified', check: checkRevisionLimits },
    { id: 'lc-termination', label: 'Termination clause', check: checkTermination },
    { id: 'lc-timeline', label: 'Timeline/deadline defined', check: checkTimeline },
    { id: 'lc-scope', label: 'Scope clearly defined (min 2 items)', check: checkScope },
    { id: 'lc-deliverables', label: 'Deliverables listed', check: checkDeliverables },
    { id: 'lc-compensation', label: 'Rate/compensation specified', check: checkCompensation },
    { id: 'lc-change-policy', label: 'Change request policy included', check: checkChangePolicy },
    { id: 'lc-late-fee', label: 'Late payment fee specified', check: checkLateFee }
  ];

  function checkPaymentTerms() {
    var schedule = document.getElementById('payment-schedule');
    var due = document.getElementById('payment-due');
    return schedule && schedule.value && due && due.value && parseFloat(due.value) > 0;
  }

  function checkIPOwnership() {
    var changePolicy = document.getElementById('change-policy').value.toLowerCase();
    var deliverables = document.getElementById('deliverables').value.toLowerCase();
    var scopeRows = document.getElementById('scope-tbody').querySelectorAll('tr');
    var scopeText = '';
    scopeRows.forEach(function(row) {
      var input = row.querySelector('input');
      if (input) scopeText += ' ' + input.value.toLowerCase();
    });
    var allText = changePolicy + ' ' + deliverables + ' ' + scopeText;
    var ipKeywords = ['intellectual property', 'ip ownership', 'ip rights', 'copyright', 'ownership', 'rights transfer', 'work for hire', 'proprietary'];
    for (var i = 0; i < ipKeywords.length; i++) {
      if (allText.indexOf(ipKeywords[i]) !== -1) return true;
    }
    return false;
  }

  function checkRevisionLimits() {
    var changePolicy = document.getElementById('change-policy').value.toLowerCase();
    var deliverables = document.getElementById('deliverables').value.toLowerCase();
    var allText = changePolicy + ' ' + deliverables;
    var revisionKeywords = ['revision', 'revisions', 'rounds of revision', 'iteration', 'iterations', 'feedback round', 'amendment'];
    for (var i = 0; i < revisionKeywords.length; i++) {
      if (allText.indexOf(revisionKeywords[i]) !== -1) return true;
    }
    return false;
  }

  function checkTermination() {
    var changePolicy = document.getElementById('change-policy').value.toLowerCase();
    var terminationKeywords = ['termination', 'terminate', 'cancel', 'cancellation', 'early termination', 'end of agreement', 'dissolution'];
    for (var i = 0; i < terminationKeywords.length; i++) {
      if (changePolicy.indexOf(terminationKeywords[i]) !== -1) return true;
    }
    return false;
  }

  function checkTimeline() {
    var startDate = document.getElementById('start-date').value;
    var endDate = document.getElementById('end-date').value;
    return !!(startDate && endDate);
  }

  function checkScope() {
    var rows = document.getElementById('scope-tbody').querySelectorAll('tr');
    var filledCount = 0;
    rows.forEach(function(row) {
      var input = row.querySelector('input');
      if (input && input.value.trim().length > 0) filledCount++;
    });
    return filledCount >= 2;
  }

  function checkDeliverables() {
    var val = document.getElementById('deliverables').value.trim();
    if (!val) return false;
    var lines = val.split('\n').filter(function(l) { return l.trim().length > 0; });
    return lines.length >= 1;
  }

  function checkCompensation() {
    var rateAmount = document.getElementById('rate-amount').value;
    return !!(rateAmount && parseFloat(rateAmount) > 0);
  }

  function checkChangePolicy() {
    var val = document.getElementById('change-policy').value.trim();
    return val.length >= 20;
  }

  function checkLateFee() {
    var val = document.getElementById('late-fee').value;
    return !!(val && parseFloat(val) > 0);
  }

  function updateChecklist() {
    var passCount = 0;
    var total = CHECKLIST_ITEMS.length;

    CHECKLIST_ITEMS.forEach(function(item) {
      var passed = item.check();
      if (passed) passCount++;

      var row = document.getElementById(item.id);
      if (!row) return;

      var icon = row.querySelector('.lc-icon');
      var label = row.querySelector('.lc-label');

      if (passed) {
        icon.textContent = '\u2713';
        icon.style.color = 'var(--green)';
        icon.style.background = 'rgba(0,255,136,0.1)';
        label.style.color = 'var(--text)';
        label.style.textDecoration = 'none';
      } else {
        icon.textContent = '\u2717';
        icon.style.color = 'var(--red)';
        icon.style.background = 'rgba(255,68,68,0.1)';
        label.style.color = 'var(--text2)';
        label.style.textDecoration = 'none';
      }
    });

    // Update percentage
    var pct = Math.round((passCount / total) * 100);
    var pctEl = document.getElementById('lc-percentage');
    var barEl = document.getElementById('lc-bar-fill');
    var countEl = document.getElementById('lc-count');

    if (pctEl) pctEl.textContent = pct + '%';
    if (countEl) countEl.textContent = passCount + '/' + total + ' items';
    if (barEl) {
      barEl.style.width = pct + '%';
      if (pct === 100) {
        barEl.style.background = 'var(--green)';
      } else if (pct >= 60) {
        barEl.style.background = 'var(--orange)';
      } else {
        barEl.style.background = 'var(--red)';
      }
    }

    // Track completion
    if (pct === 100) {
      var section = document.getElementById('lc-section');
      if (section && !section.dataset.tracked) {
        section.dataset.tracked = '1';
        dataLayer.push({
          event: 'tool_used',
          tool_name: 'sow-generator',
          action: 'legal_checklist_complete'
        });
      }
    }
  }

  function buildChecklistUI() {
    // Find the Change Request Policy section
    var formSections = document.querySelectorAll('.form-section');
    var changePolicySection = null;
    for (var i = 0; i < formSections.length; i++) {
      var h3 = formSections[i].querySelector('h3');
      if (h3 && h3.textContent.indexOf('Change Request') !== -1) {
        changePolicySection = formSections[i];
        break;
      }
    }
    if (!changePolicySection) return;

    // Create checklist section
    var section = document.createElement('div');
    section.className = 'form-section';
    section.id = 'lc-section';

    // Header
    var header = document.createElement('h3');
    header.innerHTML = '\u2696\uFE0F Legal Review Checklist';
    section.appendChild(header);

    // Progress bar area
    var progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem';

    var barOuter = document.createElement('div');
    barOuter.style.cssText = 'flex:1;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden';

    var barFill = document.createElement('div');
    barFill.id = 'lc-bar-fill';
    barFill.style.cssText = 'height:100%;width:0%;background:var(--red);border-radius:4px;transition:width 0.3s,background 0.3s';
    barOuter.appendChild(barFill);

    var pctLabel = document.createElement('span');
    pctLabel.id = 'lc-percentage';
    pctLabel.style.cssText = 'font-size:1rem;font-weight:800;color:var(--text);min-width:3rem;text-align:right';
    pctLabel.textContent = '0%';

    var countLabel = document.createElement('span');
    countLabel.id = 'lc-count';
    countLabel.style.cssText = 'font-size:0.75rem;color:var(--text3);white-space:nowrap';
    countLabel.textContent = '0/' + CHECKLIST_ITEMS.length + ' items';

    progressWrap.appendChild(barOuter);
    progressWrap.appendChild(pctLabel);
    progressWrap.appendChild(countLabel);
    section.appendChild(progressWrap);

    // Checklist items
    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:0.4rem';

    CHECKLIST_ITEMS.forEach(function(item) {
      var row = document.createElement('div');
      row.id = item.id;
      row.style.cssText = 'display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.6rem;border-radius:var(--radius-sm);transition:background 0.2s';

      var icon = document.createElement('span');
      icon.className = 'lc-icon';
      icon.style.cssText = 'width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:0.75rem;font-weight:800;flex-shrink:0;transition:all 0.2s';
      icon.textContent = '\u2717';
      icon.style.color = 'var(--red)';
      icon.style.background = 'rgba(255,68,68,0.1)';

      var label = document.createElement('span');
      label.className = 'lc-label';
      label.style.cssText = 'font-size:0.85rem;color:var(--text2);transition:color 0.2s';
      label.textContent = item.label;

      row.appendChild(icon);
      row.appendChild(label);
      list.appendChild(row);
    });

    section.appendChild(list);

    // Tip text
    var tip = document.createElement('p');
    tip.style.cssText = 'margin-top:1rem;font-size:0.75rem;color:var(--text3);line-height:1.5';
    tip.textContent = 'Tip: Add IP ownership and termination clauses to your Change Request Policy. Mention revision limits in your deliverables or policy to improve your legal coverage.';
    section.appendChild(tip);

    // Insert after Change Request Policy section
    changePolicySection.parentNode.insertBefore(section, changePolicySection.nextSibling);

    // Initial update
    updateChecklist();
  }

  function attachListeners() {
    // Listen to all form inputs for real-time updates
    var formInputIds = [
      'project-name', 'sow-number', 'sow-date', 'start-date', 'end-date',
      'provider-name', 'client-name', 'deliverables', 'rate-type', 'rate-amount',
      'currency', 'payment-schedule', 'payment-due', 'late-fee', 'change-policy',
      'est-hours'
    ];

    formInputIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', updateChecklist);
        el.addEventListener('change', updateChecklist);
      }
    });

    // Observe scope-tbody and milestones-tbody for row additions/removals
    var scopeTbody = document.getElementById('scope-tbody');
    var milestonesTbody = document.getElementById('milestones-tbody');

    var observerConfig = { childList: true, subtree: true, characterData: true };

    if (scopeTbody) {
      var scopeObserver = new MutationObserver(function() {
        // Re-attach input listeners on new scope rows
        scopeTbody.querySelectorAll('input').forEach(function(input) {
          if (!input.dataset.lcBound) {
            input.dataset.lcBound = '1';
            input.addEventListener('input', updateChecklist);
          }
        });
        updateChecklist();
      });
      scopeObserver.observe(scopeTbody, observerConfig);

      // Bind existing scope inputs
      scopeTbody.querySelectorAll('input').forEach(function(input) {
        input.dataset.lcBound = '1';
        input.addEventListener('input', updateChecklist);
      });
    }

    if (milestonesTbody) {
      var msObserver = new MutationObserver(function() {
        updateChecklist();
      });
      msObserver.observe(milestonesTbody, observerConfig);
    }
  }

  document.addEventListener('DOMContentLoaded', function() {
    buildChecklistUI();
    attachListeners();
  });

})();
