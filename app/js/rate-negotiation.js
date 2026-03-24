/**
 * [CF-164] Rate Negotiation Simulator
 * Practice rate negotiations with AI playing the client role, get scored on outcome.
 * Exposed on window.CortexFreelancer.RateNegotiation
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'cortex_rate_negotiation';
  var HISTORY_KEY = 'cortex_rate_negotiation_history';

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveHistory(h) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); }
    catch (e) {}
  }

  function escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Client Personas ──

  var PERSONAS = {
    budget_conscious: {
      name: 'Budget-Conscious Startup',
      icon: '💼',
      description: 'Early-stage startup with limited funding. Pushes hard on price but values quality.',
      maxBudget: 0.7,    // will go up to 70% of your rate
      aggressiveness: 0.8,
      responses: {
        initial: [
          "Thanks for the proposal. Your rate of $RATE/hr is honestly above our budget. We were thinking more like $COUNTER/hr. Can we make this work?",
          "We really like your portfolio, but $RATE/hr is steep for a startup like us. Our budget allows for about $COUNTER/hr. Any flexibility?"
        ],
        pushback: [
          "I hear you on the value, but we simply don't have the runway for $RATE/hr right now. Could we meet somewhere around $COUNTER/hr?",
          "We'd love to work with you, but our board has approved a max of $COUNTER/hr for this project. Is there a way to scope it differently?"
        ],
        concession: [
          "Okay, I can see the value you'd bring. We could stretch to $COUNTER/hr if you can commit to a 3-month engagement.",
          "Fair points. Let me talk to my co-founder — I think we could do $COUNTER/hr with a slightly reduced scope."
        ],
        accept: [
          "You've made a compelling case. Let's go with $RATE/hr. Welcome aboard!",
          "Alright, I'm convinced. $RATE/hr it is — let's get started."
        ],
        reject: [
          "I appreciate the discussion, but that's simply beyond what we can afford right now. Maybe in the future.",
          "Thanks for your time. We'll need to look at other options that fit our budget better."
        ]
      }
    },
    enterprise: {
      name: 'Enterprise Client',
      icon: '🏢',
      description: 'Large company with budget but strict procurement processes. Values credentials.',
      maxBudget: 0.95,
      aggressiveness: 0.5,
      responses: {
        initial: [
          "We've reviewed your proposal at $RATE/hr. Our typical rate band for this role is $COUNTER–$MID/hr. How did you arrive at your rate?",
          "Your rate of $RATE/hr is noted. For context, our procurement guidelines suggest $COUNTER/hr for similar engagements. Can you justify the premium?"
        ],
        pushback: [
          "I understand your experience, but we need to stay within approved rate bands. Could you consider $COUNTER/hr with the possibility of rate review after 6 months?",
          "Our internal benchmark is $COUNTER/hr. We can add performance bonuses if deliverables exceed expectations. Would that work?"
        ],
        concession: [
          "Your credentials are strong. I'll escalate this — I think we can approve $COUNTER/hr given your specialized expertise.",
          "Let me put in a rate exception request. I'm fairly confident we can do $COUNTER/hr. The project visibility alone should be valuable for your portfolio."
        ],
        accept: [
          "Approved. We'll proceed at $RATE/hr. I'll have procurement send over the SOW.",
          "That rate works within our exception process. $RATE/hr is confirmed. Let's align on timelines."
        ],
        reject: [
          "Unfortunately, we can't get approval beyond our rate band. Perhaps we can revisit this for a future project.",
          "The budget committee has declined the rate exception. We'll need to go with another vendor this time."
        ]
      }
    },
    seasoned_buyer: {
      name: 'Seasoned Freelance Buyer',
      icon: '🎯',
      description: 'Experienced in hiring freelancers. Knows market rates and uses negotiation tactics.',
      maxBudget: 0.85,
      aggressiveness: 0.7,
      responses: {
        initial: [
          "I've hired 50+ freelancers for similar work and typically pay $COUNTER–$MID/hr. Your ask of $RATE/hr is above market. What makes you different?",
          "Interesting portfolio. But $RATE/hr? I just wrapped a similar project with someone at $COUNTER/hr. Why should I pay a premium?"
        ],
        pushback: [
          "Look, I've seen your work and it's good — but not $RATE/hr good in this market. I can get comparable quality at $COUNTER/hr. Convince me otherwise.",
          "I respect the hustle, but my last three hires for this exact skill set averaged $COUNTER/hr. I need concrete ROI justification."
        ],
        concession: [
          "Okay, you've made some valid points. I could go to $COUNTER/hr, but I'll need you to include one round of revisions at no extra cost.",
          "Fine, I see the value-add. $COUNTER/hr works if you can guarantee the timeline. Deal?"
        ],
        accept: [
          "Sold. $RATE/hr it is. You clearly know your worth — I respect that. Let's get to work.",
          "You negotiated well. $RATE/hr, deal. I'll send the contract today."
        ],
        reject: [
          "Appreciate the conversation, but I've got two other candidates at $COUNTER/hr who can deliver. Going to pass.",
          "Good talk, but the numbers don't work. I'll reach out if my budget changes."
        ]
      }
    }
  };

  // ── Negotiation Engine ──

  var NEGOTIATION_TIPS = {
    value_framing: { text: 'Frame your rate in terms of value delivered, not hours worked.', points: 15 },
    market_data: { text: 'Reference market data or benchmarks to justify your rate.', points: 12 },
    portfolio_proof: { text: 'Point to specific past results or portfolio pieces.', points: 10 },
    scarcity: { text: 'Mention your limited availability or high demand.', points: 8 },
    package_offer: { text: 'Offer package deals or milestone-based pricing.', points: 10 },
    walk_away: { text: 'Show willingness to walk away — don\'t seem desperate.', points: 12 },
    anchoring: { text: 'Start higher than your target to leave room for negotiation.', points: 10 },
    concession_trade: { text: 'When conceding on price, ask for something in return.', points: 15 }
  };

  function detectTactics(message) {
    var msg = message.toLowerCase();
    var found = [];

    if (/value|roi|return|save|increase|revenue|growth|result/i.test(msg)) found.push('value_framing');
    if (/market|average|typical|benchmark|industry|rate.*data|going rate/i.test(msg)) found.push('market_data');
    if (/portfolio|previous|past project|client.*said|case study|delivered/i.test(msg)) found.push('portfolio_proof');
    if (/busy|booked|limited|availability|demand|waitlist|schedule/i.test(msg)) found.push('scarcity');
    if (/package|bundle|milestone|fixed price|retainer|monthly/i.test(msg)) found.push('package_offer');
    if (/understand|respect|perhaps.*not.*fit|other opportunities|walk away|pass/i.test(msg)) found.push('walk_away');
    if (/start.*at|initial.*rate|normally charge/i.test(msg)) found.push('anchoring');
    if (/if.*then|in exchange|trade|reduce.*scope|fewer revision|in return/i.test(msg)) found.push('concession_trade');

    return found;
  }

  function generateClientResponse(persona, state, userMessage) {
    var p = PERSONAS[persona];
    if (!p) return { message: 'Error: unknown persona', phase: 'end' };

    var tactics = detectTactics(userMessage);
    var tacticsScore = 0;
    tactics.forEach(function (t) {
      if (NEGOTIATION_TIPS[t]) tacticsScore += NEGOTIATION_TIPS[t].points;
    });

    var yourRate = state.yourRate;
    var counterRate = Math.round(yourRate * (1 - p.aggressiveness * 0.4));
    var midRate = Math.round((yourRate + counterRate) / 2);
    var roundNum = state.round || 1;

    // Determine phase based on round and tactics
    var phase;
    var responsePool;
    var offeredRate;

    if (roundNum === 1) {
      phase = 'initial';
      offeredRate = counterRate;
    } else if (roundNum <= 3) {
      if (tacticsScore >= 25) {
        phase = 'concession';
        offeredRate = Math.round(counterRate + (yourRate - counterRate) * Math.min(0.6 + tacticsScore * 0.005, 0.9));
      } else {
        phase = 'pushback';
        offeredRate = Math.round(counterRate + (yourRate - counterRate) * 0.2);
      }
    } else {
      // Final round
      var totalTactics = state.totalTacticsScore + tacticsScore;
      if (totalTactics >= 60) {
        phase = 'accept';
        offeredRate = Math.round(yourRate * (0.85 + Math.min(totalTactics * 0.002, 0.15)));
      } else if (totalTactics >= 30) {
        phase = 'concession';
        offeredRate = Math.round(yourRate * p.maxBudget);
      } else {
        phase = 'reject';
        offeredRate = counterRate;
      }
    }

    responsePool = p.responses[phase];
    var template = responsePool[Math.floor(Math.random() * responsePool.length)];

    var message = template
      .replace(/\$RATE/g, yourRate)
      .replace(/\$COUNTER/g, offeredRate)
      .replace(/\$MID/g, midRate);

    return {
      message: message,
      phase: phase,
      offeredRate: offeredRate,
      tacticsUsed: tactics,
      tacticsScore: tacticsScore
    };
  }

  function scoreNegotiation(state) {
    var maxScore = 100;
    var score = 0;

    // Rate achievement (0-40 points)
    var rateRatio = (state.finalRate || state.yourRate * 0.7) / state.yourRate;
    score += Math.round(rateRatio * 40);

    // Tactics diversity (0-30 points)
    var uniqueTactics = {};
    (state.allTactics || []).forEach(function (t) { uniqueTactics[t] = true; });
    var tacticCount = Object.keys(uniqueTactics).length;
    score += Math.min(tacticCount * 5, 30);

    // Rounds efficiency (0-15 points) — fewer rounds is better
    var rounds = state.round || 1;
    if (rounds <= 2) score += 15;
    else if (rounds <= 3) score += 10;
    else if (rounds <= 4) score += 5;

    // Professionalism (0-15 points) — based on tactics score
    score += Math.min(Math.round((state.totalTacticsScore || 0) * 0.15), 15);

    score = Math.min(score, maxScore);

    var grade;
    if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 55) grade = 'C';
    else if (score >= 40) grade = 'D';
    else grade = 'F';

    var feedback = [];
    var tipKeys = Object.keys(NEGOTIATION_TIPS);
    tipKeys.forEach(function (key) {
      if (!uniqueTactics[key]) {
        feedback.push('Try: ' + NEGOTIATION_TIPS[key].text);
      }
    });

    return {
      score: score,
      grade: grade,
      rateAchieved: Math.round(rateRatio * 100),
      uniqueTactics: tacticCount,
      totalTactics: Object.keys(NEGOTIATION_TIPS).length,
      feedback: feedback.slice(0, 4)
    };
  }

  // ── Styles ──

  var styles = '\
    .rn-wrap{font-family:Inter,-apple-system,sans-serif;color:var(--text,#e0e0e0);max-width:800px;margin:0 auto;padding:1.5rem 1rem}\
    .rn-wrap h2{margin:0 0 .3rem;font-size:1.4rem;color:var(--text-bright,#fff)}\
    .rn-subtitle{color:var(--text-dim,#888);font-size:.85rem;margin-bottom:1.5rem}\
    .rn-card{background:var(--bg-card,#111);border:1px solid var(--border,#222);border-radius:var(--radius,12px);padding:1.2rem;margin-bottom:1rem}\
    .rn-card h3{margin:0 0 .75rem;font-size:1rem;color:var(--text-bright,#fff)}\
    .rn-personas{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem;margin-bottom:1.5rem}\
    .rn-persona{background:var(--bg-card,#111);border:2px solid var(--border,#222);border-radius:var(--radius,12px);padding:1rem;cursor:pointer;transition:all .2s;text-align:center}\
    .rn-persona:hover{border-color:var(--orange,#ff8844);background:var(--bg-card-hover,#1a1a1a)}\
    .rn-persona.selected{border-color:var(--orange,#ff8844);background:rgba(255,136,68,.06)}\
    .rn-persona-icon{font-size:2rem;margin-bottom:.4rem}\
    .rn-persona-name{font-weight:600;font-size:.9rem;color:var(--text-bright,#fff);margin-bottom:.25rem}\
    .rn-persona-desc{font-size:.75rem;color:var(--text-dim,#888)}\
    .rn-field{margin-bottom:.75rem}\
    .rn-field label{display:block;font-size:.78rem;color:var(--text-dim,#888);margin-bottom:.25rem}\
    .rn-field input{width:100%;padding:.5rem .65rem;background:var(--bg,#0a0a0a);border:1px solid var(--border,#222);border-radius:var(--radius-sm,8px);color:var(--text,#e0e0e0);font-size:.85rem;box-sizing:border-box}\
    .rn-btn{background:var(--orange,#ff8844);color:#000;border:none;padding:.55rem 1.1rem;border-radius:var(--radius-sm,8px);cursor:pointer;font-size:.85rem;font-weight:600;transition:opacity .2s}\
    .rn-btn:hover{opacity:.85}\
    .rn-btn-outline{background:transparent;border:1px solid var(--border,#222);color:var(--text,#e0e0e0)}\
    .rn-btn-outline:hover{border-color:var(--orange,#ff8844);color:var(--orange,#ff8844)}\
    .rn-chat{max-height:400px;overflow-y:auto;padding:.5rem 0}\
    .rn-msg{margin-bottom:.75rem;display:flex;gap:.6rem}\
    .rn-msg-client .rn-bubble{background:var(--bg,#0a0a0a);border:1px solid var(--border,#222)}\
    .rn-msg-you .rn-bubble{background:rgba(255,136,68,.08);border:1px solid rgba(255,136,68,.2);margin-left:auto}\
    .rn-bubble{border-radius:var(--radius-sm,8px);padding:.65rem .85rem;max-width:85%;font-size:.85rem;line-height:1.5}\
    .rn-msg-label{font-size:.7rem;font-weight:600;color:var(--text-dim,#888);margin-bottom:.2rem}\
    .rn-input-row{display:flex;gap:.5rem;margin-top:.75rem}\
    .rn-input-row input{flex:1}\
    .rn-tactics{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.4rem}\
    .rn-tactic-tag{padding:.15rem .45rem;border-radius:4px;font-size:.68rem;background:rgba(0,255,136,.1);color:var(--green,#00ff88)}\
    .rn-score-card{text-align:center;padding:1.5rem}\
    .rn-grade{font-size:3.5rem;font-weight:800;margin:.5rem 0}\
    .rn-grade-A{color:var(--green,#00ff88)}.rn-grade-B{color:var(--blue,#4488ff)}.rn-grade-C{color:var(--orange,#ff8844)}.rn-grade-D,.rn-grade-F{color:var(--red,#ff4444)}\
    .rn-score-detail{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;text-align:left;margin-top:1rem}\
    .rn-score-item{background:var(--bg,#0a0a0a);border-radius:var(--radius-sm,8px);padding:.65rem}\
    .rn-score-label{font-size:.72rem;color:var(--text-dim,#888)}\
    .rn-score-value{font-size:1.1rem;font-weight:700;color:var(--text-bright,#fff)}\
    .rn-tips{margin-top:1rem;text-align:left}\
    .rn-tips li{font-size:.8rem;color:var(--text,#e0e0e0);margin:.35rem 0}\
    @media(max-width:600px){.rn-personas{grid-template-columns:1fr}.rn-score-detail{grid-template-columns:1fr}}\
  ';

  // ── Render ──

  function render(containerId) {
    if (!document.getElementById('rn-styles')) {
      var s = document.createElement('style');
      s.id = 'rn-styles';
      s.textContent = styles;
      document.head.appendChild(s);
    }

    var container = document.getElementById(containerId);
    if (!container) return;

    var html = '<div class="rn-wrap">';
    html += '<h2>Rate Negotiation Simulator</h2>';
    html += '<p class="rn-subtitle">Practice negotiating your rate with simulated clients. Get scored on your technique.</p>';

    // Setup phase
    html += '<div id="rn-setup">';
    html += '<div class="rn-card"><h3>Choose a Client Persona</h3>';
    html += '<div class="rn-personas">';
    Object.keys(PERSONAS).forEach(function (key) {
      var p = PERSONAS[key];
      html += '<div class="rn-persona" data-persona="' + key + '">';
      html += '<div class="rn-persona-icon">' + p.icon + '</div>';
      html += '<div class="rn-persona-name">' + escHtml(p.name) + '</div>';
      html += '<div class="rn-persona-desc">' + escHtml(p.description) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    html += '<div class="rn-card"><h3>Your Rate</h3>';
    html += '<div class="rn-field"><label>Your Desired Hourly Rate ($)</label><input type="number" id="rn-rate" min="10" max="1000" value="75" placeholder="75"></div>';
    html += '<div class="rn-field"><label>Your Skill / Service</label><input id="rn-skill" placeholder="e.g., React Development, UI/UX Design"></div>';
    html += '<button class="rn-btn" id="rn-start" style="width:100%;margin-top:.5rem" disabled>Select a Persona to Begin</button>';
    html += '</div></div>';

    // Chat phase (hidden initially)
    html += '<div id="rn-chat-phase" style="display:none">';
    html += '<div class="rn-card"><h3>Negotiation in Progress <span id="rn-round-badge" style="float:right;font-size:.75rem;color:var(--text-dim,#888)"></span></h3>';
    html += '<div class="rn-chat" id="rn-chat-log"></div>';
    html += '<div class="rn-input-row"><input id="rn-user-input" placeholder="Type your response..." maxlength="500"><button class="rn-btn" id="rn-send">Send</button></div>';
    html += '<div style="display:flex;gap:.4rem;margin-top:.5rem"><button class="rn-btn rn-btn-outline" id="rn-accept-offer" style="font-size:.78rem">Accept Their Offer</button><button class="rn-btn rn-btn-outline" id="rn-walk-away" style="font-size:.78rem">Walk Away</button></div>';
    html += '</div></div>';

    // Results phase (hidden initially)
    html += '<div id="rn-results-phase" style="display:none"></div>';

    // History
    var history = loadHistory();
    if (history.length) {
      html += '<div class="rn-card" style="margin-top:1rem"><h3>Past Sessions</h3>';
      history.slice(0, 8).forEach(function (item) {
        var d = new Date(item.date);
        html += '<div style="display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--border,#222);font-size:.82rem">';
        html += '<span>' + escHtml(PERSONAS[item.persona] ? PERSONAS[item.persona].name : item.persona) + ' — $' + item.yourRate + '/hr</span>';
        html += '<span style="color:var(--text-dim,#888)">Grade: <strong>' + item.grade + '</strong> &middot; $' + item.finalRate + '/hr &middot; ' + d.toLocaleDateString() + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // ── Interactive state ──
    var state = {
      persona: null,
      yourRate: 75,
      round: 0,
      messages: [],
      allTactics: [],
      totalTacticsScore: 0,
      finalRate: 0,
      lastOfferedRate: 0
    };

    // Persona selection
    container.addEventListener('click', function (e) {
      var personaEl = e.target.closest('.rn-persona');
      if (personaEl) {
        container.querySelectorAll('.rn-persona').forEach(function (p) { p.classList.remove('selected'); });
        personaEl.classList.add('selected');
        state.persona = personaEl.getAttribute('data-persona');
        var btn = document.getElementById('rn-start');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Start Negotiation with ' + PERSONAS[state.persona].name;
        }
      }

      // Start
      if (e.target.id === 'rn-start' && state.persona) {
        state.yourRate = parseInt(document.getElementById('rn-rate').value) || 75;
        state.round = 1;
        document.getElementById('rn-setup').style.display = 'none';
        document.getElementById('rn-chat-phase').style.display = 'block';

        // Client opens
        var response = generateClientResponse(state.persona, state, '');
        state.lastOfferedRate = response.offeredRate;
        addMessage('client', response.message, []);
        updateRoundBadge();
        document.getElementById('rn-user-input').focus();
      }

      // Send
      if (e.target.id === 'rn-send') sendUserMessage();

      // Accept offer
      if (e.target.id === 'rn-accept-offer') {
        state.finalRate = state.lastOfferedRate;
        showResults(containerId);
      }

      // Walk away
      if (e.target.id === 'rn-walk-away') {
        addMessage('you', "I appreciate your time, but I don't think we can reach an agreement. Best of luck with the project.");
        state.finalRate = 0;
        showResults(containerId);
      }

      // New session
      if (e.target.id === 'rn-new-session') {
        render(containerId);
      }
    });

    // Enter key
    container.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.id === 'rn-user-input') {
        sendUserMessage();
      }
    });

    function sendUserMessage() {
      var input = document.getElementById('rn-user-input');
      if (!input) return;
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';

      state.round++;
      var tactics = detectTactics(msg);
      state.allTactics = state.allTactics.concat(tactics);

      addMessage('you', msg, tactics);

      var response = generateClientResponse(state.persona, state, msg);
      state.totalTacticsScore += response.tacticsScore;
      state.lastOfferedRate = response.offeredRate;

      setTimeout(function () {
        addMessage('client', response.message, []);
        updateRoundBadge();

        if (response.phase === 'accept') {
          state.finalRate = state.yourRate;
          setTimeout(function () { showResults(containerId); }, 1500);
        } else if (response.phase === 'reject') {
          state.finalRate = 0;
          setTimeout(function () { showResults(containerId); }, 1500);
        }
      }, 600);
    }

    function addMessage(sender, text, tactics) {
      var chatLog = document.getElementById('rn-chat-log');
      if (!chatLog) return;
      var div = document.createElement('div');
      div.className = 'rn-msg rn-msg-' + sender;
      var label = sender === 'client' ? (PERSONAS[state.persona] ? PERSONAS[state.persona].name : 'Client') : 'You';
      var html = '<div><div class="rn-msg-label">' + escHtml(label) + '</div><div class="rn-bubble">' + escHtml(text) + '</div>';
      if (tactics && tactics.length) {
        html += '<div class="rn-tactics">';
        tactics.forEach(function (t) {
          html += '<span class="rn-tactic-tag">' + escHtml(t.replace(/_/g, ' ')) + '</span>';
        });
        html += '</div>';
      }
      html += '</div>';
      div.innerHTML = html;
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function updateRoundBadge() {
      var badge = document.getElementById('rn-round-badge');
      if (badge) badge.textContent = 'Round ' + state.round + ' of 5';
    }

    function showResults(cid) {
      var result = scoreNegotiation(state);
      document.getElementById('rn-chat-phase').style.display = 'none';
      var resultsDiv = document.getElementById('rn-results-phase');
      resultsDiv.style.display = 'block';

      var html = '<div class="rn-card rn-score-card">';
      html += '<h3>Negotiation Complete</h3>';
      html += '<div class="rn-grade rn-grade-' + result.grade + '">' + result.grade + '</div>';
      html += '<div style="font-size:.9rem;color:var(--text-dim,#888)">Score: ' + result.score + '/100</div>';

      html += '<div class="rn-score-detail">';
      html += '<div class="rn-score-item"><div class="rn-score-label">Rate Achieved</div><div class="rn-score-value">' + result.rateAchieved + '%</div></div>';
      html += '<div class="rn-score-item"><div class="rn-score-label">Final Rate</div><div class="rn-score-value">$' + (state.finalRate || 'N/A') + '/hr</div></div>';
      html += '<div class="rn-score-item"><div class="rn-score-label">Tactics Used</div><div class="rn-score-value">' + result.uniqueTactics + '/' + result.totalTactics + '</div></div>';
      html += '<div class="rn-score-item"><div class="rn-score-label">Rounds</div><div class="rn-score-value">' + state.round + '</div></div>';
      html += '</div>';

      if (result.feedback.length) {
        html += '<div class="rn-tips"><h4 style="font-size:.85rem;color:var(--text-bright,#fff);margin-bottom:.5rem">Tips for Next Time</h4><ul>';
        result.feedback.forEach(function (f) { html += '<li>' + escHtml(f) + '</li>'; });
        html += '</ul></div>';
      }

      html += '<button class="rn-btn" id="rn-new-session" style="margin-top:1.2rem">Try Again</button>';
      html += '</div>';
      resultsDiv.innerHTML = html;

      // Save to history
      var h = loadHistory();
      h.unshift({
        persona: state.persona,
        yourRate: state.yourRate,
        finalRate: state.finalRate,
        score: result.score,
        grade: result.grade,
        date: Date.now()
      });
      if (h.length > 20) h = h.slice(0, 20);
      saveHistory(h);
    }
  }

  // ── Public API ──

  var RateNegotiation = {
    init: function () {},
    render: render,
    getPersonas: function () { return Object.keys(PERSONAS); },
    getHistory: loadHistory,
    getTips: function () { return NEGOTIATION_TIPS; }
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.RateNegotiation = RateNegotiation;
})();
