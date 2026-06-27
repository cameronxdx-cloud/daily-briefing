// ============================================================
//  Daily Intelligence Briefing — WhatsApp via Twilio + Claude
//  Runs every morning at 6:00 AM (Las Vegas / Pacific time)
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import twilio from "twilio";

// ── Clients ──────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ── Helpers ──────────────────────────────────────────────────
const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "America/Los_Angeles",
});

async function generate(prompt) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0].text.trim();
}

// ── Prompts ───────────────────────────────────────────────────
async function getMarketsBriefing() {
  return generate(
    `You are a sharp financial educator. Give a punchy 3-4 sentence NASDAQ & markets briefing for ${today}.
Cover: (1) current market mood/trend, (2) one sector leading or lagging, (3) one macro factor to watch today.
Plain text only — no markdown, no bullet points. Write like a smart friend texting you.`
  );
}

async function getAIInsight() {
  return generate(
    `You are a technology educator. Share ONE genuinely interesting AI or tech insight for ${today}.
Make it specific, educational, and surprising. Include a real-world analogy. 2-3 sentences.
Plain text only — no markdown, no bullet points.`
  );
}

async function getLuxuryCarInsight() {
  return generate(
    `You are a luxury automotive expert. Share ONE fascinating insight about luxury or high-performance cars for ${today}.
Name specific brands or models. Make it educational — engineering, design, or market insight. 2-3 sentences.
Plain text only — no markdown, no bullet points.`
  );
}

async function getLuxuryFashionInsight() {
  return generate(
    `You are a luxury fashion insider. Share ONE interesting insight about luxury fashion for ${today}.
Name specific houses or designers. Could be business strategy, craftsmanship, or heritage. 2-3 sentences.
Plain text only — no markdown, no bullet points.`
  );
}

async function getDailyLesson() {
  return generate(
    `Give one short "did you know" financial or business lesson for ${today}.
Pick from: market mechanics, investing concepts, luxury brand economics, or tech business models.
Format: Question on line 1, Answer on line 2. Keep each line under 20 words. Plain text only.`
  );
}

// ── Message Builder ───────────────────────────────────────────
async function buildMessage() {
  console.log("⏳ Generating briefing sections...");

  const [markets, ai, cars, fashion, lesson] = await Promise.all([
    getMarketsBriefing(),
    getAIInsight(),
    getLuxuryCarInsight(),
    getLuxuryFashionInsight(),
    getDailyLesson(),
  ]);

  return `☀️ *Good morning — your 6 AM briefing*
📅 ${today}

━━━━━━━━━━━━━━━━━━━━
📈 *NASDAQ & MARKETS*
━━━━━━━━━━━━━━━━━━━━
${markets}

━━━━━━━━━━━━━━━━━━━━
🤖 *AI & TECHNOLOGY*
━━━━━━━━━━━━━━━━━━━━
${ai}

━━━━━━━━━━━━━━━━━━━━
🚗 *LUXURY CARS*
━━━━━━━━━━━━━━━━━━━━
${cars}

━━━━━━━━━━━━━━━━━━━━
👜 *LUXURY FASHION*
━━━━━━━━━━━━━━━━━━━━
${fashion}

━━━━━━━━━━━━━━━━━━━━
🧠 *TODAY'S LESSON*
━━━━━━━━━━━━━━━━━━━━
${lesson}

_Have a great day. 🤝_`;
}

// ── Send via Twilio ───────────────────────────────────────────
async function sendWhatsApp(body) {
  const message = await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM, // e.g. whatsapp:+14155238886
    to: process.env.YOUR_WHATSAPP_NUMBER,   // e.g. whatsapp:+17025550100
    body,
  });
  console.log(`✅ Message sent! SID: ${message.sid}`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  try {
    console.log(`🌅 Starting daily briefing — ${today}`);
    const message = await buildMessage();
    console.log("\n── Preview ─────────────────────────────────");
    console.log(message);
    console.log("────────────────────────────────────────────\n");
    await sendWhatsApp(message);
  } catch (err) {
    console.error("❌ Briefing failed:", err.message);
    process.exit(1);
  }
}

main();
