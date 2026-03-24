/**
 * Cortex Freelancer — Case Study Generator (UX-005)
 * Generates professional portfolio case studies from Upwork work history.
 */
(function () {
  "use strict";

  const API_BASE = window.CORTEX_API_BASE || "";

  /* ─── Public API ─── */

  window.CortexCaseStudyGenerator = {
    generateCaseStudy,
    renderCaseStudyCards,
  };

  /* ─── Core Functions ─── */

  async function generateCaseStudy(workEntry, profileData) {
    const res = await fetch(`${API_BASE}/api/generate-case-study`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workHistoryEntry: workEntry,
        profile: profileData,
      }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  function renderCaseStudyCards(workHistory, profileData, container) {
    if (!container) return;
    const eligible = (workHistory || []).filter(
      (e) => e.rating && e.rating >= 4
    );

    if (!eligible.length) {
      container.innerHTML =
        '<p style="color:#888;text-align:center;padding:24px;">No work history entries with rating ≥ 4 found.</p>';
      return;
    }

    container.innerHTML = "";

    eligible.forEach((entry) => {
      const wrapper = document.createElement("div");
      wrapper.className = "cs-entry";
      wrapper.style.cssText =
        "background:#12121f;border:1px solid #2d2d44;border-radius:12px;padding:20px;margin-bottom:16px;";

      // Header row
      const header = document.createElement("div");
      header.style.cssText =
        "display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;";

      const title = document.createElement("h3");
      title.textContent = entry.title;
      title.style.cssText = "margin:0;color:#e0e0e0;font-size:16px;";

      const meta = document.createElement("span");
      meta.style.cssText = "font-size:13px;color:#888;white-space:nowrap;";
      const stars = entry.rating ? "⭐".repeat(Math.round(entry.rating)) : "";
      const amount = entry.earnedAmount
        ? `$${Number(entry.earnedAmount).toLocaleString()}`
        : "";
      meta.textContent = `${stars} ${amount}`.trim();

      header.append(title, meta);
      wrapper.appendChild(header);

      // Generate button
      const btn = document.createElement("button");
      btn.textContent = "📄 Generate Case Study";
      btn.style.cssText = btnStyle();
      btn.addEventListener("click", () =>
        handleGenerate(btn, wrapper, entry, profileData)
      );
      wrapper.appendChild(btn);

      container.appendChild(wrapper);
    });
  }

  /* ─── Event Handlers ─── */

  async function handleGenerate(btn, wrapper, entry, profileData) {
    btn.disabled = true;
    btn.textContent = "⏳ Generating…";
    btn.style.opacity = "0.6";

    // Remove previous card if re-generating
    const prev = wrapper.querySelector(".cs-result");
    if (prev) prev.remove();

    try {
      const { caseStudy, htmlCard } = await generateCaseStudy(
        entry,
        profileData
      );
      const card = buildCardElement(caseStudy, entry, htmlCard);
      wrapper.appendChild(card);
      btn.textContent = "🔄 Regenerate";
    } catch (err) {
      const errEl = document.createElement("p");
      errEl.textContent = `❌ Generation failed: ${err.message}`;
      errEl.style.cssText = "color:#ff6b6b;font-size:13px;margin-top:8px;";
      errEl.className = "cs-result";
      wrapper.appendChild(errEl);
      btn.textContent = "📄 Retry";
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  }

  /* ─── Card Builder ─── */

  function buildCardElement(caseStudy, entry, htmlCard) {
    const card = document.createElement("div");
    card.className = "cs-result";
    card.style.cssText =
      "margin-top:16px;background:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;padding:24px;animation:csFadeIn .3s ease;";

    // Sections
    const sections = [
      { label: "Challenge", text: caseStudy.challenge, icon: "🎯" },
      { label: "Approach", text: caseStudy.approach, icon: "🧠" },
      { label: "Solution", text: caseStudy.solution, icon: "🛠️" },
      { label: "Results", text: caseStudy.results, icon: "📈" },
    ];

    sections.forEach(({ label, text, icon }) => {
      const sec = document.createElement("div");
      sec.style.cssText = "margin-bottom:14px;";
      sec.innerHTML = `
        <h4 style="color:#7c83ff;margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${icon} ${esc(label)}</h4>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#ccc;">${highlightMetrics(esc(text))}</p>
      `;
      card.appendChild(sec);
    });

    // Summary
    if (caseStudy.summary) {
      const sum = document.createElement("div");
      sum.style.cssText =
        "border-top:1px solid #2d2d44;padding-top:12px;margin-top:4px;";
      sum.innerHTML = `<p style="margin:0;font-size:13px;color:#00d4aa;font-style:italic;">${esc(caseStudy.summary)}</p>`;
      card.appendChild(sum);
    }

    // Action buttons
    const actions = document.createElement("div");
    actions.style.cssText =
      "display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;";

    const copyMd = makeActionBtn("📋 Copy as Markdown", () => {
      const md = toMarkdown(caseStudy, entry);
      navigator.clipboard.writeText(md).then(() => flashBtn(copyMd, "✅ Copied!"));
    });

    const copyHtml = makeActionBtn("🔗 Copy as HTML", () => {
      navigator.clipboard
        .writeText(htmlCard)
        .then(() => flashBtn(copyHtml, "✅ Copied!"));
    });

    const portfolio = makeActionBtn("🚀 Add to Portfolio", () => {
      showPortfolioInstructions(card);
    });
    portfolio.style.background = "#7c83ff";
    portfolio.style.color = "#fff";

    actions.append(copyMd, copyHtml, portfolio);
    card.appendChild(actions);

    return card;
  }

  /* ─── Helpers ─── */

  function toMarkdown(cs, entry) {
    const stars = entry.rating ? `${"★".repeat(Math.round(entry.rating))}` : "";
    const amount = entry.earnedAmount
      ? `$${Number(entry.earnedAmount).toLocaleString()}`
      : "";
    return [
      `## ${entry.title}`,
      amount || stars ? `_${[stars, amount].filter(Boolean).join(" · ")}_` : "",
      "",
      `### Challenge`,
      cs.challenge,
      "",
      `### Approach`,
      cs.approach,
      "",
      `### Solution`,
      cs.solution,
      "",
      `### Results`,
      cs.results,
      "",
      cs.summary ? `> ${cs.summary}` : "",
    ]
      .filter((l) => l !== undefined)
      .join("\n");
  }

  function highlightMetrics(text) {
    // Highlight dollar amounts, percentages, and numbers with units
    return text
      .replace(
        /(\$[\d,]+(?:\.\d{2})?)/g,
        '<span style="color:#00d4aa;font-weight:600;">$1</span>'
      )
      .replace(
        /(\d+(?:\.\d+)?%)/g,
        '<span style="color:#00d4aa;font-weight:600;">$1</span>'
      )
      .replace(
        /(\d+(?:\.\d+)?\s*(?:hours|days|weeks|months|x|users|clients))/gi,
        '<span style="color:#00d4aa;font-weight:600;">$1</span>'
      );
  }

  function showPortfolioInstructions(card) {
    const existing = card.querySelector(".cs-portfolio-tip");
    if (existing) {
      existing.remove();
      return;
    }
    const tip = document.createElement("div");
    tip.className = "cs-portfolio-tip";
    tip.style.cssText =
      "margin-top:12px;padding:16px;background:#0d0d1a;border:1px solid #7c83ff;border-radius:8px;font-size:13px;color:#ccc;line-height:1.6;";
    tip.innerHTML = `
      <strong style="color:#7c83ff;">📌 Add to Your Portfolio</strong><br>
      1. Copy the HTML or Markdown above<br>
      2. Paste into your portfolio site, LinkedIn, or personal website<br>
      3. Customize the content to match your brand voice<br>
      4. Add project screenshots or demos for extra impact<br>
      <span style="color:#888;font-size:12px;margin-top:8px;display:block;">Tip: Case studies with visuals get 2× more engagement.</span>
    `;
    card.appendChild(tip);
  }

  function makeActionBtn(label, onClick) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText =
      "background:#2d2d44;color:#e0e0e0;border:none;border-radius:8px;padding:8px 14px;font-size:12px;cursor:pointer;transition:all .15s;";
    btn.addEventListener("mouseenter", () => (btn.style.background = "#3d3d5c"));
    btn.addEventListener("mouseleave", () => {
      if (!btn.dataset.originalBg) btn.style.background = "#2d2d44";
    });
    btn.addEventListener("click", onClick);
    return btn;
  }

  function flashBtn(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = orig), 1500);
  }

  function btnStyle() {
    return "display:block;margin-top:12px;background:#00d4aa;color:#0d0d1a;border:none;border-radius:8px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;";
  }

  function esc(str) {
    if (!str) return "";
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ─── [CF-075] Offline Case Study Generator ─── */

  /**
   * Generate a structured case study locally without API calls.
   * Produces challenge, approach, solution, results, testimonial, and metrics sections.
   */
  function generateLocalCaseStudy(workEntry, profileData) {
    var title = workEntry.title || "Project";
    var desc = workEntry.description || workEntry.feedback || "";
    var rating = workEntry.rating || 0;
    var amount = workEntry.earnedAmount || 0;
    var duration = workEntry.duration || workEntry.daysWorked || null;
    var skills = workEntry.skills || profileData.skills || [];
    var feedback = workEntry.feedback || workEntry.clientFeedback || "";
    var category = profileData.category || "Freelance";

    // Generate challenge section
    var challenge = generateChallenge(title, desc, category);
    var approach = generateApproach(skills, desc, category);
    var solution = generateSolution(title, skills, desc);
    var results = generateResults(rating, amount, duration, feedback);
    var keyMetrics = extractMetrics(amount, rating, duration, desc);
    var testimonial = extractTestimonial(feedback, rating);
    var techStack = skills.slice(0, 8);
    var timeline = generateTimeline(duration, title);

    var caseStudy = {
      title: title,
      category: category,
      challenge: challenge,
      approach: approach,
      solution: solution,
      results: results,
      keyMetrics: keyMetrics,
      testimonial: testimonial,
      techStack: techStack,
      timeline: timeline,
      summary: generateSummary(title, rating, amount, skills),
    };

    var htmlCard = renderCaseStudyHTML(caseStudy, workEntry);
    var markdown = toMarkdown(caseStudy, workEntry);

    return { caseStudy: caseStudy, htmlCard: htmlCard, markdown: markdown };
  }

  function generateChallenge(title, desc, category) {
    var lower = desc.toLowerCase();
    if (lower.includes("redesign") || lower.includes("revamp"))
      return "The client needed a complete " + category.toLowerCase() + " redesign for " + title + " to modernize their digital presence and improve user engagement.";
    if (lower.includes("build") || lower.includes("create") || lower.includes("develop"))
      return "The client required a custom-built solution for " + title + ", needing a reliable and scalable implementation within a tight timeline.";
    if (lower.includes("fix") || lower.includes("bug") || lower.includes("issue"))
      return "The client was experiencing critical issues with " + title + " that were impacting their business operations and needed urgent resolution.";
    if (lower.includes("migrate") || lower.includes("upgrade"))
      return "The client needed to migrate/upgrade their existing " + title + " system to a modern architecture while maintaining data integrity and uptime.";
    return "The client engaged me for " + title + " — a " + category.toLowerCase() + " project requiring specialized expertise, clear communication, and timely delivery.";
  }

  function generateApproach(skills, desc, category) {
    var skillList = skills.slice(0, 4).join(", ");
    var approach = "I began with a thorough discovery phase to understand requirements, constraints, and success criteria. ";
    if (skillList) approach += "Leveraging my expertise in " + skillList + ", I designed a solution architecture that balanced quality with efficiency. ";
    approach += "Regular check-ins and milestone-based delivery ensured alignment throughout the project.";
    return approach;
  }

  function generateSolution(title, skills, desc) {
    var solution = "Delivered a polished " + title + " implementation";
    if (skills.length) solution += " using " + skills.slice(0, 3).join(", ");
    solution += ". The solution was built with scalability and maintainability in mind, including comprehensive documentation and clean code architecture.";
    return solution;
  }

  function generateResults(rating, amount, duration, feedback) {
    var parts = [];
    if (rating >= 4.5) parts.push("Achieved a " + rating + "/5 rating from the client");
    else if (rating > 0) parts.push("Received a " + rating + "/5 client rating");
    if (amount > 0) parts.push("Project valued at $" + Number(amount).toLocaleString());
    if (duration) parts.push("Completed within " + duration + " days");
    if (feedback && feedback.length > 20) {
      var posWords = ["great", "excellent", "amazing", "fantastic", "perfect", "recommend"];
      var hasPositive = posWords.some(function (w) { return feedback.toLowerCase().includes(w); });
      if (hasPositive) parts.push("Client expressed strong satisfaction and willingness to rehire");
    }
    return parts.length ? parts.join(". ") + "." : "Successfully delivered the project to client specifications with positive feedback.";
  }

  function extractMetrics(amount, rating, duration, desc) {
    var metrics = [];
    if (rating > 0) metrics.push({ label: "Client Rating", value: rating + "/5", icon: "⭐" });
    if (amount > 0) metrics.push({ label: "Project Value", value: "$" + Number(amount).toLocaleString(), icon: "💰" });
    if (duration) metrics.push({ label: "Duration", value: duration + " days", icon: "📅" });

    // Try to extract percentage/number metrics from description
    var pctMatch = desc.match(/(\d+)%/);
    if (pctMatch) metrics.push({ label: "Improvement", value: pctMatch[0], icon: "📈" });

    var userMatch = desc.match(/(\d+(?:,\d+)?)\s*(?:users|clients|customers)/i);
    if (userMatch) metrics.push({ label: "Users Impacted", value: userMatch[1], icon: "👥" });

    return metrics.slice(0, 4);
  }

  function extractTestimonial(feedback, rating) {
    if (!feedback || feedback.length < 15) return null;
    // Clean up and truncate if needed
    var clean = feedback.trim();
    if (clean.length > 200) clean = clean.substring(0, 197) + "...";
    return { text: clean, rating: rating };
  }

  function generateTimeline(duration, title) {
    if (!duration) return [{ phase: "Delivered", description: title }];
    var d = parseInt(duration) || 14;
    var phases = [];
    if (d <= 7) {
      phases = [
        { phase: "Day 1-2", description: "Discovery & Planning" },
        { phase: "Day 3-5", description: "Implementation" },
        { phase: "Day 6-7", description: "Testing & Delivery" },
      ];
    } else if (d <= 30) {
      phases = [
        { phase: "Week 1", description: "Discovery & Architecture" },
        { phase: "Week 2-3", description: "Core Implementation" },
        { phase: "Week " + Math.ceil(d / 7), description: "Polish, Testing & Delivery" },
      ];
    } else {
      phases = [
        { phase: "Phase 1", description: "Discovery & Planning (1-2 weeks)" },
        { phase: "Phase 2", description: "Core Development (" + Math.ceil(d * 0.5 / 7) + " weeks)" },
        { phase: "Phase 3", description: "Integration & Testing" },
        { phase: "Phase 4", description: "Launch & Handoff" },
      ];
    }
    return phases;
  }

  function generateSummary(title, rating, amount, skills) {
    var parts = [title + " — delivered successfully"];
    if (rating >= 4) parts.push("with a " + rating + "/5 rating");
    if (skills.length) parts.push("using " + skills.slice(0, 3).join(", "));
    return parts.join(" ") + ".";
  }

  function renderCaseStudyHTML(cs, entry) {
    var html = '<div style="background:#12121f;border:1px solid #2d2d44;border-radius:16px;padding:28px;max-width:680px;font-family:-apple-system,sans-serif;color:#e0e0e0;">';

    // Title
    html += '<h2 style="margin:0 0 4px;color:#e0e0e0;font-size:20px;">' + esc(cs.title) + '</h2>';
    html += '<div style="font-size:12px;color:#888;margin-bottom:20px;">' + esc(cs.category) + '</div>';

    // Key metrics bar
    if (cs.keyMetrics.length) {
      html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">';
      cs.keyMetrics.forEach(function (m) {
        html += '<div style="background:#1a1a2e;border-radius:8px;padding:10px 16px;text-align:center;flex:1;min-width:100px;">';
        html += '<div style="font-size:18px;">' + m.icon + '</div>';
        html += '<div style="font-size:16px;font-weight:700;color:#00d4aa;">' + esc(m.value) + '</div>';
        html += '<div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">' + esc(m.label) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Sections
    var sections = [
      { label: "Challenge", text: cs.challenge, icon: "🎯", color: "#ef4444" },
      { label: "Approach", text: cs.approach, icon: "🧠", color: "#7c83ff" },
      { label: "Solution", text: cs.solution, icon: "🛠️", color: "#fbbf24" },
      { label: "Results", text: cs.results, icon: "📈", color: "#00d4aa" },
    ];

    sections.forEach(function (s) {
      html += '<div style="margin-bottom:16px;">';
      html += '<h4 style="color:' + s.color + ';margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">' + s.icon + ' ' + esc(s.label) + '</h4>';
      html += '<p style="margin:0;font-size:14px;line-height:1.6;color:#ccc;">' + highlightMetrics(esc(s.text)) + '</p>';
      html += '</div>';
    });

    // Timeline
    if (cs.timeline.length > 1) {
      html += '<div style="margin-bottom:16px;">';
      html += '<h4 style="color:#818cf8;margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">📋 Timeline</h4>';
      cs.timeline.forEach(function (t, i) {
        var isLast = i === cs.timeline.length - 1;
        html += '<div style="display:flex;gap:10px;padding:4px 0;">';
        html += '<div style="display:flex;flex-direction:column;align-items:center;width:12px;">';
        html += '<div style="width:8px;height:8px;border-radius:50%;background:#7c83ff;flex-shrink:0;"></div>';
        if (!isLast) html += '<div style="width:2px;flex:1;background:#2d2d44;"></div>';
        html += '</div>';
        html += '<div style="padding-bottom:8px;"><strong style="font-size:12px;color:#e0e0e0;">' + esc(t.phase) + '</strong> <span style="font-size:12px;color:#888;">— ' + esc(t.description) + '</span></div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Tech stack
    if (cs.techStack.length) {
      html += '<div style="margin-bottom:16px;">';
      html += '<h4 style="color:#818cf8;margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;">🔧 Tech Stack</h4>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
      cs.techStack.forEach(function (s) {
        html += '<span style="font-size:11px;background:#1a1a2e;color:#818cf8;padding:3px 10px;border-radius:12px;border:1px solid #2d2d44;">' + esc(s) + '</span>';
      });
      html += '</div></div>';
    }

    // Testimonial
    if (cs.testimonial) {
      html += '<div style="background:#1a1a2e;border-left:3px solid #00d4aa;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:16px;">';
      html += '<p style="margin:0;font-size:13px;font-style:italic;color:#d1d5db;line-height:1.6;">"' + esc(cs.testimonial.text) + '"</p>';
      if (cs.testimonial.rating) html += '<div style="margin-top:6px;font-size:12px;color:#888;">' + '⭐'.repeat(Math.round(cs.testimonial.rating)) + '</div>';
      html += '</div>';
    }

    // Summary
    if (cs.summary) {
      html += '<div style="border-top:1px solid #2d2d44;padding-top:12px;">';
      html += '<p style="margin:0;font-size:13px;color:#00d4aa;font-style:italic;">' + esc(cs.summary) + '</p>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ─── Inject animation keyframes ─── */
  if (!document.getElementById("cs-gen-styles")) {
    const style = document.createElement("style");
    style.id = "cs-gen-styles";
    style.textContent = `@keyframes csFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
  }

  /* ─── Enhanced Public API ─── */
  window.CortexCaseStudyGenerator = {
    generateCaseStudy,
    generateLocalCaseStudy,
    renderCaseStudyCards,
    renderCaseStudyHTML,
    version: '2.0.0',
  };
})();
