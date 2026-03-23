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

  /* ─── Inject animation keyframes ─── */
  if (!document.getElementById("cs-gen-styles")) {
    const style = document.createElement("style");
    style.id = "cs-gen-styles";
    style.textContent = `@keyframes csFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
  }
})();
