// Twilio accepting a message doesn't mean WhatsApp delivered it. These
// helpers wait for the final status and throw if any message didn't arrive,
// so the GitHub Actions run turns red instead of silently succeeding.

const DELIVERY_WAIT_S = 60;
const FINAL_STATUSES = new Set(["delivered", "read", "failed", "undelivered"]);
const DELIVERY_HINTS = {
  63015: "Your number left the Twilio Sandbox. Send \"join <your-code>\" to the sandbox number from WhatsApp (code: Twilio console → Messaging → Try it out → Send a WhatsApp message). Sandbox membership lasts 72 hours from your last message.",
  63016: "Outside WhatsApp's 24-hour window. Send any message to your Twilio WhatsApp number, or use an approved message template.",
  63003: "The recipient number isn't a WhatsApp account. Check YOUR_WHATSAPP_NUMBER (format: whatsapp:+17025551234).",
  63007: "TWILIO_WHATSAPP_FROM isn't a WhatsApp sender on this Twilio account.",
};

export async function waitForDelivery(client, sid) {
  const deadline = Date.now() + DELIVERY_WAIT_S * 1000;
  let msg;
  do {
    await new Promise((r) => setTimeout(r, 3000));
    msg = await client.messages(sid).fetch();
  } while (!FINAL_STATUSES.has(msg.status) && Date.now() < deadline);
  return msg;
}

export async function confirmDelivery(client, sids) {
  const results = await Promise.all(sids.map((sid) => waitForDelivery(client, sid)));
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
