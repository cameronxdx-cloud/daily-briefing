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
      max_tokens: 80,
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

  const [markets, ai, cars, sportscars, fashion, vegas, lesson] = await Promise.all([
    ask(`NASDAQ markets briefing for ${today}. 1 sentence. Cover market mood and one key factor. Plain text only.`),
    ask(`One AI or tech insight for ${today}. 1 sentence. Specific and surprising. Plain text only.`),
    ask(`One luxury car insight for ${today}. 1 sentence. Name a specific brand or model. Plain text only.`),
    ask(`Luxury automotive expert. One insight for ${today} about Lamborghini, Ferrari, Porsche, or Mercedes-AMG specifically. 1 sentence. Plain text only.`),
    ask(`One luxury fashion insight for ${today}. 1 sentence. Name a specific house or designer. Plain text only.`),
    ask(`Las Vegas expert. One surprising fact about Las Vegas, Nevada for ${today}. Rotate topics: history, casinos, real estate, food, entertainment, sports, culture, or mob history. 1 sentence. Plain text only.`),
    ask(`One financial lesson for ${today}. Format: Q: question (max 8 words). A: answer (max 12 words). Plain text only.`),
  ]);

  const message = `☀️ *Your 6 AM Briefing*
📈 *MARKETS*
${markets}
🤖 *AI & TECH*
${ai}
🚗 *LUXURY CARS*
${cars}
🏎️ *LAMBORGHINI • FERRARI • PORSCHE • AMG*
${sportscars}
👜 *FASHION*
${fashion}
🎰 *LAS VEGAS*
${vegas}
🧠 *LESSON*
${lesson}
_Have a great day. 🤝_`;

  console.log("\n── Preview ──────────────────────────────");
  console.log(message);
  console.log("Character count:", message.length);
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
