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
      max_tokens: 55,
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

  const [markets, ai, cars, sportscars, fashion, vegas, energy, spacex, lesson] = await Promise.all([
    ask(`NASDAQ mood for ${today}. 1 short sentence. Plain text only.`),
    ask(`One AI or tech fact for ${today}. 1 short sentence. Plain text only.`),
    ask(`One luxury car fact for ${today}, name a brand. 1 short sentence. Plain text only.`),
    ask(`One fact about Lamborghini, Ferrari, Porsche, or AMG for ${today}. 1 short sentence. Plain text only.`),
    ask(`One luxury fashion fact for ${today}, name a house. 1 short sentence. Plain text only.`),
    ask(`One surprising Las Vegas fact for ${today}. 1 short sentence. Plain text only.`),
    ask(`One energy market fact for ${today} — oil, solar, or how AI affects power demand. 1 short sentence. Plain text only.`),
    ask(`One SpaceX or space industry fact for ${today} — Starship, Starlink, or launches. 1 short sentence. Plain text only.`),
    ask(`Financial lesson for ${today}. Format: Q:[max 6 words] A:[max 9 words]. Plain text only.`),
  ]);

  const message = `☀️ *6AM Brief — ${today}*
📈 ${markets}
🤖 ${ai}
🚗 ${cars}
🏎️ ${sportscars}
👜 ${fashion}
🎰 ${vegas}
⚡ ${energy}
🚀 ${spacex}
🧠 ${lesson}
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
