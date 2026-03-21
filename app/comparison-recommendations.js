/* ===== [147] PROFILE COMPARISON + [148] PERSONALIZED RECOMMENDATIONS ===== */

window.toggleComparisonForm = function() {
  var form = document.getElementById('comparison-form');
  form.classList.toggle('visible');
};

window.runComparison = function() {
  var skill = document.getElementById('cmp-skill-select').value;
  var country = document.getElementById('cmp-country-select').value;
  var rate = parseInt(document.getElementById('cmp-rate-input').value) || 0;
  var exp = parseInt(document.getElementById('cmp-exp-input').value) || 0;
  if (!skill || !country) { toast('Select skill and country for comparison'); return; }
  if (!rate) { toast('Enter hourly rate for comparison'); return; }

  var seed = hashStr(skill + country + rate + exp + 'cmp');
  var profile2 = generateAnalysis({ skill: skill, country: country, rate: rate, exp: exp, seed: seed });
  var profile1 = window.analysisResult;

  var resultEl = document.getElementById('comparison-result');
  resultEl.style.display = 'block';

  var categories = [
    { label: 'Headline', v1: profile1.headline, v2: profile2.headline },
    { label: 'Overview', v1: profile1.overview, v2: profile2.overview },
    { label: 'Skills', v1: profile1.skillsScore, v2: profile2.skillsScore },
    { label: 'Portfolio', v1: profile1.portfolio, v2: profile2.portfolio },
    { label: 'Rate', v1: profile1.rateScore, v2: profile2.rateScore }
  ];

  var p1Win = profile1.totalScore >= profile2.totalScore;
  var p2Win = profile2.totalScore >= profile1.totalScore;

  function barHTML(cats, isProfile1) {
    return cats.map(function(c) {
      var v = isProfile1 ? c.v1 : c.v2;
      var other = isProfile1 ? c.v2 : c.v1;
      var colorClass = v >= other ? 'green' : 'orange';
      return '<div class="comparison-bar">' +
        '<span class="cb-label">' + c.label + '</span>' +
        '<div class="cb-track"><div class="cb-fill ' + colorClass + '" style="width:' + (v * 10) + '%"></div></div>' +
        '<span class="cb-val">' + v + '/10</span></div>';
    }).join('');
  }

  resultEl.innerHTML =
    '<div class="comparison-grid">' +
      '<div class="comparison-profile">' +
        '<div class="comparison-profile-title">Your Profile</div>' +
        '<div class="comparison-score-big"><span class="num">' + profile1.totalScore + '</span><span class="den">/10</span></div>' +
        barHTML(categories, true) +
        '<div style="text-align:center;margin-top:0.75rem"><span class="comparison-winner ' + (p1Win ? 'win' : 'lose') + '">' +
          (p1Win ? 'Leading' : 'Behind by ' + (profile2.totalScore - profile1.totalScore).toFixed(1)) +
        '</span></div>' +
        '<div style="font-size:0.7rem;color:var(--text-dim);text-align:center;margin-top:0.4rem">' + profile1.skillLabel + ' &middot; ' + profile1.countryLabel + ' &middot; $' + profile1.rate + '/hr</div>' +
      '</div>' +
      '<div class="comparison-vs">VS</div>' +
      '<div class="comparison-profile">' +
        '<div class="comparison-profile-title">Profile B</div>' +
        '<div class="comparison-score-big"><span class="num">' + profile2.totalScore + '</span><span class="den">/10</span></div>' +
        barHTML(categories, false) +
        '<div style="text-align:center;margin-top:0.75rem"><span class="comparison-winner ' + (p2Win && !p1Win ? 'win' : (p1Win && !p2Win ? 'lose' : 'win')) + '">' +
          (p2Win && !p1Win ? 'Leading' : (profile1.totalScore === profile2.totalScore ? 'Tied' : 'Behind by ' + (profile1.totalScore - profile2.totalScore).toFixed(1))) +
        '</span></div>' +
        '<div style="font-size:0.7rem;color:var(--text-dim);text-align:center;margin-top:0.4rem">' + profile2.skillLabel + ' &middot; ' + profile2.countryLabel + ' &middot; $' + profile2.rate + '/hr</div>' +
      '</div>' +
    '</div>';

  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ===== [148] PERSONALIZED RECOMMENDATIONS ===== */
window.renderRecommendations = function(r) {
  var grid = document.getElementById('rec-grid');
  if (!grid || !r) return;
  var recs = [];
  var LOW = 7;

  // Low profile/headline/overview scores
  if (r.headline < LOW || r.overview < LOW) {
    recs.push({
      icon: '\u270D\uFE0F',
      name: 'Bio Generator',
      reason: 'Your headline scores ' + r.headline + '/10 and overview scores ' + r.overview + '/10. A stronger profile bio can boost visibility.',
      link: '/app/tools/bio-generator/',
      severity: Math.min(r.headline, r.overview) < 5 ? 'low' : 'mid'
    });
    recs.push({
      icon: '\uD83D\uDCCB',
      name: 'Profile Optimization Guide',
      reason: 'Review our Upwork profile optimization template to improve your headline and overview sections.',
      link: '/app/tools/',
      severity: 'mid'
    });
  }

  // Low skills score
  if (r.skillsScore < LOW) {
    recs.push({
      icon: '\uD83C\uDFAF',
      name: 'Skills Assessment',
      reason: 'Your skills score is ' + r.skillsScore + '/10. Adding trending skills for ' + r.skillLabel + ' can improve your match rate.',
      link: '/app/tools/',
      severity: r.skillsScore < 5 ? 'low' : 'mid'
    });
  }

  // Low rate score
  if (r.rateScore < LOW) {
    recs.push({
      icon: '\uD83D\uDCB0',
      name: 'Rate Calculator',
      reason: 'Your rate score is ' + r.rateScore + '/10. The market benchmark for ' + r.skillLabel + ' in ' + r.countryLabel + ' is $' + r.benchmark + '/hr.',
      link: '/app/tools/rate-calculator/',
      severity: r.rateScore < 5 ? 'low' : 'mid'
    });
    recs.push({
      icon: '\uD83D\uDCB8',
      name: 'Fee Calculator',
      reason: 'Optimize your payment method to keep more of your earnings. You could save $' + r.savings + '/yr with better payment routing.',
      link: '/app/tools/fee-calculator/',
      severity: 'mid'
    });
  }

  // Low portfolio score
  if (r.portfolio < LOW) {
    recs.push({
      icon: '\uD83D\uDDBC\uFE0F',
      name: 'Portfolio Review',
      reason: 'Your portfolio score is ' + r.portfolio + '/10. Adding case studies with measurable results will strengthen your profile.',
      link: '/app/tools/',
      severity: r.portfolio < 5 ? 'low' : 'mid'
    });
  }

  // General recommendation for non-excellent scores
  if (r.totalScore < 8) {
    recs.push({
      icon: '\uD83D\uDCDD',
      name: 'Contract Reviewer',
      reason: 'Protect yourself with reviewed contracts. Ensure fair terms before starting any project.',
      link: '/app/tools/contract-reviewer/',
      severity: 'mid'
    });
  }

  // Growth tools for strong profiles
  if (r.totalScore >= 7) {
    recs.push({
      icon: '\uD83D\uDE80',
      name: 'Ad Generator',
      reason: 'Your profile is strong at ' + r.totalScore + '/10. Generate ads to promote your services and find more clients.',
      link: '/app/tools/ad-generator/',
      severity: 'mid'
    });
  }

  // Limit to 6 recommendations max
  recs = recs.slice(0, 6);

  if (recs.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-dim);font-size:0.85rem;text-align:center;padding:1rem">Your scores are excellent! Keep up the great work.</p>';
    return;
  }

  grid.innerHTML = recs.map(function(rec) {
    return '<a href="' + rec.link + '" class="rec-card">' +
      '<span class="rec-icon">' + rec.icon + '</span>' +
      '<div class="rec-info">' +
        '<div class="rec-name">' + rec.name + '</div>' +
        '<div class="rec-reason">' + rec.reason + '</div>' +
        '<span class="rec-tag ' + rec.severity + '">' + (rec.severity === 'low' ? 'Needs Work' : 'Improvement') + '</span>' +
      '</div></a>';
  }).join('');
};
