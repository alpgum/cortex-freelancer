const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { sanitize } = require('./middleware/sanitize');
const { withErrorHandler, sendError } = require('./middleware/error-handler');

// ── Language detection heuristic ──
const LANG_MARKERS = {
  tr: ['merhaba','proje','geliştirici','deneyim','arıyoruz','ihtiyacımız','yapılacak','web sitesi','uygulama','tasarım','bütçe','süre','hafta','lütfen','tecrübe','çalışma','iş','ile','bir','için','olan','veya','ama','bu','ve'],
  es: ['hola','proyecto','desarrollador','experiencia','buscamos','necesitamos','sitio web','aplicación','diseño','presupuesto','plazo','semanas','por favor','trabajo','con','para','una','pero','este','los','las','del','que','como'],
  de: ['hallo','projekt','entwickler','erfahrung','suchen','brauchen','webseite','anwendung','gestaltung','budget','zeitrahmen','wochen','bitte','arbeit','mit','für','eine','aber','und','oder','der','die','das','ist','wir'],
};

function detectLanguage(text) {
  if (!text) return 'en';
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const scores = {};
  for (const [lang, markers] of Object.entries(LANG_MARKERS)) {
    scores[lang] = 0;
    for (const marker of markers) {
      if (words.some(w => w === marker || w.startsWith(marker))) scores[lang]++;
    }
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  // Need at least 3 marker hits to be confident
  return (best && best[1] >= 3) ? best[0] : 'en';
}

const LANG_NAMES = { en: 'English', tr: 'Turkish', es: 'Spanish', de: 'German' };

// ── Localized template strings ──
const TEMPLATE_STRINGS = {
  en: {
    greeting_pro: 'Dear Hiring Manager,',
    greeting_friendly: 'Hey there! 👋',
    intro: (name, title, jss, earnings) => `I'm ${name}, a ${title}${jss ? ` with ${jss}% job success` : ''}${earnings ? ` and ${earnings} earned on Upwork` : ''}.`,
    project_match: (jobTitle) => `Your project "${jobTitle}" stood out to me — I have direct experience in this area and can deliver high-quality results.`,
    key_qualifications: 'Key qualifications:',
    timeline_estimate: (timeline) => `I'd estimate completing this within ${timeline}. Happy to discuss scope and timeline on a quick call.`,
    closing_pro: 'Looking forward to hearing from you!',
    sign_off_pro: 'Best regards,',
    friendly_intro: (name, title, jss, earnings) => `I just came across your project and got genuinely excited — this is right in my wheelhouse!\n\nI'm ${name}, a ${title}${jss ? ` with ${jss}% job success` : ''}${earnings ? ` and ${earnings} earned on Upwork` : ''}. I've done plenty of similar work and can hit the ground running.`,
    differentiators: [
      '• I communicate proactively — no ghosting, no surprises',
      '• I deliver on time (or early)',
      '• I genuinely care about quality',
    ],
    closing_friendly: "Would love to hop on a quick call to chat about the details!",
    sign_off_friendly: 'Cheers,',
    rate_line: (rate) => `My rate is ${rate}, and I'm flexible on scope-based pricing for the right project.`,
  },
  tr: {
    greeting_pro: 'Sayın Yetkili,',
    greeting_friendly: 'Merhaba! 👋',
    intro: (name, title, jss, earnings) => `Ben ${name}, ${title}${jss ? ` ve %${jss} iş başarı oranına sahip` : ''}${earnings ? ` ve Upwork'te ${earnings} kazanmış` : ''} bir profesyonelim.`,
    project_match: (jobTitle) => `"${jobTitle}" projeniz dikkatimi çekti — bu alanda doğrudan deneyimim var ve yüksek kaliteli sonuçlar sunabilirim.`,
    key_qualifications: 'Temel yetkinliklerim:',
    timeline_estimate: (timeline) => `Bu projeyi ${timeline} içinde tamamlayabileceğimi öngörüyorum. Kapsam ve zaman çizelgesini görüşmek için kısa bir görüşme yapabiliriz.`,
    closing_pro: 'Sizden haber bekliyorum!',
    sign_off_pro: 'Saygılarımla,',
    friendly_intro: (name, title, jss, earnings) => `Projenizi gördüm ve gerçekten heyecanlandım — tam benim uzmanlık alanım!\n\nBen ${name}, ${title}${jss ? ` ve %${jss} iş başarı oranım var` : ''}${earnings ? ` ve Upwork'te ${earnings} kazandım` : ''}. Benzer birçok proje tamamladım ve hemen başlayabilirim.`,
    differentiators: [
      '• Proaktif iletişim kurarım — sessizlik yok, sürpriz yok',
      '• Zamanında (veya erken) teslim ederim',
      '• Kaliteye gerçekten önem veririm',
    ],
    closing_friendly: 'Detayları konuşmak için kısa bir görüşme yapmayı çok isterim!',
    sign_off_friendly: 'Sevgiler,',
    rate_line: (rate) => `Ücretim ${rate}, doğru proje için kapsam bazlı fiyatlandırmaya açığım.`,
  },
  es: {
    greeting_pro: 'Estimado/a Gerente de Contratación,',
    greeting_friendly: '¡Hola! 👋',
    intro: (name, title, jss, earnings) => `Soy ${name}, ${title}${jss ? ` con ${jss}% de éxito laboral` : ''}${earnings ? ` y ${earnings} ganados en Upwork` : ''}.`,
    project_match: (jobTitle) => `Su proyecto "${jobTitle}" me llamó la atención — tengo experiencia directa en esta área y puedo entregar resultados de alta calidad.`,
    key_qualifications: 'Cualificaciones clave:',
    timeline_estimate: (timeline) => `Estimo completar esto en ${timeline}. Encantado de discutir el alcance y el cronograma en una llamada rápida.`,
    closing_pro: '¡Espero tener noticias suyas!',
    sign_off_pro: 'Atentamente,',
    friendly_intro: (name, title, jss, earnings) => `¡Acabo de ver su proyecto y me emocioné genuinamente — esto es justo mi especialidad!\n\nSoy ${name}, ${title}${jss ? ` con ${jss}% de éxito laboral` : ''}${earnings ? ` y ${earnings} ganados en Upwork` : ''}. He realizado muchos trabajos similares y puedo comenzar de inmediato.`,
    differentiators: [
      '• Me comunico proactivamente — sin fantasmear, sin sorpresas',
      '• Entrego a tiempo (o antes)',
      '• Me importa genuinamente la calidad',
    ],
    closing_friendly: '¡Me encantaría tener una llamada rápida para hablar de los detalles!',
    sign_off_friendly: '¡Saludos!',
    rate_line: (rate) => `Mi tarifa es ${rate}, y soy flexible con precios basados en el alcance para el proyecto adecuado.`,
  },
  de: {
    greeting_pro: 'Sehr geehrte/r Personalverantwortliche/r,',
    greeting_friendly: 'Hallo! 👋',
    intro: (name, title, jss, earnings) => `Ich bin ${name}, ${title}${jss ? ` mit ${jss}% Joberfolgrate` : ''}${earnings ? ` und ${earnings} auf Upwork verdient` : ''}.`,
    project_match: (jobTitle) => `Ihr Projekt "${jobTitle}" hat meine Aufmerksamkeit erregt — ich habe direkte Erfahrung in diesem Bereich und kann hochwertige Ergebnisse liefern.`,
    key_qualifications: 'Kernqualifikationen:',
    timeline_estimate: (timeline) => `Ich schätze die Fertigstellung auf ${timeline}. Gerne besprechen wir Umfang und Zeitplan in einem kurzen Gespräch.`,
    closing_pro: 'Ich freue mich auf Ihre Rückmeldung!',
    sign_off_pro: 'Mit freundlichen Grüßen,',
    friendly_intro: (name, title, jss, earnings) => `Ich habe gerade Ihr Projekt gesehen und war sofort begeistert — das ist genau mein Fachgebiet!\n\nIch bin ${name}, ${title}${jss ? ` mit ${jss}% Joberfolgrate` : ''}${earnings ? ` und ${earnings} auf Upwork verdient` : ''}. Ich habe viele ähnliche Arbeiten erledigt und kann sofort loslegen.`,
    differentiators: [
      '• Ich kommuniziere proaktiv — kein Ghosting, keine Überraschungen',
      '• Ich liefere pünktlich (oder früher)',
      '• Mir liegt Qualität wirklich am Herzen',
    ],
    closing_friendly: 'Ich würde mich über ein kurzes Gespräch freuen, um die Details zu besprechen!',
    sign_off_friendly: 'Viele Grüße,',
    rate_line: (rate) => `Mein Stundensatz beträgt ${rate}, und ich bin flexibel bei umfangsbasierter Preisgestaltung für das richtige Projekt.`,
  },
};

// Template-based proposal generator (fallback when no AI)
function generateTemplateProposal(job, profile, tone, language) {
  const lang = language || 'en';
  const t = TEMPLATE_STRINGS[lang] || TEMPLATE_STRINGS.en;
  const name = profile.name || 'there';
  const title = profile.title || 'experienced freelancer';
  const jss = profile.jss || profile.jobSuccess;
  const earnings = profile.earnings || profile.totalEarnings;
  const rate = profile.rate || profile.hourlyRate;

  // Find overlapping skills
  const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
  const jobSkills = (job.jobSkills || []).map(s => s.toLowerCase());
  const overlap = profileSkills.filter(s => jobSkills.some(js => js.includes(s) || s.includes(js)));
  const topSkills = overlap.length > 0 ? overlap.slice(0, 3) : profileSkills.slice(0, 3);

  const rateLine = rate ? `\n\n${t.rate_line(rate)}` : '';
  const skillsList = topSkills.map(s => `• ${s.charAt(0).toUpperCase() + s.slice(1)}`).join('\n');

  const timeline = job.jobBudget && job.jobBudget.includes('Fixed')
    ? '1-2 weeks (depending on scope)'
    : 'an ongoing basis with weekly deliverables';

  if (tone === 'friendly') {
    return `${t.greeting_friendly}

${t.friendly_intro(name, title, jss, earnings)}

${topSkills.length > 0 ? `Skills that match your needs:\n${skillsList}` : 'I have direct experience in your project area and can deliver great results.'}
${rateLine}

${t.differentiators.join('\n')}

${t.timeline_estimate(timeline)} ${t.closing_friendly}

${t.sign_off_friendly}
${name.split(' ')[0]}`;
  }

  // Professional tone (default)
  return `${t.greeting_pro}

${t.intro(name, title, jss, earnings)}

${t.project_match(job.jobTitle)}

${t.key_qualifications}
${skillsList || '• Relevant experience in your project area'}
${rateLine}

${t.timeline_estimate(timeline)}

${t.closing_pro}

${t.sign_off_pro}
${name.split(' ')[0]}`;
}

// Claude AI proposal generator — supports tone variants and language
async function generateAIProposal(job, profile, tone, language) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const profileSkills = (profile.skills || []).join(', ');
  const jobSkills = (job.jobSkills || []).join(', ');

  const toneInstruction = tone === 'friendly'
    ? 'Write in a warm, casual, approachable tone. Use conversational language, show genuine enthusiasm. Start with "Hey" or "Hi there". Include a friendly emoji or two. Be personable but still competent.'
    : 'Write in a professional, polished tone. Be structured and metrics-focused. Emphasize track record and reliability. Start with "Dear Hiring Manager" or similar. No emojis.';

  const langName = LANG_NAMES[language] || LANG_NAMES.en;
  const languageInstruction = `Generate the proposal in ${langName}. The entire proposal text MUST be written in ${langName}.`;

  const prompt = `You are a top-rated Upwork freelancer writing a winning proposal. Be specific, mention relevant skills, address the client's needs directly. Keep it under 200 words. Do NOT use generic filler.

${languageInstruction}

${toneInstruction}

Freelancer Profile:
- Name: ${profile.name || 'Freelancer'}
- Title: ${profile.title || 'Experienced Professional'}
- Rate: ${profile.rate || profile.hourlyRate || 'Flexible'}
- Job Success: ${profile.jss || profile.jobSuccess || 'N/A'}%
- Earnings: ${profile.earnings || profile.totalEarnings || 'N/A'}
- Skills: ${profileSkills || 'Various'}

Job Details:
- Title: ${job.jobTitle}
- Description: ${(job.jobDescription || '').substring(0, 1500)}
- Budget: ${job.jobBudget || 'Not specified'}
- Required Skills: ${jobSkills || 'Not specified'}

Write the proposal now. Output ONLY the proposal text, no JSON, no markdown formatting.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const text = data?.content?.[0]?.text;
    return text || null;
  } catch {
    return null;
  }
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;
  sanitize(req);

  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
  }

  const { jobTitle, jobDescription, jobBudget, jobSkills, profile, variants: wantVariants, language: reqLanguage } = req.body || {};

  if (!profile) {
    return sendError(res, 400, 'Missing profile', 'MISSING_PARAMS', 'validation_error');
  }

  // Support new flow: jobDescription only (no jobTitle required)
  const effectiveTitle = jobTitle || extractTitleFromDescription(jobDescription) || 'Project';
  const job = { jobTitle: effectiveTitle, jobDescription, jobBudget, jobSkills };

  // Determine language: explicit request > auto-detect from job description
  const language = (reqLanguage && ['en', 'tr', 'es', 'de'].includes(reqLanguage))
    ? reqLanguage
    : detectLanguage(jobDescription);

  // ── Dual-variant mode (CF-031) ──
  if (wantVariants) {
    const tones = ['professional', 'friendly'];
    const results = [];

    // Try AI for both tones in parallel
    const aiResults = await Promise.all(
      tones.map(tone => generateAIProposal(job, profile, tone, language))
    );

    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i];
      let proposal = aiResults[i];
      let source = 'ai';

      if (!proposal) {
        proposal = generateTemplateProposal(job, profile, tone, language);
        source = 'template';
      }

      results.push({
        tone,
        label: tone === 'professional' ? '💼 Professional' : '👋 Friendly',
        proposal,
        source,
      });
    }

    return res.json({
      success: true,
      variants: results,
      language,
      detectedLanguage: detectLanguage(jobDescription),
      estimatedBudget: jobBudget || 'Discuss with client',
      suggestedTimeline: jobBudget && jobBudget.includes('Fixed') ? '1-2 weeks' : 'Ongoing',
    });
  }

  // ── Legacy single-proposal mode ──
  let proposal = await generateAIProposal(job, profile, 'professional', language);
  let source = 'ai';

  if (!proposal) {
    proposal = generateTemplateProposal(job, profile, 'professional', language);
    source = 'template';
  }

  res.json({
    success: true,
    proposal,
    source,
    estimatedBudget: jobBudget || 'Discuss with client',
    suggestedTimeline: jobBudget && jobBudget.includes('Fixed') ? '1-2 weeks' : 'Ongoing',
  });
});

// Extract a reasonable title from description text
function extractTitleFromDescription(desc) {
  if (!desc) return null;
  const firstLine = desc.split(/[\n.!?]+/)[0]?.trim();
  if (firstLine && firstLine.length > 5 && firstLine.length < 120) {
    return firstLine;
  }
  return null;
}
