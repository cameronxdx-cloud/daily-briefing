// Las Vegas news app: pulls local + national headlines, builds an easy-to-read
// web page, and sends a summarized brief to WhatsApp through Twilio.
//
//   node src/vegas-news.js            build page + send WhatsApp
//   node src/vegas-news.js --dry-run  build page + print the message, don't send
//
// Output: site/index.html and site/news.json

import fs from "node:fs/promises";
import twilio from "twilio";
import { collectNews } from "./vegas/feeds.js";
import { summarizeWithClaude, headlineBrief, buildWhatsAppMessage } from "./vegas/summarize.js";
import { renderPage } from "./vegas/render.js";

const DRY_RUN = process.argv.includes("--dry-run");
const OUT_DIR = process.env.VEGAS_OUT_DIR ?? "site";

const dateLabel = new Date().toLocaleDateString("en-US", {
  weekday: "long", month: "long", day: "numeric", timeZone: "America/Los_Angeles",
});

async function main() {
  console.log(`📰 Vegas News Brief — ${dateLabel}`);
  console.log("⏳ Fetching feeds...");
  const news = await collectNews();

  for (const s of news.status) {
    console.log(`  ${s.ok ? "✓" : "✗"} ${s.name}${s.ok ? ` (${s.count})` : ` — ${s.error}`}`);
  }
  const { local, vegasNational, national } = news.sections;
  console.log(`📊 ${local.length} local · ${vegasNational.length} Vegas-in-national · ${national.length} national`);

  if (!local.length && !vegasNational.length && !national.length) {
    throw new Error("No stories fetched from any source");
  }

  console.log("🧠 Summarizing...");
  let brief = null;
  try {
    brief = await summarizeWithClaude(news);
  } catch (err) {
    console.warn(`⚠️ Claude summary failed (${err.message}); using headline list.`);
  }
  brief ??= headlineBrief(news);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(`${OUT_DIR}/index.html`, renderPage({ news, brief, dateLabel }));
  await fs.writeFile(`${OUT_DIR}/news.json`, JSON.stringify({ ...news, brief }, null, 2));
  console.log(`🖥️  Wrote ${OUT_DIR}/index.html`);

  const message = buildWhatsAppMessage({ brief, dateLabel, pageUrl: process.env.VEGAS_PAGE_URL });
  console.log("\n── WhatsApp preview ─────────────────────");
  console.log(message);
  console.log(`(${message.length} chars)`);
  console.log("─────────────────────────────────────────\n");

  if (DRY_RUN) {
    console.log("🧪 Dry run — not sending.");
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // YOUR_WHATSAPP_NUMBER may hold several comma-separated recipients.
  const recipients = (process.env.YOUR_WHATSAPP_NUMBER ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  if (!recipients.length) throw new Error("YOUR_WHATSAPP_NUMBER is not set");
  for (const to of recipients) {
    const sent = await client.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to, body: message });
    console.log(`✅ Sent to ${to} — SID ${sent.sid}`);
  }
}

main().catch((err) => {
  console.error("❌ Vegas news failed:", err.message);
  process.exit(1);
});
