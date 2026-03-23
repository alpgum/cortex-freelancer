const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { workHistoryEntry, profile } = req.body || {};
    if (!workHistoryEntry || !workHistoryEntry.title) {
      return res.status(400).json({ error: "workHistoryEntry with title is required" });
    }

    let caseStudy;

    if (process.env.ANTHROPIC_API_KEY) {
      caseStudy = await generateWithClaude(workHistoryEntry, profile);
    } else {
      caseStudy = generateFromTemplate(workHistoryEntry, profile);
    }

    const htmlCard = buildHtmlCard(caseStudy, workHistoryEntry);

    return res.status(200).json({ caseStudy, htmlCard });
  } catch (err) {
    console.error("Case study generation error:", err);
    return res.status(500).json({ error: "Failed to generate case study" });
  }
};

async function generateWithClaude(entry, profile) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Transform this freelance project into a compelling portfolio case study.

Project Details:
- Title: ${entry.title}
- Client Rating: ${entry.rating || "N/A"}/5
- Earned: $${entry.earnedAmount || "N/A"}
- Hours Worked: ${entry.hoursWorked || "N/A"}
- Duration: ${entry.dateRange || "N/A"}
- Client Feedback: ${entry.feedbackText || "No feedback provided"}

Freelancer Profile:
- Name: ${profile?.name || "Freelancer"}
- Title: ${profile?.title || ""}
- Skills: ${(profile?.skills || []).join(", ")}

Structure the case study as JSON with these exact keys:
- challenge: What problem the client faced (2-3 sentences)
- approach: How the freelancer tackled it (2-3 sentences)
- solution: What was delivered (2-3 sentences)
- results: Measurable outcomes and impact (2-3 sentences, include specific metrics where possible)
- summary: One-line compelling summary

Professional tone, 150-250 words total. Return ONLY valid JSON, no markdown fences.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(cleaned);
}

function generateFromTemplate(entry, profile) {
  const name = profile?.name || "the freelancer";
  const skills = (profile?.skills || []).slice(0, 3).join(", ") || "specialized expertise";
  const hours = entry.hoursWorked ? `${entry.hoursWorked} hours` : "the project timeline";
  const amount = entry.earnedAmount ? `$${Number(entry.earnedAmount).toLocaleString()}` : "the agreed budget";
  const rating = entry.rating ? `${entry.rating}/5` : "high";

  return {
    challenge: `A client needed professional help with "${entry.title}". The project required ${skills} and had to be delivered within tight deadlines to meet business objectives.`,
    approach: `${name} analyzed the requirements thoroughly and developed a structured plan leveraging expertise in ${skills}. Clear milestones were established to ensure consistent progress and client alignment.`,
    solution: `The project was completed over ${hours}, delivering a comprehensive solution that met all specifications. ${entry.feedbackText ? `The client noted: "${entry.feedbackText.substring(0, 120)}${entry.feedbackText.length > 120 ? "..." : ""}"` : "The deliverables exceeded initial expectations."}`,
    results: `The project was valued at ${amount} and received a ${rating} star rating. The successful delivery demonstrated expertise in ${skills} and resulted in a satisfied client relationship.`,
    summary: `Successfully delivered "${entry.title}" — earning a ${rating} rating and ${amount} in revenue.`,
  };
}

function buildHtmlCard(caseStudy, entry) {
  const rating = entry.rating ? "⭐".repeat(Math.round(entry.rating)) : "";
  const amount = entry.earnedAmount ? `$${Number(entry.earnedAmount).toLocaleString()}` : "";

  return `<div class="case-study-card" style="background:#1a1a2e;border:1px solid #2d2d44;border-radius:12px;padding:24px;color:#e0e0e0;font-family:system-ui,sans-serif;max-width:640px;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
    <h3 style="margin:0;color:#00d4aa;font-size:18px;">${escapeHtml(entry.title)}</h3>
    <span style="font-size:14px;color:#888;">${rating} ${amount}</span>
  </div>
  <div style="margin-bottom:12px;">
    <h4 style="color:#7c83ff;margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Challenge</h4>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#ccc;">${escapeHtml(caseStudy.challenge)}</p>
  </div>
  <div style="margin-bottom:12px;">
    <h4 style="color:#7c83ff;margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Approach</h4>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#ccc;">${escapeHtml(caseStudy.approach)}</p>
  </div>
  <div style="margin-bottom:12px;">
    <h4 style="color:#7c83ff;margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Solution</h4>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#ccc;">${escapeHtml(caseStudy.solution)}</p>
  </div>
  <div style="margin-bottom:12px;">
    <h4 style="color:#7c83ff;margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Results</h4>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#ccc;">${escapeHtml(caseStudy.results)}</p>
  </div>
  <div style="border-top:1px solid #2d2d44;padding-top:12px;margin-top:8px;">
    <p style="margin:0;font-size:13px;color:#00d4aa;font-style:italic;">${escapeHtml(caseStudy.summary)}</p>
  </div>
</div>`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
