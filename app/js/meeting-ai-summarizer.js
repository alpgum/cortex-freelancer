(function(){
'use strict';

document.addEventListener('DOMContentLoaded', function(){

  // ========== SENTIMENT LEXICON ==========
  var positiveWords = ['agreed','approved','great','excellent','success','happy','excited','progress','achieved','completed','on track','ahead','love','fantastic','perfect','well done','milestone','celebration','productive','effective','aligned','confident','optimistic','resolved','fixed','improved','growth','win','positive','strong','good','benefit','opportunity','advantage','innovative','creative','thriving','breakthrough','solution','impressed','remarkable','outstanding','delivered','momentum'];
  var negativeWords = ['issue','problem','concern','risk','delay','behind','blocker','failed','missed','overdue','stuck','frustrated','worried','unclear','confused','disagree','conflict','budget overrun','scope creep','bottleneck','escalate','urgent','critical','broken','regression','complaint','disappointed','setback','obstacle','challenge','difficult','struggling','lost','decline','dropped','negative','poor','weak','threat','cut','cancelled','rejected','denied'];

  // ========== SMART SUMMARY ENGINE ==========
  function analyzeSentiment(text) {
    var lower = text.toLowerCase();
    var posCount = 0;
    var negCount = 0;
    positiveWords.forEach(function(w){
      var re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      var m = lower.match(re);
      if (m) posCount += m.length;
    });
    negativeWords.forEach(function(w){
      var re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      var m = lower.match(re);
      if (m) negCount += m.length;
    });
    var total = posCount + negCount;
    if (total === 0) return { label: 'Neutral', score: 50, color: 'var(--blue)' };
    var ratio = posCount / total;
    if (ratio >= 0.65) return { label: 'Positive', score: Math.round(ratio * 100), color: 'var(--green)' };
    if (ratio <= 0.35) return { label: 'Negative', score: Math.round((1 - ratio) * 100), color: 'var(--red)' };
    return { label: 'Neutral', score: 50, color: 'var(--blue)' };
  }

  function extractKeyThemes(text) {
    var themes = {};
    var themePatterns = [
      { pattern: /\b(design|redesign|ui|ux|wireframe|mockup|layout|visual|branding|logo|color|font|typography)\b/gi, label: 'Design & Branding' },
      { pattern: /\b(develop|code|programming|api|server|database|deploy|staging|production|build|implement|technical|backend|frontend|architecture|infrastructure)\b/gi, label: 'Development & Technical' },
      { pattern: /\b(budget|cost|price|payment|invoice|revenue|expense|financial|dollar|\$\d|funding|investment|roi)\b/gi, label: 'Budget & Finance' },
      { pattern: /\b(timeline|deadline|schedule|milestone|sprint|phase|launch|delivery|eta|due date|target date|go[\s-]?live)\b/gi, label: 'Timeline & Deadlines' },
      { pattern: /\b(marketing|campaign|seo|social media|content|blog|email|promotion|audience|traffic|conversion|analytics|ads)\b/gi, label: 'Marketing & Content' },
      { pattern: /\b(team|hire|resource|capacity|workload|assign|delegate|staffing|onboard|talent|role)\b/gi, label: 'Team & Resources' },
      { pattern: /\b(client|customer|stakeholder|user|feedback|satisfaction|requirement|expectation|approval|sign[\s-]?off)\b/gi, label: 'Client & Stakeholders' },
      { pattern: /\b(scope|feature|requirement|specification|functionality|deliverable|use case|user story)\b/gi, label: 'Scope & Requirements' },
      { pattern: /\b(testing|qa|quality|bug|fix|review|audit|compliance|security|performance)\b/gi, label: 'Quality & Testing' },
      { pattern: /\b(strategy|goal|objective|vision|plan|roadmap|direction|priority|initiative|kpi|metric)\b/gi, label: 'Strategy & Planning' }
    ];

    themePatterns.forEach(function(tp) {
      var matches = text.match(tp.pattern);
      if (matches && matches.length > 0) {
        themes[tp.label] = matches.length;
      }
    });

    // Sort by frequency and return top themes
    var sorted = Object.keys(themes).sort(function(a, b) { return themes[b] - themes[a]; });
    return sorted.slice(0, 5).map(function(label) {
      return { label: label, mentions: themes[label] };
    });
  }

  function extractTopicBullets(text, theme) {
    var lines = text.split(/[\n.!?]+/).map(function(l){ return l.trim(); }).filter(function(l){ return l.length > 10; });
    var themeWordMap = {
      'Design & Branding': /design|redesign|ui|ux|wireframe|mockup|layout|visual|branding|logo|color|font/i,
      'Development & Technical': /develop|code|api|server|database|deploy|staging|production|build|implement|technical|backend|frontend/i,
      'Budget & Finance': /budget|cost|price|payment|invoice|revenue|expense|financial|dollar|\$\d|funding/i,
      'Timeline & Deadlines': /timeline|deadline|schedule|milestone|sprint|phase|launch|delivery|eta|due/i,
      'Marketing & Content': /marketing|campaign|seo|social media|content|blog|email|promotion|audience/i,
      'Team & Resources': /team|hire|resource|capacity|workload|assign|delegate|staffing/i,
      'Client & Stakeholders': /client|customer|stakeholder|user|feedback|satisfaction|requirement|expectation/i,
      'Scope & Requirements': /scope|feature|requirement|specification|functionality|deliverable/i,
      'Quality & Testing': /testing|qa|quality|bug|fix|review|audit|compliance|security/i,
      'Strategy & Planning': /strategy|goal|objective|vision|plan|roadmap|direction|priority/i
    };
    var re = themeWordMap[theme.label];
    if (!re) return [];
    var bullets = [];
    lines.forEach(function(line) {
      if (re.test(line) && bullets.length < 3) {
        bullets.push(line.replace(/^[-*]\s*/, '').trim());
      }
    });
    return bullets;
  }

  function generateExecutiveSummary(text, decisions, actionItems, followups, people) {
    var sentences = text.split(/[.!?]+/).filter(function(s){ return s.trim().length > 15; });
    var totalSentences = sentences.length;
    var title = (document.getElementById('meetingTitle').value || '').trim();

    var line1 = '';
    if (title) {
      line1 = 'The "' + title + '" meeting covered ' + totalSentences + ' discussion points';
    } else {
      line1 = 'This meeting covered ' + totalSentences + ' discussion points';
    }
    if (people.length > 0) {
      line1 += ' with ' + people.length + ' participant' + (people.length > 1 ? 's' : '') + ' identified (' + people.slice(0, 4).join(', ') + (people.length > 4 ? '...' : '') + ')';
    }
    line1 += '.';

    var line2 = '';
    if (decisions.length > 0 && actionItems.length > 0) {
      line2 = decisions.length + ' key decision' + (decisions.length > 1 ? 's were' : ' was') + ' reached and ' + actionItems.length + ' action item' + (actionItems.length > 1 ? 's were' : ' was') + ' assigned.';
    } else if (decisions.length > 0) {
      line2 = decisions.length + ' key decision' + (decisions.length > 1 ? 's were' : ' was') + ' reached during the discussion.';
    } else if (actionItems.length > 0) {
      line2 = actionItems.length + ' action item' + (actionItems.length > 1 ? 's were' : ' was') + ' identified for follow-through.';
    } else {
      line2 = 'The meeting was primarily informational with no formal decisions or action items recorded.';
    }

    var line3 = '';
    if (followups.length > 0) {
      line3 = followups.length + ' follow-up' + (followups.length > 1 ? 's require' : ' requires') + ' attention before the next engagement.';
    } else {
      line3 = 'No outstanding follow-ups were flagged.';
    }

    return line1 + ' ' + line2 + ' ' + line3;
  }

  function calculateEffectivenessScore(text, decisions, actionItems, followups) {
    var lines = text.split(/[\n]+/).filter(function(l){ return l.trim().length > 5; });
    var totalTopics = Math.max(lines.length, 1);
    var outcomes = decisions.length + actionItems.length;

    // Base score from decisions-to-topics ratio
    var ratio = Math.min(outcomes / totalTopics, 1);
    var score = Math.round(ratio * 60);

    // Bonus for having clear owners on action items
    var ownedItems = actionItems.filter(function(item){ return item.owner && item.owner !== 'TBD'; });
    if (actionItems.length > 0) {
      score += Math.round((ownedItems.length / actionItems.length) * 15);
    }

    // Bonus for having deadlines
    var datedItems = actionItems.filter(function(item){ return item.deadline && item.deadline !== 'TBD'; });
    if (actionItems.length > 0) {
      score += Math.round((datedItems.length / actionItems.length) * 15);
    }

    // Bonus for follow-ups (shows forward thinking)
    if (followups.length > 0) score += 5;

    // Bonus for having decisions
    if (decisions.length > 0) score += 5;

    score = Math.min(score, 100);

    var label, color;
    if (score >= 80) { label = 'Highly Effective'; color = 'var(--green)'; }
    else if (score >= 60) { label = 'Effective'; color = 'var(--blue)'; }
    else if (score >= 40) { label = 'Moderately Effective'; color = 'var(--yellow)'; }
    else { label = 'Needs Improvement'; color = 'var(--red)'; }

    return { score: score, label: label, color: color };
  }

  function estimateActionTime(actionText) {
    var lower = actionText.toLowerCase();
    // Quick tasks (< 1 hour)
    if (/\b(send|email|forward|share|reply|respond|ping|notify|message|call|quick)\b/.test(lower)) {
      return { estimate: '15-30 min', category: 'quick' };
    }
    // Short tasks (1-4 hours)
    if (/\b(review|check|update|edit|fix|revise|tweak|adjust|minor|small)\b/.test(lower)) {
      return { estimate: '1-4 hours', category: 'short' };
    }
    // Medium tasks (half day to full day)
    if (/\b(draft|prepare|create|write|design|analyze|research|compile|document|report)\b/.test(lower)) {
      return { estimate: '4-8 hours', category: 'medium' };
    }
    // Large tasks (multi-day)
    if (/\b(build|develop|implement|migrate|set up|configure|deploy|integrate|launch|overhaul|rebuild|redesign|architect|refactor)\b/.test(lower)) {
      return { estimate: '1-3 days', category: 'large' };
    }
    // Default
    return { estimate: '1-2 hours', category: 'short' };
  }

  function detectDependencies(actionItems) {
    var deps = [];
    for (var i = 0; i < actionItems.length; i++) {
      var lowerI = actionItems[i].action.toLowerCase();
      for (var j = 0; j < actionItems.length; j++) {
        if (i === j) continue;
        var lowerJ = actionItems[j].action.toLowerCase();
        // Check if item i mentions something item j produces
        var dependencyPatterns = [
          { produces: /\b(send|provide|deliver|share|create|prepare|draft|finalize)\b/, consumes: /\b(after|once|when|upon|pending|waiting|based on|using|with)\b/ },
        ];
        // Check for explicit dependency keywords
        if (/\b(after|once|depends on|blocked by|waiting for|needs?)\b/.test(lowerI)) {
          // See if item i references the owner or subject of item j
          var ownerJ = actionItems[j].owner.toLowerCase();
          if (ownerJ !== 'tbd' && lowerI.indexOf(ownerJ.toLowerCase()) !== -1) {
            deps.push({ from: j, to: i, reason: 'Depends on ' + actionItems[j].owner + '\'s task' });
            continue;
          }
        }
        // Check for sequential keywords suggesting order
        if (/\b(set up|setup|configure|install|staging)\b/.test(lowerJ) && /\b(deploy|launch|test|review|use)\b/.test(lowerI)) {
          deps.push({ from: j, to: i, reason: 'Setup needed first' });
        }
        if (/\b(wireframe|design|mockup)\b/.test(lowerJ) && /\b(develop|build|implement|code)\b/.test(lowerI)) {
          deps.push({ from: j, to: i, reason: 'Design needed before development' });
        }
        if (/\b(draft|write|prepare)\b/.test(lowerJ) && /\b(review|approve|sign off|finalize)\b/.test(lowerI)) {
          deps.push({ from: j, to: i, reason: 'Draft needed before review' });
        }
      }
    }
    // Deduplicate
    var seen = {};
    return deps.filter(function(d) {
      var key = d.from + '->' + d.to;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function escHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ========== UI CREATION ==========
  function createSmartSummaryUI() {
    var resultsContent = document.getElementById('resultsContent');
    if (!resultsContent) return;

    // Check if already exists
    if (document.getElementById('smartSummaryCard')) return;

    // Create the toggle button in the export bar area
    var exportBar = resultsContent.querySelector('.export-bar');
    if (exportBar) {
      var toggleBtn = document.createElement('button');
      toggleBtn.className = 'export-btn';
      toggleBtn.id = 'smartSummaryToggle';
      toggleBtn.innerHTML = '&#9889; Smart Summary';
      toggleBtn.style.cssText = 'background:linear-gradient(135deg,rgba(255,136,68,0.15),rgba(0,255,136,0.1));border-color:var(--orange);color:var(--orange)';
      toggleBtn.addEventListener('click', function() {
        generateSmartSummary();
      });
      exportBar.appendChild(toggleBtn);
    }

    // Create the card container (hidden by default)
    var card = document.createElement('div');
    card.id = 'smartSummaryCard';
    card.style.cssText = 'display:none;margin-bottom:2rem';
    card.innerHTML = '<div id="smartSummaryContent"></div>';

    // Insert after the followups section
    var followupsSection = document.getElementById('followupsSection');
    if (followupsSection && followupsSection.parentNode) {
      followupsSection.parentNode.insertBefore(card, followupsSection.nextSibling);
    } else {
      resultsContent.appendChild(card);
    }
  }

  function generateSmartSummary() {
    var text = (document.getElementById('notesInput').value || '').trim();
    if (!text) return;

    var card = document.getElementById('smartSummaryCard');
    var content = document.getElementById('smartSummaryContent');
    if (!card || !content) return;

    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Parse data from the existing tool
    var decisions = extractDecisions(text);
    var actionItems = extractActionItems(text);
    var followups = extractFollowups(text);
    var people = extractPeople(text);

    // Analyses
    var sentiment = analyzeSentiment(text);
    var themes = extractKeyThemes(text);
    var effectiveness = calculateEffectivenessScore(text, decisions, actionItems, followups);
    var executiveSummary = generateExecutiveSummary(text, decisions, actionItems, followups, people);
    var dependencies = detectDependencies(actionItems);

    // Build HTML
    var html = '';

    // Header
    html += '<div style="background:linear-gradient(135deg,rgba(255,136,68,0.08),rgba(0,255,136,0.05));border:1px solid rgba(255,136,68,0.2);border-radius:var(--radius);overflow:hidden">';
    html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between">';
    html += '<div style="display:flex;align-items:center;gap:0.5rem"><div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--orange),var(--green));display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:900;color:#000">AI</div>';
    html += '<span style="font-size:1.1rem;font-weight:800">Smart Summary</span></div>';
    html += '<span style="font-size:0.7rem;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px">AI-Enhanced Analysis</span>';
    html += '</div>';

    // Executive Summary
    html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.04)">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem">Executive Summary</div>';
    html += '<p style="font-size:0.9rem;color:var(--text);line-height:1.7;margin:0">' + escHtml(executiveSummary) + '</p>';
    html += '</div>';

    // Score row: Sentiment + Effectiveness
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid rgba(255,255,255,0.04)">';

    // Sentiment
    html += '<div style="padding:1.25rem 1.5rem;border-right:1px solid rgba(255,255,255,0.04)">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Meeting Tone</div>';
    html += '<div style="display:flex;align-items:center;gap:0.75rem">';
    html += '<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid ' + sentiment.color + ';display:flex;align-items:center;justify-content:center;font-size:1.4rem">';
    if (sentiment.label === 'Positive') html += '&#128578;';
    else if (sentiment.label === 'Negative') html += '&#128533;';
    else html += '&#128528;';
    html += '</div>';
    html += '<div><div style="font-size:1.1rem;font-weight:800;color:' + sentiment.color + '">' + sentiment.label + '</div>';
    html += '<div style="font-size:0.75rem;color:var(--text3)">' + sentiment.score + '% confidence</div></div>';
    html += '</div></div>';

    // Effectiveness
    html += '<div style="padding:1.25rem 1.5rem">';
    html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Effectiveness Score</div>';
    html += '<div style="display:flex;align-items:center;gap:0.75rem">';
    html += '<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.05);border:2px solid ' + effectiveness.color + ';display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:' + effectiveness.color + '">' + effectiveness.score + '</div>';
    html += '<div><div style="font-size:1.1rem;font-weight:800;color:' + effectiveness.color + '">' + effectiveness.label + '</div>';
    html += '<div style="font-size:0.75rem;color:var(--text3)">Decisions / Topics ratio</div></div>';
    html += '</div>';
    // Progress bar
    html += '<div style="margin-top:0.5rem;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">';
    html += '<div style="height:100%;width:' + effectiveness.score + '%;background:' + effectiveness.color + ';border-radius:2px;transition:width 0.6s"></div>';
    html += '</div></div>';

    html += '</div>'; // end score row

    // Key Themes
    if (themes.length > 0) {
      html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.04)">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Key Themes &amp; Topics</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.5rem">';
      var themeColors = ['var(--orange)', 'var(--green)', 'var(--blue)', 'var(--yellow)', 'var(--red)'];
      themes.forEach(function(theme, idx) {
        var tc = themeColors[idx % themeColors.length];
        html += '<div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);padding:0.75rem 1rem">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem">';
        html += '<span style="font-size:0.88rem;font-weight:700;color:' + tc + '">' + escHtml(theme.label) + '</span>';
        html += '<span style="font-size:0.7rem;color:var(--text3)">' + theme.mentions + ' mention' + (theme.mentions > 1 ? 's' : '') + '</span>';
        html += '</div>';
        var bullets = extractTopicBullets(text, theme);
        if (bullets.length > 0) {
          html += '<ul style="margin:0.25rem 0 0;padding-left:1.2rem;list-style:disc">';
          bullets.forEach(function(b) {
            html += '<li style="font-size:0.82rem;color:var(--text2);line-height:1.5;margin-bottom:0.15rem">' + escHtml(b) + '</li>';
          });
          html += '</ul>';
        }
        html += '</div>';
      });
      html += '</div></div>';
    }

    // Action Item Time Estimates
    if (actionItems.length > 0) {
      html += '<div style="padding:1.25rem 1.5rem;border-bottom:1px solid rgba(255,255,255,0.04)">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Action Item Time Estimates</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.4rem">';
      var totalMinMinutes = 0;
      var totalMaxMinutes = 0;
      actionItems.forEach(function(item, idx) {
        var est = estimateActionTime(item.action);
        var catColors = { quick: 'var(--green)', short: 'var(--blue)', medium: 'var(--yellow)', large: 'var(--red)' };
        var catColor = catColors[est.category] || 'var(--text2)';
        // Estimate mins for total
        var mins = { quick: [15, 30], short: [60, 240], medium: [240, 480], large: [480, 1440] };
        var range = mins[est.category] || [60, 120];
        totalMinMinutes += range[0];
        totalMaxMinutes += range[1];

        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;background:rgba(255,255,255,0.02);border-radius:6px">';
        html += '<div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0">';
        html += '<span style="font-size:0.75rem;color:var(--text3);flex-shrink:0">#' + (idx + 1) + '</span>';
        html += '<span style="font-size:0.82rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escHtml(item.action.substring(0, 80)) + '</span>';
        html += '</div>';
        html += '<span style="font-size:0.75rem;font-weight:700;color:' + catColor + ';flex-shrink:0;margin-left:0.5rem;white-space:nowrap">' + est.estimate + '</span>';
        html += '</div>';
      });
      // Total estimate
      var formatTime = function(m) {
        if (m < 60) return m + ' min';
        if (m < 480) return Math.round(m / 60) + ' hr' + (Math.round(m / 60) > 1 ? 's' : '');
        return Math.round(m / 480) + ' day' + (Math.round(m / 480) > 1 ? 's' : '');
      };
      html += '<div style="margin-top:0.5rem;padding:0.6rem 0.75rem;background:rgba(255,136,68,0.08);border:1px solid rgba(255,136,68,0.15);border-radius:6px;display:flex;justify-content:space-between;align-items:center">';
      html += '<span style="font-size:0.82rem;font-weight:700;color:var(--orange)">Total Estimated Effort</span>';
      html += '<span style="font-size:0.82rem;font-weight:700;color:var(--text)">' + formatTime(totalMinMinutes) + ' - ' + formatTime(totalMaxMinutes) + '</span>';
      html += '</div>';
      html += '</div></div>';
    }

    // Dependencies
    if (dependencies.length > 0) {
      html += '<div style="padding:1.25rem 1.5rem">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.75rem">Action Item Dependencies</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.4rem">';
      dependencies.forEach(function(dep) {
        var fromItem = actionItems[dep.from];
        var toItem = actionItems[dep.to];
        if (!fromItem || !toItem) return;
        html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;background:rgba(100,180,255,0.05);border:1px solid rgba(100,180,255,0.12);border-radius:6px;font-size:0.82rem">';
        html += '<span style="color:var(--blue);font-weight:700;flex-shrink:0">#' + (dep.from + 1) + '</span>';
        html += '<span style="color:var(--text3)">&#8594;</span>';
        html += '<span style="color:var(--blue);font-weight:700;flex-shrink:0">#' + (dep.to + 1) + '</span>';
        html += '<span style="color:var(--text2);margin-left:0.25rem">' + escHtml(dep.reason) + '</span>';
        html += '</div>';
      });
      html += '</div></div>';
    } else if (actionItems.length > 1) {
      html += '<div style="padding:1.25rem 1.5rem">';
      html += '<div style="font-size:0.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.5rem">Action Item Dependencies</div>';
      html += '<p style="font-size:0.82rem;color:var(--text3);margin:0">No dependencies detected between action items. All tasks can proceed in parallel.</p>';
      html += '</div>';
    }

    html += '</div>'; // end main card

    content.innerHTML = html;

    dataLayer.push({ event: 'tool_used', tool_name: 'meeting-notes', action: 'smart_summary_generated' });
  }

  // ========== HOOK INTO EXISTING FLOW ==========
  // Observe the results content to inject UI when results appear
  var resultsContent = document.getElementById('resultsContent');
  if (resultsContent) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (resultsContent.style.display !== 'none') {
          createSmartSummaryUI();
        }
      });
    });
    observer.observe(resultsContent, { attributes: true, attributeFilter: ['style'] });
  }

  // Also hook into the summarizeNotes call to reset smart summary
  var origSummarize = window.summarizeNotes;
  if (typeof origSummarize === 'function') {
    window.summarizeNotes = function() {
      // Hide smart summary when re-analyzing
      var card = document.getElementById('smartSummaryCard');
      if (card) card.style.display = 'none';
      origSummarize.apply(this, arguments);
    };
  }

});
})();
