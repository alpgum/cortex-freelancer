/**
 * T03: System Prompt Builder
 * Builds context-aware system prompt for Cortex AI chat.
 */
(function () {
  'use strict';

  var CORE_PROMPT = [
    'You are Cortex, a freelancer AI business manager.',
    'You help freelancers with: proposals, emails, job analysis, rate advice, and career strategy.',
    '',
    'Rules:',
    '- Short, action-oriented answers (max 3 paragraphs unless more detail is needed)',
    '- Match the user\'s language (Turkish → Turkish, English → English)',
    '- Always give concrete output (proposal text, email draft, score/analysis)',
    '- Use the user profile data when available to personalize answers',
    '- For non-freelancing topics: politely redirect ("I specialize in freelancing — ask me about proposals, rates, or jobs!")',
    '- Use emoji sparingly. Use bullet points to organize.',
    '',
    'Tone: Professional but friendly. Like a senior freelancer friend giving advice.'
  ].join('\n');

  function buildProfileSection(profile) {
    if (!profile || profile._skipped) return 'User has not shared their profile yet.';

    var lines = ['User profile:'];
    if (profile.name) lines.push('- Name: ' + profile.name);
    if (profile.title) lines.push('- Title: ' + profile.title);
    if (profile.hourlyRate) lines.push('- Hourly rate: $' + profile.hourlyRate + '/hr');
    if (profile.skills && profile.skills.length) lines.push('- Skills: ' + profile.skills.slice(0, 15).join(', '));
    if (profile.jobSuccessScore) lines.push('- Job Success Score: ' + profile.jobSuccessScore + '%');
    if (profile.totalEarnings) lines.push('- Total earned: $' + Number(profile.totalEarnings).toLocaleString());
    if (profile.totalHours) lines.push('- Total hours: ' + Number(profile.totalHours).toLocaleString());
    if (profile.country) lines.push('- Country: ' + profile.country);
    if (profile.availability) lines.push('- Availability: ' + profile.availability);
    return lines.join('\n');
  }

  function buildGoalsSection(goals) {
    if (!goals) return '';
    var lines = ['User goals:'];
    if (goals.incomeGoal) lines.push('- Monthly income goal: $' + Number(goals.incomeGoal).toLocaleString());
    if (goals.taxCountry) lines.push('- Tax country: ' + goals.taxCountry);
    if (goals.workType) lines.push('- Preferred work: ' + goals.workType);
    return lines.length > 1 ? lines.join('\n') : '';
  }

  function buildHistorySection(history) {
    if (!history || !history.length) return '';
    var recent = history.slice(-5);
    var lines = ['Recent conversation:'];
    recent.forEach(function (msg) {
      var role = msg.role === 'user' ? 'User' : 'Cortex';
      var content = String(msg.content || '').substring(0, 200);
      lines.push(role + ': ' + content);
    });
    return lines.join('\n');
  }

  function build(profile, goals, history) {
    var parts = [CORE_PROMPT, '', buildProfileSection(profile)];
    var goalsSection = buildGoalsSection(goals);
    if (goalsSection) parts.push('', goalsSection);
    var historySection = buildHistorySection(history);
    if (historySection) parts.push('', historySection);
    return parts.join('\n');
  }

  window.CortexSystemPrompt = { build: build };
})();
