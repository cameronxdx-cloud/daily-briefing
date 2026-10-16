// Las Vegas news app: pulls local + national headlines, builds an easy-to-read
// web page, and sends a summarized brief to WhatsApp through Twilio.
//
//   node src/vegas-news.js            build page + send WhatsApp
//   node src/vegas-news.js --dry-run  build page + print the message, don't send
//
// Output: site/vegas/index.html and site/vegas/news.json

import fs from "node:fs/promises";
import twilio from "twilio";
import { collectNews } from "./vegas/feeds.js";
import { summarizeWithClaude, headlineBrief, buildWhatsAppMessage } from "./vegas/summarize.js";
import { renderPage } from "./vegas/render.js";

const DRY_RUN = process.argv.includes("--dry-run");
const OUT_DIR = process.env.VEGAS_OUT_DIR ?? "site/vegas";

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
  const sent = [];
  for (const to of recipients) {
    const msg = await client.messages.create({ from: process.env.TWILIO_WHATSAPP_FROM, to, body: message });
    console.log(`📤 Handed to Twilio for ${to} — SID ${msg.sid}`);
    sent.push(msg.sid);
  }

  // Twilio accepting a message doesn't mean WhatsApp delivered it, so wait
  // for the final status and fail the run if any message didn't arrive.
  const results = await Promise.all(sent.map((sid) => waitForDelivery(client, sid)));
  const failed = results.filter((r) => r.status === "failed" || r.status === "undelivered");
  for (const r of results) {
    if (r.status === "failed" || r.status === "undelivered") {
      console.error(`❌ ${r.to}: ${r.status} — error ${r.errorCode}: ${r.errorMessage ?? "unknown"}`);
      if (DELIVERY_HINTS[r.errorCode]) console.error(`   👉 ${DELIVERY_HINTS[r.errorCode]}`);
    } else if (r.status === "delivered" || r.status === "read") {
      console.log(`✅ ${r.to}: ${r.status}`);
    } else {
      console.warn(`⏳ ${r.to}: still "${r.status}" after ${DELIVERY_WAIT_S}s — check the Twilio logs if it doesn't arrive.`);
    }
  }
  if (failed.length) throw new Error(`${failed.length} of ${results.length} WhatsApp message(s) were not delivered`);
}

const DELIVERY_WAIT_S = 60;
const FINAL_STATUSES = new Set(["delivered", "read", "failed", "undelivered"]);
const DELIVERY_HINTS = {
  63015: "Your number left the Twilio Sandbox. Send \"join <your-code>\" to the sandbox number from WhatsApp (code: Twilio console → Messaging → Try it out → Send a WhatsApp message). Re-join at least every 72 hours.",
  63016: "Outside WhatsApp's 24-hour window. Send any message to your Twilio WhatsApp number, or use an approved message template.",
  63003: "The recipient number isn't a WhatsApp account. Check YOUR_WHATSAPP_NUMBER (format: whatsapp:+17025551234).",
  63007: "TWILIO_WHATSAPP_FROM isn't a WhatsApp sender on this Twilio account.",
};

async function waitForDelivery(client, sid) {
  const deadline = Date.now() + DELIVERY_WAIT_S * 1000;
  let msg;
  do {
    await new Promise((r) => setTimeout(r, 3000));
    msg = await client.messages(sid).fetch();
  } while (!FINAL_STATUSES.has(msg.status) && Date.now() < deadline);
  return msg;
}

main().catch((err) => {
  console.error("❌ Vegas news failed:", err.message);
  process.exit(1);
});
