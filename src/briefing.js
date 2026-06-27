import twilio from "twilio";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
  timeZone: "America/Los_Angeles",
});

async function ask(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text.trim();
}

async function main() {
  console.log(`🌅 Starting daily briefing — ${today}`);
  console.log("⏳ Generating briefing sections...");

  const [markets, ai, cars, fashion, lesson] = await Promise.all([
    ask(`Financial educator. 3-4 sentence NASDAQ & markets briefing for ${today}. Cover: market mood, one sector leading/lagging, one macro factor. Plain text only, no markdown.`),
    ask(`Tech educator. ONE interesting AI or tech insight for ${today}. Specific, educational, surprising. Include a real-world analogy. 2-3 sentences. Plain text only.`),
    ask(`Luxury automotive expert. ONE fascinating insight about luxury or high-performance cars for ${today}. Name specific brands/models. 2-3 sentences. Plain text only.`),
    ask(`Luxury fashion insider. ONE interesting insight about luxury fashion for ${today}. Name specific houses/designers. 2-3 sentences. Plain text only.`),
    ask(`One short financial or business lesson for ${today}. Format: Question on line 1, Answer on line 2. Under 20 words each. Plain text only.`),
  ]);

  const message = `☀️ *Good morning — your 6 AM briefing*
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

  console.log("\n── Preview ──────────────────────────────");
  console.log(message);
  console.log("─────────────────────────────────────────\n");

  const sent = await twilioClient.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to: process.env.YOUR_WHATSAPP_NUMBER,
    body: message,
  });

  console.log(`✅ Sent! SID: ${sent.sid}`);
}

main().catch((err) => {
  console.error("❌ Briefing failed:", err.message);
  process.exit(1);
});
