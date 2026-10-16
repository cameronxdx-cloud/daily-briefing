import Anthropic from "@anthropic-ai/sdk";

// Twilio rejects WhatsApp bodies over 1,600 characters.
export const WHATSAPP_LIMIT = 1600;

const SYSTEM = `You write a short WhatsApp news brief for people who live in Las Vegas.
You get a list of today's headlines from local Las Vegas outlets and major national outlets (CNN, AP, NPR, NBC, etc.).

Write it like this, plain text with WhatsApp formatting only (*bold*, _italic_), no markdown headings or links:

*🎰 Las Vegas*
• 4–6 bullets on the most important local stories (safety, traffic, government, schools, economy, the Strip, weather, sports). One sentence each, say what happened and why a local should care.

*🇺🇸 Nation & World*
• 3–4 bullets on the biggest national/world stories.

Rules: only use facts from the headlines given, never invent details. Merge stories that cover the same event. Skip celebrity gossip and ads. Keep the whole brief under 1,100 characters.`;

function headlineList(items, label) {
  if (!items.length) return `${label}: (none)\n`;
  return `${label}:\n` + items
    .map((i) => `- ${i.title} (${i.outlet})${i.summary ? ` — ${i.summary}` : ""}`)
    .join("\n") + "\n";
}

// Ask Claude for a brief. Returns null when no API key is configured so the
// caller can fall back to a plain headline list.
export async function summarizeWithClaude(news) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const { local, vegasNational, national } = news.sections;
  const prompt =
    headlineList([...local, ...vegasNational].slice(0, 30), "LAS VEGAS / NEVADA") +
    "\n" +
    headlineList(national.slice(0, 20), "NATIONAL / WORLD");

  const client = new Anthropic();
  // Server-side fallbacks retry on another model if this one declines.
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    console.warn("⚠️ Claude declined to summarize; using headline list instead.");
    return null;
  }
  const brief = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return brief || null;
}

// No-AI fallback: top headlines straight from the feeds.
export function headlineBrief(news) {
  const { local, vegasNational, national } = news.sections;
  const vegas = [...local, ...vegasNational].slice(0, 6);
  const lines = ["*🎰 Las Vegas*", ...vegas.map((i) => `• ${i.title} _(${i.outlet})_`)];
  if (national.length) {
    lines.push("", "*🇺🇸 Nation & World*", ...national.slice(0, 4).map((i) => `• ${i.title} _(${i.outlet})_`));
  }
  return lines.join("\n");
}

export function buildWhatsAppMessage({ brief, dateLabel, pageUrl }) {
  const header = `📰 *Vegas News Brief — ${dateLabel}*\n\n`;
  const footer = pageUrl ? `\n\n🔗 Full stories: ${pageUrl}` : "";
  const room = WHATSAPP_LIMIT - header.length - footer.length;
  let body = brief;
  if (body.length > room) {
    // Cut at the last full bullet that fits.
    body = body.slice(0, room - 1);
    body = body.slice(0, Math.max(body.lastIndexOf("\n"), 0)) || body;
    body += "\n…";
  }
  return header + body + footer;
}
