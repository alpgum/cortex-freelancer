/**
 * [CF-121] Proposal Writer — Multi-Language Support (EN/TR/ES/DE)
 * Detect job language, generate proposal in matching language with translation toggle.
 * Exposed on window.CortexFreelancer.ProposalMultiLang
 */
(function () {
  'use strict';

  var CF = window.CortexFreelancer = window.CortexFreelancer || {};

  var STORAGE_KEY = 'cf_proposal_multilang_prefs';
  var CSS_INJECTED = false;

  var SUPPORTED_LANGUAGES = {
    en: { code: 'en', label: 'English', flag: 'EN', nativeName: 'English' },
    tr: { code: 'tr', label: 'Turkish', flag: 'TR', nativeName: 'Türkçe' },
    es: { code: 'es', label: 'Spanish', flag: 'ES', nativeName: 'Español' },
    de: { code: 'de', label: 'German', flag: 'DE', nativeName: 'Deutsch' }
  };

  // Language detection patterns — common words per language
  var LANG_PATTERNS = {
    tr: {
      words: ['bir', 'için', 'ile', 'olan', 'veya', 've', 'bu', 'olarak', 'gibi', 'daha',
              'proje', 'geliştirme', 'tasarım', 'uygulama', 'yazılım', 'ihtiyaç', 'arıyoruz',
              'deneyim', 'çalışma', 'müşteri', 'hizmet', 'ödeme', 'fiyat', 'süre', 'teslim',
              'freelancer', 'uzman', 'bütçe', 'merhaba', 'iş', 'talep', 'başvuru'],
      markers: ['ş', 'ğ', 'ı', 'ö', 'ü', 'ç', 'İ', 'Ş', 'Ğ']
    },
    es: {
      words: ['para', 'con', 'una', 'los', 'las', 'del', 'por', 'como', 'más', 'pero',
              'proyecto', 'desarrollo', 'diseño', 'aplicación', 'necesitamos', 'experiencia',
              'trabajo', 'cliente', 'servicio', 'pago', 'precio', 'tiempo', 'entrega',
              'profesional', 'presupuesto', 'hola', 'solicitud', 'buscar', 'empresa'],
      markers: ['ñ', '¿', '¡', 'á', 'é', 'í', 'ó', 'ú']
    },
    de: {
      words: ['und', 'der', 'die', 'das', 'ein', 'eine', 'für', 'mit', 'auf', 'ist',
              'projekt', 'entwicklung', 'gestaltung', 'anwendung', 'software', 'erfahrung',
              'arbeit', 'kunde', 'dienst', 'zahlung', 'preis', 'zeit', 'lieferung',
              'freiberufler', 'budget', 'suchen', 'unternehmen', 'anforderung', 'wir'],
      markers: ['ä', 'ö', 'ü', 'ß']
    }
  };

  // Section labels per language
  var SECTION_LABELS_I18N = {
    en: {
      greeting: 'Greeting', introduction: 'Introduction', understanding: 'Understanding',
      approach: 'Approach', timeline: 'Timeline', pricing: 'Pricing',
      closing: 'Closing', callToAction: 'Call to Action'
    },
    tr: {
      greeting: 'Selamlama', introduction: 'Giriş', understanding: 'Anlayış',
      approach: 'Yaklaşım', timeline: 'Zaman Çizelgesi', pricing: 'Fiyatlandırma',
      closing: 'Kapanış', callToAction: 'Harekete Geçirici Mesaj'
    },
    es: {
      greeting: 'Saludo', introduction: 'Introducción', understanding: 'Comprensión',
      approach: 'Enfoque', timeline: 'Cronograma', pricing: 'Precios',
      closing: 'Cierre', callToAction: 'Llamada a la Acción'
    },
    de: {
      greeting: 'Begrüßung', introduction: 'Einleitung', understanding: 'Verständnis',
      approach: 'Ansatz', timeline: 'Zeitplan', pricing: 'Preisgestaltung',
      closing: 'Abschluss', callToAction: 'Handlungsaufforderung'
    }
  };

  // Proposal template phrases per language
  var TEMPLATES = {
    en: {
      greeting_formal: 'Dear',
      greeting_friendly: 'Hi',
      greeting_casual: 'Hey',
      intro: 'I read your job posting with great interest and I\'m confident I\'m the right fit for this project. With {experience} of experience in {skills}, I\'ve delivered similar work that exceeded client expectations.',
      understanding: 'From your description, I understand you need {summary}. The key deliverables I\'ve identified include: {deliverables}.',
      approach: 'My approach would start with a thorough requirements review, followed by an iterative development process with regular check-ins. I believe in transparent communication and delivering working results early.',
      timeline: 'Based on the scope described, I estimate this project will take approximately {hours} hours ({weeks} weeks). I can begin immediately.',
      pricing_hourly: 'My rate for this type of work is ${rate}/hr. Based on the estimated scope, the total investment would be approximately ${total}.',
      pricing_fixed: 'For this project, I\'d suggest a fixed price of ${amount}. This includes all deliverables outlined above.',
      closing: 'I\'m excited about the possibility of working together on this project. My goal is to deliver exceptional results.',
      callToAction: 'Would you be available for a quick call this week to discuss the project? Looking forward to hearing from you!'
    },
    tr: {
      greeting_formal: 'Sayın',
      greeting_friendly: 'Merhaba',
      greeting_casual: 'Selam',
      intro: 'İş ilanınızı büyük ilgiyle okudum ve bu proje için doğru kişi olduğumdan eminim. {skills} alanında {experience} deneyimimle, müşteri beklentilerini aşan benzer işler teslim ettim.',
      understanding: 'Açıklamanızdan, {summary} ihtiyacınız olduğunu anlıyorum. Belirlediğim temel teslimatlar: {deliverables}.',
      approach: 'Yaklaşımım kapsamlı bir gereksinim incelemesiyle başlayacak, ardından düzenli kontrol noktalarıyla yinelemeli bir geliştirme süreci izleyecektir. Şeffaf iletişime ve erken sonuç teslimatına inanıyorum.',
      timeline: 'Tanımlanan kapsama göre, bu projenin yaklaşık {hours} saat ({weeks} hafta) süreceğini tahmin ediyorum. Hemen başlayabilirim.',
      pricing_hourly: 'Bu tür işler için saatlik ücretim {rate}₺\'dir. Tahmini kapsama göre toplam yatırım yaklaşık {total}₺ olacaktır.',
      pricing_fixed: 'Bu proje için {amount}₺ sabit fiyat öneriyorum. Bu, yukarıda belirtilen tüm teslimatları kapsar.',
      closing: 'Bu projede birlikte çalışma olasılığı beni heyecanlandırıyor. Amacım olağanüstü sonuçlar sunmaktır.',
      callToAction: 'Bu hafta projeyi görüşmek için kısa bir görüşme yapabilir miyiz? Sizden haber almayı dört gözle bekliyorum!'
    },
    es: {
      greeting_formal: 'Estimado/a',
      greeting_friendly: 'Hola',
      greeting_casual: 'Hola',
      intro: 'Leí su publicación de trabajo con gran interés y estoy seguro/a de que soy la persona indicada para este proyecto. Con {experience} de experiencia en {skills}, he entregado trabajos similares que superaron las expectativas.',
      understanding: 'Según su descripción, entiendo que necesita {summary}. Los entregables clave que identifiqué incluyen: {deliverables}.',
      approach: 'Mi enfoque comenzaría con una revisión exhaustiva de los requisitos, seguida de un proceso de desarrollo iterativo con revisiones periódicas. Creo en la comunicación transparente y la entrega temprana de resultados.',
      timeline: 'Según el alcance descrito, estimo que este proyecto tomará aproximadamente {hours} horas ({weeks} semanas). Puedo comenzar inmediatamente.',
      pricing_hourly: 'Mi tarifa para este tipo de trabajo es ${rate}/hr. Según el alcance estimado, la inversión total sería aproximadamente ${total}.',
      pricing_fixed: 'Para este proyecto, sugeriría un precio fijo de ${amount}. Esto incluye todos los entregables mencionados.',
      closing: 'Me entusiasma la posibilidad de trabajar juntos en este proyecto. Mi objetivo es entregar resultados excepcionales.',
      callToAction: '¿Estaría disponible para una llamada rápida esta semana para discutir el proyecto? ¡Espero tener noticias suyas!'
    },
    de: {
      greeting_formal: 'Sehr geehrte/r',
      greeting_friendly: 'Hallo',
      greeting_casual: 'Hi',
      intro: 'Ich habe Ihre Stellenausschreibung mit großem Interesse gelesen und bin überzeugt, dass ich die richtige Person für dieses Projekt bin. Mit {experience} Erfahrung in {skills} habe ich ähnliche Arbeiten geliefert, die die Erwartungen übertroffen haben.',
      understanding: 'Aus Ihrer Beschreibung verstehe ich, dass Sie {summary} benötigen. Die wichtigsten Ergebnisse, die ich identifiziert habe, umfassen: {deliverables}.',
      approach: 'Mein Ansatz würde mit einer gründlichen Anforderungsanalyse beginnen, gefolgt von einem iterativen Entwicklungsprozess mit regelmäßigen Abstimmungen. Ich glaube an transparente Kommunikation und frühzeitige Ergebnislieferung.',
      timeline: 'Basierend auf dem beschriebenen Umfang schätze ich, dass dieses Projekt etwa {hours} Stunden ({weeks} Wochen) dauern wird. Ich kann sofort beginnen.',
      pricing_hourly: 'Mein Stundensatz für diese Art von Arbeit beträgt {rate}€/Std. Basierend auf dem geschätzten Umfang würde die Gesamtinvestition etwa {total}€ betragen.',
      pricing_fixed: 'Für dieses Projekt würde ich einen Festpreis von {amount}€ vorschlagen. Dies umfasst alle oben genannten Leistungen.',
      closing: 'Ich freue mich über die Möglichkeit, bei diesem Projekt zusammenzuarbeiten. Mein Ziel ist es, herausragende Ergebnisse zu liefern.',
      callToAction: 'Wären Sie diese Woche für ein kurzes Gespräch verfügbar, um das Projekt zu besprechen? Ich freue mich auf Ihre Rückmeldung!'
    }
  };

  var _config = {
    apiKey: null,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
    apiEndpoint: 'https://api.anthropic.com/v1/messages',
    preferredLanguage: null
  };

  // ─── Init ─────────────────────────────────────────────────────────

  function init(config) {
    if (!config) return;
    if (config.apiKey) _config.apiKey = config.apiKey;
    if (config.model) _config.model = config.model;
    if (config.apiEndpoint) _config.apiEndpoint = config.apiEndpoint;
    if (config.preferredLanguage) _config.preferredLanguage = config.preferredLanguage;
    _loadPrefs();
  }

  function _loadPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var prefs = JSON.parse(raw);
        if (prefs.preferredLanguage && SUPPORTED_LANGUAGES[prefs.preferredLanguage]) {
          _config.preferredLanguage = prefs.preferredLanguage;
        }
      }
    } catch (e) { /* ignore */ }
  }

  function _savePrefs() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preferredLanguage: _config.preferredLanguage
      }));
    } catch (e) { /* ignore */ }
  }

  // ─── Language Detection ───────────────────────────────────────────

  function detectLanguage(text) {
    if (!text || typeof text !== 'string') return { code: 'en', confidence: 0.5 };

    var lower = text.toLowerCase();
    var words = lower.split(/\s+/).filter(function (w) { return w.length > 1; });
    var totalWords = words.length;
    if (totalWords === 0) return { code: 'en', confidence: 0.5 };

    var scores = {};

    for (var lang in LANG_PATTERNS) {
      if (!LANG_PATTERNS.hasOwnProperty(lang)) continue;
      var pattern = LANG_PATTERNS[lang];
      var wordScore = 0;
      var markerScore = 0;

      // Count matching words
      for (var i = 0; i < words.length; i++) {
        if (pattern.words.indexOf(words[i]) !== -1) wordScore++;
      }

      // Count character markers
      for (var j = 0; j < pattern.markers.length; j++) {
        if (text.indexOf(pattern.markers[j]) !== -1) markerScore += 2;
      }

      scores[lang] = (wordScore / totalWords) * 80 + (markerScore / pattern.markers.length) * 20;
    }

    // Find highest scoring non-English language
    var bestLang = 'en';
    var bestScore = 0;
    var threshold = 8; // Minimum score to consider non-English

    for (var langCode in scores) {
      if (scores.hasOwnProperty(langCode) && scores[langCode] > bestScore) {
        bestScore = scores[langCode];
        bestLang = langCode;
      }
    }

    if (bestScore < threshold) {
      return { code: 'en', confidence: 1 - (bestScore / threshold) * 0.5 };
    }

    return {
      code: bestLang,
      confidence: Math.min(0.99, 0.5 + bestScore / 100),
      scores: scores
    };
  }

  // ─── Translation ──────────────────────────────────────────────────

  function translateProposal(proposal, targetLang, options) {
    var opts = options || {};
    if (!proposal || !SUPPORTED_LANGUAGES[targetLang]) {
      return Promise.resolve(proposal);
    }

    if (_config.apiKey) {
      return _translateViaAPI(proposal, targetLang, opts);
    }
    return Promise.resolve(_translateFallback(proposal, targetLang));
  }

  function _translateViaAPI(proposal, targetLang, opts) {
    var langInfo = SUPPORTED_LANGUAGES[targetLang];
    var sections = ['greeting', 'introduction', 'understanding', 'approach', 'timeline', 'pricing', 'closing', 'callToAction'];
    var content = {};
    for (var i = 0; i < sections.length; i++) {
      if (proposal[sections[i]]) content[sections[i]] = proposal[sections[i]];
    }

    var systemPrompt = 'You are a professional translator specializing in freelance business communication. ' +
      'Translate the following proposal sections to ' + langInfo.label + ' (' + langInfo.nativeName + '). ' +
      'Maintain professional tone, preserve formatting, and adapt cultural nuances appropriately. ' +
      'Return a JSON object with the same keys, each containing the translated text.';

    var body = {
      model: _config.model,
      max_tokens: _config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(content) }]
    };

    return fetch(_config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    })
    .then(function (res) {
      if (!res.ok) throw new Error('Translation API failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var text = data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error('Empty translation response');
      var jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        var translated = JSON.parse(jsonMatch[0]);
        var result = JSON.parse(JSON.stringify(proposal));
        for (var key in translated) {
          if (translated.hasOwnProperty(key) && result.hasOwnProperty(key)) {
            result[key] = translated[key];
          }
        }
        if (!result._meta) result._meta = {};
        result._meta.language = targetLang;
        result._meta.translatedAt = new Date().toISOString();
        result._meta.translationSource = 'ai';
        return result;
      }
      throw new Error('Could not parse translation');
    })
    .catch(function () {
      return _translateFallback(proposal, targetLang);
    });
  }

  function _translateFallback(proposal, targetLang) {
    var template = TEMPLATES[targetLang] || TEMPLATES.en;
    var result = JSON.parse(JSON.stringify(proposal));

    // Replace with localized template content, preserving dynamic values
    result.greeting = template.greeting_formal + ' ' + _extractName(proposal.greeting) + ',';
    result.introduction = template.intro
      .replace('{experience}', _extractValue(proposal.introduction, /(\d+\s*(?:years?|months?))/i) || 'extensive')
      .replace('{skills}', _extractValue(proposal.introduction, /(?:in|with)\s+(.+?)(?:\.|,|$)/i) || 'relevant technologies');
    result.understanding = template.understanding
      .replace('{summary}', _extractValue(proposal.understanding, /need\s+(.+?)(?:\.|The)/i) || 'a professional solution')
      .replace('{deliverables}', _extractValue(proposal.understanding, /include[s]?:?\s*(.+?)(?:\.|$)/i) || 'the outlined deliverables');
    result.approach = template.approach;
    result.timeline = template.timeline
      .replace('{hours}', _extractValue(proposal.timeline, /(\d+)\s*hours/i) || '40')
      .replace('{weeks}', _extractValue(proposal.timeline, /(\d+)\s*weeks/i) || '2');
    result.closing = template.closing;
    result.callToAction = template.callToAction;

    if (!result._meta) result._meta = {};
    result._meta.language = targetLang;
    result._meta.translatedAt = new Date().toISOString();
    result._meta.translationSource = 'template';

    return result;
  }

  function _extractName(greeting) {
    if (!greeting) return '';
    var match = greeting.match(/(?:Dear|Hi|Hey|Sayın|Merhaba|Hola|Hallo)\s+(.+?)(?:,|$)/i);
    return match ? match[1] : 'Hiring Manager';
  }

  function _extractValue(text, regex) {
    if (!text) return null;
    var match = text.match(regex);
    return match ? match[1].trim() : null;
  }

  // ─── Generate in Language ─────────────────────────────────────────

  function generateInLanguage(jobDescription, language, options) {
    var opts = options || {};
    var lang = language || detectLanguage(jobDescription).code;

    if (_config.apiKey) {
      return _generateInLangViaAPI(jobDescription, lang, opts);
    }
    return Promise.resolve(_generateInLangFallback(jobDescription, lang, opts));
  }

  function _generateInLangViaAPI(jobDescription, lang, opts) {
    var langInfo = SUPPORTED_LANGUAGES[lang] || SUPPORTED_LANGUAGES.en;
    var profile = opts.userProfile || {};
    var tone = opts.tone || 'professional';

    var systemPrompt = 'You are an expert freelance proposal writer. Generate a tailored proposal in ' +
      langInfo.label + ' (' + langInfo.nativeName + ') based on the job description and freelancer profile. ' +
      'Return a JSON object with keys: greeting, introduction, understanding, approach, timeline, pricing, closing, callToAction. ' +
      'Each value should be a well-written paragraph (2-4 sentences) in ' + langInfo.nativeName + '.';

    var userContent = 'JOB DESCRIPTION:\n' + jobDescription + '\n\n';
    if (profile.name) userContent += 'FREELANCER NAME: ' + profile.name + '\n';
    if (profile.skills && profile.skills.length) userContent += 'SKILLS: ' + profile.skills.join(', ') + '\n';
    if (profile.experience) userContent += 'EXPERIENCE: ' + profile.experience + '\n';

    return fetch(_config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: _config.model,
        max_tokens: _config.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }]
      })
    })
    .then(function (res) {
      if (!res.ok) throw new Error('API failed: ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var text = data.content && data.content[0] && data.content[0].text;
      if (!text) throw new Error('Empty response');
      var jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0]);
        parsed._meta = { source: 'ai', language: lang, tone: tone, generatedAt: new Date().toISOString() };
        return parsed;
      }
      throw new Error('Parse error');
    })
    .catch(function () {
      return _generateInLangFallback(jobDescription, lang, opts);
    });
  }

  function _generateInLangFallback(jobDescription, lang, opts) {
    var template = TEMPLATES[lang] || TEMPLATES.en;
    var profile = opts.userProfile || {};
    var tone = opts.tone || 'professional';
    var toneKey = tone === 'casual' ? 'greeting_casual' : tone === 'friendly' ? 'greeting_friendly' : 'greeting_formal';

    var proposal = {
      greeting: template[toneKey] + ' Hiring Manager,',
      introduction: template.intro
        .replace('{experience}', profile.experience || 'several years')
        .replace('{skills}', (profile.skills || []).slice(0, 3).join(', ') || 'relevant technologies'),
      understanding: template.understanding
        .replace('{summary}', 'a professional solution')
        .replace('{deliverables}', 'the items outlined in your posting'),
      approach: template.approach,
      timeline: template.timeline.replace('{hours}', '40').replace('{weeks}', '2'),
      pricing: template.pricing_hourly.replace('{rate}', String(profile.hourlyRate || 50)).replace('{total}', String((profile.hourlyRate || 50) * 40)),
      closing: template.closing,
      callToAction: template.callToAction,
      _meta: { source: 'template', language: lang, tone: tone, generatedAt: new Date().toISOString() }
    };

    return proposal;
  }

  // ─── Render: Language Selector ────────────────────────────────────

  function renderLanguageSelector(containerId, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var currentLang = opts.currentLanguage || _config.preferredLanguage || 'en';
    var onSelect = opts.onSelect || function () {};

    var h = '<div class="pml-selector">';
    h += '<div class="pml-selector-label">Proposal Language</div>';
    h += '<div class="pml-lang-options">';

    for (var code in SUPPORTED_LANGUAGES) {
      if (!SUPPORTED_LANGUAGES.hasOwnProperty(code)) continue;
      var lang = SUPPORTED_LANGUAGES[code];
      var active = code === currentLang ? ' pml-lang-active' : '';
      h += '<button class="pml-lang-btn' + active + '" data-lang="' + code + '">';
      h += '<span class="pml-lang-flag">' + lang.flag + '</span>';
      h += '<span class="pml-lang-name">' + lang.nativeName + '</span>';
      h += '</button>';
    }

    h += '</div></div>';

    // Auto-detect indicator
    h += '<div class="pml-detect-info" id="pml-detect-info" style="display:none;"></div>';

    container.innerHTML = h;

    var btns = container.querySelectorAll('.pml-lang-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('pml-lang-active');
        this.classList.add('pml-lang-active');
        _config.preferredLanguage = lang;
        _savePrefs();
        onSelect(lang);
      });
    }
  }

  function showDetectedLanguage(containerId, detectionResult) {
    var info = document.getElementById('pml-detect-info') ||
               (document.getElementById(containerId) && document.getElementById(containerId).querySelector('.pml-detect-info'));
    if (!info) return;

    var lang = SUPPORTED_LANGUAGES[detectionResult.code];
    if (!lang) return;

    var pct = Math.round(detectionResult.confidence * 100);
    info.style.display = 'block';
    info.innerHTML = '<span class="pml-detect-badge">Detected: <strong>' + lang.nativeName +
      '</strong> (' + pct + '% confidence)</span>';
  }

  // ─── Render: Translation Toggle ───────────────────────────────────

  function renderTranslationToggle(containerId, proposal, options) {
    _injectCSS();
    var opts = options || {};
    var container = document.getElementById(containerId);
    if (!container) return;

    var originalLang = (proposal._meta && proposal._meta.language) || 'en';
    var originalProposal = JSON.parse(JSON.stringify(proposal));
    var translations = {};
    translations[originalLang] = originalProposal;

    var h = '<div class="pml-toggle-panel">';
    h += '<div class="pml-toggle-header">';
    h += '<span class="pml-toggle-title">Translation</span>';
    h += '<div class="pml-toggle-langs">';

    for (var code in SUPPORTED_LANGUAGES) {
      if (!SUPPORTED_LANGUAGES.hasOwnProperty(code)) continue;
      var lang = SUPPORTED_LANGUAGES[code];
      var active = code === originalLang ? ' pml-toggle-active' : '';
      h += '<button class="pml-toggle-btn' + active + '" data-lang="' + code + '">' + lang.flag + '</button>';
    }

    h += '</div></div>';
    h += '<div class="pml-toggle-status" id="pml-toggle-status" style="display:none;"></div>';
    h += '<div class="pml-toggle-content" id="pml-toggle-content"></div>';
    h += '</div>';

    container.innerHTML = h;

    _renderProposalPreview('pml-toggle-content', proposal, originalLang);

    var toggleBtns = container.querySelectorAll('.pml-toggle-btn');
    for (var i = 0; i < toggleBtns.length; i++) {
      toggleBtns[i].addEventListener('click', function () {
        var targetLang = this.getAttribute('data-lang');
        for (var j = 0; j < toggleBtns.length; j++) toggleBtns[j].classList.remove('pml-toggle-active');
        this.classList.add('pml-toggle-active');

        if (translations[targetLang]) {
          _renderProposalPreview('pml-toggle-content', translations[targetLang], targetLang);
          if (opts.onTranslate) opts.onTranslate(translations[targetLang], targetLang);
          return;
        }

        var status = document.getElementById('pml-toggle-status');
        if (status) {
          status.style.display = 'block';
          status.textContent = 'Translating to ' + SUPPORTED_LANGUAGES[targetLang].nativeName + '...';
        }

        translateProposal(originalProposal, targetLang).then(function (translated) {
          translations[targetLang] = translated;
          if (status) status.style.display = 'none';
          _renderProposalPreview('pml-toggle-content', translated, targetLang);
          if (opts.onTranslate) opts.onTranslate(translated, targetLang);
        });
      });
    }
  }

  function _renderProposalPreview(containerId, proposal, lang) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var labels = SECTION_LABELS_I18N[lang] || SECTION_LABELS_I18N.en;
    var sections = ['greeting', 'introduction', 'understanding', 'approach', 'timeline', 'pricing', 'closing', 'callToAction'];

    var h = '';
    for (var i = 0; i < sections.length; i++) {
      var key = sections[i];
      var text = proposal[key];
      if (!text) continue;
      h += '<div class="pml-preview-section">';
      h += '<div class="pml-preview-label">' + _escapeHtml(labels[key] || key) + '</div>';
      h += '<div class="pml-preview-text">' + _escapeHtml(text) + '</div>';
      h += '</div>';
    }

    container.innerHTML = h;
  }

  // ─── Utilities ────────────────────────────────────────────────────

  function getSupportedLanguages() {
    return JSON.parse(JSON.stringify(SUPPORTED_LANGUAGES));
  }

  function getSectionLabels(lang) {
    return SECTION_LABELS_I18N[lang] || SECTION_LABELS_I18N.en;
  }

  function setPreferredLanguage(lang) {
    if (SUPPORTED_LANGUAGES[lang]) {
      _config.preferredLanguage = lang;
      _savePrefs();
    }
  }

  function getPreferredLanguage() {
    return _config.preferredLanguage || 'en';
  }

  function _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  function _injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.pml-selector{background:#111;border:1px solid #222;border-radius:10px;padding:14px 18px;margin-bottom:12px}',
      '.pml-selector-label{font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px}',
      '.pml-lang-options{display:flex;gap:8px;flex-wrap:wrap}',
      '.pml-lang-btn{display:flex;align-items:center;gap:6px;background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:8px 14px;color:#aaa;font-size:13px;font-weight:500;cursor:pointer;transition:all .2s}',
      '.pml-lang-btn:hover{background:#222;color:#fff;border-color:#555}',
      '.pml-lang-active{background:#7c3aed20;color:#a78bfa;border-color:#7c3aed}',
      '.pml-lang-flag{font-weight:700;font-size:11px;background:#222;padding:2px 6px;border-radius:4px}',
      '.pml-lang-name{font-size:13px}',
      '.pml-detect-info{padding:8px 18px}',
      '.pml-detect-badge{font-size:12px;color:#a78bfa;background:#7c3aed15;padding:4px 10px;border-radius:6px}',
      '.pml-toggle-panel{background:#111;border:1px solid #222;border-radius:10px;overflow:hidden}',
      '.pml-toggle-header{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #222;background:#151515}',
      '.pml-toggle-title{font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px}',
      '.pml-toggle-langs{display:flex;gap:4px}',
      '.pml-toggle-btn{background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:4px 10px;color:#aaa;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s}',
      '.pml-toggle-btn:hover{background:#222;color:#fff}',
      '.pml-toggle-active{background:#7c3aed20;color:#a78bfa;border-color:#7c3aed}',
      '.pml-toggle-status{padding:10px 18px;font-size:13px;color:#a78bfa;background:#1e1e2e}',
      '.pml-toggle-content{padding:16px 18px}',
      '.pml-preview-section{margin-bottom:14px}',
      '.pml-preview-label{font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}',
      '.pml-preview-text{font-size:14px;color:#ccc;line-height:1.6}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Public API ───────────────────────────────────────────────────

  CF.ProposalMultiLang = {
    init: init,
    detectLanguage: detectLanguage,
    translateProposal: translateProposal,
    generateInLanguage: generateInLanguage,
    renderLanguageSelector: renderLanguageSelector,
    renderTranslationToggle: renderTranslationToggle,
    showDetectedLanguage: showDetectedLanguage,
    getSupportedLanguages: getSupportedLanguages,
    getSectionLabels: getSectionLabels,
    setPreferredLanguage: setPreferredLanguage,
    getPreferredLanguage: getPreferredLanguage,
    SUPPORTED_LANGUAGES: SUPPORTED_LANGUAGES,
    SECTION_LABELS_I18N: SECTION_LABELS_I18N,
    version: '1.0.0'
  };

})();
